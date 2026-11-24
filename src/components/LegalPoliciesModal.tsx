import React, { useEffect } from 'react';
import { X, ShieldCheck, FileText, AlertTriangle, Lock } from 'lucide-react';

export type LegalPolicyTab = 'privacy' | 'terms';

interface LegalPoliciesModalProps {
  activeTab: LegalPolicyTab | null;
  onChangeTab: (tab: LegalPolicyTab) => void;
  onClose: () => void;
}

export const LegalPoliciesModal: React.FC<LegalPoliciesModalProps> = ({
  activeTab,
  onChangeTab,
  onClose,
}) => {
  useEffect(() => {
    if (!activeTab) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, onClose]);

  if (!activeTab) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#04281d]/75 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl my-auto bg-white border-2 border-[#B9E68E] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-[#0B2B22]">
        {/* Header */}
        <div className="bg-[#064734] text-white px-6 py-5 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#E0FFC2] text-xs font-semibold tracking-wide uppercase">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>MedAssist AI · Legal &amp; Compliance</span>
            </div>
            <h2 id="legal-modal-title" className="text-lg sm:text-xl font-extrabold tracking-tight">
              {activeTab === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
            </h2>
            <p className="text-xs text-[#E0FFC2]/85">
              Effective Date: January 2025 · Applies to patients, doctors, and visitors
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legal policy dialog"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-0 bg-[#F3FFE7] border-b border-[#B9E68E] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChangeTab('privacy')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-white text-[#064734] border-[#064734]'
                : 'text-[#284D41] border-transparent hover:text-[#064734]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('terms')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-white text-[#064734] border-[#064734]'
                : 'text-[#284D41] border-transparent hover:text-[#064734]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms &amp; Conditions</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 text-xs sm:text-sm leading-relaxed text-[#0B2B22]">
          {activeTab === 'privacy' ? (
            <>
              <div className="rounded-2xl bg-[#F3FFE7] border border-[#B9E68E] p-4 text-xs text-[#064734]">
                <strong>Your Privacy Matters:</strong> MedAssist AI is designed to protect your
                personal and health-related information. This Privacy Policy explains what data we
                collect, how it is used to deliver AI health guidance and telemedicine features, and
                the choices you have.
              </div>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">1. Information We Collect</h3>
                <ul className="list-disc pl-5 space-y-1 text-[#284D41]">
                  <li>
                    <strong>Account &amp; Profile Details:</strong> Name, email address, phone
                    number, age, gender, blood group, and—for doctors—medical qualification,
                    specialty, and registration number for verification.
                  </li>
                  <li>
                    <strong>Health &amp; Consultation Inputs:</strong> Symptoms entered into the AI
                    Health Chat or Symptom Checker, vitals you choose to log, uploaded prescription
                    images, appointment notes, and doctor-issued e-prescriptions.
                  </li>
                  <li>
                    <strong>Location Preferences:</strong> City or clinic location selections used
                    solely to display nearby hospitals and clinics on the interactive map.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">2. How We Use Your Information</h3>
                <p className="text-[#284D41]">
                  We use your information exclusively to operate platform features: generating
                  educational AI health summaries and prescription analyses, scheduling appointments
                  with verified doctors, enabling real-time video consultations, issuing e-prescriptions,
                  and sending in-app booking notifications. We do <strong>not</strong> sell your
                  personal or medical data to third-party advertisers.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">
                  3. Live Video Consultations, Camera &amp; Microphone
                </h3>
                <p className="text-[#284D41]">
                  Camera and microphone permissions are requested only when you actively join a live
                  video consultation. Live video and audio streams are transmitted over encrypted
                  WebRTC peer connections solely between the authorized patient and doctor in that
                  appointment room. Media streams are not recorded or stored by MedAssist AI.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">
                  4. Security &amp; Role-Based Access Control
                </h3>
                <p className="text-[#284D41]">
                  Account passwords are stored using salted cryptographic hashing (scrypt). Access to
                  appointments, health timelines, and e-prescriptions is restricted by strict
                  role-based access controls so that patients can only access their own records and
                  doctors can only access consultations assigned to them.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">
                  5. Third-Party Services &amp; Data Processing
                </h3>
                <p className="text-[#284D41]">
                  Certain features rely on trusted external services—such as AI inference APIs for
                  informational health chat and prescription image analysis, and mapping services for
                  locating nearby clinics and hospitals. Only the minimum data required to fulfill
                  your active request is transmitted to these providers.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">
                  6. Data Retention, Your Rights &amp; Contact
                </h3>
                <p className="text-[#284D41]">
                  You may review your health history inside your account at any time and request
                  correction or deletion of your account data through the platform administrator. We
                  may update this Privacy Policy periodically; continued use of the platform after
                  updates constitutes acceptance of the revised policy.
                </p>
              </section>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Medical &amp; Emergency Disclaimer:</strong> AI responses, symptom
                  assessments, and prescription scans are strictly for educational and informational
                  purposes and do <strong>not</strong> constitute a medical diagnosis or treatment
                  plan. If you experience a medical emergency (such as chest pain, severe breathing
                  difficulty, or loss of consciousness), call local emergency services (108 / 112 /
                  911) or visit the nearest hospital immediately.
                </div>
              </div>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">1. Acceptance of Terms</h3>
                <p className="text-[#284D41]">
                  By accessing or using MedAssist AI, creating an account, booking an appointment, or
                  using any AI health or telemedicine feature, you agree to be bound by these Terms
                  &amp; Conditions and our Privacy Policy. If you do not agree, please discontinue
                  use of the platform.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">
                  2. Scope of AI &amp; Telemedicine Services
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-[#284D41]">
                  <li>
                    <strong>AI Health Tools:</strong> The AI Health Chat, Symptom Checker, and
                    Prescription Analyzer provide general informational guidance only. Always confirm
                    medication names, dosages, and treatment choices with a licensed physician or
                    pharmacist.
                  </li>
                  <li>
                    <strong>Doctor Consultations &amp; E-Prescriptions:</strong> Verified doctors on
                    the platform are independently responsible for their clinical advice, diagnoses,
                    and e-prescriptions. Platform verification confirms submitted credentials at
                    onboarding and does not replace independent professional medical judgment.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">
                  3. User Responsibilities &amp; Acceptable Use
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-[#284D41]">
                  <li>
                    Provide accurate, truthful account and health information when consulting a
                    healthcare professional.
                  </li>
                  <li>
                    Keep your login credentials confidential and notify the administrator if you
                    suspect unauthorized access.
                  </li>
                  <li>
                    Do not misuse the platform, attempt to access another user&apos;s medical
                    records, upload unlawful content, or disrupt video consultation services.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">
                  4. Intellectual Property &amp; Visual Assets
                </h3>
                <p className="text-[#284D41]">
                  All platform software, interface designs, text, icons, and custom AI-generated
                  illustrations displayed on MedAssist AI are proprietary to or licensed for use by
                  the platform. You may not copy, resell, or redistribute platform materials without
                  prior permission. You retain ownership of any personal health records or
                  prescription images you upload.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">
                  5. Service Availability &amp; Limitation of Liability
                </h3>
                <p className="text-[#284D41]">
                  MedAssist AI is provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo;
                  basis. While we strive for reliable video consultations and accurate informational
                  tools, we cannot guarantee uninterrupted connectivity or error-free AI outputs. To
                  the maximum extent permitted by applicable law, MedAssist AI and its operators are
                  not liable for indirect, incidental, or consequential damages arising from your
                  reliance on informational AI outputs or temporary network interruptions.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#064734]">6. Updates to These Terms</h3>
                <p className="text-[#284D41]">
                  We may revise these Terms &amp; Conditions from time to time to reflect legal,
                  clinical, or platform updates. Updated terms take effect upon posting within the
                  application.
                </p>
              </section>
            </>
          )}
        </div>

        {/* Footer Action */}
        <div className="px-6 py-4 bg-[#F3FFE7] border-t border-[#B9E68E] flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] font-medium text-[#284D41]">
            Questions or data requests? Contact your platform administrator.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="btn-forest-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
