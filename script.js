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

    // ===== API 调    =====
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
        { key: 'CalculatedCost', label: 'Calculated Cost' }
    ];

    const configs = {
        maison: {
            action: 'getMaisonSfscData', // 获取 Maison 当前数据
            headers: [...baseHeaders, { key: 'Timestamp', label: 'Submission Time' }, { key: 'ApprovalStatus', label: 'Approval Status' }],
            actionColumn: 'delete'
        },
        admin: {
            action: 'getAllSfscData', // 获取所有 Maison 当前数据
            headers: [...baseHeaders, { key: 'SubmittedBy', label: 'Submitted By' }, { key: 'Timestamp', label: 'Submission Time' }, { key: 'ApprovalStatus', label: 'Approval Status' }],
            actionColumn: 'approve'
        },
        // NEW: SFSC_History 表的配置 (如果未来需要显示)
        maisonHistory: {
            action: 'getMaisonSfscHistory', // 获取 Maison 历史记录
            headers: [
                { key: 'MaisonName', label: 'Maison Name' },
                { key: 'Quarter', label: 'Quarter' },
                { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' },
                { key: 'FullLicenseCount', label: 'Full Licenses' },
                { key: 'CalculatedCost', label: 'Calculated Cost' },
                { key: 'SubmittedBy', label: 'Submitted By' },
                { key: 'Timestamp', label: 'Submission Timestamp' },
                { key: 'ApprovalStatus', label: 'Approval Status' },
                { key: 'Action', label: 'Action Type' }, // NEW
                { key: 'ActionTimestamp', label: 'Action Time' }, // NEW
                { key: 'ActionBy', label: 'Action By' } // NEW
            ],
            actionColumn: null // 历史记录通常不需要操作列
        },
        adminHistory: {
            action: 'getAllSfscHistory', // 获取所有历史记录
            headers: [
                { key: 'MaisonName', label: 'Maison Name' },
                { key: 'Quarter', label: 'Quarter' },
                { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' },
                { key: 'FullLicenseCount', label: 'Full Licenses' },
                { key: 'CalculatedCost', label: 'Calculated Cost' },
                { key: 'SubmittedBy', label: 'Submitted By' },
                { key: 'Timestamp', label: 'Submission Timestamp' },
                { key: 'ApprovalStatus', label: 'Approval Status' },
                { key: 'Action', label: 'Action Type' }, // NEW
                { key: 'ActionTimestamp', label: 'Action Time' }, // NEW
                { key: 'ActionBy', label: 'Action By' } // NEW
            ],
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

        res.data.forEach(row => {
            html += '<tr>' + cfg.headers.map(h => {
                let v = row[h.key];
                if (h.key === 'Timestamp' || h.key === 'ActionTimestamp') v = fmt(v); // NEW: 格式化 ActionTimestamp
                if (h.key === 'ApprovalStatus') {
                    const sc = { Pending: 'status-pending', Approved: 'status-approved', Rejected: 'status-rejected' }[v] || 'status-pending';
                    v = `<span class="status-badge ${sc}">${v}</span>`;
                }
                return `<td>${v ?? ''}</td>`;
            }).join('');

            if (cfg.actionColumn === 'delete') html += `<td><button class="delete-button-table" data-id="${row.RecordId}">Delete</button></td>`;
            else if (cfg.actionColumn === 'approve') html += `<td><button class="approve-button-table" data-id="${row.RecordId}">Approve</button><button class="reject-button-table" data-id="${row.RecordId}">Reject</button></td>`;
            html += '</tr>';
        });

        container.innerHTML = html + '</tbody></table>';
    };

    // ===== 事件委托：表格按钮 =====
    document.addEventListener('click', async e => {
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains('delete-button-table')) {
            if (!confirm('Delete this record?')) return;
            // NEW: 传递 actionBy 参数
            const res = await api('deleteSfscData', { recordId: id, actionBy: currentUser.username });
            msg($('maisonSubmitMessage'), res.success ? 'Deleted!' : 'Delete failed: ' + res.message, res.success);
            if (res.success) loadTable('maison', $('maisonHistoryTableContainer'), { maisonName: currentUser.maisonName });
        } else if (e.target.classList.contains('approve-button-table') || e.target.classList.contains('reject-button-table')) {
            const st = e.target.classList.contains('approve-button-table') ? 'Approved' : 'Rejected';
            if (!confirm(`Set to ${st}?`)) return;
            // NEW: 传递 actionBy 参数
            const res = await api('updateApprovalStatus', { recordId: id, newStatus: st, actionBy: currentUser.username });
            msg($('loginMessage'), res.success ? `Status: ${st}` : 'Update failed: ' + res.message, res.success);
            if (res.success) loadTable('admin', $('adminDataTableContainer'));
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

    // ===== Email Broadcast =====
    const filtered = () => {
        if (!searchTerm) return allUsers;
        const t = searchTerm.toLowerCase();
        return allUsers.filter(u => [(u.username || ''), (u.email || ''), (u.maisonName || '')].some(f => f.toLowerCase().includes(t)));
    };

    const selected = () => Array.from($('userListContainer').querySelectorAll('.user-checkbox:checked')).map(cb => cb.dataset.email).filter(e => e && valid(e));

    const renderU = () => {
        const f = filtered();
        if (!f.length) { $('userListContainer').innerHTML = '<p class="no-users-text">No users found.</p>'; return; }
        $('userListContainer').innerHTML = f.map((u, i) => {
            const id = `user-${i}-${(u.email || '').replace(/[^a-zA-Z0-9]/g, '_')}`; // Ensure valid ID
            return `<div class="user-checkbox-item"><input type="checkbox" id="${id}" class="user-checkbox" data-email="${u.email || ''}" ${u.email ? '' : 'disabled'}><label for="${id}" class="user-checkbox-label"><span class="user-name">${u.username || 'N/A'}</span><span class="user-email">${u.email || 'No email'}</span>${u.maisonName ? `<span class="user-maison">${u.maisonName}</span>` : ''}</label></div>`;
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
                    loadTable('maison', $('maisonHistoryTableContainer'), { maisonName: currentUser.maisonName }); // This will now load current data
                    // If you want to show actual historical data in a separate section, you'd call loadTable('maisonHistory', newContainer, { maisonName: currentUser.maisonName }); here
                    initEmail();
                } else {
                    $('adminView').classList.remove('hidden'); $('maisonView').classList.add('hidden');
                    loadTable('admin', $('adminDataTableContainer')); // This will now load current data
                    // If you want to show actual historical data in a separate section, you'd call loadTable('adminHistory', newContainer); here
                    initBcast();
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
            window.location.href = `mailto:${em.join(',')}${p.length ? '?' + p.join('&') : ''}`;
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
