(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { mode:'pcr', scene:null, camera:null, renderer:null, raycaster:null, pointer:null, objects:{}, labels:[], selected:null, running:false, runs:0, showLabels:true, history:[] };
  const API_BASE = window.MEDGEN_API_BASE || 'https://medgenai-web-1.onrender.com/api/v1';
  const DNA_DEFAULT = 'ATGCGTACGTAGCTAGCTAGGCTAACGTTAGCGATCGTACGATCG';

  const experiments = {
    pcr:{title:'PCR & Genomika',description:'DNK ketma-ketligini tekshiring, GC tarkibini hisoblang va PCR sikllarining nazariy ko‘payish modelini ko‘ring.',protocol:'PCR ish jarayoni',steps:['DNK ketma-ketligini tekshirish','GC tarkibi va uzunligini hisoblash','Sikl bo‘yicha nazariy amplifikatsiyani baholash','Hisoblangan natijani MedGen hisobiga saqlash'],note:'PCR nazariy nusxa soni real amplifikatsiya samaradorligiga teng emas. Primerlar, ferment, reagentlar va sikl sharoitlari natijaga ta’sir qiladi.'},
    cell:{title:'Hujayra kulturasi',description:'O‘quv modelida muhit pH, harorat va inkubatsiya vaqtining hujayra kulturasi holatiga ta’sirini kuzating.',protocol:'Hujayra kulturasi protokoli',steps:['Ozuqa muhitini tanlash','pH va harorat parametrlarini belgilash','Inkubatsiya vaqtini tanlash','Soddalashtirilgan model natijasini tahlil qilish'],note:'Viability ko‘rsatkichi ushbu o‘quv simulyatorining shartli formulasi; real hujayra hayotchanligi o‘lchovi yoki laboratoriya protokoli emas.'},
    bioreactor:{title:'Bioreaktor',description:'Fermentatsiya uchun pH, harorat va erigan kislorod parametrlarini o‘zgartirib, soddalashtirilgan jarayon indeksini hisoblang.',protocol:'Bioreaktor jarayoni',steps:['Bioreaktor ish rejimini tanlash','pH, harorat va DO qiymatlarini kiritish','Oziqa berish tezligini sozlash','Shartli jarayon indeksini hisoblash'],note:'Hosildorlik indeksi o‘quv uchun tuzilgan soddalashtirilgan ko‘rsatkich. U real shtamm, muhit yoki ishlab chiqarish natijasini bashorat qilmaydi.'},
    crispr:{title:'CRISPR-Cas9',description:'Guide RNA va nishon ketma-ketligi o‘rtasidagi moslikni o‘quv darajasida tekshiring. Bu real genomni tahrirlamaydi.',protocol:'CRISPR-Cas9 konseptual workflow',steps:['Namunaviy DNK ketma-ketligini kiritish','Nishon motivni qidirish','Guide/nishon mosligini ko‘rsatish','Tahrirlash cheklovlarini ko‘rib chiqish'],note:'Bu faqat konseptual moslik namoyishi. PAM, off-target, xromatin konteksti va laboratoriya validatsiyasi hisoblanmaydi; biologik tahrir bajarilmaydi.'}
  };

  function buildScene(){
    const host=$('lab3d');
    if(!window.THREE){$('sceneLoading').innerHTML='<b>3D kutubxona yuklanmadi</b><small>Internet ulanishini tekshirib sahifani yangilang.</small>';return;}
    const T=window.THREE, scene=new T.Scene(); scene.background=new T.Color(0x081724); scene.fog=new T.Fog(0x081724,12,25);
    const camera=new T.PerspectiveCamera(42,host.clientWidth/host.clientHeight,.1,100);camera.position.set(8,6.5,10);
    const renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(host.clientWidth,host.clientHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;if('outputColorSpace' in renderer && T.SRGBColorSpace)renderer.outputColorSpace=T.SRGBColorSpace;else if('outputEncoding' in renderer && T.sRGBEncoding)renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.prepend(renderer.domElement);
    const controls={target:new T.Vector3(0,1.3,0),drag:false,x:0,y:0,theta:Math.atan2(8,10),phi:1.02,radius:14};
    const ambient=new T.HemisphereLight(0xb9e9ff,0x162434,2.1);scene.add(ambient);
    const key=new T.DirectionalLight(0xffffff,3.1);key.position.set(5,10,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
    const cyan=new T.PointLight(0x3ed9e8,22,12);cyan.position.set(-4,4,1);scene.add(cyan);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:0x0b1b29,roughness:.82,metalness:.15}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
    const grid=new T.GridHelper(24,24,0x1a4558,0x153244);grid.position.y=.005;scene.add(grid);
    const wallMat=new T.MeshStandardMaterial({color:0x102b3c,roughness:.8,metalness:.1});
    const back=new T.Mesh(new T.BoxGeometry(18,7,.18),wallMat);back.position.set(0,3.4,-5);scene.add(back);
    const panelMat=new T.MeshStandardMaterial({color:0x174054,emissive:0x06212b,roughness:.5});
    for(let x=-6;x<=6;x+=3){const p=new T.Mesh(new T.BoxGeometry(2.7,2.2,.08),panelMat);p.position.set(x,4.3,-4.88);scene.add(p);}
    function mat(color,metalness=.15,roughness=.35,transparent=false,opacity=1){return new T.MeshStandardMaterial({color,metalness,roughness,transparent,opacity});}
    const steel=mat(0x8098a7,.72,.28),dark=mat(0x152b3a,.55,.32),glass=mat(0x74d9e7,.1,.12,true,.28),white=mat(0xd7e8ec,.1,.32),blue=mat(0x1e8ea5,.35,.28),green=mat(0x3ee0a2,.2,.25),gold=mat(0xe6b66c,.3,.3);
    function box(name,w,h,d,x,y,z,material,selectable=false){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData={name,selectable};scene.add(m);if(selectable)state.objects[name]=m;return m;}
    function cylinder(name,rt,rb,h,x,y,z,material,selectable=false,segments=32){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,segments),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData={name,selectable};scene.add(m);if(selectable)state.objects[name]=m;return m;}
    // Central stainless laboratory bench
    box('bench',8,.28,3.3,0,1.05,0,steel);box('bench-front',8,.95,.16,0,.53,1.53,dark);for(const x of [-3.5,3.5])box('bench-leg',.22,1,.22,x,.5,0,steel);
    // Microplate with 96 visible wells
    box('plate',2.25,.18,1.55,-2.15,1.29,-.25,white,true);
    for(let r=0;r<8;r++)for(let c=0;c<12;c++){const well=cylinder('well',.052,.052,.035,-3.08+c*.17,1.4,-.83+r*.165,mat((r+c)%3===0?0x2f9eae:0x236477,.1,.25),false,12);well.userData.parentName='plate';}
    // Pipette with handle, barrel and tip
    const pip=box('pipette',.2,.24,1.2,.15,2.0,-.2,blue,true);pip.rotation.x=-.2;pip.rotation.z=-.12;
    cylinder('pipette-button',.13,.13,.18,.15,2.22,-.2,gold);
    const tip=cylinder('pipette-tip',.015,.11,.6,.15,1.57,-.2,mat(0xb8e8ed,.1,.2,true,.65),false,20);tip.rotation.z=Math.PI;
    // Microscope
    box('microscope-base',1.2,.15,.7,2.65,1.35,-.45,dark);
    const arm=cylinder('microscope',.13,.16,1.25,2.55,2.0,-.45,white,true);arm.rotation.z=-.35;
    cylinder('microscope-eyepiece',.11,.11,.48,2.27,2.55,-.45,steel).rotation.z=-.35;
    cylinder('microscope-objective',.09,.07,.38,2.95,1.7,-.45,gold).rotation.z=.25;
    // Bioreactor vessel
    const vessel=cylinder('bioreactor',.62,.62,1.75,0,2.25,-1.45,glass,true,48);
    cylinder('reactor-base',.72,.72,.16,0,1.42,-1.45,steel);
    cylinder('reactor-liquid',.54,.54,.62,0,1.93,-1.45,mat(0x1c9c99,.1,.18,true,.78),false,48);
    cylinder('reactor-cap',.68,.68,.16,0,3.2,-1.45,steel);
    for(let j=0;j<3;j++){const tube=cylinder('reactor-port',.045,.045,.7,-.38+j*.38,3.55,-1.45,blue);tube.rotation.z=.12*(j-1);}
    // Cell model, with membrane, nucleus, mitochondria
    const cellGroup=new T.Group();cellGroup.position.set(4.1,2.1,.1);cellGroup.userData={name:'cell',selectable:true};scene.add(cellGroup);state.objects.cell=cellGroup;
    const cell=new T.Mesh(new T.SphereGeometry(1.05,40,32),mat(0x49aeb6,.12,.32,true,.48));cell.scale.set(1.35,.9,.85);cell.castShadow=true;cellGroup.add(cell);
    const nucleus=new T.Mesh(new T.SphereGeometry(.47,32,24),mat(0x855fc1,.15,.3));nucleus.position.set(.12,.08,0);cellGroup.add(nucleus);
    const nucleolus=new T.Mesh(new T.SphereGeometry(.17,20,16),mat(0xe9bd70));nucleolus.position.set(.2,.12,.36);cellGroup.add(nucleolus);
    for(let i=0;i<7;i++){const m=new T.Mesh(new T.SphereGeometry(.13,14,10),mat(i%2?0x58c995:0xe5a96b));m.scale.set(1.7,.6,.7);const a=i*2.4;m.position.set(Math.cos(a)*.78,Math.sin(a)*.45,Math.sin(a*1.7)*.4);cellGroup.add(m);}
    // DNA double helix display stand
    const dnaGroup=new T.Group();dnaGroup.position.set(-4,1.5,-1.25);scene.add(dnaGroup);state.objects.dna=dnaGroup;dnaGroup.userData={name:'dna',selectable:true};
    for(let i=0;i<32;i++){const y=i*.105;const a=i*.42;for(const sign of [-1,1]){const bead=new T.Mesh(new T.SphereGeometry(.075,12,10),sign<0?blue:green);bead.position.set(Math.cos(a+Math.PI*(sign>0))*0.48,y,Math.sin(a+Math.PI*(sign>0))*.48);dnaGroup.add(bead);}const rung=new T.Mesh(new T.CylinderGeometry(.025,.025,.72,8),gold);rung.position.y=y;rung.rotation.z=Math.PI/2;dnaGroup.add(rung);}
    cylinder('dna-stand',.42,.42,.12,-4,1.42,-1.25,steel);
    // Overhead light panels
    for(let x of [-3,0,3]){const light=box('ceiling-light',1.8,.05,.55,x,6.1,-2.7,mat(0x9beeff,.1,.2));const glow=new T.PointLight(0x70dce8,8,8);glow.position.set(x,5.7,-2.5);scene.add(glow);}
    // Equipment labels as canvas sprites
    function label(text,x,y,z){const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='rgba(5,20,30,.82)';ctx.strokeStyle='#3e9bad';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(2,2,252,60,12);ctx.fill();ctx.stroke();ctx.font='bold 22px Arial';ctx.fillStyle='#c7edf2';ctx.textAlign='center';ctx.fillText(text,128,40);const tex=new T.CanvasTexture(c);const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));sprite.scale.set(1.5,.38,1);sprite.position.set(x,y,z);sprite.userData.label=true;scene.add(sprite);state.labels.push(sprite);return sprite;}
    label('PCR MICROPLATE',-2.15,2.25,-.25);label('MICROSCOPE',2.65,3.0,-.45);label('BIOREACTOR',0,4.25,-1.45);label('CELL CULTURE',4.1,3.55,.1);label('DNA MODEL',-4,5.2,-1.25);
    state.scene=scene;state.camera=camera;state.renderer=renderer;state.raycaster=new T.Raycaster();state.pointer=new T.Vector2();state.controls=controls;state.cellGroup=cellGroup;state.vessel=vessel;state.dnaGroup=dnaGroup;
    $('sceneLoading').style.display='none';
    renderer.domElement.addEventListener('pointerdown',onPointerDown);
    renderer.domElement.addEventListener('pointermove',onPointerMove);
    renderer.domElement.addEventListener('pointerup',onPointerUp);
    renderer.domElement.addEventListener('wheel',onWheel,{passive:false});
    window.addEventListener('resize',resizeScene);
    animate();
    function animate(){if(!state.renderer)return;requestAnimationFrame(animate);cellGroup.rotation.y+=.002;dnaGroup.rotation.y+=.0025;state.vessel.rotation.y+=.001;updateCamera();renderer.render(scene,camera);}
    function updateCamera(){const c=state.controls;c.phi=Math.max(.25,Math.min(1.48,c.phi));camera.position.set(c.target.x+c.radius*Math.sin(c.phi)*Math.sin(c.theta),c.target.y+c.radius*Math.cos(c.phi),c.target.z+c.radius*Math.sin(c.phi)*Math.cos(c.theta));camera.lookAt(c.target);}
  }
  function onPointerMove(e){if(!state.controls?.drag)return;const c=state.controls,dx=e.clientX-c.x,dy=e.clientY-c.y;c.x=e.clientX;c.y=e.clientY;c.theta-=dx*.006;c.phi+=dy*.005;}
  function onWheel(e){e.preventDefault();state.controls.radius=Math.max(6,Math.min(20,state.controls.radius+e.deltaY*.012));}
  function resizeScene(){const h=$('lab3d');if(!state.renderer||!h)return;state.camera.aspect=h.clientWidth/h.clientHeight;state.camera.updateProjectionMatrix();state.renderer.setSize(h.clientWidth,h.clientHeight);}
  function focusObject(name){const obj=state.objects[name];if(!obj)return;state.selected=name;$('selectedObject').textContent='Tanlangan: '+({microscope:'mikroskop',pipette:'pipetka',plate:'mikroplastinka',bioreactor:'bioreaktor',cell:'hujayra modeli',dna:'DNK modeli'}[name]||name);$('sceneHint').textContent='Tanlangan obyekt: '+name;const c=state.controls;if(name==='cell'){c.target.set(4,2.1,0);c.radius=7;}else if(name==='dna'){c.target.set(-4,3, -1);c.radius=7;}else if(name==='bioreactor'){c.target.set(0,2,-1.4);c.radius=7;}else if(name==='microscope'){c.target.set(2.6,2,-.4);c.radius=7;}else if(name==='pipette'||name==='plate'){c.target.set(-.8,1.6,0);c.radius=7;} }
  function onPointerUpClick(e){if(!state.renderer||!state.raycaster)return;const rect=state.renderer.domElement.getBoundingClientRect();state.pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);state.raycaster.setFromCamera(state.pointer,state.camera);const hits=state.raycaster.intersectObjects(state.scene.children,true);for(const hit of hits){let o=hit.object;while(o&& !o.userData?.selectable && !o.userData?.parentName)o=o.parent;if(o?.userData?.parentName){focusObject(o.userData.parentName);return;}if(o?.userData?.selectable){focusObject(o.userData.name);return;}}}
  // Pointer selection is separated from camera drag so touch rotation remains natural.
  let downPoint=null;function onPointerDown(e){state.controls.drag=true;state.controls.x=e.clientX;state.controls.y=e.clientY;downPoint={x:e.clientX,y:e.clientY};state.renderer.domElement.setPointerCapture?.(e.pointerId);}
  function onPointerUp(e){const moved=downPoint&&Math.hypot(e.clientX-downPoint.x,e.clientY-downPoint.y)<7;state.controls.drag=false;if(moved)onPointerUpClick(e);downPoint=null;}

  function renderControls(){
    const c=$('controls');
    if(state.mode==='pcr')c.innerHTML='<label class="field-label" for="sequenceInput">DNK ketma-ketligi (5′ → 3′)</label><textarea id="sequenceInput" rows="4" spellcheck="false">'+DNA_DEFAULT+'</textarea><div class="field-row"><label>Sikl soni<input id="pcrCycles" type="number" min="1" max="40" value="30"></label><label>Denaturatsiya °C<input type="number" value="95" disabled></label></div><div class="control-hint">Faqat A, T, G, C harflari. Hisob nazariy modelga asoslanadi.</div>';
    if(state.mode==='cell')c.innerHTML='<div class="field-row"><label>pH<input id="cellPh" type="number" min="4" max="10" step=".1" value="7.2"></label><label>Harorat °C<input id="cellTemp" type="number" min="20" max="42" step=".1" value="37"></label></div><div class="field-row"><label>Inkubatsiya (kun)<input id="cellDays" type="number" min="1" max="14" value="3"></label><label>Ozuqa muhiti<select id="cellMedium"><option value="standard">Standart o‘quv muhiti</option><option value="serum">Serumli muhit (model)</option><option value="serumfree">Serumsiz muhit (model)</option></select></label></div><div class="control-hint">Parametrlar o‘quv modeliga tegishli, real hujayra protokoli emas.</div>';
    if(state.mode==='bioreactor')c.innerHTML='<div class="field-row"><label>pH<input id="reactorPh" type="number" min="4" max="9" step=".1" value="6.8"></label><label>Harorat °C<input id="reactorTemp" type="number" min="15" max="45" value="30"></label></div><div class="field-row"><label>Erigan O₂ (%)<input id="reactorDo" type="number" min="0" max="100" value="45"></label><label>Oziqa berish (%)<input id="reactorFeed" type="number" min="0" max="100" value="35"></label></div><div class="control-hint">Jarayon indeksi shartli; ishlab chiqarish parametrlarini belgilash uchun ishlatmang.</div>';
    if(state.mode==='crispr')c.innerHTML='<label class="field-label" for="sequenceInput">Namunaviy DNK (5′ → 3′)</label><textarea id="sequenceInput" rows="4" spellcheck="false">ATGCGTACGTAGCTAGCTAGGCTAACGTTAGCGATCGTACGATCG</textarea><label class="field-label" for="crisprTarget">Qidiriladigan 20 nt motiv</label><input id="crisprTarget" value="GCTAACGTTAGCGATCGTAC" maxlength="20"><div class="control-hint">Faqat matnli motiv qidiruvi. PAM, off-target yoki real editing hisoblanmaydi.</div>';
  }
  function showMode(mode){if(!experiments[mode])return;state.mode=mode;document.querySelectorAll('.module-choice').forEach(b=>b.classList.toggle('active',b.dataset.experiment===mode));const e=experiments[mode];$('experimentTitle').textContent=e.title;$('experimentDescription').textContent=e.description;$('protocolTitle').textContent=e.protocol;$('protocolSteps').innerHTML=e.steps.map(x=>'<li>'+x+'</li>').join('');$('scientistNote').textContent=e.note;$('experimentState').textContent='TAYYOR';$('resultPanel').innerHTML='<div class="result-empty"><span>◎</span><b>Natija kutilmoqda</b><small>Parametrlarni tekshirib, tajribani ishga tushiring.</small></div>';renderControls();if(mode==='cell')focusObject('cell');if(mode==='bioreactor')focusObject('bioreactor');if(mode==='crispr')focusObject('dna');if(mode==='pcr')focusObject('plate');}
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
      const ph=Number($('cellPh').value),temp=Number($('cellTemp').value),days=Number($('cellDays').value),medium=$('cellMedium').value;if(ph<4||ph>10||temp<20||temp>42||days<1||days>14)throw new Error('pH, harorat yoki inkubatsiya qiymati ruxsat etilgan oraliqdan tashqarida.');
      const phScore=Math.max(0,1-Math.abs(ph-7.2)/2),tempScore=Math.max(0,1-Math.abs(temp-37)/12),mediumScore=medium==='serum'?.95:medium==='standard'?.88:.72;const index=Math.round(100*phScore*tempScore*mediumScore);
      return {title:'Hujayra kulturasi — o‘quv modeli',metrics:[metric(index+'/100','SHARTLI MUHIT MOSLIGI'),metric(ph.toFixed(1),'pH'),metric(temp+' °C','HARORAT'),metric(days+' kun','INKUBATSIYA')],note:'Bu indeks faqat kiritilgan uchta parametrdan hisoblangan didaktik ko‘rsatkich. Hujayra viability yoki o‘sish tezligi o‘lchanmadi.',parameters:{ph,temp,incubation_days:days,medium}};
    }
    if(state.mode==='bioreactor'){
      const ph=Number($('reactorPh').value),temp=Number($('reactorTemp').value),doPct=Number($('reactorDo').value),feed=Number($('reactorFeed').value);if(ph<4||ph>9||temp<15||temp>45||doPct<0||doPct>100||feed<0||feed>100)throw new Error('Bioreaktor parametrlari ruxsat etilgan oraliqdan tashqarida.');
      const p=Math.max(0,1-Math.abs(ph-6.8)/2.2),t=Math.max(0,1-Math.abs(temp-30)/15),o=Math.max(0,1-Math.abs(doPct-45)/55),f=Math.max(0,1-Math.abs(feed-35)/65),index=Math.round(100*(p*.3+t*.25+o*.25+f*.2));
      return {title:'Bioreaktor — shartli jarayon tahlili',metrics:[metric(index+'/100','SHARTLI JARAYON INDEKSI'),metric(ph.toFixed(1),'pH'),metric(temp+' °C','HARORAT'),metric(doPct+'%','ERIGAN O₂')],note:'Bu soddalashtirilgan o‘quv indeksi. Mikroorganizm turi, kLa, aeratsiya, aralashtirish, substrat va mahsulot titri modellashtirilmagan.',parameters:{ph,temp,dissolved_oxygen_percent:doPct,feed_percent:feed}};
    }
    const seq=dnaSequence(),target=String($('crisprTarget').value||'').toUpperCase().replace(/\s+/g,'');if(!validateDna(seq))throw new Error('Namunaviy DNK 10–5000 ta A/T/G/C nukleotiddan iborat bo‘lishi kerak.');if(!/^[ATGC]{10,20}$/.test(target))throw new Error('Motiv 10–20 ta A/T/G/C nukleotiddan iborat bo‘lishi kerak.');const pos=seq.indexOf(target);
    return {title:'CRISPR-Cas9 — konseptual qidiruv',metrics:[metric(pos>=0?'TOPILDI':'TOPILMADI','MOTIV MOSLIGI'),metric(pos>=0?(pos+1)+' bp':'—','BOSHLANISH POZITSIYASI'),metric(target.length+' nt','MOTIV UZUNLIGI'),metric('0','GENOM TAHRIRI')],note:pos>=0?'Kiritilgan motiv namuna ichida topildi. Bu guide RNA samaradorligi yoki Cas9 kesish faolligini tasdiqlamaydi.':'Kiritilgan motiv ushbu namuna ichida topilmadi. Bu genom bo‘yicha to‘liq qidiruv emas.',sequence:seq,parameters:{target_motif:target,match_position_1based:pos>=0?pos+1:null,genome_editing_performed:false}};
  }
  async function persistExperiment(result){
    const token=sessionStorage.getItem('medgen_access_token');
    if(!token){$('syncStatus').textContent='Kirish talab qilinadi';return {saved:false,reason:'MedGen hisobiga kirmagansiz. Natija faqat ushbu brauzer sessiyasida ko‘rsatiladi.'};}
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
    const response=await fetch(API_BASE+'/experiments',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload)});
    if(!response.ok){const message=await response.text();throw new Error('Serverga saqlash amalga oshmadi (HTTP '+response.status+'): '+message.slice(0,220));}
    const data=await response.json();$('syncStatus').textContent='Serverga saqlandi';return {saved:true,id:data.id||'saqlandi',sequenceAnalysis};
  }
  async function runExperiment(){
    if(state.running)return;state.running=true;const button=$('runExperiment');button.disabled=true;button.textContent='⏳ HISOBLANMOQDA…';$('experimentState').textContent='ISHLAMOQDA';$('labStatus').textContent='RUNNING';
    try{
      const result=calculate();$('resultPanel').innerHTML='<div class="result-empty"><span>◌</span><b>Hisoblash yakunlandi</b><small>Natija tayyorlanmoqda…</small></div>';
      let saved={saved:false};try{saved=await persistExperiment(result);}catch(err){$('syncStatus').textContent='Server xatosi';saved={saved:false,reason:err.message};}
      const cards=result.metrics.join('');$('resultPanel').innerHTML='<h3 style="font-size:11px;margin:0 0 9px">'+result.title+'</h3><div class="metric-grid">'+cards+'</div><p class="result-note">'+result.note+'</p><p class="result-note"><strong>'+(saved.saved?'✓ MedGen hisobiga saqlandi':'! Server sinxronlashuvi bajarilmadi')+'</strong> · '+(saved.saved?'ID: '+escapeHtml(saved.id):escapeHtml(saved.reason||'Natija lokal ko‘rinishda.'))+'</p>';
      state.runs++;$('runCount').textContent=state.runs;$('experimentState').textContent='YAKUNLANDI';$('labStatus').textContent='COMPLETED';addHistory(result.title,saved.saved?'Serverga saqlandi':'Lokal natija');if(state.mode==='pcr'||state.mode==='crispr')focusObject('dna');else if(state.mode==='cell')focusObject('cell');else focusObject('bioreactor');
    }catch(err){$('resultPanel').innerHTML='<p class="result-note"><strong>Tekshiruv xatosi:</strong> '+escapeHtml(err.message)+'</p>';$('experimentState').textContent='XATO';$('labStatus').textContent='CHECK INPUT';}
    finally{state.running=false;button.disabled=false;button.textContent='▶ TAJRIBANI ISHGA TUSHIRISH';}
  }
  function addHistory(title,status){const host=$('historyList'),item=document.createElement('div');item.className='history-item';const b=document.createElement('b');b.textContent=title;const small=document.createElement('small');small.textContent=new Date().toLocaleString()+' · '+status;item.append(b,small);host.prepend(item);while(host.children.length>5)host.lastElementChild.remove();}
  function init(){
    document.querySelectorAll('.module-choice').forEach(b=>b.addEventListener('click',()=>showMode(b.dataset.experiment)));
    document.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>focusObject(b.dataset.focus)));
    $('runExperiment').addEventListener('click',runExperiment);
    $('resetExperiment').addEventListener('click',()=>{showMode(state.mode);$('syncStatus').textContent='Kutilmoqda';$('labStatus').textContent='READY';});
    $('resetView').addEventListener('click',()=>{if(!state.controls)return;state.controls.target.set(0,1.3,0);state.controls.theta=.675;state.controls.phi=1.02;state.controls.radius=14;});
    $('toggleLabels').addEventListener('click',()=>{state.showLabels=!state.showLabels;state.labels.forEach(l=>l.visible=state.showLabels);});
    try{buildScene();}catch(error){console.error('Biotechnology 3D scene failed:',error);$('sceneLoading').innerHTML='<b>3D sahna ishga tushmadi</b><small>WebGL yoki GPU imkoniyatini tekshiring. Tajriba boshqaruvi 3D sahnasiz ham ishlashi mumkin.</small>'; }showMode('pcr');
  }
  document.addEventListener('DOMContentLoaded',init);
})();