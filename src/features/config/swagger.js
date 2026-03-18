// src/config/swagger.js
/**
 * Swagger/OpenAPI Configuration for ChronoVault API
 * Provides auto-generated API documentation at /api-docs
 */

export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ChronoVault API',
      version: '1.0.0',
      description: 'Complete E-Commerce & Auction Backend API with Advanced Security & Verification',
      contact: {
        name: 'ChronoVault Team',
        email: 'support@chronovault.io',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development Server',
      },
      {
        url: process.env.API_BASE_URL || 'http://localhost:5000',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token for authentication',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sid',
          description: 'Session cookie authentication',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            role: { type: 'string', enum: ['user', 'moderator', 'admin'] },
            phoneVerified: { type: 'boolean' },
            twoFactorAuth: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                method: { type: 'string', enum: ['authenticator', 'sms'] },
              },
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            quantity: { type: 'integer' },
            category: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] },
            isFeatured: { type: 'boolean' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            userId: { type: 'string' },
            items: { type: 'array' },
            total: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            error: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        cookieAuth: [],
      },
    ],
  },
  apis: [
    // Centralized JSDoc documentation file - Contains all 158+ endpoint definitions
    './src/config/swagger-endpoints.js',
    // Additional route files for JSDoc comments
    './src/features/auth/auth.routes.js',
    './src/features/auth/oauth.routes.js',
    './src/features/auth/audit.routes.js',
    './src/features/admin/admin.routes.js',
    './src/features/moderator/moderator.routes.js',
    './src/features/category/category.routes.js',
    './src/features/tag/tag.routes.js',
    './src/features/product/product.routes.js',
    './src/features/cart/cart.routes.js',
    './src/features/order/order.routes.js',
    './src/features/wishlist/wishlist.routes.js',
    './src/features/review/review.routes.js',
    './src/features/notification/notification.routes.js',
    './src/features/verification/verification.routes.js',
    './src/features/auction/auction.routes.js',
    './src/features/user/user.routes.js',
  ],
};

/**
 * Swagger UI Options
 * Customizes the appearance and behavior of the Swagger UI
 */
export const swaggerUIOptions = {
  customCss: `
    .swagger-ui .topbar {
      background-color: #1a1a1a;
    }
    .swagger-ui .info .title {
      color: #ff6b35;
      font-weight: bold;
    }
    .swagger-ui .btn-authorize {
      background-color: #ff6b35;
    }
  `,
  customSiteTitle: 'ChronoVault API Docs',
  swaggerUrl: '/swagger.json',
  docExpansion: 'list',
  filter: true,
  showRequestHeaders: true,
  requestSnippetsEnabled: true,
  tryItOutEnabled: true,
};
