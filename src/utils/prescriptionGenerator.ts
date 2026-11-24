import {
  DrugInteractionAlert,
  ExtractedMedicine,
  PrescriptionAnalysisResult,
  SupportedLanguage,
} from '../types/healthcare';

export type SamplePrescriptionPreset = 'standard' | 'interaction';

function formatReadableToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getIsoToday(): string {
  const dt = new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateSamplePrescriptionDataUrl(mode: SamplePrescriptionPreset): {
  dataUrl: string;
  fileName: string;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', fileName: 'sample-prescription.png' };
  }

  const displayDate = formatReadableToday();

  // Paper background with subtle clinical warmth
  ctx.fillStyle = mode === 'standard' ? '#FDFBF7' : '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle border
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Header bar
  ctx.fillStyle = '#064734';
  ctx.fillRect(20, 20, canvas.width - 40, 110);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('APOLLO CARE SPECIALTY CLINIC', 45, 62);

  ctx.font = '15px sans-serif';
  ctx.fillText('Dr. Aarav Mehta, MBBS, MD (Internal Medicine)  |  Reg No: TSMC-48291', 45, 90);
  ctx.fillText('142 Health Avenue, Jubilee Hills, Hyderabad - 500033  |  Ph: +91 40 2355 8900', 45, 114);

  // Patient metadata row
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Patient Name:', 45, 168);
  ctx.fillText('Date:', 520, 168);
  ctx.fillText('Age / Gender:', 45, 202);

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(45, 222);
  ctx.lineTo(canvas.width - 45, 222);
  ctx.stroke();

  if (mode === 'standard') {
    // Simulated doctor's cursive ink handwriting with one smudged item to show 68% Low verification badge
    ctx.save();
    ctx.fillStyle = '#1E3A8A';
    ctx.font = 'italic 21px Georgia, serif';
    ctx.fillText('Rohan Verma', 165, 168);
    ctx.fillText(displayDate, 575, 168);
    ctx.fillText('34Y / Male', 165, 202);

    ctx.font = 'bold italic 36px Georgia, serif';
    ctx.fillText('Rx', 45, 275);

    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText('1) Tab. Paracetamol 650 mg', 65, 335);
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText('    1-0-1 After Food  --  3 Days (Fever / Body Ache)', 65, 366);

    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText('2) Tab. Cetirizine 10 mg', 65, 430);
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText('    0-0-1 Night After Dinner  --  5 Days', 65, 461);

    // Intentionally smudged/messy 3rd item to showcase 68% Low - Verify with Pharmacist
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.font = 'italic 21px Georgia, serif';
    ctx.fillText('3) Syp. Ambroxol-LS (?)  5 ml', 65, 525);
    ctx.font = 'italic 17px Georgia, serif';
    ctx.fillText('    1-0-1  (smudged ink)  --  5 Days', 65, 555);
    ctx.restore();

    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillText('Advice: Warm saline gargles twice daily. Hydration >= 2.5L/day.', 55, 645);
    ctx.fillText('Follow up if fever persists beyond 72 hours.', 55, 680);

    // Doctor signature scribble
    ctx.beginPath();
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 2;
    ctx.moveTo(480, 820);
    ctx.bezierCurveTo(510, 790, 540, 835, 580, 805);
    ctx.bezierCurveTo(600, 795, 620, 820, 650, 810);
    ctx.stroke();
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillText('Dr. Aarav Mehta', 495, 850);
    ctx.restore();

    return {
      dataUrl: canvas.toDataURL('image/png'),
      fileName: 'sample_handwritten_standard_rx.png',
    };
  }

  // Mode: 'interaction' — Demonstrates multi-drug interaction detection
  ctx.font = '16px monospace';
  ctx.fillStyle = '#0F172A';
  ctx.fillText('Rohan Verma', 165, 168);
  ctx.fillText(displayDate, 575, 168);
  ctx.fillText('34 Yrs / Male', 165, 202);

  ctx.font = 'bold 34px serif';
  ctx.fillStyle = '#064734';
  ctx.fillText('Rx', 45, 275);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 17px monospace';
  ctx.fillText('1. Tab. Warfarin 5 mg', 65, 330);
  ctx.font = '15px monospace';
  ctx.fillText('   Dosage: 5 mg (1 Tablet)  |  Timing: 0-0-1 Nightly  |  30 Days', 65, 358);

  ctx.font = 'bold 17px monospace';
  ctx.fillText('2. Tab. Aspirin 325 mg', 65, 415);
  ctx.font = '15px monospace';
  ctx.fillText('   Dosage: 325 mg (1 Tablet) |  Timing: 1-0-0 After Breakfast | 14 Days', 65, 443);

  ctx.font = 'bold 17px monospace';
  ctx.fillText('3. Tab. Ibuprofen 400 mg', 65, 500);
  ctx.font = '15px monospace';
  ctx.fillText('   Dosage: 400 mg (1 Tablet) |  Timing: 1-0-1 After Food | 5 Days', 65, 528);

  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Clinical Notes & Advice:', 45, 610);
  ctx.font = '15px monospace';
  ctx.fillText('- Concurrent antithrombotic + NSAID therapy requires bleeding-risk check.', 65, 642);
  ctx.fillText('- Monitor INR closely; report any unusual bruising or gastric pain.', 65, 670);

  ctx.font = 'italic 18px serif';
  ctx.fillText('Signed: Dr. Aarav Mehta, MD', 460, 840);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    fileName: 'sample_drug_interaction_rx.png',
  };
}

export function detectDrugInteractions(medicines: ExtractedMedicine[]): DrugInteractionAlert | null {
  const names = medicines.map((m) => m.name.toLowerCase());
  const hasWarfarin = names.some((n) => n.includes('warfarin'));
  const hasAspirin = names.some((n) => n.includes('aspirin'));
  const hasIbuprofen = names.some((n) => n.includes('ibuprofen') || n.includes('diclofenac') || n.includes('naproxen'));
  const hasClarithromycin = names.some((n) => n.includes('clarithromycin') || n.includes('erythromycin'));
  const hasAtorvastatin = names.some((n) => n.includes('atorvastatin') || n.includes('simvastatin'));

  if (hasWarfarin && (hasAspirin || hasIbuprofen)) {
    const interacting = medicines
      .filter((m) => {
        const low = m.name.toLowerCase();
        return low.includes('warfarin') || low.includes('aspirin') || low.includes('ibuprofen');
      })
      .map((m) => m.name);
    return {
      detected: true,
      severity: 'High',
      title: 'Potential Major Drug-Drug Interaction Detected',
      interactingMedicines: interacting,
      explanation:
        'Combining Warfarin (anticoagulant) with Aspirin and/or Ibuprofen (NSAIDs) significantly increases the risk of gastrointestinal and systemic bleeding due to synergistic antiplatelet and mucosal irritation effects.',
      recommendation:
        'Do not start or adjust these medicines together without immediate verification from your prescribing physician or clinical pharmacist. Ask whether a gastroprotective agent or safer analgesic alternative (e.g., Paracetamol under medical supervision) is indicated.',
    };
  }

  if (hasClarithromycin && hasAtorvastatin) {
    return {
      detected: true,
      severity: 'High',
      title: 'Potential CYP3A4 Statin-Macrolide Interaction Detected',
      interactingMedicines: ['Clarithromycin', 'Atorvastatin'],
      explanation:
        'Clarithromycin inhibits CYP3A4 metabolism, which can elevate Atorvastatin blood levels and increase the risk of muscle toxicity (myopathy/rhabdomyolysis).',
      recommendation:
        'Verify with your prescribing doctor or pharmacist before co-administering these medications.',
    };
  }

  return null;
}

export function buildSamplePrescriptionAnalysis(
  mode: SamplePrescriptionPreset,
  patientId: string,
  language: SupportedLanguage,
  imageDataUrl: string,
  fileName: string
): PrescriptionAnalysisResult {
  const isoDate = getIsoToday();

  if (mode === 'standard') {
    const medicines: ExtractedMedicine[] = [
      {
        name: 'Tab. Paracetamol',
        dosage: '650 mg',
        frequency: 'Twice daily',
        timing: '1-0-1 After Food',
        duration: '3 Days',
        generalPurpose: 'Fever reduction and mild-to-moderate pain relief',
        notes: 'Take with water after breakfast and dinner',
        confidence: 'High',
        confidenceScore: 96,
      },
      {
        name: 'Tab. Cetirizine',
        dosage: '10 mg',
        frequency: 'Once nightly',
        timing: '0-0-1 Night After Food',
        duration: '5 Days',
        generalPurpose: 'Relieves sneezing, runny nose, and allergic irritation',
        notes: 'May cause mild drowsiness; take at bedtime',
        confidence: 'High',
        confidenceScore: 94,
      },
      {
        name: 'Syp. Ambroxol-LS (Unclear Strength)',
        dosage: '5 ml',
        frequency: 'Twice daily',
        timing: '1-0-1 After Food',
        duration: '5 Days',
        generalPurpose: 'Mucolytic syrup used to thin chest mucus and ease wet cough',
        notes: 'Handwritten suffix partially smudged — verify exact formulation with pharmacist',
        confidence: 'Low',
        confidenceScore: 68,
      },
    ];

    return {
      id: `rx-sample-std-${Date.now()}`,
      patientId,
      createdAt: new Date().toISOString(),
      imageDataUrl,
      fileName,
      language,
      doctorName: { value: 'Dr. Aarav Mehta (MD)', confidence: 'High' },
      date: { value: isoDate, confidence: 'High' },
      patientName: { value: 'Rohan Verma', confidence: 'High' },
      medicines,
      generalNotes: {
        value: 'Warm saline gargles twice daily; maintain >= 2.5 L hydration per day. Follow up if fever persists > 72 hrs.',
        confidence: 'High',
      },
      suggestedSymptoms: 'Fever, allergic throat irritation, and productive cough',
      drugInteractionAlert: null,
    };
  }

  const interactionMedicines: ExtractedMedicine[] = [
    {
      name: 'Tab. Warfarin',
      dosage: '5 mg',
      frequency: 'Once nightly',
      timing: '0-0-1 After Dinner',
      duration: '30 Days',
      generalPurpose: 'Oral anticoagulant (blood thinner) to prevent blood clots',
      notes: 'Requires regular PT/INR monitoring',
      confidence: 'High',
      confidenceScore: 97,
    },
    {
      name: 'Tab. Aspirin',
      dosage: '325 mg',
      frequency: 'Once morning',
      timing: '1-0-0 After Breakfast',
      duration: '14 Days',
      generalPurpose: 'Antiplatelet / analgesic medicine to reduce clot aggregation & pain',
      notes: 'Bleeding precaution when combined with anticoagulants',
      confidence: 'High',
      confidenceScore: 95,
    },
    {
      name: 'Tab. Ibuprofen',
      dosage: '400 mg',
      frequency: 'Twice daily',
      timing: '1-0-1 After Food',
      duration: '5 Days',
      generalPurpose: 'NSAID pain reliever and anti-inflammatory agent',
      notes: 'Caution: increases GI bleeding risk alongside Warfarin & Aspirin',
      confidence: 'Medium',
      confidenceScore: 84,
    },
  ];

  return {
    id: `rx-sample-int-${Date.now()}`,
    patientId,
    createdAt: new Date().toISOString(),
    imageDataUrl,
    fileName,
    language,
    doctorName: { value: 'Dr. Aarav Mehta (MD)', confidence: 'High' },
    date: { value: isoDate, confidence: 'High' },
    patientName: { value: 'Rohan Verma', confidence: 'High' },
    medicines: interactionMedicines,
    generalNotes: {
      value: 'Monitor INR closely; report any unusual bruising, black stools, or gastric discomfort immediately.',
      confidence: 'High',
    },
    suggestedSymptoms: 'Anticoagulation follow-up & pain management review (Drug interaction check)',
    drugInteractionAlert: detectDrugInteractions(interactionMedicines),
  };
}
