import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appVersion } from '../frontend/version.js';

const readJSON = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const { version } = readJSON('../package.json');
const lock = readJSON('../package-lock.json');
assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Invalid app version');
for (const [name, actual] of Object.entries({
  'package-lock.json': lock.version,
  'package-lock.json root': lock.packages[''].version,
  'mygo.json': readJSON('../mygo.json').version,
  'frontend/version.js': appVersion,
})) {
  assert.equal(actual, version, `${name} must match package.json`);
}
console.log(`App version: ${version}`);
