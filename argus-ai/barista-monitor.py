#!/usr/bin/env python3
"""
Barista Monitor v2 — Person-based drink handoff counting
Tracks people (not cups) at the counter pickup zone to count drink handoffs.

A handoff is counted when:
  1. A tracked person enters the pickup zone
  2. At least one barista is present in the barista zone
  3. The person dwells for DWELL_MIN_S..DWELL_MAX_S seconds
  4. The person then exits the pickup zone

Falls back to cup-crossing detection as a secondary signal.
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
LOCAL_DATA_DIR = SCRIPT_DIR / 'barista-data'
LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)

STATE_FILE = LOCAL_DATA_DIR / 'state.json'
EVENTS_FILE = LOCAL_DATA_DIR / 'events.json'
FRAME_FILE = LOCAL_DATA_DIR / 'latest-frame.jpg'
CONFIG_FILE = LOCAL_DATA_DIR / 'config.json'
MODEL_PATH = SCRIPT_DIR / 'yolov8n.pt'

# Remote paths on Argus
REMOTE_DATA = '/home/mrcrabs/argus/data/barista-monitor'
REMOTE_STATE = f'{REMOTE_DATA}/state.json'
REMOTE_EVENTS = f'{REMOTE_DATA}/events.json'
REMOTE_FRAME = f'{REMOTE_DATA}/latest-frame.jpg'
REMOTE_CONFIG = f'{REMOTE_DATA}/config.json'

# Import remote sync
sys.path.insert(0, str(SCRIPT_DIR))
from remote_sync import read_remote_json, write_remote_json, write_remote_binary

RTSP_URL = 'rtsp://172.25.2.10:554/chID=60&streamType=main'

# COCO class IDs
PERSON_CLASS = 0
CUP_CLASS = 41
BOTTLE_CLASS = 39

# Drink counting parameters
DRINK_CONF_THRESHOLD = 0.30     # Cup confidence threshold (secondary signal)
CUP_DEBOUNCE_S = 8.0            # Cup-based debounce
PERSON_CONF_THRESHOLD = 0.25    # Person confidence threshold
DWELL_MIN_S = 10.0               # Minimum time in pickup zone to count
DWELL_MAX_S = 30.0              # Maximum dwell — longer = probably employee, ignore
CROSS_SUPPRESS_S = 10.0         # Suppress cross-method double counts
TARGET_FPS = 25

# Default zones (overridden by config.json)
DEFAULT_BARISTA_ZONE = [
    {'x': 0.0, 'y': 0.0}, {'x': 0.5, 'y': 0.0},
    {'x': 0.5, 'y': 1.0}, {'x': 0.0, 'y': 1.0},
]
DEFAULT_CUSTOMER_ZONE = [
    {'x': 0.5, 'y': 0.0}, {'x': 1.0, 'y': 0.0},
    {'x': 1.0, 'y': 1.0}, {'x': 0.5, 'y': 1.0},
]
DEFAULT_PICKUP_ZONE = None  # Derived from barista/customer boundary if not set


# ─── Zone config ──────────────────────────────────────────────────────────

zone_config = {
    'baristaZone': list(DEFAULT_BARISTA_ZONE),
    'customerZone': list(DEFAULT_CUSTOMER_ZONE),
    'pickupZone': None,
}
zone_config_lock = threading.Lock()


def point_in_polygon(px: float, py: float, polygon: list[dict]) -> bool:
    """Ray-casting point-in-polygon test. Coords are normalized 0..1."""
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]['x'], polygon[i]['y']
        xj, yj = polygon[j]['x'], polygon[j]['y']
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def derive_pickup_zone(barista_zone, customer_zone):
    """Derive a pickup zone from the boundary between barista and customer zones.
    Strategy: find the overlapping x/y range and create a thin strip on the
    customer side of the counter. Falls back to a strip between zone centroids."""
    # Get bounding boxes of each zone
    bx = [p['x'] for p in barista_zone]
    by = [p['y'] for p in barista_zone]
    cx = [p['x'] for p in customer_zone]
    cy = [p['y'] for p in customer_zone]

    # Find the boundary region — where the zones are closest
    b_cx = sum(bx) / len(bx)
    b_cy = sum(by) / len(by)
    c_cx = sum(cx) / len(cx)
    c_cy = sum(cy) / len(cy)

    # Create a strip between the two centroids, biased toward customer side
    # The pickup zone is roughly 30% of the way from barista centroid to customer centroid
    # with some width
    mix_low = 0.15   # closer to barista
    mix_high = 0.45  # into customer area

    # Interpolate
    p1x = b_cx + (c_cx - b_cx) * mix_low
    p1y = b_cy + (c_cy - b_cy) * mix_low
    p2x = b_cx + (c_cx - b_cx) * mix_high
    p2y = b_cy + (c_cy - b_cy) * mix_high

    # Create a rectangle-ish strip perpendicular to the barista→customer line
    # Use the min/max y from both zones for height
    all_y = by + cy
    y_min = min(all_y)
    y_max = max(all_y)

    pickup = [
        {'x': p1x, 'y': y_min},
        {'x': p2x, 'y': y_min},
        {'x': p2x, 'y': y_max},
        {'x': p1x, 'y': y_max},
    ]
    return pickup


def get_zone(rel_x: float, rel_y: float) -> str:
    """Classify a point into 'pickup', 'barista', 'customer', or 'none'.
    Pickup zone is checked first (it overlaps barista/customer)."""
    with zone_config_lock:
        pz = zone_config.get('pickupZone')
        bz = zone_config['baristaZone']
        cz = zone_config['customerZone']
    if pz and point_in_polygon(rel_x, rel_y, pz):
        return 'pickup'
    if point_in_polygon(rel_x, rel_y, bz):
        return 'barista'
    if point_in_polygon(rel_x, rel_y, cz):
        return 'customer'
    return 'none'


def load_zone_config():
    """Load zone config from Argus (remote) and cache locally."""
    try:
        data = read_remote_json(REMOTE_CONFIG)
        if data:
            CONFIG_FILE.write_text(json.dumps(data, indent=2))
        elif CONFIG_FILE.exists():
            data = json.loads(CONFIG_FILE.read_text())
        if data:
            if 'line1' in data and 'staffSide' in data:
                print('[barista-monitor] Old line config detected, using defaults')
                new_bz = DEFAULT_BARISTA_ZONE
                new_cz = DEFAULT_CUSTOMER_ZONE
                new_pz = None
            else:
                new_bz = data.get('baristaZone', DEFAULT_BARISTA_ZONE)
                new_cz = data.get('customerZone', DEFAULT_CUSTOMER_ZONE)
                new_pz = data.get('pickupZone', None)

            # Derive pickup zone if not explicitly configured
            if new_pz is None:
                new_pz = derive_pickup_zone(new_bz, new_cz)

            with zone_config_lock:
                changed = (
                    zone_config['baristaZone'] != new_bz or
                    zone_config['customerZone'] != new_cz or
                    zone_config.get('pickupZone') != new_pz
                )
                zone_config['baristaZone'] = new_bz
                zone_config['customerZone'] = new_cz
                zone_config['pickupZone'] = new_pz
            if changed:
                print(f'[barista-monitor] Zone config updated: barista={len(new_bz)} pts, '
                      f'customer={len(new_cz)} pts, pickup={len(new_pz)} pts')
            return changed
    except Exception as e:
        print(f'[barista-monitor] Failed to load zone config: {e}')
    return False


# ─── Threaded RTSP Reader ─────────────────────────────────────────────────

class RTSPReader:
    """Background thread that continuously grabs frames from RTSP stream."""

    def __init__(self, url, buffer_size=1):
        self.url = url
        self.buffer_size = buffer_size
        self.frame = None
        self.lock = threading.Lock()
        self.running = True
        self.connected = False
        self.reconnect_count = 0
        self._thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._thread.start()

    def _reader_loop(self):
        cap = None
        while self.running:
            if cap is None or not cap.isOpened():
                self.connected = False
                if cap:
                    cap.release()
                backoff = min(2 ** min(self.reconnect_count, 5), 30)
                if self.reconnect_count > 0:
                    print(f'[barista-monitor] Reconnecting (attempt {self.reconnect_count + 1}, '
                          f'backoff {backoff}s)...')
                    time.sleep(backoff)
                cap = cv2.VideoCapture(self.url)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, self.buffer_size)
                if cap.isOpened():
                    self.connected = True
                    self.reconnect_count = 0
                    print('[barista-monitor] Stream connected')
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

        if cap:
            cap.release()

    def read(self):
        with self.lock:
            return self.frame.copy() if self.frame is not None else None

    def stop(self):
        self.running = False


# ─── ByteTrack-style simple tracker ──────────────────────────────────────
# Lightweight multi-object tracker using IoU matching + Kalman-like smoothing.
# We don't pull in supervision to avoid extra deps — this covers our needs.

class PersonTracker:
    """Track people across frames using IoU-based matching.
    Each track gets a stable ID and maintains zone history."""

    def __init__(self, iou_threshold=0.25, max_missing=20):
        self.tracks: dict[int, dict] = {}
        self.next_id = 1
        self.iou_threshold = iou_threshold
        self.max_missing = max_missing  # frames before dropping a track

    @staticmethod
    def _iou(box_a, box_b):
        """Compute IoU between two [x1,y1,x2,y2] boxes."""
        x1 = max(box_a[0], box_b[0])
        y1 = max(box_a[1], box_b[1])
        x2 = min(box_a[2], box_b[2])
        y2 = min(box_a[3], box_b[3])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        area_a = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
        area_b = (box_b[2] - box_b[0]) * (box_b[3] - box_b[1])
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0

    def update(self, detections: list[dict]) -> dict[int, dict]:
        """Update tracks with new person detections.
        Each detection: {'bbox': [x1,y1,x2,y2], 'confidence': float, 'zone': str,
                         'cx': float, 'cy': float}
        Returns: dict of track_id → track info with 'zone', 'prev_zone', 'bbox', etc.
        """
        # Mark all as missing
        for tid in self.tracks:
            self.tracks[tid]['missing'] += 1
            self.tracks[tid]['prev_zone'] = self.tracks[tid]['zone']

        # Greedy IoU matching (sufficient for <20 people)
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

        # Update matched tracks
        for tid, di in matches:
            det = detections[di]
            self.tracks[tid].update({
                'bbox': det['bbox'],
                'zone': det['zone'],
                'cx': det['cx'],
                'cy': det['cy'],
                'confidence': det['confidence'],
                'missing': 0,
            })

        # Create new tracks for unmatched detections
        for di, det in enumerate(detections):
            if di in used_dets:
                continue
            self.tracks[self.next_id] = {
                'bbox': det['bbox'],
                'zone': det['zone'],
                'prev_zone': 'none',
                'cx': det['cx'],
                'cy': det['cy'],
                'confidence': det['confidence'],
                'missing': 0,
                'created_at': time.time(),
            }
            self.next_id += 1

        # Remove stale tracks
        stale = [tid for tid, t in self.tracks.items() if t['missing'] > self.max_missing]
        for tid in stale:
            del self.tracks[tid]

        return self.tracks


# ─── Cup tracker (secondary signal, kept from v1) ─────────────────────────

class CupTracker:
    """Track cup centroids for barista→customer zone transitions."""

    def __init__(self, max_distance=0.15, max_missing=10):
        self.tracks: dict[int, dict] = {}
        self.next_id = 1
        self.max_distance = max_distance
        self.max_missing = max_missing

    def update(self, cups: list[dict]) -> list[tuple[int, str, str]]:
        transitions = []
        for tid in self.tracks:
            self.tracks[tid]['missing'] += 1

        used_tracks = set()
        for cup in cups:
            cx, cy = cup['cx'], cup['cy']
            best_tid = None
            best_dist = float('inf')
            for tid, track in self.tracks.items():
                if tid in used_tracks:
                    continue
                dist = ((cx - track['cx'])**2 + (cy - track['cy'])**2)**0.5
                if dist < best_dist and dist < self.max_distance:
                    best_dist = dist
                    best_tid = tid

            if best_tid is not None:
                old_zone = self.tracks[best_tid]['zone']
                new_zone = cup['zone']
                self.tracks[best_tid].update(
                    {'cx': cx, 'cy': cy, 'zone': new_zone, 'missing': 0})
                used_tracks.add(best_tid)
                if old_zone != new_zone and old_zone != 'none' and new_zone != 'none':
                    transitions.append((best_tid, old_zone, new_zone))
            else:
                self.tracks[self.next_id] = {
                    'cx': cx, 'cy': cy, 'zone': cup['zone'], 'missing': 0}
                self.next_id += 1

        stale = [tid for tid, t in self.tracks.items() if t['missing'] > self.max_missing]
        for tid in stale:
            del self.tracks[tid]
        return transitions


# ─── Pickup zone dweller tracker ──────────────────────────────────────────

class PickupDwellTracker:
    """Tracks how long each person (by track ID) dwells in the pickup zone.
    Detects handoff when: entered pickup → dwelled DWELL_MIN..DWELL_MAX → exited."""

    def __init__(self):
        # track_id → {'entered_at': float, 'counted': bool}
        self.dwellers: dict[int, dict] = {}
        # track_id → timestamp of last handoff (to prevent re-counting)
        self.counted_ids: dict[int, float] = {}

    def update(self, person_tracks: dict[int, dict], barista_present: bool) -> list[int]:
        """Update with current person tracks. Returns list of track IDs that
        just completed a handoff (exited pickup after valid dwell)."""
        now = time.time()
        handoffs = []

        current_pickup_ids = set()

        for tid, track in person_tracks.items():
            zone = track['zone']
            prev_zone = track.get('prev_zone', 'none')

            if zone == 'pickup':
                current_pickup_ids.add(tid)

                if tid not in self.dwellers:
                    # Person just entered pickup zone
                    self.dwellers[tid] = {'entered_at': now, 'counted': False}
                # else: still dwelling, nothing to do yet

            elif tid in self.dwellers and zone != 'pickup':
                # Person just LEFT the pickup zone
                dwell_info = self.dwellers.pop(tid)
                dwell_time = now - dwell_info['entered_at']

                if (DWELL_MIN_S <= dwell_time <= DWELL_MAX_S
                        and barista_present
                        and not dwell_info['counted']
                        and tid not in self.counted_ids):
                    handoffs.append(tid)
                    self.counted_ids[tid] = now

        # Clean up dwellers whose tracks were dropped
        stale_dwellers = [tid for tid in self.dwellers if tid not in person_tracks]
        for tid in stale_dwellers:
            dwell_info = self.dwellers.pop(tid)
            # If they were in the zone long enough before disappearing, count it
            dwell_time = now - dwell_info['entered_at']
            if (DWELL_MIN_S <= dwell_time <= DWELL_MAX_S
                    and barista_present
                    and not dwell_info['counted']
                    and tid not in self.counted_ids):
                handoffs.append(tid)
                self.counted_ids[tid] = now

        # Clean up old counted_ids (older than 60s)
        stale_counted = [tid for tid, ts in self.counted_ids.items() if now - ts > 60]
        for tid in stale_counted:
            del self.counted_ids[tid]

        # Mark overstayers (exceeded DWELL_MAX) so they won't be counted
        for tid in list(self.dwellers.keys()):
            dwell_time = now - self.dwellers[tid]['entered_at']
            if dwell_time > DWELL_MAX_S:
                self.dwellers[tid]['counted'] = True  # prevent counting on exit

        return handoffs

    @property
    def active_dwellers(self) -> dict[int, float]:
        """Returns dict of track_id → dwell_seconds for active pickup dwellers."""
        now = time.time()
        return {tid: now - info['entered_at'] for tid, info in self.dwellers.items()}


# ─── Event and state persistence ──────────────────────────────────────────

def load_events():
    # Try remote first, fall back to local cache
    remote = read_remote_json(REMOTE_EVENTS)
    if remote is not None:
        EVENTS_FILE.write_text(json.dumps(remote))
        return remote
    if EVENTS_FILE.exists():
        try:
            return json.loads(EVENTS_FILE.read_text())
        except Exception:
            pass
    return []


def append_event(events: list, event: dict):
    events.append(event)
    try:
        tmp = str(EVENTS_FILE) + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(events, f)
        os.replace(tmp, str(EVENTS_FILE))
    except Exception as e:
        print(f'[barista-monitor] Failed to write events locally: {e}')
    write_remote_json(REMOTE_EVENTS, events, min_interval=1.0)


def save_state(state: dict):
    try:
        tmp = str(STATE_FILE) + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(state, f)
        os.replace(tmp, str(STATE_FILE))
    except Exception as e:
        print(f'[barista-monitor] Failed to write state locally: {e}')
    write_remote_json(REMOTE_STATE, state, min_interval=0.5)


# ─── Frame annotation ─────────────────────────────────────────────────────

def draw_polygon(frame, polygon, color, label, h, w, alpha=0.15):
    """Draw a semi-transparent polygon overlay."""
    pts = [(int(p['x'] * w), int(p['y'] * h)) for p in polygon]
    pts_arr = np.array(pts, dtype=np.int32)
    overlay = frame.copy()
    cv2.fillPoly(overlay, [pts_arr], color)
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
    cv2.polylines(frame, [pts_arr], True, color, 2)
    cx = sum(p[0] for p in pts) // len(pts)
    cy = sum(p[1] for p in pts) // len(pts)
    cv2.putText(frame, label, (cx - 40, cy),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2, cv2.LINE_AA)


def draw_annotations(frame, detections, person_tracks, dwellers, drink_count, fps):
    """Draw zones, bounding boxes with track IDs, and HUD."""
    h, w = frame.shape[:2]

    with zone_config_lock:
        bz = zone_config['baristaZone']
        cz = zone_config['customerZone']
        pz = zone_config.get('pickupZone')

    # Zone overlays
    draw_polygon(frame, bz, (0, 220, 180), 'BARISTA', h, w)
    draw_polygon(frame, cz, (255, 160, 0), 'CUSTOMER', h, w)
    if pz:
        draw_polygon(frame, pz, (0, 215, 255), 'PICKUP', h, w, alpha=0.20)

    # Build track_id → bbox lookup from person_tracks
    track_bboxes = {}
    for tid, track in person_tracks.items():
        track_bboxes[tid] = track['bbox']

    # Draw detections
    for det in detections:
        cls = det['class']
        conf = det['confidence']
        x1, y1, x2, y2 = det['bbox']

        if cls == 'person':
            color = (0, 255, 120)
        elif cls == 'cup':
            color = (0, 180, 255)
        else:
            color = (255, 140, 0)

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        # Find track ID for this person detection (match by bbox)
        track_label = ''
        if cls == 'person':
            for tid, bbox in track_bboxes.items():
                if bbox == [x1, y1, x2, y2]:
                    track_label = f' T{tid}'
                    # Highlight if dwelling in pickup zone
                    if tid in dwellers:
                        dwell_s = dwellers[tid]
                        track_label += f' {dwell_s:.0f}s'
                        # Draw thicker box for dwellers
                        cv2.rectangle(frame, (x1 - 2, y1 - 2), (x2 + 2, y2 + 2),
                                      (0, 215, 255), 3)
                    break

        label = f'{cls} {conf:.2f}{track_label}'
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(frame, (x1, y1 - lh - 6), (x1 + lw + 4, y1), color, -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

    # HUD
    hud_lines = [
        f'DRINKS TODAY: {drink_count}',
        f'FPS: {fps:.1f}',
        f'TRACKED: {len(person_tracks)}',
    ]
    for i, text in enumerate(hud_lines):
        y_pos = 28 + i * 26
        cv2.putText(frame, text, (w - 240, y_pos),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, text, (w - 240, y_pos),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 180, 120), 1, cv2.LINE_AA)

    return frame


# ─── Signal handling ──────────────────────────────────────────────────────

running = True

def handle_signal(sig, frame):
    global running
    print(f'\n[barista-monitor] Received signal {sig}, shutting down...')
    running = False

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    global running

    LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
    load_zone_config()

    # Load YOLO model
    print(f'[barista-monitor] Loading YOLOv8n model from {MODEL_PATH}')
    from ultralytics import YOLO
    import torch

    model = YOLO(str(MODEL_PATH))
    use_cuda = torch.cuda.is_available()
    if use_cuda:
        model.to("cuda")
        print(f"[barista-monitor] GPU: {torch.cuda.get_device_name(0)}")
    else:
        print("[barista-monitor] Running on CPU")
    device = "cuda" if use_cuda else "cpu"
    print('[barista-monitor] Model loaded')

    # Load existing events and count
    events = load_events()
    total_drinks = sum(1 for e in events if e.get('type') == 'drink')

    # Initialize trackers
    person_tracker = PersonTracker(iou_threshold=0.25, max_missing=20)
    cup_tracker = CupTracker(max_distance=0.15, max_missing=10)
    dwell_tracker = PickupDwellTracker()

    # Cross-method suppression timestamps
    last_person_handoff_time = 0.0
    last_cup_handoff_time = 0.0

    fps_deque: deque = deque(maxlen=30)

    # Connect to stream
    print(f'[barista-monitor] Connecting to {RTSP_URL}')
    reader = RTSPReader(RTSP_URL)
    for _ in range(30):
        if reader.connected:
            break
        time.sleep(1)
    if not reader.connected:
        print('[barista-monitor] WARNING: Stream not connected yet, continuing anyway...')

    print('[barista-monitor] Starting inference loop (v2 — person-based counting)')
    last_fps_print = time.time()

    while running:
        t0 = time.time()

        frame = reader.read()
        if frame is None:
            time.sleep(0.1)
            continue

        h, w = frame.shape[:2]

        # Run YOLO inference
        results = model(frame, verbose=False,
                        classes=[PERSON_CLASS, CUP_CLASS, BOTTLE_CLASS],
                        device=device)[0]

        detections = []
        person_dets = []       # for person tracker
        cup_dets = []          # for cup tracker
        barista_present = False

        for box in results.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]
            cx_px, cy_px = (x1 + x2) // 2, (y1 + y2) // 2
            rel_x = cx_px / w
            rel_y = cy_px / h

            cls_name = {
                PERSON_CLASS: 'person',
                CUP_CLASS: 'cup',
                BOTTLE_CLASS: 'bottle'
            }.get(cls_id, 'unknown')

            zone = get_zone(rel_x, rel_y)

            det = {
                'class': cls_name,
                'confidence': round(conf, 3),
                'bbox': [x1, y1, x2, y2],
                'zone': zone,
            }
            detections.append(det)

            # Person detections for tracker
            if cls_id == PERSON_CLASS and conf >= PERSON_CONF_THRESHOLD:
                person_dets.append({
                    'bbox': [x1, y1, x2, y2],
                    'confidence': conf,
                    'zone': zone,
                    'cx': rel_x,
                    'cy': rel_y,
                })
                if zone == 'barista':
                    barista_present = True

            # Cup/bottle detections for secondary tracker
            if cls_id in (CUP_CLASS, BOTTLE_CLASS) and conf >= DRINK_CONF_THRESHOLD:
                cup_dets.append({
                    'cx': rel_x, 'cy': rel_y, 'zone': zone, 'det': det
                })

        now = time.time()

        # ── Primary: person-based handoff detection ──
        tracks = person_tracker.update(person_dets)
        person_handoffs = dwell_tracker.update(tracks, barista_present)

        for tid in person_handoffs:
            # Check cross-method suppression
            if (now - last_cup_handoff_time) < CROSS_SUPPRESS_S:
                continue
            last_person_handoff_time = now
            total_drinks += 1
            event = {
                'type': 'drink',
                'method': 'person',
                'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'trackId': tid,
                'totalDrinks': total_drinks,
            }
            append_event(events, event)
            print(f'[barista-monitor] 🍵 Drink handoff #{total_drinks} '
                  f'(person T{tid} completed pickup zone dwell)')

        # ── Secondary: cup-based zone crossing ──
        cup_transitions = cup_tracker.update(cup_dets)
        for track_id, old_zone, new_zone in cup_transitions:
            if old_zone == 'barista' and new_zone in ('customer', 'pickup'):
                # Check cross-method suppression
                if (now - last_person_handoff_time) < CROSS_SUPPRESS_S:
                    continue
                if (now - last_cup_handoff_time) < CUP_DEBOUNCE_S:
                    continue
                last_cup_handoff_time = now
                total_drinks += 1
                event = {
                    'type': 'drink',
                    'method': 'cup',
                    'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                    'drinkClass': 'cup',
                    'totalDrinks': total_drinks,
                }
                append_event(events, event)
                print(f'[barista-monitor] ☕ Drink handoff #{total_drinks} '
                      f'(cup crossed barista→customer)')

        # ── Build state ──
        baristas = []
        barista_idx = 0
        for tid, track in tracks.items():
            if track['zone'] == 'barista':
                barista_idx += 1
                baristas.append({
                    'id': barista_idx,
                    'trackId': tid,
                    'position': {'x': track['cx'], 'y': track['cy']},
                    'drinksCount': 0,
                    'lastActivity': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                })

        dwellers = dwell_tracker.active_dwellers

        # FPS + frame limiter
        elapsed = time.time() - t0
        target_elapsed = 1.0 / TARGET_FPS
        if elapsed < target_elapsed:
            time.sleep(target_elapsed - elapsed)
            elapsed = time.time() - t0
        fps_deque.append(1.0 / elapsed if elapsed > 0 else 0)
        fps = sum(fps_deque) / len(fps_deque)

        # Annotate and save frame (local + remote)
        annotated = draw_annotations(
            frame.copy(), detections, tracks, dwellers, total_drinks, fps)
        tmp_frame = str(FRAME_FILE.parent / 'frame-writing.jpg')
        cv2.imwrite(tmp_frame, annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
        os.replace(tmp_frame, str(FRAME_FILE))
        # Push frame to Argus (debounced)
        try:
            frame_bytes = open(str(FRAME_FILE), 'rb').read()
            write_remote_binary(REMOTE_FRAME, frame_bytes, min_interval=0.4)
        except Exception:
            pass

        # Save state (backward compatible + new fields)
        state = {
            'baristas': baristas,
            'totalDrinks': total_drinks,
            'fps': round(fps, 2),
            'lastUpdate': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'detections': detections,
            'peopleinStaff': len(baristas),
            'cupsInHandoff': len([c for c in cup_dets if c['zone'] in ('customer', 'pickup')]),
            'trackedPeople': len(tracks),
            'pickupDwellers': len(dwellers),
            'baristaPresent': barista_present,
        }
        save_state(state)

        # Periodic logging + config reload
        if time.time() - last_fps_print >= 10.0:
            people_count = sum(1 for d in detections if d['class'] == 'person')
            cup_count = sum(1 for d in detections if d['class'] in ('cup', 'bottle'))
            print(f'[barista-monitor] FPS={fps:.1f} | people={people_count} '
                  f'| tracked={len(tracks)} | dwelling={len(dwellers)} '
                  f'| cups={cup_count} | drinks={total_drinks} '
                  f'| barista={"yes" if barista_present else "no"}')
            last_fps_print = time.time()
            load_zone_config()

    reader.stop()
    print('[barista-monitor] Shutdown complete')


if __name__ == '__main__':
    main()
