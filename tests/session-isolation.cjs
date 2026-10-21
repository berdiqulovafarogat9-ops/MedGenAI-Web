const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
 const w=new JSDOM('<div id="dashboardView"><pre class="result">private result</pre><input value="private sequence"></div><div id="labSummary">private lab</div><div id="legalModal"></div><div id="learningHubWorkspace"></div><div id="profileModal"><input value="private profile"></div>',{url:'http://localhost',runScripts:'outside-only'}).window;
 const source=fs.readFileSync('app.js','utf8'),a=source.indexOf('async function api('),b=source.indexOf('\n\n/*',a),c=source.indexOf('async function logout()'),d=source.indexOf('\n\n/*',c);
 let resolve;
 w.fetch=()=>new Promise(r=>resolve=r);
 vm.runInContext("const state={token:'alice',user:{}};window.sessionState=state;const API_BASE='/api/v1',TOKEN_KEY='token';const $=id=>document.getElementById(id);function showLogin(){}"+source.slice(a,b)+source.slice(c,d),w);
 for(const response of [{ok:true,status:200,data:{secret:'alice'}},{ok:false,status:403,data:{detail:'LEGAL_CONSENT_REQUIRED'}}]){
  w.sessionState.token='alice';w.sessionState.user={};
  const pending=w.api('/private');w.sessionState.token='bob';
  resolve({ok:response.ok,status:response.status,headers:{get:()=> 'application/json'},json:async()=>response.data});
  await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(w.sessionState.user.consent_complete,undefined);
 }
 w.fetch=async()=>({});await w.logout();
 assert.equal(w.document.querySelector('.result').textContent,'');assert.equal(w.document.querySelector('#labSummary').textContent,'');
 assert.equal(w.document.querySelector('#dashboardView input').value,'');assert.equal(w.document.querySelector('#profileModal input').value,'');
 assert.equal(w.document.getElementById('learningHubWorkspace'),null);assert.ok(w.document.getElementById('legalModal').classList.contains('hidden'));
 console.log('PASS session isolation: stale success/error responses rejected, private results and inputs cleared on logout');w.close();
})().catch(e=>{console.error(e);process.exitCode=1});
