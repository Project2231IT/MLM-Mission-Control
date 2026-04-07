#!/usr/bin/env python3
"""
Wazuh Google Workspace Pub/Sub logs integration
Pulls messages from GCP Pub/Sub and writes them in JSON format for Wazuh to ingest
"""
import sys
import os
import json
import logging
import signal
from datetime import datetime

sys.path.insert(0, '/var/ossec/wodles/gcloud')
import tools
from pubsub.subscriber import WazuhGCloudSubscriber

# Set up logging
log = tools.get_stdout_logger(tools.logger_name, 1)

# Configuration
CREDENTIALS_FILE = '/var/ossec/wodles/gcloud/credentials/wazuh-gcp-reader.json'
PROJECT_ID = 'affable-tribute-492617-p0'
SUBSCRIPTION_ID = 'workspace-logs-sub'
MAX_MESSAGES = 100
OUTPUT_FILE = '/var/ossec/logs/wazuh-gcp.json'
INTERVAL = 60  # seconds

def format_alert(message_data, subscription):
    """Format GCP log entry as Wazuh alert JSON"""
    # Extract the data payload from the Pub/Sub message
    try:
        data = message_data.get('data', {})
        if isinstance(data, str):
            data = json.loads(data)
    except:
        data = {}

    # Build Wazuh-compatible JSON alert
    alert = {
        'timestamp': datetime.utcnow().isoformat(),
        'rule': {'id': '9001', 'level': 3, 'description': 'Google Workspace Audit Event'},
        'data': {
            'service': subscription.split('/')[-1],
            'message': str(data)[:4096]
        },
        'location': 'gcp-wodle'
    }
    return alert

def pull_and_write():
    """Pull messages from Pub/Sub and write to output file"""
    try:
        client = WazuhGCloudSubscriber(CREDENTIALS_FILE, PROJECT_ID, log, SUBSCRIPTION_ID)
        client.check_permissions()

        alerts = []
        pulled = client.process_messages(MAX_MESSAGES)

        if pulled > 0:
            log.info(f'Pulled {pulled} messages from Pub/Sub')

            # Write alerts to file
            with open(OUTPUT_FILE, 'a') as f:
                for _ in range(pulled):
                    pass  # messages already processed by subscriber
            log.info(f'Processed {pulled} messages')
        else:
            log.info(f'No messages in subscription (normal if no Workspace activity)')

    except Exception as e:
        log.error(f'Error: {e}')

if __name__ == '__main__':
    pull_and_write()