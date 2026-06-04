"""
Litter Detection — detect.py

Strategy:
  1. YOLOv8 tracks people across frames.
  2. OpenCV MOG2 background subtraction finds any new blob on the floor
     (works for plastic bags, wrappers — anything not a COCO class).
  3. A litter event fires when a floor blob is stationary, NOT under a
     person, AND a person was in that region within the last N seconds.

Usage:
    python detect.py --source 0                  # webcam
    python detect.py --source video.mp4 --show   # video file with window
"""

import argparse
import bz2
import json
import time
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO


def _ensure_openh264():
    """Download openh264 DLL if missing so OpenCV can write H.264 clips."""
    dll = Path("openh264-1.8.0-win64.dll")
    if dll.exists():
        return
    url = ("https://github.com/cisco/openh264/releases/download"
           "/v1.8.0/openh264-1.8.0-win64.dll.bz2")
    print("Downloading openh264 codec (one-time, ~1 MB)...")
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            data = bz2.decompress(r.read())
        dll.write_bytes(data)
        print("openh264 ready.")
    except Exception as e:
        print(f"Warning: could not download openh264 ({e}). Clips will use fallback codec.")


_ensure_openh264()

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_PATH      = "yolov8n.pt"
EVIDENCE_DIR    = Path("evidence")
LOG_FILE        = EVIDENCE_DIR / "events.json"

PERSON_ID       = 0

# Also keep COCO litter classes as a bonus (bottles, cups, bags)
COCO_LITTER_IDS = {24: "bag", 26: "handbag", 28: "suitcase",
                   39: "bottle", 40: "wine glass", 41: "cup"}

# Floor zone — only look for blobs in the bottom fraction of the frame
FLOOR_FRACTION  = 0.45   # bottom 55% of frame height

# Background subtraction / blob tuning
MOG2_HISTORY    = 300    # frames for background model warm-up
MOG2_THRESHOLD  = 40     # pixel threshold for foreground mask
MIN_BLOB_AREA   = 800    # px² — ignore tiny noise blobs
MAX_BLOB_AREA   = 18000  # px² — ignore large blobs (cars, walls); reduced from 80000

# Litter heuristic
STATIONARY_FRAMES    = 25    # consecutive frames blob must be still
STATIONARY_DIST      = 25    # max centroid drift (px) to count as still
PERSON_MEMORY_SECS   = 8.0   # seconds to remember a person was in a region
PERSON_PROXIMITY_PX  = 120   # blob must be within this many px of where person was
COOLDOWN_SECS        = 10.0  # min seconds between events at same location
EVENT_DIST_THRESH    = 100   # px — don't fire a new event this close to recent one

# Evidence clip — longer pre-buffer so we capture the actual drop moment
CLIP_BEFORE_SECS = 6.0
CLIP_AFTER_SECS  = 3.0

# ── Helpers ───────────────────────────────────────────────────────────────────

def ensure_dirs():
    (EVIDENCE_DIR / "frames").mkdir(parents=True, exist_ok=True)
    (EVIDENCE_DIR / "clips").mkdir(parents=True, exist_ok=True)


def load_log():
    if LOG_FILE.exists():
        with open(LOG_FILE) as f:
            return json.load(f)
    return []


def append_log(entry):
    events = load_log()
    events.append(entry)
    with open(LOG_FILE, "w") as f:
        json.dump(events, f, indent=2)


def box_contains(box, cx, cy):
    x1, y1, x2, y2 = box
    return x1 <= cx <= x2 and y1 <= cy <= y2


def dist(p1, p2):
    return ((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2) ** 0.5


# ── Frame ring buffer (for pre-event clip) ────────────────────────────────────

class FrameBuffer:
    def __init__(self, fps, seconds):
        self.maxlen = max(1, int(fps * seconds))
        self._buf = []

    def push(self, frame):
        self._buf.append(frame.copy())
        if len(self._buf) > self.maxlen:
            self._buf.pop(0)

    def snapshot(self):
        return list(self._buf)


# ── Evidence writer ───────────────────────────────────────────────────────────

class EvidenceWriter:
    def __init__(self, fps, frame_size, meta, pre_frames):
        self.fps = fps
        self.frame_size = frame_size
        self.meta = meta
        self.frames = list(pre_frames)
        self.remaining = max(1, int(fps * CLIP_AFTER_SECS))
        self.done = False

        slug = (meta["timestamp"].replace(":", "-").replace(" ", "_")
                + f"_{meta['label']}")
        self.frame_path = str(EVIDENCE_DIR / "frames" / f"{slug}.jpg")
        self.clip_path  = str(EVIDENCE_DIR / "clips"  / f"{slug}.mp4")
        self.meta["frame_path"] = self.frame_path
        self.meta["clip_path"]  = self.clip_path

    def feed(self, frame):
        if self.done:
            return
        self.frames.append(frame.copy())
        self.remaining -= 1
        if self.remaining <= 0:
            self._flush()

    def _flush(self):
        if not self.frames:
            return
        mid = max(0, len(self.frames) - self.remaining - 1)
        cv2.imwrite(self.frame_path, self.frames[mid])

        # avc1 = H.264, playable in Chrome; fall back to mp4v if unavailable
        fourcc = cv2.VideoWriter_fourcc(*"avc1")
        out = cv2.VideoWriter(self.clip_path, fourcc, self.fps, self.frame_size)
        if not out.isOpened():
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(self.clip_path, fourcc, self.fps, self.frame_size)
        for f in self.frames:
            out.write(f)
        out.release()

        append_log(self.meta)
        print(f"[EVENT] {self.meta['label']} @ {self.meta['timestamp']}")
        self.done = True

    def force_flush(self):
        if not self.done:
            self._flush()


# ── Blob tracker ─────────────────────────────────────────────────────────────

class BlobTracker:
    """Assigns stable IDs to floor blobs across frames."""
    def __init__(self):
        self._next_id = 0
        # id -> {cx, cy, still_frames, last_seen}
        self._blobs: dict = {}

    def update(self, centroids):
        matched = set()
        updated = {}

        for cx, cy in centroids:
            best_id, best_d = None, STATIONARY_DIST * 2
            for bid, b in self._blobs.items():
                d = dist((cx, cy), (b["cx"], b["cy"]))
                if d < best_d:
                    best_d = d
                    best_id = bid

            if best_id is not None and best_id not in matched:
                old = self._blobs[best_id]
                moved = dist((cx, cy), (old["cx"], old["cy"])) > STATIONARY_DIST
                updated[best_id] = {
                    "cx": cx, "cy": cy,
                    "still_frames": 0 if moved else old["still_frames"] + 1,
                    "last_seen": time.time(),
                }
                matched.add(best_id)
            else:
                nid = self._next_id
                self._next_id += 1
                updated[nid] = {"cx": cx, "cy": cy, "still_frames": 0,
                                "last_seen": time.time()}

        # drop blobs not seen for >1s
        now = time.time()
        self._blobs = {bid: b for bid, b in updated.items()
                       if now - b["last_seen"] < 1.0}
        return self._blobs


# ── Main loop ─────────────────────────────────────────────────────────────────

def run(source, show=False):
    ensure_dirs()

    model = YOLO(MODEL_PATH)
    cap   = cv2.VideoCapture(int(source) if str(source).isdigit() else source)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open: {source}")

    fps  = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w    = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h    = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    size = (w, h)
    floor_y = int(h * (1.0 - FLOOR_FRACTION))

    print(f"Source: {source} | {w}x{h} @ {fps:.1f} fps | floor_y={floor_y}")

    fgbg        = cv2.createBackgroundSubtractorMOG2(
                      history=MOG2_HISTORY, varThreshold=MOG2_THRESHOLD,
                      detectShadows=False)
    buf         = FrameBuffer(fps, CLIP_BEFORE_SECS)
    blob_tracker = BlobTracker()
    writers: list[EvidenceWriter] = []

    # region -> last time a person was there: {grid_cell: timestamp}
    person_memory: dict = defaultdict(float)
    # recently fired event locations to enforce cooldown
    recent_events: list = []   # list of (cx, cy, time)

    frame_count = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_count += 1

        for wr in writers:
            wr.feed(frame)
        writers = [wr for wr in writers if not wr.done]

        buf.push(frame)

        # ── 1. YOLO: detect + track people (and bonus COCO litter) ──────────
        track_classes = [PERSON_ID] + list(COCO_LITTER_IDS.keys())
        results = model.track(frame, persist=True, classes=track_classes,
                              conf=0.25, iou=0.5, verbose=False)
        result = results[0]

        person_boxes  = []
        coco_litter   = []   # (cx, cy, label, conf)

        if result.boxes is not None and result.boxes.id is not None:
            ids      = result.boxes.id.cpu().numpy().astype(int)
            classes  = result.boxes.cls.cpu().numpy().astype(int)
            confs    = result.boxes.conf.cpu().numpy()
            xyxy     = result.boxes.xyxy.cpu().numpy()

            for tid, c, conf, box in zip(ids, classes, confs, xyxy):
                x1, y1, x2, y2 = box.tolist()
                cx, cy = (x1+x2)/2, (y1+y2)/2
                if c == PERSON_ID:
                    person_boxes.append((x1, y1, x2, y2))
                    # store exact person foot position (bottom-centre of box)
                    foot_x, foot_y = (x1 + x2) / 2, y2
                    person_memory[(foot_x, foot_y)] = time.time()
                elif c in COCO_LITTER_IDS:
                    if cy > floor_y:
                        coco_litter.append((cx, cy, COCO_LITTER_IDS[c], float(conf)))

        # ── 2. Background subtraction → floor blobs ──────────────────────────
        fg_mask = fgbg.apply(frame)

        # Only look at floor zone
        floor_mask = np.zeros_like(fg_mask)
        floor_mask[floor_y:, :] = fg_mask[floor_y:, :]

        # Morphological cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        floor_mask = cv2.morphologyEx(floor_mask, cv2.MORPH_CLOSE, kernel)
        floor_mask = cv2.morphologyEx(floor_mask, cv2.MORPH_OPEN,  kernel)

        contours, _ = cv2.findContours(floor_mask, cv2.RETR_EXTERNAL,
                                       cv2.CHAIN_APPROX_SIMPLE)
        blob_centroids = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if MIN_BLOB_AREA < area < MAX_BLOB_AREA:
                M = cv2.moments(cnt)
                if M["m00"] == 0:
                    continue
                cx = M["m10"] / M["m00"]
                cy = M["m01"] / M["m00"]
                # skip if a person is standing on this blob
                under_person = any(box_contains(pb, cx, cy) for pb in person_boxes)
                if not under_person:
                    blob_centroids.append((cx, cy))

        blobs = blob_tracker.update(blob_centroids)

        # ── 3. Litter event: stationary blob + person was recently nearby ────
        now = time.time()
        # prune person memory older than PERSON_MEMORY_SECS
        person_memory = {pos: t for pos, t in person_memory.items()
                         if now - t < PERSON_MEMORY_SECS}
        for bid, b in blobs.items():
            if b["still_frames"] < STATIONARY_FRAMES:
                continue

            cx, cy = b["cx"], b["cy"]
            # person must have been within PERSON_PROXIMITY_PX of this blob recently
            person_was_here = any(
                dist((cx, cy), pos) < PERSON_PROXIMITY_PX
                and now - t < PERSON_MEMORY_SECS
                for pos, t in person_memory.items()
            )
            if not person_was_here:
                continue

            # Cooldown: don't re-fire near a recent event
            too_close = any(
                dist((cx, cy), (rx, ry)) < EVENT_DIST_THRESH
                and now - rt < COOLDOWN_SECS
                for rx, ry, rt in recent_events
            )
            if too_close:
                continue

            recent_events.append((cx, cy, now))
            recent_events = [(x, y, t) for x, y, t in recent_events
                             if now - t < COOLDOWN_SECS * 2]

            ts   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            meta = {
                "timestamp":  ts,
                "label":      "litter",
                "confidence": None,
                "frame_path": "",
                "clip_path":  "",
            }
            writers.append(EvidenceWriter(fps, size, meta, buf.snapshot()))

        # ── 4. Also fire on reliable COCO litter detections ──────────────────
        for cx, cy, label, conf in coco_litter:
            under_person = any(box_contains(pb, cx, cy) for pb in person_boxes)
            if under_person:
                continue
            too_close = any(
                dist((cx, cy), (rx, ry)) < EVENT_DIST_THRESH
                and now - rt < COOLDOWN_SECS
                for rx, ry, rt in recent_events
            )
            if too_close:
                continue
            recent_events.append((cx, cy, now))
            ts   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            meta = {
                "timestamp":  ts,
                "label":      label,
                "confidence": round(conf, 3),
                "frame_path": "",
                "clip_path":  "",
            }
            writers.append(EvidenceWriter(fps, size, meta, buf.snapshot()))

        # ── 5. Draw overlays ─────────────────────────────────────────────────
        if show:
            vis = result.plot()

            # Floor zone line
            cv2.line(vis, (0, floor_y), (w, floor_y), (0, 255, 255), 1)

            # Draw floor blobs
            for bid, b in blobs.items():
                cx, cy = int(b["cx"]), int(b["cy"])
                ratio  = min(b["still_frames"] / STATIONARY_FRAMES, 1.0)
                color  = (0, int(255 * ratio), int(255 * (1-ratio)))
                cv2.circle(vis, (cx, cy), 12, color, 2)
                cv2.putText(vis, f"blob{bid} {b['still_frames']}f",
                            (cx+14, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.45,
                            color, 1)

            cv2.imshow("Litter Detection", vis)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    for wr in writers:
        wr.force_flush()
    cv2.destroyAllWindows()
    print(f"Done. Processed {frame_count} frames.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="0")
    parser.add_argument("--show", action="store_true")
    args = parser.parse_args()
    run(args.source, show=args.show)
