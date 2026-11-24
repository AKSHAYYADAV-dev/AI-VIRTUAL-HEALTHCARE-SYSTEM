import React from 'react';

interface IllustrationProps {
  className?: string;
}

/**
 * 1. Dashboard Hero 2D Illustration: Digital Telemedicine Console, Stethoscope, ECG & Rx Pad (No Human Pics)
 */
export const HeroClinicIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 480 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="2D illustration of digital healthcare console, stethoscope, ECG pulse, and medical prescription"
    className={`w-full h-full ${className}`}
  >
    <rect width="480" height="300" fill="#064734" />
    {/* Subtle geometric background grid & leaves */}
    <circle cx="400" cy="56" r="96" fill="#085E45" />
    <circle cx="76" cy="250" r="80" fill="#043224" />
    <path
      d="M40 44C40 44 88 38 106 76C124 114 78 134 78 134C78 134 38 104 40 44Z"
      fill="#137A5B"
      opacity="0.45"
    />
    <path
      d="M438 220C438 220 392 212 372 248C352 284 398 294 398 294C398 294 438 266 438 220Z"
      fill="#3FA57A"
      opacity="0.3"
    />

    {/* Main 2D Digital Clinic Tablet */}
    <rect x="92" y="42" width="248" height="196" rx="20" fill="#FFFFFF" stroke="#B9E68E" strokeWidth="4" />
    <rect x="108" y="58" width="216" height="34" rx="10" fill="#E0FFC2" />
    <circle cx="128" cy="75" r="8" fill="#064734" />
    <path d="M128 70V80M123 75H133" stroke="#E0FFC2" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="146" y="69" width="96" height="12" rx="6" fill="#064734" />
    <rect x="274" y="68" width="38" height="14" rx="7" fill="#3FA57A" />

    {/* ECG Vital Waveform Card inside screen */}
    <rect x="108" y="102" width="134" height="72" rx="12" fill="#F3FFE7" stroke="#B9E68E" strokeWidth="2" />
    <path
      d="M118 142H138L147 120L158 160L169 114L180 152L189 138H230"
      stroke="#064734"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="120" y="112" width="52" height="7" rx="3.5" fill="#3FA57A" />

    {/* Rx Mini Panel inside screen */}
    <rect x="252" y="102" width="72" height="72" rx="12" fill="#064734" />
    <text x="272" y="136" fill="#E0FFC2" fontSize="22" fontWeight="800" fontFamily="sans-serif">
      Rx
    </text>
    <rect x="266" y="148" width="44" height="6" rx="3" fill="#B9E68E" />
    <rect x="266" y="159" width="32" height="5" rx="2.5" fill="#3FA57A" />

    {/* Bottom Status Bars */}
    <rect x="108" y="184" width="216" height="38" rx="10" fill="#F3FFE7" stroke="#B9E68E" strokeWidth="2" />
    <circle cx="128" cy="203" r="9" fill="#3FA57A" />
    <path d="M124 203L127 206L133 200" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="146" y="196" width="108" height="6" rx="3" fill="#064734" />
    <rect x="146" y="207" width="72" height="5" rx="2.5" fill="#284D41" opacity="0.65" />

    {/* Floating 2D Stethoscope & Shield on Right */}
    <rect x="312" y="122" width="112" height="130" rx="18" fill="#E0FFC2" stroke="#FFFFFF" strokeWidth="3.5" />
    {/* Stethoscope U-tube */}
    <path
      d="M348 148V176C348 188 357 196 368 196C379 196 388 188 388 176V148"
      stroke="#064734"
      strokeWidth="5"
      strokeLinecap="round"
    />
    <circle cx="348" cy="146" r="5" fill="#064734" />
    <circle cx="388" cy="146" r="5" fill="#064734" />
    <path d="M368 196V214C368 223 375 228 383 228C391 228 396 222 396 214V204" stroke="#064734" strokeWidth="4.5" strokeLinecap="round" />
    <circle cx="396" cy="198" r="10" fill="#FFFFFF" stroke="#064734" strokeWidth="4" />
    <circle cx="396" cy="198" r="3.5" fill="#3FA57A" />

    {/* Floating 2D Capsule Pill on Left */}
    <g transform="translate(52 132) rotate(-22)">
      <rect x="0" y="0" width="64" height="28" rx="14" fill="#FFFFFF" stroke="#B9E68E" strokeWidth="3" />
      <path d="M32 0H50C57.732 0 64 6.26801 64 14C64 21.732 57.732 28 50 28H32V0Z" fill="#3FA57A" />
      <rect x="10" y="8" width="14" height="4" rx="2" fill="#E0FFC2" />
    </g>

    {/* Top Medical Cross Badge */}
    <circle cx="368" cy="70" r="24" fill="#FFFFFF" stroke="#B9E68E" strokeWidth="3" />
    <path d="M368 58V82M356 70H380" stroke="#064734" strokeWidth="5.5" strokeLinecap="round" />
  </svg>
);

/**
 * 2. Dashboard Service Card 1: AI Health Chat 2D Illustration
 */
export const ChatServiceIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 320 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="2D illustration of AI health chat bubbles and waveform"
    className={`w-full h-full ${className}`}
  >
    <rect width="320" height="200" fill="#F3FFE7" />
    <circle cx="272" cy="40" r="56" fill="#E0FFC2" />
    <circle cx="48" cy="168" r="46" fill="#E0FFC2" />

    {/* Bot Bubble Left */}
    <rect x="34" y="34" width="182" height="72" rx="16" fill="#FFFFFF" stroke="#064734" strokeWidth="2.5" />
    <circle cx="58" cy="60" r="12" fill="#064734" />
    <path d="M58 54V66M52 60H64" stroke="#E0FFC2" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="80" y="51" width="114" height="8" rx="4" fill="#064734" />
    <rect x="80" y="66" width="88" height="7" rx="3.5" fill="#3FA57A" />
    <rect x="80" y="80" width="66" height="6" rx="3" fill="#B9E68E" />

    {/* User Reply Bubble Right */}
    <rect x="114" y="118" width="172" height="52" rx="16" fill="#064734" />
    <rect x="134" y="135" width="112" height="7" rx="3.5" fill="#E0FFC2" />
    <rect x="134" y="149" width="78" height="6" rx="3" fill="#3FA57A" />
    <circle cx="264" cy="144" r="10" fill="#3FA57A" />
    <path d="M260 144L263 147L269 141" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

    {/* Floating Multilingual Pill Badge */}
    <rect x="34" y="130" width="66" height="28" rx="10" fill="#E0FFC2" stroke="#B9E68E" strokeWidth="2" />
    <text x="45" y="148" fill="#064734" fontSize="10.5" fontWeight="800" fontFamily="sans-serif">
      EN · తె · हिं
    </text>
  </svg>
);

/**
 * 3. Dashboard Service Card 2: Prescription OCR Scanner 2D Illustration
 */
export const PrescriptionScanIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 320 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="2D illustration of prescription scanner and pill analysis"
    className={`w-full h-full ${className}`}
  >
    <rect width="320" height="200" fill="#F3FFE7" />
    <circle cx="62" cy="46" r="52" fill="#E0FFC2" />
    <circle cx="268" cy="162" r="50" fill="#E0FFC2" />

    {/* Rx Document Sheet */}
    <rect x="78" y="24" width="136" height="154" rx="14" fill="#FFFFFF" stroke="#064734" strokeWidth="2.5" />
    <rect x="94" y="38" width="104" height="22" rx="6" fill="#E0FFC2" />
    <text x="104" y="54" fill="#064734" fontSize="14" fontWeight="800" fontFamily="sans-serif">
      Rx SCAN
    </text>
    <rect x="94" y="72" width="96" height="7" rx="3.5" fill="#064734" />
    <rect x="94" y="86" width="76" height="6" rx="3" fill="#284D41" opacity="0.55" />
    <rect x="94" y="114" width="92" height="7" rx="3.5" fill="#064734" />
    <rect x="94" y="128" width="64" height="6" rx="3" fill="#284D41" opacity="0.55" />
    <rect x="94" y="148" width="84" height="14" rx="7" fill="#E0FFC2" />

    {/* Horizontal Scanner Laser Line */}
    <rect x="66" y="100" width="160" height="4" rx="2" fill="#3FA57A" />

    {/* Magnifying Lens */}
    <circle cx="218" cy="112" r="34" fill="#FFFFFF" fillOpacity="0.92" stroke="#064734" strokeWidth="4" />
    <path d="M242 136L266 160" stroke="#064734" strokeWidth="7" strokeLinecap="round" />
    {/* Pill inside lens */}
    <g transform="translate(200 103) rotate(-25)">
      <rect x="0" y="0" width="34" height="15" rx="7.5" fill="#E0FFC2" stroke="#064734" strokeWidth="2" />
      <path d="M17 0H26.5C30.642 0 34 3.35786 34 7.5C34 11.6421 30.642 15 26.5 15H17V0Z" fill="#3FA57A" />
    </g>
  </svg>
);

/**
 * 4. Dashboard Service Card 3: Appointment Calendar 2D Illustration
 */
export const AppointmentServiceIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 320 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="2D illustration of appointment calendar and clock slot"
    className={`w-full h-full ${className}`}
  >
    <rect width="320" height="200" fill="#F3FFE7" />
    <circle cx="264" cy="48" r="54" fill="#E0FFC2" />

    {/* Calendar Board */}
    <rect x="58" y="34" width="164" height="138" rx="16" fill="#FFFFFF" stroke="#064734" strokeWidth="2.5" />
    <path d="M58 50C58 41.1634 65.1634 34 74 34H206C214.837 34 222 41.1634 222 50V68H58V50Z" fill="#064734" />
    <rect x="92" y="24" width="10" height="20" rx="5" fill="#3FA57A" />
    <rect x="178" y="24" width="10" height="20" rx="5" fill="#3FA57A" />

    {/* Date Grid Squares */}
    <rect x="76" y="82" width="26" height="22" rx="6" fill="#E0FFC2" />
    <rect x="110" y="82" width="26" height="22" rx="6" fill="#E0FFC2" />
    <rect x="144" y="82" width="26" height="22" rx="6" fill="#064734" />
    <path d="M151 93L155 97L163 89" stroke="#E0FFC2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="178" y="82" width="26" height="22" rx="6" fill="#E0FFC2" />

    <rect x="76" y="114" width="26" height="22" rx="6" fill="#F3FFE7" stroke="#B9E68E" strokeWidth="1.5" />
    <rect x="110" y="114" width="26" height="22" rx="6" fill="#3FA57A" />
    <rect x="144" y="114" width="26" height="22" rx="6" fill="#F3FFE7" stroke="#B9E68E" strokeWidth="1.5" />
    <rect x="178" y="114" width="26" height="22" rx="6" fill="#F3FFE7" stroke="#B9E68E" strokeWidth="1.5" />

    {/* Clock Badge on Right */}
    <circle cx="234" cy="130" r="36" fill="#FFFFFF" stroke="#064734" strokeWidth="3.5" />
    <circle cx="234" cy="130" r="26" fill="#E0FFC2" />
    <path d="M234 114V130L246 138" stroke="#064734" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 5. Dashboard Service Card 4: Digital E-Prescription PDF 2D Illustration
 */
export const EPrescriptionServiceIllustration: React.FC<IllustrationProps> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 320 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="2D illustration of digital e-prescription document and PDF badge"
    className={`w-full h-full ${className}`}
  >
    <rect width="320" height="200" fill="#F3FFE7" />
    <circle cx="64" cy="156" r="52" fill="#E0FFC2" />
    <circle cx="258" cy="46" r="46" fill="#E0FFC2" />

    {/* E-Rx Document Pad */}
    <rect x="80" y="24" width="150" height="156" rx="16" fill="#FFFFFF" stroke="#064734" strokeWidth="2.5" />
    <path d="M80 40C80 31.1634 87.1634 24 96 24H214C222.837 24 230 31.1634 230 40V58H80V40Z" fill="#064734" />
    <text x="98" y="47" fill="#E0FFC2" fontSize="14" fontWeight="800" fontFamily="sans-serif">
      E-PRESCRIPTION
    </text>

    {/* Medicine Lines */}
    <circle cx="102" cy="82" r="7" fill="#3FA57A" />
    <rect x="118" y="77" width="88" height="8" rx="4" fill="#064734" />
    <circle cx="102" cy="108" r="7" fill="#3FA57A" />
    <rect x="118" y="103" width="76" height="8" rx="4" fill="#064734" />
    <circle cx="102" cy="134" r="7" fill="#3FA57A" />
    <rect x="118" y="129" width="66" height="8" rx="4" fill="#284D41" opacity="0.7" />

    {/* Signed Seal */}
    <rect x="96" y="152" width="72" height="14" rx="7" fill="#E0FFC2" />
    <circle cx="242" cy="142" r="28" fill="#064734" stroke="#FFFFFF" strokeWidth="3" />
    <path d="M242 130V148M234 142L242 150L250 142" stroke="#E0FFC2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 6. How-It-Works 2D Illustrations (3-Step Flow)
 */
export const HowItWorksStepIllustration: React.FC<{ step: string; className?: string }> = ({
  step,
  className = '',
}) => {
  if (step === '01') {
    return <ChatServiceIllustration className={className} />;
  }
  if (step === '02') {
    return <AppointmentServiceIllustration className={className} />;
  }
  return (
    <svg
      viewBox="0 0 320 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="2D illustration of live telemedicine video stream and digital Rx"
      className={`w-full h-full ${className}`}
    >
      <rect width="320" height="200" fill="#F3FFE7" />
      <circle cx="268" cy="48" r="52" fill="#E0FFC2" />
      <circle cx="52" cy="160" r="46" fill="#E0FFC2" />

      {/* Telemedicine Monitor */}
      <rect x="44" y="32" width="184" height="126" rx="16" fill="#064734" stroke="#FFFFFF" strokeWidth="3" />
      <rect x="58" y="46" width="156" height="82" rx="10" fill="#043224" />
      {/* Live Audio/Video Waveform (no human faces) */}
      <path
        d="M72 88H92L102 68L114 106L126 62L138 100L148 82L162 88H198"
        stroke="#E0FFC2"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="76" cy="58" r="4" fill="#3FA57A" />
      <rect x="86" y="55" width="40" height="6" rx="3" fill="#E0FFC2" />
      {/* Video Control Icons */}
      <circle cx="116" cy="142" r="8" fill="#3FA57A" />
      <circle cx="138" cy="142" r="8" fill="#E0FFC2" />
      <circle cx="160" cy="142" r="8" fill="#EF4444" />

      {/* Overlapping Signed Rx Card */}
      <rect x="192" y="76" width="90" height="96" rx="12" fill="#FFFFFF" stroke="#064734" strokeWidth="2.5" />
      <text x="206" y="106" fill="#064734" fontSize="18" fontWeight="800" fontFamily="sans-serif">
        Rx
      </text>
      <rect x="206" y="118" width="60" height="6" rx="3" fill="#3FA57A" />
      <rect x="206" y="130" width="48" height="6" rx="3" fill="#B9E68E" />
      <rect x="206" y="146" width="60" height="14" rx="7" fill="#E0FFC2" />
    </svg>
  );
};

/**
 * 7. Custom 2D Medical Specialty Illustrations for Doctor Cards (Strictly No Human Pictures)
 */
export const DoctorSpecialtyIllustration: React.FC<{
  specialty?: string;
  className?: string;
}> = ({ specialty = '', className = '' }) => {
  const s = specialty.toLowerCase();

  // Cardiology: 2D Heart + ECG Pulse
  if (s.includes('cardio')) {
    return (
      <svg
        viewBox="0 0 320 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="2D Cardiology heart and pulse illustration"
        className={`w-full h-full ${className}`}
      >
        <rect width="320" height="240" fill="#F3FFE7" />
        <circle cx="160" cy="120" r="84" fill="#E0FFC2" />
        <path
          d="M160 184C160 184 92 142 92 96C92 75 109 58 130 58C144 58 155 66 160 76C165 66 176 58 190 58C211 58 228 75 228 96C228 142 160 184 160 184Z"
          fill="#064734"
          stroke="#FFFFFF"
          strokeWidth="4"
        />
        <path
          d="M112 114H134L144 92L155 134L167 84L177 122L186 110H208"
          stroke="#E0FFC2"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="24" y="20" width="88" height="24" rx="8" fill="#FFFFFF" stroke="#B9E68E" strokeWidth="2" />
        <text x="36" y="36" fill="#064734" fontSize="10" fontWeight="800" fontFamily="sans-serif">
          CARDIOLOGY
        </text>
      </svg>
    );
  }

  // Pulmonology: 2D Lungs & Respiratory Airways
  if (s.includes('pulmo') || s.includes('respir')) {
    return (
      <svg
        viewBox="0 0 320 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="2D Pulmonology lungs and airway illustration"
        className={`w-full h-full ${className}`}
      >
        <rect width="320" height="240" fill="#F3FFE7" />
        <circle cx="160" cy="122" r="84" fill="#E0FFC2" />
        {/* Trachea */}
        <path d="M160 54V112" stroke="#064734" strokeWidth="9" strokeLinecap="round" />
        <path d="M160 104L130 124M160 104L190 124" stroke="#064734" strokeWidth="7" strokeLinecap="round" />
        {/* Left & Right Lungs */}
        <path
          d="M144 92C122 92 94 114 94 152C94 174 108 186 126 186C140 186 148 176 148 158V96C148 93 146 92 144 92Z"
          fill="#064734"
          stroke="#FFFFFF"
          strokeWidth="3.5"
        />
        <path
          d="M176 92C198 92 226 114 226 152C226 174 212 186 194 186C180 186 172 176 172 158V96C172 93 174 92 176 92Z"
          fill="#3FA57A"
          stroke="#FFFFFF"
          strokeWidth="3.5"
        />
        <path d="M126 124L114 146M194 124L206 146" stroke="#E0FFC2" strokeWidth="3.5" strokeLinecap="round" />
        <rect x="24" y="20" width="98" height="24" rx="8" fill="#FFFFFF" stroke="#B9E68E" strokeWidth="2" />
        <text x="34" y="36" fill="#064734" fontSize="10" fontWeight="800" fontFamily="sans-serif">
          PULMONOLOGY
        </text>
      </svg>
    );
  }

  // Dermatology & Immunology: 2D Protective Shield + Microscope / Dropper
  if (s.includes('derma') || s.includes('immun')) {
    return (
      <svg
        viewBox="0 0 320 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="2D Dermatology shield and serum dropper illustration"
        className={`w-full h-full ${className}`}
      >
        <rect width="320" height="240" fill="#F3FFE7" />
        <circle cx="160" cy="122" r="84" fill="#E0FFC2" />
        {/* Protective Shield */}
        <path
          d="M160 56L218 80V126C218 160 192 184 160 196C128 184 102 160 102 126V80L160 56Z"
          fill="#064734"
          stroke="#FFFFFF"
          strokeWidth="4"
        />
        {/* Botanical / Cellular Droplet */}
        <path
          d="M160 88C160 88 186 118 186 138C186 152.359 174.359 164 160 164C145.641 164 134 152.359 134 138C134 118 160 88 160 88Z"
          fill="#E0FFC2"
        />
        <path d="M160 116V146M148 131H172" stroke="#064734" strokeWidth="4.5" strokeLinecap="round" />
        <rect x="24" y="20" width="102" height="24" rx="8" fill="#FFFFFF" stroke="#B9E68E" strokeWidth="2" />
        <text x="34" y="36" fill="#064734" fontSize="10" fontWeight="800" fontFamily="sans-serif">
          DERMATOLOGY
        </text>
      </svg>
    );
  }

  // Orthopedics: 2D Spine/Joint Geometry + Cross
  if (s.includes('ortho')) {
    return (
      <svg
        viewBox="0 0 320 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="2D Orthopedics joint and care illustration"
        className={`w-full h-full ${className}`}
      >
        <rect width="320" height="240" fill="#F3FFE7" />
        <circle cx="160" cy="122" r="84" fill="#E0FFC2" />
        <rect x="136" y="56" width="48" height="26" rx="10" fill="#064734" />
        <rect x="132" y="90" width="56" height="26" rx="10" fill="#3FA57A" />
        <rect x="128" y="124" width="64" height="26" rx="10" fill="#064734" />
        <rect x="134" y="158" width="52" height="26" rx="10" fill="#3FA57A" />
        <rect x="24" y="20" width="100" height="24" rx="8" fill="#FFFFFF" stroke="#B9E68E" strokeWidth="2" />
        <text x="34" y="36" fill="#064734" fontSize="10" fontWeight="800" fontFamily="sans-serif">
          ORTHOPEDICS
        </text>
      </svg>
    );
  }

  // General & Internal Medicine (Default): 2D Medical Kit + Stethoscope
  return (
    <svg
      viewBox="0 0 320 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="2D Internal Medicine medical kit and stethoscope illustration"
      className={`w-full h-full ${className}`}
    >
      <rect width="320" height="240" fill="#F3FFE7" />
      <circle cx="160" cy="122" r="84" fill="#E0FFC2" />
      {/* Handle */}
      <path d="M132 82V68C132 63.5817 135.582 60 140 60H180C184.418 60 188 63.5817 188 68V82" stroke="#064734" strokeWidth="6" />
      {/* Medical Kit Box */}
      <rect x="88" y="80" width="144" height="104" rx="18" fill="#064734" stroke="#FFFFFF" strokeWidth="4" />
      {/* Medical Cross */}
      <circle cx="160" cy="132" r="30" fill="#E0FFC2" />
      <path d="M160 116V148M144 132H176" stroke="#064734" strokeWidth="7" strokeLinecap="round" />
      <rect x="24" y="20" width="118" height="24" rx="8" fill="#FFFFFF" stroke="#B9E68E" strokeWidth="2" />
      <text x="34" y="36" fill="#064734" fontSize="10" fontWeight="800" fontFamily="sans-serif">
        INTERNAL MEDICINE
      </text>
    </svg>
  );
};
