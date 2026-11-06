/* MedGen AI — reusable 3D virtual patient scene (educational visualization). */
(function () {
  "use strict";
  class MedGen3DClinic {
    constructor() {
      this.scene=null; this.camera=null; this.renderer=null; this.patientChest=null;
      this.raf=0; this.resizeObserver=null; this.phase=0; this.rr=18; this.wrapper=null;
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
        this.camera.position.set(3.4,2.6,4.8); this.camera.lookAt(0,.85,0);
        this.renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:false});
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
        this.scene.add(new THREE.HemisphereLight(0xffffff,0x334155,1.8));
        var key=new THREE.DirectionalLight(0xffffff,1.6); key.position.set(3,6,4); this.scene.add(key);
        var floor=new THREE.Mesh(new THREE.PlaneGeometry(9,8),new THREE.MeshStandardMaterial({color:0x1e3445,roughness:.95}));
        floor.rotation.x=-Math.PI/2; this.scene.add(floor);
        var metal=new THREE.MeshStandardMaterial({color:0x94a3b8,metalness:.45,roughness:.4});
        var bed=new THREE.Mesh(new THREE.BoxGeometry(2.25,.16,1.05),metal); bed.position.set(0,.38,-.25); this.scene.add(bed);
        var mattress=new THREE.Mesh(new THREE.BoxGeometry(2.12,.13,.96),new THREE.MeshStandardMaterial({color:0xdbe5ec})); mattress.position.set(0,.52,-.25); this.scene.add(mattress);
        var patient=new THREE.Group(); patient.position.set(-.05,.62,-.25); patient.rotation.z=-Math.PI/2; this.scene.add(patient);
        var skin=new THREE.MeshStandardMaterial({color:0xc58d73}), gown=new THREE.MeshStandardMaterial({color:0x16758a});
        function part(geo,mat,x,y,z,sx,sy,sz){var m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);patient.add(m);return m;}
        part(new THREE.SphereGeometry(.2,20,16),skin,0,1.48,0,1,1.1,.9);
        this.patientChest=part(new THREE.SphereGeometry(.48,24,18),gown,0,.91,0,1,.82,.62);
        part(new THREE.CylinderGeometry(.065,.085,.72,14),skin,-.43,.88,0,1,1,1);
        part(new THREE.CylinderGeometry(.065,.085,.72,14),skin,.43,.88,0,1,1,1);
        part(new THREE.CylinderGeometry(.11,.09,.72,16),gown,-.18,.25,0,1,1,1);
        part(new THREE.CylinderGeometry(.11,.09,.72,16),gown,.18,.25,0,1,1,1);
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
      if(this.patientChest)this.patientChest.scale.y=.82+Math.sin(this.phase)*.045;
      this.renderer.render(this.scene,this.camera);
    }
    dispose() {
      if(this.raf)cancelAnimationFrame(this.raf); this.raf=0;
      if(this.resizeObserver)this.resizeObserver.disconnect(); this.resizeObserver=null;
      if(this._resize)window.removeEventListener("resize",this._resize); this._resize=null;
      if(this.scene)this.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});
      if(this.renderer){this.renderer.dispose();if(this.renderer.domElement.parentNode)this.renderer.domElement.remove();}
      this.renderer=null;this.scene=null;this.camera=null;this.patientChest=null;this.wrapper=null;
    }
  }
  window.medgen3DClinic=new MedGen3DClinic();
})();