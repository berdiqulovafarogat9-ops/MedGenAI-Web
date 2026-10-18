// Run with jsdom available on NODE_PATH. DOM-level test, not browser E2E.
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const dom=new JSDOM(html,{url:'https://medgen-ai.pages.dev',runScripts:'outside-only'});
const w=dom.window;
const expected=['student','doctor','researcher','professor','lab','biotech','pharma','bioinformatician','hospital','company'];
const roles=[...w.document.querySelectorAll('#registerRoleGrid [data-role]')].map(x=>x.dataset.role);
assert.deepEqual(roles,expected);
for(const id of ['registerSchoolName','registerSchoolClass','registerInviteCode'])assert.equal(w.document.getElementById(id),null);
assert.equal(w.document.querySelector('#educationLevel option[value="SCHOOL"]'),null);
assert.equal(/school|maktab|AI Teacher Studio/i.test(app+html),false);
for(const el of w.document.querySelectorAll('script:not([src])'))new vm.Script(el.textContent);
const context=dom.getInternalVMContext();
vm.runInContext(`const $=id=>document.getElementById(id);const state={user:{role:'student'}};function updateUserUI(){};function roleKey(){return state.user.role};function openModule(){};`,context);
const a=app.indexOf('const MEDGEN_ROLES =');const b=app.indexOf('function getLocalRole()',a);
vm.runInContext(app.slice(a,b),context);
const c=app.indexOf('function applyRoleDashboard()');const d=app.indexOf('async function registerAccount()',c);
vm.runInContext(app.slice(c,d),context);
for(const role of [...expected,'admin']){
 vm.runInContext(`state.user.role=${JSON.stringify(role)};applyRoleDashboard();`,context);
 assert.ok(w.document.querySelectorAll('#roleQuickGrid [data-role-module]').length>0);
 assert.equal(/school|maktab/i.test(w.document.getElementById('roleQuickGrid').textContent),false);
}
vm.runInContext("state.user.role='student';applyRoleDashboard();bindRoleRegistration();",context);
const modules=[...w.document.querySelectorAll('#roleQuickGrid [data-role-module]')].map(x=>x.dataset.roleModule);
assert.deepEqual(modules,['Medical Academy','Learning Hub','Virtual Laboratory']);
w.document.querySelector('[data-role="professor"]').click();assert.equal(w.document.getElementById('registerRole').value,'professor');
w.document.querySelector('[data-role="student"]').click();assert.equal(w.document.getElementById('registerRole').value,'student');
console.log('PASS: 10 registration roles, 11 dashboard renders, student modules, role clicks, removed fields/menu/module references, inline JS syntax');
w.close();
