// Bate um lote de arquivos .docx baixados localmente contra os nomes reais
// dos modelos cadastrados no CRM, via API - evita erro de associação manual
// (digitar/lembrar qual arquivo corresponde a qual ID de template).
//
// Uso: node --env-file=.env src/mapear-modelos.mjs <pasta-com-docx> [saida.json]
import { readdirSync, writeFileSync } from 'node:fs';
import { bitrixCall } from './lib.mjs';

const pasta = process.argv[2];
const saida = process.argv[3] ?? 'mapa-modelos.json';

if (!pasta) {
  console.error('Uso: node --env-file=.env src/mapear-modelos.mjs <pasta-com-docx> [saida.json]');
  process.exit(1);
}

const norm = (s) => s.replace(/\.docx$/i, '').replace(/^_+\s*/, '').replace(/\s+/g, ' ').trim();

const arquivos = readdirSync(pasta).filter((f) => f.toLowerCase().endsWith('.docx'));

let start = 0;
const modelos = [];
while (true) {
  const r = await bitrixCall('crm.documentgenerator.template.list', { select: ['id', 'name'], start });
  const templates = Array.isArray(r) ? r : Object.values(r.templates ?? r);
  modelos.push(...templates.map((t) => ({ id: t.id, nomeNorm: norm(t.name), nomeOriginal: t.name })));
  if (templates.length < 50) break;
  start += 50;
}

const mapa = {};
const semMatch = [];
for (const arquivo of arquivos) {
  const alvo = norm(arquivo);
  const bateu = modelos.filter((m) => m.nomeNorm === alvo);
  if (bateu.length === 1) {
    mapa[arquivo] = Number(bateu[0].id);
  } else {
    semMatch.push({ arquivo, candidatos: bateu.map((b) => `${b.id} (${b.nomeOriginal})`) });
  }
}

writeFileSync(saida, JSON.stringify(mapa, null, 2), 'utf8');

console.log(`Mapeados: ${Object.keys(mapa).length} de ${arquivos.length} arquivos -> ${saida}`);
if (semMatch.length) {
  console.log('\nSEM MATCH (não incluídos no mapa - confira manualmente antes de gerar):');
  for (const s of semMatch) {
    console.log(`- ${s.arquivo}`);
    if (s.candidatos.length) console.log(`  candidatos: ${s.candidatos.join(' | ')}`);
  }
}
