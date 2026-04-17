# Blogs API Documentation

## Endpoints

### 1. Get Blogs by Category
**Endpoint:** `/api/blogs/category/:categoryId`

**Method:** `GET`

**Description:** Retrieves blogs under a specific category with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1).
- `limit` (optional): Number of blogs per page (default: 10).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Blog Title",
      "slug": "blog-title",
      "excerpt": "Short description...",
      "author": {
        "name": "Author Name",
        "avatar": "avatar-url",
        "isVerified": true
      },
      "category": {
        "name": "Category Name",
        "slug": "category-slug",
        "color": "#FFFFFF"
      },
      "publishedAt": "2026-02-16T00:00:00.000Z",
      "views": 100,
      "readingTime": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 2. Get Comments for a Blog
**Endpoint:** `/api/blogs/:blogId/comments`

**Method:** `GET`

**Description:** Retrieves all comments for a specific blog.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "blog": "blogId",
      "authorName": "Subash Thapa",
      "content": "This is a comment.",
      "parentComment": null,
      "likes": 5,
      "createdAt": "2026-02-16T00:00:00.000Z",
      "updatedAt": "2026-02-16T00:00:00.000Z"
    }
  ]
}
```

---

### 3. Post a Comment on a Blog
**Endpoint:** `/api/blogs/:blogId/comments`

**Method:** `POST`

**Description:** Posts a new comment on a specific blog.

**Request Body:**
```json
{
  "authorName": "Subash Thapa",
  "content": "This is a comment.",
  "parentComment": "optionalParentCommentId"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "blog": "blogId",
    "authorName": "Subash Thapa",
    "content": "This is a comment.",
    "parentComment": null,
    "likes": 0,
    "createdAt": "2026-02-16T00:00:00.000Z",
    "updatedAt": "2026-02-16T00:00:00.000Z"
  }
}
```

---

### 4. Get Blogs by Tag
**Endpoint:** `/api/blogs/tag/:tag`

**Method:** `GET`

**Description:** Retrieves blogs associated with a specific tag.

**Query Parameters:**
- `page` (optional): Page number (default: 1).
- `limit` (optional): Number of blogs per page (default: 10).

**Response:**
```json
{
  "success": true,
  "data": {
    "tag": "example-tag",
    "blogs": [
      {
        "title": "Blog Title",
        "slug": "blog-title",
        "excerpt": "Short description...",
        "author": {
          "name": "Author Name",
          "avatar": "avatar-url"
        },
        "category": {
          "name": "Category Name",
          "slug": "category-slug"
        },
        "publishedAt": "2026-02-16T00:00:00.000Z",
        "views": 100
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

---

### 5. Post a Blog
**Endpoint:** `/api/blogs`

**Method:** `POST`

**Description:** Creates a new blog.

**Request Body:**
```json
{
  "title": "Blog Title",
  "content": "Blog content...",
  "author": "authorId",
  "category": "categoryId",
  "tags": ["tag1", "tag2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Blog Title",
    "content": "Blog content...",
    "author": "authorId",
    "category": "categoryId",
    "tags": ["tag1", "tag2"],
    "createdAt": "2026-02-16T00:00:00.000Z",
    "updatedAt": "2026-02-16T00:00:00.000Z"
  }
}
```