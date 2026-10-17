const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/layout',
  outputDir: '.context/layout-results',
  workers: 2,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8093', browserName: 'chromium', screenshot: 'only-on-failure' },
  webServer: {
    command: 'python3 -m http.server 8093 --bind 127.0.0.1 --directory apps/mobile/dist',
    url: 'http://127.0.0.1:8093',
    reuseExistingServer: false,
    stdout: 'ignore', stderr: 'ignore',
  },
});
