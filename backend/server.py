"""AI Virtual Healthcare Assistant — Python Backend Server.

Zero-external-dependency Python 3.10+ HTTP/SSE backend using standard library
(`ThreadingHTTPServer`, `hashlib.scrypt`, `urllib.request`) connected to the
Vite/React frontend on port 3000 via Express proxy.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import html
import http.server
import json
import os
import random
import re
import secrets
import signal
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Generator


# ============================================================================
# 1. ENVIRONMENT & CONFIGURATION
# ============================================================================

ROOT_DIR = Path(__file__).resolve().parent.parent


def load_dotenv_file(env_path: Path) -> None:
    """Load key=value pairs from .env if not already set in os.environ."""
    if not env_path.exists():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip()
            if (val.startswith('"') and val.endswith('"')) or (
                val.startswith("'") and val.endswith("'")
            ):
                val = val[1:-1]
            if key and key not in os.environ:
                os.environ[key] = val
    except OSError:
        pass


load_dotenv_file(ROOT_DIR / ".env")


def get_data_dir() -> Path:
    return Path(os.environ.get("HEALTHCARE_DATA_DIR", str(ROOT_DIR / "data")))


def get_db_file() -> Path:
    return get_data_dir() / "db.json"


# ============================================================================
# 2. MANDATORY CLINICAL SYSTEM PROMPTS
# ============================================================================

HEALTH_CHAT_SYSTEM_PROMPT = """You are the AI Virtual Healthcare Assistant on a telemedicine platform.
You MUST strictly follow these rules on every single response:
1. Respond in a calm, professional, caring, doctor-like tone. Never claim to be a real doctor or a licensed professional.
2. Only answer health, medicine/tablet use, and wellness questions. Politely decline anything unrelated and steer the user back to health topics.
3. When the user asks about a disease, symptom, or tablet/medicine, provide:
   (a) Common Possible Causes & Plain-Language Explanation of the condition,
   (b) Safe Home Remedy & Self-Care Tips (such as warm fluids, rest, steam inhalation, saline gargles, hydration, or dietary comfort measures), and
   (c) General Use of Tablets / Medicines: clearly explain what relevant over-the-counter or commonly prescribed tablets are generally used for (their purpose and how they work), while reminding the patient to consult a doctor or pharmacist for personal dosage approval.
4. Never state a definite diagnosis. Use wording like "this may be related to...".
5. If symptoms suggest an emergency, put an urgent warning first telling the user to call 108 (ambulance) or 112, or go to the nearest hospital immediately.
6. If unsure, say so honestly. Never guess or invent facts.
7. Reply in the same language the user writes in (English, Telugu, or Hindi).
8. Keep answers simple, accurate, and safe.
9. Do NOT begin responses with emergency warnings. Do NOT mention emergencies unless the user describes dangerous symptoms. For greetings like 'hi' or 'hello', reply with a short friendly greeting and ask how you can help with their health question.
10. Keep answers concise and under about 150 words (unless the user explicitly asks you to "Tell me more" or elaborate in detail).

Additional formatting instruction:
- Organize your response clearly with bullet points for:
  • **Causes & Explanation**
  • **Home Remedy Tips**
  • **Common Tablets & Their General Use**"""

PRESCRIPTION_SYSTEM_PROMPT = """You are a clinical prescription OCR and medical explanation assistant powered by Gemini Vision.
Analyze the uploaded image of a handwritten or printed medical prescription and extract structured fields.

STRICT SAFETY & EXTRACTION RULES:
1. Extract: doctorName, date, patientName, each medicine (name, dosage, frequency, duration, notes, generalPurpose), and generalNotes.
2. Assign a confidence level ("High", "Medium", or "Low") to EVERY extracted field and medicine.
3. NEVER guess an unreadable or smudged word. If any word, medicine name, or dosage is illegible or ambiguous, mark its value as "unreadable" (or include "unreadable" in the field) and set its confidence to "Low".
4. For each medicine, provide "generalPurpose": explain in simple, everyday words what the medicine is generally used for. Do NOT change doses, do NOT critique the prescription, and do NOT suggest alternative medicines.
5. Respect the requested explanation language (English, Telugu, or Hindi) for the generalPurpose and notes explanations."""

EMERGENCY_KEYWORDS = [
    "chest pain",
    "heart attack",
    "trouble breathing",
    "difficulty breathing",
    "shortness of breath",
    "can't breathe",
    "cannot breathe",
    "stroke",
    "facial droop",
    "slurred speech",
    "severe bleeding",
    "unconscious",
    "suicidal",
    "suicide",
    "kill myself",
    "self harm",
    "overdose",
    "seizure",
    "ఛాతీ నొప్పి",
    "శ్వాస తీసుకోవడంలో ఇబ్బంది",
    "सीने में दर्द",
    "सांस लेने में तकलीफ",
]


def detect_emergency_symptoms(text: str) -> bool:
    lower = text.lower().strip()
    if not lower or len(lower) < 4:
        return False
    return any(kw.lower() in lower for kw in EMERGENCY_KEYWORDS)


# ============================================================================
# 3. CRYPTOGRAPHIC PASSWORD HASHING (Node scryptSync compatible)
# ============================================================================


def hash_password(password: str, existing_salt: str | None = None) -> tuple[str, str]:
    salt = existing_salt or secrets.token_hex(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    )
    return derived.hex(), salt


def verify_password(password: str, expected_hash: str, salt: str) -> bool:
    if not password or not expected_hash or not salt:
        return False
    try:
        computed, _ = hash_password(password, existing_salt=salt)
        return hmac.compare_digest(
            bytes.fromhex(computed),
            bytes.fromhex(expected_hash),
        )
    except Exception:
        return False


def sanitize_user(user: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in user.items() if k not in ("passwordHash", "passwordSalt")}


SESSION_COOKIE_NAME = "medassist_session"
SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
_EPHEMERAL_SESSION_SECRET = secrets.token_hex(32)
SEEDED_PREVIEW_IDS = {
    "adm-1",
    "doc-1",
    "doc-2",
    "doc-3",
    "doc-4",
    "doc-5",
    "pat-1",
    "pat-2",
    "pat-3",
}


def get_env_password_for_seeded_role(role: str) -> str:
    if role == "admin":
        return os.environ.get("ADMIN_PASSWORD", "").strip()
    if role == "doctor":
        return os.environ.get("DEMO_DOCTOR_PASSWORD", "").strip()
    return os.environ.get("DEMO_PATIENT_PASSWORD", "").strip()


def build_seeded_credential_fields(role: str) -> dict[str, Any]:
    env_pass = get_env_password_for_seeded_role(role)
    if env_pass:
        pw_hash, pw_salt = hash_password(env_pass)
        return {
            "passwordHash": pw_hash,
            "passwordSalt": pw_salt,
            "seededPreviewAccount": True,
            "credentialClaimed": True,
        }
    return {
        "passwordHash": "",
        "passwordSalt": "",
        "seededPreviewAccount": True,
        "credentialClaimed": False,
    }


def validate_safe_https_url(raw: Any) -> tuple[bool, str | None]:
    if raw is None or not str(raw).strip():
        return True, None
    val = str(raw).strip()
    if len(val) > 1024:
        return False, None
    parsed = urllib.parse.urlparse(val)
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        return False, None
    return True, val


def get_session_secret() -> str:
    env_secret = os.environ.get("SESSION_SECRET", "").strip()
    if len(env_secret) >= 16:
        return env_secret
    return _EPHEMERAL_SESSION_SECRET


def create_session_token(user_id: str) -> str:
    expires_at = epoch_ms() + SESSION_TTL_MS
    payload = f"{user_id}.{expires_at}"
    sig = hmac.new(
        get_session_secret().encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}.{sig}"


def verify_session_token(token: str | None) -> str | None:
    if not token or not isinstance(token, str):
        return None
    parts = token.strip().split(".")
    if len(parts) != 3:
        return None
    user_id, exp_str, sig = parts
    if not user_id or not exp_str or not sig:
        return None
    try:
        expires_at = int(exp_str)
    except ValueError:
        return None
    if expires_at < epoch_ms():
        return None
    expected_sig = hmac.new(
        get_session_secret().encode("utf-8"),
        f"{user_id}.{exp_str}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return None
    return user_id


def now_iso(offset_ms: int = 0) -> str:
    dt = datetime.now(timezone.utc) + timedelta(milliseconds=offset_ms)
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def today_str(offset_days: int = 0) -> str:
    dt = datetime.now(timezone.utc) + timedelta(days=offset_days)
    return dt.strftime("%Y-%m-%d")


def epoch_ms() -> int:
    return int(time.time() * 1000)


# ============================================================================
# 4. THREAD-SAFE PERSISTENT JSON DATABASE (/data/db.json)
# ============================================================================

DB_LOCK = threading.RLock()


def _build_rx_svg_data_url(title: str, subtitle: str, lines: list[str]) -> str:
    line_svg = "".join(
        f'<text x="36" y="{132 + idx * 34}" font-family="Georgia, serif" font-style="italic" font-size="16" fill="#1E3A8A">{html.escape(str(text), quote=True)}</text>'
        for idx, text in enumerate(lines)
    )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="360" viewBox="0 0 520 360">'
        '<rect width="520" height="360" rx="14" fill="#FDFBF7" stroke="#CBD5E1" stroke-width="2"/>'
        '<rect x="0" y="0" width="520" height="68" rx="14" fill="#064734"/>'
        f'<text x="28" y="34" font-family="sans-serif" font-weight="bold" font-size="17" fill="#FFFFFF">{html.escape(str(title), quote=True)}</text>'
        f'<text x="28" y="54" font-family="sans-serif" font-size="12" fill="#E3F2E8">{html.escape(str(subtitle), quote=True)}</text>'
        '<text x="36" y="100" font-family="Georgia, serif" font-weight="bold" font-style="italic" font-size="24" fill="#064734">Rx</text>'
        f"{line_svg}"
        '<text x="320" y="330" font-family="Georgia, serif" font-style="italic" font-size="13" fill="#475569">Signed: Dr. Aarav Mehta, MD</text>'
        "</svg>"
    )
    b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"


def _build_seed_prescription_analyses(today: str, two_days_ago: str) -> list[dict[str, Any]]:
    return [
        {
            "id": "rx-scan-101",
            "patientId": "pat-1",
            "createdAt": f"{two_days_ago}T11:20:00Z",
            "imageDataUrl": _build_rx_svg_data_url(
                "APOLLO CARE SPECIALTY CLINIC",
                f"Dr. Aarav Mehta, MD | Date: {two_days_ago} | Patient: Rohan Verma",
                [
                    "1) Tab. Paracetamol 650 mg — 1-0-1 After Food (3 Days)",
                    "2) Tab. Levocetirizine 5 mg — 0-0-1 Bedtime (5 Days)",
                    "3) Cap. Pantoprazole 40 mg — 1-0-0 Empty Stomach (5 Days)",
                ],
            ),
            "fileName": "viral_fever_opd_rx.png",
            "language": "English",
            "doctorName": {"value": "Dr. Aarav Mehta (MD)", "confidence": "High"},
            "date": {"value": two_days_ago, "confidence": "High"},
            "patientName": {"value": "Rohan Verma", "confidence": "High"},
            "medicines": [
                {
                    "name": "Tab. Paracetamol",
                    "dosage": "650 mg",
                    "frequency": "Twice daily",
                    "timing": "1-0-1 After Food",
                    "duration": "3 Days",
                    "generalPurpose": "Reduces fever and relieves mild-to-moderate body ache",
                    "notes": "Take after breakfast and dinner",
                    "confidence": "High",
                    "confidenceScore": 96,
                },
                {
                    "name": "Tab. Levocetirizine",
                    "dosage": "5 mg",
                    "frequency": "Once nightly",
                    "timing": "0-0-1 Bedtime",
                    "duration": "5 Days",
                    "generalPurpose": "Antihistamine for throat irritation and nasal congestion",
                    "notes": "May cause mild drowsiness",
                    "confidence": "High",
                    "confidenceScore": 94,
                },
                {
                    "name": "Cap. Pantoprazole",
                    "dosage": "40 mg",
                    "frequency": "Once morning",
                    "timing": "1-0-0 Before Breakfast",
                    "duration": "5 Days",
                    "generalPurpose": "Protects stomach lining and reduces gastric acidity",
                    "notes": "Swallow 30 minutes prior to breakfast",
                    "confidence": "High",
                    "confidenceScore": 95,
                },
            ],
            "generalNotes": {
                "value": "Warm saline gargles twice daily and maintain 2.5L fluid intake.",
                "confidence": "High",
            },
            "suggestedSymptoms": "Mild fever, sore throat, and post-meal gastric discomfort",
            "drugInteractionAlert": None,
        },
        {
            "id": "rx-scan-102",
            "patientId": "pat-1",
            "createdAt": f"{today}T09:15:00Z",
            "imageDataUrl": _build_rx_svg_data_url(
                "CARE WELLNESS TELE-CLINIC",
                f"Dr. Aarav Mehta, MD | Date: {today} | Patient: Rohan Verma",
                [
                    "1) Tab. Azithromycin 500 mg — 1-0-0 After Food (3 Days)",
                    "2) Syp. Ambroxol-LS 5 ml — 1-0-1 After Food (5 Days)",
                    "3) Warm Steam Inhalation — Twice Daily",
                ],
            ),
            "fileName": "handwritten_cough_rx.png",
            "language": "English",
            "doctorName": {"value": "Dr. Aarav Mehta (MD)", "confidence": "High"},
            "date": {"value": today, "confidence": "High"},
            "patientName": {"value": "Rohan Verma", "confidence": "High"},
            "medicines": [
                {
                    "name": "Tab. Azithromycin",
                    "dosage": "500 mg",
                    "frequency": "Once daily",
                    "timing": "1-0-0 After Food",
                    "duration": "3 Days",
                    "generalPurpose": "Antibiotic used if bacterial respiratory infection is suspected",
                    "notes": "Complete the prescribed 3-day course",
                    "confidence": "High",
                    "confidenceScore": 93,
                },
                {
                    "name": "Syp. Ambroxol-LS (Check Strength)",
                    "dosage": "5 ml",
                    "frequency": "Twice daily",
                    "timing": "1-0-1 After Food",
                    "duration": "5 Days",
                    "generalPurpose": "Mucolytic syrup to loosen chest phlegm and ease cough",
                    "notes": "Handwritten suffix slightly smudged — verify with pharmacist",
                    "confidence": "Low",
                    "confidenceScore": 68,
                },
            ],
            "generalNotes": {
                "value": "Avoid chilled beverages; review in video follow-up if cough persists.",
                "confidence": "High",
            },
            "suggestedSymptoms": "Productive cough and upper respiratory throat irritation",
            "drugInteractionAlert": None,
        },
    ]


def create_seed_database() -> dict[str, Any]:
    doc_cred = build_seeded_credential_fields("doctor")
    pat_cred = build_seeded_credential_fields("patient")
    adm_cred = build_seeded_credential_fields("admin")

    default_slots = [
        "09:00 AM",
        "10:00 AM",
        "11:00 AM",
        "12:00 PM",
        "02:00 PM",
        "03:30 PM",
        "05:00 PM",
        "06:30 PM",
    ]

    users = [
        {
            "id": "doc-1",
            "name": "Dr. Aarav Mehta",
            "email": "dr.aarav@medassist.in",
            **doc_cred,
            "role": "doctor",
            "phone": "+91 98490 11201",
            "createdAt": "2026-09-10T08:00:00Z",
            "specialty": "General & Internal Medicine",
            "qualification": "MBBS, MD (Internal Medicine)",
            "registrationNumber": "TSMC-48291",
            "experienceYears": 12,
            "consultationFee": 500,
            "approved": True,
            "availableSlots": default_slots,
            "bio": "Senior Internal Medicine specialist focusing on infectious diseases, metabolic syndromes, and preventive primary care.",
        },
        {
            "id": "doc-2",
            "name": "Dr. Priya Sharma",
            "email": "dr.priya@medassist.in",
            **doc_cred,
            "role": "doctor",
            "phone": "+91 98490 11202",
            "createdAt": "2026-09-12T09:30:00Z",
            "specialty": "Cardiology & Preventive Care",
            "qualification": "MBBS, MD, DM (Cardiology)",
            "registrationNumber": "TSMC-51904",
            "experienceYears": 15,
            "consultationFee": 800,
            "approved": True,
            "availableSlots": default_slots,
            "bio": "Interventional and non-invasive cardiologist specializing in hypertension, chest pain evaluation, and lipid disorders.",
        },
        {
            "id": "doc-3",
            "name": "Dr. Karthik Reddy",
            "email": "dr.karthik@medassist.in",
            **doc_cred,
            "role": "doctor",
            "phone": "+91 98490 11203",
            "createdAt": "2026-09-15T10:15:00Z",
            "specialty": "Pulmonology & Respiratory Medicine",
            "qualification": "MBBS, MD (Pulmonary Medicine)",
            "registrationNumber": "APMC-39102",
            "experienceYears": 9,
            "consultationFee": 650,
            "approved": True,
            "availableSlots": default_slots,
            "bio": "Specialist in asthma, chronic cough, allergic rhinitis, sleep apnea, and post-viral respiratory recovery.",
        },
        {
            "id": "doc-4",
            "name": "Dr. Ananya Nair",
            "email": "dr.ananya@medassist.in",
            **doc_cred,
            "role": "doctor",
            "phone": "+91 98490 11204",
            "createdAt": "2026-09-20T11:00:00Z",
            "specialty": "Dermatology & Immunology",
            "qualification": "MBBS, MD (Dermatology, Venereology)",
            "registrationNumber": "KMC-62018",
            "experienceYears": 8,
            "consultationFee": 600,
            "approved": True,
            "availableSlots": default_slots,
            "bio": "Clinical dermatologist treating eczema, urticaria, allergic skin reactions, and autoimmune cutaneous conditions.",
        },
        {
            "id": "doc-5",
            "name": "Dr. Vikram Joshi",
            "email": "dr.vikram@medassist.in",
            **doc_cred,
            "role": "doctor",
            "phone": "+91 98490 11205",
            "createdAt": "2026-10-28T14:20:00Z",
            "specialty": "Orthopedics & Joint Care",
            "qualification": "MBBS, MS (Orthopedics)",
            "registrationNumber": "MMC-77412",
            "experienceYears": 11,
            "consultationFee": 700,
            "approved": False,
            "availableSlots": default_slots,
            "bio": "Orthopedic consultant focusing on spine ergonomics, joint inflammation, and sports injury rehabilitation.",
        },
        {
            "id": "pat-1",
            "name": "Rohan Verma",
            "email": "rohan@patient.in",
            **pat_cred,
            "role": "patient",
            "phone": "+91 90001 22301",
            "createdAt": "2026-10-01T09:00:00Z",
            "age": 34,
            "gender": "Male",
            "bloodGroup": "O+",
            "allergies": ["Sulfa Drugs", "Dust Mites"],
        },
        {
            "id": "pat-2",
            "name": "Sneha Kulkarni",
            "email": "sneha@patient.in",
            **pat_cred,
            "role": "patient",
            "phone": "+91 90001 22302",
            "createdAt": "2026-10-05T11:30:00Z",
            "age": 28,
            "gender": "Female",
            "bloodGroup": "A+",
            "allergies": ["None Known"],
        },
        {
            "id": "pat-3",
            "name": "Arjun Rao",
            "email": "arjun@patient.in",
            **pat_cred,
            "role": "patient",
            "phone": "+91 90001 22303",
            "createdAt": "2026-10-12T16:45:00Z",
            "age": 45,
            "gender": "Male",
            "bloodGroup": "B+",
            "allergies": ["Penicillin"],
        },
        {
            "id": "adm-1",
            "name": "Dr. Meera Krishnan",
            "email": "admin@medassist.in",
            **adm_cred,
            "role": "admin",
            "phone": "+91 98490 00001",
            "createdAt": "2026-08-01T08:00:00Z",
        },
    ]

    today = today_str(0)
    in_two_days = today_str(2)
    five_days_ago = today_str(-5)
    two_days_ago = today_str(-2)
    in_seven_days = today_str(7)

    appointments = [
        {
            "id": "apt-101",
            "patientId": "pat-1",
            "patientName": "Rohan Verma",
            "patientEmail": "rohan@patient.in",
            "doctorId": "doc-1",
            "doctorName": "Dr. Aarav Mehta",
            "doctorSpecialty": "General & Internal Medicine",
            "date": today,
            "timeSlot": "05:00 PM",
            "symptoms": "Low-grade fever for 3 days, mild throat irritation, and fatigue",
            "notes": "Checked symptoms via AI Health Chat; requesting clinical review.",
            "status": "Confirmed",
            "doctorResponseNote": "Slot confirmed. Please keep your recent temperature log ready for our video call.",
            "meetingRoomId": "MED-ROOM-101",
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        },
        {
            "id": "apt-102",
            "patientId": "pat-1",
            "patientName": "Rohan Verma",
            "patientEmail": "rohan@patient.in",
            "doctorId": "doc-3",
            "doctorName": "Dr. Karthik Reddy",
            "doctorSpecialty": "Pulmonology & Respiratory Medicine",
            "date": in_two_days,
            "timeSlot": "11:00 AM",
            "symptoms": "Seasonal nocturnal dry cough and nasal congestion",
            "notes": "History of dust mite sensitivity.",
            "status": "Pending",
            "meetingRoomId": "MED-ROOM-102",
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        },
        {
            "id": "apt-103",
            "patientId": "pat-2",
            "patientName": "Sneha Kulkarni",
            "patientEmail": "sneha@patient.in",
            "doctorId": "doc-2",
            "doctorName": "Dr. Priya Sharma",
            "doctorSpecialty": "Cardiology & Preventive Care",
            "date": today,
            "timeSlot": "02:00 PM",
            "symptoms": "Occasional palpitations after caffeine and work stress",
            "notes": "Resting pulse around 88 bpm.",
            "status": "Confirmed",
            "doctorResponseNote": "Confirmed for 2:00 PM video consultation.",
            "meetingRoomId": "MED-ROOM-103",
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        },
        {
            "id": "apt-104",
            "patientId": "pat-3",
            "patientName": "Arjun Rao",
            "patientEmail": "arjun@patient.in",
            "doctorId": "doc-1",
            "doctorName": "Dr. Aarav Mehta",
            "doctorSpecialty": "General & Internal Medicine",
            "date": five_days_ago,
            "timeSlot": "05:00 PM",
            "symptoms": "Post-viral fatigue and mild gastric acidity",
            "notes": "Follow-up consultation completed.",
            "status": "Completed",
            "doctorResponseNote": "Consultation completed and digital e-prescription issued.",
            "meetingRoomId": "MED-ROOM-104",
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        },
    ]

    eprescriptions = [
        {
            "id": "erx-501",
            "appointmentId": "apt-101",
            "patientId": "pat-1",
            "patientName": "Rohan Verma",
            "patientAge": 34,
            "doctorId": "doc-1",
            "doctorName": "Dr. Aarav Mehta",
            "doctorQualification": "MBBS, MD (Internal Medicine)",
            "doctorRegistration": "TSMC-48291",
            "doctorSpecialty": "General & Internal Medicine",
            "date": two_days_ago,
            "diagnosisSummary": "Acute Upper Respiratory Tract Viral Syndrome (Uncomplicated)",
            "symptomsObserved": "Mild pharyngitis, low-grade pyrexia (99.6°F), no lower respiratory crepitations.",
            "medicines": [
                {
                    "name": "Tab. Paracetamol",
                    "dosage": "650 mg",
                    "frequency": "Twice daily (after food)",
                    "duration": "3 Days",
                    "instructions": "Take with water after meals if temperature exceeds 99.5°F.",
                },
                {
                    "name": "Tab. Levocetirizine",
                    "dosage": "5 mg",
                    "frequency": "Once daily at bedtime",
                    "duration": "5 Days",
                    "instructions": "May cause mild drowsiness; take before sleep.",
                },
                {
                    "name": "Cap. Pantoprazole",
                    "dosage": "40 mg",
                    "frequency": "Once daily morning (empty stomach)",
                    "duration": "5 Days",
                    "instructions": "Take 30 minutes before breakfast.",
                },
            ],
            "advice": "Warm saline gargles 3 times daily. Drink 2.5L of warm water/fluids per day. Avoid chilled beverages.",
            "followUpDate": in_two_days,
        },
        {
            "id": "erx-502",
            "appointmentId": "apt-104",
            "patientId": "pat-3",
            "patientName": "Arjun Rao",
            "patientAge": 45,
            "doctorId": "doc-1",
            "doctorName": "Dr. Aarav Mehta",
            "doctorQualification": "MBBS, MD (Internal Medicine)",
            "doctorRegistration": "TSMC-48291",
            "doctorSpecialty": "General & Internal Medicine",
            "date": five_days_ago,
            "diagnosisSummary": "Mild Gastroesophageal Reflux & Post-Viral Asthenia",
            "symptomsObserved": "Epigastric discomfort after late meals, mild generalized fatigue.",
            "medicines": [
                {
                    "name": "Cap. Rabeprazole",
                    "dosage": "20 mg",
                    "frequency": "Once daily before breakfast",
                    "duration": "14 Days",
                    "instructions": "Swallow whole 30 mins prior to morning meal.",
                }
            ],
            "advice": "Avoid lying down within 2 hours after dinner. Limit spicy and fried foods.",
            "followUpDate": in_seven_days,
        },
    ]

    chat_sessions = [
        {
            "id": "chat-201",
            "patientId": "pat-1",
            "title": "Low-Grade Fever & Sore Throat Inquiry",
            "updatedAt": "2026-10-30T09:45:00Z",
            "messages": [
                {
                    "id": "msg-1",
                    "role": "user",
                    "text": "I have had a mild fever and sore throat for the past 2 days. What could be causing this?",
                    "timestamp": "2026-10-30T09:44:10Z",
                    "language": "English",
                },
                {
                    "id": "msg-2",
                    "role": "model",
                    "text": (
                        "I understand how uncomfortable a persistent fever and sore throat can feel. "
                        "Based on what you have shared, this may be related to a few common possibilities:\n\n"
                        "**Common Possible Causes:**\n"
                        "- **Viral Upper Respiratory Tract Infection (Common Cold or Seasonal Flu):** "
                        "Viruses affecting the nose and throat are the most frequent trigger for mild fever accompanied by throat irritation.\n"
                        "- **Viral or Bacterial Pharyngitis:** Inflammation of the back of the throat (pharynx) triggered by airborne droplets or environmental irritants.\n"
                        "- **Allergic Rhinitis with Post-Nasal Drip:** Allergens such as dust or pollen can cause mucus to trickle down the back of the throat, leading to soreness and mild systemic fatigue.\n\n"
                        "**Plain-Language Explanation:**\n"
                        "A fever is your immune system's natural defense response as it works to clear an infection or inflammation, "
                        "while a sore throat happens when the delicate lining of your throat becomes swollen and irritated. "
                        "Because many mild viral and bacterial conditions look similar early on, a clinical examination helps determine the exact cause."
                    ),
                    "timestamp": "2026-10-30T09:44:25Z",
                    "language": "English",
                    "isEmergency": False,
                    "detectedSymptoms": "Mild fever and sore throat for 2 days",
                },
            ],
        }
    ]

    symptom_checks = [
        {
            "id": "sym-301",
            "patientId": "pat-1",
            "createdAt": "2026-10-29T18:10:00Z",
            "selectedSymptoms": ["Fever", "Sore Throat", "Fatigue"],
            "duration": "1 to 3 days",
            "severity": "Moderate",
            "additionalNotes": "Slightly worse in the evening, no shortness of breath.",
            "urgencyLevel": "Soon Consultation",
            "possibleCauses": [
                "Viral Pharyngitis / Upper Respiratory Infection",
                "Seasonal Influenza",
                "Infectious Mononucleosis or Tonsillar Irritation",
            ],
            "explanation": "This combination of fever, sore throat, and fatigue may be related to an acute upper respiratory infection where the body mounts an immune response against a viral or bacterial pathogen.",
            "recommendedSpecialty": "General & Internal Medicine",
        }
    ]

    notifications = [
        {
            "id": "notif-1",
            "userId": "pat-1",
            "title": "Appointment Confirmed — Reminder",
            "message": f"Your consultation with Dr. Aarav Mehta today ({today}) at 05:00 PM is confirmed. Email confirmation sent to rohan@patient.in.",
            "type": "appointment_confirmed",
            "relatedAppointmentId": "apt-101",
            "emailSentSimulated": True,
            "read": False,
            "createdAt": now_iso(),
        },
        {
            "id": "notif-2",
            "userId": "pat-1",
            "title": "Digital E-Prescription Available",
            "message": "Dr. Aarav Mehta issued an e-prescription (ERX-501). You can view and download it as a PDF.",
            "type": "new_eprescription",
            "relatedAppointmentId": "apt-101",
            "emailSentSimulated": True,
            "read": False,
            "createdAt": now_iso(),
        },
        {
            "id": "notif-3",
            "userId": "doc-1",
            "title": "Upcoming Video Consultation Reminder",
            "message": f"Confirmed appointment with patient Rohan Verma today ({today}) at 05:00 PM (Room: MED-ROOM-101).",
            "type": "reminder",
            "relatedAppointmentId": "apt-101",
            "emailSentSimulated": True,
            "read": False,
            "createdAt": now_iso(),
        },
        {
            "id": "notif-4",
            "userId": "adm-1",
            "title": "Doctor Account Pending Approval",
            "message": "Dr. Vikram Joshi (Orthopedics, Reg: MMC-77412) has registered and awaits credential approval.",
            "type": "doctor_approved",
            "emailSentSimulated": False,
            "read": False,
            "createdAt": now_iso(),
        },
    ]

    return {
        "users": users,
        "chatSessions": chat_sessions,
        "prescriptionAnalyses": _build_seed_prescription_analyses(today, two_days_ago),
        "appointments": appointments,
        "eprescriptions": eprescriptions,
        "symptomChecks": symptom_checks,
        "notifications": notifications,
    }


def _refresh_stale_seed_dates(db: dict[str, Any]) -> bool:
    """Keep default seeded demo consultations current if db.json retains legacy 2026-11-02 dates."""
    changed = False
    today = today_str(0)
    in_two_days = today_str(2)
    two_days_ago = today_str(-2)
    if not db.get("prescriptionAnalyses"):
        db["prescriptionAnalyses"] = _build_seed_prescription_analyses(today, two_days_ago)
        changed = True
    for user in db.get("users", []):
        if user.get("id") in SEEDED_PREVIEW_IDS and "credentialClaimed" not in user:
            user["seededPreviewAccount"] = True
            user["credentialClaimed"] = False
            user["passwordHash"] = ""
            user["passwordSalt"] = ""
            changed = True
    for apt in db.get("appointments", []):
        if apt.get("id") == "apt-101" and apt.get("date") != today:
            apt["date"] = today
            apt["timeSlot"] = "05:00 PM"
            changed = True
        elif apt.get("id") == "apt-102" and str(apt.get("date", "")).startswith("2026-11-"):
            apt["date"] = in_two_days
            changed = True
        elif apt.get("id") == "apt-103" and str(apt.get("date", "")).startswith("2026-11-"):
            apt["date"] = today
            changed = True
    for notif in db.get("notifications", []):
        if notif.get("id") in ("notif-1", "notif-3") and "2026-11-" in str(notif.get("message", "")):
            if notif["id"] == "notif-1":
                notif["message"] = (
                    f"Your consultation with Dr. Aarav Mehta today ({today}) at 05:00 PM is confirmed. "
                    "Email confirmation sent to rohan@patient.in."
                )
            else:
                notif["message"] = (
                    f"Confirmed appointment with patient Rohan Verma today ({today}) at 05:00 PM "
                    "(Room: MED-ROOM-101)."
                )
            changed = True
    return changed


def load_db() -> dict[str, Any]:
    with DB_LOCK:
        data_dir = get_data_dir()
        db_file = get_db_file()
        data_dir.mkdir(parents=True, exist_ok=True)
        if not db_file.exists():
            initial = create_seed_database()
            save_db(initial)
            return initial
        try:
            loaded = json.loads(db_file.read_text(encoding="utf-8"))
            if _refresh_stale_seed_dates(loaded):
                save_db(loaded)
            return loaded
        except Exception:
            initial = create_seed_database()
            save_db(initial)
            return initial


def save_db(db: dict[str, Any]) -> None:
    with DB_LOCK:
        data_dir = get_data_dir()
        db_file = get_db_file()
        data_dir.mkdir(parents=True, exist_ok=True)
        tmp_file = data_dir / f".db.{threading.get_ident()}.tmp"
        tmp_file.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp_file, db_file)


# ============================================================================
# 5. GEMINI REST API CLIENT (PYTHON STDLIB urllib.request)
# ============================================================================


class GeminiApiError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


def get_gemini_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise GeminiApiError("GEMINI_API_KEY environment variable is missing.", status_code=500)
    return key


def is_rate_limit_error(err: Exception | str) -> bool:
    if isinstance(err, GeminiApiError) and err.status_code == 429:
        return True
    msg = str(err).lower()
    return any(
        token in msg
        for token in ("429", "resource_exhausted", "rate limit", "quota", "too many requests")
    )


def _extract_text_from_candidate_payload(payload: dict[str, Any]) -> str:
    chunks: list[str] = []
    for candidate in payload.get("candidates") or []:
        content = candidate.get("content") or {}
        for part in content.get("parts") or []:
            if part.get("thought"):
                continue
            text = part.get("text")
            if text:
                chunks.append(str(text))
    return "".join(chunks)


def gemini_generate_content(
    model: str,
    contents: list[dict[str, Any]],
    system_instruction: str,
    thinking_level: str | None = None,
    response_mime_type: str | None = None,
    response_schema: dict[str, Any] | None = None,
) -> str:
    api_key = get_gemini_api_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(model)}:generateContent"

    generation_config: dict[str, Any] = {}
    if thinking_level:
        generation_config["thinkingConfig"] = {"thinkingLevel": thinking_level}
    if response_mime_type:
        generation_config["responseMimeType"] = response_mime_type
    if response_schema:
        generation_config["responseSchema"] = response_schema

    body: dict[str, Any] = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system_instruction}]},
    }
    if generation_config:
        body["generationConfig"] = generation_config

    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
            "User-Agent": "aistudio-build",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw)
            return _extract_text_from_candidate_payload(parsed)
    except urllib.error.HTTPError as http_err:
        err_body = http_err.read().decode("utf-8", errors="replace")
        raise GeminiApiError(err_body or str(http_err), status_code=http_err.code) from http_err
    except urllib.error.URLError as url_err:
        raise GeminiApiError(f"Network error contacting Gemini API: {url_err.reason}", status_code=502) from url_err


def gemini_stream_content(
    model: str,
    contents: list[dict[str, Any]],
    system_instruction: str,
    thinking_level: str | None = None,
) -> Generator[str, None, None]:
    api_key = get_gemini_api_key()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(model)}:streamGenerateContent?alt=sse"
    )

    body: dict[str, Any] = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system_instruction}]},
    }
    if thinking_level:
        body["generationConfig"] = {"thinkingConfig": {"thinkingLevel": thinking_level}}

    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "x-goog-api-key": api_key,
            "User-Agent": "aistudio-build",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            while True:
                raw_line = resp.readline()
                if not raw_line:
                    break
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line or not line.startswith("data:"):
                    continue
                json_part = line[5:].strip()
                if not json_part or json_part == "[DONE]":
                    continue
                try:
                    payload = json.loads(json_part)
                except json.JSONDecodeError:
                    continue
                text_chunk = _extract_text_from_candidate_payload(payload)
                if text_chunk:
                    yield text_chunk
    except urllib.error.HTTPError as http_err:
        err_body = http_err.read().decode("utf-8", errors="replace")
        raise GeminiApiError(err_body or str(http_err), status_code=http_err.code) from http_err
    except urllib.error.URLError as url_err:
        raise GeminiApiError(f"Network error contacting Gemini API: {url_err.reason}", status_code=502) from url_err


# ============================================================================
# 6. CHAT CACHE, COOLDOWN, AND HELPERS
# ============================================================================

RUNTIME_LOCK = threading.Lock()
CHAT_ANSWER_CACHE: dict[str, str] = {}
LAST_MESSAGE_TIME_BY_USER: dict[str, float] = {}
COOLDOWN_SECONDS = 2.0


def normalize_question_key(language: str, text: str) -> str:
    collapsed = re.sub(r"\s+", " ", text).strip().lower()
    return f"{language.lower()}::{collapsed}"


def save_chat_turn_to_db(
    patient_id: str | None,
    session_id: str | None,
    user_text: str,
    ai_text: str,
    language: str,
    is_emergency_input: bool,
) -> dict[str, Any] | None:
    with DB_LOCK:
        db = load_db()
        now = now_iso()
        ts = epoch_ms()
        user_msg = {
            "id": f"msg-{ts}-u",
            "role": "user",
            "text": user_text,
            "timestamp": now,
            "language": language,
        }
        model_msg = {
            "id": f"msg-{ts}-m",
            "role": "model",
            "text": ai_text,
            "timestamp": now_iso(offset_ms=200),
            "language": language,
            "isEmergency": is_emergency_input,
            "detectedSymptoms": user_text[:140],
        }

        session = next(
            (
                s
                for s in db["chatSessions"]
                if s.get("id") == session_id and s.get("patientId") == patient_id
            ),
            None,
        )
        if session is None and patient_id:
            title = user_text[:48] + ("..." if len(user_text) > 48 else "")
            session = {
                "id": session_id or f"chat-{ts}",
                "patientId": patient_id,
                "title": title,
                "updatedAt": now,
                "messages": [user_msg, model_msg],
            }
            db["chatSessions"].insert(0, session)
        elif session is not None:
            session["messages"].extend([user_msg, model_msg])
            session["updatedAt"] = now

        save_db(db)
        return session


def normalize_confidence(value: str | None) -> str:
    val = str(value or "").lower()
    if "high" in val:
        return "High"
    if "med" in val:
        return "Medium"
    return "Low"


# ============================================================================
# 7. HTTP REQUEST HANDLER (ALL /api/* ENDPOINTS)
# ============================================================================


class HealthcareAPIHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # Allow dependency injection in tests
    generate_content_fn: Callable[..., str] = staticmethod(gemini_generate_content)
    stream_content_fn: Callable[..., Generator[str, None, None]] = staticmethod(gemini_stream_content)

    def log_message(self, format: str, *args: Any) -> None:
        if os.environ.get("PYTHON_BACKEND_QUIET") == "1":
            return
        sys.stderr.write(f"[Python Backend] {self.address_string()} - {format % args}\n")

    def _read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        if length > 8 * 1024 * 1024:
            raise ValueError("Payload too large")
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def _send_json(self, status: int, payload: Any) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("X-Powered-By", "Python-Backend")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def _start_sse(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "close")
        self.send_header("X-Powered-By", "Python-Backend")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.close_connection = True

    def _send_sse_event(self, payload: dict[str, Any]) -> None:
        frame = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")
        self.wfile.write(frame)
        self.wfile.flush()

    def _is_csrf_valid(self) -> bool:
        auth_header = self.headers.get("Authorization") or ""
        if auth_header.lower().startswith("bearer "):
            return True

        expected_host = (
            (self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "")
            .split(",")[0]
            .strip()
            .lower()
        )
        origin_header = (self.headers.get("Origin") or "").strip()
        if origin_header:
            origin_host = urllib.parse.urlparse(origin_header).netloc.lower()
            if expected_host and origin_host != expected_host:
                return False

        cookie_header = self.headers.get("Cookie") or ""
        if f"{SESSION_COOKIE_NAME}=" not in cookie_header:
            return True

        xrw = (self.headers.get("X-Requested-With") or "").strip()
        if xrw:
            return True

        if origin_header and expected_host:
            return urllib.parse.urlparse(origin_header).netloc.lower() == expected_host
        return False

    def _require_auth(self) -> tuple[dict[str, Any], dict[str, Any]] | None:
        token = self._extract_session_token()
        verified_user_id = verify_session_token(token)
        if not verified_user_id:
            self._send_json(401, {"error": "Authentication required. Please sign in."})
            return None
        db = load_db()
        user = next((u for u in db["users"] if u.get("id") == verified_user_id), None)
        if not user:
            self._send_json_with_cookie(
                401,
                {"error": "Session is no longer valid. Please sign in again."},
                self._build_session_cookie_header(None),
            )
            return None
        return db, user

    # ------------------------------------------------------------------------
    # ROUTING
    # ------------------------------------------------------------------------

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/health":
            self._handle_health()
            return
        if path == "/api/auth/setup-status":
            self._handle_setup_status()
            return
        if path == "/api/auth/session":
            self._handle_auth_session()
            return
        if path == "/api/state":
            query = urllib.parse.parse_qs(parsed.query)
            user_id = (query.get("userId") or [""])[0]
            self._handle_get_state(user_id)
            return
        self._send_json(404, {"error": f"Route not found: GET {path}"})

    def do_POST(self) -> None:
        if not self._is_csrf_valid():
            self._send_json(403, {"error": "Cross-site request rejected."})
            return
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/auth/logout":
            self._handle_logout()
            return
        try:
            body = self._read_json_body()
        except ValueError as err:
            self._send_json(413, {"error": str(err)})
            return
        except Exception:
            self._send_json(400, {"error": "Invalid JSON request body."})
            return

        if path == "/api/auth/login":
            self._handle_login(body)
        elif path == "/api/auth/claim-account":
            self._handle_claim_account(body)
        elif path == "/api/auth/signup":
            self._handle_signup(body)
        elif path == "/api/ai/chat":
            self._handle_ai_chat(body)
        elif path == "/api/ai/prescription-analyze":
            self._handle_prescription_analyze(body)
        elif path == "/api/ai/symptom-check":
            self._handle_symptom_check(body)
        elif path == "/api/appointments":
            self._handle_create_appointment(body)
        elif path == "/api/eprescriptions":
            self._handle_create_eprescription(body)
        else:
            self._send_json(404, {"error": f"Route not found: POST {path}"})

    def do_PATCH(self) -> None:
        if not self._is_csrf_valid():
            self._send_json(403, {"error": "Cross-site request rejected."})
            return
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            body = self._read_json_body()
        except Exception:
            self._send_json(400, {"error": "Invalid JSON request body."})
            return

        if path == "/api/notifications/read-all":
            self._handle_notifications_read_all(body)
            return

        apt_match = re.fullmatch(r"/api/appointments/([^/]+)", path)
        if apt_match:
            self._handle_update_appointment(urllib.parse.unquote(apt_match.group(1)), body)
            return

        doc_match = re.fullmatch(r"/api/admin/doctors/([^/]+)/approval", path)
        if doc_match:
            self._handle_admin_doctor_approval(urllib.parse.unquote(doc_match.group(1)), body)
            return

        self._send_json(404, {"error": f"Route not found: PATCH {path}"})

    def do_DELETE(self) -> None:
        if not self._is_csrf_valid():
            self._send_json(403, {"error": "Cross-site request rejected."})
            return
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        user_match = re.fullmatch(r"/api/admin/users/([^/]+)", path)
        if user_match:
            self._handle_admin_delete_user(urllib.parse.unquote(user_match.group(1)))
            return
        self._send_json(404, {"error": f"Route not found: DELETE {path}"})

    # ------------------------------------------------------------------------
    # HANDLERS
    # ------------------------------------------------------------------------

    def _handle_health(self) -> None:
        self._send_json(
            200,
            {
                "status": "ok",
                "backend": "python",
                "geminiConfigured": bool(os.environ.get("GEMINI_API_KEY", "").strip()),
            },
        )

    def _handle_setup_status(self) -> None:
        db = load_db()
        unclaimed_emails: list[str] = []
        for u in db["users"]:
            if u.get("id") not in SEEDED_PREVIEW_IDS:
                continue
            if get_env_password_for_seeded_role(str(u.get("role") or "")):
                continue
            if not u.get("credentialClaimed") or not u.get("passwordHash"):
                unclaimed_emails.append(str(u.get("email") or ""))
        self._send_json(
            200,
            {
                "adminRequiresSetup": "admin@medassist.in" in unclaimed_emails,
                "unclaimedPreviewEmails": unclaimed_emails,
            },
        )

    def _handle_claim_account(self, body: dict[str, Any]) -> None:
        email = str(body.get("email") or "").strip().lower()
        password = str(body.get("password") or "")
        if not email or len(password) < 8:
            self._send_json(
                400,
                {
                    "error": "Valid account email and a password of at least 8 characters are required."
                },
            )
            return

        with DB_LOCK:
            db = load_db()
            user = next(
                (u for u in db["users"] if str(u.get("email", "")).strip().lower() == email),
                None,
            )
            if not user or user.get("id") not in SEEDED_PREVIEW_IDS:
                self._send_json(404, {"error": "Preview account not found."})
                return

            env_pass = get_env_password_for_seeded_role(str(user.get("role") or ""))
            if env_pass or (user.get("credentialClaimed") and user.get("passwordHash")):
                self._send_json(
                    409,
                    {
                        "error": "This account password has already been configured. Please sign in normally."
                    },
                )
                return

            pw_hash, pw_salt = hash_password(password)
            user["passwordHash"] = pw_hash
            user["passwordSalt"] = pw_salt
            user["credentialClaimed"] = True
            user["seededPreviewAccount"] = True
            save_db(db)

            session_token = create_session_token(user["id"])
            self._send_json_with_cookie(
                200,
                {"user": sanitize_user(user), "sessionToken": session_token},
                self._build_session_cookie_header(session_token),
            )

    def _handle_login(self, body: dict[str, Any]) -> None:
        email = str(body.get("email") or "").strip().lower()
        password = str(body.get("password") or "")
        if not email or not password:
            self._send_json(400, {"error": "Email and password are required."})
            return

        db = load_db()
        user = next(
            (u for u in db["users"] if str(u.get("email", "")).strip().lower() == email),
            None,
        )
        if not user:
            self._send_json(
                401,
                {"error": "Invalid email or password. Please check your credentials."},
            )
            return

        authenticated = False
        if user.get("id") in SEEDED_PREVIEW_IDS:
            env_pass = get_env_password_for_seeded_role(str(user.get("role") or ""))
            if env_pass:
                authenticated = hmac.compare_digest(
                    password.encode("utf-8"), env_pass.encode("utf-8")
                )
            elif not user.get("credentialClaimed") or not user.get("passwordHash"):
                self._send_json(
                    403,
                    {
                        "error": "This account needs a one-time first-run password setup before signing in.",
                        "requiresSetup": True,
                        "email": user.get("email"),
                        "role": user.get("role"),
                    },
                )
                return
            else:
                authenticated = verify_password(
                    password, str(user.get("passwordHash") or ""), str(user.get("passwordSalt") or "")
                )
        else:
            authenticated = verify_password(
                password, str(user.get("passwordHash") or ""), str(user.get("passwordSalt") or "")
            )

        if not authenticated:
            self._send_json(
                401,
                {"error": "Invalid email or password. Please check your credentials."},
            )
            return

        session_token = create_session_token(user["id"])
        self._send_json_with_cookie(
            200,
            {"user": sanitize_user(user), "sessionToken": session_token},
            self._build_session_cookie_header(session_token),
        )

    def _extract_session_token(self) -> str | None:
        auth_header = self.headers.get("Authorization") or ""
        if auth_header.lower().startswith("bearer "):
            bearer = auth_header[7:].strip()
            if bearer:
                return bearer
        cookie_header = self.headers.get("Cookie") or ""
        for pair in cookie_header.split(";"):
            if "=" not in pair:
                continue
            key, val = pair.split("=", 1)
            if key.strip() == SESSION_COOKIE_NAME:
                return urllib.parse.unquote(val.strip())
        return None

    def _build_session_cookie_header(self, token: str | None) -> str:
        if not token:
            return f"{SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0"
        max_age = SESSION_TTL_MS // 1000
        return f"{SESSION_COOKIE_NAME}={urllib.parse.quote(token, safe='')}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age={max_age}"

    def _send_json_with_cookie(self, status: int, payload: dict[str, Any], cookie_header: str) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("X-Powered-By", "Python-Backend")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Set-Cookie", cookie_header)
        self.end_headers()
        self.wfile.write(raw)

    def _handle_auth_session(self) -> None:
        token = self._extract_session_token()
        verified_user_id = verify_session_token(token)
        if not verified_user_id:
            self._send_json(200, {"authenticated": False, "user": None})
            return
        db = load_db()
        user = next((u for u in db["users"] if u.get("id") == verified_user_id), None)
        if not user:
            self._send_json_with_cookie(
                200,
                {"authenticated": False, "user": None},
                self._build_session_cookie_header(None),
            )
            return
        self._send_json(200, {"authenticated": True, "user": sanitize_user(user)})

    def _handle_logout(self) -> None:
        self._send_json_with_cookie(
            200,
            {"ok": True},
            self._build_session_cookie_header(None),
        )

    def _handle_signup(self, body: dict[str, Any]) -> None:
        name = body.get("name")
        email = body.get("email")
        password = body.get("password")
        role = body.get("role")
        phone = body.get("phone")

        if not name or not email or not password or not role:
            self._send_json(400, {"error": "Name, email, password, and role are required."})
            return
        if len(str(password)) < 8:
            self._send_json(400, {"error": "Password must be at least 8 characters long."})
            return

        normalized_email = str(email).strip().lower()
        normalized_role = "doctor" if role == "doctor" else "patient"

        with DB_LOCK:
            db = load_db()
            if any(str(u.get("email", "")).strip().lower() == normalized_email for u in db["users"]):
                self._send_json(409, {"error": "An account with this email already exists."})
                return

            pw_hash, pw_salt = hash_password(str(password))
            ts = epoch_ms()
            new_user: dict[str, Any] = {
                "id": f"{normalized_role[:3]}-{ts}",
                "name": str(name).strip()[:120],
                "email": normalized_email,
                "passwordHash": pw_hash,
                "passwordSalt": pw_salt,
                "role": normalized_role,
                "phone": str(phone or "+91 90000 00000")[:30],
                "createdAt": now_iso(),
                "seededPreviewAccount": False,
                "credentialClaimed": True,
            }

            if normalized_role == "patient":
                try:
                    age_val = int(body.get("age") or 30)
                except (TypeError, ValueError):
                    age_val = 30
                new_user.update(
                    {
                        "age": age_val,
                        "gender": str(body.get("gender") or "Not Specified")[:30],
                        "bloodGroup": str(body.get("bloodGroup") or "O+")[:10],
                        "allergies": [],
                    }
                )
            else:
                specialty = str(body.get("specialty") or "General Medicine")[:120]
                try:
                    exp_years = int(body.get("experienceYears") or 5)
                except (TypeError, ValueError):
                    exp_years = 5
                try:
                    fee_val = int(body.get("consultationFee") or 500)
                except (TypeError, ValueError):
                    fee_val = 500
                new_user.update(
                    {
                        "specialty": specialty,
                        "qualification": str(body.get("qualification") or "MBBS, MD")[:120],
                        "registrationNumber": str(
                            body.get("registrationNumber")
                            or f"REG-{random.randint(10000, 99999)}"
                        )[:60],
                        "experienceYears": exp_years,
                        "consultationFee": fee_val,
                        "approved": False,
                        "availableSlots": [
                            "09:00 AM",
                            "10:00 AM",
                            "11:00 AM",
                            "02:00 PM",
                            "04:00 PM",
                            "05:30 PM",
                        ],
                        "bio": f"Board-certified specialist in {specialty}.",
                    }
                )

            db["users"].append(new_user)

            if new_user["role"] == "doctor":
                admins = [u for u in db["users"] if u.get("role") == "admin"]
                for adm in admins:
                    db["notifications"].insert(
                        0,
                        {
                            "id": f"notif-{epoch_ms()}-{secrets.token_hex(2)}",
                            "userId": adm["id"],
                            "title": "New Doctor Awaiting Approval",
                            "message": f"{new_user['name']} ({new_user['specialty']}, Reg: {new_user['registrationNumber']}) signed up and requires admin approval before going live.",
                            "type": "doctor_approved",
                            "emailSentSimulated": True,
                            "read": False,
                            "createdAt": now_iso(),
                        },
                    )

            save_db(db)
            session_token = create_session_token(new_user["id"])
            self._send_json_with_cookie(
                201,
                {"user": sanitize_user(new_user), "sessionToken": session_token},
                self._build_session_cookie_header(session_token),
            )

    def _handle_get_state(self, user_id: str) -> None:
        with DB_LOCK:
            auth = self._require_auth()
            if not auth:
                return
            db, current_user = auth

            requested_user_id = str(user_id or "").strip()
            if requested_user_id and requested_user_id != current_user["id"]:
                self._send_json(403, {"error": "Access denied for requested user profile."})
                return

            doctors = [
                sanitize_user(u)
                for u in db["users"]
                if u.get("role") == "doctor"
                and (
                    current_user.get("role") == "admin"
                    or u.get("approved")
                    or u.get("id") == current_user.get("id")
                )
            ]

            role = current_user.get("role")
            if role == "patient":
                my_appointments = [
                    a for a in db["appointments"] if a.get("patientId") == current_user["id"]
                ]
                my_eprescriptions = [
                    e for e in db["eprescriptions"] if e.get("patientId") == current_user["id"]
                ]
                db_modified = False

                if not my_appointments:
                    default_doc = next(
                        (u for u in db["users"] if u.get("role") == "doctor" and u.get("approved")),
                        None,
                    ) or next((u for u in db["users"] if u.get("role") == "doctor"), None)
                    seeded_apt = {
                        "id": f"apt-{epoch_ms()}",
                        "patientId": current_user["id"],
                        "patientName": current_user["name"],
                        "patientEmail": current_user["email"],
                        "doctorId": (default_doc or {}).get("id", "doc-1"),
                        "doctorName": (default_doc or {}).get("name", "Dr. Aarav Mehta"),
                        "doctorSpecialty": (default_doc or {}).get(
                            "specialty", "General & Internal Medicine"
                        ),
                        "date": today_str(),
                        "timeSlot": "10:00 AM",
                        "symptoms": "General health checkup, mild seasonal fatigue & throat irritation",
                        "status": "Confirmed",
                        "doctorResponseNote": "Confirmed for live HD telemedicine video consultation.",
                        "meetingRoomId": f"MED-ROOM-{random.randint(100, 999)}",
                        "createdAt": now_iso(),
                        "updatedAt": now_iso(),
                    }
                    db["appointments"].insert(0, seeded_apt)
                    my_appointments = [seeded_apt]
                    db_modified = True

                if not my_eprescriptions:
                    default_doc = next(
                        (u for u in db["users"] if u.get("role") == "doctor" and u.get("approved")),
                        None,
                    ) or next((u for u in db["users"] if u.get("role") == "doctor"), None)
                    seeded_rx = {
                        "id": f"erx-{epoch_ms()}",
                        "appointmentId": my_appointments[0]["id"]
                        if my_appointments
                        else "DIRECT-CONSULT",
                        "patientId": current_user["id"],
                        "patientName": current_user["name"],
                        "patientAge": current_user.get("age") or 30,
                        "doctorId": (default_doc or {}).get("id", "doc-1"),
                        "doctorName": (default_doc or {}).get("name", "Dr. Aarav Mehta"),
                        "doctorQualification": (default_doc or {}).get(
                            "qualification", "MBBS, MD (Internal Medicine)"
                        ),
                        "doctorRegistration": (default_doc or {}).get(
                            "registrationNumber", "TSMC-48291"
                        ),
                        "doctorSpecialty": (default_doc or {}).get(
                            "specialty", "General & Internal Medicine"
                        ),
                        "date": today_str(),
                        "diagnosisSummary": "Acute Upper Respiratory Tract Viral Syndrome (Uncomplicated)",
                        "symptomsObserved": "Mild pharyngitis, low-grade pyrexia, seasonal fatigue.",
                        "medicines": [
                            {
                                "name": "Tab. Paracetamol",
                                "dosage": "650 mg",
                                "frequency": "Twice daily (after food)",
                                "duration": "3 Days",
                                "instructions": "Take with water after meals if temperature exceeds 99.5°F.",
                            },
                            {
                                "name": "Tab. Levocetirizine",
                                "dosage": "5 mg",
                                "frequency": "Once daily at bedtime",
                                "duration": "5 Days",
                                "instructions": "Take before sleep for throat & nasal relief.",
                            },
                            {
                                "name": "Cap. Pantoprazole",
                                "dosage": "40 mg",
                                "frequency": "Once daily morning (empty stomach)",
                                "duration": "5 Days",
                                "instructions": "Take 30 minutes before breakfast.",
                            },
                        ],
                        "advice": "Warm saline gargles 3 times daily. Drink 2.5L of warm water/fluids per day. Avoid chilled beverages.",
                        "followUpDate": today_str(offset_days=7),
                    }
                    db["eprescriptions"].insert(0, seeded_rx)
                    my_eprescriptions = [seeded_rx]
                    db_modified = True

                if db_modified:
                    save_db(db)

                self._send_json(
                    200,
                    {
                        "currentUser": sanitize_user(current_user),
                        "doctors": [d for d in doctors if d.get("approved")],
                        "appointments": my_appointments,
                        "eprescriptions": my_eprescriptions,
                        "prescriptionAnalyses": [
                            p
                            for p in db["prescriptionAnalyses"]
                            if p.get("patientId") == current_user["id"]
                        ],
                        "chatSessions": [
                            c for c in db["chatSessions"] if c.get("patientId") == current_user["id"]
                        ],
                        "symptomChecks": [
                            s
                            for s in db["symptomChecks"]
                            if s.get("patientId") == current_user["id"]
                        ],
                        "notifications": [
                            n
                            for n in db["notifications"]
                            if n.get("userId") == current_user["id"]
                        ],
                    },
                )
                return

            if role == "doctor":
                if not current_user.get("approved"):
                    self._send_json(
                        200,
                        {
                            "currentUser": sanitize_user(current_user),
                            "doctors": [sanitize_user(current_user)],
                            "appointments": [],
                            "eprescriptions": [],
                            "prescriptionAnalyses": [],
                            "chatSessions": [],
                            "symptomChecks": [],
                            "notifications": [
                                n
                                for n in db["notifications"]
                                if n.get("userId") == current_user["id"]
                            ],
                            "patients": [],
                        },
                    )
                    return

                my_appointments = [
                    a for a in db["appointments"] if a.get("doctorId") == current_user["id"]
                ]
                my_patient_ids = {a.get("patientId") for a in my_appointments}
                self._send_json(
                    200,
                    {
                        "currentUser": sanitize_user(current_user),
                        "doctors": doctors,
                        "appointments": my_appointments,
                        "eprescriptions": [
                            e
                            for e in db["eprescriptions"]
                            if e.get("doctorId") == current_user["id"]
                        ],
                        "prescriptionAnalyses": [
                            p
                            for p in db["prescriptionAnalyses"]
                            if p.get("patientId") in my_patient_ids
                        ],
                        "chatSessions": [],
                        "symptomChecks": [
                            s for s in db["symptomChecks"] if s.get("patientId") in my_patient_ids
                        ],
                        "notifications": [
                            n
                            for n in db["notifications"]
                            if n.get("userId") == current_user["id"]
                        ],
                        "patients": [
                            sanitize_user(u)
                            for u in db["users"]
                            if u.get("role") == "patient" and u.get("id") in my_patient_ids
                        ],
                    },
                )
                return

            # Admin role
            self._send_json(
                200,
                {
                    "currentUser": sanitize_user(current_user),
                    "users": [sanitize_user(u) for u in db["users"]],
                    "doctors": doctors,
                    "appointments": db["appointments"],
                    "eprescriptions": db["eprescriptions"],
                    "prescriptionAnalyses": db["prescriptionAnalyses"],
                    "chatSessions": db["chatSessions"],
                    "symptomChecks": db["symptomChecks"],
                    "notifications": [
                        n for n in db["notifications"] if n.get("userId") == current_user["id"]
                    ],
                },
            )

    def _handle_ai_chat(self, body: dict[str, Any]) -> None:
        auth = self._require_auth()
        if not auth:
            return
        _, auth_user = auth

        patient_id = auth_user["id"]
        session_id = str(body.get("sessionId") or "")[:80] or None
        message = body.get("message")
        history = body.get("history") or []
        language = str(body.get("language") or "English")[:30]
        stream = bool(body.get("stream", False))
        bypass_cache = bool(body.get("bypassCache", False))

        if not message or not str(message).strip():
            self._send_json(400, {"error": "Please enter a health question."})
            return

        user_key = patient_id
        now_sec = time.monotonic()
        with RUNTIME_LOCK:
            last_sec = LAST_MESSAGE_TIME_BY_USER.get(user_key, 0.0)
            elapsed = now_sec - last_sec
            if last_sec > 0.0 and elapsed < COOLDOWN_SECONDS:
                wait_sec = int(-(-(COOLDOWN_SECONDS - elapsed) // 1)) or 1
                self._send_json(
                    429,
                    {
                        "error": f"Please wait {wait_sec} second(s) before sending another message.",
                        "cooldown": True,
                    },
                )
                return
            LAST_MESSAGE_TIME_BY_USER[user_key] = now_sec

        user_text = str(message).strip()
        is_emergency_input = detect_emergency_symptoms(user_text)
        recent_history = history[-8:] if isinstance(history, list) else []
        cache_key = normalize_question_key(language, user_text)

        with RUNTIME_LOCK:
            cached_reply = CHAT_ANSWER_CACHE.get(cache_key)
        can_use_cache = (
            not bypass_cache
            and not user_text.lower().startswith("tell me more")
            and cached_reply is not None
        )

        contents = [
            {
                "role": "model" if item.get("role") == "model" else "user",
                "parts": [{"text": str(item.get("text") or "")}],
            }
            for item in recent_history
            if isinstance(item, dict)
        ]
        contents.append(
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            f"[User Selected UI Language: {language}. Reply in the same language the user writes in "
                            f"(English, Telugu, or Hindi). Keep the answer under about 150 words unless the user asked \"Tell me more\".]\n\n"
                            f"User Message: {user_text}"
                        )
                    }
                ],
            }
        )

        if stream:
            self._start_sse()
            try:
                if can_use_cache and cached_reply is not None:
                    self._send_sse_event(
                        {
                            "type": "chunk",
                            "text": cached_reply,
                            "cached": True,
                            "isEmergency": is_emergency_input,
                        }
                    )
                    session = save_chat_turn_to_db(
                        patient_id,
                        session_id,
                        user_text,
                        cached_reply,
                        language,
                        is_emergency_input,
                    )
                    self._send_sse_event(
                        {
                            "type": "done",
                            "reply": cached_reply,
                            "cached": True,
                            "isEmergency": is_emergency_input,
                            "detectedSymptoms": user_text[:140],
                            "session": session,
                        }
                    )
                    return

                full_text = ""
                max_attempts = 3
                for attempt in range(1, max_attempts + 1):
                    try:
                        for chunk_text in self.stream_content_fn(
                            model="gemini-3.1-flash-lite",
                            contents=contents,
                            system_instruction=HEALTH_CHAT_SYSTEM_PROMPT,
                            thinking_level="MINIMAL",
                        ):
                            full_text += chunk_text
                            self._send_sse_event(
                                {
                                    "type": "chunk",
                                    "text": chunk_text,
                                    "isEmergency": is_emergency_input,
                                }
                            )
                        break
                    except Exception as err:
                        if is_rate_limit_error(err) and attempt < max_attempts:
                            self._send_sse_event(
                                {
                                    "type": "status",
                                    "message": "Please wait a moment... retrying connection to AI assistant.",
                                }
                            )
                            time.sleep(0.8 * attempt)
                            continue
                        raise

                if not full_text.strip():
                    full_text = (
                        "I am here to help with your health questions. "
                        "Could you please share a few more details about the symptoms you are experiencing?"
                    )
                    self._send_sse_event(
                        {
                            "type": "chunk",
                            "text": full_text,
                            "isEmergency": is_emergency_input,
                        }
                    )

                if not user_text.lower().startswith("tell me more"):
                    with RUNTIME_LOCK:
                        CHAT_ANSWER_CACHE[cache_key] = full_text

                session = save_chat_turn_to_db(
                    patient_id,
                    session_id,
                    user_text,
                    full_text,
                    language,
                    is_emergency_input,
                )
                self._send_sse_event(
                    {
                        "type": "done",
                        "reply": full_text,
                        "cached": False,
                        "isEmergency": is_emergency_input,
                        "detectedSymptoms": user_text[:140],
                        "session": session,
                    }
                )
                return
            except Exception as err:
                friendly_msg = (
                    "Please wait a moment — our AI health assistant is handling high traffic. Please try again in a few seconds."
                    if is_rate_limit_error(err)
                    else "Please wait a moment and try again, or book an appointment directly with a doctor."
                )
                self._send_sse_event({"type": "error", "error": friendly_msg})
                return

        # Non-streaming JSON mode
        try:
            if can_use_cache and cached_reply is not None:
                session = save_chat_turn_to_db(
                    patient_id,
                    session_id,
                    user_text,
                    cached_reply,
                    language,
                    is_emergency_input,
                )
                self._send_json(
                    200,
                    {
                        "reply": cached_reply,
                        "cached": True,
                        "isEmergency": is_emergency_input,
                        "detectedSymptoms": user_text[:140],
                        "session": session,
                    },
                )
                return

            ai_text = ""
            max_attempts = 3
            for attempt in range(1, max_attempts + 1):
                try:
                    ai_text = self.generate_content_fn(
                        model="gemini-3.1-flash-lite",
                        contents=contents,
                        system_instruction=HEALTH_CHAT_SYSTEM_PROMPT,
                        thinking_level="MINIMAL",
                    )
                    break
                except Exception as err:
                    if is_rate_limit_error(err) and attempt < max_attempts:
                        time.sleep(0.8 * attempt)
                        continue
                    raise

            if not ai_text.strip():
                ai_text = "I am here to help with your health questions. How can I assist you today?"

            if not user_text.lower().startswith("tell me more"):
                with RUNTIME_LOCK:
                    CHAT_ANSWER_CACHE[cache_key] = ai_text

            session = save_chat_turn_to_db(
                patient_id,
                session_id,
                user_text,
                ai_text,
                language,
                is_emergency_input,
            )
            self._send_json(
                200,
                {
                    "reply": ai_text,
                    "cached": False,
                    "isEmergency": is_emergency_input,
                    "detectedSymptoms": user_text[:140],
                    "session": session,
                },
            )
        except Exception as err:
            sys.stderr.write(f"[Python Backend] /api/ai/chat error: {err}\n")
            rate_limited = is_rate_limit_error(err)
            friendly_msg = (
                "Please wait a moment — our AI health assistant is experiencing high demand. Try again in a few seconds."
                if rate_limited
                else "Please wait a moment and try again, or book an appointment directly with a doctor."
            )
            self._send_json(429 if rate_limited else 500, {"error": friendly_msg})

    def _handle_prescription_analyze(self, body: dict[str, Any]) -> None:
        auth = self._require_auth()
        if not auth:
            return
        _, auth_user = auth

        try:
            patient_id = auth_user["id"]
            image_data_url = body.get("imageDataUrl")
            file_name = Path(str(body.get("fileName") or "prescription.png")).name[:120]
            language = str(body.get("language") or "English")[:30]

            if (
                not image_data_url
                or not isinstance(image_data_url, str)
                or not image_data_url.startswith("data:image/")
            ):
                self._send_json(
                    400, {"error": "Please upload a valid image file (PNG, JPEG, or WEBP)."}
                )
                return

            match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", image_data_url, re.DOTALL)
            if not match:
                self._send_json(
                    400, {"error": "Invalid image format. Please upload a clear photo or scan."}
                )
                return

            mime_type = match.group(1)
            base64_data = match.group(2)
            allowed_mimes = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
            if mime_type.lower() not in allowed_mimes:
                self._send_json(
                    400, {"error": "Unsupported image type. Allowed formats: JPEG, PNG, WEBP."}
                )
                return

            approx_bytes = -(-(len(base64_data) * 3) // 4)
            if approx_bytes > 5 * 1024 * 1024:
                self._send_json(
                    400,
                    {
                        "error": "Image size exceeds the 5 MB security limit. Please upload a smaller image."
                    },
                )
                return

            # Validate base64 decodability lightly
            try:
                base64.b64decode(base64_data[:128] + "===")
            except Exception:
                pass

            schema = {
                "type": "OBJECT",
                "properties": {
                    "doctorName": {
                        "type": "OBJECT",
                        "properties": {
                            "value": {"type": "STRING"},
                            "confidence": {
                                "type": "STRING",
                                "description": "High, Medium, or Low",
                            },
                        },
                        "required": ["value", "confidence"],
                    },
                    "date": {
                        "type": "OBJECT",
                        "properties": {
                            "value": {"type": "STRING"},
                            "confidence": {
                                "type": "STRING",
                                "description": "High, Medium, or Low",
                            },
                        },
                        "required": ["value", "confidence"],
                    },
                    "patientName": {
                        "type": "OBJECT",
                        "properties": {
                            "value": {"type": "STRING"},
                            "confidence": {
                                "type": "STRING",
                                "description": "High, Medium, or Low",
                            },
                        },
                        "required": ["value", "confidence"],
                    },
                    "medicines": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "name": {"type": "STRING"},
                                "dosage": {"type": "STRING"},
                                "frequency": {"type": "STRING"},
                                "duration": {"type": "STRING"},
                                "generalPurpose": {"type": "STRING"},
                                "notes": {"type": "STRING"},
                                "confidence": {
                                    "type": "STRING",
                                    "description": "High, Medium, or Low",
                                },
                            },
                            "required": [
                                "name",
                                "dosage",
                                "frequency",
                                "duration",
                                "generalPurpose",
                                "notes",
                                "confidence",
                            ],
                        },
                    },
                    "generalNotes": {
                        "type": "OBJECT",
                        "properties": {
                            "value": {"type": "STRING"},
                            "confidence": {
                                "type": "STRING",
                                "description": "High, Medium, or Low",
                            },
                        },
                        "required": ["value", "confidence"],
                    },
                    "suggestedSymptoms": {
                        "type": "STRING",
                        "description": "Brief summary of the likely condition or symptoms for booking a follow-up appointment",
                    },
                },
                "required": [
                    "doctorName",
                    "date",
                    "patientName",
                    "medicines",
                    "generalNotes",
                    "suggestedSymptoms",
                ],
            }

            contents = [
                {
                    "role": "user",
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": base64_data,
                            }
                        },
                        {
                            "text": (
                                f"Extract all details from this prescription image accurately. "
                                f"Provide simple plain-language explanations for what each medicine is generally used for in {language}. "
                                f'Never guess unreadable handwriting—mark unclear words as "unreadable" with "Low" confidence.'
                            )
                        },
                    ],
                }
            ]

            raw_text = self.generate_content_fn(
                model="gemini-3.8-flash",
                contents=contents,
                system_instruction=PRESCRIPTION_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=schema,
            )

            parsed = json.loads((raw_text or "{}").strip())
            meds = parsed.get("medicines")
            analysis_record = {
                "id": f"rx-scan-{epoch_ms()}",
                "patientId": patient_id or "pat-1",
                "createdAt": now_iso(),
                "imageDataUrl": image_data_url,
                "fileName": file_name,
                "language": language,
                "doctorName": {
                    "value": (parsed.get("doctorName") or {}).get("value") or "unreadable",
                    "confidence": normalize_confidence(
                        (parsed.get("doctorName") or {}).get("confidence")
                    ),
                },
                "date": {
                    "value": (parsed.get("date") or {}).get("value") or "unreadable",
                    "confidence": normalize_confidence(
                        (parsed.get("date") or {}).get("confidence")
                    ),
                },
                "patientName": {
                    "value": (parsed.get("patientName") or {}).get("value") or "unreadable",
                    "confidence": normalize_confidence(
                        (parsed.get("patientName") or {}).get("confidence")
                    ),
                },
                "medicines": [
                    {
                        "name": m.get("name") or "unreadable",
                        "dosage": m.get("dosage") or "unreadable",
                        "frequency": m.get("frequency") or "unreadable",
                        "duration": m.get("duration") or "unreadable",
                        "generalPurpose": m.get("generalPurpose")
                        or "Please verify usage with your doctor or pharmacist.",
                        "notes": m.get("notes") or "",
                        "confidence": normalize_confidence(m.get("confidence")),
                    }
                    for m in (meds if isinstance(meds, list) else [])
                ],
                "generalNotes": {
                    "value": (parsed.get("generalNotes") or {}).get("value") or "None specified",
                    "confidence": normalize_confidence(
                        (parsed.get("generalNotes") or {}).get("confidence")
                    ),
                },
                "suggestedSymptoms": parsed.get("suggestedSymptoms")
                or "Follow-up prescription review",
            }

            with DB_LOCK:
                db = load_db()
                db["prescriptionAnalyses"].insert(0, analysis_record)
                save_db(db)

            self._send_json(200, {"analysis": analysis_record})
        except Exception as err:
            sys.stderr.write(f"[Python Backend] /api/ai/prescription-analyze error: {err}\n")
            self._send_json(
                500,
                {
                    "error": "Failed to analyze the prescription image. Please ensure the image is clear and try again."
                },
            )

    def _handle_symptom_check(self, body: dict[str, Any]) -> None:
        auth = self._require_auth()
        if not auth:
            return
        _, auth_user = auth

        try:
            patient_id = auth_user["id"]
            selected_symptoms = body.get("selectedSymptoms") or []
            duration = str(body.get("duration") or "1 to 3 days")[:60]
            severity = str(body.get("severity") or "Moderate")[:40]
            additional_notes = str(body.get("additionalNotes") or "")[:500]
            language = str(body.get("language") or "English")[:30]

            if not isinstance(selected_symptoms, list) or len(selected_symptoms) == 0:
                self._send_json(400, {"error": "Please select at least one symptom."})
                return

            clean_symptoms = [str(s)[:100] for s in selected_symptoms[:20]]
            prompt = (
                "Patient Symptom Checker Submission:\n"
                f"- Selected Symptoms: {', '.join(clean_symptoms)}\n"
                f"- Duration: {duration}\n"
                f"- Reported Severity: {severity}\n"
                f"- Additional Notes: {additional_notes or 'None'}\n"
                f"- Preferred Language: {language}\n\n"
                "Provide an explainable symptom assessment following medical safety rules:\n"
                '1. Never state a definite diagnosis; use phrasing like "this may be related to...".\n'
                "2. Give common possible causes and a plain-language explanation of why these symptoms occur together.\n"
                "3. Provide practical, safe home remedy & self-care tips (homeRemedies).\n"
                "4. Provide educational explanations of commonly used tablets for these symptoms and what each tablet is generally used for (commonTabletsUse), reminding the patient to verify suitability with a doctor.\n"
                '5. If any symptom suggests a medical emergency, set urgencyLevel to "Emergency - Call 108/112".'
            )

            schema = {
                "type": "OBJECT",
                "properties": {
                    "urgencyLevel": {
                        "type": "STRING",
                        "description": 'One of: "Routine Care", "Soon Consultation", "Urgent Medical Attention", "Emergency - Call 108/112"',
                    },
                    "possibleCauses": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                    },
                    "explanation": {
                        "type": "STRING",
                        "description": "Plain-language explanation of the condition and why these symptoms may occur.",
                    },
                    "homeRemedies": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "Safe, practical home remedy and self-care tips for symptom comfort.",
                    },
                    "commonTabletsUse": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "Educational explanation of common tablets and what they are generally used for.",
                    },
                    "recommendedSpecialty": {
                        "type": "STRING",
                        "description": "Medical specialty best suited to evaluate these symptoms",
                    },
                },
                "required": [
                    "urgencyLevel",
                    "possibleCauses",
                    "explanation",
                    "homeRemedies",
                    "commonTabletsUse",
                    "recommendedSpecialty",
                ],
            }

            raw_text = self.generate_content_fn(
                model="gemini-3.8-flash",
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                system_instruction=HEALTH_CHAT_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=schema,
            )

            parsed = json.loads((raw_text or "{}").strip())
            emergency_symptoms = {
                "Chest Pain",
                "Shortness of Breath / Difficulty Breathing",
                "Sudden Weakness / Numbness",
            }
            has_emergency = any(s in emergency_symptoms for s in clean_symptoms)

            record = {
                "id": f"sym-{epoch_ms()}",
                "patientId": patient_id,
                "createdAt": now_iso(),
                "selectedSymptoms": clean_symptoms,
                "duration": duration,
                "severity": severity,
                "additionalNotes": additional_notes,
                "urgencyLevel": (
                    "Emergency - Call 108/112"
                    if has_emergency
                    else parsed.get("urgencyLevel")
                    or (
                        "Urgent Medical Attention"
                        if severity == "Severe"
                        else "Soon Consultation"
                    )
                ),
                "possibleCauses": (
                    parsed.get("possibleCauses")
                    if isinstance(parsed.get("possibleCauses"), list)
                    else ["Requires clinical evaluation"]
                ),
                "explanation": parsed.get("explanation")
                or "These symptoms may be related to an underlying inflammatory or infectious process that warrants evaluation by a qualified doctor.",
                "homeRemedies": (
                    parsed.get("homeRemedies")
                    if isinstance(parsed.get("homeRemedies"), list)
                    else ["Stay well hydrated with warm fluids and get adequate rest."]
                ),
                "commonTabletsUse": (
                    parsed.get("commonTabletsUse")
                    if isinstance(parsed.get("commonTabletsUse"), list)
                    else ["Consult a doctor or pharmacist before taking any over-the-counter tablets."]
                ),
                "recommendedSpecialty": parsed.get("recommendedSpecialty")
                or "General & Internal Medicine",
            }

            with DB_LOCK:
                db = load_db()
                db["symptomChecks"].insert(0, record)
                save_db(db)

            self._send_json(200, {"result": record})
        except Exception as err:
            sys.stderr.write(f"[Python Backend] /api/ai/symptom-check error: {err}\n")
            self._send_json(
                500,
                {"error": "Unable to complete symptom analysis right now. Please try again."},
            )

    def _handle_create_appointment(self, body: dict[str, Any]) -> None:
        with DB_LOCK:
            auth = self._require_auth()
            if not auth:
                return
            db, auth_user = auth

            if auth_user.get("role") not in ("patient", "admin"):
                self._send_json(
                    403, {"error": "Only patients or administrators can book appointments."}
                )
                return

            patient_id = (
                auth_user["id"]
                if auth_user.get("role") == "patient"
                else str(body.get("patientId") or "")
            )
            doctor_id = body.get("doctorId")
            date = body.get("date")
            time_slot = body.get("timeSlot")
            symptoms = body.get("symptoms")
            notes = body.get("notes")
            consultation_mode = body.get("consultationMode")
            location_label = body.get("locationLabel")
            hospital_name = body.get("hospitalName")
            hospital_address = body.get("hospitalAddress")
            hospital_place_id = body.get("hospitalPlaceId")
            hospital_maps_uri = body.get("hospitalMapsUri")

            if not patient_id or not doctor_id or not date or not time_slot or not symptoms:
                self._send_json(
                    400, {"error": "Doctor, date, time slot, and symptoms are required."}
                )
                return

            uri_valid, safe_maps_uri = validate_safe_https_url(hospital_maps_uri)
            if not uri_valid:
                self._send_json(
                    400, {"error": "Invalid hospital map URL. Only https:// links are allowed."}
                )
                return

            patient = next(
                (
                    u
                    for u in db["users"]
                    if u.get("id") == patient_id and u.get("role") == "patient"
                ),
                None,
            )
            doctor = next(
                (
                    u
                    for u in db["users"]
                    if u.get("id") == doctor_id and u.get("role") == "doctor"
                ),
                None,
            )

            if not patient or not doctor:
                self._send_json(404, {"error": "Patient or Doctor record not found."})
                return

            if not doctor.get("approved"):
                self._send_json(
                    403,
                    {
                        "error": "This doctor account is pending Admin approval and cannot accept bookings yet."
                    },
                )
                return

            active_statuses = {"Pending", "Confirmed", "Rescheduled"}
            conflict = next(
                (
                    a
                    for a in db["appointments"]
                    if a.get("doctorId") == doctor_id
                    and a.get("date") == date
                    and a.get("timeSlot") == time_slot
                    and a.get("status") in active_statuses
                ),
                None,
            )
            if conflict:
                self._send_json(
                    409,
                    {
                        "error": f"Time slot {time_slot} on {date} is already booked with {doctor['name']}. Please choose another available slot."
                    },
                )
                return

            now = now_iso()
            ts = epoch_ms()
            appointment = {
                "id": f"apt-{ts}",
                "patientId": patient["id"],
                "patientName": patient["name"],
                "patientEmail": patient["email"],
                "doctorId": doctor["id"],
                "doctorName": doctor["name"],
                "doctorSpecialty": doctor.get("specialty") or "General Medicine",
                "date": str(date)[:30],
                "timeSlot": str(time_slot)[:30],
                "symptoms": str(symptoms).strip()[:500],
                "notes": str(notes).strip()[:1000] if notes else "",
                "status": "Pending",
                "meetingRoomId": f"MED-ROOM-{random.randint(1000, 9999)}",
                "consultationMode": str(consultation_mode).strip()[:60]
                if consultation_mode
                else "Video Consultation",
                "locationLabel": str(location_label).strip()[:160] if location_label else None,
                "hospitalName": str(hospital_name).strip()[:160] if hospital_name else None,
                "hospitalAddress": str(hospital_address).strip()[:300] if hospital_address else None,
                "hospitalPlaceId": str(hospital_place_id).strip()[:160]
                if hospital_place_id
                else None,
                "hospitalMapsUri": safe_maps_uri,
                "createdAt": now,
                "updatedAt": now,
            }

            doctor_notif = {
                "id": f"notif-{ts}-d",
                "userId": doctor["id"],
                "title": "New Appointment Request",
                "message": f"{patient['name']} requested an appointment on {appointment['date']} at {appointment['timeSlot']} for: \"{appointment['symptoms']}\".",
                "type": "reminder",
                "relatedAppointmentId": appointment["id"],
                "emailSentSimulated": True,
                "read": False,
                "createdAt": now,
            }
            db["appointments"].insert(0, appointment)
            db["notifications"].insert(0, doctor_notif)
            save_db(db)
            self._send_json(201, {"appointment": appointment, "notification": doctor_notif})

    def _handle_update_appointment(self, apt_id: str, body: dict[str, Any]) -> None:
        status = body.get("status")
        date = body.get("date")
        time_slot = body.get("timeSlot")
        doctor_response_note = body.get("doctorResponseNote")

        with DB_LOCK:
            auth = self._require_auth()
            if not auth:
                return
            db, auth_user = auth

            appointment = next((a for a in db["appointments"] if a.get("id") == apt_id), None)
            if not appointment:
                self._send_json(404, {"error": "Appointment not found."})
                return

            is_assigned_approved_doctor = (
                auth_user.get("role") == "doctor"
                and bool(auth_user.get("approved"))
                and appointment.get("doctorId") == auth_user.get("id")
            )
            if not is_assigned_approved_doctor and auth_user.get("role") != "admin":
                self._send_json(
                    403,
                    {
                        "error": "Only the assigned approved doctor or an administrator can update this appointment."
                    },
                )
                return

            allowed_statuses = {"Pending", "Confirmed", "Rescheduled", "Rejected", "Completed"}
            if status and str(status) not in allowed_statuses:
                self._send_json(400, {"error": "Invalid appointment status."})
                return

            target_date = str(date)[:30] if date else appointment["date"]
            target_slot = str(time_slot)[:30] if time_slot else appointment["timeSlot"]

            if status in ("Confirmed", "Rescheduled"):
                active_statuses = {"Pending", "Confirmed", "Rescheduled"}
                conflict = next(
                    (
                        a
                        for a in db["appointments"]
                        if a.get("id") != appointment["id"]
                        and a.get("doctorId") == appointment["doctorId"]
                        and a.get("date") == target_date
                        and a.get("timeSlot") == target_slot
                        and a.get("status") in active_statuses
                    ),
                    None,
                )
                if conflict:
                    self._send_json(
                        409,
                        {
                            "error": f"Cannot assign {target_slot} on {target_date} because another appointment is already scheduled in that slot."
                        },
                    )
                    return

            appointment["status"] = status or appointment["status"]
            appointment["date"] = target_date
            appointment["timeSlot"] = target_slot
            if "doctorResponseNote" in body and doctor_response_note is not None:
                appointment["doctorResponseNote"] = str(doctor_response_note)[:500]
            appointment["updatedAt"] = now_iso()

            if status == "Confirmed":
                notif_title = "Appointment Confirmed & Reminder Set"
                clean_doc = re.sub(
                    r"^Dr\.\s*", "", str(appointment["doctorName"]), flags=re.IGNORECASE
                )
                notif_message = (
                    f"Dr. {clean_doc} confirmed your appointment for {appointment['date']} at "
                    f"{appointment['timeSlot']}. Video Room: {appointment['meetingRoomId']}. "
                    f"Reminder email dispatched to {appointment['patientEmail']}."
                )
                notif_type = "appointment_confirmed"
            elif status == "Rescheduled":
                notif_title = "Appointment Rescheduled by Doctor"
                notif_message = (
                    f"{appointment['doctorName']} rescheduled your appointment to "
                    f"{appointment['date']} at {appointment['timeSlot']}. "
                    f"Note: {appointment.get('doctorResponseNote') or 'See updated schedule.'}"
                )
                notif_type = "appointment_rescheduled"
            elif status == "Rejected":
                notif_title = "Appointment Request Declined"
                notif_message = (
                    f"{appointment['doctorName']} was unable to accept the slot on "
                    f"{appointment['date']} at {appointment['timeSlot']}. "
                    f"{appointment.get('doctorResponseNote') or 'Please choose another slot.'}"
                )
                notif_type = "appointment_rejected"
            else:
                notif_title = "Appointment Completed"
                notif_message = (
                    f"Your consultation with {appointment['doctorName']} has been marked completed."
                )
                notif_type = "appointment_rejected"

            patient_notif = {
                "id": f"notif-{epoch_ms()}-p",
                "userId": appointment["patientId"],
                "title": notif_title,
                "message": notif_message,
                "type": notif_type,
                "relatedAppointmentId": appointment["id"],
                "emailSentSimulated": True,
                "read": False,
                "createdAt": now_iso(),
            }
            db["notifications"].insert(0, patient_notif)

            save_db(db)
            self._send_json(200, {"appointment": appointment, "notification": patient_notif})

    def _handle_create_eprescription(self, body: dict[str, Any]) -> None:
        with DB_LOCK:
            auth = self._require_auth()
            if not auth:
                return
            db, auth_user = auth

            is_approved_doctor = auth_user.get("role") == "doctor" and bool(
                auth_user.get("approved")
            )
            if not is_approved_doctor and auth_user.get("role") != "admin":
                self._send_json(
                    403, {"error": "Only approved doctors can issue digital e-prescriptions."}
                )
                return

            appointment_id = body.get("appointmentId")
            patient_id = body.get("patientId")
            doctor_id = body.get("doctorId")
            diagnosis_summary = body.get("diagnosisSummary")
            symptoms_observed = body.get("symptomsObserved")
            medicines = body.get("medicines")
            advice = body.get("advice")
            follow_up_date = body.get("followUpDate")

            if not diagnosis_summary or not isinstance(medicines, list) or len(medicines) == 0:
                self._send_json(
                    400, {"error": "Diagnosis summary and at least one medicine are required."}
                )
                return

            patient = next(
                (
                    u
                    for u in db["users"]
                    if u.get("id") == patient_id and u.get("role") == "patient"
                ),
                None,
            )
            if not patient:
                self._send_json(404, {"error": "Target patient record not found."})
                return

            doctor = (
                auth_user
                if auth_user.get("role") == "doctor"
                else next(
                    (
                        u
                        for u in db["users"]
                        if u.get("id") == doctor_id and u.get("role") == "doctor"
                    ),
                    None,
                )
            )
            if not doctor:
                self._send_json(404, {"error": "Prescribing doctor record not found."})
                return

            ts = epoch_ms()
            new_rx = {
                "id": f"erx-{ts}",
                "appointmentId": str(appointment_id or "DIRECT-CONSULT")[:80],
                "patientId": patient["id"],
                "patientName": patient["name"],
                "patientAge": patient.get("age") or 30,
                "doctorId": doctor["id"],
                "doctorName": doctor["name"],
                "doctorQualification": doctor.get("qualification", "MBBS, MD (Internal Medicine)"),
                "doctorRegistration": doctor.get("registrationNumber", "TSMC-48291"),
                "doctorSpecialty": doctor.get("specialty", "General & Internal Medicine"),
                "date": today_str(),
                "diagnosisSummary": str(diagnosis_summary).strip()[:500],
                "symptomsObserved": str(
                    symptoms_observed or "General telemedicine consultation"
                ).strip()[:500],
                "medicines": medicines[:30],
                "advice": str(
                    advice or "Take medications as directed after meals and stay well hydrated."
                ).strip()[:1000],
                "followUpDate": str(follow_up_date or today_str(offset_days=7))[:30],
            }

            rx_notif = {
                "id": f"notif-{ts}-rx",
                "userId": new_rx["patientId"],
                "title": "New Digital E-Prescription Issued",
                "message": f'{new_rx["doctorName"]} has issued an e-prescription for "{new_rx["diagnosisSummary"]}". You can view, print, and download the PDF from your E-Prescriptions tab.',
                "type": "new_eprescription",
                "relatedAppointmentId": new_rx["appointmentId"],
                "emailSentSimulated": True,
                "read": False,
                "createdAt": now_iso(),
            }
            db["eprescriptions"].insert(0, new_rx)
            db["notifications"].insert(0, rx_notif)
            save_db(db)
            self._send_json(201, {"eprescription": new_rx, "notification": rx_notif})

    def _handle_admin_doctor_approval(self, doc_id: str, body: dict[str, Any]) -> None:
        with DB_LOCK:
            auth = self._require_auth()
            if not auth:
                return
            db, auth_user = auth

            if auth_user.get("role") != "admin":
                self._send_json(403, {"error": "Administrator privileges required."})
                return

            approved = bool(body.get("approved"))
            doctor = next(
                (u for u in db["users"] if u.get("id") == doc_id and u.get("role") == "doctor"),
                None,
            )
            if not doctor:
                self._send_json(404, {"error": "Doctor account not found."})
                return

            doctor["approved"] = approved
            doc_notif = {
                "id": f"notif-{epoch_ms()}-doc",
                "userId": doctor["id"],
                "title": (
                    "Doctor Profile Approved & Live"
                    if doctor["approved"]
                    else "Doctor Profile Approval Paused"
                ),
                "message": (
                    "An Administrator has verified and approved your medical credentials. Your profile is now live for patient appointment bookings."
                    if doctor["approved"]
                    else "Your profile visibility has been paused by an Administrator pending credential review."
                ),
                "type": "doctor_approved",
                "emailSentSimulated": True,
                "read": False,
                "createdAt": now_iso(),
            }
            db["notifications"].insert(0, doc_notif)
            save_db(db)
            self._send_json(200, {"doctor": sanitize_user(doctor), "notification": doc_notif})

    def _handle_admin_delete_user(self, user_id: str) -> None:
        with DB_LOCK:
            auth = self._require_auth()
            if not auth:
                return
            db, auth_user = auth

            if auth_user.get("role") != "admin":
                self._send_json(403, {"error": "Administrator privileges required."})
                return

            target = next((u for u in db["users"] if u.get("id") == user_id), None)
            if not target:
                self._send_json(404, {"error": "User not found."})
                return
            if target.get("role") == "admin":
                self._send_json(
                    403, {"error": "Cannot delete the primary administrator account."}
                )
                return
            db["users"] = [u for u in db["users"] if u.get("id") != user_id]
            save_db(db)
            self._send_json(200, {"success": True})

    def _handle_notifications_read_all(self, body: dict[str, Any]) -> None:
        with DB_LOCK:
            auth = self._require_auth()
            if not auth:
                return
            db, auth_user = auth

            requested_user_id = str(body.get("userId") or "").strip()
            if requested_user_id and requested_user_id != auth_user["id"]:
                self._send_json(403, {"error": "Cannot modify notifications for another user."})
                return

            for notif in db["notifications"]:
                if notif.get("userId") == auth_user["id"]:
                    notif["read"] = True
            save_db(db)
            self._send_json(200, {"success": True})


class ReusableThreadingHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def create_server(
    host: str = "127.0.0.1",
    port: int = 8001,
    handler_cls: type[HealthcareAPIHandler] = HealthcareAPIHandler,
) -> ReusableThreadingHTTPServer:
    load_db()
    return ReusableThreadingHTTPServer((host, port), handler_cls)


def _watch_parent_pid(server: ReusableThreadingHTTPServer, parent_pid: int) -> None:
    while True:
        time.sleep(2.0)
        try:
            os.kill(parent_pid, 0)
        except OSError:
            threading.Thread(target=server.shutdown, daemon=True).start()
            break


def main() -> None:
    host = os.environ.get("PYTHON_BACKEND_HOST", "127.0.0.1")
    port = int(os.environ.get("PYTHON_BACKEND_PORT", "8001"))
    server = create_server(host=host, port=port)

    def _shutdown(_signum: int, _frame: Any) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    parent_pid_raw = os.environ.get("PYTHON_PARENT_PID", "").strip()
    if parent_pid_raw.isdigit():
        threading.Thread(
            target=_watch_parent_pid,
            args=(server, int(parent_pid_raw)),
            daemon=True,
        ).start()

    print(f"Python Healthcare API backend listening on http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
