import { jsPDF } from 'jspdf';
import {
  EPrescription,
  PatientVitalRecord,
  SymptomCheckRecord,
  User,
} from '../types/healthcare';
import {
  computeRxVerificationCode,
  generateVerificationQrMatrix,
} from './clinicalSafety';

/**
 * Generates and downloads a formal clinical PDF document for a Doctor's E-Prescription
 * including a tamper-evident verification QR matrix and verification hash.
 */
export function downloadEPrescriptionPDF(rx: EPrescription): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const safeId = String(rx.id || 'ERX-101').toUpperCase();
  const safeDoctorName = String(rx.doctorName || 'Dr. Aarav Mehta');
  const safeQual = String(rx.doctorQualification || 'MBBS, MD');
  const safeSpec = String(rx.doctorSpecialty || 'General Medicine');
  const safeReg = String(rx.doctorRegistration || 'TSMC-48291');
  const safePatientName = String(rx.patientName || 'Patient');
  const safePatientAge = rx.patientAge ? `${rx.patientAge} Years` : 'Adult';
  const safeDate = String(rx.date || new Date().toISOString().split('T')[0]);
  const safeAptId = String(rx.appointmentId || 'DIRECT-CONSULT');
  const safeDiagnosis = String(rx.diagnosisSummary || 'General Clinical Consultation');
  const safeSymptoms = String(
    rx.symptomsObserved || 'Reported clinical symptoms reviewed during telemedicine consult.'
  );
  const safeAdvice = String(
    rx.advice || 'Follow prescribed dosage schedule, take adequate rest, and maintain hydration.'
  );

  const verificationCode = computeRxVerificationCode(rx);
  const qrMatrix = generateVerificationQrMatrix(`${verificationCode}|${safeId}|${safeReg}`);

  // Top Header Band — Forest Green (#064734)
  doc.setFillColor(6, 71, 52);
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AI VIRTUAL HEALTHCARE ASSISTANT', 15, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(224, 255, 194);
  doc.text('Verified Telemedicine Digital E-Prescription', 15, 22);
  doc.setTextColor(255, 255, 255);
  doc.text(`Prescription ID: ${safeId}  |  Verify: ${verificationCode}`, 15, 29);

  // Doctor Details (Right column in header)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  const docNameLines = doc.splitTextToSize(safeDoctorName, 70);
  doc.text(docNameLines[0], 125, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const docCredLines = doc.splitTextToSize(`${safeQual} (${safeSpec})`, 70);
  doc.text(docCredLines[0], 125, 21);
  doc.text(`Reg. No: ${safeReg}`, 125, 27);

  // Patient Details Box
  doc.setTextColor(11, 43, 34);
  doc.setDrawColor(184, 233, 148);
  doc.setFillColor(244, 255, 233);
  doc.rect(15, 44, 180, 24, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Patient Name:', 20, 52);
  doc.text('Patient Age:', 20, 61);
  doc.text('Date Issued:', 118, 52);
  doc.text('Consultation Ref:', 118, 61);

  doc.setFont('helvetica', 'normal');
  doc.text(safePatientName.slice(0, 32), 48, 52);
  doc.text(safePatientAge, 48, 61);
  doc.text(safeDate, 152, 52);
  doc.text(safeAptId.slice(0, 20), 152, 61);

  // Clinical Assessment Section
  let y = 78;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 71, 52);
  doc.text('Symptoms & Clinical Observations', 15, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const symLines = doc.splitTextToSize(safeSymptoms, 180);
  doc.text(symLines, 15, y);
  y += symLines.length * 5 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 71, 52);
  doc.text('Clinical Impression / Provisional Diagnosis', 15, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const diagLines = doc.splitTextToSize(safeDiagnosis, 180);
  doc.text(diagLines, 15, y);
  y += diagLines.length * 5 + 8;

  // Rx Heading
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(18);
  doc.setTextColor(6, 71, 52);
  doc.text('Rx — Prescribed Medications', 15, y);
  y += 6;

  // Table Header
  doc.setFillColor(224, 255, 194);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(6, 71, 52);
  doc.text('#', 18, y + 5.5);
  doc.text('Medicine Name', 26, y + 5.5);
  doc.text('Dosage', 88, y + 5.5);
  doc.text('Frequency', 118, y + 5.5);
  doc.text('Duration', 165, y + 5.5);
  y += 13;

  const medList = Array.isArray(rx.medicines) ? rx.medicines : [];
  doc.setFont('helvetica', 'normal');
  medList.forEach((med, idx) => {
    if (y > 235) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(11, 43, 34);
    doc.text(`${idx + 1}.`, 18, y);
    doc.text(String(med.name || 'Medication').slice(0, 32), 26, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(String(med.dosage || '-').slice(0, 16), 88, y);
    doc.text(String(med.frequency || '-').slice(0, 24), 118, y);
    doc.text(String(med.duration || '-').slice(0, 14), 165, y);

    if (med.instructions) {
      y += 5;
      doc.setFontSize(8.5);
      doc.setTextColor(44, 82, 68);
      const instLines = doc.splitTextToSize(`Instructions: ${String(med.instructions)}`, 165);
      doc.text(instLines, 26, y);
      y += (instLines.length - 1) * 4;
      doc.setTextColor(11, 43, 34);
    }
    y += 8;
    doc.setDrawColor(184, 233, 148);
    doc.line(15, y - 3, 195, y - 3);
  });

  // Advice & Follow-up
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(6, 71, 52);
  doc.text('General Medical Advice & Care Instructions:', 15, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const adviceLines = doc.splitTextToSize(safeAdvice, 180);
  doc.text(adviceLines, 15, y);
  y += adviceLines.length * 5 + 6;

  if (rx.followUpDate) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 71, 52);
    doc.text(`Recommended Follow-Up Date: ${String(rx.followUpDate)}`, 15, y);
  }

  // Tamper-Evident QR Verification Seal (Bottom-Left) + Digital Signature (Bottom-Right)
  const footerY = 248;
  const qrOriginX = 15;
  const qrOriginY = footerY;
  const cellMm = 1.15;
  doc.setDrawColor(184, 233, 148);
  doc.setFillColor(255, 255, 255);
  doc.rect(qrOriginX - 1.5, qrOriginY - 1.5, 21 * cellMm + 3, 21 * cellMm + 3, 'FD');

  doc.setFillColor(6, 71, 52);
  qrMatrix.forEach((row, r) => {
    row.forEach((filled, c) => {
      if (filled) {
        doc.rect(qrOriginX + c * cellMm, qrOriginY + r * cellMm, cellMm, cellMm, 'F');
      }
    });
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 71, 52);
  doc.text('PHARMACY VERIFICATION QR', 43, footerY + 6);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.text(verificationCode, 43, footerY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Tamper-evident digital signature hash', 43, footerY + 16.5);
  doc.text(`Issued: ${safeDate} | Reg: ${safeReg}`, 43, footerY + 21);

  doc.setDrawColor(6, 71, 52);
  doc.line(130, footerY + 14, 195, footerY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 71, 52);
  doc.text(`Digitally Signed by ${safeDoctorName.slice(0, 26)}`, 130, footerY + 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(44, 82, 68);
  doc.text(`Reg. No: ${safeReg}`, 130, footerY + 24);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Your health data is private and used only to provide this service. In case of medical emergency, call 108 or 112 immediately.',
    15,
    285
  );

  const fileName = `EPrescription_${safePatientName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${safeDate}.pdf`;

  try {
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch {
    doc.save(fileName);
  }
}

/**
 * Exports a 1-page Pre-Consult Clinical Health Brief PDF combining patient allergies,
 * latest vitals, active medications, and recent symptom triage for doctor review.
 */
export function downloadPreConsultSummaryPDF(params: {
  patient: User;
  vitals: PatientVitalRecord[];
  eprescriptions: EPrescription[];
  symptomChecks: SymptomCheckRecord[];
}): void {
  const { patient, vitals, eprescriptions, symptomChecks } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const today = new Date().toISOString().split('T')[0];
  const patientName = patient.name || 'Patient';

  doc.setFillColor(6, 71, 52);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('PRE-CONSULTATION CLINICAL HEALTH BRIEF', 15, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(224, 255, 194);
  doc.text(`Generated: ${today}  |  AI Virtual Healthcare Assistant`, 15, 24);

  doc.setFillColor(244, 255, 233);
  doc.setDrawColor(184, 233, 148);
  doc.rect(15, 42, 180, 24, 'FD');
  doc.setTextColor(6, 71, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Patient: ${patientName}`, 20, 50);
  doc.text(`Age / Gender: ${patient.age || 34}Y / ${patient.gender || 'Male'}`, 20, 58);
  doc.text(`Blood Group: ${patient.bloodGroup || 'O+'}`, 125, 50);
  doc.text(
    `Allergies: ${(patient.allergies || ['None Known']).join(', ').slice(0, 36)}`,
    125,
    58
  );

  let y = 76;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 71, 52);
  doc.text('Latest Recorded Vitals', 15, y);
  y += 6;

  const latestVital = vitals[0];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  if (latestVital) {
    doc.text(
      `Date: ${latestVital.recordedAt}  |  BP: ${latestVital.systolicBp}/${latestVital.diastolicBp} mmHg  |  HR: ${latestVital.heartRate} bpm  |  SpO2: ${latestVital.spo2}%  |  Temp: ${latestVital.temperatureF}°F  |  Glucose: ${latestVital.bloodGlucoseMgDl} mg/dL`,
      15,
      y,
      { maxWidth: 180 }
    );
    y += 14;
  } else {
    doc.text('No vitals logged yet.', 15, y);
    y += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 71, 52);
  doc.text('Recent Symptom Triage Assessment', 15, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const latestSym = symptomChecks[0];
  if (latestSym) {
    const symLine = `Symptoms: ${latestSym.selectedSymptoms.join(', ')} (${latestSym.duration}, ${latestSym.severity}) — Urgency: ${latestSym.urgencyLevel}`;
    const wrapped = doc.splitTextToSize(symLine, 180);
    doc.text(wrapped, 15, y);
    y += wrapped.length * 5 + 6;
  } else {
    doc.text('No recent symptom triage entries recorded.', 15, y);
    y += 10;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 71, 52);
  doc.text('Active Prescribed Medications', 15, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const latestRx = eprescriptions[0];
  if (latestRx && latestRx.medicines.length > 0) {
    latestRx.medicines.forEach((m, i) => {
      doc.text(
        `${i + 1}. ${m.name} (${m.dosage}) — ${m.frequency} for ${m.duration}`,
        18,
        y
      );
      y += 6;
    });
  } else {
    doc.text('No active prescriptions on record.', 15, y);
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Disclaimer: Summary compiled from patient portal records for clinician review.',
    15,
    285
  );

  const fileName = `PreConsult_Brief_${patientName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${today}.pdf`;
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {
    doc.save(fileName);
  }
}

