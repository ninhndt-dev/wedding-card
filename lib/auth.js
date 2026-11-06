import { createHmac, timingSafeEqual } from 'node:crypto';
const secret=()=>process.env.SESSION_SECRET;
export function validPassword(input){const expected=process.env.ADMIN_PASSWORD;if(typeof input!=='string')return false;if(!expected||expected.length<12||!secret()||secret().length<32)return false;const a=Buffer.from(input||''),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
export function token(){const expires=String(Date.now()+8*3600000);return expires+'.'+createHmac('sha256',secret()).update(expires).digest('hex');}
export function authorized(req){if(!secret())return false;const t=req.cookies.get('wedding_admin')?.value||'';const [exp,sig]=t.split('.');if(!/^\d{13,16}$/.test(exp||'')||! /^[a-f0-9]{64}$/.test(sig||'')||Number(exp)<Date.now())return false;const expected=createHmac('sha256',secret()).update(exp).digest('hex');return sig.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}
export function sameOrigin(req){
  const raw=req.headers.get('origin');if(!raw)return false;
  try{
    const origin=new URL(raw);
    if(!['http:','https:'].includes(origin.protocol)||origin.origin!==raw)return false;
    if(process.env.APP_ORIGIN)return origin.origin===new URL(process.env.APP_ORIGIN).origin;
    // Next may use localhost internally even when the browser uses 127.0.0.1.
    // Host comes from this request, never an arbitrary forwarded-host header.
    return origin.host===(req.headers.get('host')||new URL(req.url).host);
  }catch{return false;}
}
