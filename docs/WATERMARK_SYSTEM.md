# Watermark Management System

## Overview

The watermark management system automatically applies watermarks to photos when they are uploaded or managed. The watermark settings are managed as reusable templates in the `/admin/watermarks` page.

## How It Works

### 1. **Create Watermark Templates**
- Go to `http://localhost:3000/admin/watermarks`
- Click "Create Watermark" button
- Define watermark settings:
  - **Name**: Template name (e.g., "Default Text Watermark")
  - **Description**: What it's used for
  - **Type**: Text or Image
  - **Text Watermark Settings**:
    - Content: The text to display
    - Position: top-left, top-right, bottom-left, bottom-right, or center
    - Font Size: 10-100px
    - Opacity: 0-100%
    - Color: Hex color picker
  - **Status**: Active/Inactive toggle

### 2. **Set Active Watermark**
- Only **active** watermarks are used
- When you create a watermark marked as "Active", it becomes the default watermark
- Toggle watermarks on/off using the "Disable/Enable" button
- First active watermark is automatically applied to all new photo uploads

### 3. **Automatic Watermark Application**
When a photo is uploaded:
1. Backend fetches the first **active** watermark from database
2. Watermark configuration is applied to the image
3. Watermarked image is saved to disk
4. Photo document is saved with watermark metadata to database

### 4. **Watermark Caching**
- Active watermark is cached for 1 hour
- Cache is automatically invalidated when:
  - A new watermark is created
  - Watermark settings are updated
  - Watermark status is toggled
- Ensures latest watermark settings are used

## Backend Implementation

### Database Models

#### Photo Model (`server/src/features/photo/photo.model.js`)
```javascript
watermark: {
  type: { type: String, enum: ['text', 'image'], default: 'text' },
  text: {
    content: String,
    position: String, // 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'
    fontSize: Number,
    opacity: Number, // 0-1
    color: String // hex color
  },
  imageUrl: String,
  opacity: Number // 0-1
}
```

#### Watermark Model (`server/src/features/watermark/watermark.model.js`)
```javascript
{
  name: String, // Required, unique
  description: String,
  type: String, // 'text' or 'image'
  text: { // Text watermark config
    content: String,
    position: String,
    fontSize: Number,
    opacity: Number,
    color: String
  },
  imageUrl: String,
  imageOpacity: Number,
  isActive: Boolean,
  usageCount: Number,
  createdBy: ObjectId (User ref),
  createdAt: Date,
  updatedAt: Date
}
```

### API Endpoints

#### Watermark Endpoints (`/api/watermarks`)
- **POST** `/api/watermarks` - Create watermark template
- **GET** `/api/watermarks` - List all watermarks (with pagination)
- **GET** `/api/watermarks/:id` - Get single watermark
- **PUT** `/api/watermarks/:id` - Update watermark settings
- **DELETE** `/api/watermarks/:id` - Delete watermark template
- **PATCH** `/api/watermarks/:id/toggle` - Toggle active status

#### Photo Endpoints
- **POST** `/api/photos` - Upload photo (auto-applies active watermark)
- **GET** `/api/photos/admin/all` - List all photos with watermark info
- **PUT** `/api/photos/:id` - Update photo metadata or watermark settings

### Watermark Processing Pipeline

1. **Image Upload** (`photo.controller.js`)
   - Receives image file
   - Fetches active watermark from database
   - Calls watermark utility

2. **Watermark Application** (`watermark.util.js`)
   - Applies text/image watermark to image
   - Creates optimized versions:
     - **Watermarked**: Full-size (1600px max) for display & download
     - **Thumbnail**: 400px for gallery preview

3. **File Storage** (`watermark.util.js`)
   - Saves files to `/uploads/photos/`
   - Returns file URLs

4. **Database Storage** (`photo.controller.js`)
   - Saves photo document with watermark configuration
   - Stores watermark type, settings, and image URLs

## Frontend Implementation

### Watermark Management Page (`/admin/watermarks`)

**Features**:
- Create new watermark templates
- Edit existing watermarks
- Delete watermarks
- Toggle watermark active/inactive status
- View usage count (how many times applied)
- Live preview of text watermarks
- Table of all watermarks with configurations

**Modal Form**:
- Name and description
- Watermark type selection
- Type-specific settings
- Live preview for text watermarks

### Photo Management Page (`/admin/photos`)

**Features**:
- Upload photos (automatically applies active watermark)
- View watermark info on photos
- All photos show watermark type and settings
- Watermark applied before saving to database

## Example Usage

### 1. Create a Watermark Template

```
POST /api/watermarks
{
  "name": "Default Watermark",
  "description": "Default watermark for all photos",
  "type": "text",
  "text": {
    "content": "Wonder Travelers",
    "position": "bottom-right",
    "fontSize": 40,
    "opacity": 0.7,
    "color": "#FFFFFF"
  }
}
```

### 2. Upload a Photo

```
POST /api/photos
Form Data:
- image: <file>
- title: "Mountain View"
- category: "landscapes"
- price: 100
- license: "Standard"
```

Backend automatically:
- Fetches active watermark (from cache or database)
- Applies watermark to image
- Saves watermarked image files
- Stores photo with watermark metadata

### 3. View Photo with Watermark Info

```
GET /api/photos/admin/all
Response includes:
{
  _id: "...",
  title: "Mountain View",
  watermark: {
    type: "text",
    text: {
      content: "Wonder Travelers",
      position: "bottom-right",
      fontSize: 40,
      opacity: 0.7,
      color: "#FFFFFF"
    }
  },
  watermarkedImage: {
    url: "/uploads/photos/watermarked-mountain-view-1234567.jpg",
    width: 1600,
    height: 1200
  }
}
```

## File Structure

```
server/
├── src/
│   ├── features/
│   │   ├── photo/
│   │   │   ├── photo.model.js (includes watermark schema)
│   │   │   ├── photo.controller.js (auto-applies watermark on upload)
│   │   │   └── photo.routes.js
│   │   └── watermark/
│   │       ├── watermark.model.js (watermark template model)
│   │       ├── watermark.controller.js (CRUD operations)
│   │       └── watermark.routes.js
│   └── utils/
│       └── watermark.util.js (applies watermark to image)

client/
└── src/
    └── app/
        └── admin/
            ├── photos/ (upload & manage photos)
            └── watermarks/ (manage watermark templates)
```

## Caching Strategy

**Cache Keys**:
- `watermark:default:active` - Default active watermark (1 hour TTL)
- `photos:published:*` - Published photos (2 hours TTL)
- `photos:featured` - Featured photos (3 hours TTL)

**Cache Invalidation**:
- When watermark is created, updated, or toggled → invalidates `watermark:default:active`
- When photo is uploaded or updated → invalidates `photos:published:*` and `photos:featured`

## Best Practices

1. **Create Multiple Templates**: Create different watermarks for different photo types
2. **Manage Active Status**: Keep only one watermark as active during production
3. **Test Watermark**: Use live preview before saving
4. **Monitor Usage**: Check usage count to see which watermarks are being used most
5. **Update Strategically**: Modify watermark settings during off-peak hours to minimize cache misses

## Troubleshooting

### Photos not showing watermark
- Check if watermark is marked as "Active"
- Verify watermark font size and opacity
- Clear cache: `redis-cli FLUSHDB`

### Watermark not updating
- Toggle watermark status off/on
- Check browser cache (Ctrl+F5)
- Verify watermark was saved successfully

### Performance issues
- Check watermark cache is working
- Monitor Redis connection
- Verify image processing is not slow

## Future Enhancements

- [ ] Custom image watermarks with positioning
- [ ] Batch apply watermark to existing photos
- [ ] Watermark preview before photo upload
- [ ] Schedule watermark changes
- [ ] Watermark analytics and usage tracking
