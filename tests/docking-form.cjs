const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync('index-final.html','utf8'),{runScripts:'outside-only'}),w=dom.window;
const source=fs.readFileSync('app.js','utf8'),start=source.indexOf('async function runDocking()'),end=source.indexOf('/* =========================================================',start);
const calls=[];let pollCount=0;
w.testApi=async(path,opts)=>{
  if(opts?.method==='POST'){calls.push({path,body:JSON.parse(opts.body)});return {job_id:'job-test-1',status:'queued'};}
  pollCount++;return {job_id:'job-test-1',status:'completed',result:{
    target_pdb:calls[0].body.target_pdb,affinity_kcal_mol:-8.25,receptor_pdb:'ATOM test receptor',best_pose_pdb:'ATOM test ligand',hydrogen_bond_count:1,hydrogen_bonds:[],polar_contacts_estimate:4,
    lipinski:{violations:1},warning:'Computational score only.'
  }};
};
w.setTimeout=(fn)=>{fn();return 1;};
vm.runInContext("const $=id=>document.getElementById(id);const api=window.testApi;function renderResult(){};function renderDockingAdmet(data){window.renderedDockingAdmet=data;};function renderDockingPose(data){window.renderedDockingPose=data;};"+source.slice(start,end),dom.getInternalVMContext());
(async()=>{
  assert.ok(w.document.getElementById('dockingTargetPreset'));
  assert.equal(w.document.querySelectorAll('[data-discovery-ligand]').length,3);
  assert.deepEqual(Array.from(w.document.getElementById('dockingTargetPreset').options).map(o=>o.value),['1HSG','8A27','1RTD']);
  w.document.getElementById('dockingInput').value='EGFR | CCO';
  await w.runDocking();assert.equal(calls.length,0,'unsupported targets must be rejected before submission');
  w.document.getElementById('dockingInput').value='1HSG | CCO';
  await w.runDocking();
  assert.equal(calls.length,1);
  assert.equal(calls[0].path,'/hiv-lab/docking/jobs');
  assert.equal(calls[0].body.target_pdb,'1HSG');
  assert.equal(calls[0].body.smiles,'CCO');
  assert.equal(pollCount,1,'job state should be polled');
  assert.equal(w.renderedDockingPose.target_pdb,'1HSG');
  assert.ok(w.renderedDockingPose.best_pose_pdb,'best ligand pose should reach the 3D renderer');
  assert.match(w.document.getElementById('dockingResult').textContent,/−?8\.250 kcal\/mol/);
  assert.match(w.document.getElementById('dockingResult').textContent,/polar kontaktlar/i);
  w.document.getElementById('dockingInput').value='8A27 | CCO';
  await w.runDocking();
  assert.equal(calls.length,2);
  assert.equal(calls[1].body.target_pdb,'8A27');
  assert.equal(w.renderedDockingPose.target_pdb,'8A27');
  assert.equal(w.document.getElementById('dockingRun').disabled,false);
  console.log('PASS docking: 1HSG/8A27 submission, research-only target guard, async polling, ADMET handoff');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
