import db from '../../../../lib/db';
import {manifest} from '../../../../lib/editor';
import {validateDocument} from '../../../../lib/editor-schema';
import {authorized,sameOrigin} from '../../../../lib/auth';
import {readJson} from '../../../../lib/json-body';
export const runtime='nodejs';
const reply=(b,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store'}});
export async function GET(req){if(!authorized(req))return reply({error:'Vui lòng đăng nhập.'},401);const id=new URL(req.url).searchParams.get('id');if(id){const row=db.prepare('SELECT * FROM editor_presets WHERE id=?').get(Number(id));return row?reply({preset:{...row,document:JSON.parse(row.document)}}):reply({error:'Không tìm thấy preset.'},404)}return reply({presets:db.prepare('SELECT id,name,created FROM editor_presets ORDER BY id DESC').all()})}
export async function POST(req){if(!authorized(req))return reply({error:'Vui lòng đăng nhập.'},401);if(!sameOrigin(req))return reply({error:'Nguồn gửi không hợp lệ.'},403);try{const b=await readJson(req);if(b.action==='delete'&&Number.isInteger(b.id)){db.prepare('DELETE FROM editor_presets WHERE id=?').run(b.id);return reply({ok:true})}if(b.action!=='save'||typeof b.name!=='string'||!b.name.trim()||b.name.length>100)return reply({error:'Nhập tên preset tối đa 100 ký tự.'},400);const doc=validateDocument(b.document,manifest.nodes.map(n=>n.id));const result=db.prepare('INSERT INTO editor_presets(name,document) VALUES(?,?)').run(b.name.trim(),JSON.stringify(doc));return reply({ok:true,id:Number(result.lastInsertRowid)},201)}catch(e){return reply({error:e.message},400)}}
