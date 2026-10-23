// Envia as notificacoes do Bolao F1 (Firebase Cloud Messaging).
// Uso: node avisos/enviar.js            -> rotina normal (roda a cada ~10 min no GitHub Actions)
//      MENSAGEM="texto" node avisos/enviar.js teste p2,p3   -> (opcional) texto proprio; varios destinos com virgula ou "todos"
//      node avisos/enviar.js teste p1   -> manda uma notificacao de teste para os aparelhos da pessoa p1 (ou "admin")
// Variaveis: GOOGLE_APPLICATION_CREDENTIALS (chave) | FIRESTORE_EMULATOR_HOST (teste) | SIMULAR=1 (nao envia, so mostra)
//            AGORA=<ISO> (relogio de teste) | AGENDA_DIR=<pasta com jolpica_AAAA.json> (calendario de teste)
const fs = require('fs');
const SITE = 'https://mascarelo.github.io/bolao-f1/';
const PTS = [5, 25, 18, 15, 12, 10], SP = 'Sem palpites';
const H = 36e5;
// janela de tolerancia (o GitHub pode atrasar): passou disso, o lembrete daquele horario e pulado.
// O de 1h vale ate 15 min antes do 1o treino (sempre antes do encerramento automatico, 5 min antes).
const LEMB = [{ k: 'l15', h: 15, tol: 60 * 6e4 }, { k: 'l8', h: 8, tol: 60 * 6e4 }, { k: 'l1', h: 1, tol: 45 * 6e4 }];

const AGK = [[/bahrein|bahrain/i, /bahrain|sakhir/i], [/arábia|arabia/i, /saudi|jeddah/i], [/austrália|australia/i, /austral|melbourne/i], [/japão|japan/i, /japan|suzuka/i], [/china/i, /chin|shanghai/i], [/miami/i, /miami/i], [/emilia/i, /emilia|imola/i], [/mônaco|monaco/i, /monaco|monte/i], [/canadá|canada/i, /canad|montr/i], [/madri/i, /madrid|madring/i], [/barcelona/i, /barcelona|catalunya|montmel/i], [/espanha/i, /spain|spanish/i], [/áustria|austria/i, /austria|spielberg/i], [/inglaterra|britain|reino/i, /british|silverstone|great britain/i], [/hungria/i, /hungar|budapest/i], [/bélgica|belgica/i, /belg|\bspa\b/i], [/holanda/i, /dutch|netherlands|zandvoort/i], [/itália|italia/i, /italian|monza/i], [/azerbaij/i, /azerbaijan|baku/i], [/singapura/i, /singap/i], [/estados unidos/i, /united states|austin/i], [/méxico|mexico/i, /mexic/i], [/são paulo|sao paulo|brasil/i, /paulo|brazil|interlagos/i], [/las vegas/i, /vegas/i], [/catar|qatar/i, /qatar|lusail/i], [/abu dhabi/i, /abu dhabi|yas/i]];
function casar(rounds, races, idx) {
  const r = races[idx]; if (!r || r.st === 'x') return null;
  const txt = (x) => (x.raceName || '') + ' ' + (((x.Circuit || {}).Location || {}).locality || '');
  const k = AGK.find((q) => q[0].test(r.n));
  if (k) { const m = rounds.filter((x) => k[1].test(txt(x))); if (m.length === 1) return m[0]; }
  const live = races.map((_, i) => i).filter((i) => races[i].st !== 'x');
  if (live.length === rounds.length) return rounds[live.indexOf(idx)] || null;
  return null;
}
const ts = (o) => { if (!o || !o.date) return null; const t = new Date(o.date + 'T' + (o.time || '12:00:00Z')); return isNaN(t) ? null : t; };
function primeiroTreino(x) {
  const t = ts(x.FirstPractice); if (t) return t;
  const l = ['SprintQualifying', 'SprintShootout', 'Sprint', 'Qualifying'].map((k) => ts(x[k])).concat([ts(x)]).filter(Boolean).sort((a, b) => a - b);
  return l[0] || null;
}
async function calendario(y, agendaDir) {
  if (agendaDir) { try { return JSON.parse(fs.readFileSync(agendaDir + '/jolpica_' + y + '.json', 'utf8')).MRData.RaceTable.Races; } catch (_) { return null; } }
  try { const r = await fetch('https://api.jolpi.ca/ergast/f1/' + y + '.json?limit=100'); if (!r.ok) return null; return (await r.json()).MRData.RaceTable.Races; } catch (_) { return null; }
}
const chave = (...p) => p.join('_').replace(/[^A-Za-z0-9_]/g, '_');
const brData = (d) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const done = (r) => r.st !== 'x' && (r.res || []).length === 6 && r.res.every(Boolean);
const pontos = (r, pid) => (r.pk && r.pk[pid] || []).reduce((a, p, i) => a + (p && p !== SP && p === r.res[i] ? PTS[i] : 0), 0);
const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p);

// posicoes do palpite: pole, 1o..5o. Devolve os indices vazios (vazio ou "Sem palpites"); sem documento = todas vazias
const POS = ['pole', '1º', '2º', '3º', '4º', '5º'];
const vazio = (picks) => POS.map((_, i) => i).filter((i) => !picks || !picks[i] || picks[i] === SP);
function faltaTexto(v) {
  const n = v.map((i) => POS[i]);
  if (n.length === 1) return 'falta ' + (v[0] === 0 ? 'a pole' : 'o ' + n[0]);
  return 'faltam ' + n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1];
}

function textoRestante(ms) {
  const m = Math.round(ms / 6e4);
  if (m >= 90) return plural(Math.round(m / 60), 'hora', 'horas');
  if (m >= 50) return '1 hora';
  return plural(Math.max(m, 1), 'minuto', 'minutos');
}
function diaDe(t, agora) {
  return brData(t) === brData(agora) ? 'hoje' : brData(t) === brData(new Date(agora.getTime() + 24 * H)) ? 'amanhã' : t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).replace(/-feira/, '');
}
const horaDe = (t) => t.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
const quando = (t, agora) => diaDe(t, agora) + ', ' + horaDe(t);
const quandoAs = (t, agora) => diaDe(t, agora) + ' às ' + horaDe(t);

// Devolve a funcao que manda uma notificacao para uma lista de aparelhos (e limpa os aparelhos que nao existem mais)
function criarEnviar({ db, messaging, simular, log, saida }) {
  return async function enviar(tokens, msg, descricao) {
    if (!tokens.length) return;
    saida.push({ para: tokens.length, ...msg, descricao });
    log('ENVIO: ' + msg.title + ' | ' + msg.body + ' -> ' + tokens.length + ' aparelho(s) [' + descricao + ']');
    if (simular) return;
    for (let i = 0; i < tokens.length; i += 500) {
      const lote = tokens.slice(i, i + 500);
      const r = await messaging.sendEachForMulticast({
        tokens: lote, notification: { title: msg.title, body: msg.body }, data: { url: SITE },
        webpush: { fcmOptions: { link: SITE }, notification: { icon: SITE + 'icon.png' } },
      });
      await Promise.all(r.responses.map(async (x, j) => {
        const c = x.error && x.error.code;
        if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') await db.doc('dispositivos/' + lote[j]).delete().catch(() => {});
      }));
    }
  };
}

// Reserva um aviso de forma atomica (dois processos ao mesmo tempo nunca mandam o mesmo aviso duas vezes). true = pode enviar.
async function reservar(db, chaveAviso, agora) {
  const ref = db.doc('avisos/estado');
  return db.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    const env = d.exists ? (d.data().enviados || {}) : {};
    if (env[chaveAviso]) return false;
    tx.set(ref, { enviados: { [chaveAviso]: agora.toISOString() }, base: true }, { merge: true });
    return true;
  });
}

// Aviso "Palpites encerrados": vale para os dois caminhos (botao do admin, visto na rotina, e encerramento automatico, na hora)
async function avisarEncerrados({ db, messaging, agora, simular, log = console.log, saida = [] }) {
  const est = await db.doc('avisos/estado').get();
  if (!est.exists || !est.data().base) return saida; // primeira execucao: a rotina registra o passado antes
  const ts0 = await db.collection('temporadas').get(); if (!ts0.size) return saida;
  const y = ts0.docs.sort((a, b) => +a.id - +b.id)[ts0.size - 1].id;
  const races = (await db.collection('temporadas/' + y + '/corridas').get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.id < b.id ? -1 : 1));
  const devs = (await db.collection('dispositivos').get()).docs.map((d) => d.data());
  const enviar = criarEnviar({ db, messaging, simular, log, saida });
  for (const r of races) {
    if (!(r.palpitesEncerrados && r.st !== 'x')) continue;
    if (!(await reservar(db, chave('enc', y, r.id), agora))) continue;
    await enviar(devs.filter((d) => d.token && d.prefs && d.prefs.enc === true).map((d) => d.token), { title: '🔒 Palpites encerrados', body: r.n + '. Veja o que cada um apostou.' }, 'enc ' + r.id);
  }
  return saida;
}

async function rodar({ db, messaging, agora, simular, agendaDir, log = console.log }) {
  const saida = [];
  const enviar = criarEnviar({ db, messaging, simular, log, saida });

  const estadoRef = db.doc('avisos/estado');
  const est = await estadoRef.get();
  const enviados = est.exists ? (est.data().enviados || {}) : {};
  const marcar = async (ks) => { if (!ks.length) return; const o = {}; ks.forEach((k) => { enviados[k] = agora.toISOString(); o[k] = agora.toISOString(); }); await estadoRef.set({ enviados: o, base: true }, { merge: true }); };

  const ts0 = await db.collection('temporadas').get();
  if (!ts0.size) { log('Sem temporadas.'); return saida; }
  const sd = ts0.docs.sort((a, b) => +a.id - +b.id)[ts0.size - 1], y = sd.id, pessoas = (sd.data().people || []);
  const cs = await db.collection('temporadas/' + y + '/corridas').get();
  const races = cs.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.id < b.id ? -1 : 1));

  // primeira execucao: so registra o que ja aconteceu (nao avisa o passado)
  if (!est.exists || !est.data().base) {
    const ks = []; races.forEach((r) => { if (r.palpitesEncerrados && r.st !== 'x') ks.push(chave('enc', y, r.id)); if (done(r)) ks.push(chave('res', y, r.id)); });
    await marcar(ks); log('Primeira execucao: ' + ks.length + ' avisos antigos registrados, nada enviado.'); return saida;
  }

  const devs = (await db.collection('dispositivos').get()).docs.map((d) => d.data());
  const com = (k) => devs.filter((d) => d.token && d.prefs && d.prefs[k] === true);

  // 1) palpites encerrados (o encerramento automatico ja avisa na hora; aqui entram os encerrados pelo botao)
  await avisarEncerrados({ db, messaging, agora, simular, log, saida });
  // 2) resultado e pontos
  const tot = {}; pessoas.forEach((p) => { tot[p.id] = 0; });
  races.filter(done).forEach((r) => pessoas.forEach((p) => { tot[p.id] += pontos(r, p.id); }));
  const lider = pessoas.slice().sort((a, b) => tot[b.id] - tot[a.id])[0];
  for (const r of races) {
    const k = chave('res', y, r.id);
    if (done(r) && !enviados[k]) {
      const lt = lider ? 'Líder: ' + lider.n + ', ' + tot[lider.id] + '.' : '';
      const porPessoa = {};
      com('res').forEach((d) => { const g = d.pessoa || '_'; (porPessoa[g] = porPessoa[g] || []).push(d.token); });
      for (const g of Object.keys(porPessoa)) {
        const body = g === '_' ? r.n + ': resultado lançado. ' + lt : 'Você fez ' + plural(pontos(r, g), 'ponto', 'pontos') + ' no ' + r.n + '. ' + lt;
        await enviar(porPessoa[g], { title: '🏁 Resultado lançado', body }, 'res ' + r.id + ' ' + g);
      }
      await marcar([k]);
    }
  }
  // 3) lembretes de palpite (15h e 8h: so quem nao enviou nada ("Falta seu palpite") ou salvou incompleto ("Seu palpite esta incompleto");
  //    1h: TODOS que ativaram, inclusive quem ja esta completo)
  const abertas = races.map((r, i) => [r, i]).filter(([r]) => !r.palpitesEncerrados && r.st !== 'x');
  if (abertas.length) {
    const rounds = await calendario(y, agendaDir);
    if (!rounds) log('Sem calendario: lembretes pulados.');
    else {
      const cfg = await db.doc('config/geral').get();
      const auto = cfg.exists && cfg.data().autoEncerrar === true;
      for (const [r, i] of abertas) {
        const x = casar(rounds, races, i); const t = x && primeiroTreino(x); if (!t) continue;
        const dt = t - agora; if (dt <= 0) continue;
        for (const L of LEMB) {
          if (!(dt <= L.h * H && dt > L.h * H - L.tol)) continue;
          const picksDe = {};
          (await db.collection('temporadas/' + y + '/corridas/' + r.id + '/palpites').get()).docs.forEach((d) => { picksDe[d.id] = (d.data() || {}).picks || []; });
          const alvo = {};
          for (const d of com(L.k)) { if (!d.pessoa || enviados[chave('lem', L.k, y, r.id, d.pessoa)]) continue; (alvo[d.pessoa] = alvo[d.pessoa] || []).push(d.token); }
          for (const pid of Object.keys(alvo)) {
            const vazias = vazio(picksDe[pid]);
            const completo = !!picksDe[pid] && vazias.length === 0;
            if (completo && L.h !== 1) continue; // 15h e 8h: quem esta completo nao recebe
            const inc = !!picksDe[pid] && vazias.length > 0 && vazias.length < 6; // salvou, mas faltam posicoes
            const resto = textoRestante(dt);
            const fecha = auto ? quandoAs(new Date(t.getTime() - 5 * 6e4), agora) : null; // hora do encerramento automatico
            let title, body;
            if (completo) {
              title = '⏰ Última chamada';
              body = r.n + ': seu palpite está completo ✔. ' + (fecha ? 'Os palpites encerram ' + fecha + '.' : 'O 1º treino começa em ' + resto + '.');
            } else if (!inc) {
              title = L.h === 1 ? '⏰ Última chamada' : '⏰ Falta seu palpite';
              body = L.h === 1 ? r.n + ': o 1º treino começa em ' + resto + '.' + (fecha ? ' Palpites encerram ' + fecha + '.' : '') : r.n + ': o 1º treino é em ' + resto + ' (' + quando(t, agora) + ').';
            } else {
              title = L.h === 1 ? '⏰ Última chamada' : '⏰ Seu palpite está incompleto';
              body = L.h === 1 ? r.n + ': ' + faltaTexto(vazias) + '. O 1º treino começa em ' + resto + '.' + (fecha ? ' Palpites encerram ' + fecha + '.' : '') : r.n + ': ' + faltaTexto(vazias) + '. O 1º treino é em ' + resto + ' (' + quando(t, agora) + ').';
            }
            await enviar(alvo[pid], { title, body }, L.k + ' ' + r.id + ' ' + pid + (completo ? ' completo' : inc ? ' incompleto' : ''));
            await marcar([chave('lem', L.k, y, r.id, pid)]);
          }
        }
      }
    }
  }
  return saida;
}

// Notificacao de teste. alvo: p1..p4, admin, varios separados por virgula (p2,p3) ou "todos". mensagem: texto livre opcional.
async function teste({ db, messaging, simular, alvo, mensagem }) {
  const lista = String(alvo || 'admin').split(',').map((x) => x.trim()).filter(Boolean);
  const todos = lista.includes('todos');
  const devs = (await db.collection('dispositivos').get()).docs.map((d) => d.data()).filter((d) => todos || (d.pessoa ? lista.includes(d.pessoa) : lista.includes('admin')));
  const tokens = devs.map((d) => d.token);
  const msg = (mensagem || '').trim();
  const notification = msg ? { title: '💸 Bolão F1', body: msg } : { title: '🔔 Teste do Bolão', body: 'Se você está lendo isto, as notificações funcionam neste aparelho.' };
  log2('Destino: ' + lista.join(', ') + ' | aparelhos encontrados: ' + tokens.length + ' | texto: ' + notification.body);
  if (tokens.length && !simular) {
    const r = await messaging.sendEachForMulticast({ tokens, notification, data: { url: SITE }, webpush: { fcmOptions: { link: SITE }, notification: { icon: SITE + 'icon.png' } } });
    log2('Enviadas: ' + r.successCount + ' ok, ' + r.failureCount + ' com erro');
    r.responses.forEach((x) => { if (x.error) log2('  erro: ' + x.error.code); });
  }
  return { tokens, notification };
}

async function main() {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getMessaging } = require('firebase-admin/messaging');
  const emu = !!process.env.FIRESTORE_EMULATOR_HOST;
  initializeApp(emu ? { projectId: 'bolao-f1-d42ac' } : { credential: cert(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))) });
  const db = getFirestore(), messaging = emu ? null : getMessaging();
  const agora = process.env.AGORA ? new Date(process.env.AGORA) : new Date();
  const simular = !!process.env.SIMULAR || emu;
  if (process.argv[2] === 'teste') { await teste({ db, messaging, simular, alvo: process.argv[3], mensagem: process.env.MENSAGEM }); return; }
  await rodar({ db, messaging, agora, simular, agendaDir: process.env.AGENDA_DIR });
}
const log2 = (s) => console.log(s);
module.exports = { rodar, casar, primeiroTreino, calendario, teste, faltaTexto, vazio, avisarEncerrados, criarEnviar, reservar, chave, quandoAs };
if (require.main === module) main().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
