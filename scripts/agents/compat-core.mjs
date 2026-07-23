import { Buffer } from 'node:buffer';

export const GENERATED_PREFIX = '<!-- GENERATED: agents:sync; source=';
const utf8 = new TextDecoder('utf-8', { fatal: true });
const replacements = [
  ['Foundry/CLAUDE.md', 'Foundry/AGENTS.md'],
  ['# CLAUDE.md', '# AGENTS.md'],
  ['Claude Code', 'Codex'],
  ['.claude/credo.md', '.codex/credo.md'],
  ['.claude/memory/', '.codex/memory/'],
  ['~/.claude/projects/…/memory', '~/.codex/projects/…/memory'],
  ['claude.ai/code', 'Codex cloud'],
];

export function normalizeText(text) {
  return `${text.replace(/\r\n?/g, '\n').replace(/\n+$/g, '')}\n`;
}

export function readFrontmatter(text, sourcePath = '<memory>') {
  const value = normalizeText(text);
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(value);
  if (!match) throw new Error(`${sourcePath}: frontmatter Markdown invalide`);
  const attributes = new Map();
  for (const line of match[1].split('\n')) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!field) throw new Error(`${sourcePath}: champ frontmatter invalide: ${line}`);
    attributes.set(field[1], field[2]);
  }
  return { attributes, body: match[2] };
}

export function readTomlStringField(text, field, sourcePath = '<memory>') {
  const value = text.replace(/\r\n?/g, '\n');
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const assignment = new RegExp(`^${escaped}\\s*=\\s*`, 'm').exec(value);
  if (!assignment) throw new Error(`${sourcePath}: champ TOML absent: ${field}`);
  const start = assignment.index + assignment[0].length;
  for (const quote of ['"""', "'''"]) {
    if (value.startsWith(quote, start)) {
      const bodyStart = start + 3 + (value[start + 3] === '\n' ? 1 : 0);
      const end = findTomlClosingQuote(value, quote, bodyStart);
      if (end < 0) throw new Error(`${sourcePath}: string TOML multiligne non fermée: ${field}`);
      const body = value.slice(bodyStart, end);
      return quote === '"""' ? decodeTomlBasicString(body, sourcePath, field) : body;
    }
  }
  const quote = value[start];
  if (quote !== '"' && quote !== "'") throw new Error(`${sourcePath}: ${field} doit être une string TOML`);
  const end = findTomlClosingQuote(value, quote, start + 1);
  if (end < 0) throw new Error(`${sourcePath}: string TOML non fermée: ${field}`);
  const body = value.slice(start + 1, end);
  return quote === '"' ? decodeTomlBasicString(body, sourcePath, field) : body;
}

function findTomlClosingQuote(value, quote, start) {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === '\\') {
      index += 1;
      continue;
    }
    if (value.startsWith(quote, index)) return index;
  }
  return -1;
}

function decodeTomlBasicString(value, sourcePath, field) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== '\\') {
      output += character;
      continue;
    }
    const escape = value[index += 1];
    const simple = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' };
    if (escape in simple) {
      output += simple[escape];
      continue;
    }
    const length = escape === 'u' ? 4 : escape === 'U' ? 8 : 0;
    if (!length) throw new Error(`${sourcePath}: échappement TOML invalide: ${field}`);
    const hex = value.slice(index + 1, index + length + 1);
    if (!new RegExp(`^[0-9A-Fa-f]{${length}}$`).test(hex)) throw new Error(`${sourcePath}: échappement TOML invalide: ${field}`);
    output += String.fromCodePoint(Number.parseInt(hex, 16));
    index += length;
  }
  return output;
}

function adapt(text) {
  return replacements.reduce((value, [from, to]) => value.split(from).join(to), normalizeText(text));
}

export function transformGuide(text) {
  const body = adapt(text);
  if (/CLAUDE\.md|Claude Code|\.claude\/(?:credo|memory)|~\/\.claude|claude\.ai\/code/.test(body)) {
    throw new Error('guide: référence Claude résiduelle');
  }
  return `${GENERATED_PREFIX}CLAUDE.md -->\n${body}`;
}

export function transformSkillTree() { return new Map(); }
export function validateRolePairs() { return []; }
export function validateHookParity() { return []; }

export function buildExpectedOutputs(snapshot) {
  const files = new Map();
  const diagnostics = [];
  const source = snapshot.get('CLAUDE.md');
  if (!source) diagnostics.push({ family: 'guide', destination: 'AGENTS.md', type: 'missing', message: 'CLAUDE.md absent' });
  else {
    try {
      files.set('AGENTS.md', Buffer.from(transformGuide(utf8.decode(source))));
    } catch (error) {
      diagnostics.push({ family: 'guide', source: 'CLAUDE.md', destination: 'AGENTS.md', type: 'parse', message: error.message });
    }
  }
  return { files, managedRoots: new Set(['AGENTS.md']), diagnostics };
}

function withoutBanner(value) {
  return value.replace(/^<!-- GENERATED:[^\n]+ -->\n/, '');
}

export function collectDiffs(expected, actual) {
  const diagnostics = [...expected.diagnostics];
  for (const [destination, wanted] of expected.files) {
    const found = actual.get(destination);
    if (!found) diagnostics.push({ family: 'guide', destination, type: 'missing', message: 'sortie absente', safe: true });
    else if (!found.equals(wanted)) {
      let current;
      try {
        current = utf8.decode(found);
      } catch (error) {
        diagnostics.push({ family: 'guide', destination, type: 'parse', message: error.message, safe: false });
        continue;
      }
      const legacy = Buffer.from(withoutBanner(wanted.toString('utf8')));
      const marked = current.startsWith(GENERATED_PREFIX);
      const legacyExact = found.equals(legacy);
      diagnostics.push({ family: 'guide', destination, type: marked || legacyExact ? 'content' : 'unsafe-overwrite', message: 'contenu divergent', safe: marked || legacyExact });
    }
  }
  return diagnostics;
}
