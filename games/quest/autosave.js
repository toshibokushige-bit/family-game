if(typeof HGSave!=='undefined'){
 let checkpoint=null;
 const flags=a=>Array.isArray(a)&&a.length===5&&a.every(v=>typeof v==='boolean');
 const valid=d=>!!d&&flags(d.c1)&&flags(d.c2)&&(!d.run||validRun(d.run));
 function validRun(r){const s=r.s;if(!s||!CHARS[r.ch]||!DIFFS[r.diff]||!Number.isInteger(r.uid)||r.uid<0||!Number.isFinite(s.maxHp)||!Number.isFinite(s.hp)||s.hp<=0||s.hp>s.maxHp||!Number.isInteger(s.floor)||s.floor<0||s.floor>28||!Number.isFinite(s.gold)||s.gold<0)return false;
  if(!Array.isArray(s.deck)||!s.deck.length||s.deck.length>500||!s.deck.every(c=>CARDS[c.id]&&Number.isInteger(c.uid)&&typeof c.up==='boolean')||!Array.isArray(s.relics)||!s.relics.every(id=>RELICS[id]||ANCIENTS[id])||!Array.isArray(s.potions)||!s.potions.every(p=>POTIONS[p.id]))return false;
  const m=s.map;if(!m||![1,2].includes(m.stage)||!Array.isArray(m.cols)||!Number.isInteger(m.ci)||m.ci<0||m.ci>=m.cols.length)return false;
  const node=n=>n&&NODE_LABEL[n.t]&&typeof n.done==='boolean';if(!m.cols.every(c=>c.kind==='single'?node(c.node):c.kind==='branch'&&Array.isArray(c.lanes)&&c.lanes.length>0&&c.lanes.length<=3&&c.lanes.every(l=>typeof l.name==='string'&&Array.isArray(l.nodes)&&l.nodes.length>0&&l.nodes.length<=14&&l.nodes.every(node)))||!Number.isInteger(m.lane)||m.lane< -1||!Number.isInteger(m.li)||m.li<0)return false;
  const current=m.cols[m.ci];return current.kind==='single'?m.lane===-1&&m.li===0:m.lane===-1?m.li===0:m.lane<current.lanes.length&&m.li<current.lanes[m.lane].nodes.length;
 }
 function progress(d){CLEARED1=CLEARED1.map((v,i)=>v||d.c1[i]);CLEARED2=CLEARED2.map((v,i)=>v||d.c2[i]);}
 const originalMap=showMap;showMap=function(){const result=originalMap.apply(this,arguments);const ch=Object.keys(CHARS).find(k=>CHARS[k]===S.ch),diff=Object.keys(DIFFS).find(k=>DIFFS[k]===DIFF);checkpoint={s:HGSave.clone({...S,ch:null,combat:null}),ch,diff,uid:CARD_UID};if(questAuto)questAuto.capture();return result;};
 let questAuto=HGSave.mount('quest',{validate:valid,progress(d){progress(d);checkpoint=d.run;renderTitle();},note:'クリアきろくは じどうで おもいだします。ぼうけんは さいごの マップから さいかい。',capture(previous){return {c1:CLEARED1,c2:CLEARED2,run:_ended?null:checkpoint||previous?.run||null};},restore(d){if(S&&S.combat)throw Error('せんとう中は きろくを もどせません。ページを ひらきなおしてね');progress(d);if(d.run){checkpoint=HGSave.clone(d.run);S=HGSave.clone(d.run.s);S.ch=CHARS[d.run.ch];DIFF=DIFFS[d.run.diff];CARD_UID=d.run.uid;_ended=false;$("topbar").classList.add('on');showMap();}else{renderTitle();show('title-screen');}}});
 const originalPass=enterPass;enterPass=function(){const c1=CLEARED1.slice(),c2=CLEARED2.slice();originalPass();CLEARED1=CLEARED1.map((v,i)=>v||c1[i]);CLEARED2=CLEARED2.map((v,i)=>v||c2[i]);if(questAuto)questAuto.capture();renderTitle();};
}
