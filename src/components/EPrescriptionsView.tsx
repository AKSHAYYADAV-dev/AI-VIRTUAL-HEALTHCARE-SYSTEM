import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Eye,
  Printer,
  X,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  EPrescription,
  EPrescriptionMedicine,
  Appointment,
  User,
} from '../types/healthcare';
import { downloadEPrescriptionPDF } from '../utils/pdfExport';
import {
  checkAllergyConflicts,
  computeRxVerificationCode,
  generateVerificationQrMatrix,
} from '../utils/clinicalSafety';

interface EPrescriptionsViewProps {
  currentUser: User;
  eprescriptions: EPrescription[];
  appointments: Appointment[];
  patients?: User[];
  doctors?: User[];
  preselectedAppointment?: Appointment | null;
  onEPrescriptionCreated: (rx: EPrescription) => void;
}

export const EPrescriptionsView: React.FC<EPrescriptionsViewProps> = ({
  currentUser,
  eprescriptions,
  appointments,
  patients = [],
  doctors = [],
  preselectedAppointment,
  onEPrescriptionCreated,
}) => {
  const [showWriterForm, setShowWriterForm] = useState<boolean>(
    currentUser.role === 'doctor' || Boolean(preselectedAppointment)
  );
  const [previewRx, setPreviewRx] = useState<EPrescription | null>(null);

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    currentUser.role === 'patient'
      ? currentUser.id
      : preselectedAppointment?.patientId ||
          appointments[0]?.patientId ||
          patients[0]?.id ||
          'pat-1'
  );
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    currentUser.role === 'doctor'
      ? currentUser.id
      : preselectedAppointment?.doctorId ||
          appointments[0]?.doctorId ||
          doctors[0]?.id ||
          'doc-1'
  );
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(
    preselectedAppointment?.id || appointments[0]?.id || 'DIRECT-CONSULT'
  );
  const [diagnosisSummary, setDiagnosisSummary] = useState<string>(
    'Acute Viral Upper Respiratory Infection'
  );
  const [symptomsObserved, setSymptomsObserved] = useState<string>(
    preselectedAppointment?.symptoms || 'Low-grade fever, dry cough, mild pharyngitis'
  );
  const [advice, setAdvice] = useState<string>(
    'Drink plenty of warm fluids, take adequate rest, and perform warm saline gargles twice daily.'
  );
  const [followUpDate, setFollowUpDate] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [medicines, setMedicines] = useState<EPrescriptionMedicine[]>([
    {
      name: 'Tab. Paracetamol',
      dosage: '650 mg',
      frequency: 'Twice daily (after food)',
      duration: '3 Days',
      instructions: 'Take with water after meals if fever exceeds 99.5°F',
    },
    {
      name: 'Tab. Cetirizine',
      dosage: '10 mg',
      frequency: 'Once daily at bedtime',
      duration: '5 Days',
      instructions: 'Take before sleep',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync preselected appointment when navigating from Video Consultation or Appointments
  useEffect(() => {
    if (preselectedAppointment) {
      setShowWriterForm(true);
      setSelectedPatientId(preselectedAppointment.patientId);
      setSelectedDoctorId(preselectedAppointment.doctorId);
      setSelectedAppointmentId(preselectedAppointment.id);
      setSymptomsObserved(preselectedAppointment.symptoms);
    }
  }, [preselectedAppointment]);

  // Keep selected patient/doctor valid when async lists arrive
  useEffect(() => {
    if (currentUser.role === 'patient') {
      setSelectedPatientId(currentUser.id);
    } else if (patients.length > 0 && !patients.some((p) => p.id === selectedPatientId)) {
      setSelectedPatientId(patients[0].id);
    }
  }, [currentUser, patients, selectedPatientId]);

  useEffect(() => {
    if (currentUser.role === 'doctor') {
      setSelectedDoctorId(currentUser.id);
    } else if (doctors.length > 0 && !doctors.some((d) => d.id === selectedDoctorId)) {
      setSelectedDoctorId(doctors[0].id);
    }
  }, [currentUser, doctors, selectedDoctorId]);

  const handleAddMedicineRow = () => {
    setMedicines((prev) => [
      ...prev,
      {
        name: '',
        dosage: '',
        frequency: 'Twice daily',
        duration: '5 Days',
        instructions: 'After meals',
      },
    ]);
  };

  const handleRemoveMedicineRow = (idx: number) => {
    if (medicines.length <= 1) return;
    setMedicines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMedicineChange = (
    idx: number,
    field: keyof EPrescriptionMedicine,
    val: string
  ) => {
    setMedicines((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: val } : m))
    );
  };

  const handleIssueEPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const validMeds = medicines.filter((m) => m.name.trim() && m.dosage.trim());
    if (!diagnosisSummary.trim() || validMeds.length === 0) {
      setError('Please enter a diagnosis summary and at least one medicine with dosage.');
      return;
    }

    setLoading(true);
    try {
      const targetPatient = patients.find((p) => p.id === selectedPatientId);
      const response = await fetch('/api/eprescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: selectedAppointmentId || 'DIRECT-CONSULT',
          patientId: currentUser.role === 'patient' ? currentUser.id : selectedPatientId,
          patientName:
            currentUser.role === 'patient'
              ? currentUser.name
              : targetPatient?.name || preselectedAppointment?.patientName,
          doctorId: currentUser.role === 'doctor' ? currentUser.id : selectedDoctorId,
          diagnosisSummary,
          symptomsObserved,
          medicines: validMeds,
          advice,
          followUpDate,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not issue e-prescription.');
      }
      onEPrescriptionCreated(data.eprescription);
      setPreviewRx(data.eprescription);
      setSuccessMsg(
        `Digital E-Prescription (${data.eprescription.id.toUpperCase()}) generated for ${data.eprescription.patientName}! You can now view, print, or download the PDF below.`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to save e-prescription.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdfWithFeedback = (rx: EPrescription) => {
    try {
      downloadEPrescriptionPDF(rx);
      setSuccessMsg(
        `Downloading official PDF for E-Prescription ${rx.id.toUpperCase()} (${rx.patientName})...`
      );
    } catch {
      setPreviewRx(rx);
    }
  };

  return (
    <div className="fade-slide-up space-y-6">
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] text-xs text-[var(--color-forest)] font-semibold flex items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[var(--color-forest)] shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-[var(--color-forest)] hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Action Header for Patients or Doctors to toggle the E-Prescription Generator */}
      <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-forest)]">
            {currentUser.role === 'doctor'
              ? 'Clinical Digital E-Prescription Pad'
              : 'Official Digital E-Prescriptions & PDF Records'}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {currentUser.role === 'doctor'
              ? 'Write and issue signed digital e-prescriptions for your telemedicine patients.'
              : 'View your full prescription pad, print, download official PDFs, or generate an e-prescription from your consultation.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowWriterForm((prev) => !prev)}
          className="btn-forest-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>
            {showWriterForm
              ? 'Hide E-Prescription Builder'
              : currentUser.role === 'doctor'
              ? 'Write New E-Prescription'
              : 'Generate New E-Prescription'}
          </span>
        </button>
      </div>

      {/* E-PRESCRIPTION WRITER / GENERATOR FORM (Available for Doctors & Patients) */}
      {showWriterForm && (
        <form
          onSubmit={handleIssueEPrescription}
          className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-5"
        >
          <div className="border-b border-[var(--color-leaf-border)] pb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[var(--color-forest)]">
                {currentUser.role === 'doctor'
                  ? 'Write Digital E-Prescription'
                  : 'Generate Digital Consultation E-Prescription'}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Issued prescriptions are immediately saved to your health timeline and ready for PDF download.
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-[var(--color-forest)] bg-[var(--color-leaf)] px-3 py-1 rounded-xl font-bold">
              {currentUser.role === 'doctor'
                ? `Prescriber: ${currentUser.name} (${currentUser.registrationNumber || 'Verified MD'})`
                : `Patient: ${currentUser.name}`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentUser.role === 'doctor' ? (
              <div>
                <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
                  Select Patient
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
                >
                  {patients.length > 0 ? (
                    patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.age || 30}Y / {p.bloodGroup || 'O+'})
                      </option>
                    ))
                  ) : (
                    <option value="pat-1">Rohan Verma (34Y / O+)</option>
                  )}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
                  Prescribing Specialist Doctor
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
                >
                  {doctors.length > 0 ? (
                    doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialty || 'General Medicine'})
                      </option>
                    ))
                  ) : (
                    <option value="doc-1">Dr. Aarav Mehta (General &amp; Internal Medicine)</option>
                  )}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
                Linked Appointment Reference
              </label>
              <select
                value={selectedAppointmentId}
                onChange={(e) => {
                  setSelectedAppointmentId(e.target.value);
                  const found = appointments.find((a) => a.id === e.target.value);
                  if (found) {
                    setSelectedPatientId(found.patientId);
                    setSelectedDoctorId(found.doctorId);
                    setSymptomsObserved(found.symptoms);
                  }
                }}
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              >
                <option value="DIRECT-CONSULT">Direct Telemedicine Consult</option>
                {appointments.map((apt) => (
                  <option key={apt.id} value={apt.id}>
                    {apt.id.toUpperCase()} ·{' '}
                    {currentUser.role === 'doctor' ? apt.patientName : apt.doctorName} ({apt.date})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
                Follow-Up Date
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono-tabular bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
                Provisional Diagnosis / Clinical Impression *
              </label>
              <input
                type="text"
                required
                value={diagnosisSummary}
                onChange={(e) => setDiagnosisSummary(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
                Symptoms &amp; Clinical Observations
              </label>
              <input
                type="text"
                value={symptomsObserved}
                onChange={(e) => setSymptomsObserved(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
              />
            </div>
          </div>

          {/* Medicines Builder + Real-Time Allergy Guardrail */}
          {(() => {
            const activePatient =
              currentUser.role === 'patient'
                ? currentUser
                : patients.find((p) => p.id === selectedPatientId);
            const knownAllergies = activePatient?.allergies || [];
            const allergyConflicts = checkAllergyConflicts(
              medicines.map((m) => m.name),
              knownAllergies
            );
            return (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-bold text-[var(--color-forest)]">
                      Rx — Prescribed Medications
                    </label>
                    {knownAllergies.length > 0 && (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-[var(--color-leaf)] text-[var(--color-forest)] border border-[var(--color-leaf-border)]">
                        Allergy Guardrail: {knownAllergies.join(', ')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMedicineRow}
                    className="btn-forest-secondary inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Medicine</span>
                  </button>
                </div>

                {allergyConflicts.length > 0 && (
                  <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-400 text-red-950 space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-xs text-red-800">
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                      <span>
                        ALLERGY CONTRAINDICATION WARNING ({allergyConflicts.length} detected)
                      </span>
                    </div>
                    {allergyConflicts.map((c, idx) => (
                      <p key={idx} className="text-xs leading-relaxed">
                        <strong>{c.medicineName}</strong> conflicts with patient&apos;s documented{' '}
                        <strong>{c.matchedAllergy}</strong> allergy — {c.reason}
                      </p>
                    ))}
                  </div>
                )}

            {medicines.map((med, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3.5 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] items-center"
              >
                <div className="sm:col-span-3">
                  <input
                    type="text"
                    required
                    placeholder="Medicine Name (e.g. Tab. Amoxicillin)"
                    value={med.name}
                    onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    placeholder="Dosage (e.g. 500 mg)"
                    value={med.dosage}
                    onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Frequency"
                    value={med.frequency}
                    onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Duration (e.g. 5 Days)"
                    value={med.duration}
                    onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Instructions"
                    value={med.instructions}
                    onChange={(e) =>
                      handleMedicineChange(idx, 'instructions', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    disabled={medicines.length <= 1}
                    onClick={() => handleRemoveMedicineRow(idx)}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-red-600 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
              </div>
            );
          })()}

          <div>
            <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
              General Dietary &amp; Care Advice
            </label>
            <textarea
              rows={2}
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowWriterForm(false)}
              className="btn-forest-secondary px-5 py-2.5 text-xs font-bold rounded-xl cursor-pointer"
            >
              Close Form
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-forest-primary px-6 py-3 disabled:opacity-50 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              {loading ? 'Issuing E-Prescription...' : 'Issue & Save Digital E-Prescription'}
            </button>
          </div>
        </form>
      )}

      {/* IN-APP OFFICIAL PRESCRIPTION PAD PREVIEW MODAL */}
      {previewRx && (
        <div className="bg-white border-2 border-[var(--color-forest)] rounded-3xl shadow-md overflow-hidden">
          {/* Official Forest Green Hospital Letterhead */}
          <div className="bg-[var(--color-forest)] text-white p-6 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-tabular font-bold text-[var(--color-leaf)]">
                <ShieldCheck className="w-4 h-4" />
                <span>OFFICIAL DIGITAL TELEMEDICINE E-PRESCRIPTION</span>
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-white">
                AI VIRTUAL HEALTHCARE ASSISTANT
              </h3>
              <p className="text-xs text-white/85 font-mono-tabular">
                Prescription ID: {previewRx.id.toUpperCase()} · Issued: {previewRx.date}
              </p>
            </div>

            <div className="text-left sm:text-right space-y-0.5">
              <div className="text-sm font-bold text-[var(--color-leaf)]">
                {previewRx.doctorName}
              </div>
              <div className="text-xs text-white/90">
                {previewRx.doctorQualification} · {previewRx.doctorSpecialty}
              </div>
              <div className="text-xs font-mono-tabular text-white/80">
                Medical Council Reg. No: {previewRx.doctorRegistration}
              </div>
            </div>
          </div>

          {/* Prescription Pad Body */}
          <div className="p-6 sm:p-7 space-y-5 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] text-xs">
              <div>
                <span className="text-[var(--color-text-muted)] block">Patient Name:</span>
                <strong className="text-[var(--color-forest)] text-sm">
                  {previewRx.patientName} ({previewRx.patientAge || 30} Years)
                </strong>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)] block">Consultation Ref:</span>
                <strong className="text-[var(--color-text-dark)] font-mono-tabular">
                  {previewRx.appointmentId}
                </strong>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)] block">Follow-Up Date:</span>
                <strong className="text-[var(--color-forest)] font-mono-tabular">
                  {previewRx.followUpDate || 'As Needed'}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl border border-[var(--color-leaf-border)]">
                <div className="font-bold text-[var(--color-forest)] mb-1">
                  Provisional Clinical Diagnosis
                </div>
                <div className="text-[var(--color-text-dark)] font-semibold">
                  {previewRx.diagnosisSummary}
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-[var(--color-leaf-border)]">
                <div className="font-bold text-[var(--color-forest)] mb-1">
                  Symptoms &amp; Clinical Observations
                </div>
                <div className="text-[var(--color-text-dark)]">
                  {previewRx.symptomsObserved}
                </div>
              </div>
            </div>

            {/* Rx Table */}
            <div className="space-y-2">
              <div className="text-base font-extrabold italic text-[var(--color-forest)]">
                Rx — Prescribed Medications
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[var(--color-leaf-border)]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--color-leaf)] text-[var(--color-forest)] font-bold">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Medicine Name</th>
                      <th className="py-2.5 px-3">Dosage</th>
                      <th className="py-2.5 px-3">Frequency</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-leaf-border)]">
                    {previewRx.medicines.map((m, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="py-2.5 px-3 font-mono-tabular font-bold">{idx + 1}.</td>
                        <td className="py-2.5 px-3 font-bold text-[var(--color-forest)]">
                          {m.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular">{m.dosage}</td>
                        <td className="py-2.5 px-3">{m.frequency}</td>
                        <td className="py-2.5 px-3 font-mono-tabular">{m.duration}</td>
                        <td className="py-2.5 px-3 text-[var(--color-text-muted)]">
                          {m.instructions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] text-xs space-y-1">
              <div className="font-bold text-[var(--color-forest)]">
                General Medical Advice &amp; Care Instructions:
              </div>
              <p className="text-[var(--color-text-dark)] leading-relaxed">{previewRx.advice}</p>
            </div>

            <div className="pt-4 border-t border-[var(--color-leaf-border)] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {(() => {
                  const verCode = computeRxVerificationCode(previewRx);
                  const matrix = generateVerificationQrMatrix(
                    `${verCode}|${previewRx.id}|${previewRx.doctorRegistration}`
                  );
                  return (
                    <>
                      <div
                        className="p-1.5 bg-white border border-[var(--color-leaf-border)] rounded-xl shrink-0"
                        title={`Tamper-Evident Verification QR: ${verCode}`}
                      >
                        <svg width="56" height="56" viewBox="0 0 21 21" shapeRendering="crispEdges">
                          <rect width="21" height="21" fill="#FFFFFF" />
                          {matrix.map((row, r) =>
                            row.map((filled, c) =>
                              filled ? (
                                <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#064734" />
                              ) : null
                            )
                          )}
                        </svg>
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className="font-bold text-[var(--color-forest)] flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Pharmacy Verification: {verCode}</span>
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">
                          Digitally Signed by <strong className="text-[var(--color-forest)]">{previewRx.doctorName}</strong> (Reg: {previewRx.doctorRegistration})
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-forest-secondary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Prescription</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdfWithFeedback(previewRx)}
                  className="btn-forest-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Official PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewRx(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-forest)] cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* E-PRESCRIPTIONS LIST & PDF DOWNLOADER */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--color-forest)]">
              {currentUser.role === 'patient'
                ? 'Your Official Digital E-Prescriptions (PDF Ready)'
                : 'Issued Digital E-Prescriptions'}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Click &ldquo;Preview Pad&rdquo; to inspect the full prescription or &ldquo;Download PDF&rdquo; to save a printable file.
            </p>
          </div>
        </div>

        {eprescriptions.length === 0 ? (
          <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-12 text-center space-y-3 text-xs text-[var(--color-text-muted)]">
            <FileText className="w-9 h-9 text-[var(--color-forest)] mx-auto" />
            <p>No digital e-prescriptions have been issued yet.</p>
            <button
              type="button"
              onClick={() => setShowWriterForm(true)}
              className="btn-forest-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Digital E-Prescription Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {eprescriptions.map((rx) => (
              <div
                key={rx.id}
                className="card-hover-lift bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-leaf-border)] pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-[var(--color-forest)]" />
                      <span className="text-base font-bold text-[var(--color-forest)]">
                        {rx.doctorName}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        · {rx.doctorQualification} · Reg: {rx.doctorRegistration}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono-tabular">
                      Patient: <strong className="text-[var(--color-text-dark)]">{rx.patientName}</strong> · Date:{' '}
                      {rx.date} · Ref: {rx.id.toUpperCase()}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewRx(rx)}
                      className="btn-forest-secondary inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Preview Pad</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdfWithFeedback(rx)}
                      className="btn-forest-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="p-3.5 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)]">
                    <span className="text-[var(--color-text-muted)] font-semibold block mb-0.5">
                      Clinical Diagnosis:
                    </span>
                    <strong className="text-[var(--color-forest)]">{rx.diagnosisSummary}</strong>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)]">
                    <span className="text-[var(--color-text-muted)] font-semibold block mb-0.5">
                      Symptoms Observed:
                    </span>
                    <span className="text-[var(--color-text-dark)]">{rx.symptomsObserved}</span>
                  </div>
                </div>

                {/* Medications Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-leaf-border)] text-[var(--color-forest)] font-bold">
                        <th className="py-2 pr-3">Medicine</th>
                        <th className="py-2 px-3">Dosage</th>
                        <th className="py-2 px-3">Frequency</th>
                        <th className="py-2 px-3">Duration</th>
                        <th className="py-2 pl-3">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-leaf-border)]/50">
                      {rx.medicines.map((m, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 pr-3 font-bold text-[var(--color-text-dark)]">
                            {idx + 1}. {m.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono-tabular text-[var(--color-text-dark)]">
                            {m.dosage}
                          </td>
                          <td className="py-2.5 px-3 text-[var(--color-text-dark)]">{m.frequency}</td>
                          <td className="py-2.5 px-3 font-mono-tabular text-[var(--color-text-dark)]">
                            {m.duration}
                          </td>
                          <td className="py-2.5 pl-3 text-[var(--color-text-muted)]">{m.instructions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-leaf-border)] text-xs text-[var(--color-text-dark)]">
                  <div>
                    <strong className="text-[var(--color-forest)]">Advice: </strong>
                    {rx.advice}
                  </div>
                  {rx.followUpDate && (
                    <div className="font-mono-tabular text-[var(--color-forest)] font-bold">
                      Follow-Up: {rx.followUpDate}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
