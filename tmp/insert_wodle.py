import sys

with open('/var/ossec/etc/ossec.conf', 'r') as f:
    lines = f.readlines()

# Find the first </ossec_config> at line 319 (index 318)
insert_after = None
for i, line in enumerate(lines):
    if line.strip() == '</ossec_config>' and insert_after is None:
        insert_after = i
        break

gcloud_wodle = """  <!-- Google Cloud Pub/Sub integration for Workspace audit logs -->
  <wodle name="gcloud-pubsub">
    <disabled>no</disabled>
    <interval>1m</interval>
    <project>affable-tribute-492617-p0</project>
    <subscription_id>workspace-logs-sub</subscription_id>
    <credentials_file>/var/ossec/wodles/gcloud/credentials/wazuh-gcp-reader.json</credentials_file>
    <max_messages>100</max_messages>
    <num_threads>1</num_threads>
  </wodle>
"""

lines.insert(insert_after, gcloud_wodle)

with open('/var/ossec/etc/ossec.conf', 'w') as f:
    f.writelines(lines)

print(f"Inserted gcloud wodle after line {insert_after + 1}")