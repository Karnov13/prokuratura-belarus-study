const escapeText = text => text.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));

function answerDisclosure(answer) {
  return `<details class="rebus-disclosure">
    <summary><span class="rebus-show">Показать ответ</span><span class="rebus-hide">Скрыть ответ</span></summary>
    <p class="rebus-solution">${escapeText(answer)}</p>
  </details>`;
}

function renderRebuses(rebuses) {
  return `<ul class="rebuses-list">${rebuses.map(({ id, width, height, answer }) => {
    const image = `./assets/rebuses/${id}.jpg`;
    return `<li class="rebus-item">
      <a class="rebus-preview" href="${image}" target="_blank" rel="noopener" aria-label="Увеличить изображение ребуса (откроется в новой вкладке)">
        <img class="rebus-image" src="${image}" alt="Изображение ребуса" width="${width}" height="${height}" loading="lazy" decoding="async">
      </a>
      <div class="rebus-actions">
        <a class="rebus-full-size" href="${image}" target="_blank" rel="noopener">Увеличить<span class="sr-only"> изображение ребуса (откроется в новой вкладке)</span></a>
        ${answerDisclosure(answer)}
      </div>
    </li>`;
  }).join('')}</ul>`;
}

export function renderInteractiveContent({ rebuses, riddles = [] }, { fallback = false } = {}) {
  const groups = [{ id: 'rebuses-block', title: 'Ребусы', body: renderRebuses(rebuses) }];
  if (riddles.length) {
    const items = riddles.map(({ question, answer }) => `<li class="riddle-item">
      <p class="riddle-question">${escapeText(question)}</p>
      ${answerDisclosure(answer)}
    </li>`).join('');
    groups.push({ id: 'riddles-block', title: 'Загадки', body: `<ul class="riddles-list">${items}</ul>` });
  }
  const prefix = fallback ? 'fallback-' : '';
  const route = fallback ? `#${prefix}` : '#/interactive?section=';
  const links = groups.map(({ id, title }) => `<a data-section href="${route}${id}">${title}</a>`).join('');
  const sections = groups.map(({ id, title, body }) => `<section class="interactive-block" id="${prefix}${id}" aria-labelledby="${prefix}${id}-title" tabindex="-1">
    <h2 id="${prefix}${id}-title">${title}</h2>
    ${body}
  </section>`).join('');
  return `<nav class="interactive-nav" aria-label="Разделы интерактивов">${links}</nav>${sections}`;
}
