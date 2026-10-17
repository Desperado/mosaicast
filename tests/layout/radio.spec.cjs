const { test, expect } = require('@playwright/test');
const { en, uk } = require('../../packages/i18n/dist');

async function setup(page, language = 'en', options = {}) {
  await page.addInitScript(language => localStorage.setItem('mosaicast.preferences.v1', JSON.stringify({ version: 1, language, appearance: 'dark', demoStarted: true, mode: 'device', address: '192.168.1.50' })), language);
  const state = { model: 'CD-NT670D', features: { controls: ['power', 'volume', 'mute'], connectivity: [], volumeRange: { min: 0, max: 63, step: 1 }, sources: [{ id: 'tuner', name: 'FM / DAB', networkPlayer: false, tuner: true }], tuner: { bands: ['fm', 'dab'], fmRange: { min: 87500, max: 108000, step: 50 }, presets: { type: 'separate', num: 40 } } }, status: { power: 'on', input: 'tuner', volume: 12, maxVolume: 63, mute: false }, trackUnavailable: false, tuner: { band: 'fm', frequency: 94500, station: 'Fictional FM', text: 'A station reported by the test receiver', ready: true, presets: [{ slot: 1, band: 'fm', number: 94500 }] } };
  if (options.extraSource) state.features.sources.push({ id: 'cd', name: 'CD', networkPlayer: false });
  if (options.notReady) { state.tuner.band = 'dab'; state.tuner.ready = false; state.features.tuner.initialScan = true; }
  const commands = [];
  let gate;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  await page.route('http://127.0.0.1:8092/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().url().endsWith('/command')) {
      const command = route.request().postDataJSON().command;
      commands.push(command);
      if (gate) await gate;
      if (command.type === 'input') state.status.input = command.value;
      if (command.type === 'tunerScan') state.tuner.scanning = command.value === 'start';
      if (command.type === 'volume') state.status.volume += command.value === 'up' ? 1 : -1;
      if (command.type === 'tunerBand') { state.tuner.band = command.value; state.tuner.station = command.value === 'dab' ? 'Fictional DAB' : 'Fictional FM'; }
    }
    return route.fulfill({ status: 200, headers, json: state });
  });
  await page.goto('/');
  await expect(page.getByText('Fictional FM', { exact: true })).toBeVisible();
  return { commands, hold: () => { let release; gate = new Promise(resolve => { release = resolve; }); return () => { release(); gate = undefined; }; } };
}

async function fits(page) {
  expect(await page.getByTestId('screen-frame').evaluateAll(frames => frames.flatMap(frame => [...frame.querySelectorAll('[role="button"], [dir="auto"]')].filter(node => {
    if (!node.checkVisibility() || node.closest('[data-testid="collection-scroll"]')) return false;
    const r = node.getBoundingClientRect();
    return r.width && r.height && (r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1);
  }).map(node => node.getAttribute('aria-label') || node.textContent)))).toEqual([]);
}

for (const [width, height] of [[320, 568], [375, 667], [430, 932], [932, 430]]) for (const language of ['en', 'uk']) {
  test(`FM and DAB ${width}x${height} ${language} fit and expose station controls`, async ({ page }) => {
    const t = language === 'en' ? en : uk;
    await page.setViewportSize({ width, height });
    const { commands } = await setup(page, language);
    await fits(page);
    for (const name of [t.seekDown, t.seekUp, t.tuneDown, t.tuneUp, t.presets]) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
    if (width === 430 && language === 'en') await page.screenshot({ path: '.context/previews/listen-fm.png' });
    await page.getByRole('button', { name: t.seekUp, exact: true }).click();
    await expect.poll(() => commands.length).toBe(1);
    await page.getByRole('button', { name: 'DAB', exact: true }).click();
    await expect(page.getByText('Fictional DAB', { exact: true })).toBeVisible();
    await fits(page);
    if (width === 430 && language === 'en') await page.screenshot({ path: '.context/previews/listen-dab.png' });
    await page.getByRole('button', { name: t.nextStation, exact: true }).click();
    await expect.poll(() => commands.length).toBe(3);
    expect(commands).toEqual([{ type: 'tunerTune', value: 'auto_up' }, { type: 'tunerBand', value: 'dab' }, { type: 'tunerService', value: 'next' }]);
  });
}

test('volume requests keep every control visually steady and never queue another write', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  const { hold, commands } = await setup(page);
  const plus = page.getByRole('button', { name: `${en.volume} +`, exact: true });
  const controls = [plus, page.getByRole('button', { name: en.standby, exact: true }), page.getByRole('button', { name: en.seekUp, exact: true }), page.getByRole('button', { name: en.refresh, exact: true })];
  const opacity = button => button.evaluate(node => { let value = 1; for (let n = node; n; n = n.parentElement) value *= Number(getComputedStyle(n).opacity); return value; });
  const before = await Promise.all(controls.map(opacity));
  const position = await plus.boundingBox();
  const release = hold();
  await plus.click();
  await expect(plus).toBeDisabled();
  await expect(plus).toHaveAttribute('aria-busy', 'true');
  for (const control of controls.slice(1)) await expect(control).toHaveAttribute('aria-busy', 'false');
  expect(await Promise.all(controls.map(opacity))).toEqual(before);
  expect(await plus.boundingBox()).toEqual(position);
  await page.getByRole('button', { name: en.sources, exact: true }).click();
  const source = page.getByRole('button', { name: 'FM / DAB', exact: true });
  await expect(source).toBeDisabled();
  // Wait for the source sheet's entrance animation before measuring opacity.
  await expect.poll(() => opacity(source)).toBe(1);
  release();
  await expect(source).toBeEnabled();
  await page.getByRole('button', { name: en.close, exact: true }).last().click();
  await expect(plus).toBeEnabled();
  await expect(plus).toHaveAttribute('aria-busy', 'false');
  expect(commands).toEqual([{ type: 'volume', value: 'up' }]);
});

test('radio presets recall the reported slot once', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const { commands } = await setup(page);
  await page.getByRole('button', { name: en.presets, exact: true }).click();
  await page.getByRole('button', { name: `${en.preset} 1 · 94.5 MHz`, exact: true }).click();
  await expect.poll(() => commands.length).toBe(1);
  expect(commands).toEqual([{ type: 'tunerPreset', value: 1 }]);
});


for (const language of ['en', 'uk']) test(`DAB initial scan and cancellation fit a small phone in ${language}`, async ({ page }) => {
  const t = language === 'en' ? en : uk;
  await page.setViewportSize({ width: 320, height: 568 });
  const { commands } = await setup(page, language, { notReady: true });
  await fits(page);
  await page.getByRole('button', { name: t.scanStations, exact: true }).click();
  await expect(page.getByText(t.scanningStations, { exact: true })).toBeVisible();
  await fits(page);
  await page.getByRole('button', { name: t.cancelScan, exact: true }).click();
  await expect(page.getByRole('button', { name: t.scanStations, exact: true })).toBeEnabled();
  expect(commands).toEqual([{ type: 'tunerScan', value: 'start' }, { type: 'tunerScan', value: 'cancel' }]);
});

test('source selection keeps the sheet steady and marks only the selected request until observation', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  const { hold, commands } = await setup(page, 'en', { extraSource: true });
  await page.getByRole('button', { name: en.sources, exact: true }).click();
  const source = page.getByRole('button', { name: 'CD', exact: true });
  const other = page.getByRole('button', { name: 'FM / DAB', exact: true });
  await source.click({ trial: true });
  const before = await source.boundingBox();
  const release = hold();
  await source.click();
  await expect(source).toHaveAttribute('aria-busy', 'true');
  await expect(other).toHaveAttribute('aria-busy', 'false');
  await expect(other).toBeDisabled();
  await expect(page.getByText(en.chooseSource, { exact: true })).toBeVisible();
  expect(await source.boundingBox()).toEqual(before);
  release();
  await expect(page.getByText(en.chooseSource, { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: en.sources, exact: true })).toHaveText('CD');
  expect(commands).toEqual([{ type: 'input', value: 'cd' }]);
});
