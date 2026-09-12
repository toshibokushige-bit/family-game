'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
const {Engine}=require('./engine');
function createServer(){
 const rooms=new Map();
 const error=(message,status=400)=>{throw Object.assign(Error(message),{status});};
 const code=()=>String(crypto.randomInt(100000,1000000));
 function seat(room,token){const id=room.tokens.indexOf(token);if(id<0)error('あいことばを たしかめてね',403);room.seen[id]=Date.now();return id;}
 function fight(room){const e=room.e;e.fight();room.ready=[false,false];room.advanced=[false,false];room.rev++;room.resultAt=Date.now();}
 function progress(room){const e=room.e;if(!room.started||e.phase==='end')return;const alive=[0,1].filter(id=>e.players[id].hp>0);
  if(e.phase==='prep'&&alive.every(id=>room.ready[id]))fight(room);
  else if(e.phase==='result'&&alive.every(id=>room.advanced[id])&&(alive.length||Date.now()-room.resultAt>8000)){e.next();room.advanced=[false,false];room.ready=[false,false];room.rev++;if(!alive.length)fight(room);}
 }
 function snapshot(room,id){progress(room);const e=room.e,map=n=>n<0?-(map(-n-2)+2):id===1?(n===0?1:n===1?0:n):n;
  const flip=o=>{if(Array.isArray(o))return o.map(flip);if(o&&typeof o==='object'){const n={};for(const[k,v]of Object.entries(o))n[k]=k==='side'?1-v:k==='winner'&&v>=0?1-v:k==='text'&&typeof v==='string'?v.replaceAll('あなた','__YOU__').replaceAll('あいて','あなた').replaceAll('__YOU__','あいて'):flip(v);return n;}return o;};
  const results=e.results.map(r=>{let out={...r,x:map(r.x),y:map(r.y),frames:[]};if(r.x===id||r.y===id){out.frames=structuredClone(r.frames);if(r.y===id){[out.x,out.y]=[out.y,out.x];out.winner=r.winner<0?-1:1-r.winner;out.frames=out.frames.map(f=>({...flip(f),sides:[f.sides[1],f.sides[0]]}));}}delete out.sides;delete out.log;return out;});
  return {room:room.code,id,rev:room.rev,started:room.started,ready:room.ready[id],otherReady:room.ready[1-id],advanced:room.advanced[id],otherConnected:Date.now()-room.seen[1-id]<12000,
   state:{round:e.round,phase:e.phase,difficulty:e.difficulty,players:e.players.map(p=>p.id===id?{...structuredClone(p),id:0}:{...p,id:map(p.id),board:structuredClone(p.last||[]),bench:[],shop:[null,null,null,null],gold:0,rewards:[],freeze:false}).sort((a,b)=>a.id-b.id),pairs:e.pairs.map(([a,b])=>[map(a),map(b)]).map(p=>p[1]===0?[0,p[0]]:p),dead:e.dead.map(map),previousStandings:(e.previousStandings||[]).map(p=>({...p,id:map(p.id)})),results}};
 }
 function request(data){
  if(data.op==='create'){if(rooms.size>=30)error('へやが いっぱいです');let c;do{c=code();}while(rooms.has(c));const e=new Engine(crypto.randomInt(0,4294967296),Number.isInteger(data.leader)&&data.leader>=0&&data.leader<5?data.leader:0);e.players[0].name='プレイヤー1';e.players[1].name='プレイヤー2';const ai=e.ai.bind(e),battle=e.battle.bind(e);e.ai=p=>{if(p.id>=2)ai(p);};e.battle=(a,b)=>battle(a,b,a.id<2||b.id<2);const room={code:c,e,tokens:[crypto.randomBytes(18).toString('hex')],seen:[Date.now(),0],ready:[false,false],advanced:[false,false],commands:[new Map(),new Map()],started:false,rev:1,created:Date.now()};rooms.set(c,room);return {token:room.tokens[0],...snapshot(room,0)};}
  const room=rooms.get(String(data.room));if(!room)error('へやが みつからないよ。つくりなおしてね',404);
  if(data.op==='join'){if(room.started)error('この へやは ふたり いるよ');room.tokens.push(crypto.randomBytes(18).toString('hex'));room.seen[1]=Date.now();room.started=true;const p=room.e.players[1];p.leader=Number.isInteger(data.leader)&&data.leader>=0&&data.leader<5?data.leader:0;p.free=p.leader===0?1:0;room.rev++;return {token:room.tokens[1],...snapshot(room,1)};}
  const id=seat(room,data.token),e=room.e,p=e.players[id];if(data.op==='state')return snapshot(room,id);
  if(data.op!=='action'||!room.started)error('あいてを まってね');
  if(typeof data.command!=='string'||data.command.length>80)error('そうさを やりなおしてね');
  if(room.commands[id].has(data.command))return snapshot(room,id);
  if(data.round!==e.round)error('つぎの せんに すすんだよ');
  const action=data.action,args=data.args||[];let ok=false;
  if(action==='advance'&&e.phase==='result'){room.advanced[id]=true;ok=true;}
  else if(e.phase==='prep'&&p.hp>0){
   if(action==='unready'){room.ready[id]=false;ok=true;}
   else if(!room.ready[id]){switch(action){
    case 'ready':if(p.rewards.length)error('ごほうびを えらんでね');room.ready[id]=true;ok=true;break;
    case 'buy':if(Number.isInteger(args[0])&&args[0]>=0&&args[0]<4)ok=e.buy(p,args[0]);break;
    case 'sell':if(Number.isInteger(args[0]))ok=e.sell(p,args[0]);break;
    case 'place':if(Number.isInteger(args[0])&&['board','bench'].includes(args[1])&&Number.isInteger(args[2]))ok=e.place(p,...args);break;
    case 'upgrade':ok=e.upgrade(p);break;case 'refresh':ok=e.refresh(p);break;
    case 'freeze':p.freeze=!p.freeze;ok=true;break;
    case 'reward':if(Number.isInteger(args[0])&&args[0]>=0&&args[0]<3)ok=e.reward(p,args[0]);break;
   }}
  }
  if(!ok)error('いまは できないよ。コインや あきわくを みてね');
  room.commands[id].set(data.command,true);if(room.commands[id].size>100)room.commands[id].delete(room.commands[id].keys().next().value);room.rev++;progress(room);return snapshot(room,id);
 }
 const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(req.url==='/api/lan'&&req.method==='POST'){try{const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)error('この ページからは つなげないよ',403);if(!req.headers['content-type']?.startsWith('application/json'))error('JSON required',415);let body='';for await(const chunk of req){body+=chunk;if(body.length>8192)error('Request too large',413);}const result=request(JSON.parse(body));res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(result));}catch(err){res.writeHead(err.status||400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:err.message}));}return;}
  const url=(req.url||'/').split('?')[0];const allowed={'/':'index.html','/index.html':'index.html','/games/team-battle/index.html':'index.html','/favicon.ico':null};
  if(!(url in allowed)||!allowed[url]||req.method!=='GET'){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type','text/html; charset=utf-8');fs.createReadStream(path.join(__dirname,allowed[url])).pipe(res);
 });
 const cleanup=setInterval(()=>{for(const[k,r]of rooms)if(Date.now()-Math.max(...r.seen)>2*60*60*1000)rooms.delete(k);},60000);cleanup.unref();server.on('close',()=>clearInterval(cleanup));return {server,request,rooms};
}
if(require.main===module){const port=Number(process.env.TEAM_BATTLE_PORT||8770),host=process.env.TEAM_BATTLE_HOST||'0.0.0.0';const {server}=createServer();server.listen(port,host,()=>{console.log('LAN team battle: http://'+host+':'+port+'/');if(host!=='0.0.0.0'&&host!=='127.0.0.1')http.createServer(server.listeners('request')[0]).listen(port,'127.0.0.1');console.log('This PC: http://127.0.0.1:'+port+'/');});}
module.exports={createServer};
