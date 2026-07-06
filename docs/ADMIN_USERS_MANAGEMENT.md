# Admin Users Management - Setup Guide

## Prerequisites
Before accessing the admin users page, you need to:

### 1. **Login as Admin**
Navigate to the login page and use the admin credentials:

- **Email:** `admin@wondertravelers.dev`
- **Password:** `Admin@123456`

Visit: `http://localhost:3000/auth/login`

### 2. **Access Admin Panel**
Once logged in as admin, you can access:
- Dashboard: `http://localhost:3000/admin/dashboard`
- Users: `http://localhost:3000/admin/users` ✅

## Admin Users Features

### 📋 User Table Columns
- **S.No** - Serial number (auto-calculated based on pagination)
- **User Info** - User avatar, full name, and username
- **Email** - User's email address
- **Role** - User role (Admin, Moderator, User)
- **Status** - Active or Inactive
- **Joined** - Account creation date
- **Last Login** - Last login timestamp
- **Actions** - Manage user (view info, edit role, delete)

### 🔧 Available Actions

#### 1. **View User Details** (Purple Info Button 🔵)
Click the info button to see:
- Complete user profile
- Contact information
- Email & phone verification status
- 2FA settings
- Trusted devices count
- Account creation date
- Last login information
- User ID

#### 2. **Edit User Role** (Blue Edit Role Button 🔵)
- Change role: Admin → Moderator → User
- Select new role from dropdown
- Click "Save" to apply
- Takes effect immediately

#### 3. **Delete User** (Red Delete Button 🔴)
- Permanently delete user account
- Requires confirmation
- Cannot be undone!

### 📊 Dashboard Stats
At the top of the page:
- **Total Users** - Count of all users
- **Admins** - Count of admin users
- **Moderators** - Count of moderator users
- **Active Users** - Count of active accounts

### 🔍 Filters & Search
- **Search** - Search by username, email, or full name
- **Role Filter** - Filter by user role (All, Admin, Moderator, User)
- **Status Filter** - Filter by account status (All, Active, Inactive)

### 📄 Pagination
- Pages and items per page shown at bottom
- Navigate between pages with Previous/Next buttons
- 10 users displayed per page

---

## Troubleshooting

### Error: "Failed to fetch users"
**Causes:**
1. ❌ Not logged in - You need to login first
2. ❌ Not an admin - Only admins can access this page
3. ❌ Session expired - Login again
4. ❌ Backend not running - Make sure `npm run dev` is running on port 5000

**Solution:**
- Verify you're logged in as admin
- Check browser console for specific error message
- Ensure both frontend (3000) and backend (5000) are running

### Error: "HTTP 401: Unauthorized"
- Your session has expired
- Login again with admin credentials

### Error: "HTTP 403: Forbidden"
- You don't have admin privileges
- Only admin users can access this page
- Login as: `admin@wondertravelers.dev` / `Admin@123456`

---

## Database Seeding

Pre-seeded test users available:

| Email | Password | Role | Status |
|-------|----------|------|--------|
| admin@wondertravelers.dev | Admin@123456 | Admin | Active |
| moderator@wondertravelers.dev | Mod@123456 | Moderator | Active |
| test1@wondertravelers.dev | Test@123456 | User | Active |
| test2@wondertravelers.dev | Test@123456 | User | Active |
| test3@wondertravelers.dev | Test@123456 | User | Active |

**To seed more users:**
```bash
cd server
node scripts/seed-users.js
```

---

## API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/users/all` | Fetch paginated user list |
| GET | `/api/admin/users/:id/details` | Get complete user details |
| POST | `/api/admin/users/:id/change-role` | Update user role |
| DELETE | `/api/admin/users/:id` | Delete user account |

All endpoints require:
- ✅ Valid access token (in cookie)
- ✅ Admin role

---

## Need Help?

Check the browser console (F12) for detailed error messages when API calls fail.
