const { fixupConfigRules } = require('@eslint/compat');
const expo = require('eslint-config-expo/flat');
module.exports = [
  // Expo's React/import plugins still call rule APIs removed in ESLint 10.
  ...fixupConfigRules(expo),
  { ignores: ['.context/**', '**/dist/**', '**/.expo/**', '**/node_modules/**', 'apps/frame/app/bundle.js'] },
  { files: ['apps/frame/app/**/*.js'], languageOptions: { globals: { tizen: 'readonly', bundledYamahaHost: 'readonly' } } },
  { files: ['apps/frame/scripts/**/*.js'], languageOptions: { globals: { Buffer: 'readonly' } } },
  { files: ['**/*.cjs'], languageOptions: { globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly', process: 'readonly' } } },
];
