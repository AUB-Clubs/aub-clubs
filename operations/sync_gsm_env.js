#!/usr/bin/env node
import fs from 'fs';
import { spawnSync } from 'child_process';

function usage() {
  console.error(
    'Usage: node operations/sync_gsm_env.js --project <gcp-project-id> --secret <gsm-secret-id> [--env-file .env]',
  );
  process.exit(1);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function unquote(value) {
  if (value.length < 2) return value;
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) {
    return value;
  }

  const inner = value.slice(1, -1);
  if (quote === "'") return inner;

  return inner
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function stripInlineComment(value) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    const previous = value[i - 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && previous !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (
      char === '#' &&
      !inSingleQuote &&
      !inDoubleQuote &&
      (i === 0 || /\s/.test(previous))
    ) {
      return value.slice(0, i).trimEnd();
    }
  }

  return value;
}

function parseDotenv(contents) {
  const env = {};

  for (const rawLine of contents.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice('export '.length).trimStart();

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    env[key] = unquote(stripInlineComment(rawValue.trim()));
  }

  return env;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    input: options.input,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(`${command} ${args.join(' ')} failed${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`);
  }

  return result;
}

const envFile = readArg('--env-file') ?? process.env.ENV_FILE ?? '.env';
const projectId = readArg('--project') ?? process.env.GCP_PROJECT_ID;
const secretId = readArg('--secret') ?? process.env.SECRET_ID;

if (!projectId || !secretId) usage();

if (!/^[A-Za-z0-9_-]+$/.test(secretId)) {
  console.error('The Google Secret Manager secret id may only contain letters, numbers, hyphens, and underscores.');
  process.exit(1);
}

const env = parseDotenv(fs.readFileSync(envFile, 'utf8'));
const keys = Object.keys(env).sort();

if (keys.length === 0) {
  console.error(`No KEY=value entries found in ${envFile}`);
  process.exit(1);
}

const describe = spawnSync('gcloud', ['secrets', 'describe', secretId, '--project', projectId], {
  stdio: 'ignore',
});

if (describe.status !== 0) {
  run('gcloud', [
    'secrets',
    'create',
    secretId,
    '--project',
    projectId,
    '--replication-policy',
    'automatic',
  ]);
  console.log(`Created Secret Manager secret ${secretId}`);
}

run(
  'gcloud',
  ['secrets', 'versions', 'add', secretId, '--project', projectId, '--data-file', '-'],
  { input: JSON.stringify(env, null, 2) },
);

console.log(`Uploaded ${keys.length} environment keys from ${envFile} to Secret Manager secret ${secretId}`);
console.log(keys.map((key) => `- ${key}`).join('\n'));
