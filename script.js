document.addEventListener('DOMContentLoaded', () => {
    // --- 【非常重要！】请在这里替换成你的 Apps Script Web App URL ---
    const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIVoYBQtqkFB52frxB8e81899ISf_pDwJ_Fj3f9blb7mI2c3QhT4pHoz3sQuG1l6EDVQ/exec'; 
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    // Reminder: Replace the URL above with your own!

    // --- DOM Elements ---
    // Login Page
    const loginPage = document.getElementById('loginPage');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const loginMessage = document.getElementById('loginMessage');

    // Main Page (Common)
    const mainPage = document.getElementById('mainPage');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const logoutButton = document.getElementById('logoutButton');

    // Maison View
    const maisonView = document.getElementById('maisonView');
    const quarterSelect = document.getElementById('quarterSelect');
    const clientelingLicenseCountInput = document.getElementById('clientelingLicenseCount');
    const fullLicenseCountInput = document.getElementById('fullLicenseCount');
    const submitSfscDataButton = document.getElementById('submitSfscDataButton');
    const maisonSubmitMessage = document.getElementById('maisonSubmitMessage');
    const maisonHistoryTableContainer = document.getElementById('maisonHistoryTableContainer');

    // Admin View
    const adminView = document.getElementById('adminView');
    const adminDataTableContainer = document.getElementById('adminDataTableContainer');
    const exportDataButton = document.getElementById('exportDataButton');

    // Email Management Elements
    const emailManagementSection = document.getElementById('emailManagementSection');
    const emailDisplay = document.getElementById('emailDisplay');
    const registeredEmailValueSpan = document.getElementById('registeredEmailValue');
    const emailForm = document.getElementById('emailForm');
    const userEmailInput = document.getElementById('userEmailInput');
    const submitEmailButton = document.getElementById('submitEmailButton');
    const editEmailButton = document.getElementById('editEmailButton');
    const cancelEditEmailButton = document.getElementById('cancelEditEmailButton');
    const emailMessage = document.getElementById('emailMessage');

    // Cost Calculator Tool Elements
    const calcClientelingLicenseCountInput = document.getElementById('calcClientelingLicenseCount');
    const calcFullLicenseCountInput = document.getElementById('calcFullLicenseCount');
    const calcMonthsSelect = document.getElementById('calcMonthsSelect');
    const seeCostButton = document.getElementById('seeCostButton');
    const calculatedCostDisplay = document.getElementById('calculatedCostDisplay');
    const calculatorErrorMessage = document.getElementById('calculatorErrorMessage');

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
    
    // --- Global State Variables ---
    let currentUser = null; 
    let configPrices = { ClientelingUnitPrice: 16, FullUnitPrice: 52, FixedCost: 0 }; 
    let allUsers = []; // Store all users data for email broadcast
    let filteredUsers = []; // Store filtered users for display in email broadcast
    let currentRecipientEmails = []; // Store current recipient emails for email broadcast
    // --- Helper Functions ---

    // UI State Management
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

    // Email Validation Helper
    function isValidEmail(email) {
        // Simple regex for email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    // --- Table Rendering and Action Handlers ---

    // Generic table renderer for historical data with optional action buttons
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
            tableHTML += '<th>Action</th>';
        }
        if (options.includeAdminApprovalButtons) {
            tableHTML += '<th>Approval Action</th>';
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
                    } catch (e) { /* keep original value */ }
                } else if (header.key === 'ApprovalStatus' && cellValue) {
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
                tableHTML += `<td><button class="delete-button-table" data-record-id="${row.RecordId}">Delete</button></td>`;
            }
            if (options.includeAdminApprovalButtons) {
                tableHTML += `<td>
                                <button class="approve-button-table" data-record-id="${row.RecordId}">Approve</button>
                                <button class="reject-button-table" data-record-id="${row.RecordId}">Reject</button>
                              </td>`;
            }
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';
        containerElement.innerHTML = tableHTML;

        // Attach event listeners after rendering
        if (options.includeMaisonDeleteButton) {
            containerElement.querySelectorAll('.delete-button-table').forEach(button => {
                button.addEventListener('click', handleDeleteRecord);
            });
        }
        if (options.includeAdminApprovalButtons) {
            containerElement.querySelectorAll('.approve-button-table').forEach(button => {
                button.addEventListener('click', (event) => handleApprovalAction(event, 'Approved'));
            });
            containerElement.querySelectorAll('.reject-button-table').forEach(button => {
                button.addEventListener('click', (event) => handleApprovalAction(event, 'Rejected'));
            });
        }
    }

    // Handler for deleting a record
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
                    loadMaisonHistoryData();
                } else if (currentUser.role === 'admin') {
                    loadAdminOverviewData();
                }
            } else {
                showMessage(maisonSubmitMessage, 'Failed to delete record: ' + result.message, false);
            }
        }
    }

    // Handler for admin approval actions
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
                loadAdminOverviewData();
                // If maison user is logged in elsewhere, their view will reflect this on refresh
            } else {
                showMessage(loginMessage, `Failed to update record status: ${result.message}`, false);
            }
        }
    }
    // --- Data Population and Calculation Helpers ---

    // Populates the quarter selection dropdown
    async function populateQuarterSelect() {
        const numberOfFutureQuarters = 4;
        const result = await callAppsScript('getQuarterList', { numberOfFutureQuarters: numberOfFutureQuarters });
        if (result.success && result.data) {
            quarterSelect.innerHTML = '';
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

    // Populates the months selection dropdown for the cost calculator
    function populateCalcMonthsSelect() {
        calcMonthsSelect.innerHTML = '';
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            calcMonthsSelect.appendChild(option);
        }
        calcMonthsSelect.value = 12;
    }

    // Calculates the estimated cost based on licenses and months
    function calculateCostForTool(clientelingCount, fullCount, months) {
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
            // Display loading message for user-perceivable actions
            const showLoading = !['getQuarterList', 'getConfig', 'checkExistingRecord', 'getUserEmail', 'getAllUsers'].includes(action);
            if (showLoading) { 
                loginMessage.textContent = 'Requesting...'; 
                loginMessage.classList.add('loading'); 
            }
            
            // Ensure numeric payloads are correctly parsed
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

            const result = await response.json(); // Directly parse as JSON
        
            if (showLoading) {
                loginMessage.classList.remove('loading'); 
            }
            return result;

        } catch (error) {
            console.error('Error calling Apps Script:', error);
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
            
            // Fetch configuration prices after successful login
            const configResult = await callAppsScript('getConfig');
            if (configResult.success && configResult.data) {
                configPrices.ClientelingUnitPrice = parseFloat(configResult.data.ClientelingUnitPrice) || 16;
                configPrices.FullUnitPrice = parseFloat(configResult.data.FullUnitPrice) || 52;
                configPrices.FixedCost = parseFloat(configResult.data.FixedCost) || 0;
            } else {
                console.error('Failed to load config prices:', configResult.message);
                showMessage(loginMessage, 'Failed to load configuration prices. Using default prices.', false);
                configPrices = { ClientelingUnitPrice: 16, FullUnitPrice: 52, FixedCost: 0 }; // Fallback to defaults
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
        clearMessage(emailMessage); 
        showPage(loginPage);
    });

    // Submit SFSC Data button click event (Maison View)
    submitSfscDataButton.addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'maison') {
            showMessage(maisonSubmitMessage, 'Please log in as a Maison user!', false);
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

        let recordIdToUpdate = null;
        const checkResult = await callAppsScript('checkExistingRecord', { 
            maisonName: currentUser.maisonName, 
            quarter: quarter 
        });

        if (checkResult.success && checkResult.exists) {
            if (!confirm(`You have already submitted data for ${quarter}. Do you want to UPDATE the existing record?`)) {
                showMessage(maisonSubmitMessage, 'Submission cancelled.', false);
                return;
            }
            recordIdToUpdate = checkResult.recordId;
        }

        const result = await callAppsScript('submitSfscData', {
            maisonName: currentUser.maisonName,
            quarter: quarter,
            clientelingLicenseCount: clientelingLicenseCount, 
            fullLicenseCount: fullLicenseCount,               
            submittedBy: currentUser.username,
            recordIdToUpdate: recordIdToUpdate
        });

        if (result.success) {
            showMessage(maisonSubmitMessage, `${recordIdToUpdate ? 'Data updated' : 'Data submitted'} successfully! Calculated Cost: ${result.calculatedCost} €`, true);
            clientelingLicenseCountInput.value = '0';
            fullLicenseCountInput.value = '0';
            if (currentUser.role === 'maison') {
                loadMaisonHistoryData();
            }
        } else {
            showMessage(maisonSubmitMessage, 'Data submission failed: ' + result.message, false);
        }
    });
    
    // Cost Calculator Tool button click event
    seeCostButton.addEventListener('click', () => {
        clearMessage(calculatorErrorMessage);
        const clientelingCount = parseInt(calcClientelingLicenseCountInput.value, 10) || 0;
        const fullCount = parseInt(calcFullLicenseCountInput.value, 10) || 0;
        const months = parseInt(calcMonthsSelect.value, 10) || 12;

        if (clientelingCount < 0 || fullCount < 0 || months < 1 || months > 12 || isNaN(clientelingCount) || isNaN(fullCount) || isNaN(months)) {
            showMessage(calculatorErrorMessage, 'Please enter valid positive license counts and months (1-12)!', false);
            calculatedCostDisplay.textContent = 'Estimated Cost: NaN €';
            return;
        }

        const estimatedCost = calculateCostForTool(clientelingCount, fullCount, months);
        calculatedCostDisplay.textContent = `Estimated Cost: ${estimatedCost.toFixed(2)} €`;
        calculatedCostDisplay.classList.remove('error');
        calculatedCostDisplay.classList.add('success');
    });

    // Export Data button click event (Admin View)
    exportDataButton.addEventListener('click', async () => {
        if (!currentUser || currentUser.role !== 'admin') {
            alert('Only administrators can export data!');
            return;
        }
        
        const result = await callAppsScript('getAllSfscData');

        if (result.success && result.data && result.data.length > 0) {
            const headersToExport = [
                { key: 'MaisonName', label: 'Maison Name' },
                { key: 'Quarter', label: 'Quarter' },
                { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' },
                { key: 'FullLicenseCount', label: 'Full Licenses' },
                { key: 'CalculatedCost', label: 'Calculated Cost (€)' },
                { key: 'SubmittedBy', label: 'Submitted By' },
                { key: 'Timestamp', label: 'Submission Time' },
                { key: 'ApprovalStatus', label: 'Approval Status' }
            ];
            
            let csv = headersToExport.map(h => h.label).join(',') + '\n';
            result.data.forEach(row => {
                const values = headersToExport.map(header => {
                    let value = row[header.key];
                    if (header.key === 'Timestamp' && value) {
                        try {
                            const date = new Date(value);
                            if (!isNaN(date)) {
                                value = date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                            }
                        } catch (e) { /* keep original value */ }
                    }
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
            showMessage(loginMessage, 'Export failed: No data or an error occurred.', false);
        }
    });
    // --- Page Display Logic ---

    // Controls which main page view is shown based on user role
    function showMainPage() {
        showPage(mainPage);
        welcomeMessage.textContent = `Welcome, ${currentUser.maisonName} (${currentUser.role})!`;
        
        maisonView.classList.add('hidden');
        adminView.classList.add('hidden');

        if (currentUser.role === 'maison') {
            maisonView.classList.remove('hidden');
            populateQuarterSelect();
            populateCalcMonthsSelect();
            calcClientelingLicenseCountInput.value = '0'; // Reset input fields
            fullLicenseCountInput.value = '0';
            calculatedCostDisplay.textContent = 'Estimated Cost: 0.00 €';
            loadMaisonHistoryData();
            initEmailManagement();
        } else if (currentUser.role === 'admin') {
            adminView.classList.remove('hidden');
            loadAdminOverviewData();
            initEmailBroadcast();
        }
    }

    // Loads and renders historical data for the logged-in Maison user
    async function loadMaisonHistoryData() {
        if (currentUser && currentUser.role === 'maison') {
            const result = await callAppsScript('getMaisonSfscData', { maisonName: currentUser.maisonName });
            if (result.success && result.data) {
                const headersEn = [
                    { key: 'MaisonName', label: 'Maison Name' },
                    { key: 'Quarter', label: 'Quarter' },
                    { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' }, 
                    { key: 'FullLicenseCount', label: 'Full Licenses' },             
                    { key: 'CalculatedCost', label: 'Calculated Cost' },
                    { key: 'Timestamp', label: 'Submission Time' },
                    { key: 'ApprovalStatus', label: 'Approval Status' }
                ];
                renderTable(maisonHistoryTableContainer, result.data, headersEn, { includeMaisonDeleteButton: true }); 
            } else {
                maisonHistoryTableContainer.innerHTML = '<p>Failed to load historical data: ' + result.message + '</p>';
            }
        }
    }

    // Loads and renders all SFSC data for the Admin overview
    async function loadAdminOverviewData() {
        if (currentUser && currentUser.role === 'admin') {
            const result = await callAppsScript('getAllSfscData');
            if (result.success && result.data) {
                const headersEn = [
                    { key: 'MaisonName', label: 'Maison Name' },
                    { key: 'Quarter', label: 'Quarter' },
                    { key: 'ClientelingLicenseCount', label: 'Clienteling Licenses' }, 
                    { key: 'FullLicenseCount', label: 'Full Licenses' },             
                    { key: 'CalculatedCost', label: 'Calculated Cost' },
                    { key: 'SubmittedBy', label: 'Submitted By' },
                    { key: 'Timestamp', label: 'Submission Time' },
                    { key: 'ApprovalStatus', label: 'Approval Status' }
                ];
                renderTable(adminDataTableContainer, result.data, headersEn, { includeAdminApprovalButtons: true }); 
            } else {
                adminDataTableContainer.innerHTML = '<p>Failed to load all data: ' + result.message + '</p>';
            }
        }
    }
    // --- Email Management Logic (for Maison users) ---

    // Initializes the email management section UI
    async function initEmailManagement() {
        if (!currentUser || currentUser.role !== 'maison') {
            emailManagementSection.classList.add('hidden');
            return;
        }
        emailManagementSection.classList.remove('hidden');
        clearMessage(emailMessage);

        const result = await callAppsScript('getUserEmail', { username: currentUser.username });
        if (result.success && result.email) {
            registeredEmailValueSpan.textContent = result.email;
            emailDisplay.classList.remove('hidden');
            emailForm.classList.add('hidden');
            editEmailButton.classList.remove('hidden');
            submitEmailButton.textContent = 'Register Email';
            cancelEditEmailButton.classList.add('hidden');
            userEmailInput.value = result.email;
        } else {
            registeredEmailValueSpan.textContent = '';
            emailDisplay.classList.add('hidden');
            emailForm.classList.remove('hidden');
            editEmailButton.classList.add('hidden');
            submitEmailButton.textContent = 'Register Email';
            cancelEditEmailButton.classList.add('hidden');
            userEmailInput.value = '';
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
        showMessage(emailMessage, 'Saving email...', true);

        const result = await callAppsScript('updateUserEmail', { username: currentUser.username, email: email });

        if (result.success) {
            showMessage(emailMessage, 'Email saved successfully!', true);
            initEmailManagement(); // Refresh UI
        } else {
            showMessage(emailMessage, 'Failed to save email: ' + result.message, false);
        }
    });

    // Event listener for Edit Email Button
    editEmailButton.addEventListener('click', () => {
        emailDisplay.classList.add('hidden');
        editEmailButton.classList.add('hidden');

        emailForm.classList.remove('hidden');
        userEmailInput.value = registeredEmailValueSpan.textContent;
        submitEmailButton.textContent = 'Save Changes';
        cancelEditEmailButton.classList.remove('hidden');
        clearMessage(emailMessage);
    });

    // Event listener for Cancel Edit Email Button
    cancelEditEmailButton.addEventListener('click', () => {
        initEmailManagement(); // Revert to initial state
        clearMessage(emailMessage);
    });

    // --- Email Broadcast Functions (Admin) ---

    // Initializes the email broadcast section
    async function initEmailBroadcast() {
        if (!currentUser || currentUser.role !== 'admin') {
            emailBroadcastSection.classList.add('hidden');
            return;
        }
        emailBroadcastSection.classList.remove('hidden');
        
        await loadAllUsers();
        
        selectAllButton.addEventListener('click', handleSelectAll);
        deselectAllButton.addEventListener('click', handleDeselectAll);
        userSearchInput.addEventListener('input', handleUserSearch);
        openOutlookButton.addEventListener('click', handleOpenOutlook);
        copyEmailsButton.addEventListener('click', handleCopyEmails);
        
        updateRecipientCount(); // Initial count update
    }

    // Loads all users from the backend for selection
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

    // Renders the list of users with checkboxes for email broadcast
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

        userListContainer.querySelectorAll('.user-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', updateRecipientCount);
        });
    }

    // Selects all non-disabled checkboxes in the user list
    function handleSelectAll() {
        userListContainer.querySelectorAll('.user-checkbox:not(:disabled)').forEach(checkbox => {
            checkbox.checked = true;
        });
        updateRecipientCount();
    }

    // Deselects all checkboxes in the user list
    function handleDeselectAll() {
        userListContainer.querySelectorAll('.user-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        updateRecipientCount();
    }

    // Filters the user list based on search input
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

    // Updates the list of current recipient emails based on selected checkboxes
    function updateRecipientEmails() {
        const selectedCheckboxes = userListContainer.querySelectorAll('.user-checkbox:checked');
        currentRecipientEmails = Array.from(selectedCheckboxes)
            .map(cb => cb.dataset.email)
            .filter(email => email && email.trim() !== '');
    }

    // Updates the recipient count display
    function updateRecipientCount() {
        updateRecipientEmails(); // Ensure currentRecipientEmails is up-to-date
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

    // Handles opening Outlook with selected recipients and pre-filled subject/body
    function handleOpenOutlook() {
        updateRecipientEmails(); // Ensure currentRecipientEmails is up-to-date
        
        if (currentRecipientEmails.length === 0) {
            showMessage(emailBroadcastMessage, 'No recipients selected. Please select at least one user with email address.', false);
            return;
        }

        const subject = emailSubjectInput.value.trim();
        const body = emailContentInput.value.trim();

        const to = currentRecipientEmails.join(',');
        
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);

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

        window.location.href = mailtoUrl;
        
        showMessage(emailBroadcastMessage, `Opening Outlook with ${currentRecipientEmails.length} recipient(s)... If it doesn't open, please check your default email client settings.`, true);
    }

    // Handles copying selected recipient emails to clipboard
    function handleCopyEmails() {
        updateRecipientEmails(); // Ensure currentRecipientEmails is up-to-date
        
        if (currentRecipientEmails.length === 0) {
            showMessage(emailBroadcastMessage, 'No recipients to copy. Please select at least one user with email address.', false);
            return;
        }

        try {
            const emailList = currentRecipientEmails.join('; ');
            navigator.clipboard.writeText(emailList).then(() => {
                showMessage(emailBroadcastMessage, `Copied ${currentRecipientEmails.length} email(s) to clipboard!`, true);
            }).catch(() => {
                fallbackCopyToClipboard(emailList);
            });
        } catch (err) {
            fallbackCopyToClipboard(currentRecipientEmails.join('; '));
        }
    }

    // Fallback function for copying text to clipboard (for older browsers)
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
