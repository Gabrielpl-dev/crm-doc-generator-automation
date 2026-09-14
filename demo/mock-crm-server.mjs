// Servidor local que imita as 3 respostas reais da API do Bitrix24 usadas
// pelos scripts (template.list, document.add, document.getPdf) - só pra essa
// demo gravar um GIF honesto, sem bater no CRM de verdade nem inventar output.
//
// Uso: node demo/mock-crm-server.mjs
import { createServer } from 'node:http';

const TEMPLATES = {
  101: { id: '101', name: 'Contrato Padrão', active: 'Y', updateTime: '2026-09-01T10:00:00-03:00' },
  102: { id: '102', name: 'Contrato - Cliente Internacional', active: 'Y', updateTime: '2026-09-01T10:05:00-03:00' },
  103: { id: '103', name: 'Contrato - Isento de Taxas', active: 'Y', updateTime: '2026-09-01T10:10:00-03:00' },
};

// PDF mínimo válido de 1 página em branco - só pra ter bytes reais de PDF
// saindo do servidor, sem precisar de uma engine de renderização.
const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF',
  'utf8'
);

let proximoDocId = 5001;

const server = createServer(async (req, res) => {
  const method = req.url.replace(/^\//, '').replace(/\.json$/, '');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};

  if (method === 'crm.documentgenerator.template.list') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ result: { templates: TEMPLATES } }));
    return;
  }

  if (method === 'crm.documentgenerator.document.add') {
    const template = TEMPLATES[body.templateId];
    const id = proximoDocId++;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        result: {
          document: {
            id,
            title: `${template?.name ?? 'Modelo'} - Demo`,
            templateId: String(body.templateId),
            entityTypeId: String(body.entityTypeId),
            entityId: body.entityId,
          },
        },
      })
    );
    return;
  }

  if (method === 'crm.documentgenerator.document.getPdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.end(PDF_MINIMO);
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not_found', error_description: `método desconhecido: ${method}` }));
});

const PORTA = 8787;
server.listen(PORTA, () => {
  console.log(`Mock do CRM rodando em http://localhost:${PORTA}`);
});
