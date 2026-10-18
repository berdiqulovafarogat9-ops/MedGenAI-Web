const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const configs = [html, fs.readFileSync(path.join(root, 'nginx.conf'), 'utf8')];
for (const match of html.matchAll(/<script\b[^>]*\bsrc=["'](https:\/\/[^"']+)/g)) {
  const origin = new URL(match[1]).origin;
  for (const config of configs) {
    const policy = config.match(/script-src\s+([^;]+)/);
    assert.ok(policy, 'script policy exists');
    assert.ok(policy[1].split(/\s+/).includes(origin), `CSP blocks ${origin}`);
  }
}
console.log('PASS: external script origins permitted by both page and server CSP');
