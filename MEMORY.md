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
| ITFlow VM | 172.16.201.14 | — | IT helpdesk/ticketing system, Port 80/443/22 |
| nanoMDM VM | 172.16.201.25 | — | In progress, mdm.project2231.com |
| Docker/Portainer VM | 172.16.201.15 | — | guest-analytics, FreeRADIUS, Portainer :9443 |
| MLM Mission Control | 172.16.201.24 | mrcrabs / Crabs@123 | Go Antiquing dashboard (Next.js), PM2 managed |

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

## ITFlow Details
- Decryption password: afLwp86rrzKWu3oen9G-ME8MxXt8DGsh
- Jake's user ID: 10 · contact IDs: 11 (P2231), 16 (TCF), 36 (ACME)
- Always assign tickets to user 10

## Telegram Topics
- Topic 2 — Argus & cameras
- Topic 890 — MDM

## MLM Dashboard (172.16.201.24:3000)
- mrcrabs SSH: `ssh mrcrabs@172.16.201.24`
- DB mount: `//172.25.100.115/mlmpos` → `/mnt/mlmpos/` (Windows share)
- Build + restart after page changes: `cd /opt/mlm-mission-control && npm run build && pm2 restart mlm-mission-control --update-env`
- Performance page now uses client-side multiplier (0-10×) with PATCH to `performance-settings.json` — no rebuild needed for threshold changes
- Admin account locked from failed attempts — use jmcdonald account

## Portainer
- Host: 172.16.201.15:9443 (HTTPS)
- API Key: ptr_H1eEPHCGkzLnOkjW6mLQM2Fb1YjHYOjz+7DziKmyycA=
- Endpoint ID: 2 (local)
- Guest Analytics stack: ID 203, path /data/compose/203

## Guest WiFi Analytics
- Container: guest-analytics-app-1 on Portainer (.15)
- Port: 3700
- Admin: admin / P2231GuestAdmin
- DB: PostgreSQL (guestadmin / GuestWifi2024Secure)
- Session secret: p2231session2026
- Source: /home/jake/.openclaw/workspace/guest-wifi-analytics/

## Notes
- First boot: 2026-03-23
- Weekly security audit cron: Mondays 9am Central
- Proxmox cluster — Ceph on spinning disks, 22 LibreNMS devices
- YOLO inference runs on jakesopenclaw GPU (RTX 4060), syncs to Argus VM
- Argus AI scripts: `/home/jake/.openclaw/workspace/argus-ai/`
- nanoMDM in progress: VM created, next steps = install nanoMDM + SCEP + nginx + SSL + APNs

## Guest WiFi — WORKING (as of 2026-04-10)

### Architecture (all on jakesopenclaw 172.16.201.40)
- **App**: Node.js/Express on port 3700 — splash pages, registration, dashboard
- **FreeRADIUS**: Native install, systemd, ports 1812/1813 UDP
- **PostgreSQL 14**: Native, database `guest_wifi`, user `guestadmin`
- **UFW**: 3700/tcp, 1812/udp, 1813/udp open

### Working Flow
1. Guest connects to SSID → AP redirects to our splash page
2. Guest enters info → form POSTs to `/portal/register`
3. App saves to DB → redirects to `cwp.gwnportal.cloud:8080/gwn_login?username=guest&password=guest`
4. Grandstream cloud → RADIUS Access-Request → our FreeRADIUS → Access-Accept
5. AP grants internet — guest goes online

### Key Config
- **FreeRADIUS users file**: `guest` / `guest` (Cleartext-Password)
- **clients.conf**: 0.0.0.0/0 (open — Grandstream cloud IPs unknown)
- **RADIUS secret**: `P2231GuestRadius2026`
- **gwn.cloud**: External splash → `http://172.16.201.40:3700/portal/splash/{code}`, RADIUS auth = "Guest Wifi Radius" (172.16.201.40:1812/1813)
- **Pre-auth rules**: 172.16.201.40 (all ports), cwp.gwnportal.cloud
- **Business codes**: tcf, d17, acme, ahw, mlc, mlm

### Remaining Work
- Verify dashboard UI shows guest list with email/phone/name/MAC
- Re-enable FreeRADIUS SQL module for accounting (point to localhost)
- Test all splash pages end-to-end (only ACME tested)
- Systemd service for app auto-start on boot
- Grandstream VSAs in Access-Accept for advanced features

### Credentials
- Dashboard: admin / P2231GuestAdmin
- DB: guestadmin / GuestWifi2024Secure (localhost:5432)
- RADIUS: P2231GuestRadius2026

### File: /home/jake/.openclaw/workspace/MEMORY.md
