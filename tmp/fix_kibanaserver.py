import urllib.request
import ssl
import json
import base64

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Try with admin certificate via PEM file
import os, subprocess

# Get admin cert/key content  
cert_path = '/tmp/admin_cert.pem'
key_path = '/tmp/admin_key.pem'

# Read the cert and key
with open('/etc/ssl/certs/ca-certificates.crt', 'r') as f:
    ca_certs = f.read()

# Get the admin cert
result = subprocess.run(['sudo', 'cat', '/etc/wazuh-indexer/certs/admin.pem'], capture_output=True, text=True)
admin_cert = result.stdout

result = subprocess.run(['sudo', 'cat', '/etc/wazuh-indexer/certs/admin-key.pem'], capture_output=True, text=True)
admin_key = result.stdout

# Create a combined pem file
with open('/tmp/admin_combined.pem', 'w') as f:
    f.write(admin_key + admin_cert)

os.chmod('/tmp/admin_combined.pem', 0o600)

# Try using curl instead since it handles certs better
result = subprocess.run([
    'curl', '-sk', '--cert', '/tmp/admin_combined.pem',
    '-u', 'admin:P2231-Wazuh.Idx#73faf1a834b7',
    '-X', 'PUT',
    '-H', 'Content-Type: application/json',
    '-d', '{"password":"P2231WazuhKbn2026"}',
    'https://172.16.201.18:9200/_plugins/_security/api/internalusers/kibanaserver'
], capture_output=True, text=True, timeout=15)

print("STDOUT:", result.stdout)
print("STDERR:", result.stderr[:500] if result.stderr else "")
print("RC:", result.returncode)