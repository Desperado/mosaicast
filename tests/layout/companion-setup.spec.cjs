const { test, expect } = require('@playwright/test');
const { build } = require('esbuild');
let script;
test.beforeAll(async () => {
  const stubs = {
    'expo-localization': 'export const useLocales = () => [{languageCode:"en"}];',
    '@react-native-async-storage/async-storage': `export default {
      getItem:async()=>null, setItem:async()=>{ if(window.storageFails) throw new Error('Unavailable'); }
    };`,
    './hardware-volume': 'export const useHardwareVolume = () => false;',
    './phone-companion': `import {demoController} from '@mosaicast/musiccast';
      export class PhoneCompanion {
        mode = 'device'; closed = false;
        constructor() { window.companions = [...(window.companions || []), this]; }
        read = () => demoController().read();
        close() { this.closed = true; }
        async acceptInvitation() {
          if (window.invitationFails) throw new Error('Expired');
          if (window.invitationGate) await window.invitationGate;
        }
      }`,
    './device-controller': `import {demoController} from '@mosaicast/musiccast'; export const deviceController = () => demoController();`,
  };
  const result = await build({
    stdin:{contents:`import {createRoot} from 'react-dom/client'; import {AppProvider,useApp} from './apps/mobile/src/state/app';
      function Probe() { window.app = useApp(); return null; }
      createRoot(document.getElementById('root')).render(<AppProvider><Probe/></AppProvider>);`, resolveDir:process.cwd(), loader:'tsx'},
    bundle:true,write:false,platform:'browser',jsx:'automatic',alias:{'react-native':'react-native-web'},
    define:{'process.env.NODE_ENV':'"test"',__DEV__:'false'},
    plugins:[{name:'native-boundaries',setup(builder) {
      builder.onResolve({filter:/.*/}, args => args.path in stubs ? {path:args.path,namespace:'stub'} : undefined);
      builder.onLoad({filter:/.*/,namespace:'stub'}, args => ({contents:stubs[args.path],loader:'tsx',resolveDir:process.cwd()}));
    }}],
  });
  script = result.outputFiles[0].text;
});
test.beforeEach(async ({page}) => {
  await page.route('**/setup-test', route => route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
  await page.goto('/setup-test'); await page.addScriptTag({content:script});
  await expect.poll(() => page.evaluate(() => window.app?.ready)).toBe(true);
});

for (const failure of ['storage', 'invitation']) test(`${failure} failure closes the attempted companion while demo stays active`, async ({page}) => {
  const outcome = await page.evaluate(async failure => {
    window.storageFails = failure === 'storage'; window.invitationFails = failure === 'invitation';
    try { return await window.app.connectCompanion('192.168.1.20', 'test-invitation'); }
    catch { return false; }
  }, failure);
  expect(outcome).toBe(false);
  await expect.poll(() => page.evaluate(() => window.app.deviceState.phase)).toBe('disconnected');
  expect(await page.evaluate(() => window.app.activeRoom)).toBe('livingRoom');
  expect(await page.evaluate(() => window.companions[0].closed)).toBe(true);
});

test('a late failed invitation cannot disconnect a replacement session', async ({page}) => {
  await page.evaluate(() => {
    window.invitationGate = new Promise((_, reject) => { window.rejectInvitation = reject; });
    window.firstAttempt = window.app.connectCompanion('192.168.1.20', 'test-invitation').catch(() => false);
  });
  await expect.poll(() => page.evaluate(() => window.app.deviceState.phase)).toBe('connected');
  await page.evaluate(async () => { await window.app.connect('192.168.1.30'); });
  await page.evaluate(async () => { window.rejectInvitation(new Error('Expired')); await window.firstAttempt; });
  await expect.poll(() => page.evaluate(() => window.app.deviceState.host)).toBe('192.168.1.30');
  expect(await page.evaluate(() => window.app.deviceState.phase)).toBe('connected');
});
