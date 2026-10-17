const { test, expect } = require('@playwright/test');
const { en, uk } = require('../../packages/i18n/dist/index.js');

async function noClipping(page) {
  expect(await page.locator('#root').evaluate(root => [...root.querySelectorAll('input, [role="button"], [dir="auto"]')].filter(node => {
    const r = node.getBoundingClientRect();
    return r.width && r.height && r.top < innerHeight && r.bottom > 0 && (r.left < -1 || r.right > innerWidth + 1);
  }).map(node => node.textContent))).toEqual([]);
}

const devices = [{ name: 'Example headphones', address: 'AABBCCDDEEFF', type: 'headphone' }, { name: 'Kitchen speaker', address: '112233445566', type: 'loudspeaker' }];
const snapshot = {
  model: 'Example Yamaha',
  features: { controls: ['power', 'volume', 'mute'], connectivity: [], bluetoothOutput: true, volumeRange: { min: 0, max: 60, step: 1 },
    sources: [{ id: 'server', name: 'PC / NAS', networkPlayer: true }, { id: 'cd', name: 'CD', networkPlayer: false }] },
  status: { power: 'on', input: 'server', volume: 20, mute: false }, trackUnavailable: true,
  bluetooth: { enabled: true, updating: false, devices },
};

for (const language of ['en', 'uk']) for (const [width, height] of [[320, 568], [430, 932]]) {
  test(`Bluetooth headphones ${language} ${width}x${height} open from Listen and connect once`, async ({ page }, testInfo) => {
    const t = language === 'en' ? en : uk;
    await page.setViewportSize({ width, height });
    await page.addInitScript(language => localStorage.setItem('mosaicast.preferences.v1', JSON.stringify({
      version: 1, language, appearance: 'light', demoStarted: true, mode: 'device', address: '192.168.1.50', connection: 'direct',
    })), language);
    const commands = [];
    await page.route('http://127.0.0.1:8092/**', route => {
      const request = route.request();
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (new URL(request.url()).pathname === '/command') commands.push(request.postDataJSON().command);
      return route.fulfill({ status: 200, headers, json: snapshot });
    });
    await page.goto('/');
    const open = page.getByRole('button', { name: t.bluetoothHeadphones, exact: true });
    await expect(open).toBeInViewport({ ratio: 1 });
    await expect(page.getByText(t.speakerVolume, { exact: true })).toBeVisible();
    await noClipping(page);
    await open.click();
    await expect(page.getByText(t.bluetoothOutputOn, { exact: true })).toBeVisible();
    const connect = page.getByRole('button', { name: t.bluetoothConnect, exact: true }).first();
    await connect.scrollIntoViewIfNeeded();
    await expect(connect).toBeInViewport({ ratio: 1 });
    await noClipping(page);
    if (width === 430 && language === 'uk') await page.screenshot({ path: testInfo.outputPath('bluetooth.png') });
    await connect.click();
    await expect.poll(() => commands.length).toBe(1);
    expect(commands).toEqual([{ type: 'bluetoothConnect', value: 'AABBCCDDEEFF' }]);
  });
}
