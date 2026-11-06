import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
mkdirSync('data', {recursive:true});
const db = new DatabaseSync(process.env.DATABASE_PATH || 'data/wedding.sqlite');
db.exec(`PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS guests (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', attending TEXT NOT NULL, count INTEGER NOT NULL, wish TEXT NOT NULL DEFAULT '', approved INTEGER NOT NULL DEFAULT 0, created TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);`);
// Additive migration preserves existing guest responses.
const columns=new Set(db.prepare('PRAGMA table_info(guests)').all().map(c=>c.name));
for(const [name,definition] of Object.entries({kind:"TEXT NOT NULL DEFAULT 'rsvp'",side:"TEXT NOT NULL DEFAULT ''",event:"TEXT NOT NULL DEFAULT ''",message:"TEXT NOT NULL DEFAULT ''",submission_key:'TEXT',payload_hash:'TEXT'})){
  if(!columns.has(name)){
    try{db.exec(`ALTER TABLE guests ADD COLUMN ${name} ${definition}`)}catch(error){
      if(!db.prepare('PRAGMA table_info(guests)').all().some(c=>c.name===name))throw error;
    }
  }
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS guests_submission_key ON guests(submission_key); CREATE INDEX IF NOT EXISTS guests_payload_hash ON guests(payload_hash,created);');
export const defaults={bride:'Hoàng Ngọc',groom:'Tấn Ninh',date:'2026-11-28T12:30',venue:'TƯ GIA NHÀ TRAI',address:'TDP Đông Hồ, P. Thuận Thành, TP. Bắc Ninh',story:'They create a soul strong\nenough to last forever!',photo:''};
export function settings(){const r=db.prepare('SELECT value FROM settings WHERE id=1').get();return r?{...defaults,...JSON.parse(r.value)}:defaults;}
export default db;
