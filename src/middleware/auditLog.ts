import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import pino from 'pino';

const logger = pino();

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}

// Create an audit log entry
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        userEmail: entry.userEmail,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: JSON.stringify(entry.details || {}),
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        success: entry.success ?? true
      }
    });
  } catch (err) {
    logger.error({ err, entry }, 'Failed to create audit log');
  }
}

// Helper to extract IP from request
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// Log an action from a request context
export async function logAction(
  req: Request,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>,
  success: boolean = true
): Promise<void> {
  await createAuditLog({
    userId: req.user?.id,
    userEmail: req.user?.email,
    action,
    resource,
    resourceId,
    details,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    success
  });
}

// Middleware to automatically log certain admin actions
export function auditAdminActions(req: Request, res: Response, next: NextFunction) {
  // Store original json and render methods
  const originalJson = res.json.bind(res);
  const originalRender = res.render.bind(res);

  // Track if we should log this action
  const method = req.method;
  const path = req.path;

  // Only log state-changing operations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    // Extract resource and action from path
    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[0] || 'unknown';
    const resourceId = pathParts[1];

    let action = 'unknown';
    if (method === 'POST') {
      if (path.includes('/toggle')) {
        action = 'toggle';
      } else if (path.includes('/login')) {
        action = 'login';
      } else if (path.includes('/logout')) {
        action = 'logout';
      } else {
        action = 'create';
      }
    } else if (method === 'PUT' || method === 'PATCH') {
      action = 'update';
    } else if (method === 'DELETE') {
      action = 'delete';
    }

    // Override json to log after response
    res.json = function(body: unknown) {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      logAction(req, action, resource, resourceId, { body }, success).catch(() => {});
      return originalJson(body);
    };
  }

  next();
}

// Get recent audit logs (for admin dashboard)
export async function getRecentAuditLogs(limit: number = 50) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

// Get audit logs for a specific user
export async function getUserAuditLogs(userId: string, limit: number = 50) {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

// Get audit logs for a specific resource
export async function getResourceAuditLogs(resource: string, resourceId?: string, limit: number = 50) {
  return prisma.auditLog.findMany({
    where: {
      resource,
      ...(resourceId ? { resourceId } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}
