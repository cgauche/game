import { describe, it, expect } from 'vitest';
import { skills, talents, careerLevels, species, stars, specPoolOf, specResolves, specEntryId } from './index';
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
  'careerLevels|bon-marcheur|Montagnes',
  'careerLevels|sans-peur|Cavalerie',
  'careerLevels|sans-peur|Chaos',
  'careerLevels|sans-peur|Grandes bêtes',
  'careerLevels|sans-peur|Tout',
  'careerLevels|savoir-vivre|Érudit',
  'careerLevels|savoir-vivre|Mercenaires',
  'careerLevels|savoir-vivre|Minus',
  'species|maitre-artisan|Fermiers',
  'species|savoir-vivre|Guilde',
  'species|savoir-vivre|Soldat',
  'talents(passive/grantCareerSkill)|charme|Mendicité',
  'talents(passive/grantCareerSkill)|savoir|Apothicaire',
  'tavernGames|savoir|Art de la Guerre',
];

const DEF_BY_ID = new Map(DEFS.map((d) => [d.id, d]));

/** Toutes les refs `(defId, spec)` d'une porte joueur. La clé de def se lit d'ABORD sur les champs
 *  QUALIFIÉS (`skillId`/`talentId`/`skill`) : un nœud porteur d'un `id` À LUI (jeu de taverne,
 *  Activité) attribuerait sinon sa `spec` à son propre id. */
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
