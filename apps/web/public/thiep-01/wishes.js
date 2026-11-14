(function(){
 function bindForm(form){
 if(form.dataset.localWishesBound)return;form.dataset.localWishesBound='1';const scope=form.closest('[data-widget]')||form.closest('section')||document;
 const name=form.elements.fullname,wish=form.elements.comment;name.maxLength=100;wish.maxLength=2000;
 const status=document.createElement('p');status.setAttribute('role','status');status.style.cssText='font-size:18px;line-height:1.5;color:#334b3d;';form.appendChild(status);
 const container=scope.querySelector('[data-miu-wishes-list]')||scope.querySelector('.miu-wishes-list');
 const more=scope.querySelector('[data-miu-wishes-more]');if(more){more.hidden=true;more.style.display='none';}
 let visibility=null;
 function item(w){const row=document.createElement('div');row.className='miu-wishes-item';const n=document.createElement('div');n.className='miu-wishes-name';n.textContent=w.name;const c=document.createElement('div');c.className='miu-wishes-comment';c.textContent=w.wish;row.append(n,c);return row;}
 function render(items){
  if(!container)return;visibility?.disconnect();container.replaceChildren();container.hidden=!items.length;container.style.display=items.length?'':'none';if(!items.length)return;
  container.classList.add('miu-wishes-ticker');container.tabIndex=0;container.setAttribute('role','region');container.setAttribute('aria-label','Lời chúc đã được duyệt');
  const track=document.createElement('div');track.className='miu-wishes-track';const batch=document.createElement('div');batch.className='miu-wishes-batch';items.forEach(w=>batch.appendChild(item(w)));track.appendChild(batch);container.appendChild(track);
  while(batch.offsetHeight<container.clientHeight&&batch.children.length<100){for(const w of items){const copy=item(w);copy.setAttribute('aria-hidden','true');batch.appendChild(copy)}}
  const duplicate=batch.cloneNode(true);duplicate.setAttribute('aria-hidden','true');track.appendChild(duplicate);track.style.setProperty('--wish-duration',Math.max(18,batch.offsetHeight/18)+'s');
  container.dataset.tickerVisible='false';visibility=new IntersectionObserver(entries=>{container.dataset.tickerVisible=String(entries[0].isIntersecting)},{rootMargin:'100px'});visibility.observe(container);
 }
 async function load(){try{const r=await fetch('/api/wishes',{cache:'no-store'});if(!r.ok)throw Error();render((await r.json()).wishes||[])}catch{if(container){container.hidden=true;container.style.display='none';}}}
 document.addEventListener('visibilitychange',()=>{if(container)container.dataset.tickerPaused=String(document.hidden)});load();
 let busy=false,key=null,last='';
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const data={name:name.value.trim(),wish:wish.value.trim()};if(!data.name||!data.wish){status.textContent='Vui lòng nhập tên và lời chúc.';return}const serialized=JSON.stringify(data);if(!key||last!==serialized){key=crypto.randomUUID();last=serialized}const button=form.querySelector('[type="submit"]');busy=true;button.disabled=true;status.textContent='Đang gửi…';try{const r=await fetch('/api/wishes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,submissionId:key,invitationToken:new URLSearchParams(location.search).get('invite')||''})});const result=await r.json();if(!r.ok)throw Error(result.error);form.reset();key=null;status.textContent='Đã lưu lời chúc! Lời chúc sẽ hiển thị sau khi được duyệt.';}catch(error){status.textContent=error.message||'Không gửi được. Thông tin vẫn được giữ để bạn thử lại.'}finally{busy=false;button.disabled=false}});
 }
 function start(scope=document){scope.querySelectorAll('[data-miu-wishes-form="1"]').forEach(bindForm)}
 window.bindWeddingWishes=start;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start());else start();
})();
