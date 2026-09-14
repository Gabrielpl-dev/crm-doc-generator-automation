// Gera um documento a partir de um modelo já cadastrado no CRM (NÃO sobe nem
// sobrescreve arquivo de modelo nenhum - só chama a geração via API e baixa o
// PDF resultante, o mesmo resultado que clicar em "Gerar" na tela).
//
// Uso: node --env-file=.env src/gerar-documentos.mjs <mapa.json> [id-do-modelo]
//      sem o segundo argumento -> roda pra todos os modelos do mapa
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { bitrixCall, bitrixGetPdfBytesComRetry } from './lib.mjs';

const mapaPath = process.argv[2];
const soUmId = process.argv[3] ? Number(process.argv[3]) : null;

if (!mapaPath) {
  console.error('Uso: node --env-file=.env src/gerar-documentos.mjs <mapa.json> [id-do-modelo]');
  process.exit(1);
}

const MAPA = JSON.parse(readFileSync(mapaPath, 'utf8'));

// O contexto certo pra gerar (tipo de entidade + ID) depende de como o CRM está
// modelado - no meu caso era o Orçamento (Quote, entityTypeId=7), não o Negócio.
// Descobri isso na prática: usar a entidade errada gera documento com todo
// campo em branco, sem erro nenhum - vale inspecionar um documento já gerado
// corretamente pela tela (crm.documentgenerator.document.get) pra confirmar
// qual entityTypeId/entityId ele realmente usa antes de automatizar.
const ENTITY_TYPE_ID = Number(process.env.CRM_ENTITY_TYPE_ID);
const ENTITY_ID = Number(process.env.CRM_ENTITY_ID);

const GERADOS_DIR = new URL('../gerados/', import.meta.url);
mkdirSync(GERADOS_DIR, { recursive: true });

async function gerarUm(arquivo, templateId) {
  console.log(`\n=== Modelo ${templateId} (${arquivo}) ===`);

  console.log('-> Chamando crm.documentgenerator.document.add...');
  const doc = (
    await bitrixCall('crm.documentgenerator.document.add', {
      templateId,
      entityTypeId: ENTITY_TYPE_ID,
      entityId: ENTITY_ID,
    })
  ).document;

  console.log(`-> Documento gerado: id=${doc.id}, title="${doc.title}"`);
  console.log('-> Baixando PDF (crm.documentgenerator.document.getPdf)...');
  const bytes = await bitrixGetPdfBytesComRetry(doc.id);

  const nomeArquivo = `${templateId}-${doc.id}.pdf`;
  const destino = new URL(nomeArquivo, GERADOS_DIR);
  writeFileSync(destino, bytes);
  console.log(`-> Salvo em gerados/${nomeArquivo} (${bytes.length} bytes)`);

  return { templateId, arquivo, docId: doc.id, title: doc.title };
}

const entradas = Object.entries(MAPA).filter(([, id]) => soUmId === null || id === soUmId);

if (entradas.length === 0) {
  console.error(`Nenhum modelo encontrado para o id ${soUmId}.`);
  process.exit(1);
}

// Sequencial de propósito: a conversão pra PDF do lado do CRM não lida bem
// com chamadas concorrentes - gerar um de cada vez é mais lento, mas confiável.
const resultados = [];
for (const [arquivo, templateId] of entradas) {
  try {
    const r = await gerarUm(arquivo, templateId);
    resultados.push({ ...r, status: 'gerado' });
  } catch (err) {
    console.error(`ERRO no modelo ${templateId}: ${err.message}`);
    resultados.push({ templateId, arquivo, status: 'erro', erro: err.message });
  }
}

console.log('\n=== Resumo ===');
for (const r of resultados) {
  console.log(`${r.templateId}\t${r.status}\t${r.arquivo}`);
}
