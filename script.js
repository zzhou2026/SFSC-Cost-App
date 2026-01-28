document.addEventListener('DOMContentLoaded', () => {
    // --- 【非常重要！】请在这里替换成你的 Apps Script Web App URL ---
    const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIVoYBQtqkFB52frxB8e81899ISf_pDwJ_Fj3f9blb7mI2c3QhT4pHoz3sQuG1l6EDVQ/exec'; 
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    // Reminder: Replace the URL above with your own!

    // --- DOM Elements ---
    const loginPage = document.getElementById('loginPage');
    const mainPage = document.getElementById('mainPage');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const loginMessage = document.getElementById('loginMessage');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const logoutButton = document.getElementById('logoutButton');

    const maisonView = document.getElementById('maisonView');
    const quarterSelect = document.getElementById('quarterSelect');
    const clientelingLicenseCountInput = document.getElementById('clientelingLicenseCount');
    const fullLicenseCountInput = document.getElementById('fullLicenseCount');
    const submitSfscDataButton = document.getElementById('submitSfscDataButton');
    const maisonSubmitMessage = document.getElementById('maisonSubmitMessage');
    const maisonHistoryTableContainer = document.getElementById('maisonHistoryTableContainer');

    const adminView = document.getElementById('adminView');
    const adminDataTableContainer = document.getElementById('adminDataTableContainer');
    const exportDataButton = document.getElementById('exportDataButton');

    // Email Broadcast Elements (Admin)
    const emailBroadcastSection = document.getElementById('emailBroadcastSection');
    const userListContainer = document.getElementById('userListContainer');
    const selectAllButton = document.getElementById('selectAllButton');
    const deselectAllButton = document.getElementById('deselectAllButton');
    const userSearchInput = document.getElementById('userSearchInput');
    const emailSubjectInput = document.getElementById('emailSubjectInput');
    const emailContentInput = document.getElementById('emailContentInput');
    const openOutlookButton = document.getElementById('openOutlookButton');
    const copyEmailsButton = document.getElementById('copyEmailsButton');
    const emailBroadcastMessage = document.getElementById('emailBroadcastMessage');
    const recipientCountDisplay = document.getElementById('recipientCountDisplay');
    
    let allUsers = []; // Store all users data
    let filteredUsers = []; // Store filtered users for display
    let currentRecipientEmails = []; // Store current recipient emails

    // NEW: Email Management Elements
    const emailManagementSection = document.getElementById('emailManagementSection');
    const emailDisplay = document.getElementById('emailDisplay');
    const registeredEmailValueSpan = document.getElementById('registeredEmailValue');
    const emailForm = document.getElementById('emailForm');
    const userEmailInput = document.getElementById('userEmailInput');
    const submitEmailButton = document.getElementById('submitEmailButton');
    const editEmailButton = document.getElementById('editEmailButton');
    const cancelEditEmailButton = document.getElementById('cancelEditEmailButton');
    const emailMessage = document.getElementById('emailMessage');


    // --- Cost Calculator Tool Elements ---
    const calcClientelingLicenseCountInput = document.getElementById('calcClientelingLicenseCount');
    const calcFullLicenseCountInput = document.getElementById('calcFullLicenseCount');
    const calcMonthsSelect = document.getElementById('calcMonthsSelect');
    const seeCostButton = document.getElementById('seeCostButton');
    const calculatedCostDisplay = document.getElementById('calculatedCostDisplay');
    const calculatorErrorMessage = document.getElementById('calculatorErrorMessage');


    let currentUser = null; 
    let configPrices = { ClientelingUnitPrice: 16, FullUnitPrice: 52, FixedCost: 0 }; 

    // --- Helper Functions ---
    function showPage(pageElement) {
        document.querySelectorAll('.page').forEach(p => {
            p.classList.add('hidden');
            p.classList.remove('active');
        });
        pageElement.classList.remove('hidden');
        pageElement.classList.add('active');
    }

    function showMessage(element, msg, isSuccess = false) {
        element.textContent = msg;
        element.className = 'message'; 
        if (isSuccess) {
            element.classList.add('success');
        } else {
            element.classList.add('error'); 
        }
    }

    function clearMessage(element) {
        element.textContent = '';
        element.className = 'message';
    }

    // NEW: Email Validation Helper
    function isValidEmail(email) {
        // Simple regex for email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // 将数据渲染成 HTML 表格 (包含删除按钮或审批按钮)
    function renderTable(containerElement, data, headersToShowMapping, options = {}) {
        if (!data || data.length === 0) {
            containerElement.innerHTML = '<p>No data available at the moment.</p>';
            return;
        }

        let tableHTML = '<table><thead><tr>';
        
        headersToShowMapping.forEach(header => {
            tableHTML += `<th>${header.label}</th>`;
        });
        if (options.includeMaisonDeleteButton) {
            tableHTML += '<th>Action</th>'; // Maison 的删除操作列
        }
        if (options.includeAdminApprovalButtons) {
            tableHTML += '<th>Approval Action</th>'; // Admin 的审批操作列
        }
        tableHTML += '</tr></thead><tbody>';

        data.forEach(row => {
            tableHTML += '<tr>';
            headersToShowMapping.forEach(header => {
                let cellValue = row[header.key]; 
                if (header.key === 'Timestamp' && cellValue) {
                    try {
                        const date = new Date(cellValue);
                        if (!isNaN(date)) {
                            cellValue = date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                        }
                    } catch (e) {
                        // Keep original value
                    }
                } else if (header.key === 'ApprovalStatus' && cellValue) {
                    // 为 ApprovalStatus 添加状态徽章
                    let statusClass = '';
                    switch (cellValue) {
                        case 'Pending': statusClass = 'status-pending'; break;
                        case 'Approved': statusClass = 'status-approved'; break;
                        case 'Rejected': statusClass = 'status-rejected'; break;
                        default: statusClass = 'status-pending'; break;
                    }
                    cellValue = `<span class="status-badge ${statusClass}">${cellValue}</span>`;
                }
                tableHTML += `<td>${cellValue !== undefined ? cellValue : ''}</td>`;
            });
            if (options.includeMaisonDeleteButton) {
                // 每个删除按钮绑定 recordId
                tableHTML += `<td><button class="delete-button-table" data-record-id="${row.RecordId}">Delete</button></td>`;
            }
            if (options.includeAdminApprovalButtons) {
                // Admin 的审  按钮
                tableHTML += `<td>
                                <button class="approve-button-table" data-record-id="${row.RecordId}">Approve</button>
                                <button class="reject-button-table" data-record-id="${row.RecordId}">Reject</button>
                              </td>`;
            }
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';
        containerElement.innerHTML = tableHTML;

        // 为删除按钮添加事件监听器
        if (options.includeMaisonDeleteButton) {
            containerElement.querySelectorAll('.delete-button-table').forEach(button => {
                button.addEventListener('click', handleDeleteRecord);
            });
        }
        // 为审批按钮添加事件监听器
        if (options.includeAdminApprovalButtons) {
            containerElement.querySelectorAll('.approve-button-table').forEach(button => {
                button.addEventListener('click', (event) => handleApprovalAction(event, 'Approved'));
            });
            containerElement.querySelectorAll('.reject-button-table').forEach(button => {
                button.addEventListener('click', (event) => handleApprovalAction(event, 'Rejected'));
            });
        }
    }

    // --- 删除记录的事件处理函数 ---
    async function handleDeleteRecord(event) {
        const recordIdToDelete = event.target.dataset.recordId;
        if (!recordIdToDelete) {
            alert('Error: Record ID not found for deletion.');
            return;
        }

        if (confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
            const result = await callAppsScript('deleteSfscData', { recordId: recordIdToDelete });
            if (result.success) {
                showMessage(maisonSubmitMessage, 'Record deleted successfully!', true);
                if (currentUser.role === 'maison') {
                    loadMaisonHistoryData(); // 刷新数据
                } else if (currentUser.role === 'admin') {
                    // Admin 视图不显示删除按钮，但如果 Admin 也删除了，也要刷新
                    loadAdminOverviewData(); 
                }
            } else {
                showMessage(maisonSubmitMessage, 'Failed to delete record: ' + result.message, false);
            }
        }
    }

    // --- Admin 审批操作的事件处理函数 ---
    async function handleApprovalAction(event, newStatus) {
        const recordIdToUpdate = event.target.dataset.recordId;
        if (!recordIdToUpdate) {
            alert('Error: Record ID not found for approval action.');
            return;
        }

        if (confirm(`Are you sure you want to set this record's status to "${newStatus}"?`)) {
            const result = await callAppsScript('updateApprovalStatus', { recordId: recordIdToUpdate, newStatus: newStatus });
            if (result.success) {
                showMessage(loginMessage, `Record ${recordIdToUpdate} status updated to ${newStatus}.`, true);
                loadAdminOverviewData(); // 刷新 Admin 概览数据
                // 也要刷新Maison的历史数据，以便Maison用户看到状态变化
                // 仅当当前用户是 Maison 角色时才刷新，Admin 审批后 Maison 刷新自己的视图
                if (currentUser.role === 'maison') {
                    loadMaisonHistoryData(); 
                }
            } else {
                showMessage(loginMessage, `Failed to update record status: ${result.message}`, false);
            }
        }
    }


    // --- 填充季度选择器 ---
    async function populateQuarterSelect() {
        const numberOfFutureQuarters = 4; // Current quarter + 4 future quarters = 5 total options
        const result = await callAppsScript('getQuarterList', { numberOfFutureQuarters: numberOfFutureQuarters });
        if (result.success && result.data) {
            quarterSelect.innerHTML = ''; // Clear existing options
            result.data.forEach(quarter => {
                const option = document.createElement('option');
                option.value = quarter;
                option.textContent = quarter;
                quarterSelect.appendChild(option);
            });
        } else {
            console.error('Failed to load quarter list:', result.message);
            maisonSubmitMessage.textContent = 'Failed to load quarter options. Please refresh.';
            maisonSubmitMessage.classList.add('error');
        }
    }

    // --- 填充月份选择器 (用于计算工具) ---
    function populateCalcMonthsSelect() {
        calcMonthsSelect.innerHTML = '';
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            calcMonthsSelect.appendChild(option);
        }
        calcMonthsSelect.value = 12; // 默认选择 12 个月
    }

    // --- 成本计算函数 (用于计算工具) ---
    function calculateCostForTool(clientelingCount, fullCount, months) {
        // 注意：这里使用 configPrices 中的值，这些值在登录时从后端获取
        const cUnitPrice = parseFloat(configPrices.ClientelingUnitPrice) || 16; 
        const fUnitPrice = parseFloat(configPrices.FullUnitPrice) || 52;   
        const fixed = parseFloat(configPrices.FixedCost) || 0;             

        return (
            (clientelingCount * cUnitPrice * months) +
            (fullCount * fUnitPrice * months) +
            fixed
        );
    }

    // --- Core function to call Apps Script backend ---
    async function callAppsScript(action, payload = {}) {
        try {
                   // --- BEGIN MODIFICATION 1/2: callAppsScript 内部第一个 if 条件 ---
        // 显示加载提示，但只针对需要用户感知的操作
        // getConfig, checkExistingRecord, getUserEmail 和 getAllUsers 是后台请求，不显示 loading
        if (action !== 'getQuarterList' && action !== 'getConfig' && action !== 'checkExistingRecord' && action !== 'getUserEmail' && action !== 'getAllUsers') { 
             loginMessage.textContent = 'Requesting...'; 
             loginMessage.classList.add('loading'); 
        }
        // --- END MODIFICATION 1/2 ---

            
            // 确保payload中的数值是实际的数字，而不是可能为空的字符串
            if (action === 'submitSfscData') {
                payload.clientelingLicenseCount = parseInt(payload.clientelingLicenseCount, 10) || 0;
                payload.fullLicenseCount = parseInt(payload.fullLicenseCount, 10) || 0;
            }

            const response = await fetch(APP_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors', 
                headers: {
                    'Content-Type': 'text/plain', 
                },
                body: JSON.stringify({ action, ...payload }), 
            });

            const text = await response.text();
                   const result = JSON.parse(text);
        
        // --- BEGIN MODIFICATION 2/2: callAppsScript 内部第二个 if 条件 ---
        if (action !== 'getQuarterList' && action !== 'getConfig' && action !== 'checkExistingRecord' && action !== 'getUserEmail' && action !== 'getAllUsers') {
            loginMessage.classList.remove('loading'); 
        }
        // --- END MODIFICATION 2/2 ---
        return result;


        } catch (error) {
            console.error('Error calling Apps Script:', error);
            // 更详细的网络错误提示
            return { success: false, message: 'Network error or backend API call failed: ' + error.message };
        }
    }

    // --- Event Listeners ---

    // Login button click event
    loginButton.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            showMessage(loginMessage, 'Please enter username and password!');
            return;
        }
        clearMessage(loginMessage);

        const result = await callAppsScript('login', { username, password });

        if (result.success) {
            showMessage(loginMessage, 'Login successful!', true);
            currentUser = { username: username, role: result.role, maisonName: result.maisonName };
            // 登录成功后，获取配置信息，并保存到 configPrices 变量
            const configResult = await callAppsScript('getConfig');
            if (configResult.success && configResult.data) {
                // 解析从后端获取的配置值，并确保它们是数字
                configPrices.ClientelingUnitPrice = parseFloat(configResult.data.ClientelingUnitPrice) || 16;
                configPrices.FullUnitPrice = parseFloat(configResult.data.FullUnitPrice) || 52;
                configPrices.FixedCost = parseFloat(configResult.data.FixedCost) || 0;
            } else {
                console.error('Failed to load config prices:', configResult.message);
                showMessage(loginMessage, 'Failed to load configuration prices. Using default prices.', false);
                // 即使加载失败，也要使用默认值
                configPrices = { ClientelingUnitPrice: 16, FullUnitPrice: 52, FixedCost: 0 };
            }

            setTimeout(() => {
                showMainPage();
            }, 500); 
        } else {
            showMessage(loginMessage, 'Login failed: ' + result.message);
        }
    });

    // Logout button click event
    logoutButton.addEventListener('click', () => {
        currentUser = null;
        usernameInput.value = '';
        passwordInput.value = '';
        clearMessage(loginMessage);
        clearMessage(maisonSubmitMessage);
        // NEW: Clear email messages on logout
        clearMessage(emailMessage); 
        showPage(loginPage);
    });

    // Submit SFSC Data button click event (Maison View)
    submitSfscDataButton.addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'maison') {
            showMessage(maisonSubmitMessage, 'Please log in as a Maison user!', false); // Changed to false for consistent styling
            return;
        }

        const quarter = quarterSelect.value; 
        const clientelingLicenseCount = parseInt(clientelingLicenseCountInput.value, 10);
        const fullLicenseCount = parseInt(fullLicenseCountInput.value, 10);

        if (!quarter || isNaN(clientelingLicenseCount) || clientelingLicenseCount < 0 || 
            isNaN(fullLicenseCount) || fullLicenseCount < 0) {
            showMessage(maisonSubmitMessage, 'Please enter a valid quarter and valid license counts (non-negative)!', false);
            return;
        }
        clearMessage(maisonSubmitMessage);

        let recordIdToUpdate = null; // 初始化为 null
        // 检查是否存在现有记录
        const checkResult = await callAppsScript('checkExistingRecord', { 
            maisonName: currentUser.maisonName, 
            quarter: quarter 
        });

        if (checkResult.success && checkResult.exists) {
            // 如果存在，弹窗询问是否更新
            if (!confirm(`You have already submitted data for ${quarter}. Do you want to UPDATE the existing record?`)) {
                showMessage(maisonSubmitMessage, 'Submission cancelled.', false);
                return; // 用户取消，中断提交
            }
            recordIdToUpdate = checkResult.recordId; // 获取到旧记录的 RecordId
        }

        const result = await callAppsScript('submitSfscData', {
            maisonName: currentUser.maisonName,
            quarter: quarter,
            clientelingLicenseCount: clientelingLicenseCount, 
            fullLicenseCount: fullLicenseCount,               
            submittedBy: currentUser.username,
            recordIdToUpdate: recordIdToUpdate // 将 RecordIdToUpdate 传递给后端
        });

        if (result.success) {
            showMessage(maisonSubmitMessage, `${recordIdToUpdate ? 'Data updated' : 'Data submitted'} successfully! Calculated Cost: ${result.calculatedCost} €`, true);
            clientelingLicenseCountInput.value = '0'; // Clear input fields
            fullLicenseCountInput.value = '0';       // Clear input fields
            if (currentUser.role === 'maison') {
                loadMaisonHistoryData(); // 刷新数据
            }
        } else {
            showMessage(maaisonSubmitMessage, 'Data submission failed: ' + result.message, false);
        }
    });
    
    // --- 成本计算工具的事件监听 ---
    seeCostButton.addEventListener('click', () => {
        clearMessage(calculatorErrorMessage); // 清除之前的错误信息
        const clientelingCount = parseInt(calcClientelingLicenseCountInput.value, 10) || 0;
        const fullCount = parseInt(calcFullLicenseCountInput.value, 10) || 0;
        const months = parseInt(calcMonthsSelect.value, 10) || 12;

        if (clientelingCount < 0 || fullCount < 0 || months < 1 || months > 12 || isNaN(clientelingCount) || isNaN(fullCount) || isNaN(months)) {
            showMessage(calculatorErrorMessage, 'Please enter valid positive license counts and months (1-12)!', false); // Added false
            calculatedCostDisplay.textContent = 'Estimated Cost: NaN €'; // 显示错误时将成本显示为 NaN
            return;
        }

        const estimatedCost = calculateCostForTool(clientelingCount, fullCount, months);
        calculatedCostDisplay.textContent = `Estimated Cost: ${estimatedCost.toFixed(2)} €`;
        calculatedCostDisplay.classList.remove('error'); // 确保不是错误样式
        calculatedCostDisplay.classList.add('success'); // 显示为成功样式
    });

    // Export Data button click event (Admin View)
    exportDataButton.addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'admin') {
            alert('Only administrators can export data!');
            return;
        }
        
        const result = await callAppsScript('getAllSfscData');

        if (result.success && result.data && result.data.length > 0) {
            // CSV 导出时，不包含 RecordId，因为 RecordId 是内部标识
            const headersToExport = [
                { key: 'MaisonName', label: 'Maison Name' },
                { key: 'Quarter', label: 'Quarter' },
                { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' },
                { key: 'FullLicenseCount', label: 'Full Licenses' },
                { key: 'CalculatedCost', label: 'Calculated Cost (€)' },
                { key: 'SubmittedBy', label: 'Submitted By' },
                { key: 'Timestamp', label: 'Submission Time' },
                { key: 'ApprovalStatus', label: 'Approval Status' } // 新增：导出时包含审批状态
            ];
            
            let csv = headersToExport.map(h => h.label).join(',') + '\n'; // CSV 表头
            result.data.forEach(row => {
                const values = headersToExport.map(header => {
                    let value = row[header.key];
                    // 处理可能的特殊字符和日期格式
                    if (header.key === 'Timestamp' && value) {
                        try {
                            const date = new Date(value);
                            if (!isNaN(date)) {
                                value = date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                            }
                        } catch (e) { /* keep original value */ }
                    }
                    if (typeof value === 'string') {
                        value = `"${value.replace(/"/g, '""')}"`; // 转义双引号
                    }
                    return value;
                });
                csv += values.join(',') + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `SFSC_Data_Export_${new Date().toLocaleDateString('en-US')}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showMessage(loginMessage, 'Data exported successfully as CSV!', true);
        } else {
            showMessage(loginMessage, 'Export failed: No data or an error occurred.', false);
        }
    });


    // --- Page Display Logic ---

    function showMainPage() {
        showPage(mainPage);
        welcomeMessage.textContent = `Welcome, ${currentUser.maisonName} (${currentUser.role})!`;
        
        maisonView.classList.add('hidden');
        adminView.classList.add('hidden');

        // Maison user login, populate quarter selector
        if (currentUser.role === 'maison') {
            maisonView.classList.remove('hidden');
            populateQuarterSelect(); // Call function to populate quarter selector
            populateCalcMonthsSelect(); // 填充成本计算工具的月份选择器
            // 初始化成本计算工具的输入框，与提交框同步
            calcClientelingLicenseCountInput.value = clientelingLicenseCountInput.value;
            calcFullLicenseCountInput.value = fullLicenseCountInput.value;
            calculatedCostDisplay.textContent = 'Estimated Cost: 0.00 €'; // 重置显示
            loadMaisonHistoryData(); 
            initEmailManagement(); // NEW: Initialize email management section
        } else if (currentUser.role === 'admin') {
            adminView.classList.remove('hidden');
            loadAdminOverviewData();
            initEmailBroadcast(); // Initialize email broadcast functionality
        }
    }

    // Load Maison historical data
    async function loadMaisonHistoryData() {
        if (currentUser && currentUser.role === 'maison') {
            const result = await callAppsScript('getMaisonSfscData', { maisonName: currentUser.maisonName });
            if (result.success && result.data) {
                // Define English table headers and corresponding internal keys
                const headersEn = [
                    { key: 'MaisonName', label: 'Maison Name' },
                    { key: 'Quarter', label: 'Quarter' },
                    { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' }, 
                    { key: 'FullLicenseCount', label: 'Full Licenses' },             
                    { key: 'CalculatedCost', label: 'Calculated Cost' },
                    { key: 'Timestamp', label: 'Submission Time' },
                    { key: 'ApprovalStatus', label: 'Approval Status' } // 新增：显示审批状态
                ];
                // Maison 用户可以删除自己的记录
                renderTable(maisonHistoryTableContainer, result.data, headersEn, { includeMaisonDeleteButton: true }); 
            } else {
                maisonHistoryTableContainer.innerHTML = '<p>Failed to load historical data: ' + result.message + '</p>';
            }
        }
    }

    // Load Admin overview data
    async function loadAdminOverviewData() {
        if (currentUser && currentUser.role === 'admin') {
            const result = await callAppsScript('getAllSfscData');
            if (result.success && result.data) {
                // Define English table headers and corresponding internal keys
                const headersEn = [
                    { key: 'MaisonName', label: 'Maison Name' },
                    { key: 'Quarter', label: 'Quarter' },
                    { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' }, 
                    { key: 'FullLicenseCount', label: 'Full Licenses' },             
                    { key: 'CalculatedCost', label: 'Calculated Cost' },
                    { key: 'SubmittedBy', label: 'Submitted By' },
                    { key: 'Timestamp', label: 'Submission Time' },
                    { key: 'ApprovalStatus', label: 'Approval Status' } // 新增：显示审批状态
                ];
                // Admin 审批界面，包含审批按钮
                renderTable(adminDataTableContainer, result.data, headersEn, { includeAdminApprovalButtons: true }); 
            } else {
                adminDataTableContainer.innerHTML = '<p>Failed to load all data: ' + result.message + '</p>';
            }
        }
    }

    // --- NEW: Email Management Logic ---

    // Function to update the email management UI based on current user's email
    async function initEmailManagement() {
        if (!currentUser || currentUser.role !== 'maison') {
            emailManagementSection.classList.add('hidden'); // Hide if not maison user
            return;
        }
        emailManagementSection.classList.remove('hidden'); // Show for maison user
        clearMessage(emailMessage);

        const result = await callAppsScript('getUserEmail', { username: currentUser.username });
        if (result.success && result.email) {
            registeredEmailValueSpan.textContent = result.email;
            emailDisplay.classList.remove('hidden'); // Show registered email
            emailForm.classList.add('hidden'); // Hide form
            editEmailButton.classList.remove('hidden'); // Show edit button
            submitEmailButton.textContent = 'Register Email'; // Reset button text
            cancelEditEmailButton.classList.add('hidden'); // Hide cancel button
            userEmailInput.value = result.email; // Pre-fill input
        } else {
            // No email registered or error fetching
            registeredEmailValueSpan.textContent = '';
            emailDisplay.classList.add('hidden'); // Hide registered email display
            emailForm.classList.remove('hidden'); // Show form
            editEmailButton.classList.add('hidden'); // Hide edit button
            submitEmailButton.textContent = 'Register Email'; // Ensure text is "Register"
            cancelEditEmailButton.classList.add('hidden'); // Hide cancel button
            userEmailInput.value = ''; // Clear input
        }
    }

    // Event listener for Submit/Register Email Button
    submitEmailButton.addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'maison') {
            showMessage(emailMessage, 'Please log in as a Maison user to manage email.', false);
            return;
        }

        const email = userEmailInput.value.trim();
        if (!email) {
            showMessage(emailMessage, 'Email address cannot be empty.', false);
            return;
        }
        if (!isValidEmail(email)) {
            showMessage(emailMessage, 'Please enter a valid email address.', false);
            return;
        }

        clearMessage(emailMessage);
        showMessage(emailMessage, 'Saving email...', true); // Temporary loading message

        const result = await callAppsScript('updateUserEmail', { username: currentUser.username, email: email });

        if (result.success) {
            showMessage(emailMessage, 'Email saved successfully!', true);
            // Refresh UI to show the registered email
            initEmailManagement(); 
        } else {
            showMessage(emailMessage, 'Failed to save email: ' + result.message, false);
        }
    });

    // Event listener for Edit Email Button
    editEmailButton.addEventListener('click', () => {
        emailDisplay.classList.add('hidden'); // Hide display
        editEmailButton.classList.add('hidden'); // Hide edit button

        emailForm.classList.remove('hidden'); // Show form
        userEmailInput.value = registeredEmailValueSpan.textContent; // Pre-fill with current email
        submitEmailButton.textContent = 'Save Changes'; // Change button text
        cancelEditEmailButton.classList.remove('hidden'); // Show cancel button
        clearMessage(emailMessage);
    });

    // Event listener for Cancel Edit Email Button
    cancelEditEmailButton.addEventListener('click', () => {
        // Revert to initial state (display registered email, hide form)
        initEmailManagement();
        clearMessage(emailMessage);
    });

    // --- Email Broadcast Functions (Admin) - User Selection ---

    // Initialize email broadcast section
    async function initEmailBroadcast() {
        if (!currentUser || currentUser.role !== 'admin') {
            emailBroadcastSection.classList.add('hidden');
            return;
        }
        emailBroadcastSection.classList.remove('hidden');
        
        // Load all users
        await loadAllUsers();
        
        // Set up event listeners
        selectAllButton.addEventListener('click', handleSelectAll);
        deselectAllButton.addEventListener('click', handleDeselectAll);
        userSearchInput.addEventListener('input', handleUserSearch);
        openOutlookButton.addEventListener('click', handleOpenOutlook);
        copyEmailsButton.addEventListener('click', handleCopyEmails);
        
        // Update recipient count when checkboxes change
        updateRecipientCount();
    }

    // Load all users from backend
    async function loadAllUsers() {
        userListContainer.innerHTML = '<p class="loading-text">Loading users...</p>';
        
        const result = await callAppsScript('getAllUsers');
        if (result.success && result.data) {
            allUsers = result.data.filter(user => user.email && user.email.trim() !== '');
            filteredUsers = [...allUsers];
            renderUserList();
            updateRecipientCount();
        } else {
            userListContainer.innerHTML = '<p class="error-text">Failed to load users: ' + (result.message || 'Unknown error') + '</p>';
        }
    }

    // Render user list with checkboxes
    function renderUserList() {
        if (filteredUsers.length === 0) {
            userListContainer.innerHTML = '<p class="no-users-text">No users found.</p>';
            return;
        }

        let html = '<div class="user-list">';
        filteredUsers.forEach((user, index) => {
            const userId = `user-${index}-${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            html += `
                <div class="user-checkbox-item">
                    <input type="checkbox" 
                           id="${userId}" 
                           class="user-checkbox" 
                           data-email="${user.email || ''}"
                           data-username="${user.username || ''}"
                           data-maison="${user.maisonName || ''}"
                           ${user.email ? '' : 'disabled'}>
                    <label for="${userId}" class="user-checkbox-label">
                        <span class="user-name">${user.username || 'N/A'}</span>
                        <span class="user-email">${user.email || 'No email'}</span>
                        ${user.maisonName ? `<span class="user-maison">${user.maisonName}</span>` : ''}
                    </label>
                </div>
            `;
        });
        html += '</div>';
        userListContainer.innerHTML = html;

        // ... (renderUserList 函数中生成 HTML 的代码，直到 userListContainer.innerHTML = html; 这一行) ...

    userListContainer.innerHTML = html; 

    // --- BEGIN MODIFICATION (renderUserList 内部的事件绑定，确认即可) ---
    // Add change listeners to all checkboxes (re-bind every time list is rendered)
    // 这段代码是确保用户列表（包括筛选后）中的复选框可以被点击的！
    userListContainer.querySelectorAll('.user-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateRecipientCount);
    });
    // --- END MODIFICATION ---
}


    // Handle select all
    function handleSelectAll() {
        userListContainer.querySelectorAll('.user-checkbox:not(:disabled)').forEach(checkbox => {
            checkbox.checked = true;
        });
        updateRecipientCount();
    }

    // Handle deselect all
    function handleDeselectAll() {
        userListContainer.querySelectorAll('.user-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        updateRecipientCount();
    }

    // Handle user search
    function handleUserSearch() {
        const searchTerm = userSearchInput.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            filteredUsers = [...allUsers];
        } else {
            filteredUsers = allUsers.filter(user => {
                const username = (user.username || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                const maison = (user.maisonName || '').toLowerCase();
                return username.includes(searchTerm) || 
                       email.includes(searchTerm) || 
                       maison.includes(searchTerm);
            });
        }
        
        renderUserList();
        updateRecipientCount();
    }

    // Update recipient emails based on selected users
    function updateRecipientEmails() {
        const selectedCheckboxes = userListContainer.querySelectorAll('.user-checkbox:checked');
        currentRecipientEmails = Array.from(selectedCheckboxes)
            .map(cb => cb.dataset.email)
            .filter(email => email && email.trim() !== '');
        updateRecipientCount();
    }

    // Update recipient count display
    function updateRecipientCount() {
        updateRecipientEmails();
        const count = currentRecipientEmails.length;
        if (count > 0) {
            recipientCountDisplay.textContent = `Selected: ${count} recipient(s)`;
            recipientCountDisplay.classList.remove('hidden');
            recipientCountDisplay.style.color = '#00796b';
        } else {
            recipientCountDisplay.textContent = 'No recipients selected. Please select at least one user.';
            recipientCountDisplay.classList.remove('hidden');
            recipientCountDisplay.style.color = '#999';
        }
    }

    // Handle open Outlook button click
    function handleOpenOutlook() {
        updateRecipientEmails();
        
        if (currentRecipientEmails.length === 0) {
            showMessage(emailBroadcastMessage, 'No recipients selected. Please select at least one user with email address.', false);
            return;
        }

        const subject = emailSubjectInput.value.trim();
        const body = emailContentInput.value.trim();

        // Create mailto link
        // Multiple recipients: use comma-separated list
        const to = currentRecipientEmails.join(',');
        
        // Encode subject and body for URL
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);

        // Create mailto URL
        let mailtoUrl = `mailto:${to}`;
        const params = [];
        if (subject) {
            params.push(`subject=${encodedSubject}`);
        }
        if (body) {
            params.push(`body=${encodedBody}`);
        }
        if (params.length > 0) {
            mailtoUrl += '?' + params.join('&');
        }

        // Open mailto link (will open default email client, e.g., Outlook)
        window.location.href = mailtoUrl;
        
        showMessage(emailBroadcastMessage, `Opening Outlook with ${currentRecipientEmails.length} recipient(s)... If it doesn't open, please check your default email client settings.`, true);
    }

    // Handle copy emails button click
    function handleCopyEmails() {
        updateRecipientEmails();
        
        if (currentRecipientEmails.length === 0) {
            showMessage(emailBroadcastMessage, 'No recipients to copy. Please select at least one user with email address.', false);
            return;
        }

        try {
            // Copy email list to clipboard
            const emailList = currentRecipientEmails.join('; '); // Use semicolon for Outlook
            navigator.clipboard.writeText(emailList).then(() => {
                showMessage(emailBroadcastMessage, `Copied ${currentRecipientEmails.length} email(s) to clipboard!`, true);
            }).catch(() => {
                // Fallback for older browsers
                fallbackCopyToClipboard(emailList);
            });
        } catch (err) {
            // Fallback for older browsers
            fallbackCopyToClipboard(currentRecipientEmails.join('; '));
        }
    }

    // Fallback copy to clipboard function
    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showMessage(emailBroadcastMessage, `Copied ${currentRecipientEmails.length} email(s) to clipboard!`, true);
        } catch (e) {
            showMessage(emailBroadcastMessage, 'Failed to copy emails. Please select and copy manually.', false);
        }
        document.body.removeChild(textArea);
    }

    // --- On first load, show the login page ---
    showPage(loginPage);
});