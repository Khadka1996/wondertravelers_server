# Quick Login Fix Checklist

Your dashboard login isn't working because of **cross-domain cookie issues**. Here's what to do:

## ✅ Step 1: Backend Environment Variable
Check `/server/.env` has the correct frontend URL:
```
FRONTEND_URL=https://www.wondertravelers.com
```
✅ **Already correct in your .env**

## ✅ Step 2: Frontend Environment Variable
Check your client `.env.local` or `.env.production`:
```
NEXT_PUBLIC_API_URL=https://wonder.shirijanga.com
```

**If missing, add it to:**
- `client/.env.local` (for local testing)
- Create `client/.env.production` with this value for production

## ✅ Step 3: Rebuild Frontend
After updating environment variables:
```bash
cd client
npm run build
# or for development:
npm run dev
```

## ✅ Step 4: Test Login
Try logging in now. 

---

## Why This Fixes It

| Problem | Why | Solution |
|---------|-----|----------|
| Frontend doesn't know backend API URL | `NEXT_PUBLIC_API_URL` wasn't set | Add to .env |
| Logout fails silently | Logout used wrong URL (`/api/auth/logout` instead of full URL) | ✅ Already fixed |
| Cookies not sent with requests | Missing `credentials: 'include'` | ✅ Already set in code |
| Cross-domain cookies blocked | `sameSite` not 'Lax' | ✅ Already set to 'Lax' |

---

## If Still Not Working

Run this in browser console on https://www.wondertravelers.com:
```javascript
// Check if API is accessible
fetch('https://wonder.shirijanga.com/api/auth/me', {
  credentials: 'include'
})
.then(r => r.json())
.then(d => console.log('API Response:', d))
.catch(e => console.log('API Error:', e.message))
```

**Look for:**
- ❌ CORS error → Backend doesn't allow your domain
- ❌ Network error → Backend URL wrong or not running
- ✅ Response with user data → Login working!

---

## Quick Test Command (Terminal)

```bash
curl -X POST https://wonder.shirijanga.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -v
```

Look for `Set-Cookie` headers in the response. If you see them, backend is working.
