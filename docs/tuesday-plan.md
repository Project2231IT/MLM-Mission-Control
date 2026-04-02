# Tuesday March 31 — IT Infrastructure Plan
## Wazuh Log Server + FreeRADIUS + WiFi Integration

---

## PART 1 — Wazuh Log Server (~45 min)

### Step 1 — Start Wazuh VMs
In Proxmox UI, start in this order and wait 60s between each:
1. **VM111 WazuhIndexer** (pve1)
2. **VM121 WazuhServer** (pve1)
3. **VM122 WazuhDashboard** (pve1)

### Step 2 — Check Wazuh state
SSH or console into WazuhServer (VM121) and run:
```bash
systemctl status wazuh-manager
curl -s https://localhost:55000 -k -u admin:admin | head -20
```
Send Mr. Crabs the output — will assess version and health.

### Step 3 — Install Wazuh agent on P2231-DC
RDP into 172.16.250.1, run in PowerShell as Administrator:
```powershell
Invoke-WebRequest -Uri https://packages.wazuh.com/4.x/windows/wazuh-agent-4.x.x.msi -OutFile wazuh-agent.msi
msiexec /i wazuh-agent.msi WAZUH_MANAGER="<WazuhServer-IP>" /q
NET START WazuhSvc
```
(Mr. Crabs will provide exact version URL after checking VM121)

### Step 4 — Verify DC logs flowing into Wazuh
- Open Wazuh Dashboard (VM122 IP in browser)
- Check Events for DC hostname
- Filter for Event IDs 6272/6273 (NPS auth success/failure)
- This will reveal why RADIUS is failing

---

## PART 2 — FreeRADIUS Server (~60 min)

### Step 1 — Create new Ubuntu VM
In Proxmox UI:
- **VM ID:** 128 (next available)
- **Name:** FreeRADIUS
- **OS:** Ubuntu 24.04 LTS
- **RAM:** 4GB
- **CPU:** 2 cores
- **Disk:** 20GB on Ceph-replicate
- **Network:** vmbr0

### Step 2 — Install FreeRADIUS + dependencies
SSH into the new VM:
```bash
apt update && apt upgrade -y
apt install freeradius freeradius-ldap freeradius-utils -y
systemctl enable freeradius
```

### Step 3 — Configure AD/LDAP authentication (Staff WiFi)
Edit LDAP module:
```bash
nano /etc/freeradius/3.0/mods-enabled/ldap
```
Key settings:
```
server = 'ldap://172.16.250.1'
identity = 'CN=freeradius,CN=Users,DC=project2231,DC=local'
password = '<service account password>'
base_dn = 'DC=project2231,DC=local'
user {
    base_dn = "CN=Users,${base_dn}"
    filter = "(sAMAccountName=%{%{Stripped-User-Name}:-%{User-Name}})"
}
```

### Step 4 — Create AD service account for FreeRADIUS
On P2231-DC in PowerShell:
```powershell
New-ADUser -Name "freeradius" -SamAccountName "freeradius" -UserPrincipalName "freeradius@project2231.local" -AccountPassword (ConvertTo-SecureString "FRad!us@P2231" -AsPlainText -Force) -Enabled $true -PasswordNeverExpires $true
Add-ADGroupMember -Identity "Domain Users" -Members "freeradius"
```

### Step 5 — Configure RADIUS clients (APs)
Edit clients.conf:
```bash
nano /etc/freeradius/3.0/clients.conf
```
Add:
```
client grandstream-aps {
    ipaddr = 172.16.0.0/16
    secret = P2231@Rad!us#Wifi2026
    shortname = grandstream
    nas_type = other
}
```

### Step 6 — Configure EAP for WPA3-Enterprise
Edit EAP module:
```bash
nano /etc/freeradius/3.0/mods-enabled/eap
```
Key settings:
```
default_eap_type = peap
peap {
    default_eap_type = mschapv2
    copy_request_to_tunnel = yes
    use_tunneled_reply = yes
}
```

### Step 7 — Test FreeRADIUS in debug mode
```bash
systemctl stop freeradius
freeradius -X 2>&1 | head -50
```
Look for any errors before enabling.

### Step 8 — Start and enable
```bash
systemctl start freeradius
systemctl status freeradius
```

---

## PART 3 — Guest WiFi Captive Portal (~45 min)

### Option: Use GWN Cloud built-in captive portal
In GWN Cloud:
- Create new SSID: `P2231-Guest`
- Security: Open (no password) or WPA2-Personal (simple password)
- Enable **Captive Portal**
- Set portal type: **Email** (collects email before granting access)
- Set bandwidth limit: 10 Mbps down / 5 Mbps up per client
- Session timeout: 8 hours
- Redirect URL after login: your company website

### Guest RADIUS (if more control needed)
Add to FreeRADIUS clients.conf:
```
# Guest users — simple password auth
client grandstream-guest {
    ipaddr = 172.16.0.0/16
    secret = P2231@Rad!us#Wifi2026
    shortname = grandstream-guest
}
```
Create guest user file:
```bash
nano /etc/freeradius/3.0/users
# Add: guest Cleartext-Password := "Welcome2231"
```

---

## PART 4 — Update GWN Cloud SSID config (~15 min)

### Staff SSID
- Change RADIUS server from 172.16.250.1 (NPS) to FreeRADIUS VM IP
- Keep same port 1812 and secret P2231@Rad!us#Wifi2026
- Keep WPA3-Enterprise + GCMP-128

### Guest SSID
- Create new SSID `P2231-Guest`
- Enable captive portal with email collection
- Apply to all APs

---

## Summary Order
1. ✅ Start Wazuh VMs → install DC agent → debug RADIUS logs
2. ✅ Create FreeRADIUS VM → install → configure AD auth
3. ✅ Test staff auth against FreeRADIUS
4. ✅ Set up guest captive portal in GWN Cloud
5. ✅ Update GWN Cloud to point at FreeRADIUS

**Estimated total time: 3-4 hours**
