module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT ?? 'development';
  if (variant !== 'development' && variant !== 'production') {
    throw new Error('APP_VARIANT must be development or production');
  }
  if (variant === 'production') return config;

  return {
    ...config,
    name: `${config.name} Dev`,
    scheme: `${config.scheme}-dev`,
    ios: {
      ...config.ios,
      bundleIdentifier: `${config.ios.bundleIdentifier}.dev`,
    },
    android: {
      ...config.android,
      package: `${config.android.package}.dev`,
    },
  };
};
