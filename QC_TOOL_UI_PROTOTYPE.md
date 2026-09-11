# QC Tool Authentication & User/Project Membership UI Prototype

## Overview

This is a **functional low-fidelity prototype** for the QC Tool's authentication, user management, and project membership module. The prototype uses neutral grayscale styling and focuses on information architecture, business logic, and user flows rather than visual design.

## Key Principles

- ✓ Low-fidelity, neutral grayscale styling
- ✓ Simple borders, basic spacing, and typography
- ✓ Focus on information architecture and layout
- ✓ All business requirements captured
- ✓ Clickable flows for stakeholder review
- ✓ TBD markers for unspecified functionality

## Implemented Screens & States

### 1. LOGIN SCREEN
**File:** `src/App.tsx` - `SignInScreen`

**Components:**
- QC Tool title/logo placeholder
- Sign in with Google button
- Demo controls for testing different states

**Features:**
- No email/password login
- No registration or forgot password
- Authentication via Google only

### 2. AUTHENTICATION PROCESSING
**File:** `src/App.tsx` - `SigningInScreen`

**Features:**
- Shows loading state with spinner
- Text: "Signing you in…"
- Brief message about what the system is doing
- No separate screens for internal operations

### 3. LOGIN ERROR STATES
**File:** `src/App.tsx` - `SignInErrorScreen`

**Supported Error Types:**
- `google-auth-failed` - Google authentication credentials failed
- `auth-cancelled` - User cancelled the sign-in process
- `email-not-verified` - Google email is not verified
- `user-not-registered` - User not pre-registered by Admin
- `account-linking-conflict` - Multiple QC Tool accounts linked
- `account-unavailable` - Account suspended or unavailable
- `system-role-missing` - Invalid role configuration
- `service-unavailable` - Auth service temporarily down

**Features:**
- Clear error title and message
- Non-technical language
- Context-appropriate action: "Try Again" or "Contact Administrator"
- No backend technical details exposed

**Demo Controls:**
- Click demo buttons on login screen to trigger each error state

### 4. NO PROJECT ASSIGNED STATE
**File:** `src/App.tsx` - `NoProjectScreen`

**Features:**
- User successfully authenticated with valid session
- Clear explanation: account is active but no Project assigned
- Refresh action (allows re-checking for new project assignments)
- Logout action
- No project-specific data displayed

### 5. PROJECT LIST SCREEN
**File:** `src/App.tsx` - `ProjectCard` + `DashboardScreen`

**Features:**
- Displays only projects the user can access
- Each project card shows:
  - Project name
  - Description
  - API count
  - Last run time
  - Health status indicator
- Clickable cards navigate to Project Detail
- Search and status filters (future enhancement)

### 6. PROJECT DETAIL SCREEN
**File:** `src/App.tsx` - `ProjectDetailScreen`

**Navigation Tabs:**
- Overview (basic project info)
- APIs [TBD]
- Environments [TBD]
- Runs [TBD]
- Snapshots [TBD]
- Comparisons [TBD]
- Members (full implementation)

**Features:**
- Clear back navigation to Projects
- Tab-based navigation between modules
- Members tab links to full Members view

### 7. MEMBERS VIEW
**File:** `src/App.tsx` - `MembersScreen`

**Table Columns:**
- User (name + avatar)
- Email
- Role (ADMIN or USER)
- Account Status (ACTIVE, INVITED, INACTIVE, BLOCKED)
- Added date
- Actions (edit/cancel for INVITED status)

**Features:**
- Search by name or email
- Filter by status
- Add Member button
- Edit action only for INVITED members
- Cancel Invitation action only for INVITED members
- Status badges with color indicators

### 8. ADD MEMBER MODAL
**File:** `src/App.tsx` - `AddMemberModal`

**Fields:**
- Google Email (required, with validation)
- Project (read-only - auto-filled)
- Role (read-only - always USER)

**Business Logic:**
- If email doesn't exist: creates new user with System Role=USER, Status=INVITED
- If email exists: reuses existing user, adds to project
- Validates email format
- Detects duplicate members

**UI States:**
- Default
- Validation error
- Loading
- Success
- Duplicate member error
- Permission denied
- Unexpected error

**No invitation emails sent** (MVP behavior)

### 9. EDIT INVITED USER MODAL
**File:** `src/App.tsx` - `EditInvitationModal`

**Features:**
- Only available for INVITED status
- Can edit email address
- Shows current status and role (read-only)
- Disabled for ACTIVE/INACTIVE/BLOCKED accounts
- Cancel Invitation action available

### 10. CANCEL INVITED USER
**File:** `src/App.tsx` - `CancelInvitationConfirmModal`

**Features:**
- Confirmation modal (not invasive warning)
- Neutral wording (exact behavior TBD)
- Removes user from project membership
- Only available for INVITED status
- Cannot be undone from this UI

### 11. ACCESS DENIED STATE
**File:** `src/App.tsx` - `AccessDeniedScreen`

**Triggered When:**
- User lacks required permission
- User cannot access requested project
- User attempts unauthorized operation

**Features:**
- Clear lock icon
- Explanation of why access is denied
- "Go back to Dashboard" action
- No technical details

### 12. SESSION EXPIRED STATE
**File:** `src/App.tsx` - `SessionExpiredModal`

**Features:**
- Modal overlay (non-dismissible except via button)
- Shows session expiration message
- "Sign in again" action
- Returns user to Login screen

### 13. LOGOUT
**File:** `src/App.tsx` - `Header` component

**Features:**
- Logout button in top-right header
- Available on all authenticated screens
- Returns user to Login screen
- Clears session state

## UI Navigation Flow

```
LOGIN SCREEN
    ↓
    ├─→ [Demo: Dashboard with projects]
    │    ↓
    │    PROJECT LIST
    │    ↓
    │    PROJECT DETAIL
    │    ├─ Overview [TBD]
    │    ├─ APIs [TBD]
    │    ├─ Environments [TBD]
    │    ├─ Runs [TBD]
    │    ├─ Snapshots [TBD]
    │    ├─ Comparisons [TBD]
    │    └─ MEMBERS ← Full implementation
    │         ├─→ ADD MEMBER MODAL
    │         ├─→ EDIT INVITED USER MODAL
    │         └─→ CANCEL INVITATION CONFIRM
    │
    ├─→ [Demo: No Project state]
    │    ↓
    │    NO PROJECT ASSIGNED
    │    (Refresh / Logout options)
    │
    └─→ [Various error states]
         ↓
         LOGIN ERROR SCREEN
         (Try Again / Back to Sign In)

LOGOUT from any authenticated screen → LOGIN SCREEN
SESSION EXPIRED modal → LOGIN SCREEN after sign in again
ACCESS DENIED → Back to Dashboard
```

## Technology Stack

- **Framework:** React 19
- **Styling:** Tailwind CSS v4
- **Build:** Vite 8
- **State Management:** React hooks (`useState`)

## Design System Decisions (Low-Fidelity)

- **Colors:** Neutral grayscale (#6B7280, #9CA3AF, #D1D5DB) + brand red (#C41230) for highlights
- **Typography:** Inter 400/500/600 font weights
- **Spacing:** 4px base unit (using Tailwind)
- **Borders:** 1px gray-200 for light mode
- **Badges:** Status badges with color-coded backgrounds (emerald, amber, gray)
- **Icons:** Simple stroke-based icons for clarity
- **No gradients, glass morphism, or decorative illustrations**

## Business Logic Captured

✓ System Role (ADMIN/USER) is separate from Project Access
✓ Valid System Role does NOT auto-grant all Project access
✓ Pre-registration requirement for new users
✓ Google authentication as sole login method
✓ Account Status progression (INVITED → ACTIVE)
✓ Role-based action availability (edit only for INVITED)
✓ Session management (expiry, logout)
✓ Permission boundaries (Access Denied state)
✓ New user creation via member addition
✓ Existing user reuse for duplicate emails

## Demo Controls

The login screen includes demo buttons to navigate directly to:
- Dashboard (with projects)
- No Project state
- Various error states:
  - Google Auth Failed
  - Email Not Verified
  - User Not Registered
  - Account Unavailable
  - Service Down

This allows stakeholders to review all states quickly without manual testing of backend scenarios.

## TBD Areas (Intentionally Unspecified)

- ✗ APIs tab implementation
- ✗ Environments tab implementation
- ✗ Runs tab implementation
- ✗ Snapshots tab implementation
- ✗ Comparisons tab implementation
- ✗ Exact behavior of Cancel Invitation vs. project membership cleanup
- ✗ Invitation email sending (marked as MVP feature not included)
- ✗ Visual design (colors, fonts, design system)
- ✗ Advanced filtering/search
- ✗ Bulk actions

## How to Use This Prototype

1. **Open the app** in the Figma Make preview
2. **Login screen** - Click demo buttons to jump to different states
3. **Navigate** - Click projects, members, tabs, and buttons
4. **Review flows** - Follow the user journeys to validate requirements
5. **Provide feedback** - Confirm or adjust business logic and UI structure
6. **Share link** - Send to stakeholders for async review

## Next Steps

After stakeholder approval:

1. **Refine requirements** - Update business logic based on feedback
2. **Visual design phase** - Apply brand colors, typography, and design system
3. **Implement remaining modules** - Build APIs, Environments, Runs, Snapshots, Comparisons tabs
4. **Add backend integration** - Connect to actual authentication and APIs
5. **Enhance interactions** - Add animations, transitions, and polish
6. **Write tests** - Add unit and integration tests

---

**Status:** Analysis & Design Phase - Low-Fidelity UI Complete
**Last Updated:** 2026-09-08
