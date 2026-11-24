import React, { useState } from 'react';
import {
  MessageSquare,
  FileSearch,
  Calendar,
  FileText,
  ClipboardList,
  Download,
  Clock,
} from 'lucide-react';
import {
  ChatSession,
  PrescriptionAnalysisResult,
  Appointment,
  EPrescription,
  SymptomCheckRecord,
} from '../types/healthcare';
import { downloadEPrescriptionPDF } from '../utils/pdfExport';

interface HealthTimelineProps {
  chatSessions: ChatSession[];
  prescriptionAnalyses: PrescriptionAnalysisResult[];
  appointments: Appointment[];
  eprescriptions: EPrescription[];
  symptomChecks: SymptomCheckRecord[];
}

type TimelineFilter = 'all' | 'chats' | 'scans' | 'appointments' | 'eprescriptions' | 'symptoms';

export const HealthTimeline: React.FC<HealthTimelineProps> = ({
  chatSessions,
  prescriptionAnalyses,
  appointments,
  eprescriptions,
  symptomChecks,
}) => {
  const [filter, setFilter] = useState<TimelineFilter>('all');

  // Combine all patient records into a unified chronological stream
  const timelineEvents = [
    ...chatSessions.map((c) => ({
      id: `tl-chat-${c.id}`,
      type: 'chats' as const,
      dateStr: c.updatedAt,
      title: `AI Health Chat: ${c.title}`,
      subtitle: `${c.messages.length} messages exchanged`,
      detail:
        c.messages[c.messages.length - 1]?.text.slice(0, 180) +
        (c.messages[c.messages.length - 1]?.text.length > 180 ? '...' : ''),
      raw: c,
    })),
    ...prescriptionAnalyses.map((p) => ({
      id: `tl-scan-${p.id}`,
      type: 'scans' as const,
      dateStr: p.createdAt,
      title: `Prescription Image Analyzed (${p.fileName})`,
      subtitle: `Prescriber: ${p.doctorName.value} · ${p.medicines.length} medicines extracted`,
      detail: p.medicines.map((m) => `${m.name} (${m.dosage})`).join(' · '),
      raw: p,
    })),
    ...appointments.map((a) => ({
      id: `tl-apt-${a.id}`,
      type: 'appointments' as const,
      dateStr: a.updatedAt || a.createdAt,
      title: `Appointment with ${a.doctorName} (${a.doctorSpecialty})`,
      subtitle: `Scheduled: ${a.date} at ${a.timeSlot} · Status: ${a.status}`,
      detail: `Symptoms: ${a.symptoms}`,
      raw: a,
    })),
    ...eprescriptions.map((e) => ({
      id: `tl-erx-${e.id}`,
      type: 'eprescriptions' as const,
      dateStr: `${e.date}T12:00:00Z`,
      title: `Digital E-Prescription Issued by ${e.doctorName}`,
      subtitle: `Diagnosis: ${e.diagnosisSummary}`,
      detail: e.medicines.map((m) => `${m.name} ${m.dosage} (${m.frequency})`).join(' · '),
      raw: e,
    })),
    ...symptomChecks.map((s) => ({
      id: `tl-sym-${s.id}`,
      type: 'symptoms' as const,
      dateStr: s.createdAt,
      title: `Symptom Check: ${s.selectedSymptoms.join(', ')}`,
      subtitle: `Urgency: ${s.urgencyLevel} · Severity: ${s.severity} (${s.duration})`,
      detail: s.explanation,
      raw: s,
    })),
  ].sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());

  const filteredEvents = timelineEvents.filter((ev) =>
    filter === 'all' ? true : ev.type === filter
  );

  const getIcon = (type: TimelineFilter) => {
    switch (type) {
      case 'chats':
        return <MessageSquare className="w-4 h-4 text-[var(--color-forest)]" />;
      case 'scans':
        return <FileSearch className="w-4 h-4 text-[var(--color-forest)]" />;
      case 'appointments':
        return <Calendar className="w-4 h-4 text-[var(--color-forest)]" />;
      case 'eprescriptions':
        return <FileText className="w-4 h-4 text-[var(--color-forest)]" />;
      case 'symptoms':
        return <ClipboardList className="w-4 h-4 text-[var(--color-forest)]" />;
      default:
        return <Clock className="w-4 h-4 text-[var(--color-forest)]" />;
    }
  };

  return (
    <div className="fade-slide-up bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-leaf-border)] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-forest)]">
            Unified Patient Health Timeline
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Complete chronological record of your AI health chats, analyzed prescriptions, symptom checks, appointments, and PDF e-prescriptions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1.5 bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-2xl">
          {[
            { id: 'all', label: `All (${timelineEvents.length})` },
            { id: 'chats', label: `AI Chats (${chatSessions.length})` },
            { id: 'scans', label: `Rx Scans (${prescriptionAnalyses.length})` },
            { id: 'symptoms', label: `Symptom Checks (${symptomChecks.length})` },
            { id: 'appointments', label: `Appointments (${appointments.length})` },
            { id: 'eprescriptions', label: `E-Rx (${eprescriptions.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as TimelineFilter)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-[var(--color-forest)] text-white shadow-xs'
                  : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
          No health timeline events found in this category yet.
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-leaf-border)]/50">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  {getIcon(ev.type)}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--color-forest)]">{ev.title}</h3>
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <span className="text-xs font-mono-tabular text-[var(--color-text-muted)]">
                      {new Date(ev.dateStr).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[var(--color-text-dark)]">{ev.subtitle}</div>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed break-words">
                    {ev.detail}
                  </p>
                </div>
              </div>

              {ev.type === 'eprescriptions' && (
                <button
                  type="button"
                  onClick={() => downloadEPrescriptionPDF(ev.raw as EPrescription)}
                  className="btn-forest-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
