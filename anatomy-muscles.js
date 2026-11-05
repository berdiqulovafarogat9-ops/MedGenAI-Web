/* MedGen AI — Myology passport + provisional 3D muscle markers.
 * Educational reference data; marker coordinates are approximate until a
 * dedicated, anatomically validated muscular GLB is supplied.
 */
(function () {
  'use strict';

  const MUSCLES = {
    m_pectoralis_major:{uz:'Katta ko‘krak mushagi',la:'Musculus pectoralis major',group:'Ko‘krakning yuzaki mushaklari',origo:'O‘mrov suyagining medial yarmi; to‘sh suyagi va II–VI (ba’zi manbalarda VII) qovurg‘a tog‘aylari; qorin tashqi qiyshiq mushagi aponevrozining oldingi qatlami.',insertio:'Yelka suyagi katta do‘mbog‘i qirrasining lateral labiga (labium laterale sulci intertubercularis) birikadi.',functio:'Yelkani adduksiya va medial rotatsiya qiladi; o‘mrov qismi yelkani bukishda, to‘sh-qovurg‘a qismi bukilgan yelkani yozishda qatnashadi. Qo‘l fiksatsiyalansa yordamchi inspirator bo‘lishi mumkin.',innervatio:'Nervi pectorales lateralis et medialis (odatda C5–T1).'},
    m_pectoralis_minor:{uz:'Kichik ko‘krak mushagi',la:'Musculus pectoralis minor',group:'Ko‘krakning oldingi chuqur mushaklari',origo:'III–V qovurg‘alarning oldingi uchlari, qovurg‘a tog‘aylari yaqinida.',insertio:'Kurak suyagining tumshuqsimon o‘sig‘i (processus coracoideus) medial cheti va yuqori yuzasi.',functio:'Kurakni oldinga va pastga tortadi, ko‘krak qafasiga mahkamlaydi; kurak fiksatsiyalansa qovurg‘alarni ko‘tarishda yordam beradi.',innervatio:'Nervus pectoralis medialis (C8–T1; ba’zan C7 tolalari).'},
    m_intercostales_externi:{uz:'Tashqi qovurg‘alararo mushaklar',la:'Musculi intercostales externi',group:'Ko‘krakning xususiy mushaklari',origo:'Yuqoridagi qovurg‘aning pastki qirrasi.',insertio:'Quyidagi qovurg‘aning yuqori qirrasi; tolalar yuqoridan pastga va oldinga yo‘naladi.',functio:'Suyaklararo qismi qovurg‘alarni ko‘tarib, inspiratsiyaga yordam beradi; qovurg‘alararo oraliqlarni mustahkamlaydi.',innervatio:'Nervi intercostales (T1–T11).'},
    m_intercostales_interni:{uz:'Ichki qovurg‘alararo mushaklar',la:'Musculi intercostales interni',group:'Ko‘krakning xususiy mushaklari',origo:'Yuqoridagi qovurg‘aning egati/lateral labidan.',insertio:'Quyidagi qovurg‘aning yuqori qirrasi; tolalar tashqi qovurg‘alararo mushaklarga teskari yo‘naladi.',functio:'Suyaklararo qismi majburiy ekspiratsiyada qovurg‘alarni tushiradi; tog‘aylararo qismi qovurg‘alarni ko‘tarishda qatnashishi mumkin.',innervatio:'Nervi intercostales (T1–T11).'},
    diaphragma:{uz:'Diafragma',la:'Diaphragma',group:'Ko‘krak va qorin bo‘shliqlarini ajratuvchi mushak',origo:'Pars sternalis — xanjarsimon o‘simta orqa yuzasi; pars costalis — pastki olti qovurg‘a va ularning tog‘aylari ichki yuzasi; pars lumbalis — bel umurtqalari tanalari va ravoqsimon boylamlar.',insertio:'Markaziy pay (centrum tendineum).',functio:'Asosiy inspirator mushak: qisqarganda gumbazi yassilanadi, ko‘krak bo‘shlig‘i hajmi ortadi; qorin ichi bosimini oshirishda qatnashadi.',innervatio:'Nervus phrenicus (C3–C5).'},
    m_obliquus_externus_abdominis:{uz:'Qorinning tashqi qiyshiq mushagi',la:'Musculus obliquus externus abdominis',group:'Qorin devorining yon mushaklari',origo:'V–XII qovurg‘alarning tashqi yuzalari.',insertio:'Yonbosh suyagi qirrasi oldingi yarmi; chov boylami; aponevrozi qorin oq chizig‘i va to‘g‘ri mushak qini hosil bo‘lishida qatnashadi.',functio:'Ikki tomonlama qisqarib gavdani bukadi va qorin bosimini oshiradi; bir tomonlama qisqarib gavdani qarama-qarshi tomonga buradi.',innervatio:'T7–T12 nervlari, nervus iliohypogastricus va nervus ilioinguinalis.'},
    m_obliquus_internus_abdominis:{uz:'Qorinning ichki qiyshiq mushagi',la:'Musculus obliquus internus abdominis',group:'Qorin devorining yon mushaklari',origo:'Fascia thoracolumbalis, crista iliaca oldingi qismi va ligamentum inguinale lateral yarmi.',insertio:'X–XII qovurg‘alarning pastki chetlari; linea alba; pastki tolalari conjoint tendon (falx inguinalis) tarkibida qov suyagiga boradi.',functio:'Qorin a’zolarini siqadi; ikki tomonlama gavdani bukadi, bir tomonlama gavdani o‘z tomoniga buradi.',innervatio:'T7–T12, nervus iliohypogastricus va nervus ilioinguinalis.'},
    m_transversus_abdominis:{uz:'Qorinning ko‘ndalang mushagi',la:'Musculus transversus abdominis',group:'Qorin devorining chuqur qavati',origo:'VII–XII qovurg‘a tog‘aylarining ichki yuzalari, fascia thoracolumbalis, crista iliaca va ligamentum inguinale lateral qismi.',insertio:'Aponevrozi linea alba; pastki tolalari conjoint tendon orqali qov suyagi va pecten ossis pubisga.',functio:'Qorin devorini taranglaydi, qorin ichi bosimini oshiradi va gavda barqarorligini ta’minlaydi; majburiy nafas chiqarishda qatnashadi.',innervatio:'T7–T12, nervus iliohypogastricus va nervus ilioinguinalis.'},
    m_rectus_abdominis:{uz:'Qorinning to‘g‘ri mushagi',la:'Musculus rectus abdominis',group:'Qorin devorining oldingi mushaklari',origo:'Qov suyagi qirrasi va simfizi (crista pubica et symphysis pubica).',insertio:'Xiphoid o‘simta va V–VII qovurg‘a tog‘aylari.',functio:'Gavdani oldinga bukadi, tosni orqaga aylantiradi, qorin bosimini oshiradi va qorin devorini mustahkamlaydi.',innervatio:'T6–T12 thoracoabdominal nervlari.'},
    m_trapezius:{uz:'Trapetsiyasimon mushak',la:'Musculus trapezius',group:'Orqaning yuzaki mushaklari',origo:'Ensa suyagining yuqori ensa chizig‘i medial qismi va tashqi ensa bo‘rtig‘i; ligamentum nuchae; C7–T12 umurtqalar o‘tkir o‘simtalari.',insertio:'O‘mrov suyagining lateral uchdan biri, akromion va kurak qirrasi.',functio:'Yuqori tolalari kurakni ko‘taradi, o‘rta tolalari yaqinlashtiradi, pastki tolalari tushiradi; yuqori va pastki tolalar birgalikda kurakni yuqoriga rotatsiya qiladi.',innervatio:'Nervus accessorius (XI) — motor; C3–C4 plexus cervicalis — proprioseptiv/sezuvchi tolalar.'},
    m_latissimus_dorsi:{uz:'Orqaning eng keng mushagi',la:'Musculus latissimus dorsi',group:'Orqaning yuzaki mushaklari',origo:'T7–T12 o‘tkir o‘simtalari, fascia thoracolumbalis, crista iliaca, pastki 3–4 qovurg‘a; ba’zan kurakning pastki burchagi.',insertio:'Yelka suyagining intertuberkulyar egati tubining (fundus sulci intertubercularis) sohasi.',functio:'Yelkani yozadi, adduksiya va medial rotatsiya qiladi; ko‘tarilgan gavdani qo‘llar yordamida tortishda qatnashadi.',innervatio:'Nervus thoracodorsalis (C6–C8).'},
    m_erector_spinae:{uz:'Umurtqa pog‘onasini tiklovchi mushak',la:'Musculus erector spinae',group:'Orqaning chuqur, autoxton mushaklari',origo:'Umumiy pay orqali dumg‘aza, yonbosh suyagi qirrasi, bel umurtqalari o‘tkir va ko‘ndalang o‘simtalari hamda fascia thoracolumbalisdan.',insertio:'Iliocostalis — qovurg‘alar va bo‘yin ko‘ndalang o‘simtalari; longissimus — qovurg‘alar, ko‘krak/bo‘yin ko‘ndalang o‘simtalari va processus mastoideus; spinalis — yuqoridagi umurtqalar o‘tkir o‘simtalari.',functio:'Ikki tomonlama umurtqa pog‘onasini yozadi va gavdani tik tutadi; bir tomonlama qisqarib gavdani o‘z tomoniga yon egadi.',innervatio:'Orqa miya nervlarining orqa shoxlari (rami posteriores nn. spinalium).'},
    m_deltoideus:{uz:'Deltasimon mushak',la:'Musculus deltoideus',group:'Yelka kamari mushaklari',origo:'O‘mrov suyagining lateral uchdan biri, akromion va kurak qirrasi.',insertio:'Yelka suyagining deltasimon g‘adir-budurligi (tuberositas deltoidea).',functio:'O‘rta tolalari yelkani uzoqlashtiradi; oldingi tolalari bukadi va medial rotatsiya qiladi; orqa tolalari yozadi va lateral rotatsiya qiladi.',innervatio:'Nervus axillaris (C5–C6).'},
    m_biceps_brachii:{uz:'Yelkaning ikki boshli mushagi',la:'Musculus biceps brachii',group:'Yelkaning oldingi mushaklar guruhi',origo:'Caput longum — tuberculum supraglenoidale scapulae; caput breve — processus coracoideus scapulae.',insertio:'Tuberositas radii va aponeurosis bicipitalis orqali bilak fassiyasiga.',functio:'Tirsakni bukadi va bilakni supinatsiya qiladi; yelka bo‘g‘imida bukishda yordam beradi.',innervatio:'Nervus musculocutaneus (C5–C7).'},
    m_triceps_brachii:{uz:'Yelkaning uch boshli mushagi',la:'Musculus triceps brachii',group:'Yelkaning orqa mushaklar guruhi',origo:'Caput longum — tuberculum infraglenoidale scapulae; caput laterale — humerus orqa yuzasi, sulcus nervi radialisdan yuqori; caput mediale — shu egatdan pastki orqa yuza.',insertio:'Olecranon ulnae va tirsak bo‘g‘imi kapsulasi.',functio:'Tirsak bo‘g‘imida bilakni yozadi; uzun boshi yelkani yozadi va adduksiya qiladi.',innervatio:'Nervus radialis (C6–C8; asosiy tolalar C7–C8).'},
    m_gluteus_maximus:{uz:'Katta dumba mushagi',la:'Musculus gluteus maximus',group:'Chanoqning tashqi mushaklari',origo:'Yonbosh suyagining orqa qismi, dumg‘aza va dum suyagining orqa-yon yuzalari, ligamentum sacrotuberale va fascia thoracolumbalis.',insertio:'Tractus iliotibialis va tuberositas glutea femoris.',functio:'Sonni chanoq-son bo‘g‘imida yozadi va tashqariga buradi; zinadan chiqish, yugurish va tik turishda muhim.',innervatio:'Nervus gluteus inferior (L5–S2).'},
    m_quadriceps_femoris:{uz:'Sonning to‘rt boshli mushagi',la:'Musculus quadriceps femoris',group:'Sonning oldingi mushaklar guruhi',origo:'Rectus femoris — spina iliaca anterior inferior va acetabulum usti; vastus lateralis, medialis va intermedius — son suyagining turli qismlari, linea aspera va oldingi/lateral yuzalari.',insertio:'Patella orqali ligamentum patellae bilan tuberositas tibiae.',functio:'Tizza bo‘g‘imida boldirni yozadi; rectus femoris chanoq-son bo‘g‘imida sonni bukadi.',innervatio:'Nervus femoralis (L2–L4).'},
    m_triceps_surae:{uz:'Boldirning uch boshli mushagi',la:'Musculus triceps surae',group:'Boldirning orqa yuzaki mushaklari',origo:'Gastrocnemius — son suyagining medial va lateral kondillari ustidan; soleus — tibia linea solea va fibula bosh/yuqori qismidan.',insertio:'Tendo calcaneus (Axill payi) orqali tuber calcanei.',functio:'Oyoq panjasini plantar fleksiyaga keltiradi; gastrocnemius tizzani ham bukishda yordam beradi. Yurish, yugurish va sakrashda muhim.',innervatio:'Nervus tibialis (S1–S2; segmental tolalar L5–S2).'},
    m_sternocleidomastoideus:{uz:'To‘sh-o‘mrov-so‘rg‘ichsimon mushak',la:'Musculus sternocleidomastoideus',group:'Bo‘yinning yuzaki mushaklari',origo:'Caput sternale — manubrium sterni; caput claviculare — o‘mrov suyagining medial uchdan biri.',insertio:'Processus mastoideus va linea nuchae superiorning lateral qismi.',functio:'Bir tomonlama qisqarib boshni o‘z tomoniga yon egadi va yuzni qarama-qarshi tomonga buradi; ikki tomonlama bo‘yin umurtqalarini bukadi, boshni oldinga olib keladi.',innervatio:'Nervus accessorius (XI) — motor; C2–C3 plexus cervicalis — proprioseptiv tolalar.'},
    m_masseter:{uz:'Chaynov mushagi',la:'Musculus masseter',group:'Chaynov mushaklari',origo:'Arcus zygomaticusning pastki cheti va medial yuzasi.',insertio:'Mandibula shoxining lateral yuzasi va angulus mandibulae — tuberositas masseterica.',functio:'Pastki jag‘ni ko‘taradi; yuzaki tolalari protraksiyada yordam beradi.',innervatio:'Nervus massetericus, nervus mandibularis (V3) tarmog‘i.'},
    m_temporalis:{uz:'Chakka mushagi',la:'Musculus temporalis',group:'Chaynov mushaklari',origo:'Fossa temporalis va fascia temporalisning chuqur yuzasi.',insertio:'Processus coronoideus mandibulae va mandibula shoxining oldingi cheti.',functio:'Pastki jag‘ni ko‘taradi; orqa tolalari retraksiyani bajaradi.',innervatio:'Nervi temporales profundi, nervus mandibularis (V3) tarmoqlari.'},
    m_pterygoideus_lateralis:{uz:'Lateral qanotsimon mushak',la:'Musculus pterygoideus lateralis',group:'Chaynov mushaklari',origo:'Caput superius — os sphenoidale katta qanotining facies infratemporalis va crista infratemporalis; caput inferius — processus pterygoideus lateral plastinkasining tashqi yuzasi.',insertio:'Fovea pterygoidea mandibulae; yuqori boshining tolalari chakka-pastki jag‘ bo‘g‘imi diski va kapsulasiga ham boradi.',functio:'Pastki jag‘ni oldinga suradi va og‘izni ochishda yordam beradi; bir tomonlama qisqarib jag‘ni qarama-qarshi tomonga siljitadi.',innervatio:'Nervus pterygoideus lateralis, nervus mandibularis (V3) tarmog‘i.'},
    m_orbicularis_oris:{uz:'Og‘izning aylana mushagi',la:'Musculus orbicularis oris',group:'Mimika mushaklari',origo:'Og‘iz atrofidagi yuqori va pastki jag‘ hamda boshqa mimika mushaklari tolalari bilan tutashuvchi tolalar; aniq boshlanishi alohida nuqtali emas.',insertio:'Lablar terisi va shilliq qavati; og‘iz tirqishi atrofida halqa hosil qiladi.',functio:'Lablarni yopadi, siqadi va oldinga cho‘zadi; emish, hushtak chalish va talaffuzda qatnashadi.',innervatio:'Nervus facialis (VII), asosan uning buccal va marginal mandibular shoxlari.'},
    m_buccinator:{uz:'Lunj mushagi',la:'Musculus buccinator',group:'Mimika mushaklari',origo:'Yuqori va pastki jag‘ alveolyar o‘simtalarining molyar tishlar qarshisidagi qismlari hamda raphe pterygomandibularis.',insertio:'Og‘iz burchagida orbicularis oris tolalari bilan tutashadi (modiolus anguli oris).',functio:'Lunjni tishlarga bosib, ovqatni chaynash yuzalarida ushlab turadi; puflash va havoni chiqarishda qatnashadi.',innervatio:'Nervus facialis (VII), rami buccales.'}
  };

  const MARKERS = [
    ['m_pectoralis_major','Ko‘krak',0,0.48,0.16],['m_pectoralis_minor','Kichik ko‘krak',-0.12,0.46,0.12],
    ['m_intercostales_externi','Tashqi qovurg‘alararo',0.16,0.34,0.14],['m_intercostales_interni','Ichki qovurg‘alararo',-0.16,0.32,0.13],['diaphragma','Diafragma',0,0.22,0.12],
    ['m_obliquus_externus_abdominis','Tashqi qiyshiq',0.2,0.05,0.13],['m_obliquus_internus_abdominis','Ichki qiyshiq',-0.2,0.04,0.11],['m_transversus_abdominis','Ko‘ndalang',0,0.0,0.08],['m_rectus_abdominis','Qorin to‘g‘ri',0,-0.02,0.18],
    ['m_trapezius','Trapetsiyasimon',0,0.68,-0.12],['m_latissimus_dorsi','Eng keng',0,0.25,-0.14],['m_erector_spinae','Umurtqa tiklovchi',0,-0.05,-0.12],
    ['m_deltoideus','Deltasimon',0.38,0.45,0.02],['m_biceps_brachii','Biceps',0.42,0.24,0.1],['m_triceps_brachii','Triceps',-0.42,0.24,-0.1],
    ['m_gluteus_maximus','Katta dumba',0,-0.42,-0.12],['m_quadriceps_femoris','To‘rt boshli',0.13,-0.63,0.12],['m_triceps_surae','Boldir uch boshli',0.14,-0.92,-0.08],
    ['m_sternocleidomastoideus','To‘sh-o‘mrov-so‘rg‘ich',0.12,0.78,0.08],['m_masseter','Chaynov',0.1,0.9,0.12],['m_temporalis','Chakka',-0.1,0.94,0.08],['m_pterygoideus_lateralis','Lateral qanotsimon',0,0.88,0.05],['m_orbicularis_oris','Og‘iz aylana',0,0.84,0.14],['m_buccinator','Lunj',0.14,0.84,0.13]
  ];

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(k => node.setAttribute(k, attrs[k]));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showPassport(key) {
    const m = MUSCLES[key];
    const panel = document.getElementById('medgen-muscle-passport');
    if (!m || !panel) return;
    panel.innerHTML = '';
    const head = el('div',{class:'mg-muscle-head'});
    head.append(el('div',{class:'mg-muscle-group'},m.group),el('h3',{},m.uz),el('div',{class:'mg-muscle-latin'},m.la));
    panel.append(head);
    [['Origo — boshlanishi',m.origo],['Insertio — birikishi',m.insertio],['Functio — vazifasi',m.functio],['Innervatio — innervatsiyasi',m.innervatio]].forEach(([label,value])=>{
      const section=el('section',{class:'mg-muscle-field'});
      section.append(el('strong',{},label),el('p',{},value)); panel.append(section);
    });
    panel.append(el('p',{class:'mg-muscle-note'},'O‘quv ma’lumoti. Markerlar skelet modeli uchun navigatsion ko‘rsatkich; mushaklarning haqiqiy 3D geometriyasi alohida model talab qiladi.'));
    const testButton=el('button',{type:'button',class:'mg-myology-test-button'},'🎯 Ushbu mushak bo‘yicha test topshirish');
    const testBox=el('div',{class:'mg-myology-test','aria-live':'polite'});
    testButton.addEventListener('click',()=>startMyologyTest(key,testBox,testButton));
    panel.append(testButton,testBox);
    panel.style.display='block';
    document.querySelectorAll('[data-muscle-key]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.muscleKey===key)));
  }

  const API_BASE=()=>window.MEDGEN_API_BASE||'https://medgenai-web-1.onrender.com/api/v1';
  async function myologyApi(path,options={}){
    const headers=Object.assign({'Content-Type':'application/json'},options.headers||{});
    const token=sessionStorage.getItem('medgen_access_token')||'';
    if(token) headers.Authorization='Bearer '+token;
    const response=await fetch(API_BASE()+path,Object.assign({},options,{headers}));
    const data=await response.json().catch(()=>({detail:'Server javobini o‘qib bo‘lmadi.'}));
    if(!response.ok) throw new Error(data.detail||'Test xizmatida xatolik.');
    return data;
  }
  function startMyologyTest(key,box,button){
    box.innerHTML='';
    button.disabled=true;
    const loading=el('p',{class:'mg-myology-status'},'Klinik vaziyat yuklanmoqda…');
    box.append(loading);
    myologyApi('/myology/exam/'+encodeURIComponent(key)).then(question=>{
      box.innerHTML='';
      box.append(el('div',{class:'mg-myology-case'},question.scenario));
      const choices=el('div',{class:'mg-myology-options'});
      question.options.forEach((option,index)=>{
        const choice=el('button',{type:'button',class:'mg-myology-option'},String.fromCharCode(65+index)+'. '+option);
        choice.addEventListener('click',async()=>{
          choices.querySelectorAll('button').forEach(b=>b.disabled=true);
          try{
            const result=await myologyApi('/myology/exam/submit',{method:'POST',body:JSON.stringify({muscle_id:key,question_id:question.question_id,selected_index:index})});
            const status=el('div',{class:'mg-myology-result '+(result.correct?'is-correct':'is-wrong')});
            status.append(el('strong',{},result.correct?(result.awarded?'To‘g‘ri! +10 ball':'To‘g‘ri! Bu mushak uchun +10 ball avval olingan.'):'Noto‘g‘ri javob. 0 ball.'));
            status.append(el('p',{},result.explanation));
            if(!result.correct) status.append(el('p',{},'To‘g‘ri javob: '+result.correct_option));
            status.append(el('p',{},'Myologiya bo‘yicha jami ball: '+result.total_myology_points));
            if(result.leaderboard_joined) status.append(el('p',{},'Umumiy reyting balli: '+result.leaderboard_total));
            else status.append(el('p',{},'Ball saqlandi. Ommaviy reytingda ko‘rinish uchun Reyting bo‘limida rozilik bilan qo‘shiling.'));
            box.append(status);
          }catch(error){
            box.append(el('p',{class:'mg-myology-status is-wrong'},error.message));
            choices.querySelectorAll('button').forEach(b=>b.disabled=false);
          }
        });
        choices.append(choice);
      });
      box.append(choices);
    }).catch(error=>{
      box.innerHTML='';
      box.append(el('p',{class:'mg-myology-status is-wrong'},error.message+' (Hisobga kirganingizni tekshiring.)'));
    }).finally(()=>{button.disabled=false;});
  }

  function mount(container, THREE, scene) {
    if (!container || !THREE || container.dataset.musclesMounted) return;
    container.dataset.musclesMounted='1';
    const wrap=el('div',{id:'medgen-muscle-tools'});
    const list=el('div',{id:'medgen-muscle-list'});
    const passport=el('div',{id:'medgen-muscle-passport',role:'region','aria-live':'polite'});
    const title=el('div',{class:'mg-muscle-title'},'16–24-mavzular: mushak pasporti');
    const note=el('p',{class:'mg-muscle-intro'},'Mushak nomini tanlang. Markerlar hozircha o‘quv navigatsiyasi uchun taxminiy joylashtirilgan.');
    wrap.append(title,note,list,passport);
    container.append(wrap);
    Object.keys(MUSCLES).forEach(key=>{
      const m=MUSCLES[key];
      const btn=el('button',{type:'button',class:'mg-muscle-button','data-muscle-key':key},m.uz+' · '+m.la);
      btn.addEventListener('click',()=>showPassport(key));
      list.append(btn);
    });

    const markerGroup=new THREE.Group(); markerGroup.name='MedGen compact myology pins';
    const PRECISE_POSITIONS={
      m_pectoralis_major:[0.08,0.35,0.12],
      m_rectus_abdominis:[0.0,0.05,0.11],
      m_deltoideus:[0.24,0.42,0.02],
      m_quadriceps_femoris:[0.11,-0.42,0.09],
      m_triceps_surae:[0.09,-0.85,-0.06],
      m_masseter:[0.07,0.62,0.06]
    };
    const pinGeometry=new THREE.SphereGeometry(0.018,16,16);
    const pinMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
    const ringGeometry=new THREE.RingGeometry(0.024,0.03,32);
    const ringMaterial=new THREE.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false});
    MARKERS.forEach(([key,label,x,y,z])=>{
      const pos=PRECISE_POSITIONS[key]||[x,y,z];
      const pin=new THREE.Mesh(pinGeometry,pinMaterial);
      pin.position.set(pos[0],pos[1],pos[2]);
      pin.userData.muscleKey=key; pin.userData.label=label; pin.renderOrder=1001;
      const ring=new THREE.Mesh(ringGeometry,ringMaterial);
      ring.position.copy(pin.position);
      ring.userData.muscleKey=key; ring.userData.label=label; ring.userData.isMuscleRing=true; ring.renderOrder=1000;
      markerGroup.add(ring,pin);
    });
    markerGroup.visible=true;
    window.medgenMuscleMarkerGroup=markerGroup;
    if(scene) scene.add(markerGroup);
    window.medgenMuscles={dictionary:MUSCLES,markers:MARKERS,show:showPassport,mount,markerGroup};
  }

  window.medgenMuscles={dictionary:MUSCLES,markers:MARKERS,show:showPassport,mount};
  window.medgenMusclePassportStyles = true;
})();