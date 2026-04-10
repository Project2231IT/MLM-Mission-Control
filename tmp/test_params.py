from google.oauth2 import service_account
from googleapiclient import discovery
import datetime

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
    maxResults=3
).execute()
for item in results.get('items', [])[:3]:
    print('=== ACTIVITY ===')
    actor = item.get('actor', {})
    events = item.get('events', [{}])
    event = events[0]
    print('Actor:', actor)
    print('IP:', item.get('ipAddress'))
    print('Event name:', event.get('name'))
    print('Event type:', event.get('type'))
    print('Parameters:', event.get('parameters'))
    print()