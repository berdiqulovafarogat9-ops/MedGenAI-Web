(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { mode:'pcr', scene:null, camera:null, renderer:null, raycaster:null, pointer:null, objects:{}, labels:[], selected:null, running:false, runs:0, showLabels:true, history:[], bubbles:[] };
  const API_BASE = window.MEDGEN_API_BASE || 'https://medgenai-web-1.onrender.com/api/v1';
  const DNA_DEFAULT = 'ATGCGTACGTAGCTAGCTAGGCTAACGTTAGCGATCGTACGATCG';

  const experiments = {
    pcr:{title:'PCR & Genomika',description:'DNK ketma-ketligini tekshiring, GC tarkibini hisoblang va PCR sikllarining nazariy ko‘payish modelini ko‘ring.',protocol:'PCR ish jarayoni',steps:['DNK ketma-ketligini tekshirish','GC tarkibi va uzunligini hisoblash','Sikl bo‘yicha nazariy amplifikatsiyani baholash','Hisoblangan natijani MedGen hisobiga saqlash'],note:'PCR nazariy nusxa soni real amplifikatsiya samaradorligiga teng emas. Primerlar, ferment, reagentlar va sikl sharoitlari natijaga ta’sir qiladi.'},
    cell:{title:'Hujayra kulturasi',description:'O‘quv modelida muhit pH, harorat va inkubatsiya vaqtining hujayra kulturasi holatiga ta’sirini kuzating.',protocol:'Hujayra kulturasi protokoli',steps:['Ozuqa muhitini tanlash','pH va harorat parametrlarini belgilash','Inkubatsiya vaqtini tanlash','Soddalashtirilgan model natijasini tahlil qilish'],note:'Viability ko‘rsatkichi ushbu o‘quv simulyatorining shartli formulasi; real hujayra hayotchanligi o‘lchovi yoki laboratoriya protokoli emas.'},
    bioreactor:{title:'Bioreaktor',description:'Fermentatsiya uchun pH, harorat va erigan kislorod parametrlarini o‘zgartirib, soddalashtirilgan jarayon indeksini hisoblang.',protocol:'Bioreaktor jarayoni',steps:['Bioreaktor ish rejimini tanlash','pH, harorat va DO qiymatlarini kiritish','Oziqa berish tezligini sozlash','Shartli jarayon indeksini hisoblash'],note:'Hosildorlik indeksi o‘quv uchun tuzilgan soddalashtirilgan ko‘rsatkich. U real shtamm, muhit yoki ishlab chiqarish natijasini bashorat qilmaydi.'},
    crispr:{title:'CRISPR-Cas9',description:'Guide RNA va nishon ketma-ketligi o‘rtasidagi moslikni o‘quv darajasida tekshiring. Bu real genomni tahrirlamaydi.',protocol:'CRISPR-Cas9 konseptual workflow',steps:['Namunaviy DNK ketma-ketligini kiritish','Nishon motivni qidirish','Guide/nishon mosligini ko‘rsatish','Tahrirlash cheklovlarini ko‘rib chiqish'],note:'Bu faqat konseptual moslik namoyishi. PAM, off-target, xromatin konteksti va laboratoriya validatsiyasi hisoblanmaydi; biologik tahrir bajarilmaydi.'},
    microscope:{title:'Virtual mikroskopiya',description:'Obyektiv kattalashtirish, okulyar koeffitsiyenti va ko‘rish maydoni o‘rtasidagi bog‘liqlikni hisoblang.',protocol:'Optik mikroskopiya — o‘quv modeli',steps:['Namunaviy preparatni tanlash','Obyektiv kattalashtirishni belgilash','Umumiy kattalashtirishni hisoblash','Ko‘rish maydoni diametrini baholash'],note:'Hisob 10× okulyar va 18 mm field number faraziga asoslangan. Real mikroskop kalibrovkasi, optik aberratsiya va preparat qalinligi hisobga olinmaydi.'}
  };

  function buildScene(){
    const host=$('lab3d');
    if(!window.THREE){$('sceneLoading').innerHTML='<b>3D kutubxona yuklanmadi</b><small>Internet ulanishini tekshirib sahifani yangilang.</small>';return;}
    const T=window.THREE, scene=new T.Scene(); scene.background=new T.Color(0x070b12); scene.fog=new T.Fog(0x070b12,15,30);
    const camera=new T.PerspectiveCamera(68,window.innerWidth/window.innerHeight,.1,100);camera.position.set(0,2.4,3.8);
    const renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(host.clientWidth,host.clientHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;if('outputColorSpace' in renderer && T.SRGBColorSpace)renderer.outputColorSpace=T.SRGBColorSpace;else if('outputEncoding' in renderer && T.sRGBEncoding)renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.78;host.prepend(renderer.domElement);
    const CAMERA_TARGET_Y=.65;const initialRadius=Math.sqrt(3.8*3.8+(2.4-CAMERA_TARGET_Y)*(2.4-CAMERA_TARGET_Y));const controls={target:new T.Vector3(0,CAMERA_TARGET_Y,0),drag:false,pan:false,x:0,y:0,theta:0,phi:Math.acos((2.4-CAMERA_TARGET_Y)/initialRadius),radius:initialRadius,minDistance:1.0,maxDistance:6.5,minPolarAngle:.1,maxPolarAngle:Math.PI/2.05,zoomSpeed:1.2,rotateSpeed:.8,pointers:new Map(),pinchDistance:0};
    const ambient=new T.AmbientLight(0x0f172a,.6);scene.add(ambient);
    const hemi=new T.HemisphereLight(0x66839a,0x090e17,.22);scene.add(hemi);
    const key=new T.DirectionalLight(0xffffff,1.0);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(1536,1536);scene.add(key);
    const spot=new T.SpotLight(0xdff8ff,5,18,Math.PI/5,.55,1.5);spot.position.set(1,9,3);spot.target.position.set(0,1.2,0);spot.castShadow=true;scene.add(spot,spot.target);
    const cyan=new T.PointLight(0x38bdf8,1.2,8);cyan.position.set(-4,3,1);scene.add(cyan);
    function buildLaboratoryRoom(targetScene){
      const room=new T.Group();room.name='laboratory-room';
      const floorMat=new T.MeshStandardMaterial({color:0x090e17,roughness:.5,metalness:.1});
      const floor=new T.Mesh(new T.PlaneGeometry(14,14),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=-.035;floor.receiveShadow=true;room.add(floor);
      const wallMat=new T.MeshStandardMaterial({color:0x090e17,roughness:.6,metalness:.12});
      const back=new T.Mesh(new T.PlaneGeometry(14,6),wallMat);back.position.set(0,3,-7);back.receiveShadow=true;room.add(back);
      const left=new T.Mesh(new T.PlaneGeometry(14,6),wallMat);left.position.set(-7,3,0);left.rotation.y=Math.PI/2;left.receiveShadow=true;room.add(left);
      const right=new T.Mesh(new T.PlaneGeometry(14,6),wallMat);right.position.set(7,3,0);right.rotation.y=-Math.PI/2;right.receiveShadow=true;room.add(right);
      const ceiling=new T.Mesh(new T.PlaneGeometry(14,14),new T.MeshBasicMaterial({color:0x060a10,side:T.DoubleSide}));ceiling.position.y=6;ceiling.rotation.x=Math.PI/2;room.add(ceiling);
      const grid=new T.GridHelper(14,28,0x1b5368,0x122c40);grid.position.y=-.02;room.add(grid);
      const neonMat=new T.MeshBasicMaterial({color:0x38bdf8});
      for(const z of [-5.8,-3.4,0,3.4]){const strip=new T.Mesh(new T.BoxGeometry(6,.035,.055),neonMat);strip.position.set(0,5.92,z);room.add(strip);}
      for(const x of [-6.92,6.92]){const strip=new T.Mesh(new T.BoxGeometry(.035,4.8,.055),neonMat);strip.position.set(x,3,-3.8);room.add(strip);}
      const shelfMat=new T.MeshStandardMaterial({color:0x111c2e,metalness:.5,roughness:.4});
      const shelf=new T.Mesh(new T.BoxGeometry(3.5,3.2,.6),shelfMat);shelf.position.set(2.8,1.6,-6.55);shelf.castShadow=true;shelf.receiveShadow=true;room.add(shelf);
      const shelfTrim=new T.MeshStandardMaterial({color:0x38bdf8,emissive:0x07384a,metalness:.4,roughness:.3});
      for(const y of [.45,1.35,2.25]){const plank=new T.Mesh(new T.BoxGeometry(3.35,.055,.72),shelfTrim);plank.position.set(2.8,y,-6.18);room.add(plank);}
      targetScene.add(room);return room;
    }
    buildLaboratoryRoom(scene);
    function mat(color,metalness=.15,roughness=.35,transparent=false,opacity=1){return new T.MeshStandardMaterial({color,metalness,roughness,transparent,opacity});}
    const steel=mat(0x263b4d,.45,.42),dark=mat(0x0f172a,.35,.4),glass=mat(0x74d9e7,.1,.12,true,.28),white=mat(0x9aadb8,.05,.48),blue=mat(0x1e8ea5,.35,.28),green=mat(0x3ee0a2,.2,.25),gold=mat(0xe6b66c,.3,.3);
    function box(name,w,h,d,x,y,z,material,selectable=false){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData={name,selectable};scene.add(m);if(selectable)state.objects[name]=m;return m;}
    function cylinder(name,rt,rb,h,x,y,z,material,selectable=false,segments=32){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,segments),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData={name,selectable};scene.add(m);if(selectable)state.objects[name]=m;return m;}
    // Central stainless laboratory bench
    box('bench',8,.28,3.3,0,1.05,0,steel);box('bench-front',8,.95,.16,0,.53,1.53,dark);for(const x of [-3.5,3.5])box('bench-leg',.22,1,.22,x,.5,0,steel);
    // Microplate with 96 visible wells
    box('plate',2.25,.18,1.55,-1.2,1.29,.5,white,true);
    for(let r=0;r<8;r++)for(let c=0;c<12;c++){const well=cylinder('well',.052,.052,.035,-2.13+c*.17,1.4,-.08+r*.165,mat((r+c)%3===0?0x2f9eae:0x236477,.1,.25),false,12);well.userData.parentName='plate';}
    // Pipette with handle, barrel and tip
    const pip=box('pipette',.2,.24,1.2,-1.2,2.0,.5,blue,true);pip.rotation.x=-.2;pip.rotation.z=-.12;
    cylinder('pipette-button',.13,.13,.18,-1.2,2.22,.5,gold);
    const tip=cylinder('pipette-tip',.015,.11,.6,-1.2,1.57,.5,mat(0xb8e8ed,.1,.2,true,.65),false,20);tip.rotation.z=Math.PI;
    const pcrGroup=new T.Group();pcrGroup.position.set(-1.0,1.19,.3);pcrGroup.userData={name:'pcr',selectable:true};scene.add(pcrGroup);state.objects.pcr=pcrGroup;
    const pcrParts=scene.children.filter(o=>o===state.objects.plate||o===state.objects.pipette||['pipette-button','pipette-tip','well'].includes(o.userData?.name)||o.userData?.parentName==='plate');
    pcrParts.forEach(o=>{scene.remove(o);o.position.x+=1.1;o.position.y-=1.19;o.position.z-=.4;pcrGroup.add(o);});
    state.objects.plate.userData.parentName='pcr';state.objects.pipette.userData.parentName='pcr';
    // Recognizable compound microscope: foot, upright arm, stage, tube and objectives.
    const microscope=new T.Group();microscope.position.set(1.0,1.27,.3);microscope.userData={name:'microscope',selectable:true};scene.add(microscope);state.objects.microscope=microscope;
    function part(parent,geometry,material,x,y,z,rz=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.rotation.z=rz;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
    part(microscope,new T.BoxGeometry(1.35,.16,.78),dark,0,0,0);
    part(microscope,new T.BoxGeometry(.18,.92,.22),steel,-.42,.52,-.12,-.12);
    part(microscope,new T.TorusGeometry(.48,.095,12,36,Math.PI*1.25),white,-.08,.93,-.12,-.28);
    part(microscope,new T.CylinderGeometry(.13,.16,.72,32),white,.22,1.18,-.12,-.48);
    part(microscope,new T.CylinderGeometry(.105,.12,.36,32),steel,.04,1.53,-.12,-.48);
    part(microscope,new T.CylinderGeometry(.12,.09,.36,32),gold,.42,.83,-.12,.22);
    part(microscope,new T.BoxGeometry(.95,.09,.62),blue,.12,.48,-.12);
    part(microscope,new T.BoxGeometry(.28,.07,.24),steel,.12,.57,.08);
    part(microscope,new T.CylinderGeometry(.16,.16,.09,32),gold,.12,.65,.08);
    part(microscope,new T.CylinderGeometry(.08,.08,.26,24),dark,.12,.8,.08);
    part(microscope,new T.CylinderGeometry(.11,.11,.28,24),steel,-.08,1.72,-.12,-.48);
    part(microscope,new T.CylinderGeometry(.14,.14,.08,24),dark,-.08,1.87,-.12,-.48);
    // Procedural stirred-tank bioreactor: transparent glass vessel, cyan culture medium and metal drive head.
    const reactorGroup=new T.Group();reactorGroup.position.set(0,1.18,0);reactorGroup.userData={name:'bioreactor',selectable:true};scene.add(reactorGroup);state.objects.bioreactor=reactorGroup;state.vessel=reactorGroup;
    const reactorGlass=new T.MeshStandardMaterial({color:0x9cecf4,metalness:.08,roughness:.12,transparent:true,opacity:.4,side:T.DoubleSide,depthWrite:false});
    const jacketGlass=new T.MeshStandardMaterial({color:0x3aa9bf,metalness:.22,roughness:.2,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false});
    // Double-wall cylindrical glass body with rounded lower vessel.
    const jacket=new T.Mesh(new T.CylinderGeometry(.69,.69,1.72,56,1,true),jacketGlass);jacket.position.y=.91;reactorGroup.add(jacket);
    const body=new T.Mesh(new T.CylinderGeometry(.58,.58,1.58,56,1,true),reactorGlass);body.position.y=.91;body.castShadow=true;reactorGroup.add(body);
    const bottomDome=new T.Mesh(new T.SphereGeometry(.58,40,20,0,Math.PI*2,Math.PI/2,Math.PI/2),reactorGlass);bottomDome.position.y=.58;reactorGroup.add(bottomDome);
    part(reactorGroup,new T.CylinderGeometry(.72,.72,.14,56),steel,0,.08,0);
    part(reactorGroup,new T.CylinderGeometry(.69,.69,.12,56),steel,0,1.79,0);
    // Clearly visible cyan liquid fill and surface meniscus.
    const liquidMat=new T.MeshStandardMaterial({color:0x00f0ff,emissive:0x003e4b,emissiveIntensity:.35,roughness:.2,metalness:.04,transparent:true,opacity:.72});
    const liquid=new T.Mesh(new T.CylinderGeometry(.515,.515,.62,48),liquidMat);liquid.position.y=.55;reactorGroup.add(liquid);
    const liquidSurface=new T.Mesh(new T.CircleGeometry(.515,48),new T.MeshStandardMaterial({color:0x39f4ff,emissive:0x087987,emissiveIntensity:.5,transparent:true,opacity:.7,side:T.DoubleSide}));liquidSurface.rotation.x=-Math.PI/2;liquidSurface.position.y=.865;reactorGroup.add(liquidSurface);
    // Stainless lid, motor housing, shaft and three-blade impeller.
    part(reactorGroup,new T.CylinderGeometry(.61,.61,.13,48),steel,0,1.88,0);
    part(reactorGroup,new T.CylinderGeometry(.24,.28,.3,32),dark,0,2.08,0);
    part(reactorGroup,new T.CylinderGeometry(.16,.19,.12,32),steel,0,2.29,0);
    part(reactorGroup,new T.CylinderGeometry(.045,.045,1.3,16),steel,0,1.1,0);
    for(let i=0;i<3;i++){const blade=part(reactorGroup,new T.BoxGeometry(.48,.045,.09),gold,0,.56,0);blade.rotation.y=i*Math.PI/3;}
    // Four internal baffles, sampling/air ports and a compact control display.
    for(let i=0;i<4;i++){const a=i*Math.PI/2;const baffle=part(reactorGroup,new T.BoxGeometry(.055,1.22,.12),steel,Math.sin(a)*.49,.92,Math.cos(a)*.49);baffle.rotation.y=a;}
    for(let x of [-.43,.43]){part(reactorGroup,new T.CylinderGeometry(.045,.045,.38,16),steel,x,2.04,0,x*.12);part(reactorGroup,new T.CylinderGeometry(.075,.075,.08,16),gold,x,2.25,0);}
    part(reactorGroup,new T.BoxGeometry(.38,.34,.1),dark,.55,1.28,.38);
    part(reactorGroup,new T.BoxGeometry(.27,.21,.025),green,.55,1.3,.44);
    for(let i=0;i<5;i++){const bubble=new T.Mesh(new T.SphereGeometry(.032,10,8),new T.MeshStandardMaterial({color:0xc6fbff,emissive:0x1b8795,transparent:true,opacity:.78}));bubble.position.set(Math.sin(i*2.1)*.25,.28+(i%3)*.17,Math.cos(i*1.7)*.25);reactorGroup.add(bubble);state.bubbles.push(bubble);}
    // Teaching cell cross-section: membrane, cytoplasm, nucleus and organelles.
    const cellGroup=new T.Group();cellGroup.position.set(1.5,1.715,-.4);cellGroup.scale.set(.5,.5,.5);cellGroup.userData={name:'cell',selectable:true};scene.add(cellGroup);state.objects.cell=cellGroup;
    const membrane=new T.Mesh(new T.SphereGeometry(1.05,40,32),mat(0x38bdf8,.18,.24,true,.22));membrane.scale.set(1.35,.9,.85);membrane.castShadow=true;cellGroup.add(membrane);
    const membraneEdge=new T.Mesh(new T.SphereGeometry(1.055,40,32),new T.MeshBasicMaterial({color:0x4dd9e8,wireframe:true,transparent:true,opacity:.22}));membraneEdge.scale.copy(membrane.scale);cellGroup.add(membraneEdge);
    const cytoplasm=new T.Mesh(new T.SphereGeometry(.82,32,24),mat(0x1c7f8a,.05,.5,true,.2));cytoplasm.scale.set(1.3,.82,.82);cellGroup.add(cytoplasm);
    const nucleus=new T.Mesh(new T.SphereGeometry(.43,32,24),mat(0x855fc1,.15,.3));nucleus.position.set(.12,.08,0);cellGroup.add(nucleus);
    const nucleolus=new T.Mesh(new T.SphereGeometry(.15,20,16),mat(0xe9bd70));nucleolus.position.set(.2,.12,.36);cellGroup.add(nucleolus);
    function makeMitochondrion(material){if(typeof T.CapsuleGeometry==='function')return new T.Mesh(new T.CapsuleGeometry(.075,.22,4,10),material);const g=new T.Group();const shaft=new T.Mesh(new T.CylinderGeometry(.075,.075,.22,12),material);g.add(shaft);for(const y of [-.11,.11]){const cap=new T.Mesh(new T.SphereGeometry(.075,12,10),material);cap.position.y=y;g.add(cap);}return g;}for(let i=0;i<7;i++){const mito=makeMitochondrion(mat(i%2?0x58c995:0xe5a96b));const a=i*2.4;mito.scale.set(1.4,.65,.75);mito.position.set(Math.cos(a)*.78,Math.sin(a)*.45,Math.sin(a*1.7)*.4);mito.rotation.z=a;cellGroup.add(mito);}
    // DNA double helix display stand
    const dnaGroup=new T.Group();dnaGroup.position.set(-1.6,1.19,-.4);dnaGroup.scale.set(.7,.7,.7);scene.add(dnaGroup);state.objects.dna=dnaGroup;dnaGroup.userData={name:'dna',selectable:true};
    for(let i=0;i<32;i++){const y=i*.105;const a=i*.42;for(const sign of [-1,1]){const bead=new T.Mesh(new T.SphereGeometry(.075,12,10),sign<0?blue:green);bead.position.set(Math.cos(a+Math.PI*(sign>0))*0.48,y,Math.sin(a+Math.PI*(sign>0))*.48);dnaGroup.add(bead);}const rung=new T.Mesh(new T.CylinderGeometry(.025,.025,.72,8),gold);rung.position.y=y;rung.rotation.z=Math.PI/2;dnaGroup.add(rung);}
    const dnaStand=cylinder('dna-stand',.42,.42,.12,-1.3,1.26,0,steel);scene.remove(dnaStand);dnaStand.position.set(0,.07,0);dnaGroup.add(dnaStand);
    // Overhead light panels
    for(let x of [-3,0,3]){const light=box('ceiling-light',1.8,.05,.55,x,6.1,-2.7,mat(0x9beeff,.1,.2));const glow=new T.PointLight(0x70dce8,.65,6);glow.position.set(x,5.7,-2.5);scene.add(glow);}
    // Equipment placement: bench top is Y=1.19 (bench center 1.05 + half-height 0.14).
    // Keep each instrument in a dedicated footprint; Y=0.52 would place it inside the bench geometry.
    const Y_SURFACE=1.19;
    dnaGroup.position.set(-1.8,Y_SURFACE+0.40,-0.4);dnaGroup.scale.setScalar(0.55);
    pcrGroup.position.set(-0.95,Y_SURFACE+0.01,0.35);pcrGroup.scale.setScalar(0.75);
    reactorGroup.position.set(0.0,Y_SURFACE+0.01,-0.2);reactorGroup.scale.setScalar(0.55);
    microscope.position.set(0.95,Y_SURFACE+0.01,0.35);microscope.scale.setScalar(0.65);
    cellGroup.position.set(1.6,Y_SURFACE+0.25,-0.4);cellGroup.scale.setScalar(0.45);
    // Equipment labels as canvas sprites
    function label(text,parent,x,y,z,module){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='rgba(15,23,42,.92)';ctx.strokeStyle='#38bdf8';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(3,3,506,90,14);ctx.fill();ctx.stroke();ctx.font='700 28px Arial';ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.letterSpacing='0.5px';ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=8;ctx.shadowOffsetY=2;ctx.fillText(text,256,59);const tex=new T.CanvasTexture(c);const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:false}));sprite.scale.set(1.65,.31,1);const topByModule={pcr:1.12,microscope:1.91,bioreactor:2.36,cell:.945,crispr:3.35};const scaleY=parent.scale?.y||1;const localTop=topByModule[module]??.5;sprite.position.set(x,localTop+.75/scaleY,z);sprite.userData.label=true;sprite.userData.module=module||'';parent.add(sprite);state.labels.push(sprite);return sprite;}
    label('PCR MICROPLATE',pcrGroup,0,.5,0,'pcr');label('MICROSCOPE',microscope,0,.5,0,'microscope');label('BIOREACTOR',reactorGroup,0,.5,0,'bioreactor');label('CELL CULTURE',cellGroup,0,.5,0,'cell');label('DNA MODEL',dnaGroup,0,.5,0,'crispr');
    state.scene=scene;state.camera=camera;state.renderer=renderer;state.raycaster=new T.Raycaster();state.pointer=new T.Vector2();state.controls=controls;state.cellGroup=cellGroup;state.pcrGroup=pcrGroup;state.vessel=reactorGroup;state.dnaGroup=dnaGroup;
    $('sceneLoading').style.display='none';
    renderer.domElement.addEventListener('pointerdown',onPointerDown);
    renderer.domElement.addEventListener('pointermove',onPointerMove);
    renderer.domElement.addEventListener('pointerup',onPointerUp);renderer.domElement.addEventListener('pointercancel',onPointerCancel);
    host.addEventListener('wheel',onWheel,{passive:false});
    renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
    window.addEventListener('resize',resizeScene);
    animate();
    function animate(){if(!state.renderer)return;requestAnimationFrame(animate);cellGroup.rotation.y+=.002;dnaGroup.rotation.y+=.0025;state.vessel.rotation.y+=.001;state.bubbles.forEach((b,i)=>{b.position.y+=.004+(i%2)*.001;if(b.position.y>2.25)b.position.y=1.68;});updateCamera();renderer.render(scene,camera);}
    function updateCamera(){const c=state.controls;c.radius=Math.max(c.minDistance,Math.min(c.maxDistance,c.radius));c.phi=Math.max(c.minPolarAngle,Math.min(c.maxPolarAngle,c.phi));camera.position.set(c.target.x+c.radius*Math.sin(c.phi)*Math.sin(c.theta),c.target.y+c.radius*Math.cos(c.phi),c.target.z+c.radius*Math.sin(c.phi)*Math.cos(c.theta));camera.lookAt(c.target);}
  }
   function pointerDistance(points){const p=[...points.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
   function onPointerMove(e){const c=state.controls;if(!c)return;if(c.pointers.has(e.pointerId)){c.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(c.pointers.size>=2){const next=pointerDistance(c.pointers);if(c.pinchDistance>0&&next>0)c.radius=Math.max(c.minDistance,Math.min(c.maxDistance,c.radius*c.pinchDistance/next));c.pinchDistance=next;return;}}if(!c.drag||c.pointers.size!==1)return;const dx=e.clientX-c.x,dy=e.clientY-c.y;c.x=e.clientX;c.y=e.clientY;c.theta-=dx*.006*c.rotateSpeed;c.phi=Math.max(c.minPolarAngle,Math.min(c.maxPolarAngle,c.phi+dy*.005*c.rotateSpeed));}
   function onWheel(e){e.preventDefault();const c=state.controls;if(!c)return;const factor=Math.exp(Math.max(-1,Math.min(1,e.deltaY*.001))*c.zoomSpeed*.18);c.radius=Math.max(c.minDistance,Math.min(c.maxDistance,c.radius*factor));}
   function zoomLab(factor){const c=state.controls;if(!c)return;c.radius=Math.max(c.minDistance,Math.min(c.maxDistance,c.radius*factor));}
  function resizeScene(){const h=$('lab3d');if(!state.renderer||!h)return;const w=window.innerWidth||h.clientWidth,ht=window.innerHeight||h.clientHeight;state.camera.aspect=w/Math.max(1,ht);state.camera.updateProjectionMatrix();state.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));state.renderer.setSize(w,ht,false);}
  function syncActiveLabel(mode=state.mode){const selectedMode=({plate:'pcr',pipette:'pcr',pcr:'pcr',microscope:'microscope',bioreactor:'bioreactor',cell:'cell',dna:'crispr'})[state.selected];state.labels.forEach(l=>{const active=!!state.selected&&l.userData.module===selectedMode&&selectedMode===mode;l.material.opacity=active?1:0;l.visible=state.showLabels&&active;});}
  function focusObject(name){const obj=state.objects[name];if(!obj)return;state.selected=name;const activeMode=['pcr','plate','pipette'].includes(name)?'pcr':name==='cell'?'cell':name==='bioreactor'?'bioreactor':name==='microscope'?'microscope':name==='dna'?'crispr':state.mode;syncActiveLabel(activeMode);$('selectedObject').textContent='Tanlangan: '+({microscope:'mikroskop',pipette:'pipetka',plate:'mikroplastinka',bioreactor:'bioreaktor',cell:'hujayra modeli',dna:'DNK modeli'}[name]||name);$('sceneHint').textContent='Tanlangan obyekt: '+name;const c=state.controls;if(name==='cell'){c.target.set(1.15,1.9,-.2);c.radius=3.8;}else if(name==='dna'){c.target.set(-1.3,2.15,0);c.radius=4.1;}else if(name==='bioreactor'){c.target.set(0,2.05,-.25);c.radius=4.0;}else if(name==='microscope'){c.target.set(.75,2.05,.25);c.radius=3.9;}else if(name==='pipette'||name==='plate'||name==='pcr'){c.target.set(-.75,1.65,.25);c.radius=3.8;} }
  function onPointerUpClick(e){if(!state.renderer||!state.raycaster)return;const rect=state.renderer.domElement.getBoundingClientRect();state.pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);state.raycaster.setFromCamera(state.pointer,state.camera);const hits=state.raycaster.intersectObjects(state.scene.children,true);for(const hit of hits){let o=hit.object;while(o&& !o.userData?.selectable && !o.userData?.parentName)o=o.parent;if(o?.userData?.parentName){focusObject(o.userData.parentName);return;}if(o?.userData?.selectable){focusObject(o.userData.name);return;}}}
  // Pointer selection is separated from camera drag so touch rotation remains natural.
   let downPoint=null;function onPointerDown(e){const c=state.controls;c.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(c.pointers.size===1){c.drag=true;c.x=e.clientX;c.y=e.clientY;downPoint={x:e.clientX,y:e.clientY,id:e.pointerId};}else{c.drag=false;downPoint=null;c.pinchDistance=pointerDistance(c.pointers);}state.renderer.domElement.setPointerCapture?.(e.pointerId);}
   function onPointerUp(e){const c=state.controls,moved=downPoint&&downPoint.id===e.pointerId&&Math.hypot(e.clientX-downPoint.x,e.clientY-downPoint.y)<7&&c.pointers.size===1;c.pointers.delete(e.pointerId);c.pinchDistance=c.pointers.size>=2?pointerDistance(c.pointers):0;c.drag=c.pointers.size===1;if(c.drag){const p=[...c.pointers.values()][0];c.x=p.x;c.y=p.y;}if(moved&&e.button!==2)onPointerUpClick(e);downPoint=null;}
   function onPointerCancel(e){const c=state.controls;c.pointers.delete(e.pointerId);c.pinchDistance=c.pointers.size>=2?pointerDistance(c.pointers):0;c.drag=c.pointers.size===1;downPoint=null;}

  function renderControls(){
    const c=$('controls');
    if(state.mode==='pcr')c.innerHTML='<label class="field-label" for="sequenceInput">DNK ketma-ketligi (5′ → 3′)</label><textarea id="sequenceInput" rows="4" spellcheck="false">'+DNA_DEFAULT+'</textarea><div class="field-row"><label>Sikl soni<input id="pcrCycles" type="number" min="1" max="40" value="30"></label><label>Denaturatsiya °C<input type="number" value="95" disabled></label></div><div class="control-hint">Faqat A, T, G, C harflari. Hisob nazariy modelga asoslanadi.</div>';
    if(state.mode==='cell')c.innerHTML='<div class="field-row"><label>pH<input id="cellPh" type="number" min="4" max="10" step=".1" value="7.2"></label><label>Harorat °C<input id="cellTemp" type="number" min="20" max="42" step=".1" value="37"></label></div><div class="field-row"><label>Inkubatsiya (kun)<input id="cellDays" type="number" min="1" max="14" value="3"></label><label>Ozuqa muhiti<select id="cellMedium"><option value="standard">Standart o‘quv muhiti</option><option value="serum">Serumli muhit (model)</option><option value="serumfree">Serumsiz muhit (model)</option></select></label></div><div class="control-hint">Parametrlar o‘quv modeliga tegishli, real hujayra protokoli emas.</div>';
    if(state.mode==='bioreactor')c.innerHTML='<div class="field-row"><label>pH<input id="reactorPh" type="number" min="4" max="9" step=".1" value="6.8"></label><label>Harorat °C<input id="reactorTemp" type="number" min="15" max="45" value="30"></label></div><div class="field-row"><label>Erigan O₂ (%)<input id="reactorDo" type="number" min="0" max="100" value="45"></label><label>Oziqa berish (%)<input id="reactorFeed" type="number" min="0" max="100" value="35"></label></div><div class="control-hint">Jarayon indeksi shartli; ishlab chiqarish parametrlarini belgilash uchun ishlatmang.</div>';
    if(state.mode==='microscope')c.innerHTML='<div class="field-row"><label>Obyektiv<select id="objectivePower"><option value="4">4× · umumiy ko‘rish</option><option value="10">10× · past kattalashtirish</option><option value="40" selected>40× · yuqori kattalashtirish</option><option value="100">100× · immersion obyektiv</option></select></label><label>Okulyar<input id="ocularPower" type="number" value="10" min="5" max="20" disabled></label></div><div class="field-row"><label>Preparat<select id="specimenType"><option value="plant">O‘simlik hujayrasi · ~100 µm</option><option value="animal" selected>Hayvon hujayrasi · ~20 µm</option><option value="bacteria">Bakteriya · ~2 µm</option><option value="rbc">Eritrotsit · ~7.5 µm</option></select></label><label>Field number (mm)<input id="fieldNumber" type="number" value="18" min="10" max="25" step=".5"></label></div><div class="control-hint">100× immersion faqat obyektiv turi haqida o‘quv misoli; laboratoriya amaliyoti bo‘yicha ko‘rsatma emas.</div>';
    if(state.mode==='crispr')c.innerHTML='<label class="field-label" for="sequenceInput">Namunaviy DNK (5′ → 3′)</label><textarea id="sequenceInput" rows="4" spellcheck="false">ATGCGTACGTAGCTAGCTAGGCTAACGTTAGCGATCGTACGATCG</textarea><label class="field-label" for="crisprTarget">Qidiriladigan 20 nt motiv</label><input id="crisprTarget" value="GCTAACGTTAGCGATCGTAC" maxlength="20"><div class="control-hint">Faqat matnli motiv qidiruvi. PAM, off-target yoki real editing hisoblanmaydi.</div>';
  }
  function showMode(mode){if(!experiments[mode])return;state.mode=mode;syncActiveLabel(mode);document.querySelectorAll('.module-choice').forEach(b=>b.classList.toggle('active',b.dataset.experiment===mode));const e=experiments[mode];$('experimentTitle').textContent=e.title;$('experimentDescription').textContent=e.description;$('protocolTitle').textContent=e.protocol;$('protocolSteps').innerHTML=e.steps.map(x=>'<li>'+x+'</li>').join('');$('scientistNote').textContent=e.note;$('experimentState').textContent='TAYYOR';$('resultPanel').innerHTML='<div class="result-empty"><span>◎</span><b>Natija kutilmoqda</b><small>Parametrlarni tekshirib, tajribani ishga tushiring.</small></div>';renderControls();syncActiveLabel(mode);}
  function animateExperiment(mode){
    return new Promise(resolve=>{
      const started=performance.now(),duration=1250;
      const pipette=state.objects.pipette,plate=state.objects.plate,cell=state.cellGroup,reactor=state.objects.bioreactor,dna=state.dnaGroup;
      const originalY=pipette?.position.y,originalScale=cell?.scale.clone(),originalEmissive=plate?.material?.emissive?.getHex?.()||0;
      $('sceneHint').textContent=experiments[mode].title+' · 3D jarayon animatsiyasi';
      function frame(now){
        const t=Math.min(1,(now-started)/duration),pulse=Math.sin(Math.PI*t);
        if(mode==='pcr'&&pipette&&plate){pipette.position.y=originalY-pulse*.34;plate.material.emissive?.setHex?.(0x0c5260);plate.material.emissiveIntensity=pulse*.65;}
        if(mode==='cell'&&cell){const scale=1+pulse*.075;cell.scale.set(scale,scale,scale);}
        if(mode==='bioreactor'&&reactor){reactor.rotation.y+=.035;state.bubbles.forEach((b,i)=>{b.scale.setScalar(1+pulse*.4);});}
        if(mode==='crispr'&&dna){dna.rotation.y+=.018;dna.scale.set(1+pulse*.045,1,1+pulse*.045);}
        if(mode==='microscope'&&state.objects.microscope){state.objects.microscope.rotation.z=-.35-pulse*.06;}
        if(t<1)requestAnimationFrame(frame);
        else{
          if(pipette)pipette.position.y=originalY;
          if(plate){plate.material.emissive?.setHex?.(originalEmissive);plate.material.emissiveIntensity=0;}
          if(cell&&originalScale)cell.scale.copy(originalScale);
          if(dna)dna.scale.set(1,1,1);
          if(state.objects.microscope)state.objects.microscope.rotation.z=-.35;
          state.bubbles.forEach(b=>b.scale.setScalar(1));
          $('sceneHint').textContent='Jarayon animatsiyasi yakunlandi · obyektni tanlash uchun ustiga bosing';
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  function escapeHtml(value){return String(value).replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));}
  function metric(value,label){return '<div class="metric"><b>'+value+'</b><span>'+label+'</span></div>';}
  function dnaSequence(){return String($('sequenceInput')?.value||'').toUpperCase().replace(/\s+/g,'');}
  function validateDna(seq){return /^[ATGC]+$/.test(seq)&&seq.length>=10&&seq.length<=5000;}
  function calculate(){
    if(state.mode==='pcr'){
      const seq=dnaSequence(),cycles=Number($('pcrCycles').value);if(!validateDna(seq))throw new Error('DNK ketma-ketligi 10–5000 ta A/T/G/C nukleotiddan iborat bo‘lishi kerak.');if(!Number.isInteger(cycles)||cycles<1||cycles>40)throw new Error('PCR sikli 1 dan 40 gacha butun son bo‘lishi kerak.');
      const gc=(seq.match(/[GC]/g)||[]).length,percent=gc/seq.length*100,copies=2**cycles;
      return {title:'PCR nazariy hisoboti',metrics:[metric(seq.length+' bp','KETMA-KETLIK UZUNLIGI'),metric(percent.toFixed(1)+'%','GC TARKIBI'),metric(cycles,'PCR SIKLLARI'),metric(copies.toLocaleString('en-US'),'NAZARIY NUSXALAR')],note:'Hisob: boshlang‘ich 1 nusxa va har siklda 100% ikki baravar ko‘payish farazi (2ⁿ). Haqiqiy PCR samaradorligi odatda bundan farq qiladi.',sequence:seq,parameters:{sequence_length:seq.length,cycles,denaturation_temperature_c:95}};
    }
    if(state.mode==='cell'){
      const ph=Number($('cellPh').value),temp=Number($('cellTemp').value),days=Number($('cellDays').value),medium=$('cellMedium').value;if(![ph,temp,days].every(Number.isFinite)||ph<4||ph>10||temp<20||temp>42||!Number.isInteger(days)||days<1||days>14)throw new Error('pH, harorat yoki inkubatsiya qiymati ruxsat etilgan oraliqdan tashqarida.');
      const phScore=Math.max(0,1-Math.abs(ph-7.2)/2),tempScore=Math.max(0,1-Math.abs(temp-37)/12),mediumScore=medium==='serum'?.95:medium==='standard'?.88:.72;const index=Math.round(100*phScore*tempScore*mediumScore);
      return {title:'Hujayra kulturasi — o‘quv modeli',metrics:[metric(index+'/100','SHARTLI MUHIT MOSLIGI'),metric(ph.toFixed(1),'pH'),metric(temp+' °C','HARORAT'),metric(days+' kun','INKUBATSIYA')],note:'Bu indeks faqat kiritilgan uchta parametrdan hisoblangan didaktik ko‘rsatkich. Hujayra viability yoki o‘sish tezligi o‘lchanmadi.',parameters:{ph,temp,incubation_days:days,medium}};
    }
    if(state.mode==='bioreactor'){
      const ph=Number($('reactorPh').value),temp=Number($('reactorTemp').value),doPct=Number($('reactorDo').value),feed=Number($('reactorFeed').value);if(![ph,temp,doPct,feed].every(Number.isFinite)||ph<4||ph>9||temp<15||temp>45||doPct<0||doPct>100||feed<0||feed>100)throw new Error('Bioreaktor parametrlari ruxsat etilgan oraliqdan tashqarida.');
      const p=Math.max(0,1-Math.abs(ph-6.8)/2.2),t=Math.max(0,1-Math.abs(temp-30)/15),o=Math.max(0,1-Math.abs(doPct-45)/55),f=Math.max(0,1-Math.abs(feed-35)/65),index=Math.round(100*(p*.3+t*.25+o*.25+f*.2));
      return {title:'Bioreaktor — shartli jarayon tahlili',metrics:[metric(index+'/100','SHARTLI JARAYON INDEKSI'),metric(ph.toFixed(1),'pH'),metric(temp+' °C','HARORAT'),metric(doPct+'%','ERIGAN O₂')],note:'Bu soddalashtirilgan o‘quv indeksi. Mikroorganizm turi, kLa, aeratsiya, aralashtirish, substrat va mahsulot titri modellashtirilmagan.',parameters:{ph,temp,dissolved_oxygen_percent:doPct,feed_percent:feed}};
    }
    if(state.mode==='microscope'){
      const objective=Number($('objectivePower').value),ocular=Number($('ocularPower').value),fieldNumber=Number($('fieldNumber').value),specimen=$('specimenType').value;
      const specimenSizes={plant:100,animal:20,bacteria:2,rbc:7.5},specimenNames={plant:'O‘simlik hujayrasi',animal:'Hayvon hujayrasi',bacteria:'Bakteriya',rbc:'Eritrotsit'};
      if(![4,10,40,100].includes(objective)||!Number.isFinite(fieldNumber)||fieldNumber<10||fieldNumber>25)throw new Error('Obyektiv yoki field number qiymati ruxsat etilgan oraliqda emas.');
      const total=objective*ocular,fovUm=fieldNumber/objective*1000,size=specimenSizes[specimen],across=fovUm/size;
      return {title:'Virtual mikroskopiya — optik hisob',metrics:[metric(total.toLocaleString('en-US')+'×','UMUMIY KATTALASHTIRISH'),metric(fovUm.toFixed(1)+' µm','KO‘RISH MAYDONI DIAMETRI'),metric(size+' µm','TANLANGAN PREPARAT O‘LCHAMI'),metric(across.toFixed(1),'MAYDONGA SIG‘ISHI (NAZARIY)')],note:'FOV = field number / obyektiv kattalashtirishi. Maydonga sig‘ish ko‘rsatkichi ideal diametr bo‘yicha geometrik baho; preparat yo‘nalishi, optik sifat va real tasvir hisobga olinmagan.',parameters:{objective_magnification:objective,ocular_magnification:ocular,total_magnification:total,field_number_mm:fieldNumber,field_of_view_um:Number(fovUm.toFixed(2)),specimen:specimenNames[specimen],assumed_specimen_size_um:size,estimated_specimens_across:Number(across.toFixed(2))}};
    }
    const seq=dnaSequence(),target=String($('crisprTarget').value||'').toUpperCase().replace(/\s+/g,'');if(!validateDna(seq))throw new Error('Namunaviy DNK 10–5000 ta A/T/G/C nukleotiddan iborat bo‘lishi kerak.');if(!/^[ATGC]{10,20}$/.test(target))throw new Error('Motiv 10–20 ta A/T/G/C nukleotiddan iborat bo‘lishi kerak.');const pos=seq.indexOf(target);
    return {title:'CRISPR-Cas9 — konseptual qidiruv',metrics:[metric(pos>=0?'TOPILDI':'TOPILMADI','MOTIV MOSLIGI'),metric(pos>=0?(pos+1)+' bp':'—','BOSHLANISH POZITSIYASI'),metric(target.length+' nt','MOTIV UZUNLIGI'),metric('0','GENOM TAHRIRI')],note:pos>=0?'Kiritilgan motiv namuna ichida topildi. Bu guide RNA samaradorligi yoki Cas9 kesish faolligini tasdiqlamaydi.':'Kiritilgan motiv ushbu namuna ichida topilmadi. Bu genom bo‘yicha to‘liq qidiruv emas.',sequence:seq,parameters:{target_motif:target,match_position_1based:pos>=0?pos+1:null,genome_editing_performed:false}};
  }
  async function persistExperiment(result){
    const token=sessionStorage.getItem('medgen_access_token');
    if(!token){setSyncStatus('Kirish talab qilinadi','warning');return {saved:false,reason:'MedGen hisobiga kirmagansiz. Natija faqat ushbu brauzer sessiyasida ko‘rsatiladi.'};}
    let sequenceAnalysis=null;
    if(result.sequence){
      try{
        const analysisResponse=await fetch(API_BASE+'/bioinformatics/analyze',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({sequence:result.sequence,sequence_type:'DNA'})});
        if(analysisResponse.ok)sequenceAnalysis=await analysisResponse.json();
        else sequenceAnalysis={status:'not_available',http_status:analysisResponse.status};
      }catch(_){sequenceAnalysis={status:'not_available',reason:'Sequence analysis endpoint unavailable'};}
    }
    const payload={
      name:'Biotechnology Lab — '+experiments[state.mode].title,
      workflow_type:'biotechnology_'+state.mode,
      target:'Biotechnology / '+state.mode,
      input:{sequence:result.sequence||null,...(result.parameters||{})},
      parameters:{simulation_mode:state.mode,educational_simulation:true,model_version:'0.1'},
      results:{status:'completed',educational_only:true,metrics:result.metrics.map(m=>m.replace(/<[^>]*>/g,'')),interpretation:result.note,scientific_limitations:experiments[state.mode].note,sequence_analysis:sequenceAnalysis}
    };
    setSyncStatus('Saqlanmoqda…','pending');const response=await fetch(API_BASE+'/experiments',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload)});
    if(!response.ok){const message=await response.text();setSyncStatus('Saqlanmadi','warning');throw new Error('Serverga saqlash amalga oshmadi (HTTP '+response.status+'): '+message.slice(0,220));}
    const data=await response.json();setSyncStatus('✓ Saqlandi','success');return {saved:true,id:data.id||'saqlandi',sequenceAnalysis};
  }
  async function runExperiment(){
    if(state.running)return;state.running=true;const button=$('runExperiment');button.disabled=true;button.textContent='⏳ HISOBLANMOQDA…';$('experimentState').textContent='ISHLAMOQDA';$('labStatus').textContent='RUNNING';
    try{
      const result=calculate();await animateExperiment(state.mode);$('resultPanel').innerHTML='<div class="result-empty"><span>◌</span><b>Hisoblash yakunlandi</b><small>Natija tayyorlanmoqda…</small></div>';
      let saved={saved:false};try{saved=await persistExperiment(result);}catch(err){setSyncStatus('Saqlanmadi','warning');saved={saved:false,reason:err.message};}
      const cards=result.metrics.join('');$('resultPanel').innerHTML='<h3 style="font-size:11px;margin:0 0 9px">'+result.title+'</h3><div class="metric-grid">'+cards+'</div><p class="result-note">'+result.note+'</p><p class="result-note"><strong>'+(saved.saved?'✓ MedGen hisobiga saqlandi':'! Server sinxronlashuvi bajarilmadi')+'</strong> · '+(saved.saved?'ID: '+escapeHtml(saved.id):escapeHtml(saved.reason||'Natija lokal ko‘rinishda.'))+'</p>';
      state.runs++;$('runCount').textContent=state.runs;$('experimentState').textContent='YAKUNLANDI';$('labStatus').textContent='COMPLETED';addHistory(result.title,saved.saved?'Serverga saqlandi':'Lokal natija');if(state.mode==='pcr'||state.mode==='crispr')focusObject('dna');else if(state.mode==='cell')focusObject('cell');else focusObject('bioreactor');
    }catch(err){$('resultPanel').innerHTML='<p class="result-note"><strong>Tekshiruv xatosi:</strong> '+escapeHtml(err.message)+'</p>';$('experimentState').textContent='XATO';$('labStatus').textContent='CHECK INPUT';}
    finally{state.running=false;button.disabled=false;button.textContent='▶ TAJRIBANI ISHGA TUSHIRISH';}
  }
  function setSyncStatus(label,status){const el=$('syncStatus');if(!el)return;el.textContent=label;el.dataset.status=status||'idle';}
  function addHistory(title,status){const host=$('historyList'),item=document.createElement('div');item.className='history-item';const b=document.createElement('b');b.textContent=title;const small=document.createElement('small');small.textContent=new Date().toLocaleString()+' · '+status;item.append(b,small);host.prepend(item);while(host.children.length>5)host.lastElementChild.remove();}
  function init(){
    document.querySelectorAll('.module-choice').forEach(b=>b.addEventListener('click',()=>showMode(b.dataset.experiment)));
    document.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>focusObject(b.dataset.focus)));
    $('runExperiment').addEventListener('click',runExperiment);
    $('resetExperiment').addEventListener('click',()=>{showMode(state.mode);setSyncStatus('Kutilmoqda','idle');$('labStatus').textContent='READY';});
    $('resetView').addEventListener('click',()=>{if(!state.controls)return;state.controls.target.set(0,.65,0);state.controls.theta=0;state.controls.radius=4.18;state.controls.phi=Math.max(state.controls.minPolarAngle,Math.min(state.controls.maxPolarAngle,Math.acos(1.75/4.18)));});
     $('zoomIn').addEventListener('click',()=>zoomLab(.8));$('zoomOut').addEventListener('click',()=>zoomLab(1.25));
    $('toggleLabels').addEventListener('click',()=>{state.showLabels=!state.showLabels;syncActiveLabel(state.mode);});
    $('zenMode').addEventListener('click',()=>{const active=document.body.classList.toggle('zen-mode');$('zenMode').textContent=active?'✕ Oddiy ko‘rinish':'👁 To‘liq ko‘rish (UI yashirish)';$('zenMode').setAttribute('aria-pressed',String(active));});
    try{buildScene();}catch(error){console.error('Biotechnology 3D scene failed:',error);const detail=String(error?.message||error||'Noma’lum xato');$('sceneLoading').style.display='grid';$('sceneLoading').innerHTML='<b>3D sahna ishga tushmadi</b><small>'+escapeHtml(detail)+' · WebGL/GPU va Three.js mosligini tekshiring.</small>'; }showMode('pcr');
  }
  document.addEventListener('DOMContentLoaded',init);
})();