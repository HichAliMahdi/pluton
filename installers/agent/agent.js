#!/usr/bin/env node

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestPairing(serverUrl, metadata) {
  return apiPost(`${serverUrl}/api/agents/pairing/request`, metadata);
}

async function fetchPairing(serverUrl, pairingCode) {
  return apiPost(`${serverUrl}/api/agents/pairing/fetch`, { pairingCode });
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

  if (!serverUrl && isInteractive()) {
    const wizard = await runWizard({
      serverUrl: 'http://localhost:5173',
      agentName: wizardAgentName,
    });
    serverUrl = wizard.serverUrl;
    wizardAgentName = wizard.agentName;
  }

  if (!serverUrl) {
    throw new Error('Missing server URL. Run with --server http://YOUR_SERVER:5173');
  }

  const creds = await enrollIfNeeded(serverUrl, configPath, args, wizardAgentName);

  console.log(`Starting agent loop against ${serverUrl} ...`);
  while (true) {
    try {
      await heartbeat(serverUrl, creds);
      const jobs = await pullJobs(serverUrl, creds);
      if (Array.isArray(jobs) && jobs.length > 0) {
        for (const job of jobs) {
          await handleJob(serverUrl, creds, job);
        }
      }
    } catch (error) {
      console.error(`[Agent] ${error.message}`);
    }
    await sleep((creds.pollIntervalSec || 15) * 1000);
  }
}

run().catch(error => {
  console.error(error.message || error);
  pauseBeforeExit().finally(() => process.exit(1));
});
