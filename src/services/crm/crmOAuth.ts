/**
 * CRM OAuth Service
 * Handles OAuth authentication flows for Salesforce and HubSpot
 */

import { prisma } from '../../db/prisma.js';

// Environment variables for CRM OAuth
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID || '';
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET || '';
const SALESFORCE_CALLBACK_URL = process.env.SALESFORCE_CALLBACK_URL || '';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID || '';
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET || '';
const HUBSPOT_CALLBACK_URL = process.env.HUBSPOT_CALLBACK_URL || '';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  instance_url?: string; // Salesforce
  id?: string;
}

interface HubSpotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Generate Salesforce OAuth authorization URL
 */
export function getSalesforceAuthUrl(state: string): string {
  const baseUrl = 'https://login.salesforce.com/services/oauth2/authorize';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SALESFORCE_CLIENT_ID,
    redirect_uri: SALESFORCE_CALLBACK_URL,
    scope: 'api refresh_token offline_access',
    state
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Exchange Salesforce authorization code for tokens
 */
export async function exchangeSalesforceCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  expiresAt: Date;
}> {
  const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: SALESFORCE_CLIENT_ID,
      client_secret: SALESFORCE_CLIENT_SECRET,
      redirect_uri: SALESFORCE_CALLBACK_URL,
      code
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce OAuth failed: ${error}`);
  }

  const data: OAuthTokenResponse = await response.json();

  // Salesforce access tokens expire in ~2 hours but we'll refresh before
  const expiresAt = new Date(Date.now() + (data.expires_in || 7200) * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    instanceUrl: data.instance_url || '',
    expiresAt
  };
}

/**
 * Refresh Salesforce access token
 */
export async function refreshSalesforceToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: SALESFORCE_CLIENT_ID,
      client_secret: SALESFORCE_CLIENT_SECRET,
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce token refresh failed: ${error}`);
  }

  const data: OAuthTokenResponse = await response.json();
  const expiresAt = new Date(Date.now() + (data.expires_in || 7200) * 1000);

  return {
    accessToken: data.access_token,
    expiresAt
  };
}

/**
 * Generate HubSpot OAuth authorization URL
 */
export function getHubSpotAuthUrl(state: string): string {
  const baseUrl = 'https://app.hubspot.com/oauth/authorize';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: HUBSPOT_CLIENT_ID,
    redirect_uri: HUBSPOT_CALLBACK_URL,
    scope: 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read crm.objects.deals.write sales-email-read',
    state
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Exchange HubSpot authorization code for tokens
 */
export async function exchangeHubSpotCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      redirect_uri: HUBSPOT_CALLBACK_URL,
      code
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HubSpot OAuth failed: ${error}`);
  }

  const data: HubSpotTokenResponse = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt
  };
}

/**
 * Refresh HubSpot access token
 */
export async function refreshHubSpotToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HubSpot token refresh failed: ${error}`);
  }

  const data: HubSpotTokenResponse = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt
  };
}

/**
 * Get valid access token for a CRM integration, refreshing if needed
 */
export async function getValidAccessToken(provider: 'salesforce' | 'hubspot'): Promise<string | null> {
  const integration = await prisma.crmIntegration.findUnique({
    where: { provider }
  });

  if (!integration || !integration.isConnected || !integration.accessToken) {
    return null;
  }

  // Check if token is expired or about to expire (5 min buffer)
  const bufferMs = 5 * 60 * 1000;
  if (integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() - bufferMs < Date.now()) {
    // Token expired or expiring soon, refresh it
    try {
      if (provider === 'salesforce' && integration.refreshToken) {
        const tokens = await refreshSalesforceToken(integration.refreshToken);
        await prisma.crmIntegration.update({
          where: { provider },
          data: {
            accessToken: tokens.accessToken,
            tokenExpiresAt: tokens.expiresAt,
            lastError: null
          }
        });
        return tokens.accessToken;
      } else if (provider === 'hubspot' && integration.refreshToken) {
        const tokens = await refreshHubSpotToken(integration.refreshToken);
        await prisma.crmIntegration.update({
          where: { provider },
          data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenExpiresAt: tokens.expiresAt,
            lastError: null
          }
        });
        return tokens.accessToken;
      }
    } catch (err: any) {
      console.error(`Failed to refresh ${provider} token:`, err);
      await prisma.crmIntegration.update({
        where: { provider },
        data: {
          isConnected: false,
          lastError: `Token refresh failed: ${err.message}`
        }
      });
      return null;
    }
  }

  return integration.accessToken;
}

/**
 * Disconnect a CRM integration
 */
export async function disconnectCrm(provider: 'salesforce' | 'hubspot'): Promise<void> {
  await prisma.crmIntegration.update({
    where: { provider },
    data: {
      isConnected: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      instanceUrl: null,
      portalId: null
    }
  });
}

/**
 * Check if CRM integration is properly configured
 */
export function isCrmConfigured(provider: 'salesforce' | 'hubspot'): boolean {
  if (provider === 'salesforce') {
    return !!(SALESFORCE_CLIENT_ID && SALESFORCE_CLIENT_SECRET && SALESFORCE_CALLBACK_URL);
  } else {
    return !!(HUBSPOT_CLIENT_ID && HUBSPOT_CLIENT_SECRET && HUBSPOT_CALLBACK_URL);
  }
}

/**
 * Initialize CRM integration records if they don't exist
 */
export async function initializeCrmIntegrations(): Promise<void> {
  // Create Salesforce integration record if not exists
  await prisma.crmIntegration.upsert({
    where: { provider: 'salesforce' },
    create: {
      provider: 'salesforce',
      name: 'Salesforce',
      description: 'Sync training sessions to Salesforce as Activities'
    },
    update: {}
  });

  // Create HubSpot integration record if not exists
  await prisma.crmIntegration.upsert({
    where: { provider: 'hubspot' },
    create: {
      provider: 'hubspot',
      name: 'HubSpot',
      description: 'Sync training sessions to HubSpot as Engagements'
    },
    update: {}
  });
}
