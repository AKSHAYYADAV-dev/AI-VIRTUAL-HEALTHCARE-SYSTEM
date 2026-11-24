import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  Lock,
  UserCheck,
  AlertCircle,
  ArrowRight,
  KeyRound,
  Calendar,
  Pill,
  Plus,
  Heart,
  Droplet,
  MessageSquare,
  Sparkles,
  Bot,
  User as UserIcon,
  AlertTriangle,
  LogIn,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { User, SupportedLanguage } from '../types/healthcare';
import { UI_TRANSLATIONS } from '../utils/i18n';
import { LegalPoliciesModal, LegalPolicyTab } from './LegalPoliciesModal';
import {
  RoleLoginPage,
  LoginPortalRole,
  RoleDemoAccount,
} from './RoleLoginPage';

interface AuthViewProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onAuthSuccess: (user: User, sessionToken?: string) => void;
}

const DEMO_ACCOUNTS: RoleDemoAccount[] = [
  {
    label: 'Patient 1 (Rohan Verma)',
    role: 'Patient',
    portalRole: 'patient',
    email: 'rohan@patient.in',
    password: 'Patient@123',
    detail: '34M · Has chats, appointments & e-Rx',
  },
  {
    label: 'Patient 2 (Sneha Kulkarni)',
    role: 'Patient',
    portalRole: 'patient',
    email: 'sneha@patient.in',
    password: 'Patient@123',
    detail: '28F · Cardiology video appointment',
  },
  {
    label: 'Patient 3 (Arjun Rao)',
    role: 'Patient',
    portalRole: 'patient',
    email: 'arjun@patient.in',
    password: 'Patient@123',
    detail: '45M · Completed consult & PDF e-Rx',
  },
  {
    label: 'Dr. Aarav Mehta, MD',
    role: 'Doctor (Approved)',
    portalRole: 'doctor',
    email: 'dr.aarav@medassist.in',
    password: 'Doctor@123',
    detail: 'Internal Medicine · Active appointments',
  },
  {
    label: 'Dr. Priya Sharma, DM',
    role: 'Doctor (Approved)',
    portalRole: 'doctor',
    email: 'dr.priya@medassist.in',
    password: 'Doctor@123',
    detail: 'Cardiology · Confirmed consults',
  },
  {
    label: 'Dr. Karthik Reddy, MD',
    role: 'Doctor (Approved)',
    portalRole: 'doctor',
    email: 'dr.karthik@medassist.in',
    password: 'Doctor@123',
    detail: 'Pulmonology · Pending request to review',
  },
  {
    label: 'Dr. Ananya Nair, MD',
    role: 'Doctor (Approved)',
    portalRole: 'doctor',
    email: 'dr.ananya@medassist.in',
    password: 'Doctor@123',
    detail: 'Dermatology & Immunology',
  },
  {
    label: 'Dr. Vikram Joshi, MS',
    role: 'Doctor (Pending Approval)',
    portalRole: 'doctor',
    email: 'dr.vikram@medassist.in',
    password: 'Doctor@123',
    detail: 'Orthopedics · Needs Admin approval',
  },
  {
    label: 'Dr. Meera Krishnan',
    role: 'Admin',
    portalRole: 'admin',
    email: 'admin@medassist.in',
    password: 'Admin@123',
    detail: 'Approve doctors, manage users & stats',
  },
];

function parseLoginRouteFromHash(): LoginPortalRole | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.toLowerCase();
  if (h === '#/login/patient') return 'patient';
  if (h === '#/login/doctor') return 'doctor';
  if (h === '#/login/admin') return 'admin';
  return null;
}

const FEATURE_ICONS = {
  'ai-assistant': Bot,
  'book-appointments': Calendar,
  'trusted-care': ShieldCheck,
} as const;

interface FloatingShape {
  id: number;
  type: 'cross' | 'pill' | 'heart' | 'drop';
  tier: 'far' | 'mid' | 'near';
  size: number;
  driftY: number;
  bobY: number;
  duration: number;
  delay: number;
  opacity: number;
  blur: number;
  speedParallax: number;
}

// 14 floating 3D shapes drifting from LEFT to RIGHT with depth tiers
const FLOATING_SHAPES: FloatingShape[] = [
  // Far Tier (small, faint, slow) - 5 shapes
  { id: 1, type: 'cross', tier: 'far', size: 24, driftY: 40, bobY: 18, duration: 35, delay: -4, opacity: 0.25, blur: 0, speedParallax: 0.12 },
  { id: 2, type: 'pill', tier: 'far', size: 26, driftY: 190, bobY: -22, duration: 38, delay: -16, opacity: 0.22, blur: 0, speedParallax: 0.15 },
  { id: 3, type: 'heart', tier: 'far', size: 22, driftY: 340, bobY: 20, duration: 33, delay: -27, opacity: 0.24, blur: 0, speedParallax: 0.1 },
  { id: 4, type: 'drop', tier: 'far', size: 24, driftY: 530, bobY: -16, duration: 37, delay: -10, opacity: 0.25, blur: 0, speedParallax: 0.14 },
  { id: 5, type: 'cross', tier: 'far', size: 26, driftY: 710, bobY: 22, duration: 36, delay: -22, opacity: 0.23, blur: 0, speedParallax: 0.12 },

  // Mid Tier (medium speed) - 5 shapes
  { id: 6, type: 'pill', tier: 'mid', size: 36, driftY: 90, bobY: -26, duration: 24, delay: -8, opacity: 0.48, blur: 0, speedParallax: 0.26 },
  { id: 7, type: 'heart', tier: 'mid', size: 38, driftY: 270, bobY: 28, duration: 22, delay: -19, opacity: 0.52, blur: 0, speedParallax: 0.28 },
  { id: 8, type: 'drop', tier: 'mid', size: 34, driftY: 430, bobY: -24, duration: 26, delay: -2, opacity: 0.46, blur: 0, speedParallax: 0.24 },
  { id: 9, type: 'cross', tier: 'mid', size: 38, driftY: 610, bobY: 30, duration: 23, delay: -14, opacity: 0.5, blur: 0, speedParallax: 0.3 },
  { id: 10, type: 'pill', tier: 'mid', size: 36, driftY: 780, bobY: -25, duration: 25, delay: -26, opacity: 0.48, blur: 0, speedParallax: 0.25 },

  // Near Tier (larger, sharp, faster, soft shadow) - 4 shapes
  { id: 11, type: 'heart', tier: 'near', size: 50, driftY: 140, bobY: 34, duration: 16, delay: -6, opacity: 0.8, blur: 0, speedParallax: 0.44 },
  { id: 12, type: 'drop', tier: 'near', size: 48, driftY: 320, bobY: -32, duration: 17, delay: -13, opacity: 0.78, blur: 0, speedParallax: 0.48 },
  { id: 13, type: 'cross', tier: 'near', size: 52, driftY: 500, bobY: 36, duration: 15, delay: -20, opacity: 0.82, blur: 0, speedParallax: 0.5 },
  { id: 14, type: 'pill', tier: 'near', size: 50, driftY: 690, bobY: -35, duration: 16, delay: -3, opacity: 0.8, blur: 0, speedParallax: 0.46 },
];

export const AuthView: React.FC<AuthViewProps> = ({
  language,
  onLanguageChange,
  onAuthSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalModalTab, setLegalModalTab] = useState<LegalPolicyTab | null>(null);
  const [activeLoginPage, setActiveLoginPage] = useState<LoginPortalRole | null>(() =>
    parseLoginRouteFromHash()
  );
  const [loginPageMode, setLoginPageMode] = useState<'login' | 'signup'>('login');

  // Scroll Progress Bar percentage
  const [scrollPercent, setScrollPercent] = useState<number>(0);
  // Current vertical scroll offset for shape parallax
  const [scrollY, setScrollY] = useState<number>(0);

  // Chat preview card 3D tilt
  const [cardTilt, setCardTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);

  // Scroll text reveal progress for each line [0..1]
  const [lineProgress, setLineProgress] = useState<number[]>([0, 0, 0, 0, 0]);
  const [cardsProgress, setCardsProgress] = useState<number>(0);
  const revealLinesRef = useRef<(HTMLDivElement | null)[]>([]);
  const featureCardsRef = useRef<HTMLDivElement | null>(null);
  const chatCardRef = useRef<HTMLDivElement | null>(null);
  const t = UI_TRANSLATIONS[language];
  const landing = t.landing;

  // Sync separate login pages with browser hash history (#/login/patient, #/login/doctor, #/login/admin)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => {
      setActiveLoginPage(parseLoginRouteFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openRoleLoginPage = useCallback(
    (role: LoginPortalRole, targetMode: 'login' | 'signup' = 'login') => {
      setLoginPageMode(role === 'admin' ? 'login' : targetMode);
      setActiveLoginPage(role);
      setError(null);
      if (typeof window !== 'undefined') {
        const nextHash = `#/login/${role}`;
        if (window.location.hash !== nextHash) {
          window.location.hash = nextHash;
        }
      }
    },
    []
  );

  const returnToLandingHome = useCallback(() => {
    setActiveLoginPage(null);
    setError(null);
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#/login/')) {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const handleCompleteAuth = useCallback(
    (user: User, sessionToken?: string) => {
      if (typeof window !== 'undefined' && window.location.hash.startsWith('#/login/')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      onAuthSuccess(user, sessionToken);
    },
    [onAuthSuccess]
  );

  // Detect touch devices, screen size, and reduced-motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMedia = () => {
      const touch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const mobile = window.innerWidth < 768;

      setIsTouchDevice(touch);
      setReducedMotion(reduced);
      setIsMobileScreen(mobile);
    };

    checkMedia();
    window.addEventListener('resize', checkMedia);
    return () => window.removeEventListener('resize', checkMedia);
  }, []);

  // Scroll handler using requestAnimationFrame for 60fps performance and zero layout shifts
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const winH = window.innerHeight;
          const docH = document.documentElement.scrollHeight - winH;
          const currentY = window.scrollY || window.pageYOffset;

          setScrollY(currentY);
          setScrollPercent(docH > 0 ? Math.min(100, Math.max(0, (currentY / docH) * 100)) : 0);

          if (!reducedMotion) {
            // Update reveal progress for each line
            const newProgress = revealLinesRef.current.map((el) => {
              if (!el) return 0;
              const rect = el.getBoundingClientRect();
              // Trigger when line reaches lower 80% of viewport and completes by 45%
              const startY = winH * 0.80;
              const endY = winH * 0.45;
              const p = (startY - rect.top) / (startY - endY);
              return Math.min(1, Math.max(0, p));
            });
            setLineProgress(newProgress);

            // Update feature cards reveal progress
            if (featureCardsRef.current) {
              const rect = featureCardsRef.current.getBoundingClientRect();
              const startY = winH * 0.88;
              const endY = winH * 0.55;
              const p = (startY - rect.top) / (startY - endY);
              setCardsProgress(Math.min(1, Math.max(0, p)));
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [reducedMotion]);

  // Chat Preview Card 3D tilt on mouse hover (Desktop only, max 16 deg)
  const handleChatCardMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTouchDevice || reducedMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Max 16 degrees tilt
      const rotateX = Math.max(-16, Math.min(16, -((y - centerY) / centerY) * 16));
      const rotateY = Math.max(-16, Math.min(16, ((x - centerX) / centerX) * 16));

      setCardTilt({ x: rotateX, y: rotateY });
    },
    [isTouchDevice, reducedMotion]
  );

  const handleChatCardMouseLeave = useCallback(() => {
    setCardTilt({ x: 0, y: 0 });
  }, []);

  const handleQuickDemoLogin = async (
    e: React.FormEvent,
    demoEmail: string,
    demoPassword: string
  ) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: demoEmail,
          password: demoPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }
      handleCompleteAuth(data.user, data.sessionToken);
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderShapeIcon = (shape: FloatingShape) => {
    const iconSize = Math.round(shape.size * 0.52);
    switch (shape.type) {
      case 'cross':
        return <Plus style={{ width: iconSize, height: iconSize }} className="stroke-[2.6]" />;
      case 'pill':
        return <Pill style={{ width: iconSize, height: iconSize }} />;
      case 'heart':
        return <Heart style={{ width: iconSize, height: iconSize }} className="fill-current" />;
      case 'drop':
        return <Droplet style={{ width: iconSize, height: iconSize }} className="fill-current" />;
    }
  };

  // Determine active revealing line index for the blinking cursor
  const activeLineIndex = lineProgress.findIndex((p) => p > 0.1 && p < 0.95);

  // Render dedicated separate login pages: Patient -> Doctor -> Admin
  if (activeLoginPage) {
    return (
      <RoleLoginPage
        role={activeLoginPage}
        initialMode={loginPageMode}
        language={language}
        demoAccounts={DEMO_ACCOUNTS}
        onLanguageChange={onLanguageChange}
        onSwitchRole={openRoleLoginPage}
        onBackToHome={returnToLandingHome}
        onAuthSuccess={handleCompleteAuth}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F3FFE7] dark:bg-[#04281d] text-[#0B2B22] dark:text-[#E0FFC2] flex flex-col overflow-x-hidden">
      {/* 1. SCROLL PROGRESS BAR: Fixed at the very top */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-1 z-50 origin-left transition-all duration-75 pointer-events-none"
        style={{
          width: `${scrollPercent}%`,
          backgroundColor: '#3fa57a',
          boxShadow: '0 0 10px rgba(63, 165, 122, 0.6)',
        }}
      />

      {/* 2. BACKGROUND EFFECTS: Subtle ambient green gradient blobs strictly at z-0 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* Blob 1: Top-Left soft ambient glow */}
        <div
          className="blob-animate-1 absolute -top-40 -left-40 w-[540px] h-[540px] rounded-full pointer-events-none opacity-15 dark:opacity-10"
          style={{
            background:
              'radial-gradient(circle, rgba(224, 255, 194, 0.6) 0%, rgba(63, 165, 122, 0.25) 50%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />

        {/* Blob 2: Bottom-Right soft ambient glow */}
        <div
          className="blob-animate-2 absolute top-[600px] -right-48 w-[600px] h-[600px] rounded-full pointer-events-none opacity-15 dark:opacity-10"
          style={{
            background:
              'radial-gradient(circle, rgba(63, 165, 122, 0.35) 0%, rgba(224, 255, 194, 0.2) 50%, transparent 70%)',
            filter: 'blur(95px)',
          }}
        />
      </div>

      {/* 3. FLOATING 3D SHAPES: 14 shapes drifting LEFT to RIGHT on endless loops with depth and scroll parallax */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {FLOATING_SHAPES.filter((s) => !isMobileScreen || s.tier === 'near').map((s) => {
          const parallaxShift = reducedMotion ? 0 : scrollY * s.speedParallax;
          return (
            <div
              key={s.id}
              className="drift-shape absolute left-0"
              style={
                {
                  '--drift-y': `${s.driftY}px`,
                  '--bob-y': `${s.bobY}px`,
                  animationDuration: `${s.duration}s`,
                  animationDelay: `${s.delay}s`,
                  opacity: s.opacity,
                  top: 0,
                  transform: `translate3d(0, ${parallaxShift}px, 0)`,
                  transition: 'transform 100ms linear',
                } as React.CSSProperties
              }
            >
              <div
                style={{
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                }}
                className={`rounded-2xl flex items-center justify-center transition-all ${
                  s.tier === 'near'
                    ? 'bg-white text-[#064734] border border-[#B9E68E] shadow-md'
                    : s.tier === 'mid'
                    ? 'bg-[#E0FFC2]/90 text-[#064734] border border-[#064734]/20 shadow-xs'
                    : 'bg-white/50 text-[#064734]/80 border border-white/30'
                }`}
              >
                {renderShapeIcon(s)}
              </div>
            </div>
          );
        })}
      </div>

      {/* TOP NAVIGATION BAR: Primary Forest (#064734) with High-Contrast White Text */}
      <header className="relative z-30 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6 px-3.5 sm:px-6 lg:px-10 py-3 sm:py-3.5 bg-[#064734] text-white border-b border-[#043224] sticky top-0 shadow-xs">
        <a
          href="#top"
          className="flex items-center gap-2.5 min-w-0 shrink group focus:outline-none"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#E0FFC2] flex items-center justify-center text-[#064734] shadow-xs shrink-0 transition-transform group-hover:scale-105">
            <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-tight truncate">
              MedAssist
            </span>
            <span className="hidden sm:block text-[10px] font-medium text-[#E0FFC2]/90 tracking-wide leading-tight truncate">
              {landing.brandSubtitle}
            </span>
          </div>
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-6 xl:gap-7 text-sm font-medium text-white/90"
        >
          <a
            href="#feature-cards"
            className="hover:text-[#E0FFC2] transition-colors whitespace-nowrap shrink-0"
          >
            {landing.navFeatures}
          </a>
          <a
            href="#how-it-works-reveal"
            className="hover:text-[#E0FFC2] transition-colors whitespace-nowrap shrink-0"
          >
            {landing.navHowItWorks}
          </a>
          <a
            href="#auth-portal"
            className="hover:text-[#E0FFC2] transition-colors whitespace-nowrap shrink-0"
          >
            {landing.navLoginPortals}
          </a>
          <a
            href="#demo-accounts"
            className="hover:text-[#E0FFC2] transition-colors whitespace-nowrap shrink-0"
          >
            {landing.navDemoAccess}
          </a>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Select language"
            className="flex items-center gap-0.5 sm:gap-1 p-1 bg-[#043224] rounded-xl border border-white/20"
          >
            {(['English', 'Telugu', 'Hindi'] as SupportedLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
                aria-pressed={language === lang}
                className={`px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  language === lang
                    ? 'bg-[#E0FFC2] text-[#064734] font-bold shadow-xs'
                    : 'text-white/90 hover:text-white'
                }`}
              >
                {lang === 'English' ? (
                  <>
                    <span className="sm:hidden">EN</span>
                    <span className="hidden sm:inline">English</span>
                  </>
                ) : lang === 'Telugu' ? (
                  'తెలుగు'
                ) : (
                  'हिन्दी'
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openRoleLoginPage('patient', 'login')}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-[#E0FFC2] text-[#064734] hover:bg-white text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{landing.headerPatientLogin}</span>
              <span className="sm:hidden">{landing.headerLoginShort}</span>
            </button>
            <button
              type="button"
              onClick={() => openRoleLoginPage('doctor', 'login')}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#043224] border border-white/25 text-white hover:bg-[#E0FFC2] hover:text-[#064734] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>{landing.headerDoctor}</span>
            </button>
            <button
              type="button"
              onClick={() => openRoleLoginPage('admin', 'login')}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#043224] border border-white/25 text-white hover:bg-[#E0FFC2] hover:text-[#064734] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{landing.headerAdmin}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 4. LANDING PAGE HERO SECTION */}
      <section
        id="top"
        className="relative z-10 pt-10 pb-12 sm:pt-14 sm:pb-16 lg:pt-20 lg:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl 2xl:max-w-[1440px] mx-auto w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-14 items-center">
          {/* Left Hero Content: MedAssist Primary Heading, Tagline, Role CTAs & 3 Feature Highlights */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-7">
            <div className="space-y-3 sm:space-y-4">
              <h1
                className="font-extrabold tracking-[-0.035em] leading-[1.02] text-[#064734] dark:text-[#E0FFC2] word-fly-in"
                style={{ fontSize: 'clamp(2.85rem, 2.05rem + 3.2vw, 4.75rem)' }}
              >
                MedAssist
              </h1>

              <p className="text-xl sm:text-2xl lg:text-[1.65rem] font-semibold tracking-tight leading-snug text-[#0B2B22] dark:text-white max-w-2xl">
                {landing.heroTagline}
              </p>

              <p className="text-sm sm:text-base text-[#284D41] dark:text-slate-200 leading-relaxed max-w-xl font-medium">
                {landing.heroSubtitle}
              </p>
            </div>

            {/* Primary & Role Login CTAs */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
              <button
                type="button"
                onClick={() => openRoleLoginPage('patient', 'login')}
                className="btn-forest-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold shadow-sm cursor-pointer min-h-[46px] flex-1 sm:flex-none"
              >
                <UserIcon className="w-4 h-4 text-white shrink-0" />
                <span>{landing.ctaPatientLogin}</span>
                <ArrowRight className="w-4 h-4 text-white shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => openRoleLoginPage('doctor', 'login')}
                className="btn-forest-secondary inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold cursor-pointer min-h-[46px] flex-1 sm:flex-none"
              >
                <Stethoscope className="w-4 h-4 shrink-0" />
                <span>{landing.ctaDoctorLogin}</span>
              </button>

              <button
                type="button"
                onClick={() => openRoleLoginPage('admin', 'login')}
                className="btn-forest-secondary inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold cursor-pointer min-h-[46px] w-full sm:w-auto"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{landing.ctaAdminLogin}</span>
              </button>
            </div>

            {/* Three Core Feature Highlights (Above the Fold) */}
            <div
              aria-label="MedAssist key features"
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2"
            >
              {landing.features.map((item) => {
                const Icon = FEATURE_ICONS[item.id];
                return (
                  <a
                    key={item.id}
                    href="#feature-cards"
                    className="group bg-white/95 dark:bg-[#073528] border border-[#B9E68E] dark:border-[#1E5C47] hover:border-[#064734] dark:hover:border-[#E0FFC2] rounded-2xl p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 flex sm:flex-col items-start gap-3 sm:gap-2.5"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#E0FFC2] text-[#064734] border border-[#B9E68E] flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#064734] group-hover:text-[#E0FFC2]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#064734] dark:text-[#E0FFC2] leading-snug">
                        {item.title}
                      </div>
                      <div className="text-xs text-[#284D41] dark:text-white/80 font-medium mt-0.5 leading-snug">
                        {item.shortDesc}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Subtle Language & Care Readiness Row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[#284D41] dark:text-[#E0FFC2]/85 pt-0.5">
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#3fa57a]" />
                <span>English · తెలుగు · हिन्दी</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3fa57a]" />
                <span>{landing.readinessVerified}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#3fa57a]" />
                <span>{landing.readinessAlwaysOn}</span>
              </span>
            </div>
          </div>

          {/* Right Hero Content: Interactive AI Health Assistant Preview Card */}
          <div className="lg:col-span-5 w-full flex items-center justify-center">
            <div
              ref={chatCardRef}
              onMouseMove={handleChatCardMouseMove}
              onMouseLeave={handleChatCardMouseLeave}
              style={
                !isTouchDevice && !reducedMotion
                  ? {
                      transform: `perspective(1000px) rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`,
                    }
                  : undefined
              }
              className="w-full max-w-md rounded-3xl p-6 shadow-xl space-y-4 text-left bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] transition-transform duration-100 ease-out"
            >
              {/* Header inside preview card */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#B9E68E]/80 dark:border-[#1E5C47]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#064734] text-[#E0FFC2] flex items-center justify-center shadow-xs shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#064734] dark:text-[#E0FFC2]">
                      {landing.previewHeaderTitle}
                    </div>
                    <div className="text-[11px] text-[#3fa57a] font-semibold">
                      {landing.previewBadge}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] tabular-nums px-2.5 py-0.5 rounded-lg bg-[#E0FFC2] text-[#064734] font-bold shrink-0">
                  {landing.previewLiveTag}
                </span>
              </div>

              {/* Sample User Bubble */}
              <div className="flex justify-end">
                <div className="max-w-[88%] bg-[#064734] text-white p-3.5 rounded-2xl rounded-tr-xs text-xs shadow-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#E0FFC2] font-bold">
                    <UserIcon className="w-3 h-3" />
                    <span>{landing.previewYouLabel}</span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    {landing.previewUserQuestion}
                  </p>
                </div>
              </div>

              {/* Sample AI Assistant Bubble */}
              <div className="flex justify-start">
                <div className="max-w-[94%] bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] dark:border-[#1E5C47] text-[#0B2B22] dark:text-white p-3.5 rounded-2xl rounded-tl-xs text-xs shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#064734] dark:text-[#E0FFC2]">
                    <Bot className="w-3.5 h-3.5 text-[#3fa57a]" />
                    <span>{landing.previewAiLabel}</span>
                  </div>
                  <p className="leading-relaxed text-[11px] sm:text-xs font-medium text-[#0B2B22] dark:text-white">
                    {landing.previewAiLead}
                    <strong>{landing.previewAiHighlight}</strong>
                    {landing.previewAiBody}
                  </p>
                </div>
              </div>

              {/* Mandatory AI Disclaimer & "Book appointment" Button */}
              <div className="pt-2.5 border-t border-[#B9E68E]/80 dark:border-[#1E5C47] space-y-2.5">
                <div className="flex items-start gap-1.5 text-[10px] text-[#0B2B22] dark:text-white bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 leading-relaxed font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{t.aiDisclaimer}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-bold text-[#0B2B22] dark:text-white">
                    {landing.previewFollowUp}
                  </span>
                  <button
                    type="button"
                    onClick={() => openRoleLoginPage('patient', 'login')}
                    className="btn-forest-primary px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    {landing.previewBookCta}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CORE FEATURE HIGHLIGHTS SECTION */}
      <section
        id="feature-cards"
        ref={featureCardsRef}
        className="relative z-10 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-7xl 2xl:max-w-[1440px] mx-auto w-full space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-[#064734] bg-[#E0FFC2] px-3 py-1 rounded-lg border border-[#B9E68E]">
              {landing.featuresSectionBadge}
            </span>
            <h2 className="text-section-h2 text-[#064734] dark:text-[#E0FFC2]">
              {landing.featuresSectionHeading}
            </h2>
            <p className="text-sm sm:text-base text-[#284D41] dark:text-slate-200 font-medium">
              {landing.featuresSectionSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openRoleLoginPage('patient', 'signup')}
            className="btn-forest-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer self-start md:self-auto whitespace-nowrap"
          >
            <span>{landing.getStartedFreeBtn}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-stretch transition-transform duration-150"
          style={
            reducedMotion
              ? undefined
              : {
                  transform: `translate3d(${-16 * (1 - cardsProgress)}px, 0, 0)`,
                }
          }
        >
          {landing.features.map((card) => {
            const Icon = FEATURE_ICONS[card.id];
            return (
              <div
                key={card.id}
                className="card-3d-tilt bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#064734] text-[#E0FFC2] flex items-center justify-center shadow-xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-extrabold text-[#064734] dark:text-[#E0FFC2] tracking-tight">
                      {card.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#0B2B22] dark:text-white/90 leading-relaxed font-medium">
                      {card.description}
                    </p>
                  </div>

                  <ul className="space-y-1.5 pt-1">
                    {card.highlights.map((point) => (
                      <li
                        key={point}
                        className="flex items-center gap-2 text-xs font-semibold text-[#284D41] dark:text-[#E0FFC2]/90"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#3fa57a] shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-5 mt-5 border-t border-[#B9E68E]/80 dark:border-[#1E5C47]">
                  <button
                    type="button"
                    onClick={() => openRoleLoginPage('patient', 'login')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#064734] dark:text-[#E0FFC2] hover:text-[#137A5B] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <span>{card.ctaLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. SCROLL TEXT REVEAL SECTION: "How it works" */}
      <section
        id="how-it-works-reveal"
        className="relative z-10 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-8"
      >
        <div className="text-center space-y-2.5">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-[#064734] bg-[#E0FFC2] px-3 py-1 rounded-lg border border-[#B9E68E]">
            {landing.howItWorksBadge}
          </span>
          <h2 className="text-section-h2 text-[#064734] dark:text-[#E0FFC2]">
            {landing.howItWorksHeading}
          </h2>
          <p className="text-caption text-[#284D41] dark:text-slate-200 max-w-xl mx-auto">
            {landing.howItWorksSubtitle}
          </p>
        </div>

        {/* 5 Scroll-Tied Revealing Text Lines on a Solid Elevated Card */}
        <div className="bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] rounded-3xl p-6 sm:p-10 lg:p-12 shadow-sm space-y-6 sm:space-y-7">
          {landing.scrollRevealLines.map((line, idx) => {
            const p = reducedMotion ? 1 : lineProgress[idx] || 0;
            const opacity = reducedMotion ? 1 : Math.max(0.42, 0.42 + 0.58 * p);
            const translateX = reducedMotion ? 0 : -18 * (1 - p);
            const isCurrentlyRevealing = idx === activeLineIndex;

            return (
              <div
                key={idx}
                ref={(el) => {
                  revealLinesRef.current[idx] = el;
                }}
                className={`transition-all duration-150 text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight leading-snug ${
                  p > 0.5 ? 'text-[#064734] dark:text-[#E0FFC2]' : 'text-[#284D41] dark:text-white/70'
                }`}
                style={{
                  opacity,
                  transform: `translate3d(${translateX}px, 0, 0)`,
                  willChange: 'transform, opacity',
                }}
              >
                <span>{line}</span>
                {/* Thin blinking cursor on line currently being revealed */}
                {isCurrentlyRevealing && !reducedMotion && (
                  <span
                    aria-hidden="true"
                    className="cursor-blink inline-block w-1 h-5 sm:h-7 bg-[#3fa57a] ml-2 align-middle rounded-full"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 7. STATIC SAFETY NOTE: Fixed, non-animated note below cards */}
        <div
          aria-label="Medical safety notice"
          className="p-5 sm:p-6 rounded-3xl bg-red-50 dark:bg-red-950/70 border-2 border-red-400 dark:border-red-600 shadow-xs space-y-2 text-left"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs sm:text-sm text-red-950 dark:text-red-100">
              <p className="font-bold text-red-800 dark:text-red-300">
                {landing.emergencyNoteStrong}
              </p>
              <p className="text-red-900/90 dark:text-red-200 text-xs font-medium">
                {t.aiDisclaimer}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. MAIN PORTAL WORKSPACE: Separate Login Portals (Patient -> Doctor -> Admin) & Demo Switcher */}
      <main
        id="auth-portal"
        className="relative z-10 page-transition flex-1 max-w-7xl 2xl:max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10"
      >
        {/* Dedicated Separate Login Portal Cards in Order: 01 Patient -> 02 Doctor -> 03 Admin */}
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-[#064734] bg-[#E0FFC2] px-3 py-1 rounded-xl border border-[#B9E68E] mb-2">
                {landing.portalsBadge}
              </span>
              <h2 className="text-2xl font-extrabold text-[#064734] dark:text-[#E0FFC2] tracking-tight">
                {landing.portalsHeading}
              </h2>
              <p className="text-xs sm:text-sm text-[#284D41] dark:text-white/85 font-medium mt-1">
                {landing.portalsSubtitle}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-300 flex items-start gap-2.5 text-xs text-red-900 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* 01. PATIENT LOGIN CARD */}
            <div className="card-3d-tilt bg-white dark:bg-[#073528] border-2 border-[#064734] dark:border-[#B9E68E] rounded-3xl shadow-sm p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-[#064734] text-[#E0FFC2] flex items-center justify-center shadow-xs">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono-tabular font-extrabold px-2.5 py-1 rounded-xl bg-[#E0FFC2] text-[#064734]">
                    {landing.patientCardTag}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#064734] dark:text-[#E0FFC2]">
                    {landing.patientCardTitle}
                  </h3>
                  <p className="text-xs text-[#284D41] dark:text-white/85 leading-relaxed font-medium mt-1">
                    {landing.patientCardDesc}
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-[#B9E68E]">
                <button
                  type="button"
                  onClick={() => openRoleLoginPage('patient', 'login')}
                  className="btn-forest-primary w-full py-2.5 px-4 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{landing.patientCardOpenBtn}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => openRoleLoginPage('patient', 'signup')}
                  className="btn-forest-secondary w-full py-2 px-4 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {landing.patientCardSignupBtn}
                </button>
              </div>
            </div>

            {/* 02. DOCTOR LOGIN CARD */}
            <div className="card-3d-tilt bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] rounded-3xl shadow-sm p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-[#E0FFC2] text-[#064734] border border-[#B9E68E] flex items-center justify-center shadow-xs">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono-tabular font-extrabold px-2.5 py-1 rounded-xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] text-[#064734] dark:text-[#E0FFC2]">
                    {landing.doctorCardTag}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#064734] dark:text-[#E0FFC2]">
                    {landing.doctorCardTitle}
                  </h3>
                  <p className="text-xs text-[#284D41] dark:text-white/85 leading-relaxed font-medium mt-1">
                    {landing.doctorCardDesc}
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-[#B9E68E]">
                <button
                  type="button"
                  onClick={() => openRoleLoginPage('doctor', 'login')}
                  className="btn-forest-primary w-full py-2.5 px-4 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{landing.doctorCardOpenBtn}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => openRoleLoginPage('doctor', 'signup')}
                  className="btn-forest-secondary w-full py-2 px-4 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {landing.doctorCardSignupBtn}
                </button>
              </div>
            </div>

            {/* 03. ADMIN LOGIN CARD */}
            <div className="card-3d-tilt bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] rounded-3xl shadow-sm p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-[#E0FFC2] text-[#064734] border border-[#B9E68E] flex items-center justify-center shadow-xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono-tabular font-extrabold px-2.5 py-1 rounded-xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] text-[#064734] dark:text-[#E0FFC2]">
                    {landing.adminCardTag}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#064734] dark:text-[#E0FFC2]">
                    {landing.adminCardTitle}
                  </h3>
                  <p className="text-xs text-[#284D41] dark:text-white/85 leading-relaxed font-medium mt-1">
                    {landing.adminCardDesc}
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-[#B9E68E]">
                <button
                  type="button"
                  onClick={() => openRoleLoginPage('admin', 'login')}
                  className="btn-forest-primary w-full py-2.5 px-4 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{landing.adminCardOpenBtn}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
                <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-[#284D41] dark:text-white/75">
                  <Lock className="w-3.5 h-3.5 text-[#064734] dark:text-[#E0FFC2]" />
                  <span>{landing.adminCardNotice}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Instant Demo Credentials Switcher + Clinical Services Overview */}
        <div className="space-y-6" id="demo-accounts">
          <div className="bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] rounded-3xl shadow-sm p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#064734] dark:text-[#E0FFC2]">
                  {landing.demoHeading}
                </h2>
                <p className="text-xs text-[#284D41] dark:text-white/85 font-medium mt-0.5">
                  {landing.demoSubtitle}
                </p>
              </div>
              <span className="text-xs font-mono-tabular px-3 py-1 rounded-xl bg-[#E0FFC2] text-[#064734] font-bold">
                {landing.demoBadge}
              </span>
            </div>

            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full min-w-[600px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#B9E68E] text-xs font-bold text-[#064734] dark:text-[#E0FFC2]">
                    <th className="py-2.5 pr-3">{landing.demoColName}</th>
                    <th className="py-2.5 px-3">{landing.demoColRole}</th>
                    <th className="py-2.5 px-3">{landing.demoColCreds}</th>
                    <th className="py-2.5 pl-3 text-right">{landing.demoColAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#B9E68E]/60 text-xs">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <tr
                      key={acc.email}
                      className="hover:bg-[#E0FFC2]/35 dark:hover:bg-[#064734]/50 transition-colors"
                    >
                      <td className="py-3 pr-3">
                        <div className="font-bold text-[#0B2B22] dark:text-white">{acc.label}</div>
                        <div className="text-[#284D41] dark:text-white/80 font-medium">{acc.detail}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-[#064734] dark:text-[#E0FFC2] whitespace-nowrap">
                        {acc.role}
                      </td>
                      <td className="py-3 px-3 font-mono-tabular text-[#284D41] dark:text-white/90 font-medium whitespace-nowrap">
                        {acc.email} · {acc.password}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={(e) => handleQuickDemoLogin(e, acc.email, acc.password)}
                          className="btn-forest-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 font-bold rounded-xl shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-60"
                        >
                          <KeyRound className="w-3 h-3 text-white" />
                          <span>{landing.demoLoginBtn}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clinical Services Overview Cards */}
          <div className="bg-white dark:bg-[#073528] border-2 border-[#B9E68E] dark:border-[#1E5C47] rounded-3xl shadow-sm p-6 sm:p-7 space-y-4">
            <h3 className="text-base font-bold text-[#064734] dark:text-[#E0FFC2]">
              {landing.servicesHeading}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs items-stretch">
              <div className="card-3d-tilt p-4 rounded-2xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-[#064734] dark:text-[#E0FFC2] mb-1.5">
                    <Sparkles className="w-4 h-4 text-[#3fa57a] shrink-0" />
                    <span>{landing.services[0].title}</span>
                  </div>
                  <p className="leading-relaxed text-[#0B2B22] dark:text-white font-medium">
                    {landing.services[0].description}
                  </p>
                </div>
              </div>
              <div className="card-3d-tilt p-4 rounded-2xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-[#064734] dark:text-[#E0FFC2] mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#3fa57a] shrink-0" />
                    <span>{landing.services[1].title}</span>
                  </div>
                  <p className="leading-relaxed text-[#0B2B22] dark:text-white font-medium">
                    {landing.services[1].description}
                  </p>
                </div>
              </div>
              <div className="card-3d-tilt p-4 rounded-2xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-[#064734] dark:text-[#E0FFC2] mb-1.5">
                    <Calendar className="w-4 h-4 text-[#3fa57a] shrink-0" />
                    <span>{landing.services[2].title}</span>
                  </div>
                  <p className="leading-relaxed text-[#0B2B22] dark:text-white font-medium">
                    {landing.services[2].description}
                  </p>
                </div>
              </div>
              <div className="card-3d-tilt p-4 rounded-2xl bg-[#F3FFE7] dark:bg-[#04281d] border border-[#B9E68E] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-[#064734] dark:text-[#E0FFC2] mb-1.5">
                    <UserCheck className="w-4 h-4 text-[#3fa57a] shrink-0" />
                    <span>{landing.services[3].title}</span>
                  </div>
                  <p className="leading-relaxed text-[#0B2B22] dark:text-white font-medium">
                    {landing.services[3].description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-[#B9E68E] dark:border-[#1E5C47] py-7 px-4 sm:px-6 text-center text-xs font-semibold text-[#284D41] dark:text-white/80 bg-[#F3FFE7] dark:bg-[#04281d] space-y-2">
        <p className="text-[#064734] dark:text-[#E0FFC2] font-bold">
          MedAssist · {landing.heroTagline}
        </p>
        <p className="text-[11px] opacity-85">
          {landing.footerHighlightStrip}
        </p>
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
