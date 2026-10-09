// Sentry's Metro config: tags each JavaScript bundle so crash reports can be
// matched to readable source code once source map upload is switched on.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
