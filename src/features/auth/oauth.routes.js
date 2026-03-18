// src/features/auth/oauth.routes.js
// OAuth routes for social login (Google, Facebook, X/Twitter)

import { Router } from 'express';
import passport from 'passport';
import { authMiddleware } from './auth.middleware.js';
import {
  googleOAuthCallback,
  facebookOAuthCallback,
  twitterOAuthCallback,
  linkOAuthAccount,
  unlinkOAuthAccount,
  getConnectedAccounts
} from './oauth.controller.js';

const router = Router();

// ========================
// OAuth Login Routes
// ========================

/**
 * @swagger
 * /api/auth/oauth/google:
 *   get:
 *     summary: Google OAuth Login - Redirects to Google login page
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth provider
 *       400:
 *         description: OAuth authentication failed
 */
router.get('/google', 
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

/**
 * @swagger
 * /api/auth/oauth/google/callback:
 *   get:
 *     summary: Google OAuth Callback handler
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirect to frontend with authentication result
 */
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/login?error=google_auth_failed' }),
  googleOAuthCallback
);

/**
 * @swagger
 * /api/auth/oauth/facebook:
 *   get:
 *     summary: Facebook OAuth Login - Redirects to Facebook login page
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirect to Facebook OAuth provider
 *       400:
 *         description: OAuth authentication failed
 */
router.get('/facebook',
  passport.authenticate('facebook', {
    scope: ['public_profile', 'email']
  })
);

/**
 * @swagger
 * /api/auth/oauth/facebook/callback:
 *   get:
 *     summary: Facebook OAuth Callback handler
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirect to frontend with authentication result
 */
router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/auth/login?error=facebook_auth_failed' }),
  facebookOAuthCallback
);

/**
 * @swagger
 * /api/auth/oauth/twitter:
 *   get:
 *     summary: X/Twitter OAuth Login (OAuth 2.0) - Redirects to X login page
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirect to X OAuth provider
 *       400:
 *         description: OAuth authentication failed
 */
router.get('/twitter',
  passport.authenticate('twitter', {
    scope: ['tweet.read', 'users.read'],
  })
);

/**
 * @swagger
 * /api/auth/oauth/twitter/callback:
 *   get:
 *     summary: X/Twitter OAuth Callback handler
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirect to frontend with authentication result
 */
router.get('/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/auth/login?error=twitter_auth_failed' }),
  twitterOAuthCallback
);

// ========================
// Account Linking Routes (Authenticated)
// ========================

/**
 * @swagger
 * /api/auth/connected-accounts:
 *   get:
 *     summary: Get user's connected OAuth accounts
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of connected accounts retrieved successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.get('/connected-accounts',
  authMiddleware.protect,
  getConnectedAccounts
);

/**
 * @swagger
 * /api/auth/link-oauth:
 *   post:
 *     summary: Link OAuth account to existing user
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, facebook, twitter]
 *             required: [provider]
 *     responses:
 *       200:
 *         description: OAuth account linked successfully
 *       400:
 *         description: OAuth account already linked or linking failed
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.post('/link-oauth',
  authMiddleware.protect,
  linkOAuthAccount
);

/**
 * @swagger
 * /api/auth/oauth/link/google:
 *   get:
 *     summary: Link Google account to authenticated user
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth provider
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.get('/link/google',
  authMiddleware.protect,
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

/**
 * @swagger
 * /api/auth/oauth/link/google/callback:
 *   get:
 *     summary: Google account linking callback
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirect to frontend with linking result
 */
router.get('/link/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/account?error=google_link_failed' }),
  async (req, res) => {
    try {
      const { user: oauthUser } = await import('./oauth.service.js').then(m => m.default.linkOAuthAccount(req.authUser._id, req.user, 'google'));
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/account?success=google_linked`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/account?error=google_link_failed`);
    }
  }
);

/**
 * @swagger
 * /api/auth/oauth/link/facebook:
 *   get:
 *     summary: Link Facebook account to authenticated user
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       302:
 *         description: Redirect to Facebook OAuth provider
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.get('/link/facebook',
  authMiddleware.protect,
  passport.authenticate('facebook', {
    scope: ['public_profile', 'email']
  })
);

/**
 * @swagger
 * /api/auth/oauth/link/facebook/callback:
 *   get:
 *     summary: Facebook account linking callback
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirect to frontend with linking result
 */
router.get('/link/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/auth/account?error=facebook_link_failed' }),
  async (req, res) => {
    try {
      const { user: oauthUser } = await import('./oauth.service.js').then(m => m.default.linkOAuthAccount(req.authUser._id, req.user, 'facebook'));
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/account?success=facebook_linked`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/account?error=facebook_link_failed`);
    }
  }
);

/**
 * @swagger
 * /api/auth/oauth/link/twitter:
 *   get:
 *     summary: Link X/Twitter account to authenticated user
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       302:
 *         description: Redirect to X OAuth provider
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.get('/link/twitter',
  authMiddleware.protect,
  passport.authenticate('twitter', {
    scope: ['tweet.read', 'users.read']
  })
);

/**
 * @swagger
 * /api/auth/oauth/link/twitter/callback:
 *   get:
 *     summary: X/Twitter account linking callback
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirect to frontend with linking result
 */
router.get('/link/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/auth/account?error=twitter_link_failed' }),
  async (req, res) => {
    try {
      const { user: oauthUser } = await import('./oauth.service.js').then(m => m.default.linkOAuthAccount(req.authUser._id, req.user, 'twitter'));
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/account?success=twitter_linked`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/account?error=twitter_link_failed`);
    }
  }
);

/**
 * @swagger
 * /api/auth/oauth/{provider}:
 *   delete:
 *     summary: Unlink OAuth account from user
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [google, facebook, twitter] }
 *     responses:
 *       200:
 *         description: OAuth account unlinked successfully
 *       400:
 *         description: Account not linked or unlinking failed
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.delete('/:provider',
  authMiddleware.protect,
  unlinkOAuthAccount
);

export default router;
