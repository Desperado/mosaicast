const { fixupConfigRules } = require('@eslint/compat');
const expo = require('eslint-config-expo/flat');
module.exports = [
  // Expo's React/import plugins still call rule APIs removed in ESLint 10.
  ...fixupConfigRules(expo),
  { ignores: ['**/dist/**', '**/.expo/**', '**/node_modules/**'] },
  { files: ['**/*.cjs'], languageOptions: { globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly', process: 'readonly' } } },
];
