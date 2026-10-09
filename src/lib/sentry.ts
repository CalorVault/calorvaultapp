import * as Sentry from '@sentry/react-native';

// Crash reporting. The DSN only allows sending reports, so it's safe in the
// app. No personal data is sent (no IP address, no email or username), and
// web addresses in the trail of events before a crash have their query
// strings removed so search terms and ids don't leave the phone.
const SENTRY_DSN =
  'https://65d59893987365fc6195a8f8dbe48158@o4512198219137024.ingest.de.sentry.io/4512198226280528';

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !__DEV__,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'console') return null;
    const url = breadcrumb.data?.url;
    if (typeof url === 'string') breadcrumb.data = { ...breadcrumb.data, url: url.split('?')[0] };
    return breadcrumb;
  },
});

export { Sentry };
