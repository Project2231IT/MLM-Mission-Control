# MEMORY.md — Mr. Crabs' Long-Term Memory 🦀

## Key People
- **Jake McDonald** — IT Director at Project2231. Central timezone. Email: it@project2231.com
- Jake runs sudo commands himself (no elevated access on my host)

## Project2231 Businesses
Dock 17 · Miss Lucilles Marketplace · Miss Lucilles Cafe · ACME · ACME Health and Wellness · The City Forum

## Hosts & SSH
| Host | IP | SSH | Notes |
|------|----|-----|-------|
| jakesopenclaw | 172.16.201.40 | — | My host, Ubuntu 22.04, RTX 4060 |
| Thor | 172.16.201.21 | jake / Project@2231! | ARM/Tegra, Mission Control (port 3333) |
| Argus VM | 172.16.201.23 | mrcrabs / Crabs@123 | Ubuntu 24.04, Argus cameras (port 4000) |
| ITFlow VM | 172.16.201.14 | — | VM120 on pve1 |
| nanoMDM VM | 172.16.201.25 | — | In progress, mdm.project2231.com |

## Wazuh Cluster (fixed 2026-04-01)
| Component | IP | VM ID | Version |
|---|---|---|---|
| Indexer | 172.16.201.18 | 111 | 4.14.4 |
| Manager | 172.16.201.19 | 121 | 4.14.4 |
| Dashboard | 172.16.201.20 | 122 | 4.14.4 |

### Wazuh Credentials
- **Indexer admin**: admin / P2231-Wazuh.Idx#73faf1a834b7
- **Indexer kibanaserver**: kibanaserver / P2231WazuhKbn2026
- **API wazuh**: wazuh / P2231-Wazuh.Api#cf65cc787cfb
- **API wazuh-wui**: wazuh-wui / P2231-Wazuh.Wui#8057e14e701b
- **Dashboard login**: admin / P2231-Wazuh.Idx#73faf1a834b7
- **mrcrabs sudo**: Crabbie@123 (all 3 boxes, NOPASSWD on .18/.19/.20)

### Wazuh Notes
- Dashboard keystore overrides opensearch_dashboards.yml — always update keystore for indexer creds
- Manager wazuh-keystore (`/var/ossec/bin/wazuh-keystore -f indexer`) holds indexer creds for wazuh-modulesd
- Filebeat keystore holds indexer creds for log shipping
- securityadmin needs `--accept-red-cluster` flag to avoid timeout on cluster state wait
- 63 agents active as of 2026-04-01

## Services & APIs
| Service | URL | Key/Token |
|---------|-----|-----------|
| Argus | cameras.project2231.com | — |
| Mission Control | 172.16.201.21:3333 | — |
| LibreNMS | librenms.project2231.com | 0ab3c197c7a9a703a591361d42f3164c |
| Xibo CMS | xibo.project2231.com | — |
| Signage App | 172.16.201.23:3500 | — |
| Tactical RMM | rmm.project2231.com / api.project2231.com | TODXZWJCH9FJDUQY6WPVE55F7CTVWWLA |
| ITFlow | helpdesk.project2231.com | vHBWDCyf5-ncBd1bhYltNwrgi278qVpq |
| Portainer | 172.16.201.15:9443 | ptr_H1eEPHCGkzLnOkjW6mLQM2Fb1YjHYOjz+7DziKmyycA= |
| Guest WiFi Analytics | 172.16.201.15:3700 | guestadmin / GuestWifi2024!Secure |
| Uptime Kuma | 172.16.201.15:3001 | uk1_fSO9bC3bMK7l1oRlt2ydsIVJI7QimLKCmQo7mNDR |
| Guest WiFi | 172.16.201.40:3700 | admin / P2231GuestAdmin |

## ITFlow Details
- Decryption password: afLwp86rrzKWu3oen9G-ME8MxXt8DGsh
- Jake's user ID: 10 · contact IDs: 11 (P2231), 16 (TCF), 36 (ACME)
- Always assign tickets to user 10

## Telegram Topics
- Topic 2 — Argus & cameras
- Topic 890 — MDM

## Portainer (172.16.201.15)
- Host: 172.16.201.15:9443 (HTTPS)
- API Key: ptr_H1eEPHCGkzLnOkjW6mLQM2Fb1YjHYOjz+7DziKmyycA=
- Endpoint ID: 2 (local)
- Note: Guest WiFi moved off Portainer to jakesopenclaw native (2026-04-10)

## Guest WiFi Analytics — Production (all on jakesopenclaw 172.16.201.40)

### Architecture
Everything runs natively on jakesopenclaw (no Docker/Portainer):
- **App**: Node.js/Express on port 3700 — systemd service `guest-wifi-analytics`
- **FreeRADIUS**: Native install, systemd service `freeradius`, ports 1812 (auth) / 1813 (acct)
- **PostgreSQL 14**: Native, database `guest_wifi`, user `guestadmin`
- **UFW**: 3700/tcp, 1812/udp, 1813/udp open

### Guest Flow (end-to-end working since 2026-04-10)
1. Guest connects to SSID → AP redirects to splash page
2. Guest enters info → form POSTs to `/portal/register`
3. App saves to DB → redirects to `cwp.gwnportal.cloud:8080/gwn_login?username=guest&password=guest`
4. Grandstream cloud → RADIUS Access-Request → our FreeRADIUS → Access-Accept
5. AP grants internet — guest goes online (no confirmation page)

### Business Locations & SSIDs
| Code | Business | Splash URL | SSID |
|------|----------|-----------|------|
| tcf | The City Forum | `/portal/splash/tcf` | The City Forum Guest |
| d17 | Dock 17 | `/portal/splash/d17` | Dock17 Guest |
| mlc | Miss Lucille's Cafe | `/portal/splash/mlc` | Miss Lucilles Cafe Guest Wifi |
| mlm | Miss Lucille's Marketplace | `/portal/splash/mlm` | Miss Lucilles Guest Wifi |
| acme | ACME Athletics | `/portal/splash/acme` | ACME Guest Wifi |
| ahw | ACME Health & Wellness | `/portal/splash/ahw` | (not deployed yet) |

### Stats (as of 2026-04-13)
- 73 unique guests, 84 visits
- TCF: 45 guests (busiest) · D17: 17 · MLC: 6 · MLM: 6 · ACME: 2

### FreeRADIUS Config
- **Virtual server**: `/etc/freeradius/3.0/sites-enabled/grandstream-portal`
- **SQL module**: `/etc/freeradius/3.0/mods-available/sql` → PostgreSQL localhost
- **Accounting**: writes to `radacct` table (standard FreeRADIUS schema)
- **Users file**: `/etc/freeradius/3.0/users` — single user `guest/guest`
- **clients.conf**: 0.0.0.0/0 (open — Grandstream cloud IPs vary)
- **Dictionary**: Grandstream VSAs defined (Vendor 267)

### gwn.cloud Config
- **Captive portal policy** per location: External splash → `http://172.16.201.40:3700/portal/splash/{code}`
- **RADIUS auth**: "Guest Wifi Radius" → 172.16.201.40:1812/1813
- **Pre-auth rules**: allow 172.16.201.40 (all), cwp.gwnportal.cloud (for Grandstream cloud redirect)
- **External page**: business website (e.g. acmeathleticstn.com)
- **Timeout**: 5 minutes · HTTPS redirect: OFF · Secure portal: OFF

### Database Schema (guest_wifi)
- `guests` — email, first_name, last_name, mobile_phone, total_visits, first_seen, last_seen
- `visits` — guest_id, mac, ap_name, ssid, location_code, start_time, auth_method
- `radacct` — FreeRADIUS standard accounting (session, bytes, duration, client IP, etc.)
- `uploads`, `users`, `audit_log` — legacy/import tables
- Also has standard FreeRADIUS tables: radcheck, radreply, radgroupcheck, radgroupreply, radusergroup, radpostauth

### Dashboard
- URL: `http://172.16.201.40:3700` · Login: admin / P2231GuestAdmin
- Tabs: Dashboard, Customers, Analytics, Locations, Marketing, RADIUS Sessions, Settings
- RADIUS Sessions reads from `radacct` table — shows active/recent sessions with download/upload

### Credentials
- **Dashboard**: admin / P2231GuestAdmin
- **DB**: guestadmin / GuestWifi2024Secure (localhost:5432/guest_wifi)
- **RADIUS secret**: P2231GuestRadius2026
- **Session secret**: p2231session2026

### Key Files
- App source: `/home/jake/.openclaw/workspace/guest-wifi-analytics/src/`
- Portal route: `src/routes/portal.js` (splash pages, registration, redirect logic)
- Dashboard API: `src/routes/dashboard.js` (stats, accounting, trends)
- Frontend: `src/public/js/app.js`, `src/public/index.html`
- Business config: `src/config/businesses.js` (colors, logos, names per location)
- Systemd service: `/etc/systemd/system/guest-wifi-analytics.service`
- FreeRADIUS config: `/etc/freeradius/3.0/`
- GitHub: `https://github.com/Project2231IT/guest-analytics` (passwords stripped, .env.example for secrets)

### Remaining Work
- AHW splash page not deployed yet (no AP/SSID configured)
- Test all splash pages end-to-end (only ACME and TCF tested live)
- FreeRADIUS SQL module for auth (currently uses flat users file)
- Dashboard guest list — verify all fields render correctly
- Clean up test data (guest id=1 "Test Test" with 7 visits)

## Notes
- First boot: 2026-03-23
- Weekly security audit cron: Mondays 9am Central
- Proxmox cluster — Ceph on spinning disks, 22 LibreNMS devices
- YOLO inference runs on jakesopenclaw GPU (RTX 4060), syncs to Argus VM
- Argus AI scripts: `/home/jake/.openclaw/workspace/argus-ai/`
- nanoMDM in progress: VM created, next steps = install nanoMDM + SCEP + nginx + SSL + APNs
