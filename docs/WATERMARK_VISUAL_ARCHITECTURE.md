# Watermark System - Visual Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN INTERFACE (FRONTEND)                    │
│                                                                       │
│  ┌──────────────────────────────────────┐                           │
│  │  /admin/watermarks                   │                           │
│  │  ─────────────────────────────────    │                           │
│  │  • Create Watermark Template          │                           │
│  │  • Edit Watermark Settings            │                           │
│  │  • Delete Watermark                   │                           │
│  │  • Toggle Active/Inactive             │                           │
│  │  • View All Watermarks Table          │                           │
│  │  • Live Preview                       │                           │
│  └──────────────────────────────────────┘                           │
│           │                     │                                     │
│           │ Create/Update       │ Fetch List                          │
│           ↓                     ↓                                     │
│  ┌──────────────────────────────────────┐                           │
│  │  /admin/photos                       │                           │
│  │  ─────────────────────────────────    │                           │
│  │  • Upload Photo Form                  │                           │
│  │  • View Uploaded Photos               │                           │
│  │  • (Auto-watermark applied)           │                           │
│  │  • Edit Photo Metadata                │                           │
│  │  • Delete Photo                       │                           │
│  └──────────────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
                            │
                HTTP Requests│
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (ROUTES)                          │
│                                                                       │
│  ┌──────────────────────────────┐  ┌─────────────────────────────┐ │
│  │  /api/watermarks             │  │  /api/photos                │ │
│  │  ───────────────────────────  │  │  ───────────────────────────│ │
│  │  POST   - Create             │  │  POST   - Upload (auto-)    │ │
│  │  GET    - List               │  │  GET    - List All          │ │
│  │  GET/:id - Get One           │  │  PUT/:id - Update           │ │
│  │  PUT/:id - Update            │  │  DELETE - Delete            │ │
│  │  DELETE - Delete             │  │                             │ │
│  │  PATCH/:id/toggle - Toggle   │  │                             │ │
│  └──────────────────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                            │
                Database Ops│
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND CONTROLLERS                               │
│                                                                       │
│  ┌──────────────────────────────┐  ┌─────────────────────────────┐ │
│  │  watermark.controller.js     │  │  photo.controller.js        │ │
│  │  ───────────────────────────  │  │  ───────────────────────────│ │
│  │  • CRUD operations            │  │  • uploadPhoto()            │ │
│  │  • Handle requests            │  │    - Fetch active WM        │ │
│  │  • Cache management           │  │    - Apply watermark        │ │
│  │  • Validation                 │  │    - Process image          │ │
│  │  • Error handling             │  │    - Save to DB             │ │
│  └──────────────────────────────┘  │  • updatePhoto()            │ │
│                                     │  • listPhotos()             │ │
│                                     │  • deletePhoto()            │ │
│                                     └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴────────┐
                    ↓                ↓
        ┌──────────────────┐  ┌─────────────────┐
        │  CACHE (Redis)   │  │  IMAGE PROC     │
        │  ───────────────  │  │  ─────────────  │
        │  Watermark Cache  │  │  Sharp Library  │
        │  (1 hour TTL)     │  │  • Apply WM     │
        │  • Get active WM  │  │  • Resize       │
        │  • Invalidate     │  │  • Optimize     │
        └──────────────────┘  └─────────────────┘
                    │                ↓
                    └───────┬────────/
                            ↓
        ┌──────────────────────────────────┐
        │        DATABASE (MongoDB)        │
        │  ──────────────────────────────  │
        │  Collections:                    │
        │  ├── Watermarks               │
        │  │   └── Active templates      │
        │  ├── Photos                    │
        │  │   └── With watermark data   │
        │  └── Users                     │
        └──────────────────────────────────┘
                            │
                            ↓
        ┌──────────────────────────────────┐
        │    FILE STORAGE (/uploads)       │
        │  ──────────────────────────────  │
        │  ├── watermarked-*.jpg           │
        │  └── thumbnail-*.jpg             │
        └──────────────────────────────────┘
```

---

## Photo Upload Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: ADMIN UPLOADS PHOTO                                         │
│ ─────────────────────────────────────────────────────────────────── │
│ • Click "Add Photo" at /admin/photos                                │
│ • Select image file                                                 │
│ • Fill: Title, Category, Price, License (optional)                 │
│ • Click "Upload"                                                    │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: FORM VALIDATION (FRONTEND)                                  │
│ ─────────────────────────────────────────────────────────────────── │
│ • Validate image file type (must be image)                          │
│ • Validate file size (max 5MB)                                      │
│ • Validate required fields (title, category)                        │
│ • Create FormData object                                            │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: SEND TO BACKEND                                             │
│ ─────────────────────────────────────────────────────────────────── │
│ POST /api/photos                                                    │
│ Content: FormData with file + metadata                              │
│ Auth: Bearer token (admin only)                                     │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: BACKEND RECEIVES REQUEST                                    │
│ ─────────────────────────────────────────────────────────────────── │
│ • Validate authentication (must be admin)                           │
│ • Extract file from request                                         │
│ • Extract metadata from body                                        │
│ • Validate required fields                                          │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: FETCH ACTIVE WATERMARK                                      │
│ ─────────────────────────────────────────────────────────────────── │
│ • Check Redis cache for 'watermark:default:active'                 │
│ • If found: Use cached watermark                                    │
│ • If not: Query database for first active watermark                │
│ • Save to cache (1 hour TTL)                                        │
│ • Fallback: Use default text watermark if none found                │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: PROCESS IMAGE WITH WATERMARK                                │
│ ─────────────────────────────────────────────────────────────────── │
│ processPhotoWithWatermark(imageBuffer, watermarkConfig)             │
│                                                                      │
│ A. Apply Watermark                                                  │
│    • If text: Create SVG overlay with text styling                 │
│    • If image: Resize and compose with main image                  │
│    • Apply opacity and positioning                                  │
│                                                                      │
│ B. Create Watermarked Image                                         │
│    • Resize to 1600px max width (maintain aspect ratio)            │
│    • Compress with 88% quality JPEG                                │
│    • Enable progressive encoding                                    │
│    • Return buffer + metadata                                       │
│                                                                      │
│ C. Create Thumbnail                                                 │
│    • Resize to 400x400 (cover fit)                                 │
│    • Compress with 70% quality JPEG                                │
│    • Return buffer + size metadata                                  │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: SAVE FILES TO DISK                                          │
│ ─────────────────────────────────────────────────────────────────── │
│ uploadPhotoFile() × 2                                               │
│                                                                      │
│ File 1: Watermarked Image                                           │
│ • Path: /uploads/photos/watermarked-{slug}-{timestamp}.jpg         │
│ • Size: ~300-500KB (depends on dimensions)                         │
│ • Used for: Display + Download                                      │
│                                                                      │
│ File 2: Thumbnail                                                   │
│ • Path: /uploads/photos/thumbnail-{slug}-{timestamp}.jpg           │
│ • Size: ~30-50KB                                                    │
│ • Used for: Gallery preview                                         │
│                                                                      │
│ Returns: URL paths for both files                                   │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: EXTRACT EXIF METADATA                                       │
│ ─────────────────────────────────────────────────────────────────── │
│ • Parse image buffer for EXIF data                                  │
│ • Extract: Camera, Lens, ISO, Aperture, Shutter Speed              │
│ • Extract: Photo date                                               │
│ • Fallback: Use defaults from request body                          │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 9: CREATE PHOTO DOCUMENT                                       │
│ ─────────────────────────────────────────────────────────────────── │
│ new Photo({                                                         │
│   title,                                                            │
│   slug: `${slug}-${timestamp}`,                                     │
│   description,                                                      │
│   category,                                                         │
│   watermark: {                                                      │
│     type: 'text',                                                   │
│     text: { content, position, fontSize, opacity, color }           │
│   },                                                                │
│   watermarkedImage: { url, size, width, height },                  │
│   thumbnail: { url, size },                                         │
│   metadata: { camera, lens, iso, aperture, shutterSpeed },         │
│   pricing: { price, currency, license },                           │
│   status: { published, featured, archived },                        │
│   uploadedBy: req.user._id                                          │
│ })                                                                  │
│                                                                      │
│ • Validate all required fields                                      │
│ • Generate unique slug                                              │
│ • Set upload timestamp                                              │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 10: SAVE TO DATABASE                                           │
│ ─────────────────────────────────────────────────────────────────── │
│ • Insert photo document                                             │
│ • MongoDB validates schema                                          │
│ • Create indexes                                                    │
│ • Return saved document with _id                                    │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 11: INVALIDATE CACHE                                           │
│ ─────────────────────────────────────────────────────────────────── │
│ • Clear: photos:published:*                                         │
│ • Clear: photos:featured                                            │
│ • Reason: Photo list cache needs update                             │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 12: SEND SUCCESS RESPONSE                                      │
│ ─────────────────────────────────────────────────────────────────── │
│ HTTP 201 Created                                                    │
│ {                                                                   │
│   "success": true,                                                  │
│   "message": "Photo uploaded and watermarked successfully",         │
│   "photo": {                                                        │
│     "_id": "...",                                                   │
│     "title": "...",                                                 │
│     "slug": "...",                                                  │
│     "watermarkType": "text",                                        │
│     "watermarked": "/uploads/photos/watermarked-...jpg",           │
│     "thumbnail": "/uploads/photos/thumbnail-...jpg"                │
│   }                                                                 │
│ }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 13: DISPLAY IN UI                                              │
│ ─────────────────────────────────────────────────────────────────── │
│ • Frontend receives response                                        │
│ • Shows success message                                             │
│ • Closes upload modal                                               │
│ • Refreshes photo list                                              │
│ • New photo appears in table with watermark info                    │
│ • Thumbnail visible in photo grid                                   │
│ • Full watermarked image visible in preview                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Watermark Template Management Flow

```
┌──────────────────────────────────────────────────────────┐
│ CREATE WATERMARK TEMPLATE                                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 1. Admin goes to /admin/watermarks                       │
│ 2. Clicks "Create Watermark"                             │
│ 3. Fills form:                                           │
│    ├── Name: "Default Watermark"                         │
│    ├── Description: "For all landscape photos"           │
│    ├── Type: Text                                        │
│    ├── Content: "Wonder Travelers"                       │
│    ├── Position: Bottom Right                            │
│    ├── Font Size: 40px                                   │
│    ├── Opacity: 70%                                      │
│    └── Color: #FFFFFF                                    │
│ 4. Sees live preview                                     │
│ 5. Clicks "Create Watermark"                             │
│                                                          │
│ Backend:                                                 │
│ POST /api/watermarks                                     │
│ ├── Validate form data                                   │
│ ├── Check name uniqueness                                │
│ ├── Create document in MongoDB                           │
│ ├── Invalidate cache                                     │
│ └── Return created watermark                             │
│                                                          │
│ Result:                                                  │
│ ✓ Watermark template saved                               │
│ ✓ Appears in watermark list                              │
│ ✓ Ready to be marked as active                           │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ ACTIVATE WATERMARK                                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 1. In watermark list table                               │
│ 2. Find desired watermark                                │
│ 3. Click "Enable" button                                 │
│                                                          │
│ Backend:                                                 │
│ PATCH /api/watermarks/:id/toggle                         │
│ ├── Find watermark by ID                                 │
│ ├── Toggle isActive status to true                       │
│ ├── Save to database                                     │
│ ├── Invalidate cache                                     │
│ └── Return success                                       │
│                                                          │
│ Result:                                                  │
│ ✓ Watermark marked as Active                             │
│ ✓ Cache cleared                                          │
│ ✓ Next photo upload uses this watermark                 │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ EDIT WATERMARK                                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 1. Click "Edit" on watermark in table                    │
│ 2. Modal opens with form                                 │
│ 3. Form pre-populated with current settings              │
│ 4. Make changes:                                         │
│    • Change text content                                 │
│    • Adjust position                                     │
│    • Change font size                                    │
│    • Modify opacity                                      │
│    • Update color                                        │
│ 5. See live preview update                               │
│ 6. Click "Save Changes"                                  │
│                                                          │
│ Backend:                                                 │
│ PUT /api/watermarks/:id                                  │
│ ├── Validate form data                                   │
│ ├── Check name uniqueness (if changed)                   │
│ ├── Update document in MongoDB                           │
│ ├── Invalidate cache                                     │
│ └── Return updated watermark                             │
│                                                          │
│ Result:                                                  │
│ ✓ Watermark settings updated                             │
│ ✓ Cache cleared                                          │
│ ✓ Next photo uses new settings                           │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ DELETE WATERMARK                                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 1. Click "Delete" on watermark in table                  │
│ 2. Confirmation dialog appears                           │
│ 3. Confirm deletion                                      │
│                                                          │
│ Backend:                                                 │
│ DELETE /api/watermarks/:id                               │
│ ├── Find watermark by ID                                 │
│ ├── Delete from MongoDB                                  │
│ ├── Invalidate cache                                     │
│ └── Return success                                       │
│                                                          │
│ Result:                                                  │
│ ✓ Watermark deleted permanently                          │
│ ✓ Removed from table                                     │
│ ⚠️  If was active, no watermark used for uploads         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
                         REDIS CACHE
                    (In-Memory Storage)
                              │
                              ↓
              ┌───────────────────────────────┐
              │ watermark:default:active      │
              │ ────────────────────────────   │
              │ Content: Active watermark     │
              │ TTL: 3600 seconds (1 hour)    │
              │ Auto-cleared on update        │
              └───────────────────────────────┘
                              │
                              │ On photo upload
                              ↓
        ┌─────────────────────────────────────┐
        │    WATERMARK CONTROLLER             │
        │    ─────────────────────────────     │
        │    getDefaultWatermark()             │
        │    ├── Check cache first             │
        │    ├── If miss: Query database       │
        │    ├── Save to cache                 │
        │    └── Return watermark config       │
        └─────────────────────────────────────┘
                              │
                              │ Watermark config
                              ↓
        ┌─────────────────────────────────────┐
        │    WATERMARK UTILITY                │
        │    ─────────────────────────────     │
        │    processPhotoWithWatermark()       │
        │    ├── Apply watermark to image      │
        │    ├── Create watermarked version    │
        │    ├── Create thumbnail             │
        │    └── Return processed buffers      │
        └─────────────────────────────────────┘
                              │
                              │ File buffers
                              ↓
        ┌─────────────────────────────────────┐
        │    FILE SYSTEM                      │
        │    ─────────────────────────────     │
        │    /uploads/photos/                 │
        │    ├── watermarked-*.jpg            │
        │    └── thumbnail-*.jpg              │
        └─────────────────────────────────────┘
                              │
                              │ File URLs
                              ↓
        ┌─────────────────────────────────────┐
        │    MONGODB DATABASE                 │
        │    ─────────────────────────────     │
        │    Photos Collection                │
        │    ├── Title                        │
        │    ├── Watermark config             │
        │    ├── Image URLs                   │
        │    ├── Metadata                     │
        │    └── Other fields                 │
        └─────────────────────────────────────┘
```

---

## Component Interaction Diagram

```
FRONTEND COMPONENTS
    │
    ├── /admin/watermarks/page.tsx
    │   │
    │   ├── WatermarkTable
    │   │   ├── Columns: [Name, Type, Config, Usage, Status, Actions]
    │   │   └── Actions: [Edit, Delete, Enable/Disable]
    │   │
    │   └── WatermarkModal
    │       ├── CreateMode / EditMode
    │       │
    │       ├── FormFields
    │       │   ├── NameInput
    │       │   ├── DescriptionInput
    │       │   ├── TypeRadioGroup
    │       │   │
    │       │   ├── IF Type = 'text'
    │       │   │   ├── TextContentInput
    │       │   │   ├── PositionSelect
    │       │   │   ├── FontSizeSlider
    │       │   │   ├── OpacitySlider
    │       │   │   └── ColorPicker
    │       │   │
    │       │   └── IF Type = 'image'
    │       │       └── ImageOpacitySlider (coming soon)
    │       │
    │       └── LivePreview
    │           └── Shows text watermark in real-time
    │
    ├── /admin/photos/page.tsx
    │   │
    │   ├── UploadForm
    │   │   ├── FileUpload
    │   │   ├── TitleInput
    │   │   ├── CategorySelect
    │   │   ├── PriceInput
    │   │   └── LicenseSelect
    │   │   (NO watermark options - auto-applied)
    │   │
    │   └── PhotosTable
    │       ├── Columns: [Thumbnail, Title, Category, Watermark, Status, Actions]
    │       └── Watermark shows type + settings applied
    │
    └── components/AdminSidebar.tsx
        └── Menu Items
            ├── Dashboard
            ├── Manage Photos (/admin/photos)
            ├── Photo Watermarks (/admin/watermarks) [NEW]
            └── Other items
```

---

## Technology Stack

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ • React 18+ (with Next.js 16.1.6)                        │
│ • TypeScript                                             │
│ • Ant Design UI Library                                  │
│   ├── Table (for watermark/photo lists)                  │
│   ├── Modal (for forms)                                  │
│   ├── Form (for validation)                              │
│   ├── Slider (for opacity/size)                          │
│   ├── Select (for dropdowns)                             │
│   ├── Radio (for type selection)                         │
│   ├── Button (for actions)                               │
│   ├── Input (for text fields)                            │
│   └── Image (for previews)                               │
│                                                          │
│ • File Upload (image preview)                            │
│ • Color Picker (hex color input)                         │
│ • FormData API (for multipart upload)                    │
│ • Fetch API (for HTTP requests)                          │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    BACKEND                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ • Node.js 18+                                            │
│ • Express.js (API framework)                             │
│ • mongoose (MongoDB ODM)                                 │
│ • Sharp (image processing)                               │
│ • Redis (caching)                                        │
│ • Multer (file upload)                                   │
│ • EXIF Parser (metadata extraction)                      │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   DATABASE                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ • MongoDB (Document database)                            │
│   ├── Watermark Collection                               │
│   │   └── Templates for watermarking                     │
│   │                                                      │
│   └── Photo Collection                                   │
│       └── Photos with watermark metadata                 │
│                                                          │
│ • Redis (Cache layer)                                    │
│   └── Active watermark cache                             │
│                                                          │
│ • File System (/uploads/photos/)                         │
│   ├── Watermarked images                                 │
│   └── Thumbnails                                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Authentication & Authorization Flow

```
        USER ATTEMPTS WATERMARK ACTION
                    │
                    ↓
        IS USER AUTHENTICATED?
        ├─ NO → Return 401 Unauthorized
        │
        └─ YES → Continue
                    │
                    ↓
        IS USER AN ADMIN?
        ├─ NO → Return 403 Forbidden
        │
        └─ YES → Allow action
                    │
                    ├─ CREATE/EDIT/DELETE → Process
                    └─ REQUIRED FIELDS → Validate

        EXAMPLE PERMISSIONS:
        • Create Watermark      → Admin only
        • Edit Watermark        → Admin only
        • Delete Watermark      → Admin only
        • Toggle Status         → Admin only
        • View Watermarks       → Admin only
        • Upload Photo          → Admin only
        • Edit Photo Metadata   → Admin only
```

---

This visual documentation provides a clear understanding of the system architecture and flow.
