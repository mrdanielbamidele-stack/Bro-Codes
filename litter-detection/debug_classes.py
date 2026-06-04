"""Quick script to print every class YOLO detects in a video."""
import sys
from collections import Counter
import cv2
from ultralytics import YOLO

source = sys.argv[1] if len(sys.argv) > 1 else "0"
model = YOLO("yolov8n.pt")
cap = cv2.VideoCapture(source)
counts = Counter()
frame_n = 0

while True:
    ok, frame = cap.read()
    if not ok:
        break
    frame_n += 1
    if frame_n % 10 != 0:  # sample every 10th frame
        continue
    results = model(frame, verbose=False, conf=0.3)
    for r in results:
        for c in r.boxes.cls.cpu().numpy().astype(int):
            counts[f"{c}: {model.names[c]}"] += 1

cap.release()
print("\nDetected classes (sampled every 10 frames):")
for label, n in sorted(counts.items(), key=lambda x: -x[1]):
    print(f"  {label:30s}  {n} times")
