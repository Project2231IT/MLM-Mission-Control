from google.cloud import pubsub_v1
from google.cloud.pubsub_v1 import types
creds = '/var/ossec/wodles/gcloud/credentials/wazuh-gcp-reader.json'
project_id = 'affable-tribute-492617-p0'
subscriber = pubsub_v1.SubscriberClient.from_service_account_json(creds)
sub_path = f'projects/{project_id}/subscriptions/workspace-logs-sub'

response = subscriber.pull(request={'subscription': sub_path, 'max_messages': 10})
print(f'Received {len(response.received_messages)} messages')
for msg in response.received_messages:
    data = msg.message.data.decode() if msg.message.data else '(empty)'
    print(f'  ID: {msg.message.message_id}, Data: {data[:200]}')
    subscriber.acknowledge(request={'subscription': sub_path, 'ack_ids': [msg.ack_id]})
print('Done')