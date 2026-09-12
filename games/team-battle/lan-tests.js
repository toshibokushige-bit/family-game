'use strict';
const assert=require('assert/strict'),{createServer}=require('./lan-server');
async function main(){const {server,request,rooms}=createServer();let serial=0;
const create=()=>request({op:'create',leader:1});const join=a=>request({op:'join',room:a.room,leader:2});
const action=(a,round,name,args=[],command='test-'+(++serial))=>request({op:'action',room:a.room,token:a.token,round,action:name,args,command});
let a=create(),b=join(a),room=rooms.get(a.room);assert.equal(b.state.players[0].leader,2);assert.equal(b.state.players[1].leader,1);
assert.throws(()=>join(a));assert.throws(()=>request({op:'state',room:a.room,token:'wrong'}));
action(a,1,'buy',[0],'same');const gold=room.e.players[0].gold;action(a,1,'buy',[0],'same');assert.equal(room.e.players[0].gold,gold);
let view=request({op:'state',room:a.room,token:b.token});assert.equal(view.state.players[1].board.length,0);assert.deepEqual(view.state.players[1].shop,[null,null,null,null]);assert(!('seed'in view.state));assert.equal(view.token,undefined);
action(a,1,'ready');assert.equal(room.e.phase,'prep');assert.throws(()=>action(a,1,'refresh'));action(a,1,'unready');action(a,1,'ready');action(b,1,'buy',[0]);view=action(b,1,'ready');assert.notEqual(room.e.phase,'prep');
const own=view.state.results.find(r=>r.x===0);assert(own);assert(own.frames.length);assert(own.frames[0].sides[0].some(u=>u.id===room.e.players[1].board[0].id));
assert(view.state.results.filter(r=>r.x!==0&&r.y!==0).every(r=>r.frames.length===0));
action(a,1,'advance');assert.equal(room.e.round,1);action(b,1,'advance');assert.equal(room.e.round,2);assert.throws(()=>action(a,1,'ready'));const nextState=request({op:'state',room:a.room,token:b.token});assert.equal(nextState.state.round,2);assert.equal(nextState.advanced,false);assert.equal(nextState.ready,false);
// Complete tournaments with two human seats, including elimination and spectator progress.
for(let n=0;n<20;n++){const x=create(),y=join(x),r=rooms.get(x.room);let guard=0;while(r.e.phase!=='end'){assert(++guard<80);const round=r.e.round;const alive=[x,y].filter((_,i)=>r.e.players[i].hp>0);if(r.e.phase==='prep'){for(const z of alive)action(z,round,'ready');}else {for(const z of alive)action(z,round,'advance');}r.resultAt=0;request({op:'state',room:x.room,token:x.token});}assert.deepEqual(r.e.players.map(p=>p.rank).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);}
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const base='http://127.0.0.1:'+server.address().port;
const res=await fetch(base+'/api/lan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'create'})});assert.equal(res.status,200);assert((await res.json()).token);
assert.equal((await fetch(base+'/engine.js')).status,404);
assert.equal((await fetch(base+'/api/lan',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://untrusted.invalid'},body:'{}'})).status,403);
assert.equal((await fetch(base+'/')).status,200);
}finally{await new Promise(resolve=>server.close(resolve));}
console.log('LAN PASS: two seats, privacy, authentication, retries, readiness, resume, 20 tournaments, HTTP');}
main().catch(e=>{console.error(e);process.exitCode=1;});
