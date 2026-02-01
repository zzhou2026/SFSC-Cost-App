document.addEventListener('DOMContentLoaded', () => {
    // 请替换为您的 Apps Script Web App URL
    const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIVoYBQtqkFB52frxB8e81899ISf_pDwJ_Fj3f9blb7mI2c3QhT4pHoz3sQuG1l6EDVQ/exec';

    const $ = id => document.getElementById(id);
    
    let currentUser = null;
    let configPrices = { ClientelingUnitPrice: 16, FullUnitPrice: 52, FixedCost: 0 };
    let allUsers = [];
    let searchTerm = '';

    // ===== 工具函数 =====
    const showPage = page => {
        document.querySelectorAll('.page').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
        page.classList.remove('hidden');
        page.classList.add('active');
    };

    const msg = (el, text, ok = false) => {
        el.textContent = text;
        el.className = `message ${ok ? 'success' : 'error'}`;
    };

    const clr = el => { el.textContent = ''; el.className = 'message'; };
    
    const valid = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const fmt = ts => {
        try {
            const d = new Date(ts);
            return isNaN(d) ? ts : d.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch { return ts; }
    };

    // ===== API 调用 =====
    const api = async (act, data = {}) => {
        const silent = ['getQuarterList', 'getConfig', 'checkExistingRecord', 'getUserEmail', 'getAllUsers', 'getAllSfscHistory', 'getMaisonSfscHistory']; // NEW: 添加历史记录API
        const loading = !silent.includes(act);

        try {
            if (loading) msg($('loginMessage'), 'Requesting...', true);
            if (act === 'submitSfscData') {
                data.clientelingLicenseCount = parseInt(data.clientelingLicenseCount, 10) || 0;
                data.fullLicenseCount = parseInt(data.fullLicenseCount, 10) || 0;
            }
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

    // ===== 表格配置（优化：共享基础 headers）=====
    // SFSC_Data 表的配置
    const baseHeaders = [
        { key: 'MaisonName', label: 'Maison Name' },
        { key: 'Quarter', label: 'Quarter' },
        { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' },
        { key: 'FullLicenseCount', label: 'Full Licenses' },
        { key: 'CalculatedCost', label: 'Calculated Cost (\u20AC)' }
    ];

    // NEW: 历史记录表格的基础头部
    const baseHistoryHeaders = [
        { key: 'MaisonName', label: 'Maison Name' },
        { key: 'Quarter', label: 'Quarter' },
        { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' },
        { key: 'FullLicenseCount', label: 'Full Licenses' },
        { key: 'CalculatedCost', label: 'Calculated Cost(\u20AC)' },
        { key: 'SubmittedBy', label: 'Submitted By' },
        { key: 'Timestamp', label: 'Submission Time' }, // 这是 SFSC_Data 中的 Timestamp
        { key: 'ApprovalStatus', label: 'Approval Status' },
        { key: 'Action', label: 'Action Type' }, // NEW
        { key: 'ActionTimestamp', label: 'Action Time' }, // NEW
        { key: 'ActionBy', label: 'Action By' } // NEW
    ];

    const configs = {
        maison: {
            action: 'getMaisonSfscData', // 获取 Maison 当前数据
            headers: [...baseHeaders, { key: 'Timestamp', label: 'Submission Time' }, { key: 'ApprovalStatus', label: 'Approval Status' }],
            actionColumn: null // Removed Action column for My Current Data table
        },
        admin: {
            action: 'getAllSfscData', // 获取所有 Maison 当前数据
            headers: [...baseHeaders, { key: 'SubmittedBy', label: 'Submitted By' }, { key: 'Timestamp', label: 'Submission Time' }, { key: 'ApprovalStatus', label: 'Approval Status' }],
            actionColumn: 'approve'
        },
        // NEW: SFSC_History 表的配置
        maisonActionsLog: { // 针对 Maison 用户的历史操作日志
            action: 'getMaisonSfscHistory',
            // Move "Action Type" to the end and replace it with a derived "Status" column
            headers: [
                ...baseHistoryHeaders.filter(h => h.key !== 'Action'),
                { key: 'Current', label: 'Status' }
            ],
            renderStatusBadge: false, // My Historical Actions: show plain text status
            computeCurrentFlag: true,
            actionColumn: null // 历史记录通常不需要操作列
        },
        adminActionsLog: { // 针对 Admin 用户的历史操作日志
            action: 'getAllSfscHistory',
            // Keep Admin history consistent: show derived "Status" column at the end
            headers: [
                ...baseHistoryHeaders.filter(h => h.key !== 'Action'),
                { key: 'Current', label: 'Status' }
            ],
            renderStatusBadge: false,  //
            computeCurrentFlag: true,
            actionColumn: null
        }
        ,
        // NEW: Forecast table configuration
        forecast: {
            action: 'getForecastData',
            headers: null, // Will be dynamically generated
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

        let html = '<table><thead><tr>' + cfg.headers.map(h => `<th>${h.label}</th>`).join('');
        if (cfg.actionColumn) html += `<th>${cfg.actionColumn === 'delete' ? 'Action' : 'Approval Action'}</th>`;
        html += '</tr></thead><tbody>';

        // Derive "Status" (active/deprecated) for history tables:
        // Latest record (by Timestamp) within same MaisonName + Quarter + SubmittedBy => "active"
        if (cfg.computeCurrentFlag) {
            const latestByKey = new Map();
            const toMs = (v) => {
                const t = new Date(v).getTime();
                return Number.isFinite(t) ? t : -Infinity;
            };

            res.data.forEach(r => {
                const key = `${r.MaisonName ?? ''}||${r.Quarter ?? ''}||${r.SubmittedBy ?? ''}`;
                const ts = toMs(r.Timestamp);
                const prev = latestByKey.get(key);
                if (prev === undefined || ts > prev) latestByKey.set(key, ts);
            });

            res.data.forEach(r => {
                const key = `${r.MaisonName ?? ''}||${r.Quarter ?? ''}||${r.SubmittedBy ?? ''}`;
                const ts = toMs(r.Timestamp);
                r.Current = (latestByKey.get(key) === ts) ? 'Active' : 'Deprecated';
            });
        }

        res.data.forEach(row => {
            html += '<tr>' + cfg.headers.map(h => {
                let v = row[h.key];
                // NEW: 格式化 Timestamp 和 ActionTimestamp
                if (h.key === 'Timestamp' || h.key === 'ActionTimestamp') v = fmt(v); 
                if (h.key === 'ApprovalStatus') {
                    if (cfg.renderStatusBadge === false) {
                        // Keep plain text for this table
                        v = v ?? '';
                    } else {
                        const sc = { Pending: 'status-pending', Approved: 'status-approved', Rejected: 'status-rejected' }[v] || 'status-pending';
                        v = `<span class="status-badge ${sc}">${v}</span>`;
                    }
                }
                return `<td>${v ?? ''}</td>`;
            }).join('');

            if (cfg.actionColumn === 'delete') html += `<td><button class="delete-button-table" data-id="${row.RecordId}">Delete</button></td>`;
            else if (cfg.actionColumn === 'approve') {
                const submittedBy = row.SubmittedBy || '';
                const maisonName = row.MaisonName || '';
                const quarter = row.Quarter || '';
                const clientelingLicenses = row.ClientelingLicenseCount || '0';
                const fullLicenses = row.FullLicenseCount || '0';
                const calculatedCost = row.CalculatedCost || '0';
                const timestamp = row.Timestamp || '';
                html += `<td><button class="approve-button-table" data-id="${row.RecordId}" data-submitted-by="${submittedBy}" data-maison-name="${maisonName}" data-quarter="${quarter}" data-clienteling="${clientelingLicenses}" data-full="${fullLicenses}" data-cost="${calculatedCost}" data-timestamp="${timestamp}">Approve</button><button class="reject-button-table" data-id="${row.RecordId}" data-submitted-by="${submittedBy}" data-maison-name="${maisonName}" data-quarter="${quarter}" data-clienteling="${clientelingLicenses}" data-full="${fullLicenses}" data-cost="${calculatedCost}" data-timestamp="${timestamp}">Reject</button></td>`;
            }
            html += '</tr>';
        });

        container.innerHTML = html + '</tbody></table>';
    };
    
    // ===== NEW: 预测表格渲染 =====
    const loadForecastTable = async (container) => {
        const res = await api('getForecastData');

        if (!res.success || !res.data || !res.data.length) {
            container.innerHTML = `<p>${res.data && res.data.length === 0 ? 'No forecast data available.' : 'Failed to load forecast data: ' + (res.message || 'Unknown error')}</p>`;
            return;
        }

        const currentYear = new Date().getFullYear();
        const quarters = [`${currentYear}Q1`, `${currentYear}Q2`, `${currentYear}Q3`, `${currentYear}Q4`];

                // Build table header
                let html = '<table><thead><tr>';
                html += '<th>Maison</th>';
                html += '<th>License Type</th>';
                quarters.forEach(q => {
                    html += `<th>${q}<br>Qty</th>`;
                    html += `<th>${q}<br>Cost (€)</th>`;
                });
                html += '<th>Total<br>Qty</th>';
                html += '<th>Total<br>Cost (€)</th>';
                html += '</tr></thead><tbody>';
        


        // Group data by Maison and LicenseType
        const grouped = {};
        res.data.forEach(row => {
            const key = `${row.MaisonName}|${row.LicenseType}`;
            if (!grouped[key]) {
                grouped[key] = {
                    maisonName: row.MaisonName,
                    licenseType: row.LicenseType,
                    quarters: {}
                };
            }
            grouped[key].quarters[row.Quarter] = {
                quantity: row.TotalQuantity || 0,
                cost: row.TotalCost || 0
            };
        });

        // Render rows
        Object.values(grouped).forEach(item => {
            html += '<tr>';
            html += `<td>${item.maisonName}</td>`;
            html += `<td>${item.licenseType}</td>`;

            let totalQty = 0;
            let totalCost = 0;

            quarters.forEach(q => {
                const qData = item.quarters[q];
                
                if (qData) {
                    // 有提交数据
                    const qty = parseInt(qData.quantity) || 0;
                    const cost = parseFloat(qData.cost) || 0;

                    totalQty += qty;
                    totalCost += cost;

                    html += `<td>${qty}</td>`;
                    html += `<td>${cost.toFixed(2)}</td>`;
                } else {
                    // 没有提交数据，显示 -
                    html += `<td>-</td>`;
                    html += `<td>-</td>`;
                }
            });


            html += `<td>${totalQty}</td>`;
            html += `<td>${totalCost.toFixed(2)}</td>`;
            html += '</tr>';
        });

        container.innerHTML = html + '</tbody></table>';
    };
        // ===== NEW: 月度跟踪表格渲染 =====
        const loadMonthlyTrackingTable = async (container, year) => {
            const res = await api('getMonthlyTrackingData', { year: year });
    
            if (!res.success || !res.data || !res.data.length) {
                container.innerHTML = `<p>${res.data && res.data.length === 0 ? 'No monthly tracking data available. Please set annual targets first.' : 'Failed to load monthly tracking data: ' + (res.message || 'Unknown error')}</p>`;
                return;
            }
    
            // 构建表头
            let html = '<table><thead><tr>';
            html += '<th>Maison</th>';
            html += '<th>License Type</th>';
            
            // 12个月份列
            const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            months.forEach((m, idx) => {
                html += `<th>${year}.${m}<br>${monthNames[idx]}</th>`;
            });
            
            html += '<th>2026<br>Forecast</th>';
            html += '<th>Variance</th>';
            html += '<th>Alert</th>'; // NEW: Alert column
            html += '</tr></thead><tbody>';
    
            // 渲染数据行
            for (const row of res.data) {
                html += '<tr>';
                html += `<td>${row.MaisonName}</td>`;
                html += `<td>${row.LicenseType}</td>`;
    
                let latestActual = null;
                let latestMonth = null;
    
                // 显示12个月的实际数据
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
    
                // 年度预测
                const annualTarget = row.AnnualTarget || 0;
                html += `<td>${annualTarget}</td>`;
    
                // 计算差值（最新月份实际 - 年度预测）
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
    
                // NEW: Alert button with status check
                if (latestActual !== null && latestMonth !== null) {
                    // Check if alert has been sent for this data
                    const statusRes = await api('checkAlertStatus', {
                        maisonName: row.MaisonName,
                        licenseType: row.LicenseType,
                        latestMonth: latestMonth,
                        latestActualValue: latestActual
                    });
    
                    const alreadySent = statusRes.success && statusRes.alreadySent;
                    const buttonClass = alreadySent ? 'alert-button-table sent' : 'alert-button-table';
                    const buttonText = alreadySent ? 'Alert Sent' : 'Alert';
                    
                    html += `<td><button class="${buttonClass}" 
                        data-maison="${row.MaisonName}" 
                        data-license-type="${row.LicenseType}" 
                        data-latest-month="${latestMonth}" 
                        data-latest-actual="${latestActual}" 
                        data-annual-target="${annualTarget}"
                        data-already-sent="${alreadySent}"
                        data-last-sent-time="${statusRes.lastSentTime || ''}"
                        data-last-sent-by="${statusRes.lastSentBy || ''}">${buttonText}</button></td>`;
                } else {
                    html += `<td>-</td>`;
                }
    
                html += '</tr>';
            }
    
            container.innerHTML = html + '</tbody></table>';
        };
        // ===== END NEW: 月度跟踪表格渲染 =====
    



        // ===== 事件委托：表格按钮 =====
        document.addEventListener('click', async e => {
            // Handle Alert button clicks
            if (e.target.classList.contains('alert-button-table')) {
                const button = e.target;
                const maisonName = button.dataset.maison;
                const licenseType = button.dataset.licenseType;
                const latestMonth = button.dataset.latestMonth;
                const latestActual = button.dataset.latestActual;
                const annualTarget = button.dataset.annualTarget;
                const alreadySent = button.dataset.alreadySent === 'true';
                const lastSentTime = button.dataset.lastSentTime;
                const lastSentBy = button.dataset.lastSentBy;
    
                // Check if already sent
                if (alreadySent) {
                    const formattedTime = lastSentTime ? fmt(lastSentTime) : 'unknown time';
                    const confirmMsg = `This alert has been sent on ${formattedTime} by ${lastSentBy || 'unknown user'}.\n\nSend again?`;
                    if (!confirm(confirmMsg)) return;
                }
    
                // Prepare email content
                const username = `${maisonName}-${licenseType}`;
                const subject = '[Reminder] Significant Difference Between Actual and Budgeted SFSC License Quantities';
                const body = `Dear ${username},
    
    We have noticed that the actual usage of SFSC licenses in your department/maison differs significantly from the budgeted forecast. Please review and verify the situation.
    
    Budgeted Quantity: ${annualTarget}
    Actual Quantity: ${latestActual}
    
    Thank you for your cooperation!
    
    Best regards,
    BT-admin`;
    
                $('emailSubjectInput').value = subject;
                $('emailContentInput').value = body;
    
                // Load users if not already loaded
                if (!allUsers || !allUsers.length) {
                    const res = await api('getAllUsers');
                    if (res.success && res.data) {
                        allUsers = res.data.filter(u => u.email && u.email.trim());
                    }
                }
    
                // Select the specific user
                if (allUsers && allUsers.length) {
                    searchTerm = '';
                    if ($('userSearchInput')) $('userSearchInput').value = '';
                    renderU();
                    
                    $('userListContainer').querySelectorAll('.user-checkbox').forEach(cb => {
                        cb.checked = (cb.dataset.username || '').trim() === username;
                    });
                    updCnt();
                }
    
                // Record alert sent
                const recordRes = await api('recordAlertSent', {
                    maisonName: maisonName,
                    licenseType: licenseType,
                    latestMonth: latestMonth,
                    latestActualValue: latestActual,
                    sentBy: currentUser.username
                });
    
                if (recordRes.success) {
                    // Update button state
                    button.classList.add('sent');
                    button.textContent = 'Alert Sent';
                    button.dataset.alreadySent = 'true';
                    button.dataset.lastSentTime = new Date().toISOString();
                    button.dataset.lastSentBy = currentUser.username;
    
                    msg($('emailBroadcastMessage'), 'Alert email prepared. Please review and click "Open in Outlook" to send.', true);
                    $('emailBroadcastSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    msg($('emailBroadcastMessage'), 'Failed to record alert: ' + recordRes.message, false);
                }
    
                return;
            }
            
            const id = e.target.dataset.id;
            if (!id) return;
    
            if (e.target.classList.contains('delete-button-table')) {
                if (!confirm('Delete this record?')) return;
                // NEW: 传递 actionBy 参数
                const res = await api('deleteSfscData', { recordId: id, actionBy: currentUser.username });
                msg($('maisonSubmitMessage'), res.success ? 'Deleted!' : 'Delete failed: ' + res.message, res.success);
                if (res.success) {
                    loadTable('maison', $('maisonHistoryTableContainer'), { maisonName: currentUser.maisonName });
                    loadTable('maisonActionsLog', $('maisonActionsLogTableContainer'), { maisonName: currentUser.maisonName }); // NEW: 重新加载历史日志
                }
            } else if (e.target.classList.contains('approve-button-table') || e.target.classList.contains('reject-button-table')) {
                const st = e.target.classList.contains('approve-button-table') ? 'Approved' : 'Rejected';
                if (!confirm(`Set to ${st}?`)) return;
                
                // Get applicant information from button data attributes
                const submittedBy = e.target.dataset.submittedBy || '';
                const maisonName = e.target.dataset.maisonName || '';
                const quarter = e.target.dataset.quarter || '';
                const clientelingLicenses = e.target.dataset.clienteling || '0';
                const fullLicenses = e.target.dataset.full || '0';
                const calculatedCost = e.target.dataset.cost || '0';
                const timestamp = e.target.dataset.timestamp || '';
                
                // NEW: 传递 actionBy 参数
                const res = await api('updateApprovalStatus', { recordId: id, newStatus: st, actionBy: currentUser.username });
                msg($('loginMessage'), res.success ? `Status: ${st}` : 'Update failed: ' + res.message, res.success);
                
                if (res.success) {
                    loadTable('admin', $('adminDataTableContainer'));
                    loadTable('adminActionsLog', $('adminActionsLogTableContainer')); // NEW: 重新加载历史日志
                    
                    // Send notification email to applicant
                    if (submittedBy) {
                        sendApprovalNotification(submittedBy, st, maisonName, quarter, clientelingLicenses, fullLicenses, calculatedCost, timestamp);
                    }
                }
            }
        });
    

    // ===== 季度/月份选择器 =====
    const popQ = async () => {
        const res = await api('getQuarterList', { numberOfFutureQuarters: 4 });
        if (res.success && res.data) $('quarterSelect').innerHTML = res.data.map(q => `<option value="${q}">${q}</option>`).join('');
        else { console.error('Quarter failed:', res.message); msg($('maisonSubmitMessage'), 'Failed to load quarters.', false); }
    };

    const popM = () => {
        $('calcMonthsSelect').innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
        $('calcMonthsSelect').value = 12;
    };
    
    // ===== NEW: 填充年份和 Maison 选择器（月度跟踪用）=====
    const popYearSelectors = () => {
        const currentYear = new Date().getFullYear();
        const years = [currentYear - 1, currentYear, currentYear + 1];
        const yearOptions = years.map(y => `<option value="${y}">${y}</option>`).join('');
        
        if ($('targetYearSelect')) $('targetYearSelect').innerHTML = yearOptions;
        if ($('actualYearSelect')) $('actualYearSelect').innerHTML = yearOptions;
        
        // 默认选中当前年份
        if ($('targetYearSelect')) $('targetYearSelect').value = currentYear;
        if ($('actualYearSelect')) $('actualYearSelect').value = currentYear;
    };

    const popMaisonSelectors = async () => {
        const res = await api('getAllUsers');
        if (!res.success || !res.data) return;
        
        // 提取唯一的 Maison 名称（排除 BT）
        const maisons = [...new Set(res.data
            .filter(u => u.maisonName && u.maisonName !== 'BT')
            .map(u => u.maisonName))];
        
        const maisonOptions = maisons.map(m => `<option value="${m}">${m}</option>`).join('');
        
        if ($('targetMaisonSelect')) $('targetMaisonSelect').innerHTML = maisonOptions;
        if ($('actualMaisonSelect')) $('actualMaisonSelect').innerHTML = maisonOptions;
    };
    // ===== END NEW =====



    // ===== 成本计算 =====
    const calc = (c, f, m) => ((c * (parseFloat(configPrices.ClientelingUnitPrice) || 16) + f * (parseFloat(configPrices.FullUnitPrice) || 52)) * m + (parseFloat(configPrices.FixedCost) || 0));

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
        if (!currentUser || currentUser.role !== 'maison') { $('emailManagementSection').classList.add('hidden'); return; }
        $('emailManagementSection').classList.remove('hidden');
        clr($('emailMessage'));
        const res = await api('getUserEmail', { username: currentUser.username });
        setEmailUI(res.success && res.email, res.email || '');
    };

    // ===== Approval Notification Email (prepare in Email Broadcast; admin clicks "Open in Outlook" to send) =====
    const buildNotificationBody = (submittedBy, status, maisonName, quarter, clientelingLicenses, fullLicenses, calculatedCost, timestamp) => {
        const statusText = status === 'Approved' ? 'Approved' : 'Rejected';
        const formattedTimestamp = timestamp ? fmt(timestamp) : (timestamp || '');
        return (
            `Dear ${submittedBy},\n\n` +
            `Your SFSC license application has been ${statusText.toLowerCase()}.\n\n` +
            `Maison Name: ${maisonName || ''}\n` +
            `Quarter: ${quarter || ''}\n` +
            `Clienteling Licenses: ${clientelingLicenses || '0'}\n` +
            `Full Licenses: ${fullLicenses || '0'}\n` +
            `Calculated Cost: ${calculatedCost || '0'} €\n` +
            `Submitted By: ${submittedBy || ''}\n` +
            `Submission Time: ${formattedTimestamp}\n` +
            `Approval Status: ${statusText}\n\n` +
            `Best regards,\nBT-admin`
        );
    };

    const sendApprovalNotification = async (submittedBy, status, maisonName, quarter, clientelingLicenses, fullLicenses, calculatedCost, timestamp) => {
        try {
            const emailRes = await api('getUserEmail', { username: submittedBy });
            if (!emailRes.success || !emailRes.email) {
                msg($('emailBroadcastMessage'), `Applicant "${submittedBy}" has no registered email. Notification not prepared.`, false);
                return;
            }
            const applicantEmail = emailRes.email.trim();
            const statusText = status === 'Approved' ? 'Approved' : 'Rejected';
            const subject = `SFSC License Application ${statusText} - ${quarter}`;
            const body = buildNotificationBody(submittedBy, status, maisonName, quarter, clientelingLicenses, fullLicenses, calculatedCost, timestamp);

            // Pre-fill Email Broadcast section
            $('emailSubjectInput').value = subject;
            $('emailContentInput').value = body;

            // Ensure user list is loaded and select only the applicant
            if (!allUsers || !allUsers.length) {
                const res = await api('getAllUsers');
                if (res.success && res.data) allUsers = res.data.filter(u => u.email && u.email.trim());
            }
            
            // **修改点1：通过username查找用户，而不是email**
            const hasApplicant = allUsers && allUsers.some(u => (u.username || '').trim() === submittedBy);
            if (!hasApplicant && allUsers) {
                allUsers = [...allUsers, { username: submittedBy, email: applicantEmail, maisonName: '' }];
            }
            if (allUsers && allUsers.length) {
                searchTerm = '';
                if ($('userSearchInput')) $('userSearchInput').value = '';
                renderU();
                
                // **修改点2：通过username匹配checkbox，而不是email**
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
        return allUsers.filter(u => [(u.username || ''), (u.email || ''), (u.maisonName || '')].some(f => f.toLowerCase().includes(t)));
    };

    const selected = () => Array.from($('userListContainer').querySelectorAll('.user-checkbox:checked')).map(cb => cb.dataset.email).filter(e => e && valid(e));

    // **修改点3：在渲染用户列表时，给checkbox添加data-username属性**
    const renderU = () => {
        const f = filtered();
        if (!f.length) { $('userListContainer').innerHTML = '<p class="no-users-text">No users found.</p>'; return; }
        $('userListContainer').innerHTML = f.map((u, i) => {
            const id = `user-${i}-${(u.email || '').replace(/[^a-zA-Z0-9]/g, '_')}`; // Ensure valid ID
            return `<div class="user-checkbox-item"><input type="checkbox" id="${id}" class="user-checkbox" data-email="${u.email || ''}" data-username="${u.username || ''}" ${u.email ? '' : 'disabled'}><label for="${id}" class="user-checkbox-label"><span class="user-name">${u.username || 'N/A'}</span><span class="user-email">${u.email || 'No email'}</span>${u.maisonName ? `<span class="user-maison">${u.maisonName}</span>` : ''}</label></div>`;
        }).join('');
    };

    const updCnt = () => {
        const cnt = selected().length;
        $('recipientCountDisplay').textContent = cnt > 0 ? `Selected: ${cnt} recipient(s)` : 'No recipients selected.';
        $('recipientCountDisplay').style.color = cnt > 0 ? '#00796b' : '#999';
        $('recipientCountDisplay').classList.remove('hidden');
    };

    $('userListContainer').addEventListener('change', e => { if (e.target.classList.contains('user-checkbox')) updCnt(); });

    const initBcast = async () => {
        if (!currentUser || currentUser.role !== 'admin') { $('emailBroadcastSection').classList.add('hidden'); return; }
        $('emailBroadcastSection').classList.remove('hidden');
        $('userListContainer').innerHTML = '<p class="loading-text">Loading users...</p>';
        const res = await api('getAllUsers');
        if (res.success && res.data) { allUsers = res.data.filter(u => u.email && u.email.trim()); renderU(); updCnt(); }
        else $('userListContainer').innerHTML = `<p class="error-text">Failed to load users: ${res.message || 'Unknown'}</p>`;
    };

    // ===== 事件监听器（优化：集中处理）=====
    const handlers = {
        loginButton: async () => {
            const u = $('username').value.trim(), p = $('password').value.trim();
            if (!u || !p) { msg($('loginMessage'), 'Enter credentials!', false); return; }
            const res = await api('login', { username: u, password: p });
            if (!res.success) { msg($('loginMessage'), 'Login failed: ' + res.message, false); return; }
            msg($('loginMessage'), 'Login successful!', true);
            currentUser = { username: u, role: res.role, maisonName: res.maisonName };
            const cfg = await api('getConfig');
            if (cfg.success && cfg.data) Object.assign(configPrices, { ClientelingUnitPrice: parseFloat(cfg.data.ClientelingUnitPrice) || 16, FullUnitPrice: parseFloat(cfg.data.FullUnitPrice) || 52, FixedCost: parseFloat(cfg.data.FixedCost) || 0 });
            setTimeout(() => {
                showPage($('loginPage')); // Start on login page, then transition
                showPage($('mainPage'));
                $('welcomeMessage').textContent = `Welcome, ${currentUser.maisonName} (${currentUser.role})!`;
                if (currentUser.role === 'maison') {
                    $('maisonView').classList.remove('hidden'); $('adminView').classList.add('hidden');
                    popQ(); popM();
                    $('clientelingLicenseCount').value = $('fullLicenseCount').value = '0';
                    $('calculatedCostDisplay').textContent = 'Estimated Cost: 0.00 €';
                    loadTable('maison', $('maisonHistoryTableContainer'), { maisonName: currentUser.maisonName }); // Load current data
                    loadTable('maisonActionsLog', $('maisonActionsLogTableContainer'), { maisonName: currentUser.maisonName }); // NEW: Load historical actions log
                    initEmail();
                } else {
                    $('adminView').classList.remove('hidden'); $('maisonView').classList.add('hidden');
                    loadTable('admin', $('adminDataTableContainer')); // Load current data
                    loadForecastTable($('forecastTableContainer')); // NEW: Load forecast table
                    loadTable('adminActionsLog', $('adminActionsLogTableContainer')); // NEW: Load all historical actions log
                    initBcast();
                    // NEW: 初始化月度跟踪部分
                    popYearSelectors();
                    popMaisonSelectors();
                    const currentYear = new Date().getFullYear();
                    loadMonthlyTrackingTable($('monthlyTrackingTableContainer'), currentYear);
                }


            }, 500);
        },
        logoutButton: () => {
            currentUser = null;
            $('username').value = $('password').value = '';
            clr($('loginMessage')); clr($('maisonSubmitMessage')); clr($('emailMessage')); clr($('calculatorErrorMessage')); clr($('emailBroadcastMessage'));
            showPage($('loginPage'));
        },
        submitSfscDataButton: async () => {
            if (!currentUser || currentUser.role !== 'maison') { msg($('maisonSubmitMessage'), 'Maison user only!', false); return; }
            const q = $('quarterSelect').value, c = parseInt($('clientelingLicenseCount').value, 10), f = parseInt($('fullLicenseCount').value, 10);
            if (!q || c < 0 || f < 0 || isNaN(c) || isNaN(f)) { msg($('maisonSubmitMessage'), 'Invalid inputs!', false); return; }
            
            // Check for existing record
            const chk = await api('checkExistingRecord', { maisonName: currentUser.maisonName, quarter: q });
            let id = null;
            if (chk.success && chk.exists) {
                if (!confirm(`An existing record for ${q} will be updated. Do you want to proceed?`)) {
                    msg($('maisonSubmitMessage'), 'Submission cancelled.', false);
                    return;
                }
                id = chk.recordId;
            }

            const res = await api('submitSfscData', { 
                maisonName: currentUser.maisonName, 
                quarter: q, 
                clientelingLicenseCount: c, 
                fullLicenseCount: f, 
                submittedBy: currentUser.username, 
                recordIdToUpdate: id 
            });

            if (res.success) { 
                msg($('maisonSubmitMessage'), `${id ? 'Updated' : 'Submitted'}! Cost: ${res.calculatedCost} €`, true); 
                $('clientelingLicenseCount').value = $('fullLicenseCount').value = '0'; 
                loadTable('maison', $('maisonHistoryTableContainer'), { maisonName: currentUser.maisonName }); 
                loadTable('maisonActionsLog', $('maisonActionsLogTableContainer'), { maisonName: currentUser.maisonName }); // NEW: 重新加载历史日志
            } else {
                msg($('maisonSubmitMessage'), 'Failed to submit/update: ' + res.message, false);
            }
        },
        seeCostButton: () => {
            clr($('calculatorErrorMessage'));
            const c = parseInt($('calcClientelingLicenseCount').value, 10) || 0, f = parseInt($('calcFullLicenseCount').value, 10) || 0, m = parseInt($('calcMonthsSelect').value, 10) || 12;
            if (c < 0 || f < 0 || m < 1 || m > 12) { msg($('calculatorErrorMessage'), 'Invalid input for licenses or months!', false); $('calculatedCostDisplay').textContent = 'Estimated Cost: NaN €'; return; }
            $('calculatedCostDisplay').textContent = `Estimated Cost: ${calc(c, f, m).toFixed(2)} €`;
            $('calculatedCostDisplay').classList.remove('error'); $('calculatedCostDisplay').classList.add('success');
        },
        exportDataButton: async () => {
            if (!currentUser || currentUser.role !== 'admin') { alert('Admin only!'); return; }
            const res = await api('getAllSfscData'); // Assuming export current data, not history
            if (!res.success || !res.data || !res.data.length) { msg($('loginMessage'), 'Export failed: No data available.', false); return; }
            const h = configs.admin.headers; // Use admin headers for SFSC_Data
            let csv = h.map(x => x.label).join(',') + '\n';
            res.data.forEach(r => { 
                csv += h.map(x => { 
                    let v = r[x.key]; 
                    if (x.key === 'Timestamp') v = fmt(v); 
                    // Handle values that might contain commas or quotes for CSV
                    return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v; 
                }).join(',') + '\n'; 
            });
            const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' }), l = document.createElement('a');
            l.href = URL.createObjectURL(b); l.download = `SFSC_Data_Export_${new Date().toLocaleDateString('en-US')}.csv`;
            document.body.appendChild(l); l.click(); document.body.removeChild(l);
            msg($('loginMessage'), 'Data exported successfully!', true);
        },
        
         // ← 新增：导出历史数据
    exportHistoryDataButton: async () => {
        if (!currentUser || currentUser.role !== 'admin') { alert('Admin only!'); return; }
        const res = await api('getAllSfscHistory');  // 调用历史数据API
        if (!res.success || !res.data || !res.data.length) { 
            msg($('loginMessage'), 'Export failed: No history data available.', false); 
            return; 
        }
        
        const h = configs.adminActionsLog.headers;  // 使用历史表格的headers
        let csv = h.map(x => x.label).join(',') + '\n';
        
        res.data.forEach(r => { 
            csv += h.map(x => { 
                let v = r[x.key]; 
                // 格式化时间戳
                if (x.key === 'Timestamp' || x.key === 'ActionTimestamp') v = fmt(v);
                // 处理包含逗号或引号的值
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
    exportForecastButton: async () => {
        if (!currentUser || currentUser.role !== 'admin') { alert('Admin only!'); return; }
        const res = await api('getForecastData');
        if (!res.success || !res.data || !res.data.length) { 
            msg($('loginMessage'), 'Export failed: No forecast data available.', false); 
            return; 
        }

        const currentYear = new Date().getFullYear();
        const quarters = [`${currentYear}Q1`, `${currentYear}Q2`, `${currentYear}Q3`, `${currentYear}Q4`];

        // Build CSV header
        let csv = 'Maison,License Type,';
        quarters.forEach(q => {
            csv += `${q} Qty,${q} Cost,`;
        });
        csv += 'Total Qty,Total Cost\n';

        // Group data by Maison and LicenseType
        const grouped = {};
        res.data.forEach(row => {
            const key = `${row.MaisonName}|${row.LicenseType}`;
            if (!grouped[key]) {
                grouped[key] = {
                    maisonName: row.MaisonName,
                    licenseType: row.LicenseType,
                    quarters: {}
                };
            }
            grouped[key].quarters[row.Quarter] = {
                quantity: row.TotalQuantity || 0,
                cost: row.TotalCost || 0
            };
        });

        // Build CSV rows
        Object.values(grouped).forEach(item => {
            let totalQty = 0;
            let totalCost = 0;
            let row = `${item.maisonName},${item.licenseType},`;

            quarters.forEach(q => {
                const qData = item.quarters[q] || { quantity: 0, cost: 0 };
                const qty = parseInt(qData.quantity) || 0;
                const cost = parseFloat(qData.cost) || 0;

                totalQty += qty;
                totalCost += cost;

                row += `${qty},${cost.toFixed(2)},`;
            });

            row += `${totalQty},${totalCost.toFixed(2)}\n`;
            csv += row;
        });

        const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const l = document.createElement('a');
        l.href = URL.createObjectURL(b); 
        l.download = `SFSC_Forecast_${currentYear}_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.csv`;
        document.body.appendChild(l); 
        l.click(); 
        document.body.removeChild(l);

        msg($('loginMessage'), 'Forecast data exported successfully!', true);
    },
    submitTargetButton: async () => {
        if (!currentUser || currentUser.role !== 'admin') { msg($('targetSubmitMessage'), 'Admin only!', false); return; }
        
        const year = parseInt($('targetYearSelect').value);
        const maison = $('targetMaisonSelect').value;
        const clientelingTarget = parseInt($('targetClientelingInput').value) || 0;
        const fullTarget = parseInt($('targetFullInput').value) || 0;
        
        if (!maison) { msg($('targetSubmitMessage'), 'Please select a Maison!', false); return; }
        
        clr($('targetSubmitMessage'));
        msg($('targetSubmitMessage'), 'Submitting targets...', true);
        
        // 提交 Clienteling 目标
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
        
        // 提交 Full 目标
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
        
        // 重新加载月度跟踪表格
        loadMonthlyTrackingTable($('monthlyTrackingTableContainer'), year);
    },
    submitActualButton: async () => {
        if (!currentUser || currentUser.role !== 'admin') { msg($('actualSubmitMessage'), 'Admin only!', false); return; }
        
        const year = parseInt($('actualYearSelect').value);
        const month = $('actualMonthSelect').value;
        const maison = $('actualMaisonSelect').value;
        const clientelingActual = parseInt($('actualClientelingInput').value) || 0;
        const fullActual = parseInt($('actualFullInput').value) || 0;
        
        if (!maison) { msg($('actualSubmitMessage'), 'Please select a Maison!', false); return; }
        
        clr($('actualSubmitMessage'));
        msg($('actualSubmitMessage'), 'Submitting actual data...', true);
        
        // 提交 Clienteling 实际数据
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
        
        // 提交 Full 实际数据
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
        
        // 重新加载月度跟踪表格
        loadMonthlyTrackingTable($('monthlyTrackingTableContainer'), year);
    },
    exportMonthlyTrackingButton: async () => {
        if (!currentUser || currentUser.role !== 'admin') { alert('Admin only!'); return; }
        
        const year = parseInt($('actualYearSelect').value) || new Date().getFullYear();
        const res = await api('getMonthlyTrackingData', { year: year });
        
        if (!res.success || !res.data || !res.data.length) {
            msg($('loginMessage'), 'Export failed: No monthly tracking data available.', false);
            return;
        }
        
        // 构建 CSV
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



        submitEmailButton: async () => {
            if (!currentUser || currentUser.role !== 'maison') { msg($('emailMessage'), 'Maison only.', false); return; }
            const e = $('userEmailInput').value.trim();
            if (!e) { msg($('emailMessage'), 'Email address cannot be empty!', false); return; }
            if (!valid(e)) { msg($('emailMessage'), 'Invalid email format!', false); return; }
            msg($('emailMessage'), 'Saving email...', true);
            const res = await api('updateUserEmail', { username: currentUser.username, email: e });
            msg($('emailMessage'), res.success ? 'Email saved successfully!' : 'Failed to save email: ' + res.message, res.success);
            if (res.success) initEmail();
        },
        editEmailButton: () => {
            $('emailDisplay').classList.add('hidden'); $('editEmailButton').classList.add('hidden');
            $('emailForm').classList.remove('hidden'); $('userEmailInput').value = $('registeredEmailValue').textContent;
            $('submitEmailButton').textContent = 'Save Changes'; $('cancelEditEmailButton').classList.remove('hidden');
            clr($('emailMessage'));
        },
        cancelEditEmailButton: () => { initEmail(); clr($('emailMessage')); },
        selectAllButton: () => { 
            $('userListContainer').querySelectorAll('.user-checkbox:not(:disabled)').forEach(c => c.checked = true); 
            updCnt(); 
        },
        deselectAllButton: () => { 
            $('userListContainer').querySelectorAll('.user-checkbox').forEach(c => c.checked = false); 
            updCnt(); 
        },
        openOutlookButton: () => {
            const em = selected();
            if (!em.length) { msg($('emailBroadcastMessage'), 'No recipients selected to send email.', false); return; }
            const s = encodeURIComponent($('emailSubjectInput').value.trim()), b = encodeURIComponent($('emailContentInput').value.trim());
            const p = [s && `subject=${s}`, b && `body=${b}`].filter(Boolean);
            const mailtoLink = `mailto:${em.join(',')}${p.length ? '?' + p.join('&') : ''}`;
            
            // Use a temporary anchor element to trigger mailto: link (more reliable than window.location.href)
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
            if (!em.length) { msg($('emailBroadcastMessage'), 'No recipients selected to copy emails.', false); return; }
            const list = em.join('; ');
            navigator.clipboard.writeText(list).then(() => msg($('emailBroadcastMessage'), `Copied ${em.length} email(s) to clipboard!`, true)).catch(() => {
                // Fallback for older browsers or if clipboard API is not allowed
                const t = document.createElement('textarea'); t.value = list; t.style.position = 'fixed'; t.style.left = '-9999px';
                document.body.appendChild(t); t.select();
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
            // Auto-fill email subject and content
            const subject = 'SFSC License Quantity Forecast Data Collection';
            const body = `Dear All,

As part of our regular business forecast process, we kindly ask you to submit your forecasted SFSC license quantities for the period from Q1 2026 to Q4 2026. This information is essential for our upcoming budget planning cycle. Please complete the required details using the form below.

Deadline: 
Form Link: 

Your timely response is critical to ensuring accurate business planning. If you have any questions or require assistance, please contact [contact person or team].

Thank you for your cooperation.

Best regards,
BT-admin`;

            $('emailSubjectInput').value = subject;
            $('emailContentInput').value = body;
            
            // Select all users with email
            $('userListContainer').querySelectorAll('.user-checkbox:not(:disabled)').forEach(c => c.checked = true);
            updCnt();
            
            // Show success message
            msg($('emailBroadcastMessage'), 'Data collection email template loaded and all users selected. Please review and click "Open in Outlook" to send.', true);
            
            // Scroll to email content area for review
            $('emailSubjectInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

    };

    // 统一绑定事件
    Object.keys(handlers).forEach(id => {
        const element = $(id);
        if (element) { // Check if element exists before adding listener
            element.addEventListener('click', handlers[id]);
        } else {
            console.warn(`Element with ID "${id}" not found. Skipping event listener.`);
        }
    });
    
    // Ensure search input exists before adding listener
    const userSearchInput = $('userSearchInput');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => { 
            searchTerm = $('userSearchInput').value.trim(); 
            renderU(); 
            updCnt(); 
        });
    } else {
        console.warn('Element with ID "userSearchInput" not found. Skipping event listener.');
    }

    showPage($('loginPage'));
});

