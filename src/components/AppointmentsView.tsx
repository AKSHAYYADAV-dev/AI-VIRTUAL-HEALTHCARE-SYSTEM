import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Video,
  FilePlus,
  AlertCircle,
  MailCheck,
  Stethoscope,
  Building2,
  BadgeCheck,
  ExternalLink,
} from 'lucide-react';
import { Appointment, SupportedLanguage, User } from '../types/healthcare';
import { DoctorSpecialtyIllustration } from './CustomMedicalIllustrations';
import { ClinicLocationPicker, SelectedHospitalSelection } from './ClinicLocationPicker';
import internalMedicineImg from '../assets/images/doctor_internal_medicine_1795427974026.jpg';
import cardiologyHeartImg from '../assets/images/doctor_cardiology_1795427974687.jpg';
import pulmonologyXrayImg from '../assets/images/doctor_pulmonology_1795427975573.jpg';
import dermatologySerumImg from '../assets/images/doctor_dermatology_1795427973992.jpg';

interface AppointmentsViewProps {
  currentUser: User;
  language?: SupportedLanguage;
  doctors: User[];
  appointments: Appointment[];
  prefilledSymptoms: string;
  onClearPrefill: () => void;
  onAppointmentCreated: (apt: Appointment) => void;
  onAppointmentUpdated: (apt: Appointment) => void;
  onJoinVideoCall: (apt: Appointment) => void;
  onWriteEPrescription?: (apt: Appointment) => void;
}

const DEFAULT_TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:30 PM',
  '05:00 PM',
  '06:30 PM',
];

const getSpecialtyPhotoConfig = (
  specialty = ''
): { label: string; photoUrl: string | null; alt: string } => {
  const s = specialty.toLowerCase();
  if (s.includes('cardio')) {
    return {
      label: 'CARDIOLOGY',
      photoUrl: cardiologyHeartImg,
      alt: 'AI-generated frosted-glass anatomical heart sculpture and glowing ECG pulse visual for Cardiology',
    };
  }
  if (s.includes('pulmo') || s.includes('respir')) {
    return {
      label: 'PULMONOLOGY',
      photoUrl: pulmonologyXrayImg,
      alt: 'AI-generated emerald respiratory airflow and stylized lungs clinical display for Pulmonology',
    };
  }
  if (s.includes('derma') || s.includes('immun')) {
    return {
      label: 'DERMATOLOGY',
      photoUrl: dermatologySerumImg,
      alt: 'AI-generated frosted glass skincare serum bottle, dropper, and botanical leaf visual for Dermatology',
    };
  }
  if (s.includes('ortho')) {
    return {
      label: 'ORTHOPEDICS',
      photoUrl: null,
      alt: 'Orthopedics clinical specialty illustration',
    };
  }
  return {
    label: 'INTERNAL MEDICINE',
    photoUrl: internalMedicineImg,
    alt: 'AI-generated unbranded forest-green stethoscope and clinical heartbeat tablet for Internal Medicine',
  };
};

const getLocalIsoDate = (offsetDays = 0): string => {
  const dt = new Date(Date.now() + offsetDays * 86400000);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  currentUser,
  language = 'English',
  doctors,
  appointments,
  prefilledSymptoms,
  onClearPrefill,
  onAppointmentCreated,
  onAppointmentUpdated,
  onJoinVideoCall,
  onWriteEPrescription,
}) => {
  const todayIso = getLocalIsoDate(0);
  const tomorrowIso = getLocalIsoDate(1);
  const approvedDoctors = doctors.filter((d) => d.approved !== false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(approvedDoctors[0]?.id || '');
  const [failedDoctorPhotos, setFailedDoctorPhotos] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedSlot, setSelectedSlot] = useState<string>('11:00 AM');
  const [symptoms, setSymptoms] = useState<string>(prefilledSymptoms || '');
  const [notes, setNotes] = useState<string>('');
  const [selectedHospital, setSelectedHospital] = useState<SelectedHospitalSelection | null>(null);
  const [consultationMode, setConsultationMode] = useState<'Video Consultation' | 'Hospital Visit'>(
    'Video Consultation'
  );
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Doctor Reschedule Modal / Inline State
  const [rescheduleTargetId, setRescheduleTargetId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(tomorrowIso);
  const [rescheduleSlot, setRescheduleSlot] = useState<string>('03:30 PM');
  const [doctorNote, setDoctorNote] = useState<string>('');

  useEffect(() => {
    if (prefilledSymptoms) {
      setSymptoms(prefilledSymptoms);
    }
  }, [prefilledSymptoms]);

  useEffect(() => {
    if (!selectedDoctorId && approvedDoctors.length > 0) {
      setSelectedDoctorId(approvedDoctors[0].id);
    }
  }, [approvedDoctors, selectedDoctorId]);

  const selectedDoctor = approvedDoctors.find((d) => d.id === selectedDoctorId);

  // Determine which slots are already booked for selectedDoctorId on selectedDate
  const bookedSlotsForSelectedDate = new Set(
    appointments
      .filter(
        (a) =>
          a.doctorId === selectedDoctorId &&
          a.date === selectedDate &&
          ['Pending', 'Confirmed', 'Rescheduled'].includes(a.status)
      )
      .map((a) => a.timeSlot)
  );

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedDoctorId || !selectedDate || !selectedSlot || !symptoms.trim()) {
      setError('Please select a doctor, date, available time slot, and enter your symptoms.');
      return;
    }

    if (bookedSlotsForSelectedDate.has(selectedSlot)) {
      setError('This time slot is already booked. Please select an open slot.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: currentUser.id,
          doctorId: selectedDoctorId,
          date: selectedDate,
          timeSlot: selectedSlot,
          symptoms,
          notes,
          consultationMode,
          locationLabel: selectedHospital?.locationLabel,
          hospitalName: selectedHospital?.hospitalName,
          hospitalAddress: selectedHospital?.hospitalAddress,
          hospitalPlaceId: selectedHospital?.hospitalPlaceId,
          hospitalMapsUri: selectedHospital?.hospitalMapsUri,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not book appointment.');
      }
      onAppointmentCreated(data.appointment);
      onClearPrefill();
      setSymptoms('');
      setNotes('');
      setSuccessMsg(
        `Appointment confirmed & sent to ${data.appointment.doctorName} for ${data.appointment.date} at ${data.appointment.timeSlot}${
          data.appointment.hospitalName ? ` (${data.appointment.hospitalName})` : ''
        }.`
      );
    } catch (err: any) {
      setError(err.message || 'Booking failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorAction = async (
    aptId: string,
    newStatus: 'Confirmed' | 'Rejected' | 'Rescheduled',
    newDate?: string,
    newSlot?: string,
    note?: string
  ) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await fetch(`/api/appointments/${aptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          date: newDate,
          timeSlot: newSlot,
          doctorResponseNote: note,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update appointment.');
      }
      onAppointmentUpdated(data.appointment);
      setRescheduleTargetId(null);
      setDoctorNote('');
      setSuccessMsg(
        `Appointment ${data.appointment.id.toUpperCase()} updated to ${newStatus}. In-app and email reminder dispatched to patient.`
      );
    } catch (err: any) {
      setError(err.message || 'Could not update appointment.');
    }
  };

  const filteredAppointments = appointments.filter((a) =>
    statusFilter === 'All' ? true : a.status === statusFilter
  );

  return (
    <div className="fade-slide-up space-y-6">
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] text-xs text-[var(--color-forest)] font-semibold flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[var(--color-forest)] shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* PATIENT BOOKING FORM */}
      {currentUser.role === 'patient' && (
        <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-leaf-border)] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-forest)]">
                Book a Telemedicine Appointment
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Choose a verified specialist, date, and open time slot. Double-booking is automatically prevented.
              </p>
            </div>
            {prefilledSymptoms && (
              <span className="text-xs font-bold text-[var(--color-forest)] bg-[var(--color-leaf)] px-3.5 py-1.5 rounded-xl border border-[var(--color-leaf-border)]">
                Symptoms pre-filled from AI Assistant
              </span>
            )}
          </div>

          <form onSubmit={handleBookAppointment} className="space-y-6">
            {/* Step 1: Select Clinic / Hospital Location */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="block text-sm font-bold text-[var(--color-forest)]">
                    Select Clinic / Hospital Location
                  </label>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Select any city, locality, or GPS location to view real clinics and hospitals on Google Maps, or choose Online Video Consultation.
                  </p>
                </div>

                {/* Consultation Mode Selector */}
                <div className="flex items-center gap-1 p-1 bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-xl">
                  {(['Video Consultation', 'Hospital Visit'] as const).map((modeOption) => (
                    <button
                      key={modeOption}
                      type="button"
                      onClick={() => setConsultationMode(modeOption)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        consultationMode === modeOption
                          ? 'bg-[var(--color-forest)] text-white shadow-2xs'
                          : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
                      }`}
                    >
                      {modeOption}
                    </button>
                  ))}
                </div>
              </div>

              <ClinicLocationPicker
                language={language}
                selectedHospital={selectedHospital}
                onSelectHospital={(selection) => {
                  setSelectedHospital(selection);
                  if (selection) {
                    setConsultationMode(selection.isVirtual ? 'Video Consultation' : 'Hospital Visit');
                  }
                }}
              />
            </div>

            {/* Step 2: Select a Specialist */}
            <div>
              <label className="block text-sm font-bold text-[var(--color-forest)] mb-3">
                Select a Specialist
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                {approvedDoctors.map((doc) => {
                  const isSelected = doc.id === selectedDoctorId;
                  const specialtyMedia = getSpecialtyPhotoConfig(doc.specialty);
                  const showPhoto =
                    Boolean(specialtyMedia.photoUrl) && !failedDoctorPhotos[doc.id];

                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={`card-3d-tilt h-full text-left rounded-2xl border-2 overflow-hidden transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[var(--color-leaf)]/60 border-[var(--color-forest)] shadow-sm text-[var(--color-text-dark)]'
                          : 'bg-white border-[var(--color-leaf-border)] hover:border-[var(--color-forest)] text-[var(--color-text-dark)]'
                      }`}
                    >
                      <div className="w-full flex flex-col">
                        <div className="relative w-full h-40 shrink-0 rounded-t-xl bg-gradient-to-br from-[#064734] via-[#0b5c44] to-[#137A5B] overflow-hidden border-b border-[var(--color-leaf-border)]">
                          {showPhoto ? (
                            <>
                              <img
                                src={specialtyMedia.photoUrl!}
                                alt={specialtyMedia.alt}
                                loading="eager"
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setFailedDoctorPhotos((prev) => ({
                                    ...prev,
                                    [doc.id]: true,
                                  }))
                                }
                                className="w-full h-full object-cover"
                              />
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20"
                              />
                            </>
                          ) : (
                            <DoctorSpecialtyIllustration specialty={doc.specialty} />
                          )}

                          {showPhoto && (
                            <span className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-lg bg-white/95 border border-[var(--color-leaf-border)] text-[var(--color-forest)] text-[10px] font-extrabold tracking-wide shadow-2xs">
                              {specialtyMedia.label}
                            </span>
                          )}

                          <span className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 rounded-lg bg-[var(--color-forest)]/90 text-[var(--color-leaf)] text-[11px] tabular-nums font-bold shadow-2xs">
                            ₹{doc.consultationFee}
                          </span>
                        </div>

                        <div className="p-4 space-y-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-bold text-[var(--color-forest)] truncate">
                              {doc.name}
                            </span>
                            <BadgeCheck
                              className="w-4 h-4 text-[#137A5B] shrink-0"
                              aria-label="Verified Specialist"
                            />
                          </div>
                          <div className="text-xs text-[var(--color-text-dark)] font-semibold truncate">
                            {doc.specialty}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] tabular-nums">
                            {doc.qualification} · {doc.experienceYears} yrs exp
                          </div>
                        </div>
                      </div>

                      <div className="w-full px-4 pb-4 pt-2.5 border-t border-[var(--color-leaf-border)]/60 flex items-center justify-between gap-2 mt-auto">
                        <span className="text-xs text-[var(--color-forest)] font-semibold flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5 text-[var(--color-forest)] shrink-0" />
                          <span>Verified MD</span>
                        </span>
                        <span
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap ${
                            isSelected
                              ? 'bg-[var(--color-forest)] text-white'
                              : 'bg-[var(--color-leaf)] text-[var(--color-forest)]'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select Doctor'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Consultation Date & Available Consultation Slots */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-4">
                <label className="block text-sm font-bold text-[var(--color-forest)] mb-2">
                  Consultation Date
                </label>
                <input
                  type="date"
                  required
                  min={todayIso}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 text-sm tabular-nums bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] transition-all"
                />
                {selectedDoctor && (
                  <p className="text-xs text-[var(--color-text-dark)] mt-2.5 leading-relaxed bg-[var(--color-leaf-soft)] p-3 rounded-xl border border-[var(--color-leaf-border)]">
                    {selectedDoctor.bio}
                  </p>
                )}
              </div>

              <div className="md:col-span-8">
                <label className="block text-sm font-bold text-[var(--color-forest)] mb-2">
                  Available Consultation Slots
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(selectedDoctor?.availableSlots || DEFAULT_TIME_SLOTS).map((slot) => {
                    const isBooked = bookedSlotsForSelectedDate.has(slot);
                    const isSelected = selectedSlot === slot && !isBooked;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => setSelectedSlot(slot)}
                        className={`btn-hover-lift py-3 px-3 rounded-xl border text-xs tabular-nums font-bold transition-all flex items-center justify-center gap-1.5 ${
                          isBooked
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            : isSelected
                            ? 'bg-[var(--color-forest)] border-[var(--color-forest)] text-white shadow-xs cursor-pointer'
                            : 'bg-white border-[var(--color-leaf-border)] text-[var(--color-text-dark)] hover:border-[var(--color-forest)] hover:bg-[var(--color-leaf)] cursor-pointer'
                        }`}
                      >
                        <span>{slot}</span>
                        {isBooked && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">
                            Booked
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 4: Symptoms & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-[var(--color-forest)] mb-1.5">
                  Primary Symptoms / Reason for Visit *
                </label>
                <input
                  type="text"
                  required
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe your symptoms (e.g., Fever and dry cough for 3 days)"
                  className="w-full px-4 py-3 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--color-forest)] mb-1.5">
                  Additional Clinical Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any current medications, allergies, or recent test results"
                  className="w-full px-4 py-3 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] transition-all"
                />
              </div>
            </div>

            {/* Appointment Summary */}
            <div className="p-5 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-[var(--color-forest)]">
                  Appointment Summary
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-white border border-[var(--color-leaf-border)] text-[var(--color-forest)]">
                  Mode: {consultationMode}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-[var(--color-leaf-border)]">
                  <div className="text-[11px] text-[var(--color-text-muted)] font-semibold">
                    Doctor &amp; Specialty
                  </div>
                  <div className="font-bold text-[var(--color-forest)] mt-0.5 truncate">
                    {selectedDoctor?.name || 'Select a specialist'}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-dark)] truncate tabular-nums">
                    {selectedDoctor?.specialty || '—'} · ₹{selectedDoctor?.consultationFee ?? 0}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[var(--color-leaf-border)]">
                  <div className="text-[11px] text-[var(--color-text-muted)] font-semibold">
                    Hospital / Clinic Location
                  </div>
                  <div className="font-bold text-[var(--color-forest)] mt-0.5 truncate">
                    {selectedHospital?.hospitalName || 'Online Video Consultation'}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-dark)] truncate">
                    {selectedHospital?.hospitalAddress || 'Encrypted Telehealth Video Room'}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[var(--color-leaf-border)]">
                  <div className="text-[11px] text-[var(--color-text-muted)] font-semibold">
                    Schedule Slot
                  </div>
                  <div className="font-bold text-[var(--color-forest)] tabular-nums mt-0.5">
                    {selectedDate} · {selectedSlot}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-dark)] truncate">
                    Patient: {currentUser.name}
                  </div>
                </div>

                <div className="flex items-center justify-end sm:justify-stretch">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-forest-primary w-full h-full min-h-[48px] px-5 py-3 disabled:opacity-50 text-xs sm:text-sm font-bold rounded-xl shadow-xs cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{loading ? 'Confirming...' : 'Confirm & Book Appointment'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* APPOINTMENTS SCHEDULE & MANAGEMENT LIST */}
      <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-leaf-border)] pb-4">
          <div>
            <h3 className="text-base font-bold text-[var(--color-forest)]">
              {currentUser.role === 'doctor'
                ? 'Patient Appointment Queue & Schedule Management'
                : 'Your Scheduled & Past Appointments'}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Confirmed appointments include automated in-app &amp; email reminders and a dedicated Video Consultation room.
            </p>
          </div>

          {/* Interactive Filter Controls */}
          <div className="flex flex-wrap items-center gap-1 p-1.5 bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-2xl">
            {['All', 'Confirmed', 'Pending', 'Rescheduled', 'Completed', 'Rejected'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-[var(--color-forest)] text-white shadow-xs'
                    : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
            No appointments match the selected filter ({statusFilter}).
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-leaf-border)]/50">
            {filteredAppointments.map((apt) => (
              <div key={apt.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--color-forest)]">
                      <span>
                        {currentUser.role === 'patient' ? apt.doctorName : apt.patientName}
                      </span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span className="text-xs font-semibold text-[var(--color-text-dark)]">
                        {apt.doctorSpecialty}
                      </span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                          apt.status === 'Confirmed'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : apt.status === 'Pending'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : apt.status === 'Rescheduled'
                            ? 'bg-[var(--color-leaf)] text-[var(--color-forest)] border border-[var(--color-leaf-border)]'
                            : apt.status === 'Rejected'
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        Status: {apt.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)] tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[var(--color-forest)]" />
                        {apt.date}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[var(--color-forest)]" />
                        {apt.timeSlot}
                      </span>
                      <span>·</span>
                      <span>Room: {apt.meetingRoomId}</span>
                      {(apt.status === 'Confirmed' || apt.status === 'Rescheduled') && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-[var(--color-forest)] font-bold">
                            <MailCheck className="w-3.5 h-3.5" />
                            Reminder Active ({apt.patientEmail})
                          </span>
                        </>
                      )}
                    </div>

                    {apt.hospitalName && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-forest)] bg-[var(--color-leaf-soft)] px-3 py-1.5 rounded-xl border border-[var(--color-leaf-border)]">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-bold">{apt.hospitalName}</span>
                        {apt.hospitalAddress && (
                          <span className="text-[var(--color-text-dark)]">· {apt.hospitalAddress}</span>
                        )}
                        {apt.hospitalMapsUri && (
                          <a
                            href={apt.hospitalMapsUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-bold underline text-[var(--color-forest)] ml-auto"
                          >
                            <span>View on Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-[var(--color-text-dark)] pt-1">
                      <strong className="text-[var(--color-forest)]">Reported Symptoms: </strong>
                      {apt.symptoms}
                      {apt.notes && (
                        <span className="text-[var(--color-text-muted)]"> — Note: {apt.notes}</span>
                      )}
                    </div>

                    {apt.doctorResponseNote && (
                      <div className="text-xs text-[var(--color-forest)] bg-[var(--color-leaf)]/80 px-3.5 py-2 rounded-xl border border-[var(--color-leaf-border)] mt-1">
                        <strong>Doctor&apos;s Note: </strong>
                        {apt.doctorResponseNote}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Both Patient and Doctor can join Video Call for Confirmed or Rescheduled appointments */}
                    {(apt.status === 'Confirmed' || apt.status === 'Rescheduled') && (
                      <button
                        type="button"
                        onClick={() => onJoinVideoCall(apt)}
                        className="btn-forest-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Call</span>
                      </button>
                    )}

                    {/* Doctor Controls: Accept, Reschedule, Reject, Write E-Prescription */}
                    {currentUser.role === 'doctor' && (
                      <>
                        {apt.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDoctorAction(
                                apt.id,
                                'Confirmed',
                                apt.date,
                                apt.timeSlot,
                                'Confirmed by Doctor. Please join the video call 5 minutes prior.'
                              )
                            }
                            className="btn-forest-primary inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                        )}

                        {['Pending', 'Confirmed', 'Rescheduled'].includes(apt.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setRescheduleTargetId(
                                rescheduleTargetId === apt.id ? null : apt.id
                              );
                              setRescheduleDate(apt.date);
                              setRescheduleSlot(apt.timeSlot);
                            }}
                            className="btn-forest-secondary inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reschedule</span>
                          </button>
                        )}

                        {apt.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDoctorAction(
                                apt.id,
                                'Rejected',
                                apt.date,
                                apt.timeSlot,
                                'Doctor unavailable at this slot. Please select another slot.'
                              )
                            }
                            className="btn-hover-lift inline-flex items-center gap-1 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        )}

                        {onWriteEPrescription && apt.status !== 'Rejected' && (
                          <button
                            type="button"
                            onClick={() => onWriteEPrescription(apt)}
                            className="btn-forest-secondary inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            <FilePlus className="w-3.5 h-3.5" />
                            <span>Write E-Rx</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Doctor Reschedule Panel */}
                {rescheduleTargetId === apt.id && (
                  <div className="fade-slide-up p-4 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--color-forest)] mb-1">
                        New Date
                      </label>
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs tabular-nums bg-white border border-[var(--color-leaf-border)] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--color-forest)] mb-1">
                        New Time Slot
                      </label>
                      <select
                        value={rescheduleSlot}
                        onChange={(e) => setRescheduleSlot(e.target.value)}
                        className="w-full px-3 py-2 text-xs tabular-nums bg-white border border-[var(--color-leaf-border)] rounded-xl"
                      >
                        {DEFAULT_TIME_SLOTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--color-forest)] mb-1">
                        Reason / Note to Patient
                      </label>
                      <input
                        type="text"
                        value={doctorNote}
                        onChange={(e) => setDoctorNote(e.target.value)}
                        placeholder="e.g., In ward rounds at 10 AM"
                        className="w-full px-3 py-2 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleDoctorAction(
                            apt.id,
                            'Rescheduled',
                            rescheduleDate,
                            rescheduleSlot,
                            doctorNote || 'Rescheduled to updated slot.'
                          )
                        }
                        className="btn-forest-primary flex-1 py-2 px-3 text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        Save New Slot
                      </button>
                      <button
                        type="button"
                        onClick={() => setRescheduleTargetId(null)}
                        className="btn-forest-secondary py-2 px-3 text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
