'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
const Engine=require('./engine');
/* ホームボタン(../../index.html)から ゲームセンターに もどれる ように、
   リポジトリの ハブと ほかの ゲームも よみとりせんようで くばる。
   きどうじに ファイルを みて つくる「かんぜん一致の 許可リスト」なので、
   ディレクトリを さかのぼる ような URLは とおらない。 */
const SITE_ROOT=path.join(__dirname,'..','..');
function staticRoutes(){
 const routes={'/':path.join(__dirname,'index.html')};          // この ゲーム(LANの いりぐち)
 const hub=path.join(SITE_ROOT,'index.html'),list=path.join(SITE_ROOT,'games.json');
 if(fs.existsSync(hub))routes['/index.html']=hub;               // ゲームセンター
 if(fs.existsSync(list))routes['/games.json']=list;
 try{
  for(const d of fs.readdirSync(path.join(SITE_ROOT,'games'),{withFileTypes:true})){
   if(!d.isDirectory())continue;
   const f=path.join(SITE_ROOT,'games',d.name,'index.html');
   if(fs.existsSync(f))routes['/games/'+d.name+'/index.html']=f;
  }
 }catch(e){}
 return routes;
}
const STATIC_ROUTES=staticRoutes();
function serveStatic(req,res){
 const url=(req.url||'/').split('?')[0];
 const file=STATIC_ROUTES[url];
 if(!file||req.method!=='GET'){res.writeHead(404);res.end('Not found');return;}
 res.setHeader('Content-Type',file.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8');
 fs.createReadStream(file).on('error',()=>{res.writeHead(503);res.end('Build the game first');}).pipe(res);
}
function createServer(){
 const rooms=new Map(),creates=new Map();
 const error=(message,status=400)=>{throw Object.assign(Error(message),{status});};
 const nonce=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{20,80}$/.test(x);
 const token=()=>crypto.randomBytes(24).toString('hex');
 function seat(room,t){const id=room.tokens.indexOf(t);if(id<0)error('ふっきの あいことばを たしかめてね',403);room.seen[id]=Date.now();return id;}
 function snapshot(room,id){
  const s=room.state;
  const state={skillsEnabled:!!s.skillsEnabled,firstPlayer:s.firstPlayer,acting:s.acting,ply:s.ply,phase:s.phase,winner:s.winner,endReason:s.endReason,chargeLimit:s.chargeLimit,chargePlaced:s.chargePlaced,isSecondFirstTurn:s.isSecondFirstTurn,damageBySource:{...s.damageBySource},battleIds:s.battleRemaining.map(m=>m.card.netId),
   // Face-down support cards and both decks remain private, including their names in logs.
   log:s.log.map(line=>{const m=line.match(/^P(\d): 「(.+)」をコストに置く/);return m&&Number(m[1])!==id?'P'+m[1]+': カードを おうえんに まわした':line;}),
   players:s.players.map(p=>({idx:p.idx,hp:p.hp,controller:'human',aiName:'greedy',turnNo:p.turnNo,costTotal:p.costTotal,costUsed:p.costUsed,deck:Array(p.deck.length).fill(null),hand:p.idx===id?p.hand.map(c=>({...c})):Array(p.hand.length).fill(null),field:p.field.map(m=>({card:{...m.card},damage:m.damage,enteredPly:m.enteredPly,shellUsed:!!m.shellUsed}))}))};
  return {room:room.code,id,rev:room.rev,started:room.started,otherConnected:room.started&&Date.now()-room.seen[1-id]<12000,state};
 }
 function request(data){
  if(!data||typeof data!=='object'||Array.isArray(data))error('そうさを やりなおしてね');
  if(data.op==='create'){
   if(!nonce(data.requestId))error('へやを つくりなおしてね');
   const previous=creates.get(data.requestId);if(previous&&rooms.has(previous)){const room=rooms.get(previous);room.seen[0]=Date.now();return {...snapshot(room,0),token:room.tokens[0]};}
   if(rooms.size>=30)error('へやが いっぱいです');let code;do{code=String(crypto.randomInt(100000,1000000));}while(rooms.has(code));
   const rng=Engine.makeRng(crypto.randomInt(0,4294967296));let uid=0;const deck=()=>Engine.buildDeck(Engine.CARD_POOL_V3,20,rng,2).map(c=>({...c,netId:++uid}));
   const state=Engine.newGame(deck(),deck(),crypto.randomInt(0,2),rng,['human','human']);
   state.skillsEnabled=true;
   const room={code,state,started:false,rev:0,tokens:[token()],seen:[Date.now(),0],commands:[new Map(),new Map()],createId:data.requestId,joinId:null};rooms.set(code,room);creates.set(data.requestId,code);return {...snapshot(room,0),token:room.tokens[0]};
  }
  const room=rooms.get(String(data.room));if(!room)error('へやが みつからないよ。つくりなおしてね',404);
  if(data.op==='join'){
   if(!nonce(data.requestId))error('もういちど はいってね');
   if(room.started){if(room.joinId===data.requestId){room.seen[1]=Date.now();return {...snapshot(room,1),token:room.tokens[1]};}error('この へやは ふたり いるよ',409);}
   room.joinId=data.requestId;room.tokens.push(token());room.seen[1]=Date.now();room.started=true;Engine.beginTurn(room.state);room.rev++;return {...snapshot(room,1),token:room.tokens[1]};
  }
  const id=seat(room,data.token);if(data.op==='state')return snapshot(room,id);
  if(data.op!=='action'||!room.started)error('あいてを まってね');
  if(!nonce(data.command))error('そうさを やりなおしてね');
  if(room.commands[id].has(data.command))return snapshot(room,id);
  const s=room.state,p=s.players[id],opp=s.players[1-id];
  if(data.rev!==room.rev)error('がめんが かわったよ。もういちど えらんでね',409);
  if(s.phase==='gameover')error('たいせんは おわったよ');
  if(s.acting!==id)error('あいての ばんだよ',403);
  const args=data.args||[];if(!Array.isArray(args)||args.length>2)error('そうさを やりなおしてね');
  const card=()=>p.hand.find(c=>Number.isInteger(args[0])&&c.netId===args[0]);
  const monster=()=>p.field.find(m=>Number.isInteger(args[0])&&m.card.netId===args[0]);let ok=false;
  switch(data.action){
   case 'charge':if(s.phase==='charge'&&card())ok=Engine.chargeCard(s,card());break;
   case 'summon':if(s.phase==='play'&&card()&&Engine.canSummon(s,card()).ok)ok=Engine.summon(s,card());break;
   case 'retreat':if(s.phase==='play'&&monster())ok=Engine.retreat(s,monster());break;
   case 'play':if(s.phase==='charge'){Engine.advanceToPlay(s);ok=true;}break;
   case 'battle':if(s.phase==='play'){Engine.advanceToBattle(s);ok=true;}break;
   case 'end':if(s.phase==='battle'){Engine.endTurn(s);ok=true;}break;
   case 'attack':if(s.phase==='battle'&&monster()){
    const target=args[1]===null?null:opp.field.find(m=>Number.isInteger(args[1])&&m.card.netId===args[1]);
    if((args[1]===null&&opp.field.length===0)||(target&&opp.field.includes(target)))ok=Engine.attack(s,monster(),target).ok;
   }break;
  }
  if(!ok)error('いまは できないよ。おうえんや カードを みてね');
  room.rev++;room.commands[id].set(data.command,room.rev);if(room.commands[id].size>512)room.commands[id].delete(room.commands[id].keys().next().value);
  return snapshot(room,id);
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(req.url==='/api/lan'&&req.method==='POST'){
   try{if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)error('この ページからは つなげないよ',403);if(!req.headers['content-type']?.startsWith('application/json'))error('JSON required',415);let size=0,body='';for await(const c of req){size+=c.length;if(size>8192)error('Request too large',413);body+=c;}res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(request(JSON.parse(body))));}
   catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:e.message}));}return;
  }
  serveStatic(req,res);
 });
 const cleanup=setInterval(()=>{for(const[k,r]of rooms)if(Date.now()-Math.max(...r.seen)>2*60*60*1000){rooms.delete(k);creates.delete(r.createId);}},60000);cleanup.unref();server.on('close',()=>clearInterval(cleanup));return {server,request,rooms};
}
if(require.main===module){const port=Number(process.env.ANIMAL_BATTLE_PORT||8771),host=process.env.ANIMAL_BATTLE_HOST||'0.0.0.0';const {server}=createServer();server.listen(port,host,()=>{console.log('This PC: http://127.0.0.1:'+port+'/');if(host==='0.0.0.0')for(const addresses of Object.values(os.networkInterfaces()))for(const a of addresses||[])if(a.family==='IPv4'&&!a.internal)console.log('Same Wi-Fi: http://'+a.address+':'+port+'/');});}
module.exports={createServer};
