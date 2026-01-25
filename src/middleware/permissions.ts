import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';

// Permission codes organized by category
export const PERMISSIONS = {
  // User Management
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',

  // Session Management
  SESSIONS_READ: 'sessions:read',
  SESSIONS_WRITE: 'sessions:write',
  SESSIONS_DELETE: 'sessions:delete',

  // Configuration
  CONFIG_READ: 'config:read',
  CONFIG_WRITE: 'config:write',

  // Sales Content
  CONTENT_READ: 'content:read',
  CONTENT_WRITE: 'content:write',

  // Analytics
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_EXPORT: 'analytics:export',

  // AI Settings
  AI_READ: 'ai:read',
  AI_WRITE: 'ai:write',

  // Audit Logs
  AUDIT_READ: 'audit:read',

  // Webhooks & Integrations
  INTEGRATIONS_READ: 'integrations:read',
  INTEGRATIONS_WRITE: 'integrations:write',

  // Payments
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Default permissions for each role
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  user: [
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.CONTENT_READ,
  ],
  content_manager: [
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_WRITE,
    PERMISSIONS.AI_READ,
  ],
  analyst: [
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.AUDIT_READ,
  ],
  admin: Object.values(PERMISSIONS), // Admin has all permissions
};

// Cache for role permissions to avoid repeated DB queries
const permissionCache = new Map<string, Set<string>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cacheTimestamp = 0;

// Clear cache
export function clearPermissionCache(): void {
  permissionCache.clear();
  cacheTimestamp = 0;
}

// Load permissions for a role from database or cache
async function getPermissionsForRole(role: string): Promise<Set<string>> {
  const now = Date.now();

  // Check cache validity
  if (now - cacheTimestamp > CACHE_TTL) {
    clearPermissionCache();
  }

  // Return cached permissions if available
  if (permissionCache.has(role)) {
    return permissionCache.get(role)!;
  }

  // Query database for role permissions
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role },
    include: { permission: true }
  });

  // If no permissions in DB, use defaults
  let permissions: Set<string>;
  if (rolePermissions.length === 0) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
    permissions = new Set(defaults);
  } else {
    permissions = new Set(rolePermissions.map(rp => rp.permission.code));
  }

  // Cache the result
  permissionCache.set(role, permissions);
  cacheTimestamp = now;

  return permissions;
}

// Check if user has a specific permission
export async function hasPermission(req: Request, permission: PermissionCode): Promise<boolean> {
  if (!req.user) return false;

  // Admin always has all permissions (fallback)
  if (req.user.role === 'admin') return true;

  const permissions = await getPermissionsForRole(req.user.role);
  return permissions.has(permission);
}

// Check if user has any of the specified permissions
export async function hasAnyPermission(req: Request, permissions: PermissionCode[]): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;

  const userPermissions = await getPermissionsForRole(req.user.role);
  return permissions.some(p => userPermissions.has(p));
}

// Check if user has all of the specified permissions
export async function hasAllPermissions(req: Request, permissions: PermissionCode[]): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;

  const userPermissions = await getPermissionsForRole(req.user.role);
  return permissions.every(p => userPermissions.has(p));
}

// Middleware factory for requiring a specific permission
export function requirePermission(permission: PermissionCode) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

    const allowed = await hasPermission(req, permission);
    if (!allowed) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: 'Permission denied', required: permission });
      }
      return res.status(403).render('admin/error', {
        error: `Access denied. You need the "${permission}" permission.`,
        basePath: req.headers['x-forwarded-prefix'] || ''
      });
    }

    next();
  };
}

// Middleware factory for requiring any of the specified permissions
export function requireAnyPermission(permissions: PermissionCode[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

    const allowed = await hasAnyPermission(req, permissions);
    if (!allowed) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: 'Permission denied', required: permissions });
      }
      return res.status(403).render('admin/error', {
        error: `Access denied. You need one of: ${permissions.join(', ')}`,
        basePath: req.headers['x-forwarded-prefix'] || ''
      });
    }

    next();
  };
}

// Seed default permissions into database
export async function seedPermissions(): Promise<void> {
  const permissionDefs = [
    // Users
    { code: PERMISSIONS.USERS_READ, name: 'View Users', category: 'users', description: 'View user list and details' },
    { code: PERMISSIONS.USERS_WRITE, name: 'Manage Users', category: 'users', description: 'Create and edit users' },
    { code: PERMISSIONS.USERS_DELETE, name: 'Delete Users', category: 'users', description: 'Delete user accounts' },

    // Sessions
    { code: PERMISSIONS.SESSIONS_READ, name: 'View Sessions', category: 'sessions', description: 'View training sessions' },
    { code: PERMISSIONS.SESSIONS_WRITE, name: 'Manage Sessions', category: 'sessions', description: 'Edit session data' },
    { code: PERMISSIONS.SESSIONS_DELETE, name: 'Delete Sessions', category: 'sessions', description: 'Delete sessions' },

    // Config
    { code: PERMISSIONS.CONFIG_READ, name: 'View Config', category: 'config', description: 'View app configuration' },
    { code: PERMISSIONS.CONFIG_WRITE, name: 'Edit Config', category: 'config', description: 'Modify app settings' },

    // Content
    { code: PERMISSIONS.CONTENT_READ, name: 'View Content', category: 'content', description: 'View sales content' },
    { code: PERMISSIONS.CONTENT_WRITE, name: 'Edit Content', category: 'content', description: 'Manage sales content' },

    // Analytics
    { code: PERMISSIONS.ANALYTICS_READ, name: 'View Analytics', category: 'analytics', description: 'View reports and analytics' },
    { code: PERMISSIONS.ANALYTICS_EXPORT, name: 'Export Analytics', category: 'analytics', description: 'Export analytics data' },

    // AI
    { code: PERMISSIONS.AI_READ, name: 'View AI Settings', category: 'ai', description: 'View AI configuration' },
    { code: PERMISSIONS.AI_WRITE, name: 'Edit AI Settings', category: 'ai', description: 'Manage AI configuration' },

    // Audit
    { code: PERMISSIONS.AUDIT_READ, name: 'View Audit Logs', category: 'audit', description: 'View audit trail' },

    // Integrations
    { code: PERMISSIONS.INTEGRATIONS_READ, name: 'View Integrations', category: 'integrations', description: 'View webhooks and integrations' },
    { code: PERMISSIONS.INTEGRATIONS_WRITE, name: 'Manage Integrations', category: 'integrations', description: 'Configure integrations' },

    // Payments
    { code: PERMISSIONS.PAYMENTS_READ, name: 'View Payments', category: 'payments', description: 'View payment settings' },
    { code: PERMISSIONS.PAYMENTS_WRITE, name: 'Manage Payments', category: 'payments', description: 'Configure payment gateways' },
  ];

  // Upsert permissions
  for (const perm of permissionDefs) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, category: perm.category, description: perm.description },
      create: perm
    });
  }

  // Seed default role permissions for admin
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: { role: 'admin', permissionId: perm.id }
      },
      update: {},
      create: { role: 'admin', permissionId: perm.id }
    });
  }

  console.log('Permissions seeded successfully');
}
