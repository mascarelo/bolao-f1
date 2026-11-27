package com.bolao.f1;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import java.util.List;

/** Widget "Agenda": sessões do próximo GP, com a corrida em vermelho. */
public class WidgetAgenda extends WidgetBase {
    int layout(boolean vert) { return vert ? R.layout.widget_agenda_v : R.layout.widget_agenda; }

    /** Quantas linhas cabem com letra confortável (nunca menos que 2). */
    static int linhas(int w, int h, boolean vert, int n) {
        float util = h - 24, linha = 32f, topo = vert ? 44f : 0f;
        int k = (int) Math.floor((util / 0.78f - topo) / linha);
        return Math.max(Math.min(2, n), Math.min(n, Math.min(6, k)));
    }

    float escala(int w, int h, boolean vert, WidgetDados.Gp g) {
        int n = g == null ? 5 : Math.min(g.sessoes.size(), 6);
        int k = linhas(w, h, vert, n);
        float eh = (h - 24) / ((vert ? 44f : 0f) + 32f * k);
        float ew = vert ? (w - 64) / 94f : (w - 24) / 190f;
        return lim(Math.min(eh, ew));
    }

    void preencher(Context c, RemoteViews v, WidgetDados.Gp g, long agora, float esc, int w, int h, boolean vert) {
        int[] rl = { R.id.ar0, R.id.ar1, R.id.ar2, R.id.ar3, R.id.ar4, R.id.ar5 };
        int[] dd = { R.id.ad0, R.id.ad1, R.id.ad2, R.id.ad3, R.id.ad4, R.id.ad5 };
        int[] ww = { R.id.aw0, R.id.aw1, R.id.aw2, R.id.aw3, R.id.aw4, R.id.aw5 };
        int[] nn = { R.id.an0, R.id.an1, R.id.an2, R.id.an3, R.id.an4, R.id.an5 };
        int[] tt = { R.id.at0, R.id.at1, R.id.at2, R.id.at3, R.id.at4, R.id.at5 };
        int[] db = { R.id.adb0, R.id.adb1, R.id.adb2, R.id.adb3, R.id.adb4, R.id.adb5 };
        List<WidgetDados.Sessao> ss = g.sessoes;
        int n = Math.min(ss.size(), 6);
        int k = linhas(w, h, vert, n);
        int ini = ss.size() - k; // mostra as últimas (a corrida sempre aparece)
        int vermelho = c.getColor(R.color.wg_accent), texto = c.getColor(R.color.wg_text), sub = c.getColor(R.color.wg_sub);
        int[] gg = { R.id.ag0, R.id.ag1, R.id.ag2, R.id.ag3, R.id.ag4, R.id.ag5 };
        int verde = c.getColor(R.color.wg_ok);
        int nx = -1; // próxima sessão: a primeira que ainda não passou de 1 h do início (igual à lista do app)
        for (int q = 0; q < ss.size(); q++) if (ss.get(q).t + 3600000L > agora) { nx = q; break; }
        String anterior = "";
        for (int i = 0; i < 6; i++) {
            if (i >= k) { v.setViewVisibility(rl[i], View.GONE); continue; }
            WidgetDados.Sessao s = ss.get(ini + i);
            v.setViewVisibility(rl[i], View.VISIBLE);
            String ch = WidgetFmt.chave(s.t);
            boolean novoDia = !ch.equals(anterior); anterior = ch;
            v.setViewVisibility(db[i], View.VISIBLE);
            v.setTextViewText(dd[i], novoDia ? WidgetFmt.dia(s.t) : "");
            v.setTextViewText(ww[i], novoDia ? WidgetFmt.semana(s.t) : "");
            v.setTextViewText(nn[i], s.nome);
            long fim = s.t + (s.corrida ? 2L * 3600000 : 3600000);
            v.setTextViewText(tt[i], WidgetFmt.hora(s.t) + " – " + WidgetFmt.hora(fim));
            boolean passou = s.t + 3600000L <= agora, proxima = (ini + i) == nx;
            v.setTextColor(dd[i], ((s.corrida ? vermelho : texto) & 0x00FFFFFF) | (passou ? 0x80000000 : 0xFF000000));
            v.setTextColor(ww[i], ((s.corrida ? vermelho : sub) & 0x00FFFFFF) | (passou ? 0x80000000 : 0xFF000000));
            v.setTextColor(nn[i], ((s.corrida ? vermelho : texto) & 0x00FFFFFF) | (passou ? 0x80000000 : 0xFF000000));
            v.setTextColor(tt[i], ((s.corrida ? vermelho : sub) & 0x00FFFFFF) | (passou ? 0x80000000 : 0xFF000000));
            v.setInt(rl[i], "setBackgroundResource", proxima ? R.drawable.widget_next_bg : 0);
            if (passou) { v.setTextColor(gg[i], verde); v.setTextViewText(gg[i], vert ? "✓ concluído" : "✓"); v.setViewVisibility(gg[i], View.VISIBLE); }
            else if (proxima) { v.setTextColor(gg[i], vermelho); v.setTextViewText(gg[i], WidgetFmt.eta(s.t - agora, vert)); v.setViewVisibility(gg[i], View.VISIBLE); }
            else v.setViewVisibility(gg[i], View.GONE);
            tam(v, gg[i], 10 * Math.min(esc, 1.5f));
            tam(v, dd[i], 15 * esc); tam(v, ww[i], 9 * esc); tam(v, nn[i], 12.5f * esc); tam(v, tt[i], 10.5f * esc);
        }
    }
}
