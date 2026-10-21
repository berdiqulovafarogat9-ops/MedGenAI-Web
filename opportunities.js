/* Scholarship announcements: professor submission, administrator review, public-to-members listing. */
(()=>{
 const copy={
  en:['Scholarships & opportunities','View announcements and eligibility. Apply through the official source. An announcement does not guarantee an award.','No published opportunities yet.','Submit an opportunity','Title','Organization','Eligibility and details','Deadline','Official HTTPS page','Announcement language','Send for review','Submitted for administrator review.','Publish','Reject','Pending review','Published','Rejected','Open official source','Back to workspace','Loading…'],
  uz:['Stipendiyalar va imkoniyatlar','E’lon va talablarni ko‘ring. Rasmiy manba orqali ariza bering. E’lon stipendiya berilishini kafolatlamaydi.','Hozircha tasdiqlangan e’lon yo‘q.','Imkoniyat qo‘shish','Nomi','Tashkilot','Talablar va batafsil ma’lumot','Oxirgi muddat','Rasmiy HTTPS sahifa','E’lon tili','Tekshiruvga yuborish','Administrator tekshiruviga yuborildi.','E’lon qilish','Rad etish','Tekshiruvda','E’lon qilingan','Rad etilgan','Rasmiy manbani ochish','Kabinetga qaytish','Yuklanmoqda…'],
  ru:['Стипендии и возможности','Изучите объявления и требования. Подавайте заявку через официальный источник. Объявление не гарантирует получение стипендии.','Опубликованных объявлений пока нет.','Добавить возможность','Название','Организация','Требования и подробности','Срок подачи','Официальная HTTPS-страница','Язык объявления','Отправить на проверку','Отправлено администратору на проверку.','Опубликовать','Отклонить','На проверке','Опубликовано','Отклонено','Открыть официальный источник','Вернуться в кабинет','Загрузка…']
 };
 const texts=()=>copy[localStorage.getItem('medgen_language')]||copy.uz;
 const token=()=>sessionStorage.getItem('medgen_access_token');
 async function request(path,options={}){
  const session=token();
  if(!session)throw Error('Session ended.');
  const r=await fetch((window.MEDGEN_API_BASE||'/api/v1')+path,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session}});
  const data=await r.json();
  if(token()!==session){const error=Error('Session changed.');error.name='AbortError';throw error;}
  if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail));return data;
 }
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
 async function open(){
  const t=texts(),session=token();if(!session)return;
  document.getElementById('opportunitiesPanel')?.remove();
  const panel=node('section');panel.id='opportunitiesPanel';panel.className='panel';
  const active=()=>token()===session&&panel.isConnected;
  const home=document.getElementById('finalHome');home?.classList.add('hidden');
  const back=node('button',t[18]);back.className='ghost';back.onclick=()=>{panel.remove();home?.classList.remove('hidden');};
  panel.append(back,node('h2',t[0]),node('p',t[1]));
  const resources=node('nav');resources.className='official-resources';
  for(const [label,url] of [
   ['USMLE','https://www.usmle.org/prepare-your-exam'],
   ['IELTS','https://ielts.org/take-a-test/preparation-resources'],
   ['DAAD','https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/'],
   ['Campus France','https://www.campusfrance.org/en/faq/where-can-i-apply-for-a-scholarship']
  ]){const link=node('a',label+' ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';resources.append(link);}
  panel.append(resources);
  const status=node('p',t[19]);status.setAttribute('role','status');panel.append(status);
  document.querySelector('#dashboardView .container').prepend(panel);
  try{
   const data=await request('/opportunities');if(token()!==session||!panel.isConnected)return;
   status.textContent='';
   if(!data.items.length)panel.append(node('p',t[2]));
   for(const item of data.items){
    const card=node('article');card.className='community-card';
    card.append(node('h3',item.title),node('p',item.organization),node('p',item.description),node('p',t[7]+': '+item.deadline),node('p',({pending:t[14],published:t[15],rejected:t[16]})[item.status]));
    const link=node('a',t[17]);link.href=item.source_url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
    if(data.can_review){for(const [label,publish] of [[t[12],true],[t[13],false]]){const button=node('button',label);button.className='ghost';button.onclick=async()=>{if(!active()||card.dataset.busy==='true')return;card.dataset.busy='true';const controls=card.querySelectorAll('button');controls.forEach(b=>b.disabled=true);try{await request('/opportunities/'+item.id+'?publish='+publish,{method:'PATCH'});if(active())await open();}catch(e){if(active())status.textContent=e.message;}finally{card.dataset.busy='false';controls.forEach(b=>b.disabled=false);}};card.append(button);}}
    panel.append(card);
   }
   if(data.can_submit){
    const form=node('form');form.append(node('h3',t[3]));
    for(const [name,label,type] of [['title',t[4],'text'],['organization',t[5],'text'],['description',t[6],'textarea'],['deadline',t[7],'date'],['source_url',t[8],'url']]){
     const field=node('label',label),input=node(type==='textarea'?'textarea':'input');input.name=name;input.required=true;
     if(type!=='textarea')input.type=type;else input.minLength=20;
     if(type==='date')input.min=new Date().toISOString().slice(0,10);
     if(name==='title'||name==='organization')input.maxLength=180;
     if(name==='description')input.maxLength=4000;
     field.append(input);form.append(field);
    }
    const label=node('label',t[9]),select=node('select');select.name='language';for(const code of ['uz','en','ru','de','fr']){const option=node('option',code.toUpperCase());option.value=code;select.append(option);}select.value=localStorage.getItem('medgen_language')||'uz';label.append(select);form.append(label);
    const submit=node('button',t[10]);submit.className='primary';submit.type='submit';form.append(submit);
    form.onsubmit=async e=>{e.preventDefault();if(!active()||submit.disabled)return;submit.disabled=true;try{await request('/opportunities',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});if(active())await open();}catch(error){if(active())status.textContent=error.message;}finally{submit.disabled=false;}};
    panel.append(form);
   }
  }catch(error){if(active())status.textContent=error.message;}
 }
 function button(){
  const home=document.querySelector('#finalHome .cabinet-shortcuts');if(!home)return;
  let b=document.getElementById('openOpportunities');if(!b){b=node('button');b.id='openOpportunities';b.className='cabinet-tool';b.onclick=open;home.append(b);}
  if(b.textContent!==texts()[0])b.textContent=texts()[0];
 }
 document.addEventListener('DOMContentLoaded',()=>{button();new MutationObserver(button).observe(document.getElementById('dashboardView'),{childList:true,subtree:true});});
 document.addEventListener('change',e=>{if(['languageSelector','loginLanguageSelector'].includes(e.target.id))button();});
})();
