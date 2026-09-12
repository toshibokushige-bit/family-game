// Practice uses its own engine; the normal match and password state are untouched.
let tutorial=null;
const LESSONS=[
 ['なかまを かおう','おみせは うえ。あなたの チームは した。\n3コインで「ロボづくり」を かってみよう。'],
 ['わざを よもう','かった カードを タップしてみよう。\n⚔は こうげき。♥が 0になると おやすみ。\nロボづくりは おやすみすると ロボを よぶよ。'],
 ['じゅんばんを かえよう','れんしゅうように「はやわざ」を もらったよ。\nひだりから こうげきするよ。ロボづくりを\nえらんで、みぎの カードと いれかえよう。'],
 ['バトルを みよう','たたかいは じどう。カードの わざも はたらくよ。\nここでは「つぎの うごき」で ゆっくり みよう。'],
 ['ハートと じゅんい','まけた チームは ハートが へるよ。\nハートが 0で だつらく。さいごの 1にんを めざそう！\n1かい まけても つぎの おみせで くふうできるよ。'],
 ['おみせを そだてよう','ここからは べつの れんしゅうだよ。\nコインを つかって おみせ★3を ★4にしよう。\nかうか、そだてるか。コインの つかいみちを えらぼう。'],
 ['3まいで スター！','れんしゅうように おなじ カードを 2まい もらったよ。\nあと 1まいを かうと 1まいの つよい スターになる！\nおみせ★4なら ごほうびは ★5だよ。'],
 ['★5を えらぼう','ごほうびは 3まいから 1まい。\nおみせで ★5を みつけるのは むずかしいけれど、\nおなじ3まいを あつめると ねらえるよ。'],
 ['★5で おおダメージ！','れんしゅうようの ★5チームで たたかおう。\n★5が のこって かつと 1たいにつき ダメージ+3！\n11せんめからは けっせん。さらに ダメージが ふえるよ。'],
 ['じゅんび できたね！','かう → ならべる → バトル → くふうする！\nキープで おみせを のこせる。ひきなおしは 1コイン。\nうると 1コイン。コインは つぎの せんに もちこせないよ。']
];
function startTutorial(){tutorial={engine:new Engine(20260912,0),step:0,selected:false,done:false,frames:null,frame:0};tutorial.engine.players[0].shop=[0,null,null,null];fx=null;modal=null;selected=null;screen='tutorial';render();}
function tutorialNext(){const t=tutorial,p=t.engine.players[0];t.step++;t.done=false;t.selected=false;t.frames=null;t.frame=0;
 if(t.step===2)p.board.push(t.engine.unit(1));
 if(t.step===5){p.tier=3;p.discount=0;p.gold=9;p.shop=[null,null,null,null];}
 if(t.step===6){p.board=[t.engine.unit(0),t.engine.unit(0)];p.bench=[];p.gold=3;p.shop=[0,null,null,null];}
 if(t.step===8){p.board=[t.engine.unit(48)];p.bench=[];p.tier=5;t.engine.round=11;}
 render();
}
function tutorialBattle(){const t=tutorial,e=t.engine,p=e.players[0];e.phase='prep';e.ai=()=>{};e.pairs=[[0,1],[2,3],[4,5],[6,7]];e.players[1].board=[e.unit(5)];e.fight();t.result=e.results[0];t.frames=t.result.frames;t.frame=0;render();}
function tutorialExit(){tutorial=null;modal=null;screen='title';render();}
function drawTutorial(){const t=tutorial,e=t.engine,p=e.players[0],step=t.step;
 buttons=[];rect(0,0,960,62,'#152e3b',0);text('はじめての れんしゅう　'+(step+1)+' / '+LESSONS.length,24,40,23,'#ffe3a6');button('おわる',820,12,116,38,tutorialExit);
 rect(16,65,928,145,'#294953');text(LESSONS[step][0],34,94,24,'#ffe2a0');LESSONS[step][1].split('\n').forEach((line,i)=>text(line,34,124+i*29,19,'#e0ebe7'));
 const advance=()=>button('できた！ つぎへ →',680,466,255,51,tutorialNext,true,'#a77837');
 if([3,8].includes(step)){
  if(!t.frames){text('あいては うえ、あなたは しただよ',35,262,21,'#c9e5e2');p.board.forEach((u,i)=>card(u,25+i*130,350,120,110));button('バトルを はじめる',680,466,255,51,tutorialBattle,true,'#a77837');}
  else {const f=t.frames[t.frame];f.sides[1].forEach((u,i)=>card(u,24+i*126,224,116,105));f.sides[0].forEach((u,i)=>card(u,24+i*126,356,116,105));text(f.text,24,493,16,'#ffe2a0');
   if(t.frame<t.frames.length-1)button('つぎの うごき →',680,466,255,51,()=>{t.frame++;render();},true,'#a77837');
   else {text('ダメージ '+t.result.damage+'（★5 +'+t.result.starDamage+' / けっせん +'+t.result.lateDamage+'）',24,527,16,'#ffbf9f');advance();}}
  return;
 }
 if(step===4){e.standings().forEach((row,i)=>{const col=i%2,y=250+Math.floor(i/2)*48;text(row.place+'い　'+row.name+'　♥ '+row.hp,35+col*460,y,21,row.id===0?'#ffe2a0':'#d2e4e2');});advance();return;}
 if(step===9){text('★5カード と ★スターは べつものだよ。',35,270,23,'#ffe2a0');text('★5は カードの レベル。★スターは おなじ3まいの がったい。',35,310,19,'#d2e4e2');button('もういちど れんしゅう',35,407,290,54,startTutorial);button('ほんばんで あそぶ →',610,407,325,54,()=>{tutorial=null;start();},true,'#a77837');return;}
 if(step===7){p.rewards[0]?.forEach((id,i)=>{card({...CARDS[id],star:false},35+i*207,226,185,160);button('これにする',35+i*207,399,185,45,()=>{if(e.reward(p,i)){t.done=true;render();}},true,'#a77837');});if(t.done){text('★5を もらえたね！',35,282,27,'#ffe2a0');advance();}return;}
 text('おみせ　★'+p.tier+'　/　コイン '+p.gold,24,239,21,'#ffe2a0');
 if([0,6].includes(step)&&!t.done){card({...CARDS[0],star:false},24,253,151,112,()=>{if(e.buy(p,0)){t.done=true;render();}});button('3コインで かう',204,280,255,51,()=>{if(e.buy(p,0)){t.done=true;render();}},true,'#a77837');}
 if(step===5&&!t.done)button('9コインで ★4に そだてる',204,280,395,51,()=>{if(e.upgrade(p)){t.done=true;render();}},true,'#a77837');
 text('あなたの チーム',24,390,19,'#b7e6df');
 p.board.forEach((u,i)=>card(u,24+i*145,403,132,112,()=>{
  if(step===1){t.done=true;showDetail(u);}
  else if(step===2&&!t.done){if(!t.selected&&i===0)t.selected=true;else if(t.selected&&i===1){e.place(p,p.board[0].uid,'board',1);t.done=true;}render();}
  else showDetail(u);
 }));
 if(step===2&&t.selected&&!t.done)text('みぎの カードを タップ！',490,360,21,'#ffe2a0');
 if(t.done){text(step===6?'スターに なった！ ごほうびも あるよ。':'できたね！',490,390,18,'#ffe2a0');advance();}
}
