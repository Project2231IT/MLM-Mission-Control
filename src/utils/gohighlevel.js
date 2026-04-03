/**
 * GoHighLevel CRM Integration
 * Uses API v2 with Private Integration Token
 * Uses Upsert endpoint to safely create/update contacts without duplicates
 */

const GHL_API_KEY = process.env.GHL_API_KEY || '';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

// Business code → tag name mapping
const BUSINESS_TAGS = {
  TCF: 'WiFi-CityForum',
  D17: 'WiFi-Dock17',
  ACME: 'WiFi-ACME',
  AHW: 'WiFi-ACMEHealth',
  MLC: 'WiFi-MissLucillesCafe',
  MLM: 'WiFi-MissLucillesMarketplace',
};

/**
 * Make a GHL API request with proper headers
 */
async function ghlRequest(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': GHL_API_VERSION,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${GHL_BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errMsg = data?.message || data?.msg || res.statusText;
    console.error(`GHL API ${method} ${path} → ${res.status}: ${errMsg}`);
    return { ok: false, status: res.status, error: errMsg, data };
  }

  return { ok: true, status: res.status, data };
}

/**
 * Push a guest to GoHighLevel CRM using Upsert (safe — no duplicates)
 */
async function pushToGHL(guest) {
  if (!GHL_API_KEY) {
    console.log('GHL: No API key configured, skipping CRM push');
    return null;
  }

  if (!GHL_LOCATION_ID) {
    console.error('GHL: No Location ID configured (GHL_LOCATION_ID env var)');
    return null;
  }

  try {
    const {
      email,
      phone,
      first_name,
      last_name,
      business_code,
      is_returning,
      total_visits,
      marketing_optin,
      contact_method,
      mac,
      ssid,
    } = guest;

    // Build tags
    const tags = ['WiFi-Guest'];

    // Business tag
    if (business_code && BUSINESS_TAGS[business_code]) {
      tags.push(BUSINESS_TAGS[business_code]);
    }

    // New vs returning
    tags.push(is_returning ? 'WiFi-Returning' : 'WiFi-New');

    // SMS opt-in (only if they used phone AND checked the box)
    if (contact_method === 'phone' && marketing_optin) {
      tags.push('SMS-Optin');
    }

    // Visit count tags
    if (total_visits >= 5) {
      tags.push('WiFi-VIP');
    } else if (total_visits >= 3) {
      tags.push('WiFi-Regular');
    }

    // Build upsert payload
    const contactData = {
      locationId: GHL_LOCATION_ID,
      firstName: first_name || undefined,
      lastName: last_name || undefined,
      tags: tags,
      source: 'WiFi Portal',
    };

    // Add email or phone — phone must be E.164 format
    if (email) {
      contactData.email = email;
    }
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      contactData.phone = cleanPhone.startsWith('1') ? '+' + cleanPhone : '+1' + cleanPhone;
    }

    // Use Upsert endpoint — safely creates or updates
    const result = await ghlRequest('POST', '/contacts/upsert', contactData);

    if (result.ok) {
      const action = result.data?.new ? 'Created' : 'Updated';
      console.log(`GHL: ${action} contact (${email || phone}) → ${result.data?.contact?.id || 'ok'}`);

      // If this is a returning guest that was marked WiFi-New before, fix the tags
      if (is_returning && result.data?.contact?.id) {
        // Remove WiFi-New tag if it exists
        await ghlRequest('DELETE', `/contacts/${result.data.contact.id}/tags`, {
          tags: ['WiFi-New']
        }).catch(() => {}); // Ignore errors
      }
    }

    return result;
  } catch (err) {
    console.error('GHL: Integration error:', err.message);
    return null;
  }
}

/**
 * Test GHL connection — read-only, safe
 */
async function testGHLConnection() {
  if (!GHL_API_KEY) {
    return { success: false, error: 'No API key configured (GHL_API_KEY)' };
  }
  if (!GHL_LOCATION_ID) {
    return { success: false, error: 'No Location ID configured (GHL_LOCATION_ID)' };
  }

  const result = await ghlRequest('GET', `/contacts/?locationId=${GHL_LOCATION_ID}&limit=1`);

  if (result.ok) {
    const count = result.data?.meta?.total || result.data?.contacts?.length || 0;
    return {
      success: true,
      message: `Connected to GoHighLevel. Location has ${count} contacts.`,
      locationId: GHL_LOCATION_ID,
    };
  }

  return { success: false, error: result.error || 'Unknown error' };
}

/**
 * Get GHL integration status for dashboard
 */
function getGHLStatus() {
  return {
    configured: !!(GHL_API_KEY && GHL_LOCATION_ID),
    hasApiKey: !!GHL_API_KEY,
    hasLocationId: !!GHL_LOCATION_ID,
  };
}

module.exports = { pushToGHL, testGHLConnection, getGHLStatus };
