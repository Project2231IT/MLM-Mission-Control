# Staff WiFi Authentication Options
Researched: March 31, 2026

## Current Setup
FreeRADIUS → AD (via Samba/Winbind/ntlm_auth) → WPA2-Enterprise PEAP/MSCHAPv2
Staff enter their AD username + password on their phone/laptop.
Issue: Staff find it difficult/confusing.

---

## Option 1: Google Workspace Secure LDAP (RECOMMENDED)
**Staff log in with their Google Workspace email + password — the same login they use daily.**

How it works:
- Google Workspace Business Standard has "Secure LDAP" built in
- FreeRADIUS connects to Google's LDAP server instead of AD
- Staff connect to WiFi with their @project2231.com email + Google password
- No AD dependency needed

Pros:
- Staff already know their Google password — use it every day
- No separate credentials to remember
- Google handles password resets, 2FA, etc.
- Works even if AD is down

Cons:
- Requires Business Plus or higher for Secure LDAP (Business Standard may NOT include it)
- Need to check if your plan supports it

Setup:
1. Admin console → Apps → LDAP → Add Client → name "FreeRADIUS"
2. Download the generated certificate (used by FreeRADIUS to auth to Google)
3. Configure FreeRADIUS LDAP module to point at ldap.google.com:636
4. Update GWN Cloud RADIUS profile — no changes needed on AP side

---

## Option 2: Pre-shared Key with MAC filtering (SIMPLEST)
**Staff get a simple WiFi password — no username required.**

How it works:
- Change Staff SSID from WPA2/3-Enterprise to WPA2-Personal
- Set a strong password staff are given
- Optionally add MAC address filtering for extra security

Pros:
- Dead simple — staff just enter a password like any home WiFi
- No RADIUS, no AD, no LDAP
- Works on every device instantly

Cons:
- Less secure — anyone with the password can connect
- Can't track who connected (no per-user logging)
- Password changes affect everyone

---

## Option 3: Push WiFi profile via MDM/TRMM (ZERO EFFORT FOR STAFF)
**Devices auto-connect — staff do nothing.**

How it works:
- For Apple devices: push a WiFi profile via MicroMDM with the RADIUS credentials embedded
- For Windows PCs: deploy WiFi config via TRMM script (netsh wlan add profile)
- For Android: push via Google Workspace device management

Pros:
- Zero user interaction — device just connects
- Still uses WPA2-Enterprise + RADIUS (full security)
- Per-user tracking maintained

Cons:
- Only works on managed devices
- Personal phones still need manual login

---

## Option 4: Current Setup + Better Instructions
**Keep WPA2-Enterprise but make it easier to connect.**

How it works:
- Create a simple one-page instruction sheet for staff
- Push the CA certificate to devices so they don't get the "trust" warning
- For Windows domain PCs: deploy WiFi profile via Group Policy
- For phones: create a QR code that pre-fills the WiFi settings

Pros:
- No infrastructure changes
- Most secure option
- Already working

Cons:
- Staff still need to enter credentials the first time

---

## MY RECOMMENDATION

**Short term:** Option 4 — Deploy WiFi profiles to Windows PCs via TRMM (auto-connect, no user action). Create a simple instruction page for phones.

**Long term:** Option 1 — Switch FreeRADIUS to Google Workspace LDAP so staff use their Google credentials. Check if your Business Standard plan includes Secure LDAP first.

**Nuclear option:** Option 2 — If staff really struggle, just use a shared password. Less secure but dramatically simpler.
