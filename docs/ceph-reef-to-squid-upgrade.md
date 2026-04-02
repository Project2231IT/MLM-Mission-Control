# Ceph Reef → Squid Upgrade Plan
**Cluster:** P2231 | pve1 / pve2 / pve3 | 36 HDDs
**From:** 18.2.7 (Reef) → **To:** 19.2.x (Squid)
**Date:** Monday March 30, 2026
**Prerequisites:** Mr. Crabs elevated to Ceph dashboard admin at 8:45am

---

## ✅ Pre-flight Checks (Mr. Crabs runs via API)
- [ ] Cluster health = HEALTH_OK
- [ ] All 36 OSDs up and in
- [ ] No active scrubs or rebalancing
- [ ] Verify pve-manager ≥ 8.2.8 — run on any node: `pveversion --verbose`

---

## STEP 1 — Set noout flag (run ONCE on any node)
Prevents Ceph from marking OSDs out during restarts.
```bash
ceph osd set noout
```
Verify with `ceph -s` — you'll see `HEALTH_WARN noout flag(s) set` which is expected.

---

## STEP 2 — Switch repos on ALL THREE nodes
Run on **pve1, pve2, and pve3** (no restart needed yet):
```bash
sed -i 's/reef/squid/' /etc/apt/sources.list.d/ceph.list
cat /etc/apt/sources.list.d/ceph.list
```
The file should now reference `ceph-squid` instead of `ceph-reef`.

> ⚠️ If you don't have a Proxmox subscription, the line should read:
> `deb http://download.proxmox.com/debian/ceph-squid bookworm no-subscription`

---

## STEP 3 — Run apt upgrade on ALL THREE nodes
Run on **pve1, pve2, and pve3** (packages install but old binaries still running):
```bash
apt update && apt full-upgrade -y
```
This installs Squid packages but doesn't activate them yet — safe to do all nodes.

---

## STEP 4 — Restart MONs one node at a time
Do **pve1 → pve2 → pve3**, waiting for HEALTH_OK between each.

On each node:
```bash
systemctl restart ceph-mon.target
```
After each restart, check health (Mr. Crabs monitors via API):
```bash
ceph -s
```
Expected: `HEALTH_OK` or `HEALTH_WARN noout flag(s) set`

After all 3 monitors restarted, verify Squid took over:
```bash
ceph mon dump | grep min_mon_release
```
Should return: `min_mon_release 19 (squid)`

---

## STEP 5 — Restart MGR daemons on all nodes
```bash
systemctl restart ceph-mgr.target
```
Run on all three nodes. Verify with `ceph -s` — should show 3 mgr daemons.

---

## STEP 6 — Restart OSDs one node at a time
**This is the longest step.** Do **pve1 → pve2 → pve3**, waiting for HEALTH_OK between each.

On each node:
```bash
systemctl restart ceph-osd.target
```
Mr. Crabs will monitor and give you the all-clear before moving to next node.
Each node restart may take 3-10 minutes to re-peer.

---

## STEP 7 — Lock in Squid (run ONCE after all OSDs restarted)
```bash
ceph osd require-osd-release squid
```

---

## STEP 8 — Unset noout flag (run ONCE)
```bash
ceph osd unset noout
```

---

## STEP 9 — Final health check
```bash
ceph -s
ceph osd versions
```
All OSDs should report version 19.2.x.

---

## STEP 10 — Ceph Cache Tuning (while we're in there)
```bash
ceph config set osd bluestore_cache_size 2147483648
```

---

## STEP 11 — ECSSERVER Reboot
Once cluster is HEALTH_OK — reboot VM110 (Embed/ECSSERVER) from Proxmox UI.

---

## Rollback to read-only
```bash
ceph dashboard ac-user-set-roles mrcrabs read-only
```

---

## Notes
- No CephFS in use on this cluster — skip MDS steps
- No iSCSI in use — skip iSCSI known issue
- Total estimated time: 45-90 minutes
- Zero VM downtime expected (rolling upgrade)
