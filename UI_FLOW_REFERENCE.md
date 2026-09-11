# QC Tool UI Flow Reference

## Prototype Navigation Guide

This document serves as a quick reference for navigating and testing the low-fidelity UI prototype.

---

## 1. START: Login Screen

**URL Path:** Default screen when app loads

**What You See:**
- QC Tool logo (placeholder)
- Welcome message
- "Sign in with Google" button
- Demo control panel at bottom

**Next Steps:**
- Click demo buttons to jump to different flows:
  - **"Dashboard"** → Logs in user with 4 projects
  - **"No Project"** → Logs in user with no projects assigned
  - **"Auth Failed"** → Shows authentication error
  - **"Email Not Verified"** → Shows email verification error
  - **"Not Registered"** → Shows user not pre-registered error
  - **"Account Unavailable"** → Shows suspended account error
  - **"Service Down"** → Shows service unavailable error

---

## 2. FLOW A: Successful Login with Projects

### Screen 2.1: Signing In (Loading State)
- Spinner animation
- Text: "Signing you in…"
- Brief explanation message
- *Duration: 2 seconds (demo), then navigates to Dashboard*

### Screen 2.2: Project Dashboard
**What You See:**
- Sidebar navigation (dark blue left panel)
  - Logo at top
  - Navigation items: Projects, APIs, Environments, Snapshots, Comparisons
  - Admin section with "Project Members" link
- Header bar (white)
  - User info with avatar and role badge
  - Logout button
- Main content area
  - Stats cards (Assigned Projects, Total APIs, Last Run, Critical Issues)
  - Project grid with 4 cards

**Each Project Card Shows:**
- Project name
- Description
- API count
- Last run time
- Health status (Healthy/Warning/Critical)
- Clickable - navigate to Project Detail

**Actions Available:**
- Click any project card → Project Detail screen
- Click "Project Members" sidebar → Members screen
- Click Logout → Back to Login
- Simulate session expiry link (for testing)

---

## 3. FLOW B: Successful Login with No Projects

### Screen 3.1: Signing In (Loading State)
- Same as Flow A

### Screen 3.2: No Project Assigned
**What You See:**
- Minimal header with logo and user info
- Empty state message
- Icons indicating no projects
- Clear explanation

**Actions Available:**
- "Refresh" button - simulates checking for new project assignments
- "Logout" button - return to login

---

## 4. FLOW C: Login Errors

### Screen 4.1: Login Error Screen
**Shown for any of these error types:**
- Google Auth Failed
- Auth Cancelled  
- Email Not Verified
- User Not Registered
- Account Linking Conflict
- Account Unavailable
- System Role Missing
- Service Unavailable

**What You See:**
- Error icon (large red)
- Error title (specific to error type)
- Error message (user-friendly, no technical details)
- Two action buttons:
  - Primary action (Try Again / Contact Administrator)
  - Secondary action (Back to Sign In)

**Actions Available:**
- Click buttons to return to Login screen
- Try different error types by restarting demo

---

## 5. FLOW D: Project Details & Members Management

### Screen 5.1: Project Detail
**What You See:**
- Navigation back to Projects
- Tab bar with 7 tabs:
  - Overview
  - APIs [TBD]
  - Environments [TBD]
  - Runs [TBD]
  - Snapshots [TBD]
  - Comparisons [TBD]
  - Members

**Overview Tab Content:**
- Project name and description
- Quick stats (APIs, Status, Last Run)
- TBD message for detailed info

**Tab Navigation:**
- Click "Members" tab → Full Members screen

**Actions Available:**
- Click back button → Project list
- Click Members tab → Members screen
- Click Logout → Login screen

### Screen 5.2: Project Members
**What You See:**
- Members data table with columns:
  - User (name + avatar)
  - Email
  - Role (ADMIN or USER badge)
  - Status (ACTIVE, INVITED, INACTIVE, BLOCKED badge)
  - Added date
  - Actions (edit/cancel buttons)

**Toolbar:**
- Search input (by name or email)
- Status filter dropdown
- "Add Member" button (primary action)

**Table Interactions:**
- Search filters members in real-time
- Status filter narrows results
- Edit button (pencil icon) - only for INVITED members
- Row hover effects

**Current Test Data:**
- 6 members with various statuses
- Mix of ACTIVE, INVITED, and SUSPENDED accounts
- Mix of ADMIN and USER roles

**Actions Available:**
- Click "Add Member" button → Add Member modal
- Click edit icon on INVITED row → Edit Invitation modal
- Click search/filter to modify view
- Click back to return to Dashboard
- Click Logout → Login screen

---

## 6. MODAL: Add Member

**Triggered By:** Click "Add Member" button on Members screen

**What You See:**
- Modal window with title "Add Member"
- Email input field (required, with validation)
- Project field (read-only: "Payments Gateway API")
- Role field (read-only: "USER")
- Cancel and "Add Member" buttons

**Form Behavior:**
- Email field validates email format in real-time
- Shows validation error if invalid email
- Shows duplicate error if email already in project
- Loading state while adding (spinner + "Sending…")
- Success state with confirmation message

**Business Logic:**
- Accepts valid email addresses
- Detects duplicate members
- Reuses existing users or creates new ones
- Always assigns role=USER
- Sets status=INVITED
- No invitation emails sent (MVP)

**Actions Available:**
- Enter email → Click "Add Member"
- See success message → Click "Done" to close
- Click "Cancel" to close without adding
- See error → Fix and retry

---

## 7. MODAL: Edit Invitation

**Triggered By:** Click edit (pencil) icon on INVITED member row

**What You See:**
- Modal window with title "Edit Invitation"
- Email input field (editable)
- Status field (read-only: "INVITED")
- Role field (read-only: "USER")
- "Cancel Invitation" button (red, left side)
- "Cancel" and "Save Changes" buttons (bottom right)

**Behavior:**
- Only available for INVITED members
- Disabled if member has already activated account
- Can edit email address
- Loading state while saving (spinner + "Saving…")
- Success state with confirmation message

**Actions Available:**
- Edit email → Click "Save Changes"
- Click "Cancel Invitation" → Confirmation modal
- Click "Cancel" to close without saving

---

## 8. MODAL: Cancel Invitation Confirmation

**Triggered By:** Click "Cancel Invitation" button on Edit modal

**What You See:**
- Confirmation modal with warning icon
- "Cancel invitation" title
- Neutral message asking for confirmation
- Member email shown in message
- Two buttons:
  - "Keep Invitation" (gray, left)
  - "Cancel Invitation" (red, right)

**Behavior:**
- Neutral wording (exact post-cancellation behavior TBD)
- Does not describe all consequences
- Cannot be undone from UI

**Actions Available:**
- Click "Keep Invitation" → Dismiss modal, stay on Edit screen
- Click "Cancel Invitation" → Remove member, close modals

---

## 9. STATE: Access Denied

**Triggered By:** Simulated via "Simulate Access Denied" button on Members screen

**What You See:**
- Large lock icon (red)
- "Access Denied" title
- Explanation message (non-technical)
- "Go back to Dashboard" button

**Triggered When (Business Rules):**
- User lacks required permission
- User cannot access requested project
- User attempts unauthorized operation

**Actions Available:**
- Click "Go back to Dashboard" → Return to project list

---

## 10. MODAL: Session Expired

**Triggered By:** Simulated via "Simulate session expiry" link on Dashboard

**What You See:**
- Full-screen overlay modal (dark semi-transparent)
- Clock icon (amber)
- "Session expired" title
- Message about inactivity
- "Sign in again" button

**Behavior:**
- Non-dismissible (must click button)
- Interrupts all other actions
- Forces re-authentication

**Actions Available:**
- Click "Sign in again" → Return to Login screen

---

## Quick Test Scenarios

### Scenario 1: Happy Path
1. Start at Login
2. Click "Dashboard" demo button
3. Review project cards
4. Click any project card → Project Detail
5. Click "Members" tab
6. Click "Add Member" → Add modal
7. Enter test email → See success
8. Go back → See new member in table
9. Click edit pencil → Edit modal
10. Change email → Save
11. Click Logout → Back to Login

### Scenario 2: No Project Flow
1. Start at Login
2. Click "No Project" demo button
3. See empty state message
4. Click "Refresh" or "Logout"

### Scenario 3: Error States
1. Start at Login
2. Click any error demo button (e.g., "Auth Failed")
3. Review error message
4. Click "Try Again" or "Contact Administrator"
5. Return to Login

### Scenario 4: Member Management
1. Navigate to Members screen
2. Test search by typing member name
3. Test status filter dropdown
4. Click edit on INVITED member
5. Click "Cancel Invitation"
6. Confirm cancellation
7. Verify member removed from table

---

## Business Requirements Coverage

✅ **1. Login** - Google authentication only
✅ **2. Authentication Processing** - Loading state shown
✅ **3. Login Error States** - 8 different error types
✅ **4. No Project Assigned** - Separate empty state
✅ **5. Project List** - Displays user's accessible projects
✅ **6. Project Detail** - Tab navigation prepared
✅ **7. Members View** - Full table with filtering
✅ **8. Add Member** - Form with validation & success states
✅ **9. Edit Invited User** - Email editing for INVITED only
✅ **10. Cancel Invited User** - Confirmation modal
✅ **11. Access Denied** - Reusable error state
✅ **12. Session Expired** - Non-dismissible modal
✅ **13. Logout** - Available from authenticated screens

---

## Neutral Grayscale Design Notes

- Primary colors: Gray-50 through Gray-900 (Tailwind)
- Accent: Brand red (#C41230) for actions and highlights
- Badges: Color-coded by status
  - ACTIVE = Emerald (green)
  - INVITED = Amber (yellow)
  - SUSPENDED/BLOCKED = Gray
- No gradients, glass morphism, or decorative elements
- Simple borders: 1px gray-200
- Clear hierarchy through sizing and weight

---

## Testing Checklist for Stakeholders

- [ ] Login screen is clear and simple
- [ ] Error messages are understandable
- [ ] No Project state is distinct from errors
- [ ] Project cards are informative
- [ ] Members table is usable and organized
- [ ] Add Member flow is straightforward
- [ ] Edit/Cancel actions are appropriate for status
- [ ] Navigation is clear (back buttons, logout)
- [ ] All business rules are followed
- [ ] UI doesn't assume unspecified features

---

**Prototype Ready for Stakeholder Review**
**All major screens and user flows implemented**
**Ready to gather feedback and refine requirements**
