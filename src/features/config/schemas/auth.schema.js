// src/config/schemas/auth.schema.js
import { z } from 'zod';

// ========================
// Register Schema
// ========================
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(30, { message: 'Username cannot exceed 30 characters' })
    .regex(/^[a-zA-Z0-9_.-]+$/, {
      message: 'Only letters, numbers, underscores, dots and hyphens allowed',
    })
    .trim()
    .toLowerCase(),

  email: z
    .string()
    .email({ message: 'Invalid email format' })
    .max(255)
    .trim()
    .toLowerCase(),

  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(128, { message: 'Password is too long' })
    .regex(/[a-z]/, { message: 'Must contain at least one lowercase letter' })
    .regex(/[A-Z]/, { message: 'Must contain at least one uppercase letter' })
    .regex(/[0-9]/, { message: 'Must contain at least one number' })
    .regex(/[@$!%*?&]/, { message: 'Must contain at least one special character (@$!%*?&)' }),

  fullName: z
    .string()
    .max(100, { message: 'Full name is too long' })
    .trim()
    .optional(),

  avatar: z
    .string()
    .url({ message: 'Invalid URL for avatar' })
    .optional()
    .nullable(),
});

// ========================
// Login Schema
// ========================
export const loginSchema = z.object({
  email: z
    .string()
    .email({ message: 'Invalid email format' })
    .trim()
    .toLowerCase(),

  password: z
    .string()
    .min(1, { message: 'Password is required' }),
});

// ========================
// Refresh Token Schema
// ========================
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, { message: 'Refresh token is required' }),
});

// ========================
// Update Profile Schema
// ========================
export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(30, { message: 'Username cannot exceed 30 characters' })
    .regex(/^[a-zA-Z0-9_.-]+$/, {
      message: 'Only letters, numbers, underscores, dots and hyphens allowed',
    })
    .trim()
    .toLowerCase()
    .optional(),

  fullName: z
    .string()
    .max(100, { message: 'Full name is too long' })
    .trim()
    .optional(),

  avatar: z
    .string()
    .url({ message: 'Invalid URL for avatar' })
    .optional()
    .nullable(),
});

// ========================
// Update Avatar Schema
// ========================
export const updateAvatarSchema = z.object({
  avatar: z
    .string()
    .url({ message: 'Invalid URL for avatar' })
    .max(500, { message: 'Avatar URL too long' })
    .optional()
    .nullable(),
});

// ========================
// Upload Avatar Schema (for file upload metadata)
// ========================
export const uploadAvatarSchema = z.object({
  description: z
    .string()
    .max(200, { message: 'Description too long (max 200 characters)' })
    .optional(),
  // Note: File validation happens in upload.middleware.js
  // This schema is for any additional metadata sent with the upload
});

// ========================
// Delete Account Schema
// ========================
export const deleteMeSchema = z.object({
  password: z
    .string()
    .min(1, { message: 'Password is required for account deletion' }),
});

// ========================
// Change Password Schema
// ========================
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: 'Current password is required' }),

    newPassword: z
      .string()
      .min(8, { message: 'New password must be at least 8 characters' })
      .max(128, { message: 'New password is too long' })
      .regex(/[a-z]/, { message: 'Must contain at least one lowercase letter' })
      .regex(/[A-Z]/, { message: 'Must contain at least one uppercase letter' })
      .regex(/[0-9]/, { message: 'Must contain at least one number' })
      .regex(/[@$!%*?&]/, { message: 'Must contain at least one special character (@$!%*?&)' }),

    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password cannot be the same as current password",
    path: ['newPassword'],
  });

// ========================
// Request Password Reset Schema
// ========================
export const requestPasswordResetSchema = z.object({
  email: z
    .string()
    .email({ message: 'Invalid email format' })
    .trim()
    .toLowerCase(),
});

// ========================
// Reset Password Schema - UPDATED
// ========================
export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .min(1, { message: 'Reset token is required' })
      .min(64, { message: 'Reset token must be at least 64 characters' }), 

    newPassword: z
      .string()
      .min(8, { message: 'New password must be at least 8 characters' })
      .max(128, { message: 'New password is too long' })
      .regex(/[a-z]/, { message: 'Must contain at least one lowercase letter' })
      .regex(/[A-Z]/, { message: 'Must contain at least one uppercase letter' })
      .regex(/[0-9]/, { message: 'Must contain at least one number' })
      .regex(/[@$!%*?&]/, { message: 'Must contain at least one special character (@$!%*?&)' }),

    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ['confirmNewPassword'],
  });


// ========================
// Verify Device Schema
// ========================
export const verifyDeviceSchema = z.object({
  deviceFingerprint: z
    .string()
    .min(1, { message: 'Device fingerprint is required' })
    .max(255, { message: 'Device fingerprint is too long' }),

  deviceName: z
    .string()
    .max(100, { message: 'Device name is too long' })
    .optional(),
});

// ========================
// Remove Device Schema (for params validation)
// ========================
export const removeDeviceSchema = z.object({
  fingerprint: z
    .string()
    .min(1, { message: 'Device fingerprint is required' })
    .max(255, { message: 'Device fingerprint is too long' }),
});

// ========================
// Headers Schema for Device Verification
// ========================
export const deviceHeadersSchema = z.object({
  'x-device-fingerprint': z
    .string()
    .min(1, { message: 'Device fingerprint header is required' }),
});

// ========================
// Email Verification Schema
// ========================
export const verifyEmailSchema = z.object({
  token: z
    .string()
    .min(1, { message: 'Verification token is required' })
    .refine(
      (val) => val.trim().length >= 64, 
      { message: 'Verification token must be at least 64 characters' }
    ),
});

// ========================
// Resend Verification Email Schema
// ========================
export const resendVerificationSchema = z.object({
  email: z
    .string()
    .email({ message: 'Invalid email format' })
    .trim()
    .toLowerCase(),
});

// ========================
// Enable/Disable MFA Schema
// ========================
export const mfaSchema = z.object({
  enable: z.boolean(),
  method: z
    .enum(['totp', 'sms', 'email'])
    .optional()
    .default('totp'),
});

// ========================
// Verify MFA Code Schema
// ========================
export const verifyMfaSchema = z.object({
  code: z
    .string()
    .min(6, { message: 'MFA code must be at least 6 digits' })
    .max(10, { message: 'MFA code is too long' }),
});

// ========================
// Session Management Schema
// ========================
export const sessionSchema = z.object({
  sessionId: z
    .string()
    .min(1, { message: 'Session ID is required' }),
});

// ========================
// Export All Schemas
// ========================
export const authSchemas = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
  updateAvatarSchema,
  uploadAvatarSchema, 
  deleteMeSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyDeviceSchema,
  removeDeviceSchema,
  deviceHeadersSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  mfaSchema,
  verifyMfaSchema,
  sessionSchema,
};

export default authSchemas;