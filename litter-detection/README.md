# Litter Detection MVP

AI-powered litter detection using YOLOv8. Monitors video feeds, identifies abandoned litter objects, and logs evidence with thumbnails and short clips. Built for the blue-earth / anti-pollution hackathon theme.

## What it does

1. Reads a webcam feed or video file.
2. Runs YOLOv8 (yolov8n) to detect people and litter objects (bottles, cups, wine glasses).
3. Fires a **litter event** when a litter object is stationary near the floor and not overlapping a person.
4. Saves a thumbnail JPG + ~5s MP4 clip + a JSON log entry per event.
5. Serves a web dashboard to review flagged events with thumbnails and clip playback.

## How to run

```bash
# 1. Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

# 2. Install dependencies (yolov8n.pt downloads automatically on first run)
pip install -r requirements.txt

# 3. Run detection on a video file
python detect.py --source path/to/video.mp4 --show

# 3b. Or use webcam (index 0)
python detect.py --source 0 --show

# 4. In a separate terminal, start the dashboard
python app.py
# Open http://localhost:5000
```

Evidence (frames, clips, log) is saved to the `evidence/` directory.

## Architecture

```
detect.py          YOLOv8 tracking loop + litter heuristic + evidence writer
app.py             Flask dashboard — serves events.json, frames, clips
evidence/
  events.json      Append-only log of litter events
  frames/          Thumbnail JPG per event
  clips/           ~5-second MP4 clip per event
```

**Drop heuristic:** A litter object fires an event when:
- Its centroid has moved < 20 px for 15 consecutive frames (stationary).
- Its bottom edge is in the lower 45% of the frame (near the floor).
- It does not overlap any detected person bounding box (not held / in use).
- At least 10 seconds have passed since the last event for that track ID (cooldown).

## Future work / ethical notes

The following were **intentionally excluded** from this MVP:

- **NDI / phone-camera ingestion** — nice stretch goal, not needed for demo.
- **Face recognition or person identification** — matching faces against a database would risk false accusations against innocent people. This system tracks *objects*, not *identities*.
- **Automated fines or contacting individuals** — never automated; any alerting goes to a human operator who reviews evidence before taking action.
- **Email alerts** — if added, alerts go to an *operator* only (never to an accused individual) and always include the evidence clip so a human can verify before acting.
- **GDPR / privacy compliance** — a production deployment would need video retention policies, consent signage, and access controls on the evidence store.

The goal of this project is to assist human operators in identifying pollution incidents, not to automate enforcement.
