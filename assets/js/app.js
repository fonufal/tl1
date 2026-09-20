(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const concepts=window.TL1_CONCEPTS, units=window.TL1_UNITS;
const readings=window.TL1_READINGS||{};
const byId=Object.fromEntries(concepts.map(c=>[c.id,c]));
const storeKey='tl1-study-v1';
let state=JSON.parse(localStorage.getItem(storeKey)||'{"sessions":0,"ratings":{},"units":{},"recent":[]}');
let current=null, timer=null, remaining=120, currentStage='read', stageRunning=false;
let mediaRecorder=null, audioStream=null, audioChunks=[], audioUrl='', recognition=null, transcriptFinal='';
const modes=['explique','compare','conecte','exemplo','problema','autor','tempo'];
const labels={explique:'Explique',compare:'Compare',conecte:'Conecte',exemplo:'Dê um exemplo',problema:'Identifique o problema',autor:'Quem propôs isso?',tempo:'Linha do tempo'};
const unitFrames={
 ciencia:'Este tópico pertence ao estudo da Linguística como ciência. O ponto de partida é distinguir opinião sobre a língua de investigação sistemática: conceitos, dados e métodos precisam ser articulados para responder a uma pergunta clara.',
 historia:'Este tópico integra a história das reflexões sobre a linguagem. Ele deve ser compreendido em seu contexto intelectual, sem transformar a história da Linguística numa sequência linear de descobertas europeias.',
 'seculo-xix':'Este tópico participa da consolidação dos estudos histórico-comparativos no século XIX. A questão central é como formular hipóteses históricas controladas a partir de correspondências observáveis entre línguas.',
 saussure:'Este tópico faz parte da concepção saussureana da língua como sistema. Por isso, não deve ser estudado isoladamente: seu sentido depende das relações que mantém com signo, valor, sistema e com o ponto de vista adotado pelo linguista.',
 desdobramentos:'Este tópico pertence a um dos desdobramentos do estruturalismo. As escolas estruturalistas compartilham a atenção às relações, mas não formam uma doutrina única: diferem quanto ao objeto, ao método e ao papel atribuído à função e ao uso.',
 gerativismo:'Este tópico integra o programa gerativista, que desloca o foco para o conhecimento linguístico e para as capacidades mentais que tornam possível adquirir e usar uma língua. Os conceitos devem ser situados no desenvolvimento histórico do programa.',
 funcionalismo:'Este tópico pertence às tradições funcionalistas. A estrutura linguística é examinada em relação a funções comunicativas, discurso, frequência e experiência de uso, sem que isso implique negar a existência de organização gramatical.',
 niveis:'Este tópico corresponde a um domínio de análise. O recorte ajuda a formular perguntas específicas, mas não cria uma fronteira absoluta: fenômenos reais frequentemente exigem a articulação de dois ou mais níveis.'
};
function save(){localStorage.setItem(storeKey,JSON.stringify(state))}
function unitName(id){return units.find(u=>u.id===id)?.title||id}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function route(){
 const hash=(location.hash||'#inicio').split('?')[0], base=hash.split('/')[0], target=document.querySelector(base);
 $$('.view').forEach(v=>v.classList.toggle('active',v===target));
 $$('nav a').forEach(a=>a.toggleAttribute('aria-current',a.getAttribute('href')===base));
 $('nav').classList.remove('open');$('.menu-button').setAttribute('aria-expanded','false');
 if(hash==='#estudo')renderStudy();
 if(hash.startsWith('#glossario')&&location.hash.includes('/')){const id=location.hash.split('/')[1];setTimeout(()=>document.getElementById('g-'+id)?.scrollIntoView(),50)}
 window.scrollTo(0,0);
}
function buildUnits(){
 const available=new Set(concepts.filter(c=>readings[c.id]).map(c=>c.unit));
 $('#unit-select').innerHTML='<option value="all">Curso inteiro</option>'+units.filter(u=>available.has(u.id)).map(u=>`<option value="${u.id}">${u.title}</option>`).join('');
 $('#unit-list').innerHTML=units.map(u=>`<article class="unit"><div class="unit-number">${u.n}</div><div><h2>${u.title}</h2><p>${u.intro}</p><div class="unit-details">${concepts.filter(c=>c.unit===u.id).map(c=>`<a class="chip" href="#glossario/${c.id}">${c.title}</a>`).join('')}</div></div></article>`).join('');
}
function buildGlossary(filter=''){
 const q=filter.trim().toLocaleLowerCase('pt-BR');
 const found=concepts.filter(c=>(c.title+' '+c.definition+' '+c.author).toLocaleLowerCase('pt-BR').includes(q));
 $('#glossary-count').textContent=`${found.length} ${found.length===1?'verbete':'verbetes'}`;
 $('#glossary-list').innerHTML=found.map(c=>`<article class="glossary-entry" id="g-${c.id}"><div><p class="eyebrow">${unitName(c.unit)}</p><h2>${c.title}</h2></div><dl><dt>Definição</dt><dd>${c.definition}</dd><dt>Associado a</dt><dd>${c.author||unitName(c.unit)}</dd><dt>Relaciona-se com</dt><dd>${c.connections.filter(id=>byId[id]).map(id=>byId[id].title).join('; ')||'—'}</dd><dt>Não confundir</dt><dd>${c.error}</dd><dt>Fonte</dt><dd>${c.source}</dd></dl></article>`).join('');
}
function checkedUnits(){
 const selected=$('#unit-select').value;
 return selected==='all'?units.map(u=>u.id):[selected];
}
function choose(arr){return arr[Math.floor(Math.random()*arr.length)]}
function makeChallenge(mode){
 const allowed=checkedUnits();
 let pool=concepts.filter(c=>allowed.includes(c.unit)&&readings[c.id]);
 if(!pool.length)pool=concepts.filter(c=>readings[c.id]);
 const reviewIds=Object.entries(state.ratings).filter(([,r])=>r==='rever').map(([id])=>id);
 const weighted=[...pool,...pool.filter(c=>!state.recent.includes(c.id)),...pool.filter(c=>reviewIds.includes(c.id)),...pool.filter(c=>reviewIds.includes(c.id))];
 const candidates=weighted.filter(x=>x.id!==state.recent.at(-1));
 let c=choose(candidates.length?candidates:weighted);
 mode=mode==='misto'?choose(['explique','exemplo']):mode;
 if(!['explique','exemplo','problema'].includes(mode))mode='explique';
 if(mode==='compare'){
   const validPairs=window.TL1_COMPARISONS.filter(p=>byId[p[0]]&&byId[p[1]]);
   const pairs=validPairs.filter(p=>allowed.includes(byId[p[0]].unit)&&allowed.includes(byId[p[1]].unit));
   const pair=choose(pairs.length?pairs:validPairs); const a=byId[pair[0]],b=byId[pair[1]];
   return {id:a.id,title:`${a.title} × ${b.title}`,unit:a.unit,mode,prompt:'Em que esses conceitos diferem e qual é a relação entre eles? Não os trate automaticamente como opostos.',essential:[a.definition,b.definition,'A comparação deve explicitar critérios e relações, não apenas duas definições isoladas.'],error:`${a.error} Também evite: ${b.error.toLowerCase()}`,example:`Compare os exemplos: ${a.example} / ${b.example}`,connections:[a.id,b.id,...a.connections.slice(0,2)],source:`${a.source} · ${b.source}`};
 }
 if(mode==='conecte'){
   const rel=choose(c.connections.filter(id=>byId[id]))||c.connections[0], d=byId[rel];
   return {...c,title:`${c.title} ↔ ${d?.title||rel}`,mode,prompt:'Que relação teórica, histórica ou analítica existe entre esses dois elementos?',essential:[c.definition,d?.definition||'Explicite a conexão no contexto da unidade.','Indique se a relação é de complementaridade, contraste, desenvolvimento ou interface.']};
 }
 if(mode==='exemplo')return {...c,mode,prompt:`Dê um exemplo que demonstre “${c.title}” e explique por que ele é adequado.`};
 if(mode==='problema')return {...c,mode,title:'Afirmação problemática',prompt:`“${c.error.replace(/[.]$/,'')}.” O que há de problemático nessa afirmação?`,essential:[c.definition,...c.essential]};
 if(mode==='autor'){
   const authored=concepts.filter(x=>x.author&&allowed.includes(x.unit)); c=choose(authored.length?authored:pool);
   return {...c,mode,title:'Autor ou tradição',prompt:`A que autor ou tradição se associa esta formulação? “${c.definition}”`,essential:[`Associação principal: ${c.author||unitName(c.unit)}.`,...c.essential]};
 }
 if(mode==='tempo'){
   const timeline=['panini','comparativismo','neogramaticos','saussure','praga','distribucionalismo','mattoso','gramatica-gerativa','uso'].filter(id=>byId[id]&&allowed.includes(byId[id].unit));
   const fallback=pool.map(x=>x.id).slice(0,3);
   const picks=(timeline.length>=3?timeline:fallback).sort(()=>Math.random()-.5).slice(0,3);
   return {...c,id:picks[0],title:picks.map(id=>byId[id].title).join(' · '),mode,prompt:'Organize historicamente esses elementos e explique uma relação de continuidade ou ruptura entre eles.',essential:['Estabeleça uma ordem histórica aproximada.', 'Evite apresentar a história da Linguística como progresso linear.', 'Explique ao menos uma mudança de objeto, método ou problema.'],example:'Uma resposta forte situa cada elemento e mostra o que muda, sem apagar continuidades.',connections:picks,source:picks.map(id=>byId[id].source).join(' · ')};
 }
 return {...c,mode,prompt:`Explique “${c.title}” com suas próprias palavras e mostre por que esse conceito importa para a teoria.`};
}
function readingHTML(ch,seconds){
 const mins=Math.round(seconds/60), reading=readings[ch.id];
 const selected=reading.blocks.filter(b=>b.t<=seconds);
 const groups=[];
 selected.forEach(b=>{const group=groups.find(g=>g.source===b.source);if(group)group.blocks.push(b);else groups.push({source:b.source,blocks:[b]})});
 const sections=groups.map((g,gi)=>`<section class="source-excerpt"><h3>${groups.length>1?`Seleção ${gi+1}`:'Leitura'}</h3>${g.blocks.map(b=>`<blockquote><p>${b.p}</p></blockquote>`).join('')}<cite>${g.source}</cite></section>`);
 const words=selected.reduce((n,b)=>n+b.p.trim().split(/\s+/).length,0);
 $('#reading-length').textContent=`Material para cerca de ${mins} ${mins===1?'minuto':'minutos'}`;
 $('#reading-words').textContent=`${words} palavras`;
 return sections.join('');
}
function renderChallenge(ch,count=true){
 current=ch;if(count){state.sessions++;state.units[ch.unit]=(state.units[ch.unit]||0)+1;state.recent=[...state.recent,ch.id].slice(-8);save()}
 if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=''}
 audioChunks=[];transcriptFinal='';$('#transcript-text').value='';$('#automated-feedback').innerHTML='';$('#audio-feedback').hidden=true;$('#download-recording').hidden=true;$('#recording-message').textContent='';
 $('#challenge-unit').textContent=unitName(ch.unit);$('#challenge-mode').textContent=labels[ch.mode];$('#challenge-title').textContent=ch.title;$('#challenge-prompt').textContent=ch.prompt;
 $('#reading-content').innerHTML=readingHTML(ch,Number($('#read-time').value));
 $('#essential-list').innerHTML=ch.essential.map(x=>`<li>${x}</li>`).join('');$('#example-text').textContent=ch.example;$('#error-text').textContent=ch.error;$('#source-text').textContent='Fonte: '+ch.source;
 $('#connection-list').innerHTML=[...new Set(ch.connections)].filter(id=>byId[id]).map(id=>`<a class="chip" href="#glossario/${id}">${byId[id].title}</a>`).join('');
 setStage('read',false);
}
function stageDuration(){
 const ids={read:'#read-time',study:'#study-time',speak:'#speak-time'};
 return Number($(ids[currentStage])?.value||0);
}
function setStage(stage,running=false){
 currentStage=stage;stageRunning=running;clearInterval(timer);timer=null;
 ['read','study','speak'].forEach(s=>$('#'+s+'-stage').hidden=s!==stage||!running);
 $('#feedback').hidden=stage!=='check';
 $$('.stage-track li').forEach(li=>{const order=['read','study','speak','check'];li.classList.toggle('active',li.dataset.stage===stage);li.classList.toggle('done',order.indexOf(li.dataset.stage)<order.indexOf(stage))});
 const labels={read:'Iniciar leitura',study:'Iniciar preparação',speak:'Iniciar prática oral',check:'Sortear novo tópico'};
 $('#stage-start').textContent=labels[stage];$('#stage-start').hidden=running&&stage!=='check';
 $('#timer-output').hidden=stage==='check';$('#copy-button').hidden=stage!=='speak'||!running;
 $('#recording-setup').hidden=stage!=='speak'||running;$('#recording-live').hidden=stage!=='speak'||!running||!mediaRecorder;
 const status={read:'A leitura permanece oculta até você iniciar.',study:'A leitura foi encerrada e removida. Inicie a preparação quando estiver pronto.',speak:'A preparação terminou. Inicie a prática oral quando estiver pronto.',check:'Compare sua explicação com os pontos de verificação.'};
 $('#stage-status').textContent=running?'Etapa em andamento. Ao fim do tempo, a tela avançará automaticamente.':status[stage];
 if(stage==='check'){$('#feedback').scrollIntoView({behavior:'smooth',block:'nearest'});return}
 resetTimer();
}
function advanceStage(){
 if(currentStage==='read')setStage('study',false);
 else if(currentStage==='study')setStage('speak',false);
 else if(currentStage==='speak'){stopRecording(true);setStage('check',false)}
 else renderChallenge(makeChallenge($('#mode-select').value));
}
function resetTimer(){clearInterval(timer);timer=null;remaining=stageDuration();$('#timer-output').textContent=format(remaining)}
function format(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
async function startStage(){
 if(currentStage==='check'){renderChallenge(makeChallenge($('#mode-select').value));return}
 if(stageRunning)return;
 if(currentStage==='speak'&&$('#recording-enabled').checked){
   const ok=await startRecording();
   if(!ok)toast('A prática continuará sem gravação.');
 }
 stageRunning=true;$('#'+currentStage+'-stage').hidden=false;$('#stage-start').hidden=true;$('#copy-button').hidden=currentStage!=='speak';
 $('#recording-setup').hidden=true;$('#recording-live').hidden=currentStage!=='speak'||!mediaRecorder;
 $('#stage-status').textContent='Etapa em andamento. Ao fim do tempo, a tela avançará automaticamente.';
 timer=setInterval(()=>{remaining--;$('#timer-output').textContent=format(Math.max(0,remaining));if(remaining<=0){clearInterval(timer);timer=null;stageRunning=false;toast('Tempo encerrado.');advanceStage()}},1000);
}
function speechApi(){return window.SpeechRecognition||window.webkitSpeechRecognition}
async function startRecording(){
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
  $('#audio-feedback').hidden=false;$('#recording-message').textContent='Este navegador não oferece gravação de áudio compatível. Use uma versão atual do Chrome, Edge ou Safari.';return false;
 }
 try{
  audioStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
  audioChunks=[];transcriptFinal='';
  mediaRecorder=new MediaRecorder(audioStream);
  mediaRecorder.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data)};
  mediaRecorder.onstop=finalizeRecording;
  mediaRecorder.start(500);
  const SR=speechApi();
  if(SR){
   recognition=new SR();recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=true;
   recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)transcriptFinal+=t+' ';else interim+=t}$('#transcript-text').value=(transcriptFinal+interim).trim()};
   recognition.onerror=e=>{if(!['no-speech','aborted'].includes(e.error))$('#recording-message').textContent='O áudio foi gravado, mas a transcrição automática pode estar incompleta.'};
   try{recognition.start()}catch(e){}
  }
  return true;
 }catch(e){
  $('#audio-feedback').hidden=false;$('#recording-message').textContent='Não foi possível acessar o microfone. Autorize o uso do microfone no navegador para utilizar esta opção.';return false;
 }
}
function stopRecording(fromTimer=false){
 if(recognition){try{recognition.stop()}catch(e){}recognition=null}
 if(mediaRecorder&&mediaRecorder.state!=='inactive'){mediaRecorder.stop();if(!fromTimer)advanceStage()}
 audioStream?.getTracks().forEach(t=>t.stop());audioStream=null;mediaRecorder=null;$('#recording-live').hidden=true;
}
function finalizeRecording(){
 if(audioUrl)URL.revokeObjectURL(audioUrl);
 const blob=new Blob(audioChunks,{type:audioChunks[0]?.type||'audio/webm'});audioUrl=URL.createObjectURL(blob);
 $('#download-recording').href=audioUrl;$('#download-recording').hidden=false;$('#audio-feedback').hidden=false;
 const text=$('#transcript-text').value.trim();
 $('#recording-message').textContent=speechApi()?(text?'A gravação terminou. Confira a transcrição antes de considerar a devolutiva.':'A gravação foi concluída, mas não houve transcrição. Você pode ouvir ou baixar o áudio e inserir a transcrição manualmente.'):'A gravação foi concluída. Este navegador não oferece transcrição em português; insira uma transcrição para receber a devolutiva.';
 if(text)evaluateTranscript();
}
const stopwords=new Set('a o as os um uma uns umas de da do das dos em no na nos nas por para com sem que e ou se ao aos à às é são foi ser estar como sua seu suas seus isso este esta esses essas entre sobre mais menos muito também não já ainda quando onde quem qual quais porque pois cada todo toda ter tem há'.split(' '));
function norm(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ç ]/g,' ').replace(/\s+/g,' ').trim()}
function keywords(s){return [...new Set(norm(s).split(' ').filter(w=>w.length>4&&!stopwords.has(w)))].slice(0,9)}
function evaluateTranscript(){
 const raw=$('#transcript-text').value.trim(), text=norm(raw);
 if(text.split(' ').filter(Boolean).length<20){$('#automated-feedback').innerHTML='<p><strong>Não há fala suficiente para uma avaliação de conteúdo.</strong> Desenvolva a ideia central, apresente uma relação teórica e inclua um exemplo.</p>';return}
 const criteria=(current.essential||[]).map(item=>{const ks=keywords(item),hits=ks.filter(k=>text.includes(k));return {item,ok:hits.length>=Math.min(2,Math.max(1,Math.ceil(ks.length*.3)))} });
 const covered=criteria.filter(c=>c.ok), missing=criteria.filter(c=>!c.ok);
 const hasExample=/por exemplo|como exemplo|podemos observar|observe|considere|imagine/.test(text);
 const hasStructure=/primeiro|em primeiro lugar|a ideia central|além disso|por outro lado|portanto|assim|em resumo|por fim/.test(text);
 const errorTerms=keywords(current.error||'').filter(k=>text.includes(k));
 const audience=$('#audience-select').value;
 const audienceLabel={graduacao:'colegas de graduação',medio:'estudantes do ensino médio',geral:'público não especialista'}[audience];
 const jargon=keywords(current.definition||'').filter(k=>text.includes(k));
 const score=Math.max(0,Math.min(100,Math.round((covered.length/Math.max(1,criteria.length))*65+(hasExample?15:0)+(hasStructure?10:0)+(raw.split(/\s+/).length>=60?10:5)-(errorTerms.length?10:0))));
 const strengths=[];if(covered.length)strengths.push(`A resposta recupera ${covered.length} de ${criteria.length} pontos essenciais previstos para o tópico.`);if(hasExample)strengths.push('Há sinalização explícita de exemplo ou aplicação.');if(hasStructure)strengths.push('A exposição apresenta marcadores que ajudam a acompanhar a progressão do raciocínio.');
 const improvements=[];if(missing.length)improvements.push(...missing.map(c=>`Desenvolva melhor: ${c.item}`));if(!hasExample)improvements.push('Inclua um exemplo e explique explicitamente por que ele demonstra o conceito.');if(!hasStructure)improvements.push('Organize a fala com ideia central, desenvolvimento e conclusão claramente reconhecíveis.');if(audience!=='graduacao'&&jargon.length)improvements.push(`Para ${audienceLabel}, explique termos técnicos antes de utilizá-los e verifique se o exemplo pode ser compreendido sem conhecimento prévio.`);if(errorTerms.length)improvements.push('Revise a resposta à luz do alerta conceitual apresentado na verificação; a correspondência de palavras não permite concluir sozinha que há erro.');
 $('#automated-feedback').innerHTML=`<span class="feedback-score">Cobertura formativa: ${score}%</span><h4>Pontos fortes</h4><ul>${(strengths.length?strengths:['A resposta foi registrada e pode ser comparada aos pontos essenciais abaixo.']).map(x=>`<li>${x}</li>`).join('')}</ul><h4>O que aprimorar</h4><ul>${(improvements.length?improvements:['A resposta cobre os critérios previstos. Tente agora torná-la mais concisa e adaptar o exemplo ao público escolhido.']).map(x=>`<li>${x}</li>`).join('')}</ul><h4>Clareza para ${audienceLabel}</h4><p>${audience==='graduacao'?'Mantenha a terminologia teórica, mas explicite as relações entre os conceitos e não suponha que o colega leu o mesmo trecho.':'Prefira frases diretas, defina o vocabulário especializado e parta de um exemplo cotidiano antes de apresentar a formulação teórica.'}</p>`;
}
function renderStudy(){
 const ratings=Object.values(state.ratings), review=Object.entries(state.ratings).filter(([,r])=>r==='rever').map(([id])=>byId[id]).filter(Boolean);
 $('#study-stats').innerHTML=`<div class="stat"><strong>${state.sessions}</strong><span>desafios praticados</span></div><div class="stat"><strong>${Object.keys(state.ratings).length}</strong><span>conceitos avaliados</span></div><div class="stat"><strong>${review.length}</strong><span>para rever</span></div>`;
 $('#review-list').innerHTML=review.length?review.map(c=>`<div class="review-item"><a href="#glossario/${c.id}">${c.title}</a></div>`).join(''):'<p>Nenhum conceito marcado ainda.</p>';
 const max=Math.max(1,...Object.values(state.units));
 $('#unit-stats').innerHTML=units.map(u=>{const n=state.units[u.id]||0;return `<div class="bar-row"><div class="bar-label"><span>${u.title}</span><span>${n}</span></div><div class="bar"><span style="width:${n/max*100}%"></span></div></div>`}).join('');
}
window.addEventListener('hashchange',route);$('.menu-button').onclick=()=>{const n=$('nav');n.classList.toggle('open');$('.menu-button').setAttribute('aria-expanded',n.classList.contains('open'))};
$('#glossary-search').addEventListener('input',e=>buildGlossary(e.target.value));
$('#draw-button').onclick=()=>renderChallenge(makeChallenge($('#mode-select').value));
$('#stage-start').onclick=startStage;
$('#recording-enabled').onchange=e=>$('#audience-field').hidden=!e.target.checked;
$('#stop-recording').onclick=()=>stopRecording(false);
$('#evaluate-transcript').onclick=evaluateTranscript;
$('#copy-button').onclick=async()=>{await navigator.clipboard.writeText(`${current.title}\n${current.prompt}`);toast('Desafio copiado.')};
$('#read-time').onchange=()=>{if(!stageRunning){resetTimer();if(currentStage==='read'&&current)$('#reading-content').innerHTML=readingHTML(current,Number($('#read-time').value))}};
['#study-time','#speak-time'].forEach(id=>$(id).onchange=()=>{if(!stageRunning)resetTimer()});
$$('.rating-buttons button').forEach(b=>b.onclick=()=>{state.ratings[current.id]=b.dataset.rating;save();toast('Autoavaliação salva neste dispositivo.');renderChallenge(makeChallenge($('#mode-select').value))});
$('#clear-history').onclick=()=>{if(confirm('Apagar todo o histórico salvo neste navegador?')){state={sessions:0,ratings:{},units:{},recent:[]};save();renderStudy();toast('Histórico apagado.')}};
buildUnits();buildGlossary();route();renderChallenge(makeChallenge('explique'),false);
})();
