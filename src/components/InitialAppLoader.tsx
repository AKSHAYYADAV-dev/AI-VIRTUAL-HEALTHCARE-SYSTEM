import React from 'react';
import { Stethoscope, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { SupportedLanguage } from '../types/healthcare';
import { UI_TRANSLATIONS } from '../utils/i18n';

interface InitialAppLoaderProps {
  /** Active UI language for localized initialization copy */
  language?: SupportedLanguage;
  /** True while fading out cleanly right before unmounting */
  exiting?: boolean;
  /** Non-null when initial session / app resource verification fails */
  error?: string | null;
  /** Retry the initial session verification */
  onRetry?: () => void;
  /** Allow visitor to proceed to Sign In if backend is temporarily unreachable */
  onContinueToLogin?: () => void;
}

/**
 * SYSTEM 1: BEFORE LOGIN — FULL-SCREEN HEALTHCARE SPINNER
 * Displayed ONLY during initial page load / full browser refresh while
 * application resources and backend authentication session are verified.
 */
export const InitialAppLoader: React.FC<InitialAppLoaderProps> = ({
  language = 'English',
  exiting = false,
  error = null,
  onRetry,
  onContinueToLogin,
}) => {
  const loaderCopy = UI_TRANSLATIONS[language].loader;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!error}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 bg-[var(--color-leaf-soft)] dark:bg-[#04281d] text-[var(--color-text-dark)] dark:text-[#E0FFC2] transition-opacity duration-200 ease-out ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Subtle Healthcare Ambient Radial Wash using existing Forest & Leaf palette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[540px] h-[540px] rounded-full bg-[var(--color-leaf)]/65 dark:bg-[#064734]/45 blur-3xl" />
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-[#137A5B]/12 dark:bg-[#137A5B]/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        {/* Existing Website Logo & Branding */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-[var(--color-forest)] text-[var(--color-leaf)] flex items-center justify-center shadow-sm border border-[var(--color-forest-dark)]">
            <Stethoscope className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="text-left">
            <div className="text-base sm:text-lg font-extrabold tracking-tight text-[var(--color-forest)] dark:text-[#E0FFC2] leading-tight">
              MedAssist
            </div>
            <div className="text-xs font-medium text-[var(--color-text-muted)] dark:text-[#E0FFC2]/75">
              {loaderCopy.brandSubtitle}
            </div>
          </div>
        </div>

        {error ? (
          /* Graceful Initialization Error Card — Never leaves an infinite spinner */
          <div
            role="alert"
            className="w-full rounded-3xl bg-white dark:bg-[#064734] border border-[var(--color-leaf-border)] dark:border-white/15 shadow-sm p-6 space-y-4 text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 flex items-center justify-center text-red-700 dark:text-red-300">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-base font-bold text-[var(--color-forest)] dark:text-white">
                {loaderCopy.errorTitle}
              </h1>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[#E0FFC2]/85 leading-relaxed">
                {error}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="btn-forest-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{loaderCopy.retryBtn}</span>
                </button>
              )}
              {onContinueToLogin && (
                <button
                  type="button"
                  onClick={onContinueToLogin}
                  className="btn-forest-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{loaderCopy.continueToLoginBtn}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Healthcare-Themed Multi-Ring Animated Circular Spinner */
          <div className="flex flex-col items-center space-y-6">
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Outer Soft Leaf Track + Forest Arc Spinner */}
              <svg
                className="w-24 h-24 healthcare-spinner-ring"
                viewBox="0 0 96 96"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  className="text-[var(--color-leaf-border)]/70 dark:text-[#E0FFC2]/15"
                  strokeWidth="4.5"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  className="text-[var(--color-forest)] dark:text-[#E0FFC2]"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray="92 175"
                />
              </svg>

              {/* Inner Counter-Rotating Mid-Green Clinical Arc */}
              <svg
                className="absolute w-16 h-16 healthcare-spinner-arc"
                viewBox="0 0 64 64"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="currentColor"
                  className="text-[#137A5B]/35 dark:text-[#3fa57a]/30"
                  strokeWidth="3"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="currentColor"
                  className="text-[#137A5B] dark:text-[#3fa57a]"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="46 120"
                />
              </svg>

              {/* Center Healthcare Heartbeat / Clinical Cross Medallion */}
              <div className="absolute w-10 h-10 rounded-full bg-white dark:bg-[#064734] border border-[var(--color-leaf-border)] dark:border-[#E0FFC2]/25 shadow-2xs flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-[var(--color-forest)] dark:text-[#E0FFC2] healthcare-ecg-pulse"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 12h4l2.2-5.5L12 18l2.8-8 1.7 2H22" />
                </svg>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm sm:text-base font-bold text-[var(--color-forest)] dark:text-[#E0FFC2] tracking-tight">
                {loaderCopy.preparingMessage}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[#E0FFC2]/75">
                {loaderCopy.verifyingSession}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
