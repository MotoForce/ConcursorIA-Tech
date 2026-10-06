'use strict';
(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory(require('crypto'));}
  else{root.ImobCore=factory(null);}
})(typeof globalThis!=='undefined'?globalThis:this,function(nodeCrypto){
  const VERSION='5.0.0';
  const MAX_PLAYERS=6;
  const MIN_PLAYERS=2;
  const SALARY=10000;
  const SALARY_EVERY_TURNS=10;
  const BASE_DISTANCE=400;
  const MULTIPLIERS={1:0.5,2:0.75,3:1,4:1.25,5:1.5,6:2};
  const ROUTE_STEP=400;
  const TOTAL_MISSIONS=2000;

  const PROFESSIONS=[
    'Analista de Sistemas','Professor(a)','Médico(a)','Engenheiro(a)','Arquiteto(a)','Enfermeiro(a)',
    'Designer','Empreendedor(a)','Pesquisador(a)','Advogado(a)','Administrador(a)','Fotógrafo(a)',
    'Cientista','Psicólogo(a)','Contador(a)','Jornalista','Fisioterapeuta','Chef de Cozinha'
  ];
  const PROFESSION_HINTS={
    'Analista de Sistemas':'Tecnologia, automação e soluções digitais',
    'Professor(a)':'Educação, aprendizagem e desenvolvimento',
    'Médico(a)':'Saúde, prevenção e cuidado',
    'Engenheiro(a)':'Projetos, infraestrutura e planejamento',
    'Arquiteto(a)':'Cidade, espaços e experiência urbana',
    'Enfermeiro(a)':'Saúde, acolhimento e organização do cuidado',
    'Designer':'Criatividade, comunicação e experiência',
    'Empreendedor(a)':'Negócios, inovação e oportunidades',
    'Pesquisador(a)':'Ciência, investigação e evidências',
    'Advogado(a)':'Direitos, negociação e organização documental',
    'Administrador(a)':'Gestão, estratégia e organização',
    'Fotógrafo(a)':'Imagem, comunicação e criatividade',
    'Cientista':'Ciência, experimentação e inovação',
    'Psicólogo(a)':'Bem-estar, relações e tomada de decisão',
    'Contador(a)':'Organização financeira e planejamento',
    'Jornalista':'Informação, comunicação e apuração',
    'Fisioterapeuta':'Saúde, movimento e qualidade de vida',
    'Chef de Cozinha':'Alimentação, hospitalidade e criatividade'
  };

  const CITY_LOCATIONS=[
    ['Praça Central','praça','🏛️'],['Escola Horizonte','escola','🏫'],['Hospital Vida','hospital','🏥'],['Banco Aurora','banco','🏦'],
    ['Mercado Estação','mercado','🛒'],['Shopping Velocity','shopping','🛍️'],['Parque das Águas','parque','🌳'],['Residencial Mirante','apartamentos','🏢'],
    ['Vila das Casas','casas','🏘️'],['Orla Azul','praia','🏖️'],['Marina Solar','marina','⛵'],['Aeroporto Central','aeroporto','✈️'],
    ['Heliponto Executivo','helicóptero','🚁'],['Terminal de Jatos','jatos','🛩️'],['Distrito Empresarial','empresas','🏙️'],['Centro de Inovação','tecnologia','💻'],
    ['Universidade Cívica','universidade','🎓'],['Centro Cultural','cultura','🎭'],['Arena Municipal','esporte','🏟️'],['Posto Energia','combustível','⛽'],
    ['Condomínio Lux','prédios de luxo','🏨'],['Galeria Comercial','lojas','🏬'],['Hotel Panorama','hotel','🏨'],['Bosque Urbano','vegetação','🌲'],
    ['Centro Administrativo','instituição','🏛️'],['Restaurante Jardins','restaurante','🍽️'],['Oficina Rápida','oficina','🔧'],['Estação Verde','transporte','🚉'],
    ['Casa de Praia Coral','casa de praia','🏡'],['Clube Social','lazer','🎉']
  ].map((x,i)=>({id:i,name:x[0],kind:x[1],icon:x[2],meter:i*ROUTE_STEP}));


  const VEHICLES=[
    {id:'suv_pearl',name:'SUV Premium Pérola',kind:'SUV 7 lugares',icon:'🚙',price:285000,downPayment:8000,description:'SUV premium branco perolizado, confortável para missões urbanas e viagens.'},
    {id:'pickup_premium',name:'Picape Premium',kind:'Picape cabine dupla',icon:'🛻',price:315000,downPayment:9000,description:'Picape robusta de cabine dupla, preparada para trajetos urbanos e estradas.'}
  ];

  const CATEGORY_META={
    expense:{label:'Despesa',icon:'🧾'}, income:{label:'Receita',icon:'💰'}, study:{label:'Estudo',icon:'🎓'},
    health:{label:'Saúde',icon:'🩺'}, social:{label:'Convivência',icon:'🎉'}, travel:{label:'Viagem',icon:'✈️'},
    transport:{label:'Transporte',icon:'🚗'}, asset:{label:'Ativo',icon:'🏠'}, assetGift:{label:'Ativo recebido',icon:'🎁'},
    bank:{label:'Banco',icon:'🏦'}, donation:{label:'Solidariedade',icon:'🤝'}, leisure:{label:'Lazer',icon:'🌴'}
  };

  const ACTIONS=[
    {k:'expense',t:'Compras essenciais',d:'Faça compras planejadas em {place}.',min:120,max:680},
    {k:'expense',t:'Compras especiais',d:'Você encontrou uma necessidade importante em {place}.',min:350,max:1450},
    {k:'study',t:'Curso de aperfeiçoamento',d:'Invista em uma formação útil em {place}.',min:300,max:1800,knowledge:2},
    {k:'study',t:'Oficina prática',d:'Participe de uma atividade de aprendizagem em {place}.',min:120,max:850,knowledge:1},
    {k:'health',t:'Cuidados com a saúde',d:'Reserve recursos para prevenção e cuidado em {place}.',min:180,max:1300,wellbeing:1},
    {k:'social',t:'Encontro com amigos',d:'Organize uma atividade social responsável em {place}.',min:150,max:1100,wellbeing:1},
    {k:'social',t:'Festa planejada',d:'Realize uma celebração dentro do orçamento em {place}.',min:400,max:2200,wellbeing:2},
    {k:'travel',t:'Viagem curta',d:'Faça uma viagem curta partindo de {place}.',min:650,max:2400,wellbeing:1},
    {k:'travel',t:'Viagem premium',d:'Viaje com mais conforto a partir de {place}.',min:1600,max:5200,wellbeing:2},
    {k:'transport',t:'Passeio de carro',d:'Use transporte individual para cumprir compromissos em {place}.',min:90,max:520},
    {k:'transport',t:'Combustível e deslocamento',d:'Abasteça e siga sua rota pela cidade a partir de {place}.',min:120,max:620},
    {k:'income',t:'Serviço concluído',d:'Um trabalho bem executado ligado a {place} gerou receita.',min:300,max:1900},
    {k:'income',t:'Projeto entregue',d:'Você concluiu um projeto relevante em {place}.',min:700,max:3200},
    {k:'income',t:'Bônus por desempenho',d:'Seu desempenho em uma atividade de {place} trouxe um bônus.',min:250,max:1600},
    {k:'asset',t:'Entrada de imóvel',d:'Você decidiu adquirir participação em um ativo imobiliário próximo a {place}.',min:1800,max:5200,assetMin:12000,assetMax:68000},
    {k:'asset',t:'Aquisição de pequeno ativo',d:'Você adquiriu um ativo de menor porte em {place}.',min:850,max:2900,assetMin:5000,assetMax:26000},
    {k:'assetGift',t:'Ativo recebido',d:'Uma oportunidade legítima em {place} acrescentou um ativo ao seu patrimônio.',min:4000,max:18000},
    {k:'bank',t:'Serviço bancário',d:'Resolva uma necessidade bancária em {place}.',min:30,max:260},
    {k:'expense',t:'Manutenção doméstica',d:'Faça uma manutenção necessária em um imóvel próximo a {place}.',min:180,max:1600},
    {k:'expense',t:'Manutenção do veículo',d:'Faça manutenção preventiva em {place}.',min:250,max:1900},
    {k:'income',t:'Freela criativo',d:'Uma atividade extra relacionada a {place} gerou renda.',min:280,max:1500},
    {k:'study',t:'Aula especial',d:'Participe de uma aula especial em {place}.',min:90,max:680,knowledge:2},
    {k:'donation',t:'Ação solidária',d:'Você contribuiu voluntariamente para uma iniciativa em {place}.',min:80,max:600,wellbeing:2},
    {k:'donation',t:'Projeto social',d:'Você apoiou uma ação comunitária organizada em {place}.',min:150,max:900,wellbeing:3},
    {k:'leisure',t:'Dia no parque',d:'Reserve tempo para lazer e bem-estar em {place}.',min:40,max:250,wellbeing:2},
    {k:'leisure',t:'Dia de praia',d:'Aproveite um período de descanso responsável em {place}.',min:100,max:620,wellbeing:3},
    {k:'income',t:'Venda autorizada',d:'Você vendeu um bem de baixo valor durante uma oportunidade em {place}.',min:150,max:900},
    {k:'expense',t:'Compra para casa',d:'Você comprou itens úteis para sua residência em {place}.',min:220,max:1250},
    {k:'expense',t:'Tecnologia e trabalho',d:'Adquira um recurso tecnológico para trabalho ou estudo em {place}.',min:350,max:2400},
    {k:'study',t:'Livro e material',d:'Compre materiais de estudo em {place}.',min:80,max:450,knowledge:1},
    {k:'income',t:'Consultoria pontual',d:'Você prestou uma consultoria relacionada a {place}.',min:420,max:2100},
    {k:'expense',t:'Taxa de serviço',d:'Uma taxa de serviço foi cobrada em {place}.',min:25,max:220},
    {k:'expense',t:'Alimentação fora',d:'Faça uma refeição durante uma atividade em {place}.',min:45,max:260,wellbeing:1},
    {k:'income',t:'Reembolso recebido',d:'Você recebeu um reembolso referente a uma atividade em {place}.',min:90,max:650},
    {k:'asset',t:'Entrada em sala comercial',d:'Você negociou participação em um espaço comercial em {place}.',min:1500,max:4300,assetMin:10000,assetMax:52000},
    {k:'asset',t:'Entrada em casa de praia',d:'Você negociou participação em uma casa de praia próxima a {place}.',min:2200,max:6200,assetMin:18000,assetMax:80000},
    {k:'travel',t:'Voo executivo compartilhado',d:'Uma missão profissional exige deslocamento aéreo a partir de {place}.',min:1200,max:4800},
    {k:'travel',t:'Helicóptero urbano',d:'Um deslocamento especial por helicóptero foi necessário em {place}.',min:900,max:3500},
    {k:'income',t:'Evento profissional',d:'Sua participação em um evento em {place} gerou uma oportunidade remunerada.',min:280,max:1800},
    {k:'expense',t:'Evento cultural',d:'Participe de uma experiência cultural em {place}.',min:60,max:420,wellbeing:1},
    {k:'income',t:'Parceria comercial',d:'Uma parceria iniciada em {place} trouxe retorno.',min:500,max:2600},
    {k:'expense',t:'Seguro e proteção',d:'Atualize uma proteção necessária relacionada a {place}.',min:160,max:1100},
    {k:'study',t:'Certificação',d:'Faça uma certificação profissional em {place}.',min:550,max:2300,knowledge:3},
    {k:'income',t:'Premiação acadêmica',d:'Seu desempenho em uma atividade de estudo em {place} foi reconhecido.',min:200,max:1200,knowledge:1},
    {k:'expense',t:'Mudança residencial',d:'Organize uma mudança com apoio de serviços próximos a {place}.',min:700,max:2800},
    {k:'income',t:'Aluguel de ativo',d:'Um ativo seu próximo a {place} gerou receita de aluguel.',min:320,max:1450},
    {k:'expense',t:'Reforma planejada',d:'Faça uma pequena reforma relacionada a {place}.',min:600,max:3200},
    {k:'income',t:'Economia doméstica',d:'Boas escolhas em {place} reduziram despesas e preservaram seu caixa.',min:100,max:700},
    {k:'leisure',t:'Passeio pela cidade',d:'Faça um passeio cultural por {place}.',min:30,max:280,wellbeing:1},
    {k:'income',t:'Oportunidade de inovação',d:'Uma ideia aplicada em {place} gerou receita extraordinária.',min:650,max:3500,knowledge:1}
  ];
  const CONTEXTS=[
    'num dia útil','durante o fim de semana','em horário de pico','em uma manhã tranquila','ao final da tarde',
    'durante uma semana movimentada','em uma ação de planejamento','em um compromisso familiar','em uma oportunidade profissional','em uma atividade comunitária'
  ];
  const SCENARIOS=[
    {title:'planejamento',text:'A decisão foi tomada com planejamento prévio e comparação de alternativas.'},
    {title:'oportunidade',text:'Uma oportunidade inesperada surgiu e exigiu uma escolha consciente.'},
    {title:'prioridade',text:'Foi necessário equilibrar prazo, custo e prioridade antes de agir.'},
    {title:'adaptação',text:'Um pequeno imprevisto exigiu adaptação sem abandonar o objetivo principal.'}
  ];

  function seededAmount(min,max,seed){const span=max-min;const x=((seed*9301+49297)%233280)/233280;return Math.round((min+x*span)/10)*10;}
  function generateMissions(){
    const out=[];
    ACTIONS.forEach((a,ai)=>CONTEXTS.forEach((ctx,ci)=>SCENARIOS.forEach((scenario,si)=>{
      const seed=ai*137+ci*31+si*79+7;
      const meta=CATEGORY_META[a.k]||{label:'Missão',icon:'🎯'};
      out.push({
        id:out.length+1,
        title:`${a.t} — ${ctx} — ${scenario.title}`,
        descriptionTemplate:a.d,
        context:`${ctx}. ${scenario.text}`,
        category:a.k,
        categoryLabel:meta.label,
        icon:meta.icon,
        amount:seededAmount(a.min,a.max,seed),
        assetValue:a.assetMin?seededAmount(a.assetMin,a.assetMax,seed+91):0,
        knowledge:a.knowledge||0,
        wellbeing:a.wellbeing||0
      });
    })));
    if(out.length!==TOTAL_MISSIONS)throw new Error(`Missões esperadas: ${TOTAL_MISSIONS}; geradas: ${out.length}`);
    return out;
  }
  const MISSIONS=generateMissions();

  function browserRandomInt(max){
    if(typeof crypto==='undefined'||!crypto.getRandomValues)return Math.floor(Math.random()*max);
    const limit=Math.floor(0x100000000/max)*max;
    const a=new Uint32Array(1);
    do{crypto.getRandomValues(a);}while(a[0]>=limit);
    return a[0]%max;
  }
  function randomInt(max){
    if(!Number.isInteger(max)||max<=0)throw new Error('Faixa aleatória inválida.');
    if(nodeCrypto&&nodeCrypto.randomInt)return nodeCrypto.randomInt(0,max);
    return browserRandomInt(max);
  }
  function shuffle(arr){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
  function safeName(s){return String(s||'').trim().replace(/\s+/g,' ').slice(0,28);}
  function safeProfession(s){return PROFESSIONS.includes(s)?s:PROFESSIONS[0];}
  function makeId(){
    if(nodeCrypto&&nodeCrypto.randomBytes)return nodeCrypto.randomBytes(12).toString('hex');
    const a=new Uint8Array(12);
    if(typeof crypto!=='undefined'&&crypto.getRandomValues)crypto.getRandomValues(a);else for(let i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256);
    return [...a].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function normalizeMaxRounds(v){const n=Number(v);return [0,10,20,30,40,50].includes(n)?n:20;}
  function makePlayer(playerId,name,profession){return {
    id:playerId,name:safeName(name)||'Jogador',profession:safeProfession(profession),balance:SALARY,assets:[],vehicles:[],liabilities:0,positionMeters:0,totalDistance:0,
    turns:0,knowledge:0,wellbeing:0,missions:0,incomeTotal:0,expenseTotal:0,largestExpense:0,largestIncome:0
  };}
  function createRoomState(hostName,profession,code,opts={}){
    const playerId=makeId();
    return {
      code:String(code||'LOCAL').slice(0,8),hostId:playerId,status:'lobby',phase:'lobby',createdAt:Date.now(),updatedAt:Date.now(),version:1,
      currentPlayerIndex:0,round:1,missionDeck:shuffle([...Array(TOTAL_MISSIONS).keys()]),missionCursor:0,lastRoll:null,lastMission:null,
      settings:{maxRounds:normalizeMaxRounds(opts.maxRounds),salary:SALARY,salaryEveryTurns:SALARY_EVERY_TURNS},
      history:[],log:['Cidade criada. Adicione participantes e inicie quando todos estiverem prontos.'],players:[makePlayer(playerId,hostName,profession)]
    };
  }
  function touch(room){room.updatedAt=Date.now();room.version=(Number(room.version)||0)+1;}
  function joinPlayer(room,name,profession){
    if(room.status!=='lobby')throw new Error('A partida já começou.');
    if(room.players.length>=MAX_PLAYERS)throw new Error(`Sala cheia (máximo ${MAX_PLAYERS} participantes).`);
    const clean=safeName(name);if(!clean)throw new Error('Informe o nome do participante.');
    const p=makePlayer(makeId(),clean,profession);room.players.push(p);touch(room);room.log.unshift(`${p.name} entrou na cidade.`);return p;
  }
  function removePlayer(room,targetId){
    if(room.status!=='lobby')throw new Error('Participantes só podem ser removidos antes do início.');
    if(targetId===room.hostId)throw new Error('O anfitrião não pode ser removido.');
    const i=room.players.findIndex(p=>p.id===targetId);if(i<0)throw new Error('Participante não encontrado.');
    const [p]=room.players.splice(i,1);touch(room);room.log.unshift(`${p.name} saiu da cidade.`);return p;
  }
  function startGame(room,playerId){
    if(room.hostId!==playerId)throw new Error('Apenas o anfitrião pode iniciar.');
    if(room.players.length<MIN_PLAYERS)throw new Error(`São necessários pelo menos ${MIN_PLAYERS} participantes.`);
    if(room.status!=='lobby')throw new Error('A partida já foi iniciada.');
    room.status='playing';room.phase='turn';touch(room);room.log.unshift('Partida iniciada. Boa viagem pela cidade!');
  }
  function currentPlayer(room){return room.players[room.currentPlayerIndex]||null;}
  function routeLength(){return CITY_LOCATIONS.length*ROUTE_STEP;}
  function nearestLocation(position){
    const route=routeLength();const pos=((Number(position)||0)%route+route)%route;let best=CITY_LOCATIONS[0],dist=Infinity;
    for(const l of CITY_LOCATIONS){const raw=Math.abs(l.meter-pos);const d=Math.min(raw,route-raw);if(d<dist){dist=d;best=l;}}
    return {...best,distanceFromPlayer:Math.round(dist)};
  }
  function nextLocation(position){
    const route=routeLength();const pos=((Number(position)||0)%route+route)%route;const idx=Math.ceil(pos/ROUTE_STEP)%CITY_LOCATIONS.length;
    const loc=CITY_LOCATIONS[idx];return {...loc,distanceFromPlayer:Math.round((loc.meter-pos+route)%route)};
  }

  function transportForDistance(distance){
    const d=Math.max(0,Number(distance)||0);
    // Faixas alinhadas ao HUD V4: a pé até 0,5 km; moto até 1,5 km; carro até 5 km.
    if(d<=500)return {key:'walk',label:'A pé',icon:'🚶',className:'curta'};
    if(d<=1500)return {key:'moto',label:'Moto',icon:'🏍️',className:'média'};
    if(d<=5000)return {key:'car',label:'Carro',icon:'🚙',className:'longa'};
    if(d<=20000)return {key:'helicopter',label:'Helicóptero',icon:'🚁',className:'executiva'};
    return {key:'jet',label:'Jato',icon:'🛩️',className:'vip'};
  }
  function missionTravelDistance(mission,location,baseDistance){
    const t=String(mission?.title||''),kind=String(location?.kind||'').toLowerCase();
    let d=Math.max(200,Number(baseDistance)||200);
    // O dado determina o avanço-base. A rota da missão pode ser maior para representar o trajeto real até o destino.
    if(/Voo executivo|Viagem premium/i.test(t)||kind==='jatos')d=Math.max(d,28000);
    else if(/Helicóptero urbano/i.test(t)||kind==='helicóptero')d=Math.max(d,10000);
    else if(/Viagem curta/i.test(t)||kind==='aeroporto')d=Math.max(d,4500);
    else if(kind==='shopping'||kind==='lojas')d=Math.max(d,1800);
    else if(kind==='praia'||kind==='marina')d=Math.max(d,900);
    else if(kind==='combustível'||kind==='oficina')d=Math.max(d,700);
    return d;
  }

  function applyMission(player,mission){
    let delta=0,note='';
    if(['expense','health','social','travel','transport','bank','donation','leisure','study'].includes(mission.category))delta=-mission.amount;
    if(mission.category==='income')delta=mission.amount;
    if(mission.category==='asset'){
      delta=-mission.amount;
      player.assets.push({id:makeId(),name:mission.title.replace(/ —.*/,''),value:mission.assetValue,acquiredAt:Date.now(),locationName:mission.locationName});
      note=` Ativo registrado no patrimônio: R$ ${mission.assetValue.toLocaleString('pt-BR')}.`;
    }
    if(mission.category==='assetGift'){
      player.assets.push({id:makeId(),name:'Ativo recebido',value:mission.amount,acquiredAt:Date.now(),locationName:mission.locationName});
      note=` Ativo recebido no patrimônio: R$ ${mission.amount.toLocaleString('pt-BR')}.`;
    }
    player.balance+=delta;
    if(delta>0){player.incomeTotal+=delta;player.largestIncome=Math.max(player.largestIncome,delta);}
    if(delta<0){player.expenseTotal+=Math.abs(delta);player.largestExpense=Math.max(player.largestExpense,Math.abs(delta));}
    player.knowledge+=mission.knowledge||0;player.wellbeing+=mission.wellbeing||0;player.missions++;
    return {delta,note};
  }
  function ensureMissionDeck(room){
    if(room.missionCursor>=room.missionDeck.length){room.missionDeck=shuffle([...Array(TOTAL_MISSIONS).keys()]);room.missionCursor=0;room.log.unshift(`As ${TOTAL_MISSIONS} missões foram concluídas. Um novo ciclo foi reembaralhado sem repetição interna.`);}
  }
  function rollDice(room,playerId){
    if(room.status!=='playing'||room.phase!=='turn')throw new Error('O dado não pode ser lançado agora.');
    const p=currentPlayer(room);if(!p||p.id!==playerId)throw new Error('Aguarde seu turno.');
    ensureMissionDeck(room);
    const roll=randomInt(6)+1,multiplier=MULTIPLIERS[roll],distance=Math.round(BASE_DISTANCE*multiplier);
    p.positionMeters=(p.positionMeters+distance)%routeLength();p.totalDistance+=distance;
    const base=MISSIONS[room.missionDeck[room.missionCursor++]];
    const location=nearestLocation(p.positionMeters);
    const mission={...base,locationId:location.id,locationName:location.name,locationKind:location.kind,description:`${base.descriptionTemplate.replace('{place}',location.name)} Contexto: ${base.context}.`};
    mission.travelDistance=missionTravelDistance(mission,location,distance);mission.transport=transportForDistance(mission.travelDistance);
    const applied=applyMission(p,mission);
    room.lastRoll={value:roll,multiplier,distance,playerId:p.id,at:Date.now(),location};
    room.lastMission={...mission,delta:applied.delta,note:applied.note,playerId:p.id,playerName:p.name};
    room.phase='rolled';
    room.history.unshift({at:Date.now(),playerId:p.id,playerName:p.name,roll,distance,travelDistance:mission.travelDistance,transport:mission.transport?.label,missionId:mission.id,title:mission.title,locationName:location.name,delta:applied.delta,category:mission.category});
    room.history=room.history.slice(0,100);
    room.log.unshift(`${p.name} tirou ${roll}, avançou ${distance} m e chegou perto de ${location.name}.`);room.log=room.log.slice(0,50);touch(room);
    return {roll,mission:room.lastMission};
  }

  function purchaseVehicle(room,playerId,vehicleId){
    if(room.status!=='playing')throw new Error('Inicie a partida antes de comprar um veículo.');
    const p=room.players.find(x=>x.id===playerId);if(!p)throw new Error('Participante não encontrado.');
    const cp=currentPlayer(room);if(!cp||cp.id!==p.id)throw new Error('A compra deve ser feita no seu turno.');
    const v=VEHICLES.find(x=>x.id===vehicleId);if(!v)throw new Error('Veículo não encontrado.');
    p.vehicles=Array.isArray(p.vehicles)?p.vehicles:[];p.liabilities=Number(p.liabilities)||0;
    if(p.vehicles.some(x=>x.modelId===v.id))throw new Error('Esse modelo já está na sua garagem.');
    if(p.balance<v.downPayment)throw new Error(`Caixa insuficiente para a entrada de R$ ${v.downPayment.toLocaleString('pt-BR')}.`);
    const financed=v.price-v.downPayment;
    p.balance-=v.downPayment;p.expenseTotal+=v.downPayment;p.largestExpense=Math.max(p.largestExpense,v.downPayment);p.liabilities+=financed;
    const owned={id:makeId(),modelId:v.id,name:v.name,kind:v.kind,icon:v.icon,value:v.price,price:v.price,downPayment:v.downPayment,financed,acquiredAt:Date.now()};
    p.vehicles.push(owned);
    room.lastPurchase={at:Date.now(),playerId:p.id,playerName:p.name,vehicle:{...v},downPayment:v.downPayment,financed};
    room.log.unshift(`${p.name} comprou ${v.name}. Entrada: R$ ${v.downPayment.toLocaleString('pt-BR')}; saldo financiado: R$ ${financed.toLocaleString('pt-BR')}.`);room.log=room.log.slice(0,50);touch(room);
    return owned;
  }

  function paySalary(room,p){
    p.balance+=room.settings.salary;p.incomeTotal+=room.settings.salary;p.largestIncome=Math.max(p.largestIncome,room.settings.salary);
    room.log.unshift(`${p.name} recebeu salário de R$ ${room.settings.salary.toLocaleString('pt-BR')}.`);
  }
  function endTurn(room,playerId){
    if(room.status!=='playing'||room.phase!=='rolled')throw new Error('Lance o dado antes de encerrar o turno.');
    const p=currentPlayer(room);if(!p||p.id!==playerId)throw new Error('Apenas o participante do turno atual pode avançar.');
    p.turns++;
    let salaryPaid=false;
    if(p.turns%room.settings.salaryEveryTurns===0){paySalary(room,p);salaryPaid=true;}
    const wasLast=room.currentPlayerIndex===room.players.length-1;
    if(wasLast&&room.settings.maxRounds>0&&room.round>=room.settings.maxRounds){room.status='finished';room.phase='finished';room.lastRoll=null;room.lastMission=null;touch(room);room.log.unshift(`Partida concluída após ${room.settings.maxRounds} rodadas.`);return {salaryPaid,finished:true};}
    room.currentPlayerIndex=(room.currentPlayerIndex+1)%room.players.length;
    if(wasLast)room.round++;
    room.phase='turn';room.lastRoll=null;room.lastMission=null;touch(room);return {salaryPaid,finished:false};
  }
  function assetValue(p){return (p.assets||[]).reduce((s,a)=>s+(Number(a.value)||0),0);}
  function vehicleValue(p){return (p.vehicles||[]).reduce((s,a)=>s+(Number(a.value)||0),0);}
  function liabilitiesValue(p){return Math.max(0,Number(p.liabilities)||0);}
  function netWorth(p){return (Number(p.balance)||0)+assetValue(p)+vehicleValue(p)-liabilitiesValue(p);}
  function achievements(p){
    const out=[];const worth=netWorth(p);const assets=assetValue(p);
    if(p.assets.length>=1)out.push({id:'first_asset',icon:'🏠',label:'Primeiro ativo'});
    if((p.vehicles||[]).length>=1)out.push({id:'first_vehicle',icon:'🚙',label:'Primeiro veículo'});
    if(p.knowledge>=10)out.push({id:'knowledge_10',icon:'🎓',label:'Aprendiz contínuo'});
    if(p.wellbeing>=10)out.push({id:'wellbeing_10',icon:'🌿',label:'Vida equilibrada'});
    if(p.totalDistance>=10000)out.push({id:'traveler_10k',icon:'🧭',label:'Explorador urbano'});
    if(assets>=100000)out.push({id:'assets_100k',icon:'🏙️',label:'Investidor da cidade'});
    if(worth>=150000)out.push({id:'worth_150k',icon:'⭐',label:'Evolução patrimonial'});
    return out;
  }
  function playerView(p){
    const av=assetValue(p),vv=vehicleValue(p),lv=liabilitiesValue(p),nw=netWorth(p),ach=achievements(p);
    const progressScore=Math.round(nw+(p.knowledge*700)+(p.wellbeing*400)+(ach.length*1000));
    return {...p,assetValue:av,vehicleValue:vv,liabilities:lv,netWorth:nw,progressScore,achievements:ach};
  }
  function ranking(room){return room.players.map(playerView).sort((a,b)=>b.progressScore-a.progressScore||b.netWorth-a.netWorth||a.name.localeCompare(b.name,'pt-BR'));}
  function publicState(room){
    const players=room.players.map(playerView);const ranks=ranking(room);
    return {
      code:room.code,hostId:room.hostId,status:room.status,phase:room.phase,version:room.version,currentPlayerIndex:room.currentPlayerIndex,round:room.round,
      missionsRemaining:TOTAL_MISSIONS-room.missionCursor,lastRoll:room.lastRoll,lastMission:room.lastMission,lastPurchase:room.lastPurchase||null,log:room.log,history:room.history||[],players,city:CITY_LOCATIONS,
      winner:room.status==='finished'?ranks[0]:null,ranking:ranks.map((p,i)=>({rank:i+1,id:p.id,name:p.name,profession:p.profession,progressScore:p.progressScore,netWorth:p.netWorth})),
      settings:{...room.settings},vehicles:VEHICLES,rules:{salary:room.settings.salary,salaryEveryTurns:room.settings.salaryEveryTurns,baseDistance:BASE_DISTANCE,multipliers:MULTIPLIERS,totalMissions:TOTAL_MISSIONS,routeStep:ROUTE_STEP}
    };
  }
  function migrateState(raw){
    if(!raw||!Array.isArray(raw.players)||!raw.players.length)throw new Error('Partida salva inválida.');
    raw.settings=raw.settings||{maxRounds:20,salary:SALARY,salaryEveryTurns:SALARY_EVERY_TURNS};
    raw.settings.maxRounds=normalizeMaxRounds(raw.settings.maxRounds);
    raw.settings.salary=SALARY;raw.settings.salaryEveryTurns=SALARY_EVERY_TURNS;
    raw.history=Array.isArray(raw.history)?raw.history:[];raw.log=Array.isArray(raw.log)?raw.log:[];
    const validMissionDeck=Array.isArray(raw.missionDeck)&&raw.missionDeck.length===TOTAL_MISSIONS;
    raw.missionDeck=validMissionDeck?raw.missionDeck:shuffle([...Array(TOTAL_MISSIONS).keys()]);
    raw.missionCursor=validMissionDeck?Math.max(0,Math.min(TOTAL_MISSIONS,Number(raw.missionCursor)||0)):0;
    raw.round=Math.max(1,Number(raw.round)||1);raw.currentPlayerIndex=Math.max(0,Math.min(raw.players.length-1,Number(raw.currentPlayerIndex)||0));
    raw.status=['lobby','playing','finished'].includes(raw.status)?raw.status:'lobby';raw.phase=['lobby','turn','rolled','finished'].includes(raw.phase)?raw.phase:(raw.status==='playing'?'turn':raw.status);
    raw.version=Number(raw.version)||1;raw.createdAt=Number(raw.createdAt)||Date.now();raw.updatedAt=Date.now();
    raw.players=raw.players.map(p=>Object.assign(makePlayer(p.id||makeId(),p.name,p.profession),p,{assets:Array.isArray(p.assets)?p.assets:[],vehicles:Array.isArray(p.vehicles)?p.vehicles:[],liabilities:Math.max(0,Number(p.liabilities)||0)}));
    if(!raw.hostId||!raw.players.some(p=>p.id===raw.hostId))raw.hostId=raw.players[0].id;
    return raw;
  }
  function localCode(){return 'LOCAL'+String(randomInt(100)).padStart(2,'0');}
  return {VERSION,TOTAL_MISSIONS,MAX_PLAYERS,MIN_PLAYERS,PROFESSIONS,PROFESSION_HINTS,MULTIPLIERS,BASE_DISTANCE,SALARY,SALARY_EVERY_TURNS,CITY_LOCATIONS,MISSIONS,CATEGORY_META,VEHICLES,
    createRoomState,joinPlayer,removePlayer,startGame,rollDice,endTurn,purchaseVehicle,publicState,currentPlayer,nearestLocation,nextLocation,transportForDistance,localCode,migrateState,ranking};
});
