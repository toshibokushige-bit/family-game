const assert=require('assert'),{Engine,CARDS}=require('./engine');
const e=new Engine(4242),p=e.players[0];
for(let tier=1;tier<5;tier++){p.tier=tier;for(let i=0;i<1000;i++)assert(CARDS[e.offer(p)].tier<=tier);}
p.tier=5;let rare=0;for(let i=0;i<100000;i++)rare+=CARDS[e.offer(p)].tier===5;
assert(rare>850&&rare<1150);console.log('PASS ★5 shop rate',rare/1000+'%');
p.tier=4;p.board=[e.unit(0),e.unit(0),e.unit(0)];e.merge(p);assert(p.rewards[0].every(id=>CARDS[id].tier===5));assert.equal(new Set(p.rewards[0]).size,3);
p.gold=10;p.discount=0;assert(e.upgrade(p));assert.equal(p.tier,5);assert(!e.upgrade(p));
p.board=[e.unit(59)];p.bench=[];p.rewards=[];e.shop(p);assert.equal(Engine.restore(e.checkpoint()).players[0].board[0].id,59);
function fixture(round,winner,survivorIds){const g=new Engine(52);g.round=round;g.ai=()=>{};g.pairs=[[0,1],[2,3],[4,5],[6,7]];g.players[0].tier=5;g.battle=()=>({winner,sides:[survivorIds.map(id=>({id})),[]],frames:[],log:[]});g.fight();return g;}
let g=fixture(10,0,[48,59]);assert.equal(g.results[0].starDamage,6);assert.equal(g.players[1].hp,12);
g=fixture(11,0,[48,59]);assert.equal(g.players[1].hp,11);assert.equal(g.results[0].lateDamage,1);
g=fixture(12,-1,[]);assert.equal(g.players[0].hp,23);assert.equal(g.players[1].hp,23);
g=fixture(10,-1,[]);assert.equal(g.players[0].hp,25);
console.log('PASS ★5 triple reward, upgrade, save and survival damage; late loss/draw damage');
