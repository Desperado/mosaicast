const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { ESLint } = require('eslint');

test('Expo React and import rules still catch defects with ESLint 10', async () => {
  const eslint = new ESLint({ cwd: path.resolve(__dirname, '../../..') });
  const filePath = 'apps/mobile/src/app/__lint_regression__.tsx';
  const [invalid] = await eslint.lintText(`
    import React from 'react';
    import Missing from './__mosaicast_missing_module__';
    export default React.memo(() => <Missing />);
  `, { filePath });
  const rules = invalid.messages.map((message) => message.ruleId);
  assert.ok(rules.includes('react/display-name'), 'anonymous components must still be reported');
  assert.ok(rules.includes('import/no-unresolved'), 'missing imports must still be reported');

  const [valid] = await eslint.lintText(`
    import { View } from 'react-native';
    export default function ValidScreen() { return <View />; }
  `, { filePath });
  assert.deepEqual(valid.messages, []);
});
