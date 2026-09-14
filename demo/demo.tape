# Gera demo.gif rodando o pipeline de verdade contra demo/mock-crm-server.mjs
# (nenhuma chamada real ao Bitrix - ver README da pasta demo/).
# Rodar da raiz do repo: vhs demo/demo.tape

Output demo/demo.gif

Set Shell "powershell"
Set FontSize 18
Set Width 1100
Set Height 650
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

Type "Start-Process -NoNewWindow node demo/mock-crm-server.mjs"
Enter
Sleep 1s

Type "$env:CRM_WEBHOOK_URL='http://localhost:8787'; $env:CRM_ENTITY_TYPE_ID='7'; $env:CRM_ENTITY_ID='999'"
Enter
Sleep 600ms

Type "node src/listar-modelos.mjs"
Enter
Sleep 2s

Type "node src/mapear-modelos.mjs demo/exemplo-modelos demo/mapa-demo.json"
Enter
Sleep 2s

Type "node src/gerar-documentos.mjs demo/mapa-demo.json"
Enter
Sleep 3500ms

Sleep 1500ms
