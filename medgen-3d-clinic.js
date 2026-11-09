/* MedGen AI — reusable 3D virtual patient scene (educational visualization). */
(function () {
  "use strict";
  class MedGen3DClinic {
    constructor() {
      this.scene=null; this.camera=null; this.renderer=null; this.patientChest=null;
      this.raf=0; this.resizeObserver=null; this.phase=0; this.rr=18; this.hr=96; this.sbp=90; this.dbp=55; this.spo2=90; this.wrapper=null; this.breathMeshes=[]; this.monitorCtx=null; this.monitorTexture=null;
    }
    mount3DScene(wrapperId) {
      this.dispose();
      var wrap=document.getElementById(wrapperId);
      if(!wrap || !window.THREE || !THREE.WebGLRenderer) return null;
      this.wrapper=wrap;
      wrap.innerHTML='<div class="medgen-3d-clinic-stage" style="position:relative;width:100%;height:100%;min-height:0;background:#071521;border-radius:10px;overflow:hidden"><canvas style="width:100%;height:100%;display:block"></canvas><div style="position:absolute;left:9px;bottom:8px;padding:5px 9px;border-radius:5px;background:rgba(3,15,28,.86);color:#7dd3fc;font:11px system-ui">3D reanimatsiya xonasi · nafas harakati — simulyatsiya</div></div>';
      var canvas=wrap.querySelector("canvas");
      try {
        this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x0f172a);
        this.camera=new THREE.PerspectiveCamera(48,1,.1,100);
        this.camera.position.set(0,1.8,2.2); this.camera.lookAt(0,1.0,0);
        this.renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:false});
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
        this.scene.add(new THREE.HemisphereLight(0xffffff,0x334155,1.8));
        var key=new THREE.DirectionalLight(0xfff2e6,2); key.position.set(-2,6,4); key.castShadow=true; key.shadow.mapSize.set(1024,1024); this.scene.add(key); var fill=new THREE.DirectionalLight(0x9bc9e8,.7); fill.position.set(3,2,-2); this.scene.add(fill);
        var floor=new THREE.Mesh(new THREE.PlaneGeometry(9,8),new THREE.MeshStandardMaterial({color:0x1e3445,roughness:.95}));
        floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; this.scene.add(floor);
        var metal=new THREE.MeshStandardMaterial({color:0x94a3b8,metalness:.45,roughness:.4});
        var bed=new THREE.Mesh(new THREE.BoxGeometry(2.25,.16,1.05),metal); bed.position.set(0,.38,-.25); this.scene.add(bed);
        var mattress=new THREE.Mesh(new THREE.BoxGeometry(2.12,.13,.96),new THREE.MeshStandardMaterial({color:0xdbe5ec})); mattress.position.set(0,.52,-.25); this.scene.add(mattress); 
        // Hospital bed frame, side rails, head/foot panels and caster wheels.
        var bedBase=new THREE.Mesh(new THREE.BoxGeometry(1.95,.1,.78),new THREE.MeshStandardMaterial({color:0x334155,metalness:.4,roughness:.5}));bedBase.position.set(0,.24,-.25);this.scene.add(bedBase);
        [-.82,.82].forEach(x=>[-.65,.12].forEach(z=>{var leg=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.28,12),metal);leg.position.set(x,.22,z-.25);this.scene.add(leg);var wheel=new THREE.Mesh(new THREE.TorusGeometry(.055,.014,7,14),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.2}));wheel.position.set(x,.055,z-.25);this.scene.add(wheel);}));
        [-1,1].forEach(side=>{var rail=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.78,12),metal);rail.rotation.x=Math.PI/2;rail.position.set(side*.98,.78,-.25);this.scene.add(rail);[-.65,-.1,.12].forEach(z=>{var post=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.18,8),metal);post.position.set(side*.98,.68,z-.25);this.scene.add(post);});});
        var sheet=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.82),new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:1,side:THREE.DoubleSide}));sheet.rotation.x=-Math.PI/2;sheet.position.set(0,.594,-.25);this.scene.add(sheet);

        // Textured humanoid GLB; do not substitute a geometric mannequin.
        var patient=new THREE.Group(); patient.position.set(-.05,.62,-.25); patient.rotation.z=-Math.PI/2; patient.scale.setScalar(.9); this.scene.add(patient);
        this.patientModel=null; this.patientChest=null; this.chestBaseRotation=null; this.chestBaseScale=null;
        var loader=new THREE.GLTFLoader();
        loader.load("/models/medgen-patient.glb",gltf=>{
          if(!this.renderer)return;
          this.patientModel=gltf.scene;
          var initial=new THREE.Box3().setFromObject(this.patientModel),initialSize=initial.getSize(new THREE.Vector3());
          if(initialSize.x>initialSize.y*1.2)this.patientModel.rotation.z=Math.PI/2;
          var bounds=new THREE.Box3().setFromObject(this.patientModel),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
          this.patientModel.position.sub(center); patient.add(this.patientModel); this.scene.updateMatrixWorld(true);
          this.patientModel.traverse(node=>{if(!node.isMesh)return;node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;
            if(node.geometry&&node.geometry.attributes&&node.geometry.attributes.position){
              var geom=node.geometry.clone(),attr=geom.attributes.position,base=new Float32Array(attr.array),weights=new Float32Array(attr.count);
              var origin=patient.localToWorld(new THREE.Vector3(0,0,0)),axisEnd=patient.localToWorld(new THREE.Vector3(0,0,1)),localOrigin=node.worldToLocal(origin.clone()),localAxis=node.worldToLocal(axisEnd.clone()).sub(localOrigin);
              for(var i=0;i<attr.count;i++){var p=new THREE.Vector3(base[i*3],base[i*3+1],base[i*3+2]);node.localToWorld(p);patient.worldToLocal(p);
                var dy=(p.y-size.y*.16)/(size.y*.14),dx=p.x/(size.x*.25);weights[i]=Math.exp(-.5*(dy*dy+dx*dx));}
              node.geometry=geom;this.breathMeshes.push({geometry:geom,base:base,weights:weights,axis:localAxis});
            }
          });
          this.patientChest=this.patientModel.getObjectByName("Chest")||this.patientModel.getObjectByName("Torso")||null;
          if(this.patientChest){this.chestBaseRotation=this.patientChest.rotation.x;this.chestBaseScale=this.patientChest.scale.z;}
          this.patientBounds=size;
          var faceY=size.y*.5-.12,frontZ=size.z*.5+.08;
          var mask=this.scene.getObjectByName("medgen-oxygen-mask"); if(mask){mask.position.set(0,faceY,frontZ+.08);}
          var faceWorld=patient.localToWorld(new THREE.Vector3(0,faceY,frontZ+.08));
          var oxygenCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(1.8,.92,.45),new THREE.Vector3(1.25,1.15,.35),new THREE.Vector3(.55,1.05,.1),faceWorld.clone()]);
          this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(oxygenCurve,28,.01,7,false),new THREE.MeshStandardMaterial({color:0xbdeaff,transparent:true,opacity:.5,roughness:.2})));
          var armWorld=patient.localToWorld(new THREE.Vector3(-.32,size.y*.1,frontZ));
          var ivCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.45,1.65,-.2),new THREE.Vector3(-1.2,1.25,-.15),new THREE.Vector3(-.8,1.0,-.12),armWorld.clone()]);
          this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(ivCurve,28,.008,6,false),new THREE.MeshStandardMaterial({color:0x9bd5ed,transparent:true,opacity:.52,roughness:.2})));
        },undefined,err=>{console.warn("MedGen patient GLB unavailable; rendering geometric fallback.",err);if(!this.renderer)return;if(window.ClinicalUIAdapter)window.ClinicalUIAdapter.renderFallbackMannequin(this.scene,patient);else{var fallback=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),new THREE.MeshStandardMaterial({color:0x38bdf8}));fallback.position.set(0,.1,0);fallback.scale.set(1,2.2,.8);patient.add(fallback);}var note=document.createElement("div");note.textContent="Zaxira geometrik maneken · GLB yuklanmadi";note.style.cssText="position:absolute;right:9px;bottom:8px;padding:5px 8px;border-radius:5px;background:rgba(3,15,28,.86);color:#fcd34d;font:11px system-ui";if(this.wrapper)this.wrapper.firstElementChild.appendChild(note);});
        // Oxygen mask and tubing are attached to the patient's face-side.
        var maskMat=new THREE.MeshStandardMaterial({color:0xc7f0ff,transparent:true,opacity:.3,roughness:.12,side:THREE.DoubleSide,depthWrite:false});
        var mask=new THREE.Mesh(new THREE.SphereGeometry(.13,18,12,0,Math.PI*2,0,Math.PI/2),maskMat); mask.name="medgen-oxygen-mask"; mask.position.set(0,1.53,.22); mask.rotation.x=Math.PI/2; patient.add(mask);
        var maskStrap=new THREE.Mesh(new THREE.TorusGeometry(.145,.008,6,32),new THREE.MeshStandardMaterial({color:0xb8cbd5,roughness:.7})); maskStrap.position.set(0,1.53,.11); patient.add(maskStrap);
        // Realistic-style bedside monitor with a live educational ECG/vitals display.
        var monitorCase=new THREE.Mesh(new THREE.BoxGeometry(.58,.48,.14),new THREE.MeshStandardMaterial({color:0x111c27,roughness:.48,metalness:.2}));monitorCase.position.set(1.35,1.48,-.15);this.scene.add(monitorCase);
        this.monitorCanvas=document.createElement("canvas");this.monitorCanvas.width=512;this.monitorCanvas.height=320;this.monitorCtx=this.monitorCanvas.getContext("2d");this.monitorTexture=new THREE.CanvasTexture(this.monitorCanvas);
        var screen=new THREE.Mesh(new THREE.PlaneGeometry(.49,.37),new THREE.MeshBasicMaterial({map:this.monitorTexture}));screen.position.set(1.35,1.48,-.073);this.scene.add(screen);
        var monitorStand=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.42,12),metal);monitorStand.position.set(1.35,1.15,-.15);this.scene.add(monitorStand);
        var monitorFoot=new THREE.Mesh(new THREE.BoxGeometry(.42,.045,.28),metal);monitorFoot.position.set(1.35,.93,-.15);this.scene.add(monitorFoot);
        [-.18,-.06,.06,.18].forEach(x=>{var key=new THREE.Mesh(new THREE.SphereGeometry(.018,8,8),new THREE.MeshStandardMaterial({color:0x38bdf8}));key.position.set(1.35+x,1.19,-.065);this.scene.add(key);});
        // IV stand with transparent saline bag, fluid level, drip chamber and tubing.
        var pole=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,2,12),metal);pole.position.set(-1.45,1.05,-.2);this.scene.add(pole);
        var ivBase=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.035,18),metal);ivBase.position.set(-1.45,.07,-.2);this.scene.add(ivBase);
        for(var n=0;n<4;n++){var a=n*Math.PI/2;var caster=new THREE.Mesh(new THREE.TorusGeometry(.035,.012,6,12),new THREE.MeshStandardMaterial({color:0x1e293b}));caster.position.set(-1.45+Math.cos(a)*.19,.04,-.2+Math.sin(a)*.19);this.scene.add(caster);}
        var bagMat=new THREE.MeshStandardMaterial({color:0xbdeaff,transparent:true,opacity:.28,roughness:.1,side:THREE.DoubleSide,depthWrite:false});
        var bag=new THREE.Mesh(new THREE.BoxGeometry(.22,.32,.08),bagMat);bag.position.set(-1.45,1.77,-.2);this.scene.add(bag);
        var fluid=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.012),new THREE.MeshBasicMaterial({color:0x55bce8,transparent:true,opacity:.35}));fluid.position.set(-1.45,1.68,-.15);this.scene.add(fluid);
        var drip=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.16,10),bagMat);drip.position.set(-1.45,1.52,-.2);this.scene.add(drip);
        var ivTube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.45,1.43,-.2),new THREE.Vector3(-1.28,1.12,-.1),new THREE.Vector3(-.9,.95,-.08),new THREE.Vector3(-.45,.9,-.08)]),24,.008,6,false),new THREE.MeshStandardMaterial({color:0x9bd5ed,transparent:true,opacity:.6}));this.scene.add(ivTube);
        // Oxygen cylinder with regulator, gauge and flow meter.
        var oxygen=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.82,20),new THREE.MeshStandardMaterial({color:0x16845f,metalness:.25,roughness:.42}));oxygen.position.set(1.8,.55,.45);this.scene.add(oxygen);
        var valve=new THREE.Mesh(new THREE.CylinderGeometry(.045,.07,.16,12),metal);valve.position.set(1.8,1.04,.45);this.scene.add(valve);
        var gauge=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.025,16),new THREE.MeshStandardMaterial({color:0xe5e7eb,metalness:.3}));gauge.rotation.x=Math.PI/2;gauge.position.set(1.8,1.15,.45);this.scene.add(gauge);
        var regulator=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.22,10),new THREE.MeshStandardMaterial({color:0xdbeafe,transparent:true,opacity:.5}));regulator.position.set(1.92,.95,.45);this.scene.add(regulator);
        // Oxygen tubing routes from the cylinder to the patient's mask.
        var o2tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(1.8,.98,.45),new THREE.Vector3(1.35,1.12,.35),new THREE.Vector3(.7,1.05,.15),new THREE.Vector3(.15,.95,.15)]),28,.01,6,false),new THREE.MeshStandardMaterial({color:0xbdeaff,transparent:true,opacity:.55}));this.scene.add(o2tube);
        // Compact emergency trolley and defibrillator.
        var cart=new THREE.Mesh(new THREE.BoxGeometry(.58,.46,.4),new THREE.MeshStandardMaterial({color:0xe5edf2,metalness:.12,roughness:.7}));cart.position.set(-1.75,.48,.95);this.scene.add(cart);
        var drawerMat=new THREE.MeshStandardMaterial({color:0xcbd5e1,metalness:.2});[.34,.48,.62].forEach(y=>{var drawer=new THREE.Mesh(new THREE.BoxGeometry(.52,.1,.015),drawerMat);drawer.position.set(-1.75,y,.745);this.scene.add(drawer);});
        var defib=new THREE.Mesh(new THREE.BoxGeometry(.28,.24,.2),new THREE.MeshStandardMaterial({color:0x273746,roughness:.45}));defib.position.set(-1.75,.85,.95);this.scene.add(defib);
        var defibScreen=new THREE.Mesh(new THREE.PlaneGeometry(.19,.12),new THREE.MeshBasicMaterial({color:0x063b37}));defibScreen.position.set(-1.75,.85,1.055);this.scene.add(defibScreen);
        this.resize();
        if(window.ResizeObserver){this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(wrap);}
        else window.addEventListener("resize",this._resize=this.resize.bind(this));
        this.animate();
        return this;
      } catch(err) {
        console.error("MedGen 3D clinic initialization failed",err);
        this.dispose();
        wrap.textContent="3D sahna ushbu qurilmada ishga tushmadi. Simulyatorning klinik vazifalari davom etadi.";
        return null;
      }
    }
    resize() {
      if(!this.renderer||!this.wrapper)return;
      var rect=this.wrapper.getBoundingClientRect();
      var w=Math.max(1,Math.round(rect.width||this.wrapper.clientWidth||1));
      var h=Math.max(280,Math.round(rect.height||this.wrapper.clientHeight||280));
      this.camera.aspect=w/h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w,h,false);
      if(this.renderer.domElement){
        this.renderer.domElement.style.width="100%";
        this.renderer.domElement.style.height="100%";
        this.renderer.domElement.style.display="block";
      }
      this.renderer.render(this.scene,this.camera);
    }
    updateVitals(v) {
      if(v){if(Number.isFinite(Number(v.rr)))this.rr=Math.max(4,Math.min(60,Number(v.rr)));if(Number.isFinite(Number(v.hr)))this.hr=Number(v.hr);if(Number.isFinite(Number(v.sbp)))this.sbp=Number(v.sbp);if(Number.isFinite(Number(v.dbp)))this.dbp=Number(v.dbp);if(Number.isFinite(Number(v.spo2)))this.spo2=Number(v.spo2);}
    }
    animate() {
      if(!this.renderer)return;
      this.raf=requestAnimationFrame(()=>this.animate());
      this.phase+=Math.max(.025,this.rr/60*.055);
      if(this.monitorCtx&&this.monitorTexture){var c=this.monitorCtx;c.fillStyle="#06110f";c.fillRect(0,0,512,320);c.font="bold 31px monospace";c.fillStyle="#5af0c5";c.fillText("HR "+Math.round(this.hr),16,48);c.fillStyle="#f5d36b";c.fillText("BP "+Math.round(this.sbp)+"/"+Math.round(this.dbp),16,91);c.fillStyle="#67d8ff";c.fillText("SpO2 "+Math.round(this.spo2)+"%",16,134);c.fillStyle="#b9f28b";c.fillText("RR "+Math.round(this.rr)+"/min",16,177);c.strokeStyle="#4ce6bc";c.lineWidth=4;c.beginPath();for(var j=0;j<470;j++){var ph=j/470*2.4+this.phase*.35;var y=250-(Math.sin(ph*2)+.35*Math.sin(ph*5))*12-(Math.sin(ph*2)>0.92?42:0);if(j===0)c.moveTo(18+j,y);else c.lineTo(18+j,y);}c.stroke();this.monitorTexture.needsUpdate=true;}this.breathMeshes.forEach(item=>{var a=item.geometry.attributes.position;for(var i=0;i<item.weights.length;i++){var k=i*3,w=item.weights[i]*Math.sin(this.phase)*.008;a.array[k]=item.base[k]+item.axis.x*w;a.array[k+1]=item.base[k+1]+item.axis.y*w;a.array[k+2]=item.base[k+2]+item.axis.z*w;}a.needsUpdate=true;}); if(this.patientChest){if(this.chestBaseRotation!==null)this.patientChest.rotation.x=this.chestBaseRotation+Math.sin(this.phase)*.012;else if(this.chestBaseScale!==null)this.patientChest.scale.z=this.chestBaseScale*(1+Math.sin(this.phase)*.012);}
      this.renderer.render(this.scene,this.camera);
    }
    dispose() {
      if(this.raf)cancelAnimationFrame(this.raf); this.raf=0;
      if(this.resizeObserver)this.resizeObserver.disconnect(); this.resizeObserver=null;
      if(this._resize)window.removeEventListener("resize",this._resize); this._resize=null;
      if(this.scene)this.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});
      if(this.renderer){this.renderer.dispose();if(this.renderer.domElement.parentNode)this.renderer.domElement.remove();}
      this.renderer=null;this.scene=null;this.camera=null;this.patientChest=null;this.patientModel=null;this.chestBaseRotation=null;this.chestBaseScale=null;this.breathMeshes=[];this.monitorCtx=null;this.monitorTexture=null;this.wrapper=null;
    }
  }
  window.medgen3DClinic=new MedGen3DClinic();
})();