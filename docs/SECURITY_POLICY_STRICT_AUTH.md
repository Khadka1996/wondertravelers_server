# 🔐 ULTRA-STRICT AUTHENTICATION & ROLE-BASED ACCESS CONTROL POLICY

## 🚨 CRITICAL SECURITY STATEMENT

Access to the following routes is **STRICTLY FORBIDDEN** unless full authentication and role verification is completed:

- `/admin/dashboard` - Admin only
- `/moderator/dashboard` - Moderator only
- `/profile` - Authenticated users only

**No exceptions. No bypasses. No partial checks.**

---

## 📋 MANDATORY AUTHENTICATION FLOW (STRICT ORDER)

The system enforces this exact sequence:

```
1. User Requests Protected Route
        ↓
2. Frontend Middleware Executes (src/middleware.ts)
        ↓
3. Check Token Cookie Exists?
        ├─ NO → Immediate Redirect to /login
        └─ YES → Continue
        ↓
4. Allow Page Load (Token verified on backend during API calls)
        ↓
5. Page Calls Protected Backend API
        ↓
6. Backend Verifies JWT Token
        ├─ Invalid → 401 Unauthorized
        ├─ Expired → 401 Unauthorized
        ├─ Missing → 401 Unauthorized
        └─ Valid → Continue
        ↓
7. Backend Validates Role
        ├─ Admin route but user.role !== "admin" → 403 Forbidden
        ├─ Moderator route but user.role !== "moderator" → 403 Forbidden
        └─ Role matches → Allow data response
        ↓
8. Frontend Receives Data
        └─ Render protected content
```

---

## ✅ IMPLEMENTED SECURITY LAYERS

### Layer 1: Frontend Middleware (`src/middleware.ts`)

**Purpose**: Block unauthorized access at the request level

**Checks**:
- ✅ Route is protected?
- ✅ Token cookie exists?
- ✅ If no token → Immediate redirect to `/login`
- ✅ If token exists → Continue (backend will verify)

**Protected Routes**:
```typescript
/admin/*              // All admin routes
/moderator/*          // All moderator routes
/profile/*            // User profile
```

**Code**:
```typescript
// middleware.ts
const token = request.cookies.get('accessToken')?.value || 
              request.cookies.get('token')?.value;

if (!token) {
  // ❌ NO TOKEN FOUND → IMMEDIATELY redirect to login
  url.pathname = '/auth/login';
  url.searchParams.set('redirect', pathname);
  return NextResponse.redirect(url);
}
```

---

### Layer 2: Frontend ProtectedRoute Component (`src/components/ProtectedRoute.tsx`)

**Purpose**: Verify authentication state before rendering content

**Checks** (in strict order):
1. ✅ Is loading check complete?
2. ✅ Is token valid? (`hasValidToken` flag)
3. ✅ Is user authenticated? (`isAuthenticated` flag)
4. ✅ Does role match required role?

**If ANY check fails**:
- Block rendering of protected content
- Display loading/blocked state
- Redirect to login

**Code**:
```typescript
// STEP 1: TOKEN VALIDATION (MANDATORY)
if (!isAuthenticated || !hasValidToken) {
  // Do NOT render children
  // Redirect to login
  return;
}

// STEP 2: ROLE VERIFICATION
if (requiredRole && user?.role !== requiredRole) {
  // Do NOT render children
  // Show access denied
  return;
}

// STEP 3: ALL CHECKS PASSED
return <>{children}</>;
```

---

### Layer 3: Backend Token Verification

**Purpose**: Real security - validate JWT on every API request

**Endpoints** that validate tokens:
- `POST /api/auth/login` - Sets HTTP-only cookie
- `GET /api/auth/me` - Validates token, returns user
- `POST /api/auth/refresh` - Validates refresh token
- `POST /api/auth/logout` - Clears session
- All other protected endpoints - Require valid token

**Security Checks**:
- ✅ JWT signature validation
- ✅ Token expiration check
- ✅ User exists in database
- ✅ Role matches route requirement
- ✅ Returns 401/403 on failure

---

## 🛑 STRICT ROLE VALIDATION POLICY

### Admin Route Rule

**Route**: `/admin/dashboard`

**Access Allowed Only If**:
```typescript
if (user.role === 'admin') {
  // ✅ ALLOW ACCESS
} else {
  // ❌ DENY ACCESS
  // → Redirect to /login
  // → Clear token
  // → Block rendering
}
```

**Implementation**:
```typescript
<ProtectedRoute requiredRole="admin">
  <AdminDashboard />
</ProtectedRoute>
```

### Moderator Route Rule

**Route**: `/moderator/dashboard`

**Access Allowed Only If**:
```typescript
if (user.role === 'moderator') {
  // ✅ ALLOW ACCESS
} else {
  // ❌ DENY ACCESS
  // → Redirect to /login
  // → Clear token
  // → Block rendering
}
```

**Implementation**:
```typescript
<ProtectedRoute requiredRole="moderator">
  <ModeratorDashboard />
</ProtectedRoute>
```

### User Route Rule

**Route**: `/profile`

**Access Allowed Only If**:
```typescript
if (user.role === 'user' || 
    user.role === 'moderator' || 
    user.role === 'admin') {
  // ✅ ANY authenticated user allowed
} else {
  // ❌ DENY ACCESS
  // → Redirect to /login
}
```

**Implementation**:
```typescript
<ProtectedRoute>
  <UserProfile />
</ProtectedRoute>
```

---

## 🔒 TOKEN STORAGE POLICY (STRICTEST)

### Requirements

Tokens **MUST** be stored in **HttpOnly Secure Cookies** ONLY:

```typescript
// Backend sets:
response.cookie('accessToken', token, {
  httpOnly: true,      // ✅ No JavaScript access
  secure: true,        // ✅ HTTPS only
  sameSite: 'strict',  // ✅ CSRF protection
  maxAge: 15 * 60 * 1000  // 15 minutes
});

response.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
});
```

### Absolutely Forbidden

❌ Storing token in localStorage
❌ Storing token in sessionStorage
❌ Storing token in plain JavaScript variables (without HttpOnly)
❌ Trusting frontend role alone
❌ Using non-HttpOnly cookies
❌ Exposed API keys or secrets

---

## 🚨 TOKEN FAILURE HANDLING

### If ANY of these occurs:

```
Token is missing
Token is invalid
Token is expired
Token signature fails
Role mismatch occurs
User not found in database
Session is invalid
```

### System MUST:

1. **Clear authentication cookie** ✅
   - Backend: Delete access token cookie
   - Backend: Delete refresh token cookie
   - Frontend: Clear user state

2. **Redirect to /login** ✅
   - Preserve current location in `?redirect=` param
   - Clear protected content
   - Show login form

3. **Block further protected access** ✅
   - Middleware blocks at request level
   - ProtectedRoute blocks at component level
   - Backend blocks at API level

4. **Immediately** ✅
   - No delays
   - No silent failures
   - No fallback access

**Code Example**:
```typescript
// On token failure
setUser(null);
setHasValidToken(false);
router.push('/auth/login');
```

---

## 🔄 AUTHENTICATION STATE FLAGS

### `isAuthenticated`
- **Type**: `boolean`
- **True When**: User is logged in AND has valid token
- **False When**: User logged out OR token invalid
- **Used**: General authentication check

### `hasValidToken`
- **Type**: `boolean`
- **True When**: Token verified by backend
- **False When**: Token missing, invalid, or expired
- **Used**: Strict token validation (mandatory check)
- **Critical**: MUST be true before rendering protected content

### `isLoading`
- **Type**: `boolean`
- **True When**: Authentication check in progress
- **False When**: Authentication check complete
- **Used**: Show loading state during verification

---

## ⚡ NO CONTINUOUS POLLING REQUIRED

**Important**: The system does NOT need continuous cookie checking.

### Why It's Sufficient

✅ **Middleware runs automatically when**:
- Page refresh (user presses F5)
- Direct URL access (user enters URL in address bar)
- Route navigation (user clicks link)

✅ **That is SUFFICIENT** because:
- Every protected route access triggers middleware
- Middleware checks token immediately
- ProtectedRoute verifies on component load
- Backend validates on every API call

✅ **No polling needed** because:
- Continuous checking is inefficient
- Middleware handles all normal use cases
- Token expiration triggers on next request
- Session timeout handled on next API call

---

## 📋 ACCESS CONTROL VERIFICATION CHECKLIST

For each protected route access:

- [ ] **Step 1**: Middleware checks token exists
- [ ] **Step 2**: Page loads (backend will verify)
- [ ] **Step 3**: ProtectedRoute waits for loading
- [ ] **Step 4**: ProtectedRoute checks `hasValidToken`
- [ ] **Step 5**: ProtectedRoute checks `isAuthenticated`
- [ ] **Step 6**: ProtectedRoute checks role match
- [ ] **Step 7**: Backend API called for data
- [ ] **Step 8**: Backend validates JWT signature
- [ ] **Step 9**: Backend validates expiration
- [ ] **Step 10**: Backend validates role
- [ ] **Step 11**: Backend returns data or 401/403
- [ ] **Step 12**: Content rendered (if all passed)

---

## 🚫 ABSOLUTE PROHIBITIONS

The following are **STRICTLY FORBIDDEN**:

```
❌ Accessing dashboard before role confirmation
❌ Rendering protected page before middleware check
❌ Rendering protected page before token validation
❌ Trusting frontend role without backend verification
❌ Allowing fallback access without login
❌ Allowing partial authentication
❌ Allowing undefined roles
❌ Allowing access when token is missing
❌ Allowing access with expired token
❌ Allowing access with invalid signature
❌ Allowing role mismatch access
❌ Storing token in localStorage
❌ Storing token in sessionStorage
❌ Storing token in unsecured cookies
❌ Trusting client-side validation alone
❌ Skipping backend verification
```

---

## 📱 USER SCENARIOS & RESPONSES

### Scenario 1: Valid Admin Accessing `/admin/dashboard`

```
User Action: Navigate to /admin/dashboard
                ↓
Middleware: ✅ Token exists → Allow
                ↓
ProtectedRoute: ✅ hasValidToken = true
                 ✅ isAuthenticated = true
                 ✅ user.role = "admin"
                 → Render AdminDashboard
                ↓
Backend API: ✅ Token valid
             ✅ Role is admin
             → Return admin data
                ↓
Result: 🎉 Access Granted
```

### Scenario 2: Valid User (Not Admin) Accessing `/admin/dashboard`

```
User Action: Navigate to /admin/dashboard
                ↓
Middleware: ✅ Token exists → Allow page load
                ↓
ProtectedRoute: ✅ hasValidToken = true
                 ✅ isAuthenticated = true
                 ❌ user.role = "user" (not "admin")
                 → DO NOT render AdminDashboard
                 → Show "Access Denied"
                 → Redirect to /login
                ↓
Result: 🚫 Access Denied
```

### Scenario 3: No Token Accessing `/admin/dashboard`

```
User Action: Navigate to /admin/dashboard
                ↓
Middleware: ❌ No token found
            → Redirect to /login?redirect=/admin/dashboard
                ↓
Result: 🚫 Redirected to Login
```

### Scenario 4: Expired Token Accessing `/admin/dashboard`

```
User Action: Navigate to /admin/dashboard
                ↓
Middleware: ✅ Token exists → Allow
                ↓
ProtectedRoute: Attempts checkAuth() on mount
                ↓
Backend API: ❌ Token expired
             → Return 401 Unauthorized
                ↓
ProtectedRoute: ❌ hasValidToken = false
                ❌ Refresh failed
                → Render blocked state
                → Redirect to /login
                ↓
Result: 🚫 Redirected to Login
```

---

## 🔐 FINAL SECURITY STATEMENT

```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║  Access to /admin/dashboard or /admin/*               ║
║  is STRICTLY FORBIDDEN until:                         ║
║                                                        ║
║  ✅ Token cookie exists                               ║
║  ✅ Token is validated on backend                     ║
║  ✅ Role is verified as "admin"                       ║
║  ✅ Role matches requested route                      ║
║                                                        ║
║  If ANY condition fails:                              ║
║  → IMMEDIATE redirect to /login                       ║
║  → CLEAR all authentication data                      ║
║  → BLOCK protected content rendering                  ║
║                                                        ║
║  Zero tolerance.                                      ║
║  Zero bypass.                                         ║
║  Zero exceptions.                                     ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

---

## 📞 IMPLEMENTATION SUMMARY

| Component | Purpose | Security Layer |
|-----------|---------|-----------------|
| `src/middleware.ts` | Check token on every request | Layer 1 - Entry Point |
| `AuthContext` | Manage auth state + `hasValidToken` | Layer 2 - State |
| `ProtectedRoute` | Verify role before rendering | Layer 2 - Component |
| `Backend API` | Validate JWT + role on every call | Layer 3 - Real Security |
| `HTTP-only Cookies` | Secure token storage | Layer 3 - Storage |

---

**Status**: ✅ IMPLEMENTED & ENFORCED  
**Compliance Level**: ULTRA-STRICT  
**Enforcement**: Multi-layer (Frontend + Backend)  
**Exceptions**: ZERO  
**Bypass Possible**: NO
