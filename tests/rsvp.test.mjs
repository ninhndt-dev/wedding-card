import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {normalizeRsvp,saveRsvp,RsvpError} from '../lib/rsvp.js';
const valid={guestName:' Nguyễn Văn A ',willAttend:true,numberOfGuests:2,eventType:'nhatrai',eventName:'Tiệc cưới',message:' Hẹn gặp hai bạn ',submissionId:'test-submit-123456789'};
test('RSVP validates all required fields and normalizes private data',()=>{
 const r=normalizeRsvp(valid);assert.equal(r.name,'Nguyễn Văn A');assert.equal(r.count,2);assert.equal(r.message,'Hẹn gặp hai bạn');assert.equal(r.side,'nhatrai');assert.equal(r.event,'Tiệc cưới');
 const declined=normalizeRsvp({...valid,willAttend:false,numberOfGuests:50,eventName:''});assert.equal(declined.count,0);assert.equal(declined.event,'');
 for(const patch of [{guestName:' '},{guestName:'x'.repeat(101)},{willAttend:'yes'},{numberOfGuests:0},{numberOfGuests:51},{numberOfGuests:1.5},{eventType:'invalid'},{eventName:''},{eventName:'invalid'},{message:'x'.repeat(2001)},{submissionId:'x'}])assert.throws(()=>normalizeRsvp({...valid,...patch}),RsvpError,JSON.stringify(patch));
 for(const value of [null,[],5])assert.throws(()=>normalizeRsvp(value),RsvpError);
});
test('retry does not duplicate; changed payload cannot reuse submission key',()=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE guests(id INTEGER PRIMARY KEY,name TEXT,attending TEXT,count INTEGER,side TEXT,event TEXT,message TEXT,submission_key TEXT UNIQUE,payload_hash TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP)`);
 try{
 const input=normalizeRsvp(valid);
 assert.deepEqual(saveRsvp(db,input),{created:true});assert.deepEqual(saveRsvp(db,input),{duplicate:true});
 assert.deepEqual(saveRsvp(db,normalizeRsvp({...valid,numberOfGuests:3})),{conflict:true});
 assert.deepEqual(saveRsvp(db,normalizeRsvp({...valid,submissionId:'other-submit-123456789'})),{limited:true});
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM guests').get().n,1);
 assert.deepEqual(saveRsvp(db,normalizeRsvp({...valid,guestName:'Khách khác',submissionId:'unique-submit-123456789'})),{created:true});
 }finally{db.close()}
});
