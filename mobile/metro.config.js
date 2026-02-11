const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for Supabase realtime-js using Node.js 'ws' module
// which tries to import 'stream' - not available in React Native
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
