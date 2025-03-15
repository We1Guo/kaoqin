// 全局变量
let currentDate = new Date();
let currentDetailDate = null; // 当前正在查看详情的日期
let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};
let pieceworkData = JSON.parse(localStorage.getItem('pieceworkData')) || {}; // 新增：计件薪资数据
let settings = JSON.parse(localStorage.getItem('settings')) || {
    baseSalary: 5000,
    dailyWorkHours: 8,
    workDaysPerMonth: 22,
    overtimeRate: 1.5,
    // 新增：计件薪资设置
    enablePiecework: false,
    pieceworkMinimum: 0,
    pieceworkBonus: 0
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    try {
        // 初始化页面
        updateTodayDate();
        renderCalendar();
        initStatsSelectors();
        updateStats(); // 这会默认初始化考勤薪资统计
        loadSettings();
        initPieceworkSelectors(); // 初始化计件薪资选择器
        
        // 初始化模态框
        const dayDetailModal = new bootstrap.Modal(document.getElementById('dayDetailModal'));
        
        // 获取类型切换按钮
        const attendanceBtn = document.getElementById('attendanceTypeBtn');
        const pieceworkBtn = document.getElementById('pieceworkTypeBtn');
        
        // 移除旧的事件监听器（如果有）
        if (attendanceBtn.onclick) attendanceBtn.removeEventListener('click', attendanceBtn.onclick);
        if (pieceworkBtn.onclick) pieceworkBtn.removeEventListener('click', pieceworkBtn.onclick);
        
        // 设置默认按钮状态 - 考勤薪资激活
        attendanceBtn.classList.add('btn-primary');
        pieceworkBtn.classList.add('btn-outline-primary');
        pieceworkBtn.classList.remove('btn-primary');
        
        // 确保显示区域正确
        document.getElementById('attendanceStatsSection').style.display = 'block';
        document.getElementById('pieceworkStatsSection').style.display = 'none';
        
        // 初始化统计报表的工资类型切换按钮 - 使用一次性函数防止闭包问题
        attendanceBtn.addEventListener('click', function() {
            toggleSalaryTypeDisplay('attendance');
        });
        
        pieceworkBtn.addEventListener('click', function() {
            toggleSalaryTypeDisplay('piecework');
        });
        
        // 绑定导航切换事件
        document.getElementById('calendarTab').addEventListener('click', (e) => {
            e.preventDefault();
            showPage('calendarPage');
        });
        
        document.getElementById('statsTab').addEventListener('click', (e) => {
            e.preventDefault();
            showPage('statsPage');
            updateStats();
        });
        
        document.getElementById('settingsTab').addEventListener('click', (e) => {
            e.preventDefault();
            showPage('settingsPage');
        });
        
        // 绑定计件薪资标签页点击事件
        document.getElementById('pieceworkTab').addEventListener('click', (e) => {
            e.preventDefault();
            showPage('pieceworkPage');
            // 设置默认日期为今天
            document.getElementById('pieceworkDate').valueAsDate = new Date();
            // 刷新显示
            showTodayPieceworkRecords();
        });
        
        // 绑定月份切换
        document.getElementById('prevMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });
        
        document.getElementById('nextMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
        
        // 绑定打卡按钮
        document.getElementById('checkIn').addEventListener('click', checkInOut);
        document.getElementById('recordOvertime').addEventListener('click', () => saveOvertime(true));
        document.getElementById('recordLeave').addEventListener('click', () => saveOvertime(false));
        
        // 绑定设置保存
        document.getElementById('saveSettings').addEventListener('click', saveSettings);
        
        // 绑定数据统计选择器 - 移除自动更新，改为只通过查询统计按钮触发
        // 移除年份和月份选择器的自动更新监听器
        // document.getElementById('statsYear').addEventListener('change', updateStats);
        // document.getElementById('statsMonth').addEventListener('change', updateStats);
        document.getElementById('generateStats').addEventListener('click', generateCustomStats);
        
        // 绑定计件薪资相关事件
        document.getElementById('savePiecework').addEventListener('click', savePieceworkRecord);
        
        // 新增：启用/禁用计件薪资核算显示
        document.getElementById('enablePiecework').addEventListener('change', function() {
            const pieceworkSettings = document.getElementById('pieceworkSettings');
            pieceworkSettings.style.display = this.checked ? 'block' : 'none';
        });
        
        // 绑定计件薪资页面中的明细/产品统计切换按钮
        document.getElementById('pieceworkDetailBtn').addEventListener('click', function() {
            togglePieceworkView('detail');
        });
        document.getElementById('productStatsBtn').addEventListener('click', function() {
            togglePieceworkView('product');
        });
        
        console.log('页面初始化完成');
    } catch (error) {
        console.error('初始化错误:', error);
    }
});

// 显示指定页面
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    document.getElementById(pageId).classList.add('active');
    
    // 高亮相应的导航项
    if (pageId === 'calendarPage') {
        document.getElementById('calendarTab').classList.add('active');
    } else if (pageId === 'statsPage') {
        document.getElementById('statsTab').classList.add('active');
    } else if (pageId === 'settingsPage') {
        document.getElementById('settingsTab').classList.add('active');
    } else if (pageId === 'pieceworkPage') {
        document.getElementById('pieceworkTab').classList.add('active');
    }
}

// 更新今日日期显示
function updateTodayDate() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('todayDate').textContent = today.toLocaleDateString('zh-CN', options);
}

// 渲染日历
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 更新月份标题
    const monthYearStr = new Date(year, month, 1).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
    document.getElementById('currentMonthYear').textContent = monthYearStr;
    
    // 获取当月第一天
    const firstDayOfMonth = new Date(year, month, 1);
    // 获取当月最后一天
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // 计算上月需要显示的天数
    const firstDayWeekday = firstDayOfMonth.getDay(); // 0 (周日) 到 6 (周六)
    
    // 计算总共需要的单元格数量
    const daysInMonth = lastDayOfMonth.getDate();
    const totalCells = Math.ceil((daysInMonth + firstDayWeekday) / 7) * 7;
    
    // 清空日历
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    // 填充日历单元格
    for (let i = 0; i < totalCells; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        const cellDate = new Date(year, month, i - firstDayWeekday + 1);
        const dateStr = formatDateString(cellDate);
        
        // 设置日期数字
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = cellDate.getDate();
        dayCell.appendChild(dayNumber);
        
        // 如果是其他月份的日期
        if (cellDate.getMonth() !== month) {
            dayCell.classList.add('other-month');
        }
        
        // 如果是周末
        if (cellDate.getDay() === 0 || cellDate.getDay() === 6) {
            dayCell.classList.add('weekend');
        }
        
        // 如果是今天
        if (cellDate.toDateString() === new Date().toDateString()) {
            dayCell.classList.add('today');
        }
        
        // 如果有考勤记录
        if (attendanceData[dateStr]) {
            // 首先检查是否有打卡记录，并添加相应的类
            if (attendanceData[dateStr].checkedIn) {
                // 如果是补打卡
                if (attendanceData[dateStr].isMakeup) {
                    dayCell.classList.add('makeup');
                } else {
                    dayCell.classList.add('checked-in');
                }
            }
            
            // 检查是否同时有加班和请假记录
            let hasOvertime = false;
            let hasLeave = false;
            
            // 检查overtime属性和leave属性
            if (attendanceData[dateStr].overtime) {
                const overtime = parseFloat(attendanceData[dateStr].overtime);
                if (overtime > 0) {
                    hasOvertime = true;
                } else if (overtime < 0) {
                    hasLeave = true;
                }
            }
            
            // 检查leave属性 (专门存储请假记录的属性)
            if (attendanceData[dateStr].leave && parseFloat(attendanceData[dateStr].leave) > 0) {
                hasLeave = true;
            }
            
            // 添加相应的类和指示器
            if (hasOvertime && hasLeave) {
                dayCell.classList.add('has-both');
                
                // 创建并添加加班指示器元素
                const overtimeIndicator = document.createElement('div');
                overtimeIndicator.className = 'overtime-indicator';
                dayCell.appendChild(overtimeIndicator);
                
                // 创建并添加请假指示器元素
                const leaveIndicator = document.createElement('div');
                leaveIndicator.className = 'leave-indicator';
                dayCell.appendChild(leaveIndicator);
            } else if (hasOvertime) {
                dayCell.classList.add('has-overtime');
            } else if (hasLeave) {
                dayCell.classList.add('has-leave');
            }
        }
        
        // 添加点击事件
        dayCell.addEventListener('click', () => showDayDetails(cellDate));
        
        calendarDays.appendChild(dayCell);
    }
}

// 打卡处理函数
function checkInOut() {
    const today = new Date();
    doCheckIn(today);
}

// 执行打卡
function doCheckIn(date) {
    // 检查是否是未来日期
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 重置时间部分，只比较日期
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    if (checkDate > today) {
        alert('不能为未来日期打卡！');
        return;
    }
    
    const dateStr = formatDateString(date);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN');
    
    // 检查是否已经打卡
    if (attendanceData[dateStr] && attendanceData[dateStr].checkedIn) {
        alert('今天已经打过卡了！');
        return;
    }
    
    // 创建新的打卡记录
    const isMakeup = date.toDateString() !== new Date().toDateString(); // 如果不是今天，则为补打卡
    
    // 记录打卡
    attendanceData[dateStr] = {
        checkedIn: true,
        time: timeStr,
        isMakeup: isMakeup
    };
    
    // 保存到本地存储
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    
    // 更新日历视图
    renderCalendar();
    
    if (isMakeup) {
        alert(`补打卡成功！日期：${dateStr}，时间：${timeStr}`);
    } else {
        alert(`打卡成功！时间：${timeStr}`);
    }
}

// 记录加班或请假
function saveOvertime(isOvertime) {
    const hoursInput = document.getElementById('overtimeHours');
    let hours = parseFloat(hoursInput.value);
    
    if (isNaN(hours) || hours <= 0) {
        alert('请输入大于0的有效时长！');
        return;
    }
    
    // 如果是请假，将时间变为负值
    if (isOvertime === false) {
        hours = -hours;
    }
    
    const today = new Date();
    const dateStr = formatDateString(today);
    
    if (!attendanceData[dateStr]) {
        attendanceData[dateStr] = {};
    }
    
    // 检查是否已有加班/请假记录
    let existingOvertime = 0;
    if (attendanceData[dateStr].overtime) {
        existingOvertime = parseFloat(attendanceData[dateStr].overtime);
    }

    // 如果已有加班/请假记录，需要处理冲突情况
    if (existingOvertime !== 0) {
        // 如果已有加班记录，且当前操作也是记录加班
        if (existingOvertime > 0 && isOvertime) {
            // 累加加班时间
            hours += existingOvertime;
        } 
        // 如果已有请假记录，且当前操作也是记录请假
        else if (existingOvertime < 0 && !isOvertime) {
            // 累加请假时间（负值）
            hours += existingOvertime;
        }
        // 如果已有加班记录，但当前操作是记录请假，或已有请假记录，但当前操作是记录加班
        // 我们需要分别存储加班和请假记录
        else {
            // 判断现有记录是加班还是请假
            if (existingOvertime > 0) {
                // 现有加班记录，新增请假记录
                attendanceData[dateStr].overtime = existingOvertime;
                attendanceData[dateStr].leave = Math.abs(hours); // 修复：请假时间必须用正值
            } else {
                // 现有请假记录，新增加班记录
                attendanceData[dateStr].overtime = hours;
                attendanceData[dateStr].leave = Math.abs(existingOvertime); // 请假时记录为正值
            }
            
            localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
            renderCalendar();
            updateStats();
            
            const message = isOvertime ? 
                `加班时间记录成功: ${hours}小时` : 
                `请假时间记录成功: ${Math.abs(hours)}小时`;
                
            alert(message);
            hoursInput.value = '';
            return;
        }
    }
    
    // 正常情况：记录加班或请假
    attendanceData[dateStr].overtime = hours;
    
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    renderCalendar();
    updateStats();
    
    const message = hours >= 0 ? 
        `加班时间记录成功: ${hours}小时` : 
        `请假时间记录成功: ${Math.abs(hours)}小时`;
        
    alert(message);
    hoursInput.value = '';
}

// 记录过去日期的加班或请假
function recordPastOvertime(date, isOvertime, hours = null) {
    const dateStr = formatDateString(date);
    
    // 如果未提供小时数，从模态框输入获取
    if (hours === null) {
        hours = parseFloat(isOvertime ? 
            document.getElementById('modalOvertimeHours').value : 
            document.getElementById('modalLeaveHours').value);
    }
    
    if (isNaN(hours)) {
        alert('请输入有效的小时数！');
        return;
    }
    
    // 如果是请假，将时间变为负值
    if (!isOvertime) {
        hours = -hours;
    }
    
    // 如果小时数为0，则清除记录
    if (hours === 0) {
        if (attendanceData[dateStr]) {
            if (isOvertime) {
                delete attendanceData[dateStr].overtime;
            } else {
                delete attendanceData[dateStr].leave;
            }
            localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
            alert('记录已清除！');
        }
        return;
    }
    
    // 必须先打卡才能记录加班/请假
    if (!attendanceData[dateStr] || !attendanceData[dateStr].checkedIn) {
        alert('请先完成打卡再记录加班/请假！');
        return;
    }
    
    // 检查是否已有加班/请假记录
    let existingOvertime = 0;
    let existingLeave = 0;
    
    if (attendanceData[dateStr].overtime) {
        existingOvertime = parseFloat(attendanceData[dateStr].overtime);
        if (existingOvertime < 0) {
            // 如果overtime为负值，表示请假
            existingLeave = Math.abs(existingOvertime);
            existingOvertime = 0;
        }
    }
    
    if (attendanceData[dateStr].leave) {
        existingLeave = parseFloat(attendanceData[dateStr].leave);
    }
    
    // 根据记录类型更新数据
    if (isOvertime) {
        attendanceData[dateStr].overtime = hours;
        // 保留可能存在的请假记录
        if (existingLeave > 0) {
            attendanceData[dateStr].leave = existingLeave;
        }
    } else {
        // 如果是请假
        if (existingOvertime > 0) {
            // 如果已有加班记录，单独存储请假记录
            attendanceData[dateStr].leave = Math.abs(hours);
        } else {
            // 否则用overtime字段的负值表示请假
            attendanceData[dateStr].overtime = hours;
        }
    }
    
    // 保存到本地存储
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    
    // 更新日历视图
    renderCalendar();
    
    const message = isOvertime ? 
        `已记录 ${hours} 小时加班！` : 
        `已记录 ${Math.abs(hours)} 小时请假！`;
        
    alert(message);
}

// 删除考勤记录
function deleteAttendance(dateStr) {
    if (confirm('确定要删除这条打卡记录吗？')) {
        delete attendanceData[dateStr];
        localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
        
        // 更新UI
        renderCalendar();
        
        // 如果在统计页面，更新统计数据
        if (document.getElementById('statsPage').classList.contains('active')) {
            // 获取当前选择的统计时间段
            const yearSelect = document.getElementById('statsYear');
            const monthSelect = document.getElementById('statsMonth');
            const selectedYear = parseInt(yearSelect.value);
            const selectedMonth = monthSelect.value;
            
            // 更新考勤薪资统计
            if (selectedMonth === 'all') {
                // 全年统计
                const startDate = new Date(selectedYear, 0, 1);
                const endDate = new Date(selectedYear, 11, 31);
                updateStatsForPeriod(startDate, endDate, `${selectedYear}年全年`, 'attendance');
            } else {
                // 月度统计
                const monthIndex = parseInt(selectedMonth);
                const startDate = new Date(selectedYear, monthIndex, 1);
                const endDate = new Date(selectedYear, monthIndex + 1, 0); // 当月最后一天
                updateStatsForPeriod(startDate, endDate, `${selectedYear}年${monthIndex + 1}月`, 'attendance');
            }
        }
        
        alert('打卡记录已删除！');
    }
}

// 显示日期详情
function showDayDetails(date) {
    try {
        // 先确保没有多余的模态框蒙版
        const existingBackdrops = document.querySelectorAll('.modal-backdrop');
        existingBackdrops.forEach(backdrop => {
            backdrop.remove();
        });
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // 保存当前查看的日期
        currentDetailDate = date;
        
        const dateStr = formatDateString(date);
        const dateDisplay = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        
        // 设置模态框标题
        document.getElementById('modalTitle').textContent = dateDisplay + ' 详情';
        
        const dayDetails = document.getElementById('dayDetails');
        let detailsHTML = '';
        
        // 如果有打卡记录
        if (attendanceData[dateStr] && attendanceData[dateStr].checkedIn) {
            detailsHTML += `<p><strong>打卡状态:</strong> <span class="text-success">已打卡</span>`;
            
            if (attendanceData[dateStr].isMakeup) {
                detailsHTML += ` <span class="badge bg-warning text-dark">补</span>`;
            }
            
            detailsHTML += `</p>`;
            detailsHTML += `<p><strong>打卡时间:</strong> ${attendanceData[dateStr].time}</p>`;
            
            // 检查加班记录
            let hasOvertime = false;
            let overtimeHours = 0;
            
            if (attendanceData[dateStr].overtime && parseFloat(attendanceData[dateStr].overtime) > 0) {
                hasOvertime = true;
                overtimeHours = parseFloat(attendanceData[dateStr].overtime);
            }
            
            // 检查请假记录 - 可能在overtime为负值或leave属性中
            let hasLeave = false;
            let leaveHours = 0;
            
            if (attendanceData[dateStr].overtime && parseFloat(attendanceData[dateStr].overtime) < 0) {
                hasLeave = true;
                leaveHours = Math.abs(parseFloat(attendanceData[dateStr].overtime));
            }
            
            if (attendanceData[dateStr].leave && parseFloat(attendanceData[dateStr].leave) > 0) {
                hasLeave = true;
                leaveHours = parseFloat(attendanceData[dateStr].leave);
            }
            
            // 显示加班情况
            if (hasOvertime) {
                detailsHTML += `<p><strong>加班时长:</strong> <span class="text-success">${overtimeHours} 小时</span></p>`;
            }
            
            // 显示请假情况
            if (hasLeave) {
                detailsHTML += `<p><strong>请假时长:</strong> <span class="text-danger">${leaveHours} 小时</span></p>`;
            }
        } else {
            detailsHTML += `<p><strong>打卡状态:</strong> <span class="text-danger">未打卡</span></p>`;
        }
        
        dayDetails.innerHTML = detailsHTML;
        
        // 显示模态框
        const modalElement = document.getElementById('dayDetailModal');
        if (!modalElement._bootstrap_modal) {
            modalElement._bootstrap_modal = new bootstrap.Modal(modalElement);
        }
        modalElement._bootstrap_modal.show();
        
        // 设置模态框中的加班和请假输入框
        if (document.getElementById('modalOvertimeHours')) {
            document.getElementById('modalOvertimeHours').value = '';
        }
        if (document.getElementById('modalLeaveHours')) {
            document.getElementById('modalLeaveHours').value = '';
        }
        
        // 为删除按钮添加文字
        const deleteBtn = document.getElementById('modalDeleteAttendance');
        if (deleteBtn && deleteBtn.innerHTML.indexOf('删除') === -1) {
            deleteBtn.innerHTML = '<i class="bi bi-trash"></i> 删除记录';
        }
        
        // 重新绑定模态框按钮事件
        document.getElementById('modalCheckIn').onclick = function() {
            if (currentDetailDate) {
                doCheckIn(currentDetailDate);
                renderCalendar();
                showDayDetails(currentDetailDate);
            }
        };
        
        document.getElementById('modalRecordOvertime').onclick = function() {
            if (currentDetailDate) {
                recordPastOvertime(currentDetailDate, true);
                renderCalendar();
                showDayDetails(currentDetailDate);
            }
        };
        
        document.getElementById('modalRecordLeave').onclick = function() {
            if (currentDetailDate) {
                recordPastOvertime(currentDetailDate, false);
                renderCalendar();
                showDayDetails(currentDetailDate);
            }
        };
        
        document.getElementById('modalDeleteAttendance').onclick = function() {
            if (currentDetailDate) {
                const dateStr = formatDateString(currentDetailDate);
                // 先关闭模态框
                modalElement._bootstrap_modal.hide();
                // 然后执行删除操作，删除函数内部会负责更新视图和数据
                deleteAttendance(dateStr);
            }
        };
    } catch (error) {
        console.error('显示日期详情错误:', error);
    }
}

// 初始化统计选择器
function initStatsSelectors() {
    const yearSelect = document.getElementById('statsYear');
    const currentYear = new Date().getFullYear();
    
    // 清空现有选项
    yearSelect.innerHTML = '';
    
    // 添加当前年份和过去5年
    for (let i = 0; i <= 5; i++) {
        const year = currentYear - i;
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year + '年';
        yearSelect.appendChild(option);
    }
    
    // 默认选择当前年月
    yearSelect.value = currentYear;
    document.getElementById('statsMonth').value = new Date().getMonth();
}

// 生成自定义统计
function generateCustomStats() {
    const year = document.getElementById('statsYear').value;
    const month = document.getElementById('statsMonth').value;
    
    // 获取当前激活的工资类型
    const isAttendanceActive = document.getElementById('attendanceTypeBtn').classList.contains('btn-primary');
    const salaryType = isAttendanceActive ? 'attendance' : 'piecework';
    
    console.log(`执行自定义统计: 年份=${year}, 月份=${month}, 类型=${salaryType}`);
    
    // 清除之前存储的日期范围，确保重新计算
    window.currentPieceworkDateRange = null;
    
    if (month === 'all') {
        // 年度统计
        updateYearlyStats(year, salaryType);
        
        // 如果当前是计件薪资视图，确保产品统计也更新
        if (salaryType === 'piecework') {
            updatePieceworkStatsForPeriod(year, 'all');
        }
    } else {
        // 月度统计
        updateMonthlyStats(year, month, salaryType);
        
        // 如果当前是计件薪资视图，确保产品统计也更新
        if (salaryType === 'piecework') {
            updatePieceworkStatsForPeriod(year, month);
        }
    }
}

// 更新月度统计
function updateMonthlyStats(year, month, salaryType = 'attendance') {
    // 确保month是数值类型
    const monthNum = parseInt(month);
    const startDate = new Date(year, monthNum, 1);
    const endDate = new Date(year, monthNum + 1, 0); // 当月最后一天
    
    const periodLabel = `${year}年${monthNum + 1}月`;
    updateStatsForPeriod(startDate, endDate, periodLabel, salaryType);
}

// 更新年度统计
function updateYearlyStats(year, salaryType = 'attendance') {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    const periodLabel = `${year}年全年`;
    updateStatsForPeriod(startDate, endDate, periodLabel, salaryType);
}

// 更新当前统计（仅用于初始加载，不再由选择器变化触发）
function updateStats() {
    // 获取选择器的当前值
    const statsYearSelect = document.getElementById('statsYear');
    const statsMonthSelect = document.getElementById('statsMonth');
    const year = parseInt(statsYearSelect.value);
    const monthValue = statsMonthSelect.value;
    
    // 显式重置按钮状态为考勤薪资
    const attendanceBtn = document.getElementById('attendanceTypeBtn');
    const pieceworkBtn = document.getElementById('pieceworkTypeBtn');
    
    console.log(`初始化统计: 年份=${year}, 月份=${monthValue}`);
    
    // 清除之前存储的日期范围，确保重新计算
    window.currentPieceworkDateRange = null;
    
    // 根据所选月份更新统计
    if (monthValue === 'all') {
        // 年度统计
        updateYearlyStats(year, 'attendance');
        // 更新计件薪资统计（不显示）
        updatePieceworkStatsForPeriod(year, 'all');
    } else {
        // 月度统计
        const month = parseInt(monthValue);
        updateMonthlyStats(year, month, 'attendance');
        // 更新计件薪资统计（不显示）
        updatePieceworkStatsForPeriod(year, month);
    }
    
    // 设置UI显示为考勤薪资
    attendanceBtn.classList.add('btn-primary');
    attendanceBtn.classList.remove('btn-outline-primary');
    pieceworkBtn.classList.add('btn-outline-primary');
    pieceworkBtn.classList.remove('btn-primary');
    
    // 显示考勤薪资区域，隐藏计件薪资区域
    document.getElementById('attendanceStatsSection').style.display = 'block';
    document.getElementById('pieceworkStatsSection').style.display = 'none';
}

// 更新指定时间段的统计
function updateStatsForPeriod(startDate, endDate, periodLabel, salaryType) {
    // 只更新数据，不切换UI
    if (salaryType === 'attendance') {
        // 计算考勤工资
        let workDays = 0;
        let overtimeHours = 0;
        let leaveHours = 0;
        const attendanceRecords = [];
        
        // 这里使用实际考勤数据进行统计
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = formatDateString(d);
            const attendance = attendanceData[dateStr];
            
            if (attendance && attendance.checkedIn) {
                workDays++;
                
                // 检查overtime属性中的加班或请假记录
                if (attendance.overtime) {
                    const overtime = parseFloat(attendance.overtime);
                    if (overtime > 0) {
                        overtimeHours += overtime;
                    } else if (overtime < 0) {
                        leaveHours += Math.abs(overtime);
                    }
                }
                
                // 检查专门的leave属性中的请假记录
                if (attendance.leave) {
                    const leave = parseFloat(attendance.leave);
                    if (leave > 0) {
                        leaveHours += leave;
                    }
                }
                
                attendanceRecords.push({
                    date: dateStr,
                    time: attendance.time,
                    overtime: attendance.overtime || 0,
                    leave: attendance.leave || 0,
                    isMakeup: attendance.isMakeup || false
                });
            }
        }
        
        // 计算出勤工资
        const attendanceSalary = calculateSalary(workDays, overtimeHours, leaveHours);
        
        // 更新考勤统计UI
        document.getElementById('workDays').textContent = workDays;
        
        // 更新加班/请假时长显示
        const overtimeText = `<span class="text-success">${overtimeHours}小时</span>/<span class="text-danger">${leaveHours}小时</span>`;
        document.getElementById('overtimeHoursTotal').innerHTML = overtimeText;
        
        document.getElementById('attendanceSalary').textContent = `¥${attendanceSalary.toFixed(2)}`;
        
        // 渲染考勤记录表
        renderAttendanceRecords(attendanceRecords);
    } 
    else if (salaryType === 'piecework') {
        // 更新计件薪资统计
        updatePieceworkStatsForPeriod(startDate, endDate);
    }
}

// 渲染考勤记录
function renderAttendanceRecords(records) {
    const tbody = document.getElementById('attendanceRecords');
    if (!tbody) {
        console.error('找不到考勤记录表格DOM元素');
        return;
    }
    
    tbody.innerHTML = '';
    
    // 按日期排序，从新到旧
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    records.forEach(record => {
        const row = document.createElement('tr');
        
        // 日期列
        const dateTd = document.createElement('td');
        const dateObj = new Date(record.date);
        dateTd.textContent = dateObj.toLocaleDateString('zh-CN');
        row.appendChild(dateTd);
        
        // 打卡时间列
        const timeTd = document.createElement('td');
        if (record.isMakeup) {
            timeTd.innerHTML = `${record.time} <span class="badge bg-warning text-dark">补</span>`;
        } else {
            timeTd.textContent = record.time;
        }
        row.appendChild(timeTd);
        
        // 加班/请假时长列
        const overtimeTd = document.createElement('td');
        let overtimeText = "";
        
        // 计算加班时长
        let overtimeHours = 0;
        if (record.overtime && parseFloat(record.overtime) > 0) {
            overtimeHours = parseFloat(record.overtime);
        }
        
        // 计算请假时长 (可能来自overtime负值或leave属性)
        let leaveHours = 0;
        if (record.overtime && parseFloat(record.overtime) < 0) {
            leaveHours = Math.abs(parseFloat(record.overtime));
        }
        if (record.leave && parseFloat(record.leave) > 0) {
            leaveHours += parseFloat(record.leave);
        }
        
        // 显示加班时长
        if (overtimeHours > 0) {
            overtimeText += `<span class="text-success">${overtimeHours}小时</span>`;
        } else {
            overtimeText += `<span class="text-muted">0小时</span>`;
        }
        
        // 添加分隔符
        overtimeText += '/';
        
        // 显示请假时长
        if (leaveHours > 0) {
            overtimeText += `<span class="text-danger">${leaveHours}小时</span>`;
        } else {
            overtimeText += `<span class="text-muted">0小时</span>`;
        }
        
        overtimeTd.innerHTML = overtimeText;
        row.appendChild(overtimeTd);
        
        // 操作列
        const actionTd = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.addEventListener('click', () => deleteAttendance(record.date));
        actionTd.appendChild(deleteBtn);
        row.appendChild(actionTd);
        
        tbody.appendChild(row);
    });
}

// 计算薪资
function calculateSalary(workDays, overtimeHours, leaveHours) {
    const dailySalary = settings.baseSalary / settings.workDaysPerMonth;
    const hourlyWage = dailySalary / settings.dailyWorkHours;
    
    // 基本工资（根据实际出勤天数）
    const basePay = dailySalary * workDays;
    
    // 加班费（使用加班系数）
    const overtimePay = hourlyWage * settings.overtimeRate * overtimeHours;
    
    // 请假扣款（使用基本工资，不用加班系数）
    const leavePay = hourlyWage * leaveHours;
    
    // 总工资 = 基本工资 + 加班费 - 请假扣款
    return basePay + overtimePay - leavePay;
}

// 新增：计算计件薪资
function calculatePieceworkSalary(records) {
    let totalSalary = 0;
    
    records.forEach(record => {
        totalSalary += record.count * record.price;
    });
    
    // 如果达到最低数量要求且有设置奖金，加上奖金
    const totalCount = records.reduce((sum, record) => sum + record.count, 0);
    if (settings.pieceworkMinimum > 0 && totalCount >= settings.pieceworkMinimum) {
        totalSalary += settings.pieceworkBonus;
    }
    
    return totalSalary;
}

// 加载设置
function loadSettings() {
    document.getElementById('baseSalary').value = settings.baseSalary;
    document.getElementById('dailyWorkHours').value = settings.dailyWorkHours;
    document.getElementById('workDaysPerMonth').value = settings.workDaysPerMonth;
    document.getElementById('overtimeRate').value = settings.overtimeRate;
    
    // 新增：加载计件薪资参数
    document.getElementById('enablePiecework').checked = settings.enablePiecework;
    document.getElementById('pieceworkMinimum').value = settings.pieceworkMinimum;
    document.getElementById('pieceworkBonus').value = settings.pieceworkBonus;
    
    // 更新计件薪资参数区域显示
    const pieceworkSettingsDiv = document.getElementById('pieceworkSettings');
    pieceworkSettingsDiv.style.display = settings.enablePiecework ? 'block' : 'none';
}

// 保存设置
function saveSettings() {
    settings.baseSalary = parseFloat(document.getElementById('baseSalary').value);
    settings.dailyWorkHours = parseFloat(document.getElementById('dailyWorkHours').value);
    settings.workDaysPerMonth = parseInt(document.getElementById('workDaysPerMonth').value);
    settings.overtimeRate = parseFloat(document.getElementById('overtimeRate').value);
    
    // 保存计件薪资参数
    settings.enablePiecework = document.getElementById('enablePiecework').checked;
    settings.pieceworkMinimum = parseInt(document.getElementById('pieceworkMinimum').value);
    settings.pieceworkBonus = parseFloat(document.getElementById('pieceworkBonus').value);
    
    localStorage.setItem('settings', JSON.stringify(settings));
    alert('设置已保存');
    
    // 更新数据统计
    updateStats();
}

// 格式化日期字符串 YYYY-MM-DD
function formatDateString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 初始化计件薪资选择器
function initPieceworkSelectors() {
    const yearSelect = document.getElementById('statsYear');
    const currentYear = new Date().getFullYear();
    
    if (yearSelect.options.length === 0) {
        for (let i = currentYear - 2; i <= currentYear + 2; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i + '年';
            if (i === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }
    }
    
    // 设置默认日期为今天
    document.getElementById('pieceworkDate').valueAsDate = new Date();
    
    // 添加日期选择器改变事件，重置成功提示
    document.getElementById('pieceworkDate').addEventListener('change', function() {
        // 日期改变时隐藏提示框
        const alertElement = document.querySelector('.recent-record-alert');
        if (alertElement) alertElement.style.display = 'none';
    });
}

// 新增：保存计件薪资记录
function savePieceworkRecord() {
    const type = document.getElementById('pieceworkType').value.trim();
    const count = parseInt(document.getElementById('pieceworkCount').value);
    const price = parseFloat(document.getElementById('pieceworkPrice').value);
    const note = document.getElementById('pieceworkNote').value.trim();
    const date = document.getElementById('pieceworkDate').valueAsDate;
    
    if (!type) {
        alert('请输入产品型号！');
        return;
    }
    
    if (isNaN(count) || count <= 0) {
        alert('请输入有效的计件数量！');
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        alert('请输入有效的单价！');
        return;
    }
    
    if (!date) {
        alert('请选择一个有效日期！');
        return;
    }
    
    const dateStr = formatDateString(date);
    
    if (!pieceworkData[dateStr]) {
        pieceworkData[dateStr] = [];
    }
    
    // 创建新记录
    const newRecord = {
        id: Date.now(), // 使用时间戳作为唯一ID
        type: type,
        count: count,
        price: price,
        note: note,
        timestamp: new Date().toISOString()
    };
    
    pieceworkData[dateStr].push(newRecord);
    localStorage.setItem('pieceworkData', JSON.stringify(pieceworkData));
    
    // 清空表单，但保留产品型号和单价（方便连续录入）
    document.getElementById('pieceworkCount').value = '';
    document.getElementById('pieceworkNote').value = '';
    
    // 显示成功信息
    const alertElement = document.querySelector('.recent-record-alert');
    const detailsElement = document.getElementById('recentRecordDetails');
    
    // 确定单价显示的小数位数
    const priceDecimalPlaces = price.toString().includes('.') ? 
        price.toString().split('.')[1].length : 2;
    const priceFormatted = price.toFixed(Math.min(Math.max(priceDecimalPlaces, 2), 3));
    
    // 使用横向格式显示记录信息 - 修复函数调用
    detailsElement.innerHTML = `${dateStr} | 产品型号: <strong>${type}</strong> | 数量: <strong>${count}件</strong> | 单价: <strong>${priceFormatted}元/件</strong> | 金额: <strong>${(count * price).toFixed(2)}元</strong>`;
    
    alertElement.style.display = 'block';
    
    // 弹出提示
    alert('计件薪资记录已保存！详细统计可在"数据统计"中查看。');
    
    // 如果在数据统计页面，更新当前统计
    if (document.getElementById('statsPage').classList.contains('active')) {
        updateStats();
    }
}

// 简化为只显示最新添加的记录
function showTodayPieceworkRecords() {
    // 由于我们不再在这里显示记录列表，此函数保留空壳以兼容其他可能的调用
    // 实际的记录显示已移至savePieceworkRecord函数中直接处理
    
    // 如果被直接调用（如页面加载时），确保提示框不显示
    const today = document.getElementById('pieceworkDate').valueAsDate;
    if (!today) return;
    
    const alertElement = document.querySelector('.recent-record-alert');
    alertElement.style.display = 'none';
}

// 修复删除计件记录后的显示问题
function deleteTodayPieceworkRecord(dateStr, recordId) {
    if (pieceworkData[dateStr]) {
        const index = pieceworkData[dateStr].findIndex(record => record.id === recordId);
        if (index !== -1) {
            if (confirm('确定要删除这条记录吗？')) {
                pieceworkData[dateStr].splice(index, 1);
                
                // 如果当日没有记录了，删除当日键
                if (pieceworkData[dateStr].length === 0) {
                    delete pieceworkData[dateStr];
                }
                
                localStorage.setItem('pieceworkData', JSON.stringify(pieceworkData));
                
                // 获取当前选择的统计时间段，无论是否在统计页面都确保视图更新
                const yearSelect = document.getElementById('statsYear');
                const monthSelect = document.getElementById('statsMonth');
                const selectedYear = parseInt(yearSelect.value);
                const selectedMonth = monthSelect.value;
                
                // 重新计算并显示计件薪资统计
                if (selectedMonth === 'all') {
                    // 统计全年
                    const startDate = new Date(selectedYear, 0, 1);
                    const endDate = new Date(selectedYear, 11, 31);
                    updatePieceworkStatsForPeriod(startDate, endDate);
                } else {
                    // 统计选定月份 - 注意月份索引从0开始
                    const monthIndex = parseInt(selectedMonth);
                    const startDate = new Date(selectedYear, monthIndex, 1);
                    const endDate = new Date(selectedYear, monthIndex + 1, 0); // 当月最后一天
                    updatePieceworkStatsForPeriod(startDate, endDate);
                }
                
                alert('记录已删除');
            }
        }
    }
}

// 更新指定时间段的计件薪资统计
function updatePieceworkStatsForPeriod(startDate, endDate) {
    try {
        console.log(`更新计件薪资统计: ${startDate} 到 ${endDate}`);
        
        // 如果输入的是字符串而不是日期对象，需要先转换
        if (typeof startDate === 'string' || typeof startDate === 'number') {
            const year = parseInt(startDate);
            if (typeof endDate === 'string') {
                if (endDate === 'all') {
                    // 年度统计
                    startDate = new Date(year, 0, 1);
                    endDate = new Date(year, 11, 31);
                    console.log(`转换为年度统计: ${startDate.toISOString()} 到 ${endDate.toISOString()}`);
                } else {
                    // 月度统计
                    const month = parseInt(endDate);
                    startDate = new Date(year, month, 1);
                    endDate = new Date(year, month + 1, 0); // 当月最后一天
                    console.log(`转换为月度统计: ${startDate.toISOString()} 到 ${endDate.toISOString()}`);
                }
            }
        }
        
        // 计算这个时间段内的记录
        let totalRecords = [];
        let totalCount = 0;
        let totalAmount = 0;
        let productTypes = new Set();
        
        // 收集时间范围内的所有记录
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = formatDateString(d);
            if (pieceworkData[dateStr]) {
                pieceworkData[dateStr].forEach(record => {
                    totalRecords.push({...record, date: dateStr});
                    totalCount += record.count;
                    totalAmount += record.count * record.price;
                    productTypes.add(record.type);
                });
            }
        }
        
        // 更新统计显示
        document.getElementById('reportPieceworkTypes').textContent = productTypes.size;
        document.getElementById('reportPieceworkTotal').textContent = totalCount;
        
        // 计算并显示总薪资
        const totalSalary = calculatePieceworkSalary(totalRecords);
        document.getElementById('reportPieceworkSalary').textContent = `¥${totalSalary.toFixed(2)}`;
        
        // 渲染计件记录表格
        renderPieceworkRecords(totalRecords);
        
        // 同时也更新产品统计视图
        updateProductStats(totalRecords);
        
    } catch (error) {
        console.error('更新计件薪资统计错误:', error);
    }
}

// 添加在统计页面切换考勤薪资和计件薪资的函数
function toggleSalaryTypeDisplay(type) {
    const attendanceBtn = document.getElementById('attendanceTypeBtn');
    const pieceworkBtn = document.getElementById('pieceworkTypeBtn');
    const attendanceStatsSection = document.getElementById('attendanceStatsSection');
    const pieceworkStatsSection = document.getElementById('pieceworkStatsSection');
    
    if (type === 'attendance') {
        // 切换到考勤薪资
        attendanceBtn.classList.add('btn-primary');
        attendanceBtn.classList.remove('btn-outline-primary');
        pieceworkBtn.classList.add('btn-outline-primary');
        pieceworkBtn.classList.remove('btn-primary');
        
        attendanceStatsSection.style.display = 'block';
        pieceworkStatsSection.style.display = 'none';
    } else if (type === 'piecework') {
        // 切换到计件薪资
        pieceworkBtn.classList.add('btn-primary');
        pieceworkBtn.classList.remove('btn-outline-primary');
        attendanceBtn.classList.add('btn-outline-primary');
        attendanceBtn.classList.remove('btn-primary');
        
        pieceworkStatsSection.style.display = 'block';
        attendanceStatsSection.style.display = 'none';
        
        // 生成当前选择的统计
        const year = document.getElementById('statsYear').value;
        const month = document.getElementById('statsMonth').value;
        
        // 更新计件薪资统计
        if (month === 'all') {
            updatePieceworkStatsForPeriod(year, 'all');
        } else {
            updatePieceworkStatsForPeriod(year, month);
        }
    }
}

// 切换计件薪资显示的明细和产品统计视图
function togglePieceworkView(type) {
    const detailBtn = document.getElementById('pieceworkDetailBtn');
    const productBtn = document.getElementById('productStatsBtn');
    const detailSection = document.getElementById('pieceworkDetailSection');
    const productSection = document.getElementById('productStatsSection');
    
    if (type === 'detail') {
        // 切换到明细视图
        detailBtn.classList.add('btn-primary');
        detailBtn.classList.remove('btn-outline-primary');
        productBtn.classList.add('btn-outline-primary');
        productBtn.classList.remove('btn-primary');
        
        detailSection.style.display = 'block';
        productSection.style.display = 'none';
    } else if (type === 'product') {
        // 切换到产品统计视图
        productBtn.classList.add('btn-primary');
        productBtn.classList.remove('btn-outline-primary');
        detailBtn.classList.add('btn-outline-primary');
        detailBtn.classList.remove('btn-primary');
        
        productSection.style.display = 'block';
        detailSection.style.display = 'none';
    }
}

// 渲染计件薪资记录表格
function renderPieceworkRecords(records) {
    const tbody = document.getElementById('reportPieceworkRecords');
    if (!tbody) {
        console.error('找不到计件记录表格DOM元素');
        return;
    }
    
    tbody.innerHTML = '';
    
    // 按日期排序，从新到旧
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    records.forEach(record => {
        const row = document.createElement('tr');
        
        // 日期列
        const dateTd = document.createElement('td');
        dateTd.textContent = record.date;
        row.appendChild(dateTd);
        
        // 类型列
        const typeTd = document.createElement('td');
        typeTd.textContent = record.type;
        row.appendChild(typeTd);
        
        // 数量列
        const countTd = document.createElement('td');
        countTd.textContent = record.count;
        row.appendChild(countTd);
        
        // 单价列
        const priceTd = document.createElement('td');
        priceTd.textContent = `¥${record.price.toFixed(2)}`;
        row.appendChild(priceTd);
        
        // 备注列
        const noteTd = document.createElement('td');
        noteTd.textContent = record.note || '-';
        row.appendChild(noteTd);
        
        // 工资列
        const salaryTd = document.createElement('td');
        salaryTd.textContent = `¥${(record.count * record.price).toFixed(2)}`;
        row.appendChild(salaryTd);
        
        // 操作列
        const actionTd = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.addEventListener('click', () => deleteTodayPieceworkRecord(record.date, record.id));
        actionTd.appendChild(deleteBtn);
        row.appendChild(actionTd);
        
        tbody.appendChild(row);
    });
}

// 更新产品统计视图
function updateProductStats(records) {
    const container = document.querySelector('.product-stats-container');
    if (!container) {
        console.error('找不到产品统计容器DOM元素');
        return;
    }
    
    container.innerHTML = '';
    
    // 按产品类型分组统计
    const productStats = {};
    
    records.forEach(record => {
        if (!productStats[record.type]) {
            productStats[record.type] = {
                type: record.type,
                totalCount: 0,
                totalAmount: 0
            };
        }
        
        productStats[record.type].totalCount += record.count;
        productStats[record.type].totalAmount += record.count * record.price;
    });
    
    // 将对象转换为数组并按总数量排序
    const statsArray = Object.values(productStats).sort((a, b) => b.totalCount - a.totalCount);
    
    // 创建产品统计表格
    const table = document.createElement('table');
    table.className = 'table table-striped';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>产品型号</th>
            <th>总数量</th>
            <th>总金额</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    statsArray.forEach(stat => {
        const row = document.createElement('tr');
        
        const typeTd = document.createElement('td');
        typeTd.textContent = stat.type;
        row.appendChild(typeTd);
        
        const countTd = document.createElement('td');
        countTd.textContent = stat.totalCount;
        row.appendChild(countTd);
        
        const amountTd = document.createElement('td');
        amountTd.textContent = `¥${stat.totalAmount.toFixed(2)}`;
        row.appendChild(amountTd);
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
}