import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFromHash, sectionFromHash, normalizeAnswer, filterOffices, validateStructure, validateContent, safeUrl, officeDepth, bindMobileMenu } from '../scripts/logic.js';

test('unknown and malformed deep links safely select structure', () => {
  assert.equal(routeFromHash('#/career'), 'career');
  assert.equal(routeFromHash('#/missing'), 'structure');
  assert.equal(routeFromHash('#/%E0%A4%A'), 'structure');
});

test('copied reading and exercise links retain both page and target after reload', () => {
  assert.equal(routeFromHash('#/career?section=section-2'), 'career');
  assert.equal(sectionFromHash('#/career?section=section-2'), 'section-2');
  assert.equal(routeFromHash('#/interactive?section=rebuses-block'), 'interactive');
  assert.equal(sectionFromHash('#/interactive?section=rebuses-block'), 'rebuses-block');
  assert.equal(sectionFromHash('#/interactive?section=riddles-block'), 'riddles-block');
  assert.equal(sectionFromHash('#/appeals'), '');
  assert.equal(sectionFromHash('#/appeals?section=%3Cscript%3E'), '');
  assert.equal(sectionFromHash('#/appeals?section=%E0%A4%A'), '');
});

test('search terms ignore punctuation, case and ё', () => {
  assert.equal(normalizeAnswer('  ЁЖ — ответ! '), 'еж ответ');
});

const offices = [
  { id: 'root', parentId: null, name: 'Главный орган', level: 'national', region: '', officials: [] },
  { id: 'region', parentId: 'root', name: 'Областной орган', level: 'regional', region: 'Минская область', officials: [] },
  { id: 'city', parentId: 'region', name: 'Городской орган', level: 'district', region: 'Минская область', officials: [{ name: 'Иванов Иван', position: 'Прокурор' }] },
  { id: 'other', parentId: 'root', name: 'Иной орган', level: 'district', region: 'Брестская область', officials: [] }
];

test('search includes official names and retains ancestors without counting them as matches', () => {
  const result = filterOffices(offices, { query: 'иванов', region: 'Минская область' });
  assert.deepEqual(result.matches.map(x => x.id), ['city']);
  assert.deepEqual(result.visible.map(x => x.id), ['root', 'region', 'city']);
});

test('filters intersect and cycles cannot trap hierarchy traversal', () => {
  assert.deepEqual(filterOffices(offices, { query: 'город', region: 'Брестская область' }).visible, []);
  const cycle = [{ ...offices[0], parentId: 'city' }, ...offices.slice(1)];
  assert.equal(filterOffices(cycle, { query: 'иванов' }).visible.length, 3);
});

test('structure validator detects duplicate IDs and missing parents', () => {
  assert.doesNotThrow(() => validateStructure({ offices }));
  assert.throws(() => validateStructure({ offices: [...offices, offices[0]] }), /Duplicate/);
  assert.throws(() => validateStructure({ offices: [{ ...offices[0], parentId: 'absent' }] }), /parent/);
});

test('content requires safe, unique rebus IDs, valid image sizes and answers', () => {
  const rebus = { id: 'rebus-a', width: 1280, height: 640, answer: 'Закон' };
  const content = { appeals: [], career: [], activities: [], rebuses: [rebus], sources: [] };
  assert.doesNotThrow(() => validateContent(content));
  assert.throws(() => validateContent({ ...content, rebuses: [{ ...rebus, id: '../outside' }] }), /rebus/i);
  assert.throws(() => validateContent({ ...content, rebuses: [{ ...rebus, height: 0 }] }), /rebus/i);
  assert.throws(() => validateContent({ ...content, rebuses: [{ ...rebus, answer: ' ' }] }), /rebus/i);
  assert.throws(() => validateContent({ ...content, rebuses: [rebus, rebus] }), /duplicate/i);
});

test('content rejects incomplete riddle pairs before rendering', () => {
  const content = { appeals: [], career: [], activities: [], rebuses: [], sources: [] };
  assert.doesNotThrow(() => validateContent({ ...content, riddles: [{ question: 'Вопрос', answer: 'Ответ' }] }));
  assert.throws(() => validateContent({ ...content, riddles: [{ question: 'Вопрос', answer: ' ' }] }), /riddle/i);
  assert.throws(() => validateContent({ ...content, riddles: [{ question: null, answer: 'Ответ' }] }), /riddle/i);
});

test('source links reject executable and relative URLs', () => {
  assert.equal(safeUrl('https://example.by/path'), 'https://example.by/path');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('/not-an-official-source'), '');
});

test('office depth follows ancestry and caps malformed cycles', () => {
  assert.equal(officeDepth(offices[2], offices), 2);
  assert.equal(officeDepth({ ...offices[0], parentId: 'root' }, offices), 0);
});

test('Escape from anywhere in header collapses mobile menu and restores toggle focus', () => {
  const header = new EventTarget();
  const toggle = new EventTarget();
  const attrs = new Map([['aria-expanded', 'false']]);
  let focused = false;
  toggle.getAttribute = key => attrs.get(key);
  toggle.setAttribute = (key, value) => attrs.set(key, value);
  toggle.focus = () => { focused = true; };
  const classes = new Set();
  const nav = { classList: { toggle: (name, force) => force ? classes.add(name) : classes.delete(name), remove: name => classes.delete(name) } };
  bindMobileMenu(toggle, nav, header);
  toggle.dispatchEvent(new Event('click'));
  assert.equal(attrs.get('aria-expanded'), 'true');
  assert.equal(classes.has('is-open'), true);
  const escape = new Event('keydown');
  Object.defineProperty(escape, 'key', { value: 'Escape' });
  header.dispatchEvent(escape);
  assert.equal(attrs.get('aria-expanded'), 'false');
  assert.equal(classes.has('is-open'), false);
  assert.equal(focused, true);
});
