# QC Tool UI Prototype - Quick Start Guide

## 🚀 Get Started in 30 Seconds

### 1. Open the App
Access one of these URLs:
- **Local:** http://localhost:8443
- **LAN:** http://192.168.0.222:8443

### 2. Click Demo Buttons
From the Login screen, choose:
- **Dashboard** → See project list with members management
- **No Project** → Test empty state flow
- **Auth Failed** → See error handling
- **[Other errors]** → Test different error types

### 3. Navigate & Test
- Click project cards → Project detail screen
- Click "Members" tab → Member management
- Click "Add Member" → Test the form
- Edit/cancel members → Test status management
- Click Logout → Back to login

---

## 📋 What to Look For

### Data Structure ✅
- [ ] Users have System Roles (ADMIN/USER)
- [ ] Projects are separate from System Roles
- [ ] Members have Account Status (ACTIVE/INVITED/SUSPENDED/BLOCKED)
- [ ] Members can be filtered by status

### Workflows ✅
- [ ] Adding new members works
- [ ] Editing invited members works
- [ ] Cancelling invitations works
- [ ] Logout/session handling works
- [ ] Error states are clear

### Navigation ✅
- [ ] Project cards navigate to details
- [ ] Members tab appears in project
- [ ] Back buttons work throughout
- [ ] Logout returns to login
- [ ] All screens are reachable

### UI Structure ✅
- [ ] Low-fidelity, neutral styling
- [ ] No decorative elements
- [ ] Clear labels and instructions
- [ ] Status badges use color appropriately
- [ ] Forms have clear validation

---

## 🎯 Key Screens to Review

### 1. Login
- Google sign-in only
- Demo control buttons
- Clear, simple layout

### 2. Dashboard
- Project cards with key info
- Member management link in sidebar
- Quick stats at top

### 3. Members
- Table with search/filter
- Add member button
- Edit/cancel actions

### 4. Add Member Form
- Email validation
- Duplicate detection
- Success confirmation

### 5. Error States
- 8 different error types
- User-friendly messages
- Clear next actions

---

## ❓ Questions to Answer

### Business Requirements
- [ ] Does System Role vs Project Access make sense?
- [ ] Are the member statuses and transitions correct?
- [ ] Should invited users auto-create or only existing users?
- [ ] Is the cancellation behavior clear enough?

### UX Clarity
- [ ] Are form labels clear?
- [ ] Do error messages help users?
- [ ] Is the navigation intuitive?
- [ ] Are all actions discoverable?

### Completeness
- [ ] Are all 13 requirements represented?
- [ ] Are any scenarios missing?
- [ ] Are edge cases handled?
- [ ] Is the workflow complete?

---

## 🔧 Test Scenarios

### Happy Path (5 min)
1. Click "Dashboard" → See projects
2. Click a project → Project detail
3. Click "Members" tab → Member table
4. Click "Add Member" → Success
5. See member in table

### Error Path (5 min)
1. Try each error button
2. Read error messages
3. Click recovery actions
4. Return to login

### Member Mgmt (10 min)
1. Search members
2. Filter by status
3. Edit an invited member
4. Cancel an invitation
5. See changes in table

---

## 💡 Design Notes

- **Colors:** Grayscale + red (#C41230) accent only
- **No gradients, shadows, or decorations** (intentional low-fidelity)
- **Clear hierarchy** through size and weight
- **Badges use color** for status clarity (green/yellow/gray)
- **Forms have validation** feedback
- **Modals are modal** (non-dismissible when needed)

---

## 📞 Feedback Template

When reviewing, note:

**What's Working:**
- [ ] Business logic clarity
- [ ] Navigation intuitiveness
- [ ] Data model appropriateness
- [ ] Error handling

**What Needs Clarity:**
- [ ] Unclear requirements
- [ ] Missing scenarios
- [ ] Confusing labels
- [ ] Workflow gaps

**Suggestions:**
- [ ] Feature requests
- [ ] Workflow improvements
- [ ] Label changes
- [ ] Behavioral questions

---

## 🎬 Demo Script (2 minutes)

If showing to others:

1. **Open login** - Show sign-in options
2. **Click "Dashboard"** - Explain project cards
3. **Click a project** - Show navigation tabs
4. **Click Members** - Show member table
5. **Click Add Member** - Demo the form
6. **Show error state** - Click error button
7. **Logout** - Return to login

---

## ✅ Ready When You See

- [ ] Login screen with demo buttons
- [ ] Dashboard with projects
- [ ] Members table with data
- [ ] Working modals and forms
- [ ] Error states for each type
- [ ] Back/logout navigation

---

## 📚 Detailed Docs

For more information, see:
- **QC_TOOL_UI_PROTOTYPE.md** - Complete specification
- **UI_FLOW_REFERENCE.md** - Detailed walkthrough
- **PROTOTYPE_SUMMARY.md** - Executive summary

---

**Ready to review!**
Start with demo buttons, then navigate through screens.
Time: ~30 minutes for complete walkthrough.
