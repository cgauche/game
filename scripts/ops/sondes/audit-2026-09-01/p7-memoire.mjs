// SONDE (lecture seule) — quinze fiches `feedback-*` : tests/gardes cités et mentions de récidive.
// Usage : node scripts/ops/sondes/audit-2026-09-01/p7-memoire.mjs

import fs from 'fs';
import { RACINE } from './_socle.mjs';

const root=RACINE + '/';
const dir=root+'.claude/memory/';
const list=`feedback-brief-fait-autorite-grounding-seconde-main
feedback-toute-donnee-de-scene-editable-sans-ia
feedback-adversaire-reel-valeur-nue-anomalie
feedback-pas-de-plan-superpowers-tickets-github
feedback-regle-1-jamais-commit-avec-reste-ouvert
feedback-perf-profiler-avant-design-cache
feedback-recette-juge-l-ecran-pas-le-mecanisme
feedback-audit-modeling-shape-vs-raw-intent
feedback-audit-nest-pas-ordre-de-travail
feedback-jamais-git-surgery-arbre-partage-actif
feedback-editeur-ref-picker-coherent
feedback-personne-ne-lit-le-journal
feedback-questions-stop-loop
feedback-adversaire-creatif
feedback-editeur-ne-connait-pas-les-heros`.split('\n');
for(const n of list){
  const t=fs.readFileSync(dir+n+'.md','utf8');
  const tests=[...new Set([...t.matchAll(/[A-Za-z0-9_./-]*\.test\.tsx?/g)].map(m=>m[0]))];
  const guards=[...new Set([...t.matchAll(/scripts\/guards\/[A-Za-z0-9_./-]+|hook[s]?\b|pre-commit/gi)].map(m=>m[0].toLowerCase()))];
  const rec=[...new Set([...t.matchAll(/récidive|recidive|RÉCIDIVE/gi)].map(m=>m[0]))].length;
  console.log('###',n,'| tests cités:',tests.join(',')||'-','| garde/hook:',guards.join(',')||'-','| mentions recidive:',rec);
}
