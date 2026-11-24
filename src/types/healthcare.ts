/**
 * Core Domain Types for AI Virtual Healthcare Assistant
 * Supports Role-Based Access Control (Patient, Doctor, Admin),
 * Gemini AI Health Chat, Prescription Analysis, Symptom Checking,
 * Appointment Scheduling, Video Consultations, and E-Prescriptions.
 */

export type UserRole = 'patient' | 'doctor' | 'admin';

export type SupportedLanguage = 'English' | 'Telugu' | 'Hindi';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  createdAt: string;
  // Patient-specific fields
  age?: number;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[];
  // Doctor-specific fields
  specialty?: string;
  qualification?: string;
  registrationNumber?: string;
  experienceYears?: number;
  consultationFee?: number;
  approved?: boolean; // Doctors must be approved by Admin before going live
  availableSlots?: string[];
  bio?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  language: SupportedLanguage;
  isEmergency?: boolean;
  detectedSymptoms?: string;
}

export interface ChatSession {
  id: string;
  patientId: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface ExtractedField {
  value: string;
  confidence: ConfidenceLevel;
}

export interface ExtractedMedicine {
  name: string;
  dosage: string;
  frequency: string;
  timing?: string;
  duration: string;
  generalPurpose: string;
  notes: string;
  confidence: ConfidenceLevel;
  confidenceScore?: number;
}

export interface DrugInteractionAlert {
  detected: boolean;
  severity: 'High' | 'Moderate';
  title: string;
  interactingMedicines: string[];
  explanation: string;
  recommendation: string;
}

export interface PrescriptionAnalysisResult {
  id: string;
  patientId: string;
  createdAt: string;
  imageDataUrl: string;
  fileName: string;
  doctorName: ExtractedField;
  date: ExtractedField;
  patientName: ExtractedField;
  medicines: ExtractedMedicine[];
  generalNotes: ExtractedField;
  suggestedSymptoms: string;
  language: SupportedLanguage;
  drugInteractionAlert?: DrugInteractionAlert | null;
}

export type AppointmentStatus = 'Pending' | 'Confirmed' | 'Rejected' | 'Rescheduled' | 'Completed';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:00 AM"
  symptoms: string;
  notes?: string;
  status: AppointmentStatus;
  doctorResponseNote?: string;
  meetingRoomId: string;
  consultationMode?: 'Video Consultation' | 'Hospital Visit';
  locationLabel?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPlaceId?: string;
  hospitalMapsUri?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EPrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface EPrescription {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientAge?: number;
  doctorId: string;
  doctorName: string;
  doctorQualification: string;
  doctorRegistration: string;
  doctorSpecialty: string;
  date: string;
  diagnosisSummary: string;
  symptomsObserved: string;
  medicines: EPrescriptionMedicine[];
  advice: string;
  followUpDate?: string;
}

export interface SymptomCheckRecord {
  id: string;
  patientId: string;
  createdAt: string;
  selectedSymptoms: string[];
  duration: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  additionalNotes: string;
  urgencyLevel: 'Routine Care' | 'Soon Consultation' | 'Urgent Medical Attention' | 'Emergency - Call 108/112';
  possibleCauses: string[];
  explanation: string;
  homeRemedies?: string[];
  commonTabletsUse?: string[];
  recommendedSpecialty: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'appointment_confirmed' | 'appointment_rescheduled' | 'appointment_rejected' | 'new_eprescription' | 'doctor_approved' | 'reminder';
  relatedAppointmentId?: string;
  emailSentSimulated?: boolean;
  read: boolean;
  createdAt: string;
}

export interface PatientVitalRecord {
  id: string;
  patientId: string;
  recordedAt: string;
  systolicBp: number;
  diastolicBp: number;
  heartRate: number;
  spo2: number;
  temperatureF: number;
  bloodGlucoseMgDl: number;
  notes?: string;
}

