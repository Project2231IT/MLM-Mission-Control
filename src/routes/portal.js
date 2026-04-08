const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { getBusiness, getAllBusinesses } = require('../config/businesses');
const { pushToGHL } = require('../utils/gohighlevel');

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

  const { client_mac, ap_mac, ssid, url, login_url, orig_url } = req.query;

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
    input[type="email"], input[type="text"], input[type="tel"] {
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
    .toggle-row {
      display: flex;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .toggle-btn {
      flex: 1;
      padding: 10px;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      background: #fafafa;
      color: #888;
      border: none;
      transition: all 0.2s;
    }
    .toggle-btn.active {
      background: ${biz.primaryColor};
      color: ${biz.textOnPrimary};
    }
    .optin-row {
      display: none;
      margin-top: 10px;
      padding: 10px 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      font-size: 12px;
      color: #166534;
    }
    .optin-row label {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      font-size: 12px;
      font-weight: 500;
      color: #166534;
      cursor: pointer;
    }
    .optin-row input[type="checkbox"] {
      margin-top: 2px;
      width: auto;
    }
    .field-group { display: block; }
    .field-group.hidden { display: none; }
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
    <div class="logo-wrap">
      <img src="${esc(biz.logo)}" alt="${esc(biz.name)}">
    </div>
    <div class="biz-name">${esc(biz.name)}</div>
    <div class="tagline">${esc(biz.tagline)}</div>
    
    <div class="error-msg" id="error-msg">Please provide an email or phone number.</div>
    
    <form method="POST" id="wifi-form" action="/portal/register" onsubmit="handleSubmit(event)">
      <input type="hidden" name="client_mac" value="${esc(client_mac)}">
      <input type="hidden" name="ap_mac" value="${esc(ap_mac)}">
      <input type="hidden" name="ssid" value="${esc(ssid)}">
      <input type="hidden" name="redirect_url" value="${esc(orig_url || url)}">
      <input type="hidden" name="login_url" value="${esc(login_url)}">
      <input type="hidden" name="business" value="${esc(biz.code)}">
      <input type="hidden" name="contact_method" id="contact_method" value="email">
      
      <div class="toggle-row">
        <button type="button" class="toggle-btn active" id="toggle-email" onclick="switchTo('email')">📧 Email</button>
        <button type="button" class="toggle-btn" id="toggle-phone" onclick="switchTo('phone')">📱 Phone</button>
      </div>
      
      <div class="field-group" id="email-group">
        <label for="email">Email Address *</label>
        <input type="email" id="email" name="email" placeholder="you@example.com" autocomplete="email">
        <div class="optin-row" style="display:block">
          <label>
            <input type="checkbox" name="email_marketing_optin" id="email_marketing_optin" value="yes">
            I agree to receive marketing emails including special offers and promotions. You may unsubscribe at any time.
          </label>
        </div>
      </div>
      
      <div class="field-group hidden" id="phone-group">
        <label for="phone">Phone Number *</label>
        <input type="tel" id="phone" name="phone" placeholder="(555) 123-4567" autocomplete="tel">
        <div class="optin-row" id="optin-row" style="display:block">
          <label>
            <input type="checkbox" name="marketing_optin" id="marketing_optin" value="yes">
            I agree to receive marketing messages including special offers and promotions. Msg & data rates may apply. Reply STOP to unsubscribe.
          </label>
        </div>
      </div>
      
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
    
    <script>
      function switchTo(mode) {
        document.getElementById('contact_method').value = mode;
        document.getElementById('email-group').classList.toggle('hidden', mode !== 'email');
        document.getElementById('phone-group').classList.toggle('hidden', mode !== 'phone');
        document.getElementById('toggle-email').classList.toggle('active', mode === 'email');
        document.getElementById('toggle-phone').classList.toggle('active', mode === 'phone');
        if (mode === 'email') {
          document.getElementById('email').required = true;
          document.getElementById('phone').required = false;
        } else {
          document.getElementById('email').required = false;
          document.getElementById('phone').required = true;
        }
      }
      function validateForm() {
        var mode = document.getElementById('contact_method').value;
        var err = document.getElementById('error-msg');
        // DEBUG: show what's happening
        var emailEl = document.getElementById('email');
        var phoneEl = document.getElementById('phone');
        var emailVal = emailEl ? emailEl.value.trim() : '';
        var phoneVal = phoneEl ? phoneEl.value.trim().replace(/[^0-9]/g, '') : '';
        var emailOptinEl = document.getElementById('email_marketing_optin');
        var phoneOptinEl = document.getElementById('marketing_optin');
        var debug = 'mode=' + mode + ' email=' + emailVal + ' phone=' + phoneVal + ' emailOptin=' + (emailOptinEl ? emailOptinEl.checked : 'N/A') + ' phoneOptin=' + (phoneOptinEl ? phoneOptinEl.checked : 'N/A');
        console.log(debug);
        if (mode === 'email') {
          var email = emailVal;
          if (!email || email.indexOf('@') === -1) {
            err.textContent = 'Please enter a valid email address.';
            err.style.display = 'block';
            return false;
          }
          var emailOptin = emailOptinEl;
          if (!emailOptin.checked) {
            err.textContent = 'Please agree to receive marketing emails to connect.';
            err.style.display = 'block';
            return false;
          }
        } else {
          var phone = phoneVal;
          if (phone.length < 10) {
            err.textContent = 'Please enter a valid phone number.';
            err.style.display = 'block';
            return false;
          }
          var optin = phoneOptinEl;
          if (!optin.checked) {
            err.textContent = 'Please agree to receive marketing messages to use phone number sign-in.';
            err.style.display = 'block';
            return false;
          }
        }
        err.style.display = 'none';
        return true;
      }
      async function handleSubmit(e) {
        e.preventDefault();
        if (!validateForm()) return;
        var btn = document.querySelector('.btn');
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        var form = document.getElementById('wifi-form');
        var data = new FormData(form);
        try {
          var resp = await fetch('/portal/register', { method: 'POST', body: data, redirect: 'manual' });
          if (resp.type === 'opaqueredirect' || resp.status === 0) {
            window.location.href = '/portal/success?' + new URLSearchParams({ url: data.get('redirect_url') || 'http://google.com', business: data.get('business') || '' });
          } else if (resp.redirected) {
            window.location.href = resp.url;
          } else if (resp.status === 302 || resp.status === 303) {
            window.location.href = resp.headers.get('Location') || '/portal/success';
          } else {
            var err = document.getElementById('error-msg');
            err.textContent = 'Something went wrong. Please try again.';
            err.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Connect to WiFi';
          }
        } catch(err) {
          var errEl = document.getElementById('error-msg');
          errEl.textContent = 'Connection error. Please try again.';
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Connect to WiFi';
        }
      }
    </script>
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
    const { email, phone, first_name, last_name, client_mac, ap_mac, ssid, redirect_url, login_url, business, contact_method, marketing_optin, email_marketing_optin } = req.body;
    const biz = getBusiness(business);
    const locationCode = biz ? biz.code.toUpperCase() : 'UNK';

    const usePhone = contact_method === 'phone';
    const normalizedPhone = (phone || '').trim().replace(/[^0-9]/g, '');
    
    if (usePhone) {
      if (normalizedPhone.length < 10) {
        return res.redirect(`/portal/splash/${business || 'unknown'}?error=invalid_phone`);
      }
    } else {
      if (!email || !email.includes('@')) {
        return res.redirect(`/portal/splash/${business || 'unknown'}?error=invalid_email`);
      }
    }

    const normalizedEmail = usePhone ? '' : email.trim().toLowerCase();
    const lookupField = usePhone ? 'mobile_phone' : 'email';
    const lookupValue = usePhone ? normalizedPhone : normalizedEmail;
    const normalizedMac = (client_mac || '').trim().toUpperCase();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert guest - lookup by email or phone
      let guestResult;
      if (usePhone) {
        guestResult = await client.query(
          'SELECT id, total_visits FROM guests WHERE mobile_phone = $1',
          [normalizedPhone]
        );
      } else {
        guestResult = await client.query(
          'SELECT id, total_visits FROM guests WHERE email = $1',
          [normalizedEmail]
        );
      }

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
           last_name = COALESCE(NULLIF($3, ''), last_name),
           mobile_phone = COALESCE(NULLIF($4, ''), mobile_phone),
           email = COALESCE(NULLIF($5, ''), email)
           WHERE id = $6`,
          [totalVisits, first_name || '', last_name || '', normalizedPhone || '', normalizedEmail || '', guestId]
        );
      } else {
        const insertResult = await client.query(
          'INSERT INTO guests (email, mobile_phone, first_name, last_name, first_seen, last_seen, total_visits) VALUES ($1, $2, $3, $4, NOW(), NOW(), 1) RETURNING id',
          [normalizedEmail || null, normalizedPhone || null, first_name || '', last_name || '']
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

      // Push to GoHighLevel CRM (fire and forget)
      pushToGHL({
        email: normalizedEmail,
        phone: normalizedPhone,
        first_name: first_name || '',
        last_name: last_name || '',
        business_code: locationCode,
        is_returning: isReturning,
        total_visits: totalVisits,
        marketing_optin: marketing_optin === 'yes',
        contact_method: usePhone ? 'phone' : 'email',
        mac: normalizedMac,
        ssid: ssid || '',
      }).catch(e => console.error('GHL push error:', e));

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
                email: normalizedEmail || '',
                phone: normalizedPhone || '',
                first_name: first_name || '',
                last_name: last_name || '',
                total_visits: totalVisits,
                mac: normalizedMac,
                ssid: ssid || '',
                location: locationCode,
                contact_method: usePhone ? 'phone' : 'email',
                marketing_optin: marketing_optin === 'yes' || email_marketing_optin === 'yes',
                timestamp: new Date().toISOString()
              }
            })
          }).catch(() => {});
        } catch (e) { /* webhook optional */ }
      }

      // Redirect back to AP's login URL with RADIUS credentials (EXCAP flow)
      if (login_url) {
        const apLoginParams = new URLSearchParams();
        apLoginParams.set('username', 'guest');
        apLoginParams.set('password', 'guest');
        if (redirect_url) apLoginParams.set('redirect', redirect_url);
        const separator = login_url.includes('?') ? '&' : '?';
        res.redirect(`${login_url}${separator}${apLoginParams.toString()}`);
      } else {
        // Fallback: no login_url (direct access or testing)
        const successParams = new URLSearchParams();
        if (redirect_url) successParams.set('url', redirect_url);
        if (business) successParams.set('business', business);
        res.redirect(`/portal/success?${successParams.toString()}`);
      }

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
    .connected-banner {
      background: #dcfce7;
      border: 2px solid #22c55e;
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
      color: #166534;
      font-size: 14px;
      font-weight: 600;
    }
    .connected-banner span { font-size: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✅</div>
    <h1>You're Connected!</h1>
    <div class="connected-banner">
      <span>📶</span> Your device is now connected to the WiFi network.
    </div>
    <p>Enjoy free WiFi at <span class="biz">${esc(bizName)}</span></p>
    <div class="redirect" id="redirect-msg" style="display:none">
      <a href="${esc(redirectUrl)}">Click here</a> to start browsing.
    </div>
    <script>
      // Show redirect after 5 seconds - but user stays connected regardless
      setTimeout(function() {
        document.getElementById('redirect-msg').style.display = 'block';
      }, 5000);
    </script>
  </div>
</body>
</html>`;

  res.send(html);
});

module.exports = router;
