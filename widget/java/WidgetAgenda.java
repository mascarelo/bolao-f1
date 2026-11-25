package com.bolao.f1;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import java.util.List;

/** Widget "Agenda": sessões do próximo GP, com a corrida em vermelho. */
public class WidgetAgenda extends WidgetBase {
    int layout() { return R.layout.widget_agenda; }

    void preencher(Context c, RemoteViews v, WidgetDados.Gp g, long agora, float esc, int w, int h) {
        int[] rl = { R.id.ar0, R.id.ar1, R.id.ar2, R.id.ar3, R.id.ar4, R.id.ar5 };
        int[] dd = { R.id.ad0, R.id.ad1, R.id.ad2, R.id.ad3, R.id.ad4, R.id.ad5 };
        int[] ww = { R.id.aw0, R.id.aw1, R.id.aw2, R.id.aw3, R.id.aw4, R.id.aw5 };
        int[] nn = { R.id.an0, R.id.an1, R.id.an2, R.id.an3, R.id.an4, R.id.an5 };
        int[] tt = { R.id.at0, R.id.at1, R.id.at2, R.id.at3, R.id.at4, R.id.at5 };
        int[] db = { R.id.adb0, R.id.adb1, R.id.adb2, R.id.adb3, R.id.adb4, R.id.adb5 };
        List<WidgetDados.Sessao> ss = g.sessoes;
        int n = Math.min(ss.size(), 6);
        int cabem = (int) Math.floor((h - 24) / (34f * esc));
        int k = Math.max(1, Math.min(n, cabem));
        int ini = ss.size() - k; // mostra as últimas (a corrida sempre aparece)
        int vermelho = c.getColor(R.color.wg_accent), texto = c.getColor(R.color.wg_text), sub = c.getColor(R.color.wg_sub);
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
            v.setTextColor(dd[i], s.corrida ? vermelho : texto);
            v.setTextColor(ww[i], s.corrida ? vermelho : sub);
            v.setTextColor(nn[i], s.corrida ? vermelho : texto);
            v.setTextColor(tt[i], s.corrida ? vermelho : sub);
            tam(v, dd[i], 15 * esc); tam(v, ww[i], 9 * esc); tam(v, nn[i], 12.5f * esc); tam(v, tt[i], 10.5f * esc);
        }
    }
}
