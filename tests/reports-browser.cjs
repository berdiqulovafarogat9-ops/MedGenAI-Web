const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
const source=fs.readFileSync('app.js','utf8'),a=source.indexOf('function renderReportsBrowser('),b=source.indexOf('async function loadReports()',a);
vm.runInContext("const $=id=>document.getElementById(id);const state={token:'one'};window.sessionState=state;const renderResult=(el,data)=>el.textContent=JSON.stringify(data);"+source.slice(a,b),dom.getInternalVMContext());
let exported,filename;w.URL.createObjectURL=blob=>{exported=blob;return 'blob:test'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){filename=this.download};
const reports=Array.from({length:22},(_,i)=>({id:'r'+i,title:i===0?'<img src=x onerror=alert(1)>':'Report '+i,created_at:'2026-10-20'})),experiments=[{id:'e1',name:'Ethanol experiment',results:{formula:'C2H6O'}}];
w.renderReportsBrowser(reports,experiments,'one');
const el=id=>w.document.getElementById(id);assert.equal(el('reportsList').children.length,20);assert.equal(el('reportsList').querySelector('img'),null);
el('reportsPagination').lastElementChild.click();assert.equal(el('reportsList').children.length,3);
el('reportsKind').value='experiment';el('reportsKind').dispatchEvent(new w.Event('change'));assert.equal(el('reportsList').children.length,1);
el('reportsList').querySelector('button').click();assert.equal(el('reportsDetail').hidden,false);assert.match(el('reportsResult').textContent,/C2H6O/);
el('reportsDownload').click();assert.ok(exported);assert.equal(filename,'medgen-experiment-e1.json');
el('reportsSearch').value='no-such-record';el('reportsSearch').dispatchEvent(new w.Event('input'));assert.equal(el('reportsList').querySelectorAll('button').length,0);
w.sessionState.token='other';exported=null;el('reportsDownload').click();assert.equal(exported,null,'No export after account switch');
console.log('PASS reports: pagination, filtering, safe titles, details, JSON export, empty state and session guard');w.close();
})().catch(e=>{console.error(e);process.exitCode=1});
