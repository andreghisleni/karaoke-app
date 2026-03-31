🎤 Professional Karaoke System
Sistema de Karaokê de alta performance desenvolvido para ambientes Linux, focado em estabilidade, fidelidade visual e integração com hardware de áudio e vídeo profissional. O sistema permite o controle total via dispositivos móveis e transmissão de sinal via rede.

🚀 Diferenciais Técnicos
Motor Híbrido de Vídeo: Utiliza a robustez da libVLC para decodificação de hardware, com interceptação de frames em tempo real para transmissão via protocolo NDI.

Interface Web Responsiva: Dashboard moderno para smartphones e tablets (React + TanStack Router), permitindo que os convidados busquem músicas e acompanhem a fila sem interromper a tela principal.

Sistema de Notas Dinâmico: Animações Java 2D com efeito de "roleta" de números, sincronizadas milimetricamente com efeitos sonoros de suspense extraídos automaticamente do pacote da aplicação.

Gestão de Áudio Avançada: Roteamento direto para dispositivos ALSA/USB (como mixers digitais), permitindo isolar o som do karaokê de outros sons do sistema.

Fidelidade de Cores: Processamento manual de buffers de imagem para garantir a transição perfeita entre vídeos (BGRA) e gráficos gerados pelo Java (RGBA) no sinal de saída.

🛠️ Arquitetura do Sistema
Backend: Java 22 + Javalin (Web Server & WebSockets para atualizações em tempo real).

Video Engine: vlcj para controle fino do reprodutor.

Stream de Vídeo: Devolay (NDI SDK) para integração com softwares como Resolume Arena ou OBS Studio.

Frontend: React + Vite + Tailwind CSS + Shadcn/UI.

Monitoramento: Overlay nativo do VLC (Marquee) para exibição de tempo de reprodução.

📋 Pré-requisitos (Linux)
Para o correto funcionamento das bibliotecas nativas, é necessário:

Bash
# Instalação do motor VLC e dependências de desenvolvimento
sudo apt install libvlc-dev vlc

# Certifique-se de que o NDI Runtime (libndi) está instalado no diretório de bibliotecas do sistema
📦 Empacotamento e Distribuição
O projeto é consolidado em um Fat JAR único, facilitando a portabilidade.

1. Preparação do Frontend
Bash
cd frontend
npm run build
# Os arquivos gerados em /dist devem ser movidos para src/main/resources/public
2. Geração do Executável
Bash
mvn clean package
3. Estrutura de Execução
Ao rodar o .jar, o sistema organiza automaticamente os recursos necessários:

Plaintext
.
├── sistema-karaoke.jar
├── BD.ini             # Catálogo de músicas
├── audios/            # Pasta criada automaticamente com os efeitos das notas
└── config.json        # Persistência de configurações de áudio/vídeo
🎨 Funcionalidades de Interface
Dashboard (Mobile/Web)
Busca inteligente: pesquisa por código, título, artista ou trecho da letra.

Gerenciamento de Fila: visualização em tempo real de quem são os próximos cantores.

Configurações: seleção dinâmica de placas de som e monitores físicos.

Saída de Vídeo
Modo NDI: Transmissão via rede para integração em mesas de corte ou softwares de VJ.

Modo Monitor: Execução em tela cheia (Full HD) com suporte a múltiplos monitores.

Suspense: Roleta animada que para exatamente no momento em que a nota é anunciada pelo áudio.

🤝 Autor
Desenvolvido por Andre G. – Estudante de Engenharia de Controle e Automação no IFSC.