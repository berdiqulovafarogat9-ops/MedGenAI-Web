/* MedGen AI — interactive procedural 3D anatomy and appendectomy teaching lab.
 * Educational visualization only; not a clinical device or operative guidance.
 */
(function () {
  "use strict";
  if (!window.THREE) return;
  var T = window.THREE;
  function makeMat(color, opts) { return new T.MeshStandardMaterial(Object.assign({color:color,roughness:.58,metalness:.02},opts||{})); }
  function sphere(parent, name, pos, scale, material, detail) {
    var m=new T.Mesh(new T.SphereGeometry(1,detail||32,24),material);m.name=name;m.position.set(pos[0],pos[1],pos[2]);m.scale.set(scale[0],scale[1],scale[2]);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function tube(parent,name,points,radius,material,segments) {
    var curve=new T.CatmullRomCurve3(points.map(function(p){return new T.Vector3(p[0],p[1],p[2]);}));
    var m=new T.Mesh(new T.TubeGeometry(curve,segments||48,radius,10,false),material);m.name=name;m.castShadow=true;parent.add(m);return m;
  }
  var instances=[];
  function Lab(host, mode) {
    this.host=host;this.mode=mode;this.scene=new T.Scene();this.scene.background=new T.Color(0x071521);
    this.camera=new T.PerspectiveCamera(35,1,.1,100);this.camera.position.set(0,0.3,7.2);
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    if("outputColorSpace" in this.renderer&&T.SRGBColorSpace)this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;
    this.renderer.domElement.style.cssText="width:100%;height:100%;display:block;touch-action:none;cursor:grab";
    host.innerHTML="";host.appendChild(this.renderer.domElement);
    this.scene.add(new T.HemisphereLight(0xdceeff,0x26394a,2));
    var key=new T.DirectionalLight(0xffe8d5,2.6);key.position.set(-3,5,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);this.scene.add(key);
    var rim=new T.DirectionalLight(0x62c8ed,1.3);rim.position.set(4,1,-4);this.scene.add(rim);
    var floor=new T.Mesh(new T.CircleGeometry(4,64),makeMat(0x142b3a,{roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.0;floor.receiveShadow=true;this.scene.add(floor);
    this.root=new T.Group();this.scene.add(this.root);this.pickables=[];this.selected=null;this.step=0;this.tool=null;this.makeUI();
    if(mode==="surgery")this.buildSurgery();else this.buildAnatomy();
    this.resize();this.observer=window.ResizeObserver?new ResizeObserver(this.resize.bind(this)):null;if(this.observer)this.observer.observe(host);
    this.pointer={down:false,x:0,y:0};var self=this;
    this.renderer.domElement.addEventListener("pointerdown",function(e){self.pointer.down=true;self.pointer.x=e.clientX;self.pointer.y=e.clientY;self.renderer.domElement.setPointerCapture(e.pointerId);self.renderer.domElement.style.cursor="grabbing";});
    this.renderer.domElement.addEventListener("pointermove",function(e){if(!self.pointer.down)return;var dx=e.clientX-self.pointer.x,dy=e.clientY-self.pointer.y;self.pointer.x=e.clientX;self.pointer.y=e.clientY;self.root.rotation.y+=dx*.008;self.root.rotation.x=Math.max(-.55,Math.min(.55,self.root.rotation.x+dy*.006));});
    this.renderer.domElement.addEventListener("pointerup",function(){self.pointer.down=false;self.renderer.domElement.style.cursor="grab";});
    this.renderer.domElement.addEventListener("wheel",function(e){e.preventDefault();self.camera.position.z=Math.max(3.2,Math.min(11,self.camera.position.z+e.deltaY*.006));},{passive:false});
    this.ray=new T.Raycaster();this.mouse=new T.Vector2();
    this.renderer.domElement.addEventListener("click",function(e){var r=self.renderer.domElement.getBoundingClientRect();self.mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);self.ray.setFromCamera(self.mouse,self.camera);var hits=self.ray.intersectObjects(self.pickables,true);if(hits.length)self.select(hits[0].object);});
    this.animate();
  }
  Lab.prototype.makeUI=function(){
    var self=this,bar=document.createElement("div");bar.style.cssText="display:flex;flex-wrap:wrap;gap:6px;padding:7px;background:#0a1b29;border:1px solid #29465a;border-radius:10px;margin-bottom:7px";
    function btn(label,fn){var b=document.createElement("button");b.type="button";b.textContent=label;b.style.cssText="border:1px solid #31536a;border-radius:8px;background:#142b3b;color:#dff5ff;padding:7px 10px;font-size:12px;font-weight:700";b.onclick=fn;bar.appendChild(b);}
    if(this.mode==="anatomy"){
      btn("Old ko‘rinish",function(){self.root.rotation.set(0,0,0);});
      btn("Orqa ko‘rinish",function(){self.root.rotation.y=Math.PI;});
      btn("Organlarni ajratish",function(){self.root.children.forEach(function(m){if(m.userData.organ)m.visible=true;});self.setExploded(true);});
      btn("Butun tana",function(){self.setExploded(false);});
    }else{
      ["Skalpel","Pinset","Dissektor","Klipsator"].forEach(function(n){btn(n,function(){self.setTool(n);});});
      btn("Keyingi bosqich",function(){self.setStep(Math.min(5,self.step+1));});
    }
    this.host.parentNode.insertBefore(bar,this.host);this.toolbar=bar;
    var info=document.createElement("div");info.style.cssText="margin-top:7px;padding:9px 11px;background:#0a1b29;border:1px solid #29465a;border-radius:9px;color:#c6d7e4;font:12px/1.5 system-ui;min-height:48px";
    info.textContent=this.mode==="anatomy"?"Organ ustiga bosing. Sichqoncha yoki barmoq bilan aylantiring, g‘ildirak/ikki barmoq bilan yaqinlashtiring.":"Operatsion maydonni aylantiring. Asbob tanlang va bosqichlarni ko‘ring. Bu xavfsiz, soddalashtirilgan o‘quv vizualizatsiyasi.";
    this.host.parentNode.insertBefore(info,this.host.nextSibling);this.info=info;
  };
  Lab.prototype.addPick=function(mesh,title,desc){mesh.userData.organ=true;mesh.userData.title=title;mesh.userData.desc=desc;this.pickables.push(mesh);return mesh;};
  Lab.prototype.buildAnatomy=function(){
    var skin=makeMat(0xc78f78,{transparent:true,opacity:.18,side:T.DoubleSide,depthWrite:false});
    sphere(this.root,"torso",[0,.05,0],[1.15,1.75,.48],skin,48);
    var bone=makeMat(0xe9dfc8),cart=makeMat(0xd5c6ae),lung=makeMat(0xc65d67,{roughness:.42}),heart=makeMat(0xb51f39,{roughness:.4}),liver=makeMat(0x783d31),stomach=makeMat(0xe5a16e),kidney=makeMat(0x9b3e48),gut=makeMat(0xd9a77e),blue=makeMat(0x4a9eb5);
    // rib cage and sternum
    for(var y=-.12;y<.8;y+=.2){var rib=new T.Mesh(new T.TorusGeometry(.78,.035,8,48,Math.PI),bone);rib.position.set(0,y,.04);rib.rotation.z=Math.PI;this.root.add(rib);}
    sphere(this.root,"sternum",[0,.28,.15],[.10,.72,.09],bone);
    // lungs, heart and mediastinum
    var l=this.addPick(sphere(this.root,"left-lung",[-.43,.35,.1],[.38,.72,.29],lung),"Chap o‘pka","Yuqori va pastki bo‘laklar; nafas almashinuvi alveolalarda kechadi.");
    var r=this.addPick(sphere(this.root,"right-lung",[.43,.35,.1],[.38,.72,.29],makeMat(0xd8797c),48),"O‘ng o‘pka","Yuqori, o‘rta va pastki bo‘laklar; plevra bilan qoplangan.");
    var h=this.addPick(sphere(this.root,"heart",[.02,.12,.42],[.27,.38,.25],heart),"Yurak","To‘rt kamerali mushakli a’zo; qon aylanishini ta’minlaydi.");
    // airway and vessels
    tube(this.root,"trachea",[[0,1.15,.18],[0,.78,.2],[0,.53,.2]],.075,makeMat(0xd8c6a7));
    tube(this.root,"aorta",[[.1,.35,.35],[.18,.72,.36],[.15,1.0,.32],[-.05,1.05,.28]],.075,makeMat(0xb33a43));
    // abdomen
    this.addPick(sphere(this.root,"liver",[-.42,-.72,.14],[.58,.32,.27],liver,40),"Jigar","O‘ng qovurg‘a ostida joylashadi; metabolizm, sintez va detoksikatsiyada qatnashadi.");
    this.addPick(sphere(this.root,"stomach",[.35,-.58,.22],[.34,.43,.22],stomach,40),"Oshqozon","Ovqatni mexanik va kimyoviy qayta ishlaydi.");
    this.addPick(sphere(this.root,"left-kidney",[-.48,-1.15,-.02],[.18,.30,.16],kidney),"Chap buyrak","Filtratsiya, suv-elektrolit va kislota-ishqor muvozanati.");
    this.addPick(sphere(this.root,"right-kidney",[.48,-1.15,-.02],[.18,.30,.16],kidney),"O‘ng buyrak","Filtratsiya, suv-elektrolit va kislota-ishqor muvozanati.");
    var loops=new T.Group();for(var i=0;i<5;i++){var yy=-.82-i*.13;var loop=new T.Mesh(new T.TorusGeometry(.28-i*.012,.055,8,40),gut);loop.position.set(0,yy,.24);loops.add(loop);}this.root.add(loops);this.addPick(loops,"Ingichka ichak","Oziq moddalarning asosiy so‘rilish joyi.");
    var colon=new T.Mesh(new T.TorusGeometry(.48,.085,10,48),makeMat(0xb77b55));colon.position.set(0,-1.03,.22);colon.scale.set(1,.72,1);this.root.add(colon);this.addPick(colon,"Yo‘g‘on ichak","Suv va elektrolitlarning so‘rilishi, najas shakllanishi.");
    var appendix=this.addPick(tube(this.root,"appendix",[[.42,-1.12,.35],[.52,-1.32,.38],[.47,-1.52,.36]],.055,makeMat(0xe4a76f)),"Appendiks","Ko‘richakning chuvalchangsimon o‘simtasi; klinik holatga qarab yallig‘lanishi mumkin.");
    // upper body / head and limbs
    sphere(this.root,"head",[0,2.02,0],[.34,.42,.32],makeMat(0xc78f78,{transparent:true,opacity:.3}),32);
    [-1,1].forEach(function(side){var arm=sphere(this.root,"arm",[side*1.22,.15,0],[.22,.88,.22],skin,24);arm.rotation.z=side*.12;var leg=sphere(this.root,"leg",[side*.42,-2.0,0],[.28,.88,.3],skin,24);},this);
    this.info.textContent="3D tana modeli: yurak, o‘pka, jigar, oshqozon, buyraklar, ichaklar va appendiks. Organ tanlash uchun ustiga bosing.";
  };
  Lab.prototype.setExploded=function(on){this.root.children.forEach(function(m){if(m.userData.organ){var p=m.userData.basePosition;if(!p){m.userData.basePosition=m.position.clone();p=m.userData.basePosition;}m.position.copy(p);if(on)m.position.z+=.35;}});};
  Lab.prototype.select=function(mesh){var o=mesh;while(o&&!o.userData.title)o=o.parent;if(!o)return;this.selected=o;this.info.innerHTML="<strong style='color:#7dd3fc;font-size:14px'>"+o.userData.title+"</strong><br>"+o.userData.desc;};
  Lab.prototype.buildSurgery=function(){
    var wall=makeMat(0xc58c77,{roughness:.55}),fat=makeMat(0xe8c99d),fascia=makeMat(0xd7b5a1),peritoneum=makeMat(0xe8d9c5,{transparent:true,opacity:.62,side:T.DoubleSide}),bowel=makeMat(0xc87868),appendixMat=makeMat(0xdba477),meso=makeMat(0xb95751,{side:T.DoubleSide}),steel=makeMat(0xb7c6d0,{metalness:.78,roughness:.22});
    var field=new T.Mesh(new T.BoxGeometry(3.5,2.45,.28),wall);field.position.z=-.18;this.root.add(field);
    var opening=new T.Mesh(new T.BoxGeometry(2.45,1.55,.07),fat);opening.position.set(0,0,.02);this.root.add(opening);
    var layer=new T.Mesh(new T.BoxGeometry(2.12,1.22,.08),fascia);layer.position.set(0,0,.075);this.root.add(layer);
    var cavity=new T.Mesh(new T.BoxGeometry(1.82,1.02,.08),peritoneum);cavity.position.set(0,0,.13);this.root.add(cavity);
    // Caecum and terminal ileum with visible appendiceal origin
    sphere(this.root,"caecum",[-.05,-.18,.42],[.55,.42,.22],bowel,40);
    tube(this.root,"ileum",[[.75,.55,.42],[.48,.42,.42],[.35,.18,.42],[.25,-.05,.42]],.105,makeMat(0xd68b79));
    tube(this.root,"ascending-colon",[[-.42,-.65,.4],[-.48,-.25,.4],[-.46,.25,.4],[-.38,.58,.4]],.14,bowel);
    var mesoMesh=new T.Mesh(new T.BufferGeometry(),meso);var shape=new T.Shape();shape.moveTo(-.03,-.1);shape.quadraticCurveTo(.25,-.25,.42,-.58);shape.quadraticCurveTo(.1,-.55,-.03,-.1);mesoMesh.geometry=new T.ShapeGeometry(shape);mesoMesh.position.z=.54;this.root.add(mesoMesh);
    this.appendix=tube(this.root,"appendix",[[.03,-.1,.53],[.2,-.3,.57],[.35,-.55,.6],[.45,-.83,.61]],.075,appendixMat);
    this.appendixEnd=sphere(this.root,"appendix-tip",[.45,-.83,.61],[.08,.08,.08],appendixMat);
    this.toolGroup=new T.Group();this.toolGroup.position.set(.95,.85,1.0);this.root.add(this.toolGroup);
    var shaft=new T.Mesh(new T.CylinderGeometry(.025,.035,1.25,12),steel);shaft.rotation.z=-.48;this.toolGroup.add(shaft);
    var grip=new T.Mesh(new T.TorusGeometry(.10,.018,8,24),steel);grip.position.set(-.3,-.52,0);this.toolGroup.add(grip);
    var tip=new T.Mesh(new T.ConeGeometry(.06,.18,12),steel);tip.rotation.z=Math.PI/2;tip.position.set(-.55,-.58,0);this.toolGroup.add(tip);
    this.info.textContent="Appendektomiya o‘quv maydoni: qorin devori qatlamlari, ko‘richak, terminal ileum, mezappendiks va appendiks 3D ko‘rsatilgan. Bosqichni o‘zgartirish uchun yuqoridagi boshqaruvlardan foydalaning.";
    this.setStep(0);
  };
  Lab.prototype.setTool=function(name){this.tool=name;this.info.textContent=name+" tanlandi. Asbob 3D operatsion maydonda ko‘rsatilgan; uni ko‘rish uchun sahnani aylantiring.";};
  Lab.prototype.setStep=function(step){this.step=step;var stages=["Qorin devori qatlamlari va operatsion maydon","Qatlamlarni o‘quv ko‘rinishida ajratish","Ko‘richak va terminal ileumni aniqlash","Appendiks va mezappendiksni vizual ajratish","Gemostaz hududini tekshirish","Yakuniy anatomik nazorat va yopish bosqichi"];
    if(this.mode!=="surgery")return;
    this.root.children.forEach(function(m){if(m.name==="appendix"||m.name==="appendix-tip")m.visible=step>=2;if(m.name==="ascending-colon"||m.name==="caecum")m.visible=step>=2;});
    if(step>=1){this.root.children.forEach(function(m){if(m.geometry&&m.geometry.type==="BoxGeometry"&&m.position.z<.2)m.material.transparent=true;});}
    if(this.toolGroup){this.toolGroup.visible=step>=1;this.toolGroup.rotation.z=(step%3-1)*.12;this.toolGroup.position.x=step>=3?.45:.95;}
    this.info.textContent="Bosqich "+(step+1)+"/6 — "+stages[step]+". Anatomik tuzilmalarni 3D sahnada aylantirib ko‘ring. Bu soddalashtirilgan ta’lim modeli.";
  };
  Lab.prototype.resize=function(){if(!this.renderer||!this.host)return;var w=Math.max(240,this.host.clientWidth),h=Math.max(260,this.host.clientHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);};
  Lab.prototype.animate=function(){var self=this;this.raf=requestAnimationFrame(function(){self.animate();});if(this.mode==="anatomy")this.root.rotation.y+=.0015;this.renderer.render(this.scene,this.camera);};
  Lab.prototype.dispose=function(){if(this.raf)cancelAnimationFrame(this.raf);if(this.observer)this.observer.disconnect();if(this.toolbar)this.toolbar.remove();if(this.info)this.info.remove();this.renderer.dispose();this.host.innerHTML="";};
  window.MedGenAnatomyLab={mount:function(host,mode){var lab=new Lab(host,mode);instances.push(lab);return lab;},disposeAll:function(){instances.splice(0).forEach(function(lab){lab.dispose();});}};
})();