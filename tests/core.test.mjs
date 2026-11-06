import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
process.env.ADMIN_PASSWORD='test-password-for-admin';
process.env.SESSION_SECRET='test-session-secret-at-least-32-characters';
const auth=await import('../lib/auth.js');
test('administrator password and signed expiring session',()=>{
 assert.equal(auth.validPassword('wrong'),false);
 assert.equal(auth.validPassword(process.env.ADMIN_PASSWORD),true);
 const session=auth.token();
 const req=value=>({cookies:{get:()=>({value})}});
 assert.equal(auth.authorized(req(session)),true);
 assert.equal(auth.authorized(req(session+'x')),false);
 assert.equal(auth.authorized(req('1.signature')),false);
 assert.equal(auth.authorized(req('')),false);
 assert.equal(auth.authorized(req('9999999999999.'+'é'.repeat(64))),false);
 assert.equal(auth.validPassword(123),false);
});
test('mutations require matching origin',()=>{
 const req=(origin)=>({url:'https://wedding.example/api/guest',headers:new Headers(origin?{origin}:{})});
 assert.equal(auth.sameOrigin(req('https://wedding.example')),true);
 assert.equal(auth.sameOrigin(req('https://attacker.example')),false);
 assert.equal(auth.sameOrigin(req()),false);
 assert.equal(auth.sameOrigin({url:'http://localhost:3100/api/rsvp',headers:new Headers({origin:'http://127.0.0.1:3100',host:'127.0.0.1:3100'})}),true);
 assert.equal(auth.sameOrigin({url:'http://localhost:3100/api/rsvp',headers:new Headers({origin:'https://attacker.example',host:'127.0.0.1:3100'})}),false);
});
test('SQLite persists responses, excludes unapproved wishes and saves settings',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wedding-test-'));
 process.env.DATABASE_PATH=join(dir,'test.sqlite');
 const {default:db,settings}=await import('../lib/db.js');
 try {
 db.prepare('INSERT INTO guests(name,phone,attending,count,wish) VALUES(?,?,?,?,?)').run('Khách thử','0900000000','yes',2,'Chúc hạnh phúc');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM guests WHERE approved=1').get().n,0);
 db.prepare('UPDATE guests SET approved=1').run();
 assert.equal(db.prepare('SELECT name,wish FROM guests WHERE approved=1').all().length,1);
 db.prepare('INSERT INTO settings(id,value) VALUES(1,?)').run(JSON.stringify({bride:'Cô dâu thử'}));
 assert.equal(settings().bride,'Cô dâu thử');
 assert.ok(settings().groom);
 const child=spawnSync(process.execPath,['--input-type=module','-e',"import { DatabaseSync } from 'node:sqlite'; const d=new DatabaseSync(process.env.DATABASE_PATH); console.log(d.prepare('SELECT count FROM guests').get().count);d.close();"],{env:process.env,encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'2');
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
