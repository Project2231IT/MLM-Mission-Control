/**
 * GoHighLevel CRM Integration
 * Pushes WiFi portal signups to GHL as contacts with tags
 */

const GHL_API_KEY = process.env.GHL_API_KEY || '';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

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
 * Push a guest to GoHighLevel CRM
 * Creates new contact or updates existing one
 */
async function pushToGHL(guest) {
  if (!GHL_API_KEY) {
    console.log('GHL: No API key configured, skipping CRM push');
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
    if (is_returning) {
      tags.push('WiFi-Returning');
    } else {
      tags.push('WiFi-New');
    }

    // SMS opt-in
    if (contact_method === 'phone' && marketing_optin) {
      tags.push('SMS-Optin');
    }

    // Visit count tags
    if (total_visits >= 5) {
      tags.push('WiFi-VIP');
    } else if (total_visits >= 3) {
      tags.push('WiFi-Regular');
    }

    // Build contact payload
    const contactData = {
      firstName: first_name || '',
      lastName: last_name || '',
      tags: tags,
      source: 'WiFi Portal',
      customField: [
        { key: 'wifi_visits', field_value: String(total_visits || 1) },
        { key: 'wifi_location', field_value: business_code || '' },
        { key: 'wifi_mac', field_value: mac || '' },
        { key: 'wifi_ssid', field_value: ssid || '' },
      ],
    };

    // Add email or phone based on contact method
    if (email) {
      contactData.email = email;
    }
    if (phone) {
      contactData.phone = phone.startsWith('+') ? phone : '+1' + phone.replace(/\D/g, '');
    }

    // Add location ID if configured
    if (GHL_LOCATION_ID) {
      contactData.locationId = GHL_LOCATION_ID;
    }

    // First, try to find existing contact
    let existingContact = null;
    const searchField = email ? 'email' : 'phone';
    const searchValue = email || (phone ? contactData.phone : '');

    if (searchValue) {
      try {
        const searchRes = await fetch(
          `${GHL_BASE_URL}/contacts/search/duplicate?${searchField}=${encodeURIComponent(searchValue)}${GHL_LOCATION_ID ? '&locationId=' + GHL_LOCATION_ID : ''}`,
          {
            headers: {
              'Authorization': `Bearer ${GHL_API_KEY}`,
              'Version': '2021-07-28',
            },
          }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.contact) {
            existingContact = searchData.contact;
          }
        }
      } catch (e) {
        console.log('GHL: Search failed, will try to create:', e.message);
      }
    }

    let result;

    if (existingContact) {
      // Update existing contact - merge tags
      const existingTags = existingContact.tags || [];
      const mergedTags = [...new Set([...existingTags, ...tags])];
      
      // Remove WiFi-New if they're now returning
      if (is_returning) {
        const idx = mergedTags.indexOf('WiFi-New');
        if (idx > -1) mergedTags.splice(idx, 1);
      }

      contactData.tags = mergedTags;

      const updateRes = await fetch(
        `${GHL_BASE_URL}/contacts/${existingContact.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28',
          },
          body: JSON.stringify(contactData),
        }
      );

      if (updateRes.ok) {
        result = await updateRes.json();
        console.log(`GHL: Updated contact ${existingContact.id} (${email || phone})`);
      } else {
        const err = await updateRes.text();
        console.error(`GHL: Update failed (${updateRes.status}):`, err);
      }
    } else {
      // Create new contact
      const createRes = await fetch(
        `${GHL_BASE_URL}/contacts/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28',
          },
          body: JSON.stringify(contactData),
        }
      );

      if (createRes.ok) {
        result = await createRes.json();
        console.log(`GHL: Created contact (${email || phone})`);
      } else {
        const err = await createRes.text();
        console.error(`GHL: Create failed (${createRes.status}):`, err);
      }
    }

    return result;
  } catch (err) {
    console.error('GHL: Integration error:', err.message);
    return null;
  }
}

/**
 * Test GHL connection
 */
async function testGHLConnection() {
  if (!GHL_API_KEY) {
    return { success: false, error: 'No API key configured' };
  }

  try {
    const res = await fetch(
      `${GHL_BASE_URL}/contacts/?limit=1${GHL_LOCATION_ID ? '&locationId=' + GHL_LOCATION_ID : ''}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
        },
      }
    );

    if (res.ok) {
      return { success: true, message: 'Connected to GoHighLevel' };
    } else {
      const err = await res.text();
      return { success: false, error: `API returned ${res.status}: ${err}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { pushToGHL, testGHLConnection };
