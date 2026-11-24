import React, { useState } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eye,
  Sparkles,
  ShieldAlert,
  FlaskConical,
  Calendar,
} from 'lucide-react';
import {
  PrescriptionAnalysisResult,
  SupportedLanguage,
  User,
  ConfidenceLevel,
  ExtractedMedicine,
} from '../types/healthcare';
import { UI_TRANSLATIONS } from '../utils/i18n';
import {
  buildSamplePrescriptionAnalysis,
  detectDrugInteractions,
  generateSamplePrescriptionDataUrl,
  SamplePrescriptionPreset,
} from '../utils/prescriptionGenerator';
import {
  buildSampleLabReport,
  checkAllergyConflicts,
  SampleLabReportResult,
} from '../utils/clinicalSafety';
import { MandatoryAiFooter } from './MandatoryAiFooter';

interface PrescriptionAnalyzerProps {
  currentUser: User;
  language: SupportedLanguage;
  analyses: PrescriptionAnalysisResult[];
  onAnalysisCreated: (result: PrescriptionAnalysisResult) => void;
  onBookAppointment: (prefillSymptoms?: string) => void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function deriveTimingLabel(med: ExtractedMedicine): string {
  if (med.timing && med.timing.trim()) return med.timing;
  const freq = String(med.frequency || '').toLowerCase();
  if (freq.includes('twice') || freq.includes('bd')) return '1-0-1 After Food';
  if (freq.includes('thrice') || freq.includes('tid') || freq.includes('3 times')) {
    return '1-1-1 After Food';
  }
  if (freq.includes('night') || freq.includes('bedtime')) return '0-0-1 At Bedtime';
  if (freq.includes('morning') || freq.includes('empty stomach')) return '1-0-0 Before Breakfast';
  if (freq.includes('once')) return '1-0-0 After Food';
  return med.frequency || 'As Directed';
}

function getNumericScore(med: ExtractedMedicine): number {
  if (typeof med.confidenceScore === 'number') return med.confidenceScore;
  if (med.confidence === 'High') return 96;
  if (med.confidence === 'Medium') return 82;
  return 68;
}

export const PrescriptionAnalyzer: React.FC<PrescriptionAnalyzerProps> = ({
  currentUser,
  language,
  analyses,
  onAnalysisCreated,
  onBookAppointment,
}) => {
  const [analyzerMode, setAnalyzerMode] = useState<'rx' | 'lab'>('rx');
  const [consentChecked, setConsentChecked] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<PrescriptionAnalysisResult | null>(
    analyses[0] || null
  );
  const [labReportResult, setLabReportResult] = useState<SampleLabReportResult | null>(null);

  const t = UI_TRANSLATIONS[language];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      setError('Invalid file format. Please upload a PNG, JPEG, or WEBP prescription image.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File size exceeds the 5 MB security limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedImage(reader.result);
        setSelectedFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSamplePreset = (mode: SamplePrescriptionPreset) => {
    setError(null);
    setConsentChecked(true);
    const sample = generateSamplePrescriptionDataUrl(mode);
    setSelectedImage(sample.dataUrl);
    setSelectedFileName(sample.fileName);

    const presetResult = buildSamplePrescriptionAnalysis(
      mode,
      currentUser.id,
      language,
      sample.dataUrl,
      sample.fileName
    );
    setActiveResult(presetResult);
    onAnalysisCreated(presetResult);
  };

  const handleAnalyze = async () => {
    if (!consentChecked) {
      setError('Please tick the patient consent checkbox before analyzing a prescription.');
      return;
    }
    if (!selectedImage) {
      setError('Please upload a prescription image or load a sample prescription first.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/ai/prescription-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: currentUser.id,
          imageDataUrl: selectedImage,
          fileName: selectedFileName || 'prescription_scan.png',
          language,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze prescription image.');
      }
      const enrichedAnalysis: PrescriptionAnalysisResult = {
        ...data.analysis,
        drugInteractionAlert:
          data.analysis.drugInteractionAlert ||
          detectDrugInteractions(data.analysis.medicines || []),
      };
      onAnalysisCreated(enrichedAnalysis);
      setActiveResult(enrichedAnalysis);
    } catch (err: any) {
      setError(
        err.message ||
          'Unable to complete prescription analysis right now. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isLowOrUnreadable = (value: string, confidence: ConfidenceLevel): boolean => {
    return (
      confidence === 'Low' ||
      String(value || '')
        .toLowerCase()
        .includes('unreadable') ||
      String(value || '')
        .toLowerCase()
        .includes('unclear')
    );
  };

  const renderConfidenceLabel = (value: string, confidence: ConfidenceLevel) => {
    const low = isLowOrUnreadable(value, confidence);
    if (low) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span>Confidence: Low · Unclear, please verify</span>
        </span>
      );
    }
    if (confidence === 'Medium') {
      return (
        <span className="text-xs font-semibold text-amber-700">
          Confidence: Medium · Please double-check
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Confidence: High</span>
      </span>
    );
  };

  const renderTableConfidenceBadge = (med: ExtractedMedicine) => {
    const score = getNumericScore(med);
    const low = isLowOrUnreadable(med.name, med.confidence) || score < 75;
    if (low) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-300 text-[11px] font-bold text-red-800 whitespace-nowrap">
          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
          <span>{score}% Low - Verify with Pharmacist</span>
        </span>
      );
    }
    if (med.confidence === 'Medium' || score < 90) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-[11px] font-bold text-amber-900 whitespace-nowrap">
          <span>{score}% Medium - Verify</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] text-[11px] font-bold text-[var(--color-forest)] whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3 text-[var(--color-forest)] shrink-0" />
        <span>{score}% High</span>
      </span>
    );
  };

  const activeInteractionAlert =
    activeResult?.drugInteractionAlert ||
    (activeResult ? detectDrugInteractions(activeResult.medicines) : null);

  const allergyConflicts = activeResult
    ? checkAllergyConflicts(
        activeResult.medicines.map((m) => m.name),
        currentUser.allergies
      )
    : [];

  const handleLoadSampleLabReport = () => {
    setError(null);
    const sample = buildSampleLabReport(currentUser);
    setLabReportResult(sample);
  };

  return (
    <div className="fade-slide-up space-y-6">
      {/* Mode Switcher: Prescription OCR vs Lab Report Analyzer */}
      <div className="bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-xl">
          <button
            type="button"
            onClick={() => setAnalyzerMode('rx')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              analyzerMode === 'rx'
                ? 'bg-[var(--color-forest)] text-white shadow-xs'
                : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Prescription OCR</span>
          </button>
          <button
            type="button"
            onClick={() => setAnalyzerMode('lab')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              analyzerMode === 'lab'
                ? 'bg-[var(--color-forest)] text-white shadow-xs'
                : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Lab Report Analyzer (CBC / HbA1c / Lipid)</span>
          </button>
        </div>

        <div className="text-[11px] text-[var(--color-text-muted)] font-mono-tabular">
          Patient Allergies Tracked:{' '}
          <strong className="text-[var(--color-forest)]">
            {currentUser.allergies?.length ? currentUser.allergies.join(', ') : 'None Known'}
          </strong>
        </div>
      </div>

      {analyzerMode === 'lab' ? (
        <div className="space-y-6">
          <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-forest)] flex items-center gap-2">
                <FlaskConical className="w-5 h-5" />
                <span>Diagnostic Lab Report Analyzer (CBC / HbA1c / Lipid Panel)</span>
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Instantly interpret pathology biomarkers with reference ranges, Normal/Borderline/High/Low flags, and plain-language explanations.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadSampleLabReport}
              className="btn-forest-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>Load Sample Blood Test Report (CBC + HbA1c + Lipid)</span>
            </button>
          </div>

          {labReportResult ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Rendered Lab Report Image */}
              <div className="lg:col-span-4 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--color-leaf-border)] pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[var(--color-forest)]" />
                    <h3 className="text-sm font-bold text-[var(--color-forest)]">
                      NABL Lab Report Scan
                    </h3>
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] font-mono-tabular">
                    {labReportResult.reportDate}
                  </span>
                </div>
                <div className="bg-[var(--color-leaf-soft)] rounded-2xl p-3 border border-[var(--color-leaf-border)]">
                  {labReportResult.imageDataUrl ? (
                    <img
                      src={labReportResult.imageDataUrl}
                      alt="Sample NABL diagnostic lab report"
                      className="w-full rounded-xl shadow-xs object-contain"
                    />
                  ) : (
                    <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
                      {labReportResult.labName}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Structured Biomarker Table */}
              <div className="lg:col-span-8 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-leaf-border)] pb-3">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-forest)]">
                      {labReportResult.reportTitle}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {labReportResult.labName} · Patient: {labReportResult.patientName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onBookAppointment(
                        `Lab Report Review (${labReportResult.reportTitle}): WBC 11,800/µL, HbA1c 5.9%, LDL 142 mg/dL`
                      )
                    }
                    className="btn-forest-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Book Specialist Review</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-[var(--color-leaf-border)]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--color-leaf)] text-[var(--color-forest)] font-bold border-b border-[var(--color-leaf-border)]">
                        <th className="py-3 px-3.5">Parameter</th>
                        <th className="py-3 px-3.5">Result</th>
                        <th className="py-3 px-3.5">Reference Range</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5">Clinical Meaning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-leaf-border)]/70">
                      {labReportResult.biomarkers.map((bio) => {
                        const statusStyle =
                          bio.status === 'High' || bio.status === 'Low'
                            ? 'bg-red-50 border-red-300 text-red-800'
                            : bio.status === 'Borderline'
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-[var(--color-leaf)] border-[var(--color-leaf-border)] text-[var(--color-forest)]';
                        return (
                          <tr
                            key={bio.parameter}
                            className="bg-white hover:bg-[var(--color-leaf-soft)]/50"
                          >
                            <td className="py-3 px-3.5 font-bold text-[var(--color-forest)] align-top">
                              {bio.parameter}
                            </td>
                            <td className="py-3 px-3.5 font-mono-tabular font-bold text-[var(--color-text-dark)] align-top whitespace-nowrap">
                              {bio.value} {bio.unit}
                            </td>
                            <td className="py-3 px-3.5 font-mono-tabular text-[var(--color-text-muted)] align-top whitespace-nowrap">
                              {bio.referenceRange}
                            </td>
                            <td className="py-3 px-3.5 align-top whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${statusStyle}`}
                              >
                                {bio.status}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-[var(--color-text-dark)] leading-relaxed align-top">
                              {bio.explanation}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] text-xs text-[var(--color-text-dark)] space-y-1">
                  <div className="font-bold text-[var(--color-forest)]">
                    AI Clinical Summary &amp; Recommended Specialty ({labReportResult.recommendedSpecialty}):
                  </div>
                  <p className="leading-relaxed">{labReportResult.summary}</p>
                </div>

                <MandatoryAiFooter
                  language={language}
                  symptomsToPrefill={`Follow-up for ${labReportResult.reportTitle}: Elevated WBC & LDL, Borderline HbA1c`}
                  onBookAppointment={onBookAppointment}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs py-14 px-6 text-center space-y-3">
              <FlaskConical className="w-10 h-10 text-[var(--color-forest)] mx-auto" />
              <h3 className="text-sm font-bold text-[var(--color-forest)]">
                Evaluate Blood Test &amp; Pathology Biomarkers in Seconds
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] max-w-lg mx-auto leading-relaxed">
                Click &ldquo;Load Sample Blood Test Report (CBC + HbA1c + Lipid)&rdquo; above to demonstrate automated biomarker extraction, out-of-range highlighting, and specialist referral.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mandatory Handwriting Warning Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/95 border border-amber-300 shadow-2xs flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-1">
              <p className="font-bold text-sm">
                AI can misread handwriting. Always confirm medicine names and doses with your doctor or pharmacist before taking anything.
              </p>
              {language !== 'English' && (
                <p className="text-amber-900 font-medium">{t.prescriptionWarning}</p>
              )}
            </div>
          </div>

      {/* Upload & Consent Card */}
      <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-forest)]">
              Multimodal Prescription Scanner &amp; Plain-Language Explainer
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Upload a photo or scan of a handwritten or printed prescription (JPEG, PNG, WEBP up to 5 MB), or load a 1-click evaluation preset.
            </p>
          </div>

          {/* One-Click Academic Evaluation Sample Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleLoadSamplePreset('standard')}
              className="btn-forest-secondary px-3.5 py-2 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap"
            >
              Load Sample Handwritten Prescription (Standard)
            </button>
            <button
              type="button"
              onClick={() => handleLoadSamplePreset('interaction')}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 transition-all cursor-pointer whitespace-nowrap"
            >
              Load Sample Prescription (Drug Interaction Alert)
            </button>
          </div>
        </div>

        {/* Step 1: Mandatory Consent Checkbox */}
        <label className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] cursor-pointer select-none transition-colors hover:bg-[var(--color-leaf)]/60">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#064734] rounded cursor-pointer"
          />
          <div className="text-xs text-[var(--color-text-dark)] leading-relaxed">
            <span className="font-bold text-[var(--color-forest)]">
              Patient Informed Consent (Required):
            </span>{' '}
            I consent to uploading my prescription image for automated AI optical extraction and plain-language educational explanation. I understand that AI can misread handwriting and I will verify all medicines and dosages with a licensed doctor or pharmacist.
          </div>
        </label>

        {/* Step 2: File Upload Control & Action Button */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-8">
            <label
              className={`flex items-center justify-between gap-4 px-4 py-3.5 border border-dashed rounded-2xl transition-all ${
                consentChecked
                  ? 'border-[var(--color-forest)] bg-[var(--color-leaf-soft)] hover:bg-[var(--color-leaf)]/60 cursor-pointer'
                  : 'border-slate-300 bg-slate-100 opacity-70 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Upload className="w-5 h-5 text-[var(--color-forest)] shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-bold text-[var(--color-forest)] truncate">
                    {selectedFileName
                      ? `Selected: ${selectedFileName}`
                      : 'Choose prescription photo/scan (PNG, JPG, WEBP · Max 5 MB)'}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    {consentChecked
                      ? 'Consent verified — click to browse your device or click Analyze below'
                      : 'Please tick the consent checkbox above or load a sample preset'}
                  </div>
                </div>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={!consentChecked}
                onChange={handleFileChange}
                className="hidden"
              />
              <span className="px-3.5 py-1.5 text-xs font-bold bg-white border border-[var(--color-forest)] rounded-xl text-[var(--color-forest)] shrink-0 shadow-2xs">
                Browse File
              </span>
            </label>
          </div>

          <div className="md:col-span-4">
            <button
              type="button"
              disabled={!consentChecked || !selectedImage || loading}
              onClick={handleAnalyze}
              className="btn-forest-primary w-full py-3.5 px-4 disabled:opacity-50 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting Prescription...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Prescription</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Previous Scans Switcher (if multiple exist) */}
      {analyses.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-[var(--color-forest)] shrink-0">Recent Scans:</span>
          {analyses.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveResult(item)}
              className={`btn-hover-lift px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeResult?.id === item.id
                  ? 'bg-[var(--color-forest)] text-white border-[var(--color-forest)] shadow-2xs'
                  : 'bg-white text-[var(--color-text-dark)] border-[var(--color-leaf-border)] hover:bg-[var(--color-leaf)]'
              }`}
            >
              {item.fileName} · {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </button>
          ))}
        </div>
      )}

      {/* Side-by-Side Comparison: Original Prescription Image vs Extracted Structured Result */}
      {(selectedImage || activeResult) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Original Prescription Image */}
          <div className="lg:col-span-4 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--color-leaf-border)] pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[var(--color-forest)]" />
                <h3 className="text-sm font-bold text-[var(--color-forest)]">
                  Prescription Scan
                </h3>
              </div>
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                Side-by-Side
              </span>
            </div>

            <div className="bg-[var(--color-leaf-soft)] rounded-2xl p-3 border border-[var(--color-leaf-border)] flex items-center justify-center overflow-hidden">
              <img
                src={activeResult?.imageDataUrl || selectedImage || ''}
                alt="Uploaded medical prescription for side-by-side comparison"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="block max-h-[580px] w-full object-contain mx-auto rounded-xl shadow-xs"
              />
            </div>
          </div>

          {/* Right: Structured Medicine Table & Drug Interaction Warning */}
          <div className="lg:col-span-8 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-5">
            {loading ? (
              <div className="space-y-4 py-4">
                <div className="h-5 w-48 bg-[var(--color-leaf)] rounded-lg skeleton-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="h-20 bg-[var(--color-leaf-soft)] rounded-2xl skeleton-pulse" />
                  <div className="h-20 bg-[var(--color-leaf-soft)] rounded-2xl skeleton-pulse" />
                  <div className="h-20 bg-[var(--color-leaf-soft)] rounded-2xl skeleton-pulse" />
                </div>
                <div className="h-36 bg-[var(--color-leaf-soft)] rounded-2xl skeleton-pulse" />
              </div>
            ) : !activeResult ? (
              <div className="py-16 text-center space-y-2.5">
                <FileText className="w-9 h-9 text-[var(--color-forest)] mx-auto" />
                <h3 className="text-sm font-bold text-[var(--color-forest)]">
                  Ready to Extract Prescription Details
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto leading-relaxed">
                  Click one of the sample preset buttons above, or upload an image and click &ldquo;Analyze Prescription&rdquo;.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-leaf-border)] pb-3">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-forest)]">
                      Extracted Prescription Details
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Structured medication table with confidence scoring and safety checks
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">
                    Language: {activeResult.language}
                  </span>
                </div>

                {/* Allergy Contraindication Cross-Check Warning */}
                {allergyConflicts.length > 0 && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-red-50 border-2 border-red-400 text-red-950 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 font-extrabold text-sm text-red-900">
                      <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                      <span>Patient Allergy Contraindication Warning ({allergyConflicts.length})</span>
                    </div>
                    <ul className="space-y-1.5 text-xs">
                      {allergyConflicts.map((c, idx) => (
                        <li
                          key={`${c.medicineName}-${idx}`}
                          className="p-2.5 rounded-xl bg-white/80 border border-red-200"
                        >
                          <strong>{c.medicineName}</strong> conflicts with documented allergy{' '}
                          <span className="font-bold underline">{c.matchedAllergy}</span> — {c.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Clear Amber Warning Box for Drug Interactions */}
                {activeInteractionAlert?.detected && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 space-y-2 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-extrabold text-sm text-amber-900">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <span>{activeInteractionAlert.title}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-200 text-amber-950 text-[11px] font-bold font-mono-tabular">
                        Severity: {activeInteractionAlert.severity}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-amber-900">
                      Interacting Medicines: {activeInteractionAlert.interactingMedicines.join(' + ')}
                    </p>
                    <p className="text-xs text-amber-950 leading-relaxed">
                      {activeInteractionAlert.explanation}
                    </p>
                    <p className="text-xs font-bold text-amber-900 bg-amber-100/80 p-2.5 rounded-xl border border-amber-300">
                      Pharmacist / Doctor Action: {activeInteractionAlert.recommendation}
                    </p>
                  </div>
                )}

                {/* Header Metadata: Doctor Name, Date, Patient Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {[
                    { label: 'Doctor Name', field: activeResult.doctorName },
                    { label: 'Prescription Date', field: activeResult.date },
                    { label: 'Patient Name', field: activeResult.patientName },
                  ].map((meta) => {
                    const low = isLowOrUnreadable(meta.field.value, meta.field.confidence);
                    return (
                      <div
                        key={meta.label}
                        className={`p-3.5 rounded-2xl border ${
                          low
                            ? 'bg-red-50 border-red-300 text-red-950'
                            : 'bg-[var(--color-leaf-soft)] border-[var(--color-leaf-border)] text-[var(--color-text-dark)]'
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1">
                          {meta.label}
                        </div>
                        <div className="text-sm font-bold break-words">
                          {meta.field.value}
                        </div>
                        <div className="mt-1.5">
                          {renderConfidenceLabel(meta.field.value, meta.field.confidence)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Structured 5-Column Extracted Medicines Table */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-[var(--color-forest)]">
                    Extracted Medicines ({activeResult.medicines.length}) — Structured Schedule &amp; Confidence Verification
                  </h4>

                  <div className="overflow-x-auto rounded-2xl border border-[var(--color-leaf-border)]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[var(--color-leaf)] text-[var(--color-forest)] font-bold border-b border-[var(--color-leaf-border)]">
                          <th className="py-3 px-3.5">Medicine Name</th>
                          <th className="py-3 px-3.5">Dosage</th>
                          <th className="py-3 px-3.5">Timing</th>
                          <th className="py-3 px-3.5">Confidence Score</th>
                          <th className="py-3 px-3.5">Purpose</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-leaf-border)]/70">
                        {activeResult.medicines.map((med, idx) => {
                          const score = getNumericScore(med);
                          const low = isLowOrUnreadable(med.name, med.confidence) || score < 75;
                          return (
                            <tr
                              key={idx}
                              className={low ? 'bg-red-50/70' : 'bg-white hover:bg-[var(--color-leaf-soft)]/50'}
                            >
                              <td className="py-3 px-3.5 font-bold text-[var(--color-forest)] align-top">
                                <div>{med.name}</div>
                                {med.duration && (
                                  <div className="text-[11px] font-normal text-[var(--color-text-muted)] font-mono-tabular mt-0.5">
                                    Duration: {med.duration}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3.5 font-mono-tabular font-semibold text-[var(--color-text-dark)] align-top whitespace-nowrap">
                                {med.dosage}
                              </td>
                              <td className="py-3 px-3.5 font-mono-tabular text-[var(--color-text-dark)] align-top whitespace-nowrap">
                                {deriveTimingLabel(med)}
                              </td>
                              <td className="py-3 px-3.5 align-top">
                                {renderTableConfidenceBadge(med)}
                              </td>
                              <td className="py-3 px-3.5 text-[var(--color-text-dark)] leading-relaxed align-top">
                                <div>{med.generalPurpose}</div>
                                {med.notes && (
                                  <div className="text-[11px] text-[var(--color-text-muted)] mt-1">
                                    Note: {med.notes}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* General Notes */}
                <div
                  className={`p-4 rounded-2xl border text-xs ${
                    isLowOrUnreadable(
                      activeResult.generalNotes.value,
                      activeResult.generalNotes.confidence
                    )
                      ? 'bg-red-50 border-red-300 text-red-900'
                      : 'bg-[var(--color-leaf-soft)] border-[var(--color-leaf-border)] text-[var(--color-text-dark)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <strong className="text-[var(--color-forest)]">Doctor&apos;s Clinical Notes &amp; Advice:</strong>
                    {renderConfidenceLabel(
                      activeResult.generalNotes.value,
                      activeResult.generalNotes.confidence
                    )}
                  </div>
                  <p>{activeResult.generalNotes.value}</p>
                </div>

                <MandatoryAiFooter
                  language={language}
                  symptomsToPrefill={activeResult.suggestedSymptoms}
                  onBookAppointment={onBookAppointment}
                />
              </>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
