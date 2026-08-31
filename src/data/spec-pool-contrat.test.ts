import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skills, talents, careerLevels, species, stars, specCatalogOf, specLabel, specPoolOf, specResolves, specEntryId } from './index';
import tablesJson from './tables.json';
import activitiesJson from './activities.json';
import tavernGamesJson from './tavernGames.json';
import crewRolesJson from './crew-roles.json';

/**
 * CONTRAT DE DONNÉE #1342 L3 — deux axes ORTHOGONAUX sur une entrée `specs[]` : `source` dit d'où
 * l'entrée vient, `pool: false` dit qu'elle n'est pas PROPOSÉE d'office (`LDB 09 l.40`).
 *
 * BORNE DE CE FICHIER : les datasets SCANNÉS ci-dessous (`PORTES_JOUEUR`) — pas « le LDB 09 ». La
 * mesure du 2026-08-23 interdit le contrat « toute entrée du pool est énumérée par le LDB 09 » :
 * ~150 entrées héritées (Langue, Métier, Savoir…) ne figurent dans AUCUNE liste « Spécialisations : »
 * du chapitre et ne portent pas de `source`. Ce qui EST gardé ici rend le pool correct :
 *  1. une entrée hors pool est attestée ailleurs → elle porte une `source` ;
 *  2. toute spec demandée par une PORTE JOUEUR résout, et résout DANS le pool — sinon l'écran qui
 *     l'affiche ne peut pas l'offrir ;
 *  3. `pool` ne vide jamais un domaine groupé (`LDB 09 l.40` : l'Augmentation s'alloue à une
 *     Spécialisation — un domaine sans pool serait inallouable) ;
 *  4. VALIDITÉ ⊇ POOL, par construction, sur chaque def.
 */
const DEFS = [...skills, ...talents];

/** Datasets qui PROPOSENT une spec à un joueur : liste de Carrière, liste d'espèce, signe astral,
 *  op passive `grantCareerSkill` d'un Talent (`engine/talentEffects.ts#careerSkillAdditions`), table
 *  d'effets, Activité hors combat, jeu de taverne, rôle d'équipage. */
const PORTES_JOUEUR: [string, unknown][] = [
  ['careerLevels', careerLevels], ['species', species], ['stars', stars],
  ['talents(passive/grantCareerSkill)', talents], ['tables', tablesJson],
  ['activities', activitiesJson], ['tavernGames', tavernGamesJson], ['crewRoles', crewRolesJson],
];

/**
 * DETTE NOMINATIVE DATÉE (2026-08-23) — refs de porte joueur dont la `spec` est encore un LIBELLÉ FR
 * (ou une spéc absente du catalogue) : elles ne résolvent pas, donc ne peuvent pas être confrontées
 * au pool. Extinction : #1342 (3ᵉ vie de #1341). Liste FERMÉE : une clé de plus = rouge (nouvelle
 * dette), une clé PÉRIMÉE = rouge aussi (le stock a décru, la liste doit décroître avec lui).
 */
const REFS_EN_LIBELLE = [
  'activities|art|Dessin',
  'talents(passive/grantCareerSkill)|savoir|Apothicaire',
];

const DEF_BY_ID = new Map(DEFS.map((d) => [d.id, d]));

/** Toutes les refs `(defId, spec)` d'une porte joueur. La clé de def se lit d'ABORD sur les champs
 *  QUALIFIÉS (`skillId`/`talentId`/`skill`), PUIS sur l'`id` du nœud lui-même : depuis la référence
 *  emboîtée du lot 3b (L2 #1548), une réf de Compétence s'écrit `skill: { id, spec }` — la spéc est
 *  posée À CÔTÉ de l'id du nœud, donc ce repli est le chemin NORMAL de cette composition plate. */
function refsDePorte(): { where: string; defId: string; spec: string }[] {
  const out: { where: string; defId: string; spec: string }[] = [];
  const walk = (node: unknown, where: string): void => {
    if (Array.isArray(node)) { node.forEach((x) => walk(x, where)); return; }
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    const defId = (n.skillId ?? n.talentId ?? n.skill ?? n.id) as string | undefined;
    if (typeof defId === 'string' && typeof n.spec === 'string') out.push({ where, defId, spec: n.spec });
    for (const v of Object.values(n)) walk(v, where);
  };
  for (const [where, data] of PORTES_JOUEUR) walk(data, where);
  return out;
}

describe('#1342 L3 — contrat `pool` des spécialisations', () => {
  it('toute entrée `pool: false` porte une `source`', () => {
    const nues: string[] = [];
    for (const def of DEFS) {
      for (const e of def.specs ?? []) if (e.pool === false && !e.source) nues.push(`${def.id}/${e.id}`);
    }
    expect(nues, `entrée(s) hors pool sans attestation :\n${nues.join('\n')}`).toEqual([]);
  });

  it('toute spec demandée par une PORTE JOUEUR résout et est DANS le pool (hors dette nominative)', () => {
    const horsPool: string[] = [];
    const detteVue = new Set<string>();
    const detteNeuve: string[] = [];
    for (const { where, defId, spec } of refsDePorte()) {
      if (/au choix/i.test(spec)) continue; // sentinelle : un choix, pas une spéc
      const def = DEF_BY_ID.get(defId);
      if (!def) continue; // le defId n'est pas une Compétence/Talent (garde d'existence : refs-migrated)
      const cle = `${where}|${defId}|${spec}`;
      if (!specResolves(def, spec)) {
        if (REFS_EN_LIBELLE.includes(cle)) detteVue.add(cle);
        else detteNeuve.push(`${cle} (ne résout pas — dette de migration NEUVE, cf. #1342)`);
        continue;
      }
      if (!specPoolOf(def).includes(spec)) horsPool.push(`${cle} : hors pool (l'écran ne peut pas l'offrir)`);
    }
    expect(detteNeuve, detteNeuve.join('\n')).toEqual([]);
    expect(horsPool, horsPool.join('\n')).toEqual([]);
    const perimees = REFS_EN_LIBELLE.filter((k) => !detteVue.has(k));
    expect(perimees, `clé(s) de dette PÉRIMÉE(s) — la ref a été migrée, retirer la ligne :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('VALIDITÉ ⊇ POOL, et aucun domaine groupé n\'a un pool VIDE (`LDB 09 l.40`)', () => {
    const fuites: string[] = [];
    const vides: string[] = [];
    for (const def of DEFS) {
      for (const id of specPoolOf(def)) if (!specResolves(def, id)) fuites.push(`${def.id}/${id}`);
      const inline = (def.specs ?? []).map(specEntryId);
      if (inline.length) {
        expect(specPoolOf(def).length, def.id).toBeLessThanOrEqual(inline.length);
        if (specPoolOf(def).length === 0) vides.push(def.id);
      }
    }
    expect(fuites, `spec(s) proposées mais non valides :\n${fuites.join('\n')}`).toEqual([]);
    expect(vides, `domaine(s) groupés à pool VIDE — Augmentation inallouable :\n${vides.join('\n')}`).toEqual([]);
  });
});

/**
 * EXTENSION 2026-08-30 (L2 #1548, commit 3b) — MÊME contrat, périmètre ÉLARGI et axe RESSERRÉ.
 *
 * PÉRIMÈTRE MESURÉ : TOUS les `src/data/**.json` (walk récursif du dossier, 121 fichiers au relevé),
 * pas seulement les 8 `PORTES_JOUEUR` ci-dessus. L'AXE, lui, est plus étroit que celui des portes :
 * on n'exige pas ici que la spéc résolve (188 valeurs distinctes sont du TEXTE LIBRE authoré, légitime
 * sur les domaines ouverts : Langue, Métier, Savoir…), on exige qu'elle ne soit JAMAIS le LIBELLÉ FR
 * d'une entrée du catalogue de sa propre def.
 *
 * MESURE QUI L'EXIGE : `testValue` apparie la spéc possédée par ÉGALITÉ STRICTE
 * (`s.spec === spec`, `src/engine/skills.ts:76`) et les Compétences possédées portent l'ID. Une spéc
 * écrite « Ingénieur » au lieu de `ingenieur` n'apparie donc AUCUNE instance : le Test retombe sur la
 * Caractéristique de repli et les avances sont PERDUES (héros Métier (Ingénieur) +40, Int 30 : 30
 * mesuré au lieu de 70). Stock avant correctif : 4 (`steam-breakdown.json`, chemin réel
 * `seaVoyageFlow.ts:2020`), ramenés à l'id par `scripts/migrations/2026-08-30-spec-en-id-de-catalogue.mjs`.
 *
 * ANGLES MORTS ÉNONCÉS :
 *  - la clé de def n'est lue que sur `skillId` / `skill` de chaîne / `id` du nœud porteur : une réf
 *    de Compétence désignée par un champ d'un AUTRE nom échappe à la mesure ;
 *  - seules les défs de COMPÉTENCE sont confrontées (le sondage du 2026-08-30 sur les TALENTS relève
 *    5 spécs en libellé sur `sens-aiguise` — 4 dans `mutations.json`, 1 dans `spells.json` — dont la
 *    résolution passe par `PairedSense` et non par `testValue`) : axe distinct, non tranché ici ;
 *  - un libellé AMBIGU (deux entrées du même catalogue au même libellé normalisé) n'est pas départagé.
 */
const DOSSIER_DATA = fileURLToPath(new URL('.', import.meta.url));

/** Normalisation de COMPARAISON seulement (NFD + casse) : jamais une conversion de donnée. */
const normLabel = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * DETTE NOMINATIVE DATÉE — spécs de Compétence encore écrites en LIBELLÉ FR de leur propre catalogue.
 * Liste FERMÉE et DÉCROISSANTE : une clé de plus = rouge (régression), une clé périmée = rouge aussi.
 * VIDE depuis 2026-08-30 (L2 #1548, commit 3b) : les 4 `metier|Ingénieur` de `steam-breakdown.json`
 * ont été migrées. La `spec` sentinelle « Au choix » (68 occurrences, `creatures.json`/`stars.json`/
 * `talents.json`) n'entre PAS dans cette mesure : ce n'est pas un libellé de catalogue mais un CHOIX
 * à faire, exclu NOMMÉMENT ci-dessous ; sa migration en `choix: true` est le commit 4bis du lot —
 * les sentinelles de Compétences de créatures.
 */
const SPECS_EN_LIBELLE: { cle: string; date: string; lot: string }[] = [];

/** Sentinelle d'authoring : « au choix » / « Environnement au choix » — un choix, pas une spéc. */
const EST_SENTINELLE_CHOIX = (spec: string): boolean => /au choix/i.test(spec);

function fichiersDeDonnees(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiersDeDonnees(abs));
    else if (e.name.endsWith('.json')) out.push(abs);
  }
  return out;
}

describe('L2 #1548 — aucune `spec` de Compétence écrite en LIBELLÉ (tout `src/data`)', () => {
  /** Par id de Compétence : « cet id résout-il ? » et l'index LIBELLÉ normalisé → id attendu. */
  const CATALOGUE = new Map(skills.map((s) => [
    s.id,
    { def: s, parLabel: new Map(specCatalogOf(s).map((id) => [normLabel(specLabel('skills', s.id, id)), id])) },
  ]));

  const fichiers = fichiersDeDonnees(DOSSIER_DATA);

  it('le walk couvre bien TOUS les datasets JSON (périmètre non vide, non réduit à un fichier)', () => {
    expect(fichiers.length).toBeGreaterThan(100);
  });

  it('toute `spec` adjacente à un id de Compétence est un ID du catalogue ou du TEXTE LIBRE — jamais un libellé', () => {
    const regressions: string[] = [];
    const vues = new Set<string>();
    const walk = (node: unknown, ou: string): void => {
      if (Array.isArray(node)) { node.forEach((x) => walk(x, ou)); return; }
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      const defId = (typeof n.skillId === 'string' && n.skillId)
        || (typeof n.skill === 'string' && n.skill)
        || (typeof n.id === 'string' && n.id) || null;
      const spec = n.spec;
      if (defId && typeof spec === 'string' && CATALOGUE.has(defId) && !EST_SENTINELLE_CHOIX(spec)) {
        const cat = CATALOGUE.get(defId)!;
        const attendu = cat.parLabel.get(normLabel(spec));
        if (attendu && !specResolves(cat.def, spec)) {
          const cle = `${ou}|${defId}|${spec}`;
          if (SPECS_EN_LIBELLE.some((d) => d.cle === cle)) vues.add(cle);
          else regressions.push(`${cle} — LIBELLÉ FR du catalogue (id attendu « ${attendu} ») : \`testValue\` n'appariera aucune spéc possédée`);
        }
      }
      for (const v of Object.values(n)) walk(v, ou);
    };
    for (const abs of fichiers) {
      const ou = abs.slice(DOSSIER_DATA.length).replace(/\\/g, '/');
      let data: unknown;
      try { data = JSON.parse(readFileSync(abs, 'utf8')); } catch { continue; }
      walk(data, ou);
    }
    expect(regressions, regressions.join('\n')).toEqual([]);
    const perimees = SPECS_EN_LIBELLE.filter((d) => !vues.has(d.cle)).map((d) => d.cle);
    expect(perimees, `clé(s) de dette PÉRIMÉE(s) — migrée(s), retirer la ligne :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('chaque ligne de dette porte sa DATE et son LOT', () => {
    expect(SPECS_EN_LIBELLE.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !d.lot?.trim()).map((d) => d.cle)).toEqual([]);
  });
});
