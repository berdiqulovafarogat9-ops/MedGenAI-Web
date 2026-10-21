const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,source=fs.readFileSync('app.js','utf8');
const a=source.indexOf('function renderResearchEvidence('),b=source.indexOf('\n\n/*',a);let resolve,reject,calls=0;
w.mockApi=()=>{calls++;return new Promise((r,j)=>{resolve=r;reject=j})};
vm.runInContext("const $=id=>document.getElementById(id);const state={token:'one'};window.sessionState=state;const api=window.mockApi;const renderResult=(el,data)=>el.textContent=JSON.stringify(data);"+source.slice(a,b),dom.getInternalVMContext());
const el=id=>w.document.getElementById(id);
await w.runResearchAgent();assert.equal(calls,0);
el('researchQuery').value='My question';const pending=w.runResearchAgent();assert.equal(el('researchRun').disabled,true);await w.searchResearch();assert.equal(calls,1);
resolve({query:'My question',normalized_query:'my question',evidence:[{pmid:'123',title:'<img src=x>',journal:'Test',publication_date:'2025',url:'javascript:alert(1)',evidence:['Original excerpt']},{pmid:'bad',title:'No usable link'}]});await pending;
assert.equal(el('researchEvidence').querySelector('img'),null);assert.equal(el('researchEvidence').querySelectorAll('a').length,1);assert.equal(el('researchEvidence').querySelector('a').href,'https://pubmed.ncbi.nlm.nih.gov/123/');assert.match(el('researchEvidence').textContent,/Original excerpt/);
const retry=w.runResearchAgent();reject(Error('Network failed'));await retry;assert.equal(el('researchRun').disabled,false);assert.equal(el('researchEvidence').hidden,true);assert.equal(el('researchQuery').value,'My question');
const empty=w.searchResearch();resolve({query:'My question',evidence:[]});await empty;assert.match(el('researchEvidence').textContent,/Manba topilmadi/);
const old=w.runResearchAgent();w.sessionState.token='two';resolve({query:'private',evidence:[]});await old;assert.doesNotMatch(el('researchEvidence').textContent,/private/);
console.log('PASS research evidence: safe source links/text, duplicates, retry, empty results, retained input and session isolation');w.close();
})().catch(e=>{console.error(e);process.exitCode=1});
