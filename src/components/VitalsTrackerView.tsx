import React, { useState, useEffect } from 'react';
import {
  Activity,
  HeartPulse,
  Thermometer,
  Droplets,
  PlusCircle,
  CheckCircle2,
  Circle,
  Download,
  Pill,
  AlertTriangle,
} from 'lucide-react';
import {
  EPrescription,
  PatientVitalRecord,
  SymptomCheckRecord,
  User,
} from '../types/healthcare';
import { loadPatientVitals, savePatientVitals } from '../utils/clinicalSafety';
import { downloadPreConsultSummaryPDF } from '../utils/pdfExport';

interface VitalsTrackerViewProps {
  currentUser: User;
  eprescriptions: EPrescription[];
  symptomChecks: SymptomCheckRecord[];
}

export const VitalsTrackerView: React.FC<VitalsTrackerViewProps> = ({
  currentUser,
  eprescriptions,
  symptomChecks,
}) => {
  const [vitals, setVitals] = useState<PatientVitalRecord[]>(() =>
    loadPatientVitals(currentUser.id)
  );
  const [systolicBp, setSystolicBp] = useState<string>('120');
  const [diastolicBp, setDiastolicBp] = useState<string>('78');
  const [heartRate, setHeartRate] = useState<string>('74');
  const [spo2, setSpo2] = useState<string>('98');
  const [temperatureF, setTemperatureF] = useState<string>('98.6');
  const [bloodGlucose, setBloodGlucose] = useState<string>('102');
  const [vitalNotes, setVitalNotes] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const todayKey = new Date().toISOString().split('T')[0];
  const doseStorageKey = `medassist_doses_v1_${currentUser.id}_${todayKey}`;

  const [takenDoses, setTakenDoses] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(doseStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    setVitals(loadPatientVitals(currentUser.id));
  }, [currentUser.id]);

  const toggleDose = (doseKey: string) => {
    setTakenDoses((prev) => {
      const next = { ...prev, [doseKey]: !prev[doseKey] };
      try {
        localStorage.setItem(doseStorageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleLogVital = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: PatientVitalRecord = {
      id: `vit-${Date.now()}`,
      patientId: currentUser.id,
      recordedAt: todayKey,
      systolicBp: Math.max(60, Math.min(240, Number(systolicBp) || 120)),
      diastolicBp: Math.max(40, Math.min(150, Number(diastolicBp) || 80)),
      heartRate: Math.max(40, Math.min(200, Number(heartRate) || 75)),
      spo2: Math.max(70, Math.min(100, Number(spo2) || 98)),
      temperatureF: Math.max(94, Math.min(107, Number(temperatureF) || 98.6)),
      bloodGlucoseMgDl: Math.max(40, Math.min(500, Number(bloodGlucose) || 100)),
      notes: vitalNotes.trim() || 'Self-recorded patient vital check',
    };

    const updated = [newRecord, ...vitals].slice(0, 14);
    setVitals(updated);
    savePatientVitals(currentUser.id, updated);
    setVitalNotes('');
    setSavedNotice(
      `Vital reading logged (${newRecord.systolicBp}/${newRecord.diastolicBp} mmHg, SpO2 ${newRecord.spo2}%) and synced for doctor review.`
    );
  };

  const latest = vitals[0];
  const chartSeries = [...vitals].slice(0, 7).reverse();

  // Build SVG polyline points for Systolic BP & Heart Rate
  const svgW = 540;
  const svgH = 150;
  const padX = 28;
  const padY = 20;
  const minVal = 55;
  const maxVal = 155;

  const toCoords = (values: number[]) =>
    values.map((val, idx) => {
      const x =
        values.length <= 1
          ? svgW / 2
          : padX + (idx / (values.length - 1)) * (svgW - padX * 2);
      const clamped = Math.max(minVal, Math.min(maxVal, val));
      const y = svgH - padY - ((clamped - minVal) / (maxVal - minVal)) * (svgH - padY * 2);
      return { x, y, val };
    });

  const bpPoints = toCoords(chartSeries.map((v) => v.systolicBp));
  const hrPoints = toCoords(chartSeries.map((v) => v.heartRate));

  const activeRx = eprescriptions[0] || null;
  const doseItems = (activeRx?.medicines || []).flatMap((med, idx) => {
    const freq = `${med.frequency} ${med.instructions}`.toLowerCase();
    const slots: string[] = [];
    if (freq.includes('twice') || freq.includes('1-0-1') || freq.includes('morning')) {
      slots.push('Morning');
    }
    if (freq.includes('thrice') || freq.includes('1-1-1') || freq.includes('afternoon')) {
      slots.push('Afternoon');
    }
    if (
      freq.includes('twice') ||
      freq.includes('1-0-1') ||
      freq.includes('night') ||
      freq.includes('bedtime') ||
      freq.includes('0-0-1') ||
      slots.length === 0
    ) {
      slots.push('Night');
    }
    return slots.map((slot) => ({
      key: `${activeRx.id}-${idx}-${slot}`,
      medName: med.name,
      dosage: med.dosage,
      slot,
      instructions: med.instructions,
    }));
  });

  const takenCount = doseItems.filter((d) => takenDoses[d.key]).length;
  const adherencePct =
    doseItems.length > 0 ? Math.round((takenCount / doseItems.length) * 100) : 100;

  return (
    <div className="fade-slide-up space-y-6">
      {/* Header Banner + 1-Click Pre-Consult Brief PDF */}
      <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-forest)] bg-[var(--color-leaf)] px-3 py-1 rounded-xl">
            <Activity className="w-3.5 h-3.5" />
            <span>Continuous Care Monitoring · {currentUser.name}</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--color-forest)]">
            Patient Vitals Log, Trend Charts &amp; Daily Dose Checklist
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Track blood pressure, SpO2, temperature, and glucose over time. Your latest readings sync directly to your Doctor Portal pre-consult brief.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            downloadPreConsultSummaryPDF({
              patient: currentUser,
              vitals,
              eprescriptions,
              symptomChecks,
            })
          }
          className="btn-forest-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>Download Pre-Consult Brief (PDF)</span>
        </button>
      </div>

      {savedNotice && (
        <div className="p-4 rounded-2xl bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] text-xs text-[var(--color-forest)] font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* 4 Vital Summary Cards */}
      {latest && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[var(--color-leaf-border)] rounded-2xl p-5 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-muted)]">
              <span>Blood Pressure</span>
              <HeartPulse className="w-4 h-4 text-[var(--color-forest)]" />
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-[var(--color-forest)]">
              {latest.systolicBp}/{latest.diastolicBp}{' '}
              <span className="text-xs font-normal text-[var(--color-text-muted)]">mmHg</span>
            </div>
            <span
              className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                latest.systolicBp >= 140 || latest.diastolicBp >= 90
                  ? 'bg-red-100 text-red-800'
                  : latest.systolicBp >= 125
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-[var(--color-leaf)] text-[var(--color-forest)]'
              }`}
            >
              {latest.systolicBp >= 140
                ? 'High — Review with MD'
                : latest.systolicBp >= 125
                ? 'Slightly Elevated'
                : 'Normal Range'}
            </span>
          </div>

          <div className="bg-white border border-[var(--color-leaf-border)] rounded-2xl p-5 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-muted)]">
              <span>Oxygen Saturation (SpO2)</span>
              <Droplets className="w-4 h-4 text-[var(--color-forest)]" />
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-[var(--color-forest)]">
              {latest.spo2}%{' '}
              <span className="text-xs font-normal text-[var(--color-text-muted)]">
                · HR {latest.heartRate} bpm
              </span>
            </div>
            <span
              className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                latest.spo2 < 94
                  ? 'bg-red-100 text-red-800'
                  : 'bg-[var(--color-leaf)] text-[var(--color-forest)]'
              }`}
            >
              {latest.spo2 < 94 ? 'Low SpO2 — Seek Care' : 'Optimal Oxygenation'}
            </span>
          </div>

          <div className="bg-white border border-[var(--color-leaf-border)] rounded-2xl p-5 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-muted)]">
              <span>Body Temperature</span>
              <Thermometer className="w-4 h-4 text-[var(--color-forest)]" />
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-[var(--color-forest)]">
              {latest.temperatureF.toFixed(1)}°F
            </div>
            <span
              className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                latest.temperatureF >= 100.4
                  ? 'bg-red-100 text-red-800'
                  : latest.temperatureF >= 99.1
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-[var(--color-leaf)] text-[var(--color-forest)]'
              }`}
            >
              {latest.temperatureF >= 100.4
                ? 'Fever Range'
                : latest.temperatureF >= 99.1
                ? 'Low-Grade Warmth'
                : 'Afebrile (Normal)'}
            </span>
          </div>

          <div className="bg-white border border-[var(--color-leaf-border)] rounded-2xl p-5 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-muted)]">
              <span>Blood Glucose</span>
              <Activity className="w-4 h-4 text-[var(--color-forest)]" />
            </div>
            <div className="text-2xl font-bold font-mono-tabular text-[var(--color-forest)]">
              {latest.bloodGlucoseMgDl}{' '}
              <span className="text-xs font-normal text-[var(--color-text-muted)]">mg/dL</span>
            </div>
            <span
              className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                latest.bloodGlucoseMgDl >= 140
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-[var(--color-leaf)] text-[var(--color-forest)]'
              }`}
            >
              {latest.bloodGlucoseMgDl >= 140 ? 'Elevated Post-Meal' : 'Within Target Range'}
            </span>
          </div>
        </div>
      )}

      {/* Trend Chart + Log New Vitals Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: SVG Trend Chart */}
        <div className="lg:col-span-7 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-leaf-border)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-forest)]">
                Multi-Day Vitals Trend (Systolic BP &amp; Resting Heart Rate)
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Showing your last {chartSeries.length} recorded clinical readings
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 text-[var(--color-forest)]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#064734]" />
                Systolic BP (mmHg)
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                Heart Rate (bpm)
              </span>
            </div>
          </div>

          <div className="bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] rounded-2xl p-4">
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-44 overflow-visible">
              {/* Reference threshold gridlines */}
              {[120, 100, 80].map((refVal) => {
                const y =
                  svgH -
                  padY -
                  ((refVal - minVal) / (maxVal - minVal)) * (svgH - padY * 2);
                return (
                  <g key={refVal}>
                    <line
                      x1={padX}
                      y1={y}
                      x2={svgW - padX}
                      y2={y}
                      stroke="#CBD5E1"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={4}
                      y={y + 3}
                      fontSize="10"
                      fill="#64748B"
                      fontFamily="monospace"
                    >
                      {refVal}
                    </text>
                  </g>
                );
              })}

              {bpPoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#064734"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={bpPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              )}

              {hrPoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={hrPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              )}

              {bpPoints.map((p, idx) => (
                <g key={`bp-${idx}`}>
                  <circle cx={p.x} cy={p.y} r="4.5" fill="#064734" stroke="#FFFFFF" strokeWidth="1.5" />
                  <text
                    x={p.x}
                    y={p.y - 9}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#064734"
                    fontFamily="monospace"
                  >
                    {p.val}
                  </text>
                  <text
                    x={p.x}
                    y={svgH - 2}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#475569"
                    fontFamily="monospace"
                  >
                    {chartSeries[idx]?.recordedAt.slice(5)}
                  </text>
                </g>
              ))}

              {hrPoints.map((p, idx) => (
                <g key={`hr-${idx}`}>
                  <circle cx={p.x} cy={p.y} r="4" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
                  <text
                    x={p.x}
                    y={p.y + 14}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="bold"
                    fill="#047857"
                    fontFamily="monospace"
                  >
                    {p.val}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              Alert threshold: Seek urgent review if Systolic BP ≥ 160 mmHg, SpO2 &lt; 94%, or Temp ≥ 103°F.
            </span>
          </div>
        </div>

        {/* Right: Log New Reading Form */}
        <form
          onSubmit={handleLogVital}
          className="lg:col-span-5 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4"
        >
          <div className="border-b border-[var(--color-leaf-border)] pb-3 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-[var(--color-forest)]" />
            <h3 className="text-sm font-bold text-[var(--color-forest)]">
              Log Today&apos;s Vital Reading
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-[var(--color-forest)] mb-1">
                Systolic BP (mmHg)
              </label>
              <input
                type="number"
                value={systolicBp}
                onChange={(e) => setSystolicBp(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-leaf-border)] rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-bold text-[var(--color-forest)] mb-1">
                Diastolic BP (mmHg)
              </label>
              <input
                type="number"
                value={diastolicBp}
                onChange={(e) => setDiastolicBp(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-leaf-border)] rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-bold text-[var(--color-forest)] mb-1">
                Heart Rate (bpm)
              </label>
              <input
                type="number"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-leaf-border)] rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-bold text-[var(--color-forest)] mb-1">
                SpO2 (%)
              </label>
              <input
                type="number"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-leaf-border)] rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-bold text-[var(--color-forest)] mb-1">
                Temperature (°F)
              </label>
              <input
                type="number"
                step="0.1"
                value={temperatureF}
                onChange={(e) => setTemperatureF(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-leaf-border)] rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-bold text-[var(--color-forest)] mb-1">
                Blood Glucose (mg/dL)
              </label>
              <input
                type="number"
                value={bloodGlucose}
                onChange={(e) => setBloodGlucose(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-leaf-border)] rounded-xl font-mono-tabular"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-[var(--color-forest)] mb-1">
              Symptom / Context Note
            </label>
            <input
              type="text"
              value={vitalNotes}
              onChange={(e) => setVitalNotes(e.target.value)}
              placeholder="e.g., Fasting reading before morning tablets..."
              className="w-full px-3 py-2 border border-[var(--color-leaf-border)] rounded-xl"
            />
          </div>

          <button
            type="submit"
            className="btn-forest-primary w-full py-2.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
          >
            Save Vital Reading
          </button>
        </form>
      </div>

      {/* Today's Medication Dose Adherence Checklist */}
      <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-leaf-border)] pb-3">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-[var(--color-forest)]" />
            <div>
              <h3 className="text-sm font-bold text-[var(--color-forest)]">
                Today&apos;s Active Medication Dose Checklist ({todayKey})
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Synced automatically from your latest Doctor E-Prescription ({activeRx ? activeRx.id.toUpperCase() : 'None'})
              </p>
            </div>
          </div>
          <div className="text-xs font-mono-tabular font-bold px-3 py-1 rounded-xl bg-[var(--color-leaf)] text-[var(--color-forest)]">
            Adherence: {takenCount}/{doseItems.length} doses ({adherencePct}%)
          </div>
        </div>

        {doseItems.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] py-4">
            No active prescribed doses found. Once your doctor issues an E-Prescription, your daily schedule will appear here automatically.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {doseItems.map((dose) => {
              const checked = Boolean(takenDoses[dose.key]);
              return (
                <button
                  key={dose.key}
                  type="button"
                  onClick={() => toggleDose(dose.key)}
                  className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    checked
                      ? 'bg-[var(--color-leaf)]/70 border-[var(--color-forest)] text-[var(--color-forest)]'
                      : 'bg-[var(--color-leaf-soft)] border-[var(--color-leaf-border)] text-[var(--color-text-dark)] hover:border-[var(--color-forest)]'
                  }`}
                >
                  {checked ? (
                    <CheckCircle2 className="w-5 h-5 text-[var(--color-forest)] shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate">{dose.medName}</span>
                      <span className="text-[10px] font-mono-tabular font-bold px-2 py-0.5 rounded-md bg-white border border-[var(--color-leaf-border)] text-[var(--color-forest)] shrink-0">
                        {dose.slot}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono-tabular text-[var(--color-text-muted)]">
                      {dose.dosage} · {dose.instructions}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
