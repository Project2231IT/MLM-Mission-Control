#!/usr/bin/env python3
"""
Google Workspace Admin SDK - Drive Audit Logs to Wazuh
Uses syslog-style text format for reliable field extraction by Wazuh decoder
"""
import sys
import json
import logging
import datetime

sys.path.insert(0, '/var/ossec/wodles/gcloud')

from google.oauth2 import service_account
from googleapiclient import discovery

CREDS_FILE = '/var/ossec/wodles/gcloud/credentials/wazuh-gcp-reader.json'
ADMIN_EMAIL = 'it@project2231.com'
SCOPES = [
    'https://www.googleapis.com/auth/admin.reports.audit.readonly',
    'https://www.googleapis.com/auth/admin.directory.user.readonly'
]
OUTPUT_FILE = '/var/ossec/logs/wazuh-gcp-drive.json'
LOG_FILE = '/var/ossec/logs/wazuh-gcp-drive.log'

INTERNAL_DOMAINS = [
    'thecityforum.com', 'acmeathleticstn.com', 'danaknottwellness.com',
    'dock17tn.com', 'misslucillescafe.com', 'misslucilleskettlecorn.com',
    'misslucillesmarketplace.com', 'project2231.com', 'thebellehollow.com',
    'theloadingdocktn.com', 'themadisonroom.com', 'varsitypinssocial.com',
    'varsitypinstn.com', 'whodaregothere.com',
]
EXTERNAL_DOMAINS = ['hometownprofit.com', 'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger('wazuh-gcp-drive')

def get_creds():
    return service_account.Credentials.from_service_account_file(
        CREDS_FILE, scopes=SCOPES, subject=ADMIN_EMAIL)

def build_svc(creds):
    return discovery.build('admin', 'reports_v1', credentials=creds, cache_discovery=False)

def fetch_activity(svc, start_time, max_results=100):
    try:
        results = svc.activities().list(
            userKey='all', applicationName='drive',
            startTime=start_time.isoformat(), maxResults=max_results
        ).execute()
        return results.get('items', [])
    except Exception as e:
        log.error("Fetch error: " + str(e))
        return []

def is_internal(email):
    if not email:
        return False
    e = email.lower()
    for x in EXTERNAL_DOMAINS:
        if x in e:
            return False
    for d in INTERNAL_DOMAINS:
        if '@' + d in e:
            return True
    return False

SEVERITY_MAP = {
    'access_item_content': 3, 'view': 3, 'prefetch_item_content': 3, 'preview': 3,
    'create': 4, 'sync_item_content': 4, 'upload': 4, 'copy': 5, 'edit': 5, 'move': 5,
    'download': 6, 'share': 6, 'modify_permissions': 6,
    'delete': 7, 'unshare': 7, 'remove': 7,
}

def get_severity(name, vis):
    s = SEVERITY_MAP.get(name, 3)
    if vis == 'shared_externally':
        s = max(s, 6)
    return s

def make_log_line(activity):
    """Generate a Wazuh-readable log line with field extraction markers"""
    try:
        actor = activity.get('actor', {})
        ip = activity.get('ipAddress', 'unknown')
        netinfo = activity.get('networkInfo', {})
        events = (activity.get('events') or [{}])[0]
        ts = events.get('time', datetime.datetime.now(datetime.timezone.utc).isoformat())
        ename = events.get('name', 'unknown')
        
        params = {}
        for p in events.get('parameters', []):
            k = p.get('name', '')
            v = p.get('value')
            if v is None:
                mv = p.get('multiValue', [])
                v = ','.join(str(x) for x in mv) if mv else ''
            params[k] = v
        
        email = actor.get('email', 'unknown')
        vis = params.get('visibility', '')
        internal = is_internal(email)
        
        # Format: GCP_DRIVE event=download actor=test@domain.com file=filename vis=shared_externally ip=1.2.3.4
        # Wazuh decoder will extract these fields using regex
        line = (
            f"GCP_DRIVE "
            f"event={ename} "
            f"actor={email} "
            f"file={params.get('doc_title', '')} "
            f"vis={vis} "
            f"internal={str(internal)} "
            f"ip={ip} "
            f"region={netinfo.get('regionCode', '')} "
            f"owner={params.get('owner', '')} "
            f"app={actor.get('applicationInfo', {}).get('applicationName', '')}"
        )
        return ts, line
    except Exception as e:
        log.error("Make log error: " + str(e))
        return None, None

def write_logs(log_lines):
    if not log_lines:
        return
    with open(OUTPUT_FILE, 'a') as f:
        for ts, line in log_lines:
            f.write(f"{ts} {line}\n")
    log.info("Wrote " + str(len(log_lines)) + " log lines")

def main():
    log.info("Starting Drive audit collection")
    creds = get_creds()
    svc = build_svc(creds)
    start = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=10)
    items = fetch_activity(svc, start)
    if not items:
        log.info("No activity found")
        return
    log.info("Found " + str(len(items)) + " activities")
    log_lines = [make_log_line(x) for x in items]
    log_lines = [(ts, line) for ts, line in log_lines if ts]
    write_logs(log_lines)
    for ts, line in log_lines:
        print(f"{ts} {line}")
    log.info("Done - processed " + str(len(log_lines)) + " events")

if __name__ == '__main__':
    main()