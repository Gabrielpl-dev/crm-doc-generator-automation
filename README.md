# Automação de Geração de Documentos via API de CRM

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> ⚠️ **Repositório sanitizado.** Este código foi escrito originalmente pra um caso de uso
> real (CRM de verdade, dados de verdade), mas tudo que é específico daquele ambiente —
> credencial de API, IDs de negócio/orçamento/modelo, nomes de pessoas e empresas, dados
> de teste — foi removido antes de publicar. O que ficou é só a lógica genérica e
> reaproveitável. Nenhum dado real trafega por aqui.

## Contexto

Um amigo precisava homologar cerca de 30 variações de um mesmo contrato no Bitrix24
(cada variação com uma combinação diferente de cláusulas). O processo manual exigia
abrir cada proposta comercial, navegar até o painel de geração de documentos, clicar em
"Gerar", esperar a conversão pra PDF e baixar — um de cada vez, repetido umas 30 vezes.
O trabalho ia levar horas.

## Demo

Output real, capturado rodando os três scripts contra um mock local da API
(`demo/mock-crm-server.mjs`, incluído no repo) — sem tocar em nenhum CRM de verdade.
Reproduzível com `node demo/mock-crm-server.mjs` + as variáveis de ambiente de exemplo
que estão nos comentários do arquivo.

```
$ node src/listar-modelos.mjs
101	Y	2026-09-01T10:00:00-03:00	Contrato Padrão
102	Y	2026-09-01T10:05:00-03:00	Contrato - Cliente Internacional
103	Y	2026-09-01T10:10:00-03:00	Contrato - Isento de Taxas

Total: 3 modelos, 3 exibidos

$ node src/mapear-modelos.mjs demo/exemplo-modelos mapa.json
Mapeados: 3 de 3 arquivos -> mapa.json

$ node src/gerar-documentos.mjs mapa.json

=== Modelo 102 (Contrato - Cliente Internacional.docx) ===
-> Chamando crm.documentgenerator.document.add...
-> Documento gerado: id=5001, title="Contrato - Cliente Internacional - Demo"
-> Baixando PDF (crm.documentgenerator.document.getPdf)...
-> Salvo em gerados/102-5001.pdf (192 bytes)

=== Modelo 103 (Contrato - Isento de Taxas.docx) ===
-> Chamando crm.documentgenerator.document.add...
-> Documento gerado: id=5002, title="Contrato - Isento de Taxas - Demo"
-> Baixando PDF (crm.documentgenerator.document.getPdf)...
-> Salvo em gerados/103-5002.pdf (192 bytes)

=== Modelo 101 (Contrato Padrão.docx) ===
-> Chamando crm.documentgenerator.document.add...
-> Documento gerado: id=5003, title="Contrato Padrão - Demo"
-> Baixando PDF (crm.documentgenerator.document.getPdf)...
-> Salvo em gerados/101-5003.pdf (192 bytes)

=== Resumo ===
102	gerado	Contrato - Cliente Internacional.docx
103	gerado	Contrato - Isento de Taxas.docx
101	gerado	Contrato Padrão.docx
```

## Abordagem

A primeira tentativa foi automatizar via clique de navegador, espelhando exatamente o
fluxo manual. Isso esbarrou numa limitação técnica real: o widget de geração de
documento roda dentro de um iframe de origem cruzada, invisível tanto pra árvore de
acessibilidade quanto pro monitoramento de rede da ferramenta de automação — não havia
como ler nem interceptar nada de dentro dele.

Isso exigiu uma virada de estratégia: em vez de imitar clique, a investigação passou pra
API REST que o botão "Gerar" chama por baixo dos panos. Sem documentação específica pra
esse fluxo exato, foi preciso capturar uma resposta real de rede (obtida via DevTools,
já que a ferramenta de automação não enxergava o iframe) e reconstruir o comportamento a
partir dela.

Alguns problemas reais surgiram nesse processo e valem registro:

- A resposta de `document.add` vinha aninhada (`result.document`, não `result` direto) —
  detalhe só visível depois de inspecionar a resposta crua.
- A ação "download" devolvia o `.docx` fonte, não o PDF renderizado — o PDF de verdade
  só sai por um método (`getPdf`) que devolve bytes crus no corpo da resposta, não JSON.
- A conversão pra PDF é assíncrona: chamar `getPdf` cedo demais depois de gerar retorna
  erro — foi necessário retry com espera.
- O problema mais difícil de diagnosticar: os primeiros documentos gerados via API
  saíam com todo campo em branco, mesmo com um request tecnicamente válido (sem erro
  algum retornado). O botão da tela, na prática, gerava o documento vinculado a uma
  entidade diferente da que tinha sido assumida inicialmente. A causa foi encontrada
  inspecionando os metadados de um documento **já gerado corretamente** pelo clique
  manual, comparando qual entidade ele de fato usava — em vez de seguir tentativa e erro.

## Resultado

Um processo manual de vários minutos por documento virou um script que gera e baixa
todos os PDFs necessários em poucos minutos, sem clique algum — cada arquivo de modelo
local é batido automaticamente contra o nome real do template no CRM, eliminando erro de
associação manual entre dezenas de arquivos.

## Como funciona

1. **`src/mapear-modelos.mjs`** — bate os arquivos `.docx` baixados localmente contra os
   nomes reais dos templates cadastrados no CRM, via API, gerando um mapa
   arquivo → ID do template.
2. **`src/gerar-documentos.mjs`** — pra cada template mapeado, chama a API de geração,
   espera a conversão pra PDF (com retry), baixa e salva localmente.
3. **`src/listar-modelos.mjs`** — utilitário pra listar/filtrar os templates existentes
   no CRM.

```bash
cp .env.example .env
# preencha .env com o seu webhook e a entidade certa (ver comentários no .env.example
# e em src/gerar-documentos.mjs sobre como descobrir entityTypeId/entityId corretos)

node --env-file=.env src/listar-modelos.mjs "termo de adesão"
node --env-file=.env src/mapear-modelos.mjs ./meus-modelos-baixados
node --env-file=.env src/gerar-documentos.mjs mapa-modelos.json
```

## Stack

Node.js puro (sem dependências), usando `fetch` nativo e `node --env-file` pra
configuração — sem framework, só o suficiente pra resolver o problema.
