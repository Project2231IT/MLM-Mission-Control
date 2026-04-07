#!/usr/bin/env python3
import sys
sys.path.insert(0, '/var/ossec/wodles/gcloud')
from tools import get_script_arguments, logger
import tools
import logging

# Set up logger
log = logging.getLogger(':gcloud_wodle:')
log.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter('%(name)s - %(levelname)s - %(message)s'))
log.addHandler(handler)

try:
    args = get_script_arguments()
    print(f"integration_type: {args.integration_type}")
    print(f"project: {args.project}")
    print(f"subscription_id: {args.subscription_id}")
    print(f"credentials_file: {args.credentials_file}")
    print(f"max_messages: {args.max_messages}")
    print(f"num_threads: {args.n_threads}")
    print("SUCCESS: Arguments parsed correctly")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()