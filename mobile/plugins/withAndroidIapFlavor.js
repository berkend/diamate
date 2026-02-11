const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Config plugin to add missingDimensionStrategy for react-native-iap.
 * react-native-iap defines "amazon" and "play" product flavors.
 * We select "play" for Google Play Store builds.
 */
module.exports = function withAndroidIapFlavor(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('missingDimensionStrategy')) {
      config.modResults.contents = config.modResults.contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {\n        missingDimensionStrategy "store", "play"`
      );
    }
    return config;
  });
};
