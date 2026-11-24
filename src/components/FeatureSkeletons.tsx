import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { UserRole } from '../types/healthcare';

export type FeatureSkeletonKey =
  | 'dashboard'
  | 'aiChat'
  | 'prescriptionScanner'
  | 'symptomChecker'
  | 'appointments'
  | 'eprescriptions'
  | 'vitalsTracker'
  | 'historyTimeline'
  | 'videoConsult'
  | 'doctorPortal'
  | 'adminApprovals'
  | 'adminUsers'
  | 'adminAnalytics';

interface SkeletonBlockProps {
  className?: string;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`skeleton-shimmer rounded-xl ${className}`}
  />
);

interface FeatureLoadErrorProps {
  featureLabel: string;
  message: string;
  onRetry: () => void;
}

/**
 * Inline content-area error state when an authenticated feature request fails.
 * Preserves the sidebar, header, and navigation bar cleanly.
 */
export const FeatureLoadError: React.FC<FeatureLoadErrorProps> = ({
  featureLabel,
  message,
  onRetry,
}) => (
  <div
    role="alert"
    className="fade-slide-up bg-white border border-red-200 rounded-3xl shadow-xs p-8 sm:p-10 max-w-2xl mx-auto text-center space-y-4"
  >
    <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
      <AlertTriangle className="w-6 h-6" aria-hidden="true" />
    </div>
    <div className="space-y-1.5">
      <h2 className="text-base sm:text-lg font-bold text-[var(--color-forest)]">
        Unable to Load {featureLabel}
      </h2>
      <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed max-w-md mx-auto">
        {message}
      </p>
    </div>
    <div className="pt-1">
      <button
        type="button"
        onClick={onRetry}
        className="btn-forest-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        <span>Try Again</span>
      </button>
    </div>
  </div>
);

/**
 * SYSTEM 2: AFTER LOGIN — FEATURE-SPECIFIC SKELETON LOADING
 * Replaces ONLY the active content viewport while keeping sidebar & top bar intact.
 */
export const FeatureSkeleton: React.FC<{
  feature: FeatureSkeletonKey;
  role: UserRole;
  label?: string;
}> = ({ feature, role, label = 'section' }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`Loading ${label}`}
      className="space-y-6"
    >
      <span className="sr-only">Loading {label}...</span>
      {renderSkeletonByFeature(feature, role)}
    </div>
  );
};

function renderSkeletonByFeature(feature: FeatureSkeletonKey, role: UserRole) {
  switch (feature) {
    case 'dashboard':
      return role === 'doctor' ? <DoctorDashboardSkeleton /> : <PatientDashboardSkeleton />;
    case 'appointments':
      return <AppointmentsSkeleton role={role} />;
    case 'aiChat':
      return <AiHealthChatSkeleton />;
    case 'prescriptionScanner':
      return <PrescriptionAnalyzerSkeleton />;
    case 'symptomChecker':
      return <SymptomCheckerSkeleton />;
    case 'eprescriptions':
      return <EPrescriptionsSkeleton role={role} />;
    case 'vitalsTracker':
      return <VitalsTrackerSkeleton />;
    case 'historyTimeline':
      return <HealthTimelineSkeleton />;
    case 'videoConsult':
      return <VideoConsultationSkeleton />;
    case 'doctorPortal':
      return <DoctorPortalSkeleton />;
    case 'adminApprovals':
    case 'adminUsers':
    case 'adminAnalytics':
      return <AdminDashboardSkeleton variant={feature} />;
    default:
      return <PatientDashboardSkeleton />;
  }
}

const PatientDashboardSkeleton: React.FC = () => (
  <>
    {/* Hero Split Banner + Patient Profile Greeting */}
    <div className="rounded-3xl bg-white border border-[var(--color-leaf-border)] shadow-xs p-6 sm:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          <SkeletonBlock className="h-6 w-48 rounded-lg" />
          <SkeletonBlock className="h-9 w-4/5" />
          <SkeletonBlock className="h-4 w-full max-w-xl" />
          <SkeletonBlock className="h-4 w-3/4 max-w-lg" />
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <SkeletonBlock className="h-11 w-44 rounded-xl" />
            <SkeletonBlock className="h-11 w-36 rounded-xl" />
            <SkeletonBlock className="h-11 w-36 rounded-xl" />
          </div>
        </div>
        <div className="lg:col-span-5">
          <SkeletonBlock className="w-full h-56 sm:h-60 rounded-2xl" />
        </div>
      </div>
    </div>

    {/* Upcoming Reminder Strip */}
    <div className="rounded-3xl bg-white border border-[var(--color-leaf-border)] p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-[220px]">
        <SkeletonBlock className="w-9 h-9 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-3.5 w-44" />
          <SkeletonBlock className="h-3 w-72 max-w-full" />
        </div>
      </div>
      <SkeletonBlock className="h-10 w-36 rounded-xl shrink-0" />
    </div>

    {/* 4-Card Clinical KPI Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((idx) => (
        <div
          key={idx}
          className="bg-white border border-[var(--color-leaf-border)] rounded-2xl p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <SkeletonBlock className="w-10 h-10 rounded-xl" />
            <SkeletonBlock className="h-4 w-16 rounded-md" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-3.5 w-32" />
            <SkeletonBlock className="h-8 w-14" />
          </div>
          <div className="pt-2.5 border-t border-[var(--color-leaf-border)]/50">
            <SkeletonBlock className="h-3.5 w-3/4" />
          </div>
        </div>
      ))}
    </div>

    {/* 3-Step Care Workflow Cards */}
    <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
      <div className="space-y-1.5">
        <SkeletonBlock className="h-5 w-44" />
        <SkeletonBlock className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-[var(--color-leaf-border)] overflow-hidden bg-[var(--color-leaf-soft)]/50"
          >
            <SkeletonBlock className="w-full h-40 rounded-none" />
            <div className="p-4 space-y-2">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="h-3 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
);

const DoctorDashboardSkeleton: React.FC = () => (
  <>
    {/* Clinician Profile Hero Split */}
    <div className="rounded-3xl bg-white border border-[var(--color-leaf-border)] shadow-xs p-6 sm:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          <SkeletonBlock className="h-6 w-52 rounded-lg" />
          <SkeletonBlock className="h-9 w-4/5" />
          <SkeletonBlock className="h-4 w-3/4" />
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <SkeletonBlock className="h-11 w-48 rounded-xl" />
            <SkeletonBlock className="h-11 w-40 rounded-xl" />
          </div>
        </div>
        <div className="lg:col-span-5">
          <SkeletonBlock className="w-full h-56 sm:h-60 rounded-2xl" />
        </div>
      </div>
    </div>

    {/* 3-Card Clinician Metrics Row */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className="bg-white border border-[var(--color-leaf-border)] rounded-2xl p-5 shadow-xs space-y-2.5"
        >
          <SkeletonBlock className="h-3.5 w-40" />
          <SkeletonBlock className="h-8 w-16" />
          <SkeletonBlock className="h-3 w-52 max-w-full" />
        </div>
      ))}
    </div>

    {/* Incoming Patient Appointments List */}
    <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--color-leaf-border)]/60 pb-4">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-5 w-52" />
          <SkeletonBlock className="h-3.5 w-72 max-w-full" />
        </div>
        <SkeletonBlock className="h-9 w-28 rounded-xl" />
      </div>
      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className="p-4 rounded-2xl border border-[var(--color-leaf-border)]/70 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="space-y-2 flex-1 min-w-[220px]">
            <SkeletonBlock className="h-4 w-48" />
            <SkeletonBlock className="h-3 w-64 max-w-full" />
            <SkeletonBlock className="h-3 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-9 w-24 rounded-xl" />
            <SkeletonBlock className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  </>
);

const AppointmentsSkeleton: React.FC<{ role: UserRole }> = ({ role }) => (
  <div className="space-y-6">
    {role === 'patient' && (
      <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-5">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-5 w-56" />
          <SkeletonBlock className="h-3.5 w-96 max-w-full" />
        </div>
        {/* Verified Specialists Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[var(--color-leaf-border)] overflow-hidden"
            >
              <SkeletonBlock className="w-full h-32 rounded-none" />
              <div className="p-4 space-y-2">
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-3 w-1/2" />
                <SkeletonBlock className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
        {/* Date & Slot Picker Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-[var(--color-leaf-border)]/60">
          <div className="lg:col-span-5 space-y-2.5">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
            <SkeletonBlock className="h-24 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-7 space-y-2.5">
            <SkeletonBlock className="h-4 w-40" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((slot) => (
                <SkeletonBlock key={slot} className="h-10 w-full rounded-xl" />
              ))}
            </div>
            <SkeletonBlock className="h-11 w-48 rounded-xl mt-2" />
          </div>
        </div>
      </div>
    )}

    {/* Appointment Management / Schedule List */}
    <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-leaf-border)]/60 pb-4">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-5 w-52" />
          <SkeletonBlock className="h-3.5 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-8 w-20 rounded-lg" />
          <SkeletonBlock className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className="p-4 rounded-2xl border border-[var(--color-leaf-border)]/70 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="space-y-2 flex-1 min-w-[220px]">
            <SkeletonBlock className="h-4 w-56" />
            <SkeletonBlock className="h-3 w-72 max-w-full" />
            <SkeletonBlock className="h-3 w-44" />
          </div>
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-9 w-28 rounded-xl" />
            <SkeletonBlock className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AiHealthChatSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
    {/* Left Chat Threads Sidebar */}
    <div className="lg:col-span-4 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-5 w-36" />
        <SkeletonBlock className="h-9 w-28 rounded-xl" />
      </div>
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-2xl border border-[var(--color-leaf-border)]/60 space-y-2"
          >
            <SkeletonBlock className="h-4 w-4/5" />
            <SkeletonBlock className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>

    {/* Right Active AI Conversation Workspace */}
    <div className="lg:col-span-8 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-5 sm:p-6 flex flex-col justify-between min-h-[480px] space-y-5">
      <div className="flex items-center justify-between border-b border-[var(--color-leaf-border)]/60 pb-4">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="w-10 h-10 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <SkeletonBlock className="h-4 w-48" />
            <SkeletonBlock className="h-3 w-64 max-w-full" />
          </div>
        </div>
        <SkeletonBlock className="h-8 w-28 rounded-xl" />
      </div>

      {/* Chat Message Bubbles */}
      <div className="flex-1 space-y-4 py-2">
        <div className="flex justify-end">
          <SkeletonBlock className="h-14 w-3/5 rounded-2xl" />
        </div>
        <div className="flex justify-start gap-3">
          <SkeletonBlock className="w-8 h-8 rounded-xl shrink-0" />
          <div className="w-4/5 space-y-2">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-11/12" />
            <SkeletonBlock className="h-4 w-3/4" />
          </div>
        </div>
        <div className="flex justify-end">
          <SkeletonBlock className="h-12 w-2/5 rounded-2xl" />
        </div>
      </div>

      {/* Composer Input Skeleton */}
      <div className="pt-3 border-t border-[var(--color-leaf-border)]/60 flex items-center gap-2.5">
        <SkeletonBlock className="h-12 flex-1 rounded-2xl" />
        <SkeletonBlock className="h-12 w-12 rounded-2xl shrink-0" />
        <SkeletonBlock className="h-12 w-24 rounded-2xl shrink-0" />
      </div>
    </div>
  </div>
);

const PrescriptionAnalyzerSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Mode Switcher Bar */}
    <div className="bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-9 w-36 rounded-lg" />
        <SkeletonBlock className="h-9 w-56 rounded-lg" />
      </div>
      <SkeletonBlock className="h-4 w-48" />
    </div>

    {/* Upload & Analysis 12-col Split */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-5 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
        <SkeletonBlock className="h-5 w-48" />
        <SkeletonBlock className="h-48 w-full rounded-2xl" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 flex-1 rounded-xl" />
          <SkeletonBlock className="h-10 w-32 rounded-xl" />
        </div>
      </div>
      <div className="lg:col-span-7 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-leaf-border)]/60 pb-3">
          <SkeletonBlock className="h-5 w-52" />
          <SkeletonBlock className="h-6 w-24 rounded-lg" />
        </div>
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className="p-4 rounded-2xl border border-[var(--color-leaf-border)]/60 space-y-2"
          >
            <div className="flex justify-between gap-2">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="h-4 w-20" />
            </div>
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SymptomCheckerSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
    <div className="lg:col-span-7 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-5">
      <div className="space-y-1.5 border-b border-[var(--color-leaf-border)]/60 pb-4">
        <SkeletonBlock className="h-5 w-52" />
        <SkeletonBlock className="h-3.5 w-full max-w-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
          <SkeletonBlock key={idx} className="h-11 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--color-leaf-border)]/60">
        <SkeletonBlock className="h-11 w-full rounded-xl" />
        <SkeletonBlock className="h-11 w-full rounded-xl" />
      </div>
      <SkeletonBlock className="h-11 w-48 rounded-xl" />
    </div>

    <div className="lg:col-span-5 bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
      <SkeletonBlock className="h-5 w-44" />
      <SkeletonBlock className="h-24 w-full rounded-2xl" />
      <SkeletonBlock className="h-20 w-full rounded-2xl" />
      <SkeletonBlock className="h-20 w-full rounded-2xl" />
    </div>
  </div>
);

const EPrescriptionsSkeleton: React.FC<{ role: UserRole }> = ({ role }) => (
  <div className="space-y-6">
    <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1.5">
        <SkeletonBlock className="h-5 w-56" />
        <SkeletonBlock className="h-3.5 w-80 max-w-full" />
      </div>
      {role === 'doctor' && <SkeletonBlock className="h-10 w-44 rounded-xl" />}
    </div>

    <div className="grid grid-cols-1 gap-4">
      {[0, 1].map((idx) => (
        <div
          key={idx}
          className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-leaf-border)]/60 pb-4">
            <div className="space-y-1.5">
              <SkeletonBlock className="h-5 w-60" />
              <SkeletonBlock className="h-3.5 w-44" />
            </div>
            <div className="flex gap-2">
              <SkeletonBlock className="h-9 w-28 rounded-xl" />
              <SkeletonBlock className="h-9 w-36 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2.5">
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <SkeletonBlock className="h-10 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const VitalsTrackerSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-2">
        <SkeletonBlock className="h-5 w-48" />
        <SkeletonBlock className="h-6 w-72 max-w-full" />
        <SkeletonBlock className="h-3.5 w-96 max-w-full" />
      </div>
      <SkeletonBlock className="h-10 w-52 rounded-xl" />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((idx) => (
        <div
          key={idx}
          className="bg-white border border-[var(--color-leaf-border)] rounded-2xl p-5 shadow-xs space-y-2.5"
        >
          <SkeletonBlock className="h-3.5 w-32" />
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="h-5 w-24 rounded-lg" />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white border border-[var(--color-leaf-border)] rounded-3xl p-6 space-y-4">
        <SkeletonBlock className="h-5 w-44" />
        <SkeletonBlock className="h-56 w-full rounded-2xl" />
      </div>
      <div className="lg:col-span-5 bg-white border border-[var(--color-leaf-border)] rounded-3xl p-6 space-y-3">
        <SkeletonBlock className="h-5 w-44" />
        {[0, 1, 2, 3].map((idx) => (
          <SkeletonBlock key={idx} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);

const HealthTimelineSkeleton: React.FC = () => (
  <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 sm:p-7 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-leaf-border)]/60 pb-4">
      <div className="space-y-1.5">
        <SkeletonBlock className="h-5 w-56" />
        <SkeletonBlock className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((idx) => (
          <SkeletonBlock key={idx} className="h-8 w-24 rounded-xl" />
        ))}
      </div>
    </div>

    <div className="divide-y divide-[var(--color-leaf-border)]/50">
      {[0, 1, 2, 3, 4].map((idx) => (
        <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-start gap-3.5">
          <SkeletonBlock className="w-10 h-10 rounded-2xl shrink-0" />
          <div className="space-y-2 flex-1">
            <SkeletonBlock className="h-4 w-56" />
            <SkeletonBlock className="h-3.5 w-40" />
            <SkeletonBlock className="h-3 w-full max-w-xl" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const VideoConsultationSkeleton: React.FC = () => (
  <div className="space-y-5">
    {/* Consultation Room Bar */}
    <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="w-10 h-10 rounded-xl shrink-0" />
        <div className="space-y-1.5">
          <SkeletonBlock className="h-4 w-52" />
          <SkeletonBlock className="h-3 w-72 max-w-full" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-9 w-28 rounded-xl" />
        <SkeletonBlock className="h-9 w-28 rounded-xl" />
      </div>
    </div>

    {/* Video Stage + Clinical Side Panel */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-8 bg-white border border-[var(--color-leaf-border)] rounded-3xl p-4 space-y-4">
        <SkeletonBlock className="w-full aspect-video rounded-2xl" />
        <div className="flex items-center justify-center gap-3">
          <SkeletonBlock className="w-11 h-11 rounded-full" />
          <SkeletonBlock className="w-11 h-11 rounded-full" />
          <SkeletonBlock className="w-11 h-11 rounded-full" />
          <SkeletonBlock className="h-11 w-28 rounded-full" />
        </div>
      </div>
      <div className="lg:col-span-4 bg-white border border-[var(--color-leaf-border)] rounded-3xl p-5 space-y-4">
        <SkeletonBlock className="h-5 w-40" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <SkeletonBlock className="h-40 w-full rounded-2xl" />
        <SkeletonBlock className="h-10 w-full rounded-xl" />
      </div>
    </div>
  </div>
);

const DoctorPortalSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Doctor Profile & Patient Info Header */}
    <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <SkeletonBlock className="w-12 h-12 rounded-2xl shrink-0" />
        <div className="space-y-2">
          <SkeletonBlock className="h-5 w-56" />
          <SkeletonBlock className="h-3.5 w-72 max-w-full" />
        </div>
      </div>
      <div className="flex gap-2">
        <SkeletonBlock className="h-10 w-36 rounded-xl" />
        <SkeletonBlock className="h-10 w-36 rounded-xl" />
      </div>
    </div>

    {/* Patient Information + Clinical E-Rx Composer */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-5 bg-white border border-[var(--color-leaf-border)] rounded-3xl p-6 space-y-4">
        <SkeletonBlock className="h-5 w-44" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonBlock className="h-16 rounded-2xl" />
          <SkeletonBlock className="h-16 rounded-2xl" />
        </div>
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <SkeletonBlock className="h-20 w-full rounded-2xl" />
      </div>
      <div className="lg:col-span-7 bg-white border border-[var(--color-leaf-border)] rounded-3xl p-6 space-y-4">
        <SkeletonBlock className="h-5 w-52" />
        <SkeletonBlock className="h-11 w-full rounded-xl" />
        <SkeletonBlock className="h-20 w-full rounded-xl" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <SkeletonBlock className="h-11 w-48 rounded-xl" />
      </div>
    </div>
  </div>
);

const AdminDashboardSkeleton: React.FC<{
  variant: 'adminApprovals' | 'adminUsers' | 'adminAnalytics';
}> = ({ variant }) => (
  <div className="space-y-6">
    {/* 4-Card Admin KPI Row */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((idx) => (
        <div
          key={idx}
          className="bg-white border border-[var(--color-leaf-border)] rounded-2xl p-5 shadow-xs space-y-2.5"
        >
          <SkeletonBlock className="h-3.5 w-32" />
          <SkeletonBlock className="h-8 w-16" />
          <SkeletonBlock className="h-3 w-40" />
        </div>
      ))}
    </div>

    {/* Main Admin Panel */}
    <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-leaf-border)]/60 pb-4">
        <SkeletonBlock className="h-5 w-56" />
        <SkeletonBlock className="h-9 w-56 rounded-xl" />
      </div>
      {variant === 'adminAnalytics' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonBlock className="h-52 w-full rounded-2xl" />
          <SkeletonBlock className="h-52 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl border border-[var(--color-leaf-border)]/60 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-2 flex-1 min-w-[200px]">
                <SkeletonBlock className="h-4 w-48" />
                <SkeletonBlock className="h-3 w-64 max-w-full" />
              </div>
              <SkeletonBlock className="h-9 w-28 rounded-xl" />
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);
