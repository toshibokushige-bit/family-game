'use strict';
const NAMES=['たいち','けんと','のぞみ','えりか','ゆうし'];
const COLORS=['#49c9ef','#a59aff','#ff8fab','#ffbc68','#79d8ab'];
const ROLES=['はつめい','にんじゃ','おうえん'];
const specs=[
 [0,0,1,2,3,'summon','ロボづくり'],[1,1,1,3,2,'double','はやわざ'],[2,2,1,1,4,'cheer','てびょうし'],[3,2,1,2,5,'guard','まもりて'],[4,0,1,2,3,'grow','はかせ'],[0,1,1,3,3,'none','ぼうけん'],
 [0,0,2,3,5,'summon','ロボたいちょう'],[1,1,2,3,4,'double','かげぶんしん'],[2,2,2,2,6,'cheer','おどりこ'],[3,2,2,3,8,'guard','たてのきし'],[4,0,2,3,5,'grow','けんきゅう'],[4,2,2,2,5,'buff','おまじない'],
 [0,0,3,5,7,'summon','メカマスター'],[1,1,3,5,6,'double','しのび'],[2,2,3,4,8,'cheer','スター'],[3,2,3,5,11,'guard','おうえんだん'],[4,0,3,4,8,'grow','だいはつめい'],[2,1,3,5,7,'buff','かぜのおどり'],
 [0,0,4,7,10,'summon','スーパーメカ'],[1,1,4,7,9,'double','にんじゃおう'],[2,2,4,5,12,'cheer','トップスター'],[3,2,4,7,15,'guard','てっぺき'],[4,0,4,6,11,'grow','だいけんじゃ'],[3,1,4,8,10,'buff','ゆうきのつるぎ'],
 [3,2,1,2,3,'shield','おまもり'],[2,2,1,1,4,'heal','いやしのうた'],[1,1,1,2,2,'snipe','しゅりけん'],[0,0,1,2,3,'rally','メカおうえん'],[4,0,1,2,3,'train','まなび'],[3,2,1,2,3,'legacy','おくりもの'],
 [3,2,2,3,5,'shield','ひかりのたて'],[2,2,2,2,6,'heal','そよかぜ'],[1,1,2,3,3,'snipe','くない'],[0,0,2,3,5,'rally','メカがっそう'],[4,0,2,3,5,'train','しゅぎょう'],[4,2,2,3,5,'legacy','ちえのバトン'],
 [0,0,3,4,7,'shield','バリアメカ'],[3,2,3,4,8,'heal','おうえんママ'],[4,1,3,4,5,'snipe','ほしのまほう'],[2,0,3,4,7,'rally','ロボのダンス'],[1,1,3,4,7,'train','にんじゃしゅぎょう'],[0,2,3,5,6,'legacy','ゆうきのバトン'],
 [3,2,4,6,10,'shield','きぼうのたて'],[2,2,4,5,11,'heal','にじのうた'],[0,1,4,6,7,'snipe','ひかりのや'],[4,0,4,5,10,'rally','メカのせんせい'],[1,1,4,6,10,'train','たつじん'],[2,2,4,6,9,'legacy','さいごのエール'],
 [0,0,5,14,20,'summon','きょだいロボ'],[1,1,5,14,18,'double','でんせつのしのび'],[2,2,5,10,24,'cheer','きせきのステージ'],[3,2,5,12,34,'guard','みんなのしゅごしん'],[4,0,5,12,24,'grow','ほしのだいけんじゃ'],[3,2,5,16,22,'shield','むてきのひかり'],[2,2,5,12,24,'heal','いのちのうた'],[1,1,5,17,17,'snipe','りゅうせいのわざ'],[0,0,5,12,22,'rally','メカだいこうしん'],[4,0,5,13,25,'train','みらいのちから'],[2,2,5,13,20,'legacy','きぼうのバトン'],[0,0,5,17,18,'double','ツインメカ']
];
const CARDS=specs.map((s,id)=>({id,f:s[0],role:s[1],tier:s[2],a:s[3],h:s[4],skill:s[5],name:s[6]}));
const DESC={summon:'たおれると ロボを よぶ',double:'2かい こうげき',cheer:'となりが うつと こうげき+1',guard:'あいての こうげきを ひきうける',grow:'なかまが でると じぶん+1/+1',buff:'かうと ほかの なかま+1/+1',none:'バランスの よい なかま',shield:'さいしょの ダメージを 1かい ふせぐ',heal:'こうげきの あと きずついた なかまを かいふく',snipe:'じぶんから うつと はんげきを うけない',rally:'バトルの はじめ ほかの はつめいの こうげきアップ',train:'おみせが はじまると じぶんが そだつ',legacy:'おやすみすると のこった なかまを つよくする'};
class Engine {
 constructor(seed=Date.now(),leader=0){this.difficulty=1;this.seed=seed>>>0;this.uid=1;this.round=1;this.phase='prep';this.dead=[];this.history={};this.results=[];this.players=Array.from({length:8},(_,id)=>({id,name:id===0?'あなた':NAMES[(id-1)%5]+['','・そら','・ほし'][Math.floor((id-1)/5)],leader:id===0?leader:(id-1)%5,hp:25,tier:1,discount:0,gold:3,board:[],bench:[],shop:[],freeze:false,free:(id===0?leader:(id-1)%5)===0?1:0,rewards:[],rank:null,style:id%3}));this.players.forEach(p=>this.shop(p));this.schedule();} standings(){
  const sorted=this.players.slice().sort((a,b)=>{if(a.rank&&b.rank)return a.rank-b.rank;if(a.rank)return 1;if(b.rank)return -1;return b.hp-a.hp||a.id-b.id;});
  return sorted.map((p,i)=>({id:p.id,name:p.name,hp:Math.max(0,p.hp),place:p.rank||1+sorted.filter(q=>!q.rank&&q.hp>p.hp).length,out:p.hp<=0,tier:p.tier}));
 }
 checkpoint(){
  if(this.phase!=='prep'||this.players[0].hp<=0)throw Error('おみせで ほぞんしてね');
  return {version:1,seed:this.seed,uid:this.uid,round:this.round,difficulty:this.difficulty,phase:'prep',dead:this.dead,history:this.history,pairs:this.pairs,players:this.players,previousStandings:this.previousStandings||[]};
 }
 static restore(data){
  const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  if(!data||data.version!==1||data.phase!=='prep'||!int(data.seed,0,4294967295)||!int(data.uid,1,10000000)||!int(data.round,1,20)||![0,1].includes(data.difficulty)||!Array.isArray(data.players)||data.players.length!==8)throw Error('あいことばが ちがうよ');
  const seen=new Set();
  const validUnit=u=>u&&int(u.id,0,59)&&int(u.uid,1,data.uid-1)&&typeof u.star==='boolean'&&int(u.a,1,100000)&&int(u.h,1,100000);
  for(let i=0;i<8;i++){const p=data.players[i];if(!p||p.id!==i||typeof p.name!=='string'||p.name.length>24||!int(p.leader,0,4)||!int(p.hp,-100,25)||!int(p.tier,1,5)||!int(p.gold,0,100)||!int(p.discount,0,20)||!int(p.free,0,1)||typeof p.freeze!=='boolean'||!int(p.style,0,2)||!(p.rank===null||int(p.rank,1,8)))throw Error('チームの データが ちがうよ');
   for(const key of ['board','bench']){if(!Array.isArray(p[key])||p[key].length>(key==='board'?5:3))throw Error('なかまが おおすぎるよ');for(const u of p[key]){if(!validUnit(u)||seen.has(u.uid))throw Error('なかまが ちがうよ');seen.add(u.uid);}}
   if(!Array.isArray(p.shop)||p.shop.length!==4||p.shop.some(id=>id!==null&&(!int(id,0,59)||CARDS[id].tier>p.tier)))throw Error('おみせが ちがうよ');
   if(!Array.isArray(p.rewards)||p.rewards.length>20||p.rewards.some(a=>!Array.isArray(a)||a.length!==3||a.some(id=>!int(id,0,59))))throw Error('ごほうびが ちがうよ');
   if(p.last&&(!Array.isArray(p.last)||p.last.length>5||p.last.some(u=>!validUnit(u))))throw Error('まえの チームが ちがうよ');
  }
  if(data.players[0].hp<=0||!Array.isArray(data.dead)||new Set(data.dead).size!==data.dead.length||data.dead.some(id=>!int(id,0,7)||data.players[id].hp>0))throw Error('じゅんいが ちがうよ');
  if(!data.history||typeof data.history!=='object'||Object.values(data.history).some(v=>!int(v,-1,7)))throw Error('りれきが ちがうよ');
  const alive=data.players.filter(p=>p.hp>0).map(p=>p.id);if(!Array.isArray(data.pairs)||data.pairs.length!==Math.ceil(alive.length/2))throw Error('たいせんが ちがうよ');
  const assigned=[];for(const pair of data.pairs){if(!Array.isArray(pair)||pair.length!==2||!int(pair[0],0,7)||!int(pair[1],-9,7)||pair[1]===-1)throw Error('たいせんが ちがうよ');assigned.push(pair[0]);if(pair[1]>=0)assigned.push(pair[1]);else if(!data.dead.includes(-pair[1]-2))throw Error('おばけが ちがうよ');}
  if(assigned.length!==alive.length||new Set(assigned).size!==alive.length||assigned.some(id=>!alive.includes(id)))throw Error('くみあわせが ちがうよ');
  if(data.dead.length!==data.players.filter(p=>p.hp<=0).length||data.players.some(p=>p.hp>0&&p.rank!==null)||new Set(data.players.filter(p=>p.hp<=0).map(p=>p.rank)).size!==data.dead.length)throw Error('じゅんいが ちがうよ');
  const e=Object.create(Engine.prototype);for(const key of ['version','seed','uid','round','difficulty','phase','dead','history','pairs','players'])e[key]=structuredClone(data[key]);e.results=[];e.previousStandings=[];return e;
 }

 rng(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 pick(a){return a[Math.floor(this.rng()*a.length)];}
 unit(id,star=false){const d=CARDS[id];return {uid:this.uid++,id,star,a:d.a*(star?2:1),h:d.h*(star?2:1)};}
 offer(p){const tier5=p.tier===5&&this.rng()<0.01;return this.pick(CARDS.filter(c=>tier5?c.tier===5:c.tier<=Math.min(4,p.tier))).id;}
 shop(p){p.shop=Array.from({length:4},()=>this.offer(p));}
 lateBonus(){return Math.max(0,this.round-10);}
 cost(p){return Math.max(1,[0,5,7,9,10][p.tier]-p.discount);}
 refresh(p){if(p.free>0)p.free--;else if(p.gold>0)p.gold--;else return false;this.shop(p);return true;}
 upgrade(p){if(p.tier===5||p.gold<this.cost(p))return false;p.gold-=this.cost(p);p.tier++;p.discount=0;if(p.leader===4&&p.board.length){const u=this.pick(p.board);u.a++;u.h++;}return true;}
 canReceive(p,id){return CARDS[id]!==undefined&&(p.board.length+p.bench.length<8||[...p.board,...p.bench].filter(u=>u.id===id&&!u.star).length>=2);}
 add(p,u){if(!this.canReceive(p,u.id))return false;if(p.board.length+p.bench.length>=8){p.bench.push(u);this.merge(p);return true;}if(p.board.length<5)p.board.push(u);else if(p.bench.length<3)p.bench.push(u);else return false;this.merge(p);return true;}
 buy(p,i){if(p.gold<3||p.shop[i]==null||!this.canReceive(p,p.shop[i]))return false;const id=p.shop[i];p.gold-=3;p.shop[i]=null;if(CARDS[id].skill==='buff')p.board.forEach(u=>{u.a++;u.h++;});this.add(p,this.unit(id));return true;}
 merge(p){for(const d of CARDS){let copies=[...p.board,...p.bench].filter(u=>u.id===d.id&&!u.star);while(copies.length>=3){const group=copies.slice(0,3),ids=group.map(u=>u.uid);const pos=p.board.findIndex(u=>ids.includes(u.uid));p.board=p.board.filter(u=>!ids.includes(u.uid));p.bench=p.bench.filter(u=>!ids.includes(u.uid));const u=this.unit(d.id,true);u.a+=group.reduce((v,x)=>v+x.a-d.a,0);u.h+=group.reduce((v,x)=>v+x.h-d.h,0);if(pos>=0)p.board.splice(pos,0,u);else p.bench.push(u);const pool=CARDS.filter(c=>c.tier===Math.min(5,p.tier+1));const choices=[];while(choices.length<3){let id=this.pick(pool).id;if(!choices.includes(id))choices.push(id);}p.rewards.push(choices);copies=copies.slice(3);}}}
 reward(p,i){if(!p.rewards.length||!this.canReceive(p,p.rewards[0]?.[i]))return false;const id=p.rewards[0][i];if(id==null)return false;p.rewards.shift();return this.add(p,this.unit(id));}
 sell(p,uid){for(const key of ['board','bench']){const i=p[key].findIndex(u=>u.uid===uid);if(i>=0){p[key].splice(i,1);p.gold++;return true;}}return false;}
 place(p,uid,key,index){const from=p.board.some(u=>u.uid===uid)?'board':'bench';const a=p[from],i=a.findIndex(u=>u.uid===uid),b=p[key];if(i<0||!b||index<0||index>=(key==='board'?5:3))return false;if(index<b.length){[a[i],b[index]]=[b[index],a[i]];}else {const u=a.splice(i,1)[0];b.push(u);}return true;}
 ai(p){let steps=0;while(p.rewards.length&&steps++<10){if(p.board.length+p.bench.length>=8)this.sell(p,p.bench[0]?.uid||p.board[0].uid);this.reward(p,0);}if(p.tier<5&&p.gold>=this.cost(p)&&(p.board.length>=3||this.round>3)&&(p.style===1||this.round%2===0))this.upgrade(p);for(let n=0;n<14&&p.gold>=1;n++){const all=[...p.board,...p.bench];const score=id=>{const c=CARDS[id];if(this.difficulty===0&&p.id!==0)return c.a+c.h;return c.a+c.h+all.filter(u=>u.id===id&&!u.star).length*7+all.filter(u=>CARDS[u.id].role===c.role).length*(p.style===2?2:1);};const offers=p.shop.map((id,i)=>({id,i,s:id===null?-1:score(id)})).sort((a,b)=>b.s-a.s);if(p.gold>=3&&offers[0].id!=null){if(all.length>=8){const weak=all.slice().sort((a,b)=>a.a+a.h-b.a-b.h)[0];this.sell(p,weak.uid);}this.buy(p,offers[0].i);while(p.rewards.length&&p.board.length+p.bench.length<8)this.reward(p,0);}else if((p.gold>=4||p.free)&&(this.difficulty!==0||p.id===0))this.refresh(p);else break;}const sorted=[...p.board,...p.bench].sort((a,b)=>(b.a+b.h)-(a.a+a.h));p.board=sorted.slice(0,5);p.bench=sorted.slice(5);p.board.sort((a,b)=>(CARDS[b.id].skill==='summon')-(CARDS[a.id].skill==='summon'));}
 schedule(){let ids=this.players.filter(p=>p.hp>0).map(p=>p.id),ghost=null;if(ids.length%2){ghost=this.dead.length?this.dead[Math.floor(this.rng()*Math.min(3,this.dead.length))]:null;}let best=null,bestCost=Infinity;for(let n=0;n<100;n++){const a=ids.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(this.rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}const pairs=[];let cost=0;while(a.length>=2){let x=a.pop(),y=a.pop();pairs.push([x,y]);cost+=this.history[x]===y?10:0;}if(a.length){pairs.push([a[0],ghost===null?-1:-(ghost+2)]);cost+=this.history[a[0]]===-1?10:0;}if(cost<bestCost){best=pairs;bestCost=cost;}}this.pairs=(best||[]).map(pair=>pair[1]===0?[0,pair[0]]:pair);}
 battle(pa,pb,record=true){
  const sides=[pa,pb].map(p=>p.board.map(u=>({...u,used:0,maxH:u.h,shield:CARDS[u.id]?.skill==='shield'}))),log=[],frames=[];
  const ref=(side,u)=>({side,uid:u.uid});
  const name=u=>CARDS[u.id]?.name||'ちびロボ';
  const emit=(type,text,detail={},duration=850)=>{if(record)frames.push({type,text,...detail,duration,sides:structuredClone(sides)});};
  let turn=(this.round+Math.min(pa.id,pb.id))%2;
  emit('start','なかまの じゅんび！',{},700);
  [pa,pb].forEach((p,s)=>{
   if(!sides[s].length)return;
   const u=sides[s][0];
   if(p.leader===1){u.a+=2;emit('buff','けんとの わざ！ せんとうの こうげき +2',{focus:[ref(s,u)],numbers:[{...ref(s,u),value:2,stat:'a'}],label:'こうげき +2'});}
   if(p.leader===3){u.h+=3;u.maxH+=3;emit('buff','えりかの わざ！ せんとうの たいりょく +3',{focus:[ref(s,u)],numbers:[{...ref(s,u),value:3,stat:'h'}],label:'たいりょく +3'});}
  });
  for(let s=0;s<2;s++)for(const u of sides[s])if(CARDS[u.id]?.skill==='rally'){
   const amount=CARDS[u.id].tier*(u.star?2:1),targets=sides[s].filter(v=>v.uid!==u.uid&&CARDS[v.id]?.role===0);targets.forEach(v=>v.a+=amount);
   if(targets.length)emit('buff',name(u)+'の はつめい おうえん！',{focus:[ref(s,u)],numbers:targets.map(v=>({...ref(s,v),value:amount,stat:'a'})),label:'はつめい +'+amount});
  }
  emit('ready',turn===0?'あなたから こうげき！':'あいてから こうげき！',{},600);
  let ticks=0;
  while(sides[0].length&&sides[1].length&&ticks++<120){
   const s=turn,t=1-s;turn=t;
   const a=sides[s].reduce((v,u)=>u.used<v.used?u:v,sides[s][0]);a.used++;
   const double=CARDS[a.id]?.skill==='double';
   if(double)emit('ability',name(a)+'は 2かい こうげき！',{focus:[ref(s,a)],label:'2かい こうげき！'},650);
   for(let hit=0;hit<(double?2:1);hit++){
    if(!sides[s].includes(a)||!sides[t].length)break;
    const ai=sides[s].indexOf(a);
    for(const n of [sides[s][ai-1],sides[s][ai+1]])if(n&&CARDS[n.id]?.skill==='cheer'){
     const amount=(CARDS[n.id].tier===5?4:1)*(n.star?2:1);a.a+=amount;
     emit('buff',name(n)+'が おうえん！ となりの こうげき +'+amount,{focus:[ref(s,n),ref(s,a)],numbers:[{...ref(s,a),value:amount,stat:'a'}],label:'おうえん！'});
    }
    if([pa,pb][s].leader===2&&ai===2&&a.used===1&&!a.danced){
     a.danced=true;const numbers=[];for(const n of [sides[s][1],sides[s][3]])if(n){n.a++;numbers.push({...ref(s,n),value:1,stat:'a'});}
     if(numbers.length)emit('buff','のぞみの おどり！ となりの こうげき +1',{focus:numbers,numbers,label:'おどりで +1！'});
    }
    const guards=sides[t].filter(u=>CARDS[u.id]?.skill==='guard'),b=this.pick(guards.length?guards:sides[t]);
    if(guards.length)emit('ability',name(b)+'が みんなを まもる！',{focus:[ref(t,b)],label:'まもる！'},600);
    emit('attack',name(a)+(hit?'の 2かいめ！':'が こうげき！'),{actor:ref(s,a),target:ref(t,b),label:hit?'もう いっかい！':'こうげき！'},650);
    let attackDamage=a.a,counterDamage=CARDS[a.id]?.skill==='snipe'?0:b.a;
    if(b.shield){b.shield=false;attackDamage=0;emit('ability',name(b)+'の シールド！ ダメージを ふせいだ',{focus:[ref(t,b)],label:'シールド！'},650);}
    if(a.shield&&counterDamage>0){a.shield=false;counterDamage=0;emit('ability',name(a)+'の シールド！',{focus:[ref(s,a)],label:'シールド！'},650);}
    if(CARDS[a.id]?.skill==='snipe')emit('ability',name(a)+'は はんげきを うけない！',{focus:[ref(s,a)],label:'はんげき なし'},550);
    b.h-=attackDamage;a.h-=counterDamage;
    const message=name(b)+'に '+attackDamage+'！ '+name(a)+'は '+counterDamage+' うけた！';
    emit('damage',message,{actor:ref(s,a),target:ref(t,b),numbers:[{...ref(t,b),value:attackDamage?-attackDamage:0,stat:'h'},{...ref(s,a),value:counterDamage?-counterDamage:0,stat:'h'}],label:'ぶつかった！'},900);
    log.push(message);
    for(let z=0;z<2;z++){
     const dead=sides[z].filter(u=>u.h<=0);
     if(dead.length)emit('death',dead.map(name).join('・')+'は おやすみ…',{focus:dead.map(u=>ref(z,u)),label:'おやすみ…'},550);
     sides[z]=sides[z].filter(u=>u.h>0);
     for(const fallen of dead)if(CARDS[fallen.id]?.skill==='legacy'&&sides[z].length){const amount=CARDS[fallen.id].tier*(fallen.star?2:1);sides[z].forEach(v=>{v.a+=amount;v.h+=amount;v.maxH+=amount;});emit('buff',name(fallen)+'の バトンが とどいた！',{focus:sides[z].map(v=>ref(z,v)),numbers:sides[z].map(v=>({...ref(z,v),value:amount,stat:'both'})),label:'みんな +'+amount});}
     for(const u of dead)if(CARDS[u.id]?.skill==='summon'&&sides[z].length<5){
      const power=(CARDS[u.id].tier===5?14:CARDS[u.id].tier)*(u.star?2:1);
      const robot={uid:this.uid++,id:-1,a:power+1,h:power+1,maxH:power+1,used:a.used};
      sides[z].push(robot);
      emit('summon',name(u)+'から ちびロボが とうじょう！',{focus:[ref(z,robot)],label:'ロボ とうじょう！'},850);
      for(const v of sides[z])if(CARDS[v.id]?.skill==='grow'){
       const amount=(CARDS[v.id].tier===5?4:1)*(v.star?2:1);v.a+=amount;v.h+=amount;v.maxH+=amount;
       emit('buff',name(v)+'は ロボで つよくなる！',{focus:[ref(z,v)],numbers:[{...ref(z,v),value:amount,stat:'both'}],label:'こうげき・たいりょく +'+amount});
      }
     }
    }
    if(sides[s].includes(a)&&CARDS[a.id]?.skill==='heal'){const targets=sides[s].filter(v=>v.h<v.maxH).sort((x,y)=>(y.maxH-y.h)-(x.maxH-x.h));if(targets.length){const v=targets[0],amount=Math.min(v.maxH-v.h,CARDS[a.id].tier+1)*(a.star?2:1),actual=Math.min(amount,v.maxH-v.h);v.h+=actual;emit('buff',name(a)+'が '+name(v)+'を かいふく！',{focus:[ref(s,a),ref(s,v)],numbers:[{...ref(s,v),value:actual,stat:'h'}],label:'かいふく +'+actual});}}
    emit('settle','つぎの なかまの ばんだよ',{},200);
   }
  }
  const winner=!sides[0].length&&!sides[1].length?-1:!sides[0].length?1:!sides[1].length?0:-1;
  emit('end',winner<0?'ひきわけ！':winner===0?'あなたの チームの かち！':'あいての チームの かち！',{winner},1200);
  return {winner,sides,frames,log,limited:ticks>=120};
 }

 fight(){if(this.phase!=='prep')return false;this.previousStandings=this.standings();this.players.filter(p=>p.id&&p.hp>0).forEach(p=>this.ai(p));this.results=[];const old=this.players.filter(p=>p.hp>0);for(const [x,y] of this.pairs){const a=this.players[x],b=y>=0?this.players[y]:this.players[-y-2]||{id:99,name:'おばけ',leader:0,tier:1,board:[]};const r=this.battle(a,b,x===0||y===0);let damage=0,starDamage=0,lateDamage=this.lateBonus();if(r.winner!==-1){const win=r.winner===0?a:b,lose=r.winner===0?b:a;starDamage=r.sides[r.winner].filter(u=>CARDS[u.id]?.tier===5).length*3;damage=Math.min(this.round<=4?3:this.round<=8?5:8,win.tier+r.sides[r.winner].length)+starDamage+lateDamage;if(!(y<0&&lose===b))lose.hp-=damage;}else if(lateDamage){damage=lateDamage;a.hp-=damage;if(y>=0)b.hp-=damage;}this.history[x]=y<0?-1:y;if(y>=0)this.history[y]=x;this.results.push({x,y,...r,damage,starDamage,lateDamage});}const eliminated=old.filter(p=>p.hp<=0).sort((a,b)=>b.hp-a.hp||a.id-b.id);const survivors=old.length-eliminated.length;eliminated.forEach((p,i)=>{p.rank=survivors+i+1;this.dead.unshift(p.id);});this.players.forEach(p=>p.last=structuredClone(p.board));if(this.round>=20){const alive=this.players.filter(p=>p.hp>0).sort((a,b)=>b.hp-a.hp||a.id-b.id);alive.forEach((p,i)=>p.rank=i+1);this.phase='end';}else if(survivors<=1){this.players.filter(p=>p.hp>0).forEach(p=>p.rank=1);this.phase='end';}else this.phase='result';return true;}
 next(){if(this.phase!=='result')return false;this.round++;this.players.filter(p=>p.hp>0).forEach(p=>{p.gold=Math.min(10,this.round+2);p.discount++;p.free=p.leader===0?1:0;p.board.filter(u=>CARDS[u.id].skill==='train').forEach(u=>{const n=(CARDS[u.id].tier===5?4:1)*(u.star?2:1);u.a+=n;u.h+=n;});if(!p.freeze)this.shop(p);else p.shop=p.shop.map(id=>id===null?this.offer(p):id);p.freeze=false;});this.phase='prep';this.schedule();return true;}
}
if(typeof module!=='undefined')module.exports={Engine,CARDS,NAMES,COLORS,ROLES,DESC};

