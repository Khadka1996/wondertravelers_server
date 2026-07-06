# 🎨 Watermark Management System - Complete Guide

## Overview

The Watermark Management System is a complete solution for creating, managing, and applying watermarks to photos. It includes:

- **Admin Panel**: Create/Edit/Delete watermarks with interactive canvas-based positioning
- **Two Watermark Types**: Text watermarks and Image watermarks
- **Automatic Application**: When a photo is uploaded, the active watermark is automatically applied
- **Interactive Positioning**: Drag-and-drop canvas interface to position watermarks precisely
- **Error Handling**: Clear error messages if watermark is not configured

## Features

### 1. **Text Watermarks**
- Custom text content (up to 50 characters)
- Adjustable font size (10-100px)
- Adjustable opacity (0-100%)
- Custom color selection
- Positioned from bottom-right corner with X/Y offset controls

### 2. **Image Watermarks**
- Upload custom image files (PNG, JPG, etc.)
- Scales to 15% of image width
- Adjustable opacity (0-100%)
- Positioned from bottom-right corner with X/Y offset controls

### 3. **Interactive Canvas**
- Real-time preview of watermark positioning
- Drag watermark position on canvas
- Gridlines for precise alignment
- Visual offset indicators

## Step-by-Step Workflow

### Step 1: Create a Watermark

1. Go to **Admin Panel → Watermarks**
2. Click **"Create New Watermark"** button
3. Enter watermark details:
   - **Watermark Name**: Give your watermark a descriptive name (e.g., "Logo Watermark", "Copyright 2024")
   - **Description**: Optional description of this watermark
   - **Type**: Choose between "📝 Text Watermark" or "🖼️ Image Watermark"

### Step 2: Configure Text Watermark (if Text type selected)

1. **Text Content**: Enter the text to display (e.g., "Wonder Travelers", "© My Studio")
2. **Font Size**: Drag slider to adjust (10-100px)
   - Recommended: 40-60px for typical photos
3. **Opacity**: Adjust transparency (0-100%)
   - Recommended: 50-80% for subtle watermark
4. **Color**: Click color picker to choose watermark color
   - White (#FFFFFF) is recommended for text watermarks

### Step 3: Configure Image Watermark (if Image type selected)

1. **Upload Image**: Click "📤 Upload Image" and select your watermark image
   - Recommended formats: PNG (transparent background), SVG, or JPG
   - Recommended size: 500x500px or larger (will auto-scale)
2. **Opacity**: Adjust transparency (0-100%)
   - Recommended: 50-70% for subtle watermark

### Step 4: Position Your Watermark

1. **Canvas Preview**: The canvas shows how your watermark will look
   - Grid helps with alignment
   - Red square/box indicates watermark position
2. **Method 1 - Drag on Canvas**:
   - Click and drag on the canvas to reposition
   - Position is measured from bottom-right corner
3. **Method 2 - Slider Controls**:
   - Use "X Offset" slider (0-200px from right edge)
   - Use "Y Offset" slider (0-200px from bottom edge)
   - Values shown in real-time

### Step 5: Save Watermark

1. Review your settings in the preview canvas
2. Click **"💾 Create Watermark"** (or "💾 Update Watermark" if editing)
3. Success message confirms watermark is saved

### Step 6: Activate Watermark

1. After creation, go back to watermarks list
2. Find your watermark in the table
3. Click **"Activate"** button to make it active
   - Only ONE watermark can be active at a time
   - When you activate one, others are automatically deactivated
4. Green "Active" badge indicates active watermark

### Step 7: Upload Photos

1. Go to **Admin Panel → Photos**
2. Click **"Upload Photo"** button
3. Fill in photo details (title, category, price, etc.)
4. Upload your image file
5. The active watermark will be automatically applied!

## API Endpoints

### Create Watermark
```bash
POST /api/watermarks
Content-Type: application/json

{
  "name": "Logo Watermark",
  "description": "Company logo watermark",
  "type": "image",
  "imageUrl": "/uploads/logo.png",
  "imageXOffset": 30,
  "imageYOffset": 30,
  "imageOpacity": 0.7
}
```

### List Watermarks
```bash
GET /api/watermarks?limit=50
```

### Get Single Watermark
```bash
GET /api/watermarks/:id
```

### Update Watermark
```bash
PUT /api/watermarks/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "type": "text",
  "text": {
    "content": "Wonder Travelers",
    "xOffset": 40,
    "yOffset": 40,
    "fontSize": 45,
    "opacity": 0.75,
    "color": "#FFFFFF"
  }
}
```

### Toggle Active Status
```bash
PATCH /api/watermarks/:id/toggle
```

### Delete Watermark
```bash
DELETE /api/watermarks/:id
```

## Error Messages & Solutions

### ⚠️ "No Active Watermark"
**Problem**: The warning appears in the admin panel
**Solution**: 
1. Create a watermark (optional but recommended)
2. Click "Activate" on that watermark
3. Try uploading a photo again

### ⚠️ "Watermark not configured"
**Problem**: Photo upload fails with this error
**Solution**:
1. Go to Admin → Watermarks
2. Create a new watermark if none exist
3. Click "Activate" on one watermark
4. It will now be applied to all new photo uploads

### ⚠️ "Watermark file not found"
**Problem**: Image watermark references a missing file
**Solution**:
1. Edit the watermark
2. Re-upload the image file
3. Save the watermark again

### ❌ "Failed to process image with watermark"
**Problem**: Generic processing error
**Causes**:
- Watermark is misconfigured
- Image dimensions are too small
- Corrupted image file

**Solution**:
1. Try a different watermark
2. Try a larger image file (min 800x600px)
3. Check that watermark image is valid

## Best Practices

### For Text Watermarks
✅ DO:
- Use simple, readable fonts
- Choose contrasting colors (white text on dark photos)
- Keep text length short (under 30 characters)
- Use opacity around 60-70% for subtlety
- Position at a corner to avoid blocking important content

❌ DON'T:
- Use very small font sizes (hard to read)
- Use similar colors to photo background (becomes invisible)
- Make watermark too large (blocks photo content)
- Make opacity too low (watermark becomes invisible)

### For Image Watermarks
✅ DO:
- Use images with transparent backgrounds (PNG)
- Keep image dimensions square (1:1 ratio)
- Use opacity around 50-60% for subtlety
- Position in corner that doesn't block main subject
- Use high-quality logo/image files

❌ DON'T:
- Use very large images (will dominate photo)
- Use opaque backgrounds (looks unprofessional)
- Use tiny images (hard to see)
- Position over main subject of photos

### Position Guidelines
- **Bottom-Right Corner**: Most professional position (default)
- **Common Offsets**:
  - Large watermarks: X: 80-100px, Y: 80-100px
  - Medium watermarks: X: 40-60px, Y: 40-60px
  - Small watermarks: X: 20-30px, Y: 20-30px

## Workflow Summary

```
1. Admin Creates Watermark (Text or Image)
   ↓
2. Admin Activates One Watermark
   ↓
3. User Uploads Photo
   ↓
4. System Retrieves Active Watermark
   ↓
5. System Applies Watermark to Photo
   ↓
6. System Saves Watermarked Image
   ↓
7. User Gets Photo with Watermark Applied
```

## Technical Details

### Positioning System
- **Origin**: Bottom-right corner of image
- **X Offset**: Distance from right edge (0-200px)
- **Y Offset**: Distance from bottom edge (0-200px)
- **Formula**: `position_x = image_width - watermark_width - x_offset`
- **Formula**: `position_y = image_height - watermark_height - y_offset`

### Image Processing
- **Text Watermark**: SVG overlay with anti-aliasing
- **Image Watermark**: Resized to 15% of photo width, composite overlayed
- **Thumbnail**: 400px square JPEG (quality 70) for gallery
- **Main Image**: 1600px max dimension JPEG (quality 88) for download

### Database Storage
Watermarks are stored in MongoDB with the following structure:
```javascript
{
  name: String,
  description: String,
  type: String, // 'text' or 'image'
  text: {
    content: String,
    xOffset: Number,
    yOffset: Number,
    fontSize: Number,
    opacity: Number,
    color: String
  },
  imageUrl: String,
  imageXOffset: Number,
  imageYOffset: Number,
  imageOpacity: Number,
  isActive: Boolean,
  usageCount: Number,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

## Troubleshooting

### Watermark Not Appearing on Photos
1. Check that watermark is marked as "Active" (green badge)
2. Confirm photo upload was successful
3. Check photo dimensions (must be at least 400x300px)
4. Verify watermark settings are saved

### Watermark Looks Wrong
1. Adjust opacity slider to see it better
2. Change position using canvas drag or sliders
3. For text: try larger font size
4. For images: try different color/contrast

### Can't Upload Photos
1. Go to Admin → Watermarks
2. Ensure at least one watermark exists
3. Ensure one watermark has "Active" status (green badge)
4. Try uploading again

## Support & Debugging

### Check Server Logs
Look for logs with `[watermark]` or `[photo]` tags

### Debug Watermark Cache
Watermarks are cached for 1 hour:
- Creating/updating watermark clears cache
- Toggling active status clears cache
- Manual cache clear: restart server

### Test Watermark
1. Create a simple text watermark
2. Activate it
3. Upload a test photo
4. Check if watermark appears on photo
5. If not, check server logs for errors
