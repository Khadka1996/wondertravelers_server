// src/features/admin/permission.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

// ========================
// Available Permissions Constant
// ========================
export const AVAILABLE_PERMISSIONS = {
  // User Management
  'users:list': 'View all users list',
  'users:view': 'View single user details',
  'users:deactivate': 'Deactivate user accounts',
  'users:reactivate': 'Reactivate user accounts',
  'users:force-logout': 'Force logout users from all sessions',
  'users:view-history': 'View user login history and audit trail',
  'users:view-activity': 'View user activity audit trail',
  'users:change-role': 'Change user roles (mod/user only)',

  // Security & Audit
  'security:view-dashboard': 'View security dashboard with metrics',
  'security:view-audit-logs': 'View detailed audit logs',
  'security:view-summary': 'View security summary',
  'security:manage-alerts': 'Manage security alerts and notifications',

  // Moderation
  'moderation:moderate-content': 'Moderate reviews and comments',
  'moderation:manage-reports': 'Manage user reports',
  'moderation:approve-reviews': 'Approve or reject reviews',

  // Analytics
  'analytics:view-reports': 'View system reports',
  'analytics:view-metrics': 'View performance metrics',

  // Product Management
  'products:view-all': 'View all products (including drafts, archived, sold)',
  'products:create': 'Create new products',
  'products:edit': 'Edit existing products',
  'products:publish': 'Publish products to live',
  'products:archive': 'Archive products',
  'products:delete': 'Delete products permanently',
  'products:manage-inventory': 'Manage product inventory and stock levels',
  'products:upload-images': 'Upload product images',
  'products:manage-images': 'Manage product images (edit, delete, reorder)',
  'products:manage-pricing': 'Edit product prices and discounts',
  'products:manage-categories': 'Create and edit product categories',
  'products:manage-tags': 'Create and edit product tags',

  // Order Management
  'orders:view-all': 'View all orders in system',
  'orders:view-customer': 'View specific customer orders',
  'orders:manage-status': 'Update order status and fulfillment',
  'orders:process-refunds': 'Process refunds and returns',
  'orders:manage-shipping': 'Manage shipping information',

  // Auction Management (if using auction system)
  'auctions:view-all': 'View all auctions',
  'auctions:create': 'Create auctions',
  'auctions:manage': 'Manage ongoing auctions',
  'auctions:end-early': 'End auctions early',
  'auctions:resolve-disputes': 'Resolve auction disputes',
};

// ========================
// Permission Permission Schema
// ========================
const ModulePermissionSchema = new Schema(
  {
    // ===== Core Fields =====
    // Reference to moderator user
    moderatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Moderator ID is required'],
      index: true,
      validate: {
        async validator(v) {
          const { User } = await import('../auth/auth.model.js');
          const user = await User.findById(v);
          if (!user) {
            throw new Error('Moderator user not found');
          }
          if (!['moderator', 'admin'].includes(user.role)) {
            throw new Error('User must have moderator or admin role');
          }
          return true;
        },
        message: 'Invalid moderator or user does not have moderator role'
      }
    },

    // ===== Permissions =====
    // Array of permission strings
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator(v) {
          return v.every(perm => AVAILABLE_PERMISSIONS[perm]);
        },
        message: 'One or more permissions are not valid. Check AVAILABLE_PERMISSIONS.'
      }
    },

    // ===== Grant Details =====
    // Who granted these permissions (admin user)
    grantedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin who granted permissions is required'],
      index: true
    },

    // When permissions were granted
    grantedAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    // ===== Expiration (Optional) =====
    // When these permissions expire (null = never)
    expiresAt: {
      type: Date,
      default: null,
      index: true
    },

    // ===== Status =====
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    // ===== Metadata =====
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: null
    },

    // Last modified timestamp
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    lastModifiedAt: {
      type: Date,
      default: null
    },

    // Reason for last modification
    modificationReason: {
      type: String,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// ========================
// Indexes
// ========================
ModulePermissionSchema.index({ moderatorId: 1, isActive: 1 });
ModulePermissionSchema.index({ grantedBy: 1, grantedAt: -1 });
// NOTE: expiresAt already has index: true in field definition
ModulePermissionSchema.index({ isActive: 1, expiresAt: 1 });

// ========================
// Virtual Fields
// ========================
ModulePermissionSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > new Date(this.expiresAt);
});

ModulePermissionSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiresAt) return null;
  const now = new Date();
  const expiry = new Date(this.expiresAt);
  const diffMs = expiry - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// ========================
// Instance Methods
// ========================
ModulePermissionSchema.methods.hasPermission = function(permission) {
  // Return false if expired
  if (this.isExpired) return false;
  // Return false if not active
  if (!this.isActive) return false;
  // Check if permission exists
  return this.permissions.includes(permission);
};

ModulePermissionSchema.methods.hasAnyPermission = function(permissions) {
  return permissions.some(perm => this.hasPermission(perm));
};

ModulePermissionSchema.methods.hasAllPermissions = function(permissions) {
  return permissions.every(perm => this.hasPermission(perm));
};

ModulePermissionSchema.methods.grantPermission = function(permission) {
  if (!AVAILABLE_PERMISSIONS[permission]) {
    throw new Error(`Invalid permission: ${permission}`);
  }
  if (!this.permissions.includes(permission)) {
    this.permissions.push(permission);
  }
  return this;
};

ModulePermissionSchema.methods.revokePermission = function(permission) {
  this.permissions = this.permissions.filter(p => p !== permission);
  return this;
};

ModulePermissionSchema.methods.revokeAllPermissions = function() {
  this.permissions = [];
  this.isActive = false;
  return this;
};

ModulePermissionSchema.methods.renewPermissions = function(daysValid = 30) {
  this.expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
  this.isActive = true;
  return this;
};

// ========================
// Static Methods
// ========================
ModulePermissionSchema.statics.getAvailablePermissions = function() {
  return AVAILABLE_PERMISSIONS;
};

ModulePermissionSchema.statics.getPermissionsByCategory = function() {
  const categories = {
    'User Management': [],
    'Security & Audit': [],
    'Moderation': [],
    'Analytics': [],
    'Product Management': [],
    'Order Management': [],
    'Auction Management': []
  };

  Object.entries(AVAILABLE_PERMISSIONS).forEach(([perm, desc]) => {
    if (perm.startsWith('users:')) {
      categories['User Management'].push({ permission: perm, description: desc });
    } else if (perm.startsWith('security:')) {
      categories['Security & Audit'].push({ permission: perm, description: desc });
    } else if (perm.startsWith('moderation:')) {
      categories['Moderation'].push({ permission: perm, description: desc });
    } else if (perm.startsWith('analytics:')) {
      categories['Analytics'].push({ permission: perm, description: desc });
    } else if (perm.startsWith('products:')) {
      categories['Product Management'].push({ permission: perm, description: desc });
    } else if (perm.startsWith('orders:')) {
      categories['Order Management'].push({ permission: perm, description: desc });
    } else if (perm.startsWith('auctions:')) {
      categories['Auction Management'].push({ permission: perm, description: desc });
    }
  });

  return categories;
};

ModulePermissionSchema.statics.findActiveByModerator = function(moderatorId) {
  return this.findOne({
    moderatorId,
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

ModulePermissionSchema.statics.findExpired = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    isActive: true
  });
};

ModulePermissionSchema.statics.deactivateExpiredPermissions = async function() {
  const expired = await this.findExpired();
  const result = await this.updateMany(
    {
      expiresAt: { $lt: new Date() },
      isActive: true
    },
    {
      isActive: false
    }
  );
  return {
    deactivatedCount: result.modifiedCount,
    expiredRecords: expired
  };
};

ModulePermissionSchema.statics.grantPermissionsToMod = async function(
  moderatorId,
  permissions,
  grantedBy,
  options = {}
) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error('Permissions array must not be empty');
  }

  // Validate all permissions
  permissions.forEach(perm => {
    if (!AVAILABLE_PERMISSIONS[perm]) {
      throw new Error(`Invalid permission: ${perm}`);
    }
  });

  const modPermission = await this.findOne({ moderatorId, isActive: true });

  if (modPermission) {
    // Update existing
    modPermission.permissions = [...new Set([...modPermission.permissions, ...permissions])];
    modPermission.lastModifiedBy = grantedBy;
    modPermission.lastModifiedAt = new Date();
    modPermission.modificationReason = options.reason || null;
    if (options.expiresAt) {
      modPermission.expiresAt = options.expiresAt;
    }
    if (options.notes) {
      modPermission.notes = options.notes;
    }
    return modPermission.save();
  } else {
    // Create new
    return this.create({
      moderatorId,
      permissions,
      grantedBy,
      expiresAt: options.expiresAt || null,
      notes: options.notes || null
    });
  }
};

ModulePermissionSchema.statics.revokePermissionsFromMod = async function(
  moderatorId,
  permissions,
  reason = null
) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error('Permissions array must not be empty');
  }

  const modPermission = await this.findOne({ moderatorId, isActive: true });

  if (!modPermission) {
    throw new Error('Moderator permissions not found');
  }

  modPermission.permissions = modPermission.permissions.filter(
    p => !permissions.includes(p)
  );
  modPermission.lastModifiedAt = new Date();
  modPermission.modificationReason = reason;

  // If no permissions left, deactivate
  if (modPermission.permissions.length === 0) {
    modPermission.isActive = false;
  }

  return modPermission.save();
};

// ========================
// Create Model
// ========================
const ModulePermission = mongoose.model(
  'ModulePermission',
  ModulePermissionSchema
);

export { ModulePermission, ModulePermissionSchema };
