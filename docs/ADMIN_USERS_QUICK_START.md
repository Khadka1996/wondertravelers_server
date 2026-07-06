# 🚀 Quick Start - Admin Users Page

## Step 1: Start the Development Server

```bash
cd /home/xettry/Desktop/Subash_thapa/newclient
npm run dev
```

Expected output:
```
> next dev
  ▲ Next.js 14.2.0
  - Local:        http://localhost:3000
```

## Step 2: Access the Admin Users Page

Open your browser and navigate to:
```
http://localhost:3000/admin/users
```

You should see:
- ✅ 3 statistics cards at the top
- ✅ Search bar and filter dropdowns
- ✅ User table with data
- ✅ Pagination controls

---

## 🎯 How to Test Each Feature

### **Test 1: Search Users**
1. Click the search input at the top
2. Type any username or email
3. Table updates in real-time to show matching users
4. Click "Clear All" to reset

**Expected**: Table shows only users matching your search term

---

### **Test 2: Filter by Role**
1. Click "All Roles" dropdown
2. Select "Admin"
3. Table shows only admin users
4. Try other roles: "Moderator", "User"

**Expected**: Table filters by selected role

---

### **Test 3: Filter by Status**
1. Click "All Status" dropdown
2. Select "Active"
3. Table shows only active users
4. Select "Locked" to see locked accounts

**Expected**: Table filters by status correctly

---

### **Test 4: Pagination**
1. Scroll to the bottom of the page
2. You'll see "Showing X to Y of Z results"
3. Click different page numbers
4. Change "Items per page" from 10 to 20, 50, or 100

**Expected**: 
- Page content changes when clicking page numbers
- Different number of rows shown based on per-page selection

---

### **Test 5: View User Details**
1. Find any user in the table
2. Click "..." (more menu) at the end of the row
3. Select "View Details"
4. A modal pops up showing user info

**Modal should have 3 tabs:**
- **Profile**: Personal information (name, email, phone, role, status, etc.)
- **Login History**: All login attempts with timestamps and IPs
- **Audit Trail**: Complete history of admin actions on this user

**Expected**: Modal loads without errors, tabs show data

---

### **Test 6: Change User Role**
1. Click "..." menu on any user row
2. Select "Change Role"
3. Modal appears showing current role
4. Select a new role from the dropdown (e.g., change User → Admin)
5. Click "Save"

**Expected**:
- Modal shows the role change
- Success message appears
- Table refreshes and shows new role with badge update
- Action appears in Audit Trail

---

### **Test 7: Lock/Unlock User**
1. Click "..." menu on a user
2. Select "Lock User"
3. Modal appears asking to confirm
4. Optionally add a reason (e.g., "Suspicious activity")
5. Click "Lock"

**Expected**:
- User status changes to "Locked" (red badge)
- Success notification appears
- Table updates immediately

**To unlock**: Repeat steps but select "Unlock User" instead

---

### **Test 8: Force Logout User**
1. Click "..." menu on a user
2. Select "Force Logout"
3. Modal appears with option "Clear all trusted devices"
4. Check/uncheck the option
5. Click "Logout"

**Expected**:
- Success notification appears
- User is logged out from all sessions
- If you checked "Clear devices", user must verify on next login

---

### **Test 9: Delete User**
1. Click "..." menu on a user
2. Select "Delete User"
3. A red modal appears with warning
4. Modal asks to type "delete {username}" to confirm
5. Type exact confirmation text
6. "Delete" button becomes enabled
7. Click "Delete"

**Expected**:
- User disappears from table after deletion
- Success notification: "User deleted successfully"
- Cannot delete users without typing exact confirmation

---

### **Test 10: Combined Filters**
1. Search for a username
2. Filter by role "Admin"
3. Filter by status "Active"
4. Change pagination to page 2, 20 items per page

**Expected**: All filters work together, showing results that match ALL criteria

---

## 🔍 Verify Everything Works

### **In Browser Console (F12 → Console)**
- Should show NO errors
- May show some Next.js debug info (normal)

### **In Network Tab (F12 → Network)**
- When page loads, should see:
  - `GET /api/admin/users/all` - Main user list
  - Other API calls when you open modals or perform actions

### **Status Bar**
- No red error alerts
- Success messages appear when actions complete

---

## ✅ Success Indicators

After completing all tests, you should have:

✅ Users displaying in table  
✅ Search working in real-time  
✅ Filters working correctly  
✅ Pagination navigating between pages  
✅ "View Details" modal opening with 3 tabs  
✅ "Change Role" changing user role successfully  
✅ "Lock User" toggling user status  
✅ "Force Logout" logging out user  
✅ "Delete User" removing user with confirmation  
✅ Table auto-refreshing after each action  
✅ No errors in browser console  

If all these pass, **your admin users management system is fully functional!** 🎉

---

## 🐛 Troubleshooting

### **Issue: Page shows "Loading..." forever**
- Check if backend server is running (http://localhost:5000)
- Check browser console (F12) for errors
- Check if you're logged in as admin

### **Issue: Search/filters not working**
- Refresh the page (Ctrl+R)
- Check if backend API is responding
- Clear browser cache and try again

### **Issue: Modal doesn't open**
- Check browser console for JavaScript errors
- Refresh and try another user
- Try closing browser tab and reopening

### **Issue: Action fails with error message**
- Note the error message
- Check backend logs
- Ensure user role permits the action

### **Issue: Table doesn't show users**
- Backend might not have user data
- Check if backend database has users
- Verify authentication (are you logged in as admin?)

---

## 📝 Quick Reference

| Feature | Action | Result |
|---------|--------|--------|
| Search | Type in search box | Filters users by name/email/username |
| Filter Role | Select from role dropdown | Shows only that role |
| Filter Status | Select from status dropdown | Shows only active/locked users |
| View Details | Click "View Details" in menu | Opens modal with 3 tabs of info |
| Change Role | Select "Change Role" → pick role → save | Updates user role in system |
| Lock User | Select "Lock User" → confirm | Prevents user from logging in |
| Force Logout | Select "Force Logout" → confirm | Ends all user sessions |
| Delete User | Select "Delete User" → type confirmation | Permanently removes user |
| Page Nav | Click page numbers | Jump to different page |
| Items/Page | Select 10/20/50/100 | Change rows shown per page |

---

## 🎓 What's Happening Behind the Scenes

1. **Page Loads**
   - `/src/app/admin/users/page.tsx` initializes
   - `loadUsers()` called via `useEffect`
   - API request to `GET /api/admin/users/all`
   - State updates with user data
   - Components re-render with data

2. **User searches**
   - `handleSearchChange()` captures input
   - Debounced to avoid too many API calls
   - `loadUsers()` called with new filters
   - API request includes search parameter
   - Table updates with results

3. **User clicks action menu**
   - `handleAction()` is called
   - Appropriate modal state is set to `true`
   - Modal component renders (triggered by state)
   - Modal fetches additional data if needed

4. **User confirms action (e.g., lock)**
   - `adminService.toggleUserLock()` called
   - Makes POST request to `/api/admin/users/:userId/lock`
   - Backend updates database
   - Success notification shown
   - `loadUsers()` refreshes table
   - Modal closes
   - Table shows updated user status

This workflow ensures:
- ✅ Real-time feedback to user
- ✅ Data always in sync between frontend and backend
- ✅ Strong error handling
- ✅ No stale data in display

---

## 🚀 You're Ready!

Everything is set up and ready to use. Start the dev server and test it out!

Any questions? Check the component code in `/newclient/src/components/admin/` for detailed implementations.

Happy managing users! 🎉
