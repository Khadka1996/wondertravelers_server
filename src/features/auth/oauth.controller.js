// src/features/auth/oauth.controller.js
// OAuth authentication handlers for social login

import { OAuthService } from './oauth.service.js';
import { authService } from './auth.service.js';
import { logger } from '../../utils/logger.util.js';

// OAuth cookies must survive cross-origin browser requests from the frontend.
// Use the cross-site cookie settings that browsers require for this flow.
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const useSecureCookies = isProd; // ✅ Only use secure cookies in production (HTTPS)
const cookieSameSite = isProd ? 'None' : 'Lax'; // ✅ Use 'Lax' in dev (localhost), 'None' in prod

// ✅ IMPORTANT: For cross-domain frontend (www.wondertravelers.com) and backend (wonder.shirijanga.com):
// - In production: Use 'None' to allow cookies on ALL cross-origin requests (REQUIRED for different domains)
// - In development (localhost): Use 'Lax' with secure: false (HTTP allowed)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: useSecureCookies,
  sameSite: cookieSameSite,
  path: '/', // ✅ FIXED: Changed from '/api' to '/'
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const ACCESS_TOKEN_OPTIONS = {
  httpOnly: true,
  secure: useSecureCookies,
  sameSite: cookieSameSite,
  path: '/', // ✅ FIXED: Changed from '/api' to '/'
  maxAge: 15 * 60 * 1000,
};

/**
 * Google OAuth Callback Handler
 */
export const googleOAuthCallback = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Google authentication failed' 
      });
    }

    const { user, isNewUser } = await OAuthService.findOrCreateUser(req.user, 'google');

    // Generate tokens
    const accessToken = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken(user);

    // Set cookies
    res.cookie('accessToken', accessToken, ACCESS_TOKEN_OPTIONS);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    logger.info('Google OAuth login successful', { 
      userId: user._id, 
      email: user.email,
      isNewUser
    });

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = new URL(`${frontendUrl}/auth/oauth-success`);
    redirectUrl.searchParams.append('provider', 'google');
    redirectUrl.searchParams.append('isNewUser', isNewUser);
    redirectUrl.searchParams.append('accessToken', accessToken);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('Google OAuth callback error', { error: error.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/login?error=google_auth_failed`);
  }
};

/**
 * Facebook OAuth Callback Handler
 */
export const facebookOAuthCallback = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Facebook authentication failed' 
      });
    }

    const { user, isNewUser } = await OAuthService.findOrCreateUser(req.user, 'facebook');

    // Generate tokens
    const accessToken = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken(user);

    // Set cookies
    res.cookie('accessToken', accessToken, ACCESS_TOKEN_OPTIONS);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    logger.info('Facebook OAuth login successful', { 
      userId: user._id, 
      email: user.email,
      isNewUser
    });

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = new URL(`${frontendUrl}/auth/oauth-success`);
    redirectUrl.searchParams.append('provider', 'facebook');
    redirectUrl.searchParams.append('isNewUser', isNewUser);
    redirectUrl.searchParams.append('accessToken', accessToken);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('Facebook OAuth callback error', { error: error.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/login?error=facebook_auth_failed`);
  }
};

/**
 * X/Twitter OAuth Callback Handler
 */
export const twitterOAuthCallback = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Twitter authentication failed' 
      });
    }

    const { user, isNewUser } = await OAuthService.findOrCreateUser(req.user, 'twitter');

    // Generate tokens
    const accessToken = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken(user);

    // Set cookies
    res.cookie('accessToken', accessToken, ACCESS_TOKEN_OPTIONS);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    logger.info('Twitter OAuth login successful', { 
      userId: user._id, 
      email: user.email,
      isNewUser
    });

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = new URL(`${frontendUrl}/auth/oauth-success`);
    redirectUrl.searchParams.append('provider', 'twitter');
    redirectUrl.searchParams.append('isNewUser', isNewUser);
    redirectUrl.searchParams.append('accessToken', accessToken);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('Twitter OAuth callback error', { error: error.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/login?error=twitter_auth_failed`);
  }
};

/**
 * Link OAuth account to existing user (authenticated)
 */
export const linkOAuthAccount = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const provider = req.body.provider; // 'google', 'facebook', or 'twitter'
    const oauthProfile = req.user; // From OAuth strategy

    if (!['google', 'facebook', 'twitter'].includes(provider)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid provider' 
      });
    }

    const updatedUser = await OAuthService.linkOAuthAccount(
      req.authUser._id, 
      oauthProfile, 
      provider
    );

    logger.info('OAuth account linked', { 
      userId: req.authUser._id, 
      provider 
    });

    res.json({
      success: true,
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account linked successfully`,
      data: {
        provider,
        email: updatedUser.oauth[provider].email
      }
    });
  } catch (error) {
    logger.error('Link OAuth account error', { error: error.message });
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Unlink OAuth account from user (authenticated)
 */
export const unlinkOAuthAccount = async (req, res) => {
  try {
    const provider = req.params.provider; // 'google', 'facebook', or 'twitter'

    if (!['google', 'facebook', 'twitter'].includes(provider)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid provider' 
      });
    }

    const updatedUser = await OAuthService.unlinkOAuthAccount(
      req.authUser._id, 
      provider
    );

    logger.info('OAuth account unlinked', { 
      userId: req.authUser._id, 
      provider 
    });

    res.json({
      success: true,
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully`
    });
  } catch (error) {
    logger.error('Unlink OAuth account error', { error: error.message });
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Get user's connected OAuth accounts (authenticated)
 */
export const getConnectedAccounts = async (req, res) => {
  try {
    const accounts = await OAuthService.getConnectedAccounts(req.authUser._id);

    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    logger.error('Get connected accounts error', { error: error.message });
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export default {
  googleOAuthCallback,
  facebookOAuthCallback,
  twitterOAuthCallback,
  linkOAuthAccount,
  unlinkOAuthAccount,
  getConnectedAccounts
};
