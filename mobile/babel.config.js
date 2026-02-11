module.exports = function (api) {
  api.cache(true);

  const plugins = ['react-native-reanimated/plugin'];

  // Production'da console.* çağrılarını kaldır
  if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
    plugins.unshift(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
