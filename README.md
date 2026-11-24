# AI Virtual Healthcare Assistant — Telemedicine Platform

A full-stack telemedicine web application built with React 19, TypeScript, Tailwind CSS, Express, and the official `@google/genai` SDK (`gemini-3.8-flash`). Designed for an AI-assisted coding lab project and viva demonstration, all AI interactions happen strictly inside the application via a secure backend API without ever redirecting users to external sites.

---

## 1. Key Features

- **Role-Based Access Control (Patient, Doctor, Admin)**:
  - **Patients**: Access AI Health Chat, Multimodal Prescription Analysis, Symptom Checker, Appointment Booking (with double-booking prevention), Video Consultations, PDF E-Prescription downloads, and a Unified Health Timeline. Patients only see their own private health records.
  - **Doctors**: Review and manage appointment requests (Accept, Reject, Reschedule with conflict detection), join WebRTC Video Consultation rooms, and issue structured Digital E-Prescriptions. Newly registered Doctor accounts require Admin approval before going live.
  - **Admins**: Verify and approve/pause Doctor accounts, manage all registered users, and inspect live platform analytics charts.
- **Multilingual Support (English, Telugu తెలుగు, Hindi हिन्दी)**:
  - Instant UI language switcher and automatic language matching in Gemini AI responses.
- **Cryptographic Password Security & Privacy**:
  - Passwords are salted and hashed on the server using Node's `crypto.scryptSync` (`scrypt + 16-byte random salt`) and verified with `crypto.timingSafeEqual`.
  - Persistent JSON database (`/data/db.json`) pre-seeded with 5 Doctors, 3 Patients, 1 Admin, sample appointments, e-prescriptions, and chat history.

---

## 2. How the Gemini API is Integrated

All Gemini API calls are handled strictly on the backend in `/server.ts` using `@google/genai` (`gemini-3.8-flash`). The `GEMINI_API_KEY` lives exclusively in the server environment (`process.env.GEMINI_API_KEY`) and is never exposed to frontend code.

1. **`POST /api/ai/chat` (Multi-Turn AI Health Chat)**:
   - Sends the recent conversation history (`contents` array of `{ role, parts }`) along with the user's new question so follow-up questions maintain full clinical context.
   - Enforces the 8 mandatory clinical safety rules via `config.systemInstruction`.
   - Every response rendered in the UI automatically appends the mandatory application disclaimer (`"This response is AI-generated and can make mistakes. Please recheck with a qualified doctor."`) and the `"Would you like to book an appointment?"` prompt with a `"Book Appointment"` button that pre-fills the discussed symptoms.
2. **`POST /api/ai/prescription-analyze` (Multimodal Prescription OCR & Explainer)**:
   - Requires the patient to tick an informed consent checkbox first.
   - Validates image MIME type (`JPEG`, `PNG`, `WEBP`) and enforces a `5 MB` size limit.
   - Sends the base64-encoded image (`inlineData`) to `gemini-3.8-flash` using a strict JSON `responseSchema` (`Type.OBJECT`) to extract:
     - Doctor Name, Date, Patient Name (`{ value, confidence }`)
     - Each Medicine (`name`, `dosage`, `frequency`, `duration`, `generalPurpose`, `notes`, `confidence`)
     - General Clinical Notes
   - Never guesses illegible words—marks unclear handwriting as `"unreadable"` with `"Low"` confidence, highlighted in red in the UI as **`"Unclear, please verify"`** alongside the original prescription image.
3. **`POST /api/ai/symptom-check` (Explainable Symptom Triage)**:
   - Evaluates selected symptoms, duration, and severity to return common possible causes, plain-language explanations, urgency classification, and recommended specialist without prescribing medications.

---

## 3. Mandatory Clinical Safety Rules Enforced

1. **Calm, Caring, Non-Prescriptive Tone**: Never claims to be a licensed physician.
2. **Health-Only Scope**: Politely declines non-medical questions and steers the conversation back to health topics.
3. **Causes & Plain-Language Explanations Only**: Never recommends, names, or suggests any medicines, dosages, or treatments in health chat or symptom triage.
4. **No Definite Diagnosis**: Uses cautious phrasing such as *"this may be related to..."*.
5. **Emergency Triage Warning (108 / 112)**: Detects red-flag emergency symptoms (chest pain, difficulty breathing, stroke signs, severe bleeding, self-harm thoughts) and immediately displays an urgent warning instructing the user to call **108 (Ambulance)** or **112** or proceed to the nearest hospital emergency room.
6. **Honest Uncertainty & Zero Guessing on Prescriptions**: Marks unreadable handwriting as `"unreadable"` (`Low` confidence) and warns: *"AI can misread handwriting. Always confirm medicine names and doses with your doctor or pharmacist before taking anything."*

---

## 4. Demo Login Credentials (Pre-Seeded)

| Role | Name | Email | Password | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Patient 1** | Rohan Verma | `rohan@patient.in` | `Patient@123` | Has confirmed & pending appointments, chat history, and PDF E-Rx |
| **Patient 2** | Sneha Kulkarni | `sneha@patient.in` | `Patient@123` | Confirmed Cardiology video consultation |
| **Patient 3** | Arjun Rao | `arjun@patient.in` | `Patient@123` | Completed consultation & downloadable PDF E-Rx |
| **Doctor 1** | Dr. Aarav Mehta, MD | `dr.aarav@medassist.in` | `Doctor@123` | Internal Medicine · **Approved & Live** |
| **Doctor 2** | Dr. Priya Sharma, DM | `dr.priya@medassist.in` | `Doctor@123` | Cardiology · **Approved & Live** |
| **Doctor 3** | Dr. Karthik Reddy, MD | `dr.karthik@medassist.in` | `Doctor@123` | Pulmonology · **Approved & Live** (has Pending request) |
| **Doctor 4** | Dr. Ananya Nair, MD | `dr.ananya@medassist.in` | `Doctor@123` | Dermatology · **Approved & Live** |
| **Doctor 5** | Dr. Vikram Joshi, MS | `dr.vikram@medassist.in` | `Doctor@123` | Orthopedics · **Pending Admin Approval** (great for Viva demo) |
| **Admin** | Dr. Meera Krishnan | `admin@medassist.in` | `Admin@123` | Approve doctors, manage users, and view analytics charts |

---

## 5. Setup & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env`:
   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   ```
3. Start the full-stack Express + Vite server on port `3000`:
   ```bash
   npm run dev
   ```
