const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MusicCastClient, DeviceSession, demoController } = require('../dist');
const { parseBluetoothInfo, parseBluetoothList, parseFeatures } = require('../dist/parsers');

// Fictional Yamaha responses. All fetches are injected; no LAN access.
const headphone = { name: 'Example headphones', type: 'headphone', address: 'AABBCCDDEEFF' };
function device(options = {}) {
  const calls = [], writes = [];
  const state = { supported: true, enabled: true, connected: false, updating: false, devices: [headphone], power: 'on', input: 'cd', ...options };
  const features = () => ({
    system: { func_list: state.supported ? ['bluetooth_tx_setting'] : ['bluetooth'], input_list: [{ id: 'cd' }, { id: 'bluetooth' }] },
    zone: [{ id: 'main', func_list: ['power'], input_list: ['cd', 'bluetooth'] }],
  });
  const client = new MusicCastClient('192.168.1.50', async value => {
    const url = new URL(value), route = url.pathname.split('/').at(-1);
    calls.push(route);
    let result;
    if (route === 'getDeviceInfo') result = { model_name: 'Fictional Yamaha' };
    else if (route === 'getFeatures') result = features();
    else if (route === 'getStatus') result = { power: state.power, input: state.input };
    else if (route === 'getBluetoothInfo') {
      if (state.infoFails) throw new TypeError('Offline');
      result = { bluetooth_tx_setting: state.enabled, bluetooth_device: { connected: state.connected, ...headphone } };
    } else if (route === 'getBluetoothDeviceList') result = { updating: state.updating, device_list: state.devices };
    else {
      writes.push({ route, params: Object.fromEntries(url.searchParams) });
      if (state.writeFails) throw Object.assign(new Error('Timeout'), { name: 'AbortError' });
      if (!state.ignoreWrite) {
        if (route === 'setBluetoothTxSetting') state.enabled = url.searchParams.get('enable') === 'true';
        else if (route === 'updateBluetoothDeviceList') state.updating = true;
        else if (route === 'connectBluetoothDevice') state.connected = true;
        else if (route === 'disconnectBluetoothDevice') state.connected = false;
        else throw new Error(`Unexpected route ${route}`);
      }
      result = {};
    }
    return new Response(JSON.stringify({ response_code: 0, ...result }));
  }, async () => {});
  return { client, calls, writes, state, features };
}

test('Bluetooth output requires the transmit capability, not Bluetooth input support', async () => {
  const fixture = device({ supported: false });
  assert.equal(parseFeatures(fixture.features()).bluetoothOutput, false);
  assert.equal((await fixture.client.read()).bluetooth, undefined);
  await assert.rejects(fixture.client.execute({ type: 'bluetoothOutput', value: true }), /does not support/);
  assert.equal(fixture.calls.includes('getBluetoothInfo'), false);
  assert.deepEqual(fixture.writes, []);
  fixture.state.supported = true;
  assert.equal((await fixture.client.execute({ type: 'bluetoothOutput', value: true })).bluetooth.enabled, true);
  fixture.state.supported = false;
  await assert.rejects(fixture.client.execute({ type: 'bluetoothScan', value: 'start' }), /does not support/);
  assert.deepEqual(fixture.writes, []);
});

test('Bluetooth parsers reject ambiguous state and invalid addresses; lists are bounded and deduplicated', () => {
  assert.throws(() => parseBluetoothInfo({ bluetooth_tx_setting: 'true' }));
  assert.throws(() => parseBluetoothInfo({ bluetooth_tx_setting: true, bluetooth_device: {} }));
  assert.throws(() => parseBluetoothInfo({ bluetooth_tx_setting: true, bluetooth_device: { connected: true, address: 'bad' } }));
  assert.equal(parseBluetoothInfo({ bluetooth_tx_setting: false, bluetooth_device: { connected: false } }).connected, undefined);
  for (const data of [{ updating: 'false', device_list: [] }, { updating: false }, { updating: false, device_list: Array(129).fill(headphone) }, { updating: false, device_list: [{ ...headphone, address: '../path' }] }]) assert.throws(() => parseBluetoothList(data));
  const parsed = parseBluetoothList({ updating: true, device_list: [{ ...headphone, address: headphone.address.toLowerCase(), type: 'future' }, headphone] });
  assert.equal(parsed.updating, true);
  assert.deepEqual(parsed.devices, [{ ...headphone, type: 'unknown' }]);
});

test('ordinary refresh only reads cached Bluetooth state; disabled output does not fetch the list', async () => {
  const fixture = device({ enabled: false });
  assert.equal((await fixture.client.read()).bluetooth.enabled, false);
  assert.equal(fixture.calls.includes('getBluetoothDeviceList'), false);
  await fixture.client.execute({ type: 'bluetoothOutput', value: true });
  const snapshot = await fixture.client.read();
  assert.deepEqual(snapshot.bluetooth.devices, [headphone]);
  assert.deepEqual(fixture.writes, [{ route: 'setBluetoothTxSetting', params: { enable: 'true' } }]);
  await fixture.client.execute({ type: 'bluetoothOutput', value: false });
  assert.equal((await fixture.client.read()).bluetooth.enabled, false);
});

test('idle Bluetooth polling performs only two read cycles per minute with no device writes', async () => {
  const fixture = device();
  let now = 0;
  const session = new DeviceSession(() => fixture.client, () => {}, () => now);
  await session.connect('192.168.1.50');
  fixture.calls.length = 0;
  for (now = 1000; now <= 60000; now += 1000) await session.poll();
  assert.deepEqual(fixture.calls, ['getStatus', 'getBluetoothInfo', 'getBluetoothDeviceList', 'getStatus', 'getBluetoothInfo', 'getBluetoothDeviceList']);
  assert.deepEqual(fixture.writes, []);
});

test('search runs once on request and blocks another search or connection while updating', async () => {
  const fixture = device();
  assert.equal((await fixture.client.execute({ type: 'bluetoothScan', value: 'start' })).bluetooth.updating, true);
  await fixture.client.read();
  await assert.rejects(fixture.client.execute({ type: 'bluetoothScan', value: 'start' }), /search to finish/);
  await assert.rejects(fixture.client.execute({ type: 'bluetoothConnect', value: headphone.address }), /search to finish/);
  assert.deepEqual(fixture.writes, [{ route: 'updateBluetoothDeviceList', params: {} }]);
  fixture.state.updating = false;
  assert.equal((await fixture.client.read()).bluetooth.updating, false);
});

test('connection uses a fresh listed address and disconnect requires observed state', async () => {
  const fixture = device();
  await fixture.client.read();
  for (const address of ['AA:BB:CC:DD:EE:FF', '112233445566', '../getStatus']) await assert.rejects(fixture.client.execute({ type: 'bluetoothConnect', value: address }));
  assert.deepEqual(fixture.writes, []);
  const connected = await fixture.client.execute({ type: 'bluetoothConnect', value: headphone.address.toLowerCase() });
  assert.equal(connected.bluetooth.connected.address, headphone.address);
  await fixture.client.execute({ type: 'bluetoothConnect', value: headphone.address });
  assert.equal(fixture.writes.length, 1);
  fixture.state.ignoreWrite = true;
  await assert.rejects(fixture.client.execute({ type: 'bluetoothDisconnect', value: 'disconnect' }), /did not confirm/);
  assert.equal(fixture.writes.length, 2);
  fixture.state.ignoreWrite = false;
  assert.equal((await fixture.client.execute({ type: 'bluetoothDisconnect', value: 'disconnect' })).bluetooth.connected, undefined);
  await fixture.client.execute({ type: 'bluetoothDisconnect', value: 'disconnect' });
  assert.deepEqual(fixture.writes, [
    { route: 'connectBluetoothDevice', params: { address: headphone.address } },
    { route: 'disconnectBluetoothDevice', params: {} },
    { route: 'disconnectBluetoothDevice', params: {} },
  ]);
  fixture.state.devices = [];
  await assert.rejects(fixture.client.execute({ type: 'bluetoothConnect', value: headphone.address }), /no longer available/);
  assert.equal(fixture.writes.length, 3);
});

test('Bluetooth commands are gated by power, output setting and current input', async () => {
  const fixture = device({ enabled: false });
  await assert.rejects(fixture.client.execute({ type: 'bluetoothScan', value: 'start' }), /Enable Bluetooth/);
  fixture.state.power = 'standby';
  await assert.rejects(fixture.client.execute({ type: 'bluetoothOutput', value: true }), /Power on/);
  fixture.state.power = 'on'; fixture.state.input = 'bluetooth';
  await assert.rejects(fixture.client.execute({ type: 'bluetoothOutput', value: true }), /another input/);
  fixture.state.enabled = true; fixture.state.connected = true;
  await assert.rejects(fixture.client.execute({ type: 'bluetoothScan', value: 'start' }), /another input/);
  await assert.rejects(fixture.client.execute({ type: 'bluetoothConnect', value: headphone.address }), /another input/);
  assert.deepEqual(fixture.writes, []);
  await fixture.client.execute({ type: 'bluetoothDisconnect', value: 'disconnect' });
  await fixture.client.execute({ type: 'bluetoothOutput', value: false });
  assert.equal(fixture.writes.length, 2);
});

test('acknowledged enable/connect and timed-out Bluetooth writes never count as confirmed or retry', async () => {
  for (const [command, state] of [
    [{ type: 'bluetoothOutput', value: true }, { enabled: false, ignoreWrite: true }],
    [{ type: 'bluetoothConnect', value: headphone.address }, { ignoreWrite: true }],
    [{ type: 'bluetoothConnect', value: headphone.address }, { writeFails: true }],
  ]) {
    const fixture = device(state);
    await assert.rejects(fixture.client.execute(command), /did not confirm|uncertain/);
    assert.equal(fixture.writes.length, 1);
  }
});

test('optional Bluetooth read failures preserve player status and prevent Bluetooth writes', async () => {
  const fixture = device({ infoFails: true });
  const snapshot = await fixture.client.read();
  assert.equal(snapshot.status.power, 'on');
  assert.equal(snapshot.bluetooth, undefined);
  await assert.rejects(fixture.client.execute({ type: 'bluetoothConnect', value: headphone.address }));
  assert.deepEqual(fixture.writes, []);
});

test('session reports a search as accepted and holds timed-out Bluetooth writes until explicit refresh', async () => {
  const fixture = device(), session = new DeviceSession(() => fixture.client);
  await session.connect('192.168.1.50');
  await session.execute({ type: 'bluetoothScan', value: 'start' });
  assert.equal(session.state.outcome, 'bluetoothSearchStarted');
  fixture.state.updating = false; fixture.state.writeFails = true;
  await session.execute({ type: 'bluetoothConnect', value: headphone.address });
  assert.equal(session.state.needsRefresh, true);
  await session.refresh(false);
  await session.execute({ type: 'bluetoothConnect', value: headphone.address });
  assert.equal(fixture.writes.length, 2);
  fixture.state.writeFails = false;
  await session.refresh();
  await session.execute({ type: 'bluetoothConnect', value: headphone.address });
  assert.equal(session.state.outcome, 'confirmed');
  assert.equal(fixture.writes.length, 3);
});

test('demo does not advertise Bluetooth output or simulate hardware commands', async () => {
  const demo = demoController();
  assert.equal((await demo.read()).features.bluetoothOutput, undefined);
  for (const command of [{ type: 'bluetoothOutput', value: true }, { type: 'bluetoothScan', value: 'start' }, { type: 'bluetoothConnect', value: headphone.address }, { type: 'bluetoothDisconnect', value: 'disconnect' }]) await assert.rejects(demo.execute(command), /demo mode/);
  assert.equal((await demo.read()).bluetooth, undefined);
});

test('Bluetooth crosses the companion protocol with the same validation, and phone authority fences its writes', async () => {
  const { validCommand, peerDeviceFetch, CommandRejectedError } = require('../dist');
  for (const command of [{ type: 'bluetoothOutput', value: true }, { type: 'bluetoothScan', value: 'start' }, { type: 'bluetoothConnect', value: 'aabbccddeeff' }, { type: 'bluetoothDisconnect', value: 'disconnect' }]) assert.equal(validCommand(command), true);
  for (const command of [{ type: 'bluetoothOutput', value: 'true' }, { type: 'bluetoothScan', value: 'stop' }, { type: 'bluetoothConnect', value: 'AA:BB:CC:DD:EE:FF' }, { type: 'bluetoothConnect', value: '../setPower' }, { type: 'bluetoothDisconnect', value: true }, { type: 'bluetoothConnect', value: 'AABBCCDDEEFF', extra: 1 }]) assert.equal(validCommand(command), false);
  let dispatched = 0;
  const fenced = peerDeviceFetch(() => false, async () => { dispatched++; });
  for (const route of ['system/setBluetoothTxSetting', 'system/updateBluetoothDeviceList', 'system/connectBluetoothDevice', 'system/disconnectBluetoothDevice']) await assert.rejects(fenced(`http://192.168.1.50/YamahaExtendedControl/v1/${route}`));
  assert.equal(dispatched, 0);
  // A gate that fails before dispatch is a rejection, not an uncertain write.
  const { client, writes } = device({ enabled: false });
  await client.read();
  await assert.rejects(client.execute({ type: 'bluetoothScan', value: 'start' }), error => error instanceof CommandRejectedError);
  assert.equal(writes.length, 0);
});

test('shared Bluetooth state reaches both clients and a lost connect reply cannot replay the write', async () => {
  const { CompanionCoordinator, CompanionController } = require('../dist');
  const fixture = device();
  const coordinator = new CompanionCoordinator(fixture.client, 'bluetooth-generation');
  let loseConnectReply = true;
  const exchange = id => async request => {
    if (!request) return { sequence: coordinator.lastSequence(id), outcome: 'observed', state: coordinator.state };
    const reply = await coordinator.handle(id, request);
    if (id === 'phone' && request.operation.command?.type === 'bluetoothConnect' && loseConnectReply) {
      loseConnectReply = false;
      throw new Error('Lost reply after dispatch');
    }
    return reply;
  };
  const phone = new CompanionController('192.168.1.50', exchange('phone'));
  const tv = new CompanionController('192.168.1.50', exchange('tv'));
  await coordinator.poll();
  await phone.reconcile();
  await assert.rejects(phone.execute({ type: 'bluetoothConnect', value: headphone.address }), error => error.code === 'uncertain');
  await tv.read();
  assert.equal(tv.state.snapshot.bluetooth.connected.address, headphone.address);
  await coordinator.poll();
  await phone.read();
  await assert.rejects(phone.execute({ type: 'bluetoothConnect', value: headphone.address }), error => error.code === 'reconcile');
  assert.equal(fixture.writes.length, 1);
  await phone.reconcile();
  await phone.execute({ type: 'bluetoothDisconnect', value: 'disconnect' });
  await tv.read();
  assert.equal(tv.state.snapshot.bluetooth.connected, undefined);
  assert.deepEqual(fixture.writes.map(write => write.route), ['connectBluetoothDevice', 'disconnectBluetoothDevice']);
});
