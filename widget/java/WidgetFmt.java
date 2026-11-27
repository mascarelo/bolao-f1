package com.bolao.f1;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Datas e horas no fuso do aparelho, em português e 24 h. */
public class WidgetFmt {
    static final Locale PT = new Locale("pt", "BR");

    private static String limpa(String s) { return s.replace(".", "").trim(); }

    static String dataHora(long t) { return limpa(new SimpleDateFormat("d MMM", PT).format(new Date(t))) + " · " + new SimpleDateFormat("HH:mm", PT).format(new Date(t)); }
    static String dia(long t) { return new SimpleDateFormat("d", PT).format(new Date(t)); }
    static String semana(long t) { return limpa(new SimpleDateFormat("EEE", PT).format(new Date(t))).toLowerCase(PT); }
    static String chave(long t) { return new SimpleDateFormat("yyyyMMdd", PT).format(new Date(t)); }
    static String hora(long t) { return new SimpleDateFormat("HH:mm", PT).format(new Date(t)); }

    /** Tempo que falta, igual ao app: "em 27 min", "em 2h", "em 3 dias" (versão curta sem o "em"); "agora" se já começou. */
    static String eta(long ms, boolean longo) {
        long m = Math.round(ms / 60000.0);
        String s;
        if (m <= 0) return "agora";
        if (m < 60) s = m + " min"; else if (m < 2880) s = Math.round(m / 60.0) + "h"; else s = Math.round(m / 1440.0) + " dias";
        return longo ? "em " + s : s;
    }
}
