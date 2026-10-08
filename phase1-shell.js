/* MedGen AI Phase 1 — boundary only. The Phase 1 controller owns navigation. */
(function(){
'use strict';
const TOKEN_KEY='medgen_access_token';
const $=id=>document.getElementById(id);
const hasToken=()=>Boolean(sessionStorage.getItem(TOKEN_KEY));
function styles(){
 if($('phase1BoundaryStyles')) return;
 const s=document.createElement('style');s.id='phase1BoundaryStyles';
 s.textContent='body.phase1-login-active>#loginView{display:grid!important}body.phase1-login-active>#dashboardView{display:none!important}body.phase1-dashboard-active>#loginView{display:none!important}body.phase1-dashboard-active>#dashboardView{display:block!important}';
 document.head.appendChild(s);
}
function sync(){
 styles();
 const login=$('loginView'),dash=$('dashboardView');
 const auth=hasToken();
 document.body.classList.toggle('phase1-login-active',!auth);
 document.body.classList.toggle('phase1-dashboard-active',auth);
 if(login){login.hidden=auth;login.classList.toggle('hidden',auth)}
 if(dash){dash.hidden=!auth;dash.classList.toggle('hidden',!auth)}
}
window.medgenPhase1Shell={login:()=>{sessionStorage.removeItem(TOKEN_KEY);sync()},authenticated:sync,sync};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',sync,{once:true}); else sync();
})();