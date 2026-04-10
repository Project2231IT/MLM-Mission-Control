import sys, json

with open('/var/ossec/logs/alerts/alerts.json') as f:
    lines = f.readlines()

gcp_events = []
for i, line in enumerate(lines):
    line = line.strip()
    if not line:
        continue
    if 'gcp-drive-wodle' in line:
        try:
            event = json.loads(line)
            gcp_events.append(event)
        except:
            pass

if gcp_events:
    print(f'Total GCP events in alerts.json: {len(gcp_events)}')
    last = gcp_events[-1]
    print('\nLatest GCP event:')
    print(f"  timestamp: {last.get('timestamp')}")
    print(f"  rule.id: {last.get('rule',{}).get('id')}")
    print(f"  rule.level: {last.get('rule',{}).get('level')}")
    print(f"  rule.description: {last.get('rule',{}).get('description')}")
    print(f"  rule.groups: {last.get('rule',{}).get('groups')}")
    print(f"  location: {last.get('location')}")
    print(f"  integration: {last.get('integration')}")
    print(f"  data.event_name: {last.get('data',{}).get('event_name')}")
    print(f"  data.actor_email: {last.get('data',{}).get('actor_email')}")
    print(f"  data.file_name: {last.get('data',{}).get('file_name')}")
else:
    print('No GCP events found')