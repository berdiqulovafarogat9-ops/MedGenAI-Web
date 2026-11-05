(function(){
'use strict';
const API=window.MEDGEN_API_BASE||'https://medgenai-web-1.onrender.com/api/v1';
const TOKEN='medgen_access_token';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const molecules={
 aspirin:{name:'Aspirin',formula:'C9H8O4',atoms:[['C',-55,-5,0],['C',-28,-28,8],['C',2,-18,-8],['C',20,10,5],['C',-5,31,-5],['C',-35,24,8],['O',48,24,0],['O',72,5,8],['O',-78,-24,-8],['O',-95,0,8],['C',-118,18,-5],['C',-140,0,5]],bonds:[[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1],[3,6,1],[6,7,1],[0,8,1],[8,9,2],[9,10,1],[10,11,1]]},
 heme:{name:'Gem (heme)',formula:'C34H32FeN4O4',atoms:[['N',-42,-32,0],['N',42,-32,0],['N',-42,32,0],['N',42,32,0],['Fe',0,0,0],['C',-75,-55,5],['C',0,-75,-5],['C',75,-55,5],['C',-75,55,-5],['C',0,75,5],['C',75,55,-5],['O',100,80,0],['O',-100,-80,0]],bonds:[[0,4,1],[1,4,1],[2,4,1],[3,4,1],[0,5,1],[5,6,2],[6,1,1],[1,7,1],[7,10,2],[10,3,1],[3,9,1],[9,2,2],[2,8,1],[8,0,2],[10,11,1],[5,12,1]]},
 cholesterol:{name:'Xolesterin',formula:'C27H46O',atoms:[['C',-70,-10,0],['C',-45,-35,8],['C',-12,-28,-8],['C',8,0,4],['C',-18,30,-5],['C',-52,25,8],['C',20,-28,0],['C',52,-20,7],['C',72,8,-6],['C',50,35,5],['C',20,30,-5],['C',92,-42,0],['C',116,-18,8],['C',135,8,-5],['C',150,30,4],['O',-78,52,0]],bonds:[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1],[5,0,1],[2,6,1],[6,7,1],[7,8,1],[8,9,1],[9,10,1],[10,3,1],[7,11,1],[11,12,1],[12,13,1],[13,14,1],[5,15,1]]},
 atp:{name:'ATP',formula:'C10H16N5O13P3',atoms:[['N',-90,-28,0],['C',-65,-50,8],['N',-38,-32,-5],['C',-40,0,5],['N',-68,18,-8],['C',-95,8,6],['O',-12,0,0],['P',18,-20,8],['O',42,-40,0],['O',42,0,-5],['P',75,-20,5],['O',98,-42,0],['O',100,0,8],['P',132,-20,-5],['O',156,-40,0],['O',158,0,5]],bonds:[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1],[5,0,1],[3,6,1],[6,7,1],[7,8,2],[7,9,1],[9,10,1],[10,11,2],[10,12,1],[12,13,1],[13,14,2],[13,15,1]]}
};
let state={molecule:'aspirin',experiment:'biuret',step:0,index:0,question:null,locked:false};
const experiments={
 biuret:{name:'Biuret reaksiyasi',steps:['Namunaga Biuret reaktivi qo‘shing','Ishqoriy muhit hosil bo‘lishi uchun NaOH qo‘shing'],result:'Binafsha rang — peptid bog‘lari / oqsil borligini ko‘rsatadi.',color:'#9b59b6'},
 feling:{name:'Feling reaksiyasi',steps:['Probirkaga Feling I (CuSO₄) eritmasini qo‘shing','Feling II (ishqoriy tartrat) eritmasini qo‘shing','Tekshirilayotgan uglevod namunasini qo‘shing','Aralashmani ehtiyotkorlik bilan qizdiring'],result:'G‘isht-qizil Cu₂O cho‘kmasi hosil bo‘ladi — bu qaytaruvchi uglevod borligiga mos.',color:'#c65d32'},
 murexide:{name:'Mureksid reaksiyasi',steps:['Siydik kislotasi namunasi va konsentrlangan HNO₃ bilan reaksiya bosqichini simulyatsiya qiling','Aralashma quriguncha bug‘latish bosqichini kuzating','Sovutilgan qoldiqqa ammiak bug‘ini ta’sir ettiring'],result:'To‘q binafsha rangli mureksid (ammoniy purpurat) hosil bo‘ladi — siydik kislotasi aniqlanishiga xos rang reaksiyasi.',color:'#9b4da8'}
};
async function api(path,opts={}){
 const token=sessionStorage.getItem(TOKEN)||'';
 const res=await fetch(API+path,{...opts,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...(opts.headers||{})}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.detail||'Server xatosi: '+res.status);
 return data;
}
function css(){
 if(document.getElementById('medgenChemCss'))return;
 const s=document.createElement('style');s.id='medgenChemCss';s.textContent=`
 #medgenChem{margin:18px 0;padding:16px;border:1px solid rgba(93,166,255,.28);border-radius:18px;background:linear-gradient(145deg,rgba(12,31,51,.96),rgba(15,22,36,.96));color:#edf5ff}
 #medgenChem *{box-sizing:border-box}#medgenChem .chem-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
 #medgenChem button,#medgenChem select{border:1px solid rgba(180,210,255,.2);background:#15283e;color:inherit;border-radius:10px;padding:9px 12px;cursor:pointer}
 #medgenChem button.active{background:#155a83;border-color:#5ab8ff}#medgenChem .chem-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(220px,.8fr);gap:14px}
 #medgenChem .chem-card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;min-width:0}
 #medgenChem .chem-stage{height:270px;perspective:700px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(ellipse,rgba(54,124,176,.22),transparent 68%);border-radius:12px}
 #medgenChem .chem-stage canvas{display:block;width:100%;height:100%;touch-action:none}
 #medgenChem .chem-stage{touch-action:pan-y}
 #medgenChem .chem-atom:focus{outline:3px solid #62c7ff;z-index:3}
 #medgenChem .chem-note{color:#b8cbe0;font-size:13px;line-height:1.5}#medgenChem .chem-lab-tube{height:145px;width:90px;margin:16px auto 10px;border:4px solid #a8d3ec;border-top:0;border-radius:0 0 22px 22px;position:relative;overflow:hidden;background:#ffffff12}
 #medgenChem .chem-liquid{position:absolute;bottom:0;left:0;right:0;height:8%;background:#77bce0;transition:height .5s,background .5s}
 #medgenChem .chem-question{font-size:16px;line-height:1.5}#medgenChem .chem-option{display:block;width:100%;text-align:left;margin:7px 0}
 #medgenChem .chem-status{padding:10px;border-radius:10px;background:#ffffff0c;margin-top:10px;line-height:1.5}
 @media(max-width:680px){#medgenChem .chem-grid{grid-template-columns:1fr}#medgenChem .chem-stage{height:230px}}
 `;document.head.appendChild(s);
}
function cleanAcademyBlocks(host){
 const labels=new Set(['guided practice','application exercise','integration exercise']);
 host.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,summary').forEach(node=>{
  const label=(node.textContent||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!labels.has(label))return;
  const card=node.parentElement;
  if(card&&card!==host&&card.textContent.length<1800)card.remove();else node.remove();
 });
}
function render(host){
 if(!host)return;
 const existing=document.getElementById('medgenChem');
 if(existing){if(existing.parentElement!==host)host.prepend(existing);cleanAcademyBlocks(host);return;}
 css();
 const root=document.createElement('section');root.id='medgenChem';
 root.innerHTML='<div class="eyebrow">MEDGEN AI • TIBBIY KIMYO</div><h3>⚗️ Tibbiy kimyo laboratoriyasi</h3><p class="chem-note">Molekula modeli, virtual reaksiya va klinik vaziyatli testlar. Laboratoriya tajribalari o‘quv simulyatsiyasi bo‘lib, real laboratoriya protokoli emas.</p><div class="chem-tabs"><button class="active" data-tab="molecule">🧬 3D Molekula</button><button data-tab="lab">🧪 Virtual laboratoriya</button><button data-tab="test">🩺 Klinik test</button></div><div id="chemBody"></div>';
 host.prepend(root);cleanAcademyBlocks(host);
 root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));state.tab=b.dataset.tab;draw(root)});
 state.tab='molecule';draw(root);
}
function drawMolecule(root){
 const m=molecules[state.molecule],body=root.querySelector('#chemBody');
 if(state.moleculeCleanup){state.moleculeCleanup();state.moleculeCleanup=null;}
 body.innerHTML='<div class="chem-grid"><div class="chem-card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><select id="chemMol">'+Object.entries(molecules).map(([k,v])=>'<option value="'+k+'" '+(k===state.molecule?'selected':'')+'>'+v.name+'</option>').join('')+'</select><b>'+m.formula+'</b><span class="chem-note">Ball &amp; Stick · aylantirish mumkin</span></div><div class="chem-stage" id="chemStage" style="height:320px;position:relative"><div id="chemModel3d" style="position:absolute;inset:0"></div></div><p class="chem-note">Atomni bosing: element va taxminiy valentlikni ko‘ring. Model bog‘lanishlarni o‘quv maqsadida ko‘rsatadi; koordinatalar va ayrim bog‘ tartiblari sxematik, kvant-kimyoviy hisob natijasi emas.</p></div><div class="chem-card"><h4>Atom pasporti</h4><div id="chemAtomInfo" class="chem-status">Atomlardan birini tanlang.</div><p class="chem-note">C — kulrang · O — qizil · N — ko‘k · P — to‘q sariq · Fe — oltin.</p></div></div>';
 body.querySelector('#chemMol').onchange=e=>{state.molecule=e.target.value;drawMolecule(root)};
 const mount=body.querySelector('#chemModel3d');
 if(!window.THREE){mount.textContent='3D kutubxona yuklanmadi.';return;}
 const T=window.THREE,scene=new T.Scene();scene.background=new T.Color(0x0b1b2b);
 const camera=new T.PerspectiveCamera(42,1,.1,100);camera.position.set(0,0,5.8);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(mount.clientWidth||320,mount.clientHeight||320);mount.appendChild(renderer.domElement);
 scene.add(new T.AmbientLight(0xffffff,.72));const key=new T.DirectionalLight(0xffffff,1.25);key.position.set(3,4,5);scene.add(key);
 const group=new T.Group();scene.add(group);
 const positions=m.atoms.map(a=>new T.Vector3(a[1]*.012,a[2]*.012,a[3]*.012));
 const atomMeshes=[];
 const palette={C:0x9ca3af,O:0xef4444,N:0x3b82f6,P:0xf59e0b,Fe:0xd99a36};
 const radii={C:.105,O:.095,N:.10,P:.12,Fe:.17};
 const atomMat={};
 m.atoms.forEach((a,i)=>{const el=a[0],geo=new T.SphereGeometry(radii[el]||.09,24,18),mat=new T.MeshStandardMaterial({color:palette[el]||0xcbd5e1,roughness:.28,metalness:el==='Fe'?.35:.08});const mesh=new T.Mesh(geo,mat);mesh.position.copy(positions[i]);mesh.userData={element:el,index:i};group.add(mesh);atomMeshes.push(mesh)});
 const bondMaterial=new T.MeshStandardMaterial({color:0xcbd5e1,roughness:.38,metalness:.12});
 function addBond(a,b,order){
  const start=positions[a],end=positions[b],axis=new T.Vector3().subVectors(end,start),length=axis.length();if(length<.001)return;
  const dir=axis.clone().normalize(),perp=new T.Vector3().crossVectors(dir,new T.Vector3(0,0,1));
  if(perp.length()<.01)perp.set(1,0,0);perp.normalize();
  const count=order===3?3:order===2?2:1,spacing=.045;
  for(let k=0;k<count;k++){const offset=(k-(count-1)/2)*spacing;const mid=start.clone().add(end).multiplyScalar(.5).add(perp.clone().multiplyScalar(offset));const geo=new T.CylinderGeometry(.027,.027,Math.max(length-.12,.03),10);const mesh=new T.Mesh(geo,bondMaterial.clone());mesh.position.copy(mid);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir);group.add(mesh);}
 }
 (m.bonds||[]).forEach(b=>addBond(b[0],b[1],b[2]||1));
 const controls=T.OrbitControls?new T.OrbitControls(camera,renderer.domElement):null;
 if(controls){controls.enableDamping=true;controls.dampingFactor=.08;controls.autoRotate=true;controls.autoRotateSpeed=1.1;}
 const raycaster=new T.Raycaster(),pointer=new T.Vector2();
 function onClick(ev){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(atomMeshes,false);if(!hits.length)return;const a=hits[0].object.userData, val={C:4,O:2,N:3,Fe:6,P:5}[a.element]||1;body.querySelector('#chemAtomInfo').innerHTML='<b>'+a.element+' atomi</b><br>Taxminiy valentlik: '+val+'<br>Atom raqami: '+(a.index+1)+'<br><span class="chem-note">Sxematik o‘quv modeli.</span>';}
 renderer.domElement.addEventListener('click',onClick);
 let raf=0,alive=true;
 const resize=()=>{if(!alive)return;const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
 const ro=window.ResizeObserver?new ResizeObserver(resize):null;if(ro)ro.observe(mount);else window.addEventListener('resize',resize);
 const animate=()=>{if(!alive)return;raf=requestAnimationFrame(animate);if(controls)controls.update();renderer.render(scene,camera)};resize();animate();
 state.moleculeCleanup=()=>{alive=false;cancelAnimationFrame(raf);if(ro)ro.disconnect();else window.removeEventListener('resize',resize);renderer.domElement.removeEventListener('click',onClick);if(controls)controls.dispose();group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(x=>x.dispose());else o.material.dispose()}});renderer.dispose();renderer.domElement.remove();};
}
function drawLab(root){
 const body=root.querySelector('#chemBody'),e=experiments[state.experiment];
 body.innerHTML='<div class="chem-grid"><div class="chem-card"><h4>Virtual probirka</h4><select id="chemExperiment">'+Object.entries(experiments).map(([k,v])=>'<option value="'+k+'" '+(k===state.experiment?'selected':'')+'>'+v.name+'</option>').join('')+'</select><div class="chem-lab-tube"><div id="chemLiquid" class="chem-liquid"></div></div><p id="chemLabStatus" class="chem-status">Reagentlarni ketma-ket qo‘shing.</p><div id="chemLabActions"></div><button id="chemLabReset">Qayta boshlash</button></div><div class="chem-card"><h4>Jarayon bosqichlari</h4><ol id="chemSteps">'+e.steps.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol><p class="chem-note">Natija rang reaksiyasining soddalashtirilgan vizual modeli. Real laboratoriyada xavfsizlik qoidalari va tasdiqlangan protokolga rioya qiling.</p></div></div>';
 body.querySelector('#chemExperiment').onchange=x=>{state.experiment=x.target.value;state.step=0;drawLab(root)};
 const actions=body.querySelector('#chemLabActions');
 const refresh=()=>{const liquid=body.querySelector('#chemLiquid');liquid.style.height=(state.step?Math.min(18+state.step*24,90):8)+'%';liquid.style.background=state.step>=e.steps.length?e.color:'#77bce0';body.querySelector('#chemLabStatus').textContent=state.step>=e.steps.length?e.result:'Bosqich '+(state.step+1)+' / '+e.steps.length+': '+e.steps[state.step];actions.innerHTML=state.step<e.steps.length?'<button class="active" id="chemAdd">＋ Reagent qo‘shish</button>':'';const add=body.querySelector('#chemAdd');if(add)add.onclick=()=>{state.step++;refresh()}};refresh();
 body.querySelector('#chemLabReset').onclick=()=>{state.step=0;refresh()};
}
async function drawTest(root){
 const body=root.querySelector('#chemBody');
 body.innerHTML='<div class="chem-card"><div id="chemQuestion" class="chem-question">Savol yuklanmoqda…</div><div id="chemOptions"></div><div id="chemFeedback" class="chem-status">Javobni tanlang.</div><button id="chemNext" class="active" disabled>Keyingi savol →</button><p class="chem-note">Har bir savol uchun birinchi to‘g‘ri javob 10 ball beradi. Qayta urinish mumkin, ball takroran berilmaydi.</p></div>';
 await loadQuestion(root);
}
async function loadQuestion(root){
 const qbox=root.querySelector('#chemQuestion'),opts=root.querySelector('#chemOptions'),feedback=root.querySelector('#chemFeedback'),next=root.querySelector('#chemNext');
 qbox.textContent='Savol yuklanmoqda…';opts.innerHTML='';feedback.textContent='Javobni tanlang.';next.disabled=true;
 try{
  const d=await api('/chemistry/clinical-question?index='+state.index);state.question=d.question;
  qbox.innerHTML='<small>'+esc(d.question.topic)+'</small><br><b>'+esc(d.question.question)+'</b><p class="chem-note">'+esc(d.question.scenario)+'</p>';
  d.question.options.forEach((o,i)=>{const b=document.createElement('button');b.className='chem-option';b.textContent=String.fromCharCode(65+i)+'. '+o;b.onclick=async()=>{if(state.locked)return;state.locked=true;try{const r=await api('/chemistry/clinical-submit',{method:'POST',body:JSON.stringify({question_id:d.question.id,selected_index:i})});feedback.innerHTML=(r.correct?'✅ To‘g‘ri! ':'❌ Noto‘g‘ri. ')+'Jami ball: <b>'+r.total_points+'</b> (+'+r.awarded_points+')<br>'+esc(r.explanation);opts.querySelectorAll('button').forEach((x,j)=>{x.disabled=true;x.style.borderColor=j===r.correct_index?'#36b37e':j===i?'#d65b5b':''});next.disabled=false}catch(err){feedback.textContent=err.message;state.locked=false}};opts.appendChild(b)});
  next.textContent=(state.index+1>=d.total?'Testni yakunlash':'Keyingi savol →');next.onclick=()=>{state.index=(state.index+1)%d.total;state.locked=false;loadQuestion(root)};
 }catch(e){qbox.textContent='Klinik test yuklanmadi: '+e.message;feedback.textContent='API ishga tushganini va qayta kirganingizni tekshiring.'}
}
function draw(root){if(state.tab!=='molecule'&&state.moleculeCleanup){state.moleculeCleanup();state.moleculeCleanup=null;}if(state.tab==='molecule')drawMolecule(root);else if(state.tab==='lab')drawLab(root);else drawTest(root)}
function scan(){
 const attached=new WeakSet();
 const attach=panel=>{
  if(!panel||attached.has(panel))return;attached.add(panel);
  const check=()=>{const t=(panel.innerText||'').toLowerCase();if(t.includes('tibbiy kimyo')||t.includes('medical chemistry')||t.includes('chem-sampi-1'))render(panel);cleanAcademyBlocks(panel)};
  new MutationObserver(check).observe(panel,{childList:true,subtree:true,characterData:true});check();
 };
 const find=()=>{const panel=document.getElementById('academyPanel');if(panel)attach(panel)};
 find();
 new MutationObserver(find).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
})();
