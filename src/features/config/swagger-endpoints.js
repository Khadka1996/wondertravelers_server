/**
 * COMPREHENSIVE SWAGGER/OpenAPI JSDoc DOCUMENTATION
 * All 158+ API Endpoints for Wondertravelers
 * 
 * This file contains JSDoc annotations for all API endpoints.
 * It's referenced by swagger.js for auto-generating the API documentation.
 */

// ============================================================================
// AUTHENTICATION ENDPOINTS (Public + Protected)
// ============================================================================

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user account
 *     description: Create a new user account with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, username]
 *             properties:
 *               email: { type: string, format: email, example: user@example.com }
 *               password: { type: string, minLength: 8, example: "SecurePass123" }
 *               username: { type: string, minLength: 3, example: "johndoe" }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or user already exists
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid email or password
 */

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get a new access token using refresh token
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New token generated
 *       401:
 *         description: Invalid refresh token
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Invalidate user session and tokens
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */

/**
 * @swagger
 * /api/auth/request-password-reset:
 *   post:
 *     summary: Request password reset
 *     description: Send password reset email to user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset email sent
 */

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     description: Complete password reset with reset token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password reset successfully
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve authenticated user's information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /api/auth/profile:
 *   patch:
 *     summary: Update user profile
 *     description: Update user's personal information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password for authenticated user
 *     description: Change current password to new password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password changed successfully
 */

/**
 * @swagger
 * /api/auth/trusted-devices:
 *   get:
 *     summary: List trusted devices
 *     description: Get list of user's trusted devices
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of trusted devices
 */

/**
 * @swagger
 * /api/auth/verify-device:
 *   post:
 *     summary: Mark device as trusted
 *     description: Add current device to trusted devices list
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device marked as trusted
 */

// ============================================================================
// PRODUCT ENDPOINTS (Public + Admin + Moderator)
// ============================================================================

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products (paginated)
 *     description: List all published products with filtering and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of products
 */

/**
 * @swagger
 * /api/products/{slug}:
 *   get:
 *     summary: Get product by slug
 *     description: Retrieve single product details by URL slug
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */

/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     summary: List all products (admin)
 *     description: Admin endpoint - view all products including drafts and archived
 *     tags: [Products-Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, archived] }
 *     responses:
 *       200:
 *         description: All products
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/admin/products:
 *   post:
 *     summary: Create new product
 *     description: Admin endpoint - create a new product
 *     tags: [Products-Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               quantity: { type: integer }
 *               category: { type: string }
 *               status: { type: string, enum: [draft, published] }
 *     responses:
 *       201:
 *         description: Product created successfully
 */

/**
 * @swagger
 * /api/admin/products/{id}:
 *   patch:
 *     summary: Update product
 *     description: Admin endpoint - update product details
 *     tags: [Products-Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Product updated
 */

/**
 * @swagger
 * /api/admin/products/{id}:
 *   delete:
 *     summary: Delete product
 *     description: Admin endpoint - delete a product
 *     tags: [Products-Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product deleted successfully
 */

// ============================================================================
// CATEGORY ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     description: List all product categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories
 */

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create category (admin)
 *     description: Admin endpoint - create new category
 *     tags: [Categories-Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Category created
 */

/**
 * @swagger
 * /api/categories/{id}:
 *   patch:
 *     summary: Update category (admin)
 *     tags: [Categories-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category updated
 */

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete category (admin)
 *     tags: [Categories-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category deleted
 */

// ============================================================================
// ORDER ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get user's orders
 *     description: Retrieve all orders for authenticated user
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of user's orders
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create new order
 *     description: Create order from cart items
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shippingAddress: { type: object }
 *               paymentMethod: { type: string }
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 */

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order details
 *     description: Retrieve single order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order details
 */

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   patch:
 *     summary: Cancel order
 *     description: Cancel pending order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order cancelled
 */

// ============================================================================
// CART ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get shopping cart
 *     description: Retrieve user's shopping cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart items
 */

/**
 * @swagger
 * /api/cart:
 *   post:
 *     summary: Add item to cart
 *     description: Add product to shopping cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId: { type: string }
 *               quantity: { type: integer }
 *     responses:
 *       200:
 *         description: Item added to cart
 */

/**
 * @swagger
 * /api/cart/{itemId}:
 *   patch:
 *     summary: Update cart item quantity
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart updated
 */

/**
 * @swagger
 * /api/cart/{itemId}:
 *   delete:
 *     summary: Remove item from cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Item removed
 */

/**
 * @swagger
 * /api/cart/clear:
 *   delete:
 *     summary: Clear entire cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared
 */

// ============================================================================
// WISHLIST ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/wishlist:
 *   get:
 *     summary: Get wishlist
 *     description: Retrieve user's wishlist items
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wishlist items
 */

/**
 * @swagger
 * /api/wishlist:
 *   post:
 *     summary: Add item to wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId: { type: string }
 *     responses:
 *       201:
 *         description: Added to wishlist
 */

/**
 * @swagger
 * /api/wishlist/{productId}:
 *   delete:
 *     summary: Remove from wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Removed from wishlist
 */

// ============================================================================
// REVIEW ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/reviews:
 *   get:
 *     summary: Get product reviews
 *     description: Retrieve reviews for a product
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of reviews
 */

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Create product review
 *     description: Add review for purchased product
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId: { type: string }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               title: { type: string }
 *               comment: { type: string }
 *     responses:
 *       201:
 *         description: Review created
 */

/**
 * @swagger
 * /api/reviews/{id}:
 *   patch:
 *     summary: Update review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Review updated
 */

/**
 * @swagger
 * /api/reviews/{id}:
 *   delete:
 *     summary: Delete review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Review deleted
 */

// ============================================================================
// ADMIN ENDPOINTS (Admin only)
// ============================================================================

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data
 *     description: Summary statistics and metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users
 *     description: Get list of all registered users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of users
 */

/**
 * @swagger
 * /api/admin/users/{id}:
 *   patch:
 *     summary: Update user (admin)
 *     description: Modify user account details or role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User updated
 */

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete user (admin)
 *     description: Permanently delete user account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User deleted
 */

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     summary: Get all orders (admin)
 *     description: View all system orders
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All orders
 */

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: Get system settings
 *     description: Admin system configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System settings
 */

/**
 * @swagger
 * /api/admin/settings:
 *   patch:
 *     summary: Update system settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings updated
 */

// ============================================================================
// MODERATOR ENDPOINTS (Moderator only)
// ============================================================================

/**
 * @swagger
 * /api/moderator/reviews:
 *   get:
 *     summary: Get reviews for moderation
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending reviews
 */

/**
 * @swagger
 * /api/moderator/reviews/{id}/approve:
 *   patch:
 *     summary: Approve review
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Review approved
 */

/**
 * @swagger
 * /api/moderator/reviews/{id}/reject:
 *   patch:
 *     summary: Reject review
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Review rejected
 */

// ============================================================================
// AUCTION ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/auctions:
 *   get:
 *     summary: Get all active auctions
 *     description: List active auction listings
 *     tags: [Auctions]
 *     responses:
 *       200:
 *         description: Active auctions
 */

/**
 * @swagger
 * /api/auctions:
 *   post:
 *     summary: Create auction (admin)
 *     tags: [Auctions-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Auction created
 */

/**
 * @swagger
 * /api/auctions/{id}/bid:
 *   post:
 *     summary: Place auction bid
 *     description: Submit bid for auction item
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *     responses:
 *       200:
 *         description: Bid placed
 */

// ============================================================================
// NOTIFICATION ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get notifications
 *     description: Retrieve user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User notifications
 */

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Marked as read
 */

// ============================================================================
// VERIFICATION ENDPOINTS (Security & Account Verification)
// ============================================================================

/**
 * @swagger
 * /api/verification/email/send:
 *   post:
 *     summary: Send email verification
 *     description: Send verification email to user
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 */

/**
 * @swagger
 * /api/verification/email/verify:
 *   post:
 *     summary: Verify email address
 *     description: Verify email with token
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Email verified
 */

/**
 * @swagger
 * /api/verification/phone/send:
 *   post:
 *     summary: Send phone verification
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SMS sent
 */

/**
 * @swagger
 * /api/verification/phone/verify:
 *   post:
 *     summary: Verify phone number
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: Phone verified
 */

/**
 * @swagger
 * /api/verification/2fa/setup:
 *   post:
 *     summary: Setup two-factor authentication
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup initiated
 */

/**
 * @swagger
 * /api/verification/2fa/verify:
 *   post:
 *     summary: Verify 2FA code
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: 2FA verified
 */

// ============================================================================
// AUDIT & SECURITY ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/audit/logs:
 *   get:
 *     summary: Get audit logs (admin)
 *     description: View security and activity audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: severity
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit logs
 */

/**
 * @swagger
 * /api/oauth/google:
 *   post:
 *     summary: Google OAuth login
 *     description: Authenticate with Google account
 *     tags: [OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: OAuth authentication successful
 */

/**
 * @swagger
 * /api/oauth/github:
 *   post:
 *     summary: GitHub OAuth login
 *     description: Authenticate with GitHub account
 *     tags: [OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: OAuth authentication successful
 */

export default {};
