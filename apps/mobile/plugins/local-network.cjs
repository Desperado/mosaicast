const { withAndroidManifest } = require('expo/config-plugins');
// Yamaha's local API only speaks HTTP. Hosts remain restricted to private IPv4 in the adapter.
module.exports = config => withAndroidManifest(config, result => {
  const application = result.modResults.manifest.application[0];
  application.$['android:usesCleartextTraffic'] = 'true';
  return result;
});
