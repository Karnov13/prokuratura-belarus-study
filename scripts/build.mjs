import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStructure, validateContent, safeUrl } from './logic.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const sourceLink = (url, title) => safeUrl(url) ? `<a href="${esc(safeUrl(url))}">${esc(title || 'Источник')}</a>` : '';

function staticFallback(structure, content) {
  const reading = [['appeals', 'Обращение'], ['career', 'Поступление'], ['activities', 'Направления деятельности прокуратуры']].map(([key, title]) => `<section id="fallback-${key}"><h2>${title}</h2>${content[key].map(item => `<article><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p>${item.items?.length ? `<ul>${item.items.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : ''}${item.verificationStatus ? `<p class="verification-note">${esc(item.verificationStatus)}</p>` : ''}${(item.sourceIds || []).map(id => { const source = content.sources.find(source => source.id === id); return source ? sourceLink(source.url, source.title) : ''; }).join('')}</article>`).join('')}</section>`).join('');
  return `<noscript><style>#main,.main-nav,.menu-toggle{display:none}.static-fallback{width:min(1100px,calc(100% - 40px));margin:32px auto}.static-fallback section{margin:40px 0}.static-fallback article{padding:20px 0;border-bottom:1px solid #ccd5df}</style><div class="static-fallback"><h1>Учебный навигатор</h1><p class="notice">Автоматические поиск и проверка требуют JavaScript. Все материалы и решения доступны ниже.</p><nav aria-label="Разделы без JavaScript"><ul><li><a href="#fallback-structure">Структура</a></li><li><a href="#fallback-appeals">Обращение</a></li><li><a href="#fallback-career">Поступление</a></li><li><a href="#fallback-activities">Направления деятельности прокуратуры</a></li><li><a href="#fallback-interactive">Интерактивы</a></li></ul></nav><section id="fallback-structure"><h2>Структура</h2><p>Должностные лица указаны в объёме подтверждённых сведений; отсутствие имени не означает отсутствия должности.</p>${structure.offices.map(office => `<details><summary>${esc(office.name)}</summary><p>${esc(office.address || 'Адрес уточняйте в источнике.')}</p>${office.officials?.length ? `<ul>${office.officials.map(person => `<li>${esc(person.name)} — ${esc(person.position)} ${sourceLink(person.sourceUrl, 'Источник сведений')}</li>`).join('')}</ul>` : '<p>Сведения о должностных лицах не подтверждены.</p>'}${sourceLink(office.sourceUrl)}<p>Проверено: ${esc(office.checkedAt || structure.checkedAt)}</p></details>`).join('')}</section>${reading}<section id="fallback-interactive"><h2>Интерактивы</h2>${content.quiz.map(question => `<article><h3>${esc(question.question)}</h3><ol>${question.options.map(option => `<li>${esc(option)}</li>`).join('')}</ol><details><summary>Показать ответ</summary><p>Правильный ответ: ${esc(question.options[question.answerIndex])}</p><p>${esc(question.explanation)}</p></details></article>`).join('')}${[...content.riddles, ...content.rebuses].map(puzzle => `<article><h3>${esc(puzzle.prompt)}</h3><details><summary>Подсказка</summary><p>${esc(puzzle.hint)}</p></details><details><summary>Решение</summary><p>${esc(puzzle.answers[0])}</p><p>${esc(puzzle.explanation)}</p></details></article>`).join('')}</section><section><h2>Источники</h2>${content.sources.map(source => `<p>${sourceLink(source.url, source.title)}<br>${esc(source.status)} Проверено: ${esc(source.checkedAt)}</p>`).join('')}</section></div></noscript>`;
}

export async function buildSite(source, output) {
  source = resolve(source);
  output = resolve(output);
  const subpath = relative(source, output);
  if (!subpath || subpath.startsWith('..') || isAbsolute(subpath)) throw new Error('Build output must stay inside the source directory');
  const structure = validateStructure(JSON.parse(await readFile(join(source, 'data/structure.json'), 'utf8')));
  const content = validateContent(JSON.parse(await readFile(join(source, 'data/content.json'), 'utf8')));
  const html = await readFile(join(source, 'index.html'), 'utf8');
  if (!html.includes('<!-- STATIC_FALLBACK -->')) throw new Error('Static fallback marker missing');
  // Output is resolved and constrained to a child directory before removing the previous bundle.
  await rm(output, { recursive: true, force: true });
  for (const folder of ['', 'scripts', 'data', 'assets']) await mkdir(join(output, folder), { recursive: true });
  for (const file of ['styles.css', 'scripts/app.js', 'scripts/logic.js', 'data/structure.json', 'data/content.json', 'assets/academy-symbol-user-selected.png']) await copyFile(join(source, file), join(output, file));
  await writeFile(join(output, 'index.html'), html.replace('<!-- STATIC_FALLBACK -->', staticFallback(structure, content)));
  await writeFile(join(output, '.nojekyll'), '');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await buildSite(source, join(source, 'dist'));
  console.log('Website bundle created in dist/');
}
