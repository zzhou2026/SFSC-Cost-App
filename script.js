document.addEventListener('DOMContentLoaded', () => {
    // --- 【Very Important!】Please replace this with your Apps Script Web App URL ---
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
    const quarterSelect = document.getElementById('quarterSelect'); // 季度选择器
    const clientelingLicenseCountInput = document.getElementById('clientelingLicenseCount'); // Clienteling 数量输入框
    const fullLicenseCountInput = document.getElementById('fullLicenseCount');           // Full 数量输入框
    // const monthsSelect = document.getElementById('monthsSelect'); // 移除了实时预览的月份选择器
    // const costPreview = document.getElementById('costPreview');   // 移除了实时预览的成本显示
    const submitSfscDataButton = document.getElementById('submitSfscDataButton');
    const maisonSubmitMessage = document.getElementById('maisonSubmitMessage');
    const maisonHistoryTableContainer = document.getElementById('maisonHistoryTableContainer');

    const adminView = document.getElementById('adminView');
    const adminDataTableContainer = document.getElementById('adminDataTableContainer');
    const exportDataButton = document.getElementById('exportDataButton');

    // --- Cost Calculator Tool Elements ---
    const calcClientelingLicenseCountInput = document.getElementById('calcClientelingLicenseCount');
    const calcFullLicenseCountInput = document.getElementById('calcFullLicenseCount');
    const calcMonthsSelect = document.getElementById('calcMonthsSelect');
    const seeCostButton = document.getElementById('seeCostButton');
    const calculatedCostDisplay = document.getElementById('calculatedCostDisplay');
    const calculatorErrorMessage = document.getElementById('calculatorErrorMessage');


    let currentUser = null; // Stores current logged-in user info
    // 从后端获取配置价格，并修正默认值
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

    // 将数据渲染成 HTML 表格
    function renderTable(containerElement, data, headersToShowMapping) {
        if (!data || data.length === 0) {
            containerElement.innerHTML = '<p>No data available at the moment.</p>';
            return;
        }

        let tableHTML = '<table><thead><tr>';
        
        // Generate table headers
        headersToShowMapping.forEach(header => {
            tableHTML += `<th>${header.label}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';

        // Generate table rows
        data.forEach(row => {
            tableHTML += '<tr>';
            headersToShowMapping.forEach(header => {
                let cellValue = row[header.key]; // Use internal key to access data
                // Date/time formatting
                if (header.key === 'Timestamp' && cellValue) {
                    try {
                        const date = new Date(cellValue);
                        if (!isNaN(date)) {
                            cellValue = date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                        }
                    } catch (e) {
                        // If parsing fails, keep original value
                    }
                }
                tableHTML += `<td>${cellValue !== undefined ? cellValue : ''}</td>`;
            });
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';
        containerElement.innerHTML = tableHTML;
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
            // Optionally display an error message to the user
        }
    }

    // --- 新增函数：填充月份选择器 (用于计算工具) ---
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
        return (
            (clientelingCount * configPrices.ClientelingUnitPrice * months) +
            (fullCount * configPrices.FullUnitPrice * months) +
            configPrices.FixedCost
        );
    }

    // --- Core function to call Apps Script backend ---
    async function callAppsScript(action, payload = {}) {
        try {
            // 显示加载提示，但只针对需要用户感知的操作
            if (action !== 'getQuarterList' && action !== 'getConfig') { 
                 loginMessage.textContent = 'Requesting...'; 
                 loginMessage.classList.add('loading'); 
            }
            
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
            
            if (action !== 'getQuarterList' && action !== 'getConfig') {
                loginMessage.classList.remove('loading'); 
            }
            return result;

        } catch (error) {
            console.error('Error calling Apps Script:', error);
            return { success: false, message: 'Network error or server unreachable: ' + error.message };
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
            // 登录成功后，获取配置信息
            const configResult = await callAppsScript('getConfig');
            if (configResult.success && configResult.data) {
                configPrices = configResult.data;
                // 确保获取到的价格是数字类型，并提供默认值
                configPrices.ClientelingUnitPrice = parseFloat(configPrices.ClientelingUnitPrice) || 16;
                configPrices.FullUnitPrice = parseFloat(configPrices.FullUnitPrice) || 52;
                configPrices.FixedCost = parseFloat(configPrices.FixedCost) || 0;
            } else {
                console.error('Failed to load config prices:', configResult.message);
                showMessage(loginMessage, 'Failed to load configuration prices. Using default prices.', false);
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
        showPage(loginPage);
    });

    // Submit SFSC Data button click event (Maison View)
    submitSfscDataButton.addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'maison') {
            showMessage(maisonSubmitMessage, 'Please log in as a Maison user!');
            return;
        }

        const quarter = quarterSelect.value; // Get quarter from dropdown
        const clientelingLicenseCount = parseInt(clientelingLicenseCountInput.value, 10);
        const fullLicenseCount = parseInt(fullLicenseCountInput.value, 10);

        if (!quarter || isNaN(clientelingLicenseCount) || clientelingLicenseCount < 0 || 
            isNaN(fullLicenseCount) || fullLicenseCount < 0) {
            showMessage(maisonSubmitMessage, 'Please enter a valid quarter and valid license counts (non-negative)!');
            return;
        }
        clearMessage(maisonSubmitMessage);

        const result = await callAppsScript('submitSfscData', {
            maisonName: currentUser.maisonName,
            quarter: quarter,
            clientelingLicenseCount: clientelingLicenseCount, 
            fullLicenseCount: fullLicenseCount,               
            submittedBy: currentUser.username
        });

        if (result.success) {
            showMessage(maisonSubmitMessage, `Data submitted successfully! Calculated Cost: ${result.calculatedCost} €`, true);
            clientelingLicenseCountInput.value = '0'; // Clear input fields
            fullLicenseCountInput.value = '0';       // Clear input fields
            // updateCostPreview(); // No longer needed for real-time preview
            if (currentUser.role === 'maison') {
                loadMaisonHistoryData(); 
            }
        } else {
            showMessage(maisonSubmitMessage, 'Data submission failed: ' + result.message);
        }
    });
    
    // --- 成本计算工具的事件监听 ---
    seeCostButton.addEventListener('click', () => {
        clearMessage(calculatorErrorMessage);
        const clientelingCount = parseInt(calcClientelingLicenseCountInput.value, 10) || 0;
        const fullCount = parseInt(calcFullLicenseCountInput.value, 10) || 0;
        const months = parseInt(calcMonthsSelect.value, 10) || 12;

        if (clientelingCount < 0 || fullCount < 0 || months < 1 || months > 12) {
            showMessage(calculatorErrorMessage, 'Please enter valid positive license counts and months (1-12)!');
            calculatedCostDisplay.textContent = 'Estimated Cost: NaN €';
            return;
        }

        const estimatedCost = calculateCostForTool(clientelingCount, fullCount, months);
        calculatedCostDisplay.textContent = `Estimated Cost: ${estimatedCost.toFixed(2)} €`;
        calculatedCostDisplay.classList.remove('error'); // 确保不是错误样式
        calculatedCostDisplay.classList.add('success'); // 显示为成功样式
    });

    // 初始化成本计算工具的许可证数量为提交框的默认值
    // clientelingLicenseCountInput.addEventListener('input', () => {
    //     calcClientelingLicenseCountInput.value = clientelingLicenseCountInput.value;
    // });
    // fullLicenseCountInput.addEventListener('input', () => {
    //     calcFullLicenseCountInput.value = fullLicenseCountInput.value;
    // });
    // 为了确保“See Cost”按钮能获取到最新的值，我们在每次点击时再读取，或者在主输入框变化时同步
    // 但这里我们让它们独立，避免混淆

    // Export Data button click event (Admin View)
    exportDataButton.addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'admin') {
            alert('Only administrators can export data!');
            return;
        }
        
        const result = await callAppsScript('getAllSfscData');

        if (result.success && result.data && result.data.length > 0) {
            const headers = Object.keys(result.data[0]); 
            let csv = headers.join(',') + '\n';
            result.data.forEach(row => {
                const values = headers.map(header => {
                    let value = row[header];
                    if (typeof value === 'string') {
                        value = `"${value.replace(/"/g, '""')}"`;
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
            showMessage(loginMessage, 'Export failed: No data or an error occurred.');
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
        } else if (currentUser.role === 'admin') {
            adminView.classList.remove('hidden');
            loadAdminOverviewData();
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
                    { key: 'Timestamp', label: 'Submission Time' }
                ];
                renderTable(maisonHistoryTableContainer, result.data, headersEn);
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
                    { key: 'Timestamp', label: 'Submission Time' }
                ];
                renderTable(adminDataTableContainer, result.data, headersEn);
            } else {
                adminDataTableContainer.innerHTML = '<p>Failed to load all data: ' + result.message + '</p>';
            }
        }
    }

    // --- On first load, show the login page ---
    showPage(loginPage);
});
