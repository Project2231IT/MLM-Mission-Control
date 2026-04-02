# Proxmox VE 8 → 9 Upgrade Plan
**Cluster:** P2231 | pve1 / pve2 / pve3
**From:** PVE 8.4.17 → **To:** PVE 9.x (Debian Bookworm → Trixie)
**Date:** Tuesday March 31, 2026
**Prerequisites:** Ceph Squid ✅ (completed March 30)

---

## ✅ Pre-flight Checks (run before starting)
- [ ] Cluster health = HEALTH_OK: `ceph -s`
- [ ] All 36 OSDs up and in
- [ ] pve8to9 --full shows 0 failures on all nodes
- [ ] Backups of all VMs verified

---

## STEP 1 — Install intel-microcode on ALL 3 nodes (if not done)
```bash
echo "deb http://deb.debian.org/debian bookworm non-free non-free-firmware" >> /etc/apt/sources.list
apt update && apt install intel-microcode -y
```

---

## STEP 2 — Switch repos to PVE 9 / Trixie on the node being upgraded
Run on each node one at a time:
```bash
# Switch Debian base repo
sed -i 's/bookworm/trixie/g' /etc/apt/sources.list

# Switch PVE repo
sed -i 's/bookworm/trixie/g' /etc/apt/sources.list.d/pve-enterprise.list 2>/dev/null || true
sed -i 's/bookworm/trixie/g' /etc/apt/sources.list.d/pve-no-subscription.list 2>/dev/null || true

# Verify
cat /etc/apt/sources.list
```

---

## STEP 3 — Run the upgrade on that node
```bash
apt update
apt full-upgrade -y
```
This will take 15-25 minutes. If prompted about config files, keep local versions unless you know otherwise.

---

## STEP 4 — Reboot the node
```bash
reboot
```
Wait for node to come back up in Proxmox UI before moving to next node.

---

## STEP 5 — Verify after reboot
```bash
pveversion
ceph -s
```
Should show PVE 9.x and Ceph HEALTH_OK before proceeding to next node.

---

## Order: pve1 → pve2 → pve3
Repeat Steps 2-5 for each node. Mr. Crabs monitors Ceph health between each node.

---

## Notes
- No subscription? Use `pve-no-subscription` repo instead of enterprise
- VMs on that node will be briefly unavailable during reboot (~3-5 min)
- HA will auto-migrate VMs if configured
- Total estimated time: 1-2 hours
- intel-microcode takes effect on reboot (covered by Step 4)
