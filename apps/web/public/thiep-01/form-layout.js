(function(){
 const canvas=document.querySelector('.miu-canvas'),stage=document.querySelector('.miu-stage');if(!canvas)return;
 const blocks=[...canvas.querySelectorAll(':scope > [data-miu-wishes="1"],:scope > [data-miu-rsvp="1"]')];
 const defaults=new Map(blocks.map(el=>[el,parseFloat(el.style.height)||parseFloat(el.style.minHeight)||el.offsetHeight]));
 let nodes=[],layout=[],baseHeight=canvas.offsetHeight,queued=false,ready=false;
 function sync(){queued=false;if(!layout.length)return;
  const changes=layout.map(b=>({...b,delta:Math.ceil(b.el.offsetHeight-b.reserved)}));
  for(const n of nodes){const shift=changes.reduce((sum,b)=>sum+(n.el!==b.el&&n.top>=b.top+b.reserved-1?b.delta:0),0);n.el.style.top=(n.top+shift)+'px';n.el.dataset.formLayoutOffset=String(shift);}
  const height=Math.max(1,baseHeight+changes.reduce((sum,b)=>sum+b.delta,0));canvas.style.height=height+'px';
  if(stage){stage.style.setProperty('--sh',height+'px');const scale=canvas.getBoundingClientRect().width/(canvas.offsetWidth||575);stage.style.height=(height*scale)+'px';}
 }
 function schedule(){if(!ready)return;if(!queued){queued=true;requestAnimationFrame(sync)}}
 function rebase(){
  ready=true;
  nodes=[...canvas.children].filter(el=>el.dataset.nodeId&&Number.isFinite(parseFloat(el.style.top))).map(el=>({el,top:parseFloat(el.style.top)}));
  baseHeight=parseFloat(canvas.style.height)||canvas.offsetHeight;
  layout=blocks.map(el=>({el,top:parseFloat(el.style.top)||0,reserved:parseFloat(el.style.height)||parseFloat(el.style.minHeight)||defaults.get(el)}));
  for(const b of layout){b.el.style.height='auto';if(b.el.matches('[data-miu-wishes]')){b.el.style.minHeight='0';const inner=b.el.querySelector('.miu-wishes-inner');if(inner)inner.style.height='auto';}}
  schedule();
 }
 const observer=new ResizeObserver(schedule);blocks.forEach(el=>observer.observe(el));
 window.addEventListener('wedding:rendered',rebase);window.addEventListener('resize',schedule,{passive:true});
 document.fonts?.ready.then(schedule);Promise.resolve(window.weddingContentReady).then(()=>requestAnimationFrame(()=>{if(!ready)rebase()}));
})();
