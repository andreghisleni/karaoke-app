package br.com.andreg.karaoke.app.service;

import io.javalin.websocket.WsContext;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class WebSocketService {
    
    // Guarda toda a gente que está ligada (telemóveis, PCs, etc)
    private final Set<WsContext> sessoes = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService keepAliveScheduler = Executors.newSingleThreadScheduledExecutor();

    public void adicionarSessao(WsContext ctx) {
        sessoes.add(ctx);
    }

    public void removerSessao(WsContext ctx) {
        sessoes.remove(ctx);
    }

    // Envia o estado atual do player para toda a gente conectada
    public void fazerBroadcast(Object status) {
        // Celular que sai da rede nem sempre manda close: se o send falha, a sessão sai
        // agora em vez de ficar pesando no broadcast a noite inteira.
        for (WsContext sessao : new java.util.ArrayList<>(sessoes)) {
            try {
                if (sessao.session.isOpen()) sessao.send(status);
                else sessoes.remove(sessao);
            } catch (Exception e) {
                sessoes.remove(sessao);
            }
        }
    }

    public void iniciarKeepAlive() {
        keepAliveScheduler.scheduleAtFixedRate(() -> {
            // Faxina igual ao broadcast: celular que cai da rede nem sempre manda close, e sem
            // isto o keepalive só deixa a sessão morta parada no set para sempre.
            for (WsContext sessao : new java.util.ArrayList<>(sessoes)) {
                try {
                    if (sessao.session.isOpen()) sessao.send("ping");
                    else sessoes.remove(sessao);
                } catch (Exception e) {
                    sessoes.remove(sessao);
                }
            }
        }, 15, 15, TimeUnit.SECONDS);
    }

    public void pararKeepAlive() {
        keepAliveScheduler.shutdownNow();
    }
}
