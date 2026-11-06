(function(){
 function bindForm(form){
 if(form.dataset.localWishesBound)return;form.dataset.localWishesBound='1';const scope=form.closest('[data-widget]')||form.closest('section')||document;
 const name=form.elements.fullname,wish=form.elements.comment;name.maxLength=100;wish.maxLength=2000;
 const status=document.createElement('p');status.setAttribute('role','status');status.style.cssText='font-size:18px;line-height:1.5;color:#334b3d;';form.appendChild(status);
 const container=scope.querySelector('[data-miu-wishes-list]')||scope.querySelector('.miu-wishes-list');
 const more=scope.querySelector('[data-miu-wishes-more]');let all=[],limit=3;
 function render(){if(!container)return;container.replaceChildren();const items=all.slice(0,limit);if(!items.length){container.textContent='Chưa có lời chúc nào';return}items.forEach(w=>{const item=document.createElement('div');item.className='miu-wishes-item';const n=document.createElement('div');n.className='miu-wishes-name';n.textContent=w.name;const c=document.createElement('div');c.className='miu-wishes-comment';c.textContent=w.wish;item.append(n,c);container.appendChild(item)});if(more){more.hidden=limit>=all.length;more.style.display=limit>=all.length?'none':'';}}
 async function load(){try{const r=await fetch('/api/wishes',{cache:'no-store'});if(!r.ok)throw Error();all=(await r.json()).wishes;render()}catch{if(container)container.textContent='Chưa tải được lời chúc. Vui lòng tải lại trang.'}}
 if(more)more.addEventListener('click',()=>{limit+=10;render()});load();
 let busy=false,key=null,last='';
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const data={name:name.value.trim(),wish:wish.value.trim()};if(!data.name||!data.wish){status.textContent='Vui lòng nhập tên và lời chúc.';return}const serialized=JSON.stringify(data);if(!key||last!==serialized){key=crypto.randomUUID();last=serialized}const button=form.querySelector('[type="submit"]');busy=true;button.disabled=true;status.textContent='Đang gửi…';try{const r=await fetch('/api/wishes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,submissionId:key})});const result=await r.json();if(!r.ok)throw Error(result.error);form.reset();key=null;status.textContent='Đã lưu lời chúc! Lời chúc sẽ hiển thị sau khi được duyệt.';}catch(error){status.textContent=error.message||'Không thể gửi. Thông tin vẫn được giữ để bạn thử lại.'}finally{busy=false;button.disabled=false}});
 }
 function start(scope=document){scope.querySelectorAll('[data-miu-wishes-form="1"]').forEach(bindForm)}
 window.bindWeddingWishes=start;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start());else start();
})();
