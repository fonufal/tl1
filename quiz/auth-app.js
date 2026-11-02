import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,doc,collection,getDoc,getDocs,setDoc,updateDoc,onSnapshot,serverTimestamp,
  runTransaction,writeBatch,Timestamp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {FIREBASE_CONFIG} from "../apresentacoes/firebase-config.js";

const firebase=initializeApp(FIREBASE_CONFIG);
// Mesmo Firebase App [DEFAULT] e mesma origem para reutilizar persistência do login.
const auth=getAuth(firebase),db=getFirestore(firebase);
const app=document.getElementById("app"),toast=document.getElementById("toast");
const Q=window.TL1_QUIZ_QUESTIONS||[],UNITS=window.TL1_QUIZ_UNITS||[];
const ABC="ABCD",CLASS_IDS=["tl1-2026-2-01","tl1-2026-2-02"];
const p=new URLSearchParams(location.search);
const state={user:null,admin:false,authReady:false,mode:"home",classId:p.get("turma")||"",
  pin:p.get("pin")||"",member:null,session:null,participants:[],answers:[],answer:null,
  rounds:[],error:"",busy:false,revealingRound:null,unsubs:[],classes:[],authError:""};
const $=sel=>app.querySelector(sel);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tag=t=>'<span class="tag">'+esc(t)+'</span>';
const act=(id,text,klass="btn")=>'<button type="button" data-act="'+id+'" class="'+klass+'">'+text+'</button>';
const clabel=id=>({ "tl1-2026-2-01":"Turma 01 · 2026.2","tl1-2026-2-02":"Turma 02 · 2026.2"}[id]||id);
const classes=()=>{const list=state.classes.length?state.classes.map(c=>({id:c.id,label:(c.name||c.id)+" · "+(c.term||"")})):CLASS_IDS.map(id=>({id,label:clabel(id)}));
return list.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===state.classId?"selected":"")+'>'+esc(c.label)+'</option>').join("")};
const rand=(n=6)=>{let r=new Uint32Array(1);crypto.getRandomValues(r);return String(r[0]%(10**n)).padStart(n,"0")};
const shuffle=xs=>{const r=xs.slice();for(let i=r.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[r[i],r[j]]=[r[j],r[i]]}return r};
const sessionRef=()=>doc(db,"classes",state.classId,"quizSessions",state.pin);
const partRef=()=>doc(db,"classes",state.classId,"quizSessions",state.pin,"participants",state.user.uid);
const answersRef=()=>collection(db,"classes",state.classId,"quizSessions",state.pin,"answers");
const roundsRef=()=>collection(db,"classes",state.classId,"quizSessions",state.pin,"rounds");
const qById=id=>allQuestions().find(q=>q.id===id);
const validate=q=>q&&typeof q.id==="string"&&typeof q.q==="string"&&Array.isArray(q.a)&&q.a.length===4&&q.a.every(x=>typeof x==="string")&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4&&typeof q.why==="string";
function allQuestions(){let custom=[];try{const data=JSON.parse(localStorage.getItem("tl1-quiz-custom-v1")||"[]");if(Array.isArray(data))custom=data.filter(validate)}catch(_){}return Q.concat(custom)}
function notify(msg){toast.textContent=msg;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),5000)}
function message(err){state.error=err?.message||String(err);notify(state.error);render()}
function clean(){state.unsubs.forEach(un=>un());state.unsubs=[];state.session=null;state.participants=[];state.answers=[];state.answer=null;state.rounds=[];state.revealingRound=null}
function setUrl(extra={}){const url=new URL(location.href);url.search="";if(state.classId)url.searchParams.set("turma",state.classId);if(state.pin)url.searchParams.set("pin",state.pin);if(extra.admin)url.searchParams.set("professor","1");history.replaceState(null,"",url)}
function section(title,description){return '<div class="room-head"><div><p class="eyebrow">EM QUESTÃO · TL1</p><h1>'+title+'</h1><p class="smallnote">'+description+'</p></div><div class="btnline">'+act("home","Início","btn quiet small")+'</div></div>'}
function errorMsg(){return state.error?'<div class="explanation" role="alert"><strong>Não foi possível continuar</strong>'+esc(state.error)+'</div>':""}
function authView(){
  return '<div class="panel dark"><p class="eyebrow">ACESSO À TURMA</p><h2>Identificação única</h2><p>Use sua conta Google já utilizada em Apresentações. Se a sessão estiver ativa neste navegador, a entrada será automática.</p>'+
  (state.user?'<p>Conectado: <strong>'+esc(state.user.email||state.user.displayName||"Conta Google")+'</strong></p>'+act("signout","Trocar de conta","btn light"):act("signin","Entrar com Google","btn primary full"))+'</div>';
}
function renderHome(){
  app.innerHTML='<div class="home-grid"><section class="home-left"><p class="eyebrow">QUIZ AO VIVO / ACESSO INTEGRADO · PILOTO</p><h1 class="display">Em<br><em>questão.</em></h1><p class="lead">Entre com a mesma conta Google usada em Apresentações. Depois da identificação inicial, basta abrir o QR Code da aula.</p><div class="btnline"><a class="btn light" href="./">Prática individual livre</a><a class="btn quiet" href="./">Banco de questões</a></div><p class="smallnote">A prática individual continua sem login. As sessões ao vivo registram participação por turma.</p></section>'+
  '<div class="stack">'+authView()+
  '<div class="panel"><h2>Entrar no quiz</h2><form id="join" class="stack"><div class="field"><label for="join-class">Turma</label><select id="join-class">'+classes()+'</select></div><div class="field"><label for="join-pin">Código da sessão</label><input id="join-pin" class="code" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" value="'+esc(state.pin)+'" required></div><button class="btn primary full" type="submit">Participar</button></form></div>'+
  (state.admin?'<div class="panel"><p class="eyebrow">ÁREA DO PROFESSOR</p><h2>Quiz ao vivo</h2>'+act("teacher","Abrir painel do professor","btn full")+'</div>':"")+
  errorMsg()+'</div></div>';
}
function renderVerify(){
  app.innerHTML=section("Confirmar vínculo","Uma única confirmação por conta Google e turma. Não é necessário reservar um tópico de apresentação.")+
  '<div class="guest-card panel"><p class="eyebrow">TURMA '+esc(clabel(state.classId))+'</p><h2>Confirme seus dados no SIGAA</h2><p>A identificação é conferida com a lista autorizada da turma, que já é utilizada em Apresentações. Seus dados não serão exibidos na projeção.</p>'+
  '<form id="verify" class="stack"><div class="field"><label for="matricula">Matrícula</label><input id="matricula" autocomplete="off" maxlength="40" required></div><div class="field"><label for="roster-email">E-mail cadastrado no SIGAA</label><input id="roster-email" type="email" maxlength="180" autocomplete="email" value="'+esc(state.user?.email||"")+'" required></div><button class="btn primary full" type="submit">Confirmar minha turma</button></form>'+errorMsg()+'</div>';
}
async function identify(){
 const ref=doc(db,"classes",state.classId,"registrations",state.user.uid);
 const registered=await getDoc(ref);
 if(registered.exists()){state.member={name:registered.data().name,source:"Apresentações"};return true}
 const qid=await getDoc(doc(db,"classes",state.classId,"quizIdentities",state.user.uid));
 if(qid.exists()){state.member={name:qid.data().name,source:"Quiz"};return true}
 state.member=null;return false;
}
async function sha256(text){const bytes=new TextEncoder().encode(text);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function verifyMember(){
 if(state.busy)return;
 state.busy=true;state.error="";
 try{
   const matricula=$("#matricula").value.replace(/\D/g,"").trim();
   const email=$("#roster-email").value.trim().toLowerCase();
   if(matricula.length<5||!email.includes("@"))throw Error("Informe matrícula e e-mail válidos.");
   const eligibilityId=await sha256(matricula+"|"+email);
   const er=doc(db,"classes",state.classId,"eligible",eligibilityId);
   const ir=doc(db,"classes",state.classId,"quizIdentities",state.user.uid);
   const cr=doc(db,"classes",state.classId,"quizClaims",eligibilityId);
   await runTransaction(db,async t=>{
      const e=await t.get(er),i=await t.get(ir);
      if(!e.exists()||e.data().status!=="active")throw Error("Matrícula e e-mail não correspondem à lista ativa desta turma.");
      if(e.data().boundUid&&e.data().boundUid!==state.user.uid)throw Error("Esta matrícula está vinculada a outra conta Google. Procure o professor.");
      if(i.exists())return;
      t.set(ir,{eligibilityId,name:e.data().name,createdAt:serverTimestamp()});
      t.set(cr,{uid:state.user.uid,createdAt:serverTimestamp()});
   });
   await identify();if(!state.member)throw Error("Não foi possível concluir o vínculo.");
   await enterRoom();
 }catch(e){message(e)}finally{state.busy=false}
}
async function joinRoom(classId,pin){
 if(!state.user){notify("Entre com Google primeiro.");return;}
 if(!/^[a-z0-9-]{3,60}$/.test(classId)||!/^\d{6}$/.test(pin)){notify("Informe uma turma e um código de seis dígitos válidos.");return;}
 clean();state.classId=classId;state.pin=pin;state.mode="student";state.error="";setUrl();
 try{const ok=await identify();if(!ok){state.mode="verify";render();return;}await enterRoom();}
 catch(e){message(e)}
}
async function enterRoom(){
 if(!state.user||!state.member)return;
 const sr=sessionRef(),ss=await getDoc(sr);
 if(!ss.exists())throw Error("Sala não encontrada nessa turma. Confirme o código.");
 if(ss.data().phase==="ended")throw Error("Essa sessão já foi encerrada.");
 const pr=partRef(),mine=await getDoc(pr);
 if(!mine.exists())await setDoc(pr,{uid:state.user.uid,name:state.member.name,joinedAt:serverTimestamp()});
 clean();state.mode="student";setUrl();
 state.unsubs.push(onSnapshot(sr,snap=>{if(!snap.exists()){message(Error("A sessão não está mais disponível."));return;}
    const prev=state.session?.roundId;state.session=snap.data();if(prev!==state.session.roundId){state.answer=null;loadOwnAnswer(state.session.roundId);}render();
 },message));
}
async function loadOwnAnswer(roundId){
 if(!roundId||!state.user)return;
 const ar=doc(answersRef(),roundId+"__"+state.user.uid);
 try{const s=await getDoc(ar);if(state.session?.roundId===roundId)state.answer=s.exists()?s.data():null;render()}catch(e){state.error="Erro ao consultar sua resposta: "+e.message;render()}
}
function renderStudent(){
 const s=state.session,code=state.pin;
 if(!s){app.innerHTML=section("Participação",esc(clabel(state.classId)))+'<div class="guest-card panel"><h2>Conectando à sessão…</h2></div>'+errorMsg();return}
 let body="";
 if(s.phase==="lobby")body='<div class="guest-card panel center"><div class="big-symbol">✓</div><h2>Você entrou na sala.</h2><p class="lead">Aguarde o professor iniciar.</p></div>';
 if(s.phase==="question"){
  body='<div class="guest-card"><p class="question-number">QUESTÃO '+(s.currentIndex+1)+' / '+s.questionIds.length+'</p><h2 class="prompt">'+esc(s.currentQuestion?.q||"")+'</h2><div class="meta">'+tag("Tempo restante")+(s.duration?'<span class="tag" id="clock">…</span>':tag("Sem limite"))+tag(state.answer?"Resposta registrada":"Selecione uma alternativa")+'</div>'+
  '<div class="answers">'+(s.currentQuestion?.a||[]).map((a,i)=>'<button type="button" class="answer" data-choice="'+i+'" aria-pressed="'+(state.answer?.choice===i)+'" '+(state.answer||state.busy?"disabled":"")+'><span class="letter">'+ABC[i]+'</span><span>'+esc(a)+'</span></button>').join("")+'</div>'+
  (state.answer?'<div class="explanation">Sua resposta foi registrada. Aguarde o encerramento.</div>':'<p class="smallnote">A resposta é única e o prazo é validado pelo servidor.</p>')+'</div>';
 }
 if(s.phase==="result")body='<div class="guest-card"><p class="eyebrow">RESULTADO DA QUESTÃO '+(s.currentIndex+1)+'</p><h2 class="prompt">'+esc(s.currentQuestion?.q||"")+'</h2><div class="panel"><h3>Resposta: '+ABC[s.reveal?.correct]+'</h3><p>'+esc(s.currentQuestion?.a?.[s.reveal?.correct]||"")+'</p><div class="explanation"><strong>Explicação</strong>'+esc(s.reveal?.why||"")+'</div></div>'+
   (state.answer?'<p class="lead">'+(state.answer.choice===s.reveal?.correct?"Você acertou.":"Sua escolha foi "+ABC[state.answer.choice]+".")+'</p>':'<p>Não há resposta registrada nesta questão.</p>')+
   (s.ranking&&s.score?'<div class="panel"><h3>Classificação</h3>'+leadersHtml(s.leaders||[])+'</div>':"")+'</div>';
 if(s.phase==="ended")body='<div class="guest-card panel center"><div class="big-symbol">✓</div><h2>Quiz encerrado.</h2><p class="lead">Obrigado por participar.</p><a class="btn primary" href="./">Continuar praticando sem login</a></div>';
 app.innerHTML=section("Sua participação",esc(state.member?.name||"")+" · "+esc(clabel(state.classId))+" · Código "+esc(code))+body+errorMsg();
}
async function answer(choice){
 if(state.busy||state.answer||!state.session||state.session.phase!=="question"||!Number.isInteger(choice)||choice<0||choice>3)return;
 if(state.session.duration&&state.session.deadline?.toMillis&&Date.now()>=state.session.deadline.toMillis()){notify("O tempo de resposta terminou.");return;}
 state.busy=true;
 try{
   const roundId=state.session.roundId,ar=doc(answersRef(),roundId+"__"+state.user.uid);
   await setDoc(ar,{uid:state.user.uid,roundId,choice,submittedAt:serverTimestamp()});
   state.answer={choice,roundId};render();
 }catch(e){message(e)}finally{state.busy=false}
}
function unitOptions(){return UNITS.map(x=>'<option value="'+esc(x[0])+'">'+esc(x[1])+'</option>').join("")}
function renderTeacher(){
 const s=state.session;
 if(!s){
 app.innerHTML=section("Painel do professor","Conta autorizada. Os dados pessoais e as respostas individuais não são apresentados na projeção.")+
 '<div class="panel editor"><p class="eyebrow">NOVA SESSÃO</p><h2>Criar um quiz</h2><form id="create" class="stack"><div class="field"><label for="class-teacher">Turma</label><select id="class-teacher">'+classes()+'</select></div>'+
 '<div class="fields"><div class="field"><label for="unit">Tema</label><select id="unit">'+unitOptions()+'</select></div><div class="field"><label for="qty">Quantidade máxima</label><select id="qty"><option value="5">5</option><option value="8" selected>8</option><option value="12">12</option></select></div></div>'+
 '<div class="field"><label for="duration">Tempo por pergunta</label><select id="duration"><option value="0">Sem limite</option><option value="15">15 segundos</option><option value="20">20 segundos</option><option value="30" selected>30 segundos</option><option value="45">45 segundos</option><option value="60">60 segundos</option><option value="90">90 segundos</option></select></div>'+
 '<label class="check"><input id="scoring" type="checkbox" checked> Ativar pontuação</label><label class="check"><input id="ranking" type="checkbox" checked> Mostrar classificação por identificador anônimo</label><button type="submit" class="btn primary">Criar sessão</button></form></div>'+errorMsg();
 return;
 }
 const count=state.participants.length,aCount=state.answers.filter(x=>x.roundId===s.roundId).length;
 let body="";
 if(s.phase==="lobby")body='<div class="stage-grid"><div class="panel"><p class="eyebrow">CÓDIGO DE ACESSO</p><div class="lobby-card"><div><div class="pin">'+esc(state.pin)+'</div><div class="btnline">'+act("copy-link","Copiar link","btn light")+'</div><p class="smallnote">A identidade é conferida pelo login compartilhado e pela turma.</p></div><div id="qr" class="qr-wrap"></div></div></div>'+
 '<div class="panel"><h2>'+count+' conectado'+(count===1?"":"s")+'</h2><p>Aguarde a entrada da turma.</p>'+act("next","Começar perguntas","btn primary full")+'</div></div>';
 if(s.phase==="question")body='<div class="stage-grid"><section><p class="question-number">QUESTÃO '+(s.currentIndex+1)+' / '+s.questionIds.length+'</p><h2 class="prompt">'+esc(s.currentQuestion?.q||"")+'</h2><div class="answers">'+(s.currentQuestion?.a||[]).map((a,i)=>'<div class="answer"><span class="letter">'+ABC[i]+'</span><span>'+esc(a)+'</span></div>').join("")+'</div></section>'+
 '<aside class="panel"><p class="count-title">Tempo restante</p><div class="timer" id="clock">'+(s.duration?"…":"Livre")+'</div><p class="count-title">Respostas</p><div class="number">'+aCount+'<span style="font-size:.3em;color:var(--muted)"> / '+count+'</span></div>'+act("reveal","Encerrar respostas","btn primary full")+'</aside></div>';
 if(s.phase==="result"){
 const r=s.reveal,max=Math.max(1,r?.answered||0);
 body='<div class="stage-grid"><section><p class="question-number">RESULTADO · QUESTÃO '+(s.currentIndex+1)+'</p><h2 class="prompt">'+esc(s.currentQuestion?.q||"")+'</h2><div class="panel"><h3>Distribuição</h3>'+
 (s.currentQuestion?.a||[]).map((a,i)=>'<div class="bar-row '+(i===r.correct?"correct":"")+'"><div class="bar-label"><span>'+ABC[i]+'. '+esc(a)+(i===r.correct?" ✓":"")+'</span><span>'+(r.counts?.[i]||0)+'</span></div><div class="bar-bg"><div class="bar-fill" style="width:'+100*(r.counts?.[i]||0)/max+'%"></div></div></div>').join("")+'</div><div class="explanation"><strong>Explicação</strong>'+esc(r.why)+'</div></section>'+
 '<aside class="panel"><h2>'+r.correctCount+' de '+r.answered+'</h2><p>respostas corretas</p>'+(s.ranking&&s.score?leadersHtml(s.leaders||[]):"")+
 '<div class="stack" style="margin-top:20px">'+act("next",s.currentIndex+1<s.questionIds.length?"Próxima questão":"Concluir","btn primary full")+act("end","Encerrar sessão","btn quiet full")+'</div></aside></div>';
 }
 if(s.phase==="ended")body='<div class="stage-grid"><section><div class="big-symbol">✓</div><h2 class="prompt">Sessão encerrada.</h2><p class="lead">'+s.questionIds.length+' questões previstas, '+state.rounds.length+' realizadas.</p><div class="btnline">'+act("export","Exportar relatório agregado","btn primary")+act("export-individual","Exportar respostas individuais (privado)","btn light")+act("new","Nova sessão","btn quiet")+'</div></section><aside class="panel"><h3>Classificação</h3>'+leadersHtml(s.leaders||[])+'</aside></div>';
 app.innerHTML=section("Sala do professor",esc(clabel(state.classId)))+
 '<div class="meta">'+tag("Sessão "+state.pin)+tag(s.phase)+tag(count+" participantes")+tag(s.score?"Com pontuação":"Sem pontuação")+'</div>'+body+errorMsg();
 if(s.phase==="lobby"){const el=$("#qr");if(el&&window.QRCode){new window.QRCode(el,{text:studentLink(),width:160,height:160,colorDark:"#141517",colorLight:"#fff"})}}
 tick();
}
function leadersHtml(leaders){return '<div class="scoreboard">'+(leaders.length?leaders.map((x,i)=>'<div class="score-row"><span>'+(i+1)+'. '+esc(x.label)+'</span><span>'+x.points+' pts</span></div>').join(""):'<p class="smallnote">Ainda não há pontuação.</p>')+'</div>'}
function studentLink(){const u=new URL("./auth-preview.html",location.href);u.searchParams.set("turma",state.classId);u.searchParams.set("pin",state.pin);return u.href}
async function loadTeacher(classId,pin){
 clean();state.mode="teacher";state.classId=classId;state.pin=pin;state.error="";setUrl({admin:true});
 const sr=sessionRef();
 state.unsubs.push(onSnapshot(sr,s=>{state.session=s.exists()?s.data():null;render()},message));
 state.unsubs.push(onSnapshot(collection(sr,"participants"),s=>{state.participants=s.docs.map(d=>d.data());render()},message));
 state.unsubs.push(onSnapshot(answersRef(),s=>{state.answers=s.docs.map(d=>d.data());render()},message));
 state.unsubs.push(onSnapshot(roundsRef(),s=>{state.rounds=s.docs.map(d=>d.data());render()},message));
}
async function createSession(){
 if(state.busy)return;
 const classId=$("#class-teacher").value,unit=$("#unit").value,qty=Number($("#qty").value),duration=Number($("#duration").value);
 const pool=allQuestions().filter(q=>unit==="all"||q.unit===unit);
 if(!pool.length){notify("Não há perguntas no tema escolhido.");return;}
 state.busy=true;
 try{
  for(let i=0;i<7;i++){
    const pin=rand(),ref=doc(db,"classes",classId,"quizSessions",pin);
    if((await getDoc(ref)).exists())continue;
    const list=shuffle(pool).slice(0,qty);
    await setDoc(ref,{createdBy:state.user.uid,createdAt:serverTimestamp(),phase:"lobby",
      questionIds:list.map(q=>q.id),currentIndex:-1,currentQuestion:null,roundId:"",
      duration,score:$("#scoring").checked,ranking:$("#ranking").checked,
      deadline:null,openedAt:null,reveal:null,leaders:[],updatedAt:serverTimestamp()});
    await loadTeacher(classId,pin);return;
  }
  throw Error("Não foi possível gerar um código de sala. Tente novamente.");
 }catch(e){message(e)}finally{state.busy=false}
}
async function advance(){
 const s=state.session;if(!s||!["lobby","result"].includes(s.phase))return;
 if(s.currentIndex+1>=s.questionIds.length){await updateDoc(sessionRef(),{phase:"ended",updatedAt:serverTimestamp()});return;}
 const index=s.currentIndex+1,q=qById(s.questionIds[index]);
 if(!q){notify("Questão não encontrada neste navegador. Importe o banco antes de retomar.");return;}
 const deadline=s.duration?Timestamp.fromMillis(Date.now()+s.duration*1000):null,roundId="r"+rand(8);
 try{await updateDoc(sessionRef(),{phase:"question",currentIndex:index,currentQuestion:{q:q.q,a:q.a,unit:q.unit},
    roundId,deadline,openedAt:serverTimestamp(),reveal:null,updatedAt:serverTimestamp()})}catch(e){message(e)}
}
function scoreBoard(rounds,answers){
 const scores=new Map();
 for(const round of rounds){
   const q=qById(round.questionId);if(!q)continue;
   for(const a of answers.filter(x=>x.roundId===round.roundId)){
      const old=scores.get(a.uid)||{uid:a.uid,points:0,correct:0};
      if(a.choice===q.correct){
        old.correct++;
        if(state.session.score){
          let bonus=1000;
          if(round.duration&&a.submittedAt?.toMillis&&round.deadline?.toMillis){
            const remaining=Math.max(0,round.deadline.toMillis()-a.submittedAt.toMillis());
            bonus=500+Math.round(500*Math.min(1,remaining/(round.duration*1000)));
          }
          old.points+=bonus;
        }
      }
      scores.set(a.uid,old);
   }
 }
 return [...scores.values()].sort((a,b)=>b.points-a.points||b.correct-a.correct||a.uid.localeCompare(b.uid)).slice(0,10)
 .map(a=>({label:"J-"+a.uid.slice(0,5),points:a.points,correct:a.correct}));
}
async function reveal(){
 const s=state.session;if(!s||s.phase!=="question"||state.revealingRound===s.roundId)return;
 state.revealingRound=s.roundId;state.busy=true;
 try{
   const q=qById(s.questionIds[s.currentIndex]);if(!q)throw Error("Questão ausente do banco local.");
   const answers=(await getDocs(answersRef())).docs.map(d=>d.data());
   const now=answers.filter(a=>a.roundId===s.roundId);
   const counts=q.a.map((_,i)=>now.filter(a=>a.choice===i).length);
   const correctCount=now.filter(a=>a.choice===q.correct).length;
   const round={roundId:s.roundId,index:s.currentIndex,questionId:q.id,unit:q.unit,
      question:q.q,correct:q.correct,counts,answered:now.length,correctCount,
      duration:s.duration,deadline:s.deadline,closedAt:serverTimestamp()};
   const leaders=scoreBoard(state.rounds.concat([round]),answers);
   const batch=writeBatch(db);
   batch.set(doc(roundsRef(),s.roundId),round);
   batch.update(sessionRef(),{phase:"result",reveal:{correct:q.correct,why:q.why,counts,answered:now.length,correctCount},
     leaders,updatedAt:serverTimestamp()});
   await batch.commit();
 }catch(e){message(e)}finally{state.busy=false;state.revealingRound=null}
}
async function exportIndividual(){
 const s=state.session;if(!s||!state.admin)return;
 const names=new Map(state.participants.map(x=>[x.uid,x.name]));
 const roundMap=new Map(state.rounds.map(r=>[r.roundId,r]));
 const rows=[["turma","codigo_sessao","uid","nome","indice_questao","questao_id","alternativa","acertou","enviado_em"]];
 for(const a of state.answers){const r=roundMap.get(a.roundId);if(!r)continue;
   rows.push([state.classId,state.pin,a.uid,names.get(a.uid)||"",r.index+1,r.questionId,ABC[a.choice],a.choice===r.correct?"sim":"não",a.submittedAt?.toDate?.().toISOString()||""]);
 }
 const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\r\n");
 const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");
 anchor.href=url;anchor.download="quiz-privado-"+state.classId+"-"+state.pin+".csv";anchor.click();URL.revokeObjectURL(url);
}
function tick(){
 const timer=$("#clock"),s=state.session;
 if(timer&&s?.phase==="question")timer.textContent=s.duration&&s.deadline?.toMillis
   ?Math.max(0,Math.ceil((s.deadline.toMillis()-Date.now())/1000))+"s":"Livre";
 if(state.admin&&state.mode==="teacher"&&s?.phase==="question"&&s.duration&&s.deadline?.toMillis
   &&Date.now()>s.deadline.toMillis()&&!state.busy){
    // O navegador do professor inicia a transição; o servidor rejeita respostas após o prazo.
    reveal();
 }
}
async function exportResults(){
 const s=state.session;if(!s||!state.admin)return;
 const rows=[["semestre","turma","pin","pergunta","respostas","acertos","A","B","C","D"],
    ...state.rounds.sort((a,b)=>a.index-b.index).map(r=>[state.classId.split("-").slice(1,3).join("."),
      state.classId,state.pin,r.question,r.answered,r.correctCount,...r.counts])];
 const quoted=rows.map(row=>row.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\r\n");
 const blob=new Blob(["\ufeff"+quoted],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");
 anchor.href=url;anchor.download="quiz-"+state.classId+"-"+state.pin+".csv";anchor.click();URL.revokeObjectURL(url);
}
function render(){if(!state.authReady){app.innerHTML='<div class="panel"><h2>Reconhecendo a sessão Google…</h2></div>';return}
 if(state.mode==="verify")return renderVerify();
 if(state.mode==="student")return renderStudent();
 if(state.mode==="teacher"&&state.admin)return renderTeacher();
 renderHome();
}
app.addEventListener("submit",ev=>{
 ev.preventDefault();
 if(ev.target.id==="join"){joinRoom($("#join-class").value,$("#join-pin").value.trim());}
 if(ev.target.id==="verify")verifyMember();
 if(ev.target.id==="create")createSession();
});
app.addEventListener("click",async ev=>{
 const choice=ev.target.closest("[data-choice]");if(choice){answer(Number(choice.dataset.choice));return;}
 const el=ev.target.closest("[data-act]");if(!el)return;
 const id=el.dataset.act;
 if(id==="signin"){try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){message(e)}return;}
 if(id==="signout"){await signOut(auth);return;}
 if(id==="home"){clean();state.mode="home";state.pin="";state.member=null;setUrl();render();return;}
 if(id==="teacher"&&state.admin){clean();state.mode="teacher";state.pin="";render();return;}
 if(id==="next"&&state.admin)await advance();
 if(id==="reveal"&&state.admin)await reveal();
 if(id==="end"&&state.admin&&confirm("Encerrar a sessão para a turma?"))await updateDoc(sessionRef(),{phase:"ended",updatedAt:serverTimestamp()});
 if(id==="new"&&state.admin){clean();state.pin="";state.mode="teacher";render();}
 if(id==="copy-link"&&state.admin){try{await navigator.clipboard.writeText(studentLink());notify("Link copiado.")}catch(e){notify("Não foi possível copiar o link.")}}
 if(id==="export"&&state.admin)exportResults();
 if(id==="export-individual"&&state.admin)exportIndividual();
});
onAuthStateChanged(auth,async user=>{
 clean();state.user=user;state.admin=false;state.member=null;state.authReady=true;state.error="";
 if(user){
   try{
     const s=await getDoc(doc(db,"admins",user.uid));
     state.admin=s.exists()&&s.data().active===true;
     if(state.admin){
       const c=await getDocs(collection(db,"classes"));
       state.classes=c.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>a.id.localeCompare(b.id));
     }
     if(state.pin&&state.classId){
       if(state.admin&&p.get("professor")==="1")await loadTeacher(state.classId,state.pin);
       else await joinRoom(state.classId,state.pin);
     }else render();
   }catch(e){message(e)}
 }else{state.mode="home";render()}
});
setInterval(tick,250);
render();
