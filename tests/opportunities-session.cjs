const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
const dom=new JSDOM('<div id="dashboardView"><div class="container"><div id="finalHome"><div class="cabinet-shortcuts"></div></div></div></div>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
w.sessionStorage.setItem('medgen_access_token','one');let calls=[],pending=[];
w.fetch=(url,options)=>{calls.push({url,options});return new Promise(resolve=>pending.push(data=>resolve({ok:true,json:async()=>data})));};
w.eval(fs.readFileSync('opportunities.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
const flush=()=>new Promise(r=>setTimeout(r,0));
const listing={items:[],can_submit:true,can_review:false};
w.document.getElementById('openOpportunities').click();pending.shift()(listing);await flush();
let form=w.document.querySelector('form');form.elements.title.value='Research scholarship';
form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(calls.length,2,'Duplicate submission blocked');
w.sessionStorage.setItem('medgen_access_token','two');pending.shift()({});await flush();assert.equal(calls.length,2,'Late save must not open new-account board');
form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(calls.length,2,'Old form cannot send under new token');
w.document.getElementById('openOpportunities').click();pending.shift()({...listing,can_review:true,items:[{id:'test',title:'Entry',organization:'Org',description:'Description',deadline:'2030-01-01',status:'pending',source_url:'https://example.test'}]});await flush();
let controls=w.document.querySelectorAll('.community-card button');controls[0].click();controls[1].click();assert.equal(calls.length,4,'Opposing review actions cannot run together');
pending.shift()({});await flush();assert.equal(calls.length,5);pending.shift()(listing);await flush();
form=w.document.querySelector('form');w.document.querySelector('#opportunitiesPanel > button').click();form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(calls.length,5,'Closed form cannot submit');
console.log('PASS opportunities duplicate submissions, review locking, changed session and detached panel');w.close();
})().catch(e=>{console.error(e);process.exitCode=1});
