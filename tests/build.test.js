import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

test('Pages bundle contains only website files and readable escaped fallback', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'prosecution-build-'));
  const source = join(temporary, 'source');
  const output = join(source, 'dist');
  try {
    for (const folder of ['data', 'scripts', 'assets/rebuses', 'docs']) await mkdir(join(source, folder), { recursive: true });
    const files = {
      'index.html': '<html><body><!-- STATIC_FALLBACK --></body></html>',
      'styles.css': 'body {}',
      'scripts/app.js': '',
      'scripts/logic.js': '',
      'scripts/rebuses.js': '',
      'assets/academy-symbol-user-reference.jpg': 'previous image',
      'assets/academy-symbol-user-selected.png': 'selected image unchanged',
      'assets/rebuses/rebus-a.jpg': 'original rebus image',
      'assets/rebuses/rebus-unused.jpg': 'unlisted image',
      'docs/private.md': 'not public',
      'data/structure.json': JSON.stringify({ offices: [{ id: 'one', name: 'Орган <script>alert(1)</script>', officials: [] }] }),
      'data/content.json': JSON.stringify({ appeals: [{ title: 'Обращение', body: 'Читаемый материал' }], career: [], activities: [], rebuses: [{ id: 'rebus-a', width: 1280, height: 640, answer: 'Закон' }], riddles: [{ question: 'Вопрос <важный>', answer: 'Первый ответ' }, { question: 'Второй вопрос', answer: 'Второй ответ' }], sources: [] })
    };
    for (const [path, text] of Object.entries(files)) await writeFile(join(source, path), text);
    await buildSite(source, output);
    assert.deepEqual((await readdir(output)).sort(), ['.nojekyll', 'assets', 'data', 'index.html', 'scripts', 'styles.css']);
    assert.deepEqual((await readdir(join(output, 'assets'))).sort(), ['academy-symbol-user-selected.png', 'rebuses']);
    assert.equal(await readFile(join(output, 'assets/academy-symbol-user-selected.png'), 'utf8'), 'selected image unchanged');
    assert.deepEqual(await readdir(join(output, 'assets/rebuses')), ['rebus-a.jpg']);
    assert.equal(await readFile(join(output, 'assets/rebuses/rebus-a.jpg'), 'utf8'), 'original rebus image');
    const html = await readFile(join(output, 'index.html'), 'utf8');
    assert.match(html, /Читаемый материал/);
    assert.match(html, /<img[^>]*src="\.\/assets\/rebuses\/rebus-a\.jpg"[^>]*alt="Изображение ребуса"/);
    assert.match(html, /<details class="rebus-disclosure">\s*<summary><span[^>]*>Показать ответ<\/span>.*?Закон.*?<\/details>/s);
    const interactive = html.slice(html.indexOf('id="fallback-interactive"'));
    assert.match(interactive, /href="#fallback-rebuses-block">Ребусы<\/a>.*?href="#fallback-riddles-block">Вопросы<\/a>/s);
    assert.match(interactive, /id="fallback-rebuses-block".*?id="fallback-riddles-block"/s);
    assert.match(interactive, /Вопрос &lt;важный&gt;.*?<details class="rebus-disclosure">.*?Первый ответ.*?<\/details>.*?Второй вопрос.*?<details class="rebus-disclosure">.*?Второй ответ.*?<\/details>/s);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
