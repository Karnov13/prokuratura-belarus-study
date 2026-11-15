const escapeText = text => text.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));

export function renderRebuses(rebuses) {
  return `<ul class="rebuses-list">${rebuses.map(({ id, width, height, answer }) => {
    const image = `./assets/rebuses/${id}.jpg`;
    return `<li class="rebus-item">
      <a class="rebus-preview" href="${image}" target="_blank" rel="noopener" aria-label="Увеличить изображение ребуса (откроется в новой вкладке)">
        <img class="rebus-image" src="${image}" alt="Изображение ребуса" width="${width}" height="${height}" loading="lazy" decoding="async">
      </a>
      <div class="rebus-actions">
        <a class="rebus-full-size" href="${image}" target="_blank" rel="noopener">Увеличить<span class="sr-only"> изображение ребуса (откроется в новой вкладке)</span></a>
        <details class="rebus-disclosure">
          <summary><span class="rebus-show">Показать ответ</span><span class="rebus-hide">Скрыть ответ</span></summary>
          <p class="rebus-solution">${escapeText(answer)}</p>
        </details>
      </div>
    </li>`;
  }).join('')}</ul>`;
}
