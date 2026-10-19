const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}),w=dom.window;
const source=fs.readFileSync('app.js','utf8'),start=source.indexOf('async function runDocking()'),end=source.indexOf('/* =========================================================',start);
const calls=[];w.testApi=async(path,opts)=>{calls.push(JSON.parse(opts.body));throw Error('engine unavailable');};
vm.runInContext("const $=id=>document.getElementById(id);const api=window.testApi;function renderResult(){};"+source.slice(start,end),dom.getInternalVMContext());
(async()=>{
 for(const [id,value] of Object.entries({dockingInput:'Target | CCO',dockingReceptor:'receptor',dockingLigand:'ligand'}))w.document.getElementById(id).value=value;
 await w.runDocking();assert.equal(calls.length,0,'blank coordinates must not silently become zero');
 for(const [id,value] of Object.entries({dockingCenterX:'1.5',dockingCenterY:'-2',dockingCenterZ:'0'}))w.document.getElementById(id).value=value;
 await w.runDocking();assert.equal(calls.length,1);assert.equal(calls[0].center_x,1.5);assert.equal(calls[0].center_y,-2);assert.equal(calls[0].center_z,0);
 assert.equal(w.document.getElementById('dockingRun').disabled,false);
 assert.match(w.document.getElementById('dockingStatus').textContent,/engine unavailable/);
 w.document.getElementById('dockingSizeX').value='0';await w.runDocking();assert.equal(calls.length,1);
 console.log('PASS docking: explicit coordinates, bounds, submitted parameters, error recovery');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
