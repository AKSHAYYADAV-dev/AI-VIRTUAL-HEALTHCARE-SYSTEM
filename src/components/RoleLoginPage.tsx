import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  Lock,
  UserCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  User as UserIcon,
  CheckCircle2,
  Building2,
  FileText,
  Video,
  Activity,
} from 'lucide-react';
import { User, SupportedLanguage } from '../types/healthcare';
import { UI_TRANSLATIONS } from '../utils/i18n';
import { LegalPoliciesModal, LegalPolicyTab } from './LegalPoliciesModal';
import heroDigitalClinicImg from '../assets/images/hero_digital_clinic_1795425414714.jpg';
import doctorDashboardHeroImg from '../assets/images/doctor_dashboard_hero_1795427973504.jpg';
import stepSpecialistClinicImg from '../assets/images/step_specialist_clinic_1795425413005.jpg';

export type LoginPortalRole = 'patient' | 'doctor' | 'admin';

export interface RoleDemoAccount {
  label: string;
  role: string;
  portalRole: LoginPortalRole;
  email: string;
  password: string;
  detail: string;
}

interface RoleLoginPageProps {
  role: LoginPortalRole;
  initialMode?: 'login' | 'signup';
  language: SupportedLanguage;
  demoAccounts: RoleDemoAccount[];
  onLanguageChange: (lang: SupportedLanguage) => void;
  onSwitchRole: (nextRole: LoginPortalRole, mode?: 'login' | 'signup') => void;
  onBackToHome: () => void;
  onAuthSuccess: (user: User, sessionToken?: string) => void;
}

const ROLE_ORDER: LoginPortalRole[] = ['patient', 'doctor', 'admin'];

const ROLE_META: Record<
  LoginPortalRole,
  {
    stepNum: string;
    allowSignup: boolean;
    defaultEmail: string;
    defaultPassword: string;
    bannerImage: string;
    bannerAlt: string;
    nextPortalRole?: LoginPortalRole;
    prevPortalRole?: LoginPortalRole;
  }
> = {
  patient: {
    stepNum: '01',
    allowSignup: true,
    defaultEmail: 'rohan@patient.in',
    defaultPassword: 'Patient@123',
    bannerImage: heroDigitalClinicImg,
    bannerAlt: 'AI-generated modern digital clinic desk for Patient Care Portal',
    nextPortalRole: 'doctor',
  },
  doctor: {
    stepNum: '02',
    allowSignup: true,
    defaultEmail: 'dr.aarav@medassist.in',
    defaultPassword: 'Doctor@123',
    bannerImage: doctorDashboardHeroImg,
    bannerAlt: 'AI-generated clinician telemedicine workstation for Doctor Portal',
    prevPortalRole: 'patient',
    nextPortalRole: 'admin',
  },
  admin: {
    stepNum: '03',
    allowSignup: false,
    defaultEmail: 'admin@medassist.in',
    defaultPassword: 'Admin@123',
    bannerImage: stepSpecialistClinicImg,
    bannerAlt: 'AI-generated modern clinic governance suite for Administrator Portal',
    prevPortalRole: 'doctor',
  },
};

export const RoleLoginPage: React.FC<RoleLoginPageProps> = ({
  role,
  initialMode = 'login',
  language,
  demoAccounts,
  onLanguageChange,
  onSwitchRole,
  onBackToHome,
  onAuthSuccess,
}) => {
  const meta = ROLE_META[role];
  const t = UI_TRANSLATIONS[language];
  const rl = t.roleLogin;
  const roleCopy = rl.roles[role];

  const [mode, setMode] = useState<'login' | 'signup'>(
    meta.allowSignup ? initialMode : 'login'
  );
  const [email, setEmail] = useState(meta.defaultEmail);
  const [password, setPassword] = useState(meta.defaultPassword);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('29');
  const [gender, setGender] = useState('Female');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [specialty, setSpecialty] = useState('General & Internal Medicine');
  const [qualification, setQualification] = useState('MBBS, MD');
  const [registrationNumber, setRegistrationNumber] = useState('TSMC-88412');
  const [experienceYears, setExperienceYears] = useState('7');
  const [consultationFee, setConsultationFee] = useState('500');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatchRole, setMismatchRole] = useState<LoginPortalRole | null>(null);
  const [legalModalTab, setLegalModalTab] = useState<LegalPolicyTab | null>(null);

  // Sync defaults cleanly whenever the user switches between Patient / Doctor / Admin pages
  useEffect(() => {
    const nextMeta = ROLE_META[role];
    setMode(nextMeta.allowSignup ? initialMode : 'login');
    setEmail(nextMeta.defaultEmail);
    setPassword(nextMeta.defaultPassword);
    setError(null);
    setMismatchRole(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [role, initialMode]);

  const roleDemoAccounts = demoAccounts.filter((acc) => acc.portalRole === role);

  const handleLogin = async (
    e: React.FormEvent,
    overrideEmail?: string,
    overridePassword?: string
  ) => {
    e.preventDefault();
    setError(null);
    setMismatchRole(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: overrideEmail ?? email,
          password: overridePassword ?? password,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      const loggedInUser = data.user as User;
      if (loggedInUser.role !== role) {
        const correctRole = loggedInUser.role as LoginPortalRole;
        const roleDisplay = rl.roleDisplayNames[correctRole];
        setMismatchRole(correctRole);
        setError(rl.mismatchError(roleDisplay));
        return;
      }

      onAuthSuccess(loggedInUser, data.sessionToken);
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meta.allowSignup) return;
    setError(null);
    setMismatchRole(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          phone,
          age: Number(age),
          gender,
          bloodGroup,
          specialty,
          qualification,
          registrationNumber,
          experienceYears: Number(experienceYears),
          consultationFee: Number(consultationFee),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Signup failed.');
      }
      onAuthSuccess(data.user, data.sessionToken);
    } catch (err: any) {
      setError(err.message || 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  const renderRoleIcon = (r: LoginPortalRole, className = 'w-4 h-4') => {
    if (r === 'patient') return <UserIcon className={className} />;
    if (r === 'doctor') return <Stethoscope className={className} />;
    return <ShieldCheck className={className} />;
  };

  return (
    <div className="min-h-screen bg-[#F3FFE7] dark:bg-[#04281d] text-[#0B2B22] dark:text-[#E0FFC2] flex flex-col">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 bg-[#064734] text-white border-b border-[#043224] px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{rl.homeBtn}</span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E0FFC2] flex items-center justify-center text-[#064734] shadow-xs shrink-0">
                <Stethoscope className="w-4 h-4" />
              </div>
              <span className="text-sm sm:text-base font-bold tracking-tight text-white hidden sm:inline">
                {t.appTitle}
              </span>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[#043224] rounded-xl border border-white/20">
            {(['English', 'Telugu', 'Hindi'] as SupportedLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  language === lang
                    ? 'bg-[#E0FFC2] text-[#064734] font-bold shadow-xs'
                    : 'text-white/90 hover:text-white'
                }`}
              >
                {lang === 'English' ? 'English' : lang === 'Telugu' ? 'తెలుగు' : 'हिन्दी'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ROLE PORTAL NAVIGATION BAR: 01 Patient → 02 Doctor → 03 Admin */}
      <div className="bg-white/90 dark:bg-[#073528]/90 border-b border-[#B9E68E] dark:border-[#1E5C47] px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-[#284D41] dark:text-[#B9E68E] uppercase tracking-wider">
            {rl.selectPortalLabel}
          </div>
          <nav
            aria-label="Role login portals"
            className="flex flex-wrap items-center gap-2"
          >
            {ROLE_ORDER.map((r) => {
              const itemMeta = ROLE_META[r];
              const itemCopy = rl.roles[r];
              const isActive = r === role;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onSwitchRole(r, 'login')}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#064734] text-[#E0FFC2] shadow-xs ring-2 ring-[#064734]/20'
                      : 'bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] dark:border-[#1E5C47] text-[#064734] dark:text-[#E0FFC2] hover:bg-[#E0FFC2] dark:hover:bg-[#064734]'
                  }`}
                >
                  <span className="font-mono-tabular opacity-75">{itemMeta.stepNum}</span>
                  {renderRoleIcon(r, 'w-3.5 h-3.5')}
                  <span>{itemCopy.tabLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* MAIN DEDICATED LOGIN PAGE BODY */}
      <main className="flex-1 max-w-6xl xl:max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT PANEL: Role Identity, AI Visual, Capabilities & Role-Only Demo Accounts */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] rounded-3xl overflow-hidden shadow-sm">
              {/* Role Banner Image */}
              <div className="relative w-full h-52 sm:h-56 bg-gradient-to-br from-[#064734] via-[#0b5c44] to-[#137A5B] overflow-hidden border-b border-[#B9E68E]">
                <img
                  src={meta.bannerImage}
                  alt={meta.bannerAlt}
                  loading="eager"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#04281d]/85 via-[#064734]/30 to-transparent pointer-events-none"
                />
                <div className="absolute top-3.5 left-3.5 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#064734]/90 border border-[#E0FFC2]/30 text-[#E0FFC2] text-xs font-bold shadow-xs">
                  {renderRoleIcon(role, 'w-3.5 h-3.5')}
                  <span>
                    {rl.portalPrefix} {meta.stepNum} · {roleCopy.badge}
                  </span>
                </div>
                <div className="absolute bottom-3.5 left-4 right-4 text-white">
                  <div className="text-base sm:text-lg font-extrabold tracking-tight">
                    {roleCopy.bannerCaption}
                  </div>
                </div>
              </div>

              {/* Capabilities List */}
              <div className="p-6 space-y-4">
                <h2 className="text-sm font-bold text-[#064734] dark:text-[#E0FFC2] flex items-center gap-2">
                  {role === 'patient' ? (
                    <Activity className="w-4 h-4 text-[#137A5B]" />
                  ) : role === 'doctor' ? (
                    <Video className="w-4 h-4 text-[#137A5B]" />
                  ) : (
                    <Building2 className="w-4 h-4 text-[#137A5B]" />
                  )}
                  <span>{roleCopy.capabilitiesHeading}</span>
                </h2>
                <ul className="space-y-2.5 text-xs text-[#0B2B22] dark:text-white/90 font-medium">
                  {roleCopy.highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#137A5B] dark:text-[#E0FFC2] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Role-Specific Quick Demo Accounts */}
            <div className="bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] rounded-3xl shadow-sm p-5 sm:p-6 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#064734] dark:text-[#E0FFC2]">
                    {roleCopy.demoHeading}
                  </h3>
                  <p className="text-[11px] text-[#284D41] dark:text-white/80 font-medium">
                    {roleCopy.demoSubtitle}
                  </p>
                </div>
                <span className="text-[11px] font-mono-tabular px-2.5 py-1 rounded-xl bg-[#E0FFC2] text-[#064734] font-bold shrink-0">
                  {roleDemoAccounts.length}{' '}
                  {roleDemoAccounts.length === 1 ? rl.accountSingular : rl.accountPlural}
                </span>
              </div>

              <div className="space-y-2">
                {roleDemoAccounts.map((acc) => (
                  <div
                    key={acc.email}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] dark:border-[#1E5C47]"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#064734] dark:text-[#E0FFC2] truncate">
                        {acc.label}
                      </div>
                      <div className="text-[11px] text-[#284D41] dark:text-white/80 font-medium truncate">
                        {acc.detail}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-[#0B2B22] dark:text-white/90 mt-0.5">
                        {acc.email} · {acc.password}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => {
                        setEmail(acc.email);
                        setPassword(acc.password);
                        handleLogin(e, acc.email, acc.password);
                      }}
                      className="btn-forest-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl shadow-2xs cursor-pointer shrink-0 disabled:opacity-60"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-white" />
                      <span>{rl.signInBtn}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Dedicated Auth Form for the Selected Role */}
          <div className="lg:col-span-6 bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] rounded-3xl shadow-sm p-6 sm:p-8">
            {/* Mode Switcher (only shown for Patient & Doctor; Admin is Sign-In only) */}
            {meta.allowSignup ? (
              <div className="flex items-center gap-1.5 p-1.5 bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] dark:border-[#1E5C47] rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setMismatchRole(null);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    mode === 'login'
                      ? 'bg-[#064734] text-white shadow-xs'
                      : 'text-[#0B2B22] dark:text-[#E0FFC2] hover:bg-[#E0FFC2] hover:text-[#064734]'
                  }`}
                >
                  {role === 'patient' ? rl.patientSignInTab : rl.doctorSignInTab}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setEmail('');
                    setPassword('');
                    setError(null);
                    setMismatchRole(null);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    mode === 'signup'
                      ? 'bg-[#064734] text-white shadow-xs'
                      : 'text-[#0B2B22] dark:text-[#E0FFC2] hover:bg-[#E0FFC2] hover:text-[#064734]'
                  }`}
                >
                  {role === 'patient' ? rl.patientSignupTab : rl.doctorSignupTab}
                </button>
              </div>
            ) : (
              <div className="mb-6 p-3.5 rounded-2xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] dark:border-[#1E5C47] flex items-center gap-2.5 text-xs font-bold text-[#064734] dark:text-[#E0FFC2]">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{rl.adminRestrictedBanner}</span>
              </div>
            )}

            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-[#064734] text-[#E0FFC2] flex items-center justify-center shrink-0 shadow-xs">
                {renderRoleIcon(role, 'w-5 h-5')}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[#064734] dark:text-[#E0FFC2] tracking-tight">
                  {mode === 'login' ? roleCopy.title : roleCopy.signupTitle}
                </h1>
                <p className="text-xs text-[#284D41] dark:text-white/80 font-semibold">
                  {rl.stepPrefix} {meta.stepNum} · {roleCopy.badge}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#284D41] dark:text-white/85 mb-6 leading-relaxed font-medium">
              {mode === 'login' ? roleCopy.subtitle : roleCopy.signupSubtitle}
            </p>

            {error && (
              <div className="mb-5 p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-700 space-y-2.5 text-xs text-red-900 dark:text-red-200 font-semibold">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {mismatchRole && (
                  <button
                    type="button"
                    onClick={() => onSwitchRole(mismatchRole, 'login')}
                    className="btn-forest-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <span>
                      {rl.goToPrefix} {rl.roles[mismatchRole].tabLabel}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
                <div className="relative">
                  <input
                    id="role-login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=" "
                    className="peer w-full px-4 pt-5 pb-2 text-sm bg-white dark:bg-[#032419] border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl text-[#0B2B22] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#064734] transition-all"
                  />
                  <label
                    htmlFor="role-login-email"
                    className="absolute left-4 top-1.5 text-[11px] font-bold text-[#284D41] dark:text-[#B9E68E] transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-normal peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-[#064734] dark:peer-focus:text-[#E0FFC2]"
                  >
                    {roleCopy.emailLabel}
                  </label>
                </div>

                <div className="relative">
                  <input
                    id="role-login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                    className="peer w-full px-4 pt-5 pb-2 text-sm bg-white dark:bg-[#032419] border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl text-[#0B2B22] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#064734] transition-all"
                  />
                  <label
                    htmlFor="role-login-password"
                    className="absolute left-4 top-1.5 text-[11px] font-bold text-[#284D41] dark:text-[#B9E68E] transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-normal peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-[#064734] dark:peer-focus:text-[#E0FFC2]"
                  >
                    {rl.passwordLabel}
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-forest-primary w-full py-3.5 px-4 disabled:opacity-60 text-sm font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{loading ? rl.signingInLabel : roleCopy.submitLoginLabel}</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                {role === 'doctor' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-xs text-amber-950 dark:text-amber-100 font-medium">
                    <strong>{rl.doctorVerifyPolicyLabel}</strong> {rl.doctorVerifyPolicyText}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                      {rl.fullNameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={role === 'doctor' ? 'Dr. Kavita Rao' : 'Kiran Kumar'}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#032419] border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl text-[#0B2B22] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#064734]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                      {rl.phoneLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98490 12345"
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#032419] border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl text-[#0B2B22] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#064734]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                      {rl.emailAddressLabel}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={role === 'doctor' ? 'dr.name@clinic.in' : 'you@example.com'}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#032419] border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl text-[#0B2B22] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#064734]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                      {rl.passwordLabel}
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={rl.passwordPlaceholder}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#032419] border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl text-[#0B2B22] dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#064734]"
                    />
                  </div>
                </div>

                {role === 'patient' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                        {rl.ageLabel}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl bg-white dark:bg-[#032419] text-[#0B2B22] dark:text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                        {rl.genderLabel}
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl bg-white dark:bg-[#032419] text-[#0B2B22] dark:text-white font-medium"
                      >
                        <option value="Female">{rl.genderFemale}</option>
                        <option value="Male">{rl.genderMale}</option>
                        <option value="Other">{rl.genderOther}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                        {rl.bloodGroupLabel}
                      </label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl bg-white dark:bg-[#032419] text-[#0B2B22] dark:text-white font-medium"
                      >
                        <option>O+</option>
                        <option>O-</option>
                        <option>A+</option>
                        <option>A-</option>
                        <option>B+</option>
                        <option>B-</option>
                        <option>AB+</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                          {rl.specialtyLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={specialty}
                          onChange={(e) => setSpecialty(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl bg-white dark:bg-[#032419] text-[#0B2B22] dark:text-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                          {rl.medRegNoLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={registrationNumber}
                          onChange={(e) => setRegistrationNumber(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl bg-white dark:bg-[#032419] text-[#0B2B22] dark:text-white font-medium"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                          {rl.qualificationLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={qualification}
                          onChange={(e) => setQualification(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl bg-white dark:bg-[#032419] text-[#0B2B22] dark:text-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                          {rl.experienceLabel}
                        </label>
                        <input
                          type="number"
                          value={experienceYears}
                          onChange={(e) => setExperienceYears(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl bg-white dark:bg-[#032419] text-[#0B2B22] dark:text-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#0B2B22] dark:text-white mb-1">
                          {rl.consultFeeLabel}
                        </label>
                        <input
                          type="number"
                          value={consultationFee}
                          onChange={(e) => setConsultationFee(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-[#B9E68E] dark:border-[#1E5C47] rounded-xl bg-white dark:bg-[#032419] text-[#0B2B22] dark:text-white font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-forest-primary w-full py-3.5 px-4 disabled:opacity-60 text-sm font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {loading
                    ? rl.creatingAccountLabel
                    : role === 'doctor'
                    ? rl.registerDoctorBtn
                    : rl.registerPatientBtn}
                </button>
              </form>
            )}

            {/* Sequential Portal Navigation (Patient → Doctor → Admin) */}
            <div className="mt-6 pt-5 border-t border-[#B9E68E] dark:border-[#1E5C47] flex flex-wrap items-center justify-between gap-2 text-xs">
              {meta.prevPortalRole ? (
                <button
                  type="button"
                  onClick={() => onSwitchRole(meta.prevPortalRole!, 'login')}
                  className="inline-flex items-center gap-1.5 font-bold text-[#064734] dark:text-[#E0FFC2] hover:opacity-80 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{roleCopy.prevLabel}</span>
                </button>
              ) : (
                <span className="text-[11px] font-semibold text-[#284D41] dark:text-white/70">
                  {rl.otherPortalsLabel}
                </span>
              )}

              <div className="flex items-center gap-3">
                {meta.nextPortalRole && (
                  <button
                    type="button"
                    onClick={() => onSwitchRole(meta.nextPortalRole!, 'login')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] dark:border-[#1E5C47] font-bold text-[#064734] dark:text-[#E0FFC2] hover:bg-[#E0FFC2] dark:hover:bg-[#064734] transition-colors cursor-pointer"
                  >
                    <span>
                      {rl.nextPrefix} {roleCopy.nextLabel}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => onSwitchRole('patient', 'login')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] dark:border-[#1E5C47] font-bold text-[#064734] dark:text-[#E0FFC2] hover:bg-[#E0FFC2] dark:hover:bg-[#064734] transition-colors cursor-pointer"
                  >
                    <span>{rl.roles.patient.tabLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Security & Legal Footer */}
            <div className="mt-5 pt-4 border-t border-[#B9E68E] dark:border-[#1E5C47] space-y-2.5 text-[11px] text-[#284D41] dark:text-white/80 font-medium">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#E0FFC2] border border-[#B9E68E] flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-3.5 h-3.5 text-[#064734]" />
                </div>
                <div className="space-y-1">
                  <p className="leading-relaxed">{roleCopy.securityNote}</p>
                  {language !== 'English' && <p>{t.privacyNotice}</p>}
                </div>
              </div>
              <p className="text-[11px] text-[#284D41] dark:text-white/75 flex items-center gap-1 flex-wrap">
                <FileText className="w-3 h-3 shrink-0" />
                <span>{rl.agreePrefix}</span>
                <button
                  type="button"
                  onClick={() => setLegalModalTab('terms')}
                  className="text-[#064734] dark:text-[#E0FFC2] underline underline-offset-2 font-semibold cursor-pointer"
                >
                  {t.termsConditions}
                </button>
                <span>{rl.agreeAnd}</span>
                <button
                  type="button"
                  onClick={() => setLegalModalTab('privacy')}
                  className="text-[#064734] dark:text-[#E0FFC2] underline underline-offset-2 font-semibold cursor-pointer"
                >
                  {t.privacyPolicy}
                </button>
                <span>.</span>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* PAGE FOOTER */}
      <footer className="border-t border-[#B9E68E] dark:border-[#1E5C47] py-5 px-6 text-center text-xs font-semibold text-[#284D41] dark:text-white/80 bg-[#F3FFE7] dark:bg-[#04281d] space-y-1.5">
        <p>{rl.footerCaption}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setLegalModalTab('privacy')}
            className="text-[#064734] dark:text-[#E0FFC2] underline underline-offset-2 hover:opacity-80 cursor-pointer"
          >
            {t.privacyPolicy}
          </button>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <button
            type="button"
            onClick={() => setLegalModalTab('terms')}
            className="text-[#064734] dark:text-[#E0FFC2] underline underline-offset-2 hover:opacity-80 cursor-pointer"
          >
            {t.termsConditions}
          </button>
        </div>
      </footer>

      <LegalPoliciesModal
        activeTab={legalModalTab}
        onChangeTab={(tab) => setLegalModalTab(tab)}
        onClose={() => setLegalModalTab(null)}
      />
    </div>
  );
};
