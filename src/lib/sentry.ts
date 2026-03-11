// src/lib/sentry.ts
// ─────────────────────────────────────────────────────────────
// Sentry error tracking setup for Gharpayy CRM
//
// SETUP STEPS:
// 1. npm install @sentry/react
// 2. Create project at https://sentry.io
// 3. Add VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx to .env
// 4. Import initSentry() in src/main.tsx BEFORE rendering App
// ─────────────────────────────────────────────────────────────

import * as Sentry from "@sentry/react";

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // Skip in development if no DSN set
  if (!dsn) {
    console.info("[Sentry] No VITE_SENTRY_DSN set — skipping init");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'production'
    enabled: import.meta.env.PROD, // only capture in production
    release: import.meta.env.VITE_APP_VERSION ?? "unknown",

    // Capture 100% of transactions in prod, 0% in dev
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,

    // Replay 10% of sessions, 100% with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Don't send noise
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      "Payment cancelled", // user dismissed Razorpay
      /^NetworkError/,
    ],

    beforeSend(event) {
      // Strip sensitive data before sending
      if (event.request?.cookies) delete event.request.cookies;
      if (event.user?.email) {
        event.user.email = "[filtered]";
      }
      return event;
    },
  });
};

// ── Set user context after login ──────────────────────────────
// Call this in AuthContext after role + user is loaded
export const setSentryUser = (userId: string, role: string | null) => {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.setUser({ id: userId, role: role ?? "unknown" });
};

// ── Clear user on logout ──────────────────────────────────────
export const clearSentryUser = () => {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.setUser(null);
};

// ── Manual error capture ──────────────────────────────────────
export const captureError = (
  err: unknown,
  context?: Record<string, unknown>,
) => {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.error("[captureError]", err, context);
    return;
  }
  Sentry.captureException(err, { extra: context });
};
