# 通过Outlook发送邮件功能设置说明

## 前端功能已完成 ✅

前端已经添加了完整的群发邮件功能，包括：
- 管理员界面中的群发邮件区域
- **用户列表显示** - 显示所有用户，包括用户名、邮箱、Maison名称
- **手动选择功能** - 可以勾选要发送邮件的用户
- **全选/取消全选** - 快速选择或取消所有用户
- **搜索功能** - 可以按用户名、邮箱或Maison名称搜索用户
- 邮件主题和内容输入框
- **"Open in Outlook"按钮** - 使用mailto链接打开Outlook并自动填充收件人、主题和内容
- **"Copy Email List"按钮** - 复制收件人邮箱列表到剪贴板
- 实时显示选中的收件人数量

## 工作原理

1. 系统从后端加载所有用户列表并显示
2. 管理员在用户列表中手动勾选要发送邮件的用户
3. 填写邮件主题和内容
4. 点击"Open in Outlook"按钮后，系统会：
   - 获取所有选中用户的邮箱地址
   - 使用`mailto:`链接打开默认邮件客户端（Outlook）
   - 自动填充收件人、主题和内容
5. 用户可以在Outlook中查看、编辑并发送邮件

## 需要在Google Apps Script后端实现的功能

### `getAllUsers` action ⭐ **必需**

**功能**: 获取所有用户列表，包括用户名、邮箱、Maison名称等信息

**请求格式**:
```javascript
{
  action: 'getAllUsers'
}
```

**返回格式**:
```javascript
{
  success: true,
  data: [
    {
      username: 'user1',
      email: 'user1@example.com',
      maisonName: 'Maison1',
      role: 'maison'
    },
    {
      username: 'user2',
      email: 'user2@example.com',
      maisonName: 'Maison2',
      role: 'maison'
    },
    // ... 更多用户
  ]
}
```

**实现示例**:

```javascript
function getAllUsers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users'); // 假设用户表名为'Users'
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // 找到相关列的索引
  const usernameCol = headers.indexOf('Username');
  const emailCol = headers.indexOf('Email');
  const roleCol = headers.indexOf('Role');
  const maisonCol = headers.indexOf('MaisonName');
  
  const users = [];
  
  // 从第二行开始（跳过表头）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const user = {
      username: row[usernameCol] || '',
      email: row[emailCol] || '',
      role: row[roleCol] || '',
      maisonName: row[maisonCol] || ''
    };
    
    // 只添加有用户名的记录
    if (user.username && user.username.trim() !== '') {
      users.push(user);
    }
  }
  
  return users;
}

// 在主处理函数中添加路由
function doPost(e) {
  const request = JSON.parse(e.postData.contents);
  
  if (request.action === 'getAllUsers') {
    const users = getAllUsers();
    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        data: users
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ... 其他action处理
}
```

## Google Sheets数据结构建议

### 用户表 (Users Sheet)
建议包含以下列：
- Username
- Password (建议加密存储)
- Role (maison/admin)
- MaisonName
- Email (用户注册的邮箱地址)

## 使用说明

### 前端使用流程

1. **管理员登录**后，在页面底部看到"Send Email to Users via Outlook"区域
2. **选择收件人**:
   - 在用户列表中勾选要发送邮件的用户
   - 可以使用"Select All"按钮全选所有用户
   - 可以使用"Deselect All"按钮取消所有选择
   - 可以使用搜索框搜索用户（按用户名、邮箱或Maison名称）
   - 只有已注册邮箱的用户才能被选中
3. **查看选中数量**: 系统会自动显示已选中的收件人数量
4. **填写邮件内容**:
   - 输入邮件主题
   - 输入邮件内容
5. **发送邮件**:
   - 点击"Open in Outlook"按钮 - 会打开Outlook并自动填充收件人、主题和内容
   - 或点击"Copy Email List"按钮 - 复制收件人邮箱列表到剪贴板，然后手动粘贴到Outlook

### mailto链接说明

系统使用标准的`mailto:`协议来打开邮件客户端：
- 格式: `mailto:email1,email2?subject=主题&body=内容`
- 多个收件人用逗号分隔
- 如果Outlook没有自动打开，请检查：
  1. 浏览器是否允许打开外部应用
  2. 系统默认邮件客户端设置
  3. Outlook是否已安装并设置为默认邮件客户端

## 注意事项

1. **浏览器兼容性**:
   - `mailto:`链接在所有现代浏览器中都支持
   - 某些浏览器可能会询问是否允许打开邮件客户端

2. **收件人数量限制**:
   - `mailto:`链接对URL长度有限制（通常约2000字符）
   - 如果收件人太多，建议使用"Copy Email List"功能，然后在Outlook中手动添加

3. **邮件客户端**:
   - 系统会打开系统默认的邮件客户端
   - 如果默认客户端不是Outlook，需要手动设置Outlook为默认邮件客户端

4. **隐私和安全**:
   - 邮箱地址会在URL中传递，但这是标准的mailto协议行为
   - 建议在HTTPS环境下使用

## 测试建议

1. 测试三种收件人类型是否都能正确获取邮箱列表
2. 测试"Open in Outlook"按钮是否能正确打开邮件客户端
3. 测试"Copy Email List"功能是否能正确复制邮箱列表
4. 测试邮件主题和内容是否正确填充
5. 测试空邮箱列表的情况（应该显示提示信息）

## 优势

相比直接在应用中发送邮件，这种方式有以下优势：
- ✅ 不需要Gmail API配额
- ✅ 用户可以在Outlook中编辑邮件内容
- ✅ 可以使用Outlook的所有功能（附件、格式化等）
- ✅ 邮件发送记录保存在Outlook中
- ✅ 不需要额外的API权限
