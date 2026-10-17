const http = require('node:http');
const { Buffer } = require('node:buffer');
const { BrowseError, MusicCastClient, privateIPv4, validBrowseAction, validBrowseIndex } = require('../packages/musiccast/dist');

const origins = new Set([8081, 8091, 19006].flatMap(port => [`http://localhost:${port}`, `http://127.0.0.1:${port}`]));
function validCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command) || Object.keys(command).some(key => !['type', 'value'].includes(key))) return false;
  const values = { power: ['on', 'standby'], input: [], volume: ['up', 'down'], mute: [true, false], playback: ['play', 'pause', 'previous', 'next'], tunerBand: ['fm', 'dab'], tunerTune: ['up', 'down', 'auto_up', 'auto_down'], tunerService: ['previous', 'next'], tunerScan: ['start', 'cancel'], bluetoothOutput: [true, false], bluetoothScan: ['start'], bluetoothDisconnect: ['disconnect'] };
  if (command.type === 'tunerPreset') return Number.isInteger(command.value) && command.value >= 1 && command.value <= 256;
  if (command.type === 'bluetoothConnect') return typeof command.value === 'string' && /^[\da-f]{12}$/i.test(command.value);
  return command.type === 'input' ? typeof command.value === 'string' && /^[a-z][a-z0-9_]{0,47}$/.test(command.value)
    : Object.hasOwn(values, command.type) && values[command.type].includes(command.value);
}

function createBridge(createClient = host => new MusicCastClient(host)) {
  const clients = new Map();
  let inFlight = 0;
  const server = http.createServer(async (request, response) => {
    function reply(status, data) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); }
    const port = server.address().port;
    if (!['127.0.0.1:' + port, 'localhost:' + port].includes(request.headers.host) || !origins.has(request.headers.origin)) {
      reply(403, { error: 'Forbidden origin or host' }); return;
    }
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    response.setHeader('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'POST');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.writeHead(204); response.end(); return;
    }
    if (request.method !== 'POST' || !['/read', '/command', '/browse', '/browse-action'].includes(request.url) || request.headers['content-type'] !== 'application/json') {
      reply(400, { error: 'Unsupported request' }); return;
    }
    if (inFlight >= 8) { reply(429, { error: 'Bridge busy' }); return; }
    inFlight++;
    try {
      const chunks = []; let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 4096) { reply(413, { error: 'Request too large' }); return; }
        chunks.push(chunk);
      }
      let data;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { reply(400, { error: 'Invalid JSON' }); return; }
      if (!data || typeof data.host !== 'string' || !privateIPv4(data.host) || (request.url === '/command' && !validCommand(data.command))
        || (request.url === '/browse' && (!['deezer', 'server', 'usb', 'net_radio'].includes(data.input) || !validBrowseIndex(data.index)))
        || (request.url === '/browse-action' && !validBrowseAction(data.action))) {
        reply(400, { error: 'Invalid address or command' }); return;
      }
      if (!clients.has(data.host)) {
        if (clients.size >= 8) { reply(429, { error: 'Device limit reached; restart bridge' }); return; }
        clients.set(data.host, createClient(data.host));
      }
      const client = clients.get(data.host);
      const result = request.url === '/read' ? await client.read() : request.url === '/command' ? await client.execute(data.command)
        : request.url === '/browse' ? await client.browse(data.input, data.index) : await client.browseAction(data.action);
      reply(200, result);
    } catch (error) { reply(503, { error: 'Device request failed. Refresh before another command.', ...(error instanceof BrowseError ? { code: error.code } : {}) }); }
    finally { inFlight--; }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxConnections = 16;
  return server;
}

if (require.main === module) {
  const server = createBridge();
  server.on('error', () => { process.stderr.write('Could not start bridge on 127.0.0.1:8092. Check whether it is already running.\n'); process.exitCode = 1; });
  server.listen(8092, '127.0.0.1', () => { process.stdout.write('Mosaicast local browser bridge: http://127.0.0.1:8092\n'); });
}
module.exports = { createBridge, validCommand };
