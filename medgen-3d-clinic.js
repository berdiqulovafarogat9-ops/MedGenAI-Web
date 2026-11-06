/* MedGen AI — reusable 3D virtual patient scene (educational visualization). */
(function () {
  "use strict";
  class MedGen3DClinic {
    constructor() {
      this.scene=null; this.camera=null; this.renderer=null; this.patientChest=null;
      this.raf=0; this.resizeObserver=null; this.phase=0; this.rr=18; this.wrapper=null; this.breathMeshes=[];
    }
    mount3DScene(wrapperId) {
      this.dispose();
      var wrap=document.getElementById(wrapperId);
      if(!wrap || !window.THREE || !THREE.WebGLRenderer) return null;
      this.wrapper=wrap;
      wrap.innerHTML='<div style="position:relative;width:100%;height:280px;background:#071521;border-radius:10px;overflow:hidden"><canvas style="width:100%;height:100%;display:block"></canvas><div style="position:absolute;left:9px;bottom:8px;padding:5px 9px;border-radius:5px;background:rgba(3,15,28,.86);color:#7dd3fc;font:11px system-ui">3D reanimatsiya xonasi · nafas harakati — simulyatsiya</div></div>';
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
        // Textured humanoid GLB; do not substitute a geometric mannequin.
        var patient=new THREE.Group(); patient.position.set(-.05,.62,-.25); patient.rotation.z=-Math.PI/2; patient.scale.setScalar(.9); this.scene.add(patient);
        this.patientModel=null; this.patientChest=null; this.chestBaseRotation=null; this.chestBaseScale=null;
        var loader=new THREE.GLTFLoader();
        loader.load("https://files.innerscene.com/library/daniel-3d-person-lying-flat-820f78f4/6d7b4ad3797154f4db48/daniel-lying-flat-3d-person.glb",gltf=>{
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
        },undefined,err=>{console.error("MedGen patient GLB load failed",err);if(this.wrapper)this.wrapper.querySelector("[data-patient-load-error]")?.remove();});
        // Oxygen mask and tubing are attached to the patient's face-side.
        var maskMat=new THREE.MeshStandardMaterial({color:0xc7f0ff,transparent:true,opacity:.3,roughness:.12,side:THREE.DoubleSide,depthWrite:false});
        var mask=new THREE.Mesh(new THREE.SphereGeometry(.13,18,12,0,Math.PI*2,0,Math.PI/2),maskMat); mask.name="medgen-oxygen-mask"; mask.position.set(0,1.53,.22); mask.rotation.x=Math.PI/2; patient.add(mask);
        var maskStrap=new THREE.Mesh(new THREE.TorusGeometry(.145,.008,6,32),new THREE.MeshStandardMaterial({color:0xb8cbd5,roughness:.7})); maskStrap.position.set(0,1.53,.11); patient.add(maskStrap);
        // Bedside monitor and IV/oxygen equipment are visual props, not functioning devices.
        var monitor=new THREE.Mesh(new THREE.BoxGeometry(.52,.42,.12),new THREE.MeshStandardMaterial({color:0x0b1720})); monitor.position.set(1.35,1.42,-.15); this.scene.add(monitor);
        var screen=new THREE.Mesh(new THREE.PlaneGeometry(.43,.31),new THREE.MeshBasicMaterial({color:0x063b37})); screen.position.set(1.35,1.42,-.08); this.scene.add(screen);
        var pole=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,1.9,10),metal); pole.position.set(-1.45,1.05,-.2); this.scene.add(pole);
        var bag=new THREE.Mesh(new THREE.BoxGeometry(.2,.28,.1),new THREE.MeshStandardMaterial({color:0x8ecae6,transparent:true,opacity:.75})); bag.position.set(-1.45,1.78,-.2); this.scene.add(bag);
        var oxygen=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.78,16),new THREE.MeshStandardMaterial({color:0x278b70,metalness:.25})); oxygen.position.set(1.8,.55,.45); this.scene.add(oxygen);
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
      var w=Math.max(this.wrapper.clientWidth,1),h=280;
      this.camera.aspect=w/h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w,h,false);
    }
    updateVitals(v) {
      if(v&&Number.isFinite(Number(v.rr)))this.rr=Math.max(4,Math.min(60,Number(v.rr)));
    }
    animate() {
      if(!this.renderer)return;
      this.raf=requestAnimationFrame(()=>this.animate());
      this.phase+=Math.max(.025,this.rr/60*.055);
      this.breathMeshes.forEach(item=>{var a=item.geometry.attributes.position;for(var i=0;i<item.weights.length;i++){var k=i*3,w=item.weights[i]*Math.sin(this.phase)*.008;a.array[k]=item.base[k]+item.axis.x*w;a.array[k+1]=item.base[k+1]+item.axis.y*w;a.array[k+2]=item.base[k+2]+item.axis.z*w;}a.needsUpdate=true;}); if(this.patientChest){if(this.chestBaseRotation!==null)this.patientChest.rotation.x=this.chestBaseRotation+Math.sin(this.phase)*.012;else if(this.chestBaseScale!==null)this.patientChest.scale.z=this.chestBaseScale*(1+Math.sin(this.phase)*.012);}
      this.renderer.render(this.scene,this.camera);
    }
    dispose() {
      if(this.raf)cancelAnimationFrame(this.raf); this.raf=0;
      if(this.resizeObserver)this.resizeObserver.disconnect(); this.resizeObserver=null;
      if(this._resize)window.removeEventListener("resize",this._resize); this._resize=null;
      if(this.scene)this.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});
      if(this.renderer){this.renderer.dispose();if(this.renderer.domElement.parentNode)this.renderer.domElement.remove();}
      this.renderer=null;this.scene=null;this.camera=null;this.patientChest=null;this.patientModel=null;this.chestBaseRotation=null;this.chestBaseScale=null;this.breathMeshes=[];this.wrapper=null;
    }
  }
  window.medgen3DClinic=new MedGen3DClinic();
})();