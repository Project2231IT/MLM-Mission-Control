/**
 * Parse the Custom field from Grandstream GWN Cloud exports
 * Format: "Email:user@example.com\r\nFirst Name:John\r\nLast Name:Doe\r\nMobile Phone:1234567890\r\nAge:25\r\n"
 */
function parseCustomField(raw) {
  const result = {
    email: null,
    firstName: null,
    lastName: null,
    mobilePhone: null,
    age: null,
  };

  if (!raw || typeof raw !== 'string') return result;

  // Split on literal \r\n or actual newlines
  const parts = raw.split(/(?:\\r\\n|\r\n|\n)/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
    const value = trimmed.substring(colonIdx + 1).trim();

    if (!value) continue;

    switch (key) {
      case 'email':
        result.email = value.toLowerCase();
        break;
      case 'first name':
        result.firstName = value;
        break;
      case 'last name':
        result.lastName = value;
        break;
      case 'mobile phone':
        result.mobilePhone = value;
        break;
      case 'age':
        result.age = value;
        break;
    }
  }

  return result;
}

/**
 * Extract AP name from Device column
 * Format: "C0:74:AD:E7:A9:FC(TCF AP10)"
 */
function parseApName(device) {
  if (!device || typeof device !== 'string') return null;
  const match = device.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
}

/**
 * Map SSID to location code
 */
function ssidToLocation(ssid) {
  if (!ssid) return 'UNK';
  const s = ssid.toLowerCase();
  if (s.includes('city forum')) return 'TCF';
  if (s.includes('dock17') || s.includes('dock 17')) return 'D17';
  if (s.includes('acme')) return 'ACME';
  if (s.includes('lucille')) return 'MLC';
  return 'UNK';
}

module.exports = { parseCustomField, parseApName, ssidToLocation };
