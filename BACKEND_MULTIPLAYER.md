# Imob Velocity 5.1 — backend multiplayer

## Por que o GitHub Pages retorna HTTP 404
O GitHub Pages publica somente arquivos estáticos (HTML, CSS, JavaScript, imagens e PWA). O multiplayer do Imob Velocity usa as rotas `/api/...` do `server.js`, que precisam de um ambiente Node.js em execução.

## Como publicar
1. Envie para um serviço de hospedagem compatível com Node.js os arquivos `server.js`, `game-core.js`, `package.json` e a pasta `public/`.
2. Configure Node.js 18 ou superior.
3. Comando de inicialização: `npm start`.
4. O provedor deve disponibilizar uma URL HTTPS pública, por exemplo `https://seu-backend.exemplo`.
5. Confirme que `https://seu-backend.exemplo/api/health` retorna JSON com `ok: true`.
6. Na PWA publicada no GitHub Pages, abra **Modo online** e informe somente a URL base do backend, sem `/api/health`.

## Modos
- **Modo local:** funciona no GitHub Pages/PWA sem backend e permite passar o aparelho entre os participantes.
- **Modo online:** vários aparelhos exigem o backend Node.js em HTTPS.

A versão 5.1 detecta GitHub Pages e não o utiliza mais, por engano, como servidor multiplayer.
