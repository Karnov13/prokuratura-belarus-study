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
    for (const folder of ['data', 'scripts', 'assets', 'docs']) await mkdir(join(source, folder), { recursive: true });
    const files = {
      'index.html': '<html><body><!-- STATIC_FALLBACK --></body></html>',
      'styles.css': 'body {}',
      'scripts/app.js': '',
      'scripts/logic.js': '',
      'assets/academy-symbol-user-reference.jpg': 'previous image',
      'assets/academy-symbol-user-selected.png': 'selected image unchanged',
      'docs/private.md': 'not public',
      'data/structure.json': JSON.stringify({ offices: [{ id: 'one', name: 'Орган <script>alert(1)</script>', officials: [] }] }),
      'data/content.json': JSON.stringify({ appeals: [{ title: 'Обращение', body: 'Читаемый материал' }], career: [], activities: [], quiz: [{ question: 'Вопрос', options: ['А', 'Б'], answerIndex: 1, explanation: 'Объяснение' }], riddles: [], rebuses: [], sources: [] })
    };
    for (const [path, text] of Object.entries(files)) await writeFile(join(source, path), text);
    await buildSite(source, output);
    assert.deepEqual((await readdir(output)).sort(), ['.nojekyll', 'assets', 'data', 'index.html', 'scripts', 'styles.css']);
    assert.deepEqual(await readdir(join(output, 'assets')), ['academy-symbol-user-selected.png']);
    assert.equal(await readFile(join(output, 'assets/academy-symbol-user-selected.png'), 'utf8'), 'selected image unchanged');
    const html = await readFile(join(output, 'index.html'), 'utf8');
    assert.match(html, /Читаемый материал/);
    assert.match(html, /Правильный ответ: Б/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
