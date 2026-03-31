package br.com.andreg.karaoke.app.config;

import br.com.andreg.karaoke.app.model.AppConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;

public class ConfigManager {
    private static final String ARQUIVO_CONFIG = "config.json";
    private final ObjectMapper mapper = new ObjectMapper();
    private AppConfig configAtual;

    public ConfigManager() {
        carregar();
    }

    public void carregar() {
        try {
            File arquivo = new File(ARQUIVO_CONFIG);
            if (arquivo.exists()) {
                configAtual = mapper.readValue(arquivo, AppConfig.class);
                System.out.println("Configurações carregadas do arquivo.");
            } else {
                configAtual = new AppConfig();
                salvar(); // Cria o arquivo padrão
                System.out.println("Arquivo config.json criado com sucesso.");
            }
        } catch (Exception e) {
            System.err.println("Erro ao carregar configurações: " + e.getMessage());
            configAtual = new AppConfig(); // Fallback de segurança
        }
    }

    public void salvar() {
        try {
            mapper.writerWithDefaultPrettyPrinter().writeValue(new File(ARQUIVO_CONFIG), configAtual);
        } catch (Exception e) {
            System.err.println("Erro ao salvar configurações: " + e.getMessage());
        }
    }

    public AppConfig getConfig() {
        return configAtual;
    }
}