import { SupportedLanguage } from '../types/healthcare';

export interface LandingFeatureItemTranslation {
  id: 'ai-assistant' | 'book-appointments' | 'trusted-care';
  title: string;
  shortDesc: string;
  description: string;
  highlights: [string, string, string];
  ctaLabel: string;
}

export interface RolePortalTranslation {
  tabLabel: string;
  badge: string;
  title: string;
  subtitle: string;
  signupTitle: string;
  signupSubtitle: string;
  bannerCaption: string;
  capabilitiesHeading: string;
  highlights: [string, string, string, string];
  securityNote: string;
  demoHeading: string;
  demoSubtitle: string;
  emailLabel: string;
  submitLoginLabel: string;
  nextLabel?: string;
  prevLabel?: string;
}

export interface UiTranslationBundle {
  appTitle: string;
  sidebarBrand: string;
  portalLabel: string;
  doctorPortalLabel: string;
  adminPortalLabel: string;
  approvedStatus: string;
  pendingApprovalStatus: string;
  privacyNotice: string;
  aiDisclaimer: string;
  persistentDisclaimer: string;
  bookAppointmentPrompt: string;
  bookAppointmentBtn: string;
  prescriptionWarning: string;
  emergencyBannerTitle: string;
  emergencyBannerText: string;
  emergencyHelplineBar: string;
  welcomeBadge: string;
  heroTitlePatient: string;
  heroSubtitlePatient: string;
  heroTitleDoctor: string;
  heroBtnBookAppointment: string;
  heroBtnOpenChat: string;
  heroBtnScanRx: string;
  heroBtnManageAppointments: string;
  heroBtnWriteERx: string;
  upcomingReminderTitle: string;
  todayLabel: string;
  joinCallNowBtn: string;
  remindersBtn: string;
  remindersDrawerTitle: string;
  closeBtn: string;
  signOutBtn: string;
  switchToDoctorViewBtn: string;
  switchToPatientViewBtn: string;
  privacyPolicy: string;
  termsConditions: string;
  nav: {
    dashboard: string;
    aiChat: string;
    prescriptionScanner: string;
    symptomChecker: string;
    appointments: string;
    eprescriptions: string;
    vitalsTracker: string;
    historyTimeline: string;
    videoConsult: string;
    adminUsers: string;
    adminApprovals: string;
    adminAnalytics: string;
  };
  chatPlaceholder: string;
  sampleQuestions: string[];
  loader: {
    brandSubtitle: string;
    preparingMessage: string;
    verifyingSession: string;
    errorTitle: string;
    retryBtn: string;
    continueToLoginBtn: string;
  };
  landing: {
    brandSubtitle: string;
    navFeatures: string;
    navHowItWorks: string;
    navLoginPortals: string;
    navDemoAccess: string;
    headerPatientLogin: string;
    headerLoginShort: string;
    headerDoctor: string;
    headerAdmin: string;
    heroTagline: string;
    heroSubtitle: string;
    ctaPatientLogin: string;
    ctaDoctorLogin: string;
    ctaAdminLogin: string;
    readinessVerified: string;
    readinessAlwaysOn: string;
    previewHeaderTitle: string;
    previewBadge: string;
    previewLiveTag: string;
    previewYouLabel: string;
    previewAiLabel: string;
    previewUserQuestion: string;
    previewAiLead: string;
    previewAiHighlight: string;
    previewAiBody: string;
    previewFollowUp: string;
    previewBookCta: string;
    featuresSectionBadge: string;
    featuresSectionHeading: string;
    featuresSectionSubtitle: string;
    getStartedFreeBtn: string;
    features: [
      LandingFeatureItemTranslation,
      LandingFeatureItemTranslation,
      LandingFeatureItemTranslation,
    ];
    howItWorksBadge: string;
    howItWorksHeading: string;
    howItWorksSubtitle: string;
    scrollRevealLines: [string, string, string, string, string];
    emergencyNoteStrong: string;
    portalsBadge: string;
    portalsHeading: string;
    portalsSubtitle: string;
    patientCardTag: string;
    patientCardTitle: string;
    patientCardDesc: string;
    patientCardOpenBtn: string;
    patientCardSignupBtn: string;
    doctorCardTag: string;
    doctorCardTitle: string;
    doctorCardDesc: string;
    doctorCardOpenBtn: string;
    doctorCardSignupBtn: string;
    adminCardTag: string;
    adminCardTitle: string;
    adminCardDesc: string;
    adminCardOpenBtn: string;
    adminCardNotice: string;
    demoHeading: string;
    demoSubtitle: string;
    demoBadge: string;
    demoColName: string;
    demoColRole: string;
    demoColCreds: string;
    demoColAction: string;
    demoLoginBtn: string;
    servicesHeading: string;
    services: [
      { title: string; description: string },
      { title: string; description: string },
      { title: string; description: string },
      { title: string; description: string },
    ];
    footerHighlightStrip: string;
  };
  roleLogin: {
    homeBtn: string;
    selectPortalLabel: string;
    portalPrefix: string;
    stepPrefix: string;
    accountSingular: string;
    accountPlural: string;
    signInBtn: string;
    signingInLabel: string;
    creatingAccountLabel: string;
    patientSignInTab: string;
    patientSignupTab: string;
    doctorSignInTab: string;
    doctorSignupTab: string;
    adminRestrictedBanner: string;
    passwordLabel: string;
    fullNameLabel: string;
    phoneLabel: string;
    emailAddressLabel: string;
    passwordPlaceholder: string;
    ageLabel: string;
    genderLabel: string;
    genderFemale: string;
    genderMale: string;
    genderOther: string;
    bloodGroupLabel: string;
    specialtyLabel: string;
    medRegNoLabel: string;
    qualificationLabel: string;
    experienceLabel: string;
    consultFeeLabel: string;
    doctorVerifyPolicyLabel: string;
    doctorVerifyPolicyText: string;
    registerPatientBtn: string;
    registerDoctorBtn: string;
    otherPortalsLabel: string;
    nextPrefix: string;
    goToPrefix: string;
    mismatchError: (roleDisplay: string) => string;
    roleDisplayNames: {
      patient: string;
      doctor: string;
      admin: string;
    };
    agreePrefix: string;
    agreeAnd: string;
    footerCaption: string;
    roles: {
      patient: RolePortalTranslation;
      doctor: RolePortalTranslation;
      admin: RolePortalTranslation;
    };
  };
}

export const UI_TRANSLATIONS: Record<SupportedLanguage, UiTranslationBundle> = {
  English: {
    appTitle: 'MedAssist · Virtual Healthcare Assistant',
    sidebarBrand: 'MedAssist',
    portalLabel: 'Patient Portal',
    doctorPortalLabel: 'Doctor Portal · Active',
    adminPortalLabel: 'Admin Portal',
    approvedStatus: 'Approved',
    pendingApprovalStatus: 'Pending Approval',
    privacyNotice: 'Your health data is private and used only to provide this service.',
    aiDisclaimer: 'This response is AI-generated and can make mistakes. Please recheck with a qualified doctor.',
    persistentDisclaimer: 'Disclaimer: AI guidance is for informational support only and does not replace professional medical advice.',
    bookAppointmentPrompt: 'Would you like to book an appointment?',
    bookAppointmentBtn: 'Book Appointment',
    prescriptionWarning: 'AI can misread handwriting. Always confirm medicine names and doses with your doctor or pharmacist before taking anything.',
    emergencyBannerTitle: 'Medical Emergency Warning — Call 108 or 112 Immediately',
    emergencyBannerText: 'Detected severe red-flag symptoms (such as chest pain, difficulty breathing, stroke signs, or severe bleeding). Do NOT rely on home remedies. Call 108 (Ambulance) or 112 immediately, or proceed to the nearest hospital emergency room.',
    emergencyHelplineBar: 'Emergency Helpline: 108 (Ambulance) · 112',
    welcomeBadge: 'Welcome',
    heroTitlePatient: 'Your Smart Digital Clinic for AI Guidance & Specialist Care',
    heroSubtitlePatient: 'Get instant AI-assisted symptom triage, verify handwritten prescriptions, and consult certified specialists online.',
    heroTitleDoctor: 'Clinical Telemedicine Workspace',
    heroBtnBookAppointment: 'Book Appointment',
    heroBtnOpenChat: 'Open AI Health Chat',
    heroBtnScanRx: 'Scan Prescription',
    heroBtnManageAppointments: 'Manage Appointments',
    heroBtnWriteERx: 'Write E-Prescription',
    upcomingReminderTitle: 'Upcoming Confirmed Video Consultation Reminder',
    todayLabel: 'Today',
    joinCallNowBtn: 'Join Call Now',
    remindersBtn: 'Reminders',
    remindersDrawerTitle: 'Appointment Reminders & Alerts',
    closeBtn: 'Close',
    signOutBtn: 'Sign Out / Switch Role',
    switchToDoctorViewBtn: 'Switch to Doctor Portal',
    switchToPatientViewBtn: 'Switch to Patient Portal',
    privacyPolicy: 'Privacy Policy',
    termsConditions: 'Terms & Conditions',
    nav: {
      dashboard: 'Overview',
      aiChat: 'AI Health Chat',
      prescriptionScanner: 'Prescription Analysis',
      symptomChecker: 'Symptom Checker',
      appointments: 'Appointments',
      eprescriptions: 'E-Prescriptions',
      vitalsTracker: 'Vitals & Dose Tracker',
      historyTimeline: 'Health Timeline',
      videoConsult: 'Video Consultation',
      adminUsers: 'User Directory',
      adminApprovals: 'Doctor Approvals',
      adminAnalytics: 'Platform Analytics',
    },
    chatPlaceholder: 'Describe your symptoms or ask a health question in English, Telugu, or Hindi...',
    sampleQuestions: [
      'I have a mild fever and sore throat. What are the causes, home remedies, and common tablets used?',
      'What are the uses of Paracetamol, Cetirizine, and Pantoprazole tablets?',
      'What home remedies and tablets are generally used for acidity and indigestion?',
      'What are the common causes and home care tips for migraine headaches?',
    ],
    loader: {
      brandSubtitle: 'MedAssist Clinical Portal',
      preparingMessage: 'Preparing Your Healthcare Experience...',
      verifyingSession: 'Verifying your secure clinical session',
      errorTitle: 'Unable to Verify Your Session',
      retryBtn: 'Retry Connection',
      continueToLoginBtn: 'Continue to Sign In',
    },
    landing: {
      brandSubtitle: 'Virtual Healthcare Assistant',
      navFeatures: 'Features',
      navHowItWorks: 'How It Works',
      navLoginPortals: 'Login Portals',
      navDemoAccess: 'Demo Access',
      headerPatientLogin: 'Patient Login',
      headerLoginShort: 'Login',
      headerDoctor: 'Doctor',
      headerAdmin: 'Admin',
      heroTagline: "Your health matters. We're here, anytime you need us.",
      heroSubtitle:
        'Get instant multilingual health guidance in English, తెలుగు, and हिन्दी, book verified specialists, and receive clinician-approved care in one calm workspace.',
      ctaPatientLogin: 'Patient Login',
      ctaDoctorLogin: 'Doctor Login',
      ctaAdminLogin: 'Admin Login',
      readinessVerified: 'Admin-Verified Clinicians',
      readinessAlwaysOn: 'Always-On Support',
      previewHeaderTitle: 'MedAssist · AI Health Assistant',
      previewBadge: 'English · 24/7 Care',
      previewLiveTag: 'Live Preview',
      previewYouLabel: 'You',
      previewAiLabel: 'AI Health Assistant',
      previewUserQuestion:
        'I have had a mild sore throat and low-grade fever since yesterday. What should I do?',
      previewAiLead: 'This may be linked to a ',
      previewAiHighlight: 'mild viral upper respiratory infection',
      previewAiBody:
        '. Stay hydrated with warm fluids, try warm saline gargles, and monitor your temperature. If fever persists past 48 hours, consult a clinician.',
      previewFollowUp: 'Ready to speak with a verified doctor?',
      previewBookCta: 'Book appointment',
      featuresSectionBadge: 'Built For Every Step Of Care',
      featuresSectionHeading: 'Everything You Need With MedAssist',
      featuresSectionSubtitle:
        'From immediate AI symptom clarity to verified doctor consultations and safe prescriptions.',
      getStartedFreeBtn: 'Get Started Free',
      features: [
        {
          id: 'ai-assistant',
          title: 'AI Health Assistant',
          shortDesc: '24/7 guidance in English, Telugu & Hindi',
          description:
            'Get instant, plain-language explanations of symptoms, likely causes, safe home remedies, and prescription medicine uses whenever a health question comes up.',
          highlights: ['English · తెలుగు · हिन्दी', 'Handwritten Rx OCR', 'Calm emergency triage'],
          ctaLabel: 'Open AI Assistant',
        },
        {
          id: 'book-appointments',
          title: 'Book Appointments',
          shortDesc: 'Verified doctors & live video consults',
          description:
            'Browse Admin-approved specialists, pick conflict-free time slots, and connect via built-in WebRTC video consultation or visit a nearby clinic with ease.',
          highlights: ['Verified specialists', 'Conflict-free slots', 'Built-in video calls'],
          ctaLabel: 'Schedule a Visit',
        },
        {
          id: 'trusted-care',
          title: 'Trusted Care',
          shortDesc: 'Allergy guardrails & verified e-Rx',
          description:
            'Built for clinical clarity with doctor-issued PDF e-prescriptions, automatic allergy checks, transparent AI safety disclaimers, and clear 108 / 112 emergency guidance.',
          highlights: ['Admin-verified clinicians', 'Downloadable PDF e-Rx', 'Privacy-first records'],
          ctaLabel: 'Explore Care Portals',
        },
      ],
      howItWorksBadge: 'How It Works',
      howItWorksHeading: 'Seamless Care, Step By Step',
      howItWorksSubtitle:
        'From your first symptom question to a verified doctor consultation and digital e-prescription.',
      scrollRevealLines: [
        'Speak with MedAssist in English, Telugu, or Hindi anytime.',
        'Understand symptoms, likely causes, and safe next steps clearly.',
        'Scan printed or handwritten prescriptions with transparent confidence flags.',
        'Book verified specialists in seconds for live video or clinic visits.',
        'Receive clinician-approved digital e-prescriptions built around your safety.',
      ],
      emergencyNoteStrong:
        'If you are in a severe condition, please consult a nearby doctor immediately or go to the nearest hospital. In an emergency, call 108 or 112.',
      portalsBadge: 'Dedicated Role Portals',
      portalsHeading: 'Choose Your Login Portal',
      portalsSubtitle:
        'Separate, role-verified login pages for Patients, Doctors, and Administrators.',
      patientCardTag: '01 · Patient Portal',
      patientCardTitle: 'Patient Login',
      patientCardDesc:
        'Consult AI in English, Telugu, or Hindi, scan handwritten prescriptions, book verified doctors, and join live video calls.',
      patientCardOpenBtn: 'Open Patient Login Page',
      patientCardSignupBtn: 'Create New Patient Account',
      doctorCardTag: '02 · Clinician Portal',
      doctorCardTitle: 'Doctor Login',
      doctorCardDesc:
        'Manage patient booking requests, conduct live video consultations, and issue allergy-checked digital PDF e-prescriptions.',
      doctorCardOpenBtn: 'Open Doctor Login Page',
      doctorCardSignupBtn: 'Register as a Doctor',
      adminCardTag: '03 · Governance Portal',
      adminCardTitle: 'Admin Login',
      adminCardDesc:
        'Verify and approve doctor registrations, oversee user access controls, and monitor clinical telemedicine platform analytics.',
      adminCardOpenBtn: 'Open Admin Login Page',
      adminCardNotice: 'Authorized administrators only',
      demoHeading: 'Instant Demo Login Credentials (3 Patients · 5 Doctors · 1 Admin)',
      demoSubtitle:
        'Click any account row below for 1-click sign-in, or use the dedicated Patient, Doctor, and Admin login pages above.',
      demoBadge: '1-Click Switcher',
      demoColName: 'Account Name',
      demoColRole: 'Role & Status',
      demoColCreds: 'Credentials',
      demoColAction: 'Action',
      demoLoginBtn: 'Login',
      servicesHeading: 'Integrated Clinical AI & Telemedicine Services',
      services: [
        {
          title: 'AI Health Chat (Causes, Remedies & Tablet Uses)',
          description:
            'Explains common causes, safe home remedies, and general uses of tablets in plain English, Telugu, or Hindi with live streaming.',
        },
        {
          title: 'Multimodal Prescription Vision',
          description:
            'Extracts handwritten or printed medicines with High/Medium/Low confidence indicators, flagging unclear words in red as "Unclear, please verify".',
        },
        {
          title: 'Calm Emergency Guidance (108 / 112)',
          description:
            'Includes a calm hospital/emergency note at the end of every response and an urgent red alert only when life-threatening symptoms are described.',
        },
        {
          title: 'End-to-End Telemedicine Workflow',
          description:
            'Includes Symptom Checker, conflict-free Appointment Booking, WebRTC Video Consultation room, and downloadable PDF E-Prescriptions.',
        },
      ],
      footerHighlightStrip: 'AI Health Assistant · Book Appointments · Trusted Care',
    },
    roleLogin: {
      homeBtn: 'Home',
      selectPortalLabel: 'Select Login Portal',
      portalPrefix: 'Portal',
      stepPrefix: 'Step',
      accountSingular: 'Account',
      accountPlural: 'Accounts',
      signInBtn: 'Sign In',
      signingInLabel: 'Signing in...',
      creatingAccountLabel: 'Creating Account...',
      patientSignInTab: 'Patient Sign In',
      patientSignupTab: 'New Patient Registration',
      doctorSignInTab: 'Doctor Sign In',
      doctorSignupTab: 'Doctor Registration',
      adminRestrictedBanner:
        'Restricted Administrator Sign-In (Internal Credentials Required)',
      passwordLabel: 'Password',
      fullNameLabel: 'Full Name',
      phoneLabel: 'Phone Number',
      emailAddressLabel: 'Email Address',
      passwordPlaceholder: 'Create a strong password',
      ageLabel: 'Age',
      genderLabel: 'Gender',
      genderFemale: 'Female',
      genderMale: 'Male',
      genderOther: 'Other',
      bloodGroupLabel: 'Blood Group',
      specialtyLabel: 'Specialty',
      medRegNoLabel: 'Medical Reg. No.',
      qualificationLabel: 'Qualification',
      experienceLabel: 'Experience (Yrs)',
      consultFeeLabel: 'Consult Fee (₹)',
      doctorVerifyPolicyLabel: 'Verification Policy:',
      doctorVerifyPolicyText:
        'New Doctor accounts require Administrator approval before going live in the patient booking directory.',
      registerPatientBtn: 'Register Patient Account',
      registerDoctorBtn: 'Register Doctor Account',
      otherPortalsLabel: 'Other portals:',
      nextPrefix: 'Next:',
      goToPrefix: 'Go to',
      mismatchError: (roleDisplay: string) =>
        `This account belongs to the ${roleDisplay} portal. Please sign in through the ${roleDisplay} Login page.`,
      roleDisplayNames: {
        patient: 'Patient',
        doctor: 'Doctor',
        admin: 'Admin',
      },
      agreePrefix: 'By continuing, you agree to our',
      agreeAnd: 'and',
      footerCaption: 'MedAssist · Dedicated Patient, Doctor & Administrator Portals',
      roles: {
        patient: {
          tabLabel: 'Patient Login',
          badge: 'Patient Care Portal',
          title: 'Patient Sign In',
          subtitle:
            'Access your multilingual AI health chat, prescription scanner, doctor bookings, live video consultations, and PDF e-prescriptions.',
          signupTitle: 'Create Patient Account',
          signupSubtitle:
            'Register in seconds for instant access to AI health guidance and verified specialist consultations.',
          bannerCaption: 'Personal Health Assistant & Telemedicine',
          capabilitiesHeading: 'Included in Your Patient Portal',
          highlights: [
            'Consult AI in English, Telugu, or Hindi with instant symptom triage',
            'Scan handwritten or printed prescriptions with confidence indicators',
            'Book verified specialists & join encrypted live video consultations',
            'Download doctor-signed PDF e-prescriptions & track vitals',
          ],
          securityNote:
            'Your health history and prescriptions are strictly private and visible only to you and doctors you book with.',
          demoHeading: 'Patient Demo Accounts',
          demoSubtitle: 'Click any verified patient account below for instant 1-click sign-in.',
          emailLabel: 'Patient Email Address',
          submitLoginLabel: 'Sign In to Patient Portal',
          nextLabel: 'Doctor Login',
        },
        doctor: {
          tabLabel: 'Doctor Login',
          badge: 'Verified Clinician Portal',
          title: 'Doctor Sign In',
          subtitle:
            'Review patient booking requests, conduct live WebRTC video consultations, and issue allergy-checked digital e-prescriptions.',
          signupTitle: 'Register as a Doctor',
          signupSubtitle:
            'Submit your medical credentials for Administrator verification before appearing in the patient booking directory.',
          bannerCaption: 'Clinician Telemedicine & E-Rx Workspace',
          capabilitiesHeading: 'Included in Your Clinician Workspace',
          highlights: [
            'Accept, reschedule, or decline incoming patient appointment requests',
            'Review pre-consultation AI symptom checks, allergies, and vitals',
            'Host real-time HD video consultations with instant room sync',
            'Generate signed PDF e-prescriptions with built-in allergy guardrails',
          ],
          securityNote:
            'Clinician access is role-scoped to assigned patients only. New doctor registrations require Admin credential approval.',
          demoHeading: 'Doctor Demo Accounts',
          demoSubtitle: 'Click any verified doctor account below for instant 1-click sign-in.',
          emailLabel: 'Doctor Email Address',
          submitLoginLabel: 'Sign In to Doctor Workspace',
          prevLabel: 'Patient Login',
          nextLabel: 'Admin Login',
        },
        admin: {
          tabLabel: 'Admin Login',
          badge: 'Restricted Governance Portal',
          title: 'Administrator Sign In',
          subtitle:
            'Verify and approve doctor registrations, manage platform user accounts, and monitor clinical telemedicine analytics.',
          signupTitle: 'Administrator Sign In',
          signupSubtitle:
            'Administrator accounts are provisioned internally and cannot be self-registered.',
          bannerCaption: 'Clinical Verification & Platform Governance',
          capabilitiesHeading: 'Administrator Governance Capabilities',
          highlights: [
            'Review submitted medical registration numbers and approve doctors',
            'Audit and manage Patient and Doctor accounts across the platform',
            'Monitor platform-wide consultations, e-prescriptions, and AI usage',
            'Enforce strict role-based security and clinical compliance policies',
          ],
          securityNote:
            'Authorized personnel only. Public registration is disabled for Administrator accounts to protect clinical governance.',
          demoHeading: 'Administrator Demo Account',
          demoSubtitle: 'Click the verified administrator account below for instant 1-click sign-in.',
          emailLabel: 'Administrator Email Address',
          submitLoginLabel: 'Sign In to Admin Panel',
          prevLabel: 'Doctor Login',
        },
      },
    },
  },
  Telugu: {
    appTitle: 'MedAssist · వర్చువల్ హెల్త్‌కేర్ అసిస్టెంట్',
    sidebarBrand: 'MedAssist',
    portalLabel: 'రోగి పోర్టల్',
    doctorPortalLabel: 'డాక్టర్ పోర్టల్ · యాక్టివ్',
    adminPortalLabel: 'అడ్మిన్ పోర్టల్',
    approvedStatus: 'ఆమోదించబడింది',
    pendingApprovalStatus: 'ఆమోదం పెండింగ్‌లో ఉంది',
    privacyNotice: 'మీ ఆరోగ్య డేటా గోప్యంగా ఉంచబడుతుంది మరియు ఈ సేవను అందించడానికి మాత్రమే ఉపయోగించబడుతుంది.',
    aiDisclaimer: 'ఈ ప్రతిస్పందన AI ద్వారా రూపొందించబడింది మరియు తప్పులు ఉండవచ్చు. దయచేసి అర్హత కలిగిన వైద్యుడితో సరిచూసుకోండి.',
    persistentDisclaimer: 'గమనిక: AI మార్గదర్శకత్వం కేవలం సమాచార సహాయం కోసం మాత్రమే మరియు ఇది వృత్తిపరమైన వైద్య సలహాకు ప్రత్యామ్నాయం కాదు.',
    bookAppointmentPrompt: 'మీరు డాక్టర్ అపాయింట్‌మెంట్ బుక్ చేసుకోవాలనుకుంటున్నారా?',
    bookAppointmentBtn: 'అపాయింట్‌మెంట్ బుక్ చేయండి',
    prescriptionWarning: 'AI చేతిరాతను తప్పుగా చదవగలదు. ఏదైనా మందులు తీసుకునే ముందు ఎల్లప్పుడూ మీ డాక్టర్ లేదా ఫార్మసిస్ట్‌తో మందుల పేర్లు మరియు మోతాదులను నిర్ధారించుకోండి.',
    emergencyBannerTitle: 'అత్యవసర వైద్య హెచ్చరిక — వెంటనే 108 లేదా 112 కి కాల్ చేయండి',
    emergencyBannerText: 'ఛాతీ నొప్పి, శ్వాస తీసుకోవడంలో ఇబ్బంది, స్ట్రోక్ లక్షణాలు లేదా తీవ్రమైన రక్తస్రావం వంటి తీవ్రమైన లక్షణాలు గుర్తించబడ్డాయి. ఇంటి చిట్కాలు ప్రయత్నించకండి — వెంటనే 108 (అంబులెన్స్) లేదా 112 కి కాల్ చేయండి లేదా సమీప ఆసుపత్రికి వెళ్లండి.',
    emergencyHelplineBar: 'అత్యవసర హెల్ప్‌లైన్: 108 (అంబులెన్స్) · 112',
    welcomeBadge: 'స్వాగతం',
    heroTitlePatient: 'AI మార్గదర్శకత్వం & స్పెషలిస్ట్ సంరక్షణ కోసం మీ స్మార్ట్ డిజిటల్ క్లినిక్',
    heroSubtitlePatient: 'తక్షణ AI లక్షణాల పరిశీలన పొందండి, చేతిరాత ప్రిస్క్రిప్షన్లను సరిచూసుకోండి మరియు ఆన్‌లైన్‌లో ధృవీకృత నిపుణులను సంప్రదించండి.',
    heroTitleDoctor: 'క్లినికల్ టెలిమెడిసిన్ వర్క్‌స్పేస్',
    heroBtnBookAppointment: 'అపాయింట్‌మెంట్ బుక్ చేయండి',
    heroBtnOpenChat: 'AI ఆరోగ్య చాట్ తెరవండి',
    heroBtnScanRx: 'ప్రిస్క్రిప్షన్ స్కాన్ చేయండి',
    heroBtnManageAppointments: 'అపాయింట్‌మెంట్లను నిర్వహించండి',
    heroBtnWriteERx: 'ఇ-ప్రిస్క్రిప్షన్ రాయండి',
    upcomingReminderTitle: 'రాబోయే నిర్ధారిత వీడియో కన్సల్టేషన్ రిమైండర్',
    todayLabel: 'ఈ రోజు',
    joinCallNowBtn: 'ఇప్పుడే కాల్‌లో చేరండి',
    remindersBtn: 'రిమైండర్లు',
    remindersDrawerTitle: 'అపాయింట్‌మెంట్ రిమైండర్లు & హెచ్చరికలు',
    closeBtn: 'మూసివేయి',
    signOutBtn: 'సైన్ అవుట్ / పాత్రను మార్చండి',
    switchToDoctorViewBtn: 'డాక్టర్ పోర్టల్‌కు మారండి',
    switchToPatientViewBtn: 'రోగి పోర్టల్‌కు మారండి',
    privacyPolicy: 'గోప్యతా విధానం',
    termsConditions: 'నిబంధనలు & షరతులు',
    nav: {
      dashboard: 'అవలోకనం',
      aiChat: 'AI ఆరోగ్య చాట్',
      prescriptionScanner: 'ప్రిస్క్రిప్షన్ విశ్లేషణ',
      symptomChecker: 'లక్షణాల తనిఖీ',
      appointments: 'అపాయింట్‌మెంట్లు',
      eprescriptions: 'ఇ-ప్రిస్క్రిప్షన్లు',
      vitalsTracker: 'వైటల్స్ & మందుల ట్రాకర్',
      historyTimeline: 'ఆరోగ్య చరిత్ర',
      videoConsult: 'వీడియో కన్సల్టేషన్',
      adminUsers: 'వినియోగదారులు',
      adminApprovals: 'డాక్టర్ ఆమోదాలు',
      adminAnalytics: 'గణాంకాలు',
    },
    chatPlaceholder: 'మీ ఆరోగ్య ప్రశ్న, ఇంటి చిట్కాలు లేదా మాత్రల ఉపయోగాలను అడగండి...',
    sampleQuestions: [
      'జ్వరం మరియు పొడి దగ్గుకు గల కారణాలు, ఇంటి చిట్కాలు (Home Remedies) మరియు సాధారణ మాత్రల ఉపయోగాలు ఏమిటి?',
      'పారాసిటమాల్ (Paracetamol) మరియు సిటిరిజైన్ (Cetirizine) మాత్రలు దేనికి ఉపయోగిస్తారు?',
      'గ్యాస్ మరియు ఎసిడిటీ తగ్గడానికి ఇంటి చిట్కాలు మరియు సాధారణ మాత్రల ఉపయోగం ఏమిటి?',
      'మైగ్రేన్ తలనొప్పి ఎందుకు వస్తుంది మరియు ఇంటి వద్ద తీసుకోవలసిన జాగ్రత్తలు ఏమిటి?',
    ],
    loader: {
      brandSubtitle: 'MedAssist క్లినికల్ పోర్టల్',
      preparingMessage: 'మీ ఆరోగ్య సేవను సిద్ధం చేస్తున్నాము...',
      verifyingSession: 'మీ సురక్షిత క్లినికల్ సెషన్‌ను ధృవీకరిస్తున్నాము',
      errorTitle: 'మీ సెషన్‌ను ధృవీకరించడం సాధ్యం కాలేదు',
      retryBtn: 'మళ్లీ ప్రయత్నించండి',
      continueToLoginBtn: 'లాగిన్‌కు కొనసాగండి',
    },
    landing: {
      brandSubtitle: 'వర్చువల్ హెల్త్‌కేర్ అసిస్టెంట్',
      navFeatures: 'ఫీచర్లు',
      navHowItWorks: 'ఎలా పనిచేస్తుంది',
      navLoginPortals: 'లాగిన్ పోర్టల్స్',
      navDemoAccess: 'డెమో యాక్సెస్',
      headerPatientLogin: 'రోగి లాగిన్',
      headerLoginShort: 'లాగిన్',
      headerDoctor: 'డాక్టర్',
      headerAdmin: 'అడ్మిన్',
      heroTagline: 'మీ ఆరోగ్యం ముఖ్యం. మీకు అవసరమైనప్పుడల్లా మేము ఉన్నాము.',
      heroSubtitle:
        'English, తెలుగు మరియు हिन्दी భాషలలో తక్షణ ఆరోగ్య మార్గదర్శకత్వం పొందండి, ధృవీకృత నిపుణులతో అపాయింట్‌మెంట్ బుక్ చేసుకోండి మరియు సురక్షిత వైద్య సంరక్షణను పొందండి.',
      ctaPatientLogin: 'రోగి లాగిన్',
      ctaDoctorLogin: 'డాక్టర్ లాగిన్',
      ctaAdminLogin: 'అడ్మిన్ లాగిన్',
      readinessVerified: 'అడ్మిన్-ధృవీకృత వైద్యులు',
      readinessAlwaysOn: '24/7 ఆరోగ్య సహాయం',
      previewHeaderTitle: 'MedAssist · AI ఆరోగ్య సహాయకుడు',
      previewBadge: 'తెలుగు · 24/7 సంరక్షణ',
      previewLiveTag: 'లైవ్ ప్రివ్యూ',
      previewYouLabel: 'మీరు',
      previewAiLabel: 'AI ఆరోగ్య సహాయకుడు',
      previewUserQuestion:
        'నిన్నటి నుండి గొంతు నొప్పి మరియు తేలికపాటి జ్వరం ఉంది. ఏం చేయాలి?',
      previewAiLead: 'ఇది సాధారణంగా ',
      previewAiHighlight: 'తేలికపాటి వైరల్ ఇన్ఫెక్షన్',
      previewAiBody:
        ' వల్ల కలగవచ్చు. గోరువెచ్చని నీరు తాగండి, ఉప్పు నీటితో పుక్కిలించండి మరియు విశ్రాంతి తీసుకోండి. 48 గంటలకు మించి జ్వరం ఉంటే డాక్టర్‌ను సంప్రదించండి.',
      previewFollowUp: 'ధృవీకృత డాక్టర్‌తో మాట్లాడాలనుకుంటున్నారా?',
      previewBookCta: 'అపాయింట్‌మెంట్ బుక్ చేయండి',
      featuresSectionBadge: 'ప్రతి ఆరోగ్య అవసరానికి',
      featuresSectionHeading: 'MedAssist తో మీకు కావలసినవన్నీ',
      featuresSectionSubtitle:
        'తక్షణ AI లక్షణాల అవగాహన నుండి ధృవీకృత డాక్టర్ సంప్రదింపులు మరియు సురక్షిత ప్రిస్క్రిప్షన్ల వరకు.',
      getStartedFreeBtn: 'ఉచితంగా ప్రారంభించండి',
      features: [
        {
          id: 'ai-assistant',
          title: 'AI ఆరోగ్య సహాయకుడు',
          shortDesc: 'English, తెలుగు & हिन्दी లో 24/7 సలహా',
          description:
            'లక్షణాలు, సాధారణ కారణాలు, సురక్షిత ఇంటి చిట్కాలు మరియు మందుల ఉపయోగాలపై మీ భాషలోనే స్పష్టమైన సమాధానాలను ఎప్పుడైనా పొందండి.',
          highlights: ['English · తెలుగు · हिन्दी', 'చేతిరాత Rx స్కానర్', 'అత్యవసర మార్గదర్శకత్వం'],
          ctaLabel: 'AI సహాయకుడిని తెరవండి',
        },
        {
          id: 'book-appointments',
          title: 'అపాయింట్‌మెంట్ బుకింగ్',
          shortDesc: 'ధృవీకృత వైద్యులు & లైవ్ వీడియో కాల్స్',
          description:
            'అడ్మిన్ ఆమోదించిన నిపుణులను ఎంచుకోండి, ఖాళీ సమయ స్లాట్లను బుక్ చేయండి మరియు వీడియో కన్సల్టేషన్ లేదా సమీప క్లినిక్ ద్వారా సంప్రదించండి.',
          highlights: ['ధృవీకృత నిపుణులు', 'సులభమైన స్లాట్ బుకింగ్', 'లైవ్ వీడియో కన్సల్టేషన్'],
          ctaLabel: 'అపాయింట్‌మెంట్ బుక్ చేయండి',
        },
        {
          id: 'trusted-care',
          title: 'నమ్మకమైన వైద్య సంరక్షణ',
          shortDesc: 'అలెర్జీ జాగ్రత్తలు & ధృవీకృత ఇ-Rx',
          description:
            'డాక్టర్ జారీ చేసిన PDF ఇ-ప్రిస్క్రిప్షన్లు, ఆటోమేటిక్ అలెర్జీ తనిఖీలు, స్పష్టమైన AI భద్రతా గమనికలు మరియు 108 / 112 అత్యవసర మార్గదర్శకత్వంతో సురక్షిత సంరక్షణ.',
          highlights: ['ధృవీకృత వైద్యులు', 'డౌన్‌లోడ్ PDF ఇ-Rx', 'గోప్యమైన ఆరోగ్య రికార్డులు'],
          ctaLabel: 'పోర్టల్స్ చూడండి',
        },
      ],
      howItWorksBadge: 'ఎలా పనిచేస్తుంది',
      howItWorksHeading: 'దశలవారీగా సులభమైన వైద్య సంరక్షణ',
      howItWorksSubtitle:
        'మీ మొదటి ఆరోగ్య ప్రశ్న నుండి ధృవీకృత డాక్టర్ సంప్రదింపు మరియు డిజిటల్ ఇ-ప్రిస్క్రిప్షన్ వరకు.',
      scrollRevealLines: [
        'ఎప్పుడైనా English, తెలుగు లేదా हिन्दी లో MedAssist తో మాట్లాడండి.',
        'లక్షణాలు, సంభావ్య కారణాలు మరియు సురక్షిత తదుపరి చర్యలను స్పష్టంగా తెలుసుకోండి.',
        'ముద్రిత లేదా చేతిరాత ప్రిస్క్రిప్షన్లను నమ్మకమైన సూచికలతో స్కాన్ చేయండి.',
        'వీడియో లేదా క్లినిక్ సంప్రదింపు కోసం క్షణాల్లో ధృవీకృత నిపుణులను బుక్ చేయండి.',
        'మీ భద్రతను దృష్టిలో ఉంచుకుని డాక్టర్ ఆమోదించిన డిజిటల్ ఇ-ప్రిస్క్రిప్షన్లు పొందండి.',
      ],
      emergencyNoteStrong:
        'మీ పరిస్థితి తీవ్రంగా ఉంటే, దయచేసి వెంటనే సమీప వైద్యుడిని సంప్రదించండి లేదా సమీప ఆసుపత్రికి వెళ్లండి. అత్యవసర పరిస్థితిలో 108 లేదా 112 కి కాల్ చేయండి.',
      portalsBadge: 'ప్రత్యేక పాత్ర పోర్టల్స్',
      portalsHeading: 'మీ లాగిన్ పోర్టల్‌ను ఎంచుకోండి',
      portalsSubtitle:
        'రోగులు, వైద్యులు మరియు అడ్మినిస్ట్రేటర్ల కోసం వేర్వేరు ధృవీకృత లాగిన్ పేజీలు.',
      patientCardTag: '01 · రోగి పోర్టల్',
      patientCardTitle: 'రోగి లాగిన్',
      patientCardDesc:
        'English, తెలుగు లేదా हिन्दी లో AI సంప్రదించండి, చేతిరాత ప్రిస్క్రిప్షన్లు స్కాన్ చేయండి, ధృవీకృత డాక్టర్లను బుక్ చేసి లైవ్ వీడియో కాల్స్‌లో చేరండి.',
      patientCardOpenBtn: 'రోగి లాగిన్ పేజీని తెరవండి',
      patientCardSignupBtn: 'కొత్త రోగి ఖాతాను సృష్టించండి',
      doctorCardTag: '02 · వైద్యుల పోర్టల్',
      doctorCardTitle: 'డాక్టర్ లాగిన్',
      doctorCardDesc:
        'రోగుల అపాయింట్‌మెంట్ అభ్యర్థనలను నిర్వహించండి, లైవ్ వీడియో కన్సల్టేషన్లు నిర్వహించండి మరియు అలెర్జీ-తనిఖీ చేసిన PDF ఇ-ప్రిస్క్రిప్షన్లు జారీ చేయండి.',
      doctorCardOpenBtn: 'డాక్టర్ లాగిన్ పేజీని తెరవండి',
      doctorCardSignupBtn: 'డాక్టర్‌గా నమోదు చేసుకోండి',
      adminCardTag: '03 · నిర్వహణ పోర్టల్',
      adminCardTitle: 'అడ్మిన్ లాగిన్',
      adminCardDesc:
        'డాక్టర్ నమోదులను ధృవీకరించి ఆమోదించండి, వినియోగదారుల యాక్సెస్‌ను పర్యవేక్షించండి మరియు టెలిమెడిసిన్ గణాంకాలను పరిశీలించండి.',
      adminCardOpenBtn: 'అడ్మిన్ లాగిన్ పేజీని తెరవండి',
      adminCardNotice: 'అధికృత అడ్మినిస్ట్రేటర్లకు మాత్రమే',
      demoHeading: 'తక్షణ డెమో లాగిన్ వివరాలు (3 రోగులు · 5 వైద్యులు · 1 అడ్మిన్)',
      demoSubtitle:
        '1-క్లిక్ సైన్-ఇన్ కోసం క్రింది ఏదైనా ఖాతాపై క్లిక్ చేయండి లేదా పైనున్న ప్రత్యేక లాగిన్ పేజీలను ఉపయోగించండి.',
      demoBadge: '1-క్లిక్ స్విచ్చర్',
      demoColName: 'ఖాతా పేరు',
      demoColRole: 'పాత్ర & స్థితి',
      demoColCreds: 'లాగిన్ వివరాలు',
      demoColAction: 'చర్య',
      demoLoginBtn: 'లాగిన్',
      servicesHeading: 'సమగ్ర క్లినికల్ AI & టెలిమెడిసిన్ సేవలు',
      services: [
        {
          title: 'AI ఆరోగ్య చాట్ (కారణాలు, ఇంటి చిట్కాలు & మాత్రల ఉపయోగాలు)',
          description:
            'English, తెలుగు లేదా हिन्दी భాషలలో సాధారణ కారణాలు, సురక్షిత ఇంటి చిట్కాలు మరియు మాత్రల ఉపయోగాలను లైవ్ స్ట్రీమింగ్‌తో స్పష్టంగా వివరిస్తుంది.',
        },
        {
          title: 'మల్టీమోడల్ ప్రిస్క్రిప్షన్ విజన్',
          description:
            'చేతిరాత లేదా ముద్రిత మందులను High/Medium/Low విశ్వాస సూచికలతో చదువుతుంది మరియు స్పష్టంగా లేని పదాలను ఎరుపు రంగులో గుర్తిస్తుంది.',
        },
        {
          title: 'అత్యవసర మార్గదర్శకత్వం (108 / 112)',
          description:
            'ప్రతి సమాధానం చివర సురక్షిత ఆసుపత్రి గమనికను చూపిస్తుంది మరియు ప్రాణాపాయ లక్షణాలు ఉన్నప్పుడు మాత్రమే అత్యవసర హెచ్చరికను ఇస్తుంది.',
        },
        {
          title: 'పూర్తి టెలిమెడిసిన్ వర్క్‌ఫ్లో',
          description:
            'లక్షణాల తనిఖీ, అపాయింట్‌మెంట్ బుకింగ్, WebRTC వీడియో కన్సల్టేషన్ రూమ్ మరియు డౌన్‌లోడ్ చేసుకోదగిన PDF ఇ-ప్రిస్క్రిప్షన్లు అన్నీ ఒకే చోట.',
        },
      ],
      footerHighlightStrip: 'AI ఆరోగ్య సహాయకుడు · అపాయింట్‌మెంట్ బుకింగ్ · నమ్మకమైన వైద్య సంరక్షణ',
    },
    roleLogin: {
      homeBtn: 'హోమ్',
      selectPortalLabel: 'లాగిన్ పోర్టల్‌ను ఎంచుకోండి',
      portalPrefix: 'పోర్టల్',
      stepPrefix: 'దశ',
      accountSingular: 'ఖాతా',
      accountPlural: 'ఖాతాలు',
      signInBtn: 'సైన్ ఇన్',
      signingInLabel: 'సైన్ ఇన్ అవుతోంది...',
      creatingAccountLabel: 'ఖాతా సృష్టించబడుతోంది...',
      patientSignInTab: 'రోగి సైన్ ఇన్',
      patientSignupTab: 'కొత్త రోగి నమోదు',
      doctorSignInTab: 'డాక్టర్ సైన్ ఇన్',
      doctorSignupTab: 'డాక్టర్ నమోదు',
      adminRestrictedBanner:
        'పరిమిత అడ్మినిస్ట్రేటర్ సైన్-ఇన్ (అంతర్గత వివరాలు అవసరం)',
      passwordLabel: 'పాస్‌వర్డ్',
      fullNameLabel: 'పూర్తి పేరు',
      phoneLabel: 'ఫోన్ నంబర్',
      emailAddressLabel: 'ఇమెయిల్ చిరునామా',
      passwordPlaceholder: 'బలమైన పాస్‌వర్డ్‌ను సృష్టించండి',
      ageLabel: 'వయస్సు',
      genderLabel: 'లింగం',
      genderFemale: 'స్త్రీ',
      genderMale: 'పురుషుడు',
      genderOther: 'ఇతర',
      bloodGroupLabel: 'రక్త గ్రూప్',
      specialtyLabel: 'స్పెషాలిటీ',
      medRegNoLabel: 'మెడికల్ రిజిస్ట్రేషన్ నంబర్',
      qualificationLabel: 'అర్హత',
      experienceLabel: 'అనుభవం (సంవత్సరాలు)',
      consultFeeLabel: 'కన్సల్టేషన్ ఫీజు (₹)',
      doctorVerifyPolicyLabel: 'ధృవీకరణ విధానం:',
      doctorVerifyPolicyText:
        'కొత్త డాక్టర్ ఖాతాలు రోగుల బుకింగ్ డైరెక్టరీలో కనిపించడానికి ముందు అడ్మినిస్ట్రేటర్ ఆమోదం అవసరం.',
      registerPatientBtn: 'రోగి ఖాతాను నమోదు చేయండి',
      registerDoctorBtn: 'డాక్టర్ ఖాతాను నమోదు చేయండి',
      otherPortalsLabel: 'ఇతర పోర్టల్స్:',
      nextPrefix: 'తదుపరి:',
      goToPrefix: 'వెళ్ళండి:',
      mismatchError: (roleDisplay: string) =>
        `ఈ ఖాతా ${roleDisplay} పోర్టల్‌కు చెందినది. దయచేసి ${roleDisplay} లాగిన్ పేజీ ద్వారా సైన్ ఇన్ చేయండి.`,
      roleDisplayNames: {
        patient: 'రోగి',
        doctor: 'డాక్టర్',
        admin: 'అడ్మిన్',
      },
      agreePrefix: 'కొనసాగించడం ద్వారా, మీరు మా',
      agreeAnd: 'మరియు',
      footerCaption: 'MedAssist · ప్రత్యేక రోగి, డాక్టర్ & అడ్మినిస్ట్రేటర్ పోర్టల్స్',
      roles: {
        patient: {
          tabLabel: 'రోగి లాగిన్',
          badge: 'రోగి సంరక్షణ పోర్టల్',
          title: 'రోగి సైన్ ఇన్',
          subtitle:
            'మీ బహుభాషా AI ఆరోగ్య చాట్, ప్రిస్క్రిప్షన్ స్కానర్, డాక్టర్ బుకింగ్స్, లైవ్ వీడియో కన్సల్టేషన్లు మరియు PDF ఇ-ప్రిస్క్రిప్షన్లను యాక్సెస్ చేయండి.',
          signupTitle: 'రోగి ఖాతాను సృష్టించండి',
          signupSubtitle:
            'AI ఆరోగ్య సలహా మరియు ధృవీకృత నిపుణుల సంప్రదింపుల కోసం క్షణాల్లో నమోదు చేసుకోండి.',
          bannerCaption: 'వ్యక్తిగత ఆరోగ్య సహాయకుడు & టెలిమెడిసిన్',
          capabilitiesHeading: 'మీ రోగి పోర్టల్‌లో ఉన్న సేవలు',
          highlights: [
            'English, తెలుగు లేదా हिन्दी లో తక్షణ లక్షణాల తనిఖీతో AI సంప్రదించండి',
            'చేతిరాత లేదా ముద్రిత ప్రిస్క్రిప్షన్లను నమ్మక సూచికలతో స్కాన్ చేయండి',
            'ధృవీకృత నిపుణులను బుక్ చేసి సురక్షిత లైవ్ వీడియో కాల్స్‌లో చేరండి',
            'డాక్టర్ సంతకం చేసిన PDF ఇ-ప్రిస్క్రిప్షన్లను డౌన్‌లోడ్ చేసి వైటల్స్ ట్రాక్ చేయండి',
          ],
          securityNote:
            'మీ ఆరోగ్య చరిత్ర మరియు ప్రిస్క్రిప్షన్లు పూర్తిగా గోప్యంగా ఉంటాయి మరియు మీరు బుక్ చేసిన వైద్యులకు మాత్రమే కనిపిస్తాయి.',
          demoHeading: 'రోగి డెమో ఖాతాలు',
          demoSubtitle: 'తక్షణ 1-క్లిక్ సైన్-ఇన్ కోసం క్రింది ధృవీకృత రోగి ఖాతాపై క్లిక్ చేయండి.',
          emailLabel: 'రోగి ఇమెయిల్ చిరునామా',
          submitLoginLabel: 'రోగి పోర్టల్‌లో సైన్ ఇన్ చేయండి',
          nextLabel: 'డాక్టర్ లాగిన్',
        },
        doctor: {
          tabLabel: 'డాక్టర్ లాగిన్',
          badge: 'ధృవీకృత వైద్యుల పోర్టల్',
          title: 'డాక్టర్ సైన్ ఇన్',
          subtitle:
            'రోగుల అపాయింట్‌మెంట్ అభ్యర్థనలను సమీక్షించండి, లైవ్ WebRTC వీడియో కన్సల్టేషన్లు నిర్వహించండి మరియు డిజిటల్ ఇ-ప్రిస్క్రిప్షన్లు జారీ చేయండి.',
          signupTitle: 'డాక్టర్‌గా నమోదు చేసుకోండి',
          signupSubtitle:
            'రోగుల బుకింగ్ డైరెక్టరీలో కనిపించడానికి ముందు అడ్మినిస్ట్రేటర్ ధృవీకరణ కోసం మీ వైద్య వివరాలను సమర్పించండి.',
          bannerCaption: 'వైద్యుల టెలిమెడిసిన్ & ఇ-Rx వర్క్‌స్పేస్',
          capabilitiesHeading: 'మీ వైద్యుల వర్క్‌స్పేస్‌లో ఉన్న సేవలు',
          highlights: [
            'రోగుల అపాయింట్‌మెంట్ అభ్యర్థనలను ఆమోదించండి, రీషెడ్యూల్ చేయండి లేదా తిరస్కరించండి',
            'సంప్రదింపు ముందు AI లక్షణాల తనిఖీ, అలెర్జీలు మరియు వైటల్స్ పరిశీలించండి',
            'తక్షణ రూమ్ సింక్‌తో రియల్-టైమ్ HD వీడియో కన్సల్టేషన్లు నిర్వహించండి',
            'అలెర్జీ జాగ్రత్తలతో సంతకం చేసిన PDF ఇ-ప్రిస్క్రిప్షన్లను రూపొందించండి',
          ],
          securityNote:
            'వైద్యుల యాక్సెస్ కేటాయించిన రోగులకు మాత్రమే పరిమితం. కొత్త డాక్టర్ నమోదులకు అడ్మిన్ ఆమోదం అవసరం.',
          demoHeading: 'డాక్టర్ డెమో ఖాతాలు',
          demoSubtitle: 'తక్షణ 1-క్లిక్ సైన్-ఇన్ కోసం క్రింది ధృవీకృత డాక్టర్ ఖాతాపై క్లిక్ చేయండి.',
          emailLabel: 'డాక్టర్ ఇమెయిల్ చిరునామా',
          submitLoginLabel: 'డాక్టర్ వర్క్‌స్పేస్‌లో సైన్ ఇన్ చేయండి',
          prevLabel: 'రోగి లాగిన్',
          nextLabel: 'అడ్మిన్ లాగిన్',
        },
        admin: {
          tabLabel: 'అడ్మిన్ లాగిన్',
          badge: 'పరిమిత నిర్వహణ పోర్టల్',
          title: 'అడ్మినిస్ట్రేటర్ సైన్ ఇన్',
          subtitle:
            'డాక్టర్ నమోదులను ధృవీకరించి ఆమోదించండి, ప్లాట్‌ఫారమ్ వినియోగదారు ఖాతాలను నిర్వహించండి మరియు టెలిమెడిసిన్ గణాంకాలను పర్యవేక్షించండి.',
          signupTitle: 'అడ్మినిస్ట్రేటర్ సైన్ ఇన్',
          signupSubtitle:
            'అడ్మినిస్ట్రేటర్ ఖాతాలు అంతర్గతంగా మాత్రమే కేటాయించబడతాయి మరియు స్వయంగా నమోదు చేసుకోలేరు.',
          bannerCaption: 'క్లినికల్ ధృవీకరణ & ప్లాట్‌ఫారమ్ నిర్వహణ',
          capabilitiesHeading: 'అడ్మినిస్ట్రేటర్ నిర్వహణ సామర్థ్యాలు',
          highlights: [
            'సమర్పించిన మెడికల్ రిజిస్ట్రేషన్ నంబర్లను సమీక్షించి డాక్టర్లను ఆమోదించండి',
            'ప్లాట్‌ఫారమ్ అంతటా రోగి మరియు డాక్టర్ ఖాతాలను ఆడిట్ చేసి నిర్వహించండి',
            'కన్సల్టేషన్లు, ఇ-ప్రిస్క్రిప్షన్లు మరియు AI వినియోగాన్ని పర్యవేక్షించండి',
            'కఠినమైన పాత్ర-ఆధారిత భద్రత మరియు క్లినికల్ నిబంధనలను అమలు చేయండి',
          ],
          securityNote:
            'అధికృత సిబ్బందికి మాత్రమే. క్లినికల్ భద్రత కోసం అడ్మినిస్ట్రేటర్ ఖాతాలకు పబ్లిక్ రిజిస్ట్రేషన్ నిలిపివేయబడింది.',
          demoHeading: 'అడ్మినిస్ట్రేటర్ డెమో ఖాతా',
          demoSubtitle: 'తక్షణ 1-క్లిక్ సైన్-ఇన్ కోసం క్రింది ధృవీకృత అడ్మిన్ ఖాతాపై క్లిక్ చేయండి.',
          emailLabel: 'అడ్మినిస్ట్రేటర్ ఇమెయిల్ చిరునామా',
          submitLoginLabel: 'అడ్మిన్ ప్యానెల్‌లో సైన్ ఇన్ చేయండి',
          prevLabel: 'డాక్టర్ లాగిన్',
        },
      },
    },
  },
  Hindi: {
    appTitle: 'MedAssist · वर्चुअल हेल्थकेयर असिस्टेंट',
    sidebarBrand: 'MedAssist',
    portalLabel: 'रोगी पोर्टल',
    doctorPortalLabel: 'डॉक्टर पोर्टल · सक्रिय',
    adminPortalLabel: 'एडमिन पोर्टल',
    approvedStatus: 'स्वीकृत',
    pendingApprovalStatus: 'स्वीकृति लंबित',
    privacyNotice: 'आपका स्वास्थ्य डेटा गोपनीय है और इसका उपयोग केवल यह सेवा प्रदान करने के लिए किया जाता है।',
    aiDisclaimer: 'यह उत्तर AI द्वारा जनरेट किया गया है और इसमें गलतियाँ हो सकती हैं। कृपया किसी योग्य डॉक्टर से अवश्य जाँच कराएं।',
    persistentDisclaimer: 'अस्वीकरण: AI मार्गदर्शन केवल सूचनात्मक सहायता के लिए है और यह पेशेवर चिकित्सा सलाह का स्थान नहीं लेता है।',
    bookAppointmentPrompt: 'क्या आप डॉक्टर से अपॉइंटमेंट बुक करना चाहेंगे?',
    bookAppointmentBtn: 'अपॉइंटमेंट बुक करें',
    prescriptionWarning: 'AI लिखावट को पढ़ने में गलती कर सकता है। कोई भी दवा लेने से पहले हमेशा अपने डॉक्टर या फार्मासिस्ट से दवा के नाम और खुराक की पुष्टि करें।',
    emergencyBannerTitle: 'आपातकालीन चिकित्सा चेतावनी — तुरंत 108 या 112 पर कॉल करें',
    emergencyBannerText: 'गंभीर आपातकालीन लक्षण (जैसे सीने में दर्द, सांस लेने में तकलीफ, स्ट्रोक के लक्षण या गंभीर रक्तस्राव) पहचाने गए हैं। घरेलू उपाय न आज़माएं — तुरंत 108 (एम्बुलेंस) या 112 पर कॉल करें या नजदीकी अस्पताल के आपातकालीन कक्ष में जाएं।',
    emergencyHelplineBar: 'आपातकालीन हेल्पलाइन: 108 (एम्बुलेंस) · 112',
    welcomeBadge: 'स्वागत है',
    heroTitlePatient: 'AI मार्गदर्शन और विशेषज्ञ देखभाल के लिए आपका स्मार्ट डिजिटल क्लिनिक',
    heroSubtitlePatient: 'तुरंत AI-सहायता प्राप्त लक्षण जांच पाएं, हस्तलिखित प्रिस्क्रिप्शन सत्यापित करें और प्रमाणित विशेषज्ञों से ऑनलाइन परामर्श लें।',
    heroTitleDoctor: 'क्लिनिकल टेलीमेडिसिन कार्यक्षेत्र',
    heroBtnBookAppointment: 'अपॉइंटमेंट बुक करें',
    heroBtnOpenChat: 'AI स्वास्थ्य चैट खोलें',
    heroBtnScanRx: 'प्रिस्क्रिप्शन स्कैन करें',
    heroBtnManageAppointments: 'अपॉइंटमेंट प्रबंधित करें',
    heroBtnWriteERx: 'ई-प्रिस्क्रिप्शन लिखें',
    upcomingReminderTitle: 'आगामी पुष्टि किया गया वीडियो परामर्श रिमाइंडर',
    todayLabel: 'आज',
    joinCallNowBtn: 'अभी कॉल से जुड़ें',
    remindersBtn: 'रिमाइंडर',
    remindersDrawerTitle: 'अपॉइंटमेंट रिमाइंडर और अलर्ट',
    closeBtn: 'बंद करें',
    signOutBtn: 'साइन आउट / भूमिका बदलें',
    switchToDoctorViewBtn: 'डॉक्टर पोर्टल पर स्विच करें',
    switchToPatientViewBtn: 'रोगी पोर्टल पर स्विच करें',
    privacyPolicy: 'गोपनीयता नीति',
    termsConditions: 'नियम एवं शर्तें',
    nav: {
      dashboard: 'अवलोकन',
      aiChat: 'AI स्वास्थ्य चैट',
      prescriptionScanner: 'प्रिस्क्रिप्शन विश्लेषण',
      symptomChecker: 'लक्षण जांचकर्ता',
      appointments: 'अपॉइंटमेंट्स',
      eprescriptions: 'ई-प्रिस्क्रिप्शन',
      vitalsTracker: 'वाइटल्स और दवा ट्रैकर',
      historyTimeline: 'स्वास्थ्य टाइमलाइन',
      videoConsult: 'वीडियो परामर्श',
      adminUsers: 'उपयोगकर्ता प्रबंधन',
      adminApprovals: 'डॉक्टर स्वीकृति',
      adminAnalytics: 'एनालिटिक्स चार्ट',
    },
    chatPlaceholder: 'लक्षण, घरेलू उपाय या टैबलेट के उपयोग के बारे में पूछें...',
    sampleQuestions: [
      'हल्के बुखार और खांसी के कारण, घरेलू उपाय (Home Remedies) और सामान्य टैबलेट के उपयोग क्या हैं?',
      'पैरासिटामोल (Paracetamol) और सेटिरिज़िन (Cetirizine) टैबलेट किस काम आती हैं?',
      'एसिडिटी और अपच के लिए घरेलू उपाय और सामान्य टैबलेट का उपयोग बताएं।',
      'माइग्रेन सिरदर्द के मुख्य कारण और घरेलू देखभाल के उपाय क्या हैं?',
    ],
    loader: {
      brandSubtitle: 'MedAssist क्लिनिकल पोर्टल',
      preparingMessage: 'आपका स्वास्थ्य अनुभव तैयार किया जा रहा है...',
      verifyingSession: 'आपके सुरक्षित क्लिनिकल सत्र की पुष्टि हो रही है',
      errorTitle: 'सत्र की पुष्टि नहीं हो सकी',
      retryBtn: 'पुनः प्रयास करें',
      continueToLoginBtn: 'साइन इन पर जाएं',
    },
    landing: {
      brandSubtitle: 'वर्चुअल हेल्थकेयर असिस्टेंट',
      navFeatures: 'विशेषताएँ',
      navHowItWorks: 'यह कैसे काम करता है',
      navLoginPortals: 'लॉगिन पोर्टल',
      navDemoAccess: 'डेमो एक्सेस',
      headerPatientLogin: 'रोगी लॉगिन',
      headerLoginShort: 'लॉगिन',
      headerDoctor: 'डॉक्टर',
      headerAdmin: 'एडमिन',
      heroTagline: 'आपका स्वास्थ्य महत्वपूर्ण है। जब भी आपको ज़रूरत हो, हम हमेशा साथ हैं।',
      heroSubtitle:
        'English, తెలుగు और हिन्दी में तुरंत स्वास्थ्य मार्गदर्शन पाएं, सत्यापित विशेषज्ञों से अपॉइंटमेंट बुक करें और एक ही सुरक्षित मंच पर डॉक्टर-अनुमोदित देखभाल प्राप्त करें।',
      ctaPatientLogin: 'रोगी लॉगिन',
      ctaDoctorLogin: 'डॉक्टर लॉगिन',
      ctaAdminLogin: 'एडमिन लॉगिन',
      readinessVerified: 'एडमिन-सत्यापित डॉक्टर',
      readinessAlwaysOn: '24/7 स्वास्थ्य सहायता',
      previewHeaderTitle: 'MedAssist · AI स्वास्थ्य सहायक',
      previewBadge: 'हिन्दी · 24/7 देखभाल',
      previewLiveTag: 'लाइव प्रीव्यू',
      previewYouLabel: 'आप',
      previewAiLabel: 'AI स्वास्थ्य सहायक',
      previewUserQuestion:
        'कल से गले में खराश और हल्का बुखार है। मुझे क्या करना चाहिए?',
      previewAiLead: 'यह सामान्यतः ',
      previewAiHighlight: 'हल्के वायरल संक्रमण',
      previewAiBody:
        ' के कारण हो सकता है। गुनगुना पानी पिएं, नमक के पानी से गरारे करें और पर्याप्त आराम करें। यदि बुखार 48 घंटे से अधिक रहे तो डॉक्टर से सलाह लें।',
      previewFollowUp: 'क्या आप सत्यापित डॉक्टर से परामर्श लेना चाहते हैं?',
      previewBookCta: 'अपॉइंटमेंट बुक करें',
      featuresSectionBadge: 'देखभाल के हर कदम के लिए',
      featuresSectionHeading: 'MedAssist के साथ आपकी हर स्वास्थ्य ज़रूरत',
      featuresSectionSubtitle:
        'तुरंत AI लक्षण मार्गदर्शन से लेकर सत्यापित डॉक्टर परामर्श और सुरक्षित प्रिस्क्रिप्शन तक।',
      getStartedFreeBtn: 'निःशुल्क शुरू करें',
      features: [
        {
          id: 'ai-assistant',
          title: 'AI स्वास्थ्य सहायक',
          shortDesc: 'English, తెలుగు और हिन्दी में 24/7 मार्गदर्शन',
          description:
            'लक्षणों, संभावित कारणों, सुरक्षित घरेलू उपायों और दवाओं के उपयोग के बारे में अपनी भाषा में तुरंत और स्पष्ट जानकारी प्राप्त करें।',
          highlights: ['English · తెలుగు · हिन्दी', 'हस्तलिखित Rx स्कैनर', 'शांत आपातकालीन सलाह'],
          ctaLabel: 'AI सहायक खोलें',
        },
        {
          id: 'book-appointments',
          title: 'अपॉइंटमेंट बुक करें',
          shortDesc: 'सत्यापित डॉक्टर और लाइव वीडियो परामर्श',
          description:
            'एडमिन-स्वीकृत विशेषज्ञों को चुनें, खाली समय स्लॉट बुक करें और बिल्ट-इन वीडियो कॉल या नजदीकी क्लिनिक के माध्यम से परामर्श लें।',
          highlights: ['सत्यापित विशेषज्ञ', 'सुविधाजनक समय स्लॉट', 'लाइव वीडियो परामर्श'],
          ctaLabel: 'विज़िट शेड्यूल करें',
        },
        {
          id: 'trusted-care',
          title: 'भरोसेमंद देखभाल',
          shortDesc: 'एलर्जी सुरक्षा और सत्यापित ई-Rx',
          description:
            'डॉक्टर द्वारा जारी PDF ई-प्रिस्क्रिप्शन, स्वचालित एलर्जी जांच, पारदर्शी AI सुरक्षा अस्वीकरण और स्पष्ट 108 / 112 आपातकालीन मार्गदर्शन।',
          highlights: ['सत्यापित चिकित्सक', 'डाउनलोड योग्य PDF ई-Rx', 'गोपनीय स्वास्थ्य रिकॉर्ड'],
          ctaLabel: 'केयर पोर्टल देखें',
        },
      ],
      howItWorksBadge: 'यह कैसे काम करता है',
      howItWorksHeading: 'सरल और सुरक्षित देखभाल, कदम दर कदम',
      howItWorksSubtitle:
        'आपके पहले स्वास्थ्य सवाल से लेकर सत्यापित डॉक्टर परामर्श और डिजिटल ई-प्रिस्क्रिप्शन तक।',
      scrollRevealLines: [
        'कभी भी English, తెలుగు या हिन्दी में MedAssist से बात करें।',
        'लक्षणों, संभावित कारणों और सुरक्षित अगले कदमों को स्पष्ट रूप से समझें।',
        'मुद्रित या हस्तलिखित प्रिस्क्रिप्शन को स्पष्ट विश्वास संकेतों के साथ स्कैन करें।',
        'लाइव वीडियो या क्लिनिक विज़िट के लिए सेकंडों में सत्यापित डॉक्टर बुक करें।',
        'अपनी सुरक्षा के अनुसार डॉक्टर-स्वीकृत डिजिटल ई-प्रिस्क्रिप्शन प्राप्त करें।',
      ],
      emergencyNoteStrong:
        'यदि आपकी स्थिति गंभीर है, तो कृपया तुरंत नजदीकी डॉक्टर से परामर्श लें या नजदीकी अस्पताल जाएं। आपातकाल में 108 या 112 पर कॉल करें।',
      portalsBadge: 'समर्पित भूमिका पोर्टल',
      portalsHeading: 'अपना लॉगिन पोर्टल चुनें',
      portalsSubtitle:
        'रोगियों, डॉक्टरों और एडमिनिस्ट्रेटर के लिए अलग-अलग भूमिका-सत्यापित लॉगिन पेज।',
      patientCardTag: '01 · रोगी पोर्टल',
      patientCardTitle: 'रोगी लॉगिन',
      patientCardDesc:
        'English, తెలుగు या हिन्दी में AI से सलाह लें, हस्तलिखित प्रिस्क्रिप्शन स्कैन करें, सत्यापित डॉक्टर बुक करें और लाइव वीडियो कॉल में जुड़ें।',
      patientCardOpenBtn: 'रोगी लॉगिन पेज खोलें',
      patientCardSignupBtn: 'नया रोगी खाता बनाएं',
      doctorCardTag: '02 · चिकित्सक पोर्टल',
      doctorCardTitle: 'डॉक्टर लॉगिन',
      doctorCardDesc:
        'रोगी अपॉइंटमेंट अनुरोध प्रबंधित करें, लाइव वीडियो परामर्श लें और एलर्जी-जांच किए गए डिजिटल PDF ई-प्रिस्क्रिप्शन जारी करें।',
      doctorCardOpenBtn: 'डॉक्टर लॉगिन पेज खोलें',
      doctorCardSignupBtn: 'डॉक्टर के रूप में पंजीकरण करें',
      adminCardTag: '03 · प्रशासन पोर्टल',
      adminCardTitle: 'एडमिन लॉगिन',
      adminCardDesc:
        'डॉक्टर पंजीकरण सत्यापित और स्वीकृत करें, उपयोगकर्ता नियंत्रण प्रबंधित करें और क्लिनिकल टेलीमेडिसिन एनालिटिक्स देखें।',
      adminCardOpenBtn: 'एडमिन लॉगिन पेज खोलें',
      adminCardNotice: 'केवल अधिकृत एडमिनिस्ट्रेटर के लिए',
      demoHeading: 'तुरंत डेमो लॉगिन विवरण (3 रोगी · 5 डॉक्टर · 1 एडमिन)',
      demoSubtitle:
        '1-क्लिक साइन-इन के लिए नीचे किसी भी खाते पर क्लिक करें, या ऊपर दिए गए समर्पित लॉगिन पेज का उपयोग करें।',
      demoBadge: '1-क्लिक स्विचर',
      demoColName: 'खाता नाम',
      demoColRole: 'भूमिका और स्थिति',
      demoColCreds: 'लॉगिन विवरण',
      demoColAction: 'कार्रवाई',
      demoLoginBtn: 'लॉगिन',
      servicesHeading: 'एकीकृत क्लिनिकल AI और टेलीमेडिसिन सेवाएँ',
      services: [
        {
          title: 'AI स्वास्थ्य चैट (कारण, घरेलू उपाय और टैबलेट के उपयोग)',
          description:
            'लाइव स्ट्रीमिंग के साथ सरल English, తెలుగు या हिन्दी में सामान्य कारण, सुरक्षित घरेलू उपाय और दवाओं के उपयोग समझाता है।',
        },
        {
          title: 'मल्टीमॉडल प्रिस्क्रिप्शन विज़न',
          description:
            'हस्तलिखित या मुद्रित दवाओं को High/Medium/Low विश्वास संकेतों के साथ पढ़ता है और अस्पष्ट शब्दों को लाल रंग में चिह्नित करता है।',
        },
        {
          title: 'शांत आपातकालीन मार्गदर्शन (108 / 112)',
          description:
            'हर उत्तर के अंत में शांत अस्पताल/आपातकालीन नोट देता है और केवल जीवन-घातक लक्षणों पर ही लाल चेतावनी दिखाता है।',
        },
        {
          title: 'संपूर्ण टेलीमेडिसिन वर्कफ़्लो',
          description:
            'लक्षण जांचकर्ता, अपॉइंटमेंट बुकिंग, WebRTC वीडियो परामर्श कक्ष और डाउनलोड करने योग्य PDF ई-प्रिस्क्रिप्शन शामिल हैं।',
        },
      ],
      footerHighlightStrip: 'AI स्वास्थ्य सहायक · अपॉइंटमेंट बुक करें · भरोसेमंद देखभाल',
    },
    roleLogin: {
      homeBtn: 'होम',
      selectPortalLabel: 'लॉगिन पोर्टल चुनें',
      portalPrefix: 'पोर्टल',
      stepPrefix: 'चरण',
      accountSingular: 'खाता',
      accountPlural: 'खाते',
      signInBtn: 'साइन इन',
      signingInLabel: 'साइन इन हो रहा है...',
      creatingAccountLabel: 'खाता बनाया जा रहा है...',
      patientSignInTab: 'रोगी साइन इन',
      patientSignupTab: 'नया रोगी पंजीकरण',
      doctorSignInTab: 'डॉक्टर साइन इन',
      doctorSignupTab: 'डॉक्टर पंजीकरण',
      adminRestrictedBanner:
        'प्रतिबंधित एडमिनिस्ट्रेटर साइन-इन (आंतरिक विवरण आवश्यक)',
      passwordLabel: 'पासवर्ड',
      fullNameLabel: 'पूरा नाम',
      phoneLabel: 'फ़ोन नंबर',
      emailAddressLabel: 'ईमेल पता',
      passwordPlaceholder: 'एक मजबूत पासवर्ड बनाएं',
      ageLabel: 'आयु',
      genderLabel: 'लिंग',
      genderFemale: 'महिला',
      genderMale: 'पुरुष',
      genderOther: 'अन्य',
      bloodGroupLabel: 'रक्त समूह',
      specialtyLabel: 'विशेषज्ञता',
      medRegNoLabel: 'मेडिकल पंजीकरण संख्या',
      qualificationLabel: 'योग्यता',
      experienceLabel: 'अनुभव (वर्ष)',
      consultFeeLabel: 'परामर्श शुल्क (₹)',
      doctorVerifyPolicyLabel: 'सत्यापन नीति:',
      doctorVerifyPolicyText:
        'नए डॉक्टर खातों को रोगी बुकिंग डायरेक्टरी में दिखने से पहले एडमिनिस्ट्रेटर की स्वीकृति आवश्यक है।',
      registerPatientBtn: 'रोगी खाता पंजीकृत करें',
      registerDoctorBtn: 'डॉक्टर खाता पंजीकृत करें',
      otherPortalsLabel: 'अन्य पोर्टल:',
      nextPrefix: 'अगला:',
      goToPrefix: 'जाएं:',
      mismatchError: (roleDisplay: string) =>
        `यह खाता ${roleDisplay} पोर्टल से संबंधित है। कृपया ${roleDisplay} लॉगिन पेज के माध्यम से साइन इन करें।`,
      roleDisplayNames: {
        patient: 'रोगी',
        doctor: 'डॉक्टर',
        admin: 'एडमिन',
      },
      agreePrefix: 'आगे बढ़कर, आप हमारी',
      agreeAnd: 'और',
      footerCaption: 'MedAssist · समर्पित रोगी, डॉक्टर और एडमिनिस्ट्रेटर पोर्टल',
      roles: {
        patient: {
          tabLabel: 'रोगी लॉगिन',
          badge: 'रोगी देखभाल पोर्टल',
          title: 'रोगी साइन इन',
          subtitle:
            'अपने बहुभाषी AI स्वास्थ्य चैट, प्रिस्क्रिप्शन स्कैनर, डॉक्टर बुकिंग, लाइव वीडियो परामर्श और PDF ई-प्रिस्क्रिप्शन तक पहुंचें।',
          signupTitle: 'रोगी खाता बनाएं',
          signupSubtitle:
            'AI स्वास्थ्य मार्गदर्शन और सत्यापित विशेषज्ञ परामर्श के लिए सेकंडों में पंजीकरण करें।',
          bannerCaption: 'व्यक्तिगत स्वास्थ्य सहायक और टेलीमेडिसिन',
          capabilitiesHeading: 'आपके रोगी पोर्टल में शामिल सेवाएँ',
          highlights: [
            'तुरंत लक्षण जांच के साथ English, తెలుగు या हिन्दी में AI परामर्श लें',
            'विश्वास संकेतों के साथ हस्तलिखित या मुद्रित प्रिस्क्रिप्शन स्कैन करें',
            'सत्यापित विशेषज्ञ बुक करें और सुरक्षित लाइव वीडियो परामर्श में जुड़ें',
            'डॉक्टर-हस्ताक्षरित PDF ई-प्रिस्क्रिप्शन डाउनलोड करें और वाइटल्स ट्रैक करें',
          ],
          securityNote:
            'आपका स्वास्थ्य इतिहास और प्रिस्क्रिप्शन पूरी तरह गोपनीय हैं और केवल आपको तथा आपके चुने हुए डॉक्टरों को दिखाई देते हैं।',
          demoHeading: 'रोगी डेमो खाते',
          demoSubtitle: 'तुरंत 1-क्लिक साइन-इन के लिए नीचे किसी भी सत्यापित रोगी खाते पर क्लिक करें।',
          emailLabel: 'रोगी ईमेल पता',
          submitLoginLabel: 'रोगी पोर्टल में साइन इन करें',
          nextLabel: 'डॉक्टर लॉगिन',
        },
        doctor: {
          tabLabel: 'डॉक्टर लॉगिन',
          badge: 'सत्यापित चिकित्सक पोर्टल',
          title: 'डॉक्टर साइन इन',
          subtitle:
            'रोगी बुकिंग अनुरोधों की समीक्षा करें, लाइव WebRTC वीडियो परामर्श लें और एलर्जी-जांच किए गए डिजिटल ई-प्रिस्क्रिप्शन जारी करें।',
          signupTitle: 'डॉक्टर के रूप में पंजीकरण करें',
          signupSubtitle:
            'रोगी बुकिंग डायरेक्टरी में शामिल होने से पहले एडमिनिस्ट्रेटर सत्यापन के लिए अपने मेडिकल प्रमाणपत्र सबमिट करें।',
          bannerCaption: 'चिकित्सक टेलीमेडिसिन और ई-Rx कार्यक्षेत्र',
          capabilitiesHeading: 'आपके चिकित्सक कार्यक्षेत्र में शामिल सेवाएँ',
          highlights: [
            'आने वाले रोगी अपॉइंटमेंट अनुरोधों को स्वीकार, पुनर्निर्धारित या अस्वीकार करें',
            'परामर्श से पहले AI लक्षण जांच, एलर्जी और वाइटल्स की समीक्षा करें',
            'तुरंत रूम सिंक के साथ रीयल-टाइम HD वीडियो परामर्श आयोजित करें',
            'एलर्जी सुरक्षा के साथ हस्ताक्षरित PDF ई-प्रिस्क्रिप्शन तैयार करें',
          ],
          securityNote:
            'चिकित्सक पहुंच केवल आवंटित रोगियों तक सीमित है। नए डॉक्टर पंजीकरण के लिए एडमिन स्वीकृति आवश्यक है।',
          demoHeading: 'डॉक्टर डेमो खाते',
          demoSubtitle: 'तुरंत 1-क्लिक साइन-इन के लिए नीचे किसी भी सत्यापित डॉक्टर खाते पर क्लिक करें।',
          emailLabel: 'डॉक्टर ईमेल पता',
          submitLoginLabel: 'डॉक्टर कार्यक्षेत्र में साइन इन करें',
          prevLabel: 'रोगी लॉगिन',
          nextLabel: 'एडमिन लॉगिन',
        },
        admin: {
          tabLabel: 'एडमिन लॉगिन',
          badge: 'प्रतिबंधित प्रशासन पोर्टल',
          title: 'एडमिनिस्ट्रेटर साइन इन',
          subtitle:
            'डॉक्टर पंजीकरण सत्यापित और स्वीकृत करें, प्लेटफ़ॉर्म उपयोगकर्ता खातों का प्रबंधन करें और टेलीमेडिसिन एनालिटिक्स की निगरानी करें।',
          signupTitle: 'एडमिनिस्ट्रेटर साइन इन',
          signupSubtitle:
            'एडमिनिस्ट्रेटर खाते आंतरिक रूप से प्रदान किए जाते हैं और स्वयं पंजीकृत नहीं किए जा सकते।',
          bannerCaption: 'क्लिनिकल सत्यापन और प्लेटफ़ॉर्म शासन',
          capabilitiesHeading: 'एडमिनिस्ट्रेटर शासन क्षमताएँ',
          highlights: [
            'सबमिट की गई मेडिकल पंजीकरण संख्या की समीक्षा करें और डॉक्टरों को स्वीकृति दें',
            'प्लेटफ़ॉर्म पर रोगी और डॉक्टर खातों का ऑडिट और प्रबंधन करें',
            'प्लेटफ़ॉर्म-व्यापी परामर्श, ई-प्रिस्क्रिप्शन और AI उपयोग की निगरानी करें',
            'सख्त भूमिका-आधारित सुरक्षा और क्लिनिकल अनुपालन नीतियां लागू करें',
          ],
          securityNote:
            'केवल अधिकृत कर्मियों के लिए। क्लिनिकल शासन की सुरक्षा के लिए एडमिन खातों हेतु सार्वजनिक पंजीकरण अक्षम है।',
          demoHeading: 'एडमिनिस्ट्रेटर डेमो खाता',
          demoSubtitle: 'तुरंत 1-क्लिक साइन-इन के लिए नीचे सत्यापित एडमिन खाते पर क्लिक करें।',
          emailLabel: 'एडमिनिस्ट्रेटर ईमेल पता',
          submitLoginLabel: 'एडमिन पैनल में साइन इन करें',
          prevLabel: 'डॉक्टर लॉगिन',
        },
      },
    },
  },
};
