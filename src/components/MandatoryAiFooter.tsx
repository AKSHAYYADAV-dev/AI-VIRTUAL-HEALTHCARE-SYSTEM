import React from 'react';
import { Calendar, AlertCircle, PhoneCall } from 'lucide-react';
import { SupportedLanguage } from '../types/healthcare';
import { UI_TRANSLATIONS } from '../utils/i18n';

interface MandatoryAiFooterProps {
  language: SupportedLanguage;
  symptomsToPrefill?: string;
  onBookAppointment: (prefillSymptoms?: string) => void;
}

/**
 * Mandatory footer appended by the application to EVERY AI response
 * (AI Health Chat, Prescription Analysis, and Symptom Checker).
 * Never left to the AI model to generate.
 *
 * Includes:
 * 1. Calm severe-condition / emergency note (placed above the AI disclaimer and Book Appointment button)
 * 2. "This response is AI-generated and can make mistakes. Please recheck with a qualified doctor."
 * 3. "Would you like to book an appointment?" + "Book Appointment" button
 */
export const MandatoryAiFooter: React.FC<MandatoryAiFooterProps> = ({
  language,
  symptomsToPrefill,
  onBookAppointment,
}) => {
  const t = UI_TRANSLATIONS[language];

  return (
    <div className="mt-4 pt-3.5 border-t border-[var(--color-leaf-border)] space-y-2.5">
      {/* Calm Severe-Condition & Emergency Note (Above AI disclaimer and Book Appointment button) */}
      <div className="flex items-start gap-2.5 text-xs bg-[var(--color-leaf-soft)] px-3.5 py-2.5 rounded-xl border border-[var(--color-leaf-border)]">
        <PhoneCall className="w-4 h-4 text-[var(--color-forest)] shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[var(--color-text-dark)]">
          If you are in a severe condition, please consult a nearby doctor immediately or go to the nearest hospital. In an emergency, call 108 or 112.
        </p>
      </div>

      {/* Mandatory Notice 1: AI-generated disclaimer */}
      <div className="flex items-start gap-2.5 text-xs bg-white px-3.5 py-2.5 rounded-xl border border-[var(--color-leaf-border)]">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="font-medium leading-relaxed text-[var(--color-text-dark)]">
          This response is AI-generated and can make mistakes. Please recheck with a qualified doctor.
          {language !== 'English' && (
            <span className="block mt-1 text-[var(--color-text-muted)] font-normal">{t.aiDisclaimer}</span>
          )}
        </p>
      </div>

      {/* Mandatory Notice 2: Book Appointment prompt + button */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--color-leaf)] px-4 py-3 rounded-xl border border-[var(--color-leaf-border)]">
        <div className="text-xs font-semibold text-[var(--color-forest)]">
          <span>Would you like to book an appointment?</span>
          {language !== 'English' && (
            <span className="ml-2 font-normal text-[var(--color-text-dark)]">({t.bookAppointmentPrompt})</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onBookAppointment(symptomsToPrefill)}
          className="btn-forest-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl shadow-xs cursor-pointer whitespace-nowrap shrink-0"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Book Appointment</span>
        </button>
      </div>
    </div>
  );
};
