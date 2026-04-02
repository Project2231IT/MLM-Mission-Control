const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { getBusiness, getAllBusinesses } = require('../config/businesses');

// Helper to sanitize for HTML attributes
function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// GET /portal/splash/:business - Business-branded captive portal
router.get('/splash/:business', (req, res) => {
  const biz = getBusiness(req.params.business);
  if (!biz) {
    return res.status(404).send('Unknown location. Please check the WiFi network.');
  }

  const { client_mac, ap_mac, ssid, url } = req.query;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>WiFi - ${esc(biz.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${biz.bgGradient};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 36px 28px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    .logo-wrap {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-wrap img {
      max-width: 180px;
      max-height: 100px;
      object-fit: contain;
      border-radius: 8px;
    }
    .biz-name {
      text-align: center;
      font-size: 20px;
      font-weight: 700;
      color: ${biz.secondaryColor};
      margin-bottom: 4px;
    }
    .tagline {
      text-align: center;
      color: #888;
      font-size: 14px;
      margin-bottom: 28px;
    }
    .wifi-icon {
      text-align: center;
      font-size: 40px;
      margin-bottom: 12px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #444;
      margin-bottom: 5px;
      margin-top: 14px;
    }
    input[type="email"], input[type="text"] {
      width: 100%;
      padding: 12px 14px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 16px;
      transition: border-color 0.2s;
      -webkit-appearance: none;
      background: #fafafa;
    }
    input:focus {
      outline: none;
      border-color: ${biz.primaryColor};
      background: #fff;
    }
    .btn {
      width: 100%;
      padding: 14px;
      background: ${biz.primaryColor};
      color: ${biz.textOnPrimary};
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 22px;
      transition: opacity 0.2s;
      letter-spacing: 0.3px;
    }
    .btn:hover { opacity: 0.9; }
    .btn:active { opacity: 0.8; }
    .terms {
      text-align: center;
      font-size: 11px;
      color: #aaa;
      margin-top: 14px;
      line-height: 1.4;
    }
    .name-row {
      display: flex;
      gap: 10px;
    }
    .name-row > div { flex: 1; }
    .error-msg {
      background: #FFF3F3;
      color: #D32F2F;
      padding: 10px;
      border-radius: 8px;
      font-size: 13px;
      text-align: center;
      margin-bottom: 12px;
      display: ${req.query.error ? 'block' : 'none'};
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="wifi-icon">📶</div>
    <div class="logo-wrap">
      <img src="${esc(biz.logo)}" alt="${esc(biz.name)}">
    </div>
    <div class="biz-name">${esc(biz.name)}</div>
    <div class="tagline">${esc(biz.tagline)}</div>
    
    <div class="error-msg">Please enter a valid email address.</div>
    
    <form method="POST" action="/portal/register">
      <input type="hidden" name="client_mac" value="${esc(client_mac)}">
      <input type="hidden" name="ap_mac" value="${esc(ap_mac)}">
      <input type="hidden" name="ssid" value="${esc(ssid)}">
      <input type="hidden" name="redirect_url" value="${esc(url)}">
      <input type="hidden" name="business" value="${esc(biz.code)}">
      
      <label for="email">Email Address *</label>
      <input type="email" id="email" name="email" required placeholder="you@example.com" autocomplete="email">
      
      <div class="name-row">
        <div>
          <label for="first_name">First Name</label>
          <input type="text" id="first_name" name="first_name" placeholder="First" autocomplete="given-name">
        </div>
        <div>
          <label for="last_name">Last Name</label>
          <input type="text" id="last_name" name="last_name" placeholder="Last" autocomplete="family-name">
        </div>
      </div>
      
      <button type="submit" class="btn">Connect to WiFi</button>
    </form>
    
    <div class="terms">
      By connecting, you agree to our terms of use and privacy policy.
    </div>
  </div>
</body>
</html>`;

  res.send(html);
});

// Backwards compat: /portal/splash without business code → 404 with helpful message
router.get('/splash', (req, res) => {
  const allBiz = getAllBusinesses();
  const links = Object.values(allBiz).map(b => `<li><a href="/portal/splash/${b.code}">${b.name}</a></li>`).join('');
  res.status(404).send(`<h3>Please use a business-specific portal link:</h3><ul>${links}</ul>`);
});

// POST /portal/register - Handle guest registration
router.post('/register', async (req, res) => {
  try {
    const { email, first_name, last_name, client_mac, ap_mac, ssid, redirect_url, business } = req.body;
    const biz = getBusiness(business);
    const locationCode = biz ? biz.code.toUpperCase() : 'UNK';

    if (!email || !email.includes('@')) {
      const params = new URLSearchParams({ error: 'invalid_email' });
      if (client_mac) params.set('client_mac', client_mac);
      if (ssid) params.set('ssid', ssid);
      if (redirect_url) params.set('url', redirect_url);
      return res.redirect(`/portal/splash/${business || 'unknown'}?${params.toString()}`);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedMac = (client_mac || '').trim().toUpperCase();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert guest
      let guestResult = await client.query(
        'SELECT id, total_visits FROM guests WHERE email = $1',
        [normalizedEmail]
      );

      let guestId;
      let isReturning = false;
      let totalVisits = 1;

      if (guestResult.rows.length > 0) {
        guestId = guestResult.rows[0].id;
        totalVisits = guestResult.rows[0].total_visits + 1;
        isReturning = true;

        await client.query(
          `UPDATE guests SET last_seen = NOW(), total_visits = $1,
           first_name = COALESCE(NULLIF($2, ''), first_name),
           last_name = COALESCE(NULLIF($3, ''), last_name)
           WHERE id = $4`,
          [totalVisits, first_name || '', last_name || '', guestId]
        );
      } else {
        const insertResult = await client.query(
          'INSERT INTO guests (email, first_name, last_name, first_seen, last_seen, total_visits) VALUES ($1, $2, $3, NOW(), NOW(), 1) RETURNING id',
          [normalizedEmail, first_name || '', last_name || '']
        );
        guestId = insertResult.rows[0].id;
      }

      // Upsert MAC
      if (normalizedMac) {
        await client.query(`
          INSERT INTO mac_addresses (mac, guest_id, first_seen, last_seen)
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT (mac) DO UPDATE SET guest_id = $2, last_seen = NOW()
        `, [normalizedMac, guestId]);
      }

      // Create visit
      await client.query(
        `INSERT INTO visits (guest_id, mac, ap_name, ssid, start_time, auth_method, visit_count, location_code)
         VALUES ($1, $2, $3, $4, NOW(), 'portal', $5, $6)`,
        [guestId, normalizedMac, ap_mac || '', ssid || '', totalVisits, locationCode]
      );

      await client.query('COMMIT');

      // Webhook for returning guests
      if (isReturning && process.env.WEBHOOK_URL) {
        try {
          const fetchFn = globalThis.fetch || require('node-fetch');
          fetchFn(process.env.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'returning_guest',
              business: biz ? { code: biz.code, name: biz.name } : null,
              guest: {
                email: normalizedEmail,
                first_name: first_name || '',
                last_name: last_name || '',
                total_visits: totalVisits,
                mac: normalizedMac,
                ssid: ssid || '',
                location: locationCode,
                timestamp: new Date().toISOString()
              }
            })
          }).catch(() => {});
        } catch (e) { /* webhook optional */ }
      }

      // Redirect to branded success page
      const successParams = new URLSearchParams();
      if (redirect_url) successParams.set('url', redirect_url);
      if (business) successParams.set('business', business);
      res.redirect(`/portal/success?${successParams.toString()}`);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Portal registration error:', err);
    res.redirect('/portal/splash/' + (req.body.business || '') + '?error=server_error');
  }
});

// GET /portal/success - Branded success page
router.get('/success', (req, res) => {
  const redirectUrl = req.query.url || 'https://www.google.com';
  const biz = getBusiness(req.query.business);
  const primaryColor = biz ? biz.primaryColor : '#1a73e8';
  const bgGradient = biz ? biz.bgGradient : 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)';
  const bizName = biz ? biz.name : 'Project 2231';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="3;url=${esc(redirectUrl)}">
  <title>Connected!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgGradient};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 48px 32px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      text-align: center;
    }
    .check { font-size: 64px; margin-bottom: 16px; }
    h1 { color: ${primaryColor}; font-size: 24px; margin-bottom: 8px; }
    p { color: #666; font-size: 15px; line-height: 1.5; }
    .biz { font-weight: 600; color: #333; }
    .redirect { margin-top: 24px; font-size: 12px; color: #999; }
    a { color: ${primaryColor}; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✅</div>
    <h1>You're Connected!</h1>
    <p>Enjoy free WiFi at <span class="biz">${esc(bizName)}</span></p>
    <div class="redirect">
      Redirecting in 3 seconds...<br>
      <a href="${esc(redirectUrl)}">Click here</a> if not redirected.
    </div>
  </div>
</body>
</html>`;

  res.send(html);
});

module.exports = router;
