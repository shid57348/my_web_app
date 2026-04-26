// Storage Manager
const Storage = {
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    }
};

// Medication Manager
const MedicationManager = {
    getMedications() {
        return Storage.get('medications', []);
    },

    saveMedications(medications) {
        return Storage.set('medications', medications);
    },

    addMedication(med) {
        const medications = this.getMedications();
        med.id = Date.now().toString();
        med.createdAt = new Date().toISOString();
        medications.push(med);
        return this.saveMedications(medications);
    },

    updateMedication(id, updates) {
        const medications = this.getMedications();
        const index = medications.findIndex(m => m.id === id);
        if (index !== -1) {
            medications[index] = { ...medications[index], ...updates };
            return this.saveMedications(medications);
        }
        return false;
    },

    deleteMedication(id) {
        let medications = this.getMedications();
        medications = medications.filter(m => m.id !== id);
        return this.saveMedications(medications);
    },

    getTodaySchedule() {
        const medications = this.getMedications();
        const today = new Date().toDateString();
        const schedule = [];

        const timeMap = {
            morning: '08:00',
            noon: '12:00',
            evening: '18:00',
            bedtime: '21:00'
        };

        medications.forEach(med => {
            if (med.isActive === false) return;

            if (med.startDate && new Date(med.startDate) > new Date()) return;
            if (med.endDate && new Date(med.endDate) < new Date()) return;

            if (med.times) {
                med.times.forEach(time => {
                    if (timeMap[time]) {
                        schedule.push({
                            id: `${med.id}-${time}`,
                            medId: med.id,
                            medName: med.name,
                            dosage: med.dosage,
                            time: timeMap[time],
                            timeLabel: time,
                            notes: med.notes || ''
                        });
                    }
                });
            }
        });

        schedule.sort((a, b) => a.time.localeCompare(b.time));
        return schedule;
    }
};

// Reminder Manager
const ReminderManager = {
    getSettings() {
        return Storage.get('reminderSettings', {
            browserNotification: false,
            advanceTime: 10,
            sound: 'default'
        });
    },

    saveSettings(settings) {
        return Storage.set('reminderSettings', settings);
    },

    getReminders() {
        return Storage.get('reminders', []);
    },

    saveReminders(reminders) {
        return Storage.set('reminders', reminders);
    },

    generateTodayReminders() {
        const schedule = MedicationManager.getTodaySchedule();
        const reminders = this.getReminders();
        const today = new Date().toDateString();

        const todayReminders = reminders.filter(r => 
            new Date(r.date).toDateString() === today
        );

        if (todayReminders.length === 0) {
            const newReminders = schedule.map(s => ({
                id: `reminder-${Date.now()}-${Math.random()}`,
                medId: s.medId,
                medName: s.medName,
                dosage: s.dosage,
                time: s.time,
                timeLabel: s.timeLabel,
                date: new Date().toISOString(),
                status: 'pending',
                notes: s.notes
            }));

            const allReminders = [...reminders, ...newReminders];
            this.saveReminders(allReminders);
            return newReminders;
        }

        return todayReminders;
    },

    updateReminderStatus(id, status) {
        const reminders = this.getReminders();
        const index = reminders.findIndex(r => r.id === id);
        if (index !== -1) {
            reminders[index].status = status;
            reminders[index].recordedAt = new Date().toISOString();
            return this.saveReminders(reminders);
        }
        return false;
    },

    checkReminders() {
        const settings = this.getSettings();
        if (!settings.browserNotification) return;

        const todayReminders = this.generateTodayReminders();
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        todayReminders.forEach(reminder => {
            if (reminder.status !== 'pending') return;

            const [hours, minutes] = reminder.time.split(':').map(Number);
            const reminderMinutes = hours * 60 + minutes;
            const advanceMinutes = settings.advanceTime || 0;

            if (Math.abs(currentMinutes - reminderMinutes) <= advanceMinutes) {
                this.showNotification(reminder);
            }
        });
    },

    showNotification(reminder) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('服药提醒', {
                body: `该服用 ${reminder.medName} 了，剂量：${reminder.dosage}`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💊</text></svg>',
                tag: reminder.id
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }

        showToast(`提醒：该服用 ${reminder.medName} 了！`, 'warning');
    },

    requestNotificationPermission() {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showToast('通知权限已开启');
                } else {
                    showToast('通知权限被拒绝，请在浏览器设置中开启', 'error');
                }
            });
        } else {
            showToast('您的浏览器不支持通知功能', 'error');
        }
    }
};

// Visit Manager
const VisitManager = {
    getVisits() {
        return Storage.get('visits', []);
    },

    saveVisits(visits) {
        return Storage.set('visits', visits);
    },

    addVisit(visit) {
        const visits = this.getVisits();
        visit.id = Date.now().toString();
        visit.createdAt = new Date().toISOString();
        visits.push(visit);
        return this.saveVisits(visits);
    },

    updateVisit(id, updates) {
        const visits = this.getVisits();
        const index = visits.findIndex(v => v.id === id);
        if (index !== -1) {
            visits[index] = { ...visits[index], ...updates };
            return this.saveVisits(visits);
        }
        return false;
    },

    deleteVisit(id) {
        let visits = this.getVisits();
        visits = visits.filter(v => v.id !== id);
        return this.saveVisits(visits);
    },

    getUpcomingVisits() {
        const visits = this.getVisits();
        const now = new Date();
        return visits
            .filter(v => new Date(v.date) >= now)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    getPastVisits() {
        const visits = this.getVisits();
        const now = new Date();
        return visits
            .filter(v => new Date(v.date) < now)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
};

// Records Manager
const RecordsManager = {
    getRecords() {
        return Storage.get('records', []);
    },

    saveRecords(records) {
        return Storage.set('records', records);
    },

    addRecord(record) {
        const records = this.getRecords();
        record.id = Date.now().toString();
        record.recordedAt = new Date().toISOString();
        records.push(record);
        return this.saveRecords(records);
    },

    getRecordsByDate(date) {
        const records = this.getRecords();
        const targetDate = new Date(date).toDateString();
        return records.filter(r => new Date(r.date).toDateString() === targetDate);
    },

    getTodayRecords() {
        return this.getRecordsByDate(new Date());
    },

    getWeekCompliance() {
        const records = this.getRecords();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const weekRecords = records.filter(r => new Date(r.date) >= weekAgo);
        const takenCount = weekRecords.filter(r => r.status === 'taken').length;

        if (weekRecords.length === 0) return 0;
        return Math.round((takenCount / weekRecords.length) * 100);
    }
};

// UI Functions
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    localStorage.setItem('activeTab', tabName);

    if (tabName === 'medications') renderMedications();
    if (tabName === 'reminders') renderReminders();
    if (tabName === 'visits') renderVisits();
    if (tabName === 'records') renderRecords();
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Medication Functions
function showAddMedicationModal() {
    document.getElementById('add-medication-form').reset();
    document.getElementById('med-start-date').value = new Date().toISOString().split('T')[0];
    showModal('add-medication-modal');
}

function addMedication(event) {
    event.preventDefault();

    const name = document.getElementById('med-name').value;
    const dosage = document.getElementById('med-dosage').value;
    const frequency = document.getElementById('med-frequency').value;
    const notes = document.getElementById('med-notes').value;
    const startDate = document.getElementById('med-start-date').value;
    const endDate = document.getElementById('med-end-date').value;

    const times = [];
    document.querySelectorAll('input[name="med-times"]:checked').forEach(cb => {
        times.push(cb.value);
    });

    if (times.length === 0) {
        showToast('请至少选择一个用药时段', 'error');
        return;
    }

    const medication = {
        name,
        dosage,
        frequency,
        times,
        notes,
        startDate,
        endDate,
        isActive: true
    };

    if (MedicationManager.addMedication(medication)) {
        showToast('药品添加成功！');
        closeModal('add-medication-modal');
        renderMedications();
    } else {
        showToast('添加失败，请重试', 'error');
    }
}

function deleteMedication(id) {
    if (confirm('确定要删除这个药品吗？')) {
        MedicationManager.deleteMedication(id);
        showToast('药品已删除');
        renderMedications();
    }
}

function renderMedications() {
    const schedule = MedicationManager.getTodaySchedule();
    const medications = MedicationManager.getMedications();

    const scheduleContainer = document.getElementById('today-schedule');
    if (schedule.length === 0) {
        scheduleContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <p>今日暂无用药计划</p>
                <p>请先添加药品</p>
            </div>
        `;
    } else {
        scheduleContainer.innerHTML = schedule.map(item => `
            <div class="schedule-item">
                <div class="schedule-time">${item.time}</div>
                <div class="schedule-info">
                    <div class="schedule-med-name">${item.medName}</div>
                    <div class="schedule-detail">${item.dosage} ${item.notes ? '| ' + item.notes : ''}</div>
                </div>
            </div>
        `).join('');
    }

    const medsContainer = document.getElementById('medications-container');
    if (medications.length === 0) {
        medsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💊</div>
                <p>暂无药品信息</p>
                <button class="btn btn-primary" onclick="showAddMedicationModal()">添加第一个药品</button>
            </div>
        `;
    } else {
        medsContainer.innerHTML = medications.map(med => `
            <div class="medication-card">
                <div class="med-card-header">
                    <span class="med-name">${med.name}</span>
                    <span class="badge badge-primary">${med.frequency}</span>
                </div>
                <div class="med-card-body">
                    <p>剂量：${med.dosage}</p>
                    <p>时段：${med.times.map(t => getTimeLabel(t)).join('、')}</p>
                    ${med.notes ? `<p>备注：${med.notes}</p>` : ''}
                    ${med.startDate ? `<p>开始日期：${med.startDate}</p>` : ''}
                    ${med.endDate ? `<p>结束日期：${med.endDate}</p>` : ''}
                </div>
                <div class="med-card-actions">
                    <button class="btn btn-danger btn-small" onclick="deleteMedication('${med.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }
}

function getTimeLabel(time) {
    const labels = {
        morning: '早餐后(8:00)',
        noon: '午餐后(12:00)',
        evening: '晚餐后(18:00)',
        bedtime: '睡前(21:00)'
    };
    return labels[time] || time;
}

// Import/Export Functions
function showImportModal() {
    document.getElementById('import-file').value = '';
    showModal('import-modal');
}

function importMedications() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];

    if (!file) {
        showToast('请选择要导入的文件', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (data.medications && Array.isArray(data.medications)) {
                const existing = MedicationManager.getMedications();
                const merged = [...existing, ...data.medications];
                MedicationManager.saveMedications(merged);
                showToast(`成功导入 ${data.medications.length} 个药品`);
                closeModal('import-modal');
                renderMedications();
            } else {
                showToast('文件格式不正确', 'error');
            }
        } catch (err) {
            showToast('文件解析失败，请检查文件格式', 'error');
        }
    };
    reader.readAsText(file);
}

function exportMedications() {
    const medications = MedicationManager.getMedications();

    if (medications.length === 0) {
        showToast('暂无药品可导出', 'error');
        return;
    }

    const data = {
        exportDate: new Date().toISOString(),
        medications: medications
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `用药信息_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('导出成功');
}

// Reminder Functions
function renderReminders() {
    const settings = ReminderManager.getSettings();

    document.getElementById('browser-notification-toggle').checked = settings.browserNotification || false;
    document.getElementById('advance-reminder-time').value = settings.advanceTime || 10;
    document.getElementById('reminder-sound').value = settings.sound || 'default';

    const reminders = ReminderManager.generateTodayReminders();
    const statusContainer = document.getElementById('reminder-status-list');

    if (reminders.length === 0) {
        statusContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔔</div>
                <p>今日暂无服药提醒</p>
            </div>
        `;
    } else {
        statusContainer.innerHTML = reminders.map(r => `
            <div class="reminder-item ${r.status}">
                <div class="reminder-time">${r.time}</div>
                <div class="reminder-info">
                    <strong>${r.medName}</strong> - ${r.dosage}
                    ${r.notes ? `<br><small>${r.notes}</small>` : ''}
                </div>
                <div class="reminder-actions">
                    ${r.status === 'pending' ? `
                        <button class="btn btn-primary btn-small" onclick="takeMedication('${r.id}')">已服用</button>
                        <button class="btn btn-danger btn-small" onclick="skipMedication('${r.id}')">未服用</button>
                    ` : `
                        <span class="record-status ${r.status}">
                            ${r.status === 'taken' ? '已服用' : '未服用'}
                        </span>
                    `}
                </div>
            </div>
        `).join('');
    }
}

function saveReminderSettings() {
    const settings = {
        browserNotification: document.getElementById('browser-notification-toggle').checked,
        advanceTime: parseInt(document.getElementById('advance-reminder-time').value),
        sound: document.getElementById('reminder-sound').value
    };

    ReminderManager.saveSettings(settings);

    if (settings.browserNotification) {
        ReminderManager.requestNotificationPermission();
    }

    showToast('提醒设置已保存');
}

function takeMedication(reminderId) {
    ReminderManager.updateReminderStatus(reminderId, 'taken');

    const reminder = ReminderManager.getReminders().find(r => r.id === reminderId);
    if (reminder) {
        RecordsManager.addRecord({
            medId: reminder.medId,
            medName: reminder.medName,
            dosage: reminder.dosage,
            time: reminder.time,
            date: new Date().toISOString(),
            status: 'taken'
        });
    }

    showToast('已记录服药');
    renderReminders();
}

function skipMedication(reminderId) {
    ReminderManager.updateReminderStatus(reminderId, 'missed');

    const reminder = ReminderManager.getReminders().find(r => r.id === reminderId);
    if (reminder) {
        RecordsManager.addRecord({
            medId: reminder.medId,
            medName: reminder.medName,
            dosage: reminder.dosage,
            time: reminder.time,
            date: new Date().toISOString(),
            status: 'missed'
        });
    }

    showToast('已记录未服药', 'warning');
    renderReminders();
}

// Visit Functions
function showAddVisitModal() {
    document.getElementById('add-visit-form').reset();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    document.getElementById('visit-date').value = nextMonth.toISOString().split('T')[0];
    showModal('add-visit-modal');
}

function addVisit(event) {
    event.preventDefault();

    const visit = {
        department: document.getElementById('visit-dept').value,
        doctor: document.getElementById('visit-doctor').value,
        date: document.getElementById('visit-date').value,
        notes: document.getElementById('visit-notes').value
    };

    if (VisitManager.addVisit(visit)) {
        showToast('复诊计划添加成功！');
        closeModal('add-visit-modal');
        renderVisits();
    } else {
        showToast('添加失败，请重试', 'error');
    }
}

function deleteVisit(id) {
    if (confirm('确定要删除这个复诊计划吗？')) {
        VisitManager.deleteVisit(id);
        showToast('复诊计划已删除');
        renderVisits();
    }
}

function editVisitDate(id) {
    const newDate = prompt('请输入新的复诊日期（YYYY-MM-DD）：');
    if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        VisitManager.updateVisit(id, { date: newDate });
        showToast('复诊日期已更新');
        renderVisits();
    } else if (newDate) {
        showToast('日期格式不正确', 'error');
    }
}

function renderVisits() {
    const upcoming = VisitManager.getUpcomingVisits();
    const past = VisitManager.getPastVisits();
    const container = document.getElementById('visits-container');

    if (upcoming.length === 0 && past.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏥</div>
                <p>暂无复诊计划</p>
                <button class="btn btn-primary" onclick="showAddVisitModal()">添加复诊计划</button>
            </div>
        `;
        return;
    }

    let html = '';

    if (upcoming.length > 0) {
        html += '<h3> upcoming复诊</h3>';
        html += upcoming.map(v => {
            const daysUntil = Math.ceil((new Date(v.date) - new Date()) / (1000 * 60 * 60 * 24));
            let badge = '';
            if (daysUntil <= 3) {
                badge = '<span class="badge badge-danger">即将到期</span>';
            } else if (daysUntil <= 7) {
                badge = '<span class="badge badge-warning">即将到来</span>';
            }

            return `
                <div class="visit-card">
                    <div class="visit-card-header">
                        <span class="visit-dept">${v.department} ${v.doctor ? '- ' + v.doctor : ''}</span>
                        ${badge}
                    </div>
                    <div class="visit-card-body">
                        <p class="visit-date">复诊日期：${v.date}</p>
                        <p>距今：${daysUntil} 天</p>
                        ${v.notes ? `<p>备注：${v.notes}</p>` : ''}
                    </div>
                    <div class="med-card-actions">
                        <button class="btn btn-secondary btn-small" onclick="editVisitDate('${v.id}')">修改日期</button>
                        <button class="btn btn-danger btn-small" onclick="deleteVisit('${v.id}')">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (past.length > 0) {
        html += '<h3>历史复诊</h3>';
        html += past.slice(0, 5).map(v => `
            <div class="visit-card" style="opacity: 0.7;">
                <div class="visit-card-header">
                    <span class="visit-dept">${v.department} ${v.doctor ? '- ' + v.doctor : ''}</span>
                </div>
                <div class="visit-card-body">
                    <p>复诊日期：${v.date}</p>
                    ${v.notes ? `<p>备注：${v.notes}</p>` : ''}
                </div>
                <div class="med-card-actions">
                    <button class="btn btn-danger btn-small" onclick="deleteVisit('${v.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    container.innerHTML = html;
}

// Records Functions
function renderRecords() {
    const dateFilter = document.getElementById('record-date-filter');
    if (!dateFilter.value) {
        dateFilter.value = new Date().toISOString().split('T')[0];
    }

    const records = RecordsManager.getRecordsByDate(dateFilter.value);
    const todayRecords = RecordsManager.getTodayRecords();
    const weekCompliance = RecordsManager.getWeekCompliance();

    document.getElementById('stat-today-total').textContent = todayRecords.length;
    document.getElementById('stat-today-taken').textContent = todayRecords.filter(r => r.status === 'taken').length;
    document.getElementById('stat-week-compliance').textContent = weekCompliance + '%';

    const container = document.getElementById('records-container');

    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>该日期暂无用药记录</p>
            </div>
        `;
    } else {
        container.innerHTML = records.map(r => `
            <div class="record-item">
                <div class="record-med">
                    <div class="record-med-name">${r.medName}</div>
                    <div class="record-med-detail">${r.dosage} - ${r.time}</div>
                </div>
                <span class="record-status ${r.status}">
                    ${r.status === 'taken' ? '已服用' : '未服用'}
                </span>
                <div class="record-actions">
                    <button class="btn btn-danger btn-small" onclick="deleteRecord('${r.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }
}

function loadRecords() {
    renderRecords();
}

function deleteRecord(id) {
    if (confirm('确定要删除这条记录吗？')) {
        let records = RecordsManager.getRecords();
        records = records.filter(r => r.id !== id);
        RecordsManager.saveRecords(records);
        showToast('记录已删除');
        renderRecords();
    }
}

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        showTab(btn.dataset.tab);
    });
});

// Initialize App
function initApp() {
    const activeTab = localStorage.getItem('activeTab') || 'medications';
    showTab(activeTab);

    if (document.getElementById('record-date-filter')) {
        document.getElementById('record-date-filter').value = new Date().toISOString().split('T')[0];
    }

    setInterval(() => {
        ReminderManager.checkReminders();
    }, 60000);

    ReminderManager.checkReminders();
}

initApp();
