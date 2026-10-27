# 🏁 Bolão F1 by Mascarelo

Bolão de palpites de Fórmula 1 entre amigos. Cada um palpita o grid de cada corrida, o resultado oficial é lançado e o ranking da temporada se atualiza sozinho.

**🌐 Acesse:** https://mascarelo.github.io/bolao-f1/
**📱 App Android:** baixe o `.apk` mais recente em [Releases](https://github.com/mascarelo/bolao-f1/releases/latest)

---

## ✨ O que o bolão faz

- 🏆 **Ranking da temporada**, com pódio, pontos por corrida e evolução (pontos ou posição ao longo do ano)
- 🎯 **Palpites** de Pole e dos 5 primeiros colocados, corrida a corrida
- 🔒 **Encerramento automático** dos palpites no horário da corrida; depois disso todos podem ver o que cada um apostou
- 🔔 **Notificações**: lembretes 15h, 8h e 1h antes, aviso de palpites encerrados e de resultado lançado
- 🧪 **Simulador**: teste "e se o piloto X vencer?" e veja como ficaria o ranking
- 🌍 **Mundial F1**: classificação oficial de pilotos e construtores
- 🔄 **Calendário e pilotos atualizados automaticamente** a cada temporada
- 👥 Cada participante tem **login e senha** próprios
- ⚙️ Telas de **Configurações, Notificações, Sobre e Trocar senha**
- 🌗 Modo claro e escuro, layout adaptado a qualquer tamanho de tela

## 📊 Regras de pontuação

| Posição | Pontos |
|---|---|
| Pole | 5 |
| 1º | 25 |
| 2º | 18 |
| 3º | 15 |
| 4º | 12 |
| 5º | 10 |

Pontua somente quem acertar a **posição exata**. Corrida cancelada não vale pontos.

## 📲 Instalando no celular

**Android (app):** abra o link de [Releases](https://github.com/mascarelo/bolao-f1/releases/latest), baixe o `.apk` e instale (o Android pede para permitir a instalação de fontes desconhecidas na primeira vez). Depois disso, as atualizações chegam **dentro do próprio app**: aparece um aviso no Ranking com o botão **Atualizar agora**.

**Qualquer aparelho (site):** abra o endereço acima. No Chrome, use **⋮ → Adicionar à tela inicial** para virar um atalho.

## 🧱 Como funciona por dentro

| Peça | Tecnologia |
|---|---|
| Site e app | Um único `index.html` (JavaScript puro, sem framework) |
| App Android | [Capacitor](https://capacitorjs.com/), gerado pela Action **Gerar APK** |
| Banco de dados e login | Firebase (Firestore + Authentication) |
| Notificações | Firebase Cloud Messaging |
| Hospedagem | GitHub Pages |
| Automações | GitHub Actions (avisos, encerramento, vigia de resultado, sincronização de pilotos, backup, testes) |

### 📁 Arquivos principais

| Arquivo / pasta | Para que serve |
|---|---|
| `index.html` | O bolão inteiro (site + app) |
| `.github/workflows/` | Automações: gerar APK, enviar avisos, fechar palpites, vigia, backup |
| `avisos/` | Scripts que enviam as notificações e atualizam pilotos/resultados |
| `capacitor.config.json` | Configuração do app Android |
| `manifest.webmanifest`, `icon.png` | Ícone e instalação como app web |

## 🚀 Publicando uma nova versão

1. Suba o novo `index.html` na raiz do repositório (**Add file → Upload files → Commit changes**).
2. Aguarde a Action **Gerar APK** ficar verde na aba **Actions**.
3. Pronto: o site já está atualizado e o app mostra o aviso **Atualizar agora**.

Cada versão do app é uma release com tag `apk-N`; o número aparece em **Configurações → Sobre**.

## 🔐 Segurança

Chaves e senhas ficam em **Secrets** do GitHub, nunca no código. Qualquer pessoa pode ver o site, mas só os participantes logados enviam palpites e só o administrador lança resultados.

---

Feito para a diversão do grupo 🏎️💨 — **Thiago, João, Lucas e Caio**.
