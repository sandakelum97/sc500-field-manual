// Builds data/bank.json from data/content/*.json and writes index.html (GitHub Pages) + artifact.html (Claude preview).
import fs from 'node:fs';
import crypto from 'node:crypto';
const dir = 'data/content';
const sections = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));
const bank = { generated: new Date().toISOString(), source: 'Microsoft Learn (learn.microsoft.com)', sections };
fs.writeFileSync('data/bank.json', JSON.stringify(bank));
// Cache-bust local CSS/JS so browsers pick up new versions straight after a deploy.
const ver = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
const body = fs.readFileSync('src/app-body.html', 'utf8')
  .replace(/(href|src)="((?:css|js)\/[\w.-]+\.(?:css|js))"/g, (m, a, f) => `${a}="${f}?v=${ver(f)}"`);
const [head, rest] = body.split('<!-- /head -->');
fs.writeFileSync('index.html', `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head.trim()}\n</head>\n<body>\n${rest.trim()}\n</body>\n</html>\n`);
fs.writeFileSync('artifact.html', head.trim() + '\n' + rest.trim() + '\n');
const q = sections.reduce((n, s) => n + s.objectives.reduce((m, o) => m + (o.questions || []).length, 0), 0);
console.log(`sections=${sections.length} questions=${q}`);
