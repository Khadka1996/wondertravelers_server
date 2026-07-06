# 🔐 Authentication Error - Troubleshooting Guide

## ❌ Error: "Authentication required – please log in"

You're seeing this error when trying to access `/admin/blog/add` even though you're logged in. Here's how to fix it:

---

## 🔍 Step 1: Check Browser Console for Clues

1. Open your browser DevTools: Press `F12`
2. Go to **Console** tab
3. Look for logs starting with `[Blog]`
4. They will show:
   - `[Blog] Checking authentication status...`
   - `[Blog] No valid session found (401)` ← This tells us the cookie isn't being sent
   - `[Blog] Authentication check passed` ← This means it worked

**What to look for:**
```
[Blog] Checking authentication status...
[Blog] No valid session found (401), redirecting to login
```

---

## 🍪 Step 2: Check Network/Cookies Tab

1. In DevTools, go to **Application** or **Storage** tab
2. Click on **Cookies**
3. Select `http://localhost:3000` or your frontend URL
4. Look for a cookie named `access_token`

**If `access_token` is missing:**
- ✗ Your session is not saved
- ✗ Need to login again

**If `access_token` exists:**
- ✓ Session is saved
- But backend is not receiving it (CORS/path issue)

---

## 🛠️ Quick Fixes (Try in Order)

### Fix #1: Clear Cache & Logout Completely

```
1. Click "Logout" button (if error shows one)
2. Or go to profile menu → Logout
3. Close browser tab completely
4. Clear browser cache (Ctrl+Shift+Delete)
5. Open new tab
6. Go to http://localhost:3000/auth/login
7. Log in again
8. Try accessing /admin/blog/add
```

### Fix #2: Check Server is Running

```bash
# Terminal 1: Backend server
cd /server
npm run dev

# Terminal 2: Frontend client
cd /client
npm run dev
```

Visit: `http://localhost:3000` to verify frontend is running
Visit: `http://localhost:5000/api/authors` to verify backend is running

### Fix #3: Check Environment Variables

**Frontend (.env.local or .env):**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Backend (.env):**
```
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key
```

Restart both frontend and backend after changing `.env` files.

### Fix #4: Check CORS Configuration

If you're accessing from a different URL (not localhost:3000):

1. Edit `/server/src/app.js`
2. Find the `allowedOrigins` array
3. Add your URL:
```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://your-actual-url:port',  // ← Add this
  // ...
];
```

---

## 🧪 Test Authentication

Open browser console and run:

```javascript
// Test if cookies are being sent
fetch('http://localhost:5000/api/authors?limit=1', {
  credentials: 'include',
  headers: { 'Accept': 'application/json' }
})
  .then(r => r.json())
  .then(data => {
    console.log('✅ Auth working!', data);
  })
  .catch(err => {
    console.error('❌ Auth failed:', err);
  });
```

**Expected response:**
- ✅ `{ success: true, data: [...] }` → Auth works!
- ❌ `{ success: false, message: "Authentication required" }` → Session expired, need to login

---

## 📋 Complete Reboot Process

If none of the above work, try a complete restart:

```bash
# 1. Stop all servers (Ctrl+C in terminals)

# 2. Clear all cache
rm -rf /client/.next
rm -rf /client/node_modules/.cache

# 3. Optional: Clear browser cache
# Ctrl+Shift+Delete → Select all time → Clear browsing data

# 4. Open fresh terminal windows and start fresh
# Terminal 1:
cd /server && npm run dev

# Terminal 2:
cd /client && npm run dev

# 5. Wait for both to fully start (look for "ready on" messages)

# 6. Try again:
# - Go to http://localhost:3000
# - Log in fresh
# - Try /admin/blog/add
```

---

## 🆘 Still Not Working?

### Check Backend Logs

Look at the terminal where backend is running for errors like:
```
Access token missing from all sources
CORS: Missing origin header
Invalid authentication token
```

### Check Frontend Network Requests

1. DevTools → Network tab
2. Filter for `/api/authors` request (first one when loading blog add page)
3. Click on it
4. Under **Request Headers**, check:
   - `Cookie: access_token=...` should be present
   - `Origin: http://localhost:3000` should match allowed origins
5. Under **Response**, check for error message

### Verify Token Format

1. DevTools → Application → Cookies → access_token
2. Copy the value
3. Go to https://jwt.io
4. Paste in "Encoded" section
5. Verify it matches your `JWT_SECRET`

---

## 🔄 If You Want to Force Logout Everywhere

Sometimes the session gets stuck:

```bash
# Clear database sessions (if using MongoDB)
# Connect to MongoDB and run:
db.securityaudits.deleteMany({})
db.users.updateMany({}, { $set: { sessionVersion: 0 } })

# Then log in fresh
```

---

## ✅ What Should Happen

1. ✅ Log in at `/auth/login`
2. ✅ Session cookie `access_token` is set
3. ✅ Redirected to dashboard
4. ✅ Visit `/admin/blog/add`
5. ✅ Form loads with authors and categories
6. ✅ Can create blog successfully

---

## 📞 Still Need Help?

Check these files are correct:

- [ ] `/server/.env` has all required secrets
- [ ] `/client/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:5000`
- [ ] Backend running on port 5000
- [ ] Frontend running on port 3000
- [ ] Can see `[Blog] Checking authentication...` in console

If you see `[Blog]` logs in console, auth system is detecting the error correctly. If you don't see them, the front-end code might not have updated. Try:

```bash
cd /client
npm run clean  # or rm -rf .next
npm run dev
```
