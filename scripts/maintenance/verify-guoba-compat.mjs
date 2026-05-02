import fs from 'fs';
import path from 'path';
import process from 'process';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..');
const webRoot = path.join(pluginRoot, 'guoba-plugin-web');
const webAppRoot = path.join(webRoot, 'apps', 'web-antd');

const cliFlags = new Set(process.argv.slice(2));

function resolveBin(baseDir, name) {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  return path.join(baseDir, 'node_modules', '.bin', `${name}${ext}`);
}

function ensureExecutable(executable, label) {
  if (!fs.existsSync(executable)) {
    throw new Error(`[verify-guoba-compat] missing ${label}: ${executable}`);
  }
}

function runStep(step) {
  console.log(`[verify-guoba-compat] ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    env: {
      ...process.env,
      ...step.env,
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildSteps() {
  const steps = [];
  const vueTscBin = resolveBin(webRoot, 'vue-tsc');
  const viteBin = resolveBin(webRoot, 'vite');

  if (!cliFlags.has('--skip-audit')) {
    steps.push({
      args: [path.join(__dirname, 'audit-guoba-schema-compat.mjs')],
      command: process.execPath,
      cwd: pluginRoot,
      label: 'audit guoba schema compatibility',
    });
  }

  if (!cliFlags.has('--skip-typecheck')) {
    ensureExecutable(vueTscBin, 'vue-tsc');
    steps.push({
      args: ['--noEmit', '--skipLibCheck', '-p', 'apps/web-antd/tsconfig.json'],
      command: vueTscBin,
      cwd: webRoot,
      label: 'typecheck web-antd',
    });
  }

  if (!cliFlags.has('--skip-build')) {
    ensureExecutable(viteBin, 'vite');
    steps.push({
      args: ['build', '--mode', 'production'],
      command: viteBin,
      cwd: webAppRoot,
      label: 'build web-antd via vite',
    });
  }

  if (!cliFlags.has('--skip-sync')) {
    steps.push({
      args: [path.join(webRoot, 'scripts', 'sync-v5-dist.mjs')],
      command: process.execPath,
      cwd: webRoot,
      label: 'sync dist to server/static',
    });
  }

  return steps;
}

function printUsage() {
  console.log('Usage: node ./scripts/verify-guoba-compat.mjs [--skip-audit] [--skip-typecheck] [--skip-build] [--skip-sync]');
}

function main() {
  if (cliFlags.has('--help') || cliFlags.has('-h')) {
    printUsage();
    return;
  }

  for (const step of buildSteps()) {
    runStep(step);
  }

  console.log('[verify-guoba-compat] done');
}

main();
