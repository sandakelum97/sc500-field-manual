// Usage: node docs/validate.mjs [file...]  (defaults to all data/content/*.json)
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const obj = JSON.parse(fs.readFileSync(path.join(root,'data/objectives.json'),'utf8'));
const objIds = new Set(); obj.domains.forEach(d=>d.sections.forEach(s=>s.objectives.forEach(o=>objIds.add(o.id))));
let files = process.argv.slice(2); if(!files.length) files = fs.readdirSync(path.join(root,'data/content')).filter(f=>f.endsWith('.json')).map(f=>path.join(root,'data/content',f));
let errs=0, nq=0, nf=0; const ids=new Set();
const bad=(f,m)=>{errs++;console.log(`ERR ${path.basename(f)}: ${m}`)};
const isLearn=u=>typeof u==='string'&&/^https:\/\/(learn\.microsoft\.com|aka\.ms|go\.microsoft\.com)\//.test(u);
for(const f of files){ let j; try{ j=JSON.parse(fs.readFileSync(f,'utf8')) }catch(e){ bad(f,'invalid JSON '+e.message); continue }
 for(const o of j.objectives||[]){ if(!objIds.has(o.objectiveId)) bad(f,'unknown objectiveId '+o.objectiveId);
  if(!o.summary) bad(f,o.objectiveId+' no summary');
  (o.keyFacts||[]).forEach(k=>{ if(!isLearn(k.source)) bad(f,o.objectiveId+' fact source not Learn: '+k.source) });
  (o.flashcards||[]).forEach(c=>{ nf++; if(!c.front||!c.back) bad(f,o.objectiveId+' flashcard incomplete'); if(!isLearn(c.source)) bad(f,o.objectiveId+' flashcard source') });
  for(const q of o.questions||[]){ nq++; if(ids.has(q.id)) bad(f,'dup id '+q.id); ids.add(q.id);
   if(!q.question||!q.explanation) bad(f,q.id+' missing question/explanation');
   if(!(q.sources||[]).length||!q.sources.every(s=>isLearn(s.url))) bad(f,q.id+' sources missing/not Learn');
   const t=q.type;
   if(t==='single'||t==='multi'){ if(!Array.isArray(q.options)||q.options.length<2) bad(f,q.id+' options'); if(!Array.isArray(q.answer)||!q.answer.length||q.answer.some(i=>i<0||i>=q.options.length)) bad(f,q.id+' answer idx'); if(t==='single'&&q.answer.length!==1) bad(f,q.id+' single needs 1 answer'); if(t==='multi'&&q.answer.length<2) bad(f,q.id+' multi needs 2+'); }
   else if(t==='yesno'){ if(!Array.isArray(q.statements)||!q.statements.length||q.statements.some(s=>typeof s.answer!=='boolean')) bad(f,q.id+' statements'); }
   else if(t==='hotspot'){ if(!Array.isArray(q.dropdowns)||!q.dropdowns.length||q.dropdowns.some(d=>!Array.isArray(d.options)||d.answer<0||d.answer>=d.options.length)) bad(f,q.id+' dropdowns'); }
   else if(t==='order'){ if(!Array.isArray(q.items)||q.items.length<3) bad(f,q.id+' items'); }
   else bad(f,q.id+' bad type '+t);
  } } }
console.log(`files=${files.length} questions=${nq} flashcards=${nf} errors=${errs}`); process.exit(errs?1:0);
