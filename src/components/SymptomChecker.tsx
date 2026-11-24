import React, { useState } from 'react';
import {
  ClipboardList,
  AlertTriangle,
  Loader2,
  Stethoscope,
  Sparkles,
  CheckSquare,
  PhoneCall,
} from 'lucide-react';
import { SymptomCheckRecord, SupportedLanguage, User } from '../types/healthcare';
import { UI_TRANSLATIONS } from '../utils/i18n';
import { MandatoryAiFooter } from './MandatoryAiFooter';

const RED_FLAG_KEYWORDS = [
  'chest pain',
  'difficulty breathing',
  'shortness of breath',
  'stroke',
  'severe bleeding',
  'unconscious',
  'sudden weakness',
  'heart attack',
  "can't breathe",
  'cannot breathe',
  'ఛాతీ నొప్పి',
  'శ్వాస తీసుకోవడంలో ఇబ్బంది',
  'सीने में दर्द',
  'सांस लेने में तकलीफ',
];

function detectRedFlagSymptoms(symptoms: string[], notes: string): boolean {
  const combined = `${symptoms.join(' ')} ${notes}`.toLowerCase();
  return RED_FLAG_KEYWORDS.some((kw) => combined.includes(kw));
}

interface SymptomCheckerProps {
  currentUser: User;
  language: SupportedLanguage;
  history: SymptomCheckRecord[];
  onCheckCreated: (record: SymptomCheckRecord) => void;
  onBookAppointment: (prefillSymptoms?: string) => void;
}

const SYMPTOM_CATEGORIES = [
  {
    category: 'General & Systemic',
    items: ['Fever', 'Chills / Night Sweats', 'Fatigue', 'Unexplained Weight Change'],
  },
  {
    category: 'Respiratory & ENT',
    items: [
      'Dry Cough',
      'Productive Cough',
      'Sore Throat',
      'Nasal Congestion',
      'Shortness of Breath / Difficulty Breathing',
    ],
  },
  {
    category: 'Cardiovascular & Urgent Signs',
    items: ['Chest Pain', 'Palpitations / Rapid Heartbeat', 'Dizziness / Lightheadedness'],
  },
  {
    category: 'Neurological & Head',
    items: ['Headache / Migraine', 'Sudden Weakness / Numbness', 'Sleep Disturbance'],
  },
  {
    category: 'Gastrointestinal & Skin',
    items: ['Nausea / Vomiting', 'Abdominal Pain / Acidity', 'Skin Rash / Itching', 'Joint Pain'],
  },
];

export const SymptomChecker: React.FC<SymptomCheckerProps> = ({
  currentUser,
  language,
  history,
  onCheckCreated,
  onBookAppointment,
}) => {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['Fever', 'Dry Cough']);
  const [duration, setDuration] = useState('1 to 3 days');
  const [severity, setSeverity] = useState<'Mild' | 'Moderate' | 'Severe'>('Moderate');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<SymptomCheckRecord | null>(history[0] || null);

  const t = UI_TRANSLATIONS[language];
  const liveRedFlagSelected = detectRedFlagSymptoms(selectedSymptoms, additionalNotes);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSymptoms.length === 0) {
      setError('Please select at least one symptom from the checklist.');
      return;
    }

    setError(null);
    const isRedFlag = detectRedFlagSymptoms(selectedSymptoms, additionalNotes);

    // Immediate emergency red-flag triage without home remedies
    if (isRedFlag) {
      const emergencyRecord: SymptomCheckRecord = {
        id: `sym-emergency-${Date.now()}`,
        patientId: currentUser.id,
        createdAt: new Date().toISOString(),
        selectedSymptoms,
        duration,
        severity,
        additionalNotes,
        urgencyLevel: 'Emergency - Call 108/112',
        possibleCauses: [
          'Acute Cardiopulmonary or Neurological Emergency (Requires Immediate ER Evaluation)',
        ],
        explanation:
          'One or more severe red-flag symptoms (such as chest pain, breathing difficulty, stroke signs, severe bleeding, or loss of consciousness) were detected. Immediate emergency medical care is essential—do not wait or attempt home remedies.',
        homeRemedies: [],
        commonTabletsUse: [],
        recommendedSpecialty: 'Emergency Medicine / Cardiology',
      };
      onCheckCreated(emergencyRecord);
      setActiveResult(emergencyRecord);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/symptom-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: currentUser.id,
          selectedSymptoms,
          duration,
          severity,
          additionalNotes,
          language,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to evaluate symptoms.');
      }
      onCheckCreated(data.result);
      setActiveResult(data.result);
    } catch (err: any) {
      setError(err.message || 'Unable to evaluate symptoms right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-slide-up grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Structured Symptom Checklist Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-7 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-6"
      >
        <div className="border-b border-[var(--color-leaf-border)] pb-4">
          <h2 className="text-lg font-bold text-[var(--color-forest)]">
            Interactive Symptom Checker
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Select your symptoms, duration, and severity to receive an explainable clinical overview of common causes, home remedies, and tablet uses.
          </p>
        </div>

        {/* Symptom Checkboxes by System */}
        <div className="space-y-4">
          {SYMPTOM_CATEGORIES.map((group) => (
            <div key={group.category} className="space-y-2">
              <h3 className="text-xs font-bold text-[var(--color-forest)]">{group.category}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {group.items.map((item) => {
                  const checked = selectedSymptoms.includes(item);
                  const isUrgentSign = [
                    'Chest Pain',
                    'Shortness of Breath / Difficulty Breathing',
                    'Sudden Weakness / Numbness',
                  ].includes(item);
                  return (
                    <label
                      key={item}
                      className={`card-hover-lift flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all select-none ${
                        checked
                          ? isUrgentSign
                            ? 'bg-red-50 border-red-300 text-red-950 font-bold shadow-2xs'
                            : 'bg-[var(--color-leaf)] border-[var(--color-forest)] text-[var(--color-forest)] font-bold shadow-2xs'
                          : 'bg-white border-[var(--color-leaf-border)] text-[var(--color-text-dark)] hover:bg-[var(--color-leaf-soft)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSymptom(item)}
                        className="w-4 h-4 accent-[#064734] rounded cursor-pointer shrink-0"
                      />
                      <span className="truncate">{item}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Duration & Severity Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--color-leaf-border)]">
          <div>
            <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
              Symptom Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-medium bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
            >
              <option value="Less than 24 hours">Less than 24 hours</option>
              <option value="1 to 3 days">1 to 3 days</option>
              <option value="4 to 7 days">4 to 7 days</option>
              <option value="1 to 4 weeks">1 to 4 weeks</option>
              <option value="More than 1 month">More than 1 month</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
              Perceived Severity
            </label>
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-2xl">
              {(['Mild', 'Moderate', 'Severe'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSeverity(lvl)}
                  className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    severity === lvl
                      ? lvl === 'Severe'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-[var(--color-forest)] text-white shadow-xs'
                      : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Additional Context */}
        <div>
          <label className="block text-xs font-bold text-[var(--color-forest)] mb-1.5">
            Additional Context or Triggers (Optional)
          </label>
          <input
            type="text"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="e.g., Worse in the morning, started after travel..."
            className="w-full px-4 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
          />
        </div>

        {liveRedFlagSelected && (
          <div className="rounded-2xl bg-red-50 border-2 border-red-500 overflow-hidden shadow-xs">
            <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between gap-2 text-xs font-extrabold">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{t.emergencyBannerTitle}</span>
              </div>
              <span className="inline-flex items-center gap-1 bg-white text-red-700 px-2 py-0.5 rounded-md font-mono-tabular">
                <PhoneCall className="w-3 h-3" />
                108 / 112
              </span>
            </div>
            <p className="p-3.5 text-xs font-semibold text-red-950 leading-relaxed">
              {t.emergencyBannerText}
            </p>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || selectedSymptoms.length === 0}
          className="btn-forest-primary w-full py-3.5 px-4 disabled:opacity-50 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating Explainable Assessment...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Analyze Symptoms ({selectedSymptoms.length} selected)</span>
            </>
          )}
        </button>
      </form>

      {/* Right: Explainable Result Panel */}
      <div className="lg:col-span-5 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--color-leaf-border)] pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[var(--color-forest)]" />
            <h3 className="text-base font-bold text-[var(--color-forest)]">
              Explainable Symptom Analysis
            </h3>
          </div>
          <span className="text-xs text-[var(--color-text-muted)] font-mono-tabular">
            Non-Prescriptive
          </span>
        </div>

        {loading ? (
          <div className="space-y-4 py-4">
            <div className="h-20 bg-[var(--color-leaf-soft)] rounded-2xl skeleton-pulse" />
            <div className="h-14 bg-[var(--color-leaf-soft)] rounded-2xl skeleton-pulse" />
            <div className="h-28 bg-[var(--color-leaf-soft)] rounded-2xl skeleton-pulse" />
            <div className="h-24 bg-[var(--color-leaf-soft)] rounded-2xl skeleton-pulse" />
          </div>
        ) : !activeResult ? (
          <div className="py-16 text-center space-y-2.5 text-xs text-[var(--color-text-muted)]">
            <CheckSquare className="w-9 h-9 text-[var(--color-forest)] mx-auto" />
            <p className="max-w-xs mx-auto leading-relaxed">
              Select your symptoms on the left and click &ldquo;Analyze Symptoms&rdquo; to view common causes, plain-language explanations, home remedy tips, and the general use of tablets.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* High-Contrast Red Emergency Alert Card (Top of Response) */}
            {(activeResult.urgencyLevel.includes('Emergency') ||
              detectRedFlagSymptoms(activeResult.selectedSymptoms, activeResult.additionalNotes)) && (
              <div className="rounded-2xl bg-red-50 border-2 border-red-500 overflow-hidden shadow-sm">
                <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-extrabold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{t.emergencyBannerTitle}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-white text-red-700 px-2.5 py-0.5 rounded-md font-mono-tabular">
                    <PhoneCall className="w-3.5 h-3.5" />
                    108 / 112
                  </span>
                </div>
                <p className="p-4 text-xs font-semibold text-red-950 leading-relaxed">
                  {t.emergencyBannerText}
                </p>
              </div>
            )}

            {/* Urgency Banner */}
            <div
              className={`p-4 rounded-2xl border ${
                activeResult.urgencyLevel.includes('Emergency') ||
                activeResult.urgencyLevel.includes('Urgent')
                  ? 'bg-red-50 border-red-300 text-red-950'
                  : 'bg-[var(--color-leaf)] border-[var(--color-leaf-border)] text-[var(--color-forest)]'
              }`}
            >
              <div className="text-[11px] font-semibold opacity-80">
                Triage Urgency Indicator
              </div>
              <div className="text-base font-bold mt-0.5 flex items-center gap-2">
                {(activeResult.urgencyLevel.includes('Emergency') ||
                  activeResult.urgencyLevel.includes('Urgent')) && (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{activeResult.urgencyLevel}</span>
              </div>
            </div>

            {/* Summary Metadata */}
            <div className="text-xs text-[var(--color-text-dark)] bg-[var(--color-leaf-soft)] p-4 rounded-2xl border border-[var(--color-leaf-border)] space-y-1">
              <div>
                <strong className="text-[var(--color-forest)]">Selected Symptoms: </strong>
                {activeResult.selectedSymptoms.join(' · ')}
              </div>
              <div className="font-mono-tabular">
                <strong className="text-[var(--color-forest)]">Duration: </strong>
                {activeResult.duration} ·{' '}
                <strong className="text-[var(--color-forest)]">Severity: </strong>
                {activeResult.severity}
              </div>
            </div>

            {/* Common Possible Causes */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[var(--color-forest)]">
                (a) Common Possible Causes (Not a Definite Diagnosis):
              </h4>
              <ul className="space-y-2 text-xs text-[var(--color-text-dark)]">
                {activeResult.possibleCauses.map((cause, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded-xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] font-medium text-[var(--color-text-dark)]"
                  >
                    • {cause}
                  </li>
                ))}
              </ul>
            </div>

            {/* Plain-Language Explanation */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-[var(--color-forest)]">
                (b) Plain-Language Clinical Explanation:
              </h4>
              <p className="text-xs text-[var(--color-text-dark)] leading-relaxed bg-[var(--color-leaf-soft)] p-4 rounded-2xl border border-[var(--color-leaf-border)]">
                {activeResult.explanation}
              </p>
            </div>

            {/* Home Remedy & Self-Care Tips (Strictly Omitted During Emergency Red-Flag Triage) */}
            {!activeResult.urgencyLevel.includes('Emergency') &&
              !detectRedFlagSymptoms(activeResult.selectedSymptoms, activeResult.additionalNotes) &&
              activeResult.homeRemedies &&
              activeResult.homeRemedies.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[var(--color-forest)]">
                  (c) Home Remedy &amp; Self-Care Tips:
                </h4>
                <ul className="space-y-2 text-xs text-[var(--color-text-dark)]">
                  {activeResult.homeRemedies.map((tip, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl bg-[var(--color-leaf)]/60 border border-[var(--color-leaf-border)] font-medium text-[var(--color-text-dark)]"
                    >
                      • {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Common Tablets & Their General Use */}
            {activeResult.commonTabletsUse && activeResult.commonTabletsUse.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[var(--color-forest)]">
                  (d) Common Tablets &amp; Their General Use (Educational):
                </h4>
                <ul className="space-y-2 text-xs text-[var(--color-text-dark)]">
                  {activeResult.commonTabletsUse.map((tabletInfo, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-[var(--color-leaf-border)] font-medium text-[var(--color-text-dark)]"
                    >
                      • {tabletInfo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Specialty */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] text-xs">
              <span className="text-[var(--color-text-dark)] flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-[var(--color-forest)]" />
                <span>Recommended Specialist:</span>
              </span>
              <strong className="text-[var(--color-forest)]">
                {activeResult.recommendedSpecialty}
              </strong>
            </div>

            {/* Mandatory AI Footer */}
            <MandatoryAiFooter
              language={language}
              symptomsToPrefill={`${activeResult.selectedSymptoms.join(', ')} (${activeResult.duration}, ${activeResult.severity})`}
              onBookAppointment={onBookAppointment}
            />
          </div>
        )}
      </div>
    </div>
  );
};
