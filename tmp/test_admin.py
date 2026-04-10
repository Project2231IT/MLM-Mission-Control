from google.oauth2 import service_account
from googleapiclient import discovery
import datetime

SCOPES = [
    'https://www.googleapis.com/auth/admin.reports.audit.readonly',
    'https://www.googleapis.com/auth/admin.directory.user.readonly'
]
creds = service_account.Credentials.from_service_account_file(
    '/var/ossec/wodles/gcloud/credentials/wazuh-gcp-reader.json',
    scopes=SCOPES,
    subject='it@project2231.com'
)
print('Creds OK')
service = discovery.build('admin', 'reports_v1', credentials=creds, cache_discovery=False)
print('Service built OK')
start_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=30)
results = service.activities().list(
    userKey='all',
    applicationName='drive',
    startTime=start_time.isoformat(),
    maxResults=5
).execute()
items = results.get('items', [])
print(f'Found {len(items)} Drive activities')
for item in items[:3]:
    events = item.get('events', [{}])
    name = events[0].get('name', 'unknown') if events else 'unknown'
    email = item.get('actor', {}).get('email', 'unknown')
    print(f'  - {name} by {email}')