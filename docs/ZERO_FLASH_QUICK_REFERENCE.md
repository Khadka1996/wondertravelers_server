# 🔐 ZERO-FLASH PROTECTION - QUICK REFERENCE

## For Developers: Protecting New Routes

### Pattern 1️⃣: New Admin Sub-Routes

When adding a new admin page/feature:

```typescript
// ✅ app/admin/[new-feature]/layout.tsx
import { requireRole } from '@/utils/server-auth';
import NewFeatureClient from './layout-client';

export default async function NewFeatureLayout({ children }) {
  // 🔐 Verification here - no HTML rendered if unauthorized
  await requireRole(['admin']);
  
  return (
    <NewFeatureClient>
      {children}
    </NewFeatureClient>
  );
}
```

```typescript
// ✅ app/admin/[new-feature]/layout-client.tsx
'use client';

export default function NewFeatureClient({ children }) {
  // Interactive UI here
  return (
    <div>
      {children}
    </div>
  );
}
```

```typescript
// ✅ app/admin/[new-feature]/page.tsx
// NO 'use client' - inherits verification from parent layout

export default function NewFeaturePage() {
  return <FeatureContent />;
}
```

---

### Pattern 2️⃣: New Moderator Sub-Routes

```typescript
// ✅ app/moderator/[feature]/layout.tsx
import { requireRole } from '@/utils/server-auth';

export default async function FeatureLayout({ children }) {
  // Allows moderators AND admins
  await requireRole(['moderator', 'admin']);
  
  return <FeatureContent>{children}</FeatureContent>;
}
```

---

### Pattern 3️⃣: Protected Profile/User Pages

```typescript
// ✅ app/profile/page.tsx
import { requireAuth } from '@/utils/server-auth';

export default async function ProfilePage() {
  // Just check if user is logged in (any role)
  const user = await requireAuth();
  
  return <ProfileContent user={user} />;
}
```

---

### Pattern 4️⃣: Custom Role Requirements

```typescript
// ✅ app/special-feature/page.tsx
import { requireRole } from '@/utils/server-auth';

export default async function SpecialPage() {
  // Only super-admins
  await requireRole(['admin']);
  
  return <SpecialContent />;
}
```

Or with conditional roles:

```typescript
import { getCurrentUser } from '@/utils/server-auth';

export default async function AdminOrModPage() {
  const user = await getCurrentUser();
  
  if (!user || !['admin', 'moderator'].includes(user.role)) {
    redirect('/unauthorized');
  }
  
  return <Content user={user} />;
}
```

---

### Pattern 5️⃣: Conditional Rendering Based on Role

```typescript
// ✅ Mixed public + role-specific content
import { hasRole } from '@/utils/server-auth';

export default async function MixedPage() {
  const isAdmin = await hasRole(['admin']);
  const isModerator = await hasRole(['moderator']);
  
  return (
    <div>
      {/* Always shown */}
      <PublicSection />
      
      {/* Admin only */}
      {isAdmin && <AdminPanel />}
      
      {/* Moderator only */}
      {isModerator && <ModeratorTools />}
    </div>
  );
}
```

---

## ⚡ DO's and DON'Ts

### ✅ DO:

```typescript
// ✅ Call requireRole in server component
async function AdminLayout({ children }) {
  await requireRole(['admin']);
  return <Content>{children}</Content>;
}

// ✅ Use next/navigation redirect
import { redirect } from 'next/navigation';
redirect('/unauthorized');

// ✅ Pass user as prop
<ClientComponent user={user} />

// ✅ Make layout a server component
export default async function Layout({ children }) {
  // No 'use client'
}

// ✅ Use cache: 'no-store' for auth
const user = await getCurrentUser(); // No caching
```

---

### ❌ DON'T:

```typescript
// ❌ Use requireRole in client component
'use client';
const user = await requireRole(['admin']); // ERROR!

// ❌ Use next/router for redirect
import { useRouter } from 'next/router'; // Wrong!

// ❌ Render UI before verification
if (user) {
  return <AdminUI />; // Might show before verification
}

// ❌ Mark layout as client component
'use client';
export default function Layout({ children }) {
  // Can't redirect before HTML generation
}

// ❌ Cache auth checks
const user = await getCurrentUser(); // Cache: 'default'
// Wrong - role might change!
```

---

## 🔍 Testing Your Protected Routes

### Step 1: Test as Admin
```bash
curl -H "Cookie: access_token=ADMIN_TOKEN" \
  http://localhost:3000/admin/dashboard
# ✅ Should see dashboard
```

### Step 2: Test as Non-Admin
```bash
curl -H "Cookie: access_token=USER_TOKEN" \
  http://localhost:3000/admin/dashboard
# ✅ Should redirect to /unauthorized
```

### Step 3: Test without Token
```bash
curl http://localhost:3000/admin/dashboard
# ✅ Should redirect to /auth/login
```

### Step 4: Inspect Network
```bash
# Open DevTools → Network → Reload /admin/dashboard
# ❌ BAD: Multiple requests, visible delay
# ✅ GOOD: Single request, immediate redirect
```

### Step 5: Check for UI Flash
```bash
# Visit /admin/dashboard as non-admin
# ✅ Correct: No admin UI visible
# ❌ Wrong: Sidebar briefly visible before redirect
```

---

## 📋 Checklist for New Protected Pages

When adding new admin/moderator pages:

- [ ] Create `layout.tsx` as **server component**
  - [ ] Import `requireRole` or `requireAuth`
  - [ ] Call verification function at top
  - [ ] Return `<ClientComponent>`
  
- [ ] Create `layout-client.tsx` as **client component**
  - [ ] Add interactive features here
  - [ ] Add `'use client'` directive
  - [ ] Use hooks as needed
  
- [ ] Create `page.tsx` **without** `'use client'`
  - [ ] Inherits verification from parent layout
  - [ ] No auth checks needed here
  
- [ ] Update middleware if needed
  - [ ] Add route to PROTECTED_ROUTES if using custom path
  
- [ ] Test thoroughly
  - [ ] As authorized user ✅
  - [ ] As unauthorized user → Redirect ✅
  - [ ] Without token → Login redirect ✅
  - [ ] NO UI FLASH at any stage ✅

---

## 🚨 Common Mistakes

### Mistake 1: Client Component Verification
```typescript
// ❌ WRONG
'use client';
async function AdminPage() {
  await requireRole(['admin']); // Can't use here!
}

// ✅ CORRECT
// NO 'use client' - let parent layout verify
export default function AdminPage() {
  return <Content />;
}
```

### Mistake 2: Verification in Child Component
```typescript
// ❌ WRONG
export default function AdminPage() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // Client-side check - TOO LATE
    checkAuth().then(setUser);
  }, []);
  
  return user ? <AdminUI /> : <LoadingUI />; // FLASH!
}

// ✅ CORRECT
// Verification in layout.tsx (server component)
// This page just renders - role already verified
export default function AdminPage() {
  return <AdminUI />;
}
```

### Mistake 3: Caching Auth Check
```typescript
// ❌ WRONG - Uses default cache
const user = await getCurrentUser();

// ✅ CORRECT - No cache
const user = await getCurrentUser();
// Implicitly: cache: 'no-store'
```

### Mistake 4: Multiple Verification Points
```typescript
// ❌ WRONG
async function Layout({ children }) {
  await requireRole(['admin']);
  
  return (
    <Page>
      {children} {/* Each child also checks - redundant */}
    </Page>
  );
}

// ✅ CORRECT
async function Layout({ children }) {
  await requireRole(['admin']); // Single check point
  
  return <Page>{children}</Page>;
}
```

---

## 🎓 Understanding the Flow

### Why Server Components Work:

```
┌─────────────────────────────────────────┐
│ Client Requests /admin/dashboard        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Middleware Checks Token                 │
│ ✅ Token exists → Continue              │
│ ❌ No token → Redirect login            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Server Renders layout.tsx               │
│                                         │
│ async function Layout() {               │
│   await requireRole(['admin'])          │
│   //                                    │
│   // If role check fails →              │
│   // redirect() is called               │
│   // (NO HTML generated)                │
│   //                                    │
│   return <Content />;                   │
│ }                                       │
└─────────────────────────────────────────┘
                    ↓
              ┌─────────┐
              │ SUCCESS │
              ├─────────┤
        ┌─────┴────────┬────────┐
        │              │        │
        ↓              ↓        ↓
    USER HAS     RENDER       SEND
    ADMIN ROLE   HTML        TO BROWSER
                 ✅
        
        NO FLASH. NO UNAUTHORIZED CONTENT.
```

### Why Client Components Fail:

```
┌──────────────────────────────┐
│ Client Renders HTML          │
│ ← ALL HTML sent to browser   │
│ ← Admin sidebar visible ⚠️   │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│ Client JS Checks Auth        │
│ ← API call (100-500ms delay) │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│ Check Fails                  │
│ → Redirect to /unauthorized  │
│ ← But UI already visible 🚨  │
└──────────────────────────────┘

FLASH! User briefly saw admin interface.
```

---

## 📞 Need Help?

If a protected route isn't working:

1. **Check layout.tsx exists** - Must call `requireRole()`
2. **Check import** - `import { requireRole } from '@/utils/server-auth'`
3. **Check layout-client.tsx exists** - For interactive UI
4. **Check middleware** - Token validation working?
5. **Check backend** - `/api/auth/me` returning role?
6. **Check for 'use client'** - Layout must be server component
7. **Check redirect** - Is user being redirected correctly?

---

**🛡️ Remember: Server-side verification BEFORE HTML generation = ZERO FLASH**
