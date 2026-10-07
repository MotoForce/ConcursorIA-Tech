'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const engine=require('./game-core');

const PORT=Number(process.env.PORT||8080);
const ROOT=path.join(__dirname,'public');
const rooms=new Map();
const TTL=12*60*60*1000;
const buckets=new Map();
const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
  'Access-Control-Max-Age':'86400'
};
function code(){return crypto.randomBytes(3).toString('hex').toUpperCase();}
function headers(extra={}){return {...CORS,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN',...extra};}
function json(res,status,obj){res.writeHead(status,headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}));res.end(JSON.stringify(obj));}
function readBody(req){return new Promise((resolve,reject)=>{let data='';req.on('data',chunk=>{data+=chunk;if(data.length>65536){reject(new Error('Corpo da requisição muito grande.'));req.destroy();}});req.on('end',()=>{try{resolve(data?JSON.parse(data):{});}catch{reject(new Error('JSON inválido.'));}});req.on('error',reject);});}
function roomOr404(res,c){const r=rooms.get(c);if(!r){json(res,404,{error:'Sala não encontrada ou expirada.'});return null;}r.updatedAt=Date.now();return r;}
function safeFile(urlPath){const rel=urlPath==='/'?'index.html':decodeURIComponent(urlPath).replace(/^\/+/, '');const full=path.resolve(ROOT,rel);return (full===ROOT||full.startsWith(ROOT+path.sep))?full:null;}
function contentType(file){return {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json; charset=utf-8','.ico':'image/x-icon'}[path.extname(file).toLowerCase()]||'application/octet-stream';}
function serve(req,res){const pathname=new URL(req.url,'http://localhost').pathname;const file=safeFile(pathname);if(!file)return json(res,403,{error:'Acesso bloqueado.'});fs.readFile(file,(err,data)=>{if(err)return json(res,404,{error:'Arquivo não encontrado.'});const ext=path.extname(file).toLowerCase();res.writeHead(200,headers({'Content-Type':contentType(file),'Cache-Control':(ext==='.html'||path.basename(file)==='sw.js')?'no-cache':'public, max-age=3600'}));res.end(data);});}
function rateLimit(req,res){const ip=req.socket.remoteAddress||'unknown',now=Date.now(),slot=buckets.get(ip)||{n:0,t:now};if(now-slot.t>60000){slot.n=0;slot.t=now;}slot.n++;buckets.set(ip,slot);if(slot.n>240){json(res,429,{error:'Muitas requisições. Aguarde um minuto.'});return false;}return true;}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='OPTIONS'){res.writeHead(204,headers());return res.end();}
    if(!rateLimit(req,res))return;
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,app:'Imob Velocity',version:engine.VERSION});
    if(u.pathname==='/api/meta'&&req.method==='GET')return json(res,200,{professions:engine.PROFESSIONS,version:engine.VERSION,minPlayers:engine.MIN_PLAYERS,maxPlayers:engine.MAX_PLAYERS,totalMissions:engine.TOTAL_MISSIONS});
    if(u.pathname==='/api/rooms'&&req.method==='POST'){
      const b=await readBody(req);let c;do{c=code();}while(rooms.has(c));
      const room=engine.createRoomState(b.name,b.profession,c,{maxRounds:b.maxRounds});rooms.set(c,room);
      return json(res,201,{playerId:room.hostId,state:engine.publicState(room)});
    }
    const m=u.pathname.match(/^\/api\/rooms\/([A-F0-9]{6})(?:\/(join|start|roll|end|buy-vehicle))?$/);
    if(m){
      const c=m[1],action=m[2]||'state',room=roomOr404(res,c);if(!room)return;
      if(req.method==='GET'&&action==='state')return json(res,200,{state:engine.publicState(room)});
      if(req.method==='POST'){
        const b=await readBody(req);
        if(action==='join'){const p=engine.joinPlayer(room,b.name,b.profession);return json(res,201,{playerId:p.id,state:engine.publicState(room)});}
        if(action==='start'){engine.startGame(room,b.playerId);return json(res,200,{state:engine.publicState(room)});}
        if(action==='roll'){engine.rollDice(room,b.playerId);return json(res,200,{state:engine.publicState(room)});}
        if(action==='end'){engine.endTurn(room,b.playerId);return json(res,200,{state:engine.publicState(room)});}
        if(action==='buy-vehicle'){engine.purchaseVehicle(room,b.playerId,b.vehicleId);return json(res,200,{state:engine.publicState(room)});}
      }
    }
    if(u.pathname.startsWith('/api/'))return json(res,404,{error:'Endpoint não encontrado.'});
    return serve(req,res);
  }catch(e){return json(res,400,{error:e&&e.message?e.message:'Erro inesperado.'});}
});

setInterval(()=>{const now=Date.now();for(const [c,r] of rooms)if(now-(r.updatedAt||r.createdAt)>TTL)rooms.delete(c);for(const [ip,b] of buckets)if(now-b.t>5*60*1000)buckets.delete(ip);},10*60*1000).unref();
server.listen(PORT,()=>console.log(`Imob Velocity ${engine.VERSION} em http://localhost:${PORT}`));
