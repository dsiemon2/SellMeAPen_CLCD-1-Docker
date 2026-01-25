/**
 * HubSpot API Client
 * Handles HubSpot REST API operations for syncing training sessions
 */

import { prisma } from '../../db/prisma.js';
import { getValidAccessToken } from './crmOAuth.js';

interface HubSpotEngagement {
  engagement: {
    type: string;
    timestamp: number;
  };
  associations: {
    contactIds?: number[];
    dealIds?: number[];
    companyIds?: number[];
  };
  metadata: {
    body?: string;
    subject?: string;
    status?: string;
    taskType?: string;
    priority?: string;
    [key: string]: any;
  };
}

interface HubSpotContact {
  id: string;
  properties: Record<string, string>;
}

interface HubSpotSearchResult {
  total: number;
  results: HubSpotContact[];
}

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

/**
 * Make authenticated request to HubSpot API
 */
async function hubspotRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const accessToken = await getValidAccessToken('hubspot');
  if (!accessToken) {
    throw new Error('HubSpot not connected or token invalid');
  }

  const url = `${HUBSPOT_API_BASE}${endpoint}`;
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
    throw new Error(`HubSpot API error (${response.status}): ${errorText}`);
  }

  // DELETE requests may not return content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Create an Engagement (Note/Task) in HubSpot
 */
export async function createEngagement(engagement: HubSpotEngagement): Promise<string> {
  const result = await hubspotRequest<{ engagement: { id: number } }>(
    '/engagements/v1/engagements',
    'POST',
    engagement
  );
  return String(result.engagement.id);
}

/**
 * Update an Engagement in HubSpot
 */
export async function updateEngagement(
  engagementId: string,
  metadata: Record<string, any>
): Promise<void> {
  await hubspotRequest(`/engagements/v1/engagements/${engagementId}`, 'PATCH', {
    metadata
  });
}

/**
 * Create a Note in HubSpot (simpler than engagement)
 */
export async function createNote(body: string, contactIds?: number[]): Promise<string> {
  const engagement: HubSpotEngagement = {
    engagement: {
      type: 'NOTE',
      timestamp: Date.now()
    },
    associations: {
      contactIds: contactIds || []
    },
    metadata: {
      body
    }
  };
  return createEngagement(engagement);
}

/**
 * Sync training session to HubSpot as a Task engagement
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
  // Build engagement data
  const engagement: HubSpotEngagement = {
    engagement: {
      type: 'TASK',
      timestamp: sessionData.startedAt.getTime()
    },
    associations: {
      contactIds: []
    },
    metadata: {
      subject: `Sales Training: ${sessionData.grade} Grade (${sessionData.score}/100)`,
      body: buildSessionBody(sessionData),
      status: sessionData.endedAt ? 'COMPLETED' : 'NOT_STARTED',
      taskType: 'TRAINING',
      priority: sessionData.score >= 80 ? 'HIGH' : (sessionData.score >= 60 ? 'MEDIUM' : 'LOW')
    }
  };

  // Find contact by email if available
  if (sessionData.userEmail) {
    const contact = await findContactByEmail(sessionData.userEmail);
    if (contact) {
      engagement.associations.contactIds = [parseInt(contact, 10)];
    }
  }

  // Get field mappings for custom properties
  const integration = await prisma.crmIntegration.findUnique({
    where: { provider: 'hubspot' },
    include: { fieldMappings: { where: { isEnabled: true } } }
  });

  if (integration?.fieldMappings) {
    for (const mapping of integration.fieldMappings) {
      const value = getFieldValue(sessionData, mapping.sourceField, mapping.transformType, mapping.transformConfig);
      if (value !== undefined) {
        engagement.metadata[mapping.targetField] = value;
      }
    }
  }

  // Check if we already synced this session
  const existingSync = await prisma.crmSyncLog.findFirst({
    where: {
      integrationId: integration?.id,
      sessionId: sessionData.sessionId,
      status: 'success',
      objectType: 'Engagement'
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existingSync?.externalId) {
    // Update existing engagement
    await updateEngagement(existingSync.externalId, engagement.metadata);
    return { externalId: existingSync.externalId, action: 'updated' };
  } else {
    // Create new engagement
    const engagementId = await createEngagement(engagement);
    return { externalId: engagementId, action: 'created' };
  }
}

/**
 * Build body text for HubSpot engagement
 */
function buildSessionBody(sessionData: {
  outcome: string;
  score: number;
  grade: string;
  salesMode: string;
  duration: number;
  messageCount: number;
  userName: string;
}): string {
  const outcomeDisplay = sessionData.outcome === 'sale_made' ? 'Sale Made' :
                         sessionData.outcome === 'no_sale' ? 'No Sale' :
                         sessionData.outcome || 'Unknown';

  const modeDisplay = sessionData.salesMode === 'ai_sells' ? 'User as Buyer' :
                      sessionData.salesMode === 'user_sells' ? 'User as Seller' :
                      sessionData.salesMode;

  return `<h3>Sales Training Session</h3>
<p><strong>Trainee:</strong> ${sessionData.userName}</p>
<p><strong>Mode:</strong> ${modeDisplay}</p>
<p><strong>Outcome:</strong> ${outcomeDisplay}</p>
<p><strong>Score:</strong> ${sessionData.score}/100 (${sessionData.grade})</p>
<p><strong>Duration:</strong> ${Math.round(sessionData.duration / 60)} minutes</p>
<p><strong>Messages:</strong> ${sessionData.messageCount}</p>
<hr>
<p><em>Logged by SellMeAPen Training Platform</em></p>`;
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
      const mapping = JSON.parse(transformConfig || '{}');
      return mapping[rawValue] ?? rawValue;
    }
    case 'format': {
      const config = JSON.parse(transformConfig || '{}');
      if (config.type === 'date' && rawValue instanceof Date) {
        return rawValue.getTime();
      }
      return String(rawValue);
    }
    default:
      return rawValue;
  }
}

/**
 * Find HubSpot contact by email
 */
export async function findContactByEmail(email: string): Promise<string | null> {
  try {
    const result = await hubspotRequest<HubSpotSearchResult>(
      '/crm/v3/objects/contacts/search',
      'POST',
      {
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: email
          }]
        }],
        limit: 1
      }
    );
    return result.results[0]?.id || null;
  } catch (err) {
    console.error('Error finding HubSpot contact:', err);
    return null;
  }
}

/**
 * Get HubSpot contact by ID
 */
export async function getContact(contactId: string): Promise<HubSpotContact | null> {
  try {
    return await hubspotRequest<HubSpotContact>(
      `/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname`
    );
  } catch (err) {
    console.error('Error getting HubSpot contact:', err);
    return null;
  }
}

/**
 * Test HubSpot connection
 */
export async function testConnection(): Promise<{ success: boolean; error?: string; accountInfo?: any }> {
  try {
    const accessToken = await getValidAccessToken('hubspot');
    if (!accessToken) {
      return { success: false, error: 'Not connected or token invalid' };
    }

    // Get account info
    const response = await fetch(`${HUBSPOT_API_BASE}/account-info/v3/details`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      return { success: false, error: `API test failed: ${response.status}` };
    }

    const accountInfo = await response.json();
    return { success: true, accountInfo };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Get HubSpot portal info
 */
export async function getPortalInfo(): Promise<{ portalId: string; timeZone: string } | null> {
  try {
    const result = await hubspotRequest<{ portalId: number; timeZone: string }>(
      '/account-info/v3/details'
    );
    return {
      portalId: String(result.portalId),
      timeZone: result.timeZone
    };
  } catch (err) {
    console.error('Error getting HubSpot portal info:', err);
    return null;
  }
}
