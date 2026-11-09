window.applyWeddingContent=function(s){
 const node=id=>document.querySelector('[data-node-id="'+id+'"]');
 const text=(id,value)=>{const n=node(id);if(n)n.textContent=value;};
 for(const id of ['element_text_tmrq54dtaxd','element_text_e3pbz0i593p'])text(id,s.groom.toLocaleUpperCase('vi'));
 for(const id of ['element_text_a8sem1kayyv','element_text_4ffn52f5b4i'])text(id,s.bride.toLocaleUpperCase('vi'));
 text('element_text_cebfwmhxj05',(s.groom+' - '+s.bride).toLocaleUpperCase('vi'));
 text('element_text_d9l0um64u0y',s.venue);text('element_text_7izh3ni5mms',s.address);text('element_text_n89e4g42wdj',s.story);
 document.title='Thiệp cưới - '+s.groom+' & '+s.bride;
 const mainMap=node('element_button_ndhn6x96u8i');if(mainMap){const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.venue+' '+s.address);mainMap.href=url;window.weddingMainMapUrl=url;if(!window.__mainMapBound){window.__mainMapBound=true;window.addEventListener('click',e=>{if(!e.target.closest?.('[data-node-id="element_button_ndhn6x96u8i"]'))return;if(new URLSearchParams(location.search).has('editorPreview'))return;e.preventDefault();e.stopImmediatePropagation();if(!new URLSearchParams(location.search).has('editorPreview'))window.open(window.weddingMainMapUrl,'_blank','noopener,noreferrer')},true);}}
 const [year,month,day]=s.date.slice(0,10).split('-').map(Number);const d=new Date(Date.UTC(year,month-1,day));const time=s.date.slice(11,16);const dayName=['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'][d.getUTCDay()];
 text('element_text_ea5tuau0re9',String(day).padStart(2,'0')+'.'+String(month).padStart(2,'0')+'.'+year);
 text('element_text_2kfp3y1lfce',year);text('element_text_lcmidurlfce',d.toLocaleString('en',{month:'long',timeZone:'UTC'}));
 for(const [id,clock] of [['element_calendar_5zjnlsxup6d',time],['element_calendar_3or7w9v84o3','06:30']]){
 const n=node(id);if(!n)continue;const leaves=[...n.querySelectorAll('div')].filter(x=>!x.children.length&&x.textContent.trim());const values=[clock,String(day).padStart(2,'0'),String(month).padStart(2,'0'),String(year).slice(-2),dayName];leaves.forEach((n,i)=>{if(i<values.length)n.textContent=values[i]});
 }
 const cal=node('element_calendar_rjejexalfce');if(cal&&cal.children[1]){const grid=cal.children[1],sample=grid.querySelector('div');const css=sample?.style.cssText||'';const heart=grid.querySelector('[data-anim-preset="heartBeat"]')?.cloneNode(true);grid.replaceChildren();const offset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;const days=new Date(Date.UTC(year,month,0)).getUTCDate();for(let i=0;i<offset+days;i++){const cell=document.createElement('div');cell.style.cssText=css;const n=i-offset+1;cell.textContent=n>0?n:'';cell.style.opacity=n>0?'1':'0';if(n===day){if(heart){const label=[...heart.querySelectorAll('div')].find(el=>!el.children.length&&el.textContent.trim());if(label)label.textContent=String(day);cell.replaceChildren(heart)}else{cell.style.background='#4e6437';cell.style.color='#fff'}}grid.appendChild(cell)}}
 document.querySelectorAll('[data-countdown]').forEach(n=>n.setAttribute('data-target',s.date+'+07:00'));
 if(s.date.slice(0,10)!=='2026-11-28')for(const id of ['element_text_dxprjxa0off','element_text_kmldvzj84o3']){const n=node(id);if(n)n.textContent='';}
 if(s.photo){const img=document.querySelector('img[src*="1793892037600-HIU_7932"]');if(img)img.src=s.photo;}
 document.documentElement.dataset.contentLoaded='true';

};
window.weddingContentReady=(async function(){const response=await fetch('/api/content',{cache:'no-store'});if(!response.ok)throw Error();const s=await response.json();if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));window.applyWeddingContent(s);return s;})().catch(()=>{console.warn('Không tải được nội dung cập nhật của thiệp.');return null});
