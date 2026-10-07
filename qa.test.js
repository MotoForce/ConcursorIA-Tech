'use strict';
const assert=require('assert');
const e=require('./game-core');

assert.equal(e.VERSION,'5.0.0');
assert.equal(e.TOTAL_MISSIONS,2000);
assert.equal(e.MISSIONS.length,2000,'Deve haver exatamente 2.000 missões');
assert.equal(new Set(e.MISSIONS.map(m=>m.title)).size,2000,'Os títulos das 2.000 missões devem ser únicos');
assert.equal(new Set(e.MISSIONS.map(m=>m.id)).size,2000,'IDs das missões devem ser únicos');
assert.deepEqual(e.MULTIPLIERS,{1:0.5,2:0.75,3:1,4:1.25,5:1.5,6:2});
assert.equal(e.PROFESSIONS.length,18);
assert.equal(e.CITY_LOCATIONS.length,30);

// Fluxo básico e proteção de turno.
const room=e.createRoomState('Alice','Analista de Sistemas','ABC123',{maxRounds:2});
const bob=e.joinPlayer(room,'Bruno','Professor(a)');
assert.equal(room.players.length,2);
e.startGame(room,room.hostId);
assert.equal(room.status,'playing');
assert.throws(()=>e.rollDice(room,bob.id),/Aguarde seu turno/);
let cp=room.players[room.currentPlayerIndex];
e.rollDice(room,cp.id);
assert.equal(room.phase,'rolled');
assert.ok(room.lastRoll.value>=1&&room.lastRoll.value<=6);
assert.ok([200,300,400,500,600,800].includes(room.lastRoll.distance));
assert.ok(room.lastMission&&room.lastMission.id>=1&&room.lastMission.id<=2000);
assert.equal(room.lastMission.locationId,room.lastRoll.location.id);
e.endTurn(room,cp.id);
assert.equal(room.players[room.currentPlayerIndex].id,bob.id);

// Termina corretamente ao fim da rodada configurada.
while(room.status!=='finished'){
  cp=room.players[room.currentPlayerIndex];
  e.rollDice(room,cp.id);
  e.endTurn(room,cp.id);
}
const pubFinished=e.publicState(room);
assert.equal(pubFinished.status,'finished');
assert.ok(pubFinished.winner);
assert.equal(pubFinished.ranking.length,2);

// As 2.000 missões de um ciclo não podem repetir.
const deckRoom=e.createRoomState('A','Cientista','DECK00',{maxRounds:0});
e.joinPlayer(deckRoom,'B','Designer');
e.startGame(deckRoom,deckRoom.hostId);
const seen=new Set();
for(let i=0;i<2000;i++){
  const p=deckRoom.players[deckRoom.currentPlayerIndex];
  e.rollDice(deckRoom,p.id);
  assert(!seen.has(deckRoom.lastMission.id),`Missão repetida antes de concluir o ciclo: ${deckRoom.lastMission.id}`);
  seen.add(deckRoom.lastMission.id);
  e.endTurn(deckRoom,p.id);
}
assert.equal(seen.size,2000);
assert.equal(deckRoom.missionCursor,2000);
// A próxima rolagem reinicia o ciclo de forma segura.
cp=deckRoom.players[deckRoom.currentPlayerIndex];e.rollDice(deckRoom,cp.id);assert.equal(deckRoom.missionCursor,1);

// Salário: cada jogador recebe R$ 10.000 a cada 10 turnos pessoais.
const sal=e.createRoomState('A','Contador(a)','SAL000',{maxRounds:0});
e.joinPlayer(sal,'B','Administrador(a)');e.startGame(sal,sal.hostId);
for(let i=0;i<20;i++){const p=sal.players[sal.currentPlayerIndex];e.rollDice(sal,p.id);e.endTurn(sal,p.id);}
assert.equal(sal.players[0].turns,10);assert.equal(sal.players[1].turns,10);
assert.ok(sal.log.some(x=>x.includes('recebeu salário')),'Deve registrar pagamento de salário');

// Migração de save antigo mantém estado jogável.
const legacy={code:'LOCAL01',hostId:'x',status:'lobby',phase:'lobby',version:1,currentPlayerIndex:0,round:1,missionDeck:[...Array(500).keys()],missionCursor:0,lastRoll:null,lastMission:null,log:[],players:[{id:'x',name:'Legado',profession:'Professor(a)',balance:10000,assets:[],positionMeters:0,totalDistance:0,turns:0,knowledge:0,wellbeing:0}]};
const migrated=e.migrateState(legacy);assert.equal(migrated.settings.salary,10000);assert.equal(migrated.players[0].name,'Legado');assert.equal(migrated.history.length,0);assert.equal(migrated.missionDeck.length,2000);assert.equal(migrated.missionCursor,0);

const pub=e.publicState(sal);assert.ok(pub.players[0].progressScore>=0||Number.isFinite(pub.players[0].progressScore));assert.equal(pub.city.length,30);

// V5: seleção de transporte e compra de veículos.
assert.equal(e.transportForDistance(200).label,'A pé');
assert.equal(e.transportForDistance(500).label,'A pé');
assert.equal(e.transportForDistance(600).label,'Moto');
assert.equal(e.transportForDistance(1500).label,'Moto');
assert.equal(e.transportForDistance(1600).label,'Carro');
assert.equal(e.transportForDistance(10000).label,'Helicóptero');
assert.equal(e.transportForDistance(30000).label,'Jato');
const vr=e.createRoomState('NR',e.PROFESSIONS[0],'V5TEST',{maxRounds:10});const vp=e.joinPlayer(vr,'B',e.PROFESSIONS[1]);e.startGame(vr,vr.hostId);const before=vr.players[0].balance;e.purchaseVehicle(vr,vr.hostId,'suv_pearl');assert.equal(vr.players[0].vehicles.length,1);assert.ok(vr.players[0].liabilities>0);assert.ok(vr.players[0].balance<before);assert.ok(e.publicState(vr).players[0].vehicleValue>0);assert.throws(()=>e.purchaseVehicle(vr,vr.hostId,'suv_pearl'),/já está na sua garagem/);assert.equal(e.publicState(vr).lastPurchase.playerName,'NR');

// V5: artefatos PWA essenciais.
const fs=require('fs'),path=require('path');
for(const rel of ['public/manifest.webmanifest','public/sw.js','public/icons/icon-192.png','public/icons/icon-512.png','public/index.html','standalone/Imob_Velocity_V5_Standalone.html']){
  assert.ok(fs.existsSync(path.join(__dirname,rel)),`Arquivo PWA/standalone ausente: ${rel}`);
}
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'public/manifest.webmanifest'),'utf8'));
assert.equal(manifest.display,'standalone');assert.ok(manifest.icons.length>=3);
const html=fs.readFileSync(path.join(__dirname,'public/index.html'),'utf8');
assert.ok(html.includes('rel="manifest"'));assert.ok(html.includes('installPwaBtn'));assert.ok(html.includes('0,5×'));

console.log('QA V5 OK: 2.000 missões únicas, ciclo completo sem repetição, multiplayer/turnos, salário, fim de partida, migração, ranking, veículos, PWA e standalone validados.');
