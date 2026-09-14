// Lista os modelos (templates) de Document Generator cadastrados no CRM.
// Uso: node --env-file=.env src/listar-modelos.mjs [filtro-no-nome]
import { bitrixCall } from './lib.mjs';

const termo = (process.argv[2] ?? '').toLowerCase();

let start = 0;
const todos = [];
while (true) {
  const result = await bitrixCall('crm.documentgenerator.template.list', {
    select: ['id', 'name', 'active', 'entityTypeId', 'updateTime'],
    start,
  });

  const templates = Array.isArray(result) ? result : Object.values(result.templates ?? result);
  todos.push(...templates);

  if (templates.length < 50) break;
  start += 50;
}

const filtrados = termo ? todos.filter((t) => t.name.toLowerCase().includes(termo)) : todos;

for (const t of filtrados) {
  console.log(`${t.id}\t${t.active}\t${t.updateTime}\t${t.name}`);
}
console.log(`\nTotal: ${todos.length} modelos, ${filtrados.length} exibidos`);
