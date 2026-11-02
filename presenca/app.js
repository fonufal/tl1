import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,doc,collection,getDoc,getDocs,setDoc,updateDoc,runTransaction,writeBatch,serverTimestamp,Timestamp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {FIREBASE_CONFIG} from "../apresentacoes/firebase-config.js";

const firebase=initializeApp(FIREBASE_CONFIG);
const auth=getAuth(firebase),db=getFirestore(firebase);
const app=document.getElementById("app"),toast=document.getElementById("notice");
const params=new URLSearchParams(location.search);
const stageNames={start:"Chamada inicial · tempos 1 e 2",end:"Chamada final · tempos 3 e 4"};
const today=()=>{const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Maceio",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return parts.year+"-"+parts.month+"-"+parts.day};
const state={user:null,admin:false,ready:false,classes:[],classId:params.get("turma")||"",date:params.get("dia")||today(),stage:params.get("etapa")||"",token:params.get("chave")||"",member:null,needVerify:false,busy:false,error:"",roster:[],windows:[],records:new Map(),selectedDate:params.get("dia")||today(),view:"day"};
if(state.token){const clean=new URL(location.href);clean.searchParams.delete("chave");history.replaceState(null,"",clean.pathname+clean.search+clean.hash);}
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const classLabel=c=>c.name||c.id;
const windowId=(date,stage)=>date+"_"+stage;
const winRef=(date,stage)=>doc(db,"classes",state.classId,"attendanceWindows",windowId(date,stage));
const eligibleRef=id=>doc(db,"classes",state.classId,"eligible",id);
const regRef=()=>doc(db,"classes",state.classId,"registrations",state.user.uid);
const quizRef=()=>doc(db,"classes",state.classId,"quizIdentities",state.user.uid);
const clsRef=()=>doc(db,"classes",state.classId);
const validClass=id=>/^[a-z0-9-]{3,60}$/.test(id);
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+"T12:00:00Z"));
const institutional=e=>/^[^@]+@([a-z0-9-]+\.)*ufal\.br$/i.test(e||"");
function notify(msg){toast.textContent=msg;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),5500)}
function err(e){state.error=e?.message||String(e);notify(state.error);render()}
function head(title,lead){return '<div class="head"><div class="eyebrow">TEORIA LINGUÍSTICA 1 / PRESENÇA</div><h1>'+title+'</h1><p class="muted">'+lead+'</p></div>'}
function authBox(){return '<div class="card"><div class="row"><div><h2>Acesso</h2><p class="muted">'+(state.user?"Conta: "+esc(state.user.email||"Google"):"Use a conta institucional Google, igual à cadastrada no SIGAA.")+'</p></div><button class="btn '+(state.user?"secondary":"")+'" data-act="'+(state.user?"logout":"login")+'">'+(state.user?"Sair":"Entrar com Google")+'</button></div></div>'}
function errBox(){return state.error?'<div class="card error" role="alert">'+esc(state.error)+'</div>':""}
function renderStudent(){
  let content=head("Presença.","Dois registros por encontro: um no início e outro ao final das quatro aulas.")+authBox();
  if(!validClass(state.classId)||!validDate(state.date)||!stageNames[state.stage]||!state.token){
    content+='<div class="card"><h2>Leia o QR Code exibido em sala</h2><p>Abra o link da chamada no início ou no final da aula. Cada QR Code é válido por poucos minutos.</p></div>';
  }else{
    content+='<div class="card"><div class="eyebrow">TURMA '+esc(state.classId)+' · '+esc(state.date)+'</div><h2>'+esc(stageNames[state.stage])+'</h2>';
    if(!state.user)content+='<p>Entre com Google para continuar.</p>';
    else if(!institutional(state.user.email))content+='<p class="error">Esta conta não usa um domínio institucional da UFAL. Entre com sua conta institucional ou solicite registro presencial ao professor.</p>';
    else if(state.needVerify)content+='<p>Confirme sua matrícula uma única vez. Seu e-mail deve coincidir com o da conta Google institucional.</p><form id="verify" class="stack"><div class="field"><label for="matricula">Matrícula</label><input id="matricula" inputmode="numeric" required></div><div class="field"><label for="email">E-mail do SIGAA</label><input id="email" type="email" required value="'+esc(state.user.email||"")+'"></div><button class="btn" type="submit">Confirmar vínculo</button></form>';
    else if(state.member)content+='<p>Estudante: <strong>'+esc(state.member.name)+'</strong></p><p class="muted small">A presença é registrada apenas após a confirmação abaixo.</p><button class="btn" data-act="mark" '+(state.busy?"disabled":"")+'>Registrar presença</button>';
    else content+='<p>Verificando seu vínculo com a turma…</p>';
    content+='</div>';
  }
  app.innerHTML=content+errBox();
}
function renderAdmin(){
  const choices=state.classes.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===state.classId?"selected":"")+'>'+esc(classLabel(c))+'</option>').join("");
  let html=head("Chamada.","Abertura dos QR Codes e conferência privativa, por turma e semestre.")+authBox();
  html+='<div class="card"><div class="controls"><div class="field"><label for="turma">Turma</label><select id="turma"><option value="">Selecione</option>'+choices+'</select></div><div class="field"><label for="dia">Data do encontro</label><input id="dia" type="date" value="'+esc(state.selectedDate)+'"></div><div class="field"><label for="duracao">Duração do QR Code</label><select id="duracao"><option value="3">3 minutos</option><option value="5" selected>5 minutos</option><option value="8">8 minutos</option><option value="10">10 minutos</option></select></div><button class="btn" data-act="reload">Consultar</button></div></div>';
  if(!state.classId){app.innerHTML=html+errBox();return;}
  html+='<div class="grid">';
  for(const stage of ["start","end"]){
    const w=state.windows.find(x=>x.id===windowId(state.selectedDate,stage));
    const active=w&&w.status==="open"&&w.expiresAt&&w.expiresAt.toMillis()>Date.now();
    const count=state.records.get(windowId(state.selectedDate,stage))?.marks.size||0;
    html+='<section class="card"><div class="eyebrow">'+(stage==="start"?"01 / INÍCIO":"02 / FINAL")+'</div><h2>'+esc(stageNames[stage])+'</h2><p class="muted">'+(active?"Chamada aberta · "+count+" registro(s)":"Chamada não ativa")+'</p>';
    if(active)html+='<div class="qr" id="qr-'+stage+'" aria-label="QR Code temporário da chamada"></div><p class="small">Expira às '+esc(new Date(w.expiresAt.toMillis()).toLocaleTimeString("pt-BR",{timeZone:"America/Maceio",hour:"2-digit",minute:"2-digit",second:"2-digit"}))+'</p><button class="btn secondary" data-act="copylink" data-stage="'+stage+'">Copiar link</button> <button class="btn negative" data-act="close" data-stage="'+stage+'">Encerrar</button>';
    else html+='<button class="btn" data-act="open" data-stage="'+stage+'">'+(w?"Reabrir com novo QR":"Abrir chamada")+'</button>';
    html+='</section>';
  }
  html+='</div><section class="card"><h2>Conferência e ajustes</h2><p class="muted small">A correção manual exige justificativa. Cada alteração gera um evento de auditoria. O QR Code não substitui a conferência do professor.</p><form id="correction" class="stack"><div class="grid"><div class="field"><label for="student">Estudante</label><select id="student" required>'+state.roster.filter(x=>x.status==="active").map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+" · "+esc(s.matricula)+'</option>').join("")+'</select></div><div class="field"><label for="stage">Etapa</label><select id="stage"><option value="start">Início (2 tempos)</option><option value="end">Final (2 tempos)</option></select></div></div><div class="grid"><div class="field"><label for="correction-status">Registrar</label><select id="correction-status"><option value="present">Presença conferida</option><option value="absent">Ausência conferida</option><option value="auto">Desfazer correção (usar QR)</option></select></div><div class="field"><label for="reason">Justificativa</label><input id="reason" minlength="8" required placeholder="Ex.: registro presencial sem celular"></div></div><button type="submit" class="btn secondary">Salvar correção</button></form></section>';
  html+='<section class="card"><div class="row"><div><h2>Relatório de frequência</h2><p class="muted small">0, 2 ou 4 = faltas na data. Pendente = nem todas as janelas foram abertas. A grade considera apenas registros existentes, sem presumir aulas em dias não registrados.</p></div><button class="btn secondary" data-act="report">Atualizar relatório</button></div><div class="actionbar"><button class="btn" data-act="copy">Copiar grade</button><button class="btn secondary" data-act="csv">Baixar CSV</button><button class="btn secondary" data-act="copyabsences">Copiar só as faltas</button></div><div id="report-table">'+buildTable()+'</div></section>';
  app.innerHTML=html+errBox();
  for(const stage of ["start","end"]){const w=state.windows.find(x=>x.id===windowId(state.selectedDate,stage));if(w&&w.status==="open"&&w.expiresAt?.toMillis()>Date.now()&&window.QRCode){
    new window.QRCode($("qr-"+stage),{text:makeLink(w),width:200,height:200,correctLevel:window.QRCode.CorrectLevel.M});
  }}
}
function makeLink(w){const url=new URL("./",location.href);url.search="";url.searchParams.set("turma",state.classId);url.searchParams.set("dia",w.day);url.searchParams.set("etapa",w.stage);url.searchParams.set("chave",w.token);return url.href}
function render(){if(!state.ready){app.innerHTML='<div class="card">Reconhecendo a sessão Google…</div>';return;}if(state.admin&&params.get("painel")==="1")renderAdmin();else renderStudent()}
function showSuccess(text){app.innerHTML=head("Registrado.","Chamada de Teoria Linguística 1")+authBox()+'<div class="card"><p class="confirm">'+esc(text)+'</p><p>'+esc(state.member?.name||"")+'</p><p class="muted">'+esc(state.date)+' · '+esc(stageNames[state.stage])+'</p><p class="small">Guarde esta confirmação. A presença final é conferida pelo professor e lançada oficialmente no SIGAA.</p></div>'}
async function identify(){
  state.member=null;state.needVerify=false;
  if(!validClass(state.classId)||!state.user)return;
  const r=await getDoc(regRef());
  let id="",name="";
  if(r.exists()){id=r.data().eligibilityId;name=r.data().name;}
  else{const q=await getDoc(quizRef());if(q.exists()){id=q.data().eligibilityId;name=q.data().name;}}
  if(!id){state.needVerify=true;return;}
  const s=await getDoc(eligibleRef(id));
  if(!s.exists()||s.data().status!=="active"){state.error="Cadastro não está ativo nesta turma. Consulte o professor.";return;}
  if(String(s.data().emailNormalized||s.data().email).toLowerCase()!==String(state.user.email).toLowerCase()){state.error="O e-mail autenticado difere do cadastrado no SIGAA. Use a conta institucional correspondente ou procure o professor.";return;}
  state.member={id,name:name||s.data().name};
}
async function sha256(text){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function verify(){
  if(state.busy)return;
  const matricula=$("matricula").value.replace(/\D/g,""),email=$("email").value.trim().toLowerCase();
  if(matricula.length<5||email!==state.user.email.toLowerCase()||!institutional(email))throw Error("Use o mesmo e-mail institucional autenticado, junto com a matrícula do SIGAA.");
  state.busy=true;
  try{
    const id=await sha256(matricula+"|"+email),er=eligibleRef(id),qr=quizRef(),cr=doc(db,"classes",state.classId,"quizClaims",id);
    await runTransaction(db,async tx=>{
      const e=await tx.get(er),i=await tx.get(qr);
      if(!e.exists()||e.data().status!=="active")throw Error("Matrícula e e-mail não encontrados na lista ativa.");
      if(e.data().boundUid&&e.data().boundUid!==state.user.uid)throw Error("Matrícula vinculada a outra conta. Procure o professor.");
      if(i.exists())return;
      tx.set(qr,{eligibilityId:id,name:e.data().name,createdAt:serverTimestamp()});
      tx.set(cr,{uid:state.user.uid,createdAt:serverTimestamp()});
    });
    await identify();if(!state.member)throw Error("Não foi possível concluir o vínculo.");
    state.busy=false;
    await mark();
  }finally{state.busy=false;}
}
async function mark(){
  if(state.busy)return;
  if(!institutional(state.user?.email)||!state.member)throw Error("Acesso não autorizado para registrar frequência.");
  const ref=doc(winRef(state.date,state.stage),"marks",state.user.uid),old=await getDoc(ref);
  if(old.exists()){showSuccess("Presença já registrada nesta etapa.");return;}
  state.busy=true;
  try{
    await setDoc(ref,{uid:state.user.uid,eligibilityId:state.member.id,token:state.token,markedAt:serverTimestamp()});
    showSuccess("Presença recebida com sucesso.");
  }catch(e){
    if(e.code==="permission-denied")throw Error("Não foi possível registrar: QR Code encerrado, expirado ou incompatível com a conta/turma. Solicite conferência ao professor.");
    throw e;
  }finally{state.busy=false;}
}
async function loadAdmin(){
  const snap=await getDocs(collection(db,"classes"));state.classes=snap.docs.map(d=>({id:d.id,...d.data()}));
  if(!state.classId&&state.classes.length)state.classId=state.classes[0].id;
  if(state.classId)await loadClass();else render();
}
async function loadClass(){
  if(!validClass(state.classId))throw Error("Turma inválida.");
  const [students,windows]=await Promise.all([getDocs(collection(clsRef(),"eligible")),getDocs(collection(clsRef(),"attendanceWindows"))]);
  state.roster=students.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
  state.windows=windows.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.day.localeCompare(b.day));
  await refreshRecords();render();
}
async function refreshRecords(){
  const win=state.windows;
  const values=await Promise.all(win.map(async w=>{
    const [marks,corrections]=await Promise.all([getDocs(collection(winRef(w.day,w.stage),"marks")),getDocs(collection(winRef(w.day,w.stage),"corrections"))]);
    return [w.id,{marks:new Map(marks.docs.map(d=>[d.data().eligibilityId,d.data()])),corrections:new Map(corrections.docs.map(d=>[d.id,d.data()]))}];
  }));
  state.records=new Map(values);
}

function absenceSummary(){
  const rows=absenceRows();
  return '<h3 style="margin-top:24px">Faltas para ajuste no SIGAA</h3><p class="muted small">Após conferir as presenças da data no SIGAA, ajuste apenas os casos abaixo. Não inclui janelas incompletas.</p>'+
  (rows.length===1?'<p>Nenhuma falta em encontros encerrados.</p>':
  '<div class="tablewrap"><table><thead><tr>'+rows[0].map(x=>'<th>'+esc(x)+'</th>').join("")+'</tr></thead><tbody>'+
  rows.slice(1).map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>');
}

function markStatus(student,windowDoc){
  if(!windowDoc)return null;
  const x=state.records.get(windowDoc.id),override=x?.corrections.get(student.id);
  if(override&&override.status!=="auto")return override.status==="present";
  return x?.marks.has(student.id)||false;
}
function matrix(){
  const days=[...new Set(state.windows.map(w=>w.day))].sort();
  const rows=state.roster.map(s=>{
    const cells=days.map(day=>{
      if(s.status!=="active")return "T";
      const first=state.windows.find(w=>w.day===day&&w.stage==="start");
      const last=state.windows.find(w=>w.day===day&&w.stage==="end");
      if(!first||!last)return "PENDENTE";
      const finished=w=>w.status==="closed"||(w.expiresAt&&w.expiresAt.toMillis()<=Date.now());
      if(!finished(first)||!finished(last))return "EM ANDAMENTO";
      return String((markStatus(s,first)?0:2)+(markStatus(s,last)?0:2));
    });
    const confirmed=cells.filter(x=>/^[024]$/.test(x)).reduce((t,x)=>t+Number(x),0);
    return [s.matricula,s.name,...cells,String(confirmed)];
  });
  return [["Matrícula","Nome",...days.map(x=>x.slice(8,10)+"/"+x.slice(5,7)+"/"+x.slice(0,4)),"Faltas (datas completas)"],...rows];
}
function absenceRows(){
  const days=[...new Set(state.windows.map(w=>w.day))].sort(),result=[];
  for(const day of days){
    const first=state.windows.find(w=>w.day===day&&w.stage==="start"),last=state.windows.find(w=>w.day===day&&w.stage==="end");
    if(!first||!last)continue;
    const done=w=>w.status==="closed"||(w.expiresAt&&w.expiresAt.toMillis()<=Date.now());
    if(!done(first)||!done(last))continue;
    for(const s of state.roster){
      if(s.status!=="active")continue;
      const a=markStatus(s,first)?0:2,b=markStatus(s,last)?0:2;
      if(a||b)result.push([day.slice(8,10)+"/"+day.slice(5,7)+"/"+day.slice(0,4),s.matricula,s.name,String(a),String(b),String(a+b)]);
    }
  }
  return [["Data","Matrícula","Nome","Faltas no início","Faltas no final","Total"],...result];
}
function buildTable(){
  if(!state.roster.length)return '<p class="muted">Sem estudantes autorizados nesta turma.</p>';
  const m=matrix(),hdr=m[0].map(x=>'<th>'+esc(x)+'</th>').join("");
  return '<div class="tablewrap"><table><thead><tr>'+hdr+'</tr></thead><tbody>'+m.slice(1).map(r=>'<tr>'+r.map((v,i)=>'<td '+(i>1?'class="num"':'')+'>'+esc(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'+absenceSummary();
}
async function openWindow(stage){
  if($("turma").value!==state.classId)throw Error("Clique em Consultar após trocar a turma.");
  state.selectedDate=$("dia").value;
  if(!stageNames[stage]||!validDate(state.selectedDate))throw Error("Data/etapa inválida.");
  const already=state.windows.find(w=>w.id===windowId(state.selectedDate,stage));
  if(already&&!confirm("Reabrir esta etapa altera o QR e mantém os registros anteriores. Continuar?"))return;
  const mins=Number($("duracao").value);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,"0")).join("");
  await setDoc(winRef(state.selectedDate,stage),{day:state.selectedDate,stage,status:"open",openedAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+mins*60*1000),token,openedBy:state.user.uid,minutes:mins});
  notify("QR Code de "+(stage==="start"?"início":"final")+" criado.");
  await loadClass();
}
async function closeWindow(stage){state.selectedDate=$("dia").value;if($("turma").value!==state.classId)throw Error("Consulte primeiro a turma selecionada.");if(!confirm("Encerrar a chamada "+stageNames[stage]+"?"))return;await updateDoc(winRef(state.selectedDate,stage),{status:"closed",closedAt:serverTimestamp(),closedBy:state.user.uid});await loadClass();}
async function correction(){
  state.selectedDate=$("dia").value;if($("turma").value!==state.classId)throw Error("Consulte primeiro a turma selecionada.");
  const id=$("student").value,stage=$("stage").value,status=$("correction-status").value,reason=$("reason").value.trim();
  if(!state.roster.some(s=>s.id===id&&s.status==="active")||!stageNames[stage]||!["present","absent","auto"].includes(status)||reason.length<8)throw Error("Informe estudante, etapa, situação e justificativa de pelo menos oito caracteres.");
  const w=state.windows.find(x=>x.id===windowId(state.selectedDate,stage));
  if(!w)throw Error("Abra a janela desta etapa antes de inserir ajustes. Datas sem chamada não geram faltas.");
  const batch=writeBatch(db),fields={eligibilityId:id,status,reason,updatedBy:state.user.uid,updatedAt:serverTimestamp()};
  batch.set(doc(winRef(state.selectedDate,stage),"corrections",id),fields);
  batch.set(doc(collection(winRef(state.selectedDate,stage),"correctionLogs")),{...fields,day:state.selectedDate,stage});
  await batch.commit();notify("Correção registrada e auditada.");await loadClass();
}
function safeCell(x){const v=String(x);return /^[=+\-@]/.test(v)?"'"+v:v}
function downloadCSV(){const cells=matrix();const csv="\ufeff"+cells.map(r=>r.map(x=>'"'+safeCell(x).replaceAll('"','""')+'"').join(";")).join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="presenca-"+state.classId+"-"+today()+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function copyAbsences(){await navigator.clipboard.writeText(absenceRows().map(r=>r.map(x=>safeCell(x).replace(/[\t\r\n]/g," ")).join("\t")).join("\n"));notify("Somente as faltas confirmadas foram copiadas.");}
async function copyTSV(){await navigator.clipboard.writeText(matrix().map(r=>r.map(x=>safeCell(x).replace(/[\t\r\n]/g," ")).join("\t")).join("\n"));notify("Grade copiada. Cole em uma planilha privada para conferência.")}
app.addEventListener("click",async e=>{
  const b=e.target.closest("[data-act]");if(!b)return;
  state.error="";
  try{
    if(b.dataset.act==="login"){await signInWithPopup(auth,new GoogleAuthProvider());return}
    if(b.dataset.act==="logout"){await signOut(auth);return}
    if(!state.admin&&b.dataset.act==="mark"){await mark();return}
    if(!state.admin)return;
    const act=b.dataset.act,stage=b.dataset.stage;
    if(act==="reload"){state.classId=$("turma").value;state.selectedDate=$("dia").value;await loadClass()}
    if(act==="open")await openWindow(stage);
    if(act==="close")await closeWindow(stage);
    if(act==="copylink"){const w=state.windows.find(x=>x.id===windowId(state.selectedDate,stage));if(w){await navigator.clipboard.writeText(makeLink(w));notify("Link temporário copiado.")}}
    if(act==="report"){await refreshRecords();render();notify("Relatório atualizado.")}
    if(act==="copy")await copyTSV();
    if(act==="copyabsences")await copyAbsences();
    if(act==="csv")downloadCSV();
  }catch(error){err(error)}
});
app.addEventListener("submit",async e=>{if(!["verify","correction"].includes(e.target.id))return;e.preventDefault();state.error="";try{if(e.target.id==="verify")await verify();else await correction();}catch(error){err(error)}});
onAuthStateChanged(auth,async user=>{
  state.ready=true;state.user=user;state.admin=false;state.error="";state.member=null;state.needVerify=false;render();
  if(!user)return;
  try{
    const a=await getDoc(doc(db,"admins",user.uid));state.admin=a.exists()&&a.data().active===true;
    if(state.admin&&params.get("painel")==="1")await loadAdmin();
    else if(validClass(state.classId)){await identify();render();}
    else render();
  }catch(error){err(error);}
});