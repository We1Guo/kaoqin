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
    try {
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
            
            // 设置数据属性，用于显示日期提示
            dayCell.dataset.date = dateStr;
            
            // 添加日期提示元素，确保不影响其他元素交互
            const dateTooltip = document.createElement('div');
            dateTooltip.className = 'date-tooltip';
            dateTooltip.textContent = dateStr;
            dateTooltip.style.pointerEvents = 'none'; // 确保不影响鼠标事件
            
            // 如果有打卡记录，添加到提示文本
            if (attendanceData[dateStr] && attendanceData[dateStr].checkedIn) {
                dateTooltip.textContent += " (已打卡)";
            }
            
            dayCell.appendChild(dateTooltip);
            
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
                const isCheckedIn = attendanceData[dateStr].checkedIn;
                const isMakeup = attendanceData[dateStr].isMakeup;
                const hasOvertime = attendanceData[dateStr].overtime && parseFloat(attendanceData[dateStr].overtime) > 0;
                const hasLeave = attendanceData[dateStr].leave && parseFloat(attendanceData[dateStr].leave) > 0;
                
                // 根据加班和请假状态设置不同的样式
                if (hasOvertime && hasLeave) {
                    // 同时有加班和请假，添加双色边框
                    dayCell.classList.add('has-overtime-and-leave');
                    
                    // 添加单独的打卡标记元素，而不是依赖::after伪元素
                    if (isCheckedIn) {
                        const checkMark = document.createElement('div');
                        checkMark.className = 'explicit-check-mark';
                        checkMark.textContent = '✓';
                        dayCell.appendChild(checkMark);
                    }
                } else if (hasOvertime) {
                    // 只有加班
                    dayCell.classList.add('has-overtime');
                    
                    // 正常添加打卡标记类
                    if (isCheckedIn) {
                        if (isMakeup) {
                            dayCell.classList.add('makeup');
                        } else {
                            dayCell.classList.add('checked-in');
                        }
                    }
                } else if (hasLeave) {
                    // 只有请假
                    dayCell.classList.add('has-leave');
                    
                    // 正常添加打卡标记类
                    if (isCheckedIn) {
                        if (isMakeup) {
                            dayCell.classList.add('makeup');
                        } else {
                            dayCell.classList.add('checked-in');
                        }
                    }
                } else {
                    // 既没有加班也没有请假，只处理打卡状态
                    if (isCheckedIn) {
                        if (isMakeup) {
                            dayCell.classList.add('makeup');
                        } else {
                            dayCell.classList.add('checked-in');
                        }
                    }
                }
            }
            
            // 添加点击事件，显示日期详情
            dayCell.addEventListener('click', function(e) {
                // 确保点击事件不被tooltip阻止
                e.stopPropagation();
                showDayDetails(cellDate);
            });
            
            calendarDays.appendChild(dayCell);
        }
    } catch (error) {
        console.error('渲染日历错误:', error);
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
    const hours = parseFloat(document.getElementById('overtimeHours').value);
    
    if (isNaN(hours) || hours <= 0) {
        alert('请输入有效的小时数！');
        return;
    }
    
    const today = new Date();
    const dateStr = formatDateString(today);
    
    if (!attendanceData[dateStr]) {
        alert('请先完成打卡再记录加班/请假！');
        return;
    }
    
    if (isOvertime) {
        attendanceData[dateStr].overtime = hours;
        alert(`已记录 ${hours} 小时加班！`);
    } else {
        attendanceData[dateStr].leave = hours;
        alert(`已记录 ${hours} 小时请假！`);
    }
    
    // 保存到本地存储
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    
    // 清空输入框
    document.getElementById('overtimeHours').value = '';
    
    // 更新日历视图
    renderCalendar();
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
    
    if (isOvertime) {
        attendanceData[dateStr].overtime = hours;
        alert(`已记录 ${hours} 小时加班！`);
    } else {
        attendanceData[dateStr].leave = hours;
        alert(`已记录 ${hours} 小时请假！`);
    }
    
    // 保存到本地存储
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    
    // 更新日历视图
    renderCalendar();
}

// 删除考勤记录
function deleteAttendance(dateStr) {
    if (confirm('确定要删除这条打卡记录吗？')) {
        delete attendanceData[dateStr];
        localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
        renderCalendar();
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
            
            // 显示加班或请假情况
            if (attendanceData[dateStr].overtime && parseFloat(attendanceData[dateStr].overtime) > 0) {
                detailsHTML += `<p><strong>加班时长:</strong> <span class="text-success">${attendanceData[dateStr].overtime} 小时</span></p>`;
            }
            
            if (attendanceData[dateStr].leave && parseFloat(attendanceData[dateStr].leave) > 0) {
                detailsHTML += `<p><strong>请假时长:</strong> <span class="text-danger">${attendanceData[dateStr].leave} 小时</span></p>`;
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
                deleteAttendance(dateStr);
                renderCalendar();
                modalElement._bootstrap_modal.hide();
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
                
                if (attendance.overtime) {
                    overtimeHours += parseFloat(attendance.overtime);
                }
                
                if (attendance.leave) {
                    leaveHours += parseFloat(attendance.leave);
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
        
        // 显示加班时长（绿色）
        if (record.overtime) {
            overtimeText += `<span class="text-success">${record.overtime}小时</span>`;
        } else {
            overtimeText += `<span class="text-muted">0小时</span>`;
        }
        
        // 添加分隔符
        overtimeText += '/';
        
        // 显示请假时长（红色）
        if (record.leave) {
            overtimeText += `<span class="text-danger">${record.leave}小时</span>`;
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
    
    // 加班费
    const overtimePay = hourlyWage * settings.overtimeRate * overtimeHours;
    
    // 请假扣款
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
    
    // 使用横向格式显示记录信息
    detailsElement.innerHTML = `${formatShortDate(dateStr)} | 产品型号: <strong>${type}</strong> | 数量: <strong>${count}件</strong> | 单价: <strong>${priceFormatted}元/件</strong> | 金额: <strong>${(count * price).toFixed(2)}元</strong>`;
    
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

// 保留函数以避免错误，但简化实现
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
            } else {
                // 默认为当年统计
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31);
                console.log(`转换为默认年度统计: ${startDate.toISOString()} 到 ${endDate.toISOString()}`);
            }
        }
        
        // 保存当前日期范围，供其他函数使用
        window.currentPieceworkDateRange = {
            startDate: startDate,
            endDate: endDate
        };
        
        let totalPieces = 0;
        let totalSalary = 0;
        let productTypes = new Set();
        const pieceworkRecords = [];
        
        // 统计数据 - 使用更高效的方式遍历日期
        const allDates = Object.keys(pieceworkData);
        for (const dateStr of allDates) {
            // 正确解析日期字符串（格式如：2023-03-15）
            const parts = dateStr.split('-');
            const recordDate = new Date(
                parseInt(parts[0]),    // 年
                parseInt(parts[1]) - 1, // 月（注意减1，因为月份从0开始）
                parseInt(parts[2])      // 日
            );
            
            // 检查日期是否在所选范围内
            if (recordDate >= startDate && recordDate <= endDate) {
                pieceworkData[dateStr].forEach(record => {
                    totalPieces += record.count;
                    const recordSalary = record.count * record.price;
                    totalSalary += recordSalary;
                    productTypes.add(record.type);
                    pieceworkRecords.push({
                        date: dateStr,
                        record: record
                    });
                });
            }
        }
        
        // 计算奖金（如果达到最低数量要求）
        if (settings.pieceworkMinimum > 0 && totalPieces >= settings.pieceworkMinimum) {
            totalSalary += settings.pieceworkBonus;
        }
        
        // 更新计件薪资统计卡片
        document.getElementById('reportPieceworkTypes').textContent = productTypes.size;
        document.getElementById('reportPieceworkTotal').textContent = totalPieces;
        document.getElementById('reportPieceworkSalary').textContent = `¥${totalSalary.toFixed(2)}`;
        
        // 渲染计件薪资记录表格
        renderReportPieceworkRecords(pieceworkRecords);
        
        // 如果当前显示的是产品统计视图，也更新产品统计
        if (document.getElementById('productStatsSection').style.display !== 'none') {
            renderProductStats();
        }
        
        console.log(`计件薪资统计完成: ${totalPieces}件, ¥${totalSalary.toFixed(2)}`);
    } catch (error) {
        console.error('更新计件薪资统计出错:', error);
    }
}

// 渲染计件薪资记录表格
function renderReportPieceworkRecords(records) {
    const tbody = document.getElementById('reportPieceworkRecords');
    tbody.innerHTML = '';
    
    // 按日期倒序排序
    records.sort((a, b) => {
        if (a.date === b.date) {
            return new Date(b.record.timestamp) - new Date(a.record.timestamp);
        }
        return new Date(b.date) - new Date(a.date);
    });
    
    if (records.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center">暂无计件记录</td>';
        tbody.appendChild(row);
        return;
    }
    
    records.forEach(item => {
        const { date, record } = item;
        const row = document.createElement('tr');
        
        // 计算该记录的薪资
        const salary = record.count * record.price;
        
        // 确定单价显示的小数位数
        const priceDecimalPlaces = record.price.toString().includes('.') ? 
            record.price.toString().split('.')[1].length : 2;
        const priceFormatted = record.price.toFixed(Math.min(Math.max(priceDecimalPlaces, 2), 3));
        
        row.innerHTML = `
            <td>${formatShortDate(date)}</td>
            <td>${record.type}</td>
            <td>${record.count}</td>
            <td>${record.note || '-'}</td>
            <td>¥${salary.toFixed(2)} <span class="text-muted small">(${priceFormatted}元/件)</span></td>
            <td>
                <button class="btn btn-sm btn-danger delete-piecework" data-date="${date}" data-id="${record.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // 绑定删除按钮事件
    document.querySelectorAll('.delete-piecework').forEach(btn => {
        btn.addEventListener('click', function() {
            const date = this.getAttribute('data-date');
            const id = parseInt(this.getAttribute('data-id'));
            deletePieceworkRecord(date, id);
        });
    });
}

// 删除计件薪资记录
function deletePieceworkRecord(dateStr, recordId) {
    if (confirm('确定要删除这条记录吗？')) {
        if (pieceworkData[dateStr]) {
            // 过滤出除了要删除的记录之外的所有记录
            pieceworkData[dateStr] = pieceworkData[dateStr].filter(record => record.id !== recordId);
            
            // 如果该日期下没有记录了，删除该日期的键
            if (pieceworkData[dateStr].length === 0) {
                delete pieceworkData[dateStr];
            }
            
            // 保存到本地存储
            localStorage.setItem('pieceworkData', JSON.stringify(pieceworkData));
            
            alert('记录已删除！');
            
            // 如果在统计报表页面，更新当前统计
            if (document.getElementById('statsPage').classList.contains('active')) {
                updatePieceworkStatsForPeriod(
                    document.getElementById('statsYear').value,
                    document.getElementById('statsMonth').value
                );
            }
        }
    }
}

// 切换工资类型显示
function toggleSalaryTypeDisplay(salaryType) {
    try {
        // 防止重复调用
        const attendanceBtn = document.getElementById('attendanceTypeBtn');
        const pieceworkBtn = document.getElementById('pieceworkTypeBtn');
        
        console.log(`尝试切换到: ${salaryType}`);
        
        // 如果当前已经是这个类型，就不重复切换
        if ((salaryType === 'attendance' && attendanceBtn.classList.contains('btn-primary')) ||
            (salaryType === 'piecework' && pieceworkBtn.classList.contains('btn-primary'))) {
            console.log(`已经是 ${salaryType} 类型，不重复切换`);
            return;
        }
        
        console.time('切换工资类型');
        // 获取各个元素
        const attendanceSection = document.getElementById('attendanceStatsSection');
        const pieceworkSection = document.getElementById('pieceworkStatsSection');
        
        console.log(`切换到: ${salaryType}, 当前按钮状态: 打卡=${attendanceBtn.classList.contains('btn-primary')}, 计件=${pieceworkBtn.classList.contains('btn-primary')}`);
        
        // 获取当前年月
        const statsYearSelect = document.getElementById('statsYear');
        const statsMonthSelect = document.getElementById('statsMonth');
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        
        // 如果当前没有选择任何值，则设置为当前年月
        if (!statsYearSelect.value) {
            statsYearSelect.value = currentYear.toString();
        }
        
        if (!statsMonthSelect.value || statsMonthSelect.value === 'all') {
            statsMonthSelect.value = currentMonth.toString();
        }
        
        // 先更新按钮状态，让界面感觉更快速响应
        if (salaryType === 'attendance') {
            console.log('切换为考勤薪资显示');
            // 更新按钮样式
            attendanceBtn.classList.add('btn-primary');
            attendanceBtn.classList.remove('btn-outline-primary');
            pieceworkBtn.classList.add('btn-outline-primary');
            pieceworkBtn.classList.remove('btn-primary');
        } 
        else if (salaryType === 'piecework') {
            console.log('切换为计件薪资显示');
            // 更新按钮样式
            pieceworkBtn.classList.add('btn-primary');
            pieceworkBtn.classList.remove('btn-outline-primary');
            attendanceBtn.classList.add('btn-outline-primary');
            attendanceBtn.classList.remove('btn-primary');
        }
        
        // 立即更新显示状态，不延迟
        if (salaryType === 'attendance') {
            // 显示考勤薪资区域，隐藏计件薪资区域
            attendanceSection.style.display = 'block';
            pieceworkSection.style.display = 'none';
            
            // 自动更新考勤薪资统计，注意不要传递salaryType参数，避免循环
            if (typeof updateMonthlyStats === 'function') {
                console.log('更新考勤薪资统计');
                updateMonthlyStats(statsYearSelect.value, statsMonthSelect.value);
            }
        } 
        else if (salaryType === 'piecework') {
            // 显示计件薪资区域，隐藏考勤薪资区域
            attendanceSection.style.display = 'none';
            pieceworkSection.style.display = 'block';
            
            // 自动更新计件薪资统计
            if (typeof updatePieceworkStatsForPeriod === 'function') {
                console.log('更新计件薪资统计');
                const year = statsYearSelect.value;
                const monthValue = statsMonthSelect.value;
                
                // 清除之前存储的日期范围，确保重新计算
                window.currentPieceworkDateRange = null;
                
                if (monthValue === 'all') {
                    // 年度统计
                    updatePieceworkStatsForPeriod(year, 'all');
                } else {
                    // 月度统计
                    const month = parseInt(monthValue);
                    updatePieceworkStatsForPeriod(year, month);
                }
            }
            
            // 重置计件薪资子视图为明细视图
            togglePieceworkView('detail');
        }
        
        console.log(`切换后: 打卡=${attendanceBtn.classList.contains('btn-primary')}, 计件=${pieceworkBtn.classList.contains('btn-primary')}`);
        console.timeEnd('切换工资类型');
    } catch (error) {
        console.error('工资类型切换出错:', error);
    }
}

// 切换计件薪资视图（明细/产品统计）
function togglePieceworkView(viewType) {
    const detailBtn = document.getElementById('pieceworkDetailBtn');
    const productBtn = document.getElementById('productStatsBtn');
    const detailSection = document.getElementById('pieceworkDetailSection');
    const productSection = document.getElementById('productStatsSection');
    
    if (viewType === 'detail') {
        // 更新按钮样式
        detailBtn.classList.add('btn-primary');
        detailBtn.classList.remove('btn-outline-primary');
        productBtn.classList.add('btn-outline-primary');
        productBtn.classList.remove('btn-primary');
        
        // 更新显示区域
        detailSection.style.display = 'block';
        productSection.style.display = 'none';
    } else if (viewType === 'product') {
        // 更新按钮样式
        productBtn.classList.add('btn-primary');
        productBtn.classList.remove('btn-outline-primary');
        detailBtn.classList.add('btn-outline-primary');
        detailBtn.classList.remove('btn-primary');
        
        // 更新显示区域
        detailSection.style.display = 'none';
        productSection.style.display = 'block';
        
        // 更新产品统计数据
        renderProductStats();
    }
}

// 渲染产品统计数据
function renderProductStats() {
    const container = document.querySelector('#productStatsSection .product-stats-container');
    container.innerHTML = '';
    
    try {
        // 使用当前已存储的日期范围，避免重复计算
        let startDate, endDate;
        
        if (window.currentPieceworkDateRange) {
            startDate = window.currentPieceworkDateRange.startDate;
            endDate = window.currentPieceworkDateRange.endDate;
            console.log(`使用已存储的日期范围: ${startDate.toISOString()} 到 ${endDate.toISOString()}`);
        } else {
            // 查找当前选择的时间范围内的记录
            const year = document.getElementById('statsYear').value;
            const monthSelect = document.getElementById('statsMonth');
            const month = monthSelect.value;
            
            if (month === 'all') {
                // 全年
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31);
            } else {
                // 指定月份
                startDate = new Date(year, month, 1);
                // 获取月末日期
                endDate = new Date(year, parseInt(month) + 1, 0);
            }
            console.log(`使用新计算的日期范围: ${startDate.toISOString()} 到 ${endDate.toISOString()}`);
        }
        
        // 创建标题栏
        const headerRow = document.createElement('div');
        headerRow.className = 'product-stats-header';
        headerRow.innerHTML = `
            <div class="product-header-type">产品型号</div>
            <div class="product-header-count">总数量</div>
            <div class="product-header-amount">工资金额</div>
        `;
        container.appendChild(headerRow);
        
        // 获取这段时间内的所有记录
        const productStats = {};
        let totalCount = 0;
        let totalAmount = 0;
        
        // 遍历所有日期的记录
        Object.keys(pieceworkData).forEach(dateStr => {
            // 正确解析日期字符串
            const parts = dateStr.split('-');
            const recordDate = new Date(
                parseInt(parts[0]), 
                parseInt(parts[1]) - 1, 
                parseInt(parts[2])
            );
            
            // 检查日期是否在所选范围内
            if (recordDate >= startDate && recordDate <= endDate) {
                // 遍历当天的所有记录
                pieceworkData[dateStr].forEach(record => {
                    const type = record.type;
                    const count = record.count;
                    const price = record.price;
                    const salary = count * price;
                    
                    // 更新产品统计
                    if (!productStats[type]) {
                        productStats[type] = {
                            total: 0,
                            salary: 0
                        };
                    }
                    
                    productStats[type].total += count;
                    productStats[type].salary += salary;
                    
                    // 更新总计
                    totalCount += count;
                    totalAmount += salary;
                });
            }
        });
        
        // 将统计结果转换为数组，以便排序
        const statsArray = Object.keys(productStats).map(type => {
            return {
                type: type,
                total: productStats[type].total,
                salary: productStats[type].salary
            };
        });
        
        // 按照总数量从高到低排序
        statsArray.sort((a, b) => b.total - a.total);
        
        // 渲染到界面
        if (statsArray.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'no-records-message';
            emptyMessage.textContent = '暂无产品记录';
            container.appendChild(emptyMessage);
            return;
        }
        
        // 添加所有产品项
        statsArray.forEach(item => {
            const productItem = document.createElement('div');
            productItem.className = 'product-stat-item';
            
            // 计算百分比
            const percentOfTotal = ((item.total / totalCount) * 100).toFixed(1);
            
            productItem.innerHTML = `
                <div class="product-type">${item.type}</div>
                <div class="product-count">${item.total}件 <span class="product-percent">(${percentOfTotal}%)</span></div>
                <div class="product-amount">¥${item.salary.toFixed(2)}</div>
            `;
            container.appendChild(productItem);
        });
        
        // 添加总计行
        const totalRow = document.createElement('div');
        totalRow.className = 'product-stat-total';
        totalRow.innerHTML = `
            <div class="product-type">总计</div>
            <div class="product-count">${totalCount}件</div>
            <div class="product-amount">¥${totalAmount.toFixed(2)}</div>
        `;
        container.appendChild(totalRow);
        
    } catch (error) {
        console.error('渲染产品统计出错:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'no-records-message';
        errorMessage.textContent = '统计数据出错';
        container.appendChild(errorMessage);
    }
}

// 格式化简短日期（如：2025-03-09）
function formatShortDate(dateStr) {
    return dateStr; // 保留完整日期格式
}