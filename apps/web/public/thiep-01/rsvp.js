(function(){
  function start(scope=document){
    scope.querySelectorAll('form[data-miu-rsvp-form="1"]').forEach(function(form){
      if(form.dataset.localRsvpBound)return;form.dataset.localRsvpBound='1';
      const button=form.querySelector('button[type="submit"]');
      const number=form.elements.numberOfGuests,event=form.elements.eventName;
      let sending=false,submissionId=null,lastPayload=null;
      const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      status.style.cssText='font-size:18px;line-height:1.5;text-align:center;margin:6px 0;white-space:normal;color:#334b3d;';
      form.appendChild(status);
      const note=document.createElement('small');note.textContent='Lời nhắn chỉ hiển thị với cô dâu, chú rể trong trang quản trị.';note.style.cssText='font-size:16px;line-height:1.5;color:#6b7280;';form.appendChild(note);
      const update=()=>{const yes=form.elements.willAttend.value==='yes';number.disabled=!yes;number.required=yes;event.disabled=!yes;event.required=yes;};
      form.addEventListener('change',update);update();
      form.addEventListener('submit',async function(e){
        e.preventDefault();e.stopImmediatePropagation();
        if(sending||!form.reportValidity())return;
        const fd=new FormData(form),yes=fd.get('willAttend')==='yes';
        const payload={guestName:String(fd.get('guestName')||'').trim(),willAttend:yes,numberOfGuests:yes?Number(fd.get('numberOfGuests')):0,eventType:String(fd.get('eventType')||''),eventName:yes?String(fd.get('eventName')||''):'',message:String(fd.get('message')||'').trim()};
        if(!payload.guestName){status.textContent='Vui lòng nhập họ tên.';form.elements.guestName.focus();return;}
        const serialized=JSON.stringify(payload);
        if(!submissionId||lastPayload!==serialized){submissionId=crypto.randomUUID();lastPayload=serialized;}
        const buttonLabel=button.textContent;sending=true;button.disabled=true;button.textContent='Đang lưu…';status.textContent='';
        try{
          const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
          let response;
          try{response=await fetch('/api/rsvp',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({...payload,submissionId}),signal:controller.signal});}finally{clearTimeout(timer);}
          const result=await response.json();if(!response.ok)throw Error(result.error||'Không thể lưu phản hồi.');
          status.style.color='#334b3d';status.textContent=yes?'Đã lưu xác nhận! Cảm ơn bạn đã đến chung vui cùng chúng mình.':'Đã lưu phản hồi. Cảm ơn bạn đã báo tin cho chúng mình!';
          form.reset();update();submissionId=null;lastPayload=null;
        }catch(error){status.style.color='#a12a2a';status.textContent=error.name==='AbortError'?'Kết nối chậm. Bạn có thể bấm xác nhận để thử lại; phản hồi sẽ không bị lưu trùng.':(error.message||'Không thể kết nối. Vui lòng thử lại.');}
        finally{sending=false;button.disabled=false;button.textContent=buttonLabel;}
      },true);
    });
  }
  window.bindWeddingRsvp=start;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start());else start();
})();
