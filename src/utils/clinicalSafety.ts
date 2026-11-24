import { EPrescription, PatientVitalRecord, User } from '../types/healthcare';

export interface AllergyConflict {
  medicineName: string;
  matchedAllergy: string;
  reason: string;
  severity: 'High' | 'Moderate';
}

interface AllergyRule {
  allergyKeywords: string[];
  drugKeywords: string[];
  label: string;
  reason: string;
}

const ALLERGY_CROSS_REACTIVITY_RULES: AllergyRule[] = [
  {
    allergyKeywords: ['sulfa', 'sulfonamide', 'sulfamethoxazole', 'cotrimoxazole'],
    drugKeywords: [
      'sulfamethoxazole',
      'cotrimoxazole',
      'bactrim',
      'septran',
      'sulfasalazine',
      'sulfadiazine',
      'dapsone',
      'celecoxib',
      'furosemide',
    ],
    label: 'Sulfa / Sulfonamide Class',
    reason:
      'Contains or cross-reacts with Sulfonamide moiety; high risk of hypersensitivity rash or Stevens-Johnson reaction.',
  },
  {
    allergyKeywords: ['penicillin', 'amoxicillin', 'ampicillin', 'beta-lactam'],
    drugKeywords: [
      'penicillin',
      'amoxicillin',
      'amoxyclav',
      'augmentin',
      'ampicillin',
      'cloxacillin',
      'piperacillin',
      'tazobactam',
    ],
    label: 'Penicillin / Beta-Lactam Class',
    reason:
      'Belongs to the Penicillin antibiotic family; contraindicated due to risk of anaphylaxis or urticaria.',
  },
  {
    allergyKeywords: ['nsaid', 'aspirin', 'ibuprofen', 'diclofenac'],
    drugKeywords: ['aspirin', 'ibuprofen', 'diclofenac', 'naproxen', 'aceclofenac', 'ketorolac'],
    label: 'NSAID / Salicylate Class',
    reason:
      'Cross-reactive COX-1 NSAID/salicylate agent; may trigger bronchospasm, angioedema, or gastric irritation.',
  },
  {
    allergyKeywords: ['cephalosporin', 'cefixime', 'ceftriaxone'],
    drugKeywords: ['cefixime', 'ceftriaxone', 'cephalexin', 'cefuroxime', 'cefpodoxime'],
    label: 'Cephalosporin Class',
    reason: 'Matches documented Cephalosporin allergy; select a non-beta-lactam alternative.',
  },
  {
    allergyKeywords: ['macrolide', 'azithromycin', 'erythromycin'],
    drugKeywords: ['azithromycin', 'erythromycin', 'clarithromycin', 'roxithromycin'],
    label: 'Macrolide Class',
    reason: 'Belongs to the Macrolide antibiotic class noted in the patient allergy profile.',
  },
];

export function checkAllergyConflicts(
  medicineNames: string[],
  patientAllergies?: string[]
): AllergyConflict[] {
  const allergies = (patientAllergies || [])
    .map((a) => a.trim())
    .filter((a) => a && a.toLowerCase() !== 'none known' && a.toLowerCase() !== 'none');

  if (allergies.length === 0 || medicineNames.length === 0) return [];

  const conflicts: AllergyConflict[] = [];
  const seen = new Set<string>();

  for (const rawMed of medicineNames) {
    const medName = rawMed.trim();
    if (!medName) continue;
    const medLower = medName.toLowerCase();

    for (const allergy of allergies) {
      const allergyLower = allergy.toLowerCase();

      // Check pharmacological class rules
      for (const rule of ALLERGY_CROSS_REACTIVITY_RULES) {
        const allergyMatchesRule = rule.allergyKeywords.some((kw) => allergyLower.includes(kw));
        const drugMatchesRule = rule.drugKeywords.some((kw) => medLower.includes(kw));
        if (allergyMatchesRule && drugMatchesRule) {
          const key = `${medLower}::${allergyLower}`;
          if (!seen.has(key)) {
            seen.add(key);
            conflicts.push({
              medicineName: medName,
              matchedAllergy: allergy,
              reason: `${rule.label}: ${rule.reason}`,
              severity: 'High',
            });
          }
        }
      }

      // Direct token match (e.g., allergy keyword appears directly in medicine name)
      const tokens = allergyLower
        .split(/[\s,/()-]+/)
        .filter((t) => t.length >= 4 && t !== 'drugs' && t !== 'drug' && t !== 'mites');
      if (tokens.some((tok) => medLower.includes(tok))) {
        const key = `${medLower}::${allergyLower}`;
        if (!seen.has(key)) {
          seen.add(key);
          conflicts.push({
            medicineName: medName,
            matchedAllergy: allergy,
            reason: `Direct match with documented patient allergy ("${allergy}"). Verify before dispensing.`,
            severity: 'High',
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Computes a deterministic tamper-evident verification code for an E-Prescription.
 */
export function computeRxVerificationCode(rx: Pick<EPrescription, 'id' | 'patientId' | 'doctorRegistration' | 'date'>): string {
  const payload = `${rx.id}|${rx.patientId}|${rx.doctorRegistration}|${rx.date}`;
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `MED-VER-${hex}`;
}

/**
 * Generates a deterministic 21x21 QR-style verification matrix (3 corner finder patterns + data payload bits)
 * so E-Prescriptions display a scannable-style tamper-evident verification seal offline and in PDFs.
 */
export function generateVerificationQrMatrix(seedText: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (startR: number, startC: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[startR + r][startC + c] = isBorder || isCenter;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Deterministic PRNG seeded by prescription signature payload
  let h = 0x811c9dc5;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      const onTiming = r === 6 || c === 6;
      if (inTopLeft || inTopRight || inBottomLeft || onTiming) continue;

      h ^= (r * 31 + c * 17) ^ 0x9e3779b9;
      h = Math.imul(h, 0x85ebca6b);
      grid[r][c] = ((h >>> 15) & 1) === 1;
    }
  }

  return grid;
}

export function getSeedVitalsForPatient(patientId: string): PatientVitalRecord[] {
  const now = Date.now();
  const dayMs = 86400000;
  const fmt = (offsetDays: number) => {
    const dt = new Date(now + offsetDays * dayMs);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
      dt.getDate()
    ).padStart(2, '0')}`;
  };

  return [
    {
      id: `vit-${patientId}-5`,
      patientId,
      recordedAt: fmt(0),
      systolicBp: 122,
      diastolicBp: 78,
      heartRate: 76,
      spo2: 98,
      temperatureF: 98.8,
      bloodGlucoseMgDl: 104,
      notes: 'Morning check before breakfast; feeling better after hydration.',
    },
    {
      id: `vit-${patientId}-4`,
      patientId,
      recordedAt: fmt(-1),
      systolicBp: 126,
      diastolicBp: 82,
      heartRate: 82,
      spo2: 97,
      temperatureF: 99.4,
      bloodGlucoseMgDl: 112,
      notes: 'Mild evening fever; took Tab. Paracetamol 650 mg.',
    },
    {
      id: `vit-${patientId}-3`,
      patientId,
      recordedAt: fmt(-2),
      systolicBp: 128,
      diastolicBp: 84,
      heartRate: 86,
      spo2: 97,
      temperatureF: 99.8,
      bloodGlucoseMgDl: 116,
      notes: 'Mild sore throat and body ache.',
    },
    {
      id: `vit-${patientId}-2`,
      patientId,
      recordedAt: fmt(-3),
      systolicBp: 124,
      diastolicBp: 80,
      heartRate: 78,
      spo2: 98,
      temperatureF: 98.6,
      bloodGlucoseMgDl: 102,
      notes: 'Routine evening check.',
    },
    {
      id: `vit-${patientId}-1`,
      patientId,
      recordedAt: fmt(-4),
      systolicBp: 120,
      diastolicBp: 78,
      heartRate: 74,
      spo2: 99,
      temperatureF: 98.4,
      bloodGlucoseMgDl: 98,
      notes: 'Baseline wellness reading.',
    },
  ];
}

export function loadPatientVitals(patientId: string): PatientVitalRecord[] {
  const key = `medassist_vitals_v1_${patientId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as PatientVitalRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return getSeedVitalsForPatient(patientId);
}

export function savePatientVitals(patientId: string, records: PatientVitalRecord[]): void {
  const key = `medassist_vitals_v1_${patientId}`;
  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch {
    // ignore storage errors
  }
}

export interface LabReportBiomarker {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'Normal' | 'Borderline' | 'High' | 'Low';
  explanation: string;
}

export interface SampleLabReportResult {
  id: string;
  reportTitle: string;
  labName: string;
  reportDate: string;
  patientName: string;
  imageDataUrl: string;
  biomarkers: LabReportBiomarker[];
  summary: string;
  recommendedSpecialty: string;
}

export function buildSampleLabReport(patient: User): SampleLabReportResult {
  const today = new Date().toISOString().split('T')[0];
  const displayPatient = patient.name || 'Rohan Verma';

  let dataUrl = '';
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

      ctx.fillStyle = '#064734';
      ctx.fillRect(20, 20, canvas.width - 40, 100);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('APOLLO DIAGNOSTICS — CLINICAL LAB REPORT', 44, 62);
      ctx.font = '14px sans-serif';
      ctx.fillText(
        `Patient: ${displayPatient} (${patient.age || 34}Y/${patient.gender || 'M'})  |  Date: ${today}  |  NABL Accredited`,
        44,
        92
      );

      const rows = [
        ['Hemoglobin (Hb)', '12.1 g/dL', '13.5 - 17.5 g/dL', 'LOW'],
        ['WBC Count (Total Leukocyte)', '11,800 /µL', '4,000 - 11,000 /µL', 'HIGH'],
        ['Fasting Blood Glucose', '108 mg/dL', '70 - 99 mg/dL', 'BORDERLINE'],
        ['HbA1c (Glycated Hemoglobin)', '5.9 %', '< 5.7 %', 'BORDERLINE'],
        ['LDL Cholesterol', '142 mg/dL', '< 100 mg/dL', 'HIGH'],
        ['TSH (Thyroid Stimulating)', '2.4 mIU/L', '0.4 - 4.5 mIU/L', 'NORMAL'],
      ];

      ctx.fillStyle = '#E0FFC2';
      ctx.fillRect(40, 150, 680, 42);
      ctx.fillStyle = '#064734';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('TEST PARAMETER', 54, 176);
      ctx.fillText('RESULT', 320, 176);
      ctx.fillText('REF RANGE', 445, 176);
      ctx.fillText('FLAG', 625, 176);

      rows.forEach((row, idx) => {
        const y = 225 + idx * 62;
        ctx.fillStyle = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        ctx.fillRect(40, y - 28, 680, 52);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(row[0], 54, y);
        ctx.font = '15px monospace';
        ctx.fillText(row[1], 320, y);
        ctx.fillStyle = '#475569';
        ctx.font = '14px sans-serif';
        ctx.fillText(row[2], 445, y);
        ctx.fillStyle =
          row[3] === 'HIGH' || row[3] === 'LOW'
            ? '#B91C1C'
            : row[3] === 'BORDERLINE'
            ? '#B45309'
            : '#047857';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(row[3], 625, y);
      });

      ctx.fillStyle = '#334155';
      ctx.font = '14px sans-serif';
      ctx.fillText('Electronically verified by Dr. S. Kulkarni, MD (Pathology)', 44, 660);
      dataUrl = canvas.toDataURL('image/png');
    }
  }

  return {
    id: `lab-${Date.now()}`,
    reportTitle: 'Comprehensive Fever, Metabolic & Lipid Panel',
    labName: 'Apollo Diagnostics (NABL Accredited)',
    reportDate: today,
    patientName: displayPatient,
    imageDataUrl: dataUrl,
    biomarkers: [
      {
        parameter: 'Hemoglobin (Hb)',
        value: '12.1',
        unit: 'g/dL',
        referenceRange: '13.5 – 17.5 g/dL',
        status: 'Low',
        explanation:
          'Slightly below the typical adult male range, which may suggest mild nutritional or post-illness anemia.',
      },
      {
        parameter: 'WBC Count (Total Leukocyte)',
        value: '11,800',
        unit: '/µL',
        referenceRange: '4,000 – 11,000 /µL',
        status: 'High',
        explanation:
          'Mildly elevated white blood cells commonly reflect an active immune response to an infection or inflammation.',
      },
      {
        parameter: 'Fasting Blood Glucose',
        value: '108',
        unit: 'mg/dL',
        referenceRange: '70 – 99 mg/dL',
        status: 'Borderline',
        explanation:
          'Falls in the impaired fasting glucose (prediabetic) range; dietary moderation and repeat check are advised.',
      },
      {
        parameter: 'HbA1c (3-Month Avg Sugar)',
        value: '5.9',
        unit: '%',
        referenceRange: '< 5.7 %',
        status: 'Borderline',
        explanation:
          'Indicates mildly elevated average blood sugar over the past 3 months (prediabetes range: 5.7%–6.4%).',
      },
      {
        parameter: 'LDL Cholesterol ("Bad" Cholesterol)',
        value: '142',
        unit: 'mg/dL',
        referenceRange: '< 100 mg/dL',
        status: 'High',
        explanation:
          'Elevated LDL increases long-term cardiovascular risk; discuss low-saturated-fat diet & lipid targets with a physician.',
      },
      {
        parameter: 'TSH (Thyroid Function)',
        value: '2.4',
        unit: 'mIU/L',
        referenceRange: '0.4 – 4.5 mIU/L',
        status: 'Normal',
        explanation: 'Thyroid stimulating hormone is squarely within healthy normal limits.',
      },
    ],
    summary:
      'Mild leukocytosis (WBC 11,800/µL) aligns with recent viral/bacterial fever recovery, alongside borderline HbA1c (5.9%) and elevated LDL cholesterol (142 mg/dL) that merit lifestyle review with Internal Medicine or Cardiology.',
    recommendedSpecialty: 'General & Internal Medicine',
  };
}
