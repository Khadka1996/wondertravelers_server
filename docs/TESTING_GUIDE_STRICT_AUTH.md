# 🧪 ULTRA-STRICT AUTHENTICATION TESTING GUIDE

## 📋 BEFORE YOU START

### Prerequisites

1. **Backend is running** - API server at `http://localhost:5000`
2. **Frontend dev server ready** - Will run on `http://localhost:3000`
3. **Test accounts created** in your database:
   - Admin user: `admin@example.com` / `AdminPassword123`
   - Moderator user: `moderator@example.com` / `ModPassword123`
   - Regular user: `user@example.com` / `UserPassword123`

### Test Commands

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
cd client
npm run dev
```

Then open: `http://localhost:3000`

---

## 🎯 TEST SUITE 1: MIDDLEWARE TOKEN VALIDATION

### Test 1.1: Direct URL Access WITHOUT Token

**Goal**: Middleware should redirect to login immediately

**Steps**:
1. Open fresh browser (clear cookies)
2. Open DevTools → Storage → Cookies → Delete all
3. Navigate directly to `http://localhost:3000/admin/dashboard`

**Expected Result**:
```
❌ MIDDLEWARE BLOCKS ACCESS
✅ URL changes to: http://localhost:3000/auth/login?redirect=/admin/dashboard
✅ Login page displays
✅ Shows message: "You need to log in to access that page"
✅ After login as admin → redirects back to /admin/dashboard
```

**Verification Code**:
```javascript
// Open DevTools Console
console.log(document.location.href);
// Should output: http://localhost:3000/auth/login?redirect=/admin/dashboard
```

---

### Test 1.2: Direct URL Access WITH Valid Token

**Goal**: Middleware should allow, then ProtectedRoute verifies role

**Steps**:
1. Login as admin user successfully
2. Go to `/admin/dashboard`
3. Admin dashboard displays
4. Open DevTools → Storage → Cookies
5. Copy the `accessToken` cookie value
6. Refresh page (F5)

**Expected Result**:
```
✅ Middleware checks token exists
✅ ProtectedRoute checks hasValidToken = true
✅ ProtectedRoute checks role = "admin"
✅ AdminDashboard renders immediately
✅ No "Access Denied" message
```

**Verification Code**:
```javascript
// In login flow
localStorage.setItem('test_step', 'logged_in');
// After dashboard loads
console.log(localStorage.getItem('test_step')); // Still "logged_in"
```

---

## 🎯 TEST SUITE 2: PROTECTED ROUTE ROLE VALIDATION

### Test 2.1: Admin User Accessing Admin Dashboard

**Goal**: Verify admin role grants access

**Steps**:
1. Clear all cookies
2. Navigate to login page
3. Login with admin credentials: `admin@example.com` / `AdminPassword123`
4. Click "Admin Dashboard" button (or navigate to `/admin/dashboard`)

**Expected Result**:
```
✅ Login successful
✅ Dashboard fully loads
✅ Shows admin-specific content (stats, admin tools, etc.)
✅ No "Access Denied" message
✅ Page title shows "Admin Dashboard"
✅ Can interact with admin features
```

**Verification Code**:
```javascript
// In DevTools Console
document.querySelector('h1').textContent;
// Should output: "Admin Dashboard" or similar
```

---

### Test 2.2: Moderator User Accessing Moderator Dashboard

**Goal**: Verify moderator role grants access

**Steps**:
1. Clear all cookies
2. Navigate to login page
3. Login with moderator credentials: `moderator@example.com` / `ModPassword123`
4. Click "Moderator Dashboard" button (or navigate to `/moderator/dashboard`)

**Expected Result**:
```
✅ Login successful
✅ Dashboard fully loads
✅ Shows moderator-specific content (blog moderation, etc.)
✅ No "Access Denied" message
✅ Page title shows "Moderator Dashboard"
✅ Can interact with moderator features
```

**Verification Code**:
```javascript
// In DevTools Console
document.body.innerText.includes('Moderator');
// Should return: true
```

---

### Test 2.3: Regular User Trying to Access Admin Dashboard

**Goal**: Access should be DENIED immediately

**Steps**:
1. Clear all cookies
2. Login with regular user: `user@example.com` / `UserPassword123`
3. Try to navigate to `/admin/dashboard` directly:
   - Type URL in address bar
   - Or manually navigate if there's a sidebar link

**Expected Result**:
```
❌ PROTECTED ROUTE BLOCKS ACCESS
✅ See message: "Access Denied - You don't have permission"
✅ Red alert box appears
✅ After 2 seconds: redirects to /login
✅ User is returned to login page
```

**Verification Code**:
```javascript
// Immediately after trying to access /admin/dashboard (before 2s redirect)
document.querySelector('[role="alert"]')?.textContent;
// Should output: something like "Access Denied"
```

---

### Test 2.4: Regular User Trying to Access Moderator Dashboard

**Goal**: Access should be DENIED immediately

**Steps**:
1. Make sure you're logged in as regular user
2. Try to navigate to `/moderator/dashboard` directly

**Expected Result**:
```
❌ PROTECTED ROUTE BLOCKS ACCESS
✅ See message: "Access Denied - You don't have permission"
✅ Red alert box appears
✅ After 2 seconds: redirects to /login
```

---

## 🎯 TEST SUITE 3: TOKEN VALIDATION FLAG

### Test 3.1: hasValidToken Flag Management

**Goal**: Verify token validity flag is set/cleared correctly

**Steps**:
1. Add test code to browser console
2. Login as admin
3. Check token flag after login

**Test Code**:
```javascript
// After login (in DevTools Console)
// Note: You may need to access context if it's global

// Step 1: Token should be valid after login
// Step 2: After logout, token should be invalid

// Check token cookie
document.cookie.includes('accessToken');
// Should return: true (after login)

// Logout
document.querySelector('[aria-label="Logout"]')?.click();
// or find logout button

// Check again
document.cookie.includes('accessToken');
// Should return: false (after logout)
```

**Expected Result**:
```
✅ After login → hasValidToken = true
✅ Token cookie present in Storage
✅ After logout → hasValidToken = false
✅ Token cookie removed from Storage
✅ Accessing protected route redirects to login
```

---

## 🎯 TEST SUITE 4: TOKEN EXPIRATION HANDLING

### Test 4.1: Expired Token Behavior

**Goal**: Verify system handles expired tokens correctly

**Steps**:

**Option A: Wait for natural expiration** (if token TTL is short)
1. Login successfully
2. Wait for token expiration time (check your backend TTL)
3. Try to navigate to protected route

**Option B: Simulate expiration** (recommended for testing)
1. Login successfully
2. Open DevTools → Application → Cookies
3. Find `accessToken` cookie
4. Edit the value to something invalid: `invalid_token_12345`
5. Try to navigate to `/admin/dashboard`

**Expected Result**:
```
❌ TOKEN INVALID
✅ ProtectedRoute detects invalid token
✅ hasValidToken = false
✅ Redirects to /login?redirect=/admin/dashboard
✅ Shows message: "Your session has expired"
✅ Can login again
```

---

## 🎯 TEST SUITE 5: REDIRECT AFTER LOGIN

### Test 5.1: Redirect to Original Route

**Goal**: After login from protected route, redirect back

**Steps**:
1. Clear cookies
2. Navigate to `/admin/dashboard`
3. Middleware redirects to `/auth/login?redirect=/admin/dashboard`
4. Login as admin
5. Should redirect back to `/admin/dashboard`

**Expected Result**:
```
✅ URL starts as: /admin/dashboard
✅ Redirected to: /auth/login?redirect=/admin/dashboard
✅ Login entered
✅ After login: redirects to /admin/dashboard
✅ Dashboard displays successfully
```

**Verification Code**:
```javascript
// On login page, check URL
new URLSearchParams(window.location.search).get('redirect');
// Should output: /admin/dashboard
```

---

### Test 5.2: Redirect to Default Route (No Redirect Param)

**Goal**: Normal login should redirect to appropriate dashboard

**Steps**:
1. Clear cookies
2. Go directly to login: `http://localhost:3000/auth/login`
3. Login as admin
4. Should redirect to admin dashboard or home

**Expected Result**:
```
✅ No ?redirect= parameter
✅ After login → redirects to home or appropriate dashboard
✅ NOT stuck on login page
✅ Session established correctly
```

---

## 🎯 TEST SUITE 6: PROFILE ROUTE ACCESS

### Test 6.1: Any User Can Access Profile

**Goal**: Profile route should allow any authenticated user

**Steps**:
1. Login as regular user
2. Navigate to `/profile`
3. Should display profile page
4. Logout
5. Try to access `/profile` directly

**Expected Result**:
```
✅ Authenticated user → /profile loads
✅ Shows user profile information
✅ Logged out user → redirects to /login
```

---

## 🎯 TEST SUITE 7: SESSION PERSISTENCE

### Test 7.1: Page Refresh Maintains Session

**Goal**: After login, refreshing page should keep session

**Steps**:
1. Login as admin
2. Go to `/admin/dashboard`
3. Press F5 (refresh page)
4. Dashboard should reload successfully

**Expected Result**:
```
✅ After login → session active
✅ Page refresh → session maintained
✅ Token cookie still present
✅ Dashboard reloads without login prompt
✅ No flashing/redirect to login
```

**Verification Code**:
```javascript
// After refresh
document.title;
// Should contain: "Admin Dashboard" (or not show login)
```

---

### Test 7.2: New Tab Uses Same Session

**Goal**: Multiple tabs should share auth session

**Steps**:
1. Login as admin in Tab 1
2. Go to `/admin/dashboard` in Tab 1
3. Open new tab
4. Navigate to `/admin/dashboard` in Tab 2
5. Dashboard should load immediately

**Expected Result**:
```
✅ Login in Tab 1 → session established
✅ Tab 2 accesses same cookie
✅ Tab 2 dashboard loads (no login required)
✅ Both tabs show same user data
```

---

## 🎯 TEST SUITE 8: LOGOUT FUNCTIONALITY

### Test 8.1: Logout Clears Session

**Goal**: Logout should clear all auth data

**Steps**:
1. Login as admin
2. Go to `/admin/dashboard`
3. Click logout button
4. Try to access `/admin/dashboard` again

**Expected Result**:
```
✅ Logout successful
✅ Token cookie deleted
✅ User data cleared
✅ hasValidToken = false
✅ Attempting to access /admin/dashboard → redirected to /login
✅ Cannot access protected route without logging in again
```

**Verification Code**:
```javascript
// After logout
document.cookie;
// Should NOT contain: accessToken token value

// Try to access protected route
window.location.href = '/admin/dashboard';
// Should redirect to /auth/login
```

---

### Test 8.2: Logout in One Tab Affects Other Tabs

**Goal**: Session should sync across browser tabs

**Steps**:
1. Login as admin in Tab 1
2. Go to `/admin/dashboard` in Tab 1
3. Open `/admin/dashboard` in Tab 2 (works)
4. Click logout in Tab 1
5. Try to do action in Tab 2

**Expected Result**:
```
✅ Logout in Tab 1
✅ Token cookie deleted from browser
✅ Tab 2 no longer has cookie
✅ Next API call in Tab 2 → 401 Unauthorized
✅ Tab 2 detects auth failure → redirects to login
```

---

## 🎯 TEST SUITE 9: BACKEND API VALIDATION

### Test 9.1: Token Validation on API Call

**Goal**: Backend should validate token on every API call

**Steps**:
1. Login as admin
2. Open DevTools → Network tab
3. Navigate to `/admin/dashboard`
4. Watch network requests
5. Look for API call (e.g., `GET /api/admin/stats`)

**Expected Result**:
```
✅ Request includes Authorization header (or cookie)
✅ Backend respects token
✅ Response code: 200 OK
✅ Response includes user data
```

**Verification Code**:
```javascript
// In Network tab, click on API call
// Headers section should show:
// Cookie: accessToken=<valid_token>
// OR
// Authorization: Bearer <valid_token>
```

---

### Test 9.2: Role Verification on API Call

**Goal**: Backend should verify role matches route

**Steps**:
1. Simulate role mismatch:
   - Either: Create test user with wrong role in database
   - Or: Modify token to have wrong role (if possible)
2. Try to call admin API
3. Check response

**Expected Result**:
```
❌ API CALL FAILS
✅ Response code: 403 Forbidden
✅ Message: "Insufficient permissions" or "Admin role required"
✅ Frontend sees 403 → redirects to login
```

---

## 🎯 TEST SUITE 10: ERROR STATES

### Test 10.1: Invalid Credentials

**Goal**: Login with wrong password should fail

**Steps**:
1. Go to login page
2. Enter username: `admin@example.com`
3. Enter wrong password: `WrongPassword123`
4. Click login

**Expected Result**:
```
❌ LOGIN FAILS
✅ Shows error message: "Invalid credentials"
✅ No token cookie created
✅ hasValidToken = false
✅ Page stays on login (no redirect)
✅ Can try again
```

---

### Test 10.2: Network Error During Login

**Goal**: Network errors should be handled

**Steps**:
1. Turn off network (DevTools → Network → Offline)
2. Try to login
3. Turn network back on

**Expected Result**:
```
❌ LOGIN FAILS
✅ Shows error message: "Network error" or similar
✅ No token set
✅ Can retry when network returns
```

---

### Test 10.3: 500 Server Error

**Goal**: Server errors during auth should be handled

**Steps**:
1. Stop backend server
2. Try to login
3. Start backend again
4. Try to login again

**Expected Result**:
```
❌ LOGIN FAILS
✅ Shows error message: "Server error"
✅ No token set
✅ Can retry when server returns
```

---

## ✅ FINAL VERIFICATION CHECKLIST

- [ ] **Middleware**: Direct access without token redirects to `/login`
- [ ] **Authentication**: Login works for admin, moderator, user
- [ ] **Token Flag**: `hasValidToken` set on successful login
- [ ] **Admin Access**: Admin can access `/admin/dashboard`
- [ ] **Moderator Access**: Moderator can access `/moderator/dashboard`
- [ ] **Role Denial**: User cannot access admin/moderator dashboards
- [ ] **Profile Access**: Any authenticated user can access `/profile`
- [ ] **Redirect**: After login from protected route, redirects back
- [ ] **Refresh**: Page refresh maintains session
- [ ] **Expiration**: Expired token triggers redirect to login
- [ ] **Logout**: Logout clears session and prevents re-access
- [ ] **Error Handling**: Login errors displayed correctly
- [ ] **API Validation**: Backend validates on every API call
- [ ] **Cookies**: Tokens stored in HTTP-only cookies
- [ ] **No Bypass**: No way to access protected routes without auth

---

## 🐛 DEBUGGING TIPS

### Check Token in Browser

```javascript
// DevTools Console
// Check if token exists
document.cookie;

// Check if present
document.cookie.includes('accessToken');

// If using other cookie name:
document.cookie.includes('token');
```

### Check Auth State

```javascript
// If context is window-exposed (for testing):
window.__auth_context;

// Check hasValidToken
console.log(window.__auth_context?.hasValidToken);

// Check user
console.log(window.__auth_context?.user);
```

### Network Debugging

1. Open DevTools → Network tab
2. Filter by API calls
3. Click on auth-related requests:
   - `/api/auth/login`
   - `/api/auth/me`
   - `/api/admin/*`
4. Check:
   - Status code
   - Request headers
   - Response body

### Middleware Debugging

1. Check browser console for redirect logs
2. Check URL bar for redirects
3. If stuck: Check browser console for errors
4. Check `src/middleware.ts` logic

---

## 📊 EXPECTED RESULTS SUMMARY

| Test | Expected | Status |
|------|----------|--------|
| No token → dashboard | Redirect to login | [  ] |
| Valid token + admin → admin dashboard | Loads | [  ] |
| Valid token + user → admin dashboard | Access Denied + redirect | [  ] |
| Expired token → protected route | Redirect to login | [  ] |
| Logout → protected route | Redirect to login | [  ] |
| Page refresh with token | Session maintained | [  ] |
| Role mismatch on API | 403 Forbidden | [  ] |
| Invalid credentials | Login fails | [  ] |

---

**Once all tests pass**: Ultra-strict authentication is successfully implemented! 🎉
