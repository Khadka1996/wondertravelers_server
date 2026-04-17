// src/config/passport.config.js
// Passport.js configuration for OAuth strategies (Google, Facebook, X/Twitter)

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { logger } from '../utils/logger.util.js';

/**
 * Serialize user for session
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser((id, done) => {
  done(null, { id });
});

/**
 * Google OAuth 2.0 Strategy
 * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use('google', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/auth/oauth/google/callback`,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      logger.info('Google OAuth strategy executed', { 
        googleId: profile.id,
        email: profile.emails?.[0]?.value
      });
      
      return done(null, profile);
    } catch (error) {
      logger.error('Google OAuth strategy error', { error: error.message });
      return done(error);
    }
  }));
  
  logger.info('Google OAuth strategy configured');
} else {
  logger.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

/**
 * Facebook OAuth 2.0 Strategy
 * Requires: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
 */
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use('facebook', new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/auth/oauth/facebook/callback`,
    profileFields: ['id', 'displayName', 'photos', 'emails'],
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      logger.info('Facebook OAuth strategy executed', { 
        facebookId: profile.id,
        email: profile.emails?.[0]?.value
      });
      
      return done(null, profile);
    } catch (error) {
      logger.error('Facebook OAuth strategy error', { error: error.message });
      return done(error);
    }
  }));
  
  logger.info('Facebook OAuth strategy configured');
} else {
  logger.warn('Facebook OAuth not configured - missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET');
}

/**
 * X/Twitter OAuth 2.0 Strategy (v2 API)
 * Requires: TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET
 */
if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
  passport.use('twitter', new TwitterStrategy({
    consumerKey: process.env.TWITTER_CLIENT_ID,
    consumerSecret: process.env.TWITTER_CLIENT_SECRET,
    callbackURL: `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/auth/oauth/twitter/callback`,
    includeEmail: true,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      logger.info('Twitter OAuth strategy executed', { 
        twitterId: profile.id,
        email: profile.emails?.[0]?.value
      });
      
      return done(null, profile);
    } catch (error) {
      logger.error('Twitter OAuth strategy error', { error: error.message });
      return done(error);
    }
  }));
  
  logger.info('Twitter OAuth strategy configured');
} else {
  logger.warn('Twitter OAuth not configured - missing TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET');
}

export default passport;

/**
 * Initialize Passport strategies (used in app.js)
 */
export const initializePassportStrategies = (passportInstance) => {
  // Strategies are already configured above via module-level code
  // This function is called to ensure strategies are ready when Passport is initialized
  logger.info('Passport strategies initialization complete');
  return passportInstance;
};
