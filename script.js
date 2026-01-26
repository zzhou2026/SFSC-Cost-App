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
    const currentQuarterInput = document.getElementById('currentQuarter');
    const licenseCountInput = document.getElementById('licenseCount');
    const submitSfscDataButton = document.getElementById('submitSfscDataButton');
    const maisonSubmitMessage = document.getElementById('maisonSubmitMessage');
    const maisonHistoryTableContainer = document.getElementById('maisonHistoryTableContainer');

    const adminView = document.getElementById('adminView');
    const adminDataTableContainer = document.getElementById('adminDataTableContainer');
    const exportDataButton = document.getElementById('exportDataButton');

    let currentUser = null; // Stores current logged-in user info

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

    // Get current quarter (e.g., 2024Q1, 2024Q2)
    function getCurrentQuarter() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // getMonth() returns 0-11

        let quarter = '';
        if (month >= 1 && month <= 3) {
            quarter = 'Q1';
        } else if (month >= 4 && month <= 6) {
            quarter = 'Q2';
        } else if (month >= 7 && month <= 9) {
            quarter = 'Q3';
        } else {
            quarter = 'Q4';
        }
        return `${year}${quarter}`;
    }

    // Render data into an HTML table
    function renderTable(containerElement, data, headersToShowMapping) {
        if (!data || data.length === 0) {
            containerElement.innerHTML = '<p>No data available at the moment.</p>';
            return;
        }

        let tableHTML = '<table><thead><tr>';
        
        // Generate table headers (in English)
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


    // --- Core function to call Apps Script backend ---
    async function callAppsScript(action, payload = {}) {
        try {
            loginMessage.textContent = 'Requesting...'; 
            loginMessage.classList.add('loading'); 

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
            
            loginMessage.classList.remove('loading'); 
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

        const quarter = currentQuarterInput.value;
        const licenseCount = parseInt(licenseCountInput.value, 10);

        if (!quarter || isNaN(licenseCount) || licenseCount < 0) {
            showMessage(maisonSubmitMessage, 'Please enter a valid quarter and number of licenses!');
            return;
        }
        clearMessage(maisonSubmitMessage);

        const result = await callAppsScript('submitSfscData', {
            maisonName: currentUser.maisonName,
            quarter: quarter,
            licenseCount: licenseCount,
            submittedBy: currentUser.username
        });

        if (result.success) {
            showMessage(maisonSubmitMessage, `Data submitted successfully! Calculated Cost: ${result.calculatedCost}`, true);
            licenseCountInput.value = ''; 
            if (currentUser.role === 'maison') {
                loadMaisonHistoryData(); 
            }
        } else {
            showMessage(maisonSubmitMessage, 'Data submission failed: ' + result.message);
        }
    });

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

        currentQuarterInput.value = getCurrentQuarter(); 

        if (currentUser.role === 'maison') {
            maisonView.classList.remove('hidden');
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
                    { key: 'LicenseCount', label: 'License Count' },
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
                    { key: 'LicenseCount', label: 'License Count' },
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
