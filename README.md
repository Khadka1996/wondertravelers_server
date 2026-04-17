# Wondertravelers API

## Overview
Wondertravelers is a comprehensive backend API designed for e-commerce and auction platforms. It includes advanced security, user verification, and performance monitoring features.

## Features
- **Authentication**: Secure user authentication with JWT and OAuth support.
- **Authorization**: Role-based access control for users, admins, and moderators.
- **Audit Logging**: Tracks sensitive actions and logs them for security purposes.
- **Performance Monitoring**: Collects and analyzes server metrics.
- **Rate Limiting**: Protects against abuse with configurable rate limits.
- **Swagger Documentation**: Auto-generated API documentation available at `/api-docs`.
- **Health Check**: Endpoint to monitor server health at `/health`.
- **GeoIP Integration**: Tracks geolocation data for requests.
- **Email Notifications**: Sends alerts and updates to users.
- **Redis Integration**: Caching and session management.

## Prerequisites
- Node.js (v16 or higher)
- MongoDB
- Redis

## Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and configure the following variables:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/wondertravelers
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development
   ```

## Scripts
- **Start Development Server**:
  ```bash
  npm run dev
  ```
- **Start Production Server**:
  ```bash
  npm start
  ```

## Folder Structure
```
server/
├── src/
│   ├── app.js               # Main application setup
│   ├── server.js            # Server entry point
│   ├── features/            # Feature-specific modules
│   │   ├── auth/            # Authentication and authorization
│   │   ├── analytics/       # Analytics and reporting
│   │   ├── backup/          # Backup and restore
│   │   ├── config/          # Configuration files
│   │   ├── moderator/       # Moderator-specific features
│   │   ├── notification/    # Notifications
│   │   ├── perf/            # Performance monitoring
│   │   ├── user/            # User management
│   │   └── verification/    # User verification
│   ├── middleware/          # Express middleware
│   ├── models/              # Mongoose models
│   ├── routes/              # API routes
│   ├── services/            # Business logic
│   └── utils/               # Utility functions
├── .env                     # Environment variables
├── package.json             # Project metadata and dependencies
└── README.md                # Project documentation
```

## API Endpoints
### Authentication
- `POST /api/auth/register`: Register a new user.
- `POST /api/auth/login`: Log in a user.
- `POST /api/auth/logout`: Log out a user.

### Health Check
- `GET /health`: Check server health.

### Documentation
- `GET /api-docs`: View Swagger API documentation.

## Contributing
1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your message here"
   ```
4. Push to the branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a pull request.

## License
This project is licensed under the ISC License. See the LICENSE file for details.

## Contact
For support, contact the Wondertravelers team at [support@wondertravelers.io](mailto:support@wondertravelers.io).