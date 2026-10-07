# Relatório de QA — Imob Velocity 5.0

## Resultado
**APROVADO nos testes automatizados executados neste ambiente.**

## Verificações realizadas
- Sintaxe de `server.js`, `game-core.js`, `public/game-core.js`, `public/app.js` e `public/sw.js`.
- Sintaxe dos scripts incorporados no HTML standalone.
- Exatamente 2.000 missões e 2.000 IDs/títulos únicos.
- Ciclo completo de 2.000 missões sem repetição antes do reinício do baralho.
- Turnos, dado, distâncias, salário, ranking e encerramento de partida.
- Migração de save antigo.
- Seleção automática de transporte por distância.
- Compra de veículos e bloqueio de compra duplicada.
- Registro do nome real do comprador no evento de compra.
- Presença e validade estrutural do manifest PWA.
- Presença de service worker, ícones 192/512/maskable e HTML standalone.
- Servidor HTTP testado em porta alternativa: `/api/health` retornou versão 5.0.0.
- MIME type validado para manifest (`application/manifest+json`) e WebP (`image/webp`).
- `sw.js` validado com política de cache `no-cache` no servidor.

## Limites da validação
A instalação efetiva como PWA depende do navegador e de HTTPS/localhost. O teste de QA neste ambiente não substitui teste de aceitação em aparelhos Android/iOS específicos nem teste de carga multiplayer em produção.
