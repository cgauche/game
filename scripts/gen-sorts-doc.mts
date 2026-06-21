/**
 * Génère docs/sorts-implementation.md — INVENTAIRE des sorts/miracles :
 * pour chacun, son niveau de prise en charge mécanique et CE QUI RESTE à
 * implémenter (le texte « arbitrage MJ » journalisé en jeu).
 *
 * Migration #5 : les métadonnées de résolution (durée, ZdE, etc.) vivent désormais
 * dans SpellData (spells.json) — plus de src/data/spellspecs/. La colonne « Curé »
 * lit s.curated directement depuis la donnée JSON.
 *
 *   npx tsx scripts/gen-sorts-doc.mts
 */
import { writeFileSync } from 'node:fs';
import { spells } from '../src/data';
import { spellSupport } from '../src/engine/spellspec';
import { isMagicMissile } from '../src/engine/magic';
import { spellOps } from '../src/state/flow';

const ICON = { mecanique: '✅', partiel: '🟡', narratif: '📜' } as const;

const lines: string[] = [
  '# Sorts & Miracles — état d\'implémentation',
  '',
  '> GÉNÉRÉ par `npx tsx scripts/gen-sorts-doc.mts` — ne pas éditer à la main.',
  '> ✅ = effets connus appliqués par le moteur ·',
  '> 🟡 = partiel (volet « arbitrage MJ » journalisé en jeu) · 📜 = rien de mécanique',
  '> (effet journalisé verbatim). « curé » = spec complète dans SpellData (spells.json).',
  '',
];

const groups = new Map<string, typeof spells>();
for (const s of spells) {
  const key = s.subType ? `${s.type} — ${s.subType}` : s.type;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(s);
}

const totals = { mecanique: 0, partiel: 0, narratif: 0, curated: 0 };
for (const [group, list] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))) {
  lines.push(`## ${group} (${list.length})`, '');
  lines.push('| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |');
  lines.push('|---|---|---|---|');
  for (const s of [...list].sort((a, b) => a.label.localeCompare(b.label, 'fr'))) {
    // Les EFFETS (ops) vivent sur `SpellData.effects` (Flow) ; on les extrait par cible.
    const ops = [...spellOps(s.effects, 'target'), ...spellOps(s.effects, 'caster')];
    const support = spellSupport(spellOps(s.effects, 'target'), s, isMagicMissile(s));
    totals[support]++;
    if (s.curated) totals.curated++;
    const reste = ops
      .filter((o) => o.op === 'narrative')
      .map((o) => (o as { text: string }).text)
      .join(' ')
      .replace(/\|/g, '/');
    const fallbackNote = !s.curated && ops.length === 0 ? 'Non curé : desc journalisée telle quelle.' : '';
    lines.push(`| ${s.label} | ${ICON[support]} | ${s.curated ? 'oui' : 'repli'} | ${reste || fallbackNote} |`);
  }
  lines.push('');
}

lines.splice(8, 0,
  `**Synthèse** : ${spells.length} sorts — ✅ ${totals.mecanique} mécaniques · 🟡 ${totals.partiel} partiels · ` +
  `📜 ${totals.narratif} narratifs (arbitrage MJ) · ${totals.curated} specs curées.`,
  '');

writeFileSync('docs/sorts-implementation.md', lines.join('\n'));
console.log(`docs/sorts-implementation.md : ${spells.length} sorts — ✅ ${totals.mecanique} · 🟡 ${totals.partiel} · 📜 ${totals.narratif} · curés ${totals.curated}`);
