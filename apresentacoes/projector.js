import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { FIREBASE_CONFIG, isFirebaseConfigured } from "./runtime-config.js?v=20260926-1737";
import { TOPIC_MAP } from "./topics.js";

const el = id => document.getElementById(id);
const classId = new URLSearchParams(location.search).get("turma");

let auth;
let db;
let unsubscribeClass = null;
let unsubscribeSession = null;
let currentClass = null;
let currentSession = null;
let currentSessionId = null;
let timerHandle = null;

function show(id, visible = true) {
  el(id)?.classList.toggle("hidden", !visible);
}

function authMessage(text) {
  el("projection-auth-message").textContent = text;
  show("projection-auth-message", true);
}

if (!isFirebaseConfigured()) {
  authMessage("Firebase não configurado.");
  el("projection-login-btn").disabled = true;
} else if (!classId) {
  authMessage("O link da projeção não contém uma turma.");
  el("projection-login-btn").disabled = true;
} else {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
}

el("projection-login-btn")?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    authMessage("Não foi possível entrar: " + err.message);
  }
});

el("fullscreen-btn")?.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {}
});

document.addEventListener("fullscreenchange", () => {
  el("fullscreen-btn").textContent = document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia";
});

if (auth && classId) {
  onAuthStateChanged(auth, async user => {
    cleanup();

    if (!user) {
      show("projection-auth", true);
      show("projection-app", false);
      return;
    }

    try {
      const adminSnap = await getDoc(doc(db, "admins", user.uid));
      if (!adminSnap.exists() || adminSnap.data().active !== true) {
        show("projection-auth", true);
        show("projection-app", false);
        authMessage("Esta conta não está autorizada como administradora.");
        return;
      }

      show("projection-auth", false);
      show("projection-app", true);
      attachClass();
    } catch (err) {
      show("projection-auth", true);
      show("projection-app", false);
      authMessage("Não foi possível validar o acesso administrativo: " + err.message);
    }
  });
}

function attachClass() {
  const classRef = doc(db, "classes", classId);
  unsubscribeClass = onSnapshot(
    classRef,
    snap => {
      if (!snap.exists()) {
        setIdle("Turma não encontrada.");
        return;
      }

      currentClass = snap.data();
      el("projection-class").textContent =
        currentClass.name + (currentClass.term ? " · " + currentClass.term : "");

      const sessionId = currentClass.currentSessionId || null;
      if (sessionId !== currentSessionId) {
        attachSession(sessionId);
      } else if (!sessionId) {
        setIdle("Aguardando o professor sortear a ordem.");
      }
    },
    err => setIdle("Não foi possível acompanhar a turma: " + err.message)
  );
}

function attachSession(sessionId) {
  if (unsubscribeSession) unsubscribeSession();
  unsubscribeSession = null;
  currentSession = null;
  currentSessionId = sessionId || null;
  stopTimer();

  if (!sessionId) {
    setIdle("Aguardando o professor sortear a ordem.");
    return;
  }

  unsubscribeSession = onSnapshot(
    doc(db, "classes", classId, "sessions", sessionId),
    snap => {
      if (!snap.exists()) {
        setIdle("Sessão não encontrada.");
        return;
      }
      currentSession = { id: snap.id, ...snap.data() };
      renderSession();
      startTimer();
    },
    err => setIdle("Não foi possível acompanhar a sessão: " + err.message)
  );
}

function renderSession() {
  const s = currentSession;
  if (!s) return;

  document.body.classList.remove("projection-presenting", "projection-rating", "projection-finished");

  if (s.status === "finished") {
    document.body.classList.add("projection-finished");
    el("projection-phase").textContent = "CONCLUÍDA";
    el("projection-label").textContent = "Sessão de apresentações";
    el("projection-name").textContent = "Fim das apresentações";
    el("projection-topic").textContent = "";
    el("projection-timer").textContent = "FIM";
    el("projection-status").textContent = "Sessão concluída.";
    show("projection-next", false);
    return;
  }

  const presenter = s.currentPresenter || {};
  const topic = TOPIC_MAP[presenter.topicId];
  el("projection-name").textContent = presenter.name || "—";
  el("projection-topic").textContent = topic?.title || presenter.topicId || "";
  renderNext(s);

  if (s.status === "ready") {
    el("projection-phase").textContent = "PRÓXIMO";
    el("projection-label").textContent = "Próximo apresentador";
    el("projection-status").textContent = "Aguardando o professor iniciar.";
    el("projection-timer").textContent = formatTime(Number(s.presentationSeconds || 180));
  } else if (s.status === "presenting") {
    document.body.classList.add("projection-presenting");
    el("projection-phase").textContent = "APRESENTANDO";
    el("projection-label").textContent = "Apresentando agora";
    el("projection-status").textContent = "Apresentação em andamento.";
  } else if (s.status === "rating") {
    document.body.classList.add("projection-rating");
    el("projection-phase").textContent = "AVALIAÇÃO ABERTA";
    el("projection-label").textContent = "Apresentação concluída";
    el("projection-status").textContent = "Os colegas estão avaliando.";
  } else if (s.status === "awaitingNext") {
    el("projection-phase").textContent = "AGUARDANDO";
    el("projection-label").textContent = "Apresentação concluída";
    el("projection-timer").textContent = "00:00";
    el("projection-status").textContent = "Aguardando o próximo apresentador.";
  }
}

function renderNext(s) {
  const order = Array.isArray(s.order) ? s.order : [];
  const index = Number(s.currentIndex ?? -1);
  const next = index >= 0 ? order[index + 1] : null;
  const shouldShow = next && ["presenting", "rating", "awaitingNext"].includes(s.status);

  show("projection-next", Boolean(shouldShow));
  if (!shouldShow) return;

  el("projection-next-name").textContent = next.name || "";
  const nextTopic = TOPIC_MAP[next.topicId];
  el("projection-next-topic").textContent = nextTopic?.title || next.topicId || "";
}

function startTimer() {
  stopTimer();
  timerHandle = setInterval(tick, 200);
  tick();
}

function tick() {
  const s = currentSession;
  if (!s) return;

  if (s.status === "presenting" && s.startedAt?.toMillis) {
    const seconds = Math.max(
      0,
      Math.ceil(Number(s.presentationSeconds || 180) - (Date.now() - s.startedAt.toMillis()) / 1000)
    );
    el("projection-timer").textContent = formatTime(seconds);
  } else if (s.status === "rating" && s.ratingStartedAt?.toMillis) {
    const seconds = Math.max(
      0,
      Math.ceil(Number(s.ratingSeconds || 30) - (Date.now() - s.ratingStartedAt.toMillis()) / 1000)
    );
    el("projection-timer").textContent = formatTime(seconds);
  }
}

function setIdle(status) {
  currentSession = null;
  stopTimer();
  document.body.classList.remove("projection-presenting", "projection-rating", "projection-finished");
  el("projection-phase").textContent = "AGUARDANDO";
  el("projection-label").textContent = "Sessão de apresentações";
  el("projection-name").textContent = "Aguardando início";
  el("projection-topic").textContent = "";
  el("projection-timer").textContent = currentClass
    ? formatTime(Number(currentClass.presentationSeconds || 180))
    : "03:00";
  el("projection-status").textContent = status;
  show("projection-next", false);
}

function formatTime(totalSeconds) {
  const total = Math.max(0, Math.ceil(totalSeconds));
  const min = String(Math.floor(total / 60)).padStart(2, "0");
  const sec = String(total % 60).padStart(2, "0");
  return min + ":" + sec;
}

function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function cleanup() {
  if (unsubscribeClass) unsubscribeClass();
  if (unsubscribeSession) unsubscribeSession();
  unsubscribeClass = unsubscribeSession = null;
  currentSessionId = null;
  stopTimer();
}
