import db from '../../../lib/db';
import '../../../lib/editor';
import {sameOrigin} from '../../../lib/auth';
import {readJson} from '../../../lib/json-body';
import {createHash} from 'node:crypto';
export const runtime='nodejs';
export async function POST(req){if(!sameOrigin(req))return new Response(null,{status:403});try{const b=await readJson(req,1024);if(typeof b.visitor!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(b.visitor))return new Response(null,{status:400});const hash=createHash('sha256').update((process.env.SESSION_SECRET||'local')+b.visitor).digest('hex');db.prepare("INSERT INTO visit_events(visitor_hash,day) VALUES(?,date('now','+7 hours'))").run(hash);return new Response(null,{status:204})}catch{return new Response(null,{status:400})}}
