# Tuesday March 31 — Daily IT Schedule
## Goals: Wazuh + FreeRADIUS + DNS Filtering + Docker Inventory

---

## 9:00am — Morning Kickoff (15 min)
- Mr. Crabs runs pre-flight: Ceph health, all VMs running, cluster stable
- Review any overnight alerts from LibreNMS/TRMM

---

## 9:15am — PART 1: Wazuh Log Server (45 min)
**Goal: Wazuh fully operational with DC agent by 10:00am**

- Start VM111 (WazuhIndexer) → VM121 (WazuhServer) → VM122 (WazuhDashboard)
- Mr. Crabs checks versions and health
- Install Wazuh agent on P2231-DC (172.16.250.1)
- Verify NPS event logs (6272/6273) flowing in
- **Outcome:** Can see RADIUS auth failures in Wazuh dashboard

---

## 10:00am — PART 2: Debug RADIUS Failure (30 min)
**Goal: Staff WiFi authenticating successfully by 10:30am**

- Pull NPS failure event from Wazuh — identify exact error
- Fix NPS config or switch to FreeRADIUS based on what we find
- Test domain credential login on a device
- **Outcome:** Staff WiFi working with AD credentials

---

## 10:30am — PART 3: FreeRADIUS VM (60 min)
**Goal: FreeRADIUS running with AD auth by 11:30am**

- Create Ubuntu 24.04 VM (ID 128, 4GB RAM, 2 CPU, 20GB)
- Install freeradius + freeradius-ldap
- Create AD service account for FreeRADIUS
- Configure LDAP/AD auth + EAP-PEAP
- Test auth in debug mode
- Point GWN Cloud Staff SSID at FreeRADIUS
- **Outcome:** Staff WiFi running through FreeRADIUS

---

## 11:30am — BREAK (15 min)

---

## 11:45am — PART 4: Guest WiFi Captive Portal (30 min)
**Goal: Guest WiFi live with email collection by 12:15pm**

- Create P2231-Guest SSID in GWN Cloud
- Enable captive portal with email collection
- Set bandwidth limits (10/5 Mbps per client)
- Set session timeout (8 hours)
- Test on a personal device
- **Outcome:** Guests connect, enter email, get internet

---

## 12:15pm — LUNCH (45 min)

---

## 1:00pm — PART 5: NxFilter DNS Filtering (60 min)
**Goal: NxFilter running and filtering DNS for all sites by 2:00pm**

- Create Ubuntu VM (ID 129, 2GB RAM, 1 CPU, 20GB)
- Install NxFilter
- Configure basic policy: block malware/phishing/adult content
- Point OPNsense DNS at NxFilter
- Test filtering is working
- **Outcome:** All devices on network using filtered DNS

---

## 2:00pm — PART 6: Portainer Inventory + Update (45 min)
**Goal: Portainer updated and all containers documented by 2:45pm**

- Jake provides Portainer URL + credentials
- Mr. Crabs inventories all running containers
- Update Portainer CE to latest
- Update any outdated containers
- Document Docker stack in ITFlow
- **Outcome:** Clean, updated Docker environment

---

## 2:45pm — PART 7: OPNsense → Wazuh Integration (30 min)
**Goal: Firewall logs flowing into Wazuh by 3:15pm**

- Configure OPNsense syslog to ship to Wazuh
- Enable Suricata IDS/IPS if not already on
- Verify firewall events appear in Wazuh
- **Outcome:** Full security visibility — endpoints + AD + firewall in one place

---

## 3:15pm — Wrap Up (30 min)
- Document everything created today in ITFlow
- Update asset records
- Mr. Crabs runs final health check across all systems
- Set any needed reminders for follow-up items

---

## 3:45pm — Done ✅

---

## Summary of Outcomes
By end of day Tuesday:
- ✅ Wazuh SIEM live with DC + firewall logs
- ✅ Staff WiFi working (FreeRADIUS + AD)
- ✅ Guest WiFi with email captive portal
- ✅ DNS filtering across all sites (NxFilter)
- ✅ Docker stack inventoried and updated
- ✅ Full security stack: OPNsense + Wazuh + NxFilter + FreeRADIUS

**Estimated total: ~6.5 hours of work**
