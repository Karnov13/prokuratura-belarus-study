export function routeFromHash(hash = '') {
  const route = hash.replace(/^#\/?/, '').split('?')[0];
  return ['structure', 'appeals', 'career', 'activities', 'interactive'].includes(route) ? route : 'structure';
}

export function sectionFromHash(hash = '') {
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) return '';
  const section = new URLSearchParams(hash.slice(queryIndex + 1)).get('section') || '';
  return /^[a-z][a-z0-9-]*$/.test(section) ? section : '';
}

export function normalizeAnswer(value) {
  return String(value ?? '').toLocaleLowerCase('ru').replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function checkAnswer(value, answers) {
  const normalized = normalizeAnswer(value);
  return Boolean(normalized) && answers.some(answer => normalizeAnswer(answer) === normalized);
}

export function filterOffices(offices, { query = '', region = '', level = '' } = {}) {
  const words = normalizeAnswer(query).split(' ').filter(Boolean);
  const matches = offices.filter(office => {
    const text = normalizeAnswer([office.name, office.address, office.region,
      ...(office.officials || []).flatMap(person => [person.name, person.position])].join(' '));
    return (!region || office.region === region) && (!level || office.level === level)
      && words.every(word => text.includes(word));
  });
  const byId = new Map(offices.map(office => [office.id, office]));
  const visibleIds = new Set();
  for (const office of matches) {
    let current = office;
    while (current && !visibleIds.has(current.id)) {
      visibleIds.add(current.id);
      current = byId.get(current.parentId);
    }
  }
  return { matches, visible: offices.filter(office => visibleIds.has(office.id)) };
}

export function gradeQuiz(quiz, answers) {
  const complete = quiz.length > 0 && quiz.every((question, index) =>
    Number.isInteger(answers[index]) && answers[index] >= 0 && answers[index] < question.options.length);
  const correct = quiz.map((question, index) => answers[index] === question.answerIndex);
  return { complete, score: complete ? correct.filter(Boolean).length : 0, total: quiz.length, correct };
}

export function validateStructure(data) {
  if (!data || !Array.isArray(data.offices)) throw new Error('Invalid offices');
  const ids = new Set();
  for (const office of data.offices) {
    if (!office.id || typeof office.name !== 'string') throw new Error('Invalid office');
    if (ids.has(office.id)) throw new Error(`Duplicate office: ${office.id}`);
    ids.add(office.id);
  }
  for (const office of data.offices) {
    if (office.parentId && !ids.has(office.parentId)) throw new Error(`Missing parent: ${office.parentId}`);
  }
  return data;
}

export function validateContent(data) {
  for (const key of ['appeals', 'career', 'activities', 'quiz', 'riddles', 'rebuses', 'sources']) {
    if (!Array.isArray(data?.[key])) throw new Error(`Invalid collection: ${key}`);
  }
  for (const question of data.quiz) {
    if (typeof question.question !== 'string' || !Array.isArray(question.options)
      || question.options.length < 2 || !Number.isInteger(question.answerIndex)
      || question.answerIndex < 0 || question.answerIndex >= question.options.length) throw new Error('Invalid quiz');
  }
  for (const puzzle of [...data.riddles, ...data.rebuses]) {
    if (!puzzle.prompt || !Array.isArray(puzzle.answers) || !puzzle.answers.some(answer => normalizeAnswer(answer))) throw new Error('Invalid puzzle');
  }
  return data;
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function officeDepth(office, offices) {
  const byId = new Map(offices.map(item => [item.id, item]));
  const seen = new Set([office.id]);
  let depth = 0;
  let parent = byId.get(office.parentId);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    depth++;
    parent = byId.get(parent.parentId);
  }
  return depth;
}

export function bindMobileMenu(toggle, navigation, header) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  header.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;
    toggle.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    toggle.focus();
  });
}
