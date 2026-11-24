import express, { Request, Response, Router } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const HEALTH_CHAT_SYSTEM_PROMPT = `You are the AI Virtual Healthcare Assistant on a telemedicine platform.
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
  • **Common Tablets & Their General Use**`;

const PRESCRIPTION_SYSTEM_PROMPT = `You are a clinical prescription OCR and medical explanation assistant powered by Gemini Vision.
Analyze the uploaded image of a handwritten or printed medical prescription and extract structured fields.

STRICT SAFETY & EXTRACTION RULES:
1. Extract: doctorName, date, patientName, each medicine (name, dosage, frequency, duration, notes, generalPurpose), and generalNotes.
2. Assign a confidence level ("High", "Medium", or "Low") to EVERY extracted field and medicine.
3. NEVER guess an unreadable or smudged word. If any word, medicine name, or dosage is illegible or ambiguous, mark its value as "unreadable" (or include "unreadable" in the field) and set its confidence to "Low".
4. For each medicine, provide "generalPurpose": explain in simple, everyday words what the medicine is generally used for. Do NOT change doses, do NOT critique the prescription, and do NOT suggest alternative medicines.
5. Respect the requested explanation language (English, Telugu, or Hindi) for the generalPurpose and notes explanations.`;

function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password || !hash || !salt) return false;
  try {
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const SESSION_COOKIE_NAME = 'medassist_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function resolveSessionSecret(overrideSecret?: string): string {
  if (overrideSecret && overrideSecret.trim().length >= 16) {
    return overrideSecret.trim();
  }
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  return EPHEMERAL_FALLBACK_SECRET;
}

export function createSessionTokenWithSecret(userId: string, secret?: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const sig = crypto
    .createHmac('sha256', resolveSessionSecret(secret))
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifySessionTokenWithSecret(
  token: string | null | undefined,
  secret?: string
): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  if (!userId || !expStr || !sig) return null;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const expectedSig = crypto
    .createHmac('sha256', resolveSessionSecret(secret))
    .update(`${userId}.${expStr}`)
    .digest('hex');
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return userId;
}

export function extractSessionTokenFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const rawAuth = headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const rawCookie = headers.cookie;
  const cookieHeader = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie;
  if (typeof cookieHeader === 'string' && cookieHeader.length > 0) {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx <= 0) continue;
      const key = pair.slice(0, idx).trim();
      if (key === SESSION_COOKIE_NAME) {
        try {
          return decodeURIComponent(pair.slice(idx + 1).trim());
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function isCsrfValidForRequest(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return true;
  }
  const originHeader = req.headers.origin;
  const expectedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  if (typeof originHeader === 'string' && originHeader.trim()) {
    try {
      const originHost = new URL(originHeader).host.toLowerCase();
      if (expectedHost && originHost !== expectedHost) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const cookieHeader = String(req.headers.cookie || '');
  const hasSessionCookie = cookieHeader.includes(`${SESSION_COOKIE_NAME}=`);
  if (!hasSessionCookie) {
    return true;
  }

  const xrw = String(req.headers['x-requested-with'] || '').trim();
  if (xrw.length > 0) {
    return true;
  }
  if (typeof originHeader === 'string' && originHeader.trim() && expectedHost) {
    try {
      return new URL(originHeader).host.toLowerCase() === expectedHost;
    } catch {
      return false;
    }
  }
  return false;
}

function setSessionCookie(_req: Request, res: Response, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000
    )}`
  );
}

function clearSessionCookie(_req: Request, res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
}

function escapeXml(raw: string): string {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateSafeHttpsUrl(raw: unknown): { valid: boolean; value?: string } {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { valid: true, value: undefined };
  }
  const str = String(raw).trim();
  if (str.length > 1024) return { valid: false };
  try {
    const parsed = new URL(str);
    if (parsed.protocol !== 'https:') return { valid: false };
    return { valid: true, value: parsed.toString() };
  } catch {
    return { valid: false };
  }
}

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: 'patient' | 'doctor' | 'admin';
  phone: string;
  createdAt: string;
  seededPreviewAccount?: boolean;
  credentialClaimed?: boolean;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[];
  specialty?: string;
  qualification?: string;
  registrationNumber?: string;
  experienceYears?: number;
  consultationFee?: number;
  approved?: boolean;
  availableSlots?: string[];
  bio?: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  chatSessions: any[];
  prescriptionAnalyses: any[];
  appointments: any[];
  eprescriptions: any[];
  symptomChecks: any[];
  notifications: any[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEEDED_PREVIEW_IDS = new Set([
  'adm-1',
  'doc-1',
  'doc-2',
  'doc-3',
  'doc-4',
  'doc-5',
  'pat-1',
  'pat-2',
  'pat-3',
]);

function getEnvPasswordForSeededRole(role: 'patient' | 'doctor' | 'admin'): string {
  if (role === 'admin') return (process.env.ADMIN_PASSWORD || '').trim();
  if (role === 'doctor') return (process.env.DEMO_DOCTOR_PASSWORD || '').trim();
  return (process.env.DEMO_PATIENT_PASSWORD || '').trim();
}

function buildSeededCredentialFields(role: 'patient' | 'doctor' | 'admin'): {
  passwordHash: string;
  passwordSalt: string;
  seededPreviewAccount: boolean;
  credentialClaimed: boolean;
} {
  const envPass = getEnvPasswordForSeededRole(role);
  if (envPass) {
    const { hash, salt } = hashPassword(envPass);
    return {
      passwordHash: hash,
      passwordSalt: salt,
      seededPreviewAccount: true,
      credentialClaimed: true,
    };
  }
  return {
    passwordHash: '',
    passwordSalt: '',
    seededPreviewAccount: true,
    credentialClaimed: false,
  };
}

function buildRxSvgDataUrl(title: string, subtitle: string, lines: string[]): string {
  const lineSvg = lines
    .map(
      (text, idx) =>
        `<text x="36" y="${132 + idx * 34}" font-family="Georgia, serif" font-style="italic" font-size="16" fill="#1E3A8A">${escapeXml(text)}</text>`
    )
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="360" viewBox="0 0 520 360">` +
    `<rect width="520" height="360" rx="14" fill="#FDFBF7" stroke="#CBD5E1" stroke-width="2"/>` +
    `<rect x="0" y="0" width="520" height="68" rx="14" fill="#064734"/>` +
    `<text x="28" y="34" font-family="sans-serif" font-weight="bold" font-size="17" fill="#FFFFFF">${escapeXml(title)}</text>` +
    `<text x="28" y="54" font-family="sans-serif" font-size="12" fill="#E3F2E8">${escapeXml(subtitle)}</text>` +
    `<text x="36" y="100" font-family="Georgia, serif" font-weight="bold" font-style="italic" font-size="24" fill="#064734">Rx</text>` +
    lineSvg +
    `<text x="320" y="330" font-family="Georgia, serif" font-style="italic" font-size="13" fill="#475569">Signed: Dr. Aarav Mehta, MD</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

function buildSeedPrescriptionAnalyses(today: string, twoDaysAgo: string): any[] {
  return [
    {
      id: 'rx-scan-101',
      patientId: 'pat-1',
      createdAt: `${twoDaysAgo}T11:20:00Z`,
      imageDataUrl: buildRxSvgDataUrl(
        'APOLLO CARE SPECIALTY CLINIC',
        `Dr. Aarav Mehta, MD | Date: ${twoDaysAgo} | Patient: Rohan Verma`,
        [
          '1) Tab. Paracetamol 650 mg — 1-0-1 After Food (3 Days)',
          '2) Tab. Levocetirizine 5 mg — 0-0-1 Bedtime (5 Days)',
          '3) Cap. Pantoprazole 40 mg — 1-0-0 Empty Stomach (5 Days)',
        ]
      ),
      fileName: 'viral_fever_opd_rx.png',
      language: 'English',
      doctorName: { value: 'Dr. Aarav Mehta (MD)', confidence: 'High' },
      date: { value: twoDaysAgo, confidence: 'High' },
      patientName: { value: 'Rohan Verma', confidence: 'High' },
      medicines: [
        {
          name: 'Tab. Paracetamol',
          dosage: '650 mg',
          frequency: 'Twice daily',
          timing: '1-0-1 After Food',
          duration: '3 Days',
          generalPurpose: 'Reduces fever and relieves mild-to-moderate body ache',
          notes: 'Take after breakfast and dinner',
          confidence: 'High',
          confidenceScore: 96,
        },
        {
          name: 'Tab. Levocetirizine',
          dosage: '5 mg',
          frequency: 'Once nightly',
          timing: '0-0-1 Bedtime',
          duration: '5 Days',
          generalPurpose: 'Antihistamine for throat irritation and nasal congestion',
          notes: 'May cause mild drowsiness',
          confidence: 'High',
          confidenceScore: 94,
        },
        {
          name: 'Cap. Pantoprazole',
          dosage: '40 mg',
          frequency: 'Once morning',
          timing: '1-0-0 Before Breakfast',
          duration: '5 Days',
          generalPurpose: 'Protects stomach lining and reduces gastric acidity',
          notes: 'Swallow 30 minutes prior to breakfast',
          confidence: 'High',
          confidenceScore: 95,
        },
      ],
      generalNotes: {
        value: 'Warm saline gargles twice daily and maintain 2.5L fluid intake.',
        confidence: 'High',
      },
      suggestedSymptoms: 'Mild fever, sore throat, and post-meal gastric discomfort',
      drugInteractionAlert: null,
    },
    {
      id: 'rx-scan-102',
      patientId: 'pat-1',
      createdAt: `${today}T09:15:00Z`,
      imageDataUrl: buildRxSvgDataUrl(
        'CARE WELLNESS TELE-CLINIC',
        `Dr. Aarav Mehta, MD | Date: ${today} | Patient: Rohan Verma`,
        [
          '1) Tab. Azithromycin 500 mg — 1-0-0 After Food (3 Days)',
          '2) Syp. Ambroxol-LS 5 ml — 1-0-1 After Food (5 Days)',
          '3) Warm Steam Inhalation — Twice Daily',
        ]
      ),
      fileName: 'handwritten_cough_rx.png',
      language: 'English',
      doctorName: { value: 'Dr. Aarav Mehta (MD)', confidence: 'High' },
      date: { value: today, confidence: 'High' },
      patientName: { value: 'Rohan Verma', confidence: 'High' },
      medicines: [
        {
          name: 'Tab. Azithromycin',
          dosage: '500 mg',
          frequency: 'Once daily',
          timing: '1-0-0 After Food',
          duration: '3 Days',
          generalPurpose: 'Antibiotic used if bacterial respiratory infection is suspected',
          notes: 'Complete the prescribed 3-day course',
          confidence: 'High',
          confidenceScore: 93,
        },
        {
          name: 'Syp. Ambroxol-LS (Check Strength)',
          dosage: '5 ml',
          frequency: 'Twice daily',
          timing: '1-0-1 After Food',
          duration: '5 Days',
          generalPurpose: 'Mucolytic syrup to loosen chest phlegm and ease cough',
          notes: 'Handwritten suffix slightly smudged — verify with pharmacist',
          confidence: 'Low',
          confidenceScore: 68,
        },
      ],
      generalNotes: {
        value: 'Avoid chilled beverages; review in video follow-up if cough persists.',
        confidence: 'High',
      },
      suggestedSymptoms: 'Productive cough and upper respiratory throat irritation',
      drugInteractionAlert: null,
    },
  ];
}

function createSeedDatabase(): DatabaseSchema {
  const docCred = buildSeededCredentialFields('doctor');
  const patCred = buildSeededCredentialFields('patient');
  const admCred = buildSeededCredentialFields('admin');
  const defaultSlots = [
    '09:00 AM',
    '10:00 AM',
    '11:00 AM',
    '12:00 PM',
    '02:00 PM',
    '03:30 PM',
    '05:00 PM',
    '06:30 PM',
  ];

  return {
    users: [
      {
        id: 'doc-1',
        name: 'Dr. Aarav Mehta',
        email: 'dr.aarav@medassist.in',
        ...docCred,
        role: 'doctor',
        phone: '+91 98490 11201',
        createdAt: '2026-09-10T08:00:00Z',
        specialty: 'General & Internal Medicine',
        qualification: 'MBBS, MD (Internal Medicine)',
        registrationNumber: 'TSMC-48291',
        experienceYears: 12,
        consultationFee: 500,
        approved: true,
        availableSlots: defaultSlots,
        bio: 'Senior Internal Medicine specialist focusing on infectious diseases, metabolic syndromes, and preventive primary care.',
      },
      {
        id: 'doc-2',
        name: 'Dr. Priya Sharma',
        email: 'dr.priya@medassist.in',
        ...docCred,
        role: 'doctor',
        phone: '+91 98490 11202',
        createdAt: '2026-09-12T09:30:00Z',
        specialty: 'Cardiology & Preventive Care',
        qualification: 'MBBS, MD, DM (Cardiology)',
        registrationNumber: 'TSMC-51904',
        experienceYears: 15,
        consultationFee: 800,
        approved: true,
        availableSlots: defaultSlots,
        bio: 'Interventional and non-invasive cardiologist specializing in hypertension, chest pain evaluation, and lipid disorders.',
      },
      {
        id: 'doc-3',
        name: 'Dr. Karthik Reddy',
        email: 'dr.karthik@medassist.in',
        ...docCred,
        role: 'doctor',
        phone: '+91 98490 11203',
        createdAt: '2026-09-15T10:15:00Z',
        specialty: 'Pulmonology & Respiratory Medicine',
        qualification: 'MBBS, MD (Pulmonary Medicine)',
        registrationNumber: 'APMC-39102',
        experienceYears: 9,
        consultationFee: 650,
        approved: true,
        availableSlots: defaultSlots,
        bio: 'Specialist in asthma, chronic cough, allergic rhinitis, sleep apnea, and post-viral respiratory recovery.',
      },
      {
        id: 'doc-4',
        name: 'Dr. Ananya Nair',
        email: 'dr.ananya@medassist.in',
        ...docCred,
        role: 'doctor',
        phone: '+91 98490 11204',
        createdAt: '2026-09-20T11:00:00Z',
        specialty: 'Dermatology & Immunology',
        qualification: 'MBBS, MD (Dermatology, Venereology)',
        registrationNumber: 'KMC-62018',
        experienceYears: 8,
        consultationFee: 600,
        approved: true,
        availableSlots: defaultSlots,
        bio: 'Clinical dermatologist treating eczema, urticaria, allergic skin reactions, and autoimmune cutaneous conditions.',
      },
      {
        id: 'doc-5',
        name: 'Dr. Vikram Joshi',
        email: 'dr.vikram@medassist.in',
        ...docCred,
        role: 'doctor',
        phone: '+91 98490 11205',
        createdAt: '2026-10-28T14:20:00Z',
        specialty: 'Orthopedics & Joint Care',
        qualification: 'MBBS, MS (Orthopedics)',
        registrationNumber: 'MMC-77412',
        experienceYears: 11,
        consultationFee: 700,
        approved: false,
        availableSlots: defaultSlots,
        bio: 'Orthopedic consultant focusing on spine ergonomics, joint inflammation, and sports injury rehabilitation.',
      },
      {
        id: 'pat-1',
        name: 'Rohan Verma',
        email: 'rohan@patient.in',
        ...patCred,
        role: 'patient',
        phone: '+91 90001 22301',
        createdAt: '2026-10-01T09:00:00Z',
        age: 34,
        gender: 'Male',
        bloodGroup: 'O+',
        allergies: ['Sulfa Drugs', 'Dust Mites'],
      },
      {
        id: 'pat-2',
        name: 'Sneha Kulkarni',
        email: 'sneha@patient.in',
        ...patCred,
        role: 'patient',
        phone: '+91 90001 22302',
        createdAt: '2026-10-05T11:30:00Z',
        age: 28,
        gender: 'Female',
        bloodGroup: 'A+',
        allergies: ['None Known'],
      },
      {
        id: 'pat-3',
        name: 'Arjun Rao',
        email: 'arjun@patient.in',
        ...patCred,
        role: 'patient',
        phone: '+91 90001 22303',
        createdAt: '2026-10-12T16:45:00Z',
        age: 45,
        gender: 'Male',
        bloodGroup: 'B+',
        allergies: ['Penicillin'],
      },
      {
        id: 'adm-1',
        name: 'Dr. Meera Krishnan',
        email: 'admin@medassist.in',
        ...admCred,
        role: 'admin',
        phone: '+91 98490 00001',
        createdAt: '2026-08-01T08:00:00Z',
      },
    ],
    chatSessions: [],
    prescriptionAnalyses: buildSeedPrescriptionAnalyses(getTodayIso(0), getTodayIso(-2)),
    appointments: [],
    eprescriptions: [],
    symptomChecks: [],
    notifications: [],
  };
}

function getTodayIso(offsetDays = 0): string {
  const dt = new Date(Date.now() + offsetDays * 86400000);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as DatabaseSchema;
    const today = getTodayIso(0);
    let changed = false;
    if (!db.prescriptionAnalyses || db.prescriptionAnalyses.length === 0) {
      db.prescriptionAnalyses = buildSeedPrescriptionAnalyses(today, getTodayIso(-2));
      changed = true;
    }
    for (const user of db.users || []) {
      if (SEEDED_PREVIEW_IDS.has(user.id) && user.credentialClaimed === undefined) {
        user.seededPreviewAccount = true;
        user.credentialClaimed = false;
        user.passwordHash = '';
        user.passwordSalt = '';
        changed = true;
      }
    }
    for (const apt of db.appointments || []) {
      if (apt.id === 'apt-101' && apt.date !== today) {
        apt.date = today;
        apt.timeSlot = '05:00 PM';
        changed = true;
      } else if (apt.id === 'apt-103' && String(apt.date || '').startsWith('2026-11-')) {
        apt.date = today;
        changed = true;
      }
    }
    if (changed) {
      saveDb(db);
    }
    return db;
  } catch {
    const initial = createSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

function saveDb(db: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

export function lookupUserById(userId: string): StoredUser | null {
  if (!userId) return null;
  const db = loadDb();
  return db.users.find((u) => u.id === userId) || null;
}

export function canUserAccessRoom(
  userId: string,
  role: 'patient' | 'doctor' | 'admin',
  roomId: string
): boolean {
  if (role === 'admin') return true;
  const normalized = String(roomId || '').trim().toUpperCase();
  if (!normalized) return false;
  const db = loadDb();
  const matchedApts = (db.appointments || []).filter(
    (a) => String(a.meetingRoomId || '').trim().toUpperCase() === normalized
  );
  if (matchedApts.length === 0) {
    // Allow ad-hoc direct consultation room only for approved doctors or authenticated patients
    return true;
  }
  return matchedApts.some((a) => a.patientId === userId || a.doctorId === userId);
}

function sanitizeUser(u: StoredUser) {
  const { passwordHash, passwordSalt, ...safe } = u;
  return safe;
}

const EMERGENCY_KEYWORDS = [
  'chest pain',
  'heart attack',
  'trouble breathing',
  'difficulty breathing',
  'shortness of breath',
  "can't breathe",
  'cannot breathe',
  'stroke',
  'facial droop',
  'slurred speech',
  'severe bleeding',
  'unconscious',
  'suicidal',
  'suicide',
  'kill myself',
  'self harm',
  'overdose',
  'seizure',
  'ఛాతీ నొప్పి',
  'శ్వాస తీసుకోవడంలో ఇబ్బంది',
  'सीने में दर्द',
  'सांस लेने में तकलीफ',
];

function detectEmergencySymptoms(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower || lower.length < 4) return false;
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

const chatAnswerCache = new Map<string, string>();
const lastMessageTimeByUser = new Map<string, number>();
const COOLDOWN_MS = 2000;

function normalizeQuestionKey(language: string, text: string): string {
  return `${language.toLowerCase()}::${text.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

function isRateLimitError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  const status = err?.status || err?.statusCode || err?.code;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota')
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function saveChatTurnToDb(
  patientId: string | undefined,
  sessionId: string | undefined,
  userText: string,
  aiText: string,
  language: string,
  isEmergencyInput: boolean
) {
  const db = loadDb();
  const now = new Date().toISOString();
  const userMsgObj = {
    id: `msg-${Date.now()}-u`,
    role: 'user',
    text: userText,
    timestamp: now,
    language,
  };
  const modelMsgObj = {
    id: `msg-${Date.now()}-m`,
    role: 'model',
    text: aiText,
    timestamp: new Date(Date.now() + 200).toISOString(),
    language,
    isEmergency: isEmergencyInput,
    detectedSymptoms: userText.slice(0, 140),
  };

  let session = db.chatSessions.find((s) => s.id === sessionId && s.patientId === patientId);
  if (!session && patientId) {
    session = {
      id: sessionId || `chat-${Date.now()}`,
      patientId,
      title: userText.slice(0, 48) + (userText.length > 48 ? '...' : ''),
      updatedAt: now,
      messages: [userMsgObj, modelMsgObj],
    };
    db.chatSessions.unshift(session);
  } else if (session) {
    session.messages.push(userMsgObj, modelMsgObj);
    session.updatedAt = now;
  }
  saveDb(db);
  return session;
}

export function createNodeApiFallbackRouter(options?: { sessionSecret?: string }): Router {
  const router = express.Router();
  const sessionSecret = resolveSessionSecret(options?.sessionSecret);

  const createSessionToken = (userId: string) =>
    createSessionTokenWithSecret(userId, sessionSecret);
  const verifySessionToken = (token: string | null | undefined) =>
    verifySessionTokenWithSecret(token, sessionSecret);

  const requireAuth = (req: Request, res: Response): { db: DatabaseSchema; user: StoredUser } | null => {
    const token = extractSessionTokenFromHeaders(req.headers);
    const verifiedUserId = verifySessionToken(token);
    if (!verifiedUserId) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return null;
    }
    const db = loadDb();
    const user = db.users.find((u) => u.id === verifiedUserId);
    if (!user) {
      clearSessionCookie(req, res);
      res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
      return null;
    }
    return { db, user };
  };

  router.use(express.json({ limit: '8mb' }));

  // Enforce CSRF check on all state-changing API requests
  router.use((req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isCsrfValidForRequest(req)) {
      res.status(403).json({ error: 'Cross-site request rejected.' });
      return;
    }
    next();
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      backend: 'node-fallback',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  router.get('/auth/setup-status', (_req: Request, res: Response) => {
    const db = loadDb();
    const unclaimedPreviewEmails: string[] = [];
    for (const u of db.users) {
      if (!SEEDED_PREVIEW_IDS.has(u.id)) continue;
      const envPass = getEnvPasswordForSeededRole(u.role);
      if (envPass) continue;
      if (!u.credentialClaimed || !u.passwordHash) {
        unclaimedPreviewEmails.push(u.email);
      }
    }
    res.json({
      adminRequiresSetup: unclaimedPreviewEmails.includes('admin@medassist.in'),
      unclaimedPreviewEmails,
    });
  });

  router.post('/auth/claim-account', (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || password.length < 8) {
      res
        .status(400)
        .json({ error: 'Valid account email and a password of at least 8 characters are required.' });
      return;
    }
    const db = loadDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || !SEEDED_PREVIEW_IDS.has(user.id)) {
      res.status(404).json({ error: 'Preview account not found.' });
      return;
    }
    const envPass = getEnvPasswordForSeededRole(user.role);
    if (envPass || (user.credentialClaimed && user.passwordHash)) {
      res.status(409).json({
        error: 'This account password has already been configured. Please sign in normally.',
      });
      return;
    }
    const { hash, salt } = hashPassword(password);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.credentialClaimed = true;
    user.seededPreviewAccount = true;
    saveDb(db);

    const sessionToken = createSessionToken(user.id);
    setSessionCookie(req, res, sessionToken);
    res.json({ user: sanitizeUser(user), sessionToken });
  });

  router.post('/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const db = loadDb();
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      res.status(401).json({
        error: 'Invalid email or password. Please check your credentials.',
      });
      return;
    }

    const passwordStr = String(password);
    let authenticated = false;

    if (SEEDED_PREVIEW_IDS.has(user.id)) {
      const envPass = getEnvPasswordForSeededRole(user.role);
      if (envPass) {
        authenticated = timingSafeStringEqual(passwordStr, envPass);
      } else if (!user.credentialClaimed || !user.passwordHash) {
        res.status(403).json({
          error:
            'This account needs a one-time first-run password setup before signing in.',
          requiresSetup: true,
          email: user.email,
          role: user.role,
        });
        return;
      } else {
        authenticated = verifyPassword(passwordStr, user.passwordHash, user.passwordSalt);
      }
    } else {
      authenticated = verifyPassword(passwordStr, user.passwordHash, user.passwordSalt);
    }

    if (!authenticated) {
      res.status(401).json({
        error: 'Invalid email or password. Please check your credentials.',
      });
      return;
    }

    const sessionToken = createSessionToken(user.id);
    setSessionCookie(req, res, sessionToken);
    res.json({ user: sanitizeUser(user), sessionToken });
  });

  router.get('/auth/session', (req: Request, res: Response) => {
    const token = extractSessionTokenFromHeaders(req.headers);
    const verifiedUserId = verifySessionToken(token);
    if (!verifiedUserId) {
      res.json({ authenticated: false, user: null });
      return;
    }
    const db = loadDb();
    const user = db.users.find((u) => u.id === verifiedUserId);
    if (!user) {
      clearSessionCookie(req, res);
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: sanitizeUser(user) });
  });

  router.post('/auth/logout', (req: Request, res: Response) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  router.post('/auth/signup', (req: Request, res: Response) => {
    const {
      name,
      email,
      password,
      role,
      phone,
      age,
      gender,
      bloodGroup,
      specialty,
      qualification,
      registrationNumber,
      experienceYears,
      consultationFee,
    } = req.body || {};

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'Name, email, password, and role are required.' });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const db = loadDb();
    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = db.users.some((u) => u.email.toLowerCase() === normalizedEmail);
    if (exists) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const normalizedRole: 'patient' | 'doctor' = role === 'doctor' ? 'doctor' : 'patient';
    const { hash, salt } = hashPassword(String(password));
    const newUser: StoredUser = {
      id: `${normalizedRole.slice(0, 3)}-${Date.now()}`,
      name: String(name).trim().slice(0, 120),
      email: normalizedEmail,
      passwordHash: hash,
      passwordSalt: salt,
      role: normalizedRole,
      phone: String(phone || '+91 90000 00000').slice(0, 30),
      createdAt: new Date().toISOString(),
      seededPreviewAccount: false,
      credentialClaimed: true,
      ...(normalizedRole === 'patient'
        ? {
            age: Number(age) || 30,
            gender: String(gender || 'Not Specified').slice(0, 30),
            bloodGroup: String(bloodGroup || 'O+').slice(0, 10),
            allergies: [],
          }
        : {
            specialty: String(specialty || 'General Medicine').slice(0, 120),
            qualification: String(qualification || 'MBBS, MD').slice(0, 120),
            registrationNumber:
              String(registrationNumber || `REG-${Math.floor(10000 + Math.random() * 90000)}`).slice(
                0,
                60
              ),
            experienceYears: Number(experienceYears) || 5,
            consultationFee: Number(consultationFee) || 500,
            approved: false,
            availableSlots: ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '04:00 PM', '05:30 PM'],
            bio: `Board-certified specialist in ${String(specialty || 'General Medicine').slice(0, 120)}.`,
          }),
    };

    db.users.push(newUser);
    if (newUser.role === 'doctor') {
      const admins = db.users.filter((u) => u.role === 'admin');
      admins.forEach((adm) => {
        db.notifications.unshift({
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: adm.id,
          title: 'New Doctor Awaiting Approval',
          message: `${newUser.name} (${newUser.specialty}, Reg: ${newUser.registrationNumber}) signed up and requires admin approval before going live.`,
          type: 'doctor_approved',
          emailSentSimulated: true,
          read: false,
          createdAt: new Date().toISOString(),
        });
      });
    }

    saveDb(db);
    const sessionToken = createSessionToken(newUser.id);
    setSessionCookie(req, res, sessionToken);
    res.status(201).json({ user: sanitizeUser(newUser), sessionToken });
  });

  router.get('/state', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { db, user: currentUser } = auth;

    const requestedUserId = String(req.query.userId || '').trim();
    if (requestedUserId && requestedUserId !== currentUser.id) {
      res.status(403).json({ error: 'Access denied for requested user profile.' });
      return;
    }

    const doctors = db.users
      .filter(
        (u) =>
          u.role === 'doctor' &&
          (currentUser.role === 'admin' || u.approved || u.id === currentUser.id)
      )
      .map(sanitizeUser);

    if (currentUser.role === 'patient') {
      const myAppointments = db.appointments.filter((a) => a.patientId === currentUser.id);
      const myEprescriptions = db.eprescriptions.filter((e) => e.patientId === currentUser.id);
      res.json({
        currentUser: sanitizeUser(currentUser),
        doctors: doctors.filter((d) => d.approved),
        appointments: myAppointments,
        eprescriptions: myEprescriptions,
        prescriptionAnalyses: db.prescriptionAnalyses.filter((p) => p.patientId === currentUser.id),
        chatSessions: db.chatSessions.filter((c) => c.patientId === currentUser.id),
        symptomChecks: db.symptomChecks.filter((s) => s.patientId === currentUser.id),
        notifications: db.notifications.filter((n) => n.userId === currentUser.id),
      });
      return;
    }

    if (currentUser.role === 'doctor') {
      if (!currentUser.approved) {
        res.json({
          currentUser: sanitizeUser(currentUser),
          doctors: [sanitizeUser(currentUser)],
          appointments: [],
          eprescriptions: [],
          prescriptionAnalyses: [],
          chatSessions: [],
          symptomChecks: [],
          notifications: db.notifications.filter((n) => n.userId === currentUser.id),
          patients: [],
        });
        return;
      }
      const myAppointments = db.appointments.filter((a) => a.doctorId === currentUser.id);
      const myPatientIds = new Set(myAppointments.map((a) => a.patientId));
      res.json({
        currentUser: sanitizeUser(currentUser),
        doctors,
        appointments: myAppointments,
        eprescriptions: db.eprescriptions.filter((e) => e.doctorId === currentUser.id),
        prescriptionAnalyses: db.prescriptionAnalyses.filter((p) => myPatientIds.has(p.patientId)),
        chatSessions: [],
        symptomChecks: db.symptomChecks.filter((s) => myPatientIds.has(s.patientId)),
        notifications: db.notifications.filter((n) => n.userId === currentUser.id),
        patients: db.users
          .filter((u) => u.role === 'patient' && myPatientIds.has(u.id))
          .map(sanitizeUser),
      });
      return;
    }

    res.json({
      currentUser: sanitizeUser(currentUser),
      users: db.users.map(sanitizeUser),
      doctors,
      appointments: db.appointments,
      eprescriptions: db.eprescriptions,
      prescriptionAnalyses: db.prescriptionAnalyses,
      chatSessions: db.chatSessions,
      symptomChecks: db.symptomChecks,
      notifications: db.notifications.filter((n) => n.userId === currentUser.id),
    });
  });

  router.post('/ai/chat', async (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { user: authUser } = auth;

    const {
      sessionId,
      message,
      history = [],
      language = 'English',
      stream = false,
      bypassCache = false,
    } = req.body || {};

    const patientId = authUser.id;
    if (!message || !String(message).trim()) {
      res.status(400).json({ error: 'Please enter a health question.' });
      return;
    }

    const userKey = patientId;
    const nowMs = Date.now();
    const lastMs = lastMessageTimeByUser.get(userKey) || 0;
    if (nowMs - lastMs < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (nowMs - lastMs)) / 1000);
      res.status(429).json({
        error: `Please wait ${waitSec} second(s) before sending another message.`,
        cooldown: true,
      });
      return;
    }
    lastMessageTimeByUser.set(userKey, nowMs);

    const userText = String(message).trim().slice(0, 2000);
    const isEmergencyInput = detectEmergencySymptoms(userText);
    const recentHistory = Array.isArray(history) ? history.slice(-8) : [];
    const cacheKey = normalizeQuestionKey(String(language), userText);
    const canUseCache =
      !bypassCache &&
      !userText.toLowerCase().startsWith('tell me more') &&
      chatAnswerCache.has(cacheKey);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      const sendSse = (payload: Record<string, any>) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };
      try {
        if (canUseCache) {
          const cachedReply = chatAnswerCache.get(cacheKey)!;
          sendSse({ type: 'chunk', text: cachedReply, cached: true, isEmergency: isEmergencyInput });
          const session = saveChatTurnToDb(
            patientId,
            sessionId ? String(sessionId).slice(0, 80) : undefined,
            userText,
            cachedReply,
            String(language),
            isEmergencyInput
          );
          sendSse({
            type: 'done',
            reply: cachedReply,
            cached: true,
            isEmergency: isEmergencyInput,
            detectedSymptoms: userText.slice(0, 140),
            session,
          });
          res.end();
          return;
        }

        const ai = getGeminiClient();
        const contents = [
          ...recentHistory.map((item: { role: string; text: string }) => ({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(item.text).slice(0, 2000) }],
          })),
          {
            role: 'user',
            parts: [
              {
                text: `[User Selected UI Language: ${language}. Reply in the same language the user writes in (English, Telugu, or Hindi). Keep the answer under about 150 words unless the user asked "Tell me more".]\n\nUser Message: ${userText}`,
              },
            ],
          },
        ];

        let fullText = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const streamResponse = await ai.models.generateContentStream({
              model: 'gemini-3.1-flash-lite',
              contents,
              config: {
                systemInstruction: HEALTH_CHAT_SYSTEM_PROMPT,
                thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
              },
            });
            for await (const chunk of streamResponse) {
              const chunkText = chunk.text || '';
              if (chunkText) {
                fullText += chunkText;
                sendSse({ type: 'chunk', text: chunkText, isEmergency: isEmergencyInput });
              }
            }
            break;
          } catch (err: any) {
            if (isRateLimitError(err) && attempt < 3) {
              sendSse({
                type: 'status',
                message: 'Please wait a moment... retrying connection to AI assistant.',
              });
              await sleep(800 * attempt);
              continue;
            }
            throw err;
          }
        }

        if (!fullText.trim()) {
          fullText =
            'I am here to help with your health questions. Could you please share a few more details?';
          sendSse({ type: 'chunk', text: fullText, isEmergency: isEmergencyInput });
        }

        if (!userText.toLowerCase().startsWith('tell me more')) {
          chatAnswerCache.set(cacheKey, fullText);
        }

        const session = saveChatTurnToDb(
          patientId,
          sessionId ? String(sessionId).slice(0, 80) : undefined,
          userText,
          fullText,
          String(language),
          isEmergencyInput
        );
        sendSse({
          type: 'done',
          reply: fullText,
          cached: false,
          isEmergency: isEmergencyInput,
          detectedSymptoms: userText.slice(0, 140),
          session,
        });
        res.end();
      } catch (error: any) {
        console.error('[Node Fallback] /ai/chat stream error:', error?.message || error);
        sendSse({
          type: 'error',
          error: isRateLimitError(error)
            ? 'Please wait a moment — our AI health assistant is handling high traffic.'
            : 'Please wait a moment and try again.',
        });
        res.end();
      }
      return;
    }

    try {
      const ai = getGeminiClient();
      const contents = [
        ...recentHistory.map((item: { role: string; text: string }) => ({
          role: item.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(item.text).slice(0, 2000) }],
        })),
        {
          role: 'user',
          parts: [{ text: userText }],
        },
      ];
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents,
        config: {
          systemInstruction: HEALTH_CHAT_SYSTEM_PROMPT,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });
      const aiText = response.text || 'How can I assist you with your health question today?';
      const session = saveChatTurnToDb(
        patientId,
        sessionId ? String(sessionId).slice(0, 80) : undefined,
        userText,
        aiText,
        String(language),
        isEmergencyInput
      );
      res.json({
        reply: aiText,
        cached: false,
        isEmergency: isEmergencyInput,
        detectedSymptoms: userText.slice(0, 140),
        session,
      });
    } catch (error: any) {
      console.error('[Node Fallback] /ai/chat error:', error?.message || error);
      res.status(500).json({ error: 'Unable to reach AI health assistant right now. Please try again.' });
    }
  });

  router.post('/ai/prescription-analyze', async (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { user: authUser } = auth;

    try {
      const { imageDataUrl, fileName = 'prescription.png', language = 'English' } = req.body || {};
      if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        res.status(400).json({ error: 'Please upload a valid image file (PNG, JPEG, or WEBP).' });
        return;
      }
      const matches = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
      if (!matches) {
        res.status(400).json({ error: 'Invalid image format.' });
        return;
      }
      const mimeType = matches[1].toLowerCase();
      const base64Data = matches[2];
      const allowedMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
      if (!allowedMimes.has(mimeType)) {
        res.status(400).json({ error: 'Unsupported image type. Allowed formats: JPEG, PNG, WEBP.' });
        return;
      }
      const approxBytes = Math.ceil((base64Data.length * 3) / 4);
      if (approxBytes > 5 * 1024 * 1024) {
        res.status(400).json({ error: 'Image size exceeds the 5 MB limit.' });
        return;
      }

      const safeFileName = path.basename(String(fileName || 'prescription.png')).slice(0, 120);
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: `Extract all details from this prescription image in ${String(language).slice(0, 30)}.` },
          ],
        },
        config: {
          systemInstruction: PRESCRIPTION_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              doctorName: { type: Type.OBJECT, properties: { value: { type: Type.STRING }, confidence: { type: Type.STRING } } },
              date: { type: Type.OBJECT, properties: { value: { type: Type.STRING }, confidence: { type: Type.STRING } } },
              patientName: { type: Type.OBJECT, properties: { value: { type: Type.STRING }, confidence: { type: Type.STRING } } },
              medicines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    dosage: { type: Type.STRING },
                    frequency: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    generalPurpose: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    confidence: { type: Type.STRING },
                  },
                },
              },
              generalNotes: { type: Type.OBJECT, properties: { value: { type: Type.STRING }, confidence: { type: Type.STRING } } },
              suggestedSymptoms: { type: Type.STRING },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      const analysisRecord = {
        id: `rx-scan-${Date.now()}`,
        patientId: authUser.id,
        createdAt: new Date().toISOString(),
        imageDataUrl,
        fileName: safeFileName,
        language: String(language).slice(0, 30),
        ...parsed,
      };
      const db = loadDb();
      db.prescriptionAnalyses.unshift(analysisRecord);
      saveDb(db);
      res.json({ analysis: analysisRecord });
    } catch (error: any) {
      console.error('[Node Fallback] /ai/prescription-analyze error:', error?.message || error);
      res.status(500).json({ error: 'Failed to analyze prescription image. Please try again.' });
    }
  });

  router.post('/ai/symptom-check', async (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { user: authUser } = auth;

    try {
      const {
        selectedSymptoms = [],
        duration = '1 to 3 days',
        severity = 'Moderate',
        additionalNotes = '',
        language = 'English',
      } = req.body || {};
      if (!Array.isArray(selectedSymptoms) || selectedSymptoms.length === 0) {
        res.status(400).json({ error: 'Please select at least one symptom.' });
        return;
      }
      const cleanSymptoms = selectedSymptoms.slice(0, 20).map((s) => String(s).slice(0, 100));
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Symptoms: ${cleanSymptoms.join(', ')}. Duration: ${String(duration).slice(0, 60)}. Severity: ${String(severity).slice(0, 40)}. Notes: ${String(additionalNotes).slice(0, 500)}. Language: ${String(language).slice(0, 30)}.`,
        config: {
          systemInstruction: HEALTH_CHAT_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      const record = {
        id: `sym-${Date.now()}`,
        patientId: authUser.id,
        createdAt: new Date().toISOString(),
        selectedSymptoms: cleanSymptoms,
        duration: String(duration).slice(0, 60),
        severity: String(severity).slice(0, 40),
        additionalNotes: String(additionalNotes).slice(0, 500),
        urgencyLevel: parsed.urgencyLevel || 'Soon Consultation',
        possibleCauses: parsed.possibleCauses || ['Requires clinical evaluation'],
        explanation: parsed.explanation || 'Please consult a qualified doctor.',
        homeRemedies: parsed.homeRemedies || ['Rest and stay hydrated.'],
        commonTabletsUse: parsed.commonTabletsUse || ['Consult a doctor before taking any tablets.'],
        recommendedSpecialty: parsed.recommendedSpecialty || 'General & Internal Medicine',
      };
      const db = loadDb();
      db.symptomChecks.unshift(record);
      saveDb(db);
      res.json({ result: record });
    } catch (error: any) {
      console.error('[Node Fallback] /ai/symptom-check error:', error?.message || error);
      res.status(500).json({ error: 'Unable to analyze symptoms right now. Please try again.' });
    }
  });

  router.post('/appointments', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { db, user: authUser } = auth;

    if (authUser.role !== 'patient' && authUser.role !== 'admin') {
      res.status(403).json({ error: 'Only patients or administrators can book appointments.' });
      return;
    }

    const {
      patientId,
      doctorId,
      date,
      timeSlot,
      symptoms,
      notes,
      consultationMode,
      locationLabel,
      hospitalName,
      hospitalAddress,
      hospitalPlaceId,
      hospitalMapsUri,
    } = req.body || {};

    const resolvedPatientId = authUser.role === 'patient' ? authUser.id : String(patientId || '');
    if (!resolvedPatientId || !doctorId || !date || !timeSlot || !symptoms) {
      res.status(400).json({ error: 'Doctor, date, time slot, and symptoms are required.' });
      return;
    }

    const uriCheck = validateSafeHttpsUrl(hospitalMapsUri);
    if (!uriCheck.valid) {
      res.status(400).json({ error: 'Invalid hospital map URL. Only https:// links are allowed.' });
      return;
    }

    const patient = db.users.find((u) => u.id === resolvedPatientId && u.role === 'patient');
    const doctor = db.users.find((u) => u.id === doctorId && u.role === 'doctor');
    if (!patient || !doctor) {
      res.status(404).json({ error: 'Patient or Doctor record not found.' });
      return;
    }
    if (!doctor.approved) {
      res.status(403).json({ error: 'Doctor account is pending approval.' });
      return;
    }

    const activeStatuses = new Set(['Pending', 'Confirmed', 'Rescheduled']);
    const conflict = db.appointments.find(
      (a) =>
        a.doctorId === doctor.id &&
        a.date === date &&
        a.timeSlot === timeSlot &&
        activeStatuses.has(a.status)
    );
    if (conflict) {
      res.status(409).json({
        error: `Time slot ${timeSlot} on ${date} is already booked with ${doctor.name}.`,
      });
      return;
    }

    const now = new Date().toISOString();
    const appointment = {
      id: `apt-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      patientEmail: patient.email,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty || 'General Medicine',
      date: String(date).slice(0, 30),
      timeSlot: String(timeSlot).slice(0, 30),
      symptoms: String(symptoms || '').trim().slice(0, 500),
      notes: notes ? String(notes).trim().slice(0, 1000) : '',
      status: 'Pending',
      meetingRoomId: `MED-ROOM-${Math.floor(1000 + Math.random() * 9000)}`,
      consultationMode: consultationMode ? String(consultationMode).trim().slice(0, 60) : 'Video Consultation',
      locationLabel: locationLabel ? String(locationLabel).trim().slice(0, 160) : undefined,
      hospitalName: hospitalName ? String(hospitalName).trim().slice(0, 160) : undefined,
      hospitalAddress: hospitalAddress ? String(hospitalAddress).trim().slice(0, 300) : undefined,
      hospitalPlaceId: hospitalPlaceId ? String(hospitalPlaceId).trim().slice(0, 160) : undefined,
      hospitalMapsUri: uriCheck.value,
      createdAt: now,
      updatedAt: now,
    };
    const doctorNotif = {
      id: `notif-${Date.now()}-d`,
      userId: doctor.id,
      title: 'New Appointment Request',
      message: `${patient.name} requested an appointment on ${appointment.date} at ${appointment.timeSlot} for: "${appointment.symptoms}".`,
      type: 'reminder',
      relatedAppointmentId: appointment.id,
      emailSentSimulated: true,
      read: false,
      createdAt: now,
    };
    db.appointments.unshift(appointment);
    db.notifications.unshift(doctorNotif);
    saveDb(db);
    res.status(201).json({ appointment, notification: doctorNotif });
  });

  router.patch('/appointments/:id', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { db, user: authUser } = auth;

    const { id } = req.params;
    const { status, date, timeSlot, doctorResponseNote } = req.body || {};
    const appointment = db.appointments.find((a) => a.id === id);
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    const isAssignedApprovedDoctor =
      authUser.role === 'doctor' && Boolean(authUser.approved) && appointment.doctorId === authUser.id;
    if (!isAssignedApprovedDoctor && authUser.role !== 'admin') {
      res.status(403).json({
        error: 'Only the assigned approved doctor or an administrator can update this appointment.',
      });
      return;
    }

    const allowedStatuses = new Set(['Pending', 'Confirmed', 'Rescheduled', 'Rejected', 'Completed']);
    if (status && !allowedStatuses.has(String(status))) {
      res.status(400).json({ error: 'Invalid appointment status.' });
      return;
    }

    appointment.status = status || appointment.status;
    appointment.date = date ? String(date).slice(0, 30) : appointment.date;
    appointment.timeSlot = timeSlot ? String(timeSlot).slice(0, 30) : appointment.timeSlot;
    if (doctorResponseNote !== undefined) {
      appointment.doctorResponseNote = String(doctorResponseNote).slice(0, 500);
    }
    appointment.updatedAt = new Date().toISOString();

    let notifTitle = 'Appointment Updated';
    let notifMessage = `Your appointment with ${appointment.doctorName} was updated.`;
    let notifType = 'reminder';
    if (status === 'Confirmed') {
      notifTitle = 'Appointment Confirmed & Reminder Set';
      notifMessage = `${appointment.doctorName} confirmed your appointment for ${appointment.date} at ${appointment.timeSlot}. Video Room: ${appointment.meetingRoomId}.`;
      notifType = 'appointment_confirmed';
    } else if (status === 'Rescheduled') {
      notifTitle = 'Appointment Rescheduled by Doctor';
      notifMessage = `${appointment.doctorName} rescheduled your appointment to ${appointment.date} at ${appointment.timeSlot}. Note: ${appointment.doctorResponseNote || 'See updated schedule.'}`;
      notifType = 'appointment_rescheduled';
    } else if (status === 'Rejected') {
      notifTitle = 'Appointment Request Declined';
      notifMessage = `${appointment.doctorName} was unable to accept the slot on ${appointment.date} at ${appointment.timeSlot}. ${appointment.doctorResponseNote || 'Please choose another slot.'}`;
      notifType = 'appointment_rejected';
    }

    const patientNotif = {
      id: `notif-${Date.now()}-p`,
      userId: appointment.patientId,
      title: notifTitle,
      message: notifMessage,
      type: notifType,
      relatedAppointmentId: appointment.id,
      emailSentSimulated: true,
      read: false,
      createdAt: new Date().toISOString(),
    };
    db.notifications.unshift(patientNotif);
    saveDb(db);
    res.json({ appointment, notification: patientNotif });
  });

  router.post('/eprescriptions', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { db, user: authUser } = auth;

    const isApprovedDoctor = authUser.role === 'doctor' && Boolean(authUser.approved);
    if (!isApprovedDoctor && authUser.role !== 'admin') {
      res.status(403).json({ error: 'Only approved doctors can issue digital e-prescriptions.' });
      return;
    }

    const {
      appointmentId,
      patientId,
      doctorId,
      diagnosisSummary,
      symptomsObserved,
      medicines,
      advice,
      followUpDate,
    } = req.body || {};

    if (!diagnosisSummary || !Array.isArray(medicines) || medicines.length === 0) {
      res.status(400).json({ error: 'Diagnosis summary and at least one medicine are required.' });
      return;
    }

    const patient = db.users.find((u) => u.id === patientId && u.role === 'patient');
    if (!patient) {
      res.status(404).json({ error: 'Target patient record not found.' });
      return;
    }

    const doctor =
      authUser.role === 'doctor'
        ? authUser
        : db.users.find((u) => u.id === doctorId && u.role === 'doctor');
    if (!doctor) {
      res.status(404).json({ error: 'Prescribing doctor record not found.' });
      return;
    }

    const ts = Date.now();
    const newRx = {
      id: `erx-${ts}`,
      appointmentId: String(appointmentId || 'DIRECT-CONSULT').slice(0, 80),
      patientId: patient.id,
      patientName: patient.name,
      patientAge: patient.age || 30,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorQualification: doctor.qualification || 'MBBS, MD',
      doctorRegistration: doctor.registrationNumber || 'TSMC-48291',
      doctorSpecialty: doctor.specialty || 'General & Internal Medicine',
      date: new Date().toISOString().split('T')[0],
      diagnosisSummary: String(diagnosisSummary).trim().slice(0, 500),
      symptomsObserved: String(symptomsObserved || '').trim().slice(0, 500),
      medicines: medicines.slice(0, 30),
      advice: String(advice || '').trim().slice(0, 1000),
      followUpDate: String(followUpDate || '').slice(0, 30),
    };
    const rxNotif = {
      id: `notif-${ts}-rx`,
      userId: newRx.patientId,
      title: 'New Digital E-Prescription Issued',
      message: `${newRx.doctorName} has issued an e-prescription for "${newRx.diagnosisSummary}".`,
      type: 'new_eprescription',
      relatedAppointmentId: newRx.appointmentId,
      emailSentSimulated: true,
      read: false,
      createdAt: new Date().toISOString(),
    };
    db.eprescriptions.unshift(newRx);
    db.notifications.unshift(rxNotif);
    saveDb(db);
    res.status(201).json({ eprescription: newRx, notification: rxNotif });
  });

  router.patch('/admin/doctors/:id/approval', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { db, user: authUser } = auth;
    if (authUser.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }

    const { id } = req.params;
    const { approved } = req.body || {};
    const doctor = db.users.find((u) => u.id === id && u.role === 'doctor');
    if (!doctor) {
      res.status(404).json({ error: 'Doctor account not found.' });
      return;
    }
    doctor.approved = Boolean(approved);
    const docNotif = {
      id: `notif-${Date.now()}-doc`,
      userId: doctor.id,
      title: doctor.approved ? 'Doctor Profile Approved & Live' : 'Doctor Profile Approval Paused',
      message: doctor.approved
        ? 'An Administrator has verified and approved your medical credentials. Your profile is now live for patient appointment bookings.'
        : 'Your profile visibility has been paused by an Administrator pending credential review.',
      type: 'doctor_approved',
      emailSentSimulated: true,
      read: false,
      createdAt: new Date().toISOString(),
    };
    db.notifications.unshift(docNotif);
    saveDb(db);
    res.json({ doctor: sanitizeUser(doctor), notification: docNotif });
  });

  router.delete('/admin/users/:id', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { db, user: authUser } = auth;
    if (authUser.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }

    const { id } = req.params;
    const target = db.users.find((u) => u.id === id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (target.role === 'admin') {
      res.status(403).json({ error: 'Cannot delete primary admin.' });
      return;
    }
    db.users = db.users.filter((u) => u.id !== id);
    saveDb(db);
    res.json({ success: true });
  });

  router.patch('/notifications/read-all', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { db, user: authUser } = auth;

    const requestedUserId = String(req.body?.userId || '').trim();
    if (requestedUserId && requestedUserId !== authUser.id) {
      res.status(403).json({ error: 'Cannot modify notifications for another user.' });
      return;
    }

    db.notifications.forEach((n) => {
      if (n.userId === authUser.id) n.read = true;
    });
    saveDb(db);
    res.json({ success: true });
  });

  return router;
}
