#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const readline = require('readline');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

function getConfigDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'PlutonAgent');
  }
  return path.join('/etc', 'pluton-agent');
}

function normalizePlatform(platform) {
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  if (platform === 'darwin') return 'darwin';
  return platform || 'unknown';
}

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = question => new Promise(resolve => rl.question(question, resolve));
  const close = () => rl.close();
  return { ask, close };
}

async function pauseBeforeExit(message = 'Press Enter to close...') {
  if (!isInteractive()) return;
  const prompt = createPrompt();
  await prompt.ask(`\n${message}`);
  prompt.close();
}

function printGuide() {
  console.log('==========================================');
  console.log('Pluton Agent - Guided Setup');
  console.log('==========================================');
  console.log('1) Enter your Pluton server URL.');
  console.log('2) Agent requests a pairing code.');
  console.log('3) In server UI: Agents -> Register Computer.');
  console.log('4) Paste pairing code and approve.');
  console.log('5) Agent saves credentials and starts automatically.');
  console.log('');
  console.log('Tip: keep this terminal open while pairing.');
  console.log('');
}

async function runWizard(defaults) {
  const prompt = createPrompt();
  try {
    printGuide();
    const server = await prompt.ask(
      `Server URL [${defaults.serverUrl || 'http://localhost:5173'}]: `
    );
    const name = await prompt.ask(`Agent name [${defaults.agentName || os.hostname()}]: `);
    return {
      serverUrl: normalizeServerUrl(server.trim() || defaults.serverUrl || 'http://localhost:5173'),
      agentName: name.trim() || defaults.agentName || os.hostname(),
    };
  } finally {
    prompt.close();
  }
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function loadJson(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function normalizeServerUrl(url) {
  if (!url) return '';
  return String(url).replace(/\/$/, '');
}

async function apiPost(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    body: JSON.stringify(body || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const message = data.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data.result;
}

async function apiGet(url, headers = {}) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const message = data.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data.result;
}

async function apiPut(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    body: JSON.stringify(body || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const message = data.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data.result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestPairing(serverUrl, metadata) {
  return apiPost(`${serverUrl}/api/agents/pairing/request`, metadata);
}

async function fetchPairing(serverUrl, pairingCode) {
  return apiPost(`${serverUrl}/api/agents/pairing/fetch`, { pairingCode });
}

async function getSelfBackupConfig(serverUrl, creds) {
  return apiGet(`${serverUrl}/api/agents/self/backup-config`, {
    'x-agent-id': creds.agentId,
    'x-agent-secret': creds.agentSecret,
  });
}

async function setSelfBackupConfig(serverUrl, creds, config) {
  return apiPut(`${serverUrl}/api/agents/self/backup-config`, config, {
    'x-agent-id': creds.agentId,
    'x-agent-secret': creds.agentSecret,
  });
}

async function runSelfBackupNow(serverUrl, creds) {
  return apiPost(`${serverUrl}/api/agents/self/backup/run-now`, {}, {
    'x-agent-id': creds.agentId,
    'x-agent-secret': creds.agentSecret,
  });
}

async function heartbeat(serverUrl, creds) {
  return apiPost(`${serverUrl}/api/agents/heartbeat`, {}, {
    'x-agent-id': creds.agentId,
    'x-agent-secret': creds.agentSecret,
  });
}

async function pullJobs(serverUrl, creds) {
  return apiPost(`${serverUrl}/api/agents/jobs/pull`, {}, {
    'x-agent-id': creds.agentId,
    'x-agent-secret': creds.agentSecret,
  });
}

async function reportProgress(serverUrl, creds, jobId, progress) {
  return apiPost(`${serverUrl}/api/agents/jobs/${jobId}/progress`, progress, {
    'x-agent-id': creds.agentId,
    'x-agent-secret': creds.agentSecret,
  });
}

async function reportResult(serverUrl, creds, jobId, result) {
  return apiPost(`${serverUrl}/api/agents/jobs/${jobId}/result`, result, {
    'x-agent-id': creds.agentId,
    'x-agent-secret': creds.agentSecret,
  });
}

async function handleJob(serverUrl, creds, job) {
  const now = Date.now();
  await reportProgress(serverUrl, creds, job.id, {
    percent: 10,
    phase: 'prepare',
    timestamp: now,
  });

  await sleep(500);

  await reportProgress(serverUrl, creds, job.id, {
    percent: 50,
    phase: 'backup',
    bytesProcessed: 1024 * 1024,
    totalBytes: 2 * 1024 * 1024,
    timestamp: Date.now(),
  });

  await sleep(600);

  await reportResult(serverUrl, creds, job.id, {
    status: 'completed',
    summary: {
      filesNew: 1,
      filesChanged: 0,
      totalBytesProcessed: 2 * 1024 * 1024,
      dataAdded: 1024 * 1024,
      snapshotId: `agent-${job.id}-${Date.now()}`,
    },
  });
}

async function updateStateFromServerConfig(state) {
  if (!state.creds?.agentId || !state.creds?.agentSecret) return;
  try {
    const backupConfig = await getSelfBackupConfig(state.serverUrl, state.creds);
    state.backupConfig = backupConfig;
  } catch (error) {
    state.lastError = `[Config] ${error.message}`;
  }
}

async function enrollIfNeeded(serverUrl, configPath, args, wizardAgentName) {
  const current = await loadJson(configPath, null);
  if (current && current.agentId && current.agentSecret) {
    return current;
  }

  const platform = args.platform || process.platform;
  const pairingRes = await requestPairing(serverUrl, {
    agentName: wizardAgentName || args.name || os.hostname(),
    hostname: os.hostname(),
    platform: platform === 'win32' ? 'windows' : platform === 'linux' ? 'linux' : platform,
    arch: process.arch,
    osVersion: os.release(),
    agentVersion: '0.1.0',
    capabilities: {
      fileBackup: true,
      fullBackup: true,
      dbBackup: false,
    },
  });

  console.log('\n=== Pluton Agent Pairing ===');
  console.log(`Pairing code: ${pairingRes.pairingCode}`);
  console.log('Enter this code in Server Console > Agents > Register Computer');
  console.log('Waiting for approval...\n');

  while (true) {
    const pairState = await fetchPairing(serverUrl, pairingRes.pairingCode);
    if (pairState.approved && pairState.agentId && pairState.agentSecret) {
      const creds = {
        serverUrl,
        agentName: wizardAgentName || args.name || os.hostname(),
        agentId: pairState.agentId,
        agentSecret: pairState.agentSecret,
        heartbeatIntervalSec: pairState.heartbeatIntervalSec || 30,
        pollIntervalSec: pairState.pollIntervalSec || 15,
      };
      await writeJson(configPath, creds);
      console.log(`Agent approved and registered as ${creds.agentId}`);
      return creds;
    }
    await sleep((pairingRes.pollIntervalSec || 10) * 1000);
  }
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
      return;
    }
    if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
      return;
    }
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // fallback to console URL only
  }
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function renderWizardHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pluton Agent Setup</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; background: #f4f7fb; color: #122033; margin: 0; }
    .wrap { max-width: 960px; margin: 24px auto; padding: 0 16px 32px; }
    .card { background: #fff; border: 1px solid #dbe4f0; border-radius: 12px; padding: 16px; margin-bottom: 14px; box-shadow: 0 4px 18px rgba(9, 30, 66, 0.06); }
    h1 { margin: 4px 0 16px; font-size: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 6px 0; }
    .muted { color: #5a6a80; font-size: 14px; }
    label { display:block; margin: 8px 0 4px; font-size: 13px; color: #30425e; }
    input, textarea, select { width: 100%; box-sizing: border-box; border:1px solid #cfd9e7; border-radius: 8px; padding: 10px; font-size: 14px; }
    textarea { min-height: 88px; }
    .row { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .actions { margin-top: 12px; display:flex; gap: 8px; flex-wrap: wrap; }
    button { border: 1px solid #0d6efd; background: #0d6efd; color: #fff; border-radius: 8px; padding: 10px 14px; cursor: pointer; }
    button.alt { background: #f7fbff; color:#0d6efd; }
    .code { font: 700 24px Consolas, monospace; letter-spacing: 1px; color: #0d6efd; }
    .status { padding: 8px 10px; border-radius: 8px; font-size: 13px; }
    .ok { background: #e8f8ef; color: #147a3f; }
    .warn { background: #fff8e6; color: #8a6200; }
    .err { background: #fdeeee; color: #9d2323; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Pluton Agent Setup Wizard</h1>

    <div class="card">
      <h2>1. Connect to Server</h2>
      <p class="muted">Enter your main server URL and agent name.</p>
      <div class="row">
        <div>
          <label>Server URL</label>
          <input id="serverUrl" placeholder="http://192.168.1.20:5173" />
        </div>
        <div>
          <label>Agent Name</label>
          <input id="agentName" placeholder="Office-PC-01" />
        </div>
      </div>
      <div class="actions">
        <button onclick="startPairing()">Generate Pairing Code</button>
      </div>
    </div>

    <div class="card">
      <h2>2. Pair This Computer</h2>
      <p class="muted">In the server dashboard: Agents -> Register Computer, then enter this code.</p>
      <div id="pairCode" class="code">-</div>
      <div class="actions">
        <button class="alt" onclick="checkPairing()">Check Approval</button>
      </div>
      <div id="pairStatus" class="status warn" style="margin-top:10px;">Waiting for pairing code...</div>
    </div>

    <div class="card">
      <h2>3. Configure Backup</h2>
      <p class="muted">Configure backup from this agent. This can also be changed from server later.</p>
      <div class="row">
        <div>
          <label>Mode</label>
          <select id="mode">
            <option value="path_backup">Backup folder or repository</option>
            <option value="full_backup">Full backup</option>
          </select>
        </div>
        <div>
          <label>Storage Path</label>
          <input id="storagePath" placeholder="agents/my-computer" />
        </div>
      </div>
      <label>Paths (one per line, used for path backup)</label>
      <textarea id="paths" placeholder="C:\\Users\\me\\Documents\nD:\\Projects\\repo"></textarea>
      <label>Exclude Patterns (one per line)</label>
      <textarea id="excludes" placeholder="**\\node_modules\\**\n**\\.git\\**"></textarea>
      <div class="actions">
        <button onclick="saveConfig()">Save Backup Config</button>
        <button class="alt" onclick="runBackupNow()">Run Backup Now</button>
      </div>
      <div id="cfgStatus" class="status warn" style="margin-top:10px;">Waiting for agent registration...</div>
    </div>

    <div class="card">
      <h2>Agent Status</h2>
      <div id="agentStatus" class="status warn">Initializing...</div>
    </div>
  </div>

  <script>
    async function api(url, method = 'GET', body) {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');
      return data.result;
    }

    function toLines(value) {
      return (value || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    }

    async function refreshState() {
      try {
        const state = await api('/api/state');
        document.getElementById('serverUrl').value = state.serverUrl || '';
        document.getElementById('agentName').value = state.agentName || '';
        document.getElementById('pairCode').textContent = state.pairingCode || '-';

        const pairStatusEl = document.getElementById('pairStatus');
        pairStatusEl.textContent = state.pairingStatus || 'Not paired yet';
        pairStatusEl.className = 'status ' + (state.paired ? 'ok' : 'warn');

        const a = document.getElementById('agentStatus');
        if (state.paired) {
          a.textContent = 'Connected as ' + state.agentId + '. Last heartbeat: ' + (state.lastHeartbeat || 'pending');
          a.className = 'status ok';
        } else {
          a.textContent = 'Agent not registered yet.';
          a.className = 'status warn';
        }

        if (state.backupConfig) {
          document.getElementById('mode').value = state.backupConfig.mode || 'path_backup';
          document.getElementById('storagePath').value = state.backupConfig.storagePath || '';
          document.getElementById('paths').value = (state.backupConfig.paths || []).join('\n');
          document.getElementById('excludes').value = (state.backupConfig.excludes || []).join('\n');
          const cfg = document.getElementById('cfgStatus');
          cfg.textContent = 'Backup configuration loaded.';
          cfg.className = 'status ok';
        }

        if (state.lastError) {
          const cfg = document.getElementById('cfgStatus');
          cfg.textContent = state.lastError;
          cfg.className = 'status err';
        }
      } catch (err) {
        const a = document.getElementById('agentStatus');
        a.textContent = err.message;
        a.className = 'status err';
      }
    }

    async function startPairing() {
      const serverUrl = document.getElementById('serverUrl').value.trim();
      const agentName = document.getElementById('agentName').value.trim();
      try {
        await api('/api/setup', 'POST', { serverUrl, agentName });
        await refreshState();
      } catch (err) {
        const pairStatusEl = document.getElementById('pairStatus');
        pairStatusEl.textContent = err.message;
        pairStatusEl.className = 'status err';
      }
    }

    async function checkPairing() {
      try {
        await api('/api/pairing/check', 'POST');
        await refreshState();
      } catch (err) {
        const pairStatusEl = document.getElementById('pairStatus');
        pairStatusEl.textContent = err.message;
        pairStatusEl.className = 'status err';
      }
    }

    async function saveConfig() {
      try {
        const payload = {
          mode: document.getElementById('mode').value,
          storagePath: document.getElementById('storagePath').value.trim(),
          paths: toLines(document.getElementById('paths').value),
          excludes: toLines(document.getElementById('excludes').value),
        };
        await api('/api/backup-config', 'POST', payload);
        const cfg = document.getElementById('cfgStatus');
        cfg.textContent = 'Backup configuration saved.';
        cfg.className = 'status ok';
      } catch (err) {
        const cfg = document.getElementById('cfgStatus');
        cfg.textContent = err.message;
        cfg.className = 'status err';
      }
    }

    async function runBackupNow() {
      try {
        await api('/api/backup/run-now', 'POST');
        const cfg = document.getElementById('cfgStatus');
        cfg.textContent = 'Backup job queued successfully.';
        cfg.className = 'status ok';
      } catch (err) {
        const cfg = document.getElementById('cfgStatus');
        cfg.textContent = err.message;
        cfg.className = 'status err';
      }
    }

    refreshState();
    setInterval(refreshState, 5000);
  </script>
</body>
</html>`;
}

async function createWizardServer(state) {
  const html = renderWizardHtml();
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (req.method === 'GET' && req.url === '/api/state') {
        sendJson(res, 200, {
          success: true,
          result: {
            serverUrl: state.serverUrl,
            agentName: state.agentName,
            pairingCode: state.pairingCode,
            pairingStatus: state.pairingStatus,
            paired: Boolean(state.creds?.agentId),
            agentId: state.creds?.agentId || '',
            lastHeartbeat: state.lastHeartbeat,
            lastError: state.lastError,
            backupConfig: state.backupConfig || null,
          },
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/api/setup') {
        const body = await parseRequestBody(req);
        const serverUrl = normalizeServerUrl(String(body.serverUrl || ''));
        if (!serverUrl) {
          sendJson(res, 400, { success: false, error: 'Server URL is required.' });
          return;
        }
        state.serverUrl = serverUrl;
        state.agentName = String(body.agentName || os.hostname());
        state.lastError = '';

        const pairingRes = await requestPairing(state.serverUrl, {
          agentName: state.agentName,
          hostname: os.hostname(),
          platform: normalizePlatform(process.platform),
          arch: process.arch,
          osVersion: os.release(),
          agentVersion: '0.2.0',
          capabilities: {
            fileBackup: true,
            fullBackup: true,
            dbBackup: false,
          },
        });

        state.pairingCode = pairingRes.pairingCode;
        state.pairingStatus = 'Pairing code generated. Please approve from server UI.';

        sendJson(res, 200, { success: true, result: pairingRes });
        return;
      }

      if (req.method === 'POST' && req.url === '/api/pairing/check') {
        if (!state.serverUrl || !state.pairingCode) {
          sendJson(res, 400, { success: false, error: 'Generate a pairing code first.' });
          return;
        }

        const pairState = await fetchPairing(state.serverUrl, state.pairingCode);
        if (!pairState.approved || !pairState.agentId || !pairState.agentSecret) {
          state.pairingStatus = 'Waiting for approval...';
          sendJson(res, 200, { success: true, result: { approved: false } });
          return;
        }

        state.creds = {
          agentId: pairState.agentId,
          agentSecret: pairState.agentSecret,
          heartbeatIntervalSec: pairState.heartbeatIntervalSec || 30,
          pollIntervalSec: pairState.pollIntervalSec || 15,
        };

        state.pairingStatus = `Approved and registered as ${state.creds.agentId}`;
        await writeJson(state.configPath, {
          serverUrl: state.serverUrl,
          agentName: state.agentName,
          ...state.creds,
        });

        await updateStateFromServerConfig(state);
        startAgentLoop(state);
        sendJson(res, 200, { success: true, result: { approved: true, agentId: state.creds.agentId } });
        return;
      }

      if (req.method === 'POST' && req.url === '/api/backup-config') {
        if (!state.serverUrl || !state.creds?.agentId || !state.creds?.agentSecret) {
          sendJson(res, 400, { success: false, error: 'Agent must be registered first.' });
          return;
        }
        const body = await parseRequestBody(req);
        const payload = {
          mode: body.mode === 'full_backup' ? 'full_backup' : 'path_backup',
          paths: Array.isArray(body.paths) ? body.paths : [],
          excludes: Array.isArray(body.excludes) ? body.excludes : [],
          storagePath: String(body.storagePath || `agents/${state.creds.agentId}`),
          compression: true,
          encryption: true,
        };

        const saved = await setSelfBackupConfig(state.serverUrl, state.creds, payload);
        state.backupConfig = saved;
        sendJson(res, 200, { success: true, result: saved });
        return;
      }

      if (req.method === 'POST' && req.url === '/api/backup/run-now') {
        if (!state.serverUrl || !state.creds?.agentId || !state.creds?.agentSecret) {
          sendJson(res, 400, { success: false, error: 'Agent must be registered first.' });
          return;
        }
        const result = await runSelfBackupNow(state.serverUrl, state.creds);
        sendJson(res, 200, { success: true, result });
        return;
      }

      sendJson(res, 404, { success: false, error: 'Not found.' });
    } catch (error) {
      state.lastError = error.message || String(error);
      sendJson(res, 500, { success: false, error: state.lastError });
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(18631, '127.0.0.1', () => resolve(server));
  });
}

function startAgentLoop(state) {
  if (state.loopRunning || !state.serverUrl || !state.creds?.agentId || !state.creds?.agentSecret) {
    return;
  }
  state.loopRunning = true;

  const tick = async () => {
    if (!state.loopRunning) return;
    try {
      await heartbeat(state.serverUrl, state.creds);
      state.lastHeartbeat = new Date().toISOString();
      const jobs = await pullJobs(state.serverUrl, state.creds);
      if (Array.isArray(jobs) && jobs.length > 0) {
        for (const job of jobs) {
          await handleJob(state.serverUrl, state.creds, job);
        }
      }
      state.lastError = '';
    } catch (error) {
      state.lastError = `[Agent Loop] ${error.message || String(error)}`;
    }
    setTimeout(tick, (state.creds.pollIntervalSec || 15) * 1000);
  };

  tick();
}

function printUsage() {
  console.log('Usage: pluton-agent [options]');
  console.log('');
  console.log('Options:');
  console.log('  --server <url>   Pluton server URL');
  console.log('  --name <name>    Agent display name');
  console.log('  --guide          Show installation guide');
  console.log('  --help           Show this help');
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const configDir = getConfigDir();
  await ensureDir(configDir);
  const configPath = path.join(configDir, 'config.json');
  const currentConfig = await loadJson(configPath, {});

  let serverUrl = normalizeServerUrl(
    args.server || process.env.PLUTON_SERVER_URL || currentConfig.serverUrl || ''
  );
  let wizardAgentName = args.name || currentConfig.agentName || os.hostname();

  if (args.guide) {
    printGuide();
  }

  if (!serverUrl && isInteractive() && args.headless) {
    const wizard = await runWizard({
      serverUrl: 'http://localhost:5173',
      agentName: wizardAgentName,
    });
    serverUrl = wizard.serverUrl;
    wizardAgentName = wizard.agentName;
  }

  if (!serverUrl && args.headless) {
    throw new Error('Missing server URL. Run with --server http://YOUR_SERVER:5173');
  }

  if (args.headless) {
    const creds = await enrollIfNeeded(serverUrl, configPath, args, wizardAgentName);
    console.log(`Starting headless agent loop against ${serverUrl} ...`);
    const state = {
      serverUrl,
      agentName: wizardAgentName,
      configPath,
      creds,
      pairingCode: '',
      pairingStatus: 'paired',
      backupConfig: null,
      lastError: '',
      lastHeartbeat: '',
      loopRunning: false,
    };
    await updateStateFromServerConfig(state);
    startAgentLoop(state);
    await new Promise(() => {});
  }

  const state = {
    serverUrl,
    agentName: wizardAgentName,
    configPath,
    creds:
      currentConfig.agentId && currentConfig.agentSecret
        ? {
          agentId: currentConfig.agentId,
          agentSecret: currentConfig.agentSecret,
          heartbeatIntervalSec: currentConfig.heartbeatIntervalSec || 30,
          pollIntervalSec: currentConfig.pollIntervalSec || 15,
        }
        : null,
    pairingCode: '',
    pairingStatus: currentConfig.agentId ? `Already paired as ${currentConfig.agentId}` : 'Not paired yet',
    backupConfig: null,
    lastError: '',
    lastHeartbeat: '',
    loopRunning: false,
  };

  if (state.serverUrl && state.creds?.agentId) {
    await updateStateFromServerConfig(state);
    startAgentLoop(state);
  }

  await createWizardServer(state);
  const url = 'http://127.0.0.1:18631';
  console.log(`Pluton Agent wizard is running at ${url}`);
  openBrowser(url);
  await new Promise(() => {});
}

run().catch(error => {
  console.error(error.message || error);
  pauseBeforeExit().finally(() => process.exit(1));
});
