import sys,json,subprocess

result = subprocess.run([
    'curl', '-s', '-k', '-u', 'wazuh:P2231-Wazuh.Api#cf65cc787cfb',
    '-X', 'POST', 'https://172.16.201.19:55000/security/user/authenticate?raw=true'
], capture_output=True, text=True)
token = result.stdout.strip()

# Check rules individually
for rid in ['9010', '9011', '65000', '0690']:
    result = subprocess.run([
        'curl', '-s', '-k', '-H', f'Authorization: Bearer {token}',
        f'https://172.16.201.19:55000/rules?rule_ids={rid}&pretty=true'
    ], capture_output=True, text=True)
    d = json.loads(result.stdout)
    items = d.get('data', {}).get('affected_items', [])
    if items:
        r = items[0]
        print(f"Rule {rid}: filename={r.get('filename')}, level={r.get('level')}, exists=True")
    else:
        print(f"Rule {rid}: exists=False")