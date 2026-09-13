if(typeof HGSave!=='undefined'){
 let dashStarted=false,dashPaused=false;
 const originalNew=Game.newGame;Game.newGame=function(){dashStarted=true;return originalNew.apply(this,arguments);};
 const originalLoad=Game.loadGame;Game.loadGame=function(d){dashStarted=true;return originalLoad.call(this,d);};
 const originalUpdate=Game.update;Game.update=function(dt){if(!dashPaused)return originalUpdate.call(this,dt);};
 const int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
 function valid(d){return d&&int(d.stage,0,STAGES.length-1)&&int(d.lv,1,BAL.lvMax)&&CHAR_ORDER.includes(d.char)&&typeof d.complete==='boolean'&&d.picks&&Object.keys(d.picks).every(k=>CHAR_ORDER.includes(k)&&Object.keys(d.picks[k]).every(id=>CARDS.some(c=>c.id===id&&(c.char===null||c.char===k)&&int(d.picks[k][id],0,c.max))));}
 HGSave.mount('dash',{validate:valid,note:'ステージ・レベル・えらんだカードを ほぞん。つづきは ステージの はじめから。',pause(){dashPaused=true;},unpause(){dashPaused=false;Input.raw={};Input.tap=null;},capture(old){if(!dashStarted)return old;return {stage:Math.min(STAGES.length-1,Game.stageIdx+(Game.state==='stageclear'?1:0)),lv:Game.familyLv,char:Game.charId,picks:Game.charPicks,complete:Game.state==='allclear'};},restore(d){AudioEng.init();Game.loadGame({stage:d.stage,lv:d.lv});Game.charId=d.char;Game.charPicks=HGSave.clone(d.picks);Game.toSelect();}});
}
