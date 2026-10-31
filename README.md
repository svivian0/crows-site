# Crows Blog

Blog pessoal retro/cyberpunk, sem banco de dados e sem dependências de instalação. Os posts são arquivos Markdown mantidos no GitHub.

## Adicionar um post

Crie um arquivo em `posts/` com nome único, em minúsculas e separado por hífens, por exemplo `2026-11-01-meu-novo-post.md`:

```md
---
title: Meu novo post
date: 2026-11-01
category: DIÁRIO
reading_time: 3
cover: terminal
excerpt: Uma frase curta para o cartão do post.
---

O texto começa aqui. Separe os parágrafos com uma linha em branco.

Use **negrito**, *itálico*, títulos, listas, blocos de citação, links e blocos de código.
```

Os campos `title` e `date` são obrigatórios. `category`, `reading_time`, `cover` e `excerpt` são opcionais. Capas disponíveis: `rose`, `web` e `terminal`. Sem `excerpt`, o cartão usa o primeiro parágrafo. Um arquivo com erro é ignorado sem esconder os demais; a saída do build mostra o nome e o motivo.

## Abrir localmente

Com Python 3.9 ou superior, dentro da pasta do projeto, rode:

```sh
python3 server.py
```

Abra <http://127.0.0.1:8000>. Este servidor só entrega a página e lê os arquivos `.md`; não conecta a banco de dados. A lista é lida diretamente de `posts/` a cada atualização.

Para gerar os arquivos estáticos da publicação, rode `npm run build` com Node.js 20 ou superior. O GitHub Actions faz isso automaticamente durante a publicação.

## Publicação pelo GitHub

O workflow `.github/workflows/pages.yml` reconstrói e publica o site no GitHub Pages sempre que um `.md` novo ou alterado for enviado para `main`. Na primeira publicação, em **Settings → Pages → Build and deployment**, selecione **GitHub Actions** como fonte. Depois disso, basta adicionar ou editar arquivos em `posts/`; o workflow publica a versão atualizada.

O contador de visitas é local no navegador. Os recados anônimos e a integração com banco de dados foram removidos.
