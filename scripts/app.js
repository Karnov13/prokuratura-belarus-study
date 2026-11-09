import { routeFromHash, sectionFromHash, filterOffices, gradeQuiz, checkAnswer, safeUrl, officeDepth, validateStructure, validateContent, bindMobileMenu } from './logic.js';

const main = document.querySelector('#main');
const navigation = document.querySelector('#main-nav');
const menuToggle = document.querySelector('#menu-toggle');
const readingWideScreen = matchMedia('(min-width: 1100px)');
const titles = { structure: 'Структура', appeals: 'Обращение', career: 'Поступление', activities: 'Направления деятельности прокуратуры', interactive: 'Интерактивы' };
const levelLabels = { national: 'Республиканский уровень', regional: 'Областной уровень', district: 'Районный и городской уровень', city: 'Городской уровень', interdistrict: 'Межрайонный уровень', specialized: 'Специализированные органы', 'specialized-or-interdistrict': 'Специализированные и межрайонные органы' };
let structure;
let content;
let structureError = false;
let contentError = false;
let renderedRoute;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const paragraphs = value => String(value ?? '').split(/\n\s*\n/).filter(Boolean).map(text => `<p>${esc(text)}</p>`).join('');
const date = value => value ? esc(value.split('-').reverse().join('.')) : 'Дата проверки не указана';
function link(url, label = 'Официальный источник') {
  const href = safeUrl(url);
  return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span><span class="sr-only"> (откроется в новой вкладке)</span></a>` : '';
}
function sourcesFor(item) {
  const sources = (item.sourceIds || []).map(id => content.sources.find(source => source.id === id)).filter(Boolean);
  if (!sources.length && !item.sourceUrl) return '';
  return `<details class="source-links"><summary>Источники</summary>${sources.map(source => `<div class="source-note"><p>Источник: ${link(source.url, source.title)}</p>${source.status ? `<p>${esc(source.status)}</p>` : ''}<p>Источник просмотрен: ${date(source.checkedAt)}</p></div>`).join('')}${item.sourceUrl ? `<p>${link(item.sourceUrl)}</p>` : ''}</details>`;
}
function pageHeading(route) {
  return `<section class="page-heading" aria-labelledby="page-title"><h1 id="page-title">${titles[route]}</h1></section>`;
}
function errorState(kind) {
  return `<section class="error-state" role="alert"><h2>Не удалось загрузить ${kind}</h2><p>Проверьте подключение и повторите попытку.</p><button type="button" id="retry">Повторить загрузку</button></section>`;
}

async function loadData() {
  const results = await Promise.allSettled([
    fetch(new URL('../data/structure.json', import.meta.url)).then(response => { if (!response.ok) throw new Error(response.status); return response.json(); }).then(validateStructure),
    fetch(new URL('../data/content.json', import.meta.url)).then(response => { if (!response.ok) throw new Error(response.status); return response.json(); }).then(validateContent)
  ]);
  structureError = results[0].status === 'rejected';
  contentError = results[1].status === 'rejected';
  if (!structureError) structure = results[0].value;
  if (!contentError) content = results[1].value;
  render();
}

function renderStructure() {
  const regions = [...new Set(structure.offices.map(office => office.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  const levels = [...new Set(structure.offices.map(office => office.level).filter(Boolean))];
  main.insertAdjacentHTML('beforeend', `<section class="structure-section" aria-label="Каталог органов прокуратуры"><form id="office-filters" class="filter-bar" role="search"><label class="search-field">Поиск<input type="search" name="query" placeholder="Название, регион или фамилия" autocomplete="off"></label><label>Регион<select name="region"><option value="">Все регионы</option>${regions.map(region => `<option>${esc(region)}</option>`).join('')}</select></label><label>Уровень<select name="level"><option value="">Все уровни</option>${levels.map(level => `<option value="${esc(level)}">${esc(levelLabels[level] || level)}</option>`).join('')}</select></label><button class="text-button" type="reset">Сбросить фильтры</button></form><p id="office-count" class="result-count" role="status" aria-live="polite"></p><div class="structure-browser"><div id="office-results" class="office-tree" aria-label="Выберите орган прокуратуры"></div><div id="selected-office" class="selected-office"></div></div><details class="catalog-data"><summary>О данных каталога</summary><p>В каталоге — ${structure.offices.length} органов прокуратуры. Выберите регион, затем орган. Сведения о должностных лицах представлены в объёме подтверждённых данных; отсутствие имени не означает отсутствия должности. Актуальные контакты и состав руководства уточняйте в официальном источнике.</p><p>Источники просмотрены: ${date(structure.checkedAt)}</p></details></section>`);
  const form = main.querySelector('#office-filters');
  let selectedId = structure.offices[0]?.id;
  let currentMatches = structure.offices;
  const showOffice = (office, focus = false) => {
    if (!office) { main.querySelector('#selected-office').innerHTML = ''; return; }
    selectedId = office.id;
    main.querySelectorAll('[data-office]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.office === selectedId)));
    const parent = structure.offices.find(item => item.id === office.parentId);
    const people = office.officials?.length ? `<ul class="officials">${office.officials.map(person => `<li><strong>${esc(person.name)}</strong><span>${esc(person.position)}</span>${person.sourceUrl ? `<span class="person-source">${link(person.sourceUrl, 'Источник')}${person.checkedAt ? ` · ${date(person.checkedAt)}` : ''}</span>` : ''}</li>`).join('')}</ul>` : '<p class="missing-data">Сведения о должностных лицах не подтверждены. Уточните их на официальном сайте.</p>';
    main.querySelector('#selected-office').innerHTML = `<article class="office-card"><span class="level-label">${esc(levelLabels[office.level] || office.level)}</span><h2 tabindex="-1" id="selected-office-title">${esc(office.name)}</h2>${parent ? `<p class="parent-name">Подчинение: ${esc(parent.name)}</p>` : ''}<div class="office-content"><div><h3>Должностные лица</h3>${people}</div><div class="office-address"><h3>Контакты</h3><span>${esc(office.region)}</span><p>${office.address ? esc(office.address) : 'Адрес не подтверждён — уточните в официальном источнике.'}</p></div></div>${office.status && /[А-Яа-яЁё]/.test(office.status) ? `<p class="verification-note">${esc(office.status)}</p>` : ''}<div class="card-meta">${link(office.sourceUrl)}<span>Проверено ${date(office.checkedAt || structure.checkedAt)}</span></div></article>`;
    if (focus) main.querySelector('#selected-office-title').focus();
  };
  const choice = office => `<button type="button" class="office-choice" data-office="${esc(office.id)}" aria-pressed="${office.id === selectedId}"><span>${esc(office.name)}</span><small>${esc(levelLabels[office.level] || office.level)}</small></button>`;
  const update = () => {
    const filters = Object.fromEntries(new FormData(form));
    const result = filterOffices(structure.offices, filters);
    currentMatches = result.matches;
    if (!currentMatches.some(office => office.id === selectedId)) selectedId = currentMatches[0]?.id;
    main.querySelector('#office-count').textContent = `Найдено органов: ${result.matches.length} из ${structure.offices.length}.`;
    const groups = [...new Set(currentMatches.map(office => office.region || 'Другие органы'))];
    main.querySelector('#office-results').innerHTML = currentMatches.length ? (filters.query.trim() || filters.level
      ? currentMatches.map(choice).join('')
      : groups.map(region => {
        const group = currentMatches.filter(office => (office.region || 'Другие органы') === region).sort((a, b) => officeDepth(a, structure.offices) - officeDepth(b, structure.offices));
        const open = filters.region || group.some(office => office.id === selectedId);
        return `<details class="region-group" ${open ? 'open' : ''}><summary>${esc(region)} <span>${group.length}</span></summary>${group.map(choice).join('')}</details>`;
      }).join('')) : '<div class="empty-state"><h3>Ничего не найдено</h3><p>Попробуйте другую фамилию, сократите запрос или сбросьте фильтры.</p><button type="button" id="empty-reset">Сбросить фильтры</button></div>';
    main.querySelectorAll('[data-office]').forEach(button => button.addEventListener('click', () => showOffice(currentMatches.find(office => office.id === button.dataset.office), true)));
    showOffice(currentMatches.find(office => office.id === selectedId));
    main.querySelector('#empty-reset')?.addEventListener('click', () => { form.reset(); update(); form.elements.query.focus(); });
  };
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('reset', () => requestAnimationFrame(update));
  update();
}

function renderReading(route) {
  const items = content[route];
  main.insertAdjacentHTML('beforeend', `<section class="reading-layout" aria-label="Материалы раздела"><aside class="reading-nav" aria-label="Содержание раздела"><details class="reading-toc" ${readingWideScreen.matches ? 'open' : ''}><summary>Содержание</summary><ul>${items.map((item, index) => `<li><a href="#/${route}?section=section-${index}" data-section="section-${index}">${esc(item.title)}</a></li>`).join('')}</ul></details></aside><div class="reading-content">${route === 'appeals' ? '<p class="appeal-notice">Сайт не принимает обращения</p>' : ''}${items.map((item, index) => `<article id="section-${index}" class="reading-card"><h2>${esc(item.title)}</h2>${paragraphs(item.body)}${item.items?.length ? `<ul>${item.items.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : ''}${item.verificationStatus ? `<p class="verification-note">${esc(item.verificationStatus)}</p>` : ''}${sourcesFor(item)}</article>`).join('')}${items.length ? '' : '<p class="empty-state">Материалы этого раздела готовятся.</p>'}</div></section>`);
}

function renderInteractive() {
  main.insertAdjacentHTML('beforeend', `<section class="interactive-intro" aria-label="Виды заданий"><div class="interactive-links"><a href="#/interactive?section=quiz-block" data-jump="quiz-block">Тесты <span>${content.quiz.length} вопросов</span></a><a href="#/interactive?section=riddles-block" data-jump="riddles-block">Загадки <span>${content.riddles.length} заданий</span></a><a href="#/interactive?section=rebuses-block" data-jump="rebuses-block">Ребусы <span>${content.rebuses.length} заданий</span></a></div></section><section id="quiz-block" class="quiz-section"><div class="section-heading"><h2>Тесты</h2><span>Выберите один ответ</span></div><form id="quiz-form">${content.quiz.map((question, index) => `<fieldset class="question-card"><legend>${esc(question.question)}</legend>${question.options.map((option, optionIndex) => `<label class="answer-option"><input type="radio" name="q${index}" value="${optionIndex}" required><span>${esc(option)}</span></label>`).join('')}<div id="feedback-${index}"></div></fieldset>`).join('')}<div class="quiz-actions"><button type="submit">Проверить ответы</button><button type="reset" class="secondary-button">Пройти заново</button><p id="quiz-progress" role="status" aria-live="polite">Отвечено: 0 из ${content.quiz.length}</p></div><div id="quiz-result" class="quiz-result" aria-live="polite" tabindex="-1"></div></form></section>${renderPuzzles('riddles', 'Загадки')}${renderPuzzles('rebuses', 'Ребусы')}`);
  const form = main.querySelector('#quiz-form');
  form.addEventListener('change', () => {
    main.querySelector('#quiz-progress').textContent = `Отвечено: ${new Set([...form.querySelectorAll('input:checked')].map(input => input.name)).size} из ${content.quiz.length}`;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(form);
    const result = gradeQuiz(content.quiz, content.quiz.map((_, index) => values.has(`q${index}`) ? Number(values.get(`q${index}`)) : undefined));
    const resultElement = main.querySelector('#quiz-result');
    if (!result.complete) { resultElement.textContent = 'Ответьте на все вопросы, чтобы получить результат.'; resultElement.focus(); return; }
    resultElement.innerHTML = `<h3>Ваш результат: ${result.score} из ${result.total}</h3>`;
    content.quiz.forEach((question, index) => {
      main.querySelector(`#feedback-${index}`).innerHTML = `<div class="answer-feedback ${result.correct[index] ? 'correct' : 'incorrect'}"><strong>${result.correct[index] ? 'Верно' : 'Есть ошибка'}</strong><p>Правильный ответ: ${esc(question.options[question.answerIndex])}</p>${paragraphs(question.explanation)}${sourcesFor(question)}</div>`;
    });
    form.querySelectorAll('input').forEach(input => { input.disabled = true; });
    form.querySelector('button[type="submit"]').disabled = true;
    resultElement.focus();
  });
  form.addEventListener('reset', () => {
    form.querySelectorAll('input').forEach(input => { input.disabled = false; });
    form.querySelector('button[type="submit"]').disabled = false;
    content.quiz.forEach((_, index) => { main.querySelector(`#feedback-${index}`).innerHTML = ''; });
    main.querySelector('#quiz-result').innerHTML = '';
    main.querySelector('#quiz-progress').textContent = `Отвечено: 0 из ${content.quiz.length}`;
    requestAnimationFrame(() => form.querySelector('input')?.focus());
  });
  main.querySelectorAll('.puzzle-form').forEach(puzzleForm => puzzleForm.addEventListener('submit', event => {
    event.preventDefault();
    const puzzle = content[puzzleForm.dataset.kind][Number(puzzleForm.dataset.index)];
    const answer = new FormData(puzzleForm).get('answer');
    puzzleForm.querySelector('.puzzle-feedback').textContent = checkAnswer(answer, puzzle.answers) ? `Верно! ${puzzle.explanation || ''}` : 'Пока не совпало. Попробуйте ещё раз или откройте подсказку.';
  }));
}

function renderPuzzles(kind, title) {
  return `<section id="${kind}-block" class="puzzles-section"><div class="section-heading"><h2>${title}</h2><span>${content[kind].length} заданий</span></div><div class="puzzles-grid">${content[kind].map((puzzle, index) => `<article class="puzzle-card"><h3>${esc(puzzle.prompt)}</h3><form class="puzzle-form" data-kind="${kind}" data-index="${index}"><label for="${kind}-answer-${index}">Ваш ответ</label><div class="answer-row"><input id="${kind}-answer-${index}" name="answer" required autocomplete="off"><button type="submit">Проверить</button></div><p class="puzzle-feedback" aria-live="polite"></p></form><details><summary>Подсказка</summary><p>${esc(puzzle.hint)}</p></details><details><summary>Показать решение</summary><p><strong>${esc(puzzle.answers[0])}</strong></p>${paragraphs(puzzle.explanation)}</details></article>`).join('')}</div></section>`;
}

function render() {
  const route = routeFromHash(location.hash);
  renderedRoute = route;
  document.querySelector('.skip-link').href = `#/${route}?section=main`;
  document.title = `${titles[route]} — Прокуратура Республики Беларусь`;
  navigation.querySelectorAll('a').forEach(anchor => {
    if (anchor.hash === `#/${route}`) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  });
  main.innerHTML = pageHeading(route);
  if ((route === 'structure' && structureError) || (route !== 'structure' && contentError)) {
    main.insertAdjacentHTML('beforeend', errorState(route === 'structure' ? 'каталог органов' : 'учебные материалы'));
    main.querySelector('#retry').addEventListener('click', () => { main.querySelector('#retry').disabled = true; loadData(); });
  } else if (route === 'structure' && structure) renderStructure();
  else if (content && route === 'interactive') renderInteractive();
  else if (content) renderReading(route);
  else main.insertAdjacentHTML('beforeend', '<p class="loading-state" role="status">Загружаем материалы…</p>');
  requestAnimationFrame(() => jumpToSection(false));
}

function jumpToSection(focus = true) {
  const section = sectionFromHash(location.hash);
  const target = section && document.getElementById(section);
  if (!target) return false;
  const heading = target.matches('.reading-card') ? target.querySelector('h2') : null;
  const focusTarget = heading || target;
  focusTarget.tabIndex = -1;
  if (!readingWideScreen.matches) main.querySelector('.reading-toc')?.removeAttribute('open');
  if (focus) focusTarget.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: 'instant', block: 'start' });
  return true;
}

bindMobileMenu(menuToggle, navigation, document.querySelector('.site-header'));
readingWideScreen.addEventListener('change', event => {
  const toc = main.querySelector('.reading-toc');
  if (toc) toc.open = event.matches;
});
document.querySelector('.skip-link').addEventListener('click', event => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  main.focus({ preventScroll: true });
  main.scrollIntoView({ behavior: 'instant' });
});
main.addEventListener('click', event => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const anchor = event.target.closest('a[data-section],a[data-jump]');
  if (anchor?.hash === location.hash) { event.preventDefault(); jumpToSection(); }
});
window.addEventListener('hashchange', () => {
  navigation.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  if (routeFromHash(location.hash) !== renderedRoute) render();
  if (!jumpToSection()) {
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
});
render();
loadData();
