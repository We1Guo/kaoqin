// 全局变量
let currentDate = new Date();
let currentDetailDate = null; // 当前正在查看详情的日期
let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};
let pieceworkData = JSON.parse(localStorage.getItem('pieceworkData')) || {}; // 新增：计件工资数据
let settings = JSON.parse(localStorage.getItem('settings')) || {
    baseSalary: 5000,
    dailyWorkHours: 8,
    workDaysPerMonth: 22,
    overtimeRate: 1.5,
    // 新增：计件工资设置
    enablePiecework: false,
    pieceworkMinimum: 0,
    pieceworkBonus: 0
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化页面
    updateTodayDate();
    renderCalendar();
    initStatsSelectors();
    updateStats();
    loadSettings();
    initPieceworkSelectors(); // 初始化计件工资选择器
    
    // 初始化模态框
    const dayDetailModal = new bootstrap.Modal(document.getElementById('dayDetailModal'));
    
    // 初始化统计报表的工资类型切换按钮
    document.getElementById('attendanceTypeBtn').addEventListener('click', function() {
        toggleSalaryTypeDisplay('attendance');
        updateButtonState('attendance');
    });
    
    document.getElementById('pieceworkTypeBtn').addEventListener('click', function() {
        toggleSalaryTypeDisplay('piecework');
        updateButtonState('piecework');
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
    
    // 绑定计件工资标签页点击事件
    document.getElementById('pieceworkTab').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('pieceworkPage');
        // 设置默认日期为今天
        document.getElementById('pieceworkDate').valueAsDate = new Date();
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
    
    // 绑定统计报表选择器
    document.getElementById('generateStats').addEventListener('click', generateCustomStats);
    
    // 新增：绑定计件工资相关事件
    document.getElementById('savePiecework').addEventListener('click', savePieceworkRecord);
    document.getElementById('generatePieceworkStats').addEventListener('click', generatePieceworkStats);
    
    // 新增：启用/禁用计件工资设置显示
    document.getElementById('enablePiecework').addEventListener('change', function() {
        const pieceworkSettings = document.getElementById('pieceworkSettings');
        pieceworkSettings.style.display = this.checked ? 'block' : 'none';
    });
    
    // 绑定模态框按钮事件
    document.getElementById('modalCheckIn').addEventListener('click', () => {
        if (currentDetailDate) {
            doCheckIn(currentDetailDate);
            dayDetailModal.hide();
        }
    });
    
    document.getElementById('modalRecordOvertime').addEventListener('click', () => {
        if (currentDetailDate) {
            const hours = parseFloat(document.getElementById('modalOvertimeHours').value);
            if (isNaN(hours)) {
                alert('请输入有效的小时数！');
                return;
            }
            recordPastOvertime(currentDetailDate, true, hours);
            dayDetailModal.hide();
        }
    });
    
    document.getElementById('modalRecordLeave').addEventListener('click', () => {
        if (currentDetailDate) {
            const hours = parseFloat(document.getElementById('modalLeaveHours').value);
            if (isNaN(hours)) {
                alert('请输入有效的小时数！');
                return;
            }
            recordPastOvertime(currentDetailDate, false, hours);
            dayDetailModal.hide();
        }
    });
    
    // 绑定删除打卡按钮
    document.getElementById('modalDeleteAttendance').addEventListener('click', () => {
        if (currentDetailDate) {
            const dateStr = formatDateString(currentDetailDate);
            deleteAttendance(dateStr);
            dayDetailModal.hide();
        }
    });
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
            if (attendanceData[dateStr].checkedIn) {
                // 如果是补打卡
                if (attendanceData[dateStr].isMakeup) {
                    dayCell.classList.add('makeup');
                } else {
                    dayCell.classList.add('checked-in');
                }
            }
            
            // 区分加班和请假
            if (attendanceData[dateStr].overtime) {
                const overtime = parseFloat(attendanceData[dateStr].overtime);
                if (overtime > 0) {
                    dayCell.classList.add('has-overtime');
                } else if (overtime < 0) {
                    dayCell.classList.add('has-leave');
                }
            }
        }
        
        // 添加点击事件
        dayCell.addEventListener('click', () => showDayDetails(cellDate));
        
        calendarDays.appendChild(dayCell);
    }
}

// 打卡功能
function checkInOut() {
    doCheckIn(new Date());
}

// 执行打卡（支持当天和补打卡）
function doCheckIn(date) {
    const now = new Date();
    const dateStr = formatDateString(date);
    const isToday = date.toDateString() === now.toDateString();
    
    if (!attendanceData[dateStr]) {
        attendanceData[dateStr] = {};
    }
    
    attendanceData[dateStr].checkedIn = true;
    attendanceData[dateStr].checkTime = now.toLocaleTimeString();
    
    // 如果不是今天，标记为补打卡
    if (!isToday) {
        attendanceData[dateStr].isMakeup = true;
    }
    
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    renderCalendar();
    updateStats();
    
    const message = isToday ? '打卡成功！' : '补打卡成功！';
    alert(`${message}时间：${now.toLocaleTimeString()}`);
}

// 记录加班/请假时间
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

// 删除打卡记录
function deleteAttendance(dateStr) {
    if (confirm('确定要删除这条打卡记录吗？')) {
        delete attendanceData[dateStr];
        localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
        renderCalendar();
        updateStats();
        alert('记录已删除');
    }
}

// 日期详情和补打卡功能 - 使用模态框
function showDayDetails(date) {
    const dateStr = formatDateString(date);
    const dayData = attendanceData[dateStr] || {};
    const today = new Date();
    
    // 如果是未来日期，不允许打卡
    if (date > today) {
        alert('不能为未来日期打卡！');
        return;
    }
    
    // 保存当前查看的日期
    currentDetailDate = date;
    
    // 清空输入框
    document.getElementById('modalOvertimeHours').value = '';
    document.getElementById('modalLeaveHours').value = '';
    
    // 更新模态框标题
    document.getElementById('modalTitle').textContent = date.toLocaleDateString('zh-CN') + ' 详情';
    
    // 准备详情内容
    let detailsHTML = '';
    
    if (dayData.checkedIn) {
        detailsHTML += `<p><strong>打卡状态:</strong> ${dayData.isMakeup ? '已补打卡' : '已打卡'}</p>`;
        detailsHTML += `<p><strong>打卡时间:</strong> ${dayData.checkTime || '未记录'}</p>`;
        
        if (dayData.overtime) {
            const overtime = parseFloat(dayData.overtime);
            if (overtime > 0) {
                detailsHTML += `<p><strong>加班时长:</strong> <span class="overtime-positive">${overtime} 小时</span></p>`;
            } else if (overtime < 0) {
                detailsHTML += `<p><strong>请假时长:</strong> <span class="overtime-negative">${Math.abs(overtime)} 小时</span></p>`;
            }
        }
    } else {
        detailsHTML += `<p><strong>打卡状态:</strong> 未打卡</p>`;
    }
    
    document.getElementById('dayDetails').innerHTML = detailsHTML;
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('dayDetailModal'));
    modal.show();
}

// 为过去日期记录加班/请假 - 带预设时长
function recordPastOvertime(date, isOvertime, hours = null) {
    const dateStr = formatDateString(date);
    
    // 如果没有传入小时数，则需要询问
    if (hours === null) {
        const promptText = isOvertime ? 
            `请输入 ${date.toLocaleDateString('zh-CN')} 的加班时长(小时):` : 
            `请输入 ${date.toLocaleDateString('zh-CN')} 的请假时长(小时):`;
        
        const hoursInput = prompt(promptText, '');
        if (hoursInput === null) return; // 用户取消了输入
        
        hours = parseFloat(hoursInput);
        if (isNaN(hours) || hours <= 0) {
            alert('请输入大于0的有效时长！');
            return;
        }
    }
    
    // 如果是输入0，则清除加班/请假记录
    if (hours === 0) {
        if (attendanceData[dateStr] && attendanceData[dateStr].overtime !== undefined) {
            delete attendanceData[dateStr].overtime;
            localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
            renderCalendar();
            updateStats();
            alert('加班/请假记录已清除！');
            return;
        }
    }
    
    // 如果是请假，将时间变为负值
    if (!isOvertime) {
        hours = -hours;
    }
    
    // 如果日期不存在考勤记录，创建一个
    if (!attendanceData[dateStr]) {
        attendanceData[dateStr] = {
            checkedIn: true,
            checkTime: '补录',
            isMakeup: true
        };
    }
    
    attendanceData[dateStr].overtime = hours;
    
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    renderCalendar();
    updateStats();
    
    const message = hours > 0 ? 
        `${date.toLocaleDateString('zh-CN')} 加班记录成功: ${hours}小时` : 
        `${date.toLocaleDateString('zh-CN')} 请假记录成功: ${Math.abs(hours)}小时`;
        
    alert(message);
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
    let salaryType = 'attendance';
    if (document.getElementById('pieceworkTypeBtn').classList.contains('btn-primary')) {
        salaryType = 'piecework';
    }
    
    if (month === 'all') {
        updateYearlyStats(year, salaryType);
    } else {
        updateMonthlyStats(year, month, salaryType);
    }
}

// 更新月度统计
function updateMonthlyStats(year, month, salaryType) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    const periodLabel = `${year}年${parseInt(month) + 1}月`;
    updateStatsForPeriod(startDate, endDate, periodLabel, salaryType);
}

// 更新年度统计
function updateYearlyStats(year, salaryType) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    const periodLabel = `${year}年全年`;
    updateStatsForPeriod(startDate, endDate, periodLabel, salaryType);
}

// 更新当前统计（默认为当月）
function updateStats() {
    const today = new Date();
    updateMonthlyStats(today.getFullYear(), today.getMonth(), 'attendance');
}

// 更新指定时间段的统计
function updateStatsForPeriod(startDate, endDate, periodLabel, salaryType) {
    // 首先切换到正确的统计视图
    toggleSalaryTypeDisplay(salaryType);
    
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
                    makeup: attendance.isMakeup || false
                });
            }
        }
        
        // 计算出勤工资
        const attendanceSalary = calculateSalary(workDays, overtimeHours, leaveHours);
        
        // 更新考勤统计UI
        document.getElementById('workDays').textContent = workDays;
        document.getElementById('overtimeHoursTotal').textContent = `${overtimeHours}(加)/${leaveHours}(假)`;
        document.getElementById('attendanceSalary').textContent = `¥${attendanceSalary.toFixed(2)}`;
        
        // 渲染考勤记录表
        renderAttendanceRecords(attendanceRecords);
    } 
    else if (salaryType === 'piecework') {
        // 更新计件工资统计
        updatePieceworkStatsInReport(startDate, endDate);
    }
}

// 渲染考勤记录表
function renderAttendanceRecords(records) {
    const tbody = document.getElementById('attendanceRecords');
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.textContent = '暂无考勤记录';
        td.className = 'text-center text-muted';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }
    
    records.forEach(record => {
        const tr = document.createElement('tr');
        
        // 日期列
        const dateTd = document.createElement('td');
        const date = new Date(record.date);
        dateTd.textContent = date.toLocaleDateString('zh-CN');
        if (record.isMakeup) {
            const makeupBadge = document.createElement('span');
            makeupBadge.className = 'badge bg-warning ms-1';
            makeupBadge.textContent = '补';
            dateTd.appendChild(makeupBadge);
        }
        tr.appendChild(dateTd);
        
        // 打卡时间列
        const timeTd = document.createElement('td');
        timeTd.textContent = record.time;
        tr.appendChild(timeTd);
        
        // 加班/请假时长列
        const overtimeTd = document.createElement('td');
        const hours = parseFloat(record.overtime);
        if (hours > 0) {
            overtimeTd.textContent = `+${hours.toFixed(1)}h`;
            overtimeTd.className = 'overtime-positive';
        } else if (hours < 0) {
            overtimeTd.textContent = `-${Math.abs(hours).toFixed(1)}h`;
            overtimeTd.className = 'overtime-negative';
        } else {
            overtimeTd.textContent = '-';
        }
        tr.appendChild(overtimeTd);
        
        // 操作列
        const actionTd = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.addEventListener('click', () => deleteAttendance(record.date));
        actionTd.appendChild(deleteBtn);
        tr.appendChild(actionTd);
        
        tbody.appendChild(tr);
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

// 新增：计算计件工资
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
    
    // 新增：加载计件工资设置
    document.getElementById('enablePiecework').checked = settings.enablePiecework;
    document.getElementById('pieceworkMinimum').value = settings.pieceworkMinimum;
    document.getElementById('pieceworkBonus').value = settings.pieceworkBonus;
    
    // 根据是否启用计件工资显示/隐藏相关设置
    const pieceworkSettings = document.getElementById('pieceworkSettings');
    pieceworkSettings.style.display = settings.enablePiecework ? 'block' : 'none';
}

// 保存设置
function saveSettings() {
    settings.baseSalary = parseFloat(document.getElementById('baseSalary').value);
    settings.dailyWorkHours = parseFloat(document.getElementById('dailyWorkHours').value);
    settings.workDaysPerMonth = parseInt(document.getElementById('workDaysPerMonth').value);
    settings.overtimeRate = parseFloat(document.getElementById('overtimeRate').value);
    
    // 保存计件工资设置
    const enablePiecework = document.getElementById('enablePiecework').checked;
    const pieceworkStatusChanged = settings.enablePiecework !== enablePiecework;
    
    settings.enablePiecework = enablePiecework;
    settings.pieceworkMinimum = parseInt(document.getElementById('pieceworkMinimum').value);
    settings.pieceworkBonus = parseFloat(document.getElementById('pieceworkBonus').value);
    
    localStorage.setItem('settings', JSON.stringify(settings));
    
    // 根据计件工资启用状态更新UI
    if (pieceworkStatusChanged) {
        // 更新计件工资设置区域显示
        document.getElementById('pieceworkSettings').style.display = settings.enablePiecework ? 'block' : 'none';
        
        // 更新统计报表
        updateStats();
    }
    
    alert('设置已保存');
}

// 格式化日期字符串 YYYY-MM-DD
function formatDateString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 初始化计件工资选择器
function initPieceworkSelectors() {
    // 初始化年份选择器
    const currentYear = new Date().getFullYear();
    const yearSelect = document.getElementById('statsYear');
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
}

// 新增：保存计件工资记录
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
    
    // 显示最近添加的记录
    const totalSalary = count * price;
    const recordDetails = document.getElementById('recentRecordDetails');
    recordDetails.innerHTML = `${formatShortDate(dateStr)} | ${type} | ${count}件 | 单价: ¥${price.toFixed(2)} | 合计: ¥${totalSalary.toFixed(2)}`;
    
    const alertElement = document.querySelector('.recent-record-alert');
    alertElement.style.display = 'block';
    
    // 清空表单，但保留产品型号和单价（方便连续录入）
    document.getElementById('pieceworkCount').value = '';
    document.getElementById('pieceworkNote').value = '';
    
    alert('计件工资记录已保存！');
}

// 更新指定时间段的计件工资统计
function updatePieceworkStatsForPeriod(startDate, endDate) {
    let totalPieces = 0;
    let totalSalary = 0;
    let productTypes = new Set();
    const pieceworkRecords = [];
    
    // 统计数据
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateString(d);
        
        if (pieceworkData[dateStr]) {
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
    
    // 更新计件统计卡片
    document.getElementById('reportPieceworkTypes').textContent = productTypes.size;
    document.getElementById('reportPieceworkTotal').textContent = totalPieces;
    document.getElementById('reportPieceworkSalary').textContent = `¥${totalSalary.toFixed(2)}`;
    
    // 渲染计件记录表
    renderReportPieceworkRecords(pieceworkRecords);
}

// 渲染计件工资记录表格
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
    
    records.forEach(item => {
        const { date, record } = item;
        const row = document.createElement('tr');
        
        // 计算该记录的工资
        const salary = record.count * record.price;
        
        row.innerHTML = `
            <td>${formatShortDate(date)}</td>
            <td>${record.type}</td>
            <td>${record.count}</td>
            <td>${record.note || '-'}</td>
            <td>¥${salary.toFixed(2)}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // 如果有记录，添加产品类型统计信息
    if (records.length > 0) {
        // 按产品类型分组统计
        const typeStats = {};
        records.forEach(item => {
            const { record } = item;
            if (!typeStats[record.type]) {
                typeStats[record.type] = {
                    count: 0,
                    salary: 0
                };
            }
            typeStats[record.type].count += record.count;
            typeStats[record.type].salary += record.count * record.price;
        });
        
        // 添加分隔行
        const separatorRow = document.createElement('tr');
        separatorRow.className = 'table-secondary';
        separatorRow.innerHTML = `
            <td colspan="5" class="text-center fw-bold">
                <i class="bi bi-bar-chart-fill"></i> 产品类型统计
            </td>
        `;
        tbody.appendChild(separatorRow);
        
        // 按类型添加统计行
        Object.entries(typeStats).forEach(([type, stats]) => {
            const typeRow = document.createElement('tr');
            typeRow.className = 'table-light';
            typeRow.innerHTML = `
                <td colspan="2" class="fw-bold">${type}</td>
                <td class="fw-bold">${stats.count}</td>
                <td>-</td>
                <td class="fw-bold">¥${stats.salary.toFixed(2)}</td>
            `;
            tbody.appendChild(typeRow);
        });
    }
}

// 切换显示不同类型的工资统计
function toggleSalaryTypeDisplay(salaryType) {
    const attendanceSection = document.getElementById('attendanceStatsSection');
    const pieceworkSection = document.getElementById('pieceworkStatsSection');
    
    if (salaryType === 'attendance') {
        attendanceSection.style.display = 'block';
        pieceworkSection.style.display = 'none';
    } else if (salaryType === 'piecework') {
        attendanceSection.style.display = 'none';
        pieceworkSection.style.display = 'block';
        
        // 确保计件工资统计数据是最新的
        const year = document.getElementById('statsYear').value;
        const month = document.getElementById('statsMonth').value;
        updatePieceworkStatsInReport(year, month);
    }
}

// 在报表中更新计件工资统计
function updatePieceworkStatsInReport(startDate, endDate) {
    // 如果输入的是年月字符串，转换为Date对象
    if (typeof startDate === 'string' || typeof startDate === 'number') {
        const year = parseInt(startDate);
        if (typeof endDate === 'string' && endDate !== 'all') {
            // 月度统计
            const month = parseInt(endDate);
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0);
        } else {
            // 年度统计
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
        }
    }
    
    // 确保只有在启用计件工资时才显示统计
    if (!settings.enablePiecework) {
        alert('计件工资功能未启用，请在设置中启用该功能。');
        document.getElementById('salaryType').value = 'attendance';
        toggleSalaryTypeDisplay('attendance');
        return;
    }
    
    let totalPieces = 0;
    let totalSalary = 0;
    let productTypes = new Set();
    const pieceworkRecords = [];
    
    // 统计数据
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateString(d);
        
        if (pieceworkData[dateStr]) {
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
    
    // 更新计件统计卡片
    document.getElementById('reportPieceworkTypes').textContent = productTypes.size;
    document.getElementById('reportPieceworkTotal').textContent = totalPieces;
    document.getElementById('reportPieceworkSalary').textContent = `¥${totalSalary.toFixed(2)}`;
    
    // 渲染计件记录表
    renderReportPieceworkRecords(pieceworkRecords);
}

// 更新按钮状态
function updateButtonState(activeType) {
    const attendanceBtn = document.getElementById('attendanceTypeBtn');
    const pieceworkBtn = document.getElementById('pieceworkTypeBtn');
    
    if (activeType === 'attendance') {
        attendanceBtn.classList.add('btn-primary');
        attendanceBtn.classList.remove('btn-outline-primary');
        pieceworkBtn.classList.add('btn-outline-primary');
        pieceworkBtn.classList.remove('btn-primary');
    } else {
        pieceworkBtn.classList.add('btn-primary');
        pieceworkBtn.classList.remove('btn-outline-primary');
        attendanceBtn.classList.add('btn-outline-primary');
        attendanceBtn.classList.remove('btn-primary');
    }
}

// 新增：格式化简短日期（如：03-21）
function formatShortDate(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[1]}-${parts[2]}`;
}

// 新增：删除计件工资记录
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
                generateCustomStats();
            }
        }
    }
}
