// Google 配置
const CLIENT_ID = '865328084242-q1sgtl5mijq2pborbboffgocllnbcbsu.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDva51wB_ZwbyVhGIqf7IcDVCSx5_TOTH4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const SPREADSHEET_ID = '1JJteOelS61Zb76CBi5RhwzuCqNKSdgiDuG_O3WDqm8A';
 
// 本地存儲鍵
const STORAGE_KEYS = {
    PUBLIC_MESSAGES: 'publicMessages',
    PRIVATE_MESSAGES: 'privateMessages',
    PENDING_MESSAGES: 'pendingMessages',
    USER_ROLE: 'userRole',
    USER_ID: 'userId',
    ACCESS_TOKEN: 'googleAccessToken'
};

// 全局變量
let tokenClient;
let accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
let currentUserId = localStorage.getItem(STORAGE_KEYS.USER_ID) || generateUserId();
let isAdmin = localStorage.getItem(STORAGE_KEYS.USER_ROLE) === 'admin';

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('The page is loaded and initialized...');
    initializeLocalStorage();
    loadMessages();
    updateDebugInfo('Page loading completed');
    
    if (isAdmin) {
        document.getElementById('adminPanel').style.display = 'block';
        loadPendingMessages();
    }
    
    // 初始化 Google
    initializeGoogle();
});

// 初始化 Google 服務
function initializeGoogle() {
    console.log('Initializing Google services...');
    
    // 載入 Google API Client
    gapi.load('client', initializeGapiClient);
    
    // 初始化 Google Identity Services
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse,
    });
    
    // 如果有保存的 token，檢查是否有效
    if (accessToken) {
        validateAndUseToken();
    }
}

// 初始化 GAPI Client
function initializeGapiClient() {
    console.log('Initializing GAPI Client...');
    
    gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    }).then(function() {
        console.log('GAPI Client initialization successful');
        document.getElementById('apiStatus').textContent = '已初始化';
        
        // 如果有 token，設置它
        if (accessToken) {
            gapi.client.setToken({ access_token: accessToken });
            updateSigninStatus(true);
        } else {
            showSignInButton();
        }
    }).catch(function(error) {
        console.error('GAPI Client initialization failed:', error);
        updateDebugInfo('Initialization failed: ' + error.message);
    });
}

// 處理 Token 響應
function handleTokenResponse(tokenResponse) {
    console.log('Receive Token response');
    
    if (tokenResponse.error) {
        console.error('Token error:', tokenResponse.error);
        return;
    }
    
    accessToken = tokenResponse.access_token;
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    
    // 設置 token 到 GAPI
    gapi.client.setToken({ access_token: accessToken });
    
    updateSigninStatus(true);
    testSheetsConnection();
}

// 顯示登入按鈕
function showSignInButton() {
    const buttonDiv = document.getElementById('buttonDiv');
    buttonDiv.innerHTML = '<button id="signInButton" style="padding: 10px 20px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">登入 Google</button>';
    
    document.getElementById('signInButton').onclick = () => {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    };
}

// 驗證並使用保存的 Token
function validateAndUseToken() {
    console.log('Verify the saved Token...');
    
    // 嘗試使用 token 進行 API 調用
    gapi.client.setToken({ access_token: accessToken });
    
    gapi.client.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
    }).then(function(response) {
        console.log('Token is valid');
        updateSigninStatus(true);
    }).catch(function(error) {
        console.log('Token is invalid or expired');
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        accessToken = null;
        showSignInButton();
    });
}

// 更新登入狀態
function updateSigninStatus(isSignedIn) {
    console.log('Login status update:', isSignedIn);
    
    if (isSignedIn) {
        document.getElementById('loginStatus').textContent = '已登入';
        document.getElementById('buttonDiv').innerHTML = '<button onclick="signOut()" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">登出</button>';
    } else {
        document.getElementById('loginStatus').textContent = '未登入';
        showSignInButton();
    }
}

// 登出
function signOut() {
    console.log('Logout...');
    
    // 撤銷 token
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Token has been revoked');
        });
    }
    
    // 清除本地存儲
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    accessToken = null;
    
    // 清除 GAPI token
    gapi.client.setToken(null);
    
    updateSigninStatus(false);
}

// 測試 Sheets 連接
function testSheetsConnection() {
    console.log('Testing Google Sheets connection...');
    
    gapi.client.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
    }).then(function(response) {
        console.log('Successfully connected to Google Sheets');
        console.log('Spreadsheet Name:', response.result.properties.title);
        updateDebugInfo('Sheets connected successfully');
        
        // 自動測試寫入
        const testData = [[
            Date.now(),
            'Testing User',
            'Test message for Google Identity Services',
            new Date().toISOString(),
            'approved',
            'system',
            new Date().toISOString()
        ]];
        
        return gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'publicMessages!A:G',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: testData
            }
        });
    }).then(function(response) {
        console.log('Test write successful!');
        updateDebugInfo('Test write successful!');
        alert('Google Sheets connected successfully!');
    }).catch(function(error) {
        console.error('connected error:', error);
        updateDebugInfo('connected error: ' + error.message);
        
        if (error.status === 401) {
            console.log('The token may have expired and you need to log in again.');
            signOut();
        }
    });
}

// 檢查 Google Sheets
function checkGoogleSheets() {
    if (!accessToken) {
        alert('Please log in to your Google account');
        tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
    }
    
    testSheetsConnection();
}

// 從 Google Sheets 載入數據
function loadFromGoogleSheets() {
    if (!accessToken) {
        alert('Please log in to your Google account');
        tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
    }
    
    console.log('Load data from Google Sheets...');
    
    // 載入公開留言
    gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'publicMessages!A2:G'
    }).then(function(response) {
        const values = response.result.values || [];
        console.log('Loaded', values.length, 'Public comments');
        
        const messages = values.map(row => ({
            id: parseInt(row[0]) || Date.now(),
            author: row[1] || 'NA',
            content: row[2] || '',
            timestamp: row[3] || new Date().toISOString(),
            status: row[4] || 'pending',
            approvedBy: row[5] || '',
            approvedAt: row[6] || ''
        }));
        
        localStorage.setItem(STORAGE_KEYS.PUBLIC_MESSAGES, JSON.stringify(messages));
        loadPublicMessages();
        updateDebugInfo('Loaded successfully');
    }).catch(function(error) {
        console.error('Loaded Error:', error);
        updateDebugInfo('Loaded Error');
    });
}

// 提交到 Google Sheets
function appendToGoogleSheets(sheetName, values) {
    if (!accessToken) {
        console.warn('Not logged into Google, data is only saved locally');
        return;
    }
    
    const range = sheetName === 'publicMessages' ? 'publicMessages!A:G' : 'privateMessages!A:E';
    
    gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            values: [values]
        }
    }).then(function(response) {
        console.log('Data synced to Google Sheets');
        updateDebugInfo('Synchronization successful');
    }).catch(function(error) {
        console.error('Synchronization unsuccessful:', error);
        updateDebugInfo('Synchronization unsuccessful');
    });
}


// 生成用戶ID
function generateUserId() {
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    return userId;
}

// 初始化本地存儲
function initializeLocalStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.PUBLIC_MESSAGES)) {
        const initialPublicMessages = [{
            id: 1,
            author: "manager",
            content: "Welcom to use the Message Board System！",
            timestamp: new Date().toISOString(),
            status: "approved",
            approvedBy: "system",
            approvedAt: new Date().toISOString()
        }];
        localStorage.setItem(STORAGE_KEYS.PUBLIC_MESSAGES, JSON.stringify(initialPublicMessages));
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.PRIVATE_MESSAGES)) {
        const initialPrivateMessages = [{
            id: 1,
            conversationID: currentUserId,
            sender: "researcher",
            content: "Hello! What can I do for you?",
            timestamp: new Date().toISOString()
        }];
        localStorage.setItem(STORAGE_KEYS.PRIVATE_MESSAGES, JSON.stringify(initialPrivateMessages));
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.PENDING_MESSAGES)) {
        localStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify([]));
    }
}

// 載入訊息
function loadMessages() {
    loadPublicMessages();
    loadPrivateMessages();
}

// 載入公開留言
function loadPublicMessages() {
    const messages = JSON.parse(localStorage.getItem(STORAGE_KEYS.PUBLIC_MESSAGES) || '[]');
    const container = document.getElementById('publicMessages');
    container.innerHTML = '';
    
    messages
        .filter(msg => msg.status === 'approved')
        .forEach(msg => displayPublicMessage(msg));
}

// 載入私人訊息
function loadPrivateMessages() {
    const messages = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRIVATE_MESSAGES) || '[]');
    const container = document.getElementById('privateMessages');
    container.innerHTML = '';
    
    messages
        .filter(msg => msg.conversationID === currentUserId)
        .forEach(msg => displayPrivateMessage(msg));
}

// 載入待審核留言
function loadPendingMessages() {
    if (!isAdmin) return;
    
    const pendingMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_MESSAGES) || '[]');
    const container = document.getElementById('pendingMessages');
    container.innerHTML = '';
    
    pendingMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'pending-message';
        messageDiv.innerHTML = `
            <div class="message-author">${msg.author}</div>
            <div class="message-content">${msg.content}</div>
            <div class="message-time">${new Date(msg.timestamp).toLocaleString('zh-TW')}</div>
            <div class="admin-actions">
                <button class="approve-btn" onclick="approveMessage(${msg.id})">approve</button>
                <button class="reject-btn" onclick="rejectMessage(${msg.id})">reject</button>
            </div>
        `;
        container.appendChild(messageDiv);
    });
}

// 顯示公開留言
function displayPublicMessage(message) {
    const container = document.getElementById('publicMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-item';
    messageDiv.innerHTML = `
        <div>
            <span class="message-author">${message.author}</span>
            <span class="message-time">${new Date(message.timestamp).toLocaleString('zh-TW')}</span>
        </div>
        <div class="message-content">${parseMarkdown(message.content)}</div>
    `;
    container.appendChild(messageDiv);
}

// 顯示私人訊息
function displayPrivateMessage(message) {
    const container = document.getElementById('privateMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${message.sender}`;
    messageDiv.innerHTML = `
        <div class="chat-bubble">
            <div class="chat-content">${parseMarkdown(message.content)}</div>
            <div class="chat-time" style="font-size: 11px; color: #666; margin-top: 5px;">
                ${new Date(message.timestamp).toLocaleTimeString('zh-TW')}
            </div>
        </div>
    `;
    container.appendChild(messageDiv);
}

// 提交公開留言
function submitPublicMessage() {
    const input = document.getElementById('publicMessageInput');
    const content = input.value.trim();
    
    if (!content) {
        alert(' Please input the content: ');
        return;
    }
    
    const newMessage = {
        id: Date.now(),
        author: currentUserId,
        content: content,
        timestamp: new Date().toISOString(),
        status: 'pending',
        approvedBy: null,
        approvedAt: null
    };
    
    const pendingMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_MESSAGES) || '[]');
    pendingMessages.push(newMessage);
    localStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify(pendingMessages));
    
    appendToGoogleSheets('publicMessages', [
        newMessage.id,
        newMessage.author,
        newMessage.content,
        newMessage.timestamp,
        newMessage.status,
        newMessage.approvedBy || '',
        newMessage.approvedAt || ''
    ]);
    
    input.value = '';
    alert('The message has been submitted and is awaiting review by the administrator');
    updateDebugInfo('Submit the new message');
    
    if (isAdmin) {
        loadPendingMessages();
    }
}

// 發送私人訊息
function sendPrivateMessage() {
    const input = document.getElementById('privateChatInput');
    const content = input.value.trim();
    
    if (!content) {
        alert(' Please input the content: ');
        return;
    }
    
    const newMessage = {
        id: Date.now(),
        conversationID: currentUserId,
        sender: 'participant',
        content: content,
        timestamp: new Date().toISOString()
    };
    
    const privateMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRIVATE_MESSAGES) || '[]');
    privateMessages.push(newMessage);
    localStorage.setItem(STORAGE_KEYS.PRIVATE_MESSAGES, JSON.stringify(privateMessages));
    
    appendToGoogleSheets('privateMessages', [
        newMessage.id,
        newMessage.conversationID,
        newMessage.sender,
        newMessage.content,
        newMessage.timestamp
    ]);
    
    input.value = '';
    displayPrivateMessage(newMessage);
    updateDebugInfo(' Send Private Message ');
    
    setTimeout(() => {
        const autoReply = {
            id: Date.now(),
            conversationID: currentUserId,
            sender: 'researcher',
            content: 'Thank you for your message. I will reply to you as soon as possible.',
            timestamp: new Date().toISOString()
        };
        
        privateMessages.push(autoReply);
        localStorage.setItem(STORAGE_KEYS.PRIVATE_MESSAGES, JSON.stringify(privateMessages));
        displayPrivateMessage(autoReply);
        
        appendToGoogleSheets('privateMessages', [
            autoReply.id,
            autoReply.conversationID,
            autoReply.sender,
            autoReply.content,
            autoReply.timestamp
        ]);
    }, 2000);
}

// 批准留言
function approveMessage(messageId) {
    const pendingMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_MESSAGES) || '[]');
    const publicMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.PUBLIC_MESSAGES) || '[]');
    
    const messageIndex = pendingMessages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1) {
        const message = pendingMessages[messageIndex];
        message.status = 'approved';
        message.approvedBy = 'admin';
        message.approvedAt = new Date().toISOString();
        
        publicMessages.push(message);
        pendingMessages.splice(messageIndex, 1);
        
        localStorage.setItem(STORAGE_KEYS.PUBLIC_MESSAGES, JSON.stringify(publicMessages));
        localStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify(pendingMessages));
        
        loadMessages();
        loadPendingMessages();
        updateDebugInfo(' Approved Message');
    }
}

// 拒絕留言
function rejectMessage(messageId) {
    const pendingMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_MESSAGES) || '[]');
    const messageIndex = pendingMessages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
        pendingMessages.splice(messageIndex, 1);
        localStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify(pendingMessages));
        
        loadPendingMessages();
        updateDebugInfo(' Reject Message');
    }
}

// 更新調試信息
function updateDebugInfo(action) {
    document.getElementById('lastAction').textContent = action + ' (' + new Date().toLocaleTimeString('zh-TW') + ')';
}

// 切換管理員模式
function toggleAdminMode() {
    isAdmin = !isAdmin;
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, isAdmin ? 'admin' : 'user');
    document.getElementById('adminPanel').style.display = isAdmin ? 'block' : 'none';
    if (isAdmin) {
        loadPendingMessages();
    }
    alert(isAdmin ? 'Switched to administrator mode' : 'Switched to user mode');
}

// Markdown  
function parseMarkdown(text) {
    text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    text = text.replace(/\*(.+?)\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    text = text.replace(/_(.+?)_/g, '<em>$1</em>');
    text = text.replace(/~(.+?)~/g, '<del>$1</del>');
    text = text.replace(/`(.+?)`/g, '<code>$1</code>');
    text = text.replace(/\n/g, '<br>');
    
    return text;
}



// 全局函數
window.submitPublicMessage = submitPublicMessage;
window.sendPrivateMessage = sendPrivateMessage;
window.approveMessage = approveMessage;
window.rejectMessage = rejectMessage;
window.toggleAdminMode = toggleAdminMode;
window.checkGoogleSheets = checkGoogleSheets;
window.loadFromGoogleSheets = loadFromGoogleSheets;
window.signOut = signOut;

console.log('Tip: Use the new Google Identity Services');
console.log('Enter toggleAdminMode() in the console to switch to administrator mode');