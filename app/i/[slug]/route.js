import {publishedDocument,initialDocument} from '../../../lib/editor';
export const runtime='nodejs';
export async function GET(req,{params}){const {slug}=await params;const doc=publishedDocument()||initialDocument();if(slug!==doc.site.slug)return new Response('Không tìm thấy thiệp.',{status:404});const target=new URL('/thiep-01/index.html',req.url);for(const key of ['guest','opening']){const v=new URL(req.url).searchParams.get(key);if(v)target.searchParams.set(key,v.slice(0,100))}return new Response(null,{status:307,headers:{Location:target.pathname+target.search}})}
