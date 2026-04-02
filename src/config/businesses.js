// Business configuration for multi-tenant captive portal
const businesses = {
  acme: {
    code: 'acme',
    name: 'ACME Athletics',
    tagline: 'Connect to free WiFi',
    primaryColor: '#3ECDB0',
    secondaryColor: '#5D6B6E',
    bgGradient: 'linear-gradient(135deg, #3ECDB0 0%, #2BA890 100%)',
    logo: '/logos/acme.jpg',
    textOnPrimary: '#ffffff',
  },
  ahw: {
    code: 'ahw',
    name: 'ACME Health & Wellness',
    tagline: 'Connect to free WiFi',
    primaryColor: '#3ECDB0',
    secondaryColor: '#5D6B6E',
    bgGradient: 'linear-gradient(135deg, #3ECDB0 0%, #2BA890 100%)',
    logo: '/logos/ahw.jpg',
    textOnPrimary: '#ffffff',
  },
  d17: {
    code: 'd17',
    name: 'Dock 17',
    tagline: 'Connect to free WiFi',
    primaryColor: '#E8943A',
    secondaryColor: '#2C2C2C',
    bgGradient: 'linear-gradient(135deg, #E8943A 0%, #D07A24 100%)',
    logo: '/logos/d17.jpg',
    textOnPrimary: '#ffffff',
  },
  mlc: {
    code: 'mlc',
    name: "Miss Lucille's Café",
    tagline: 'Connect to free WiFi',
    primaryColor: '#2D6B4F',
    secondaryColor: '#1A1A1A',
    bgGradient: 'linear-gradient(135deg, #2D6B4F 0%, #1E4D38 100%)',
    logo: '/logos/mlc.jpg',
    textOnPrimary: '#ffffff',
  },
  mlm: {
    code: 'mlm',
    name: "Miss Lucille's Marketplace",
    tagline: 'Connect to free WiFi',
    primaryColor: '#5A8F72',
    secondaryColor: '#2C3E2E',
    bgGradient: 'linear-gradient(135deg, #BFD9C8 0%, #8FB89E 100%)',
    logo: '/logos/mlm.jpg',
    textOnPrimary: '#2C3E2E',
  },
  tcf: {
    code: 'tcf',
    name: 'The City Forum',
    tagline: 'Connect to free WiFi',
    primaryColor: '#E63946',
    secondaryColor: '#1A1A1A',
    bgGradient: 'linear-gradient(135deg, #E63946 0%, #C62828 100%)',
    logo: '/logos/tcf.jpg',
    textOnPrimary: '#ffffff',
  },
};

function getBusiness(code) {
  return businesses[code] || null;
}

function getAllBusinesses() {
  return businesses;
}

module.exports = { getBusiness, getAllBusinesses, businesses };
