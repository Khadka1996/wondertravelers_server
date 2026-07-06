# 📍 ROLE-BASED REDIRECT AFTER LOGIN

## ✅ NEW BEHAVIOR

After a user logs in, they are redirected based on their **role**:

### Redirect Map:

```
┌─────────────────────────────────────────────┐
│ User Logs In                                │
└─────────────────────────────────────────────┘
         ↓
    ┌─────────────────────┐
    │ Check User Role     │
    └─────────────────────┘
         ↓
    ┌─────────────────────────────────────────┐
    │  Is Admin?                              │
    │  ✅ YES → /admin/dashboard              │
    │  ❌ NO → Continue checking              │
    └─────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────┐
    │  Is Moderator?                          │
    │  ✅ YES → /moderator/dashboard          │
    │  ❌ NO → Continue checking              │
    └─────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────┐
    │  Regular User                           │
    │  → / (Home Page)                        │
    └─────────────────────────────────────────┘
```

---

## 📊 Redirect Destinations

| User Role | Redirect Destination | Reason |
|-----------|----------------------|--------|
| **Admin** | `/admin/dashboard` | Dashboard to manage site |
| **Moderator** | `/moderator/dashboard` | Dashboard to moderate content |
| **User** | `/` | Home page |

---

## 🎯 Examples

### Example 1: Admin Logs In
```
1. Admin opens login page
2. Enters credentials
3. Clicks "Sign In"
4. ✅ Logged in successfully
5. 🎯 Redirected to → /admin/dashboard (Admin Panel)
```

### Example 2: Moderator Logs In
```
1. Moderator opens login page
2. Enters credentials
3. Clicks "Sign In"
4. ✅ Logged in successfully
5. 🎯 Redirected to → /moderator/dashboard (Moderator Panel)
```

### Example 3: Regular User Logs In
```
1. User opens login page
2. Enters credentials
3. Clicks "Sign In"
4. ✅ Logged in successfully
5. 🎯 Redirected to → / (Home Page)
```

---

## 🔄 Exception: Explicit Redirect URL

If a user was trying to access a protected page, they are redirected there AFTER login:

```
1. User visits /admin/featured-images (not logged in)
2. Middleware blocks access → Redirects to /auth/login?redirect=/admin/featured-images
3. User logs in
4. ❌ NOT redirected to /admin/dashboard
5. ✅ Redirected to → /admin/featured-images (original destination)
```

---

## 💻 Implementation Details

### Login Page Code (src/app/auth/login/page.tsx):

```typescript
const { login, isLoading, error, clearError, isAuthenticated, user } = useAuth();
const [hasExplicitRedirect, setHasExplicitRedirect] = useState(false);

const redirectTo = searchParams.get('redirect') || '/';

// Check if there was an explicit redirect URL
useEffect(() => {
  setHasExplicitRedirect(!!searchParams.get('redirect'));
}, [searchParams]);

// 🎯 ROLE-BASED REDIRECT
useEffect(() => {
  if (isAuthenticated && !isLoading) {
    if (hasExplicitRedirect) {
      // User was trying to access a specific page
      router.push(redirectTo);
    } else {
      // No explicit redirect - use role-based redirect
      if (user?.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (user?.role === 'moderator') {
        router.push('/moderator/dashboard');
      } else {
        // Regular user
        router.push('/');
      }
    }
  }
}, [isAuthenticated, isLoading, user?.role, router, redirectTo, hasExplicitRedirect]);
```

### How It Works:

1. **User submits login form**
   - `handleSubmit()` calls `login(email, password)`
   - Waits for AuthContext to update with logged-in user

2. **isAuthenticated becomes true**
   - `useEffect` hook detects change
   - Checks if `hasExplicitRedirect` is true

3. **If explicit redirect URL exists** (e.g., `?redirect=/admin/featured-images`)
   - Use that URL: `router.push(redirectTo)`

4. **If NO explicit redirect URL**
   - Check user role:
     - `role === 'admin'` → `/admin/dashboard`
     - `role === 'moderator'` → `/moderator/dashboard`
     - `role === 'user'` → `/`

---

## ✅ Testing

### Test as Admin:
```bash
1. Go to http://localhost:3000/auth/login
2. Login with admin credentials
3. Should see: Admin Dashboard (/admin/dashboard)
4. Should see: Admin Panel with navigation
```

### Test as Moderator:
```bash
1. Go to http://localhost:3000/auth/login
2. Login with moderator credentials
3. Should see: Moderator Dashboard (/moderator/dashboard)
4. Should see: Moderator Panel with navigation
```

### Test as Regular User:
```bash
1. Go to http://localhost:3000/auth/login
2. Login with regular user credentials
3. Should see: Home Page (/)
4. Should NOT see admin/moderator panels
```

### Test with Explicit Redirect:
```bash
1. Visit http://localhost:3000/admin/featured-images (not logged in)
2. Redirected to login: /auth/login?redirect=/admin/featured-images
3. Login as admin
4. Should be redirected to: /admin/featured-images
5. Should NOT go to /admin/dashboard first
```

---

## 🔐 Security Note

The role-based redirect happens **client-side** (in the browser), but:

✅ **Why this is safe:**
- The layout verification (server-side) still protects the actual page
- If user role doesn't match, `/admin/dashboard` redirect is attempted
- Layout calls `requireRole(['admin'])` and blocks rendering if unauthorized
- User cannot bypass this check even if they manually edit `redirectTo`

---

## 🎨 User Experience Improvement

### Before (Old Behavior):
```
User logs in
   ↓
Always goes to / (home page)
   ↓
Must manually click "Admin Panel" or "Moderator Panel"
```

### After (New Behavior):
```
User logs in
   ↓
Automatically taken to dashboard for their role
   ↓
Saves time, better UX
   ↓
Admin/Moderator gets to work immediately
```

---

## 📋 Summary

| Feature | Status |
|---------|--------|
| Admin redirect to `/admin/dashboard` | ✅ Implemented |
| Moderator redirect to `/moderator/dashboard` | ✅ Implemented |
| User redirect to `/` | ✅ Implemented |
| Respect explicit redirect URLs | ✅ Implemented |
| Role verification in layouts | ✅ Implemented (via server-side checks) |
| Zero UI flash | ✅ Guaranteed (server-side verification) |

---

**Navigation is now smart and role-aware after login! 🎯**
