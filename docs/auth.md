# Code Analysis and Documentation

## Endpoints

### Authentication
- `POST /api/auth/register`: Register a new user.
- `POST /api/auth/login`: Log in a user.
- `POST /api/auth/logout`: Log out a user.
- `GET /api/auth/me`: Retrieve the authenticated user's profile.

### Admin
- `GET /api/admin/users`: Retrieve a list of all users.
- `PATCH /api/admin/users/{id}`: Update user details or role.
- `DELETE /api/admin/users/{id}`: Delete a user account.
- `GET /api/admin/settings`: Retrieve system configuration settings.
- `PATCH /api/admin/settings`: Update system configuration settings.

### Moderator
- `GET /api/moderator/status`: Retrieve moderator access status and available endpoints.

### Health Check
- `GET /health`: Check server health.

### Documentation
- `GET /api-docs`: View Swagger API documentation.

---

## Schemas

### User Schema
```json
{
  "id": "string",
  "email": "string",
  "username": "string",
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "role": "string" // Possible values: 'user', 'moderator', 'admin'
}
```

### Admin Settings Schema
```json
{
  "key": "string",
  "value": "string"
}
```

### Product Schema
```json
{
  "_id": "string",
  "title": "string",
  "slug": "string",
  "description": "string",
  "price": "number",
  "quantity": "integer",
  "category": "string",
  "status": "string" // Possible values: 'draft', 'published', 'archived'
}
```

### Order Schema
```json
{
  "_id": "string",
  "userId": "string",
  "items": ["array"],
  "total": "number",
  "status": "string", // Possible values: 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
  "createdAt": "string" // ISO date format
}
```

---

## Workflows

### User Registration
1. User sends a `POST` request to `/api/auth/register` with email, username, and password.
2. Server validates the input using `registerSchema`.
3. If valid, a new user is created in the database.
4. A success response is returned with the user details.

### User Login
1. User sends a `POST` request to `/api/auth/login` with email and password.
2. Server validates the input using `loginSchema`.
3. If valid, a JWT token is generated and returned to the user.

### Fetching User Profile
1. Authenticated user sends a `GET` request to `/api/auth/me`.
2. Server retrieves the user details from the database.
3. A success response is returned with the user profile.

### Admin Updating User Details
1. Admin sends a `PATCH` request to `/api/admin/users/{id}` with updated user details.
2. Server validates the input and checks admin privileges.
3. If valid, the user details are updated in the database.
4. A success response is returned.

### Health Check
1. Any user sends a `GET` request to `/health`.
2. Server checks its uptime and other metrics.
3. A success response is returned with the server status.

---

## Notes
- The application uses `zod` for schema validation.
- Swagger documentation is available at `/api-docs`.
- Redis is used for caching and session management.
- The application follows a modular structure with feature-specific folders.