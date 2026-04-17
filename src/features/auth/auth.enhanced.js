import { User } from './auth.model.js';

/**
 * Check whether the user has exceeded failed attempts in the last 15 minutes
 * Returns true if threshold reached, false otherwise
 */
export async function checkBruteForce(userId, threshold = 5) {
  if (!userId) return false;

  const user = await User.findById(userId).select('loginAttempts');
  if (!user || !user.loginAttempts) return false;

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const recentFailed = user.loginAttempts.filter(a => !a.success && a.timestamp > fifteenMinutesAgo).length;

  return recentFailed >= threshold;
}

/**
 * Record a login attempt on the user's document
 */
export async function recordLoginAttempt(userId, ip = '0.0.0.0', success = false) {
  if (!userId) return null;

  const user = await User.findById(userId).select('loginAttempts lastFailedLogin');
  if (!user) return null;

  user.loginAttempts.push({ ip, timestamp: new Date(), success });

  if (!success) {
    user.lastFailedLogin = new Date();
  }

  // Keep history reasonable
  if (user.loginAttempts.length > 50) {
    user.loginAttempts = user.loginAttempts.slice(-50);
  }

  await user.save();
  return user;
}
