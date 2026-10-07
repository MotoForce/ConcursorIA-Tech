# Imob Velocity 5.0

Versão 5.0 com duas formas de uso: **PWA instalável** e **Standalone autocontido**.

## Entregas

### 1) PWA
A pasta `public/` é a versão Progressive Web App. Ela inclui:
- `manifest.webmanifest`;
- service worker (`sw.js`);
- ícones 192 px, 512 px e maskable;
- cache offline do núcleo, interface, imagens e ícones;
- botão **Instalar app** quando o navegador oferece instalação;
- abertura em modo standalone após instalação;
- partidas locais disponíveis offline depois da primeira abertura com cache concluído.

Para testar localmente com os recursos PWA:
1. Instale Node.js 18 ou superior.
2. Execute `npm start` ou `start.bat` / `start.sh`.
3. Abra `http://localhost:8080`.

Em produção, use HTTPS. Service workers e instalação PWA normalmente exigem HTTPS, exceto em localhost.

### 2) Standalone
Abra diretamente:
`ABRIR_IMOB_VELOCITY_V5.html`

ou
`standalone/Imob_Velocity_V5_Standalone.html`

Essa versão é um único HTML autocontido e funciona no modo local sem Node.js e sem service worker. É a opção indicada para abrir diretamente no Android por arquivo local.

## Recursos preservados e aprimorados
- 2.000 missões sem repetição dentro do ciclo;
- 2 a 6 participantes;
- salário-base de R$ 10.000;
- turnos, ranking, patrimônio, conhecimento e bem-estar;
- SUV Premium Pérola e Picape Premium;
- compra com anúncio usando automaticamente o nome real do comprador da rodada;
- garagem, ativos e financiamento lúdico;
- cenas cinematográficas com zoom por destino;
- velocidade visual mais confortável: 0,5×, 1× e 2×, com 1× como padrão;
- transporte automático por distância: a pé, moto, carro, helicóptero e jato;
- modo local e multiplayer por servidor Node.js;
- backup/importação de partida local.

## PWA e multiplayer
O PWA pode funcionar offline para partidas locais depois que os arquivos principais forem armazenados pelo service worker. O modo multiplayer continua dependente de conexão com o servidor.

Se a pasta `public/` for publicada em hospedagem estática, o modo local e PWA funcionam. Para multiplayer, é necessário hospedar também o `server.js` em ambiente Node.js e informar o endereço HTTPS do servidor na aba Online.

## QA
Execute:
`npm test`

O QA V5 valida 2.000 missões, ciclo sem repetição, turnos, salários, ranking, migração, veículos, compra, arquivos PWA, manifest e versão standalone.

## Observação financeira
Valores de compras, custos, patrimônio e financiamento são parâmetros lúdicos do jogo e não constituem cotação, investimento, promessa de retorno ou aconselhamento financeiro.

## Correção para GitHub Pages — multiplayer

O GitHub Pages hospeda a PWA e os arquivos estáticos, mas não executa o `server.js` do multiplayer. Por isso, o endereço `https://<usuario>.github.io` não deve ser usado como servidor multiplayer: a rota `/api/health` retornará 404.

Nesta revisão, o aplicativo detecta `github.io`, não preenche mais esse endereço como backend e inicia em Modo local quando não houver um servidor online configurado. Para multiplayer entre aparelhos, publique o backend Node.js separadamente em HTTPS e informe a URL base no campo **Endereço do servidor multiplayer**.

Consulte `BACKEND_MULTIPLAYER.md` para o procedimento.
