import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {mediaTypes} from '../../../lib/media';
export const runtime='nodejs';
export async function GET(req,{params}){const {filename}=await params;if(!/^[a-f0-9-]{36}\.(png|jpg|webp|gif|mp4|m4a|mp3|wav|ogg|ttf|otf|woff2)$/.test(filename))return new Response(null,{status:404});try{const bytes=await readFile(path.resolve('data/uploads',filename));const mime=mediaTypes[filename.split('.').pop()];return new Response(bytes,{headers:{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'}})}catch{return new Response(null,{status:404})}}
