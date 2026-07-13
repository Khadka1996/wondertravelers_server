# 🔐 Strong Authentication & Role-Based Authorization Architecture

## Overview

This is a **server-first, backend-driven** authentication system that prioritizes security over convenience. The backend verifies all access, and the frontend strictly follows these decisions with **zero trust** in client-side tokens.

## Key Principles

### 1. **Never Trust the Frontend**
- All role verification happens **on the server**
- Frontend cannot override backend decisions
- Client-side tokens are only passed to backend for verification

### 2. **Zero-Flash Security Policy**
- Admin/Moderator dashboards are **server components**
- Role verification happens BEFORE any HTML is sent to the browser
- Non-authorized users never see protected UI
- Unauthorized access attempts result in immediate redirect

### 3. **Server-Side Authorization Gates**
- Every protected route has a server component that calls `requireRole()`
- The `requireRole()` function makes synchronous backend call to `/api/auth/me`
- Backend verifies JWT token validity, user existence, and role
- If verification fails, redirect happens on server (no leaked UI)

## Architecture Layers

### Backend (`/newserver/src/`)
```
Auth System (Strong)
├── /api/auth/me          ← Gets current user with role (protected route)
├── /api/auth/login       ← Issues JWT tokens in HTTP-only cookies
├── /api/auth/register    ← Creates user with 'user' role by default
├── /api/auth/refresh     ← Refreshes expired tokens
├── /api/auth/logout      ← Invalidates session
└── /api/admin/*          ← Admin routes (protected with restrictTo('admin'))
└── /api/moderator/*      ← Moderator routes (protected with restrictTo('moderator'))
```

**Protection Layers:**
1. `authMiddleware.protect` - Validates JWT token validity
2. `authMiddleware.restrictTo()` - Checks user.role against allowed roles
3. `requireRole()` (backend) - Server-side verification utility

### Frontend (`/newclient/src/`)
```
Auth System (Strict)
├── /server/src/utils/server-auth.ts        ← Server utilities
│   ├── getCurrentUser()             ← Fetch user from backend
│   ├── requireRole()                ← Verify role before rendering
│   ├── hasRole()                    ← Check role without blocking
│   └── requireAuth()                ← Verify any authentication
│
├── /src/app/page.tsx                ← Home page (ROOT)
│   └── Server component
│       ├── Checks if user is authenticated
│       ├── Redirects to /admin/dashboard if admin
│       ├── Redirects to /moderator/dashboard if moderator
│       ├── Shows home page if regular user
│       └── Redirects to /auth/login if not authenticated
│
├── /src/app/auth/login              ← Login page
│   └── Client component
│       ├── Submits credentials to backend
│       ├── Backend sets HTTP-only cookies with tokens
│       ├── After login success:
│       │   ├── Admins redirect to /admin/dashboard
│       │   ├── Moderators redirect to /moderator/dashboard
│       │   └── Users redirect to home page /
│       └── On error: show error message
│
├── /src/app/admin/                  ← ADMIN DASHBOARD
│   ├── layout.tsx                   ← SERVER component
│   │   ├── Calls requireRole(['admin'])
│   │   ├── Backend verifies user.role === 'admin'
│   │   ├── No HTML sent if not admin
│   │   └── Passes verified user to client layout
│   │
│   ├── layout-client.tsx            ← CLIENT component
│   │   ├── Receives pre-verified user
│   │   └── Renders admin UI
│   │
│   └── dashboard/page.tsx           ← Admin dashboard content
│
├── /src/app/moderator/              ← MODERATOR DASHBOARD
│   ├── layout.tsx                   ← SERVER component (same pattern as admin)
│   ├── layout-client.tsx            ← CLIENT component
│   └── dashboard/page.tsx           ← Moderator dashboard content
│
└── /src/app/profile/                ← USER PROFILE (requires any auth)
    └── page.tsx                     ← Client component with logout
```

## Authentication Flow

### 1. **User Registration**
```
Frontend (/auth/register)
    ↓
Backend: POST /api/auth/register
    ├─ Create user with role='user'
    ├─ Hash password with bcrypt
    ├─ Generate JWT tokens
    └─ Set HTTP-only cookies
    ↓
Frontend: Login successful, redirect to home `/`
```

### 2. **User Login**
```
Frontend (/auth/login)
    ↓
Backend: POST /api/auth/login
    ├─ Verify email exists
    ├─ Verify password matches
    ├─ Update lastLogin timestamp
    ├─ Generate JWT tokens
    ├─ Set HTTP-only cookies
    └─ Return user object with role
    ↓
Frontend (Client-side):
    ├─ Receive user data with role
    ├─ Check user.role
    ├─ Redirect based on role:
    │   ├─ 'admin' → /admin/dashboard
    │   ├─ 'moderator' → /moderator/dashboard
    │   └─ 'user' → /
    └─ AuthContext stores user temporarily
```

### 3. **Accessing Protected Routes (Admin Panel)**
```
User navigates to /admin/dashboard
    ↓
Browser requests layout.tsx (SERVER COMPONENT)
    ↓
layout.tsx calls: requireRole(['admin'])
    ↓
Backend: GET /api/auth/me (with HTTP-only cookie)
    ├─ Verify JWT is valid
    ├─ Fetch user from database
    ├─ Check user.active === true
    ├─ Verify user.role === 'admin'
    └─ Return user data
    ↓
If verified:
    ├─ layout.tsx renders layout-client.tsx with user
    ├─ Browser receives admin UI HTML
    └─ User sees admin dashboard
    ↓
If NOT verified:
    ├─ Backend redirect('/auth/login')
    ├─ NO admin UI is ever sent to browser
    ├─ User sees login page
    └─ HTTP response is redirect (304)
```

### 4. **User Logout**
```
Frontend: Click logout button
    ↓
AuthContext.logout():
    ├─ Invalidate session on backend
    ├─ Clear HTTP-only cookies
    └─ Redirect to /auth/login
    ↓
All subsequent requests:
    ├─ No valid token in cookies
    ├─ /api/auth/me returns 401
    ├─ requireRole() redirects to /auth/login
    └─ User locked out of protected routes
```

## Key Routes & Their Protection

### Public Routes (No Auth Required)
```
GET  /                          ← Home page (server-redirects if authenticated)
GET  /auth/login                ← Login form
GET  /auth/register             ← Registration form
GET  /auth/forgot-password      ← Forgot password form
```

### Admin Routes (Admin-Only)
```
GET  /admin/dashboard           ← Requires: requireRole(['admin'])
GET  /admin/settings            ← Requires: requireRole(['admin'])
GET  /admin/analytics           ← Requires: requireRole(['admin'])
GET  /admin/users               ← Requires: requireRole(['admin'])
```

### Moderator Routes (Moderator-Only)
```
GET  /moderator/dashboard       ← Requires: requireRole(['moderator', 'admin'])
GET  /moderator/content         ← Requires: requireRole(['moderator', 'admin'])
GET  /moderator/reports         ← Requires: requireRole(['moderator', 'admin'])
GET  /moderator/users           ← Requires: requireRole(['moderator', 'admin'])
```

### User Routes (Any Authenticated User)
```
GET  /profile                   ← Requires: requireAuth() (from frontend)
GET  /dashboard                 ← (DEPRECATED - use home page redirect instead)
POST /api/logout                ← Clear session
```

## Backend API Endpoints

### Authentication Endpoints
```javascript
// Public
POST   /api/auth/register          ← Create new user
POST   /api/auth/login             ← Authenticate user
POST   /api/auth/forgotten-password ← Send reset email
POST   /api/auth/reset-password    ← Reset password

// Protected (any authenticated user)
GET    /api/auth/me                ← Get current user (uses cookies)
POST   /api/auth/refresh           ← Refresh expired token
POST   /api/auth/logout            ← Invalidate session
PATCH  /api/auth/profile           ← Update user profile
PATCH  /api/auth/avatar            ← Update avatar

// Admin Only
GET    /api/admin/users            ← List all users
GET    /api/admin/users/list-admins ← List admin users
GET    /api/admin/users/list-mods   ← List moderator users
```

## Security Features

### 1. **HTTP-Only Cookies**
- Tokens stored in HTTP-only cookies
- Cannot be accessed via JavaScript (XSS protection)
- Sent automatically with every request
- Not visible in localStorage

### 2. **JWT Token Validation**
- Backend verifies every token before use
- Checks token signature
- Verifies expiration time
- Validates token type (access vs refresh)
- Checks session version (for forced logout)

### 3. **Role-Based Access Control (RBAC)**
- User roles: `user`, `moderator`, `admin`
- Backend restricts routes by role
- Frontend can only show what backend allows
- No client-side override possible

### 4. **Session Management**
- Session version bumped on logout (invalidates old tokens)
- Last login tracking
- Device fingerprinting (optional)
- Rate limiting on sensitive endpoints

### 5. **Zero-Flash Security Policy**
- Protected UIs rendered on server
- Unauthorized requests never reach client
- No flash of protected content
- Routing happens on server first

## State Management

### AuthContext (Client-Side)
```typescript
// Temporary state - cleared on navigation
{
  user: {
    _id: string;
    email: string;
    username: string;
    role: 'admin' | 'moderator' | 'user';
    firstName?: string;
    lastName?: string;
  } | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}
```

### Server-Side User (Backend Verified)
```javascript
// GET /api/auth/me returns:
{
  success: true,
  user: {
    _id: ObjectId;
    email: string;
    username: string;
    role: string;              // Verified by backend
    firstName?: string;
    lastName?: string;
    avatar?: string;
    active: boolean;           // Verified by backend
    lastLogin: Date;
    createdAt: Date;
    // No sensitive fields returned
  }
}
```

## Testing Scenarios

### Scenario 1: Login as Admin
```
1. Visit /auth/login
2. Enter admin@example.com / password
3. Backend returns user with role='admin'
4. Frontend redirects to /admin/dashboard
5. Server component calls requireRole(['admin'])
6. Backend verifies token & role
7. Admin UI renders successfully
```

### Scenario 2: Unauthorized Access
```
1. User A logs out
2. User A tries to access /admin/dashboard directly
3. Server component calls requireRole(['admin'])
4. Backend: No token in cookies → 401
5. Backend redirects to /auth/login
6. Admin UI never rendered
7. User sees login page
```

### Scenario 3: Role Change (Admin demoted to User)
```
1. Admin was viewing /admin/dashboard
2. Admin (another user) demotes admin role to 'user'
3. Session version updated in database
4. Next request to backend:
   - Token has version=5, db has version=6
   - Backend detects mismatch
   - Backend redirects to /auth/login
5. Old admin is logged out immediately
```

## Configuration

### Environment Variables (Backend)
```env
# .env (newserver)
JWT_SECRET=<strong-random-key>
JWT_REFRESH_SECRET=<strong-random-key>
JWT_ACCESS_EXPIRY=15m              # Short-lived access token
JWT_REFRESH_EXPIRY=7d              # Long-lived refresh token
BCRYPT_ROUNDS=12                   # Password hashing strength
```

### Configuration (Frontend)
```typescript
// server/src/utils/server-auth.ts
const API_URL = 'http://localhost:5000'  // Backend URL
const COOKIE_PATH = '/'                  // Cookies sent to all routes
```

## Migration from Dashboard Route

**Old Architecture:**
```
User logs in → Frontend stores token → Redirect to /dashboard
/dashboard → Client component checks token → Show dashboard
Problem: Client-side checks can be bypassed
```

**New Architecture:**
```
User logs in → Backend sets HTTP-only cookie
User navigates to /admin/dashboard
  → Server component verifies token via backend API
  → Backend confirms user.role === 'admin'
  → Admin UI renders (or redirect to login if unauthorized)
Problem: None - fully server-verified
```

## Troubleshooting

### User can access /admin/dashboard without being admin
- Clear browser cookies
- Verify backend `/api/auth/me` returns correct role
- Check `newserver` logs for role verification errors
- Ensure layout.tsx is a server component (no 'use client')

### Logout doesn't work
- Check browser cookies are cleared
- Verify `DELETE /api/auth/logout` is called
- Ensure session version is updated on backend
- Check AuthContext.logout() implementation

### Role-based redirect doesn't work
- Verify login returns user with role
- Check backend role in user database
- Ensure `requireRole()` calls `/api/auth/me` (not cache)
- Verify HTTP-only cookies are being sent with requests

## Performance Notes

1. **Server-Side Rendering**: Layout components use async/await - may be slower than client-side
2. **Backend Calls**: Every protected route calls `/api/auth/me` - 1 extra request per page
3. **Caching**: Set `revalidate: 0` in fetch to always get fresh auth status
4. **Optimization**: For logged-in users, the re-check is fast (usually <50ms from Redis)

## Next Steps

1. Create `/moderator/content` page for content review
2. Implement `/moderator/reports` for user reports
3. Add more admin features to `/admin/settings`
4. Implement user account deletion endpoint
5. Add 2FA (Two-Factor Authentication)
6. Implement password reset flow
7. Add device trust verification
8. Setup WebSocket for real-time moderation alerts
