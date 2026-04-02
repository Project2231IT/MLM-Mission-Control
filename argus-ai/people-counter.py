#!/usr/bin/env python3
"""
People Counter v2 — YOLO + Person Tracking + Line Crossing

Watches entry/exit cameras via RTSP, tracks people using YOLOv8n + IoU matching,
and counts entries/exits when tracked people cross a configurable line at each door.

Replaces the old vision-LLM snapshot-based counter with real-time detection.
"""

import cv2
import json
import time
import signal
import sys
import os
import threading
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from collections import deque

# --- Paths ---
SCRIPT_DIR = Path(__file__).parent
LOCAL_DATA_DIR = SCRIPT_DIR / 'counter-data'
LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)

CAMERAS_FILE = LOCAL_DATA_DIR / 'entry-cameras.json'
COUNTS_FILE = LOCAL_DATA_DIR / 'people-counts.json'
HISTORY_DIR = LOCAL_DATA_DIR / 'people-history'
COUNTER_CONFIG_FILE = LOCAL_DATA_DIR / 'people-counter-config.json'
MODEL_PATH = SCRIPT_DIR / 'yolov8n.pt'

# Remote paths on Argus
REMOTE_DATA = '/home/mrcrabs/argus/data'
REMOTE_CAMERAS = f'{REMOTE_DATA}/entry-cameras.json'
REMOTE_COUNTS = f'{REMOTE_DATA}/people-counts.json'
REMOTE_HISTORY = f'{REMOTE_DATA}/people-history'
REMOTE_COUNTER_CONFIG = f'{REMOTE_DATA}/people-counter-config.json'

# Import remote sync
sys.path.insert(0, str(SCRIPT_DIR))
from remote_sync import read_remote_json, write_remote_json

# Detection parameters
PERSON_CLASS = 0
PERSON_CONF_THRESHOLD = 0.30
TARGET_FPS = 8          # Per camera — lower than barista since we have 5 cameras
CYCLE_INTERVAL_S = 0.5  # Process each camera every 0.5s (round-robin)
CROSS_COOLDOWN_S = 3.0  # Same person can't cross same line within 3s
LOG_INTERVAL_S = 30.0   # Log stats every 30s


# ─── RTSP URL builder ─────────────────────────────────────────────────────

def build_rtsp_url(cam: dict) -> str:
    """Build RTSP URL from camera config."""
    ip = cam['ip']
    ch = cam['channel']
    user = cam.get('username', '')
    pw = cam.get('password', '')
    protocol = cam.get('protocol', 'onvif')
    auth = f"{user}:{pw}@" if user else ""

    if protocol in ('isapi', 'hikvision'):
        return f"rtsp://{auth}{ip}:554/Streaming/channels/{ch * 100 + 1}"
    elif protocol in ('tvt', 'onvif'):
        return f"rtsp://{auth}{ip}:554/chID={ch}&streamType=sub"
    else:
        # uniview / lapi
        return f"rtsp://{auth}{ip}:554/unicast/c{ch}/s0/live"


# ─── Threaded RTSP Reader (one per camera) ─────────────────────────────────

class RTSPReader:
    """Background thread that continuously grabs frames from an RTSP stream."""

    def __init__(self, url: str, camera_name: str, buffer_size: int = 1):
        self.url = url
        self.camera_name = camera_name
        self.frame = None
        self.frame_time = 0.0
        self.lock = threading.Lock()
        self.running = True
        self.connected = False
        self.reconnect_count = 0
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):
        cap = None
        while self.running:
            if cap is None or not cap.isOpened():
                self.connected = False
                if cap:
                    cap.release()
                backoff = min(2 ** min(self.reconnect_count, 5), 30)
                if self.reconnect_count > 0:
                    time.sleep(backoff)
                cap = cv2.VideoCapture(self.url)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                if cap.isOpened():
                    self.connected = True
                    self.reconnect_count = 0
                    print(f'[people-counter] {self.camera_name}: stream connected')
                else:
                    self.reconnect_count += 1
                    continue

            ret, frame = cap.read()
            if not ret:
                self.reconnect_count += 1
                cap.release()
                cap = None
                continue

            with self.lock:
                self.frame = frame
                self.frame_time = time.time()

        if cap:
            cap.release()

    def read(self):
        with self.lock:
            if self.frame is not None:
                return self.frame.copy(), self.frame_time
            return None, 0.0

    def stop(self):
        self.running = False


# ─── Person Tracker (per camera) ──────────────────────────────────────────

class PersonTracker:
    """IoU-based multi-object tracker. Tracks people with stable IDs."""

    def __init__(self, iou_threshold=0.25, max_missing=15):
        self.tracks: dict[int, dict] = {}
        self.next_id = 1
        self.iou_threshold = iou_threshold
        self.max_missing = max_missing

    @staticmethod
    def _iou(a, b):
        x1 = max(a[0], b[0])
        y1 = max(a[1], b[1])
        x2 = min(a[2], b[2])
        y2 = min(a[3], b[3])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        area_a = (a[2] - a[0]) * (a[3] - a[1])
        area_b = (b[2] - b[0]) * (b[3] - b[1])
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0

    def update(self, detections: list[dict]) -> dict[int, dict]:
        """Update tracks. Each det: {'bbox': [x1,y1,x2,y2], 'cx': float, 'cy': float, 'confidence': float}
        Returns tracks dict with prev_cy for line-crossing detection."""
        for tid in self.tracks:
            self.tracks[tid]['missing'] += 1
            self.tracks[tid]['prev_cx'] = self.tracks[tid]['cx']
            self.tracks[tid]['prev_cy'] = self.tracks[tid]['cy']

        used_tracks = set()
        used_dets = set()
        matches = []

        for di, det in enumerate(detections):
            best_tid = None
            best_iou = 0
            for tid, track in self.tracks.items():
                if tid in used_tracks:
                    continue
                iou = self._iou(det['bbox'], track['bbox'])
                if iou > best_iou and iou >= self.iou_threshold:
                    best_iou = iou
                    best_tid = tid
            if best_tid is not None:
                matches.append((best_tid, di))
                used_tracks.add(best_tid)
                used_dets.add(di)

        for tid, di in matches:
            det = detections[di]
            self.tracks[tid].update({
                'bbox': det['bbox'],
                'cx': det['cx'],
                'cy': det['cy'],
                'confidence': det['confidence'],
                'missing': 0,
            })

        for di, det in enumerate(detections):
            if di in used_dets:
                continue
            self.tracks[self.next_id] = {
                'bbox': det['bbox'],
                'cx': det['cx'],
                'cy': det['cy'],
                'prev_cx': det['cx'],
                'prev_cy': det['cy'],
                'confidence': det['confidence'],
                'missing': 0,
                'created_at': time.time(),
            }
            self.next_id += 1

        stale = [tid for tid, t in self.tracks.items() if t['missing'] > self.max_missing]
        for tid in stale:
            del self.tracks[tid]

        return self.tracks


# ─── Line crossing detector ───────────────────────────────────────────────

class LineCrossingDetector:
    """Detects when tracked people cross a counting line.

    The line is defined by two points (normalized 0..1).
    Direction is determined by which side the person crosses from.

    'entry_side' defines which side of the line counts as the "outside"
    (so crossing FROM entry_side TO the other side = entry).
    """

    def __init__(self, line_start: dict, line_end: dict, entry_side: str = 'above'):
        """
        line_start/end: {'x': float, 'y': float} in normalized coords
        entry_side: 'above' or 'below' or 'left' or 'right'
          - 'above': person coming from smaller y → larger y = entry
          - 'below': person coming from larger y → smaller y = entry
          - 'left': person coming from smaller x → larger x = entry
          - 'right': person coming from larger x → smaller x = entry
        """
        self.line_start = line_start
        self.line_end = line_end
        self.entry_side = entry_side
        self.cooldowns: dict[int, float] = {}  # track_id → last_cross_time

    def _side_of_line(self, px: float, py: float) -> float:
        """Returns signed value: positive = one side, negative = other side.
        Uses cross product of line vector and point-to-start vector."""
        x1, y1 = self.line_start['x'], self.line_start['y']
        x2, y2 = self.line_end['x'], self.line_end['y']
        return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)

    def check_crossings(self, tracks: dict[int, dict]) -> list[dict]:
        """Check all tracks for line crossings.
        Returns list of {'track_id': int, 'direction': 'entry'|'exit'}"""
        now = time.time()
        crossings = []

        # Clean old cooldowns
        stale = [tid for tid, t in self.cooldowns.items() if now - t > CROSS_COOLDOWN_S]
        for tid in stale:
            del self.cooldowns[tid]

        for tid, track in tracks.items():
            if track['missing'] > 0:
                continue
            if tid in self.cooldowns:
                continue

            prev_side = self._side_of_line(track['prev_cx'], track['prev_cy'])
            curr_side = self._side_of_line(track['cx'], track['cy'])

            # Check if crossed (sign change)
            if prev_side * curr_side < 0:
                # Determine direction based on entry_side config
                # For simple horizontal lines: positive side = below, negative = above
                # For simple vertical lines: positive side = right, negative = left
                if self.entry_side == 'above':
                    is_entry = prev_side < 0  # was above (negative), now below
                elif self.entry_side == 'below':
                    is_entry = prev_side > 0  # was below (positive), now above
                elif self.entry_side == 'left':
                    is_entry = prev_side < 0
                elif self.entry_side == 'right':
                    is_entry = prev_side > 0
                else:
                    is_entry = prev_side < 0  # default

                direction = 'entry' if is_entry else 'exit'
                crossings.append({'track_id': tid, 'direction': direction})
                self.cooldowns[tid] = now

        return crossings


# ─── Data persistence (compatible with v1 format) ─────────────────────────

def load_counts() -> dict:
    # Try remote first
    remote = read_remote_json(REMOTE_COUNTS)
    if remote is not None:
        COUNTS_FILE.write_text(json.dumps(remote, indent=2))
        return remote
    try:
        if COUNTS_FILE.exists():
            return json.loads(COUNTS_FILE.read_text())
    except Exception:
        pass
    return {'counts': {}, 'cameraState': {}}


def save_counts(data: dict):
    try:
        tmp = str(COUNTS_FILE) + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, str(COUNTS_FILE))
    except Exception as e:
        print(f'[people-counter] Failed to save counts locally: {e}')
    write_remote_json(REMOTE_COUNTS, data, min_interval=2.0)


def today_string() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')


def chicago_today() -> str:
    from datetime import timezone as tz
    parts = datetime.now(timezone.utc).astimezone()
    # Use Chicago time for day boundaries
    try:
        from zoneinfo import ZoneInfo
        chi = datetime.now(ZoneInfo('America/Chicago'))
        return chi.strftime('%Y-%m-%d')
    except Exception:
        return today_string()


def current_interval() -> str:
    """15-minute interval key like '14:30'."""
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo('America/Chicago'))
    except Exception:
        now = datetime.now()
    hh = now.hour
    mm = (now.minute // 15) * 15
    return f"{hh:02d}:{mm:02d}"


def archive_day(group: str, old_data: dict):
    """Archive a day's counts to history on Argus."""
    try:
        date = old_data['today']
        remote_hist = f'{REMOTE_HISTORY}/{date}.json'
        existing = read_remote_json(remote_hist) or {'date': date, 'groups': {}}
        existing['groups'][group] = {
            'entered': old_data['entered'],
            'exited': old_data['exited'],
            'intervals': old_data.get('intervals', {}),
        }
        # Ensure remote dir exists
        import subprocess
        subprocess.run(["ssh", "mrcrabs@172.16.201.23", f"mkdir -p {REMOTE_HISTORY}"],
                      capture_output=True, timeout=5)
        write_remote_json(remote_hist, existing, min_interval=0)
        print(f'[people-counter] Archived {group} data for {date}')
    except Exception as e:
        print(f'[people-counter] Archive failed: {e}')


def ensure_group(data: dict, group: str):
    """Ensure today's group counter exists, archiving old day if needed."""
    today = chicago_today()
    if group not in data['counts'] or data['counts'][group].get('today') != today:
        if group in data['counts'] and data['counts'][group].get('today') != today:
            archive_day(group, data['counts'][group])
        data['counts'][group] = {
            'today': today,
            'entered': 0,
            'exited': 0,
            'intervals': {},
            'lastUpdate': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        }


def apply_crossing(data: dict, group: str, camera_id: str, direction: str):
    """Apply a single entry or exit crossing to the counts."""
    ensure_group(data, group)
    gc = data['counts'][group]
    interval = current_interval()

    if direction == 'entry':
        gc['entered'] += 1
    else:
        gc['exited'] += 1

    gc['lastUpdate'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

    if interval not in gc.get('intervals', {}):
        gc.setdefault('intervals', {})[interval] = {'entered': 0, 'exited': 0}
    gc['intervals'][interval][direction == 'entry' and 'entered' or 'exited'] += 1

    # Camera state
    data.setdefault('cameraState', {})
    cs = data['cameraState'].setdefault(camera_id, {
        'lastSnapshot': '', 'totalEntered': 0, 'totalExited': 0,
        'skippedFrames': 0, 'analyzedFrames': 0, 'lastCount': 0,
    })
    if direction == 'entry':
        cs['totalEntered'] += 1
    else:
        cs['totalExited'] += 1
    cs['lastSnapshot'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    cs['analyzedFrames'] += 1


# ─── Camera line config ───────────────────────────────────────────────────

def load_camera_lines() -> dict:
    """Load per-camera counting line config from Argus."""
    remote = read_remote_json(REMOTE_COUNTER_CONFIG)
    if remote is not None:
        COUNTER_CONFIG_FILE.write_text(json.dumps(remote, indent=2))
        return remote
    try:
        if COUNTER_CONFIG_FILE.exists():
            return json.loads(COUNTER_CONFIG_FILE.read_text())
    except Exception:
        pass
    return {}


def get_camera_line(camera_id: str, lines_config: dict) -> dict:
    """Get counting line for a camera, with sensible default."""
    if camera_id in lines_config:
        cfg = lines_config[camera_id]
        return {
            'lineStart': cfg.get('lineStart', {'x': 0.0, 'y': 0.5}),
            'lineEnd': cfg.get('lineEnd', {'x': 1.0, 'y': 0.5}),
            'entrySide': cfg.get('entrySide', 'above'),
        }
    # Default: horizontal line at middle, entry from above
    return {
        'lineStart': {'x': 0.0, 'y': 0.5},
        'lineEnd': {'x': 1.0, 'y': 0.5},
        'entrySide': 'above',
    }


# ─── Frame annotation ─────────────────────────────────────────────────────

FRAMES_DIR = LOCAL_DATA_DIR / 'frames'
FRAMES_DIR.mkdir(parents=True, exist_ok=True)
REMOTE_FRAMES_DIR = f'{REMOTE_DATA}/people-counter-frames'

# Ensure remote frames dir exists (once at startup)
import subprocess as _sp
_sp.run(["ssh", "mrcrabs@172.16.201.23", f"mkdir -p {REMOTE_FRAMES_DIR}"],
        capture_output=True, timeout=5)


def draw_counter_frame(frame, cam_id: str, cam_name: str, detector: 'LineCrossingDetector',
                       tracks: dict, person_dets: list, cam_stat: dict, group_data: dict):
    """Draw counting line, bounding boxes, track IDs, and stats on frame."""
    annotated = frame.copy()
    h, w = annotated.shape[:2]

    # Draw the counting line (thick, bright red)
    ls = detector.line_start
    le = detector.line_end
    pt1 = (int(ls['x'] * w), int(ls['y'] * h))
    pt2 = (int(le['x'] * w), int(le['y'] * h))
    cv2.line(annotated, pt1, pt2, (0, 0, 255), 3)

    # Draw entry direction arrow at midpoint
    mx, my = (pt1[0] + pt2[0]) // 2, (pt1[1] + pt2[1]) // 2
    entry_side = detector.entry_side
    arrow_len = 30
    if entry_side == 'above':
        cv2.arrowedLine(annotated, (mx, my - arrow_len), (mx, my + arrow_len), (0, 255, 0), 2, tipLength=0.3)
    elif entry_side == 'below':
        cv2.arrowedLine(annotated, (mx, my + arrow_len), (mx, my - arrow_len), (0, 255, 0), 2, tipLength=0.3)
    elif entry_side == 'left':
        cv2.arrowedLine(annotated, (mx - arrow_len, my), (mx + arrow_len, my), (0, 255, 0), 2, tipLength=0.3)
    elif entry_side == 'right':
        cv2.arrowedLine(annotated, (mx + arrow_len, my), (mx - arrow_len, my), (0, 255, 0), 2, tipLength=0.3)

    # Label the line
    cv2.putText(annotated, 'COUNTING LINE', (pt1[0] + 5, pt1[1] - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2, cv2.LINE_AA)

    # Draw person bounding boxes with track IDs
    for tid, track in tracks.items():
        if track['missing'] > 0:
            continue
        bbox = track['bbox']
        x1, y1, x2, y2 = bbox
        color = (0, 255, 120)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label = f'T{tid} {track["confidence"]:.2f}'
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(annotated, (x1, y1 - lh - 6), (x1 + lw + 4, y1), color, -1)
        cv2.putText(annotated, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)

        # Draw centroid dot
        cx_px = int(track['cx'] * w)
        cy_px = int(track['cy'] * h)
        cv2.circle(annotated, (cx_px, cy_px), 4, (0, 255, 255), -1)

    # HUD overlay
    entered = group_data.get('entered', 0)
    exited = group_data.get('exited', 0)
    hud = [
        f'{cam_name}',
        f'IN: {entered}  OUT: {exited}  NET: {entered - exited}',
        f'Tracked: {len([t for t in tracks.values() if t["missing"] == 0])}',
    ]
    for i, text in enumerate(hud):
        y_pos = 24 + i * 22
        cv2.putText(annotated, text, (8, y_pos),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(annotated, text, (8, y_pos),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (20, 180, 120), 1, cv2.LINE_AA)

    return annotated


# ─── Signal handling ──────────────────────────────────────────────────────

running = True

def handle_signal(sig, frame):
    global running
    print(f'\n[people-counter] Received signal {sig}, shutting down...')
    running = False

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    global running

    # Load cameras from Argus
    cams_raw = read_remote_json(REMOTE_CAMERAS)
    if cams_raw:
        CAMERAS_FILE.write_text(json.dumps(cams_raw, indent=2))
    else:
        try:
            cams_raw = json.loads(CAMERAS_FILE.read_text())
        except Exception as e:
            print(f'[people-counter] Failed to load cameras: {e}')
            return
    cameras = cams_raw.get('cameras', [])

    if not cameras:
        print('[people-counter] No cameras configured, exiting')
        return

    print(f'[people-counter] Loading YOLOv8n model from {MODEL_PATH}')
    from ultralytics import YOLO
    import torch

    model = YOLO(str(MODEL_PATH))
    use_cuda = torch.cuda.is_available()
    if use_cuda:
        model.to("cuda")
        print(f"[people-counter] GPU: {torch.cuda.get_device_name(0)}")
    else:
        print("[people-counter] Running on CPU")
    device = "cuda" if use_cuda else "cpu"

    # Load line configs
    lines_config = load_camera_lines()

    # Initialize per-camera state
    readers: dict[str, RTSPReader] = {}
    trackers: dict[str, PersonTracker] = {}
    detectors: dict[str, LineCrossingDetector] = {}
    cam_stats: dict[str, dict] = {}

    for cam in cameras:
        cam_id = cam['id']
        rtsp_url = build_rtsp_url(cam)
        print(f'[people-counter] {cam["name"]} ({cam_id}): {rtsp_url}')

        readers[cam_id] = RTSPReader(rtsp_url, cam['name'])
        trackers[cam_id] = PersonTracker(iou_threshold=0.25, max_missing=15)

        line_cfg = get_camera_line(cam_id, lines_config)
        detectors[cam_id] = LineCrossingDetector(
            line_cfg['lineStart'], line_cfg['lineEnd'], line_cfg['entrySide'])

        cam_stats[cam_id] = {
            'frames': 0, 'entered': 0, 'exited': 0,
            'tracked': 0, 'last_process': 0.0,
        }

    # Wait for at least one stream to connect
    print('[people-counter] Waiting for streams...')
    for _ in range(30):
        if any(r.connected for r in readers.values()):
            break
        time.sleep(1)

    connected = [cam['name'] for cam in cameras if readers[cam['id']].connected]
    print(f'[people-counter] Connected: {", ".join(connected) if connected else "none yet"}')
    print(f'[people-counter] Starting inference loop (v2 — YOLO line-crossing)')

    data = load_counts()
    last_save = time.time()
    last_log = time.time()
    last_config_reload = time.time()
    cam_index = 0

    while running:
        t0 = time.time()

        # Round-robin through cameras
        cam = cameras[cam_index % len(cameras)]
        cam_id = cam['id']
        cam_index += 1

        reader = readers[cam_id]
        frame, frame_time = reader.read()

        if frame is None or frame_time == cam_stats[cam_id]['last_process']:
            time.sleep(0.05)
            continue

        cam_stats[cam_id]['last_process'] = frame_time
        cam_stats[cam_id]['frames'] += 1

        h, w = frame.shape[:2]

        # Run YOLO — persons only
        results = model(frame, verbose=False, classes=[PERSON_CLASS], device=device)[0]

        person_dets = []
        for box in results.boxes:
            conf = float(box.conf[0])
            if conf < PERSON_CONF_THRESHOLD:
                continue
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]
            cx = ((x1 + x2) / 2) / w  # normalized
            cy = ((y1 + y2) / 2) / h
            person_dets.append({
                'bbox': [x1, y1, x2, y2],
                'cx': cx,
                'cy': cy,
                'confidence': conf,
            })

        # Update tracker
        tracks = trackers[cam_id].update(person_dets)
        cam_stats[cam_id]['tracked'] = len(tracks)

        # Check line crossings
        crossings = detectors[cam_id].check_crossings(tracks)
        for crossing in crossings:
            direction = crossing['direction']
            tid = crossing['track_id']
            apply_crossing(data, cam['group'], cam_id, direction)

            if direction == 'entry':
                cam_stats[cam_id]['entered'] += 1
            else:
                cam_stats[cam_id]['exited'] += 1

            emoji = '🚶➡️' if direction == 'entry' else '🚶⬅️'
            print(f'[people-counter] {emoji} {cam["name"]}: {direction} '
                  f'(T{tid}) | {cam["group"]} total: '
                  f'in={data["counts"][cam["group"]]["entered"]} '
                  f'out={data["counts"][cam["group"]]["exited"]}')

        # Annotate and save frame for this camera
        group_data = data['counts'].get(cam['group'], {})
        annotated = draw_counter_frame(
            frame, cam_id, cam['name'], detectors[cam_id],
            tracks, person_dets, cam_stats[cam_id], group_data)
        local_frame = FRAMES_DIR / f'{cam_id}.jpg'
        tmp_frame = FRAMES_DIR / f'{cam_id}-tmp.jpg'
        cv2.imwrite(str(tmp_frame), annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
        os.replace(str(tmp_frame), str(local_frame))
        # Sync to Argus via SCP (debounced per camera)
        try:
            from remote_sync import scp_to_remote, _write_lock, _last_write
            remote_key = f'{REMOTE_FRAMES_DIR}/{cam_id}.jpg'
            with _write_lock:
                _now = time.time()
                if remote_key not in _last_write or (_now - _last_write[remote_key]) >= 1.0:
                    _last_write[remote_key] = _now
                    scp_to_remote(str(local_frame), remote_key)
        except Exception:
            pass

        # Periodic save (every 5s)
        now = time.time()
        if now - last_save >= 5.0:
            save_counts(data)
            last_save = now

        # Periodic logging
        if now - last_log >= LOG_INTERVAL_S:
            for c in cameras:
                cid = c['id']
                s = cam_stats[cid]
                conn = '✅' if readers[cid].connected else '❌'
                group_data = data['counts'].get(c['group'], {})
                print(f'[people-counter] {conn} {c["name"]}: '
                      f'frames={s["frames"]} tracked={s["tracked"]} '
                      f'entered={s["entered"]} exited={s["exited"]} | '
                      f'{c["group"]}: in={group_data.get("entered", 0)} '
                      f'out={group_data.get("exited", 0)}')
            last_log = now

        # Reload line config periodically
        if now - last_config_reload >= 30.0:
            new_lines = load_camera_lines()
            if new_lines != lines_config:
                lines_config = new_lines
                for cam in cameras:
                    cid = cam['id']
                    lcfg = get_camera_line(cid, lines_config)
                    detectors[cid] = LineCrossingDetector(
                        lcfg['lineStart'], lcfg['lineEnd'], lcfg['entrySide'])
                print('[people-counter] Line config reloaded')
            # Also check for day rollover
            for cam in cameras:
                ensure_group(data, cam['group'])
            last_config_reload = now

        # Frame rate limiting
        elapsed = time.time() - t0
        target = CYCLE_INTERVAL_S / len(cameras)
        if elapsed < target:
            time.sleep(target - elapsed)

    # Shutdown
    save_counts(data)
    for r in readers.values():
        r.stop()
    print('[people-counter] Shutdown complete')


if __name__ == '__main__':
    main()
