/**
 * Migration : identité des créatures en `id` stable (slugId). Ajoute `id` à chaque créature de
 * creatures.json, puis réécrit toutes les RÉFÉRENCES créature (label → id) dans les scènes JSON
 * (arene-projet.json) et les fichiers de scène/test .ts (`ref: 'X'`). « Plus de label » pour les
 * références de données ; le `label` ne reste que pour l'affichage/édition.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const slugId = (label) =>
  label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const uniqueSlugId = (label, taken) => {
  const base = slugId(label); let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id); return id;
};
const ser = (v) => JSON.stringify(v, null, 2); // format canonique app-owned (sans newline final)

// 1) creatures.json : ajouter `id` (en tête), construire label→id.
const CRE = 'src/data/creatures.json';
const creatures = JSON.parse(readFileSync(CRE, 'utf8'));
const taken = new Set();
const label2id = new Map();
const withIds = creatures.map((c) => {
  const id = uniqueSlugId(c.label, taken);
  label2id.set(c.label, id);
  return { id, ...c };
});
writeFileSync(CRE, ser(withIds));
console.log(`creatures.json : ${withIds.length} ids ajoutés`);

// 2) Réécrire les refs créature dans les scènes JSON (walk : tout objet `{ ref: <label connu> }`).
let jsonRefs = 0;
function rewriteJson(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      if (typeof o.ref === 'string' && label2id.has(o.ref)) { o.ref = label2id.get(o.ref); jsonRefs++; }
      Object.values(o).forEach(walk);
    }
  };
  walk(data);
  writeFileSync(path, ser(data));
}
rewriteJson('src/scenes/arene/arene-projet.json');
console.log(`arene-projet.json : ${jsonRefs} refs créature réécrites`);

// 3) Réécrire `ref: '<label>'` / `ref: "<label>"` dans les .ts de scène (src/scenes/**).
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const labelsByLen = [...label2id.keys()].sort((a, b) => b.length - a.length); // longs d'abord (évite sous-chaînes)
let tsRefs = 0;
function walkTs(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { walkTs(p); continue; }
    if (!p.endsWith('.ts') && !p.endsWith('.tsx')) continue;
    let src = readFileSync(p, 'utf8');
    let n = 0;
    for (const label of labelsByLen) {
      const id = label2id.get(label);
      const re = new RegExp(`(\\bref:\\s*)(['"])${esc(label)}\\2`, 'g');
      src = src.replace(re, (_m, pre, q) => { n++; return `${pre}${q}${id}${q}`; });
    }
    if (n) { writeFileSync(p, src); tsRefs += n; }
  }
}
walkTs('src/scenes');
console.log(`scènes .ts : ${tsRefs} refs créature réécrites`);
console.log('Exemples :', withIds.slice(0, 2).map((c) => `${c.label} → ${c.id}`).join(' | '));
