// Vigia continuo dos avisos: fica LIGADO (ate ~5h30) observando o banco em tempo real e manda os avisos em ~1 minuto, em vez de esperar
// o agendador do GitHub (que tem atrasado 26 a 46 min). Usa exatamente a mesma rotina de avisos/enviar.js (rodar), entao mensagens, regras
// e a trava contra aviso repetido sao as mesmas. O robo de 10 em 10 minutos (avisos.yml) continua existindo como reserva.
//
// Quando liga: so de quinta 00:00 a segunda 12:00 (horario de Brasilia), nos fins de semana de corrida. Fora disso encerra na hora.
// Uso: node avisos/vigia.js   (VIGIA_SEMPRE=1 ignora a janela, SIMULAR=1 nao envia)
const fs = require('fs');
const { rodar } = require('./enviar.js');

const MIN = 6e4, BRT = -3 * 60 * MIN;                 // Brasilia = UTC-3 (sem horario de verao)
const DURACAO = 330 * MIN;                            // 5h30 por turno (o limite do GitHub e 6h)
const TICK = 3 * MIN;                                 // conferencia periodica (lembretes de 15h/8h/1h tem folga de 45 a 60 min)
const DEBOUNCE = 4e3;                                 // junta varias gravacoes seguidas numa so conferencia

// Fim da janela de vigia em que "agora" esta (segunda 12:00 BRT), ou null se estiver fora (terca a quarta, segunda depois do meio-dia).
function fimDaJanela(agora) {
  const b = new Date(agora.getTime() + BRT), dow = b.getUTCDay(), h = b.getUTCHours();
  if (dow === 2 || dow === 3 || (dow === 1 && h >= 12)) return null;
  const dias = dow === 1 ? 0 : (8 - dow) % 7;          // dias ate a proxima segunda (quinta=4 -> 4, sexta -> 3, sabado -> 2, domingo -> 1)
  const f = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + dias, 12, 0, 0));
  return new Date(f.getTime() - BRT);
}

async function vigiar({ db, messaging, agendaDir, simular, log = console.log, agora = () => new Date(), duracao = DURACAO, tick = TICK, debounce = DEBOUNCE, sempre = false, aoRodar = () => {} }) {
  const fimJ = sempre ? null : fimDaJanela(agora());
  if (!sempre && !fimJ) { log('Fora da janela de vigia (quinta a segunda 12h): nada a fazer. O robo normal cuida dos avisos.'); return { turnos: 0 }; }
  const ts = await db.collection('temporadas').get();
  if (!ts.size) { log('Sem temporadas.'); return { turnos: 0 }; }
  const y = ts.docs.sort((a, b) => +a.id - +b.id)[ts.size - 1].id;
  const fim = Date.now() + (fimJ ? Math.min(duracao, fimJ - agora()) : duracao);
  log('Vigia ligado ate ' + new Date(fim).toISOString() + (fimJ ? ' (janela termina ' + fimJ.toISOString() + ')' : ''));

  let rodando = false, pendente = false, n = 0, timer = null;
  const conferir = async () => {
    if (rodando) { pendente = true; return; }
    rodando = true;
    try {
      do {
        pendente = false; n++;
        try { const s = await rodar({ db, messaging, agora: agora(), simular, agendaDir, log: () => {} }); s.forEach((x) => log('Enviado: ' + x.title + ' (' + x.para + ' aparelho(s))')); aoRodar(s); }
        catch (e) { log('Erro na conferencia (segue vigiando): ' + e.message); }
      } while (pendente);
    } finally { rodando = false; }
  };
  const agendar = () => { clearTimeout(timer); timer = setTimeout(conferir, debounce); };

  let primeiro = true;
  const parar1 = db.collection('temporadas/' + y + '/corridas').onSnapshot(() => { if (primeiro) { primeiro = false; return; } agendar(); }, (e) => log('Erro no observador: ' + e.message));
  const parar2 = db.doc('config/geral').onSnapshot(() => {}, () => {});
  await conferir();
  const iv = setInterval(conferir, tick);
  await new Promise((ok) => { const t = setInterval(() => { if (Date.now() >= fim) { clearInterval(t); ok(); } }, 1000); });
  clearInterval(iv); clearTimeout(timer); parar1(); parar2();
  while (rodando) await new Promise((r) => setTimeout(r, 200));
  log('Vigia encerrado apos ' + n + ' conferencia(s).');
  return { turnos: 1, conferencias: n };
}

async function main() {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getMessaging } = require('firebase-admin/messaging');
  const emu = !!process.env.FIRESTORE_EMULATOR_HOST;
  initializeApp(emu ? { projectId: 'bolao-f1-d42ac' } : { credential: cert(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))) });
  await vigiar({ db: getFirestore(), messaging: emu ? null : getMessaging(), agendaDir: process.env.AGENDA_DIR, simular: !!process.env.SIMULAR || emu, sempre: !!process.env.VIGIA_SEMPRE });
}
module.exports = { vigiar, fimDaJanela };
if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error('ERRO', e.message); process.exit(1); });
