// src/features/auth/oauth.service.js
// OAuth service for social login (Gmail, Facebook, X/Twitter)

import { User } from './auth.model.js';
import { logger } from '../../utils/logger.util.js';

/**
 * OAuth Login Service
 * Handles user authentication via social providers (Gmail, Facebook, X)
 */
export class OAuthService {
  /**
   * Find or create user from OAuth profile
   * @param {Object} profile - OAuth profile data
   * @param {string} provider - OAuth provider (google, facebook, twitter)
   * @returns {Object} - { user, isNewUser, tokens }
   */
  static async findOrCreateUser(profile, provider) {
    try {
      // Construct unique OAuth identifier
      const oauthId = `${provider}_${profile.id}`;
      const email = profile.emails?.[0]?.value || profile.email;

      // Try to find existing user by OAuth ID
      let user = await User.findOne({ [`oauth.${provider}.id`]: profile.id });

      if (user) {
        // User exists, update last login
        user.lastLogin = new Date();
        user.lastLoginProvider = provider;
        
        // Update OAuth profile info if changed
        if (!user.oauth) user.oauth = {};
        if (!user.oauth[provider]) user.oauth[provider] = {};
        
        user.oauth[provider] = {
          id: profile.id,
          email: email,
          name: profile.displayName,
          picture: profile.photos?.[0]?.value,
          updatedAt: new Date()
        };

        await user.save();
        logger.info(`OAuth user updated: ${provider}`, { userId: user._id, email });
        
        return { 
          user, 
          isNewUser: false,
          provider
        };
      }

      // Try to find by email if not found by OAuth ID
      if (email) {
        user = await User.findOne({ email });
        
        if (user) {
          // Link OAuth to existing email account
          if (!user.oauth) user.oauth = {};
          user.oauth[provider] = {
            id: profile.id,
            email: email,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          user.lastLogin = new Date();
          user.lastLoginProvider = provider;
          await user.save();
          
          logger.info(`OAuth linked to existing email: ${provider}`, { userId: user._id, email });
          
          return { 
            user, 
            isNewUser: false,
            provider,
            linkedExisting: true
          };
        }
      }

      // Create new user from OAuth profile
      const newUser = new User({
        email: email || `${oauthId}@oauth.wondertravelers.local`,
        firstName: profile.given_name || profile.first_name || (profile.displayName?.split(' ')[0] || 'User'),
        lastName: profile.family_name || profile.last_name || (profile.displayName?.split(' ')[1] || ''),
        avatar: profile.photos?.[0]?.value,
        isEmailVerified: email ? true : false, // Trust OAuth provider's email
        oauth: {
          [provider]: {
            id: profile.id,
            email: email,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        lastLogin: new Date(),
        lastLoginProvider: provider,
        signupMethod: provider
      });

      await newUser.save();
      logger.info(`New OAuth user created: ${provider}`, { userId: newUser._id, email });

      return { 
        user: newUser, 
        isNewUser: true,
        provider
      };
    } catch (error) {
      logger.error('OAuth user creation failed', { provider, error: error.message });
      throw error;
    }
  }

  /**
   * Link social account to existing user
   * @param {string} userId - User ID
   * @param {Object} profile - OAuth profile
   * @param {string} provider - OAuth provider
   */
  static async linkOAuthAccount(userId, profile, provider) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      if (!user.oauth) user.oauth = {};

      // Check if this OAuth ID is already linked to another user
      const existing = await User.findOne({ 
        [`oauth.${provider}.id`]: profile.id,
        _id: { $ne: userId }
      });

      if (existing) {
        throw new Error(`This ${provider} account is already linked to another user`);
      }

      user.oauth[provider] = {
        id: profile.id,
        email: profile.emails?.[0]?.value || profile.email,
        name: profile.displayName,
        picture: profile.photos?.[0]?.value,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await user.save();
      logger.info(`OAuth account linked: ${provider}`, { userId, email: user.email });

      return user;
    } catch (error) {
      logger.error('OAuth account linking failed', { provider, error: error.message });
      throw error;
    }
  }

  /**
   * Unlink social account from user
   * @param {string} userId - User ID
   * @param {string} provider - OAuth provider to unlink
   */
  static async unlinkOAuthAccount(userId, provider) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Check if user has password (can't unlink only auth method)
      if (!user.password && Object.keys(user.oauth || {}).length === 1) {
        throw new Error('Cannot unlink your only login method. Please set a password first.');
      }

      if (user.oauth?.[provider]) {
        delete user.oauth[provider];
        await user.save();
        logger.info(`OAuth account unlinked: ${provider}`, { userId, email: user.email });
      }

      return user;
    } catch (error) {
      logger.error('OAuth account unlinking failed', { provider, error: error.message });
      throw error;
    }
  }

  /**
   * Get user's connected OAuth accounts
   * @param {string} userId - User ID
   */
  static async getConnectedAccounts(userId) {
    try {
      const user = await User.findById(userId).select('oauth email');
      if (!user) throw new Error('User not found');

      const connected = {};
      if (user.oauth) {
        Object.keys(user.oauth).forEach(provider => {
          connected[provider] = {
            connected: true,
            email: user.oauth[provider].email,
            name: user.oauth[provider].name,
            linkedAt: user.oauth[provider].createdAt
          };
        });
      }

      return connected;
    } catch (error) {
      logger.error('Failed to get connected accounts', { error: error.message });
      throw error;
    }
  }
}

export default OAuthService;
