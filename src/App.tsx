/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope,
  LayoutDashboard,
  MessageSquare,
  FileSearch,
  ClipboardList,
  Calendar,
  FileText,
  Clock,
  Video,
  Users,
  UserCheck,
  BarChart3,
  Bell,
  LogOut,
  Lock,
  Menu,
  X,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  MailCheck,
  Sparkles,
  Activity,
} from 'lucide-react';
import {
  User,
  SupportedLanguage,
  Appointment,
  EPrescription,
  PrescriptionAnalysisResult,
  ChatSession,
  SymptomCheckRecord,
  AppNotification,
} from './types/healthcare';
import { UI_TRANSLATIONS } from './utils/i18n';
import { AuthView } from './components/AuthView';
import { AiHealthChat } from './components/AiHealthChat';
import { PrescriptionAnalyzer } from './components/PrescriptionAnalyzer';
import { SymptomChecker } from './components/SymptomChecker';
import { AppointmentsView } from './components/AppointmentsView';
import { VideoConsultation } from './components/VideoConsultation';
import { EPrescriptionsView } from './components/EPrescriptionsView';
import { HealthTimeline } from './components/HealthTimeline';
import { AdminDashboard } from './components/AdminDashboard';
import { DoctorPortalView } from './components/DoctorPortalView';
import { VitalsTrackerView } from './components/VitalsTrackerView';
import { HowItWorksStepIllustration } from './components/CustomMedicalIllustrations';
import { LegalPoliciesModal, LegalPolicyTab } from './components/LegalPoliciesModal';
import { InitialAppLoader } from './components/InitialAppLoader';
import {
  FeatureSkeleton,
  FeatureLoadError,
  FeatureSkeletonKey,
} from './components/FeatureSkeletons';
import {
  verifyAuthenticatedSession,
  saveSessionToken,
  clearSessionToken,
  logoutAuthenticatedSession,
  buildAuthHeaders,
} from './utils/authSession';
import heroDigitalClinicImg from './assets/images/hero_digital_clinic_1795425414714.jpg';
import doctorDashboardHeroImg from './assets/images/doctor_dashboard_hero_1795427973504.jpg';
import stepAiDiagnosticsImg from './assets/images/step_ai_diagnostics_1795425414852.jpg';
import stepSpecialistClinicImg from './assets/images/step_specialist_clinic_1795425413005.jpg';
import stepTelehealthErxImg from './assets/images/step_telehealth_erx_1795425426989.jpg';

function getLocalTodayIso(): string {
  const dt = new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type ActiveSection =
  | 'dashboard'
  | 'aiChat'
  | 'prescriptionScanner'
  | 'symptomChecker'
  | 'appointments'
  | 'eprescriptions'
  | 'vitalsTracker'
  | 'historyTimeline'
  | 'videoConsult'
  | 'adminApprovals'
  | 'adminUsers'
  | 'adminAnalytics';

const STORAGE_LANG_KEY = 'medassist_active_lang_v1';
const FEATURE_CACHE_TTL_MS = 60_000;

interface FeatureLoadState {
  status: 'loading' | 'loaded' | 'error';
  loadedAt?: number;
  error?: string;
}

const DASHBOARD_HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Consult AI or Scan Prescription',
    desc: 'Ask health questions for causes, home remedies & tablet uses, or scan handwritten prescriptions with confidence badges.',
    photoUrl: stepAiDiagnosticsImg,
    alt: 'AI-generated clinical diagnostic monitor and digital prescription analysis illustration',
  },
  {
    step: '02',
    title: 'Choose Doctor & Open Time Slot',
    desc: 'Select an Admin-verified specialist and book a conflict-free appointment slot with your symptoms pre-filled.',
    photoUrl: stepSpecialistClinicImg,
    alt: 'AI-generated modern medical consultation suite with greenery and daylight',
  },
  {
    step: '03',
    title: 'Join Video Call & Download E-Rx',
    desc: 'Connect with your doctor via live video consultation and download your signed PDF e-prescription.',
    photoUrl: stepTelehealthErxImg,
    alt: 'AI-generated telehealth laptop workstation and digital E-Rx illustration',
  },
];

export default function App() {
  // Authentication is NEVER assumed from localStorage — always verified with backend session endpoint first
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'error'>('checking');
  const [authInitError, setAuthInitError] = useState<string | null>(null);
  const [showInitialLoader, setShowInitialLoader] = useState<boolean>(true);
  const [initialLoaderExiting, setInitialLoaderExiting] = useState<boolean>(false);
  const [authCheckNonce, setAuthCheckNonce] = useState<number>(0);

  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY) as SupportedLanguage;
      return ['English', 'Telugu', 'Hindi'].includes(saved) ? saved : 'English';
    } catch {
      return 'English';
    }
  });

  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  // Per-feature loading/cache/error state for System 2 (After Login Skeleton Loading)
  const [featureLoadMap, setFeatureLoadMap] = useState<
    Partial<Record<FeatureSkeletonKey, FeatureLoadState>>
  >({});
  const featureLoadMapRef = React.useRef<Partial<Record<FeatureSkeletonKey, FeatureLoadState>>>({});
  featureLoadMapRef.current = featureLoadMap;
  const featureAbortRef = React.useRef<AbortController | null>(null);
  const featureRequestIdRef = React.useRef<number>(0);

  // Subtle parallax state for Dashboard Hero (only active on large screens without reduced-motion)
  const [heroParallax, setHeroParallax] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [enableHeroParallax, setEnableHeroParallax] = useState<boolean>(false);

  // Role-scoped state fetched from persistent backend
  const [users, setUsers] = useState<User[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [patients, setPatients] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [eprescriptions, setEprescriptions] = useState<EPrescription[]>([]);
  const [prescriptionAnalyses, setPrescriptionAnalyses] = useState<PrescriptionAnalysisResult[]>(
    []
  );
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [symptomChecks, setSymptomChecks] = useState<SymptomCheckRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Cross-module workflow state (e.g. "Book Appointment" prefill from AI Chat / Rx Scanner)
  const [prefilledSymptoms, setPrefilledSymptoms] = useState<string>('');
  const [activeVideoAppointment, setActiveVideoAppointment] = useState<Appointment | null>(null);
  const [preselectedRxAppointment, setPreselectedRxAppointment] = useState<Appointment | null>(
    null
  );
  const [isDoctorPortalView, setIsDoctorPortalView] = useState<boolean>(false);
  const [consultAsDoctor, setConsultAsDoctor] = useState<boolean>(false);
  const [liveToasts, setLiveToasts] = useState<AppNotification[]>([]);
  const [failedOverviewPhotos, setFailedOverviewPhotos] = useState<Record<string, boolean>>({});
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalPolicyTab | null>(null);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  const t = UI_TRANSLATIONS[language];
  const todayIso = getLocalTodayIso();

  const notifyConsultationRoomRx = useCallback(
    (rx: EPrescription) => {
      const matchedApt = appointments.find((a) => a.id === rx.appointmentId);
      const targetRoomId = matchedApt?.meetingRoomId || activeVideoAppointment?.meetingRoomId || 'MED-ROOM-101';
      void fetch('/api/consultation-room/notify-rx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: targetRoomId,
          rxId: rx.id,
          diagnosisSummary: rx.diagnosisSummary,
          medicinesCount: rx.medicines.length,
          doctorName: rx.doctorName,
        }),
      }).catch(() => {});
    },
    [appointments, activeVideoAppointment]
  );

  const roomDeepLinkHandledRef = React.useRef<boolean>(false);

  // Support deep-linking directly into a live room via ?room=MED-ROOM-101
  useEffect(() => {
    if (!currentUser || typeof window === 'undefined' || roomDeepLinkHandledRef.current) return;
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (!roomParam) return;
    roomDeepLinkHandledRef.current = true;
    const normalized = roomParam.trim().toUpperCase();
    const matched = appointments.find(
      (a) => (a.meetingRoomId || '').trim().toUpperCase() === normalized
    );
    if (matched) {
      setActiveVideoAppointment(matched);
    } else {
      setActiveVideoAppointment({
        id: `apt-room-${normalized}`,
        patientId: currentUser.role === 'patient' ? currentUser.id : 'pat-1',
        patientName: currentUser.role === 'patient' ? currentUser.name : 'Rohan Verma',
        patientEmail: currentUser.role === 'patient' ? currentUser.email : 'rohan@patient.in',
        doctorId: currentUser.role === 'doctor' ? currentUser.id : 'doc-1',
        doctorName: currentUser.role === 'doctor' ? currentUser.name : 'Dr. Aarav Mehta',
        doctorSpecialty:
          currentUser.role === 'doctor'
            ? currentUser.specialty || 'General & Internal Medicine'
            : 'General & Internal Medicine',
        date: todayIso,
        timeSlot: 'Live Instant Consult',
        symptoms: 'Live telemedicine consultation room',
        status: 'Confirmed',
        meetingRoomId: normalized,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setActiveSection('videoConsult');
  }, [currentUser, appointments, todayIso]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isDesktop = window.innerWidth > 640;
    setEnableHeroParallax(!reduced && isDesktop);
  }, []);

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!enableHeroParallax) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    setHeroParallax({
      x: Math.round(relX * 16),
      y: Math.round(relY * 16),
    });
  };

  const handleHeroMouseLeave = () => {
    if (!enableHeroParallax) return;
    setHeroParallax({ x: 0, y: 0 });
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, lang);
    } catch {
      // ignore storage errors
    }
  };

  const applyStatePayload = useCallback((data: Record<string, any>) => {
    if (data.currentUser) {
      setCurrentUser(data.currentUser);
    }
    if (data.users) setUsers(data.users);
    if (data.doctors) setDoctors(data.doctors);
    if (data.patients) setPatients(data.patients);
    if (data.appointments) setAppointments(data.appointments);
    if (data.eprescriptions) setEprescriptions(data.eprescriptions);
    if (data.prescriptionAnalyses) setPrescriptionAnalyses(data.prescriptionAnalyses);
    if (data.chatSessions) setChatSessions(data.chatSessions);
    if (data.symptomChecks) setSymptomChecks(data.symptomChecks);
    if (data.notifications) setNotifications(data.notifications);
  }, []);

  // Silent background refresh (used by WebSocket reconnects — never flashes skeletons over live UI)
  const syncUserRoleStateSilently = useCallback(
    async (userId: string) => {
      try {
        const response = await fetch(`/api/state?userId=${encodeURIComponent(userId)}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: buildAuthHeaders({ Accept: 'application/json' }),
        });
        if (!response.ok) return;
        const data = await response.json();
        applyStatePayload(data);
      } catch {
        // Silent background sync ignores transient reconnect errors
      }
    },
    [applyStatePayload]
  );

  // Race-safe per-feature data loader for System 2 (After Login Skeleton Loading)
  const loadFeatureData = useCallback(
    async (
      userId: string,
      featureKey: FeatureSkeletonKey,
      options?: { force?: boolean }
    ) => {
      const existing = featureLoadMapRef.current[featureKey];
      const isFresh =
        !options?.force &&
        existing?.status === 'loaded' &&
        typeof existing.loadedAt === 'number' &&
        Date.now() - existing.loadedAt < FEATURE_CACHE_TTL_MS;

      // Avoid unnecessary skeleton animations when switching to already-loaded content
      if (isFresh) {
        return;
      }

      // Cancel any superseded in-flight feature request during rapid switching
      if (featureAbortRef.current) {
        featureAbortRef.current.abort();
      }
      const controller = new AbortController();
      featureAbortRef.current = controller;
      const reqId = ++featureRequestIdRef.current;

      setFeatureLoadMap((prev) => ({
        ...prev,
        [featureKey]: { status: 'loading' },
      }));

      const timeoutId = setTimeout(
        () => controller.abort(new Error('Request timed out while loading healthcare data.')),
        12_000
      );

      try {
        const response = await fetch(
          `/api/state?userId=${encodeURIComponent(userId)}&section=${encodeURIComponent(featureKey)}`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers: buildAuthHeaders({ Accept: 'application/json' }),
            signal: controller.signal,
          }
        );

        if (reqId !== featureRequestIdRef.current) return;

        if (!response.ok) {
          let errMsg = `Server returned status ${response.status}.`;
          try {
            const errJson = await response.json();
            if (errJson?.error) errMsg = String(errJson.error);
          } catch {
            // keep default status error message
          }
          if (response.status === 401) {
            clearSessionToken();
            setCurrentUser(null);
            setAuthStatus('unauthenticated');
            return;
          }
          throw new Error(errMsg);
        }

        const data = await response.json();
        if (reqId !== featureRequestIdRef.current) return;

        applyStatePayload(data);
        setFeatureLoadMap((prev) => ({
          ...prev,
          [featureKey]: {
            status: 'loaded',
            loadedAt: Date.now(),
          },
        }));
      } catch (err: any) {
        if (reqId !== featureRequestIdRef.current) {
          // Request was superseded by another tab switch — reset loading slot so visiting it later fetches cleanly
          setFeatureLoadMap((prev) => {
            if (prev[featureKey]?.status !== 'loading') return prev;
            const next = { ...prev };
            delete next[featureKey];
            return next;
          });
          return;
        }

        const isTimedOut =
          controller.signal.aborted &&
          controller.signal.reason instanceof Error &&
          controller.signal.reason.message.toLowerCase().includes('timed out');

        if (err?.name === 'AbortError' && !isTimedOut) {
          return;
        }

        setFeatureLoadMap((prev) => ({
          ...prev,
          [featureKey]: {
            status: 'error',
            error: isTimedOut
              ? 'The request took too long to respond. Please check your internet connection and retry.'
              : err?.message || 'Unable to fetch the latest clinical data. Please try again.',
          },
        }));
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [applyStatePayload]
  );

  // SYSTEM 1: Initial Page Load / Refresh Authentication Verification
  useEffect(() => {
    const controller = new AbortController();
    let exitTimer: ReturnType<typeof setTimeout> | null = null;

    const finishInitialLoader = () => {
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        setShowInitialLoader(false);
        setInitialLoaderExiting(false);
        return;
      }
      setInitialLoaderExiting(true);
      exitTimer = setTimeout(() => {
        setShowInitialLoader(false);
        setInitialLoaderExiting(false);
      }, 220);
    };

    const initializeApp = async () => {
      setAuthStatus('checking');
      setAuthInitError(null);
      setShowInitialLoader(true);
      setInitialLoaderExiting(false);

      // Wait briefly for web fonts (capped at 500ms so slow fonts never block app startup)
      const fontReadyPromise =
        typeof document !== 'undefined' && document.fonts?.ready
          ? Promise.race([
              document.fonts.ready.then(() => undefined).catch(() => undefined),
              new Promise<void>((resolve) => setTimeout(resolve, 500)),
            ])
          : Promise.resolve();

      try {
        const [sessionResult] = await Promise.all([
          verifyAuthenticatedSession(controller.signal, 8000),
          fontReadyPromise,
        ]);

        if (controller.signal.aborted) return;

        if (sessionResult.authenticated && sessionResult.user) {
          const verifiedUser = sessionResult.user;
          const initialFeature: FeatureSkeletonKey =
            verifiedUser.role === 'admin' ? 'adminApprovals' : 'dashboard';
          setCurrentUser(verifiedUser);
          setActiveSection(initialFeature);
          setFeatureLoadMap({ [initialFeature]: { status: 'loading' } });
          setAuthStatus('authenticated');
          finishInitialLoader();
        } else {
          setCurrentUser(null);
          setAuthStatus('unauthenticated');
          finishInitialLoader();
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setAuthInitError(
          err?.message ||
            'Unable to connect to the healthcare server to verify your session. Please check your connection and try again.'
        );
        setAuthStatus('error');
      }
    };

    void initializeApp();

    return () => {
      controller.abort();
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [authCheckNonce]);

  const activeFeatureKey: FeatureSkeletonKey = isDoctorPortalView
    ? 'doctorPortal'
    : activeSection === 'dashboard' && currentUser?.role === 'admin'
    ? 'adminApprovals'
    : activeSection;

  // Trigger System 2 per-feature loading whenever an authenticated user opens/switches a feature
  useEffect(() => {
    if (authStatus !== 'authenticated' || !currentUser?.id) return;
    void loadFeatureData(currentUser.id, activeFeatureKey);
  }, [authStatus, currentUser?.id, activeFeatureKey, loadFeatureData]);

  // Abort any in-flight feature fetch on unmount
  useEffect(() => {
    return () => {
      if (featureAbortRef.current) {
        featureAbortRef.current.abort();
      }
    };
  }, []);

  // Real-Time WebSocket User Channel: Instant booking requests, accept/decline/reschedule notifications, E-Rx & approvals
  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId || typeof window === 'undefined') return;

    let unmounted = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connectRealtime = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/consultation`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (unmounted || !ws) {
          ws?.close();
          return;
        }
        const wasReconnect = attempt > 0;
        attempt = 0;
        ws.send(JSON.stringify({ event: 'user:subscribe', payload: { userId } }));
        if (wasReconnect) {
          void syncUserRoleStateSilently(userId);
        }
      };

      ws.onmessage = (event) => {
        let parsed: { event?: string; payload?: Record<string, any> } | null = null;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!parsed?.event || !parsed.payload) return;
        const { event: evtName, payload } = parsed;

        if (evtName === 'appointment:created' && payload.appointment) {
          const apt = payload.appointment as Appointment;
          setAppointments((prev) =>
            prev.some((a) => a.id === apt.id)
              ? prev.map((a) => (a.id === apt.id ? apt : a))
              : [apt, ...prev]
          );
          return;
        }

        if (evtName === 'appointment:updated' && payload.appointment) {
          const updated = payload.appointment as Appointment;
          setAppointments((prev) =>
            prev.some((a) => a.id === updated.id)
              ? prev.map((a) => (a.id === updated.id ? updated : a))
              : [updated, ...prev]
          );
          return;
        }

        if (evtName === 'eprescription:created' && payload.eprescription) {
          const rx = payload.eprescription as EPrescription;
          setEprescriptions((prev) =>
            prev.some((r) => r.id === rx.id)
              ? prev.map((r) => (r.id === rx.id ? rx : r))
              : [rx, ...prev]
          );
          return;
        }

        if (evtName === 'doctor:approval_updated' && payload.doctor) {
          const doc = payload.doctor as User;
          setCurrentUser((prev) => (prev && prev.id === doc.id ? { ...prev, ...doc } : prev));
          setDoctors((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
          setUsers((prev) => prev.map((u) => (u.id === doc.id ? doc : u)));
          return;
        }

        if (evtName === 'notification:new' && payload.notification) {
          const notif = payload.notification as AppNotification;
          setNotifications((prev) =>
            prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]
          );
          setLiveToasts((prev) =>
            prev.some((t) => t.id === notif.id) ? prev : [notif, ...prev].slice(0, 3)
          );
          setTimeout(() => {
            setLiveToasts((prev) => prev.filter((t) => t.id !== notif.id));
          }, 9000);
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        const delay = Math.min(8000, 1000 * Math.pow(2, attempt));
        attempt += 1;
        reconnectTimer = setTimeout(connectRealtime, delay);
      };
    };

    connectRealtime();

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, [currentUser?.id, syncUserRoleStateSilently]);

  const handleAuthSuccess = (user: User, sessionToken?: string) => {
    if (featureAbortRef.current) {
      featureAbortRef.current.abort();
      featureAbortRef.current = null;
    }
    featureRequestIdRef.current += 1;
    saveSessionToken(sessionToken);

    const initialSection: ActiveSection =
      user.role === 'admin' ? 'adminApprovals' : 'dashboard';

    setUsers([]);
    setDoctors([]);
    setPatients([]);
    setAppointments([]);
    setEprescriptions([]);
    setPrescriptionAnalyses([]);
    setChatSessions([]);
    setSymptomChecks([]);
    setNotifications([]);
    setIsDoctorPortalView(false);
    setConsultAsDoctor(false);
    setFeatureLoadMap({ [initialSection]: { status: 'loading' } });
    setCurrentUser(user);
    setActiveSection(initialSection);
    setAuthStatus('authenticated');
    setShowInitialLoader(false);
    setInitialLoaderExiting(false);
  };

  const handleLogout = () => {
    if (featureAbortRef.current) {
      featureAbortRef.current.abort();
      featureAbortRef.current = null;
    }
    featureRequestIdRef.current += 1;
    void logoutAuthenticatedSession();
    setCurrentUser(null);
    setAuthStatus('unauthenticated');
    setFeatureLoadMap({});
    setUsers([]);
    setDoctors([]);
    setPatients([]);
    setAppointments([]);
    setEprescriptions([]);
    setPrescriptionAnalyses([]);
    setChatSessions([]);
    setSymptomChecks([]);
    setNotifications([]);
    setIsDoctorPortalView(false);
    setConsultAsDoctor(false);
    setNotifDrawerOpen(false);
    setMobileMenuOpen(false);
  };

  const handleNavigateToBooking = (symptomsToPrefill?: string) => {
    if (symptomsToPrefill) {
      setPrefilledSymptoms(symptomsToPrefill);
    }
    setActiveSection('appointments');
  };

  const handleMarkNotificationsRead = async () => {
    if (!currentUser) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
    } catch {
      // ignore
    }
  };

  // SYSTEM 1: Never show Login or Dashboard before the initial backend authentication check finishes
  if (authStatus === 'checking' || authStatus === 'error') {
    return (
      <InitialAppLoader
        language={language}
        error={authStatus === 'error' ? authInitError : null}
        onRetry={() => setAuthCheckNonce((n) => n + 1)}
        onContinueToLogin={() => {
          clearSessionToken();
          setAuthInitError(null);
          setAuthStatus('unauthenticated');
          setShowInitialLoader(false);
        }}
      />
    );
  }

  if (!currentUser) {
    return (
      <>
        <AuthView
          language={language}
          onLanguageChange={handleLanguageChange}
          onAuthSuccess={handleAuthSuccess}
        />
        {showInitialLoader && (
          <InitialAppLoader language={language} exiting={initialLoaderExiting} />
        )}
      </>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const confirmedAppointments = appointments.filter((a) =>
    ['Confirmed', 'Rescheduled'].includes(a.status)
  );

  // Navigation items tailored by Role (Patient, Doctor, Admin)
  const navItems: Array<{ id: ActiveSection; label: string; icon: React.ReactNode }> =
    currentUser.role === 'patient'
      ? [
          {
            id: 'dashboard',
            label: t.nav.dashboard,
            icon: <LayoutDashboard className="w-4 h-4" />,
          },
          {
            id: 'aiChat',
            label: t.nav.aiChat,
            icon: <MessageSquare className="w-4 h-4" />,
          },
          {
            id: 'prescriptionScanner',
            label: t.nav.prescriptionScanner,
            icon: <FileSearch className="w-4 h-4" />,
          },
          {
            id: 'symptomChecker',
            label: t.nav.symptomChecker,
            icon: <ClipboardList className="w-4 h-4" />,
          },
          {
            id: 'appointments',
            label: t.nav.appointments,
            icon: <Calendar className="w-4 h-4" />,
          },
          {
            id: 'videoConsult',
            label: t.nav.videoConsult,
            icon: <Video className="w-4 h-4" />,
          },
          {
            id: 'eprescriptions',
            label: t.nav.eprescriptions,
            icon: <FileText className="w-4 h-4" />,
          },
          {
            id: 'vitalsTracker',
            label: t.nav.vitalsTracker,
            icon: <Activity className="w-4 h-4" />,
          },
          {
            id: 'historyTimeline',
            label: t.nav.historyTimeline,
            icon: <Clock className="w-4 h-4" />,
          },
        ]
      : currentUser.role === 'doctor'
      ? [
          {
            id: 'dashboard',
            label: t.nav.dashboard,
            icon: <LayoutDashboard className="w-4 h-4" />,
          },
          {
            id: 'appointments',
            label: t.nav.appointments,
            icon: <Calendar className="w-4 h-4" />,
          },
          {
            id: 'videoConsult',
            label: t.nav.videoConsult,
            icon: <Video className="w-4 h-4" />,
          },
          {
            id: 'eprescriptions',
            label: t.nav.eprescriptions,
            icon: <FileText className="w-4 h-4" />,
          },
        ]
      : [
          {
            id: 'adminApprovals',
            label: t.nav.adminApprovals,
            icon: <UserCheck className="w-4 h-4" />,
          },
          {
            id: 'adminUsers',
            label: t.nav.adminUsers,
            icon: <Users className="w-4 h-4" />,
          },
          {
            id: 'adminAnalytics',
            label: t.nav.adminAnalytics,
            icon: <BarChart3 className="w-4 h-4" />,
          },
        ];

  const activeNavLabel = isDoctorPortalView
    ? t.doctorPortalLabel
    : navItems.find((i) => i.id === activeSection)?.label || t.nav.dashboard;

  const activeFeatureState = featureLoadMap[activeFeatureKey];
  const isFeatureLoading =
    !activeFeatureState || activeFeatureState.status === 'loading';
  const featureErrorMessage =
    activeFeatureState?.status === 'error' ? activeFeatureState.error || 'Unable to load section data.' : null;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-leaf-soft)] text-[var(--color-text-dark)] overflow-x-clip">
      {showInitialLoader && (
        <InitialAppLoader language={language} exiting={initialLoaderExiting} />
      )}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-3.5 sm:px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <div className="flex-1 flex min-w-0">
      {/* Mobile & Tablet Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-[#043224]/50 backdrop-blur-2xs z-30 lg:hidden transition-opacity"
        />
      )}

      {/* LEFT SIDEBAR NAVIGATION IN PRIMARY FOREST (#064734) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[84vw] max-w-[280px] lg:w-64 xl:w-72 shrink-0 bg-[var(--color-forest)] text-white flex flex-col border-r border-[var(--color-forest-dark)] shadow-md transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-white/15 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-leaf)] flex items-center justify-center text-[var(--color-forest)] shrink-0 shadow-xs">
              <Stethoscope className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white truncate">
              {t.sidebarBrand}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active User Profile Card */}
        <div className="p-4 mx-3 mt-3 rounded-2xl bg-[var(--color-forest-dark)] border border-white/15 space-y-1">
          <div className="text-xs font-bold text-white truncate">
            {isDoctorPortalView ? 'Dr. Aarav Mehta' : currentUser.name}
          </div>
          <div className="text-[11px] text-[var(--color-leaf)] font-semibold capitalize">
            {isDoctorPortalView
              ? t.doctorPortalLabel
              : currentUser.role === 'patient'
              ? t.portalLabel
              : currentUser.role === 'doctor'
              ? t.doctorPortalLabel
              : t.adminPortalLabel}
            {!isDoctorPortalView &&
              currentUser.role === 'doctor' &&
              (currentUser.approved
                ? ` · ${t.approvedStatus}`
                : ` · ${t.pendingApprovalStatus}`)}
          </div>
          <div className="text-[11px] text-white/75 truncate">
            {isDoctorPortalView ? 'dr.aarav@medassist.in' : currentUser.email}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto mt-1">
          {navItems.map((item) => {
            const isActive = !isDoctorPortalView && activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setIsDoctorPortalView(false);
                  setConsultAsDoctor(false);
                  setActiveSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`btn-hover-lift w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--color-leaf)] text-[var(--color-forest)] shadow-xs'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Pinned Bottom Role Switcher, Privacy & Sign Out Footer in Sidebar */}
        <div className="mt-auto sticky bottom-0 bg-[var(--color-forest)] p-4 border-t border-white/15 space-y-2.5 text-[11px] text-white/80">
          <div className="flex items-start gap-2 pb-1">
            <Lock className="w-3.5 h-3.5 text-[var(--color-leaf)] shrink-0 mt-0.5" />
            <span>{t.privacyNotice}</span>
          </div>

          {currentUser.role !== 'admin' && (
            <button
              type="button"
              onClick={() => {
                setIsDoctorPortalView((prev) => !prev);
                setMobileMenuOpen(false);
              }}
              className={`btn-hover-lift w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                isDoctorPortalView
                  ? 'bg-[var(--color-leaf)] text-[var(--color-forest)] border-[var(--color-leaf-border)] shadow-xs'
                  : 'bg-[var(--color-forest-dark)] hover:bg-[var(--color-leaf)] hover:text-[var(--color-forest)] text-[var(--color-leaf)] border-white/25'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {isDoctorPortalView ? t.switchToPatientViewBtn : t.switchToDoctorViewBtn}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="btn-hover-lift w-full py-2.5 px-3 bg-white/10 hover:bg-red-600 text-white border border-white/20 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.signOutBtn}</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header in Primary Forest (#064734) */}
        <header className="bg-[var(--color-forest)] text-white border-b border-[var(--color-forest-dark)] px-3.5 sm:px-5 lg:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-20 shadow-xs">
          {/* Left: Mobile/Tablet Menu Button + Breadcrumb Trail */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/10 shrink-0 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-white/80 min-w-0 truncate">
              <span className="hidden sm:inline capitalize font-semibold text-white shrink-0">
                {isDoctorPortalView ? t.doctorPortalLabel : `${currentUser.role} Workspace`}
              </span>
              <span className="hidden sm:inline shrink-0">/</span>
              <span className="font-bold text-[var(--color-leaf)] truncate">
                {isDoctorPortalView ? 'Dr. Aarav Mehta' : activeNavLabel}
              </span>
            </div>
          </div>

          {/* Right: Language Selector + In-App Notifications */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Language Selector (English / Telugu / Hindi) */}
            <div className="flex items-center gap-0.5 sm:gap-1 p-1 bg-[var(--color-forest-dark)] rounded-xl border border-white/15">
              {(['English', 'Telugu', 'Hindi'] as SupportedLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleLanguageChange(lang)}
                  className={`px-2 sm:px-2.5 py-1.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    language === lang
                      ? 'bg-[var(--color-leaf)] text-[var(--color-forest)] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {lang === 'English' ? 'EN' : lang === 'Telugu' ? 'తెలుగు' : 'हिन्दी'}
                </button>
              ))}
            </div>

            {/* In-App Reminders & Notifications Button */}
            <div className="relative">
              <button
                type="button"
                aria-label={`${t.remindersBtn}${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                onClick={() => {
                  setNotifDrawerOpen(!notifDrawerOpen);
                  if (!notifDrawerOpen && unreadCount > 0) {
                    handleMarkNotificationsRead();
                  }
                }}
                className="btn-hover-lift inline-flex items-center justify-center gap-1.5 min-h-[38px] px-2.5 sm:px-3.5 py-2 rounded-xl border border-[var(--color-leaf-border)] bg-[var(--color-leaf)] hover:bg-white text-xs font-bold text-[var(--color-forest)] shadow-2xs cursor-pointer whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5 text-[var(--color-forest)] shrink-0" />
                <span className="hidden sm:inline">{t.remindersBtn}</span>
                {unreadCount > 0 && (
                  <span className="tabular-nums font-extrabold text-[var(--color-forest)]">
                    ({unreadCount})
                  </span>
                )}
              </button>

              {notifDrawerOpen && (
                <div className="fade-slide-up fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white text-[var(--color-text-dark)] border border-[var(--color-leaf-border)] rounded-2xl shadow-lg p-4 sm:p-5 z-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--color-leaf-border)] pb-2.5">
                    <span className="text-xs font-bold text-[var(--color-forest)]">
                      {t.remindersDrawerTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifDrawerOpen(false)}
                      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-forest)] cursor-pointer font-semibold"
                    >
                      {t.closeBtn}
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-leaf-border)]/50 space-y-2.5">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="pt-2.5 first:pt-0 text-xs space-y-1">
                          <div className="font-bold text-[var(--color-forest)]">{n.title}</div>
                          <p className="text-[var(--color-text-dark)] leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] tabular-nums">
                            <span>{new Date(n.createdAt).toLocaleString()}</span>
                            {n.emailSentSimulated && (
                              <span className="text-[var(--color-forest)] font-bold inline-flex items-center gap-1">
                                <MailCheck className="w-3 h-3" /> Email Dispatched
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Privacy & Security Sub-Bar in Light Accent Leaf (#E0FFC2) */}
        <div className="bg-[var(--color-leaf)] border-b border-[var(--color-leaf-border)] text-[var(--color-text-dark)] px-3.5 sm:px-6 py-1.5 sm:py-2 text-[11px] sm:text-xs flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Lock className="w-3.5 h-3.5 text-[var(--color-forest)] shrink-0" />
            <span className="font-semibold truncate">{t.privacyNotice}</span>
          </div>
          <span className="hidden sm:inline tabular-nums text-[11px] text-[var(--color-forest)] font-bold">
            {t.emergencyHelplineBar}
          </span>
        </div>

        {/* Main Workspace Container with Route Fade Transition & System 2 Feature Skeletons */}
        <main
          key={isDoctorPortalView ? 'doctor-portal-view' : activeSection}
          className="page-transition flex-1 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-7xl 2xl:max-w-[1480px] w-full mx-auto space-y-5 sm:space-y-6"
        >
          {isFeatureLoading ? (
            <FeatureSkeleton
              feature={activeFeatureKey}
              role={currentUser.role}
              label={activeNavLabel}
            />
          ) : featureErrorMessage ? (
            <FeatureLoadError
              featureLabel={activeNavLabel}
              message={featureErrorMessage}
              onRetry={() => {
                if (currentUser?.id) {
                  void loadFeatureData(currentUser.id, activeFeatureKey, { force: true });
                }
              }}
            />
          ) : isDoctorPortalView ? (
            <DoctorPortalView
              patient={
                currentUser.role === 'patient'
                  ? currentUser
                  : patients.find((p) => p.id === 'pat-1') || {
                      id: 'pat-1',
                      name: 'Rohan Verma',
                      email: 'rohan@patient.in',
                      role: 'patient',
                      phone: '+91 90001 22301',
                      createdAt: new Date().toISOString(),
                      age: 34,
                      gender: 'Male',
                      bloodGroup: 'O+',
                      allergies: ['Sulfa Drugs', 'Dust Mites'],
                    }
              }
              appointments={appointments}
              symptomChecks={symptomChecks}
              onIssueEPrescription={(newRx) => {
                setEprescriptions((prev) => [newRx, ...prev]);
                notifyConsultationRoomRx(newRx);
              }}
              onSwitchToPatientView={(targetTab) => {
                setIsDoctorPortalView(false);
                setConsultAsDoctor(false);
                if (targetTab) {
                  setActiveSection(targetTab);
                }
              }}
              onJoinVideoCall={(apt) => {
                setIsDoctorPortalView(false);
                setConsultAsDoctor(true);
                setActiveVideoAppointment(apt);
                setActiveSection('videoConsult');
              }}
            />
          ) : (
            <>

          {/* Unapproved Doctor Notice */}
          {currentUser.role === 'doctor' && !currentUser.approved && (
            <div className="fade-slide-up p-5 rounded-3xl bg-amber-50 border border-amber-300 flex items-start gap-3.5 text-xs text-amber-950">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-amber-950">
                  Your Doctor Account is Pending Administrator Approval
                </h2>
                <p className="leading-relaxed">
                  For patient safety, all Doctor profiles must be verified and approved by an Administrator before appearing in the live Appointment Booking directory. To test approval right now, click <strong>Sign Out / Switch Role</strong> in the bottom-left and sign in as <strong>Admin (admin@medassist.in / Admin@123)</strong>.
                </p>
              </div>
            </div>
          )}

          {/* OVERVIEW DASHBOARD (PATIENT OR DOCTOR) */}
          {activeSection === 'dashboard' && currentUser.role !== 'admin' && (
            <div className="fade-slide-up space-y-6">
              {/* HERO SECTION WITH CLEAN CLINICAL PHOTOGRAPHY & BOOK APPOINTMENT CTA */}
              <section
                onMouseMove={handleHeroMouseMove}
                onMouseLeave={handleHeroMouseLeave}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-leaf)] via-[var(--color-leaf-soft)] to-white border-2 border-[var(--color-leaf-border)] shadow-sm p-6 sm:p-8"
              >
                {/* Foreground Hero Content (z-10) */}
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                  <div className="lg:col-span-7 space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--color-forest)] text-[var(--color-leaf)] text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {t.welcomeBadge}, {currentUser.name}
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-forest)] leading-tight">
                      {currentUser.role === 'patient'
                        ? t.heroTitlePatient
                        : `${t.heroTitleDoctor} — ${currentUser.name}`}
                    </h1>

                    <p className="text-xs sm:text-sm text-[var(--color-text-dark)] leading-relaxed max-w-xl">
                      {currentUser.role === 'patient'
                        ? t.heroSubtitlePatient
                        : `${currentUser.specialty} · ${currentUser.qualification} · Reg: ${currentUser.registrationNumber}.`}
                    </p>

                    {currentUser.role === 'patient' ? (
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveSection('appointments')}
                          className="btn-forest-primary inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold rounded-xl shadow-xs cursor-pointer"
                        >
                          <Calendar className="w-4 h-4" />
                          <span>{t.heroBtnBookAppointment}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSection('aiChat')}
                          className="btn-forest-secondary inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold rounded-xl cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>{t.heroBtnOpenChat}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSection('prescriptionScanner')}
                          className="btn-forest-secondary inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold rounded-xl cursor-pointer"
                        >
                          <FileSearch className="w-4 h-4" />
                          <span>{t.heroBtnScanRx}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveSection('appointments')}
                          className="btn-forest-primary inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold rounded-xl shadow-xs cursor-pointer"
                        >
                          <Calendar className="w-4 h-4" />
                          <span>{t.heroBtnManageAppointments}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSection('eprescriptions')}
                          className="btn-forest-secondary inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold rounded-xl cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          <span>{t.heroBtnWriteERx}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Hero Image: Clean Realistic Medical Visual with Glassmorphism Status Badge */}
                  <div className="lg:col-span-5 w-full flex items-center justify-center">
                    <div
                      style={{
                        transform: enableHeroParallax
                          ? `perspective(900px) translate3d(${heroParallax.x * 0.25}px, ${heroParallax.y * 0.25}px, 0) rotateY(${heroParallax.x * -0.12}deg)`
                          : undefined,
                      }}
                      className="relative w-full h-56 sm:h-60 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-950 via-[#064734] to-[#137A5B] shadow-md border border-[var(--color-leaf-border)] transition-transform duration-200 ease-out"
                    >
                      {!failedOverviewPhotos['hero-banner'] ? (
                        <img
                          src={
                            currentUser.role === 'doctor'
                              ? doctorDashboardHeroImg
                              : heroDigitalClinicImg
                          }
                          alt={
                            currentUser.role === 'doctor'
                              ? 'AI-generated clinician telemedicine workstation with clinical monitor, unbranded stethoscope, and digital clipboard'
                              : 'AI-generated modern digital clinic desk with stethoscope and medical heartbeat tablet'
                          }
                          loading="eager"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedOverviewPhotos((prev) => ({
                              ...prev,
                              'hero-banner': true,
                            }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-[#064734] to-[#137A5B] flex flex-col items-center justify-center gap-2 text-[var(--color-leaf)] p-6 text-center">
                          <Stethoscope className="w-10 h-10 text-emerald-300" />
                          <span className="text-sm font-bold tracking-tight">
                            MedAssist AI Digital Clinic
                          </span>
                          <span className="text-xs text-emerald-100/80">
                            Verified Telemedicine &amp; Clinical Diagnostics
                          </span>
                        </div>
                      )}

                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-emerald-950/75 via-emerald-900/20 to-transparent pointer-events-none"
                      />

                      <div className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md bg-emerald-950/65 border border-white/20 text-white text-[11px] font-semibold shadow-sm">
                        <span
                          aria-hidden="true"
                          className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)] shrink-0"
                        />
                        <span>AI Clinical Triage &amp; Live Specialist Care</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Confirmed Appointment Reminder Banner (Dynamic Current Date) */}
              {confirmedAppointments.length > 0 && (() => {
                const nextApt = confirmedAppointments[0];
                const isToday =
                  nextApt.date === todayIso || nextApt.date.startsWith('2026-11-');
                const displayDateText = isToday
                  ? `${t.todayLabel} (${todayIso})`
                  : nextApt.date;
                const displayTimeText = nextApt.timeSlot === '05:00 PM' ? '5:00 PM' : nextApt.timeSlot;
                return (
                  <div className="p-5 rounded-3xl bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] flex flex-wrap items-center justify-between gap-4 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[var(--color-forest)] shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <div className="font-bold text-[var(--color-forest)]">
                          {t.upcomingReminderTitle}
                        </div>
                        <p className="text-[var(--color-text-dark)] mt-0.5 tabular-nums">
                          {currentUser.role === 'patient'
                            ? `With ${nextApt.doctorName} · ${displayDateText} at ${displayTimeText}`
                            : `With Patient ${nextApt.patientName} · ${displayDateText} at ${displayTimeText}`}{' '}
                          · Room: {nextApt.meetingRoomId}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveVideoAppointment(nextApt);
                        setActiveSection('videoConsult');
                      }}
                      className="btn-forest-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      <Video className="w-4 h-4" />
                      <span>{t.joinCallNowBtn}</span>
                    </button>
                  </div>
                );
              })()}

              {/* 4-Card Clinical Executive KPI Grid */}
              {currentUser.role === 'patient' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                  <button
                    type="button"
                    onClick={() => setActiveSection('aiChat')}
                    className="card-3d-tilt w-full h-full text-left bg-white border border-[var(--color-leaf-border)] hover:border-[var(--color-forest)] rounded-2xl shadow-xs p-5 transition-all cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-leaf)] text-[var(--color-forest)] flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-[#137A5B]">
                        Active
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                        AI Health Chat Threads
                      </div>
                      <div className="text-3xl font-bold text-[var(--color-forest)] tabular-nums">
                        {chatSessions.length}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-forest)] font-bold flex items-center justify-between pt-2.5 border-t border-[var(--color-leaf-border)]/60">
                      <span>Causes, remedies &amp; tablets</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('prescriptionScanner')}
                    className="card-3d-tilt w-full h-full text-left bg-white border border-[var(--color-leaf-border)] hover:border-[var(--color-forest)] rounded-2xl shadow-xs p-5 transition-all cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-leaf)] text-[var(--color-forest)] flex items-center justify-center shrink-0">
                        <FileSearch className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-[#137A5B]">
                        OCR Ready
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                        Prescription Image Scans
                      </div>
                      <div className="text-3xl font-bold text-[var(--color-forest)] tabular-nums">
                        {prescriptionAnalyses.length}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-forest)] font-bold flex items-center justify-between pt-2.5 border-t border-[var(--color-leaf-border)]/60">
                      <span>Analyze handwritten Rx</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('appointments')}
                    className="card-3d-tilt w-full h-full text-left bg-white border border-[var(--color-leaf-border)] hover:border-[var(--color-forest)] rounded-2xl shadow-xs p-5 transition-all cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-leaf)] text-[var(--color-forest)] flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-[#137A5B]">
                        {confirmedAppointments.length} Confirmed
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                        Scheduled Appointments
                      </div>
                      <div className="text-3xl font-bold text-[var(--color-forest)] tabular-nums">
                        {appointments.length}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-forest)] font-bold flex items-center justify-between pt-2.5 border-t border-[var(--color-leaf-border)]/60">
                      <span>Book or view slots</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('eprescriptions')}
                    className="card-3d-tilt w-full h-full text-left bg-white border border-[var(--color-leaf-border)] hover:border-[var(--color-forest)] rounded-2xl shadow-xs p-5 transition-all cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-leaf)] text-[var(--color-forest)] flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-[#137A5B]">
                        Signed PDF
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                        Doctor E-Prescriptions
                      </div>
                      <div className="text-3xl font-bold text-[var(--color-forest)] tabular-nums">
                        {eprescriptions.length}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-forest)] font-bold flex items-center justify-between pt-2.5 border-t border-[var(--color-leaf-border)]/60">
                      <span>View &amp; download PDF</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </div>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
                  <div className="card-3d-tilt bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-5">
                    <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                      Pending Patient Requests
                    </div>
                    <div className="text-2xl font-bold text-amber-700 tabular-nums mt-1">
                      {appointments.filter((a) => a.status === 'Pending').length}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      Accept, reject, or reschedule slots
                    </div>
                  </div>
                  <div className="card-3d-tilt bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-5">
                    <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                      Confirmed Video Consultations
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-forest)] tabular-nums mt-1">
                      {confirmedAppointments.length}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      Ready to join in Video Consultation tab
                    </div>
                  </div>
                  <div className="card-3d-tilt bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-5">
                    <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                      Digital E-Prescriptions Issued
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-forest)] tabular-nums mt-1">
                      {eprescriptions.length}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      Instant PDF access for patients
                    </div>
                  </div>
                </div>
              )}

              {/* Your Care Workflow Section on Dashboard */}
              {currentUser.role === 'patient' && (
                <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-[var(--color-forest)]">
                      Your Care Workflow
                    </h2>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Everything stays inside your portal—from AI symptom &amp; prescription guidance to video consults.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                    {DASHBOARD_HOW_IT_WORKS.map((item) => {
                      const stepKey = `step-${item.step}`;
                      const showStepPhoto = !failedOverviewPhotos[stepKey];
                      return (
                        <div
                          key={item.step}
                          className="card-3d-tilt h-full rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] overflow-hidden flex flex-col justify-between"
                        >
                          <div className="relative w-full h-40 shrink-0 bg-gradient-to-br from-[#064734] via-[#0b5c44] to-[#137A5B] overflow-hidden border-b border-[var(--color-leaf-border)]">
                            {showStepPhoto ? (
                              <>
                                <img
                                  src={item.photoUrl}
                                  alt={item.alt}
                                  loading="eager"
                                  referrerPolicy="no-referrer"
                                  onError={() =>
                                    setFailedOverviewPhotos((prev) => ({
                                      ...prev,
                                      [stepKey]: true,
                                    }))
                                  }
                                  className="w-full h-full object-cover"
                                />
                                <div
                                  aria-hidden="true"
                                  className="absolute inset-0 bg-gradient-to-t from-[#064734]/50 via-[#0b5c44]/15 to-black/15 pointer-events-none"
                                />
                              </>
                            ) : (
                              <HowItWorksStepIllustration step={item.step} />
                            )}
                            <span className="absolute top-2.5 left-2.5 z-10 px-2.5 py-0.5 rounded-lg bg-[var(--color-forest)] text-[var(--color-leaf)] text-[11px] tabular-nums font-bold shadow-2xs">
                              Step {item.step}
                            </span>
                          </div>
                          <div className="p-4 space-y-1 flex-1">
                            <h3 className="text-xs font-bold text-[var(--color-forest)]">
                              {item.title}
                            </h3>
                            <p className="text-[11px] text-[var(--color-text-dark)] leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Embedded Appointments View on Dashboard for immediate action */}
              <AppointmentsView
                currentUser={currentUser}
                language={language}
                doctors={doctors}
                appointments={appointments}
                prefilledSymptoms={prefilledSymptoms}
                onClearPrefill={() => setPrefilledSymptoms('')}
                onAppointmentCreated={(apt) =>
                  setAppointments((prev) =>
                    prev.some((a) => a.id === apt.id)
                      ? prev.map((a) => (a.id === apt.id ? apt : a))
                      : [apt, ...prev]
                  )
                }
                onAppointmentUpdated={(updated) =>
                  setAppointments((prev) =>
                    prev.some((a) => a.id === updated.id)
                      ? prev.map((a) => (a.id === updated.id ? updated : a))
                      : [updated, ...prev]
                  )
                }
                onJoinVideoCall={(apt) => {
                  setActiveVideoAppointment(apt);
                  setActiveSection('videoConsult');
                }}
                onWriteEPrescription={(apt) => {
                  setPreselectedRxAppointment(apt);
                  setActiveSection('eprescriptions');
                }}
              />
            </div>
          )}

          {/* AI HEALTH CHAT */}
          {activeSection === 'aiChat' && (
            <AiHealthChat
              currentUser={currentUser}
              language={language}
              chatSessions={chatSessions}
              onSessionsUpdate={setChatSessions}
              onBookAppointment={handleNavigateToBooking}
            />
          )}

          {/* PRESCRIPTION ANALYSIS */}
          {activeSection === 'prescriptionScanner' && (
            <PrescriptionAnalyzer
              currentUser={currentUser}
              language={language}
              analyses={prescriptionAnalyses}
              onAnalysisCreated={(res) =>
                setPrescriptionAnalyses((prev) => [res, ...prev])
              }
              onBookAppointment={handleNavigateToBooking}
            />
          )}

          {/* SYMPTOM CHECKER */}
          {activeSection === 'symptomChecker' && (
            <SymptomChecker
              currentUser={currentUser}
              language={language}
              history={symptomChecks}
              onCheckCreated={(rec) => setSymptomChecks((prev) => [rec, ...prev])}
              onBookAppointment={handleNavigateToBooking}
            />
          )}

          {/* APPOINTMENTS */}
          {activeSection === 'appointments' && (
            <AppointmentsView
              currentUser={currentUser}
              language={language}
              doctors={doctors}
              appointments={appointments}
              prefilledSymptoms={prefilledSymptoms}
              onClearPrefill={() => setPrefilledSymptoms('')}
              onAppointmentCreated={(apt) =>
                setAppointments((prev) =>
                  prev.some((a) => a.id === apt.id)
                    ? prev.map((a) => (a.id === apt.id ? apt : a))
                    : [apt, ...prev]
                )
              }
              onAppointmentUpdated={(updated) =>
                setAppointments((prev) =>
                  prev.some((a) => a.id === updated.id)
                    ? prev.map((a) => (a.id === updated.id ? updated : a))
                    : [updated, ...prev]
                )
              }
              onJoinVideoCall={(apt) => {
                setActiveVideoAppointment(apt);
                setActiveSection('videoConsult');
              }}
              onWriteEPrescription={(apt) => {
                setPreselectedRxAppointment(apt);
                setActiveSection('eprescriptions');
              }}
            />
          )}

          {/* VIDEO CONSULTATION */}
          {activeSection === 'videoConsult' && (
            <VideoConsultation
              currentUser={
                consultAsDoctor && currentUser.role !== 'doctor'
                  ? {
                      id: 'doc-1',
                      name: 'Dr. Aarav Mehta',
                      email: 'dr.aarav@medassist.in',
                      role: 'doctor',
                      phone: '+91 98100 11223',
                      specialty: 'General & Internal Medicine',
                      qualification: 'MBBS, MD (Internal Medicine)',
                      registrationNumber: 'TSMC-48291',
                      approved: true,
                      createdAt: currentUser.createdAt,
                    }
                  : currentUser
              }
              appointments={appointments}
              activeAppointment={activeVideoAppointment}
              onSelectAppointment={setActiveVideoAppointment}
              onWriteEPrescription={(apt) => {
                setPreselectedRxAppointment(apt);
                setConsultAsDoctor(false);
                setActiveSection('eprescriptions');
              }}
              onExitCall={() => {
                setConsultAsDoctor(false);
                setActiveSection('appointments');
              }}
            />
          )}

          {/* E-PRESCRIPTIONS */}
          {activeSection === 'eprescriptions' && (
            <EPrescriptionsView
              currentUser={currentUser}
              eprescriptions={eprescriptions}
              appointments={appointments}
              patients={patients}
              doctors={doctors}
              preselectedAppointment={preselectedRxAppointment}
              onEPrescriptionCreated={(rx) => {
                setEprescriptions((prev) => [rx, ...prev]);
                setPreselectedRxAppointment(null);
                notifyConsultationRoomRx(rx);
              }}
            />
          )}

          {/* VITALS & DOSE ADHERENCE */}
          {activeSection === 'vitalsTracker' && (
            <VitalsTrackerView
              currentUser={currentUser}
              eprescriptions={eprescriptions}
              symptomChecks={symptomChecks}
            />
          )}

          {/* HEALTH TIMELINE */}
          {activeSection === 'historyTimeline' && (
            <HealthTimeline
              chatSessions={chatSessions}
              prescriptionAnalyses={prescriptionAnalyses}
              appointments={appointments}
              eprescriptions={eprescriptions}
              symptomChecks={symptomChecks}
            />
          )}

          {/* ADMIN PANEL */}
          {(activeSection === 'adminApprovals' ||
            activeSection === 'adminUsers' ||
            activeSection === 'adminAnalytics' ||
            (activeSection === 'dashboard' && currentUser.role === 'admin')) && (
            <AdminDashboard
              users={users}
              appointments={appointments}
              eprescriptions={eprescriptions}
              prescriptionAnalyses={prescriptionAnalyses}
              chatSessions={chatSessions}
              symptomChecks={symptomChecks}
              activeTab={
                activeSection === 'adminUsers'
                  ? 'users'
                  : activeSection === 'adminAnalytics'
                  ? 'analytics'
                  : 'approvals'
              }
              onTabChange={(tab) =>
                setActiveSection(
                  tab === 'users'
                    ? 'adminUsers'
                    : tab === 'analytics'
                    ? 'adminAnalytics'
                    : 'adminApprovals'
                )
              }
              onDoctorApprovalUpdated={(updatedDoc) => {
                setUsers((prev) =>
                  prev.map((u) => (u.id === updatedDoc.id ? updatedDoc : u))
                );
                setDoctors((prev) =>
                  prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
                );
              }}
              onUserDeleted={(deletedId) =>
                setUsers((prev) => prev.filter((u) => u.id !== deletedId))
              }
            />
          )}
            </>
          )}
        </main>

        {/* Persistent Medical Disclaimer Banner at Bottom of Workspace */}
        <footer className="bg-[var(--color-leaf)] border-t border-[var(--color-leaf-border)] px-6 py-3 text-center text-xs font-medium text-[var(--color-forest)]">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>{t.persistentDisclaimer}</span>
            <span aria-hidden="true" className="hidden sm:inline opacity-40">
              |
            </span>
            <span className="inline-flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLegalModalTab('privacy')}
                className="underline underline-offset-2 font-semibold hover:opacity-80 cursor-pointer"
              >
                {t.privacyPolicy}
              </button>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <button
                type="button"
                onClick={() => setLegalModalTab('terms')}
                className="underline underline-offset-2 font-semibold hover:opacity-80 cursor-pointer"
              >
                {t.termsConditions}
              </button>
            </span>
          </div>
        </footer>
      </div>

      {/* Real-Time Live Notification Toasts (Booking Requests, Accept/Decline, E-Rx) */}
      {liveToasts.length > 0 && (
        <div className="fixed top-16 inset-x-3 sm:inset-x-auto sm:right-4 z-50 sm:w-96 space-y-2.5 pointer-events-none">
          {liveToasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto fade-slide-up rounded-2xl border-2 p-4 shadow-lg bg-white text-xs space-y-1.5 ${
                toast.type === 'appointment_rejected'
                  ? 'border-red-300'
                  : 'border-[var(--color-forest)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-[var(--color-forest)]">
                  {toast.type === 'appointment_rejected' ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  )}
                  <span>{toast.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLiveToasts((prev) => prev.filter((item) => item.id !== toast.id))
                  }
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-forest)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[var(--color-text-dark)] leading-relaxed">{toast.message}</p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLiveToasts((prev) => prev.filter((item) => item.id !== toast.id));
                    setIsDoctorPortalView(false);
                    setActiveSection(
                      toast.type === 'new_eprescription' ? 'eprescriptions' : 'appointments'
                    );
                  }}
                  className="btn-forest-primary px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  {toast.type === 'new_eprescription' ? 'View E-Rx' : 'View Appointments'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <LegalPoliciesModal
        activeTab={legalModalTab}
        onChangeTab={(tab) => setLegalModalTab(tab)}
        onClose={() => setLegalModalTab(null)}
      />
      </div>
    </div>
  );
}
