(() => {
  "use strict";
  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  const BASE = Array.isArray(window.TL1_QUIZ_QUESTIONS) ? window.TL1_QUIZ_QUESTIONS : [];
  const UNITS = window.TL1_QUIZ_UNITS || [["all", "Todas as unidades"]];
  const KEY = "tl1-quiz-custom-v1";
  const alphabet = "ABCD";
  let custom = loadCustom();
  let page = "home", peer = null, conn = null, host = null, guest = null, solo = null, sessionTimer = null;
  const $ = (sel) => app.querySelector(sel);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const btn = (act, label, cls = "btn") => '<button type="button" class="' + cls + '" data-act="' + act + '">' + label + "</button>";
  const title = (name, sub) => '<div class="room-head"><div><p class="eyebrow">EM QUESTÃO / TEORIA LINGUÍSTICA 1</p><h1>' + name + '</h1><p class="smallnote">' + sub + '</p></div><div class="btnline">' + btn("home","Voltar ao início","btn quiet small") + "</div></div>";
  const all = () => BASE.concat(custom);
  const unitName = (id) => (UNITS.find(u => u[0] === id) || [id,id])[1];
  const pick = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const shuffle = (a) => { a = a.slice(); for(let i=a.length-1;i>0;i--){const j=pick(i+1);[a[i],a[j]]=[a[j],a[i]];}return a; };
  const roomURL = (pin) => new URL("./?pin="+pin, location.href).href;
  function loadCustom() {try {const a=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(a)?a.filter(validateQuestion):[];} catch (_) {return [];} }
  function persist() {try{localStorage.setItem(KEY,JSON.stringify(custom));}catch(_){notify("O navegador não permitiu salvar o banco local.");}}
  function validateQuestion(q) {return q && typeof q.id==="string" && q.id.length<90 && typeof q.unit==="string" && typeof q.q==="string" && q.q.length>=8 && q.q.length<=400 && Array.isArray(q.a) && q.a.length===4 && q.a.every(t=>typeof t==="string"&&t.trim().length>0&&t.length<=240) && Number.isInteger(q.correct) && q.correct>=0 && q.correct<4 && typeof q.why==="string"&&q.why.length<=600;}
  function notify(msg) {toastEl.textContent=msg;toastEl.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toastEl.classList.remove("show"),4800);}
  function destroyConnection() {
    if(sessionTimer) clearInterval(sessionTimer);
    sessionTimer=null;
    if(conn){try{conn.close();}catch(_){}conn=null;}
    if(peer){try{peer.destroy();}catch(_){}peer=null;}
    host=null;guest=null;solo=null;
  }
  function setPage(next) {page=next;render();window.scrollTo(0,0);}
  function render() {
    if(page==="home") return renderHome();
    if(page==="editor") return renderEditor();
    if(page==="host") return renderHost();
    if(page==="guest") return renderGuest();
    if(page==="solo") return renderSolo();
  }
  function unitOptions(includeAll=true) {return UNITS.filter(u=>includeAll||u[0]!=="all").map(u=>'<option value="'+esc(u[0])+'">'+esc(u[1])+'</option>').join("");}
  function renderHome() {
    const qpin=new URLSearchParams(location.search).get("pin")||"";
    app.innerHTML='<div class="home-grid"><section class="home-left"><p class="eyebrow">APRENDER É TESTAR IDEIAS / 01</p><h1 class="display">Em<br><em>questão.</em></h1><p class="lead">Perguntas, escolhas e explicações. Uma forma de colocar a teoria em discussão — ao vivo, com a turma.</p><div class="btnline">'+btn("practice","Praticar individualmente","btn light")+btn("editor","Banco de questões","btn quiet")+'</div><p class="smallnote" style="margin-top:28px">Questões para revisão conceitual. Respostas e pontuação não são notas acadêmicas.</p></section>'+
    '<section class="stack"><div class="panel dark"><p class="eyebrow">01 / PARTICIPAR</p><h2>Entrar na sala</h2><p>Informe o código projetado pelo professor e escolha um apelido.</p><form id="join-form" class="stack"><div class="fields"><div class="field"><label for="pin">Código de 6 dígitos</label><input id="pin" class="code" name="pin" pattern="[0-9]{6}" maxlength="6" inputmode="numeric" placeholder="000000" required value="'+esc(qpin.replace(/\D/g,"").slice(0,6))+'"></div><div class="field"><label for="nickname">Apelido</label><input id="nickname" name="nickname" maxlength="24" minlength="2" autocomplete="nickname" placeholder="Como quer aparecer?" required></div></div><button class="btn primary full" type="submit">Entrar no jogo</button></form></div>'+
    '<div class="panel"><p class="eyebrow">02 / PARA O PROFESSOR</p><h2>Abrir uma sessão</h2><form id="create-form" class="stack"><div class="fields"><div class="field"><label for="semester">Semestre</label><input id="semester" maxlength="20" value="2026.2" required></div><div class="field"><label for="classroom">Turma</label><select id="classroom"><option value="01">01</option><option value="02">02</option><option value="livre">Outra / oficina</option></select></div></div><div class="field"><label for="unit">Tema</label><select id="unit">'+unitOptions()+'</select></div><div class="fields"><div class="field"><label for="quantity">Questões</label><select id="quantity"><option value="5">Até 5</option><option value="8" selected>Até 8</option><option value="12">Até 12</option><option value="99">Todas disponíveis</option></select></div><div class="field"><label for="duration">Tempo por questão</label><select id="duration"><option value="0">Sem limite</option><option value="15">15 segundos</option><option value="20">20 segundos</option><option value="30" selected>30 segundos</option><option value="45">45 segundos</option><option value="60">60 segundos</option><option value="90">90 segundos</option></select></div></div><label class="check"><input id="score" type="checkbox" checked> Pontuar as respostas</label><label class="check"><input id="ranking" type="checkbox" checked> Mostrar classificação</label><button class="btn full" type="submit">Criar sessão ao vivo</button></form></div></section></div>';
  }
  function renderEditor() {
    app.innerHTML=title("Banco de questões",all().length+" questões disponíveis, sendo "+custom.length+" criadas neste navegador.")+
    '<div class="editor stack"><div class="panel"><p class="eyebrow">ADICIONAR QUESTÃO</p><form id="add-form" class="stack"><div class="field"><label for="new-unit">Unidade</label><select id="new-unit">'+unitOptions(false)+'</select></div><div class="field"><label for="new-q">Enunciado</label><textarea id="new-q" maxlength="400" required></textarea></div><div class="editor-grid">'+alphabet.split("").map(x=>'<div class="field"><label for="opt'+x+'">Alternativa '+x+'</label><input id="opt'+x+'" maxlength="240" required></div>').join("")+'</div><div class="field"><label for="new-answer">Alternativa correta</label><select id="new-answer">'+alphabet.split("").map((x,i)=>'<option value="'+i+'">'+x+'</option>').join("")+'</select></div><div class="field"><label for="new-why">Justificativa exibida após a resposta</label><textarea id="new-why" maxlength="600" required></textarea></div><div class="btnline"><button class="btn primary" type="submit">Adicionar ao banco</button>'+btn("export-bank","Exportar banco (JSON)","btn quiet")+'</div></form></div>'+
    '<div class="panel"><h3>Importar questões</h3><p>Selecione um arquivo JSON exportado anteriormente. As questões válidas serão incorporadas sem substituir o banco original.</p><input id="file-bank" type="file" accept=".json,application/json" aria-label="Importar banco JSON"></div>'+
    '<div class="panel"><h3>Questões criadas neste navegador</h3>'+(custom.length?custom.map(q=>'<div class="custom-item"><div><span>'+esc(q.q)+'</span><div class="tiny">'+esc(unitName(q.unit))+'</div></div><button class="btn quiet small" type="button" data-act="delete-custom" data-id="'+esc(q.id)+'">Excluir</button></div>').join(""):'<p>Ainda não há questões adicionais.</p>')+'</div></div>';
  }
  function formAdd() {
    const q={id:"local-"+Date.now()+"-"+pick(100000),unit:$("#new-unit").value,q:$("#new-q").value.trim(),a:alphabet.split("").map(x=>$("#opt"+x).value.trim()),correct:Number($("#new-answer").value),why:$("#new-why").value.trim()};
    if(!validateQuestion(q)||!q.why){notify("Preencha o enunciado, as quatro alternativas e a explicação.");return;}
    custom.push(q);persist();renderEditor();notify("Questão adicionada ao banco local.");
  }
  function importBank(file) {
    if(!file||file.size>2000000){notify("Selecione um JSON de até 2 MB.");return;}
    file.text().then(text=>{
      const a=JSON.parse(text),items=Array.isArray(a)?a:a.questions;
      if(!Array.isArray(items))throw Error("Arquivo inválido");
      const known=new Set(all().map(q=>q.id));let added=0;
      for(const q of items)if(validateQuestion(q)&&!known.has(q.id)){custom.push(q);known.add(q.id);added++;}
      persist();renderEditor();notify(added+" questões incorporadas.");
    }).catch(()=>notify("Não foi possível importar o arquivo JSON."));
  }
  function saveBlob(name,body,mime) {
    const blob=new Blob([body],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function startHost() {
    if(typeof Peer==="undefined"){notify("Biblioteca de conexão não carregada. Verifique a internet.");return;}
    const unit=$("#unit").value;
    const pool=all().filter(q=>unit==="all"||q.unit===unit);
    if(!pool.length){notify("Não há questões nesse tema. Adicione questões ao banco.");return;}
    destroyConnection();
    const duration=Number($("#duration").value),n=Number($("#quantity").value);
    host={semester:$("#semester").value.trim().slice(0,20)||"Não informado",classroom:$("#classroom").value,
      duration,score:$("#score").checked,ranking:$("#ranking").checked,
      questions:shuffle(pool).slice(0,n),pin:String(100000+pick(900000)),
      players:new Map(),index:-1,phase:"lobby",answers:new Map(),history:[],deadline:0,connected:false};
    page="host";render();
    peer=new Peer("tl1-quiz-"+host.pin);
    peer.on("open",()=>{if(!host)return;host.connected=true;render();});
    peer.on("error",error=>{
      if(!host)return;
      host.connected=false;
      notify("Falha na abertura da sala: "+(error.type==="unavailable-id"?"código ocupado. Feche e crie outra sessão.":"verifique sua conexão com a internet."));
      render();
    });
    peer.on("disconnected",()=>{if(host){host.connected=false;render();notify("Conexão de sinalização interrompida.");}});
    peer.on("connection",link=>attachHostConnection(link));
    sessionTimer=setInterval(tick,200);
  }
  function attachHostConnection(link) {
    link.on("data",message=>{
      if(!host||!message||typeof message!=="object")return;
      if(message.type==="join"){
        const raw=String(message.name||"").trim().replace(/[\u0000-\u001f]/g,"").slice(0,24);
        if(raw.length<2){link.send({type:"error",message:"Apelido deve conter pelo menos 2 caracteres."});return;}
        const previous=host.players.get(link.peer);
        host.players.set(link.peer,{name:previous?previous.name:raw,points:previous?previous.points:0,correct:previous?previous.correct:0,connected:true,link});
        sendState(link);render();
      }else if(message.type==="answer"){
        if(host.phase!=="question"||message.index!==host.index||host.answers.has(link.peer)||!host.players.has(link.peer))return;
        if(host.duration>0&&Date.now()>host.deadline)return;
        if(!Number.isInteger(message.choice)||message.choice<0||message.choice>3)return;
        const q=host.questions[host.index],ok=message.choice===q.correct;
        const remain=host.duration?Math.max(0,(host.deadline-Date.now())/1000):0;
        const points=ok&&host.score?(host.duration?500+Math.round(500*remain/host.duration):1000):0;
        host.answers.set(link.peer,{choice:message.choice,ok,points});
        const p=host.players.get(link.peer);p.points+=points;if(ok)p.correct++;
        sendState(link);render();
      }
    });
    link.on("close",()=>{if(host&&host.players.has(link.peer)){host.players.get(link.peer).connected=false;render();}});
    link.on("error",()=>{if(host&&host.players.has(link.peer)){host.players.get(link.peer).connected=false;render();}});
  }
  function currentQuestion(){return host&&host.index>=0?host.questions[host.index]:null;}
  function leaderboard() {return [...host.players.values()].sort((a,b)=>b.points-a.points||b.correct-a.correct||a.name.localeCompare(b.name,"pt")).map((p,i)=>({name:p.name,points:p.points,correct:p.correct,pos:i+1}));}
  function payload(playerId) {
    const q=currentQuestion(),p=host.players.get(playerId);
    return {type:"state",pin:host.pin,phase:host.phase,index:host.index,total:host.questions.length,
      participants:[...host.players.values()].filter(x=>x.connected).length,
      question:q?{q:q.q,a:q.a,unit:q.unit}:null,
      secondsLeft:host.phase==="question"&&host.duration>0?Math.max(0,(host.deadline-Date.now())/1000):null,
      duration:host.duration,answered:host.answers.has(playerId),
      ownChoice:host.answers.has(playerId)?host.answers.get(playerId).choice:null,
      ownPoints:p?p.points:0,ownCorrect:p?p.correct:0,
      reveal:host.phase==="result"&&q?{correct:q.correct,why:q.why,counts:q.a.map((_,i)=>[...host.answers.values()].filter(a=>a.choice===i).length),answered:host.answers.size}:null,
      showRank:host.ranking&&host.score,
      rank:host.phase!=="question"&&host.ranking&&host.score?leaderboard().slice(0,5):[],
      scoring:host.score};
  }
  function sendState(link) {if(!host||!link||!link.open)return;try{link.send(payload(link.peer));}catch(_){}}
  function broadcast(){if(!host)return;for(const p of host.players.values())if(p.connected)sendState(p.link);}
  function hostNext() {
    if(!host||!host.connected||host.phase==="question")return;
    if(host.index+1>=host.questions.length){hostEnd();return;}
    host.index++;host.phase="question";host.answers.clear();
    host.deadline=host.duration?Date.now()+host.duration*1000:0;
    broadcast();render();
  }
  function hostReveal() {
    if(!host||host.phase!=="question")return;
    host.phase="result";
    const q=currentQuestion();
    host.history.push({id:q.id,unit:q.unit,q:q.q,correct:q.correct,counts:q.a.map((_,i)=>[...host.answers.values()].filter(a=>a.choice===i).length),answered:host.answers.size,correctCount:[...host.answers.values()].filter(a=>a.ok).length});
    broadcast();render();
  }
  function hostEnd(){if(!host)return;if(host.phase==="question")hostReveal();host.phase="ended";broadcast();render();}
  function tick() {
    if(host&&host.phase==="question"&&host.duration&&Date.now()>=host.deadline)hostReveal();
    const c=document.getElementById("clock");
    if(c){
      if(host&&host.phase==="question")c.textContent=host.duration?Math.ceil(Math.max(0,host.deadline-Date.now())/1000)+"s":"Livre";
      else if(guest&&guest.state&&guest.state.phase==="question")c.textContent=guest.state.duration?Math.ceil(Math.max(0,guest.deadline-Date.now())/1000)+"s":"Livre";
    }
  }
  function summaryRows() {
    if(!host||!host.ranking||!host.score)return '<p class="smallnote">Classificação desativada nesta sessão.</p>';
    return leaderboard().slice(0,5).map(x=>'<div class="score-row"><span>'+x.pos+'. '+esc(x.name)+'</span><span>'+x.points+' pts</span></div>').join("")||'<p>Sem participantes.</p>';
  }
  function renderHost() {
    if(!host)return setPage("home");
    const state=host.phase;
    const total=[...host.players.values()].filter(p=>p.connected).length;
    let body="";
    if(state==="lobby"){
      body='<div class="stage-grid"><div class="panel"><p class="eyebrow">CONVIDE OS PARTICIPANTES</p><div class="lobby-card"><div><p class="count-title">Código da sessão</p><div class="pin">'+esc(host.pin)+'</div><div class="btnline">'+btn("copy-link","Copiar link","btn light")+btn("copy-pin","Copiar código","btn quiet")+'</div><p class="smallnote">Compartilhe o código ou projete o QR Code. Não publique o código fora da aula.</p></div><div><div id="qr" class="qr-wrap" aria-label="QR Code do link da sessão"></div></div></div></div>'+
      '<div class="panel"><p class="eyebrow">SALA DE ESPERA</p><h2>'+total+' participante'+(total===1?"":"s")+'</h2><ul class="list">'+[...host.players.values()].filter(p=>p.connected).map(p=>'<li>'+esc(p.name)+'</li>').join("")+'</ul><p class="smallnote">Inicie quando os estudantes estiverem conectados.</p>'+btn("host-next","Iniciar quiz","btn primary full")+'</div></div>';
    }else if(state==="question"){
      const q=currentQuestion();
      body='<div class="stage-grid"><div><div class="question-number">QUESTÃO '+(host.index+1)+' / '+host.questions.length+' · '+esc(unitName(q.unit))+'</div><h2 class="prompt">'+esc(q.q)+'</h2><div class="answers">'+q.a.map((a,i)=>'<div class="answer"><span class="letter">'+alphabet[i]+'</span><span>'+esc(a)+'</span></div>').join("")+'</div></div>'+
      '<aside class="panel"><p class="count-title">Tempo restante</p><div class="timer" id="clock">'+(host.duration?host.duration+"s":"Livre")+'</div><p class="count-title">Respostas recebidas</p><div class="number">'+host.answers.size+'<span style="font-size:.3em;color:var(--muted)"> / '+total+'</span></div>'+btn("host-reveal","Encerrar respostas","btn primary full")+'<p class="smallnote">Respostas individuais não aparecem na projeção.</p></aside></div>';
    }else if(state==="result"){
      const q=currentQuestion(),h=host.history[host.history.length-1],max=Math.max(1,h.answered);
      body='<div class="stage-grid"><section><p class="question-number">RESULTADO / QUESTÃO '+(host.index+1)+' DE '+host.questions.length+'</p><h2 class="prompt">'+esc(q.q)+'</h2><div class="panel"><h3>Distribuição das respostas</h3>'+
      q.a.map((text,i)=>'<div class="bar-row '+(i===q.correct?"correct":"")+'"><div class="bar-label"><span>'+alphabet[i]+'. '+esc(text)+(i===q.correct?" ✓":"")+'</span><span>'+h.counts[i]+'</span></div><div class="bar-bg"><div class="bar-fill" style="width:'+(h.counts[i]/max*100)+'%"></div></div></div>').join("")+'</div><div class="explanation"><strong>Por quê?</strong>'+esc(q.why)+'</div></section><aside class="panel"><p class="eyebrow">DEPOIS DA RESPOSTA</p><h2>'+h.correctCount+' de '+h.answered+'</h2><p>respostas corretas</p><div class="scoreboard">'+summaryRows()+'</div><div class="stack" style="margin-top:22px">'+btn("host-next",host.index+1>=host.questions.length?"Concluir sessão":"Próxima questão","btn primary full")+btn("host-end","Encerrar agora","btn quiet full")+'</div></aside></div>';
    }else{
      body='<div class="stage-grid"><div><div class="big-symbol">✓</div><h2 class="prompt">Sessão encerrada.</h2><p class="lead">'+host.history.length+' questões realizadas. '+host.players.size+' participantes registrados nesta sessão.</p><div class="btnline">'+btn("export-results","Exportar resultados agregados (CSV)","btn primary")+btn("home","Sair da sala","btn quiet")+'</div></div><div class="panel"><h3>Classificação final</h3>'+summaryRows()+'<p class="smallnote">O arquivo CSV não contém apelidos nem respostas individuais.</p></div></div>';
    }
    app.innerHTML=title("Sala do professor",esc(host.semester)+" · Turma "+esc(host.classroom))+
      '<div class="meta"><span class="tag"><span class="live-dot"></span>'+(host.connected?"Conectado":"Conectando / indisponível")+'</span><span class="tag">Código '+esc(host.pin)+'</span><span class="tag">'+host.questions.length+' questões</span><span class="tag">'+(host.score?"Pontuação ativa":"Sem pontuação")+'</span></div>'+body;
    if(state==="lobby"&&host.connected){
      const qr=$("#qr");if(qr){try{if(typeof QRCode!=="undefined")new QRCode(qr,{text:roomURL(host.pin),width:160,height:160,colorDark:"#141517",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});else qr.textContent="QR indisponível. Use o código."; }catch(_){qr.textContent=roomURL(host.pin);}}
    }
    tick();
  }
  function startGuest(pin,name) {
    if(typeof Peer==="undefined"){notify("Biblioteca de conexão não carregada. Verifique a internet.");return;}
    if(!/^\d{6}$/.test(pin)||name.trim().length<2){notify("Informe o código de seis dígitos e um apelido.");return;}
    destroyConnection();
    guest={pin,name:name.trim().slice(0,24),connected:false,deadline:0,state:null,chosen:null};
    page="guest";render();
    peer=new Peer();
    peer.on("open",()=>{
      if(!guest)return;
      conn=peer.connect("tl1-quiz-"+pin,{reliable:true});
      conn.on("open",()=>{if(!guest)return;guest.connected=true;conn.send({type:"join",name:guest.name});render();});
      conn.on("data",m=>{
        if(!guest||!m)return;
        if(m.type==="error"){notify(m.message||"Entrada recusada.");return;}
        if(m.type!=="state")return;
        const before=guest.state;
        if(!before||before.index!==m.index)guest.chosen=null;
        if(m.answered)guest.chosen=m.ownChoice;
        guest.state=m;
        if(m.phase==="question")guest.deadline=Date.now()+Math.max(0,m.secondsLeft===null?0:m.secondsLeft*1000);
        render();
      });
      conn.on("close",()=>{if(guest){guest.connected=false;render();notify("Conexão com a sala interrompida. Reentre usando o código.");}});
      conn.on("error",()=>{if(guest){guest.connected=false;render();notify("Erro de conexão com a sala.");}});
    });
    peer.on("error",(err)=>{notify(err.type==="peer-unavailable"?"Sala não encontrada. Confira o código e se o professor iniciou a sessão.":"Falha na conexão. Verifique sua internet.");});
    sessionTimer=setInterval(tick,200);
  }
  function guestAnswer(choice){
    const s=guest&&guest.state;
    if(!s||s.phase!=="question"||guest.chosen!==null||!guest.connected||!conn||!conn.open)return;
    if(s.duration&&Date.now()>guest.deadline)return;
    guest.chosen=choice;
    try{conn.send({type:"answer",index:s.index,choice});render();}catch(_){notify("Não foi possível enviar. Verifique a conexão.");}
  }
  function renderGuest(){
    if(!guest)return setPage("home");
    const s=guest.state;
    if(!guest.connected||!s){
      app.innerHTML=title("Participação","Apelido: "+esc(guest.name)+" · Código "+esc(guest.pin))+'<div class="guest-card panel center"><div class="big-symbol">…</div><h2>'+(!guest.connected?"Conectando à sala":"Aguardando o professor")+'</h2><p>Para receber as perguntas, mantenha esta página aberta e sua conexão ativa.</p>'+btn("home","Voltar e tentar novamente","btn light")+'</div>';return;
    }
    let content="";
    if(s.phase==="lobby") content='<div class="guest-card panel center"><div class="big-symbol">✓</div><h2>Você está na sala.</h2><p class="lead">Aguarde o professor iniciar o quiz.</p><span class="tag">'+s.participants+' participantes conectados</span></div>';
    if(s.phase==="question"){
      const q=s.question;
      content='<div class="guest-card"><div class="question-number">QUESTÃO '+(s.index+1)+' / '+s.total+' · '+esc(unitName(q.unit))+'</div><h2 class="prompt">'+esc(q.q)+'</h2><div class="meta"><span class="tag">Tempo: <strong id="clock">'+(s.duration?Math.ceil(s.secondsLeft)+"s":"Livre")+'</strong></span><span class="tag">'+(guest.chosen===null?"Escolha uma alternativa":"Resposta enviada")+'</span></div>'+
      '<div class="answers">'+q.a.map((a,i)=>'<button type="button" class="answer" data-choice="'+i+'" aria-pressed="'+(guest.chosen===i)+'" '+(guest.chosen!==null?"disabled":"")+'><span class="letter">'+alphabet[i]+'</span><span>'+esc(a)+'</span></button>').join("")+'</div>'+(guest.chosen===null?'<p class="smallnote">Você só poderá responder uma vez.</p>':'<div class="explanation">Resposta registrada. Aguarde a apuração coletiva.</div>')+'</div>';
    }
    if(s.phase==="result"){
      const correct=s.reveal.correct,ok=guest.chosen===correct;
      content='<div class="guest-card"><p class="question-number">RESULTADO / QUESTÃO '+(s.index+1)+' DE '+s.total+'</p><div class="big-symbol">'+(guest.chosen===null?"–":ok?"✓":"×")+'</div><h2 class="prompt">'+(guest.chosen===null?"Você não respondeu a tempo.":ok?"Você acertou.":"Vamos conferir?")+'</h2><div class="panel"><p><strong>Resposta correta: '+alphabet[correct]+'</strong> · '+esc(s.question.a[correct])+'</p><div class="explanation"><strong>Explicação</strong>'+esc(s.reveal.why)+'</div></div><div class="meta"><span class="tag">Respostas: '+s.reveal.answered+'</span>'+(s.scoring?'<span class="tag">Sua pontuação: '+s.ownPoints+'</span>':'')+'</div>'+(s.showRank?'<div class="panel"><h3>Primeiras posições</h3>'+s.rank.map(x=>'<div class="score-row"><span>'+x.pos+'. '+esc(x.name)+'</span><span>'+x.points+' pts</span></div>').join("")+'</div>':'')+'<p class="smallnote">A próxima pergunta aparecerá quando o professor avançar.</p></div>';
    }
    if(s.phase==="ended")content='<div class="guest-card panel center"><div class="big-symbol">✓</div><h2>Fim do quiz</h2><p class="lead">Obrigado por participar. Você pode continuar praticando individualmente.</p><div class="meta" style="justify-content:center">'+(s.scoring?'<span class="tag">Sua pontuação: '+s.ownPoints+'</span>':'')+'<span class="tag">Respostas corretas: '+s.ownCorrect+'</span></div><div class="btnline" style="justify-content:center">'+btn("practice","Praticar","btn primary")+btn("home","Início","btn quiet")+'</div></div>';
    app.innerHTML=title("Sua participação",esc(guest.name)+" · Sala "+esc(guest.pin))+content;tick();
  }
  function startSolo(){
    destroyConnection();
    solo={questions:shuffle(all()).slice(0,8),index:0,answer:null,correct:0};
    setPage("solo");
  }
  function renderSolo(){
    if(!solo)return setPage("home");
    const q=solo.questions[solo.index];
    if(!q){
      app.innerHTML=title("Prática individual","Autoestudo · Sem registro de notas")+'<div class="guest-card panel center"><div class="big-symbol">✓</div><h2>Prática concluída</h2><p class="lead">'+solo.correct+' de '+solo.questions.length+' respostas corretas.</p><div class="btnline" style="justify-content:center">'+btn("practice","Outra sequência","btn primary")+btn("home","Início","btn quiet")+'</div></div>';return;
    }
    app.innerHTML=title("Prática individual","Sem cronômetro e sem classificação")+'<div class="guest-card"><p class="question-number">QUESTÃO '+(solo.index+1)+' / '+solo.questions.length+' · '+esc(unitName(q.unit))+'</p><h2 class="prompt">'+esc(q.q)+'</h2><div class="answers">'+q.a.map((a,i)=>'<button class="answer '+(solo.answer!==null&&i===q.correct?"correct":"")+'" type="button" data-choice="'+i+'" '+(solo.answer!==null?"disabled":"")+' aria-pressed="'+(solo.answer===i)+'"><span class="letter">'+alphabet[i]+'</span><span>'+esc(a)+'</span></button>').join("")+'</div>'+
      (solo.answer===null?'<p class="smallnote">Escolha a alternativa que considera correta.</p>':'<div class="explanation"><strong>'+(solo.answer===q.correct?"Resposta correta.":"Resposta correta: "+alphabet[q.correct]+".")+'</strong>'+esc(q.why)+'</div><div class="btnline">'+btn("solo-next","Próxima questão","btn primary")+'</div>')+'</div>';
  }
  function exportResults(){
    if(!host)return;
    const header=["semestre","turma","codigo_sessao","questao_id","unidade","respondentes","acertos","alternativa_A","alternativa_B","alternativa_C","alternativa_D"];
    const cell=x=>'"'+String(x==null?"":x).replace(/"/g,'""')+'"';
    const rows=host.history.map(h=>[host.semester,host.classroom,host.pin,h.id,h.unit,h.answered,h.correctCount,...h.counts].map(cell).join(","));
    saveBlob("tl1-quiz-"+host.semester+"-turma-"+host.classroom+"-"+host.pin+".csv","\ufeff"+[header.join(","),...rows].join("\r\n"),"text/csv;charset=utf-8");
  }
  async function copy(value){try{await navigator.clipboard.writeText(value);notify("Copiado.");}catch(_){notify("Cópia não disponível neste navegador.");}}
  app.addEventListener("submit",ev=>{
    ev.preventDefault();
    if(ev.target.id==="join-form")startGuest($("#pin").value.replace(/\D/g,""),$("#nickname").value);
    if(ev.target.id==="create-form")startHost();
    if(ev.target.id==="add-form")formAdd();
  });
  app.addEventListener("click",ev=>{
    const answer=ev.target.closest("[data-choice]");
    if(answer){const c=Number(answer.dataset.choice);if(page==="guest")guestAnswer(c);else if(page==="solo"&&solo&&solo.answer===null){solo.answer=c;if(c===solo.questions[solo.index].correct)solo.correct++;render();}return;}
    const el=ev.target.closest("[data-act]");if(!el)return;
    const act=el.dataset.act;
    if(act==="home"){if((host||guest)&&!confirm("Sair encerrará sua conexão com a sessão. Continuar?"))return;destroyConnection();history.replaceState(null,"",location.pathname);setPage("home");}
    if(act==="editor"){destroyConnection();setPage("editor");}
    if(act==="practice")startSolo();
    if(act==="host-next")hostNext();
    if(act==="host-reveal")hostReveal();
    if(act==="host-end"){if(confirm("Encerrar a sessão para todos os participantes?"))hostEnd();}
    if(act==="copy-pin"&&host)copy(host.pin);
    if(act==="copy-link"&&host)copy(roomURL(host.pin));
    if(act==="export-results")exportResults();
    if(act==="export-bank")saveBlob("tl1-quiz-banco.json",JSON.stringify({questions:all()},null,2),"application/json");
    if(act==="delete-custom"){custom=custom.filter(q=>q.id!==el.dataset.id);persist();render();notify("Questão removida do banco local.");}
    if(act==="solo-next"&&solo){solo.index++;solo.answer=null;render();}
  });
  app.addEventListener("change",ev=>{if(ev.target.id==="file-bank")importBank(ev.target.files[0]);});
  window.addEventListener("beforeunload",ev=>{if(host&&host.phase!=="ended"){ev.preventDefault();ev.returnValue="";}});
  render();
})();
