document.addEventListener('DOMContentLoaded', () => {
    const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIVoYBQtqkFB52frxB8e81899ISf_pDwJ_Fj3f9blb7mI2c3QhT4pHoz3sQuG1l6EDVQ/exec';

    // DOM 元素快速访问
    const $ = id => document.getElementById(id);
    
    // 全局状态
    let currentUser = null;
    let configPrices = { ClientelingUnitPrice: 16, FullUnitPrice: 52, FixedCost: 0 };
    let allUsers = [];
    let searchTerm = ''; // 只保留搜索词，不保存 filteredUsers

    // ===== 工具函数 =====
    const showPage = page => {
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        page.classList.remove('hidden');
    };

    const showMessage = (el, msg, isSuccess = false) => {
        el.textContent = msg;
        el.className = `message ${isSuccess ? 'success' : 'error'}`;
    };

    const clearMessage = el => {
        el.textContent = '';
        el.className = 'message';
    };

    const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const formatTimestamp = ts => {
        try {
            const date = new Date(ts);
            return isNaN(date) ? ts : date.toLocaleString('en-US', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return ts;
        }
    };

    // ===== API 调用 =====
    const callAppsScript = async (action, payload = {}) => {
        const silentActions = ['getQuarterList', 'getConfig', 'checkExistingRecord', 'getUserEmail', 'getAllUsers'];
        const showLoading = !silentActions.includes(action);

        try {
            if (showLoading) showMessage($('loginMessage'), 'Requesting...', true);

            if (action === 'submitSfscData') {
                payload.clientelingLicenseCount = parseInt(payload.clientelingLicenseCount, 10) || 0;
                payload.fullLicenseCount = parseInt(payload.fullLicenseCount, 10) || 0;
            }

            const response = await fetch(APP_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action, ...payload })
            });

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, message: 'Network error: ' + error.message };
        } finally {
            if (showLoading) clearMessage($('loginMessage'));
        }
    };

    // ===== 表格渲染（优化：统一的数据加载和渲染逻辑）=====
    const TABLE_CONFIGS = {
        maison: {
            action: 'getMaisonSfscData',
            headers: [
                { key: 'MaisonName', label: 'Maison Name' },
                { key: 'Quarter', label: 'Quarter' },
                { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' },
                { key: 'FullLicenseCount', label: 'Full Licenses' },
                { key: 'CalculatedCost', label: 'Calculated Cost' },
                { key: 'Timestamp', label: 'Submission Time' },
                { key: 'ApprovalStatus', label: 'Approval Status' }
            ],
            actionColumn: 'delete'
        },
        admin: {
            action: 'getAllSfscData',
            headers: [
                { key: 'MaisonName', label: 'Maison Name' },
                { key: 'Quarter', label: 'Quarter' },
                { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' },
                { key: 'FullLicenseCount', label: 'Full Licenses' },
                { key: 'CalculatedCost', label: 'Calculated Cost' },
                { key: 'SubmittedBy', label: 'Submitted By' },
                { key: 'Timestamp', label: 'Submission Time' },
                { key: 'ApprovalStatus', label: 'Approval Status' }
            ],
            actionColumn: 'approve'
        }
    };

    // 优化：统一的加载和渲染函数
    const loadAndRenderTable = async (type, container, params = {}) => {
        const config = TABLE_CONFIGS[type];
        const result = await callAppsScript(config.action, params);

        if (!result.success || !result.data) {
            container.innerHTML = `<p>Failed to load data: ${result.message || 'Unknown error'}</p>`;
            return;
        }

        if (result.data.length === 0) {
            container.innerHTML = '<p>No data available.</p>';
            return;
        }

        // 构建表格 HTML
        let html = '<table><thead><tr>';
        config.headers.forEach(h => html += `<th>${h.label}</th>`);
        if (config.actionColumn) html += `<th>${config.actionColumn === 'delete' ? 'Action' : 'Approval Action'}</th>`;
        html += '</tr></thead><tbody>';

        result.data.forEach(row => {
            html += '<tr>';
            config.headers.forEach(h => {
                let value = row[h.key];
                if (h.key === 'Timestamp') value = formatTimestamp(value);
                if (h.key === 'ApprovalStatus') {
                    const statusClass = { Pending: 'status-pending', Approved: 'status-approved', Rejected: 'status-rejected' }[value] || 'status-pending';
                    value = `<span class="status-badge ${statusClass}">${value}</span>`;
                }
                html += `<td>${value ?? ''}</td>`;
            });

            if (config.actionColumn === 'delete') {
                html += `<td><button class="delete-button-table" data-id="${row.RecordId}">Delete</button></td>`;
            } else if (config.actionColumn === 'approve') {
                html += `<td><button class="approve-button-table" data-id="${row.RecordId}">Approve</button><button class="reject-button-table" data-id="${row.RecordId}">Reject</button></td>`;
            }
            html += '</tr>';
        });

        container.innerHTML = html + '</tbody></table>';
    };

    // 优化：使用事件委托处理表格按钮点击
    document.addEventListener('click', async e => {
        const target = e.target;
        const recordId = target.dataset.id;
        if (!recordId) return;

        if (target.classList.contains('delete-button-table')) {
            if (!confirm('Delete this record?')) return;
            const result = await callAppsScript('deleteSfscData', { recordId });
            if (result.success) {
                showMessage($('maisonSubmitMessage'), 'Deleted successfully!', true);
                loadAndRenderTable('maison', $('maisonHistoryTableContainer'), { maisonName: currentUser.maisonName });
            } else {
                showMessage($('maisonSubmitMessage'), 'Delete failed: ' + result.message, false);
            }
        } else if (target.classList.contains('approve-button-table') || target.classList.contains('reject-button-table')) {
            const newStatus = target.classList.contains('approve-button-table') ? 'Approved' : 'Rejected';
            if (!confirm(`Set status to ${newStatus}?`)) return;
            const result = await callAppsScript('updateApprovalStatus', { recordId, newStatus });
            if (result.success) {
                showMessage($('loginMessage'), `Status updated to ${newStatus}`, true);
                loadAndRenderTable('admin', $('adminDataTableContainer'));
            } else {
                showMessage($('loginMessage'), 'Update failed: ' + result.message, false);
            }
        }
    });

    // ===== 季度和月份选择器 =====
    const populateQuarterSelect = async () => {
        const result = await callAppsScript('getQuarterList', { numberOfFutureQuarters: 4 });
        if (result.success && result.data) {
            $('quarterSelect').innerHTML = result.data.map(q => `<option value="${q}">${q}</option>`).join('');
        } else {
            console.error('Failed to load quarters:', result.message);
            showMessage($('maisonSubmitMessage'), 'Failed to load quarter options.', false);
        }
    };

    const populateCalcMonthsSelect = () => {
        $('calcMonthsSelect').innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
        $('calcMonthsSelect').value = 12;
    };

    // ===== 成本计算 =====
    const calculateCost = (clienteling, full, months) => {
        const cPrice = parseFloat(configPrices.ClientelingUnitPrice) || 16;
        const fPrice = parseFloat(configPrices.FullUnitPrice) || 52;
        const fixed = parseFloat(configPrices.FixedCost) || 0;
        return (clienteling * cPrice + full * fPrice) * months + fixed;
    };

    // ===== Email Management（优化：简化状态切换）=====
    const setEmailUIState = (hasEmail, email = '') => {
        $('registeredEmailValue').textContent = email;
        $('emailDisplay').classList.toggle('hidden', !hasEmail);
        $('emailForm').classList.toggle('hidden', hasEmail);
        $('editEmailButton').classList.toggle('hidden', !hasEmail);
        $('cancelEditEmailButton').classList.add('hidden');
        $('submitEmailButton').textContent = 'Register Email';
        $('userEmailInput').value = email;
    };

    const initEmailManagement = async () => {
        if (!currentUser || currentUser.role !== 'maison') {
            $('emailManagementSection').classList.add('hidden');
            return;
        }
        $('emailManagementSection').classList.remove('hidden');
        clearMessage($('emailMessage'));

        const result = await callAppsScript('getUserEmail', { username: currentUser.username });
        setEmailUIState(result.success && result.email, result.email || '');
    };

    // ===== Email Broadcast（优化：简化逻辑）=====
    const getFilteredUsers = () => {
        if (!searchTerm) return allUsers;
        const term = searchTerm.toLowerCase();
        return allUsers.filter(u =>
            (u.username || '').toLowerCase().includes(term) ||
            (u.email || '').toLowerCase().includes(term) ||
            (u.maisonName || '').toLowerCase().includes(term)
        );
    };

    const getSelectedEmails = () => {
        return Array.from($('userListContainer').querySelectorAll('.user-checkbox:checked'))
            .map(cb => cb.dataset.email)
            .filter(email => email && isValidEmail(email));
    };

    const renderUserList = () => {
        const filtered = getFilteredUsers();
        if (filtered.length === 0) {
            $('userListContainer').innerHTML = '<p class="no-users-text">No users found.</p>';
            return;
        }

        $('userListContainer').innerHTML = filtered.map((user, i) => {
            const id = `user-${i}-${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            return `
                <div class="user-checkbox-item">
                    <input type="checkbox" id="${id}" class="user-checkbox" 
                           data-email="${user.email || ''}" ${user.email ? '' : 'disabled'}>
                    <label for="${id}" class="user-checkbox-label">
                        <span class="user-name">${user.username || 'N/A'}</span>
                        <span class="user-email">${user.email || 'No email'}</span>
                        ${user.maisonName ? `<span class="user-maison">${user.maisonName}</span>` : ''}
                    </label>
                </div>
            `;
        }).join('');
    };

    const updateRecipientCount = () => {
        const emails = getSelectedEmails();
        const count = emails.length;
        $('recipientCountDisplay').textContent = count > 0
            ? `Selected: ${count} recipient(s)`
            : 'No recipients selected. Please select at least one user.';
        $('recipientCountDisplay').style.color = count > 0 ? '#00796b' : '#999';
        $('recipientCountDisplay').classList.remove('hidden');
    };

    // 优化：使用事件委托处理用户列表的复选框
    $('userListContainer').addEventListener('change', e => {
        if (e.target.classList.contains('user-checkbox')) {
            updateRecipientCount();
        }
    });

    const initEmailBroadcast = async () => {
        if (!currentUser || currentUser.role !== 'admin') {
            $('emailBroadcastSection').classList.add('hidden');
            return;
        }
        $('emailBroadcastSection').classList.remove('hidden');

        // 加载用户
        $('userListContainer').innerHTML = '<p class="loading-text">Loading users...</p>';
        const result = await callAppsScript('getAllUsers');
        if (result.success && result.data) {
            allUsers = result.data.filter(u => u.email && u.email.trim());
            renderUserList();
            updateRecipientCount();
        } else {
            $('userListContainer').innerHTML = `<p class="error-text">Failed to load users: ${result.message || 'Unknown error'}</p>`;
        }
    };

    // ===== 事件监听器 =====
    $('loginButton').addEventListener('click', async () => {
        const username = $('username').value.trim();
        const password = $('password').value.trim();

        if (!username || !password) {
            showMessage($('loginMessage'), 'Please enter username and password!', false);
            return;
        }

        const result = await callAppsScript('login', { username, password });
        if (!result.success) {
            showMessage($('loginMessage'), 'Login failed: ' + result.message, false);
            return;
        }

        showMessage($('loginMessage'), 'Login successful!', true);
        currentUser = { username, role: result.role, maisonName: result.maisonName };

        // 获取配置
        const configResult = await callAppsScript('getConfig');
        if (configResult.success && configResult.data) {
            Object.assign(configPrices, {
                ClientelingUnitPrice: parseFloat(configResult.data.ClientelingUnitPrice) || 16,
                FullUnitPrice: parseFloat(configResult.data.FullUnitPrice) || 52,
                FixedCost: parseFloat(configResult.data.FixedCost) || 0
            });
        }

        setTimeout(() => {
            showPage($('mainPage'));
            $('welcomeMessage').textContent = `Welcome, ${currentUser.maisonName} (${currentUser.role})!`;
            
            if (currentUser.role === 'maison') {
                $('maisonView').classList.remove('hidden');
                $('adminView').classList.add('hidden');
                populateQuarterSelect();
                populateCalcMonthsSelect();
                $('clientelingLicenseCount').value = $('fullLicenseCount').value = '0';
                $('calculatedCostDisplay').textContent = 'Estimated Cost: 0.00 €';
                loadAndRenderTable('maison', $('maisonHistoryTableContainer'), { maisonName: currentUser.maisonName });
                initEmailManagement();
            } else {
                $('adminView').classList.remove('hidden');
                $('maisonView').classList.add('hidden');
                loadAndRenderTable('admin', $('adminDataTableContainer'));
                initEmailBroadcast();
            }
        }, 500);
    });

    $('logoutButton').addEventListener('click', () => {
        currentUser = null;
        $('username').value = $('password').value = '';
        clearMessage($('loginMessage'));
        clearMessage($('maisonSubmitMessage'));
        clearMessage($('emailMessage'));
        showPage($('loginPage'));
    });

    $('submitSfscDataButton').addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'maison') {
            showMessage($('maisonSubmitMessage'), 'Please log in as a Maison user!', false);
            return;
        }

        const quarter = $('quarterSelect').value;
        const clienteling = parseInt($('clientelingLicenseCount').value, 10);
        const full = parseInt($('fullLicenseCount').value, 10);

        if (!quarter || clienteling < 0 || full < 0 || isNaN(clienteling) || isNaN(full)) {
            showMessage($('maisonSubmitMessage'), 'Please enter valid inputs!', false);
            return;
        }

        // 检查是否存在
        const checkResult = await callAppsScript('checkExistingRecord', {
            maisonName: currentUser.maisonName,
            quarter
        });

        let recordIdToUpdate = null;
        if (checkResult.success && checkResult.exists) {
            if (!confirm(`Update existing data for ${quarter}?`)) {
                showMessage($('maisonSubmitMessage'), 'Submission cancelled.', false);
                return;
            }
            recordIdToUpdate = checkResult.recordId;
        }

        const result = await callAppsScript('submitSfscData', {
            maisonName: currentUser.maisonName,
            quarter,
            clientelingLicenseCount: clienteling,
            fullLicenseCount: full,
            submittedBy: currentUser.username,
            recordIdToUpdate
        });

        if (result.success) {
            showMessage($('maisonSubmitMessage'), `${recordIdToUpdate ? 'Updated' : 'Submitted'} successfully! Cost: ${result.calculatedCost} €`, true);
            $('clientelingLicenseCount').value = $('fullLicenseCount').value = '0';
            loadAndRenderTable('maison', $('maisonHistoryTableContainer'), { maisonName: currentUser.maisonName });
        } else {
            showMessage($('maisonSubmitMessage'), 'Submission failed: ' + result.message, false);
        }
    });

    $('seeCostButton').addEventListener('click', () => {
        clearMessage($('calculatorErrorMessage'));
        const clienteling = parseInt($('calcClientelingLicenseCount').value, 10) || 0;
        const full = parseInt($('calcFullLicenseCount').value, 10) || 0;
        const months = parseInt($('calcMonthsSelect').value, 10) || 12;

        if (clienteling < 0 || full < 0 || months < 1 || months > 12) {
            showMessage($('calculatorErrorMessage'), 'Invalid inputs!', false);
            $('calculatedCostDisplay').textContent = 'Estimated Cost: NaN €';
            return;
        }

        const cost = calculateCost(clienteling, full, months);
        $('calculatedCostDisplay').textContent = `Estimated Cost: ${cost.toFixed(2)} €`;
        $('calculatedCostDisplay').classList.remove('error');
        $('calculatedCostDisplay').classList.add('success');
    });

    $('exportDataButton').addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'admin') {
            alert('Admin only!');
            return;
        }

        const result = await callAppsScript('getAllSfscData');
        if (!result.success || !result.data || result.data.length === 0) {
            showMessage($('loginMessage'), 'Export failed: No data available.', false);
            return;
        }

        const headers = TABLE_CONFIGS.admin.headers;
        let csv = headers.map(h => h.label).join(',') + '\n';
        
        result.data.forEach(row => {
            const values = headers.map(h => {
                let value = row[h.key];
                if (h.key === 'Timestamp') value = formatTimestamp(value);
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
            });
            csv += values.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `SFSC_Data_Export_${new Date().toLocaleDateString('en-US')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showMessage($('loginMessage'), 'Export successful!', true);
    });

    $('submitEmailButton').addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'maison') {
            showMessage($('emailMessage'), 'Maison user only.', false);
            return;
        }

        const email = $('userEmailInput').value.trim();
        if (!email) {
            showMessage($('emailMessage'), 'Email cannot be empty.', false);
            return;
        }
        if (!isValidEmail(email)) {
            showMessage($('emailMessage'), 'Invalid email format.', false);
            return;
        }

        showMessage($('emailMessage'), 'Saving...', true);
        const result = await callAppsScript('updateUserEmail', { username: currentUser.username, email });
        
        if (result.success) {
            showMessage($('emailMessage'), 'Email saved successfully!', true);
            initEmailManagement();
        } else {
            showMessage($('emailMessage'), 'Failed: ' + result.message, false);
        }
    });

    $('editEmailButton').addEventListener('click', () => {
        $('emailDisplay').classList.add('hidden');
        $('editEmailButton').classList.add('hidden');
        $('emailForm').classList.remove('hidden');
        $('userEmailInput').value = $('registeredEmailValue').textContent;
        $('submitEmailButton').textContent = 'Save Changes';
        $('cancelEditEmailButton').classList.remove('hidden');
        clearMessage($('emailMessage'));
    });

    $('cancelEditEmailButton').addEventListener('click', () => {
        initEmailManagement();
        clearMessage($('emailMessage'));
    });

    $('selectAllButton').addEventListener('click', () => {
        $('userListContainer').querySelectorAll('.user-checkbox:not(:disabled)').forEach(cb => cb.checked = true);
        updateRecipientCount();
    });

    $('deselectAllButton').addEventListener('click', () => {
        $('userListContainer').querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
        updateRecipientCount();
    });

    $('userSearchInput').addEventListener('input', () => {
        searchTerm = $('userSearchInput').value.trim();
        renderUserList();
        updateRecipientCount();
    });

    $('openOutlookButton').addEventListener('click', () => {
        const emails = getSelectedEmails();
        if (!emails.length) {
            showMessage($('emailBroadcastMessage'), 'No recipients selected.', false);
            return;
        }

        const subject = encodeURIComponent($('emailSubjectInput').value.trim());
        const body = encodeURIComponent($('emailContentInput').value.trim());
        const params = [subject && `subject=${subject}`, body && `body=${body}`].filter(Boolean);
        
        window.location.href = `mailto:${emails.join(',')}${params.length ? '?' + params.join('&') : ''}`;
        showMessage($('emailBroadcastMessage'), `Opening Outlook with ${emails.length} recipient(s)...`, true);
    });

    $('copyEmailsButton').addEventListener('click', () => {
        const emails = getSelectedEmails();
        if (!emails.length) {
            showMessage($('emailBroadcastMessage'), 'No recipients to copy.', false);
            return;
        }

        const emailList = emails.join('; ');
        navigator.clipboard.writeText(emailList)
            .then(() => showMessage($('emailBroadcastMessage'), `Copied ${emails.length} email(s)!`, true))
            .catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = emailList;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    showMessage($('emailBroadcastMessage'), `Copied ${emails.length} email(s)!`, true);
                } catch {
                    showMessage($('emailBroadcastMessage'), 'Copy failed.', false);
                }
                document.body.removeChild(textarea);
            });
    });

    // 初始化
    showPage($('loginPage'));
});
