const browser = document.querySelector('#browser');
const viewport = document.querySelector('#viewport');
const closedMessage = document.querySelector('#closed-message');

document.querySelector('#minimize').addEventListener('click', () => {
  browser.hidden = true;
});

document.querySelector('#maximize').addEventListener('click', () => {
  browser.classList.toggle('maximized');
});

document.querySelector('#close').addEventListener('click', () => {
  browser.hidden = true;
  closedMessage.hidden = false;
});

document.querySelector('#reopen').addEventListener('click', () => {
  closedMessage.hidden = true;
  browser.hidden = false;
});

document.querySelector('#start').addEventListener('click', () => {
  browser.hidden = false;
  closedMessage.hidden = true;
});

document.querySelector('#home').addEventListener('click', () => {
  viewport.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelector('#refresh').addEventListener('click', (event) => {
  event.currentTarget.textContent = '✓';
  window.setTimeout(() => { event.currentTarget.textContent = '↻'; }, 700);
});

document.querySelector('#go').addEventListener('click', () => {
  document.querySelector('#latest').scrollIntoView({ behavior: 'smooth' });
});

const postList = document.querySelector('#post-list');
const postDetail = document.querySelector('#post-detail');
const loadedPosts = new Map();

function displayPostDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || 'DATA DESCONHECIDA';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}

function createPostCard(post) {
  const article = document.createElement('article');
  article.className = 'post-card';

  const cover = document.createElement('div');
  const coverStyle = ['rose', 'web', 'terminal'].includes(post.cover) ? post.cover : 'web';
  cover.className = `post-cover cover-${coverStyle}`;
  const coverMark = document.createElement('span');
  coverMark.textContent = coverStyle === 'rose' ? '♥' : coverStyle === 'terminal' ? '>_' : 'www.';
  const coverLabel = document.createElement('small');
  coverLabel.textContent = post.category;
  cover.append(coverMark, coverLabel);

  const body = document.createElement('div');
  body.className = 'post-body';
  const metadata = document.createElement('div');
  metadata.className = 'post-meta';
  metadata.textContent = `${displayPostDate(post.date)} · ${post.category} · ${post.reading_time} MIN`;

  const title = document.createElement('h2');
  const titleLink = document.createElement('a');
  titleLink.href = `#post/${encodeURIComponent(post.slug)}`;
  titleLink.textContent = post.title;
  title.append(titleLink);

  const excerpt = document.createElement('p');
  excerpt.textContent = post.excerpt;
  const readLink = document.createElement('a');
  readLink.className = 'post-link';
  readLink.href = titleLink.href;
  readLink.append(document.createTextNode('ler o post inteiro '));
  const arrow = document.createElement('b');
  arrow.textContent = '➜';
  readLink.append(arrow);

  body.append(metadata, title, excerpt, readLink);
  article.append(cover, body);
  return article;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function renderInlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|#)[^\s)]+)\)/gi, '<a href="$2" rel="noreferrer">$1</a>');
  return text;
}

function renderMarkdown(source) {
  const output = [];
  const lines = source.split(/\r?\n/);
  let paragraph = [];
  let listTag = '';
  let codeLines = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${paragraph.map(renderInlineMarkdown).join(' ')}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listTag) output.push(`</${listTag}>`);
    listTag = '';
  };
  const flushTextBlocks = () => {
    flushParagraph();
    closeList();
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushTextBlocks();
      if (inCode) {
        output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushTextBlocks();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushTextBlocks();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith('> ')) {
      flushTextBlocks();
      output.push(`<blockquote>${renderInlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextListTag = unordered ? 'ul' : 'ol';
      if (listTag !== nextListTag) {
        closeList();
        listTag = nextListTag;
        output.push(`<${listTag}>`);
      }
      output.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }
    paragraph.push(line.trim());
  }

  if (inCode) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  flushTextBlocks();
  return output.join('\n');
}

async function showPost(slug) {
  let post = loadedPosts.get(slug);
  if (!post || typeof post.body !== 'string') {
    try {
      const response = await fetch(`./posts/${encodeURIComponent(slug)}.md`, { cache: 'no-store' });
      if (!response.ok) throw new Error('post não encontrado');
      post = { ...post, body: await response.text() };
      loadedPosts.set(slug, post);
    } catch {
      document.querySelector('#post-detail-title').textContent = 'arquivo não encontrado';
      document.querySelector('#post-detail-meta').textContent = 'confira o nome do arquivo na pasta posts/';
      document.querySelector('#post-detail-body').replaceChildren();
      postList.hidden = true;
      postDetail.hidden = false;
      return;
    }
  }

  document.querySelector('#post-detail-title').textContent = post.title;
  document.querySelector('#post-detail-meta').textContent = `${displayPostDate(post.date)} · ${post.category} · ${post.reading_time} MIN`;
  document.querySelector('#post-detail-body').innerHTML = renderMarkdown(post.body);
  postList.hidden = true;
  postDetail.hidden = false;
  postDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function routePostHash() {
  const match = window.location.hash.match(/^#post\/(.+)$/);
  if (match) {
    showPost(decodeURIComponent(match[1]));
    return;
  }
  postDetail.hidden = true;
  postList.hidden = false;
}

async function loadPosts() {
  try {
    const response = await fetch('./posts-index.json', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error('posts indisponíveis');
    if (!Array.isArray(data.posts)) throw new Error('lista de posts inválida');
    const skipped = Array.isArray(data.skipped)
      ? data.skipped.map((item) => typeof item === 'string' ? item : `${item.file}: ${item.reason}`)
      : [];

    postList.replaceChildren();
    document.querySelector('#post-count').textContent = `${data.posts.length} arquivo(s) markdown carregado(s)`;
    data.posts.forEach((post) => {
      loadedPosts.set(post.slug, post);
      postList.append(createPostCard(post));
    });
    if (!data.posts.length) {
      const empty = document.createElement('p');
      empty.className = 'posts-status';
      empty.textContent = skipped.length
        ? `nenhum post válido; confira os arquivos: ${skipped.join('; ')}`
        : 'nenhum post ainda. adicione um arquivo .md na pasta posts/.';
      postList.append(empty);
    }
    if (skipped.length && data.posts.length) {
      const warning = document.createElement('p');
      warning.className = 'posts-status';
      warning.textContent = `${skipped.length} arquivo(s) não carregado(s): ${skipped.join('; ')}. Os outros posts continuam disponíveis.`;
      postList.append(warning);
    }
    routePostHash();
  } catch {
    postList.replaceChildren();
    const status = document.createElement('p');
    status.className = 'posts-status';
    status.textContent = 'não foi possível carregar o índice de posts. Rode npm run dev ou abra o site publicado.';
    postList.append(status);
  }
}

window.addEventListener('hashchange', routePostHash);
document.querySelector('#post-back').addEventListener('click', () => {
  window.location.hash = 'posts';
});
loadPosts();

const clock = document.querySelector('#clock');
const updateClock = () => {
  clock.textContent = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
};
updateClock();
window.setInterval(updateClock, 30_000);

