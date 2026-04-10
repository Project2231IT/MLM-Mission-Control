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
| ITFlow VM | 172.16.201.15 | — | VM120 on pve1 |
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

## ITFlow Details
- Decryption password: afLwp86rrzKWu3oen9G-ME8MxXt8DGsh
- Jake's user ID: 10 · contact IDs: 11 (P2231), 16 (TCF), 36 (ACME)
- Always assign tickets to user 10

## Telegram Topics
- Topic 2 — Argus & cameras
- Topic 890 — MDM

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
