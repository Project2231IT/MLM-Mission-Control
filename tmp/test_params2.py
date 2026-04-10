from google.oauth2 import service_account
from googleapiclient import discovery
import datetime
import json

creds = service_account.Credentials.from_service_account_file(
    '/var/ossec/wodles/gcloud/credentials/wazuh-gcp-reader.json',
    scopes=['https://www.googleapis.com/auth/admin.reports.audit.readonly'],
    subject='it@project2231.com'
)
service = discovery.build('admin', 'reports_v1', credentials=creds, cache_discovery=False)
start_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=30)
results = service.activities().list(
    userKey='all',
    applicationName='drive',
    startTime=start_time.isoformat(),
    maxResults=5
).execute()

DOMAIN = 'thecityforum.com'

for item in results.get('items', [])[:5]:
    actor = item.get('actor', {})
    ip_address = item.get('ipAddress', 'unknown')
    events = item.get('events', [{}])
    event = events[0]
    
    params = event.get('parameters', [])
    event_data = {}
    for param in params:
        key = param.get('key', '')
        value = param.get('value', param.get('multiValue', []))
        if isinstance(value, list):
            value = ','.join(str(v) for v in value) if value else ''
        event_data[key] = value
    
    actor_email = actor.get('email', 'unknown')
    is_external = DOMAIN not in actor_email
    
    print('=== Event ===')
    print('  Actor email:', actor_email)
    print('  IP:', ip_address)
    print('  Event name:', event.get('name'))
    print('  Event type:', event.get('type'))
    print('  All params:', json.dumps(event_data, indent=2))
    print('  Is external:', is_external)
    print()