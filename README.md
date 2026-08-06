# Looma Feed

Crie um dashboard estilo X (Twitter) do zero para o Looma.
Analise as imagens de referência e a logo enviadas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE VISUAL (obrigatório em tudo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fundo geral: #0A0A0A
Sidebar: #111111 | border-right: 1px solid #1F1F1F
Cards/inputs: #1A1A1A | border: 1px solid #222222
Cor de destaque: #FF6452
Texto principal: #FFFFFF
Texto secundário: #A3A3A3
Texto muted: #6B6B6B
Border-radius padrão: 12-16px em cards, 9999px em pills/botões
Sem verde, sem gradiente colorido, sem glow, sem glassmorphism

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT GERAL (3 colunas, estilo X)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- COLUNA ESQUERDA: sidebar fixa, width 240px
- COLUNA CENTRAL: feed, max-width 600px, centralizado
- COLUNA DIREITA: painel lateral, width 320px
- Em mobile: esconder colunas esquerda e direita, 
  mostrar só o feed com navbar inferior

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIDEBAR ESQUERDA (coluna 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
position: fixed | height: 100vh
background: #111111 | border-right: 1px solid #1F1F1F

TOPO:
Logo (looma-logo.png, height: 32px) + "looma"
(color: #FF6452, font-weight: 700, font-size: 22px, gap: 8px)
padding: 24px 20px | border-bottom: 1px solid #1F1F1F

NAVEGAÇÃO (ícones lucide-react):
  Home          → "Início"       → / (ATIVO)
  Search        → "Explorar"     → /explorar
  Bell          → "Notificações" → /notificacoes
  MessageCircle → "Mensagens"    → /mensagens
  Users         → "Conexões"     → /conexoes
  Briefcase     → "Marketplace"  → /marketplace
  Globe         → "Comunidades"  → /comunidades
  Settings      → "Configurações"→ /configuracoes

Estilo item INATIVO:
  color: #A3A3A3 | background: transparent
  padding: 12px 16px | border-radius: 10px
  margin: 2px 12px | font-size: 15px | font-weight: 500
  hover: background #1A1A1A | color #FFFFFF

Estilo item ATIVO:
  color: #FFFFFF | background: #FF6452

BOTÃO PUBLICAR (abaixo da nav):
  "Publicar" — width: calc(100% - 24px) | margin: 12px
  background: #FF6452 | color: #FFFFFF
  border-radius: 9999px | padding: 14px
  font-weight: 700 | font-size: 16px

RODAPÉ:
  border-top: 1px solid #1F1F1F | padding: 16px 20px
  Avatar 36px (background: #2A2A2A) +
  "Usuário" (#FFFFFF, 14px, semibold) +
  "@usuario" (#A3A3A3, 13px) +
  ícone MoreHorizontal (#A3A3A3) à direita

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEED CENTRAL (coluna 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
border-left: 1px solid #1F1F1F
border-right: 1px solid #1F1F1F

HEADER DO FEED:
  "Para você" e "Seguindo" — duas abas no topo
  Aba ativa: #FFFFFF, font-weight: 700, 
  border-bottom: 2px solid #FF6452
  Aba inativa: #A3A3A3
  padding: 16px | border-bottom: 1px solid #1F1F1F

CAIXA DE POSTAGEM:
  padding: 16px | border-bottom: 1px solid #1F1F1F
  Avatar 40px (placeholder, background: #2A2A2A) +
  textarea ao lado:
    placeholder: "O que está acontecendo?"
    background: transparent | border: none
    color: #FFFFFF | font-size: 18px
    resize: none | min-height: 80px
  
  Rodapé da caixa:
    border-top: 1px solid #1F1F1F | padding-top: 12px
    Ícones à esquerda: Image, Smile (color: #FF6452, size: 20px)
    Botão à direita: "Publicar"
      background: #FF6452 | color: #FFFFFF
      border-radius: 9999px | padding: 8px 18px
      font-weight: 700 | font-size: 15px
      desabilitado (opacity: 0.5) quando textarea vazio

POSTS MOCKADOS (3 posts de exemplo):
  Cada post:
    border-bottom: 1px solid #1F1F1F | padding: 16px
    Avatar 40px circular (placeholder #2A2A2A) +
    Nome (branco, 15px, semibold) +
    "@handle" (#A3A3A3, 14px) +
    "· 2h" (#6B6B6B, 14px)
    Texto do post (#FFFFFF, 15px, line-height: 1.5)
    Ações abaixo: 
      Comentar / Repostar / Curtir / Compartilhar
      ícones lucide-react (MessageCircle, Repeat2, Heart, Share)
      color: #6B6B6B | hover: #FF6452
      font-size: 13px | gap: 4px entre ícone e número

  POST 1:
    Nome: "Ana Costa" | @anacosta | "2h"
    Texto: "Acabei de fechar meu primeiro projeto pelo Looma 🔥 
    Encontrei um youtuber incrível em menos de 24h. 
    Isso aqui é diferente."

  POST 2:
    Nome: "Rafael Torres" | @rafaeltorres | "5h"
    Texto: "Alguém aqui trabalha com edição de vídeo para 
    canal de finanças? Preciso de alguém constante, 
    4 vídeos por semana. Me chama."

  POST 3:
    Nome: "Julia Alves" | @juliaalves | "8h"
    Texto: "Dica: preencha seu perfil completo no Looma. 
    Recebi 3 propostas em 2 dias só por ter colocado 
    meu portfólio direitinho."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLUNA DIREITA (coluna 3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
padding: 20px 16px | position: sticky | top: 0

CARD "QUEM SEGUIR":
  background: #111111 | border: 1px solid #1F1F1F
  border-radius: 16px | padding: 16px | margin-bottom: 16px
  Título: "Quem seguir" (#FFFFFF, 18px, semibold)
  
  3 sugestões de perfil:
    Avatar 40px (#2A2A2A) + Nome + @handle + 
    botão "Seguir" (border: 1px solid #FF6452, 
    color: #FF6452, background: transparent,
    border-radius: 9999px, padding: 6px 16px,
    font-size: 13px, font-weight: 600)
  
  Sugestão 1: "Lucas Mendes" | @lucasmendes | Youtuber
  Sugestão 2: "Camila Rocha" | @camilarocha | Designer
  Sugestão 3: "Diego Dev" | @diegodev | Desenvolvedor

CARD "EM ALTA":
  background: #111111 | border: 1px solid #1F1F1F
  border-radius: 16px | padding: 16px
  Título: "Em alta na Looma" (#FFFFFF, 18px, semibold)
  
  3 tópicos:
    Label (#6B6B6B, 12px) + 
    Tópico (#FFFFFF, 15px, semibold) + 
    "X publicações" (#A3A3A3, 13px)
  
  Tópico 1: "Criadores" | "#looma" | "2.4k publicações"
  Tópico 2: "Edição de vídeo" | "Dicas" | "1.8k publicações"
  Tópico 3: "Marketplace" | "Freelance" | "940 publicações"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESTRIÇÕES ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Não implemente auth ou Supabase agora — é só visual
- Não use verde em nenhum elemento
- Sem glow, sombra colorida ou gradiente
- "looma" sempre minúsculo ao lado da logo
- Não crie outras páginas além de / (feed principal)
- Os posts são mockados/estáticos por enquanto

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/142e7b1f-d89b-4a6d-af9e-fe6962cdc244).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
