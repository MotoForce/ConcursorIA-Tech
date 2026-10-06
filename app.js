'use strict';
(() => {
  const $=s=>document.querySelector(s), core=globalThis.ImobCore;
  if(!core){alert('Falha ao carregar o núcleo do jogo.');return;}
  const fmt=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(n)||0);
  const num=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
  const LS={mode:'iv4Mode',player:'iv4Player',room:'iv4Room',server:'iv4Server',local:'iv4LocalState'};
  const OLD_LOCAL='iv3LocalState';
  const ASSET=name=>(globalThis.IMOB_ASSETS&&globalThis.IMOB_ASSETS[name])||`assets/${name}.webp`;
  let cinematicTimer=null,cinematicInterval=null,cinSpeed=1,lastCinematicKey='',lastPurchaseKey='';
  const volatileStore=new Map();
  function storeGet(key){try{const v=localStorage.getItem(key);if(v!==null)return v;}catch{}return volatileStore.has(key)?volatileStore.get(key):null;}
  function storeSet(key,value){const v=String(value);volatileStore.set(key,v);try{localStorage.setItem(key,v);}catch{}return v;}
  function storeRemove(key){volatileStore.delete(key);try{localStorage.removeItem(key);}catch{}}
  let mode='local', playerId='', roomCode='', state=null, poller=null, busy=false, lastWinnerVersion=-1;
  let cam={angle:-0.68,zoom:.93}, dragging=false,lastX=0,pointers=new Map(),pinchDist=0,sceneTime=0,lastFrame=0;
  const reduceMotion=matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;

  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function toast(message,ms=3000){const t=$('#toast');t.textContent=message;t.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add('hidden'),ms);}
  function setBusy(v){busy=v;['#createLocal','#createOnline','#joinOnline','#start','#roll','#end','#confirmAdd','#vehicleStore'].forEach(s=>{const el=$(s);if(el)el.disabled=v;});}
  function populateProfessions(){const html=core.PROFESSIONS.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');$('#profession').innerHTML=html;$('#newProfession').innerHTML=html;updateProfessionHint();}
  function updateProfessionHint(){const p=$('#profession').value;$('#professionHint').textContent=core.PROFESSION_HINTS[p]||'';}
  function defaultServer(){if(location.protocol==='http:'||location.protocol==='https:')return location.origin;return storeGet(LS.server)||'';}
  function normalizedServer(){let v=$('#serverUrl').value.trim();if(!v)return '';v=v.replace(/\/+$/,'');if(!/^https?:\/\//i.test(v))v='https://'+v;return v;}
  function setMode(next){
    mode=next==='online'?'online':'local';storeSet(LS.mode,mode);
    $('#tabLocal').classList.toggle('active',mode==='local');$('#tabOnline').classList.toggle('active',mode==='online');
    $('#tabLocal').setAttribute('aria-selected',String(mode==='local'));$('#tabOnline').setAttribute('aria-selected',String(mode==='online'));
    $('#localPanel').classList.toggle('hidden',mode!=='local');$('#onlinePanel').classList.toggle('hidden',mode!=='online');
    $('#modeBadge').textContent=mode==='local'?'Modo local':'Modo online';$('#modeBadge').className='badge '+mode;
    if(mode==='online')checkServer();
  }
  async function api(path,opt={}){
    const base=normalizedServer();if(!base)throw new Error('Informe o endereço do servidor online.');
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
    try{
      const r=await fetch(base+path,{headers:{'Content-Type':'application/json'},signal:ctrl.signal,...opt});let j={};try{j=await r.json();}catch{}
      if(!r.ok)throw new Error(j.error||`Falha HTTP ${r.status}`);return j;
    }catch(e){
      if(e.name==='AbortError')throw new Error('Servidor não respondeu a tempo.');
      if(e instanceof TypeError)throw new Error('Servidor inacessível. Verifique a URL, o HTTPS e sua conexão.');
      throw e;
    }finally{clearTimeout(timer);}
  }
  async function checkServer(){
    const v=normalizedServer();$('#serverDot').className='dot';
    if(!v){$('#serverStatus').textContent='Informe a URL do servidor para jogar em vários aparelhos.';return false;}
    storeSet(LS.server,v);
    try{const j=await api('/api/health');$('#serverDot').className='dot ok';$('#serverStatus').textContent=`Conectado • ${j.app||'Imob Velocity'} ${j.version||''}`;return true;}
    catch(e){$('#serverDot').className='dot bad';$('#serverStatus').textContent=e.message;return false;}
  }
  function localView(){return state?core.publicState(state):null;}
  function saveLocal(){if(state)storeSet(LS.local,JSON.stringify(state));refreshResume();}
  function refreshResume(){const has=!!storeGet(LS.local)||!!storeGet(OLD_LOCAL);$('#resumeLocal').classList.toggle('hidden',!has);}
  function saveOnline(){storeSet(LS.player,playerId);storeSet(LS.room,roomCode);}
  function clearOnline(){storeRemove(LS.player);storeRemove(LS.room);}

  function createLocal(){
    try{
      const name=$('#name').value.trim();if(!name)throw new Error('Informe seu nome.');
      state=core.createRoomState(name,$('#profession').value,core.localCode(),{maxRounds:Number($('#maxRounds').value)});
      mode='local';playerId=state.hostId;roomCode=state.code;saveLocal();enterGame();render(localView());toast('Partida criada. Adicione pelo menos mais um participante.');
    }catch(e){toast(e.message);}
  }
  function resumeLocal(){
    try{
      let raw=storeGet(LS.local);if(!raw){raw=storeGet(OLD_LOCAL);if(raw)storeRemove(OLD_LOCAL);}
      if(!raw)throw new Error('Nenhuma partida salva.');state=core.migrateState(JSON.parse(raw));mode='local';playerId=state.hostId;roomCode=state.code||core.localCode();saveLocal();enterGame();render(localView());toast('Partida restaurada.');
    }catch(e){storeRemove(LS.local);toast('O salvamento não pôde ser restaurado.');}
  }
  async function createOnline(){
    if(busy)return;setBusy(true);
    try{
      const name=$('#name').value.trim();if(!name)throw new Error('Informe seu nome.');if(!await checkServer())throw new Error('Servidor online indisponível.');
      const j=await api('/api/rooms',{method:'POST',body:JSON.stringify({name,profession:$('#profession').value,maxRounds:Number($('#maxRounds').value)})});
      mode='online';playerId=j.playerId;state=j.state;roomCode=state.code;saveOnline();enterGame();render(state);startPolling();
    }catch(e){toast(e.message);}finally{setBusy(false);}
  }
  async function joinOnline(){
    if(busy)return;setBusy(true);
    try{
      const name=$('#name').value.trim();if(!name)throw new Error('Informe seu nome.');const c=$('#roomCode').value.trim().toUpperCase();
      if(!/^[A-F0-9]{6}$/.test(c))throw new Error('Informe o código de sala com 6 caracteres.');if(!await checkServer())throw new Error('Servidor online indisponível.');
      const j=await api(`/api/rooms/${c}/join`,{method:'POST',body:JSON.stringify({name,profession:$('#profession').value})});
      mode='online';playerId=j.playerId;state=j.state;roomCode=c;saveOnline();enterGame();render(state);startPolling();
    }catch(e){toast(e.message);}finally{setBusy(false);}
  }
  function enterGame(){
    $('#entry').classList.add('hidden');$('#game').classList.remove('hidden');$('#roomBadge').textContent=mode==='local'?'Partida local':'Sala '+roomCode;
    $('#copy').classList.toggle('hidden',mode!=='online');$('#exportSave').classList.toggle('hidden',mode!=='local');
    $('#modeBadge').textContent=mode==='local'?'Modo local':'Modo online';$('#modeBadge').className='badge '+mode;setTimeout(resize,40);window.scrollTo({top:0,behavior:'smooth'});
  }
  function leave(){clearInterval(poller);poller=null;if(mode==='online')clearOnline();state=null;playerId='';roomCode='';lastWinnerVersion=-1;$('#game').classList.add('hidden');$('#entry').classList.remove('hidden');refreshResume();window.scrollTo({top:0,behavior:'smooth'});}
  async function act(action){
    if(busy)return;setBusy(true);
    try{
      if(mode==='local'){
        if(action==='start')core.startGame(state,state.hostId);
        else if(action==='roll'){const cp=state.players[state.currentPlayerIndex];core.rollDice(state,cp.id);await animateDice(state.lastRoll.value);saveLocal();const v=localView();render(v);await showMissionCinematic(v);return;}
        else if(action==='end'){const cp=state.players[state.currentPlayerIndex];core.endTurn(state,cp.id);}
        saveLocal();render(localView());return;
      }
      let j;
      if(action==='roll'){j=await api(`/api/rooms/${roomCode}/roll`,{method:'POST',body:JSON.stringify({playerId})});await animateDice(j.state.lastRoll?.value);state=j.state;render(state);await showMissionCinematic(state);return;}
      else j=await api(`/api/rooms/${roomCode}/${action}`,{method:'POST',body:JSON.stringify({playerId})});
      state=j.state;render(state);
    }catch(e){toast(e.message);}finally{setBusy(false);}
  }

  function currentView(){return mode==='local'?localView():state;}
  function sceneKey(view){const k=String(view?.lastMission?.locationKind||view?.lastRoll?.location?.kind||'').toLowerCase();const n=String(view?.lastMission?.locationName||'').toLowerCase();if(k.includes('praia')||k.includes('marina')||n.includes('praia')||n.includes('orla'))return 'beach';if(k.includes('shopping')||k.includes('loja')||n.includes('shopping')||n.includes('galeria'))return 'shopping';if(k.includes('combust')||k.includes('oficina')||n.includes('posto'))return 'gas';return 'city';}
  function missionTransport(view){const m=view?.lastMission||{};return m.transport||core.transportForDistance?.(m.travelDistance||view?.lastRoll?.distance||0)||{label:'A pé',icon:'🚶',key:'walk'};}
  function resetCinematicAnimation(){const bg=$('#cinematicBg'),trav=$('#traveler'),bar=$('#cinProgressBar');[bg,trav,bar].forEach(el=>{if(!el)return;el.style.animation='none';void el.offsetWidth;el.style.animation='';});}
  function scheduleCinematicFinish(){
    clearTimeout(cinematicTimer);clearInterval(cinematicInterval);
    const duration=Math.max(2500,7600/cinSpeed),seconds=Math.max(2,Math.ceil(duration/1000));let remaining=seconds;
    $('#cinTime').textContent=`Trajeto • ${remaining}s`;
    cinematicInterval=setInterval(()=>{remaining=Math.max(0,remaining-1);$('#cinTime').textContent=remaining?`Trajeto • ${remaining}s`:'Chegada ao destino';},1000);
    cinematicTimer=setTimeout(hideMissionCinematic,duration+450);
  }
  function setCinematicSpeed(f){cinSpeed=Number(f)||1;document.documentElement.style.setProperty('--travel-duration',`${Math.max(2.4,7.6/cinSpeed)}s`);document.querySelectorAll('.speedBtn').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===cinSpeed));resetCinematicAnimation();if(!$('#missionCinematic').classList.contains('hidden'))scheduleCinematicFinish();}
  function hideMissionCinematic(){clearTimeout(cinematicTimer);clearInterval(cinematicInterval);cinematicTimer=cinematicInterval=null;$('#missionCinematic').classList.add('hidden');}
  async function showMissionCinematic(view){
    if(!view?.lastMission||!view?.lastRoll)return;const key=`${view.version}-${view.lastMission.id}-${view.lastMission.playerId}`;if(key===lastCinematicKey)return;lastCinematicKey=key;
    const m=view.lastMission,t=missionTransport(view),scene=sceneKey(view),player=view.players.find(p=>p.id===m.playerId)||view.players[view.currentPlayerIndex];
    $('#cinematicBg').style.backgroundImage=`url("${ASSET(scene)}")`;$('#cinFocus').textContent=`🎯 Foco: ${m.locationName||'Destino'}`;
    $('#cinTitle').textContent=String(m.title||'Missão').split(' — ')[0];$('#cinDescription').textContent=m.description||'';$('#cinDestination').textContent=m.locationName||'Cidade';
    const d=Number(m.travelDistance||view.lastRoll.distance||0);$('#cinDistance').textContent=d>=1000?`${(d/1000).toFixed(d>=10000?0:1).replace('.',',')} km`:`${d} m`;
    $('#cinTransport').textContent=`${t.icon||'🚶'} ${t.label||'A pé'}`;$('#travelerVehicle').textContent=t.icon||'🚶';$('#travelerAvatar').textContent=(player?.name||'NR').slice(0,2).toUpperCase();
    $('#cinCost').textContent=m.delta?`${m.delta<0?'−':'+'}${fmt(Math.abs(m.delta))}`:'Sem alteração';$('#missionCinematic').classList.remove('hidden');setCinematicSpeed(1);scheduleCinematicFinish();
  }
  function renderVehicleStore(view){const cur=view?.players?.[view.currentPlayerIndex],me=mode==='local'?cur:(view?.players?.find(p=>p.id===playerId)||cur);const owned=new Set((me?.vehicles||[]).map(v=>v.modelId));
    $('#vehicleCards').innerHTML=(core.VEHICLES||[]).map(v=>`<article class="vehicleCard"><img src="${ASSET(v.id==='suv_pearl'?'suv':'pickup')}" alt="${escapeHtml(v.name)}"><div class="vehicleBody"><h3>${escapeHtml(v.icon)} ${escapeHtml(v.name)}</h3><p class="tiny">${escapeHtml(v.description)}</p><div class="vehiclePrice">${fmt(v.price)}</div><div class="tiny">Entrada no jogo: <b>${fmt(v.downPayment)}</b> • restante registrado como financiamento.</div><button class="btn wide ${owned.has(v.id)?'secondary':''}" data-buy-vehicle="${v.id}" type="button" ${owned.has(v.id)?'disabled':''} style="margin-top:10px">${owned.has(v.id)?'Na garagem':'Comprar'}</button></div></article>`).join('');
    document.querySelectorAll('[data-buy-vehicle]').forEach(b=>b.onclick=()=>buyVehicle(b.dataset.buyVehicle));
  }
  function openVehicleStore(){const view=currentView();if(!view||view.status!=='playing'){toast('Inicie a partida para acessar a loja.');return;}renderVehicleStore(view);$('#vehicleModal').classList.remove('hidden');}
  function closeVehicleStore(){$('#vehicleModal').classList.add('hidden');}
  async function buyVehicle(vehicleId){if(busy)return;setBusy(true);try{let view;
    if(mode==='local'){const cp=state.players[state.currentPlayerIndex];core.purchaseVehicle(state,cp.id,vehicleId);saveLocal();view=localView();render(view);}else{const j=await api(`/api/rooms/${roomCode}/buy-vehicle`,{method:'POST',body:JSON.stringify({playerId,vehicleId})});state=j.state;view=state;render(view);}closeVehicleStore();
    }catch(e){toast(e.message,4200);}finally{setBusy(false);}}
  function purchaseKey(p){return p?`${p.at||0}:${p.playerId||''}:${p.vehicle?.id||''}`:'';}
  function maybeShowPurchase(view){const p=view?.lastPurchase;if(!p)return;const key=purchaseKey(p);if(!key||key===lastPurchaseKey)return;lastPurchaseKey=key;if(Date.now()-(Number(p.at)||0)>60000)return;showPurchaseReveal(p,view);}
  function showPurchaseReveal(purchase,view){if(!purchase)return;const v=purchase.vehicle||{},reveal=$('#purchaseReveal'),card=reveal.querySelector('.purchaseCard'),buyer=String(purchase.playerName||view?.players?.find(p=>p.id===purchase.playerId)?.name||'Jogador').trim()||'Jogador';$('#purchaseHero').style.backgroundImage=`url("${ASSET(v.id==='pickup_premium'?'pickup':'purchase')}")`;$('#purchaseHeadline').textContent='Compra concluída!';$('#purchaseMessage').textContent=`${buyer} comprou um carro novo!`;$('#purchaseDetails').innerHTML=`<b>${escapeHtml(v.icon||'🚙')} ${escapeHtml(v.name||'Veículo')}</b><br>Comprador: <b>${escapeHtml(buyer)}</b> • valor de referência no jogo: ${fmt(v.price||0)} • entrada ${fmt(purchase.downPayment||0)} • financiamento registrado ${fmt(purchase.financed||0)}.`;reveal.classList.remove('hidden');if(card){card.classList.remove('celebrate');void card.offsetWidth;card.classList.add('celebrate');}}
  function hidePurchaseReveal(){$('#purchaseReveal').classList.add('hidden');}

  function startPolling(){
    clearInterval(poller);if(mode!=='online')return;
    poller=setInterval(async()=>{if(busy||document.visibilityState==='hidden')return;try{const j=await api(`/api/rooms/${roomCode}`);if(!state||j.state.version!==state.version){state=j.state;render(state);}}catch{}},1700);
  }
  function restoreOnline(){
    const p=storeGet(LS.player),r=storeGet(LS.room);if(!p||!r||mode!=='online')return;
    playerId=p;roomCode=r;api(`/api/rooms/${r}`).then(j=>{state=j.state;enterGame();render(state);startPolling();}).catch(()=>clearOnline());
  }

  function showAdd(){if(mode!=='local'||!state||state.status!=='lobby')return;$('#newName').value='';$('#addModal').classList.remove('hidden');setTimeout(()=>$('#newName').focus(),60);}
  function confirmAdd(){
    try{core.joinPlayer(state,$('#newName').value,$('#newProfession').value);saveLocal();render(localView());$('#addModal').classList.add('hidden');toast('Participante adicionado.');}
    catch(e){toast(e.message);}
  }
  function removeLocal(id){try{core.removePlayer(state,id);saveLocal();render(localView());toast('Participante removido.');}catch(e){toast(e.message);}}

  function exportBackup(){
    if(mode!=='local'||!state)return;const payload={app:'Imob Velocity',version:core.VERSION,exportedAt:new Date().toISOString(),state};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`imob-velocity-v4-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Backup gerado.');
  }
  function importBackupFile(file){
    if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result||''));state=core.migrateState(parsed.state||parsed);mode='local';playerId=state.hostId;roomCode=state.code||core.localCode();saveLocal();enterGame();render(localView());toast('Backup importado com sucesso.');}catch(e){toast('Arquivo de backup inválido.');}};reader.onerror=()=>toast('Não foi possível ler o arquivo.');reader.readAsText(file);
  }

  function showWinner(view){
    if(view.status!=='finished'||!view.winner||lastWinnerVersion===view.version)return;lastWinnerVersion=view.version;
    const rank=view.ranking||[];$('#winnerBody').innerHTML=`<p style="text-align:center"><b>${escapeHtml(view.winner.name)}</b> liderou o índice de evolução com <b>${num(view.winner.progressScore)}</b> pontos.</p><div class="list">${rank.map(r=>`<div class="historyLine"><b>${r.rank}º ${escapeHtml(r.name)}</b> • ${num(r.progressScore)} pts • ${fmt(r.netWorth)}</div>`).join('')}</div>`;$('#winnerModal').classList.remove('hidden');
  }

  function render(view){
    if(!view)return;
    const cur=view.players[view.currentPlayerIndex]||view.players[0];const me=mode==='local'?cur:(view.players.find(p=>p.id===playerId)||cur);
    $('#roundBadge').textContent=view.settings?.maxRounds?`Rodada ${view.round}/${view.settings.maxRounds}`:`Rodada ${view.round}`;
    $('#hudMissions').textContent=`${view.missionsRemaining} missões restantes`;
    {const total=view.rules?.totalMissions||core.TOTAL_MISSIONS||2000;$('#missionCount').textContent=`${total-view.missionsRemaining}/${num(total)} usadas`;}
    $('#playersCount').textContent=`${view.players.length}/6`;
    $('#statusLabel').textContent=view.status==='lobby'?'Lobby':view.status==='finished'?'Concluída':'Em jogo';
    $('#turnBadge').textContent=view.status==='lobby'?`Lobby • ${view.players.length}/6`:view.status==='finished'?'Partida concluída':`Vez de ${cur?.name||'—'}`;
    $('#turnName').textContent=view.status==='lobby'?'Prepare os participantes':view.status==='finished'?'Partida concluída':cur?.name||'—';
    $('#turnProfession').textContent=view.status==='lobby'?'Adicione de 2 a 6 pessoas e inicie.':view.status==='finished'?'Confira o ranking final abaixo.':`${cur?.profession||''} • ${core.PROFESSION_HINTS[cur?.profession]||''}`;
    $('#cash').textContent=fmt(me?.balance||0);$('#worth').textContent=fmt(me?.netWorth||0);$('#knowledge').textContent=me?.knowledge||0;$('#wellbeing').textContent=me?.wellbeing||0;$('#liabilities').textContent=fmt(me?.liabilities||0);$('#garageCount').textContent=(me?.vehicles||[]).length;
    const score=me?.progressScore||0;$('#scoreText').textContent=`Índice de evolução: ${num(score)} pontos`;$('#scoreBar').style.width=Math.min(100,Math.max(score?4:0,score/1800))+'%';
    const loc=cur?view.city[Math.round((cur.positionMeters||0)/400)%view.city.length]:view.city[0];$('#hudLocation').textContent=loc?`${loc.icon} ${loc.name}`:'📍 Cidade';$('#hudDistance').textContent=`${num(cur?.totalDistance||0)} m percorridos`;

    const canStart=view.status==='lobby'&&view.players.length>=2&&((mode==='local')||(mode==='online'&&view.hostId===playerId));$('#start').classList.toggle('hidden',!canStart);
    $('#addPlayer').classList.toggle('hidden',!(mode==='local'&&view.status==='lobby'&&view.players.length<6));
    const canRoll=view.status==='playing'&&view.phase==='turn'&&(mode==='local'||cur?.id===playerId);$('#roll').disabled=!canRoll||busy;$('#roll').classList.toggle('pulse',canRoll&&!busy);
    const canEnd=view.status==='playing'&&view.phase==='rolled'&&(mode==='local'||cur?.id===playerId);$('#end').classList.toggle('hidden',!canEnd);
    [...document.querySelectorAll('.dieCell')].forEach(x=>x.classList.toggle('on',Number(x.dataset.n)===view.lastRoll?.value));

    const m=view.lastMission,box=$('#mission');
    if(m){
      const cls=m.delta>0?'positive':m.delta<0?'negative':'neutral';const sign=m.delta>0?'+':m.delta<0?'−':'';
      box.innerHTML=`<div class="missionHeader"><div class="missionIcon">${escapeHtml(m.icon||'🎯')}</div><div><h3>${escapeHtml(m.title)}</h3><span class="tag">${escapeHtml(m.categoryLabel||'Missão')} • ${escapeHtml(m.locationName||'Cidade')}</span></div></div><p>${escapeHtml(m.description)}</p><p class="effect ${cls}">${m.delta?`${sign}${fmt(Math.abs(m.delta))}`:'Sem alteração imediata no caixa'}</p><p class="tiny">${m.assetValue?`Ativo: ${fmt(m.assetValue)} • `:''}${m.knowledge?`+${m.knowledge} conhecimento • `:''}${m.wellbeing?`+${m.wellbeing} bem-estar • `:''}deslocamento-base ${view.lastRoll?.distance||0} m • rota da missão ${m.travelDistance||view.lastRoll?.distance||0} m • ${escapeHtml(m.transport?.label||'A pé')}.</p>`;
      box.classList.remove('reveal');void box.offsetWidth;box.classList.add('reveal');
    }else{
      box.classList.remove('reveal');box.innerHTML='<div class="missionHeader"><div class="missionIcon">🎯</div><div><h3>Aguardando lançamento</h3><span class="tag">Cidade Velocity</span></div></div><p>O dado define o deslocamento e revela uma missão ainda não usada neste ciclo.</p>';
    }

    const rankMap=new Map((view.ranking||[]).map(r=>[r.id,r.rank]));
    $('#players').innerHTML=view.players.map((p,i)=>{
      const rm=(mode==='local'&&view.status==='lobby'&&p.id!==view.hostId)?`<button class="remove" data-remove="${p.id}" type="button">remover</button>`:'';
      const ach=(p.achievements||[]).slice(0,4).map(a=>`<span class="achievement" title="${escapeHtml(a.label)}">${escapeHtml(a.icon)} ${escapeHtml(a.label)}</span>`).join('');
      return `<div class="player ${i===view.currentPlayerIndex&&view.status==='playing'?'turn':''}"><div class="avatar">${escapeHtml((p.name||'?')[0])}</div><div><b>${escapeHtml(p.name)}</b> <span class="rank">#${rankMap.get(p.id)||i+1}</span><div class="meta">${escapeHtml(p.profession)} • ${p.assets.length} ativos • ${(p.vehicles||[]).length} veículos • ${num(p.totalDistance)} m</div><div class="achievementRow">${ach}</div></div><div class="playerRight"><b>${fmt(p.netWorth)}</b><div class="tiny">${num(p.progressScore)} pts</div>${rm}</div></div>`;
    }).join('');
    document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeLocal(b.dataset.remove));

    $('#history').innerHTML=(view.history||[]).slice(0,18).map(h=>`<div class="historyLine"><b>${escapeHtml(h.playerName)}</b> • dado ${h.roll} • ${h.distance} m<br>${escapeHtml(h.title)} em ${escapeHtml(h.locationName)} • <span class="${h.delta>0?'positive':h.delta<0?'negative':'neutral'}">${h.delta>0?'+':h.delta<0?'−':''}${h.delta?fmt(Math.abs(h.delta)):'sem alteração no caixa'}</span></div>`).join('')||'<div class="historyLine">Nenhuma missão concluída.</div>';
    const assets=me?.assets||[];$('#assetsTotal').textContent=fmt(me?.assetValue||0);$('#assets').innerHTML=assets.map(a=>`<div class="assetLine"><b>${escapeHtml(a.name)}</b><br>${escapeHtml(a.locationName||'Cidade')} • ${fmt(a.value)}</div>`).join('')||'<div class="assetLine">Nenhum ativo registrado.</div>';const vehicles=me?.vehicles||[];$('#vehicleValue').textContent=fmt(me?.vehicleValue||0);$('#garage').innerHTML=vehicles.map(v=>`<div class="garageLine"><b>${escapeHtml(v.icon||'🚙')} ${escapeHtml(v.name)}</b><br>${escapeHtml(v.kind||'Veículo')} • ${fmt(v.value)}<br><span class="tiny">Financiado: ${fmt(v.financed||0)}</span></div>`).join('')||'<div class="garageLine">Nenhum veículo adquirido.</div>';
    $('#log').innerHTML=(view.log||[]).slice(0,25).map(x=>`<div class="logLine">${escapeHtml(x)}</div>`).join('')||'<div class="logLine">Nenhum evento.</div>';
    drawCity(view);showWinner(view);maybeShowPurchase(view);
  }

  function initDice(){for(let i=1;i<=6;i++)$('#dice').insertAdjacentHTML('beforeend',`<div class="dieCell" data-n="${i}" aria-label="Face ${i}">${i}</div>`);}
  async function animateDice(finalValue){const cells=[...document.querySelectorAll('.dieCell')];if(!cells.length||reduceMotion){cells.forEach(c=>c.classList.toggle('on',Number(c.dataset.n)===Number(finalValue)));return;}for(let i=0;i<10;i++){const n=1+Math.floor(Math.random()*6);cells.forEach(c=>c.classList.toggle('on',Number(c.dataset.n)===n));await new Promise(r=>setTimeout(r,50+i*6));}cells.forEach(c=>c.classList.toggle('on',Number(c.dataset.n)===Number(finalValue)));}

  const canvas=$('#city'),ctx=canvas.getContext('2d',{alpha:false});
  function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(620,Math.floor(r.width*dpr));canvas.height=Math.max(390,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);drawCity(mode==='local'&&state?localView():state);}
  function project(x,y,z,w,h){const ca=Math.cos(cam.angle),sa=Math.sin(cam.angle),rx=x*ca-y*sa,ry=x*sa+y*ca,s=cam.zoom*Math.min(w,h)/900;return [w/2+rx*s,h*.60+(ry*.50-z)*s];}
  function poly(ps,fill,stroke){ctx.beginPath();ctx.moveTo(...ps[0]);for(let i=1;i<ps.length;i++)ctx.lineTo(...ps[i]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function shade(hex,amt){let c=hex.replace('#','');if(c.length===3)c=c.split('').map(x=>x+x).join('');const n=parseInt(c,16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));return `rgb(${r},${g},${b})`;}
  function prism(x,y,z,sx,sy,sz,color,w,h){const p=(xx,yy,zz)=>project(xx,yy,zz,w,h),A=p(x-sx,y-sy,z),B=p(x+sx,y-sy,z),C=p(x+sx,y+sy,z),D=p(x-sx,y+sy,z),A2=p(x-sx,y-sy,z+sz),B2=p(x+sx,y-sy,z+sz),C2=p(x+sx,y+sy,z+sz),D2=p(x-sx,y+sy,z+sz);poly([A,B,B2,A2],shade(color,-14));poly([B,C,C2,B2],shade(color,-30));poly([A2,B2,C2,D2],shade(color,16));poly([A,D,D2,A2],shade(color,-5));}
  function tree(x,y,w,h,s=1){const p=project(x,y,0,w,h),t=project(x,y,34*s,w,h);ctx.strokeStyle='#6c4c2b';ctx.lineWidth=Math.max(2,4*s);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...t);ctx.stroke();ctx.beginPath();ctx.arc(t[0],t[1]-3,Math.max(6,10*s),0,Math.PI*2);ctx.fillStyle='#2b914e';ctx.fill();}
  function roadLine(a,b,w,h,width=18){const p1=project(a[0],a[1],0,w,h),p2=project(b[0],b[1],0,w,h);ctx.strokeStyle='#4c5966';ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...p1);ctx.lineTo(...p2);ctx.stroke();ctx.strokeStyle='#cbd5e1';ctx.lineWidth=1;ctx.setLineDash([8,9]);ctx.beginPath();ctx.moveTo(...p1);ctx.lineTo(...p2);ctx.stroke();ctx.setLineDash([]);}
  function drawCity(view){
    if(!canvas.width)return;const r=canvas.getBoundingClientRect(),w=r.width,h=r.height;if(!w||!h)return;
    const sky=ctx.createLinearGradient(0,0,0,h*.5);sky.addColorStop(0,'#73c7f6');sky.addColorStop(1,'#d8f2ff');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#63b66b';ctx.fillRect(0,h*.44,w,h*.56);ctx.fillStyle='#55b9e7';ctx.fillRect(w*.73,h*.44,w*.27,h*.56);
    ctx.beginPath();ctx.arc(w*.13,h*.13,28,0,Math.PI*2);ctx.fillStyle='#ffe18a';ctx.fill();
    for(let i=0;i<6;i++){ctx.strokeStyle=`rgba(255,255,255,${.20+i*.02})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.74,h*.55+i*22+(Math.sin(sceneTime*.002+i)*4));ctx.quadraticCurveTo(w*.86,h*.54+i*22,w,h*.56+i*22);ctx.stroke();}
    for(let i=-4;i<=4;i+=2){roadLine([-430,i*105],[430,i*105],w,h,17);roadLine([i*105,-430],[i*105,430],w,h,17);}
    const blocks=[];for(let gx=-3;gx<=3;gx++)for(let gy=-3;gy<=3;gy++){if(gx%2===0||gy%2===0)continue;const seed=(gx+5)*17+(gy+5)*31,z=38+(Math.abs(seed)%8)*15;blocks.push({x:gx*105+((seed%3)-1)*18,y:gy*105+((((seed>>1)%3))-1)*18,z,color:['#d97706','#0ea5e9','#8b5cf6','#64748b','#ef4444','#10b981','#f97316'][Math.abs(seed)%7],depth:gx+gy});}
    blocks.sort((a,b)=>a.depth-b.depth);for(const b of blocks){prism(b.x,b.y,0,29,29,b.z,b.color,w,h);for(let z=16;z<b.z-8;z+=20){const p=project(b.x,b.y-30,z,w,h);ctx.fillStyle='#dff4ff';ctx.fillRect(p[0]-7,p[1]-2,14,3);}}
    for(let i=0;i<34;i++){const a=i*2.27,rad=250+(i%5)*34;tree(Math.cos(a)*rad,Math.sin(a)*rad,w,h,.8+(i%3)*.12);}
    const labs=[[-315,-315,'🏥'],[315,-315,'🏫'],[-315,315,'🏦'],[315,315,'🛍️'],[0,-315,'✈️'],[330,0,'🏖️'],[-315,0,'🌳'],[0,315,'🏢'],[155,315,'🚁'],[-155,-315,'⛽'],[-315,160,'🏡'],[315,160,'🏟️']];ctx.font='27px system-ui';ctx.textAlign='center';for(const [x,y,t] of labs){const p=project(x,y,16,w,h);ctx.fillText(t,p[0],p[1]);}
    if(!reduceMotion){const carT=(sceneTime*.05)%760-380;for(let k=0;k<3;k++){const p=project(carT+k*95,-210+k*210,8,w,h);ctx.fillStyle=['#ef4444','#fde047','#2563eb'][k];ctx.fillRect(p[0]-7,p[1]-4,14,8);}ctx.font='22px system-ui';ctx.fillText('✈️',(sceneTime*.035)%(w+100)-50,70);}
    if(view){
      view.players.forEach((p,i)=>{const loc=view.city[Math.round((p.positionMeters||0)/400)%view.city.length],angle=(loc.id/view.city.length)*Math.PI*2,x=Math.cos(angle)*360,y=Math.sin(angle)*360,q=project(x,y,23,w,h);ctx.beginPath();ctx.arc(q[0],q[1],11+(i===view.currentPlayerIndex&&view.status==='playing'?3:0),0,Math.PI*2);ctx.fillStyle=['#fde047','#22c55e','#f472b6','#a78bfa','#fb923c','#f8fafc'][i%6];ctx.fill();ctx.strokeStyle='#0f172a';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#0f172a';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(String(i+1),q[0],q[1]+3);});
      const cp=view.players[view.currentPlayerIndex];if(cp){const loc=view.city[Math.round((cp.positionMeters||0)/400)%view.city.length];ctx.fillStyle='#06111fe8';ctx.fillRect(12,h-48,Math.min(420,w-24),34);ctx.fillStyle='#edf8ff';ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillText(`${loc.icon} ${loc.name} • ${num(cp.totalDistance||0)} m percorridos`,22,h-27);}
    }
  }
  function animationLoop(ts){sceneTime=ts;if(!reduceMotion&&ts-lastFrame>120&&!$('#game').classList.contains('hidden')&&document.visibilityState==='visible'){lastFrame=ts;drawCity(mode==='local'&&state?localView():state);}requestAnimationFrame(animationLoop);}

  canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){dragging=true;lastX=e.clientX;}try{canvas.setPointerCapture(e.pointerId);}catch{}});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1&&dragging){cam.angle+=(e.clientX-lastX)*.008;lastX=e.clientX;drawCity(mode==='local'&&state?localView():state);}else if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchDist)cam.zoom=Math.max(.55,Math.min(1.55,cam.zoom+(d-pinchDist)*.002));pinchDist=d;drawCity(mode==='local'&&state?localView():state);}});
  function pointerUp(e){pointers.delete(e.pointerId);dragging=false;pinchDist=0;}canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
  canvas.addEventListener('wheel',e=>{e.preventDefault();cam.zoom=Math.max(.55,Math.min(1.55,cam.zoom-e.deltaY*.001));drawCity(mode==='local'&&state?localView():state);},{passive:false});

  function openRules(){$('#rulesModal').classList.remove('hidden');}
  function closeRules(){$('#rulesModal').classList.add('hidden');}
  let deferredInstallPrompt=null;
  function isStandaloneDisplay(){return matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;}
  function updateInstallButton(){
    const btn=$('#installPwaBtn');if(!btn)return;
    if(isStandaloneDisplay()||location.protocol==='file:'){btn.classList.add('hidden');return;}
    const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    if(deferredInstallPrompt||isiOS)btn.classList.remove('hidden');else btn.classList.add('hidden');
  }
  async function installPwa(){
    if(isStandaloneDisplay()){toast('O Imob Velocity já está instalado.');return;}
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      const choice=await deferredInstallPrompt.userChoice.catch(()=>({outcome:'dismissed'}));
      deferredInstallPrompt=null;updateInstallButton();
      toast(choice.outcome==='accepted'?'Instalação iniciada.':'Instalação cancelada.');
      return;
    }
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)){toast('No iPhone/iPad: Compartilhar → Adicionar à Tela de Início.',6500);return;}
    toast('Para instalar, abra esta versão em HTTPS ou localhost e use o menu do navegador → Instalar app.',6500);
  }
  function initPwa(){
    addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;updateInstallButton();});
    addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateInstallButton();toast('Imob Velocity instalado com sucesso.');});
    updateInstallButton();
    if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  }
  async function init(){
    populateProfessions();initDice();initPwa();$('#serverUrl').value=defaultServer();refreshResume();
    const requested=storeGet(LS.mode);setMode(requested==='online'?'online':'local');if(mode==='online')restoreOnline();resize();requestAnimationFrame(animationLoop);
  }

  const installBtn=$('#installPwaBtn');if(installBtn)installBtn.onclick=installPwa;
  $('#tabLocal').onclick=()=>setMode('local');$('#tabOnline').onclick=()=>setMode('online');$('#profession').onchange=updateProfessionHint;
  $('#serverUrl').onchange=checkServer;$('#serverUrl').onblur=checkServer;$('#createLocal').onclick=createLocal;$('#resumeLocal').onclick=resumeLocal;$('#createOnline').onclick=createOnline;$('#joinOnline').onclick=joinOnline;
  $('#start').onclick=()=>act('start');$('#roll').onclick=()=>act('roll');$('#end').onclick=()=>act('end');$('#vehicleStore').onclick=openVehicleStore;$('#closeVehicle').onclick=closeVehicleStore;$('#addPlayer').onclick=showAdd;$('#confirmAdd').onclick=confirmAdd;$('#cancelAdd').onclick=()=>$('#addModal').classList.add('hidden');
  $('#addModal').onclick=e=>{if(e.target===$('#addModal'))$('#addModal').classList.add('hidden');};$('#leave').onclick=leave;
  $('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);toast('Código copiado: '+roomCode);}catch{toast('Código da sala: '+roomCode,4500);}};
  $('#exportSave').onclick=exportBackup;$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=e=>{importBackupFile(e.target.files?.[0]);e.target.value='';};
  $('#rulesBtn').onclick=openRules;$('#closeRules').onclick=closeRules;$('#rulesModal').onclick=e=>{if(e.target===$('#rulesModal'))closeRules();};$('#winnerClose').onclick=()=>$('#winnerModal').classList.add('hidden');$('#skipCinematic').onclick=hideMissionCinematic;document.querySelectorAll('.speedBtn').forEach(b=>b.onclick=()=>setCinematicSpeed(b.dataset.speed));$('#purchaseContinue').onclick=hidePurchaseReveal;$('#purchaseGarage').onclick=()=>{hidePurchaseReveal();document.getElementById('garage')?.scrollIntoView({behavior:'smooth',block:'center'});};
  addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state)drawCity(mode==='local'?localView():state);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#addModal').classList.add('hidden');$('#rulesModal').classList.add('hidden');$('#winnerModal').classList.add('hidden');closeVehicleStore();hideMissionCinematic();hidePurchaseReveal();}});
  init();
})();
