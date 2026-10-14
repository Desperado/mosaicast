const expo = require('eslint-config-expo/flat');
module.exports = [
  ...expo,
  { ignores: ['**/dist/**', '**/.expo/**', '**/node_modules/**'] },
  { files: ['**/*.cjs'], languageOptions: { globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly', process: 'readonly' } } },
];
