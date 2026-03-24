import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const agentDir = path.join(rootDir, 'installers', 'agent');
const distDir = path.join(agentDir, 'dist');
const windowsOut = path.join(rootDir, 'installers', 'windows', 'pluton-agent.exe');
const linuxDebOut = path.join(rootDir, 'installers', 'linux', 'pluton-agent.deb');

function run(command, cwd = rootDir) {
  execSync(command, { cwd, stdio: 'inherit', env: process.env });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function buildBinaries() {
  await ensureDir(distDir);
  run(`pnpm exec pkg ${path.join(agentDir, 'agent.js')} --targets node20-win-x64,node20-linux-x64 --out-path ${distDir}`);
}

async function copyWindowsBinary() {
  const src = path.join(distDir, 'agent-win.exe');
  if (!(await fileExists(src))) {
    throw new Error('Missing built Windows executable: ' + src);
  }
  await ensureDir(path.dirname(windowsOut));
  await fs.copyFile(src, windowsOut);
}

async function createLinuxDeb() {
  const linuxBin = path.join(distDir, 'agent-linux');
  if (!(await fileExists(linuxBin))) {
    throw new Error('Missing built Linux binary: ' + linuxBin);
  }

  const pkgRoot = path.join(agentDir, 'deb-build');
  const debianDir = path.join(pkgRoot, 'DEBIAN');
  const binDir = path.join(pkgRoot, 'usr', 'local', 'bin');

  await fs.rm(pkgRoot, { recursive: true, force: true });
  await ensureDir(debianDir);
  await ensureDir(binDir);

  const control = `Package: pluton-agent\nVersion: 0.1.0\nSection: utils\nPriority: optional\nArchitecture: amd64\nMaintainer: Pluton <support@plutonhq.com>\nDescription: Pluton remote backup agent\n`;
  await fs.writeFile(path.join(debianDir, 'control'), control, 'utf8');

  const targetBin = path.join(binDir, 'pluton-agent');
  await fs.copyFile(linuxBin, targetBin);
  await fs.chmod(targetBin, 0o755);

  await ensureDir(path.dirname(linuxDebOut));
  run(`dpkg-deb --build ${pkgRoot} ${linuxDebOut}`);
}

async function main() {
  console.log('Building Pluton agent installers...');
  await buildBinaries();
  await copyWindowsBinary();

  if (os.platform() === 'linux') {
    await createLinuxDeb();
  } else {
    console.log('Skipping .deb creation because host is not Linux.');
  }

  console.log('Done.');
  console.log('Windows installer:', windowsOut);
  console.log('Linux installer:', linuxDebOut);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
