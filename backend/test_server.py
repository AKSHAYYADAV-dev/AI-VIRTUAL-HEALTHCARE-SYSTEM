"""Automated unit & integration tests for the Python Healthcare Backend."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import server as py_backend  # noqa: E402


class MockHealthcareAPIHandler(py_backend.HealthcareAPIHandler):
    """Test handler with deterministic mocked Gemini responses."""

    @staticmethod
    def generate_content_fn(
        model: str,
        contents: list,
        system_instruction: str,
        thinking_level: str | None = None,
        response_mime_type: str | None = None,
        response_schema: dict | None = None,
    ) -> str:
        if response_mime_type == "application/json" and "medicines" in json.dumps(
            response_schema or {}
        ):
            return json.dumps(
                {
                    "doctorName": {"value": "Dr. Aarav Mehta", "confidence": "High"},
                    "date": {"value": "2026-11-10", "confidence": "High"},
                    "patientName": {"value": "Rohan Verma", "confidence": "High"},
                    "medicines": [
                        {
                            "name": "Tab. Paracetamol 650mg",
                            "dosage": "650 mg",
                            "frequency": "Twice daily",
                            "duration": "3 days",
                            "generalPurpose": "Used to reduce fever and mild body pain.",
                            "notes": "Take after meals",
                            "confidence": "High",
                        }
                    ],
                    "generalNotes": {"value": "Stay hydrated", "confidence": "Medium"},
                    "suggestedSymptoms": "Mild fever",
                }
            )
        if response_mime_type == "application/json" and "possibleCauses" in json.dumps(
            response_schema or {}
        ):
            return json.dumps(
                {
                    "urgencyLevel": "Soon Consultation",
                    "possibleCauses": ["Viral upper respiratory infection", "Seasonal allergies"],
                    "explanation": "This may be related to a mild viral throat irritation.",
                    "homeRemedies": ["Drink warm water", "Rest adequately"],
                    "commonTabletsUse": ["Paracetamol is generally used to lower fever."],
                    "recommendedSpecialty": "General & Internal Medicine",
                }
            )
        return (
            "• **Causes & Explanation**: This may be related to a mild viral throat infection.\n"
            "• **Home Remedy Tips**: Warm saline gargles and fluids.\n"
            "• **Common Tablets & Their General Use**: Paracetamol is generally used for fever relief."
        )

    @staticmethod
    def stream_content_fn(
        model: str,
        contents: list,
        system_instruction: str,
        thinking_level: str | None = None,
    ):
        yield "• **Causes & Explanation**: This may be related to seasonal viral pharyngitis.\n"
        yield "• **Home Remedy Tips**: Warm water and rest.\n"
        yield "• **Common Tablets & Their General Use**: Lozenges or paracetamol for comfort."


class PythonBackendTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        os.environ["PYTHON_BACKEND_QUIET"] = "1"
        cls.temp_dir = tempfile.mkdtemp(prefix="medassist_py_test_")
        os.environ["HEALTHCARE_DATA_DIR"] = cls.temp_dir

        with py_backend.RUNTIME_LOCK:
            py_backend.CHAT_ANSWER_CACHE.clear()
            py_backend.LAST_MESSAGE_TIME_BY_USER.clear()

        cls.httpd = py_backend.create_server(
            host="127.0.0.1", port=0, handler_cls=MockHealthcareAPIHandler
        )
        cls.port = cls.httpd.server_address[1]
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.httpd.shutdown()
        cls.httpd.server_close()
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def request_json(
        self, method: str, path: str, body: dict | None = None
    ) -> tuple[int, dict, dict]:
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"} if data is not None else {}
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status, dict(resp.headers), json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            return err.code, dict(err.headers), json.loads(err.read().decode("utf-8"))

    def test_01_health_endpoint(self) -> None:
        status, headers, data = self.request_json("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["backend"], "python")
        self.assertEqual(headers.get("X-Powered-By"), "Python-Backend")
        self.assertGreaterEqual(data["usersCount"], 9)

    def test_02_login_and_scrypt_verification(self) -> None:
        status, _, data = self.request_json(
            "POST",
            "/api/auth/login",
            {"email": "rohan@patient.in", "password": "Patient@123"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["user"]["id"], "pat-1")
        self.assertNotIn("passwordHash", data["user"])

        bad_status, _, _ = self.request_json(
            "POST",
            "/api/auth/login",
            {"email": "rohan@patient.in", "password": "WrongPassword"},
        )
        self.assertEqual(bad_status, 401)

    def test_03_signup_patient_and_doctor_pending_approval(self) -> None:
        status, _, data = self.request_json(
            "POST",
            "/api/auth/signup",
            {
                "name": "Kavita Patient",
                "email": "kavita@patient.in",
                "password": "User@1234",
                "role": "patient",
                "age": 29,
            },
        )
        self.assertEqual(status, 201)
        self.assertEqual(data["user"]["role"], "patient")

        dup_status, _, _ = self.request_json(
            "POST",
            "/api/auth/signup",
            {
                "name": "Kavita Patient",
                "email": "kavita@patient.in",
                "password": "User@1234",
                "role": "patient",
            },
        )
        self.assertEqual(dup_status, 409)

        doc_status, _, doc_data = self.request_json(
            "POST",
            "/api/auth/signup",
            {
                "name": "Dr. Neha Verma",
                "email": "dr.neha@medassist.in",
                "password": "Doctor@123",
                "role": "doctor",
                "specialty": "Neurology",
            },
        )
        self.assertEqual(doc_status, 201)
        self.assertFalse(doc_data["user"]["approved"])

    def test_04_rbac_state_fetching(self) -> None:
        unauth_status, _, _ = self.request_json("GET", "/api/state?userId=unknown-id")
        self.assertEqual(unauth_status, 401)

        pat_status, _, pat_state = self.request_json("GET", "/api/state?userId=pat-1")
        self.assertEqual(pat_status, 200)
        self.assertNotIn("users", pat_state)
        self.assertTrue(all(d["approved"] for d in pat_state["doctors"]))

        adm_status, _, adm_state = self.request_json("GET", "/api/state?userId=adm-1")
        self.assertEqual(adm_status, 200)
        self.assertIn("users", adm_state)

    def test_05_appointments_booking_and_conflict_prevention(self) -> None:
        # Unapproved doctor (doc-5) must return 403
        unapproved_status, _, _ = self.request_json(
            "POST",
            "/api/appointments",
            {
                "patientId": "pat-1",
                "doctorId": "doc-5",
                "date": "2026-11-15",
                "timeSlot": "10:00 AM",
                "symptoms": "Knee pain",
            },
        )
        self.assertEqual(unapproved_status, 403)

        # Valid booking
        ok_status, _, ok_data = self.request_json(
            "POST",
            "/api/appointments",
            {
                "patientId": "pat-1",
                "doctorId": "doc-1",
                "date": "2026-11-20",
                "timeSlot": "03:30 PM",
                "symptoms": "Mild headache",
            },
        )
        self.assertEqual(ok_status, 201)
        apt_id = ok_data["appointment"]["id"]

        # Double-booking same slot must return 409
        conflict_status, _, _ = self.request_json(
            "POST",
            "/api/appointments",
            {
                "patientId": "pat-2",
                "doctorId": "doc-1",
                "date": "2026-11-20",
                "timeSlot": "03:30 PM",
                "symptoms": "Another patient same slot",
            },
        )
        self.assertEqual(conflict_status, 409)

        # Confirm appointment via PATCH
        patch_status, _, patch_data = self.request_json(
            "PATCH",
            f"/api/appointments/{apt_id}",
            {"status": "Confirmed", "doctorResponseNote": "Ready for call"},
        )
        self.assertEqual(patch_status, 200)
        self.assertEqual(patch_data["appointment"]["status"], "Confirmed")

    def test_06_eprescription_and_admin_controls(self) -> None:
        rx_status, _, rx_data = self.request_json(
            "POST",
            "/api/eprescriptions",
            {
                "patientId": "pat-1",
                "doctorId": "doc-1",
                "diagnosisSummary": "Mild seasonal rhinitis",
                "medicines": [
                    {
                        "name": "Tab. Cetirizine",
                        "dosage": "10 mg",
                        "frequency": "Once nightly",
                        "duration": "5 Days",
                        "instructions": "After dinner",
                    }
                ],
            },
        )
        self.assertEqual(rx_status, 201)
        self.assertEqual(rx_data["eprescription"]["patientName"], "Rohan Verma")

        # Approve doc-5
        app_status, _, app_data = self.request_json(
            "PATCH",
            "/api/admin/doctors/doc-5/approval",
            {"approved": True},
        )
        self.assertEqual(app_status, 200)
        self.assertTrue(app_data["doctor"]["approved"])

        # Cannot delete primary admin
        del_adm_status, _, _ = self.request_json("DELETE", "/api/admin/users/adm-1")
        self.assertEqual(del_adm_status, 403)

    def test_07_ai_chat_streaming_cache_cooldown_and_emergency(self) -> None:
        # 1. SSE Streaming request with emergency keyword
        req = urllib.request.Request(
            f"{self.base_url}/api/ai/chat",
            data=json.dumps(
                {
                    "patientId": "pat-stream-test",
                    "sessionId": "chat-test-1",
                    "message": "I have severe chest pain right now",
                    "language": "English",
                    "stream": True,
                }
            ).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn("text/event-stream", resp.headers.get("Content-Type", ""))
            sse_body = resp.read().decode("utf-8")

        events = [
            json.loads(line[5:].strip())
            for line in sse_body.splitlines()
            if line.startswith("data:")
        ]
        done_event = next((e for e in events if e.get("type") == "done"), None)
        self.assertIsNotNone(done_event)
        self.assertTrue(done_event["isEmergency"])
        self.assertIn("Causes & Explanation", done_event["reply"])

        # 2. Immediate follow-up within 2s hits cooldown (429)
        cool_status, _, cool_data = self.request_json(
            "POST",
            "/api/ai/chat",
            {
                "patientId": "pat-stream-test",
                "message": "hello",
                "stream": False,
            },
        )
        self.assertEqual(cool_status, 429)
        self.assertTrue(cool_data.get("cooldown"))

        # 3. After waiting 2.1s, same message hits in-memory cache
        time.sleep(2.1)
        cached_status, _, cached_data = self.request_json(
            "POST",
            "/api/ai/chat",
            {
                "patientId": "pat-stream-test",
                "sessionId": "chat-test-1",
                "message": "I have severe chest pain right now",
                "language": "English",
                "stream": False,
            },
        )
        self.assertEqual(cached_status, 200)
        self.assertTrue(cached_data["cached"])

    def test_08_prescription_analyze_and_symptom_check(self) -> None:
        bad_status, _, _ = self.request_json(
            "POST",
            "/api/ai/prescription-analyze",
            {"patientId": "pat-1", "imageDataUrl": "not-an-image"},
        )
        self.assertEqual(bad_status, 400)

        tiny_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        ok_status, _, rx_scan = self.request_json(
            "POST",
            "/api/ai/prescription-analyze",
            {"patientId": "pat-1", "imageDataUrl": tiny_png, "fileName": "rx.png"},
        )
        self.assertEqual(ok_status, 200)
        self.assertEqual(rx_scan["analysis"]["doctorName"]["value"], "Dr. Aarav Mehta")
        self.assertEqual(len(rx_scan["analysis"]["medicines"]), 1)

        sym_status, _, sym_data = self.request_json(
            "POST",
            "/api/ai/symptom-check",
            {
                "patientId": "pat-1",
                "selectedSymptoms": ["Fever", "Chest Pain"],
                "severity": "Moderate",
            },
        )
        self.assertEqual(sym_status, 200)
        self.assertEqual(sym_data["result"]["urgencyLevel"], "Emergency - Call 108/112")


if __name__ == "__main__":
    unittest.main(verbosity=2)
