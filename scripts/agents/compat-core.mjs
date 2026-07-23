import { Buffer } from 'node:buffer';

export const GENERATED_PREFIX = '<!-- GENERATED: agents:sync; source=';
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
      const end = value.indexOf(quote, bodyStart);
      if (end < 0) throw new Error(`${sourcePath}: string TOML multiligne non fermée: ${field}`);
      return value.slice(bodyStart, end);
    }
  }
  const quote = value[start];
  if (quote !== '"' && quote !== "'") throw new Error(`${sourcePath}: ${field} doit être une string TOML`);
  const end = value.indexOf(quote, start + 1);
  if (end < 0) throw new Error(`${sourcePath}: string TOML non fermée: ${field}`);
  return quote === '"' ? JSON.parse(value.slice(start, end + 1)) : value.slice(start + 1, end);
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
  else files.set('AGENTS.md', Buffer.from(transformGuide(source.toString('utf8'))));
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
      const current = normalizeText(found.toString('utf8'));
      const legacy = withoutBanner(wanted.toString('utf8'));
      const marked = current.startsWith(GENERATED_PREFIX);
      diagnostics.push({ family: 'guide', destination, type: marked || current === legacy ? 'content' : 'unsafe-overwrite', message: 'contenu divergent', safe: marked || current === legacy });
    }
  }
  return diagnostics;
}
