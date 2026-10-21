const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<div id="hubCell3D"></div><div id="hubCell3DStatus"></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
 let frame,draws=0,disposed=0,observed=0;
 const vec=()=>({x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z})},setScalar(){}});
 class Obj{constructor(){this.children=[];this.position=vec();this.rotation=vec();this.scale=vec();}add(o){this.children.push(o)}traverse(fn){fn(this);this.children.forEach(o=>o.traverse(fn));}}
 class Disposable{dispose(){disposed++}}
 class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;}}
 let camera,renderer,cell;
 w.THREE={Scene:Obj,Color:class{},PerspectiveCamera:class extends Obj{constructor(){super();camera=this}updateProjectionMatrix(){}},Group:class extends Obj{constructor(){super();cell=this}},Mesh,SphereGeometry:Disposable,MeshStandardMaterial:Disposable,MeshBasicMaterial:Disposable,HemisphereLight:Obj,DirectionalLight:Obj,WebGLRenderer:class{constructor(){renderer=this;this.domElement=w.document.createElement('canvas');this.domElement.setPointerCapture=()=>{};}setPixelRatio(){}setSize(width,height){this.size=[width,height]}render(){draws++}dispose(){disposed++}forceContextLoss(){this.lost=true}}};
 w.ResizeObserver=class{constructor(fn){this.fn=fn}observe(){observed++}disconnect(){observed--}};
 w.matchMedia=()=>({matches:true});w.requestAnimationFrame=fn=>{frame=fn};
 const viewer=w.document.getElementById('hubCell3D');Object.defineProperty(viewer,'clientWidth',{value:320});viewer.getClientRects=()=>[{}];Object.defineProperty(w.document,'hidden',{value:false,configurable:true});
 const s=fs.readFileSync('app.js','utf8'),a=s.indexOf('    const initHubCell3D = () => {'),b=s.indexOf('    initOrganGame();',a);
 w.eval('const $=id=>document.getElementById(id);'+s.slice(a,b)+'initHubCell3D();');await new Promise(r=>setImmediate(r));
 const buttons=w.document.querySelectorAll('.cell-view-controls button');assert.equal(buttons.length,4);assert.equal(buttons[2].getAttribute('aria-pressed'),'true','Reduced motion pauses by default');
 buttons[0].click();assert.ok(camera.position.z<7);buttons[1].click();assert.equal(camera.position.z,7);
 renderer.domElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',cancelable:true}));assert.equal(cell.rotation.y,.15);
 buttons[3].click();assert.equal(cell.rotation.y,0);buttons[2].click();frame();assert.ok(cell.rotation.y>0);
 viewer.getClientRects=()=>[];const before=draws;frame();assert.equal(draws,before,'Hidden workspace must not redraw');
 assert.deepEqual(renderer.size,[320,240]);assert.equal(observed,1);
 viewer.remove();frame();assert.ok(disposed>=21);assert.equal(observed,0);assert.equal(renderer.lost,true);
 console.log('PASS cell controls: mobile zoom, keyboard, reset, reduced motion, hidden render, resize and disposal');w.close();
})().catch(e=>{console.error(e);process.exitCode=1});
