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
  for (const key of ['appeals', 'career', 'activities', 'rebuses', 'sources']) {
    if (!Array.isArray(data?.[key])) throw new Error(`Invalid collection: ${key}`);
  }
  const ids = new Set();
  for (const rebus of data.rebuses) {
    if (!rebus || typeof rebus.id !== 'string' || !/^rebus-[a-z0-9]+$/.test(rebus.id)
      || !Number.isSafeInteger(rebus.width) || rebus.width < 1
      || !Number.isSafeInteger(rebus.height) || rebus.height < 1
      || typeof rebus.answer !== 'string' || !rebus.answer.trim()) throw new Error('Invalid rebus');
    if (ids.has(rebus.id)) throw new Error(`Duplicate rebus: ${rebus.id}`);
    ids.add(rebus.id);
  }
  if (data.riddles !== undefined && (!Array.isArray(data.riddles) || data.riddles.some(riddle =>
    !riddle || typeof riddle.question !== 'string' || !riddle.question.trim()
    || typeof riddle.answer !== 'string' || !riddle.answer.trim()))) throw new Error('Invalid riddle');
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
