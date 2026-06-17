/**
 * Migration jetable : ajoute un `id` stable (slugId) à chaque mutation de `mutations.json` et
 * réécrit les références `ranges[].mutation` de `mutationTables.json` du label vers l'id.
 * « On ne devrait plus se baser sur le label » — runtime/données 100% id, label = affichage seul.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const slugId = (label) =>
  label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const uniqueSlugId = (label, taken) => {
  const base = slugId(label);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
};
const norm = (s) => s.trim().toLowerCase().replace(/[’']/g, "'");

const MUT = 'src/data/mutations.json';
const TBL = 'src/data/mutationTables.json';

const muts = JSON.parse(readFileSync(MUT, 'utf8'));
const taken = new Set();
const byNorm = new Map();
const withIds = muts.map((m) => {
  const id = uniqueSlugId(m.label, taken);
  byNorm.set(norm(m.label), id);
  return { id, ...m }; // id en tête, ordre des autres champs préservé
});
writeFileSync(MUT, JSON.stringify(withIds, null, 2) + '\n');

const tables = JSON.parse(readFileSync(TBL, 'utf8'));
let rewritten = 0;
for (const t of tables) {
  for (const r of t.ranges) {
    const id = byNorm.get(norm(r.mutation));
    if (!id) throw new Error(`Table « ${t.label} » : mutation « ${r.mutation} » introuvable dans mutations.json`);
    r.mutation = id;
    rewritten++;
  }
}
writeFileSync(TBL, JSON.stringify(tables, null, 2) + '\n');

console.log(`mutations.json : ${withIds.length} ids ; mutationTables.json : ${rewritten} refs réécrites`);
console.log('Exemples :', withIds.slice(0, 3).map((m) => `${m.label} → ${m.id}`).join(' | '));
