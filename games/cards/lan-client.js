  var online=null,lanTimer=null,lanEntering=false,lanAttempt=null;
  function lanNonce(){var a=new Uint8Array(20);crypto.getRandomValues(a);return Array.from(a,function(v){return v.toString(16).padStart(2,'0');}).join('');}
  function lanLocal(){var h=location.hostname;return h==='localhost'||h==='127.0.0.1'||h==='[::1]'||/^192\.168\./.test(h)||/^10\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||/\.local$/.test(h);}
  function lanDialog(message){
    $('lan-home-wrap').hidden=true;
    $('lan-note').textContent=message||'へやを つくるか、6けたの ばんごうを いれてね';
    $('lan-code').value=online?online.room+'.'+online.token:'';
    $('lan-code-label').textContent=online?'じぶんの ふっきの あいことば':'へやの ばんごう ／ ふっきの あいことば';
    $('lan-create').hidden=!!online;$('lan-join').hidden=!!online;$('lan-resume').hidden=!!online;$('lan-leave').hidden=!online;
    $('lan-code-wrap').hidden=false;$('lan-copy').hidden=!online;
    if(!$('lan-dialog').open)$('lan-dialog').showModal();
  }
  function openLan(){
    if(online){lanDialog('この あいことばは じぶんだけで つかってね。ページを とじても もどれるよ。');return;}
    if(location.protocol==='file:'||!lanLocal()){
      lanDialog('おうちで ふたりたいせん！ 同じWi-Fiに つないで、おうちのPCで サーバーを うごかしてね。');
      ['lan-create','lan-join','lan-resume','lan-code-wrap'].forEach(function(id){$(id).hidden=true;});
      $('lan-home-wrap').hidden=false;$('lan-home-address').value=homeHostFromHash();$('lan-home-error').textContent='';$('lan-home-address').focus();return;
    }
    if(location.port!=='8771'){location.href='http://'+location.hostname+':8771/#lan';return;}
    lanDialog();
  }
  function homeHostFromHash(){var m=/(?:#|&)home=([^&]+)/.exec(location.hash||'');try{return m?decodeURIComponent(m[1]):'';}catch(e){return '';}}
  function normalizeHomeUrl(input){
    var v=String(input||'').trim();if(!v)return '';
    try{var u=new URL(/^https?:\/\//i.test(v)?v:'http://'+v);if(!/^https?:$/.test(u.protocol)||!u.hostname||u.username||u.password)return '';return 'http://'+u.hostname+':'+(u.port||'8771')+'/#lan';}catch(e){return '';}
  }
  function goHomeLan(){var url=normalizeHomeUrl($('lan-home-address').value);if(!url){$('lan-home-error').textContent='PCの アドレスを いれてね。';$('lan-home-address').focus();return;}location.hash='home='+encodeURIComponent(url.replace(/^http:\/\//,'').replace(/\/#lan$/,''));location.href=url;}
  async function lanFetch(data){var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},8000);try{var response=await fetch('/api/lan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});var value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'もういちど えらんでね'),{server:true,status:response.status});return value;}finally{clearTimeout(timeout);}}
  async function enterLan(op){
    if(lanEntering)return;var input=$('lan-code').value.trim(),parts=input.split('.');
    if(op==='join'&&!/^\d{6}$/.test(input)){$('lan-note').textContent='6けたの へやの ばんごうを いれてね';return;}
    if(op==='resume'&&(!/^\d{6}$/.test(parts[0])||! /^[a-f0-9]{48}$/.test(parts[1]||''))){$('lan-note').textContent='ふっきの あいことばを ぜんぶ はりつけてね';return;}
    var key=op+':'+input;if(!lanAttempt||lanAttempt.key!==key)lanAttempt={key:key,id:lanNonce()};
    var data=op==='resume'?{op:'state',room:parts[0],token:parts[1]}:{op:op,room:input,requestId:lanAttempt.id};lanEntering=true;
    ['lan-create','lan-join','lan-resume'].forEach(function(id){$(id).disabled=true;});$('lan-note').textContent='つないでいるよ…';
    try{var value=await lanFetch(data);online={room:value.room,token:value.token||parts[1],rev:-1,pending:null,busy:false,error:'',otherConnected:false};mode='lan';humanIdx=value.id;tut=null;ui={selectedAttacker:null,anim:null,deadGhost:null,fullLogReturn:'screen-game',slots:[[null,null,null,null],[null,null,null,null]]};
      location.hash='lan='+online.room+'.'+online.token;document.body.classList.add('animal-online');$('lan-session').classList.remove('hidden');$('lan-dialog').close();applyLan(value);clearInterval(lanTimer);lanTimer=setInterval(pollLan,1200);lanAttempt=null;
    }catch(e){$('lan-note').textContent=e.server?e.message:'PCに つながらないよ。同じWi-Fiか たしかめて、もういちど おしてね。';}
    finally{lanEntering=false;['lan-create','lan-join','lan-resume'].forEach(function(id){$(id).disabled=false;});}
  }
  function leaveLan(){online=null;clearInterval(lanTimer);lanTimer=null;location.hash='';document.body.classList.remove('animal-online');$('lan-session').classList.add('hidden');$('lan-dialog').close();closeModal();closeInspect();gameState=null;mode='cpu';humanIdx=0;tut=null;showScreen('screen-title');}
  function updateLanStatus(){if(!online)return;$('lan-room-label').textContent='へや '+online.room;$('lan-connection').textContent=online.error||(online.pending?'そうさを とどけているよ…':!online.started?'あいてを まっているよ':!online.otherConnected?'あいてが つなぎなおし中':'つながっているよ');}
  function sendLan(action,args){if(!online||online.pending||online.error)return;online.pending={op:'action',room:online.room,token:online.token,rev:online.rev,action:action,args:args||[],command:lanNonce()};closeModal();ui.selectedAttacker=null;render();updateLanStatus();pollLan();}
  async function pollLan(){var session=online;if(!session||session.busy)return;session.busy=true;var command=session.pending;
    try{var value=await lanFetch(command||{op:'state',room:session.room,token:session.token});if(online!==session)return;var hadError=!!session.error;session.error='';if(command)session.pending=null;applyLan(value,hadError||!!command);}
    catch(e){if(online!==session)return;if(e.server&&command){session.pending=null;session.rev=-1;}session.error=e.server?e.message:'つなぎなおし中… このまま まってね';updateLanStatus();if(gameState&&gameState.phase!=='gameover')render();}
    finally{session.busy=false;}
  }
  function applyLan(value,force){
    if(!online)return;online.started=value.started;online.otherConnected=value.otherConnected;updateLanStatus();if(value.rev===online.rev&&!force)return;
    var old=gameState,selectedId=ui.selectedAttacker&&ui.selectedAttacker.card.netId;
    var next=value.state;next.battleRemaining=next.battleIds.map(function(id){return next.players[next.acting].field.find(function(m){return m.card.netId===id;});}).filter(Boolean);delete next.battleIds;
    online.rev=value.rev;gameState=next;humanIdx=value.id;
    // Reconnect and each revision rebuild object references; keep positions by stable IDs.
    ui.slots=ui.slots.map(function(slots,id){return slots.map(function(m){return m?next.players[id].field.find(function(n){return n.card.netId===m.card.netId;})||null:null;});});
    ui.selectedAttacker=next.acting===humanIdx?next.players[humanIdx].field.find(function(m){return m.card.netId===selectedId&&next.battleRemaining.includes(m);})||null:null;
    ui.anim=null;ui.deadGhost=null;closeModal();closeInspect();
    if(old&&old.phase!=='init'&&value.rev>0){
      var before=old.players.map(function(p){return p.hp;}),after=next.players.map(function(p){return p.hp;});
      ui.anim=buildAttackAnim(before,after,{});
      next.players.forEach(function(p,id){p.field.forEach(function(m){var previous=old.players[id].field.find(function(n){return n.card.netId===m.card.netId;});if(!previous)ui.anim.summonedCard=m;else if(m.damage>previous.damage){ui.anim.hitCard=m;ui.anim.dmgTargetMon=m;ui.anim.dmgText=String(m.damage-previous.damage);}});});
      if(old.acting===next.acting&&old.phase==='battle'&&next.phase==='battle'){
        var spent=old.battleRemaining.find(function(m){return !next.battleRemaining.some(function(n){return n.card.netId===m.card.netId;});});
        if(spent){ui.anim.attackerCard=next.players[next.acting].field.find(function(m){return m.card.netId===spent.card.netId;});var target=old.players[1-next.acting].field.find(function(m){return !next.players[1-next.acting].field.some(function(n){return n.card.netId===m.card.netId;});});if(target){ui.deadGhost={ownerIdx:1-next.acting,mon:target};ui.anim.dmgTargetMon=target;ui.anim.dmgText=String(Engine.previewAttack(old,spent,target));}}
      }
    }
    if(!value.started){$('lan-wait-code').textContent=value.room;showScreen('screen-lan-wait');return;}
    if(next.phase==='gameover'){if(!old||old.phase!=='gameover'){showScreen('screen-game');render();setTimeout(function(){if(gameState===next)showVictory();},900);}return;}
    var current=getCurrentScreenId();if(current!=='screen-fulllog')showScreen('screen-game');
    if(old&&next.players.some(function(p,i){return p.hp<old.players[i].hp;}))Sound.bodyDamage();
    render();
    ui.anim=null;if(ui.deadGhost)setTimeout(function(){if(gameState===next){ui.deadGhost=null;render();}},900);
    if(current==='screen-fulllog')$('fulllog-content').textContent=buildDisplayLog(next.log).join('\n');
  }
  function lanMainAction(){
    if(!isMyInteractiveTurn())return;var p=gameState.phase,action=p==='charge'?'play':p==='play'?'battle':p==='battle'?'end':null;if(!action)return;
    var remaining=p==='charge'?hasChargeRemaining():p==='play'?hasPlayRemaining():hasBattleRemaining();
    if(remaining)openConfirmModal(p==='charge'?'まだ おうえんに まわせるよ。つぎへ すすむ？':p==='play'?'まだ カードを だせるよ。つぎへ すすむ？':'まだ こうげき できるよ。ばんを おわる？',function(){sendLan(action);});else sendLan(action);
  }
  function lanHandModal(c){
    if(!isMyInteractiveTurn())return;setModalCard(c,'こうげき '+c.atk+' / ぼうぎょ '+c.df+' / たいりょく '+c.hp);var b=$('modal-buttons');b.innerHTML='';
    var charging=gameState.phase==='charge',check=charging?{ok:Engine.canChargeMore(gameState),reason:'この ばんは もう おうえんに まわせないよ'}:Engine.canSummon(gameState,c);
    $('modal-title').textContent=charging?'おうえんに まわしますか？':'このカードを だしますか？';b.appendChild(mkModalButton(charging?'おうえんに まわす':'だす',check.ok,function(){sendLan(charging?'charge':'summon',[c.netId]);}));if(!check.ok)b.appendChild(mkReason(check.reason));b.appendChild(mkModalButtonClass('やめる','btn-plain',closeModal));openModal();
  }
  function lanRetreat(m){if(!isMyInteractiveTurn())return;setModalCard(m.card,'たいきゃくすると '+m.card.rarityNum+'ダメージ うけます');$('modal-title').textContent='たいきゃく しますか？';var b=$('modal-buttons');b.innerHTML='';b.appendChild(mkModalButtonClass('たいきゃくする','btn-danger',function(){sendLan('retreat',[m.card.netId]);}));b.appendChild(mkModalButtonClass('やめる','btn-plain',closeModal));openModal();}
  function initLan(){
    $('lan-home-go').onclick=goHomeLan;
    $('btn-vs-lan').onclick=openLan;$('lan-room-button').onclick=openLan;$('lan-wait-room').onclick=openLan;
    $('lan-create').onclick=function(){enterLan('create');};$('lan-join').onclick=function(){enterLan('join');};$('lan-resume').onclick=function(){enterLan('resume');};$('lan-close').onclick=function(){if(!lanEntering)$('lan-dialog').close();};$('lan-leave').onclick=leaveLan;
    $('lan-copy').onclick=async function(){var input=$('lan-code');input.select();try{await navigator.clipboard.writeText(input.value);$('lan-note').textContent='コピーしたよ。じぶんの メモに のこしてね。';}catch(e){$('lan-note').textContent='あいことばを ながおしして コピーしてね。';}};
    $('lan-dialog').addEventListener('cancel',function(e){if(lanEntering)e.preventDefault();});
    document.addEventListener('visibilitychange',function(){if(!document.hidden)pollLan();});
    if(location.hash==='#lan')openLan();else if(/^#lan=\d{6}\.[a-f0-9]{48}$/.test(location.hash)){if(lanLocal()&&location.port==='8771'){lanDialog();$('lan-code').value=location.hash.slice(5);enterLan('resume');}}
  }
