// Helpers para chamar a API REST (webhook) do Bitrix24 - Document Generator.
// Rodar sempre com: node --env-file=.env <script>.mjs
// (Node 20.6+/24 lê --env-file nativamente, sem precisar de dependência dotenv)

const WEBHOOK = process.env.CRM_WEBHOOK_URL;
if (!WEBHOOK) {
  throw new Error(
    'CRM_WEBHOOK_URL não definido. Copie .env.example para .env, preencha com o seu webhook, e rode: node --env-file=.env nome-do-script.mjs'
  );
}

export async function bitrixCall(method, params = {}) {
  const url = `${WEBHOOK}/${method}.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || 'error' in data) {
    throw new Error(
      `Bitrix API erro [${method}]: HTTP ${res.status} - ${data.error} - ${data.error_description ?? ''}`
    );
  }
  return data.result;
}

export async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// crm.documentgenerator.document.getPdf é diferente dos outros métodos: devolve
// os bytes do PDF direto no corpo da resposta, não um JSON {result: ...}.
export async function bitrixGetPdfBytes(id) {
  const url = `${WEBHOOK}/crm.documentgenerator.document.getPdf.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Falha ao pegar PDF do documento ${id}: HTTP ${res.status} - ${body.slice(0, 300)}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('pdf')) {
    const text = await res.text();
    throw new Error(`Resposta inesperada (content-type=${contentType}) pro documento ${id}: ${text.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// A conversão pra PDF é assíncrona no Bitrix - logo após document.add o PDF
// pode ainda não estar pronto (getPdf devolve HTTP 400 nesse caso). Tenta de
// novo com espera crescente antes de desistir.
export async function bitrixGetPdfBytesComRetry(id, { tentativas = 6, esperaMs = 4000 } = {}) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    if (i > 0) await sleep(esperaMs);
    try {
      return await bitrixGetPdfBytes(id);
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw new Error(`PDF do documento ${id} não ficou pronto após ${tentativas} tentativas: ${ultimoErro.message}`);
}
