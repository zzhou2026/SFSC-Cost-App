document.addEventListener('DOMContentLoaded', () => {
    // 请替换为您的 Apps Script Web App URL
    const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIVoYBQtqkFB52frxB8e81899ISf_pDwJ_Fj3f9blb7mI2c3QhT4pHoz3sQuG1l6EDVQ/exec';

    const $ = id => document.getElementById(id);
    
    let currentUser = null;
    let configPrices = { ClientelingUnitPrice: 16, FullUnitPrice: 52 };
    let allUsers = [];
    let searchTerm = '';
    let currentYear = new Date().getFullYear();
    let selectedForecastYear = new Date().getFullYear(); // 当前选中的Forecast年份
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
    
// ===== 重置年份 Tab 为默认年份 =====
const resetYearTabs = () => {
    selectedForecastYear = new Date().getFullYear(); // 重置为当前年份
    
    // 更新 Tab 激活状态
    document.querySelectorAll('.year-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const defaultTab = $(`year${selectedForecastYear}Tab`);
    if (defaultTab) defaultTab.classList.add('active');
};

// ===== 更新BT-admin邮箱显示 =====
const updateBTAdminEmail = () => {
    const emailSpan = $('btAdminEmail');
    if (emailSpan && configPrices.BeautyTechEmail) {
        emailSpan.textContent = `BT-admin (${configPrices.BeautyTechEmail})`;
    }
};

    // ===== API 调用 =====
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

    // ===== 成本计算 =====
    const calculateQuarterlyCost = (count, licenseType) => {
        const unitPrice = licenseType === 'Clienteling' 
            ? parseFloat(configPrices.ClientelingUnitPrice) || 16
            : parseFloat(configPrices.FullUnitPrice) || 52;
        return count * unitPrice * 3; // 3个月
    };

        // ===== 季度数据验证 =====
        const validateQuarterData = (values) => {
            // values: [q1, q2, q3, q4] - 数字数组
            const warnings = [];
            
            // 检查递增规则
            for (let i = 1; i < values.length; i++) {
                if (values[i] !== null && values[i - 1] !== null) {
                    if (values[i] < values[i - 1]) {
                        warnings.push(`Q${i + 1} (${values[i]}) is less than Q${i} (${values[i - 1]})`);
                    }
                }
            }
            
            return warnings;
        };
    

        

    // ===== 获取当前季度列表 =====
    const getQuarters = async () => {
        const res = await api('getQuarterList', { numberOfFutureQuarters: 3 });
        if (res.success && res.data && res.data.length >= 4) {
            return res.data.slice(0, 4); // 返回当前季度和未来3个季度
        }
        // 默认返回当前年份的Q1-Q4
        return [`${currentYear}Q1`, `${currentYear}Q2`, `${currentYear}Q3`, `${currentYear}Q4`];
    };  // ← getQuarters 函数的结束



    // ===== 表格配置和渲染 =====  ← 下一个部分开始

    // ===== 表格配置和渲染 =====
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
            headers: [...baseHeaders, { key: 'SubmittedBy', label: 'Submitted By' }, { key: 'Timestamp', label: 'Submission Time' }, { key: 'ApprovalStatus', label: 'Approval Status' }, { key: 'MaisonNotes', label: 'Maison Notes' }],
            actionColumn: 'approve',  // ← 改成 'approve'
            filterLicenseType: 'Clienteling'
        },
        adminFull: {
            action: 'getAllSfscData',
            headers: [...baseHeaders, { key: 'SubmittedBy', label: 'Submitted By' }, { key: 'Timestamp', label: 'Submission Time' }, { key: 'ApprovalStatus', label: 'Approval Status' }, { key: 'MaisonNotes', label: 'Maison Notes' }],
            actionColumn: 'approve',  // ← 改成 'approve'
            filterLicenseType: 'Full'
        },
        
        maisonActionsLog: {
    
            action: 'getMaisonSfscHistory',
            headers: [...baseHistoryHeaders, { key: 'MaisonNotes', label: 'Notes' }],
            renderStatusBadge: false,
            actionColumn: null
        },
        adminActionsLog: {
            action: 'getAllSfscHistory',
            headers: [...baseHistoryHeaders, { key: 'MaisonNotes', label: 'Maison Notes' }, { key: 'AdminNotes', label: 'Admin Notes' }],
            renderStatusBadge: false,
            actionColumn: null
        }
    };

    // ===== 表格渲染 =====
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
        // 根据配置过滤 License Type
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
        html += '</tr></thead><tbody>';

        dataToRender.forEach(row => {
            // 检查是否有减少数量的情况
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
                
                // 格式化成本字段（保留2位小数）
                if (h.key.includes('Cost')) {
                    const num = parseFloat(v);
                    v = isNaN(num) ? '0.00' : num.toFixed(2);
                }
                
                // 限制Notes显示长度
                if ((h.key === 'MaisonNotes' || h.key === 'AdminNotes') && v && v.length > 50) {
                    v = `<span title="${v}">${v.substring(0, 50)}...</span>`;
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
                
                // 构建四个季度的详情（用于邮件通知）
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
            
            html += '</tr>';
        });

        container.innerHTML = html + '</tbody></table>';
        container.innerHTML = html + '</tbody></table>';
    };
    // 检查 Forecast Alert 按钮状态
    const checkForecastAlertStatuses = async (container) => {
        const alertButtons = container.querySelectorAll('.forecast-alert');
        
        for (const button of alertButtons) {
            const maisonName = button.dataset.maison;
            const licenseType = button.dataset.licenseType;
            const budget = button.dataset.budget;
            const forecast = button.dataset.forecast;
            
            // 用 'Annual' 作为 latestMonth，用 'budget|forecast' 作为 latestActualValue
            const latestActualValue = `${budget}|${forecast}`;
            
            const checkRes = await api('checkAlertStatus', {
                maisonName: maisonName,
                licenseType: licenseType,
                latestMonth: 'Annual',
                latestActualValue: latestActualValue
            });
            
            if (checkRes.success && checkRes.alreadySent) {
                button.disabled = true;
                button.textContent = 'Alert Sent';
            }
        }
    };
// 检查同一条记录内是否有季度递减
const checkForDecrease = (row) => {
    const q1 = parseInt(row.Q1Count) || 0;
    const q2 = parseInt(row.Q2Count) || 0;
    const q3 = parseInt(row.Q3Count) || 0;
    const q4 = parseInt(row.Q4Count) || 0;
    
    // 检查是否有递减
    return q2 < q1 || q3 < q2 || q4 < q3;
};


    // ===== Forecast 表格渲染 =====
const loadForecastTable = async (container, licenseType) => {
    const year = selectedForecastYear; // 使用全局变量
    const tableHtml = await generateForecastTableForYear(year, licenseType);
    container.innerHTML = tableHtml;
    await checkForecastAlertStatuses(container);
};

    
    // 新增：生成单个年份的 Forecast 表格
    const generateForecastTableForYear = async (year, licenseType) => {
        const budgetRes = await api('getAnnualBudgets', { year: year });
        const forecastRes = await api('getForecastData', { licenseType: licenseType });
    
        if (!forecastRes.success || !forecastRes.data) {
            return `<p>Failed to load forecast data: ${forecastRes.message || 'Unknown error'}</p>`;
        }
    
        const budgets = {};
        if (budgetRes.success && budgetRes.data) {
            budgetRes.data.forEach(b => {
                const key = `${b.MaisonName}|${b.LicenseType}`;
                budgets[key] = parseFloat(b.AnnualTarget) || 0;
            });
        }
    
        const quarters = [`${year}Q1`, `${year}Q2`, `${year}Q3`, `${year}Q4`];
    
        let html = '<table><thead><tr>';
html += '<th>Maison</th>';
quarters.forEach(q => {
    html += `<th>${q}<br>Qty</th>`;
    html += `<th>${q}<br>Cost (€)</th>`;
});
html += '<th>Annual<br>Forecast (€)</th>';
html += '<th>Annual<br>Budget (€)</th>';
html += '<th>Variance</th>';
html += '<th>Alert</th>';
html += '</tr></thead><tbody>';

        // 按 Maison 分组，并过滤该年份的数据
        const grouped = {};
        forecastRes.data.forEach(row => {
            // 检查季度是否属于当前年份
            const quarterYear = parseInt(row.Quarter.substring(0, 4));
            if (quarterYear !== year) return;
            
            const key = row.MaisonName;
            if (!grouped[key]) {
                grouped[key] = {
                    maisonName: row.MaisonName,
                    quarters: {}
                };
            }
            grouped[key].quarters[row.Quarter] = {
                quantity: row.TotalQuantity || 0,
                cost: row.TotalCost || 0
            };
        });
    
        // 如果没有数据
        if (Object.keys(grouped).length === 0) {
            html += '<tr><td colspan="100%" style="text-align: center; padding: 20px; color: #666;">No forecast data available for this year.</td></tr>';
            html += '</tbody></table>';
            return html;
        }
    
        Object.values(grouped).forEach(item => {
            html += '<tr>';
            html += `<td>${item.maisonName}</td>`;
        
            const budgetKey = `${item.maisonName}|${licenseType}`;
            const budget = budgets[budgetKey] || 0;
        
            let totalForecast = 0;
        
            quarters.forEach(q => {
                const qData = item.quarters[q];
                if (qData) {
                    const qty = parseInt(qData.quantity) || 0;
                    const cost = parseFloat(qData.cost) || 0;
                    totalForecast += cost;
                    html += `<td>${qty}</td>`;
                    html += `<td>${cost.toFixed(2)}</td>`;
                } else {
                    html += `<td>-</td>`;
                    html += `<td>-</td>`;
                }
            });
        
            html += `<td><strong>${totalForecast.toFixed(2)}</strong></td>`;
            html += `<td>${budget.toFixed(2)}</td>`;
    
            // 计算 Variance
            const variance = budget > 0 ? ((totalForecast - budget) / budget * 100) : 0;
            const varianceThreshold = parseFloat(configPrices.VarianceThreshold) || 15;
            
            let varianceClass = 'variance-good';
            if (Math.abs(variance) > varianceThreshold) {
                varianceClass = 'variance-danger';
            } else if (Math.abs(variance) > varianceThreshold / 2) {
                varianceClass = 'variance-warning';
            }
            
            const varianceSign = variance >= 0 ? '+' : '';
            html += `<td class="${varianceClass}">${varianceSign}${variance.toFixed(1)}%</td>`;
    
            // Alert 按钮
            const needsAlert = Math.abs(variance) > varianceThreshold;
            if (needsAlert) {
                html += `<td><button class="alert-button-table forecast-alert" 
                    data-maison="${item.maisonName}" 
                    data-license-type="${licenseType}"
                    data-budget="${budget.toFixed(2)}"
                    data-forecast="${totalForecast.toFixed(2)}"
                    data-variance="${variance.toFixed(1)}">🔔 Alert</button></td>`;
            } else {
                html += `<td>-</td>`;
            }
    
            html += '</tr>';
        });
    
        html += '</tbody></table>';
        return html;
    };
    
    // ===== Monthly Tracking 表格渲染 =====
    const loadMonthlyTrackingTable = async (container, year) => {
        const res = await api('getMonthlyTrackingData', { year: year });

        if (!res.success || !res.data || !res.data.length) {
            container.innerHTML = `<p>${res.data && res.data.length === 0 ? 'No monthly tracking data available. Please set annual targets first.' : 'Failed to load monthly tracking data: ' + (res.message || 'Unknown error')}</p>`;
            return;
        }

        let html = '<table><thead><tr>';
        html += '<th>Maison</th>';
        html += '<th>License Type</th>';
        
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach((m, idx) => {
            html += `<th>${year}.${m}<br>${monthNames[idx]}</th>`;
        });
        
        html += `<th>${year}<br>Forecast</th>`;
        html += '<th>Variance</th>';
        html += '<th>Alert</th>';
        html += '</tr></thead><tbody>';

        for (let rowIdx = 0; rowIdx < res.data.length; rowIdx++) {
            const row = res.data[rowIdx];
            html += '<tr>';
            html += `<td>${row.MaisonName}</td>`;
            html += `<td>${row.LicenseType}</td>`;

            let latestActual = null;
            let latestMonth = null;

            months.forEach(m => {
                const actualQty = row.MonthlyActuals[m];
                if (actualQty !== undefined && actualQty !== null) {
                    html += `<td>${actualQty}</td>`;
                    latestActual = actualQty;
                    latestMonth = m;
                } else {
                    html += `<td>-</td>`;
                }
            });

            const annualTarget = row.AnnualTarget || 0;
            html += `<td>${annualTarget}</td>`;

            if (latestActual !== null) {
                const variance = latestActual - annualTarget;
                const variancePercent = annualTarget > 0 ? Math.abs(variance / annualTarget * 100) : 0;
                
                let varianceClass = 'variance-good';
                if (variancePercent > 15) {
                    varianceClass = 'variance-danger';
                } else if (variancePercent > 5) {
                    varianceClass = 'variance-warning';
                }
                
                const varianceSign = variance >= 0 ? '+' : '';
                html += `<td class="${varianceClass}">${varianceSign}${variance}</td>`;
            } else {
                html += `<td>-</td>`;
            }

            const maisonName = row.MaisonName;
            const licenseType = row.LicenseType;
            const checkRes = await api('checkAlertStatus', {
                maisonName: maisonName,
                licenseType: licenseType,
                latestMonth: latestMonth || '',
                latestActualValue: latestActual !== null ? latestActual : ''
            });

            let buttonDisabled = '';
            let buttonText = 'Alert';
            
            if (checkRes.success && checkRes.alreadySent) {
                buttonDisabled = 'disabled';
                buttonText = 'Alert Sent';
            }

            const alertData = {
                maisonName: maisonName,
                licenseType: licenseType,
                annualTarget: annualTarget,
                latestMonth: latestMonth || '',
                latestActual: latestActual !== null ? latestActual : '',
                variance: latestActual !== null ? (latestActual - annualTarget) : ''
            };
            
            html += `<td><button class="alert-button-table" 
                data-maison="${alertData.maisonName}" 
                data-license-type="${alertData.licenseType}"
                data-annual-target="${alertData.annualTarget}"
                data-latest-month="${alertData.latestMonth}"
                data-latest-actual="${alertData.latestActual}"
                data-variance="${alertData.variance}"
                ${buttonDisabled}>${buttonText}</button></td>`;

            html += '</tr>';
        }

        container.innerHTML = html + '</tbody></table>';
    };

    // ===== 事件委托：表格按钮 =====
    document.addEventListener('click', async e => {
        // Forecast Alert 按钮
        if (e.target.classList.contains('forecast-alert')) {
            const maisonName = e.target.dataset.maison;
            const licenseType = e.target.dataset.licenseType;
            const budget = e.target.dataset.budget;
            const forecast = e.target.dataset.forecast;
            const variance = e.target.dataset.variance;
            const isAlreadySent = e.target.disabled;
            
            if (isAlreadySent) {
                const confirmMsg = `Alert has already been sent for ${maisonName} ${licenseType}\n` +
                                 `(Budget: ${budget}€, Forecast: ${forecast}€).\n\n` +
                                 `Do you want to prepare the email again?`;
                
                if (!confirm(confirmMsg)) {
                    return;
                }
            } else {
                // 记录 Alert 发送
                const latestActualValue = `${budget}|${forecast}`;
                
                const recordRes = await api('recordAlertSent', {
                    maisonName: maisonName,
                    licenseType: licenseType,
                    latestMonth: 'Annual',
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
            
            const subject = `SFSC Budget Variance Alert - ${maisonName} ${licenseType}`;
            
            let body = `Dear ${targetUsername},\n\n`;
            body += `This is an automated alert regarding your SFSC budget variance for ${maisonName} - ${licenseType}.\n\n`;
            body += `=== Summary ===\n`;
            body += `Budget Annuel (${currentYear}): ${budget} €\n`;
            body += `Forecast Annuel (Q1-Q4): ${forecast} €\n`;
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
                // 刷新对应的 Forecast 表格
                if ($('clientelingForecastTab').classList.contains('active')) {
                    await loadForecastTable($('clientelingForecastTableContainer'), 'Clienteling');
                } else {
                    await loadForecastTable($('fullForecastTableContainer'), 'Full');
                }
            }
            return;
        }

        // Monthly Tracking Alert 按钮
        if (e.target.classList.contains('alert-button-table') && !e.target.classList.contains('forecast-alert')) {
            const maisonName = e.target.dataset.maison;
            const licenseType = e.target.dataset.licenseType;
            const annualTarget = e.target.dataset.annualTarget;
            const latestMonth = e.target.dataset.latestMonth;
            const latestActual = e.target.dataset.latestActual;
            const variance = e.target.dataset.variance;
            
            const isAlreadySent = e.target.disabled;
            
            if (isAlreadySent) {
                const confirmMsg = `Alert has already been sent for ${maisonName} ${licenseType}\n` +
                                 `(Month: ${latestMonth || 'N/A'}, Actual: ${latestActual || 'N/A'}).\n\n` +
                                 `Do you want to prepare the email again?`;
                
                if (!confirm(confirmMsg)) {
                    return;
                }
            } else {
                const recordRes = await api('recordAlertSent', {
                    maisonName: maisonName,
                    licenseType: licenseType,
                    latestMonth: latestMonth || '',
                    latestActualValue: latestActual !== null && latestActual !== '' ? latestActual : '',
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
            
            const subject = `SFSC License Variance Alert - ${maisonName} ${licenseType}`;
            
            let body = `Dear ${targetUsername},\n\n`;
            body += `This is an automated alert regarding your SFSC license usage for ${maisonName} - ${licenseType}.\n\n`;
            body += `=== Summary ===\n`;
            body += `Annual Target (${currentYear} Forecast): ${annualTarget}\n`;
            
            if (latestMonth && latestActual !== '') {
                const monthNames = {
                    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
                    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
                    '09': 'September', '10': 'October', '11': 'November', '12': 'December'
                };
                body += `Latest Month: ${monthNames[latestMonth] || latestMonth}\n`;
                body += `Latest Actual: ${latestActual}\n`;
                body += `Variance: ${variance}\n\n`;
                
                if (parseFloat(variance) < 0) {
                    body += `⚠️ Your actual usage is BELOW the target by ${Math.abs(variance)} licenses.\n`;
                } else if (parseFloat(variance) > 0) {
                    body += `⚠️ Your actual usage is ABOVE the target by ${variance} licenses.\n`;
                } else {
                    body += `✓ Your actual usage matches the target.\n`;
                }
            } else {
                body += `No monthly actual data has been submitted yet.\n`;
            }
            
            body += `\nPlease review your license usage and take appropriate action if needed.\n`;
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

        // Approve/Reject 按钮
const id = e.target.dataset.id;
if (!id) return;

if (e.target.classList.contains('approve-button-table') || e.target.classList.contains('reject-button-table')) {
    const st = e.target.classList.contains('approve-button-table') ? 'Approved' : 'Rejected';
    
    const submittedBy = e.target.dataset.submittedBy || '';
    const maisonName = e.target.dataset.maisonName || '';
    const year = e.target.dataset.year || '';
    const licenseType = e.target.dataset.licenseType || '';
    const totalCost = e.target.dataset.totalCost || '0';
    const timestamp = e.target.dataset.timestamp || '';
    const maisonNotes = e.target.dataset.maisonNotes || '';
    const quarterDetails = e.target.dataset.quarterDetails || '';
    
    // 弹出对话框让Admin输入备注
    const adminNotes = prompt(`${st === 'Approved' ? 'Approve' : 'Reject'} this submission?\n\nYear: ${year}\nMaison: ${maisonName}\nLicense Type: ${licenseType}\nTotal Cost: ${totalCost}€\n\nYou can add optional notes below:`, '');
    
    if (adminNotes === null) return; // 用户取消
    
    const res = await api('updateApprovalStatus', { 
        recordId: id, 
        newStatus: st, 
        actionBy: currentUser.username,
        adminNotes: adminNotes
    });
    
    msg($('loginMessage'), res.success ? `Status: ${st}` : 'Update failed: ' + res.message, res.success);
    
    if (res.success) {
        // 刷新 Overview 的两个 Tab
        loadTable('adminClienteling', $('overviewClientelingTableContainer'));
        loadTable('adminFull', $('overviewFullTableContainer'));
        
        // 刷新历史记录
        loadTable('adminActionsLog', $('adminActionsLogTableContainer'));
        
        if (submittedBy) {
            sendApprovalNotification(submittedBy, st, maisonName, year, licenseType, quarterDetails, totalCost, timestamp, maisonNotes, adminNotes);
        }
    }
}

    });
    // ===== Email 管理 =====
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
    

    // ===== Email Broadcast =====
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

    // ===== 填充选择器 =====
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
    // ===== 事件处理器 =====
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
                    
                    // 更新标题显示许可证类型
                    $('maisonSubmitTitle').textContent = `Submit Quarterly Forecast (${currentUser.licenseType} Licenses)`;
                    updateBTAdminEmail();
                      // ========== 在这里添加年份选择器初始化 ==========
    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear, currentYear + 1, currentYear + 2]
        .map(y => `<option value="${y}">${y}</option>`)
        .join('');
    $('forecastYearSelect').innerHTML = yearOptions;
    $('forecastYearSelect').value = currentYear;
    // ========== 添加结束 ==========
                    // 清空输入框
                    $('q1Input').value = '';
                    $('q2Input').value = '';
                    $('q3Input').value = '';
                    $('q4Input').value = '';
                    $('maisonNotesInput').value = '';
                    clr($('validationMessage'));
                    clr($('maisonSubmitMessage'));
                    
                    // 清空计算器
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
                    loadForecastTable($('clientelingForecastTableContainer'), 'Clienteling');
                    loadForecastTable($('fullForecastTableContainer'), 'Full');
                    loadTable('adminActionsLog', $('adminActionsLogTableContainer'));
                    initBcast();
                    
                    popYearSelectors();
                    popMaisonSelectors();
                    loadMonthlyTrackingTable($('monthlyTrackingTableContainer'), currentYear);
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
            // ===== 强制验证：所有四个季度都必须填写 =====
            if (!q1 || !q2 || !q3 || !q4) {
                msg($('maisonSubmitMessage'), 'Please fill in all four quarters! If the quantity remains unchanged, please re-enter the original value.', false);
                return;
            }
            
            // 验证输入是否为有效数字
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
            
            // 验证递增规则
            const values = [q1Num, q2Num, q3Num, q4Num];
            const warnings = [];
            
            for (let i = 1; i < values.length; i++) {
                if (values[i] < values[i - 1]) {
                    warnings.push(`Q${i + 1} (${values[i]}) is less than Q${i} (${values[i - 1]})`);
                }
            }
            
            // 获取季度列表（用于生成 "2026Q1" 格式）
            const quarters = [`${selectedYear}Q1`, `${selectedYear}Q2`, `${selectedYear}Q3`, `${selectedYear}Q4`];
            
            // 构建确认消息
            let confirmMsg = '';
            
            // 如果有 Warning，先显示
            if (warnings.length > 0) {
                const beautyTechEmail = configPrices.BeautyTechEmail || 'beautytech@example.com';
                confirmMsg += '⚠️ WARNING ⚠️\n';
                confirmMsg += warnings.join('\n') + '\n\n';
                confirmMsg += `Due to contract restrictions, license quantities should not decrease during the year.\n`;
                confirmMsg += `If you need to reduce licenses, contact Beauty Tech at ${beautyTechEmail} AFTER submitting.\n\n`;
                confirmMsg += '═'.repeat(50) + '\n\n';
            }
            
            // 检查是否有现有数据
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
confirmMsg += `Year: ${selectedYear}\n`;  // ← 把 new Date().getFullYear() 改为 selectedYear
confirmMsg += `License Type: ${currentUser.licenseType}\n\n`;

            
            // ========== 修改显示逻辑 ==========
values.forEach((val, idx) => {
    const marker = isUpdate && existingData && existingData[idx] !== val 
        ? ` (changed from ${existingData[idx]})` 
        : isUpdate 
        ? ' (no change)' 
        : ' (new)';
    confirmMsg += `Q${idx + 1}: ${val}${marker}\n`;
});
// ========== 修改结束 ==========

            
            if (maisonNotes) {
                confirmMsg += `\nYour Notes: ${maisonNotes}\n`;
            }
            
            confirmMsg += '\nDo you want to proceed?';
            
            if (!confirm(confirmMsg)) {
                msg($('maisonSubmitMessage'), 'Submission cancelled.', false);
                return;
            }
            
            // 构建季度数据（使用 "2026Q1" 格式）
            const quarterData = quarters.slice(0, 4).map((q, idx) => ({
                quarter: q,
                count: values[idx]
            }));
            
            // 提交数据
            const res = await api('submitSfscData', {
                maisonName: currentUser.maisonName,
                licenseType: currentUser.licenseType,
                quarterData: quarterData,
                submittedBy: currentUser.username,
                maisonNotes: maisonNotes
            });
            
            if (res.success) {
                msg($('maisonSubmitMessage'), `Forecast ${isUpdate ? 'updated' : 'submitted'} successfully! Total Cost: ${res.totalCost}€`, true);
                
                // 清空表单
                $('q1Input').value = '';
                $('q2Input').value = '';
                $('q3Input').value = '';
                $('q4Input').value = '';
                $('maisonNotesInput').value = '';
                clr($('validationMessage'));
                
                // 重新加载表格
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
                
                // 重新加载 Forecast 表格
                if ($('clientelingForecastTab').classList.contains('active')) {
                    loadForecastTable($('clientelingForecastTableContainer'), 'Clienteling');
                } else {
                    loadForecastTable($('fullForecastTableContainer'), 'Full');
                }
            }
        },

        clientelingForecastTab: () => {
            resetYearTabs();
            $('clientelingForecastTab').classList.add('active');
            $('fullForecastTab').classList.remove('active');
            $('clientelingForecastContainer').classList.remove('hidden');
            $('clientelingForecastContainer').classList.add('active');
            $('fullForecastContainer').classList.add('hidden');
            $('fullForecastContainer').classList.remove('active');
            loadForecastTable($('clientelingForecastTableContainer'), 'Clienteling');
        },

        fullForecastTab: () => {
            resetYearTabs();
            $('fullForecastTab').classList.add('active');
            $('clientelingForecastTab').classList.remove('active');
            $('fullForecastContainer').classList.remove('hidden');
            $('fullForecastContainer').classList.add('active');
            $('clientelingForecastContainer').classList.add('hidden');
            $('clientelingForecastContainer').classList.remove('active');
            loadForecastTable($('fullForecastTableContainer'), 'Full');
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

        exportClientelingDataButton: async () => {
            await exportOverviewData('Clienteling');
        },

        exportFullDataButton: async () => {
            await exportOverviewData('Full');
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

        exportClientelingForecastButton: async () => {
            await exportForecastData('Clienteling');
        },

        exportFullForecastButton: async () => {
            await exportForecastData('Full');
        },
        submitTargetButton: async () => {
            if (!currentUser || currentUser.role !== 'admin') { 
                msg($('targetSubmitMessage'), 'Admin only!', false); 
                return; 
            }
            
            const year = parseInt($('targetYearSelect').value);
            const maison = $('targetMaisonSelect').value;
            const clientelingTarget = parseInt($('targetClientelingInput').value) || 0;
            const fullTarget = parseInt($('targetFullInput').value) || 0;
            
            if (!maison) { 
                msg($('targetSubmitMessage'), 'Please select a Maison!', false); 
                return; 
            }
            
            clr($('targetSubmitMessage'));
            msg($('targetSubmitMessage'), 'Submitting targets...', true);
            
            if (clientelingTarget >= 0) {
                const resC = await api('setAnnualTarget', {
                    maisonName: maison,
                    licenseType: 'Clienteling',
                    year: year,
                    annualTarget: clientelingTarget,
                    updatedBy: currentUser.username
                });
                if (!resC.success) {
                    msg($('targetSubmitMessage'), 'Failed to set Clienteling target: ' + resC.message, false);
                    return;
                }
            }
            
            if (fullTarget >= 0) {
                const resF = await api('setAnnualTarget', {
                    maisonName: maison,
                    licenseType: 'Full',
                    year: year,
                    annualTarget: fullTarget,
                    updatedBy: currentUser.username
                });
                if (!resF.success) {
                    msg($('targetSubmitMessage'), 'Failed to set Full target: ' + resF.message, false);
                    return;
                }
            }
            
            msg($('targetSubmitMessage'), 'Annual targets set successfully!', true);
            $('targetClientelingInput').value = '0';
            $('targetFullInput').value = '0';
            
            loadMonthlyTrackingTable($('monthlyTrackingTableContainer'), year);
        },

        submitActualButton: async () => {
            if (!currentUser || currentUser.role !== 'admin') { 
                msg($('actualSubmitMessage'), 'Admin only!', false); 
                return; 
            }
            
            const year = parseInt($('actualYearSelect').value);
            const month = $('actualMonthSelect').value;
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
                const resC = await api('submitMonthlyActual', {
                    maisonName: maison,
                    licenseType: 'Clienteling',
                    year: year,
                    month: month,
                    actualQuantity: clientelingActual,
                    updatedBy: currentUser.username
                });
                if (!resC.success) {
                    msg($('actualSubmitMessage'), 'Failed to submit Clienteling actual: ' + resC.message, false);
                    return;
                }
            }
            
            if (fullActual >= 0) {
                const resF = await api('submitMonthlyActual', {
                    maisonName: maison,
                    licenseType: 'Full',
                    year: year,
                    month: month,
                    actualQuantity: fullActual,
                    updatedBy: currentUser.username
                });
                if (!resF.success) {
                    msg($('actualSubmitMessage'), 'Failed to submit Full actual: ' + resF.message, false);
                    return;
                }
            }
            
            msg($('actualSubmitMessage'), 'Monthly actual data submitted successfully!', true);
            $('actualClientelingInput').value = '0';
            $('actualFullInput').value = '0';
            
            loadMonthlyTrackingTable($('monthlyTrackingTableContainer'), year);
        },

        exportMonthlyTrackingButton: async () => {
            if (!currentUser || currentUser.role !== 'admin') { alert('Admin only!'); return; }
            
            const year = parseInt($('actualYearSelect').value) || currentYear;
            const res = await api('getMonthlyTrackingData', { year: year });
            
            if (!res.success || !res.data || !res.data.length) {
                msg($('loginMessage'), 'Export failed: No monthly tracking data available.', false);
                return;
            }
            
            const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            let csv = 'Maison,License Type,';
            months.forEach(m => { csv += `${year}.${m},`; });
            csv += `${year} Forecast,Variance\n`;
            
            res.data.forEach(row => {
                csv += `${row.MaisonName},${row.LicenseType},`;
                
                let latestActual = null;
                months.forEach(m => {
                    const actualQty = row.MonthlyActuals[m];
                    csv += actualQty !== undefined && actualQty !== null ? `${actualQty},` : '-,';
                    if (actualQty !== undefined && actualQty !== null) {
                        latestActual = actualQty;
                    }
                });
                
                const annualTarget = row.AnnualTarget || 0;
                csv += `${annualTarget},`;
                
                if (latestActual !== null) {
                    const variance = latestActual - annualTarget;
                    csv += `${variance >= 0 ? '+' : ''}${variance}`;
                } else {
                    csv += '-';
                }
                csv += '\n';
            });
            
            const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const l = document.createElement('a');
            l.href = URL.createObjectURL(b);
            l.download = `Monthly_Tracking_${year}_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.csv`;
            document.body.appendChild(l);
            l.click();
            document.body.removeChild(l);
            
            msg($('loginMessage'), 'Monthly tracking data exported successfully!', true);
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

    // 导出 Forecast 数据的辅助函数
const exportForecastData = async (licenseType) => {
    if (!currentUser || currentUser.role !== 'admin') { alert('Admin only!'); return; }
    
    const budgetRes = await api('getAnnualBudgets', { year: selectedForecastYear });
    const forecastRes = await api('getForecastData', { licenseType: licenseType });
    
    if (!forecastRes.success || !forecastRes.data || !forecastRes.data.length) {
        msg($('loginMessage'), `Export failed: No ${licenseType} forecast data available.`, false);
        return;
    }

    const budgets = {};
    if (budgetRes.success && budgetRes.data) {
        budgetRes.data.forEach(b => {
            const key = `${b.MaisonName}|${b.LicenseType}`;
            budgets[key] = parseFloat(b.AnnualTarget) || 0;
        });
    }

    const quarters = [`${selectedForecastYear}Q1`, `${selectedForecastYear}Q2`, `${selectedForecastYear}Q3`, `${selectedForecastYear}Q4`];

    let csv = 'Maison,';
    quarters.forEach(q => {
        csv += `${q} Qty,${q} Cost (€),`;
    });
    csv += 'Annual Forecast (€),Annual Budget (€),Variance %\n';

    const grouped = {};
    forecastRes.data
        .filter(row => {
            // 只导出选中年份的数据
            const rowYear = parseInt(row.Quarter.substring(0, 4));
            return rowYear === selectedForecastYear;
        })
        .forEach(row => {
            const key = row.MaisonName;
            if (!grouped[key]) {
                grouped[key] = {
                    maisonName: row.MaisonName,
                    quarters: {}
                };
            }
            grouped[key].quarters[row.Quarter] = {
                quantity: row.TotalQuantity || 0,
                cost: row.TotalCost || 0
            };
        });

    Object.values(grouped).forEach(item => {
        const budgetKey = `${item.maisonName}|${licenseType}`;
        const budget = budgets[budgetKey] || 0;
        let totalForecast = 0;
        let row = `${item.maisonName},`;

        quarters.forEach(q => {
            const qData = item.quarters[q];
            if (qData) {
                const qty = parseInt(qData.quantity) || 0;
                const cost = parseFloat(qData.cost) || 0;
                totalForecast += cost;
                row += `${qty},${cost.toFixed(2)},`;
            } else {
                row += '-,-,';
            }
        });

        const variance = budget > 0 ? ((totalForecast - budget) / budget * 100) : 0;
        row += `${totalForecast.toFixed(2)},${budget.toFixed(2)},${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%\n`;
        csv += row;
    });

    const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const l = document.createElement('a');
    l.href = URL.createObjectURL(b);
    l.download = `SFSC_${licenseType}_Forecast_${selectedForecastYear}_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.csv`;
    document.body.appendChild(l);
    l.click();
    document.body.removeChild(l);

    msg($('loginMessage'), `${licenseType} forecast data for ${selectedForecastYear} exported successfully!`, true);
};

    // 导出 Overview 数据的辅助函数
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
        
        // 过滤指定 License Type 的数据
        const filteredData = res.data.filter(row => row.LicenseType === licenseType);
        
        if (filteredData.length === 0) {
            msg($('loginMessage'), `Export failed: No ${licenseType} data available.`, false);
            return;
        }
        
        const h = configs.admin.headers;
        let csv = h.map(x => x.label).join(',') + '\n';
        
        filteredData.forEach(r => { 
            csv += h.map(x => { 
                let v = r[x.key]; 
                if (x.key === 'Timestamp') v = fmt(v); 
                return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : (v ?? ''); 
            }).join(',') + '\n'; 
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


    // 统一绑定事件
    Object.keys(handlers).forEach(id => {
        const element = $(id);
        if (element) {
            element.addEventListener('click', handlers[id]);
        } else {
            console.warn(`Element with ID "${id}" not found. Skipping event listener.`);
        }
    });
    
    // 搜索输入框事件
    const userSearchInput = $('userSearchInput');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => { 
            searchTerm = $('userSearchInput').value.trim(); 
            renderU(); 
            updCnt(); 
        });
    }

        // Notes 字符计数
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
        // ===== 第二层 Tab: 年份切换事件 =====
document.querySelectorAll('.year-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        const clickedYear = parseInt(e.target.dataset.year);
        
        // 更新选中年份
        selectedForecastYear = clickedYear;
        
        // 更新 Tab 激活状态
        document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        // 重新加载当前激活的 Forecast 表格
        if ($('clientelingForecastTab').classList.contains('active')) {
            loadForecastTable($('clientelingForecastTableContainer'), 'Clienteling');
        } else {
            loadForecastTable($('fullForecastTableContainer'), 'Full');
        }
    });
});

    
        // 初始化
        showPage($('loginPage'));
    });
    