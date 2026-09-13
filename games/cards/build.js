const fs=require('fs');
const read=f=>fs.readFileSync(__dirname+'/'+f,'utf8').replace(/\r\n/g,'\n');
let html=read('source.html'),app=read('app.js');
function patch(a,b){if(!app.includes(a))throw Error('Missing hook: '+a);app=app.replace(a,b);}
patch("gameState.acting === selfIndex();", "gameState.acting === selfIndex() && (!online || (!online.pending && !online.error));");
patch("f.textContent = ui.anim.dmgText;", "f.textContent = isZero ? 'ガード' : '−'+ui.anim.dmgText;");
patch("titleEl.textContent = 'あいての ターン…';","titleEl.textContent = online && (online.pending || online.error) ? 'つうしん中…' : 'あいての ターン…';");
for(const [signature,body] of [
 ['onMainAction()','if(online){lanMainAction();return;}'],
 ['openHandCardModal(card, sourceEl)','if(online){lanHandModal(card);return;}'],
 ['openRetreatConfirm(m)','if(online){lanRetreat(m);return;}'],
 ['performAttack(attacker, target)',"if(online){sendLan('attack',[attacker.card.netId,target?target.card.netId:null]);return;}"],
 ['doEndTurn()',"if(online){sendLan('end');return;}"],
 ['maybeRunCpu()','if(online)return;']])patch('function '+signature+' {','function '+signature+' {\n    '+body);
patch("$('btn-again').onclick = function () { goToJanken(); };","$('btn-again').onclick = function () { if(online){leaveLan();return;}goToJanken(); };");
patch("$('btn-title2').onclick = function () { showScreen('screen-title'); };","$('btn-title2').onclick = function () { if(online){leaveLan();return;}showScreen('screen-title'); };");
patch('  // 初期画面',read('lan-client.js')+'\n  // 初期画面');
patch('  initAnimalUI();','  initAnimalUI();\n  initLan();');
// Initialize automatic reconnection only after the default screen has been selected.
app=app.replace('  initLan();','').replace("  showScreen('screen-title');\n})();","  showScreen('screen-title');\n  initLan();\n})();");
if(!app.includes('  initLan();'))throw Error('Initialization hook missing');
for(const [name,code]of [['ai.js',read('ai.js')],['engine.js',read('engine.js')],['app.js',app]]){
 const marker='// ==== '+name+' ====',start=html.indexOf(marker),end=html.indexOf('</script>',start);
 if(start<0||end<0)throw Error(name);html=html.slice(0,start)+marker+'\n'+code.trim()+'\n'+html.slice(end);
}
html=html.replace('</style>',read('lan.css')+'\n</style>');
html=html.replace('<div id="app">','<div id="app">'+read('lan.html'));
html=html.replace('<button id="btn-vs-human"','<button id="btn-vs-lan" class="btn-primary btn-block">2だいで たたかう<span class="btn-sub">同じWi-Fiで へやに さんか</span></button><button id="btn-vs-human"');
html=html.replace('v0.3.0 · イラストばん','v0.4.0 · 2たんまつ たいせん');
fs.writeFileSync(__dirname+'/index.html',html);console.log('Built index.html');
