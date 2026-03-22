// src/lib/analytics.ts

/**
 * All trackable events in the Teseo product.
 * Grouped by funnel stage for readability.
 *
 * Beta instrumentation:
 *   - Events log to console in dev.
 *   - Events log as JSON in production (ready for Sentry RUM / Datadog / PostHog ingest).
 *   - Replace the production branch below to wire up Amplitude, Mixpanel, or PostHog.
 */
type EventName =
  // ── Onboarding & creation ───────────────────────────────────────────────
  | 'ONBOARDING_STEP'          // user advanced a step in new-TCC modal
  | 'TCC_CREATED'              // TCC successfully created
  | 'TCC_DELETED'              // TCC deleted from dashboard
  // ── Workspace ──────────────────────────────────────────────────────────
  | 'WORKSPACE_OPEN'           // workspace loaded for a TCC
  | 'MANUAL_SAVE_TCC'          // user clicked "Save now"
  | 'INSERT_SUGGESTION_DOCUMENT' // user inserted AI suggestion into document
  | 'AI_SUGGESTION_REGENERATE'   // user regenerated a suggestion
  // ── AI Actions ─────────────────────────────────────────────────────────
  | 'AI_ACTION_CLICK'          // user clicked an action button
  | 'AI_ACTION_BLOCK_PLAN'     // action blocked due to plan restriction
  | 'AI_ACTION_SUCCESS'        // action returned successfully
  | 'AI_ACTION_ERROR'          // action returned an error
  | 'AI_PANEL_TOGGLE_NEXT_STEP' // "Próximo Passo" panel opened/closed
  // ── Monetisation ───────────────────────────────────────────────────────
  | 'UPGRADE_MODAL_SHOWN'      // upgrade modal was displayed
  | 'UPGRADE_CTA_CLICK'        // user clicked a pricing CTA
  | 'LIMIT_MODAL_SHOWN'        // daily-limit modal was displayed
  | 'EXPORT_CLICK'             // user attempted to export the TCC
  // ── Engagement ─────────────────────────────────────────────────────────
  | 'TURNITIN_INFO_HOVER'      // user hovered/focused the Turnitin tooltip

export const trackEvent = (eventName: EventName, properties?: Record<string, unknown>) => {
  const payload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    properties: {
      url: typeof window !== 'undefined' ? window.location.pathname : 'server',
      ...properties,
    },
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Teseo Analytics] ${eventName}`, payload.properties)
  } else {
    // Production: structured log — consumed by Sentry RUM / Datadog / PostHog
    // TODO: replace with provider SDK call, e.g.:
    //   posthog.capture(eventName, payload.properties)
    console.info(JSON.stringify(payload))
  }
}
