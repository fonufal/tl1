import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, onSnapshot, runTransaction,
  serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { FIREBASE_CONFIG, MAIL_WEBAPP_URL, isFirebaseConfigured, isMailConfigured } from "./runtime-config.js?v=20260926-1737";
import { TOPICS, TOPIC_MAP } from "./topics.js";

const el = id => document.getElementById(id);
const classId = new URLSearchParams(location.search).get("turma");
const hashMode = location.hash.replace("#", "");

let auth;
let db;
let user = null;
let classData = null;
let registration = null;
let claims = new Set();
let unsubscribeClaims = null;
let unsubscribeClass = null;
let unsubscribeSession = null;
let activeSession = null;
let listeningSessionId = null;

function show(id, visible = true) {
  el(id)?.classList.toggle("hidden", !visible);
}
function message(text, type = "") {
  const box = el("global-message");
  box.textContent = text;
  box.className = "notice" + (type ? " " + type : "");
  show("global-message", true);
}
function clearMessage() { show("global-message", false); }
function formatScore(value) { return Number(value).toFixed(1).replace(".", ","); }

if (!isFirebaseConfigured()) {
  show("setup-warning", true);
  el("login-btn").disabled = true;
} else {
  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
}

if (!classId) {
  show("auth-card", false);
  show("no-class-card", true);
}

el("login-btn")?.addEventListener("click", async () => {
  clearMessage();
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    message("Não foi possível entrar com Google: " + err.message, "danger");
  }
});

el("signout-btn")?.addEventListener("click", () => signOut(auth));

el("topic-search")?.addEventListener("input", renderTopics);

el("score-input")?.addEventListener("input", event => {
  el("score-value").textContent = formatScore(event.target.value);
});

el("submit-score-btn")?.addEventListener("click", submitEvaluation);

if (isFirebaseConfigured() && classId) {
  onAuthStateChanged(auth, async currentUser => {
    user = currentUser;
    if (!user) {
      cleanupListeners();
      el("user-label").textContent = "";
      show("signout-btn", false);
      show("auth-card", true);
      show("registration-card", false);
      show("choice-card", false);
      show("evaluation-card", false);
      return;
    }

    el("user-label").textContent = user.displayName || user.email || "";
    show("signout-btn", true);
    show("auth-card", false);
    el("student-name").value = user.displayName || "";
    await loadClassAndRegistration();
  });
}

async function loadClassAndRegistration() {
  clearMessage();
  const classRef = doc(db, "classes", classId);
  const snap = await getDoc(classRef);
  if (!snap.exists()) {
    message("Turma não encontrada. Confira o link fornecido pelo professor.", "danger");
    return;
  }
  classData = snap.data();
  el("class-title").textContent = classData.name || "Teoria Linguística 1";
  el("class-subtitle").textContent = [classData.term, classData.presentationDate].filter(Boolean).join(" · ") || "Escolha de tópicos e avaliação por pares.";

  const regRef = doc(db, "classes", classId, "registrations", user.uid);
  const regSnap = await getDoc(regRef);
  registration = regSnap.exists() ? regSnap.data() : null;

  if (registration) {
    renderChoice();
    show("registration-card", false);
    show("choice-card", true);
    show("evaluation-card", true);
  } else {
    show("choice-card", false);
    show("evaluation-card", false);
    show("registration-card", true);
    startClaimsListener();
  }

  startClassListener(classRef);
  if (registration) await syncSessionFromClass();
}

function startClaimsListener() {
  if (unsubscribeClaims) unsubscribeClaims();
  unsubscribeClaims = onSnapshot(collection(db, "classes", classId, "claims"), snapshot => {
    claims = new Set(snapshot.docs.map(d => d.id));
    renderTopics();
  }, err => message("Não foi possível atualizar os tópicos disponíveis: " + err.message, "danger"));
}

function renderTopics() {
  const list = el("topic-list");
  if (!list) return;
  const term = (el("topic-search")?.value || "").trim().toLowerCase();
  const disabled = new Set(classData?.disabledTopics || []);
  const filtered = TOPICS.filter(topic => {
    if (!term) return true;
    return (topic.title + " " + topic.authors).toLowerCase().includes(term);
  });
  const available = TOPICS.filter(t => !claims.has(t.id) && !disabled.has(t.id)).length;
  el("available-count").textContent = available + " disponíveis";

  list.innerHTML = "";
  filtered.forEach(topic => {
    const unavailable = claims.has(topic.id) || disabled.has(topic.id);
    const item = document.createElement("div");
    item.className = "topic" + (unavailable ? " unavailable" : "");
    item.innerHTML =
      '<div class="topic-id">' + topic.id + '</div>' +
      '<div><div class="topic-title">' + escapeHtml(topic.title) + '</div>' +
      '<div class="topic-author">' + escapeHtml(topic.authors) + '</div></div>';
    const button = document.createElement("button");
    button.className = "btn secondary";
    button.textContent = unavailable ? "Indisponível" : "Escolher";
    button.disabled = unavailable || !classData?.selectionOpen;
    button.addEventListener("click", () => reserveTopic(topic));
    item.appendChild(button);
    list.appendChild(item);
  });

  if (!classData?.selectionOpen) {
    const closed = document.createElement("div");
    closed.className = "notice";
    closed.textContent = "A escolha de tópicos está fechada no momento.";
    list.prepend(closed);
  }
}

async function reserveTopic(topic) {
  clearMessage();
  const name = el("student-name").value.trim();
  const matricula = el("student-id").value.trim();

  if (name.length < 2) return message("Informe seu nome.", "danger");
  if (matricula.length < 3) return message("Informe sua matrícula.", "danger");

  const ok = confirm("Confirmar a escolha de “" + topic.title + "”? Depois da confirmação, somente o professor poderá alterar o tópico.");
  if (!ok) return;

  const classRef = doc(db, "classes", classId);
  const regRef = doc(db, "classes", classId, "registrations", user.uid);
  const claimRef = doc(db, "classes", classId, "claims", topic.id);
  const rosterRef = doc(db, "classes", classId, "roster", user.uid);

  try {
    await runTransaction(db, async transaction => {
      const classSnap = await transaction.get(classRef);
      const regSnap = await transaction.get(regRef);
      const claimSnap = await transaction.get(claimRef);

      if (!classSnap.exists()) throw new Error("Turma não encontrada.");
      const currentClass = classSnap.data();
      if (!currentClass.selectionOpen) throw new Error("A escolha de tópicos foi encerrada.");
      if (regSnap.exists()) throw new Error("Você já escolheu um tópico nesta turma.");
      if (claimSnap.exists()) throw new Error("Este tópico acabou de ser escolhido por outro aluno.");
      if ((currentClass.disabledTopics || []).includes(topic.id)) throw new Error("Este tópico não está habilitado para a turma.");

      transaction.set(claimRef, { claimedAt: serverTimestamp() });
      transaction.set(regRef, {
        uid: user.uid,
        name,
        matricula,
        email: user.email,
        topicId: topic.id,
        createdAt: serverTimestamp()
      });
      transaction.set(rosterRef, { name, topicId: topic.id });
    });

    registration = { uid: user.uid, name, matricula, email: user.email, topicId: topic.id };
    if (unsubscribeClaims) {
      unsubscribeClaims();
      unsubscribeClaims = null;
    }
    show("registration-card", false);
    show("choice-card", true);
    show("evaluation-card", true);
    renderChoice();
    await syncSessionFromClass();
    message("Tópico reservado com sucesso.", "ok");
    await requestConfirmationEmail();
  } catch (err) {
    message(err.message || "Não foi possível reservar o tópico.", "danger");
  }
}

function renderChoice() {
  const topic = TOPIC_MAP[registration.topicId];
  el("choice-content").innerHTML =
    '<div class="topic choice"><div class="topic-id">' + registration.topicId + '</div>' +
    '<div><div class="topic-title">' + escapeHtml(topic?.title || registration.topicId) + '</div>' +
    '<div class="topic-author">' + escapeHtml(topic?.authors || "") + '</div></div></div>';
}

async function requestConfirmationEmail() {
  const box = el("mail-status");
  if (!isMailConfigured()) {
    box.textContent = "A confirmação por e-mail será ativada depois da publicação do serviço de e-mail.";
    box.className = "notice";
    show("mail-status", true);
    return;
  }

  try {
    await postConfirmationEmail();
    box.textContent = "Solicitação de e-mail de confirmação enviada.";
    box.className = "notice ok";
    show("mail-status", true);

    const retryDelay = 20000 + Math.floor(Math.random() * 40000);
    window.setTimeout(() => {
      if (user) postConfirmationEmail().catch(() => {});
    }, retryDelay);
  } catch {
    box.textContent = "A reserva foi feita. Se o e-mail não chegar, a plataforma tentará novamente enquanto esta página permanecer aberta.";
    box.className = "notice";
    show("mail-status", true);
  }
}

async function postConfirmationEmail() {
  const idToken = await user.getIdToken();
  const body = new URLSearchParams({ idToken, classId });
  await fetch(MAIL_WEBAPP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });
}

function startClassListener(classRef) {
  if (unsubscribeClass) unsubscribeClass();
  unsubscribeClass = onSnapshot(
    classRef,
    async snap => {
      if (!snap.exists()) return;
      classData = snap.data();
      if (registration) {
        await syncSessionFromClass();
      } else {
        renderTopics();
      }
    },
    err => {
      message("Não foi possível acompanhar as atualizações da turma: " + err.message, "danger");
    }
  );
}

async function syncSessionFromClass() {
  if (!registration || !classData) return;

  const sessionId = classData.currentSessionId || null;

  if (!sessionId || !classData.evaluationOpen) {
    detachSessionListener();
    resetEvaluationUI();
    el("evaluation-status").textContent = classData.evaluationOpen
      ? "Aguardando o professor iniciar a sessão."
      : "A avaliação ainda não está aberta.";
    return;
  }

  if (listeningSessionId === sessionId && unsubscribeSession) return;

  detachSessionListener();
  activeSession = null;
  resetEvaluationUI();

  const sessionRef = doc(db, "classes", classId, "sessions", sessionId);

  // Busca inicial explícita: evita depender apenas do primeiro evento do listener.
  try {
    const initial = await getDoc(sessionRef);
    if (initial.exists()) {
      activeSession = { id: initial.id, ...initial.data() };
      await renderSessionForStudent();
    }
  } catch (err) {
    el("evaluation-status").textContent =
      "Não foi possível carregar a sessão: " + err.message;
  }

  listeningSessionId = sessionId;
  unsubscribeSession = onSnapshot(
    sessionRef,
    async snap => {
      if (!snap.exists()) return;
      activeSession = { id: snap.id, ...snap.data() };
      await renderSessionForStudent();
    },
    err => {
      listeningSessionId = null;
      el("evaluation-status").textContent =
        "Não foi possível acompanhar a sessão: " + err.message;
      message("Erro ao acompanhar a sessão de apresentações: " + err.message, "danger");
    }
  );
}

function detachSessionListener() {
  if (unsubscribeSession) unsubscribeSession();
  unsubscribeSession = null;
  listeningSessionId = null;
  activeSession = null;
}

async function renderSessionForStudent() {
  const session = activeSession;
  resetEvaluationUI();
  if (!session) return;

  if (session.status === "finished") {
    setEvaluationPhase("Concluída");
    el("evaluation-status").textContent = "Sessão concluída.";
    return;
  }

  if (!session.currentPresenter?.uid) {
    setEvaluationPhase("Aguardando");
    el("evaluation-status").textContent = "Aguardando o próximo apresentador.";
    return;
  }

  const presenterIsUser = session.currentPresenter.uid === user.uid;
  const topic = TOPIC_MAP[session.currentPresenter.topicId];

  show("presentation-box", true);
  el("presenter-name").textContent = session.currentPresenter.name || "";
  el("presenter-topic").textContent = topic?.title || session.currentPresenter.topicId;

  if (session.status === "ready") {
    el("presenter-label").textContent = "Próximo apresentador";
    setEvaluationPhase("Próximo");
    el("evaluation-status").textContent = presenterIsUser
      ? "Você é o próximo apresentador. Aguarde o professor iniciar."
      : "Próxima apresentação pronta. Aguarde o professor iniciar.";
    return;
  }

  if (session.status === "presenting") {
    el("presenter-label").textContent = "Apresentando agora";
    setEvaluationPhase("Apresentando", "is-presenting");
    el("evaluation-status").textContent = presenterIsUser
      ? "Você está apresentando agora."
      : "Apresentação em andamento. A avaliação abrirá ao final.";
    return;
  }

  if (session.status === "rating") {
    el("presenter-label").textContent = "Apresentação concluída";
    setEvaluationPhase("AVALIAÇÃO ABERTA", "rating-open");

    if (presenterIsUser) {
      el("evaluation-status").textContent =
        "Sua apresentação terminou. Você não pode se autoavaliar.";
      bringEvaluationIntoView();
      return;
    }

    const evalId = session.currentPresenter.uid + "__" + user.uid;
    const evalRef = doc(db, "classes", classId, "sessions", session.id, "evaluations", evalId);
    const existing = await getDoc(evalRef);

    // A sessão pode ter mudado enquanto a avaliação já enviada era consultada.
    if (!activeSession || activeSession.id !== session.id || activeSession.status !== "rating") {
      return renderSessionForStudent();
    }

    if (existing.exists()) {
      el("evaluation-status").textContent = "Sua avaliação deste apresentador já foi enviada.";
      bringEvaluationIntoView();
      return;
    }

    el("evaluation-status").textContent = "Avalie agora: a janela de avaliação está aberta.";
    el("score-input").value = "7";
    el("score-value").textContent = "7,0";
    show("score-box", true);
    bringEvaluationIntoView();
    return;
  }

  if (session.status === "awaitingNext") {
    el("presenter-label").textContent = "Apresentação concluída";
    setEvaluationPhase("Encerrada");
    el("evaluation-status").textContent = presenterIsUser
      ? "Sua apresentação e a avaliação foram encerradas. Aguarde o próximo apresentador."
      : "Avaliação encerrada. Aguarde o próximo apresentador.";
    return;
  }
}

async function submitEvaluation() {
  if (!activeSession || activeSession.status !== "rating") return;
  const presenterUid = activeSession.currentPresenter?.uid;
  if (!presenterUid || presenterUid === user.uid) return;

  const button = el("submit-score-btn");
  button.disabled = true;
  const score = Number(el("score-input").value);
  const evalId = presenterUid + "__" + user.uid;
  const evalRef = doc(db, "classes", classId, "sessions", activeSession.id, "evaluations", evalId);

  try {
    await setDoc(evalRef, {
      presenterUid,
      evaluatorUid: user.uid,
      score,
      roundId: activeSession.roundId,
      submittedAt: serverTimestamp()
    });
    show("score-box", false);
    el("evaluation-status").textContent = "Avaliação enviada. Obrigado.";
  } catch (err) {
    message("A avaliação não pôde ser registrada. Talvez a janela de avaliação já tenha sido encerrada.", "danger");
  } finally {
    button.disabled = false;
  }
}

function resetEvaluationUI() {
  show("presentation-box", false);
  show("score-box", false);
  const card = el("evaluation-card");
  card?.classList.remove("is-presenting", "rating-open");
  if (el("evaluation-phase")) el("evaluation-phase").textContent = "Aguardando";
}

function setEvaluationPhase(label, className = "") {
  const card = el("evaluation-card");
  card?.classList.remove("is-presenting", "rating-open");
  if (className) card?.classList.add(className);
  if (el("evaluation-phase")) el("evaluation-phase").textContent = label;
}

function bringEvaluationIntoView() {
  const card = el("evaluation-card");
  if (!card) return;
  const rect = card.getBoundingClientRect();
  if (rect.top < 0 || rect.top > window.innerHeight * 0.65) {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function cleanupListeners() {
  [unsubscribeClaims, unsubscribeClass].forEach(fn => fn && fn());
  unsubscribeClaims = unsubscribeClass = null;
  detachSessionListener();
}

async function refreshClassState() {
  if (!db || !user || !classId || !registration) return;
  try {
    const snap = await getDoc(doc(db, "classes", classId));
    if (!snap.exists()) return;
    classData = snap.data();
    await syncSessionFromClass();
  } catch (err) {
    console.warn("Falha ao sincronizar estado da turma", err);
  }
}

window.addEventListener("focus", refreshClassState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshClassState();
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}
