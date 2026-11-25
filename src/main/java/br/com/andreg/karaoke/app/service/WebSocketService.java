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
        sessoes.stream().filter(ctx -> ctx.session.isOpen()).forEach(sessao -> {
            try {
                sessao.send(status);
            } catch (Exception e) {
                // Ignora se der erro ao enviar para um cliente específico
            }
        });
    }

    public void iniciarKeepAlive() {
        keepAliveScheduler.scheduleAtFixedRate(() -> {
            sessoes.stream().filter(ctx -> ctx.session.isOpen()).forEach(sessao -> {
                try {
                    sessao.send("ping");
                } catch (Exception e) {
                    sessoes.remove(sessao);
                }
            });
        }, 15, 15, TimeUnit.SECONDS);
    }

    public void pararKeepAlive() {
        keepAliveScheduler.shutdownNow();
    }
}
