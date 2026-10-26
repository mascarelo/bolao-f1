// Sincroniza os pilotos da temporada atual com a CLASSIFICACAO oficial (Jolpica). So ACRESCENTA: nunca remove nem renomeia.
// - Casa pelo codigo fixo do piloto (campo "c"). Na primeira vez, casa pelo nome (sem acento/maiuscula; "Kimi Antonelli" casa com
//   "Andrea Kimi Antonelli") e grava o codigo, mantendo o nome que o bolao ja usa nos palpites.
// - Piloto realmente novo entra com o nome oficial e fica registrado em config/pilotos (aviso em Configuracoes do app).
// - Desligavel pelo app: config/geral.pilotosAuto = false.
const MIN = 6e4, SP = 'Sem palpites', INTERVALO = 50 * MIN;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.']/g, '').replace(/-/g, ' ').split(/\s+/).filter((t) => t && !['jr', 'sr'].includes(t));
const casa = (a, b) => { const x = norm(a), y = norm(b); return x.length && y.length && (x.every((t) => y.includes(t)) || y.every((t) => x.includes(t))); };

async function buscarClassificacao(y) {
  const r = await fetch('https://api.jolpi.ca/ergast/f1/' + y + '/driverstandings.json?limit=100');
  if (!r.ok) throw new Error('Jolpica ' + r.status);
  const l = (((await r.json()).MRData.StandingsTable.StandingsLists || [])[0] || {}).DriverStandings || [];
  return l.map((x) => { const c = (x.Constructors || []).slice(-1)[0] || {}; return { id: x.Driver.driverId, nome: x.Driver.givenName + ' ' + x.Driver.familyName, cid: c.constructorId, cn: c.name || '' }; });
}

async function sincronizar({ db, buscar = buscarClassificacao, agora = new Date(), simular = false, forcar = false, log = console.log }) {
  const cfg = await db.doc('config/geral').get();
  if (cfg.exists && cfg.data().pilotosAuto === false) { log('Pilotos: sincronizacao desligada.'); return { pulado: 'desligado' }; }
  const pilRef = db.doc('config/pilotos'), pil = await pilRef.get(), pd = pil.exists ? pil.data() : {};
  if (!forcar && pd.sync && agora - new Date(pd.sync) < INTERVALO) return { pulado: 'recente' };
  const ts = await db.collection('temporadas').get();
  if (!ts.size) return { pulado: 'sem temporada' };
  const sd = ts.docs.sort((a, b) => +a.id - +b.id)[ts.size - 1], y = sd.id, ref = db.doc('temporadas/' + y);
  const api = await buscar(y);
  if (!api.length) { log('Pilotos: classificacao oficial ainda vazia.'); return { pulado: 'sem classificacao' }; }
  const adicionados = [], codigos = [], avisos = [];
  const lista = await db.runTransaction(async (tx) => {
    adicionados.length = 0; codigos.length = 0; avisos.length = 0;
    const doc = await tx.get(ref), drivers = (doc.data().drivers || []).map((d) => ({ ...d })), meus = drivers.filter((d) => d.n !== SP);
    const jaTem = (e) => meus.find((d) => d.c === e.id);
    // 1) codigos: pilotos sem codigo que casam, sem ambiguidade, com um piloto oficial ainda sem dono
    api.forEach((e) => {
      if (jaTem(e)) return;
      const cand = meus.filter((d) => !d.c && casa(d.n, e.nome));
      const outros = api.filter((o) => o.id !== e.id && !jaTem(o) && cand.some((d) => casa(d.n, o.nome)));
      if (cand.length === 1 && !outros.length) { cand[0].c = e.id; codigos.push(cand[0].n + ' = ' + e.id); }
      else if (cand.length) avisos.push('ambiguo: ' + e.nome + ' ~ ' + cand.map((d) => d.n).join(' | '));
    });
    // 2) novos: ninguem tem o codigo e nenhum piloto do app (mesmo sem codigo) casa com o nome
    const equipe = {}; meus.forEach((d) => { const e = api.find((o) => o.id === d.c); if (e && e.cid && d.t && !equipe[e.cid]) equipe[e.cid] = d.t; });
    api.forEach((e) => {
      if (jaTem(e)) return;
      if (meus.some((d) => casa(d.n, e.nome))) return;
      const novo = { n: e.nome, t: equipe[e.cid] || e.cn || 'Equipe', c: e.id };
      const iSP = drivers.findIndex((d) => d.n === SP); if (iSP >= 0) drivers.splice(iSP, 0, novo); else drivers.push(novo);
      meus.push(novo); adicionados.push(novo);
    });
    if ((adicionados.length || codigos.length) && !simular) tx.update(ref, { drivers });
    return drivers;
  });
  const novos = (Array.isArray(pd.novos) ? pd.novos : []).concat(adicionados.map((d) => ({ n: d.n, t: d.t, c: d.c, y: +y, em: agora.toISOString() })));
  if (!simular) await pilRef.set({ sync: agora.toISOString(), total: lista.filter((d) => d.n !== SP).length, novos }, { merge: true });
  codigos.forEach((c) => log('Pilotos: codigo gravado ' + c));
  adicionados.forEach((d) => log('Pilotos: NOVO ' + d.n + ' (' + d.t + ')'));
  avisos.forEach((a) => log('Pilotos: ' + a + ' (nada feito)'));
  return { y, adicionados, codigos, avisos };
}
module.exports = { sincronizar, buscarClassificacao, casa, norm };
