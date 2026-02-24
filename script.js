document.addEventListener('DOMContentLoaded', () => {
    // 请替换为您的 Apps Script Web App URL
    const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIVoYBQtqkFB52frxB8e81899ISf_pDwJ_Fj3f9blb7mI2c3QhT4pHoz3sQuG1l6EDVQ/exec';

    const $ = id => document.getElementById(id);
    
    let currentUser = null;
    let configPrices = { ClientelingUnitPrice: 16, FullUnitPrice: 52 };
    let allUsers = [];
    let searchTerm = '';
    let currentYear = new Date().getFullYear();
    const showNotesModal = (title, maisonNotes, adminNotes) => {
        const modal = document.getElementById('notesModal');
        const modalTitle = document.getElementById('notesModalTitle');
        
        const maisonNotesSection = document.getElementById('maisonNotesSection');
        const adminNotesSection = document.getElementById('adminNotesSection');
        const singleNoteSection = document.getElementById('singleNoteSection');
        
        const maisonNotesText = document.getElementById('maisonNotesText');
        const adminNotesText = document.getElementById('adminNotesText');
        const singleNoteText = document.getElementById('singleNoteText');
        
        modalTitle.textContent = title;
        
        // 隐藏所有 section
        maisonNotesSection.classList.add('hidden');
        adminNotesSection.classList.add('hidden');
        singleNoteSection.classList.add('hidden');
        
        // 判断显示模式
        const hasMaisonNotes = maisonNotes && maisonNotes.trim();
        const hasAdminNotes = adminNotes && adminNotes.trim();
        
        if (hasMaisonNotes && hasAdminNotes) {
            // 同时显示两种 notes
            maisonNotesText.textContent = maisonNotes;
            adminNotesText.textContent = adminNotes;
            maisonNotesSection.classList.remove('hidden');
            adminNotesSection.classList.remove('hidden');
        } else if (hasMaisonNotes) {
            // 只显示 Maison notes
            singleNoteText.textContent = maisonNotes;
            singleNoteSection.classList.remove('hidden');
        } else if (hasAdminNotes) {
            // 只显示 Admin notes
            singleNoteText.textContent = adminNotes;
            singleNoteSection.classList.remove('hidden');
        } else {
            // 都没有
            singleNoteText.textContent = 'No notes available.';
            singleNoteSection.classList.remove('hidden');
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('active');
    };
    
    
    const closeNotesModal = () => {
        const modal = document.getElementById('notesModal');
        modal.classList.remove('active');
        modal.classList.add('hidden');
    };
    
    // 关闭按钮事件
    document.getElementById('closeNotesModal').addEventListener('click', closeNotesModal);
    
    // 点击模态框外部关闭
    document.getElementById('notesModal').addEventListener('click', (e) => {
        if (e.target.id === 'notesModal') {
            closeNotesModal();
        }
    });
    
    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNotesModal();
        }
    });
    // ===== 工具函数 =====
    const showPage = page => {
        document.querySelectorAll('.page').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
        page.classList.remove('hidden');
        page.classList.add('active');
    };

    const msg = (el, text, ok = false) => {
        el.textContent = text;
        el.className = ok ? 'message success' : 'message';
    };

    const clr = el => { el.textContent = ''; el.className = 'message'; };
    
    const valid = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const fmt = ts => {
        try {
            const d = new Date(ts);
            return isNaN(d) ? ts : d.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch { return ts; }
    };
    

    const updateBTAdminEmail = () => {
        const emailSpan = $('btAdminEmail');
        if (emailSpan && configPrices.BeautyTechEmail) {
            emailSpan.textContent = `BT-admin (${configPrices.BeautyTechEmail})`;
        }
    };

    const api = async (act, data = {}) => {
        const silent = ['getQuarterList', 'getConfig', 'checkExistingRecord', 'getUserEmail', 'getAllUsers', 'getAllSfscHistory', 'getMaisonSfscHistory', 'getForecastData', 'getAnnualBudgets'];
        const loading = !silent.includes(act);

        try {
            if (loading) msg($('loginMessage'), 'Requesting...', true);
            
            const res = await fetch(APP_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: act, ...data })
            });
            return await res.json();
        } catch (e) {
            console.error('API Error:', e);
            return { success: false, message: 'Network error: ' + e.message };
        } finally {
            if (loading) clr($('loginMessage'));
        }
    };

    const calculateQuarterlyCost = (count, licenseType) => {
        const unitPrice = licenseType === 'Clienteling' 
            ? parseFloat(configPrices.ClientelingUnitPrice) || 16
            : parseFloat(configPrices.FullUnitPrice) || 52;
        return count * unitPrice * 3;
    };

    const validateQuarterData = (values) => {
        const warnings = [];
        for (let i = 1; i < values.length; i++) {
            if (values[i] !== null && values[i - 1] !== null) {
                if (values[i] < values[i - 1]) {
                    warnings.push(`Q${i + 1} (${values[i]}) is less than Q${i} (${values[i - 1]})`);
                }
            }
        }
        return warnings;
    };

    const getQuarters = async () => {
        const res = await api('getQuarterList', { numberOfFutureQuarters: 3 });
        if (res.success && res.data && res.data.length >= 4) {
            return res.data.slice(0, 4);
        }
        return [`${currentYear}Q1`, `${currentYear}Q2`, `${currentYear}Q3`, `${currentYear}Q4`];
    };

    const baseHeaders = [
        { key: 'MaisonName', label: 'Maison Name' },
        { key: 'LicenseType', label: 'License Type' },
        { key: 'Year', label: 'Year' },
        { key: 'Q1Count', label: 'Q1 Qty' },
        { key: 'Q1Cost', label: 'Q1 Cost (€)' },
        { key: 'Q2Count', label: 'Q2 Qty' },
        { key: 'Q2Cost', label: 'Q2 Cost (€)' },
        { key: 'Q3Count', label: 'Q3 Qty' },
        { key: 'Q3Cost', label: 'Q3 Cost (€)' },
        { key: 'Q4Count', label: 'Q4 Qty' },
        { key: 'Q4Cost', label: 'Q4 Cost (€)' },
        { key: 'TotalCost', label: 'Total Cost (€)' }
    ];    
    
    const baseHistoryHeaders = [
        { key: 'MaisonName', label: 'Maison Name' },
        { key: 'LicenseType', label: 'License Type' },
        { key: 'Year', label: 'Year' },
        { key: 'Q1Count', label: 'Q1 Qty' },
        { key: 'Q1Cost', label: 'Q1 Cost (€)' },
        { key: 'Q2Count', label: 'Q2 Qty' },
        { key: 'Q2Cost', label: 'Q2 Cost (€)' },
        { key: 'Q3Count', label: 'Q3 Qty' },
        { key: 'Q3Cost', label: 'Q3 Cost (€)' },
        { key: 'Q4Count', label: 'Q4 Qty' },
        { key: 'Q4Cost', label: 'Q4 Cost (€)' },
        { key: 'TotalCost', label: 'Total Cost (€)' },
        { key: 'SubmittedBy', label: 'Submitted By' },
        { key: 'Timestamp', label: 'Submission Time' },
        { key: 'ApprovalStatus', label: 'Approval Status' },
        { key: 'Action', label: 'Action Type' },
        { key: 'ActionTimestamp', label: 'Action Time' },
        { key: 'ActionBy', label: 'Action By' }
    ];    
    
    const configs = {
        maison: {
            action: 'getMaisonSfscData',
            headers: [...baseHeaders, { key: 'Timestamp', label: 'Submission Time' }, { key: 'ApprovalStatus', label: 'Approval Status' }, { key: 'MaisonNotes', label: 'Notes' }],
            actionColumn: null
        },
        admin: {
            action: 'getAllSfscData',
            headers: [...baseHeaders, { key: 'SubmittedBy', label: 'Submitted By' }, { key: 'Timestamp', label: 'Submission Time' }, { key: 'ApprovalStatus', label: 'Approval Status' }, { key: 'MaisonNotes', label: 'Maison Notes' }],
            actionColumn: 'approve'
        },
        adminClienteling: {
            action: 'getAllSfscData',
            headers: [...baseHeaders, { key: 'ApprovalStatus', label: 'Approval Status' }, { key: 'MaisonNotes', label: 'Notes' }],
            actionColumn: 'approve',
            filterLicenseType: 'Clienteling',
            showBudgetVariance: true
        },
        adminFull: {
            action: 'getAllSfscData',
            headers: [...baseHeaders, { key: 'ApprovalStatus', label: 'Approval Status' }, { key: 'MaisonNotes', label: 'Notes' }],
            actionColumn: 'approve',
            filterLicenseType: 'Full',
            showBudgetVariance: true
        },
        maisonActionsLog: {
            action: 'getMaisonSfscHistory',
            headers: [...baseHistoryHeaders, { key: 'MaisonNotes', label: 'Notes' }],
            renderStatusBadge: false,
            actionColumn: null
        },
        adminActionsLog: {
            action: 'getAllSfscHistory',
            headers: [...baseHistoryHeaders],
            renderStatusBadge: false,
            actionColumn: null
        }        
    };

    const loadTable = async (type, container, params = {}) => {
        const cfg = configs[type];
        if (!cfg) {
            console.error('Invalid table configuration type:', type);
            container.innerHTML = '<p class="error-text">Invalid table configuration.</p>';
            return;
        }

        const res = await api(cfg.action, params);

        if (!res.success || !res.data || !res.data.length) {
            container.innerHTML = `<p>${res.data && res.data.length === 0 ? 'No data available.' : 'Failed to load data: ' + (res.message || 'Unknown error')}</p>`;
            return;
        }

        let budgets = {};
        if (cfg.showBudgetVariance) {
            const currentYear = new Date().getFullYear();
            const years = [currentYear - 1, currentYear, currentYear + 1];
            
            for (const year of years) {
                const budgetRes = await api('getAnnualBudgets', { year: year });
                if (budgetRes.success && budgetRes.data) {
                    budgetRes.data.forEach(b => {
                        const key = `${b.MaisonName}|${b.LicenseType}|${b.Year}`;
                        budgets[key] = parseFloat(b.AnnualTarget) || 0;
                    });
                }
            }
        }

        let dataToRender = res.data;
        if (cfg.filterLicenseType) {
            dataToRender = res.data.filter(row => row.LicenseType === cfg.filterLicenseType);
            if (dataToRender.length === 0) {
                container.innerHTML = `<p>No ${cfg.filterLicenseType} license data available.</p>`;
                return;
            }
        }

        let html = '<table><thead><tr>' + cfg.headers.map(h => `<th>${h.label}</th>`).join('');
        if (cfg.actionColumn) html += `<th>${cfg.actionColumn === 'delete' ? 'Action' : 'Approval Action'}</th>`;
        if (cfg.showBudgetVariance) {
            html += '<th>Annual<br>Budget (€)</th>';
            html += '<th>Variance</th>';
            html += '<th>Alert</th>';
        }
        html += '</tr></thead><tbody>';

        dataToRender.forEach(row => {
            const hasDecrease = (type.includes('admin') || type === 'maison') && checkForDecrease(row);
            const rowClass = hasDecrease ? 'warning-row' : '';
            
            html += `<tr class="${rowClass}">` + cfg.headers.map(h => {
                let v = row[h.key];
                
                if (h.key === 'Timestamp' || h.key === 'ActionTimestamp') v = fmt(v);
                
                if (h.key === 'ApprovalStatus') {
                    if (cfg.renderStatusBadge === false) {
                        v = v ?? '';
                    } else {
                        const sc = { Pending: 'status-pending', Approved: 'status-approved', Rejected: 'status-rejected' }[v] || 'status-pending';
                        v = `<span class="status-badge ${sc}">${v}</span>`;
                    }
                }
                
                if (h.key.includes('Cost')) {
                    const num = parseFloat(v);
                    v = isNaN(num) ? '0.00' : num.toFixed(2);
                }
                
                // Notes 列特殊处理：显示 "See" 链接
if (h.key === 'MaisonNotes' || h.key === 'AdminNotes') {
    const maisonNotes = row['MaisonNotes'] || '';
    const adminNotes = row['AdminNotes'] || '';
    const hasMaisonNotes = maisonNotes && maisonNotes.trim();
    const hasAdminNotes = adminNotes && adminNotes.trim();
    
    if (hasMaisonNotes || hasAdminNotes) {
        const maisonNotesData = String(maisonNotes).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const adminNotesData = String(adminNotes).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        v = `<span class="notes-link" data-maison-notes="${maisonNotesData}" data-admin-notes="${adminNotesData}"><u>See</u></span>`;
    } else {
        v = '<span class="no-notes">-</span>';
    }
}

                
                return `<td>${v ?? ''}</td>`;
            }).join('');        

            if (cfg.actionColumn === 'approve') {
                const submittedBy = row.SubmittedBy || '';
                const maisonName = row.MaisonName || '';
                const year = row.Year || '';
                const licenseType = row.LicenseType || '';
                const totalCost = row.TotalCost || '0';
                const timestamp = row.Timestamp || '';
                const maisonNotes = row.MaisonNotes || '';
                const recordId = row.RecordId || '';
                
                const q1Data = `Q1: ${row.Q1Count || 0} (${row.Q1Cost || 0}€)`;
                const q2Data = `Q2: ${row.Q2Count || 0} (${row.Q2Cost || 0}€)`;
                const q3Data = `Q3: ${row.Q3Count || 0} (${row.Q3Cost || 0}€)`;
                const q4Data = `Q4: ${row.Q4Count || 0} (${row.Q4Cost || 0}€)`;
                const quarterDetails = `${q1Data}, ${q2Data}, ${q3Data}, ${q4Data}`;
                
                html += `<td>
                    <button class="approve-button-table" 
                        data-id="${recordId}" 
                        data-submitted-by="${submittedBy}" 
                        data-maison-name="${maisonName}" 
                        data-year="${year}"
                        data-license-type="${licenseType}"
                        data-total-cost="${totalCost}" 
                        data-timestamp="${timestamp}"
                        data-maison-notes="${maisonNotes}"
                        data-quarter-details="${quarterDetails}">Approve</button>
                    <button class="reject-button-table" 
                        data-id="${recordId}" 
                        data-submitted-by="${submittedBy}" 
                        data-maison-name="${maisonName}" 
                        data-year="${year}"
                        data-license-type="${licenseType}"
                        data-total-cost="${totalCost}" 
                        data-timestamp="${timestamp}"
                        data-maison-notes="${maisonNotes}"
                        data-quarter-details="${quarterDetails}">Reject</button>
                </td>`;
            }

            if (cfg.showBudgetVariance) {
                const budgetKey = `${row.MaisonName}|${row.LicenseType}|${row.Year}`;
                const budget = budgets[budgetKey] || 0;
                const totalCost = parseFloat(row.TotalCost) || 0;
                
                html += `<td>${budget.toFixed(2)}</td>`;
                
                const variance = budget > 0 ? ((totalCost - budget) / budget * 100) : 0;
                const varianceThreshold = parseFloat(configPrices.VarianceThreshold) || 15;
                
                let varianceClass = 'variance-good';
                if (Math.abs(variance) > varianceThreshold) {
                    varianceClass = 'variance-danger';
                } else if (Math.abs(variance) > varianceThreshold / 2) {
                    varianceClass = 'variance-warning';
                }
                
                const varianceSign = variance >= 0 ? '+' : '';
                html += `<td class="${varianceClass}">${varianceSign}${variance.toFixed(1)}%</td>`;
                
                const needsAlert = Math.abs(variance) > varianceThreshold;
                if (needsAlert) {
                    html += `<td><button class="alert-button-table overview-alert" 
                        data-maison="${row.MaisonName}" 
                        data-license-type="${row.LicenseType}"
                        data-year="${row.Year}"
                        data-budget="${budget.toFixed(2)}"
                        data-forecast="${totalCost.toFixed(2)}"
                        data-variance="${variance.toFixed(1)}">🔔 Alert</button></td>`;
                } else {
                    html += `<td>-</td>`;
                }
            }
            
            html += '</tr>';
        });

        container.innerHTML = html + '</tbody></table>';
        
        if (cfg.showBudgetVariance) {
            await checkOverviewAlertStatuses(container);
        }
        // 添加 Notes 链接的点击事件
container.querySelectorAll('.notes-link').forEach(link => {
    link.addEventListener('click', () => {
        const maisonNotes = link.dataset.maisonNotes || '';
        const adminNotes = link.dataset.adminNotes || '';
        showNotesModal('Notes', maisonNotes, adminNotes);
    });
});

    };


    const checkOverviewAlertStatuses = async (container) => {
        const alertButtons = container.querySelectorAll('.overview-alert');
        
        for (const button of alertButtons) {
            const maisonName = button.dataset.maison;
            const licenseType = button.dataset.licenseType;
            const year = button.dataset.year;
            const budget = button.dataset.budget;
            const forecast = button.dataset.forecast;
            
            const latestMonth = `Annual-${year}`;
            const latestActualValue = `${budget}|${forecast}`;
            
            const checkRes = await api('checkAlertStatus', {
                maisonName: maisonName,
                licenseType: licenseType,
                latestMonth: latestMonth,
                latestActualValue: latestActualValue
            });
            
            if (checkRes.success && checkRes.alreadySent) {
                button.disabled = true;
                button.textContent = 'Alert Sent';
            }
        }
    };

    const checkForDecrease = (row) => {
        const q1 = parseInt(row.Q1Count) || 0;
        const q2 = parseInt(row.Q2Count) || 0;
        const q3 = parseInt(row.Q3Count) || 0;
        const q4 = parseInt(row.Q4Count) || 0;
        return q2 < q1 || q3 < q2 || q4 < q3;
    };

    
    const loadQuarterlyTrackingTable = async (container, year) => {
        // 获取所有 Maisons 的 Budget 数据
        const budgetRes = await api('getAnnualBudgets', { year: year });
        const actualRes = await api('getQuarterlyTrackingData', { year: year });
    
        if (!budgetRes.success || !budgetRes.data || budgetRes.data.length === 0) {
            container.innerHTML = `<p>No budget data available. Please set annual budgets first.</p>`;
            return;
        }
    
        // 构建 Budget 映射
        const budgets = {};
        budgetRes.data.forEach(b => {
            const key = `${b.MaisonName}|${b.LicenseType}`;
            budgets[key] = parseFloat(b.AnnualTarget) || 0;
        });
    
        // 构建 Actual 数据映射
        const actuals = {};
        if (actualRes.success && actualRes.data) {
            actualRes.data.forEach(row => {
                const key = `${row.MaisonName}|${row.LicenseType}`;
                actuals[key] = row.QuarterlyActuals || {};
            });
        }
    
        let html = '<table><thead><tr>';
html += '<th>Maison</th>';
html += '<th>Year</th>';
html += '<th>License Type</th>';

const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
quarters.forEach(q => {
    html += `<th>${q}</th>`;
});

html += `<th>Budget (€)</th>`;
html += `<th>Actual Cost (€)</th>`;
html += '<th>Variance</th>';
html += '<th>Alert</th>';
html += '</tr></thead><tbody>';

    
        // 遍历所有有 Budget 的 Maison + LicenseType 组合
        const sortedKeys = Object.keys(budgets).sort();
        
        for (const key of sortedKeys) {
            const [maisonName, licenseType] = key.split('|');
            const budget = budgets[key];
            const quarterlyActuals = actuals[key] || {};
    
            html += '<tr>';
html += `<td>${maisonName}</td>`;
html += `<td>${year}</td>`;
html += `<td>${licenseType}</td>`;

let totalActualCost = 0;

            let latestQuarter = null;
            let latestActual = null;
    
            // 获取单价
            const unitPrice = licenseType === 'Clienteling' 
                ? parseFloat(configPrices.ClientelingUnitPrice) || 16
                : parseFloat(configPrices.FullUnitPrice) || 52;
    
            // 显示每季度数量并计算成本
            quarters.forEach(q => {
                const actualQty = quarterlyActuals[q];
                if (actualQty !== undefined && actualQty !== null) {
                    html += `<td>${actualQty}</td>`;
                    // 计算该季度成本：数量 × 单价 × 3个月
                    const quarterlyCost = actualQty * unitPrice * 3;
                    totalActualCost += quarterlyCost;
                    latestActual = actualQty;
                    latestQuarter = q;
                } else {
                    html += `<td>-</td>`;
                }
            });
    
            // Budget 列
            html += `<td><strong>${budget.toFixed(2)}</strong></td>`;
    
            // Actual Cost 列
            html += `<td><strong>${totalActualCost.toFixed(2)}</strong></td>`;
    
            // Variance 列
            if (totalActualCost > 0) {
                const variance = budget > 0 ? ((totalActualCost - budget) / budget * 100) : 0;
                const varianceThreshold = parseFloat(configPrices.VarianceThreshold) || 15;
                
                let varianceClass = 'variance-good';
                if (Math.abs(variance) > varianceThreshold) {
                    varianceClass = 'variance-danger';
                } else if (Math.abs(variance) > varianceThreshold / 2) {
                    varianceClass = 'variance-warning';
                }
                
                const varianceSign = variance >= 0 ? '+' : '';
                html += `<td class="${varianceClass}">${varianceSign}${variance.toFixed(1)}%</td>`;
            } else {
                html += `<td>-</td>`;
            }
    
            // Alert 按钮
            const checkRes = await api('checkAlertStatus', {
                maisonName: maisonName,
                licenseType: licenseType,
                latestMonth: latestQuarter || '',
                latestActualValue: totalActualCost > 0 ? totalActualCost.toFixed(2) : ''
            });
    
            let buttonDisabled = '';
            let buttonText = 'Alert';
            
            if (checkRes.success && checkRes.alreadySent) {
                buttonDisabled = 'disabled';
                buttonText = 'Alert Sent';
            }
    
            const needsAlert = totalActualCost > 0 && budget > 0 && Math.abs((totalActualCost - budget) / budget * 100) > (parseFloat(configPrices.VarianceThreshold) || 15);
    
            if (needsAlert) {
                html += `<td><button class="alert-button-table monthly-tracking-alert" 
                    data-maison="${maisonName}" 
                    data-license-type="${licenseType}"
                    data-budget="${budget.toFixed(2)}"
                    data-actual-cost="${totalActualCost.toFixed(2)}"
                    data-latest-month="${latestQuarter || ''}"
                    data-variance="${budget > 0 ? ((totalActualCost - budget) / budget * 100).toFixed(1) : '0'}"
                    ${buttonDisabled}>${buttonText}</button></td>`;
            } else {
                html += `<td>-</td>`;
            }
    
            html += '</tr>';
        }
    
        html += '</tbody></table>';
        container.innerHTML = html;
    };
    


    document.addEventListener('click', async e => {

        if (e.target.classList.contains('overview-alert')) {
            const maisonName = e.target.dataset.maison;
            const licenseType = e.target.dataset.licenseType;
            const year = e.target.dataset.year;
            const budget = e.target.dataset.budget;
            const forecast = e.target.dataset.forecast;
            const variance = e.target.dataset.variance;
            const isAlreadySent = e.target.disabled;
            
            if (isAlreadySent) {
                const confirmMsg = `Alert has already been sent for ${maisonName} ${licenseType} (${year})\n` +
                                 `(Budget: ${budget}€, Forecast: ${forecast}€).\n\n` +
                                 `Do you want to prepare the email again?`;
                
                if (!confirm(confirmMsg)) {
                    return;
                }
            } else {
                const latestMonth = `Annual-${year}`;
                const latestActualValue = `${budget}|${forecast}`;
                
                const recordRes = await api('recordAlertSent', {
                    maisonName: maisonName,
                    licenseType: licenseType,
                    latestMonth: latestMonth,
                    latestActualValue: latestActualValue,
                    sentBy: currentUser.username
                });
                
                if (!recordRes.success) {
                    msg($('emailBroadcastMessage'), `Failed to record alert: ${recordRes.message}`, false);
                    return;
                }
            }
            
            const targetUsername = `${maisonName}-${licenseType}`;
            
            if (!allUsers || !allUsers.length) {
                msg($('emailBroadcastMessage'), 'User list not loaded. Please wait and try again.', false);
                return;
            }
            
            const targetUser = allUsers.find(u => u.username === targetUsername);
            
            if (!targetUser) {
                msg($('emailBroadcastMessage'), `User "${targetUsername}" not found in the system.`, false);
                return;
            }
            
            if (!targetUser.email || !targetUser.email.trim()) {
                msg($('emailBroadcastMessage'), `User "${targetUsername}" has no registered email address.`, false);
                return;
            }
            
            searchTerm = '';
            if ($('userSearchInput')) $('userSearchInput').value = '';
            renderU();
            
            $('userListContainer').querySelectorAll('.user-checkbox').forEach(cb => { 
                cb.checked = false; 
            });
            
            const targetCheckbox = $('userListContainer').querySelector(`.user-checkbox[data-username="${targetUsername}"]`);
            if (targetCheckbox) {
                targetCheckbox.checked = true;
                updCnt();
            } else {
                msg($('emailBroadcastMessage'), `Failed to select user "${targetUsername}".`, false);
                return;
            }
            
            const subject = `SFSC Budget Variance Alert - ${maisonName} ${licenseType} (${year})`;
            
            let body = `Dear ${targetUsername},\n\n`;
            body += `This is an automated alert regarding your SFSC budget variance for ${maisonName} - ${licenseType} (${year}).\n\n`;
            body += `=== Summary ===\n`;
            body += `Budget Annuel (${year}): ${budget} €\n`;
            body += `Forecast/Actual Total Cost: ${forecast} €\n`;
            body += `Variance: ${variance}%\n\n`;
            
            if (parseFloat(variance) < 0) {
                body += `⚠️ Your forecast is BELOW the budget by ${Math.abs(parseFloat(variance)).toFixed(1)}%.\n`;
            } else if (parseFloat(variance) > 0) {
                body += `⚠️ Your forecast is ABOVE the budget by ${variance}%.\n`;
            }
            
            body += `\nPlease review your forecast and adjust if necessary.\n`;
            body += `\nIf you have any questions, please contact the BT team.\n\n`;
            body += `Best regards,\nBT-admin`;
            
            $('emailSubjectInput').value = subject;
            $('emailContentInput').value = body;
            
            $('emailBroadcastSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            msg($('emailBroadcastMessage'), `Alert email prepared for "${targetUsername}". Please review and click "Open in Outlook" to send.`, true);
            
            if (!isAlreadySent) {
                if ($('overviewClientelingTab').classList.contains('active')) {
                    loadTable('adminClienteling', $('overviewClientelingTableContainer'));
                } else {
                    loadTable('adminFull', $('overviewFullTableContainer'));
                }
            }
            return;
        }

        if (e.target.classList.contains('monthly-tracking-alert')) {
            const maisonName = e.target.dataset.maison;
            const licenseType = e.target.dataset.licenseType;
            const budget = e.target.dataset.budget;
            const actualCost = e.target.dataset.actualCost;
            const latestMonth = e.target.dataset.latestMonth;
            const variance = e.target.dataset.variance;
            
            const isAlreadySent = e.target.disabled;
            
            if (isAlreadySent) {
                const confirmMsg = `Alert has already been sent for ${maisonName} ${licenseType}\n` +
                                 `(Budget: ${budget}€, Actual Cost: ${actualCost}€).\n\n` +
                                 `Do you want to prepare the email again?`;
                
                if (!confirm(confirmMsg)) {
                    return;
                }
            } else {
                const recordRes = await api('recordAlertSent', {
                    maisonName: maisonName,
                    licenseType: licenseType,
                    latestMonth: latestMonth || '',
                    latestActualValue: actualCost || '',
                    sentBy: currentUser.username
                });
                
                if (!recordRes.success) {
                    msg($('emailBroadcastMessage'), `Failed to record alert: ${recordRes.message}`, false);
                    return;
                }
            }
        
            const targetUsername = `${maisonName}-${licenseType}`;
            
            if (!allUsers || !allUsers.length) {
                msg($('emailBroadcastMessage'), 'User list not loaded. Please wait and try again.', false);
                return;
            }
            
            const targetUser = allUsers.find(u => u.username === targetUsername);
            
            if (!targetUser) {
                msg($('emailBroadcastMessage'), `User "${targetUsername}" not found in the system.`, false);
                return;
            }
            
            if (!targetUser.email || !targetUser.email.trim()) {
                msg($('emailBroadcastMessage'), `User "${targetUsername}" has no registered email address.`, false);
                return;
            }
            
            searchTerm = '';
            if ($('userSearchInput')) $('userSearchInput').value = '';
            renderU();
            
            $('userListContainer').querySelectorAll('.user-checkbox').forEach(cb => { 
                cb.checked = false; 
            });
            
            const targetCheckbox = $('userListContainer').querySelector(`.user-checkbox[data-username="${targetUsername}"]`);
            if (targetCheckbox) {
                targetCheckbox.checked = true;
                updCnt();
            } else {
                msg($('emailBroadcastMessage'), `Failed to select user "${targetUsername}".`, false);
                return;
            }
            
            const subject = `SFSC Cost Variance Alert - ${maisonName} ${licenseType}`;
            
            let body = `Dear ${targetUsername},\n\n`;
body += `This is an automated alert regarding your SFSC cost variance for ${maisonName} - ${licenseType}.\n\n`;
body += `=== Summary ===\n`;
body += `Annual Budget (${currentYear}): ${budget} €\n`;
body += `Quarterly Actual Cost (累计): ${actualCost} €\n`;
body += `Variance: ${variance}%\n\n`;

            
            if (parseFloat(variance) < 0) {
                body += `✓ Your actual cost is BELOW the budget by ${Math.abs(parseFloat(variance)).toFixed(1)}%.\n`;
            } else if (parseFloat(variance) > 0) {
                body += `⚠️ Your actual cost is ABOVE the budget by ${variance}%.\n`;
            } else {
                body += `✓ Your actual cost matches the budget.\n`;
            }
            
            body += `\nPlease review your spending and take appropriate action if needed.\n`;
            body += `\nIf you have any questions, please contact the BT team.\n\n`;
            body += `Best regards,\nBT-admin`;
            
            $('emailSubjectInput').value = subject;
            $('emailContentInput').value = body;
            
            $('emailBroadcastSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            msg($('emailBroadcastMessage'), `Alert email prepared for "${targetUsername}". Please review and click "Open in Outlook" to send.`, true);
            
            if (!isAlreadySent) {
                const currentYear = new Date().getFullYear();
                await loadMonthlyTrackingTable($('monthlyTrackingTableContainer'), currentYear);
            }
            
            return;
        }
        

        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains('approve-button-table') || e.target.classList.contains('reject-button-table')) {
             // 检查按钮是否正在处理中
    if (e.target.dataset.processing === 'true') {
        console.log('Button is already being processed, ignoring...');
        return;
    }
    
    // 标记按钮为处理中
    e.target.dataset.processing = 'true';
            e.preventDefault(); // 阻止默认行为
            e.stopPropagation(); // 阻止事件冒泡
            const st = e.target.classList.contains('approve-button-table') ? 'Approved' : 'Rejected';
            
            const submittedBy = e.target.dataset.submittedBy || '';
            const maisonName = e.target.dataset.maisonName || '';
            const year = e.target.dataset.year || '';
            const licenseType = e.target.dataset.licenseType || '';
            const totalCost = e.target.dataset.totalCost || '0';
            const timestamp = e.target.dataset.timestamp || '';
            const maisonNotes = e.target.dataset.maisonNotes || '';
            const quarterDetails = e.target.dataset.quarterDetails || '';
            
            const adminNotes = prompt(`${st === 'Approved' ? 'Approve' : 'Reject'} this submission?\n\nYear: ${year}\nMaison: ${maisonName}\nLicense Type: ${licenseType}\nTotal Cost: ${totalCost}€\n\nYou can add optional notes below:`, '');
            
            if (adminNotes === null) return;
            
            const res = await api('updateApprovalStatus', { 
                recordId: id, 
                newStatus: st, 
                actionBy: currentUser.username,
                adminNotes: adminNotes
            });
            
            msg($('loginMessage'), res.success ? `Status: ${st}` : 'Update failed: ' + res.message, res.success);
            
            if (res.success) {
                loadTable('adminClienteling', $('overviewClientelingTableContainer'));
                loadTable('adminFull', $('overviewFullTableContainer'));
                loadTable('adminActionsLog', $('adminActionsLogTableContainer'));
                
                if (submittedBy) {
                    sendApprovalNotification(submittedBy, st, maisonName, year, licenseType, quarterDetails, totalCost, timestamp, maisonNotes, adminNotes);
                }
            }
            return; 
        }
    });

    const setEmailUI = (has, email = '') => {
        $('registeredEmailValue').textContent = email;
        $('emailDisplay').classList.toggle('hidden', !has);
        $('emailForm').classList.toggle('hidden', has);
        $('editEmailButton').classList.toggle('hidden', !has);
        $('cancelEditEmailButton').classList.add('hidden');
        $('submitEmailButton').textContent = 'Register Email';
        $('userEmailInput').value = email;
    };

    const initEmail = async () => {
        if (!currentUser || currentUser.role !== 'maison') { 
            $('emailManagementSection').classList.add('hidden'); 
            return; 
        }
        $('emailManagementSection').classList.remove('hidden');
        clr($('emailMessage'));
        const res = await api('getUserEmail', { username: currentUser.username });
        setEmailUI(res.success && res.email, res.email || '');
    };

    const buildNotificationBody = (submittedBy, status, maisonName, year, licenseType, quarterDetails, totalCost, timestamp, maisonNotes, adminNotes) => {
        const statusText = status === 'Approved' ? 'Approved' : 'Rejected';
        const formattedTimestamp = timestamp ? fmt(timestamp) : (timestamp || '');
        return (
            `Dear ${submittedBy},\n\n` +
            `Your SFSC license application has been ${statusText.toLowerCase()}.\n\n` +
            `Details:\n` +
            `Maison Name: ${maisonName || ''}\n` +
            `License Type: ${licenseType || ''}\n` +
            `Year: ${year || ''}\n` +
            `Quarterly Data: ${quarterDetails || ''}\n` +
            `Total Cost: ${totalCost || '0'} €\n` +
            `Submitted By: ${submittedBy || ''}\n` +
            `Submission Time: ${formattedTimestamp}\n` +
            `Approval Status: ${statusText}\n` +
            (maisonNotes ? `\nYour Notes: ${maisonNotes}\n` : '') +
            (adminNotes ? `\nAdmin Notes: ${adminNotes}\n` : '') +
            `\n` +
            (status === 'Approved' 
              ? `Thank you for your submission. The data has been successfully approved.\n`
              : `Please review your submission. If you have any questions or need to resubmit, please contact the administrator.\n`) +
            `\nBest regards,\nBT-admin`
        );
    };

    const sendApprovalNotification = async (submittedBy, status, maisonName, year, licenseType, quarterDetails, totalCost, timestamp, maisonNotes, adminNotes) => {
        try {
            const emailRes = await api('getUserEmail', { username: submittedBy });
            if (!emailRes.success || !emailRes.email) {
                msg($('emailBroadcastMessage'), `Applicant "${submittedBy}" has no registered email. Notification not prepared.`, false);
                return;
            }
            const applicantEmail = emailRes.email.trim();
            const statusText = status === 'Approved' ? 'Approved' : 'Rejected';
            const subject = `SFSC License Application ${statusText} - ${maisonName} ${licenseType} (${year})`;
            const body = buildNotificationBody(submittedBy, status, maisonName, year, licenseType, quarterDetails, totalCost, timestamp, maisonNotes, adminNotes);
    
            $('emailSubjectInput').value = subject;
            $('emailContentInput').value = body;
    
            if (!allUsers || !allUsers.length) {
                const res = await api('getAllUsers');
                if (res.success && res.data) allUsers = res.data.filter(u => u.email && u.email.trim());
            }
            
            const hasApplicant = allUsers && allUsers.some(u => (u.username || '').trim() === submittedBy);
            if (!hasApplicant && allUsers) {
                allUsers = [...allUsers, { username: submittedBy, email: applicantEmail, maisonName: '', licenseType: '' }];
            }
            if (allUsers && allUsers.length) {
                searchTerm = '';
                if ($('userSearchInput')) $('userSearchInput').value = '';
                renderU();
                
                $('userListContainer').querySelectorAll('.user-checkbox').forEach(cb => { 
                    cb.checked = (cb.dataset.username || '').trim() === submittedBy; 
                });
                updCnt();
            }
    
            $('emailBroadcastSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
            msg($('emailBroadcastMessage'), 'Notification email prepared for applicant. Click "Open in Outlook" to open and send.', true);
        } catch (error) {
            console.error('Error preparing approval notification:', error);
            msg($('emailBroadcastMessage'), 'Failed to prepare notification: ' + (error.message || 'Unknown error'), false);
        }
    };

    const filtered = () => {
        if (!searchTerm) return allUsers;
        const t = searchTerm.toLowerCase();
        return allUsers.filter(u => [(u.username || ''), (u.email || ''), (u.maisonName || ''), (u.licenseType || '')].some(f => f.toLowerCase().includes(t)));
    };

    const selected = () => Array.from($('userListContainer').querySelectorAll('.user-checkbox:checked')).map(cb => cb.dataset.email).filter(e => e && valid(e));

    const renderU = () => {
        const f = filtered();
        if (!f.length) { 
            $('userListContainer').innerHTML = '<p class="no-users-text">No users found.</p>'; 
            return; 
        }
        $('userListContainer').innerHTML = f.map((u, i) => {
            const id = `user-${i}-${(u.email || '').replace(/[^a-zA-Z0-9]/g, '_')}`;
            const displayText = u.licenseType && u.licenseType !== 'N/A' 
                ? `${u.maisonName} - ${u.licenseType}` 
                : u.maisonName;
            return `<div class="user-checkbox-item">
                <input type="checkbox" id="${id}" class="user-checkbox" data-email="${u.email || ''}" data-username="${u.username || ''}" ${u.email ? '' : 'disabled'}>
                <label for="${id}" class="user-checkbox-label">
                    <span class="user-name">${u.username || 'N/A'}</span>
                    <span class="user-email">${u.email || 'No email'}</span>
                    ${displayText ? `<span class="user-maison">${displayText}</span>` : ''}
                </label>
            </div>`;
        }).join('');
    };

    const updCnt = () => {
        const cnt = selected().length;
        $('recipientCountDisplay').textContent = cnt > 0 ? `Selected: ${cnt} recipient(s)` : 'No recipients selected.';
        $('recipientCountDisplay').style.color = cnt > 0 ? '#00796b' : '#999';
        $('recipientCountDisplay').classList.remove('hidden');
    };

    $('userListContainer').addEventListener('change', e => { 
        if (e.target.classList.contains('user-checkbox')) updCnt(); 
    });

    const initBcast = async () => {
        if (!currentUser || currentUser.role !== 'admin') { 
            $('emailBroadcastSection').classList.add('hidden'); 
            return; 
        }
        $('emailBroadcastSection').classList.remove('hidden');
        $('userListContainer').innerHTML = '<p class="loading-text">Loading users...</p>';
        const res = await api('getAllUsers');
        if (res.success && res.data) { 
            allUsers = res.data.filter(u => u.email && u.email.trim()); 
            renderU(); 
            updCnt(); 
        } else {
            $('userListContainer').innerHTML = `<p class="error-text">Failed to load users: ${res.message || 'Unknown'}</p>`;
        }
    };

    const popYearSelectors = () => {
        const years = [currentYear - 1, currentYear, currentYear + 1];
        const yearOptions = years.map(y => `<option value="${y}">${y}</option>`).join('');
        
        if ($('budgetYearSelect')) $('budgetYearSelect').innerHTML = yearOptions;
        if ($('targetYearSelect')) $('targetYearSelect').innerHTML = yearOptions;
        if ($('actualYearSelect')) $('actualYearSelect').innerHTML = yearOptions;
        
        if ($('budgetYearSelect')) $('budgetYearSelect').value = currentYear;
        if ($('targetYearSelect')) $('targetYearSelect').value = currentYear;
        if ($('actualYearSelect')) $('actualYearSelect').value = currentYear;
    };

    const popMaisonSelectors = async () => {
        const res = await api('getAllUsers');
        if (!res.success || !res.data) return;
        
        const maisons = [...new Set(res.data
            .filter(u => u.maisonName && u.maisonName !== 'BT')
            .map(u => u.maisonName))];
        
        const maisonOptions = maisons.map(m => `<option value="${m}">${m}</option>`).join('');
        
        if ($('budgetMaisonSelect')) $('budgetMaisonSelect').innerHTML = maisonOptions;
        if ($('targetMaisonSelect')) $('targetMaisonSelect').innerHTML = maisonOptions;
        if ($('actualMaisonSelect')) $('actualMaisonSelect').innerHTML = maisonOptions;
    };

    const handlers = {
        loginButton: async () => {
            const u = $('username').value.trim(), p = $('password').value.trim();
            if (!u || !p) { msg($('loginMessage'), 'Enter credentials!', false); return; }
            const res = await api('login', { username: u, password: p });
            if (!res.success) { msg($('loginMessage'), 'Login failed: ' + res.message, false); return; }
            msg($('loginMessage'), 'Login successful!', true);
            currentUser = { username: u, role: res.role, maisonName: res.maisonName, licenseType: res.licenseType };
            
            const cfg = await api('getConfig');
            if (cfg.success && cfg.data) {
                Object.assign(configPrices, { 
                    ClientelingUnitPrice: parseFloat(cfg.data.ClientelingUnitPrice) || 16, 
                    FullUnitPrice: parseFloat(cfg.data.FullUnitPrice) || 52,
                    VarianceThreshold: parseFloat(cfg.data.VarianceThreshold) || 15,
                    BeautyTechEmail: cfg.data.BeautyTechEmail || 'beautytech@example.com'
                });
            }
            
            setTimeout(async () => {
                showPage($('mainPage'));
                $('welcomeMessage').textContent = `Welcome, ${currentUser.username} (${currentUser.role})!`;
                
                if (currentUser.role === 'maison') {
                    $('maisonView').classList.remove('hidden'); 
                    $('adminView').classList.add('hidden');
                    
                    $('maisonSubmitTitle').textContent = `Submit Quarterly Forecast (${currentUser.licenseType} Licenses)`;
                    updateBTAdminEmail();
                    
                    const currentYear = new Date().getFullYear();
                    const yearOptions = [currentYear - 1, currentYear, currentYear + 1]
                        .map(y => `<option value="${y}">${y}</option>`)
                        .join('');
                    $('forecastYearSelect').innerHTML = yearOptions;
                    $('forecastYearSelect').value = currentYear;
                    
                    $('q1Input').value = '';
                    $('q2Input').value = '';
                    $('q3Input').value = '';
                    $('q4Input').value = '';
                    $('maisonNotesInput').value = '';
                    clr($('validationMessage'));
                    clr($('maisonSubmitMessage'));
                    
                    $('calcQ1Input').value = '0';
                    $('calcQ2Input').value = '0';
                    $('calcQ3Input').value = '0';
                    $('calcQ4Input').value = '0';
                    $('q1CostDisplay').textContent = '0.00';
                    $('q2CostDisplay').textContent = '0.00';
                    $('q3CostDisplay').textContent = '0.00';
                    $('q4CostDisplay').textContent = '0.00';
                    $('totalForecastDisplay').textContent = '0.00';
                    
                    loadTable('maison', $('maisonHistoryTableContainer'), { 
                        submittedBy: currentUser.username,
                        licenseType: currentUser.licenseType
                    });
                    loadTable('maisonActionsLog', $('maisonActionsLogTableContainer'), { 
                        submittedBy: currentUser.username,
                        licenseType: currentUser.licenseType
                    });
                    initEmail();
                } else {
                    $('adminView').classList.remove('hidden'); 
                    $('maisonView').classList.add('hidden');
                    
                    
                    
                    loadTable('adminClienteling', $('overviewClientelingTableContainer'));
                    loadTable('adminFull', $('overviewFullTableContainer'));
                    loadTable('adminActionsLog', $('adminActionsLogTableContainer'));
                    initBcast();
                    
                    popYearSelectors();
                    popMaisonSelectors();
                    loadQuarterlyTrackingTable($('monthlyTrackingTableContainer'), currentYear);
                }
                
            }, 500);
        },

        logoutButton: () => {
            currentUser = null;
            $('username').value = $('password').value = '';
            clr($('loginMessage')); 
            clr($('maisonSubmitMessage')); 
            clr($('emailMessage')); 
            clr($('calculatorErrorMessage')); 
            clr($('emailBroadcastMessage'));
            clr($('validationMessage'));
            showPage($('loginPage'));
        },

        submitForecastButton: async () => {
            if (!currentUser || currentUser.role !== 'maison') { 
                msg($('maisonSubmitMessage'), 'Maison user only!', false); 
                return; 
            }
            
            clr($('validationMessage'));
            clr($('maisonSubmitMessage'));
            
            const q1 = $('q1Input').value.trim();
            const q2 = $('q2Input').value.trim();
            const q3 = $('q3Input').value.trim();
            const q4 = $('q4Input').value.trim();
            const maisonNotes = $('maisonNotesInput').value.trim();
            const selectedYear = parseInt($('forecastYearSelect').value);
            
            if (!q1 || !q2 || !q3 || !q4) {
                msg($('maisonSubmitMessage'), 'Please fill in all four quarters! If the quantity remains unchanged, please re-enter the original value.', false);
                return;
            }
            
            const q1Num = parseInt(q1);
            const q2Num = parseInt(q2);
            const q3Num = parseInt(q3);
            const q4Num = parseInt(q4);
            
            if (isNaN(q1Num) || isNaN(q2Num) || isNaN(q3Num) || isNaN(q4Num)) {
                msg($('maisonSubmitMessage'), 'All quarters must be valid numbers!', false);
                return;
            }
            
            if (q1Num < 0 || q2Num < 0 || q3Num < 0 || q4Num < 0) {
                msg($('maisonSubmitMessage'), 'Quantities cannot be negative!', false);
                return;
            }
            
            const values = [q1Num, q2Num, q3Num, q4Num];
            const warnings = [];
            
            for (let i = 1; i < values.length; i++) {
                if (values[i] < values[i - 1]) {
                    warnings.push(`Q${i + 1} (${values[i]}) is less than Q${i} (${values[i - 1]})`);
                }
            }
            
            const quarters = [`${selectedYear}Q1`, `${selectedYear}Q2`, `${selectedYear}Q3`, `${selectedYear}Q4`];
            
            let confirmMsg = '';
            
            if (warnings.length > 0) {
                const beautyTechEmail = configPrices.BeautyTechEmail || 'beautytech@example.com';
                confirmMsg += '⚠️ WARNING ⚠️\n';
                confirmMsg += warnings.join('\n') + '\n\n';
                confirmMsg += `Due to contract restrictions, license quantities should not decrease during the year.\n`;
                confirmMsg += `If you need to reduce licenses, contact Beauty Tech at ${beautyTechEmail} AFTER submitting.\n\n`;
                confirmMsg += '═'.repeat(50) + '\n\n';
            }
            
            const checkRes = await api('checkExistingRecord', {
                maisonName: currentUser.maisonName,
                year: selectedYear,
                submittedBy: currentUser.username,
                licenseType: currentUser.licenseType
            });
            
            const isUpdate = checkRes.success && checkRes.exists;
            const existingData = isUpdate ? [
                parseInt(checkRes.q1Count) || 0,
                parseInt(checkRes.q2Count) || 0,
                parseInt(checkRes.q3Count) || 0,
                parseInt(checkRes.q4Count) || 0
            ] : null;
            
            confirmMsg += `You are about to ${isUpdate ? 'UPDATE' : 'SUBMIT'} the following yearly forecast:\n\n`;
            confirmMsg += `Year: ${selectedYear}\n`;
            confirmMsg += `License Type: ${currentUser.licenseType}\n\n`;

            values.forEach((val, idx) => {
                const marker = isUpdate && existingData && existingData[idx] !== val 
                    ? ` (changed from ${existingData[idx]})` 
                    : isUpdate 
                    ? ' (no change)' 
                    : ' (new)';
                confirmMsg += `Q${idx + 1}: ${val}${marker}\n`;
            });
            
            if (maisonNotes) {
                confirmMsg += `\nYour Notes: ${maisonNotes}\n`;
            }
            
            confirmMsg += '\nDo you want to proceed?';
            
            if (!confirm(confirmMsg)) {
                msg($('maisonSubmitMessage'), 'Submission cancelled.', false);
                return;
            }
            
            const quarterData = quarters.slice(0, 4).map((q, idx) => ({
                quarter: q,
                count: values[idx]
            }));
            
            const res = await api('submitSfscData', {
                maisonName: currentUser.maisonName,
                licenseType: currentUser.licenseType,
                quarterData: quarterData,
                submittedBy: currentUser.username,
                maisonNotes: maisonNotes
            });
            
            if (res.success) {
                msg($('maisonSubmitMessage'), `Forecast ${isUpdate ? 'updated' : 'submitted'} successfully! Total Cost: ${res.totalCost}€`, true);
                
                $('q1Input').value = '';
                $('q2Input').value = '';
                $('q3Input').value = '';
                $('q4Input').value = '';
                $('maisonNotesInput').value = '';
                clr($('validationMessage'));
                
                loadTable('maison', $('maisonHistoryTableContainer'), { 
                    submittedBy: currentUser.username,
                    licenseType: currentUser.licenseType
                });
                loadTable('maisonActionsLog', $('maisonActionsLogTableContainer'), { 
                    submittedBy: currentUser.username,
                    licenseType: currentUser.licenseType
                });
            } else {
                msg($('maisonSubmitMessage'), 'Failed to submit: ' + res.message, false);
            }
        },

        calculateCostButton: () => {
            clr($('calculatorErrorMessage'));
            
            const q1 = parseInt($('calcQ1Input').value) || 0;
            const q2 = parseInt($('calcQ2Input').value) || 0;
            const q3 = parseInt($('calcQ3Input').value) || 0;
            const q4 = parseInt($('calcQ4Input').value) || 0;
            
            if (q1 < 0 || q2 < 0 || q3 < 0 || q4 < 0) {
                msg($('calculatorErrorMessage'), 'Invalid input: quantities cannot be negative!', false);
                return;
            }
            
            const q1Cost = calculateQuarterlyCost(q1, currentUser.licenseType);
            const q2Cost = calculateQuarterlyCost(q2, currentUser.licenseType);
            const q3Cost = calculateQuarterlyCost(q3, currentUser.licenseType);
            const q4Cost = calculateQuarterlyCost(q4, currentUser.licenseType);
            const totalCost = q1Cost + q2Cost + q3Cost + q4Cost;
            
            $('q1CostDisplay').textContent = q1Cost.toFixed(2);
            $('q2CostDisplay').textContent = q2Cost.toFixed(2);
            $('q3CostDisplay').textContent = q3Cost.toFixed(2);
            $('q4CostDisplay').textContent = q4Cost.toFixed(2);
            $('totalForecastDisplay').textContent = totalCost.toFixed(2);
        },

        submitEmailButton: async () => {
            if (!currentUser || currentUser.role !== 'maison') { 
                msg($('emailMessage'), 'Maison only.', false); 
                return; 
            }
            const e = $('userEmailInput').value.trim();
            if (!e) { msg($('emailMessage'), 'Email address cannot be empty!', false); return; }
            if (!valid(e)) { msg($('emailMessage'), 'Invalid email format!', false); return; }
            msg($('emailMessage'), 'Saving email...', true);
            const res = await api('updateUserEmail', { username: currentUser.username, email: e });
            msg($('emailMessage'), res.success ? 'Email saved successfully!' : 'Failed to save email: ' + res.message, res.success);
            if (res.success) initEmail();
        },

        editEmailButton: () => {
            $('emailDisplay').classList.add('hidden'); 
            $('editEmailButton').classList.add('hidden');
            $('emailForm').classList.remove('hidden'); 
            $('userEmailInput').value = $('registeredEmailValue').textContent;
            $('submitEmailButton').textContent = 'Save Changes'; 
            $('cancelEditEmailButton').classList.remove('hidden');
            clr($('emailMessage'));
        },

        cancelEditEmailButton: () => { 
            initEmail(); 
            clr($('emailMessage')); 
        },

        submitBudgetButton: async () => {
            if (!currentUser || currentUser.role !== 'admin') { 
                msg($('budgetSubmitMessage'), 'Admin only!', false); 
                return; 
            }
            
            const year = parseInt($('budgetYearSelect').value);
            const maison = $('budgetMaisonSelect').value;
            const licenseType = $('budgetLicenseTypeSelect').value;
            const budgetAnnuel = parseFloat($('budgetAnnuelInput').value) || 0;
            
            if (!maison) { 
                msg($('budgetSubmitMessage'), 'Please select a Maison!', false); 
                return; 
            }
            
            if (budgetAnnuel < 0) {
                msg($('budgetSubmitMessage'), 'Budget cannot be negative!', false);
                return;
            }
            
            clr($('budgetSubmitMessage'));
            msg($('budgetSubmitMessage'), 'Submitting budget...', true);
            
            const res = await api('setAnnualBudget', {
                maisonName: maison,
                licenseType: licenseType,
                year: year,
                budgetAnnuel: budgetAnnuel,
                updatedBy: currentUser.username
            });
            
            msg($('budgetSubmitMessage'), res.success ? 'Budget set successfully!' : 'Failed: ' + res.message, res.success);
            
            if (res.success) {
                $('budgetAnnuelInput').value = '0';
                loadTable('adminClienteling', $('overviewClientelingTableContainer'));
                loadTable('adminFull', $('overviewFullTableContainer'));
            }
        },



        overviewClientelingTab: () => {
            $('overviewClientelingTab').classList.add('active');
            $('overviewFullTab').classList.remove('active');
            $('overviewClientelingContainer').classList.remove('hidden');
            $('overviewClientelingContainer').classList.add('active');
            $('overviewFullContainer').classList.add('hidden');
            $('overviewFullContainer').classList.remove('active');
        },

        overviewFullTab: () => {
            $('overviewFullTab').classList.add('active');
            $('overviewClientelingTab').classList.remove('active');
            $('overviewFullContainer').classList.remove('hidden');
            $('overviewFullContainer').classList.add('active');
            $('overviewClientelingContainer').classList.add('hidden');
            $('overviewClientelingContainer').classList.remove('active');
        },


        exportHistoryDataButton: async () => {
            if (!currentUser || currentUser.role !== 'admin') { alert('Admin only!'); return; }
            const res = await api('getAllSfscHistory');
            if (!res.success || !res.data || !res.data.length) { 
                msg($('loginMessage'), 'Export failed: No history data available.', false); 
                return; 
            }
            
            const h = configs.adminActionsLog.headers;
            let csv = h.map(x => x.label).join(',') + '\n';
            
            res.data.forEach(r => { 
                csv += h.map(x => { 
                    let v = r[x.key]; 
                    if (x.key === 'Timestamp' || x.key === 'ActionTimestamp') v = fmt(v);
                    return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : (v ?? ''); 
                }).join(',') + '\n'; 
            });
            
            const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const l = document.createElement('a');
            l.href = URL.createObjectURL(b); 
            l.download = `SFSC_History_Export_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.csv`;
            document.body.appendChild(l); 
            l.click(); 
            document.body.removeChild(l);
            
            msg($('loginMessage'), 'History data exported successfully!', true);
        },



        submitActualButton: async () => {
            if (!currentUser || currentUser.role !== 'admin') { 
                msg($('actualSubmitMessage'), 'Admin only!', false); 
                return; 
            }
            
            const year = parseInt($('actualYearSelect').value);
            const quarter = $('actualQuarterSelect').value;
            const maison = $('actualMaisonSelect').value;
            const clientelingActual = parseInt($('actualClientelingInput').value) || 0;
            const fullActual = parseInt($('actualFullInput').value) || 0;
            
            if (!maison) { 
                msg($('actualSubmitMessage'), 'Please select a Maison!', false); 
                return; 
            }
            
            clr($('actualSubmitMessage'));
            msg($('actualSubmitMessage'), 'Submitting actual data...', true);
            
            if (clientelingActual >= 0) {
                const resC = await api('submitQuarterlyActual', {
                    maisonName: maison,
                    licenseType: 'Clienteling',
                    year: year,
                    quarter: quarter,
                    actualQuantity: clientelingActual,
                    updatedBy: currentUser.username
                });
                if (!resC.success) {
                    msg($('actualSubmitMessage'), 'Failed to submit Clienteling actual: ' + resC.message, false);
                    return;
                }
            }
            
            if (fullActual >= 0) {
                const resF = await api('submitQuarterlyActual', {
                    maisonName: maison,
                    licenseType: 'Full',
                    year: year,
                    quarter: quarter,
                    actualQuantity: fullActual,
                    updatedBy: currentUser.username
                });
                if (!resF.success) {
                    msg($('actualSubmitMessage'), 'Failed to submit Full actual: ' + resF.message, false);
                    return;
                }
            }
            
            msg($('actualSubmitMessage'), 'Quarterly actual data submitted successfully!', true);
            $('actualClientelingInput').value = '0';
            $('actualFullInput').value = '0';
            
            loadQuarterlyTrackingTable($('monthlyTrackingTableContainer'), year);
        },
        

        exportMonthlyTrackingButton: async () => {
            if (!currentUser || currentUser.role !== 'admin') { alert('Admin only!'); return; }
            
            const year = parseInt($('actualYearSelect').value) || currentYear;
            
            const budgetRes = await api('getAnnualBudgets', { year: year });
            const actualRes = await api('getQuarterlyTrackingData', { year: year });
            
            if (!budgetRes.success || !budgetRes.data || budgetRes.data.length === 0) {
                msg($('loginMessage'), 'Export failed: No budget data available.', false);
                return;
            }
        
            const budgets = {};
            budgetRes.data.forEach(b => {
                const key = `${b.MaisonName}|${b.LicenseType}`;
                budgets[key] = parseFloat(b.AnnualTarget) || 0;
            });
        
            const actuals = {};
            if (actualRes.success && actualRes.data) {
                actualRes.data.forEach(row => {
                    const key = `${row.MaisonName}|${row.LicenseType}`;
                    actuals[key] = row.QuarterlyActuals || {};
                });
            }
            
            const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
let csv = 'Maison,Year,License Type,';
quarters.forEach(q => { csv += `${q},`; });
csv += `Budget (€),Actual Cost (€),Variance %\n`;

            
            const sortedKeys = Object.keys(budgets).sort();
            
            sortedKeys.forEach(key => {
                const [maisonName, licenseType] = key.split('|');
                const budget = budgets[key];
                const quarterlyActuals = actuals[key] || {};
                
                csv += `${maisonName},${year},${licenseType},`;
            
                
                let totalActualCost = 0;
                const unitPrice = licenseType === 'Clienteling' 
                    ? parseFloat(configPrices.ClientelingUnitPrice) || 16
                    : parseFloat(configPrices.FullUnitPrice) || 52;
                
                quarters.forEach(q => {
                    const actualQty = quarterlyActuals[q];
                    if (actualQty !== undefined && actualQty !== null) {
                        csv += `${actualQty},`;
                        const quarterlyCost = actualQty * unitPrice * 3;
                        totalActualCost += quarterlyCost;
                    } else {
                        csv += '-,';
                    }
                });
                
                csv += `${budget.toFixed(2)},`;
                csv += `${totalActualCost.toFixed(2)},`;
                
                if (totalActualCost > 0 && budget > 0) {
                    const variance = ((totalActualCost - budget) / budget * 100);
                    csv += `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`;
                } else {
                    csv += '-';
                }
                csv += '\n';
            });
            
            const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const l = document.createElement('a');
            l.href = URL.createObjectURL(b);
            l.download = `Quarterly_Tracking_${year}_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.csv`;
            document.body.appendChild(l);
            l.click();
            document.body.removeChild(l);
            
            msg($('loginMessage'), 'Quarterly tracking data exported successfully!', true);
        },
        

        selectAllButton: () => { 
            $('userListContainer').querySelectorAll('.user-checkbox:not(:disabled)').forEach(c => c.checked = true); 
            updCnt(); 
        },

        deselectAllButton: () => { 
            $('userListContainer').querySelectorAll('.user-checkbox').forEach(c => c.checked = false); 
            updCnt(); 
        },

        openOutlookButton: async () => {
            const em = selected();
            if (!em.length) { 
                msg($('emailBroadcastMessage'), 'No recipients selected to send email.', false); 
                return; 
            }
            const s = encodeURIComponent($('emailSubjectInput').value.trim()), 
                  b = encodeURIComponent($('emailContentInput').value.trim());
            const p = [s && `subject=${s}`, b && `body=${b}`].filter(Boolean);
            const mailtoLink = `mailto:${em.join(';')}${p.length ? '?' + p.join('&') : ''}`;

            const tempLink = document.createElement('a');
            tempLink.href = mailtoLink;
            tempLink.style.display = 'none';
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
            
            msg($('emailBroadcastMessage'), `Opening Outlook with ${em.length} recipient(s)...`, true);
        },

        copyEmailsButton: () => {
            const em = selected();
            if (!em.length) { 
                msg($('emailBroadcastMessage'), 'No recipients selected to copy emails.', false); 
                return; 
            }
            const list = em.join('; ');
            navigator.clipboard.writeText(list).then(() => 
                msg($('emailBroadcastMessage'), `Copied ${em.length} email(s) to clipboard!`, true)
            ).catch(() => {
                const t = document.createElement('textarea'); 
                t.value = list; 
                t.style.position = 'fixed'; 
                t.style.left = '-9999px';
                document.body.appendChild(t); 
                t.select();
                try { 
                    document.execCommand('copy'); 
                    msg($('emailBroadcastMessage'), `Copied ${em.length} email(s) to clipboard (fallback)!`, true); 
                } catch (err) { 
                    msg($('emailBroadcastMessage'), 'Copy failed. Please manually copy the emails.', false); 
                    console.error('Fallback copy failed:', err);
                }
                document.body.removeChild(t);
            });
        },

        quickStartDataCollection: () => {
            const subject = 'SFSC License Quantity Forecast Data Collection';
            const body = `Dear All,

As part of our regular business forecast process, we kindly ask you to submit your forecasted SFSC license quantities for the period from Q1 ${currentYear} to Q4 ${currentYear}. This information is essential for our upcoming budget planning cycle. Please complete the required details using the form below.

Deadline: 
Form Link: 

Your timely response is critical to ensuring accurate business planning. If you have any questions or require assistance, please contact [contact person or team].

Thank you for your cooperation.

Best regards,
BT-admin`;

            $('emailSubjectInput').value = subject;
            $('emailContentInput').value = body;
            
            $('userListContainer').querySelectorAll('.user-checkbox:not(:disabled)').forEach(c => c.checked = true);
            updCnt();
            
            msg($('emailBroadcastMessage'), 'Data collection email template loaded and all users selected. Please review and click "Open in Outlook" to send.', true);
            
            $('emailSubjectInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };


    const exportOverviewData = async (licenseType) => {
        if (!currentUser || currentUser.role !== 'admin') { 
            alert('Admin only!'); 
            return; 
        }
        
        const res = await api('getAllSfscData');
        if (!res.success || !res.data || !res.data.length) { 
            msg($('loginMessage'), `Export failed: No ${licenseType} data available.`, false); 
            return; 
        }
        
        const filteredData = res.data.filter(row => row.LicenseType === licenseType);
        
        if (filteredData.length === 0) {
            msg($('loginMessage'), `Export failed: No ${licenseType} data available.`, false);
            return;
        }
        
        const h = configs.adminClienteling.headers;
        let csv = h.map(x => x.label).join(',') + ',Annual Budget (€),Variance\n';
        
        const currentYear = new Date().getFullYear();
        const years = [currentYear - 1, currentYear, currentYear + 1];
        const budgets = {};
        
        for (const year of years) {
            const budgetRes = await api('getAnnualBudgets', { year: year });
            if (budgetRes.success && budgetRes.data) {
                budgetRes.data.forEach(b => {
                    const key = `${b.MaisonName}|${b.LicenseType}|${b.Year}`;
                    budgets[key] = parseFloat(b.AnnualTarget) || 0;
                });
            }
        }
        
        filteredData.forEach(r => { 
            csv += h.map(x => { 
                let v = r[x.key]; 
                if (x.key === 'Timestamp') v = fmt(v); 
                return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : (v ?? ''); 
            }).join(',');
            
            const budgetKey = `${r.MaisonName}|${r.LicenseType}|${r.Year}`;
            const budget = budgets[budgetKey] || 0;
            const totalCost = parseFloat(r.TotalCost) || 0;
            const variance = budget > 0 ? ((totalCost - budget) / budget * 100) : 0;
            const varianceSign = variance >= 0 ? '+' : '';
            
            csv += `,${budget.toFixed(2)},${varianceSign}${variance.toFixed(1)}%\n`;
        });
        
        const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const l = document.createElement('a');
        l.href = URL.createObjectURL(b); 
        l.download = `SFSC_${licenseType}_Overview_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.csv`;
        document.body.appendChild(l); 
        l.click(); 
        document.body.removeChild(l);
        
        msg($('loginMessage'), `${licenseType} overview data exported successfully!`, true);
    };

    Object.keys(handlers).forEach(id => {
        const element = $(id);
        if (element) {
            element.addEventListener('click', handlers[id]);
        } else {
            console.warn(`Element with ID "${id}" not found. Skipping event listener.`);
        }
    });
    
    const userSearchInput = $('userSearchInput');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => { 
            searchTerm = $('userSearchInput').value.trim(); 
            renderU(); 
            updCnt(); 
        });
    }

    const maisonNotesInput = $('maisonNotesInput');
    if (maisonNotesInput) {
        maisonNotesInput.addEventListener('input', () => {
            const count = maisonNotesInput.value.length;
            $('notesCharCount').textContent = `${count}/200`;
            if (count >= 200) {
                $('notesCharCount').style.color = '#d32f2f';
            } else {
                $('notesCharCount').style.color = '#666';
            }
        });
    }

    showPage($('loginPage'));
});

