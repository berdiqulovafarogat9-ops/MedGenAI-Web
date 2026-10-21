const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,source=fs.readFileSync('app.js','utf8');
const a=source.indexOf('function renderLabSummary('),b=source.indexOf('async function loadJobStatus()',a),c=source.indexOf('async function loadWorkflows()'),d=source.indexOf('\n\n/*',c);
const calls=[];let pending;
w.mockApi=(path,options)=>{calls.push({path,body:options?JSON.parse(options.body||'{}'):null});if(path==='/lab/pipeline')return new Promise(r=>pending=r);if(path.endsWith('/execute'))return Promise.resolve({experiment:{id:'test',status:'completed',results:{steps:[{step:'molecular_analysis',status:'completed',result:{molecular_formula:'C2H6O',molecular_weight:46.069,canonical_smiles:'CCO'}}]}}});if(path==='/scientific/reports')return Promise.resolve({report:{id:'report'}});if(path==='/workflows')return Promise.resolve({workflows:[]});return Promise.resolve({experiments:[{id:'own',workflow_type:'virtual_lab'},{id:'other-type',workflow_type:'custom'}]});};
vm.runInContext("const $=id=>document.getElementById(id);const state={token:'one'};window.sessionState=state;const api=window.mockApi;const t=x=>x;const renderResult=(el,data)=>el.textContent=JSON.stringify(data);"+source.slice(a,b)+source.slice(c,d),dom.getInternalVMContext());
const el=id=>w.document.getElementById(id);
await w.createLabWorkflow();assert.equal(calls.length,0);
el('labSmiles').value='CCO';const first=w.createLabWorkflow();assert.equal(el('labRun').disabled,true);await w.createLabWorkflow();assert.equal(calls.length,1);
assert.deepEqual(calls[0].body.steps,['molecular_analysis','report']);assert.equal(calls[0].body.ligand_smiles,'CCO');
pending({experiment:{id:'test'}});await first;assert.equal(calls.length,3);assert.equal(el('labRun').disabled,false);assert.match(el('labSummary').textContent,/C2H6O/);assert.match(el('labSummary').textContent,/46.069/);
await w.loadWorkflows();assert.match(el('workflowResult').textContent,/own/);assert.doesNotMatch(el('workflowResult').textContent,/other-type/);
el('labMode').value='advanced';el('labInput').value='null';const count=calls.length;await w.createLabWorkflow();assert.equal(calls.length,count);
el('labMode').value='guided';const second=w.createLabWorkflow();w.sessionState.token=null;const before=calls.length;pending({experiment:{id:'after-logout'}});await second;assert.equal(calls.length,before,'Must not execute/report after logout');assert.equal(el('labRun').disabled,false);
console.log('PASS guided lab: empty input, exact steps, duplicate prevention, readable summary, history, JSON validation and logout guard');w.close();
})().catch(e=>{console.error(e);process.exitCode=1});
