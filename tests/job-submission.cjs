const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,source=fs.readFileSync('app.js','utf8');
let pending,calls=0,fail=false;
w.mockApi=()=>{calls++;return new Promise((resolve,reject)=>pending={resolve,reject});};
const a=source.indexOf('async function createJob()'),b=source.indexOf('/* =========================================================',a);
vm.runInContext("const $=id=>document.getElementById(id);const state={token:'one'};window.sessionState=state;const api=window.mockApi;const renderResult=(el,data)=>el.textContent=JSON.stringify(data);async function loadJobs(){};"+source.slice(a,b),dom.getInternalVMContext());
const el=id=>w.document.getElementById(id);
el('jobInput').value='null';await w.createJob();assert.equal(calls,0);
el('jobInput').value='{"smiles":"CCO"}';el('jobCreateResult').textContent='old result';
let task=w.createJob();await w.createJob();assert.equal(calls,1);assert.equal(el('jobCreate').disabled,true);assert.equal(el('jobCreateResult').textContent,'');
pending.reject(new Error('Storage unavailable'));await task;assert.equal(el('jobCreate').disabled,false);assert.match(el('jobCreateStatus').textContent,/Storage/);assert.match(el('jobInput').value,/CCO/);
task=w.createJob();pending.resolve({status:'completed',id:'saved'});await task;assert.match(el('jobCreateResult').textContent,/saved/);
task=w.createJob();w.sessionState.token='two';el('jobCreateStatus').textContent='new session';pending.resolve({status:'completed',id:'private'});await task;assert.doesNotMatch(el('jobCreateResult').textContent,/private/);assert.equal(el('jobCreateStatus').textContent,'new session');assert.equal(el('jobCreate').disabled,false);
console.log('PASS job JSON validation, duplicate guard, retry, old-result clearing and session guard');w.close();
})().catch(e=>{console.error(e);process.exitCode=1});
