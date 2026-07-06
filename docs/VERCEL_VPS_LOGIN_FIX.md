# Vercel + VPS Backend Login & Dashboard Fix

**Problem:** You can login, but can't access admin/dashboard when deployed on Vercel

**Why it happens:** Vercel server-side code can't verify your authentication with the VPS backend

---

## ✅ What I Fixed in Code

1. **Updated server-auth.ts** to use `NEXT_PUBLIC_API_URL` for Vercel deployments
2. **Added Bearer token fallback** for server-to-server requests  
3. **Created .env.production** with correct settings

---

## 📋 Vercel Dashboard Setup

Go to your Vercel project settings and add these **Environment Variables**:

### For Production Deployment:
```
NEXT_PUBLIC_API_URL = https://wonder.shirijanga.com
NEXT_PUBLIC_BASE_URL = https://www.wondertravelers.com
NODE_ENV = production
```

### For Preview/Staging:
```
NEXT_PUBLIC_API_URL = https://wonder.shirijanga.com
NEXT_PUBLIC_BASE_URL = https://www.wondertravelers.com
NODE_ENV = production
```

---

## 🔒 Backend Configuration Check

Verify your backend at `https://wonder.shirijanga.com` has:

### 1. ✅ CORS allows your Vercel domain
In `/server/.env`:
```
FRONTEND_URL=https://www.wondertravelers.com
```

The backend's allowedOrigins should include:
- ✅ `https://www.wondertravelers.com`
- ✅ `https://wondertravelers.com`
- ✅ Your custom Vercel domain (if using custom domain)

### 2. ✅ Cookies configured correctly
In `/server/src/features/auth/auth.controller.js`:
```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,        // ✅ HTTPS required
  sameSite: 'Lax',     // ✅ Allows cross-domain
  path: '/',           // ✅ Available to all paths
  domain: '.shirijanga.com', // ✅ ADD THIS if cookies aren't working
};
```

If cookies still don't work, try adding explicit domain:
```javascript
domain: '.wonder.shirijanga.com', // Remove for local testing
```

---

## ✅ After Making Changes

### 1. Update Backend (if needed)
```bash
cd server
# Verify .env has correct FRONTEND_URL
git add .
git commit -m "Fix: Add domain to cookie options"
git push
```

### 2. Update Vercel
```bash
cd client
git add .
git commit -m "Fix: Add Vercel environment setup"
git push
# This triggers automatic Vercel deployment
```

### 3. Test Login Flow

**In Browser Console:**
```javascript
// 1. Test login works
fetch('https://wonder.shirijanga.com/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: 'your@email.com', 
    password: 'yourpassword' 
  })
})
.then(r => r.json())
.then(d => {
  console.log('Login:', d);
  // If successful, you'll see your user data
})

// 2. Now try accessing dashboard
// Navigate to https://www.wondertravelers.com/admin/dashboard
// Should NOT redirect to /unauthorized
```

---

## 🐛 If Still Not Working

### Debug Step 1: Check Chrome DevTools
1. Go to `https://www.wondertravelers.com/admin/dashboard`
2. Open **DevTools** (F12)
3. Go to **Application** → **Cookies**
4. Look for `access_token` and `refresh_token`

**If cookies exist:**
- Theme Problem is server-to-server (Next.js can't read the cookie)

**If NO cookies:**
- CORS is blocking them or login failed

### Debug Step 2: Check Backend Logs
```bash
# SSH into your VPS
ssh yourserver

# Check backend logs
cd /path/to/server
tail -f server.log | grep "CORS\|access_token\|auth"
```

Look for:
- ❌ `CORS blocked origin` - Add domain to backend CORS
- ❌ `No access token found` - Cookie not being sent
- ✅ `User logged in successfully` - Login working

### Debug Step 3: Test Backend Directly
```bash
# Replace with your tokens from login
curl -X GET https://wonder.shirijanga.com/api/auth/me \
  -H "Cookie: access_token=YOUR_TOKEN_HERE" \
  -v

# Should return your user data (200) or "No token" (401)
```

---

## 🚀 Quick Checklist

- [ ] Added environment variables to Vercel dashboard
- [ ] Backend CORS includes your frontend domain
- [ ] Backend .env has correct FRONTEND_URL
- [ ] Cookies have `domain` set (if needed)
- [ ] Redeployed both frontend and backend
- [ ] Waited 5 minutes for Vercel cache to clear
- [ ] Tested login in new incognito window
- [ ] Checked browser cookies in DevTools

---

## 📞 Still Stuck?

Run this command to tell me what's happening:
```bash
# Check backend CORS config
curl -X OPTIONS https://wonder.shirijanga.com/api/auth/me \
  -H "Origin: https://www.wondertravelers.com" \
  -v
```

Look for `Access-Control-Allow-Origin` in response headers.
