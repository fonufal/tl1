import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, collection, setDoc, updateDoc,
  onSnapshot, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { FIREBASE_CONFIG, APP_BASE_URL, isFirebaseConfigured } from "./runtime-config.js?v=20260926-1737";
import { TOPIC_MAP } from "./topics.js";

const el = id => document.getElementById(id);
const initialClassId = new URLSearchParams(location.search).get("turma");

let auth;
let db;
let user = null;
let currentClassId = null;
let currentClass = null;
let currentSession = null;
let registrations = new Map();
let unsubscribeClass = null;
let unsubscribeRegistrations = null;
let unsubscribeSession = null;
let timerHandle = null;
let transitionInFlight = false;
let lastResults = null;

function show(id, visible = true) { el(id)?.classList.toggle("hidden", !visible); }
function adminMessage(text, type = "") {
  const box = el("admin-message");
  box.textContent = text;
  box.className = "notice" + (type ? " " + type : "");
  show("admin-message", true);
}
function clearAdminMessage() { show("admin-message", false); }

if (!isFirebaseConfigured()) {
  show("admin-setup-warning", true);
  el("admin-login-btn").disabled = true;
} else {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
}

el("admin-login-btn")?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    adminMessage("Não foi possível entrar: " + err.message, "danger");
  }
});
el("admin-signout-btn")?.addEventListener("click", () => signOut(auth));
el("create-class-btn")?.addEventListener("click", createClass);
el("create-production-classes-btn")?.addEventListener("click", createProductionClasses);
el("class-select")?.addEventListener("change", event => loadClass(event.target.value));
el("toggle-selection-btn")?.addEventListener("click", () => toggleClassFlag("selectionOpen"));
el("toggle-evaluation-btn")?.addEventListener("click", () => toggleClassFlag("evaluationOpen"));
el("create-session-btn")?.addEventListener("click", createSession);
el("start-btn")?.addEventListener("click", startCurrentPresentation);
el("end-btn")?.addEventListener("click", endCurrentPhase);
el("next-btn")?.addEventListener("click", moveNext);
el("results-btn")?.addEventListener("click", renderResults);
el("csv-btn")?.addEventListener("click", downloadCsv);

if (isFirebaseConfigured()) {
  onAuthStateChanged(auth, async currentUser => {
    cleanup();
    user = currentUser;
    if (!user) {
      el("admin-user-label").textContent = "";
      show("admin-signout-btn", false);
      show("admin-auth-card", true);
      show("not-admin-card", false);
      show("admin-app", false);
      return;
    }

    el("admin-user-label").textContent = user.displayName || user.email || "";
    show("admin-signout-btn", true);
    show("admin-auth-card", false);

    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    if (!adminSnap.exists() || adminSnap.data().active !== true) {
      el("admin-uid").textContent = user.uid;
      show("not-admin-card", true);
      show("admin-app", false);
      return;
    }

    show("not-admin-card", false);
    show("admin-app", true);
    await refreshClasses();
  });
}

async function refreshClasses() {
  const snap = await getDocs(collection(db, "classes"));
  const classes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));

  const select = el("class-select");
  select.innerHTML = '<option value="">Selecione...</option>';
  classes.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name + (item.term ? " — " + item.term : "");
    select.appendChild(option);
  });

  const target = initialClassId && classes.some(c => c.id === initialClassId)
    ? initialClassId
    : (currentClassId && classes.some(c => c.id === currentClassId) ? currentClassId : "");

  if (target) {
    select.value = target;
    await loadClass(target);
  }
}

async function createClass() {
  clearAdminMessage();
  const classId = el("new-class-id").value.trim().toLowerCase();
  const name = el("new-class-name").value.trim();
  const term = el("new-class-term").value.trim();
  const presentationDate = el("new-class-date").value;

  if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(classId)) {
    return adminMessage("Use no identificador apenas letras minúsculas, números e hífens.", "danger");
  }
  if (name.length < 3) return adminMessage("Informe o nome da turma.", "danger");

  const ref = doc(db, "classes", classId);
  if ((await getDoc(ref)).exists()) return adminMessage("Esse identificador de turma já existe.", "danger");

  await setDoc(ref, {
    name,
    term,
    presentationDate: presentationDate || "",
    active: true,
    selectionOpen: true,
    evaluationOpen: false,
    presentationSeconds: 180,
    ratingSeconds: 30,
    disabledTopics: [],
    currentSessionId: null,
    createdAt: serverTimestamp()
  });

  adminMessage("Turma criada.", "ok");
  await refreshClasses();
  el("class-select").value = classId;
  await loadClass(classId);
}

async function createProductionClasses() {
  clearAdminMessage();

  const classes = [
    { id: "tl1-2026-2-01", name: "TL1 — Turma 01", term: "2026.2" },
    { id: "tl1-2026-2-02", name: "TL1 — Turma 02", term: "2026.2" }
  ];

  const batch = writeBatch(db);
  const created = [];
  const skipped = [];

  for (const item of classes) {
    const ref = doc(db, "classes", item.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      skipped.push(item.name);
      continue;
    }

    batch.set(ref, {
      name: item.name,
      term: item.term,
      presentationDate: "",
      active: true,
      selectionOpen: true,
      evaluationOpen: false,
      presentationSeconds: 180,
      ratingSeconds: 30,
      disabledTopics: [],
      currentSessionId: null,
      createdAt: serverTimestamp()
    });
    created.push(item.name);
  }

  if (created.length) await batch.commit();
  await refreshClasses();

  if (created.length && skipped.length) {
    adminMessage(
      "Criadas: " + created.join(", ") + ". Já existiam: " + skipped.join(", ") + ".",
      "ok"
    );
  } else if (created.length) {
    adminMessage("Turmas reais criadas: " + created.join(", ") + ".", "ok");
  } else {
    adminMessage("As duas turmas TL1 2026.2 já existem.", "ok");
  }
}

async function loadClass(classId) {
  cleanupClassListeners();
  currentClassId = classId || null;
  currentClass = null;
  currentSession = null;
  registrations = new Map();
  lastResults = null;
  show("class-admin-card", false);
  show("session-card", false);
  show("qr-card", false);
  show("projector-link", false);

  if (!currentClassId) return;

  const classRef = doc(db, "classes", currentClassId);
  unsubscribeClass = onSnapshot(classRef, snap => {
    if (!snap.exists()) return;
    currentClass = snap.data();
    renderClass();
    attachSession(currentClass.currentSessionId || null);
  });

  unsubscribeRegistrations = onSnapshot(
    collection(db, "classes", currentClassId, "registrations"),
    snapshot => {
      registrations = new Map(snapshot.docs.map(d => [d.id, { uid: d.id, ...d.data() }]));
      renderRoster();
    }
  );
}

function renderClass() {
  show("class-admin-card", true);
  show("session-card", true);
  show("qr-card", true);
  el("admin-class-title").textContent = currentClass.name;
  el("admin-class-meta").textContent = [currentClass.term, currentClass.presentationDate].filter(Boolean).join(" · ");
  el("toggle-selection-btn").textContent = currentClass.selectionOpen ? "Fechar escolhas" : "Abrir escolhas";
  el("toggle-evaluation-btn").textContent = currentClass.evaluationOpen ? "Fechar avaliação" : "Abrir avaliação";

  const url = APP_BASE_URL + "?turma=" + encodeURIComponent(currentClassId) + "#avaliar";
  el("student-link").href = url;
  el("student-link").textContent = url;
  renderQr(url);

  const projector = el("projector-link");
  if (projector) {
    projector.href = APP_BASE_URL + "projector.html?turma=" + encodeURIComponent(currentClassId);
    show("projector-link", true);
  }
}

function renderRoster() {
  const body = el("roster-body");
  body.innerHTML = "";
  const rows = [...registrations.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  el("roster-count").textContent = rows.length;

  rows.forEach(reg => {
    const topic = TOPIC_MAP[reg.topicId];
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + escapeHtml(reg.name) + "</td>" +
      "<td>" + escapeHtml(reg.matricula || "") + "</td>" +
      "<td>" + escapeHtml(topic?.title || reg.topicId) + "</td>";
    body.appendChild(tr);
  });
}

async function toggleClassFlag(field) {
  if (!currentClassId || !currentClass) return;
  await updateDoc(doc(db, "classes", currentClassId), { [field]: !currentClass[field] });
}

async function createSession() {
  if (!currentClassId) return;
  const order = [...registrations.values()].map(reg => ({
    uid: reg.uid,
    name: reg.name,
    topicId: reg.topicId
  }));

  if (!order.length) return adminMessage("Não há alunos inscritos nesta turma.", "danger");
  shuffle(order);

  const sessionId = "s-" + Date.now().toString(36);
  const sessionRef = doc(db, "classes", currentClassId, "sessions", sessionId);
  const classRef = doc(db, "classes", currentClassId);
  const batch = writeBatch(db);
  batch.set(sessionRef, {
    status: "ready",
    order,
    currentIndex: 0,
    currentPresenter: order[0],
    presentationSeconds: Number(currentClass.presentationSeconds || 180),
    ratingSeconds: Number(currentClass.ratingSeconds || 30),
    startedAt: null,
    ratingStartedAt: null,
    roundId: null,
    createdAt: serverTimestamp()
  });
  batch.update(classRef, { currentSessionId: sessionId, evaluationOpen: true });
  await batch.commit();
  adminMessage("Ordem sorteada e sessão criada.", "ok");
}

function attachSession(sessionId) {
  if (unsubscribeSession) {
    unsubscribeSession();
    unsubscribeSession = null;
  }
  stopTimer();
  currentSession = null;
  show("session-controls", false);
  if (!sessionId || !currentClassId) return;

  unsubscribeSession = onSnapshot(
    doc(db, "classes", currentClassId, "sessions", sessionId),
    snap => {
      if (!snap.exists()) return;
      currentSession = { id: snap.id, ...snap.data() };
      transitionInFlight = false;
      renderSession();
      startTimerLoop();
    }
  );
}

function renderSession() {
  if (!currentSession) return;
  show("session-controls", true);
  const presenter = currentSession.currentPresenter || {};
  const topic = TOPIC_MAP[presenter.topicId];
  el("admin-presenter-name").textContent = presenter.name || "—";
  el("admin-presenter-topic").textContent = topic?.title || presenter.topicId || "";
  el("session-state").textContent = stateLabel(currentSession.status);

  const started = currentSession.status === "presenting";
  const rating = currentSession.status === "rating";
  const waiting = currentSession.status === "awaitingNext";
  const finished = currentSession.status === "finished";

  el("start-btn").disabled = started || rating || waiting || finished;
  el("end-btn").disabled = !(started || rating);
  el("next-btn").disabled = started || rating || finished;
  if (finished) {
    el("main-timer").textContent = "FIM";
  } else if (currentSession.status === "ready") {
    el("main-timer").textContent = formatTime(Number(currentSession.presentationSeconds || 180));
  }
}

async function startCurrentPresentation() {
  if (!currentSession || currentSession.status !== "ready") return;
  await updateDoc(sessionRef(), {
    status: "presenting",
    startedAt: serverTimestamp(),
    ratingStartedAt: null,
    roundId: crypto.randomUUID()
  });
}

async function endCurrentPhase() {
  if (!currentSession) return;
  if (currentSession.status === "presenting") {
    await updateDoc(sessionRef(), {
      status: "rating",
      ratingStartedAt: serverTimestamp()
    });
  } else if (currentSession.status === "rating") {
    await updateDoc(sessionRef(), { status: "awaitingNext" });
  }
}

async function moveNext() {
  if (!currentSession) return;
  const nextIndex = Number(currentSession.currentIndex || 0) + 1;
  const order = currentSession.order || [];

  if (nextIndex >= order.length) {
    await updateDoc(sessionRef(), {
      status: "finished",
      currentPresenter: null,
      startedAt: null,
      ratingStartedAt: null
    });
    return;
  }

  await updateDoc(sessionRef(), {
    status: "ready",
    currentIndex: nextIndex,
    currentPresenter: order[nextIndex],
    startedAt: null,
    ratingStartedAt: null,
    roundId: null
  });
}

function startTimerLoop() {
  stopTimer();
  timerHandle = setInterval(tickTimer, 250);
  tickTimer();
}

async function tickTimer() {
  if (!currentSession) return;
  let seconds = null;

  if (currentSession.status === "presenting" && currentSession.startedAt?.toMillis) {
    seconds = Math.max(0, Math.ceil(
      Number(currentSession.presentationSeconds || 180) -
      (Date.now() - currentSession.startedAt.toMillis()) / 1000
    ));
    el("main-timer").classList.remove("rating");
    if (seconds <= 0 && !transitionInFlight) {
      transitionInFlight = true;
      try {
        await updateDoc(sessionRef(), { status: "rating", ratingStartedAt: serverTimestamp() });
      } finally {
        transitionInFlight = false;
      }
    }
  } else if (currentSession.status === "rating" && currentSession.ratingStartedAt?.toMillis) {
    seconds = Math.max(0, Math.ceil(
      Number(currentSession.ratingSeconds || 30) -
      (Date.now() - currentSession.ratingStartedAt.toMillis()) / 1000
    ));
    el("main-timer").classList.add("rating");
    if (seconds <= 0 && !transitionInFlight) {
      transitionInFlight = true;
      try {
        await updateDoc(sessionRef(), { status: "awaitingNext" });
      } finally {
        transitionInFlight = false;
      }
    }
  }

  if (seconds !== null) el("main-timer").textContent = formatTime(seconds);
}

async function renderResults() {
  if (!currentSession) return;
  lastResults = await computeResults();
  const body = el("results-body");
  body.innerHTML = "";

  const expectedPerPresenter = Math.max(0, registrations.size - 1);
  let complete = 0;

  lastResults.forEach(row => {
    const isComplete = row.count === expectedPerPresenter;
    if (isComplete) complete++;

    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + escapeHtml(row.name) + "</td>" +
      "<td>" + escapeHtml(row.topic) + "</td>" +
      "<td>" + row.count + " / " + expectedPerPresenter + "</td>" +
      "<td>" + (row.count ? row.average.toFixed(1).replace(".", ",") : "—") + "</td>";
    body.appendChild(tr);
  });

  const summary = el("results-summary");
  if (summary) {
    summary.textContent = expectedPerPresenter
      ? complete + " de " + lastResults.length +
        " apresentadores receberam todas as " + expectedPerPresenter +
        " avaliações esperadas."
      : "Não há avaliadores suficientes para calcular uma média por pares.";
  }

  show("results-wrap", true);
}

async function computeResults() {
  const evalSnap = await getDocs(collection(
    db, "classes", currentClassId, "sessions", currentSession.id, "evaluations"
  ));
  const grouped = new Map();
  evalSnap.docs.forEach(d => {
    const data = d.data();
    if (!grouped.has(data.presenterUid)) grouped.set(data.presenterUid, []);
    grouped.get(data.presenterUid).push(Number(data.score));
  });

  return [...registrations.values()]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"))
    .map(reg => {
      const scores = grouped.get(reg.uid) || [];
      const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        uid: reg.uid,
        name: reg.name,
        matricula: reg.matricula || "",
        topicId: reg.topicId,
        topic: TOPIC_MAP[reg.topicId]?.title || reg.topicId,
        count: scores.length,
        average
      };
    });
}

async function downloadCsv() {
  if (!currentSession) return;
  const rows = lastResults || await computeResults();
  const header = ["nome","matricula","topico_id","topico","n_avaliacoes","media"];
  const data = [header, ...rows.map(r => [
    r.name, r.matricula, r.topicId, r.topic, r.count, r.count ? r.average.toFixed(1) : ""
  ])];
  const csv = data.map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = currentClassId + "-" + currentSession.id + "-resultados.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function renderQr(url) {
  const canvas = el("qr-canvas");
  if (!canvas || !window.QRious) return;

  new window.QRious({
    element: canvas,
    value: url,
    size: 220,
    padding: 10,
    level: "M",
    background: "white",
    foreground: "black"
  });
}

function sessionRef() {
  return doc(db, "classes", currentClassId, "sessions", currentSession.id);
}

function stateLabel(status) {
  return ({
    ready: "pronto",
    presenting: "apresentando",
    rating: "avaliação aberta",
    awaitingNext: "aguardando próximo",
    finished: "concluído"
  })[status] || status || "";
}

function formatTime(totalSeconds) {
  const total = Math.max(0, Math.ceil(totalSeconds));
  const min = String(Math.floor(total / 60)).padStart(2, "0");
  const sec = String(total % 60).padStart(2, "0");
  return min + ":" + sec;
}

function shuffle(array) {
  if (crypto?.getRandomValues) {
    for (let i = array.length - 1; i > 0; i--) {
      const max = Math.floor(0x100000000 / (i + 1)) * (i + 1);
      let value;
      do {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        value = buf[0];
      } while (value >= max);
      const j = value % (i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
  } else {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function cleanupClassListeners() {
  if (unsubscribeClass) unsubscribeClass();
  if (unsubscribeRegistrations) unsubscribeRegistrations();
  if (unsubscribeSession) unsubscribeSession();
  unsubscribeClass = unsubscribeRegistrations = unsubscribeSession = null;
  stopTimer();
}

function cleanup() {
  cleanupClassListeners();
  currentClassId = null;
  currentClass = null;
  currentSession = null;
}

function csvCell(value) {
  const s = String(value ?? "");
  return '"' + s.replace(/"/g, '""') + '"';
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}
