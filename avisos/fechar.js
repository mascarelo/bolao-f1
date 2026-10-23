// Encerramento automatico dos palpites: 5 minutos antes do 1o treino (so se a chave "Encerrar palpites automaticamente" estiver ligada
// em Configuracoes do app). Roda no GitHub Actions (fechar.yml). Como o GitHub nao e pontual, quando faltam ate 120 minutos para o
// encerramento o processo FICA ESPERANDO ate o minuto certo (conferindo a cada 30 s se o admin desligou, reabriu ou encerrou antes).
//
// Uso: node avisos/fechar.js        (variaveis: GOOGLE_APPLICATION_CREDENTIALS | SIMULAR=1 so mostra o aviso, nao envia)
//
// O que faz ao encerrar e o mesmo do botao do app: marca a corrida como encerrada, copia os palpites para a corrida (ficam publicos)
// e apaga os documentos individuais. Depois manda o aviso "Palpites encerrados" na hora.
// Anotacoes em fechamentos/AAAA_ID: em = hora do encerramento (a trava das regras usa isso), feito = encerrou sozinho,
// reaberto = o admin reabriu (o automatico nao mexe mais nessa corrida).
const fs = require('fs');
const { casar, primeiroTreino, calendario, avisarEncerrados } = require('./enviar.js');

const MIN = 6e4, SP = 'Sem palpites';
const ANTES = 5 * MIN;            // encerra 5 min antes do 1o treino
const ESPERA_MAX = 120 * MIN;     // so fica esperando se faltar ate isso (o GitHub chega a passar 45 min entre execucoes)
const PASSO = 30e3;               // confere o estado a cada 30 s enquanto espera
const pad6 = (a) => { a = (a || []).slice(0, 6); while (a.length < 6) a.push(''); return a; };

async function fechar({ db, messaging, agendaDir, simular, log = console.log, agora = () => new Date(), dormir = (ms) => new Promise((r) => setTimeout(r, ms)), passo = PASSO }) {
  const { Timestamp } = require('firebase-admin/firestore');
  const saida = [];
  const ligado = async () => { const d = await db.doc('config/geral').get(); return d.exists && d.data().autoEncerrar === true; };
  if (!(await ligado())) { log('Encerramento automatico desligado.'); return saida; }

  const ts = await db.collection('temporadas').get();
  if (!ts.size) { log('Sem temporadas.'); return saida; }
  const sd = ts.docs.sort((a, b) => +a.id - +b.id)[ts.size - 1], y = sd.id, pessoas = sd.data().people || [];
  const races = (await db.collection('temporadas/' + y + '/corridas').get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.id < b.id ? -1 : 1));
  const i = races.findIndex((r) => !r.palpitesEncerrados && r.st !== 'x');
  if (i < 0) { log('Nenhuma corrida com palpites abertos.'); return saida; }
  const r = races[i];

  const rounds = await calendario(y, agendaDir);
  if (!rounds) { log('Sem calendario: nada feito.'); return saida; }
  const x = casar(rounds, races, i), tl1 = x && primeiroTreino(x);
  if (!tl1) { log('Nao achei o 1o treino de ' + r.n + ': nada feito.'); return saida; }
  if (agora() - tl1 > 2 * 24 * 60 * MIN) { log('O 1o treino de ' + r.n + ' foi ha mais de 2 dias: nada feito (encerre pelo botao).'); return saida; }
  const T = new Date(tl1.getTime() - ANTES);

  const raceRef = db.doc('temporadas/' + y + '/corridas/' + r.id), fmRef = db.doc('fechamentos/' + y + '_' + r.id);
  const f = (await fmRef.get()).data() || {};
  if (f.reaberto) { log('O admin reabriu ' + r.n + ': o automatico nao mexe mais nela.'); return saida; }
  if (f.feito) { log(r.n + ' ja foi encerrada automaticamente.'); return saida; }

  // grava a hora do encerramento (a trava das regras do Firebase usa isso)
  if (!f.em || f.em.toMillis() !== T.getTime()) { await fmRef.set({ em: Timestamp.fromDate(T) }, { merge: true }); log('Hora de encerramento gravada: ' + r.n + ' as ' + T.toISOString()); }

  if (T - agora() > ESPERA_MAX) { log('Ainda falta mais de 120 min para o encerramento de ' + r.n + ' (' + T.toISOString() + ').'); return saida; }

  // espera ate o minuto certo, conferindo se nada mudou
  while (T - agora() > 0) {
    await dormir(Math.min(passo, Math.max(T - agora(), 1)));
    if (!(await ligado())) { log('O admin desligou o encerramento automatico.'); return saida; }
    if (((await raceRef.get()).data() || {}).palpitesEncerrados) { log(r.n + ' foi encerrada antes (pelo botao).'); return saida; }
    const g = (await fmRef.get()).data() || {};
    if (g.reaberto) { log('O admin reabriu ' + r.n + '.'); return saida; }
    if (g.feito) { log(r.n + ' ja foi encerrada.'); return saida; }
  }

  // encerra (mesma coisa que o botao do app)
  await raceRef.update({ palpitesEncerrados: true });
  const pk = {}; pessoas.forEach((p) => { pk[p.id] = pad6().map(() => SP); });
  const qs = await raceRef.collection('palpites').get();
  qs.forEach((d) => { if (pk[d.id]) pk[d.id] = pad6(d.data().picks).map((v) => v || SP); });
  await raceRef.update({ pk });
  const bt = db.batch(); qs.forEach((d) => bt.delete(d.ref)); await bt.commit();
  await fmRef.set({ feito: agora().toISOString(), em: Timestamp.fromDate(T) }, { merge: true });
  log('ENCERRADO automaticamente: ' + r.n + ' (' + qs.size + ' palpite(s) copiados).');
  saida.push({ acao: 'encerrado', corrida: r.id });
  await avisarEncerrados({ db, messaging, agora: agora(), simular, log, saida });
  return saida;
}

async function main() {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getMessaging } = require('firebase-admin/messaging');
  const emu = !!process.env.FIRESTORE_EMULATOR_HOST;
  initializeApp(emu ? { projectId: 'bolao-f1-d42ac' } : { credential: cert(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))) });
  await fechar({ db: getFirestore(), messaging: emu ? null : getMessaging(), simular: !!process.env.SIMULAR || emu, agendaDir: process.env.AGENDA_DIR });
}
module.exports = { fechar };
if (require.main === module) main().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
