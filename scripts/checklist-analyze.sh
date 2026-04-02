#!/bin/bash
# Checklist Analysis — runs from OpenClaw host (jakesopenclaw)
# SSHes into Argus VM, pulls pending tasks + snapshots, outputs JSON for the agent to analyze
# Usage: ./checklist-analyze.sh [YYYY-MM-DD]

set -e
ARGUS_HOST="mrcrabs@172.16.201.23"
ARGUS_DIR="/home/mrcrabs/argus"
LOCAL_TMP="/tmp/checklist-analysis-$$"

DATE="${1:-$(TZ=America/Chicago date -d 'yesterday' +%Y-%m-%d)}"

mkdir -p "$LOCAL_TMP"

# Pull checklists.json
scp -q "$ARGUS_HOST:$ARGUS_DIR/data/checklists.json" "$LOCAL_TMP/checklists.json"

# Find pending results for the date
python3 -c "
import json, sys
d = json.load(open('$LOCAL_TMP/checklists.json'))
tasks = {t['id']: t for t in d['tasks']}
pending = [r for r in d['results'] if r['date'] == '$DATE' and r['status'] == 'pending' and len(r.get('snapshots', [])) > 0]
if not pending:
    print('NO_PENDING')
    sys.exit(0)
for r in pending:
    t = tasks.get(r['taskId'], {})
    snaps = r.get('snapshots', [])
    # Sample max 6, front-weighted: 4 from first 40% + 2 from remainder
    if len(snaps) > 6:
        split = max(1, int(len(snaps) * 0.4))
        early, late = snaps[:split], snaps[split:]
        early_sel = [early[int(i * len(early) / 4)] for i in range(min(4, len(early)))]
        late_sel = [late[int(i * len(late) / 2)] for i in range(min(2, len(late)))]
        snaps = early_sel + late_sel
    info = {
        'resultId': r['id'],
        'taskId': r['taskId'],
        'taskName': t.get('name', ''),
        'business': t.get('business', ''),
        'lookFor': t.get('lookFor', ''),
        'snapshots': [{'file': s['file'], 'cameraName': s.get('cameraName',''), 'time': s.get('time','')} for s in snaps]
    }
    print(json.dumps(info))
"

# If we have pending tasks, pull snapshots locally
python3 -c "
import json
d = json.load(open('$LOCAL_TMP/checklists.json'))
pending = [r for r in d['results'] if r['date'] == '$DATE' and r['status'] == 'pending' and len(r.get('snapshots', [])) > 0]
files = set()
for r in pending:
    snaps = r.get('snapshots', [])
    if len(snaps) > 6:
        split = max(1, int(len(snaps) * 0.4))
        early, late = snaps[:split], snaps[split:]
        early_sel = [early[int(i * len(early) / 4)] for i in range(min(4, len(early)))]
        late_sel = [late[int(i * len(late) / 2)] for i in range(min(2, len(late)))]
        snaps = early_sel + late_sel
    for s in snaps:
        files.add(s['file'])
for f in files:
    print(f)
" | while read -r remote_file; do
    local_file="$LOCAL_TMP/$(basename "$remote_file")"
    scp -q "$ARGUS_HOST:$remote_file" "$local_file" 2>/dev/null || true
done

echo "SNAPSHOTS_DIR=$LOCAL_TMP"
