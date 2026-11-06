import {createHash} from 'node:crypto';
export const EVENT_NAMES=['Lễ nhà trai','Lễ nhà gái','Tiệc cưới'];
export class RsvpError extends Error {}
export function normalizeRsvp(body,allowedEvents=EVENT_NAMES){
  if(!body || typeof body!=='object'||Array.isArray(body)) throw new RsvpError('Dữ liệu không hợp lệ.');
  const text=(key,max,required=false)=>{
    const value=body[key]??'';
    if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new RsvpError(`Vui lòng kiểm tra ${key==='guestName'?'họ tên':key==='message'?'lời nhắn':'thông tin phản hồi'}.`);
    return value.trim();
  };
  const name=text('guestName',100,true),message=text('message',2000),side=text('eventType',20),event=text('eventName',100);
  if(typeof body.willAttend!=='boolean')throw new RsvpError('Vui lòng chọn có hoặc không tham dự.');
  if(!['nhatrai','nhagai'].includes(side))throw new RsvpError('Vui lòng chọn khách của chú rể hoặc cô dâu.');
  if((body.willAttend&&!allowedEvents.includes(event))||(!body.willAttend&&event&&!allowedEvents.includes(event)))throw new RsvpError('Vui lòng chọn sự kiện tham dự.');
  if(body.willAttend&&(!Number.isInteger(body.numberOfGuests)||body.numberOfGuests<1||body.numberOfGuests>50))throw new RsvpError('Số người tham dự phải từ 1 đến 50.');
  const idempotencyKey=body.submissionId;
  if(typeof idempotencyKey!=='string'||! /^[a-zA-Z0-9_-]{16,80}$/.test(idempotencyKey))throw new RsvpError('Mã gửi không hợp lệ. Vui lòng tải lại trang.');
  const data={name,message,side,event:body.willAttend?event:'',attending:body.willAttend?'yes':'no',count:body.willAttend?body.numberOfGuests:0};
  return {...data,key:idempotencyKey,hash:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
}
export function saveRsvp(db,input){
  db.exec('BEGIN IMMEDIATE');
  try{
    const existing=db.prepare('SELECT id,payload_hash FROM guests WHERE submission_key=?').get(input.key);
    if(existing){db.exec('COMMIT');return existing.payload_hash===input.hash?{duplicate:true}:{conflict:true};}
    const recent=db.prepare("SELECT id FROM guests WHERE payload_hash=? AND created>datetime('now','-1 minute')").get(input.hash);
    if(recent){db.exec('COMMIT');return {limited:true};}
    db.prepare('INSERT INTO guests(name,attending,count,side,event,message,submission_key,payload_hash) VALUES(?,?,?,?,?,?,?,?)').run(input.name,input.attending,input.count,input.side,input.event,input.message,input.key,input.hash);
    db.exec('COMMIT');return {created:true};
  }catch(e){db.exec('ROLLBACK');throw e;}
}
