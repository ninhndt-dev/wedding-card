(function(){
 const cover=document.getElementById('miuOpening'),stage=document.getElementById('miuOpeningSides');if(!cover||!stage)return;
 const preview=new URLSearchParams(location.search).has('editorPreview')&&window.parent!==window;
 const root=document.documentElement,body=document.body,left=stage.querySelector('.card-side.left'),right=stage.querySelector('.card-side.right');
 const buttons=[document.getElementById('miuOpeningBtn'),document.getElementById('miuOpeningCtaBtn')].filter(Boolean);
 let running=false,closed=false,willCloseSent=false,timer=null,leadTimer=null,animations=[];
 const event=name=>window.dispatchEvent(new Event('miu:opening:'+name));
 function reveal(){if(willCloseSent)return;willCloseSent=true;event('willClose');}
 function syncSize(){if(running)return;const main=document.querySelector('.miu-stage');const width=Math.min(main?.clientWidth||575,innerWidth);stage.style.setProperty('--miu-opening-w',Math.round(width)+'px');}
 function finish(){if(closed)return;const focusInside=cover.contains(document.activeElement);closed=true;running=false;clearTimeout(timer);clearTimeout(leadTimer);reveal();
 cover.style.display='none';cover.dataset.open='0';cover.dataset.motion='closed';cover.setAttribute('aria-hidden','true');cover.setAttribute('aria-busy','false');cover.inert=true;
 delete root.dataset.editorOpening;root.style.overflow='';body.style.overflow='';
 for(const animation of animations)animation.cancel();animations=[];
 for(const panel of [left,right])if(panel){panel.style.removeProperty('clip-path');panel.style.removeProperty('will-change')}
 stage.style.removeProperty('will-change');buttons.forEach(b=>{b.disabled=false;b.setAttribute('aria-expanded','true')});
 if(focusInside&&!preview){const main=document.querySelector('.miu-stage');if(main){main.setAttribute('tabindex','-1');main.focus({preventScroll:true})}}
 event('closed');
 }
 function animate(el,frames,options){if(!el)return;const animation=el.animate(frames,{fill:'both',...options});animations.push(animation);return animation.finished.catch(()=>{});}
 function play(){if(running||cover.dataset.open==='0')return;
 running=true;closed=false;willCloseSent=false;cover.dataset.motion='opening';cover.setAttribute('aria-busy','true');buttons.forEach(b=>b.disabled=true);
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 if(reduced||!stage.animate){reveal();if(stage.animate){animate(stage,[{opacity:1},{opacity:0}],{duration:140,easing:'linear'}).then(finish);timer=setTimeout(finish,220)}else finish();return;}
 // Use a fixed clipping line through the seal, so the two duplicate artwork
 // layers become two paper halves instead of two whole envelopes moving apart.
 const seal=left?.querySelector('.miu-env-nutthiep'),sealRect=seal?.getBoundingClientRect(),rect=stage.getBoundingClientRect();
 const split=Math.max(rect.height*.25,Math.min(rect.height*.8,sealRect?sealRect.top+sealRect.height/2-rect.top:rect.height*.5));
 if(left)left.style.clipPath='inset(0 0 '+Math.max(0,rect.height-split)+'px 0)';if(right)right.style.clipPath='inset('+split+'px 0 0 0)';
 const distance=Math.min(280,rect.height*.32),ease='cubic-bezier(.32,0,.16,1)';
 const work=[
 animate(left,[{transform:'translate3d(0,0,0)',opacity:1},{transform:'translate3d(0,'+(-distance)+'px,0)',opacity:0}],{duration:1100,easing:ease}),
 animate(right,[{transform:'translate3d(0,0,0)',opacity:1},{transform:'translate3d(0,'+distance+'px,0)',opacity:0}],{duration:1100,delay:60,easing:ease}),
 animate(cover,[{opacity:1,offset:0},{opacity:1,offset:.25},{opacity:0,offset:1}],{duration:1160,easing:'linear'})
 ];
 for(const hint of stage.querySelectorAll('.miu-env-click-btn,.miu-env-nutthiep'))animate(hint,[{opacity:1},{opacity:0}],{duration:220,easing:'ease-out'});
 leadTimer=setTimeout(reveal,240);timer=setTimeout(finish,1400);Promise.all(work).then(finish);
 }
 cover.addEventListener('click',()=>{if(!preview)play()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&running)finish()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)finish()});
 window.addEventListener('resize',syncSize,{passive:true});
 window.weddingOpening={play};
 syncSize();cover.dataset.motion='idle';cover.inert=false;
 if(!preview){cover.style.display='block';cover.dataset.open='1';cover.setAttribute('aria-hidden','false');root.style.overflow='hidden';body.style.overflow='hidden';buttons.forEach(b=>b.setAttribute('aria-expanded','false'));}
 // Decode the small cover images and the first photo before a guest taps.
 for(const img of [...stage.querySelectorAll('img'),document.querySelector('.miu-canvas img')].filter(Boolean)){img.decoding='async';img.decode?.().catch(()=>{});}
})();
