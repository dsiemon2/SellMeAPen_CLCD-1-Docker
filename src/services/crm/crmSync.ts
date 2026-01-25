/**
 * CRM Sync Service
 * Orchestrates syncing training sessions to connected CRMs
 */

import { prisma } from '../../db/prisma.js';
import * as salesforce from './salesforceClient.js';
import * as hubspot from './hubspotClient.js';
import { calculateSessionScore } from '../scoreCalculator.js';

interface SessionSyncData {
  sessionId: string;
  userName: string;
  userEmail?: string;
  outcome: string;
  score: number;
  grade: string;
  salesMode: string;
  duration: number;
  messageCount: number;
  startedAt: Date;
  endedAt?: Date | null;
}

/**
 * Sync a training session to all connected CRMs
 */
export async function syncSessionToCrm(sessionId: string): Promise<{
  salesforce?: { success: boolean; externalId?: string; error?: string };
  hubspot?: { success: boolean; externalId?: string; error?: string };
}> {
  const results: {
    salesforce?: { success: boolean; externalId?: string; error?: string };
    hubspot?: { success: boolean; externalId?: string; error?: string };
  } = {};

  // Get session data
  const session = await prisma.salesSession.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
      analytics: true,
      messages: { select: { id: true } }
    }
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Get app config for sales mode
  const config = await prisma.appConfig.findFirst();

  // Calculate score from session data
  const sessionScore = await calculateSessionScore(sessionId);
  const score = sessionScore?.total || 0;

  // Build sync data
  const syncData: SessionSyncData = {
    sessionId: session.id,
    userName: session.user?.name || 'Anonymous',
    userEmail: session.user?.email,
    outcome: session.outcome || 'unknown',
    score,
    grade: calculateGrade(score),
    salesMode: config?.salesMode || 'user_sells',
    duration: session.endedAt && session.startedAt
      ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
      : 0,
    messageCount: session.messages.length,
    startedAt: session.startedAt,
    endedAt: session.endedAt
  };

  // Get enabled integrations
  const integrations = await prisma.crmIntegration.findMany({
    where: {
      isEnabled: true,
      isConnected: true
    }
  });

  // Sync to each connected CRM
  for (const integration of integrations) {
    if (integration.provider === 'salesforce') {
      results.salesforce = await syncToSalesforce(integration.id, syncData);
    } else if (integration.provider === 'hubspot') {
      results.hubspot = await syncToHubSpot(integration.id, syncData);
    }
  }

  return results;
}

/**
 * Sync session to Salesforce
 */
async function syncToSalesforce(
  integrationId: string,
  data: SessionSyncData
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  // Create sync log entry
  const syncLog = await prisma.crmSyncLog.create({
    data: {
      integrationId,
      sessionId: data.sessionId,
      syncType: 'create',
      objectType: 'Task',
      status: 'pending',
      requestPayload: JSON.stringify(data)
    }
  });

  try {
    const result = await salesforce.syncTrainingSession(data);

    // Update sync log with success
    await prisma.crmSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        externalId: result.externalId,
        syncType: result.action,
        responseData: JSON.stringify(result)
      }
    });

    // Update integration last sync time
    await prisma.crmIntegration.update({
      where: { provider: 'salesforce' },
      data: {
        lastSyncAt: new Date(),
        lastError: null
      }
    });

    return { success: true, externalId: result.externalId };
  } catch (err: any) {
    // Update sync log with failure
    await prisma.crmSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        errorMessage: err.message
      }
    });

    // Update integration with error
    await prisma.crmIntegration.update({
      where: { provider: 'salesforce' },
      data: {
        lastError: err.message
      }
    });

    console.error('Salesforce sync failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Sync session to HubSpot
 */
async function syncToHubSpot(
  integrationId: string,
  data: SessionSyncData
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  // Create sync log entry
  const syncLog = await prisma.crmSyncLog.create({
    data: {
      integrationId,
      sessionId: data.sessionId,
      syncType: 'create',
      objectType: 'Engagement',
      status: 'pending',
      requestPayload: JSON.stringify(data)
    }
  });

  try {
    const result = await hubspot.syncTrainingSession(data);

    // Update sync log with success
    await prisma.crmSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        externalId: result.externalId,
        syncType: result.action,
        responseData: JSON.stringify(result)
      }
    });

    // Update integration last sync time
    await prisma.crmIntegration.update({
      where: { provider: 'hubspot' },
      data: {
        lastSyncAt: new Date(),
        lastError: null
      }
    });

    return { success: true, externalId: result.externalId };
  } catch (err: any) {
    // Update sync log with failure
    await prisma.crmSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        errorMessage: err.message
      }
    });

    // Update integration with error
    await prisma.crmIntegration.update({
      where: { provider: 'hubspot' },
      data: {
        lastError: err.message
      }
    });

    console.error('HubSpot sync failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Retry a failed sync
 */
export async function retrySyncLog(syncLogId: string): Promise<{
  success: boolean;
  externalId?: string;
  error?: string;
}> {
  const syncLog = await prisma.crmSyncLog.findUnique({
    where: { id: syncLogId },
    include: { integration: true }
  });

  if (!syncLog) {
    throw new Error('Sync log not found');
  }

  if (syncLog.status === 'success') {
    return { success: true, externalId: syncLog.externalId || undefined };
  }

  // Increment retry count
  await prisma.crmSyncLog.update({
    where: { id: syncLogId },
    data: {
      retryCount: syncLog.retryCount + 1,
      status: 'retrying'
    }
  });

  // Parse original data
  const data: SessionSyncData = JSON.parse(syncLog.requestPayload || '{}');

  try {
    let result: { externalId: string; action: string };

    if (syncLog.integration.provider === 'salesforce') {
      result = await salesforce.syncTrainingSession(data);
    } else if (syncLog.integration.provider === 'hubspot') {
      result = await hubspot.syncTrainingSession(data);
    } else {
      throw new Error(`Unknown provider: ${syncLog.integration.provider}`);
    }

    // Update with success
    await prisma.crmSyncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'success',
        externalId: result.externalId,
        syncType: result.action,
        responseData: JSON.stringify(result)
      }
    });

    return { success: true, externalId: result.externalId };
  } catch (err: any) {
    // Update with failure
    await prisma.crmSyncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'failed',
        errorMessage: err.message
      }
    });

    return { success: false, error: err.message };
  }
}

/**
 * Get sync statistics for an integration
 */
export async function getSyncStats(provider: 'salesforce' | 'hubspot'): Promise<{
  total: number;
  success: number;
  failed: number;
  pending: number;
  lastSync?: Date;
}> {
  const integration = await prisma.crmIntegration.findUnique({
    where: { provider }
  });

  if (!integration) {
    return { total: 0, success: 0, failed: 0, pending: 0 };
  }

  const [total, success, failed, pending] = await Promise.all([
    prisma.crmSyncLog.count({ where: { integrationId: integration.id } }),
    prisma.crmSyncLog.count({ where: { integrationId: integration.id, status: 'success' } }),
    prisma.crmSyncLog.count({ where: { integrationId: integration.id, status: 'failed' } }),
    prisma.crmSyncLog.count({ where: { integrationId: integration.id, status: 'pending' } })
  ]);

  return {
    total,
    success,
    failed,
    pending,
    lastSync: integration.lastSyncAt || undefined
  };
}

/**
 * Get recent sync logs for an integration
 */
export async function getRecentSyncLogs(
  provider: 'salesforce' | 'hubspot',
  limit: number = 50
): Promise<Array<{
  id: string;
  sessionId: string | null;
  syncType: string;
  objectType: string;
  externalId: string | null;
  status: string;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
}>> {
  const integration = await prisma.crmIntegration.findUnique({
    where: { provider }
  });

  if (!integration) {
    return [];
  }

  return prisma.crmSyncLog.findMany({
    where: { integrationId: integration.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      sessionId: true,
      syncType: true,
      objectType: true,
      externalId: true,
      status: true,
      errorMessage: true,
      retryCount: true,
      createdAt: true
    }
  });
}

/**
 * Calculate grade from score
 */
function calculateGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Check if any CRM integration is enabled
 */
export async function hasCrmEnabled(): Promise<boolean> {
  const count = await prisma.crmIntegration.count({
    where: {
      isEnabled: true,
      isConnected: true
    }
  });
  return count > 0;
}
