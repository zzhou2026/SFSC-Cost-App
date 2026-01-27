# SFSC Cost Management Application

## Version 0.0.1 (Released: January 27, 2026)

### 🎉 Initial Release

This is the first official release of the SFSC Cost Management Application.

### ✨ New Features

#### 1. Email Broadcast via Outlook
- Added email broadcast functionality for administrators
- **User Selection Interface**: Display all users with checkboxes for manual selection
  - Shows username, email address, and Maison name
  - Search functionality to filter users by name, email, or Maison
  - Select All / Deselect All buttons for quick selection
- **Outlook Integration**:
  - "Open in Outlook" button - Opens default email client (Outlook) with pre-filled recipients, subject, and content
  - "Copy Email List" button - Copies selected email addresses to clipboard
- Real-time recipient count display
- Only users with registered email addresses can be selected

### 🎨 UI/UX Improvements

#### Overview Table Enhancements
- **Table Header Font Size**: Reduced to `0.75em` for better fit
- **Table Content Font Size**: Reduced to `0.8em` for better readability
- **Table Header Text Wrapping**: Enabled text wrapping in headers to prevent truncation (e.g., "Submission Time" no longer shows as "subm...")
- **Column Width Optimization**:
  - First 7 columns (Maison Name, Quarter, Clienteling Licenses, Full Licenses, Calculated Cost, Submitted By, Approval Status): Fixed at `70px` each
  - Submission Time column (7th): Shares remaining width with Approval Action column
  - Approval Action column (9th): Shares remaining width with Submission Time column
  - Both long-content columns automatically divide remaining space equally
- **Button Alignment**: Approve and Reject buttons are now vertically centered in table cells
- **Table Layout**: All columns have consistent vertical alignment

#### Overall Layout
- **Container Width**: Increased maximum width from `800px` to `1000px` for better content display
- Container width: `90%` of viewport (responsive) with `max-width: 1000px`

### 📋 Technical Details

#### Backend Requirements
- `getAllUsers` API endpoint required for email broadcast feature
  - Returns user list with username, email, maisonName, and role
  - See `OUTLOOK_EMAIL_SETUP.md` for implementation details

#### CSS Changes
- Table header: `font-size: 0.75em`, `white-space: normal`, `word-wrap: break-word`
- Table content: `font-size: 0.8em`
- Container: `max-width: 1000px`
- Column widths: Fixed 70px for short columns, dynamic for long-content columns

### 🔧 Bug Fixes
- Fixed table header text truncation issue
- Improved button vertical alignment in approval action column

---

## Project Overview

SFSC Cost Management Application is a web-based system for managing SFSC license quantities and costs.

### Features
- User authentication (Maison users and Admin)
- SFSC license quantity submission by quarter
- Cost calculation tool
- Historical data management
- Admin approval workflow
- Data export (CSV)
- Email management for users
- **Email broadcast via Outlook** (New in v0.0.1)

### Technology Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Google Apps Script
- Database: Google Sheets

### User Roles
- **Maison Users**: Can submit license data, view history, manage email
- **Admin**: Can view all data, approve/reject submissions, export data, send broadcast emails
