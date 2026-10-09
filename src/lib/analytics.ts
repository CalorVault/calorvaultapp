import PostHog from 'posthog-react-native';

// Anonymous usage analytics (PostHog, stored in the EU). The key only allows
// sending events. What's sent: which screens are opened and simple actions
// like "food logged by photo". Never food names, calories, weight or any other
// health data, never names or emails, no location and no screen recordings.
// People can turn it off in Settings > Privacy.
const POSTHOG_KEY = 'phc_ywbjivJPoAJ7aAdyd746to4WMTqzdX5UCynhK4LS6q4x';

export const posthog = new PostHog(POSTHOG_KEY, {
  host: 'https://eu.i.posthog.com',
  disabled: __DEV__,
  captureAppLifecycleEvents: true,
  enableSessionReplay: false,
  personProfiles: 'never',
  disableGeoip: true,
  disableSurveys: true,
  preloadFeatureFlags: false,
});

type EventProps = Record<string, string | number | boolean>;

export function track(event: string, properties?: EventProps) {
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break the app.
  }
}

export function trackScreen(name: string) {
  posthog.screen(name).catch(() => {});
}

export function isUsageStatsOn(): boolean {
  return !posthog.optedOut;
}

export async function setUsageStats(on: boolean): Promise<void> {
  await (on ? posthog.optIn() : posthog.optOut());
}
