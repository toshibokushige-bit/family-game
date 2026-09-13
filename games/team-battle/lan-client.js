let online=null,lanTimer=null;
function lanDialog(message='へやを つくるか、ばんごうを いれてね'){
 let box=document.getElementById('lan-dialog');if(!box){box=document.createElement('dialog');box.id='lan-dialog';box.style.cssText='max-width:560px;width:85%;background:#254452;color:#edf3df;border:2px solid #ffe2a0;border-radius:16px;padding:24px;font:20px sans-serif';box.innerHTML='<h2>ふたりで LANたいせん</h2><p id="lan-note"></p><p>おなじ Wi-Fiで あそぼう。えらんだ リーダーで さんかするよ。</p><label>へやの ばんごう / ふっきの あいことば<input id="lan-code" autocomplete="off" style="display:block;width:95%;font:18px monospace;padding:10px;margin:12px 0"></label><div id="lan-actions"></div>';
 document.body.appendChild(box);}box.querySelector('#lan-code').parentElement.style.display='';box.querySelector('#lan-note').textContent=message;const actions=box.querySelector('#lan-actions');actions.replaceChildren();
 const add=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='font:18px sans-serif;padding:12px;margin:5px;border-radius:8px';b.onclick=fn;actions.appendChild(b);};
 if(online){box.querySelector('#lan-code').value=online.room+'.'+online.token;add('とじる',()=>box.close());add('たいせんから でる',()=>{box.close();leaveLan();});}
 else {add('へやを つくる',()=>enterLan('create'));add('へやに はいる',()=>enterLan('join'));add('つづきに もどる',()=>enterLan('resume'));add('とじる',()=>box.close());}
 if(!box.open)box.showModal();
}
// 公開サイトでは家庭内サーバーへの入口を表示する。
function lanAvailable(){
 if(location.protocol==='file:')return true;
 var h=location.hostname;
 return h==='localhost'||h==='127.0.0.1'||h==='[::1]'||
  /^192\.168\./.test(h)||/^10\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||/\.local$/.test(h);
}
function openLan(){
 if(!lanAvailable()||location.protocol==='file:'){lanUnavailableDialog();return;}
 if(location.port!=='8770'){location.href=location.protocol+'//'+location.hostname+':8770/#lan';return;}
 lanDialog();
}
// おうちの パソコンの アドレスは リポジトリに うめこまない。
// URLの #home= に おぼえさせる（ブックマークに のこる）か、その ばで いれてもらう。
function homeHostFromHash(){
 const m=/[#&]home=([^&]+)/.exec(location.hash||'');
 return m?decodeURIComponent(m[1]):'';
}
// 「192.168.1.10」「192.168.1.10:8770」「http://192.168.1.10:8770/」などを うけつける
function normalizeHomeUrl(input){
 let v=String(input||'').trim();
 if(!v)return '';
 v=v.replace(/^https?:\/\//i,'').replace(/[\/#].*$/,'');
 if(!v)return '';
 if(!/:\d+$/.test(v))v+=':8770';
 return 'http://'+v+'/#lan';
}
function lanUnavailableDialog(){
 lanDialog('おうちで ふたりたいせん！ おなじ Wi-Fiに つないで、おうちの パソコンで サーバーを うごかしてね。');
 const box=document.getElementById('lan-dialog'),code=box.querySelector('#lan-code');
 code.parentElement.style.display='none';
 const actions=box.querySelector('#lan-actions');actions.replaceChildren();

 const hint=document.createElement('p');
 hint.textContent='パソコンの がめんに でた「http://…:8770/」を いれてね。';
 hint.style.cssText='margin:4px 0 8px';actions.appendChild(hint);

 const address=document.createElement('input');
 address.value=homeHostFromHash();
 address.placeholder='192.168.x.x:8770';
 address.setAttribute('aria-label','おうちの パソコンの アドレス');
 address.autocomplete='off'; address.spellcheck=false;
 address.style.cssText='width:95%;padding:10px;font:16px monospace;user-select:text;border-radius:8px';
 actions.appendChild(address);

 const err=document.createElement('p');
 err.style.cssText='margin:6px 0;min-height:1.4em;color:#ffd0a8';actions.appendChild(err);

 const go=document.createElement('button');
 go.textContent='おうちの たいせんへ →';
 go.style.cssText='display:block;width:100%;padding:16px;margin:8px 0;background:#a77837;color:white;border:0;border-radius:10px;font:18px sans-serif';
 go.onclick=()=>{
  const url=normalizeHomeUrl(address.value);
  if(!url){err.textContent='アドレスを いれてね。';address.focus();return;}
  // つぎに この ページを ひらいた ときの ために おぼえておく（ブックマークに のこる）
  try{ location.hash='home='+encodeURIComponent(url.replace(/^http:\/\//,'').replace(/\/#lan$/,'')); }catch(e){}
  location.href=url;
 };
 actions.appendChild(go);

 const close=document.createElement('button');
 close.textContent='とじる';
 close.style.cssText='font:18px sans-serif;padding:12px;margin:5px;border-radius:8px';
 close.onclick=()=>box.close();
 actions.appendChild(close);
 address.focus();
}
async function lanFetch(data){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);try{const r=await fetch('/api/lan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});const result=await r.json();if(!r.ok)throw Object.assign(Error(result.error||'つなぎなおしてね'),{server:true});return result;}finally{clearTimeout(timeout);}}
async function enterLan(op){const input=document.getElementById('lan-code').value.trim(),parts=input.split('.'),data=op==='resume'?{op:'state',room:parts[0],token:parts[1]}:{op,room:input,leader};
 const controls=document.querySelectorAll('#lan-actions button');controls.forEach(b=>b.disabled=true);
 try{const state=await lanFetch(data);online={room:state.room,token:state.token||parts[1],lastRound:0,lastPhase:null,pending:null,busy:false,error:''};location.hash='lan='+online.room+'.'+online.token;document.getElementById('lan-dialog').close();modal=null;fx=null;undoState=null;selected=null;applyLan(state);clearInterval(lanTimer);lanTimer=setInterval(pollLan,1200);}
 catch(err){document.getElementById('lan-note').textContent=err.server?err.message:'PCに つながらないよ。同じ Wi-Fiか たしかめてね。';}finally{controls.forEach(b=>b.disabled=false);}
}
function leaveLan(){online=null;clearInterval(lanTimer);location.hash='';g=null;modal=null;screen='title';render();}
function sendLan(action,args=[]){if(!online||online.pending)return false;online.pending={op:'action',room:online.room,token:online.token,round:g.round,action,args,command:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};modal=null;selected=null;undoState=null;pollLan();return true;}
async function pollLan(){const session=online;if(!session||session.busy)return;session.busy=true;const command=session.pending;
 try{const data=await lanFetch(command||{op:'state',room:session.room,token:session.token});if(online!==session)return;session.error='';if(command)session.pending=null;applyLan(data);}
 catch(err){if(online!==session)return;if(err.server&&command)session.pending=null;session.error=err.server?err.message:'つなぎなおし中… このまま まってね';render();}
 finally{session.busy=false;}
}
function applyLan(data){if(!online)return;const wasRound=online.lastRound,wasPhase=online.lastPhase;Object.assign(online,{...data,state:undefined});g=Object.assign(Object.create(Engine.prototype),data.state);
 for(const name of ['buy','sell','upgrade','refresh','reward','place'])g[name]=(p,...args)=>sendLan(name,args);
 // The server owns all mutations; UI helpers only request legal actions.
 g.checkpoint=()=>{throw Error('LANでは ふっきの あいことばを つかってね');};
 if(!data.started||data.ready||data.advanced){screen='lanwait';modal=null;}
 else if(g.phase==='prep'){if(wasPhase!=='prep'||wasRound!==g.round||screen==='lanwait'){screen='prep';modal=null;selected=null;}}
 else if(wasRound!==g.round||wasPhase==='prep'||!wasPhase){const r=g.results.find(r=>r.x===0||r.y===0);oldHearts=g.previousStandings.find(p=>p.id===0)?.hp||25;modal=null;fx=null;selected=null;
  if(r?.frames.length){replay=r;frame=0;paused=false;elapsed=0;screen='battle';tick();}else screen='result';
 }
 online.lastRound=g.round;online.lastPhase=g.phase;render();
}
function drawLanWait(){text(!online.started?'あいてが はいるのを まっているよ':online.ready?'じゅんび OK！ あいてを まとう':'つぎの おみせを まっているよ',480,190,28,'#ffe2a0','center');text('へやの ばんごう　'+online.room,480,265,30,'#c6e9dc','center');text(!online.started?'もうひとりも このページを ひらいて ばんごうを いれてね。':'ふたりの じゅんびが できると すすむよ。',480,320,19,'#c6e9dc','center');if(online.ready)button('じゅんびを やりなおす',305,383,350,54,()=>sendLan('unready'),true,'#a77837');button('ふっきの あいことば',305,455,350,48,()=>lanDialog('ページを とじても、この あいことばで もどれるよ。'));}
function decorateLan(){if(!online)return;
 if(screen==='prep')for(const b of buttons){if(b.label==='キープ'||b.label==='❄ ON')b.fn=()=>sendLan('freeze');if(b.label==='あいことば')b.fn=()=>lanDialog('この あいことばは じぶんだけで つかってね。');}
 // Sales cannot use a local undo snapshot in a shared match.
 if(modal?.sell){const b=buttons.find(b=>b.label==='うる');if(b)b.fn=()=>sendLan('sell',[modal.sell]);}
 if(screen==='finish')for(const b of buttons)b.fn=leaveLan;
 if(online.pending){buttons=[];rect(220,215,520,95,'#253f4ff5');text('そうさを とどけているよ…',480,271,24,'#ffe2a0','center');}
 rect(0,0,820,43,'#152e3b',0);text('LAN '+online.room+' / '+(g.players[0].hp<=0?'かんせん':g.players[0].name)+(online.started&&!online.otherConnected?' / あいてが つなぎなおし中':''),155,29,14,'#aee4db');
 if(online.error){rect(12,507,936,32,'#683d40');text(online.error,24,530,16,'#fff0d9');}
 if(!modal)button('へや',727,8,90,32,()=>lanDialog('ふっきの あいことばは じぶんだけで つかってね。'));
}
function lanNext(){if(g.phase==='end'){screen='finish';render();return;}if(g.players[0].hp<=0){screen='result';notice='ほかの チームを かんせんしているよ';render();return;}sendLan('advance');}
if(typeof window!=='undefined')window.addEventListener('load',()=>{if(location.hash==='#lan')openLan();else if(location.hash.startsWith('#lan=')){lanDialog('つづきに もどろう');document.getElementById('lan-code').value=location.hash.slice(5);enterLan('resume');}});
