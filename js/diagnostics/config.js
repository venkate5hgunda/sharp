// Public deployment configuration only. A key alone cannot enable sharing.
// Keep secret/read/admin keys on the developer machine, never in this file.
export const TELEMETRY_CONFIG = Object.freeze({ publicProjectKey: null, host: 'https://us.i.posthog.com' });
