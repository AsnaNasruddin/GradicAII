import base64
import io
import numpy as np
from PIL import Image

# YOLOv8 COCO class indices we care about
PERSON_CLASS = 0
PHONE_CLASS = 67
BOOK_CLASS = 73

# Label → event_type mapping
DETECTION_MAP = {
    PHONE_CLASS: "phone",
    BOOK_CLASS:  "book",
}

_model = None

def get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO("yolov8n.pt")  # nano model (~6 MB, auto-downloaded)
    return _model


def decode_frame(b64_data: str) -> np.ndarray:
    """Decode a base64 JPEG/PNG frame into an RGB numpy array."""
    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]
    raw = base64.b64decode(b64_data)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


def analyze_frame(b64_data: str) -> dict:
    """
    Returns:
      {
        "violations": ["phone", "book", "multiple_persons", "face_absent"],
        "person_count": int,
        "detections": [{"class": str, "confidence": float}]
      }
    """
    try:
        frame = decode_frame(b64_data)
    except Exception:
        return {"violations": [], "person_count": 0, "detections": []}

    model = get_model()
    results = model(frame, verbose=False, conf=0.25)[0]

    persons = 0
    violations = []
    detections = []

    for box in results.boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        label = results.names[cls]
        detections.append({"class": label, "confidence": round(conf, 2)})

        if cls == PERSON_CLASS:
            persons += 1
        elif cls in DETECTION_MAP:
            vtype = DETECTION_MAP[cls]
            if vtype not in violations:
                violations.append(vtype)

    if persons == 0:
        violations.append("face_absent")
    elif persons > 1:
        violations.append("multiple_persons")

    return {
        "violations": violations,
        "person_count": persons,
        "detections": detections,
    }
