#!/usr/bin/env python3
"""
TRMM Monthly Maintenance Report
Pulls agent data from Tactical RMM and produces a maintenance summary.
"""

import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

TRMM_API = "https://api.project2231.com"
API_KEY = "TODXZWJCH9FJDUQY6WPVE55F7CTVWWLA"

# OS versions considered EOL or near-EOL
EOL_OS = [
    "Windows Server 2012",
    "Windows Server 2016",
    "Windows 10",  # EOL Oct 2025
    "Windows 7",
    "Windows 8",
]

def fetch(path):
    req = urllib.request.Request(
        f"{TRMM_API}{path}",
        headers={"X-API-KEY": API_KEY, "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def days_ago(iso_str):
    if not iso_str:
        return None
    dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - dt).days

def boot_days(boot_ts):
    if not boot_ts:
        return None
    dt = datetime.fromtimestamp(boot_ts, tz=timezone.utc)
    return (datetime.now(timezone.utc) - dt).days

def main():
    agents = fetch("/agents/")
    now = datetime.now(timezone.utc)
    report_date = now.strftime("%B %d, %Y")

    total = len(agents)
    online = [a for a in agents if a["status"] == "online"]
    offline = [a for a in agents if a["status"] != "online"]
    needs_reboot = [a for a in agents if a["needs_reboot"]]
    patches_pending = [a for a in agents if a["has_patches_pending"]]
    failing_checks = [a for a in agents if a["checks"]["has_failing_checks"] and a["checks"]["failing"] > 0]

    # EOL OS detection
    eol_machines = []
    for a in agents:
        os = a.get("operating_system", "")
        for eol in EOL_OS:
            if eol in os:
                eol_machines.append((a["hostname"], a["site_name"], os))
                break

    # Long offline (>7 days)
    long_offline = []
    for a in offline:
        d = days_ago(a.get("last_seen"))
        if d is not None and d > 7:
            long_offline.append((a["hostname"], a["site_name"], d))
    long_offline.sort(key=lambda x: -x[2])

    # Long uptime without reboot (>14 days, servers only)
    long_uptime = []
    for a in agents:
        if a["monitoring_type"] == "server" and a.get("boot_time"):
            days = boot_days(a["boot_time"])
            if days and days > 14:
                long_uptime.append((a["hostname"], a["site_name"], days))
    long_uptime.sort(key=lambda x: -x[2])

    # Old agent versions
    old_agent = [a for a in agents if not a.get("version", "").startswith("2.10")]

    lines = []
    lines.append(f"🦀 TRMM Monthly Maintenance Report — {report_date}")
    lines.append("")
    lines.append(f"📊 Fleet: {total} agents | {len(online)} online | {len(offline)} offline")
    lines.append("")

    # Patch compliance
    pct = round((1 - len(patches_pending) / total) * 100)
    lines.append(f"🔒 Patch Compliance: {total - len(patches_pending)}/{total} fully patched ({pct}%)")
    if patches_pending:
        lines.append("  Machines needing patches:")
        for a in sorted(patches_pending, key=lambda x: x["site_name"]):
            lines.append(f"    • {a['hostname']} ({a['site_name']})")
    lines.append("")

    # EOL / at-risk OS
    if eol_machines:
        lines.append("⚠️ EOL / At-Risk Operating Systems:")
        for hostname, site, os in sorted(eol_machines, key=lambda x: x[1]):
            lines.append(f"    • {hostname} ({site}) — {os[:50]}")
        lines.append("")

    # Failing checks
    if failing_checks:
        lines.append("❌ Failing Checks:")
        for a in failing_checks:
            lines.append(f"    • {a['hostname']} ({a['site_name']}) — {a['checks']['failing']} failing")
        lines.append("")

    # Needs reboot
    if needs_reboot:
        lines.append("🔁 Needs Reboot:")
        for a in needs_reboot:
            lines.append(f"    • {a['hostname']} ({a['site_name']})")
        lines.append("")

    # Servers with long uptime
    if long_uptime:
        lines.append("⏱️ Servers Running >14 Days Without Reboot:")
        for hostname, site, days in long_uptime:
            lines.append(f"    • {hostname} ({site}) — {days} days")
        lines.append("")

    # Long offline machines
    if long_offline:
        lines.append("📴 Machines Offline >7 Days:")
        for hostname, site, days in long_offline:
            lines.append(f"    • {hostname} ({site}) — {days} days offline")
        lines.append("")

    # Old agent versions
    if old_agent:
        lines.append(f"🔧 Outdated TRMM Agent (not v2.10.x): {len(old_agent)} machines")
        for a in old_agent:
            lines.append(f"    • {a['hostname']} ({a['site_name']}) — v{a['version']}")
        lines.append("")

    lines.append("— End of Report")
    print("\n".join(lines))

if __name__ == "__main__":
    main()
