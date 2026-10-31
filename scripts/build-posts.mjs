import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsSource = path.join(projectRoot, 'posts');
const publicRoot = path.join(projectRoot, 'public');
const postsOutput = path.join(publicRoot, 'posts');
const indexOutput = path.join(publicRoot, 'posts-index.json');
const validCovers = new Set(['rose', 'web', 'terminal']);

function parseValue(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  if (trimmed === '>' || trimmed === '|') {
    throw new Error('metadados multilinha não são suportados; mantenha cada campo em uma linha');
  }
  return trimmed;
}

function parsePost(filename, source) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0]?.trim() !== '---') throw new Error('o arquivo deve começar com ---');

  const closingLine = lines.indexOf('---', 1);
  if (closingLine < 0) throw new Error('faltou fechar os metadados com ---');

  const metadata = {};
  for (const line of lines.slice(1, closingLine)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon < 1) throw new Error(`metadado inválido: ${line}`);
    const key = line.slice(0, colon).trim().toLowerCase();
    metadata[key] = parseValue(line.slice(colon + 1));
  }

  if (!metadata.title) throw new Error('adicione title: no início do arquivo');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date ?? '')) {
    throw new Error('date deve estar no formato AAAA-MM-DD');
  }
  const date = new Date(`${metadata.date}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== metadata.date) {
    throw new Error('date não é uma data válida');
  }

  const body = lines.slice(closingLine + 1).join('\n').trim();
  const firstParagraph = body.split(/\n\s*\n/).find((paragraph) => paragraph.trim()) ?? '';
  const generatedExcerpt = firstParagraph
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_`~>#\[\]()!]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const readingTime = metadata.reading_time === undefined
    ? Math.max(1, Math.ceil(wordCount / 200))
    : Number(metadata.reading_time);

  if (!Number.isInteger(readingTime) || readingTime < 1) {
    throw new Error('reading_time deve ser um inteiro maior que zero');
  }

  const cover = metadata.cover || 'web';
  if (!validCovers.has(cover)) {
    throw new Error('cover deve ser rose, web ou terminal');
  }

  return {
    slug: filename.slice(0, -3),
    title: metadata.title,
    date: metadata.date,
    category: metadata.category || 'DIÁRIO',
    reading_time: readingTime,
    cover,
    excerpt: metadata.excerpt || generatedExcerpt,
    body,
  };
}

export async function buildPosts() {
  await mkdir(postsSource, { recursive: true });
  await mkdir(publicRoot, { recursive: true });
  await rm(postsOutput, { recursive: true, force: true });
  await mkdir(postsOutput, { recursive: true });

  const posts = [];
  const skipped = [];
  const filenames = (await readdir(postsSource)).filter((filename) => filename.endsWith('.md')).sort();

  for (const filename of filenames) {
    if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(filename)) {
      skipped.push({ file: filename, reason: 'use um nome em minúsculas, com números e hífens' });
      continue;
    }

    try {
      const source = await readFile(path.join(postsSource, filename), 'utf8');
      const { body, ...post } = parsePost(filename, source);
      await writeFile(path.join(postsOutput, filename), body, 'utf8');
      posts.push(post);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'erro desconhecido';
      skipped.push({ file: filename, reason });
    }
  }

  posts.sort((left, right) => right.date.localeCompare(left.date) || left.slug.localeCompare(right.slug));
  await writeFile(indexOutput, `${JSON.stringify({ posts, skipped }, null, 2)}\n`, 'utf8');
  console.log(`Índice gerado: ${posts.length} post(s), ${skipped.length} arquivo(s) ignorado(s).`);
  for (const item of skipped) console.warn(`Post ignorado: ${item.file} — ${item.reason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPosts();
}
