/**
 * Salesforce API Client
 * Handles Salesforce REST API operations for syncing training sessions
 */

import { prisma } from '../../db/prisma.js';
import { getValidAccessToken } from './crmOAuth.js';

interface SalesforceTask {
  Subject: string;
  Description?: string;
  Status: string;
  Priority: string;
  ActivityDate: string;
  Type?: string;
  [key: string]: any; // Allow custom fields
}

interface SalesforceResponse {
  id: string;
  success: boolean;
  errors: any[];
}

interface SalesforceQueryResult<T> {
  totalSize: number;
  done: boolean;
  records: T[];
}

/**
 * Get Salesforce instance URL from integration
 */
async function getInstanceUrl(): Promise<string | null> {
  const integration = await prisma.crmIntegration.findUnique({
    where: { provider: 'salesforce' }
  });
  return integration?.instanceUrl || null;
}

/**
 * Make authenticated request to Salesforce REST API
 */
async function salesforceRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const accessToken = await getValidAccessToken('salesforce');
  if (!accessToken) {
    throw new Error('Salesforce not connected or token invalid');
  }

  const instanceUrl = await getInstanceUrl();
  if (!instanceUrl) {
    throw new Error('Salesforce instance URL not configured');
  }

  const url = `${instanceUrl}/services/data/v59.0${endpoint}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce API error (${response.status}): ${errorText}`);
  }

  // DELETE requests may not return content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Create a Task (Activity) in Salesforce
 */
export async function createTask(task: SalesforceTask): Promise<string> {
  const result = await salesforceRequest<SalesforceResponse>('/sobjects/Task', 'POST', task);
  if (!result.success) {
    throw new Error(`Failed to create task: ${JSON.stringify(result.errors)}`);
  }
  return result.id;
}

/**
 * Update a Task in Salesforce
 */
export async function updateTask(taskId: string, updates: Partial<SalesforceTask>): Promise<void> {
  await salesforceRequest(`/sobjects/Task/${taskId}`, 'PATCH', updates);
}

/**
 * Create or update a custom object record for training sessions
 */
export async function syncTrainingSession(sessionData: {
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
}): Promise<{ externalId: string; action: 'created' | 'updated' }> {
  // Format as a Salesforce Task
  const task: SalesforceTask = {
    Subject: `Sales Training Session - ${sessionData.grade} Grade`,
    Description: buildSessionDescription(sessionData),
    Status: sessionData.endedAt ? 'Completed' : 'In Progress',
    Priority: sessionData.score >= 80 ? 'High' : (sessionData.score >= 60 ? 'Normal' : 'Low'),
    ActivityDate: sessionData.startedAt.toISOString().split('T')[0],
    Type: 'Training'
  };

  // Get field mappings for custom fields
  const integration = await prisma.crmIntegration.findUnique({
    where: { provider: 'salesforce' },
    include: { fieldMappings: { where: { isEnabled: true } } }
  });

  if (integration?.fieldMappings) {
    for (const mapping of integration.fieldMappings) {
      const value = getFieldValue(sessionData, mapping.sourceField, mapping.transformType, mapping.transformConfig);
      if (value !== undefined) {
        task[mapping.targetField] = value;
      }
    }
  }

  // Check if we already synced this session
  const existingSync = await prisma.crmSyncLog.findFirst({
    where: {
      integrationId: integration?.id,
      sessionId: sessionData.sessionId,
      status: 'success',
      objectType: 'Task'
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existingSync?.externalId) {
    // Update existing task
    await updateTask(existingSync.externalId, task);
    return { externalId: existingSync.externalId, action: 'updated' };
  } else {
    // Create new task
    const taskId = await createTask(task);
    return { externalId: taskId, action: 'created' };
  }
}

/**
 * Build description text for a training session
 */
function buildSessionDescription(sessionData: {
  outcome: string;
  score: number;
  grade: string;
  salesMode: string;
  duration: number;
  messageCount: number;
}): string {
  const outcomeDisplay = sessionData.outcome === 'sale_made' ? 'Sale Made' :
                         sessionData.outcome === 'no_sale' ? 'No Sale' :
                         sessionData.outcome || 'Unknown';

  const modeDisplay = sessionData.salesMode === 'ai_sells' ? 'User as Buyer' :
                      sessionData.salesMode === 'user_sells' ? 'User as Seller' :
                      sessionData.salesMode;

  return `Sales Training Session Summary
================================
Mode: ${modeDisplay}
Outcome: ${outcomeDisplay}
Score: ${sessionData.score}/100 (${sessionData.grade})
Duration: ${Math.round(sessionData.duration / 60)} minutes
Messages: ${sessionData.messageCount}

This activity was logged automatically by SellMeAPen Training Platform.`;
}

/**
 * Get field value from session data with optional transformation
 */
function getFieldValue(
  sessionData: Record<string, any>,
  sourceField: string,
  transformType: string,
  transformConfig: string
): any {
  const rawValue = sessionData[sourceField];

  if (rawValue === undefined) return undefined;

  switch (transformType) {
    case 'map': {
      // Map value using config
      const mapping = JSON.parse(transformConfig || '{}');
      return mapping[rawValue] ?? rawValue;
    }
    case 'format': {
      // Format value (e.g., date formatting)
      const config = JSON.parse(transformConfig || '{}');
      if (config.type === 'date' && rawValue instanceof Date) {
        return rawValue.toISOString();
      }
      return String(rawValue);
    }
    default:
      return rawValue;
  }
}

/**
 * Query Salesforce for contacts matching an email
 */
export async function findContactByEmail(email: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`SELECT Id FROM Contact WHERE Email = '${email}' LIMIT 1`);
    const result = await salesforceRequest<SalesforceQueryResult<{ Id: string }>>(
      `/query?q=${query}`
    );
    return result.records[0]?.Id || null;
  } catch (err) {
    console.error('Error finding contact:', err);
    return null;
  }
}

/**
 * Link a task to a contact (WhoId)
 */
export async function linkTaskToContact(taskId: string, contactId: string): Promise<void> {
  await updateTask(taskId, { WhoId: contactId });
}

/**
 * Test Salesforce connection
 */
export async function testConnection(): Promise<{ success: boolean; error?: string; userInfo?: any }> {
  try {
    const accessToken = await getValidAccessToken('salesforce');
    if (!accessToken) {
      return { success: false, error: 'Not connected or token invalid' };
    }

    const instanceUrl = await getInstanceUrl();
    if (!instanceUrl) {
      return { success: false, error: 'Instance URL not configured' };
    }

    // Get user info
    const response = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      return { success: false, error: `API test failed: ${response.status}` };
    }

    const userInfo = await response.json();
    return { success: true, userInfo };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
