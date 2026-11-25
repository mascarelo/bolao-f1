package com.bolao.f1;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/** Calendário da F1 (Jolpica, o mesmo do app) guardado no aparelho para os widgets. */
public class WidgetDados {
    static final String PREFS = "bolao_widget";
    static final long TTL = 6L * 3600 * 1000;           // atualiza o calendário a cada 6 h
    static final long DURACAO_CORRIDA = 3L * 3600 * 1000; // depois disso o widget passa para o próximo GP

    public static class Sessao {
        public long t; public String nome; public boolean corrida;
    }

    public static class Gp {
        public String nome; public long corrida; public int ano; public int rodada; public List<Sessao> sessoes = new ArrayList<>();
    }

    private static final String[][] SESSOES = {
        {"FirstPractice", "Treino livre 1"}, {"SecondPractice", "Treino livre 2"}, {"ThirdPractice", "Treino livre 3"},
        {"SprintQualifying", "Classif. Sprint"}, {"SprintShootout", "Classif. Sprint"}, {"Sprint", "Sprint"}, {"Qualifying", "Classificação"}
    };

    private static long tempo(JSONObject o) {
        try {
            if (o == null || !o.has("date")) return 0;
            String h = o.optString("time", "12:00:00Z");
            if (!h.endsWith("Z")) h = h + "Z";
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = f.parse(o.getString("date") + "T" + h);
            return d == null ? 0 : d.getTime();
        } catch (Exception e) { return 0; }
    }

    private static String nomePt(String corrida, String local) {
        String n = (corrida == null ? "" : corrida).toLowerCase(Locale.US), l = (local == null ? "" : local).toLowerCase(Locale.US);
        String[][] m = {
            {"bahrain", "GP do Bahrein"}, {"saudi", "GP da Arábia Saudita"}, {"australia", "GP da Austrália"}, {"japan", "GP do Japão"},
            {"chin", "GP da China"}, {"miami", "GP de Miami"}, {"emilia", "GP da Emilia-Romagna"}, {"monaco", "GP de Mônaco"},
            {"canad", "GP do Canadá"}, {"austria", "GP da Áustria"}, {"british", "GP da Inglaterra"}, {"hungar", "GP da Hungria"},
            {"belg", "GP da Bélgica"}, {"dutch", "GP da Holanda"}, {"ital", "GP da Itália"}, {"azerbaijan", "GP do Azerbaijão"},
            {"singapore", "GP de Singapura"}, {"united states", "GP dos Estados Unidos"}, {"mexic", "GP do México"},
            {"são paulo", "GP de São Paulo"}, {"sao paulo", "GP de São Paulo"}, {"brazil", "GP de São Paulo"}, {"las vegas", "GP de Las Vegas"},
            {"qatar", "GP do Catar"}, {"abu dhabi", "GP de Abu Dhabi"}
        };
        if (n.contains("spanish") || n.contains("spain") || n.contains("barcelona") || n.contains("madrid")) {
            if (l.contains("madrid") || n.contains("madrid")) return "GP da Espanha (Madri)";
            if (n.contains("barcelona") || l.contains("barcelona") || l.contains("montmel")) return n.contains("barcelona") ? "GP de Barcelona-Catalunha" : "GP da Espanha";
            return "GP da Espanha";
        }
        for (String[] k : m) if (n.contains(k[0])) return k[1];
        return corrida == null ? "GP" : corrida.replace("Grand Prix", "GP").trim();
    }

    private static String baixar(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(10000); c.setReadTimeout(15000);
            c.setRequestProperty("User-Agent", "bolao-f1-widget"); c.setRequestProperty("Accept", "application/json");
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
                String ln; while ((ln = r.readLine()) != null) sb.append(ln);
            }
            return sb.toString();
        } finally { c.disconnect(); }
    }

    /** Devolve o calendário do ano (do aparelho, ou baixado se estiver velho). Nunca lança erro. */
    static synchronized JSONArray corridas(Context ctx, int ano, boolean permitirRede) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String cache = p.getString("cal" + ano, null); long quando = p.getLong("t" + ano, 0);
        boolean velho = cache == null || System.currentTimeMillis() - quando > TTL;
        if (velho && permitirRede) {
            try {
                String j = baixar("https://api.jolpi.ca/ergast/f1/" + ano + ".json?limit=100");
                JSONArray a = new JSONObject(j).getJSONObject("MRData").getJSONObject("RaceTable").getJSONArray("Races");
                if (a.length() > 0) { cache = a.toString(); p.edit().putString("cal" + ano, cache).putLong("t" + ano, System.currentTimeMillis()).apply(); }
            } catch (Exception e) { /* mantém o que já tinha */ }
        }
        try { return cache == null ? null : new JSONArray(cache); } catch (Exception e) { return null; }
    }

    private static Gp montar(JSONObject r) {
        Gp g = new Gp();
        JSONObject loc = r.optJSONObject("Circuit") == null ? null : r.optJSONObject("Circuit").optJSONObject("Location");
        g.nome = nomePt(r.optString("raceName"), loc == null ? "" : loc.optString("locality"));
        g.corrida = tempo(r);
        g.rodada = r.optInt("round", 0);
        g.ano = r.optInt("season", 0);
        for (String[] s : SESSOES) {
            long t = tempo(r.optJSONObject(s[0]));
            if (t > 0) { Sessao x = new Sessao(); x.t = t; x.nome = s[1]; g.sessoes.add(x); }
        }
        if (g.corrida > 0) { Sessao x = new Sessao(); x.t = g.corrida; x.nome = "Corrida"; x.corrida = true; g.sessoes.add(x); }
        Collections.sort(g.sessoes, new Comparator<Sessao>() { public int compare(Sessao a, Sessao b) { return Long.compare(a.t, b.t); } });
        return g;
    }

    /** O próximo GP (ou o que está acontecendo). Null se ainda não há calendário. */
    static Gp proximo(Context ctx, long agora, boolean permitirRede) {
        int ano = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR);
        for (int a = ano; a <= ano + 1; a++) {
            JSONArray rs = corridas(ctx, a, permitirRede);
            if (rs == null) continue;
            Gp melhor = null;
            for (int i = 0; i < rs.length(); i++) {
                JSONObject r = rs.optJSONObject(i); if (r == null) continue;
                Gp g = montar(r);
                if (g.corrida <= 0 || g.corrida + DURACAO_CORRIDA <= agora) continue;
                if (melhor == null || g.corrida < melhor.corrida) melhor = g;
            }
            if (melhor != null) return melhor;
        }
        return null;
    }
}
