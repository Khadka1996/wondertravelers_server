# Frontend Auth System - Quick Reference

## 🚀 Quick Start

### Test Login:
```bash
cd client && npm run dev
# Visit http://localhost:3000/auth/login
```

### Test Registration:
```
http://localhost:3000/auth/register
```

### Test User Profile:
```
http://localhost:3000/profile (Must be logged in)
```

### Test Admin Dashboard:
```
http://localhost:3000/admin/dashboard (Must be admin)
```

### Test Moderator Dashboard:
```
http://localhost:3000/moderator/dashboard (Must be moderator)
```

---

## 🔐 Credentials for Testing

Use accounts created on the backend:
- **Admin**: Login at `/auth/login` with admin account credentials
- **Moderator**: Login with moderator account credentials
- **User**: Login with regular user credentials

---

## 📁 Key Files Location

| File | Purpose |
|------|---------|
| `/client/src/context/AuthContext.tsx` | Auth state management |
| `/client/src/app/auth/login/page.tsx` | Login page |
| `/client/src/app/auth/register/page.tsx` | Registration page |
| `/client/src/app/profile/page.tsx` | User profile |
| `/client/src/app/admin/dashboard/page.tsx` | Admin dashboard |
| `/client/src/app/moderator/dashboard/page.tsx` | Moderator dashboard |
| `/client/src/components/ProtectedRoute.tsx` | Route protection |
| `/client/src/app/components/Header/Header.tsx` | Navigation bar |

---

## 💻 Using Auth in Components

### Check if user is logged in:
```typescript
import { useAuth } from '@/context/AuthContext';

export default function MyComponent() {
  const { isAuthenticated, user } = useAuth();
  
  return isAuthenticated ? <div>Hello {user.fullName}</div> : <div>Not logged in</div>;
}
```

### Protect a page:
```typescript
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function AdminPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div>Admin content here</div>
    </ProtectedRoute>
  );
}
```

### Get current user:
```typescript
const { user } = useAuth();
// user = { _id, username, email, fullName, role, avatar, ... }
```

### Logout:
```typescript
const { logout } = useAuth();

const handleLogout = async () => {
  await logout();
  router.push('/');
};
```

---

## 🎨 Design Features

- ✅ Dark theme with blue/purple accents
- ✅ Glassmorphism design (backdrop blur)
- ✅ Responsive mobile design
- ✅ Smooth animations
- ✅ Professional icons (Lucide React)
- ✅ Loading states
- ✅ Error handling

---

## 🔒 Security Checklist

- ✅ HTTP-only cookies (backend managed)
- ✅ CSRF protection (credentials: include)
- ✅ Password strength validation
- ✅ Role-based access control
- ✅ Safe error messages
- ✅ Automatic token refresh
- ✅ Protected routes
- ✅ Session tracking

---

## 📱 Navbar Features

### When Logged In:
- User avatar with initial
- User dropdown menu
- Profile link
- Dashboard links (if admin/moderator)
- Logout button

### When Logged Out:
- Login button
- Sign up button

### Mobile Menu:
- Same options as desktop
- Slide-out sidebar
- User info card (when logged in)
- All readable on mobile

---

## 🔄 Auto Redirect Logic

### After Login:
1. Check for `?redirect=` param
2. If not present, check sessionStorage for `previousLocation`
3. If not available:
   - Admin → `/admin/dashboard`
   - Moderator → `/moderator/dashboard`
   - User → `/`

### Unauthorized Access:
- Redirect to `/unauthorized` page
- Show 403 error
- Link back to home/sign in

### Session Expired:
- Attempt automatic token refresh
- If fails, redirect to login
- Preserve original location in `?redirect=` param

---

## 📊 API Endpoints

| Method | Endpoint | Used For |
|--------|----------|----------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout user |
| PUT | `/api/auth/update-profile` | Update profile |

---

## 🐛 Troubleshooting

### Login not working:
- Check backend is running: `cd server && npm run dev`
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Check browser console for errors

### Protected route redirecting:
- Ensure `<ProtectedRoute>` wrapper is used
- Check role matches requirement
- Try logout and login again

### Profile not updating:
- Ensure backend has `/api/auth/update-profile` endpoint
- Check form validation errors
- Verify user has permission

### Navbar not showing user:
- Check AuthProvider is in layout.tsx
- Clear browser cache
- Hard refresh page (Ctrl+Shift+R)

---

## 📚 Component Exports

```typescript
// From AuthContext
export const useAuth = () => {
  // Returns: { user, isAuthenticated, isLoading, error, login, register, logout, checkAuth }
}

// From ProtectedRoute
export const ProtectedRoute = ({ requiredRole, children }) => { ... }
export const useRedirectAfterLogin = () => { ... }
export const useRememberLocation = () => { ... }

// From Header
export default MainNavigation = ({ scrolled }) => { ... }
```

---

## 🎯 Testing Checklist

- [ ] Login with valid credentials
- [ ] Login fails with invalid credentials
- [ ] Register new user
- [ ] Cannot register with weak password
- [ ] Password strength meter works
- [ ] Create account button shows on register
- [ ] Navbar shows user when logged in
- [ ] Navbar shows login button when logged out
- [ ] User menu dropdown opens/closes
- [ ] Profile page shows user info
- [ ] Admin can access admin dashboard
- [ ] Moderator can access moderator dashboard
- [ ] Regular user cannot access admin page
- [ ] Logout works properly
- [ ] Redirect to previous page after login works
- [ ] Mobile menu works on small screens

---

## 🚀 Deployment Notes

Before deploying to production:

1. **Environment Variables** (.env.local)
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-api.com
   ```

2. **HTTPS Required**
   - HTTP-only cookies require HTTPS
   - Set cookie secure flag on backend

3. **CORS Configuration**
   - Backend must allow frontend domain
   - credentials: 'include' requires proper CORS headers

4. **Build:**
   ```bash
   npm run build
   npm start
   ```

5. **Test in Production:**
   - Login/Register flow
   - Protected routes
   - Token refresh
   - Mobile responsiveness

---

## 📞 Support Resources

- **Auth Context**: Check `/client/src/context/AuthContext.tsx`
- **Protected Routes**: Check `/client/src/components/ProtectedRoute.tsx`
- **Navbar**: Check `/client/src/app/components/Header/Header.tsx`
- **Backend Auth**: Check `/server/src/features/auth/`

---

**Version: 1.0**
**Last Updated: Today**
**Status: ✅ Production Ready**
