import db from '../../../lib/db';
import {publishedDocument} from '../../../lib/editor';
import {sameOrigin} from '../../../lib/auth';
import {readJson} from '../../../lib/json-body';
import {normalizeSubmission,storeSubmission} from '../../../lib/submissions';
export const runtime='nodejs';
const reply=(b,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store'}});
export async function POST(req){if(!sameOrigin(req))return reply({error:'Nguồn gửi không hợp lệ.'},403);let input;try{input=normalizeSubmission(await readJson(req,16384),publishedDocument())}catch(e){return reply({error:e.message},400)}try{const result=storeSubmission(db,input);if(result.conflict)return reply({error:'Mã gửi đã được dùng cho nội dung khác.'},409);if(result.limited)return reply({error:'Bạn vừa gửi nội dung này. Vui lòng chờ một phút.'},429);return reply({ok:true},result.duplicate?200:201)}catch(e){console.error('Submission save',e.code);return reply({error:'Chưa thể lưu. Vui lòng thử lại.'},503)}}
