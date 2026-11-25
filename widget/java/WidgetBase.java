package com.bolao.f1;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

/** Parte comum dos widgets do Bolão F1: atualização, tamanho ajustável e toque que abre os Palpites. */
public abstract class WidgetBase extends AppWidgetProvider {
    static final String TICK = "com.bolao.f1.WIDGET_TICK";

    abstract int layout(boolean vertical);
    abstract float escala(int w, int h, boolean vertical, WidgetDados.Gp g);
    abstract void preencher(Context c, RemoteViews v, WidgetDados.Gp g, long agora, float esc, int w, int h, boolean vertical);

    static float lim(float s) { return Math.max(0.5f, Math.min(1.9f, s)); }

    static void tam(RemoteViews v, int id, float sp) { v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, sp); }

    int[] tamanho(AppWidgetManager m, int id) {
        Bundle o = m.getAppWidgetOptions(id);
        int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        return new int[] { w > 0 ? w : 250, h > 0 ? h : 120 };
    }

    void desenhar(Context c, AppWidgetManager m, int id, boolean rede) {
        int[] t = tamanho(m, id);
        boolean vert = t[0] < 1.35f * t[1]; // mais alto que largo: título em cima e linhas embaixo
        RemoteViews v = new RemoteViews(c.getPackageName(), layout(vert));
        long agora = System.currentTimeMillis();
        WidgetDados.Gp g = null;
        try { g = WidgetDados.proximo(c, agora, rede); } catch (Exception e) { /* mostra aviso abaixo */ }
        float esc = escala(t[0], t[1], vert, g);

        // esconde partes quando o widget fica pequeno
        v.setViewVisibility(R.id.wg_left, (!vert && t[0] < 150) ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.wg_logo, (t[0] < 160 || t[1] < 90 || (!vert && t[0] < 230)) ? View.GONE : View.VISIBLE);
        float eh = Math.min(esc, 1.5f);
        tam(v, R.id.wg_titulo, 16 * eh); tam(v, R.id.wg_sub, 11 * eh); tam(v, R.id.wg_data, 12 * eh);
        try {
            if (g == null) {
                v.setTextViewText(R.id.wg_titulo, "Bolão F1");
                v.setTextViewText(R.id.wg_sub, "Abra o app");
                v.setTextViewText(R.id.wg_data, "para carregar");
            } else {
                v.setTextViewText(R.id.wg_titulo, g.nome);
                v.setTextViewText(R.id.wg_sub, "Corrida");
                v.setTextViewText(R.id.wg_data, WidgetFmt.dataHora(g.corrida));
                preencher(c, v, g, agora, esc, t[0], t[1], vert);
            }
        } catch (Exception e) { /* nunca derruba o widget */ }

        Intent i;
        if (g != null && g.rodada > 0) {
            i = new Intent(Intent.ACTION_VIEW, Uri.parse("bolaof1://palpites?round=" + g.rodada + "&y=" + g.ano));
            i.setPackage(c.getPackageName());
        } else {
            i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            if (i == null) i = new Intent();
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.wg_root, pi);
        m.updateAppWidget(id, v);
    }

    void tudo(Context c, boolean rede) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : m.getAppWidgetIds(new ComponentName(c, getClass()))) desenhar(c, m, id, rede);
    }

    PendingIntent alarme(Context c) {
        Intent i = new Intent(c, getClass()); i.setAction(TICK);
        return PendingIntent.getBroadcast(c, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    void agendar(Context c) {
        try {
            AlarmManager a = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (a != null) a.setAndAllowWhileIdle(AlarmManager.RTC, System.currentTimeMillis() + 60000, alarme(c));
        } catch (Exception e) { /* ignora */ }
    }

    @Override public void onUpdate(final Context c, final AppWidgetManager m, final int[] ids) {
        final PendingResult pr = goAsync();
        new Thread(new Runnable() { public void run() {
            try { for (int id : ids) desenhar(c, m, id, true); agendar(c); } finally { pr.finish(); }
        } }).start();
    }

    @Override public void onAppWidgetOptionsChanged(final Context c, final AppWidgetManager m, final int id, Bundle o) {
        final PendingResult pr = goAsync();
        new Thread(new Runnable() { public void run() {
            try { desenhar(c, m, id, false); } finally { pr.finish(); }
        } }).start();
    }

    @Override public void onReceive(final Context c, Intent in) {
        if (TICK.equals(in.getAction())) {
            final PendingResult pr = goAsync();
            new Thread(new Runnable() { public void run() {
                try { tudo(c, true); agendar(c); } finally { pr.finish(); }
            } }).start();
        } else super.onReceive(c, in);
    }

    @Override public void onEnabled(Context c) { agendar(c); }

    @Override public void onDisabled(Context c) {
        try { AlarmManager a = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE); if (a != null) a.cancel(alarme(c)); } catch (Exception e) { /* ignora */ }
    }
}
