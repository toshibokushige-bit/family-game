const assert=require('assert/strict'),crypto=require('crypto');
const {createServer}=require('./lan-server'),Engine=require('./engine');
const nonce=()=>crypto.randomBytes(20).toString('hex');
async function main(){
 const service=createServer();await new Promise(r=>service.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+service.server.address().port;
 let checks=0,actions=0;
 const ok=(x,m)=>{assert(x,m);checks++;};
 async function post(data,status=200,headers={}){const r=await fetch(base+'/api/lan',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});assert.equal(r.status,status);checks++;return r.json();}
 try{
  const create={op:'create',requestId:nonce()},host=await post(create),retry=await post(create);ok(host.token===retry.token&&host.room===retry.room,'Create retry');
  const join={op:'join',room:host.room,requestId:nonce()},guest=await post(join);ok((await post(join)).token===guest.token,'Join retry');await post({...join,requestId:nonce()},409);
  const auth=[host,guest].map(v=>({room:v.room,token:v.token}));
  const state=i=>post({op:'state',...auth[i]});
  await post({op:'state',room:host.room,token:nonce()},403);
  const initial=await state(0);ok(initial.started,'Host sees join');
  for(let i=0;i<2;i++){const v=await state(i);ok(v.state.players[i].hand.every(c=>c.name&&c.netId),'Own hand visible');ok(v.state.players[1-i].hand.every(c=>c===null),'Other hand private');ok(v.state.players.every(p=>p.deck.every(c=>c===null)),'Decks private');ok(!('token' in v)&&!('rng'in v.state),'Secrets omitted');}
  const active=initial.state.acting,other=1-active;
  const command={op:'action',...auth[active],command:nonce(),rev:initial.rev,action:'charge',args:[(await state(active)).state.players[active].hand[0].netId]};
  await post({...command,...auth[other]},403);await post({...command,action:'summon'},400);await post({...command,args:[999]},400);
  const charged=await post(command),repeated=await post(command);ok(repeated.rev===charged.rev,'Lost-response retry applies once');ok(repeated.state.players[active].costTotal===1,'Single charge');
  await post({...command,command:nonce()},409);
  ok((await state(other)).state.log.some(l=>l.includes('カードを おうえんに まわした')),'Charge log hides identity');
  const resumed=await state(active);ok(resumed.rev===charged.rev,'Resume preserves state');
  // Complete real API games. Decisions use only the acting seat's public snapshot.
  for(let match=0;match<12;match++){
   const h=match===0?host:await post({op:'create',requestId:nonce()});const g=match===0?guest:await post({op:'join',room:h.room,requestId:nonce()});const seats=[h,g];
   let v=await post({op:'state',room:h.room,token:h.token});let steps=0;
   while(v.state.phase!=='gameover'&&steps++<500){
    const id=v.state.acting,a=seats[id];v=await post({op:'state',room:a.room,token:a.token});const s=v.state,p=s.players[id];let action,args=[];
    if(s.phase==='charge'){if(Engine.canChargeMore(s)){action='charge';args=[p.hand[0].netId];}else action='play';}
    else if(s.phase==='play'){const c=p.hand.find(c=>Engine.canSummon(s,c).ok);if(c){action='summon';args=[c.netId];}else action='battle';}
    else {if(s.battleIds.length){action='attack';args=[s.battleIds[0],s.players[1-id].field[0]?.card.netId??null];}else action='end';}
    const cmd={op:'action',room:a.room,token:a.token,command:nonce(),rev:v.rev,action,args};v=await post(cmd);actions++;
    if(action==='attack'){ok((await post(cmd)).rev===v.rev,'Attack duplicate not applied twice');}
   }
   ok(v.state.phase==='gameover','API game completes');const b=await post({op:'state',room:g.room,token:g.token});ok(b.state.winner===v.state.winner&&b.state.players.every((p,i)=>p.hp===v.state.players[i].hp),'Both screens agree');
  }
  await post({op:'create',requestId:nonce()},403,{Origin:'https://elsewhere.example'});
  ok((await fetch(base+'/lan-server.js')).status===404,'Server source private');ok((await fetch(base+'/')).status===200,'Game served');
  console.log('LAN PASS: '+checks+' assertions; '+actions+' actions; 12 completed games through HTTP');
 }finally{await new Promise(r=>service.server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
