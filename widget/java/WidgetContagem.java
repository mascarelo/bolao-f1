package com.bolao.f1;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/** Widget "Contagem regressiva": dias, horas e minutos até a corrida. */
public class WidgetContagem extends WidgetBase {
    int layout(boolean vert) { return vert ? R.layout.widget_contagem_v : R.layout.widget_contagem; }

    float escala(int w, int h, boolean vert, WidgetDados.Gp g) {
        float eh, ew;
        if (vert) { eh = (h - 24) / 120f; ew = (w - 24) / 150f; }
        else { eh = (h - 24) / 140f; ew = (0.58f * (w - 24) - 8) / 106f; }
        return lim(Math.min(eh, ew));
    }

    private static String dois(long x) { return x < 10 ? "0" + x : String.valueOf(x); }

    void preencher(Context c, RemoteViews v, WidgetDados.Gp g, long agora, float esc, int w, int h, boolean vert) {
        long falta = Math.max(0, g.corrida - agora) / 60000L; // minutos
        long d = falta / 1440, hh = (falta % 1440) / 60, m = falta % 60;
        boolean agoraRolando = g.corrida <= agora;
        if (agoraRolando) v.setTextViewText(R.id.wg_sub, "Acontecendo agora");
        boolean compacto = h < 100;
        int[] nums = { R.id.cnd, R.id.cnh, R.id.cnm }, uns = { R.id.cud, R.id.cuh, R.id.cum }, rows = { R.id.crd, R.id.crh, R.id.crm };
        long[] val = { d, hh, m };
        String[][] un = { { "dia", "dias" }, { "hora", "horas" }, { "minuto", "minutos" } };
        // com pouca altura, mostra só as duas maiores unidades que ainda importam
        for (int i = 0; i < 3; i++) {
            v.setViewVisibility(rows[i], View.VISIBLE);
            v.setTextViewText(nums[i], dois(val[i]));
            v.setTextViewText(uns[i], val[i] == 1 ? un[i][0] : un[i][1]);
            tam(v, nums[i], (compacto ? 26 : 38) * esc); tam(v, uns[i], (compacto ? 11 : 15) * esc);
        }
        if (compacto) v.setViewVisibility(rows[0], d > 0 ? View.VISIBLE : View.GONE);
    }
}
