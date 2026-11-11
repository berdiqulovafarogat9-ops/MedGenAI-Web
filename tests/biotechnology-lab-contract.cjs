const fs = require('node:fs');
const assert = require('node:assert/strict');

const read = (path) => fs.readFileSync(path, 'utf8');
const html = read('biotechnology-lab.html');
const js = read('biotechnology-lab.js');
const index = read('index-final.html');
const app = read('app.js');
const docker = read('Dockerfile');

assert.match(html, /\/vendor\/three\.min\.js/, '3D engine must use the bundled production asset');
assert.match(html, /biotechnology-lab\.js/, 'lab page must load its controller');
assert.match(html, /biotechnology-lab\.css/, 'lab page must load its styles');
assert.match(js, /function onPointerMove/, '3D camera must support drag rotation');
assert.match(js, /function onWheel/, '3D camera must support zoom');
assert.match(js, /function animateExperiment/, 'experiment actions must animate the 3D scene');
assert.match(js, /field_of_view_um/, 'microscopy must calculate field of view');
assert.match(js, /objective_magnification/, 'microscopy must report optical magnification');
assert.match(js, /await animateExperiment\(state\.mode\)/, 'running a workflow must trigger its 3D animation');
for (const mode of ['pcr', 'cell', 'bioreactor', 'crispr', 'microscope']) {
  assert.match(js, new RegExp(mode + ':\\{'), 'missing experiment mode: ' + mode);
}
assert.match(js, /API_BASE\+'\/experiments'/, 'simulation results must use the persisted experiment API');
assert.match(js, /API_BASE\+'\/bioinformatics\/analyze'/, 'nucleotide inputs must use the sequence-analysis API');
assert.match(js, /educational_only:true/, 'saved results must be labelled educational');
assert.match(js, /genome_editing_performed:false/, 'CRISPR demo must not claim to edit a genome');
assert.match(index, /data-module="Biotechnology 3D Lab"/, 'dashboard entry is missing');
assert.match(index, /'Biotechnology 3D Lab'/, 'role-aware module registry is missing');
for (const role of ['researcher', 'professor', 'lab', 'biotech', 'pharma', 'bioinformatician', 'company']) {
  const start = index.indexOf(role + ':[');
  const end = start < 0 ? -1 : index.indexOf(']', start);
  assert.ok(start >= 0 && end > start && index.slice(start, end).includes("'Biotechnology 3D Lab'"), role + ' role cannot see the biotechnology lab');
}
const medgenRolesStart = app.indexOf('const MEDGEN_ROLES');
for (const role of ['researcher', 'professor', 'lab', 'biotech', 'pharma', 'bioinformatician', 'company']) {
  const start = app.indexOf(role + ':{', medgenRolesStart);
  const end = start < 0 ? -1 : app.indexOf('},', start);
  assert.ok(start >= 0 && end > start && app.slice(start, end).includes("'Biotechnology 3D Lab'"), 'app role registry missing biotechnology lab for ' + role);
}
assert.match(app, /window\.location\.assign\('\/biotechnology-lab\.html'\)/, 'module routing is missing');
for (const asset of ['biotechnology-lab.html', 'biotechnology-lab.js', 'biotechnology-lab.css']) {
  assert.ok(docker.includes(asset), 'Docker image does not include ' + asset);
}
console.log('PASS biotechnology lab contract: assets, routing, role registry, 3D controls, experiment modes, and persistence');
