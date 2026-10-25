"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import json
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(current_dir, "static")), name="static")

TEACHERS_FILE = current_dir / "teachers.json"


def load_teachers():
    if not TEACHERS_FILE.exists():
        return {"teachers": [{"username": "teacher", "password": "Mergington123"}]}

    try:
        with TEACHERS_FILE.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (json.JSONDecodeError, OSError):
        return {"teachers": [{"username": "teacher", "password": "Mergington123"}]}

    if isinstance(data, dict) and "teachers" in data:
        return data
    return {"teachers": [{"username": "teacher", "password": "Mergington123"}]}


TEACHERS = load_teachers()["teachers"]
ACTIVE_TOKENS = {}


def require_teacher_auth(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=403,
            detail="Teacher login required. Please log in to manage activity rosters."
        )

    token = authorization.split(" ", 1)[1].strip()
    username = ACTIVE_TOKENS.get(token)
    if not username:
        raise HTTPException(
            status_code=403,
            detail="Teacher login required. Please log in to manage activity rosters."
        )
    return username


# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/admin/status")
def get_admin_status(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        return {"logged_in": False, "username": None}

    token = authorization.split(" ", 1)[1].strip()
    username = ACTIVE_TOKENS.get(token)
    if username:
        return {"logged_in": True, "username": username}
    return {"logged_in": False, "username": None}


@app.post("/admin/login")
def login_admin(payload: dict):
    username = payload.get("username", "").strip()
    password = payload.get("password", "")
    for teacher in TEACHERS:
        if teacher.get("username") == username and teacher.get("password") == password:
            token = uuid.uuid4().hex
            ACTIVE_TOKENS[token] = username
            return {"message": "Logged in as teacher", "token": token, "username": username}

    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/admin/logout")
def logout_admin(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        ACTIVE_TOKENS.pop(token, None)
    return {"message": "Logged out"}


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, authorization: str | None = Header(default=None)):
    """Teachers sign up a student for an activity."""
    require_teacher_auth(authorization)

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]

    if email in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is already signed up")

    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, authorization: str | None = Header(default=None)):
    """Teachers unregister a student from an activity."""
    require_teacher_auth(authorization)

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]

    if email not in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is not signed up for this activity")

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
