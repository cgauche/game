import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  normalizeText, readFrontmatter, readTomlStringField, transformGuide,
  buildExpectedOutputs, collectDiffs,
} from './compat-core.mjs';

test('normalise CRLF et termine par un seul LF', () => {
  assert.equal(normalizeText('a\r\nb\r\n'), 'a\nb\n');
});

test('lit frontmatter et corps sans le modifier', () => {
  const parsed = readFrontmatter('---\r\nname: demo\r\ndescription: Démo\r\n---\r\nCorps\r\n', 'demo.md');
  assert.equal(parsed.attributes.get('name'), 'demo');
  assert.equal(parsed.body, 'Corps\n');
});

test('lit les quatre formes string TOML requises', () => {
  assert.equal(readTomlStringField('name = "codeur"\r\n', 'name'), 'codeur');
  assert.equal(readTomlStringField("name = 'codeur'\n", 'name'), 'codeur');
  assert.equal(readTomlStringField('developer_instructions = """\r\nligne\r\n"""', 'developer_instructions'), 'ligne\n');
  assert.equal(readTomlStringField("developer_instructions = '''\nligne\n'''", 'developer_instructions'), 'ligne\n');
});

test('transforme le guide par table fermée', () => {
  const out = transformGuide('# CLAUDE.md\nClaude Code `.claude/credo.md` `.claude/memory/` Foundry/CLAUDE.md ~/.claude/projects/…/memory claude.ai/code\n');
  assert.match(out, /^<!-- GENERATED: agents:sync; source=CLAUDE\.md -->\n# AGENTS\.md/m);
  assert.doesNotMatch(out.replace(/^[^\n]*\n/, ''), /CLAUDE\.md|Claude Code|\.claude\/credo|\.claude\/memory|~\/\.claude|claude\.ai\/code/);
});

test('adopte un legacy exact mais refuse un écrasement manuel', () => {
  const expected = buildExpectedOutputs(new Map([['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code\n')]]));
  const generated = expected.files.get('AGENTS.md').toString('utf8');
  const legacy = generated.replace(/^<!-- GENERATED:[^\n]+ -->\n/, '');
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from(legacy)] ]))[0].safe, true);
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from('# manuel\n')]]))[0].type, 'unsafe-overwrite');
});
