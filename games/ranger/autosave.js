if(typeof HGSave!=='undefined'){
 let previousPause=false;
 const int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
 const valid=d=>d&&int(d.coins,0,1000000000)&&int(d.cleared,0,STAGES.length)&&Array.isArray(d.lv)&&d.lv.length===5&&d.lv.every(v=>int(v,1,15))&&Array.isArray(d.cc)&&d.cc.length===5&&d.cc.every(v=>typeof v==='boolean')&&Array.isArray(d.stars)&&d.stars.length===STAGES.length&&d.stars.every(v=>int(v,0,3));
 function apply(d,merge=false){const old=HGSave.clone(Save);for(const k of ['coins','cleared','lv','cc','stars'])Save[k]=HGSave.clone(d[k]);if(merge){Save.cleared=Math.max(old.cleared,Save.cleared);Save.lv=Save.lv.map((v,i)=>Math.max(v,old.lv[i]));Save.cc=Save.cc.map((v,i)=>v||old.cc[i]);Save.stars=Save.stars.map((v,i)=>Math.max(v,old.stars[i]));}}
 HGSave.mount('ranger',{validate:valid,pause(){previousPause=Battle.paused;Battle.paused=true;},unpause(){Battle.paused=previousPause;},progress(d){apply(d);},note:'コイン・レベル・クリアきろくを じどうほぞん。バトルは ステージの はじめから。',capture(){return HGSave.clone(Save);},restore(d){Battle.on=false;apply(d,true);buildHome();showScr('#scr-home');}});
}
