"""
GradicAI Proctoring Service — port 8001
Receives base64 video frames via WebSocket, runs YOLOv8 detection,
returns violations in real-time.
"""

import json
import sys
import os
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# Load env vars: Render injects them directly; for local dev, fall back to backend/.env
load_dotenv()  # picks up Render env vars or local .env in cwd
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))  # local dev fallback

from detector import analyze_frame, get_model

app = FastAPI(title="GradicAI Proctoring Service", version="1.0.0")

INTERNAL_KEY = os.getenv("PROCTORING_INTERNAL_KEY", "")

ALLOWED_ORIGINS = [o for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1):\d+)|(https://.*\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAIN_API = os.getenv("MAIN_API_URL", "http://localhost:8000")

# In-memory session state: session_id → {warning_count, terminated}
sessions: dict = {}


@app.on_event("startup")
async def preload_model():
    get_model()
    print("[Proctoring] YOLOv8 model loaded and ready")


@app.get("/")
def root():
    return {"message": "GradicAI Proctoring Service running"}


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.websocket("/ws/{session_id}")
async def proctoring_ws(websocket: WebSocket, session_id: str, exam_id: int = 0, student_id: int = 0):
    await websocket.accept()

    # Initialize session state
    state = {"warning_count": 0, "terminated": False, "cooldown": 0, "exam_id": exam_id, "student_id": student_id}
    sessions[session_id] = state

    try:
        while True:
            message = await websocket.receive_text()

            if state["terminated"]:
                await websocket.send_text(json.dumps({
                    "type": "terminated",
                    "message": "Exam has been terminated due to repeated violations."
                }))
                continue

            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "frame":
                    b64 = data.get("frame", "")
                    if not b64:
                        continue

                    # Cooldown: skip analysis for N frames after a warning to avoid repeated alerts
                    if state["cooldown"] > 0:
                        state["cooldown"] -= 1
                        await websocket.send_text(json.dumps({"type": "ok"}))
                        continue

                    result = analyze_frame(b64)
                    violations = result["violations"]

                    if not violations:
                        await websocket.send_text(json.dumps({
                            "type": "ok",
                            "person_count": result["person_count"],
                        }))
                        continue

                    # Issue warning
                    state["warning_count"] += 1
                    wc = state["warning_count"]
                    state["cooldown"] = 4  # skip 4 frames (~6 seconds)

                    # Map violation types to human-readable messages
                    messages = {
                        "phone":            "Mobile phone detected — please remove it from view.",
                        "book":             "Study material detected — please remove it from view.",
                        "multiple_persons": "Multiple people detected — only you should be visible.",
                        "face_absent":      "You have moved out of the camera frame — please return.",
                    }
                    primary = violations[0]
                    msg = messages.get(primary, "Suspicious activity detected.")

                    if wc >= 3:
                        state["terminated"] = True
                        response = {
                            "type": "terminate",
                            "warning_level": 3,
                            "violation": primary,
                            "message": "Exam terminated: 3 violations recorded. Your teacher has been notified.",
                        }
                    else:
                        response = {
                            "type": "warning",
                            "warning_level": wc,
                            "violation": primary,
                            "violations": violations,
                            "message": msg,
                            "warnings_remaining": 3 - wc,
                        }

                    await websocket.send_text(json.dumps(response))

                    # Notify main API to log the event + screenshot (best-effort)
                    try:
                        async with httpx.AsyncClient() as client:
                            await client.post(
                                f"{MAIN_API}/proctoring/event",
                                json={
                                    "session_key": session_id,
                                    "exam_id": state["exam_id"],
                                    "student_id": state["student_id"],
                                    "event_type": primary,
                                    "warning_level": wc,
                                    "terminated": state["terminated"],
                                    "frame_b64": b64,  # save violation screenshot
                                },
                                headers={"X-Internal-Key": INTERNAL_KEY},
                                timeout=5.0,
                            )
                    except Exception:
                        pass

                elif msg_type == "tab_switch":
                    if state["cooldown"] > 0:
                        await websocket.send_text(json.dumps({"type": "ok"}))
                        continue

                    state["warning_count"] += 1
                    wc = state["warning_count"]
                    state["cooldown"] = 4

                    if wc >= 3:
                        state["terminated"] = True
                        response = {
                            "type": "terminate",
                            "warning_level": 3,
                            "violation": "tab_switch",
                            "message": "Exam terminated: 3 violations recorded. Your teacher has been notified.",
                        }
                    else:
                        response = {
                            "type": "warning",
                            "warning_level": wc,
                            "violation": "tab_switch",
                            "violations": ["tab_switch"],
                            "message": "Tab switching detected — you must stay on the exam page.",
                            "warnings_remaining": 3 - wc,
                        }

                    await websocket.send_text(json.dumps(response))

                    try:
                        async with httpx.AsyncClient() as client:
                            await client.post(
                                f"{MAIN_API}/proctoring/event",
                                json={
                                    "session_key": session_id,
                                    "exam_id": state["exam_id"],
                                    "student_id": state["student_id"],
                                    "event_type": "tab_switch",
                                    "warning_level": wc,
                                    "terminated": state["terminated"],
                                },
                                headers={"X-Internal-Key": INTERNAL_KEY},
                                timeout=5.0,
                            )
                    except Exception:
                        pass

                elif msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

                elif msg_type == "end":
                    break

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        pass
    finally:
        sessions.pop(session_id, None)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
