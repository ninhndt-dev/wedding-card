import {settings} from '../../../lib/db';
import {publishedDocument,initialDocument} from '../../../lib/editor';
export const runtime='nodejs';
export async function GET(){const document=publishedDocument();return Response.json({...settings(),...(document?.settings||{}),site:(document||initialDocument()).site,editor:document},{headers:{'Cache-Control':'no-store'}});}
