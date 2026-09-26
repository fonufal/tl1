const TL1 = Object.freeze({
  SPREADSHEET_ID: '1PAsVoUl72CDLyRap3OgFcvmIU3ISOKGZWoAh2tmqTtA',
  TOPICS_SHEET: 'TOPICOS',
  EMAIL_LOG_SHEET: 'EMAIL_LOG'
});

function doGet() {
  return json_({ ok: true, service: 'TL1 confirmation mailer' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const idToken = String(e && e.parameter && e.parameter.idToken || '');
    const classId = String(e && e.parameter && e.parameter.classId || '');

    if (!idToken || !classId) {
      return json_({ ok: false, error: 'missing_parameters' });
    }

    const user = verifyFirebaseUser_(idToken);
    const uid = user.localId;
    const email = user.email;

    if (!uid || !email || user.emailVerified !== true) {
      return json_({ ok: false, error: 'unverified_user' });
    }

    const registration = firestoreGet_(
      'classes/' + encodeURIComponent(classId) + '/registrations/' + encodeURIComponent(uid),
      idToken
    );

    if (!registration || registration.email !== email || registration.uid !== uid) {
      return json_({ ok: false, error: 'registration_mismatch' });
    }

    const key = sentKey_(classId, uid);
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(key)) {
      return json_({ ok: true, alreadySent: true });
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      logEmail_(email, 'TL1 — confirmação de tópico', 'PENDENTE', 'Quota diária de e-mail esgotada.');
      return json_({ ok: false, error: 'mail_quota_exhausted' });
    }

    const classData = firestoreGet_(
      'classes/' + encodeURIComponent(classId),
      idToken
    );

    const topic = getTopic_(registration.topicId);
    if (!topic) {
      return json_({ ok: false, error: 'unknown_topic' });
    }

    const subject = 'TL1 — tópico confirmado: ' + topic.title;
    const htmlBody = buildMessage_(registration, classData, topic);

    MailApp.sendEmail({
      to: email,
      subject,
      htmlBody,
      name: 'Teoria Linguística 1'
    });

    props.setProperty(key, new Date().toISOString());
    logEmail_(email, subject, 'ENVIADO', '');
    return json_({ ok: true });
  } catch (err) {
    try {
      logEmail_('', 'TL1 — confirmação de tópico', 'ERRO', String(err && err.message || err));
    } catch (_) {}
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function verifyFirebaseUser_(idToken) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('FIREBASE_API_KEY');
  if (!apiKey) throw new Error('FIREBASE_API_KEY não configurada nas propriedades do script.');

  const response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('Token Firebase inválido ou expirado.');
  }

  const data = JSON.parse(response.getContentText());
  if (!data.users || !data.users.length) throw new Error('Usuário Firebase não encontrado.');
  return data.users[0];
}

function firestoreGet_(documentPath, idToken) {
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('FIREBASE_PROJECT_ID');
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID não configurado nas propriedades do script.');

  const url =
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(projectId) +
    '/databases/(default)/documents/' +
    documentPath;

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + idToken },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Não foi possível validar a inscrição no Firestore.');
  }

  const doc = JSON.parse(response.getContentText());
  return decodeFields_(doc.fields || {});
}

function decodeFields_(fields) {
  const out = {};
  Object.keys(fields).forEach(function(key) {
    out[key] = decodeValue_(fields[key]);
  });
  return out;
}

function decodeValue_(value) {
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeValue_);
  if (value.mapValue) return decodeFields_(value.mapValue.fields || {});
  return null;
}

function getTopic_(topicId) {
  const ss = SpreadsheetApp.openById(TL1.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(TL1.TOPICS_SHEET);
  const values = sheet.getRange(2, 1, Math.max(0, sheet.getLastRow() - 1), 4).getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(topicId)) {
      return {
        id: String(values[i][0]),
        order: values[i][1],
        title: String(values[i][2]),
        authors: String(values[i][3])
      };
    }
  }
  return null;
}

function buildMessage_(registration, classData, topic) {
  const className = classData && classData.name ? classData.name : 'Teoria Linguística 1';
  const date = classData && classData.presentationDate
    ? '<p><strong>Data da apresentação:</strong> ' + escapeHtml_(classData.presentationDate) + '</p>'
    : '';

  return [
    '<p>' + escapeHtml_(registration.name) + ',</p>',
    '<p>seu tópico para a apresentação de ' + escapeHtml_(className) + ' foi confirmado.</p>',
    '<p><strong>' + escapeHtml_(topic.title) + '</strong><br>' + escapeHtml_(topic.authors) + '</p>',
    date,
    '<p>A apresentação terá <strong>3 minutos</strong>. O objetivo não é resumir todo o capítulo, mas responder de maneira sintética e compreensível à pergunta do título.</p>',
    '<p>Na preparação, organize a fala em torno de: uma resposta central; uma ou duas ideias que sustentem essa resposta; pelo menos um exemplo que torne o ponto compreensível; e um encerramento breve.</p>',
    '<p>No dia, a ordem será sorteada. Ao final de cada apresentação haverá uma janela curta para a avaliação da turma.</p>',
    '<p>Teoria Linguística 1</p>'
  ].join('');
}

function sentKey_(classId, uid) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    classId + '|' + uid,
    Utilities.Charset.UTF_8
  );
  return 'mail_' + bytes.map(function(b) {
    const n = (b + 256) % 256;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function logEmail_(to, subject, status, error) {
  const ss = SpreadsheetApp.openById(TL1.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(TL1.EMAIL_LOG_SHEET);
  sheet.appendRow([new Date(), to, subject, status, error]);
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
