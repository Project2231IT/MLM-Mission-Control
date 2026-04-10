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
    maxResults=3
).execute()

for item in results.get('items', [])[:3]:
    print('=== FULL PARAMS FOR EVENT ===')
    events = item.get('events', [{}])
    event = events[0]
    params = event.get('parameters', [])
    for param in params:
        print(f'  Key: {param.get("key")}, Value type: {type(param.get("value"))}, Value: {str(param.get("value"))[:200]}')
    print()