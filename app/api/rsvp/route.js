import db from '../../../lib/db';
import {publishedDocument} from '../../../lib/editor';
import {sameOrigin} from '../../../lib/auth';
import {normalizeRsvp,saveRsvp,RsvpError} from '../../../lib/rsvp';
export const runtime='nodejs';
const reply=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req){
  if(!sameOrigin(req))return reply({error:'Yêu cầu không hợp lệ. Vui lòng mở thiệp từ đường dẫn website.'},403);
  if(!req.headers.get('content-type')?.includes('application/json'))return reply({error:'Định dạng dữ liệu không hợp lệ.'},415);
  // Bound the actual streamed body, including requests without Content-Length.
  let bytes=0,parts=[];
  try{
    if(!req.body)return reply({error:'Thiếu thông tin xác nhận.'},400);
    const reader=req.body.getReader();
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16384){await reader.cancel();return reply({error:'Nội dung gửi quá dài.'},413)}parts.push(Buffer.from(value));}
    const body=JSON.parse(Buffer.concat(parts).toString('utf8'));
    const input=normalizeRsvp(body,publishedDocument()?.forms?.rsvp?.events);
    const result=saveRsvp(db,input);
    if(result.conflict)return reply({error:'Phản hồi này đã được lưu trước đó với nội dung khác. Vui lòng tải lại trang để gửi phản hồi mới.'},409);
    if(result.limited)return reply({error:'Phản hồi giống nội dung này vừa được lưu. Vui lòng chờ một phút.'},429);
    return reply({ok:true,message:'Đã lưu xác nhận tham dự. Cảm ơn bạn!'},result.duplicate?200:201);
  }catch(e){
    if(e instanceof SyntaxError)return reply({error:'Dữ liệu không hợp lệ.'},400);
    if(e instanceof RsvpError)return reply({error:e.message},400);
    console.error('RSVP save failed',e.code||e.name);
    return reply({error:'Chưa thể lưu phản hồi. Vui lòng thử lại, thông tin bạn nhập vẫn được giữ nguyên.'},503);
  }
}
