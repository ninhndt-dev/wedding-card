import db from '../../../lib/db';
import {sameOrigin} from '../../../lib/auth';
import {createHash} from 'node:crypto';
export const runtime='nodejs';
const reply=(b,status=200)=>Response.json(b,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return reply({wishes:db.prepare("SELECT id,name,wish,created FROM guests WHERE approved=1 AND wish!='' ORDER BY id DESC LIMIT 200").all()});}
export async function POST(req){
 if(!sameOrigin(req))return reply({error:'Nguồn gửi không hợp lệ.'},403);
 let b;try{const text=await req.text();if(Buffer.byteLength(text)>16384)return reply({error:'Nội dung quá dài.'},413);b=JSON.parse(text)}catch{return reply({error:'Dữ liệu không hợp lệ.'},400)}
 if(!b||typeof b!=='object'||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||typeof b.wish!=='string'||!b.wish.trim()||b.wish.length>2000||typeof b.submissionId!=='string'||! /^[a-zA-Z0-9_-]{16,80}$/.test(b.submissionId))return reply({error:'Nhập tên (tối đa 100 ký tự) và lời chúc (tối đa 2.000 ký tự).'},400);
 const name=b.name.trim(),wish=b.wish.trim(),key='wish-'+b.submissionId,hash=createHash('sha256').update(JSON.stringify({name,wish})).digest('hex');
 try{
 db.exec('BEGIN IMMEDIATE');
 const prev=db.prepare('SELECT payload_hash FROM guests WHERE submission_key=?').get(key);
 if(prev){db.exec('COMMIT');return prev.payload_hash===hash?reply({ok:true}):reply({error:'Mã gửi đã được dùng. Vui lòng tải lại trang.'},409)}
 if(db.prepare("SELECT id FROM guests WHERE payload_hash=? AND created>datetime('now','-1 minute')").get(hash)){db.exec('COMMIT');return reply({error:'Lời chúc này vừa được lưu. Vui lòng chờ một phút.'},429)}
 db.prepare("INSERT INTO guests(name,attending,count,wish,submission_key,payload_hash,kind) VALUES(?,'maybe',0,?,?,?,'wish')").run(name,wish,key,hash);db.exec('COMMIT');return reply({ok:true},201);
 }catch(e){try{db.exec('ROLLBACK')}catch{}console.error('Wish save failed',e.code||e.name);return reply({error:'Chưa thể lưu lời chúc, vui lòng thử lại.'},503)}
}
