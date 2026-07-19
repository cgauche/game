import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanLabelLogic } from '../../scripts/guards/lib/labelLogic.mjs';

/**
 * Garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc agents) : toute LOGIQUE est
 * keyée par `id` STABLE — le `label` est de l'AFFICHAGE (multilangue). Scanne `src/engine` + `src/state`
 * (moteur/store, #142) + `src/gameIso` + `src/ui` (#289, rendu iso + UI) récursif, `.ts`/`.tsx`, HORS
 * `*.test.*` : ÉCHEC si le code (commentaires retirés) porte, sur `.label`, l'une de TROIS formes —
 * une carte par label (`XXX_BY_LABEL`/`byLabel`), une comparaison D'ÉGALITÉ (`x.label === …` /
 * `… === x.label`), ou un PRÉDICAT (regex `.test(x.label)`, méthode de chaîne `x.label.startsWith(…)`,
 * `switch (x.label)`) — les trois remplacent un `id` STABLE par une identité de libellé.
 *
 * `src/engine`/`src/state` restent TOLÉRANCE ZÉRO, AUCUNE exception (l'instance de référence,
 * `creatureEquip.ts` SHAPE_BY_LABEL/RELOAD_BY_LABEL, est déjà migrée — rien ne justifie un répit
 * dans le moteur/store).
 *
 * `src/gameIso`/`src/ui` (#289, élargissement) portent un ratchet à EXCEPTIONS JUSTIFIÉES
 * (patron `no-emoji-affordance.test.ts`/LOT 4) : un `fichier:ligne` par site, chacun un pattern
 * DIFFÉRENT du FK-par-label originel (#142) — recherche/diagnostic, pas persistance de logique :
 *  - diagnostic DEV qui détecte PRÉCISÉMENT un mésusage label-au-lieu-d'id (comparer par id
 *    annulerait le diagnostic) ;
 *  - saisie/recherche UI par texte tapé (le label EST la clé de recherche humaine, motif `RefField`
 *    freeText déjà sanctionné) sur un type qui ne porte PAS d'id (aucune régression possible) ;
 *  - auto-liage de PROSE par texte (Codex) — matching textuel, pas une FK.
 * Chaque exception se justifie ligne par ligne ; une migration mécanique retire son entrée (CLIQUET).
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const STRICT_DIRS = ['src/engine', 'src/state'];
const RATCHET_DIRS = ['src/gameIso', 'src/ui'];

// `src/data/index.ts` = couture label→id tolérée au CHARGEMENT (conversion depuis du texte) — hors
// périmètre du garde-fou, aucune LOGIQUE keyée par label. (`instanceIdMigration.ts` est SCANNÉ comme
// tout fichier state : sa migration de renommage teste la PRÉSENCE de clé `'label' in o`, pas une
// comparaison de libellé.)
const EXCLUDED = (rel: string) =>
  /\.test\.[tj]sx?$/.test(rel) || rel === 'src/data/index.ts';

// Exceptions JUSTIFIÉES (#289, src/gameIso + src/ui SEULEMENT — src/engine/src/state restent à zéro).
// Une entrée = `fichier:ligne` EXACT constaté au recensement ; toute dérive de ligne ou nettoyage du
// site fait échouer le CLIQUET ci-dessous (à réviser, pas à re-décaler idempotemment). `ligne` est
// celle rapportée par `scanLabelLogic` (contenu POST-retrait des commentaires de bloc, cf.
// `stripComments` — peut différer du numéro de ligne brut du fichier si un bloc `/* … */` multi-lignes
// précède le site).
const RATCHET_EXCEPTIONS: Record<string, string> = {
  'gameIso/rig/parts/equipment.ts:23':
    "isShield (fallback de RENDU rig) — détecte un bouclier d'abord par la Qualité Protectrice ; " +
    "repli texte sur x.label pour un objet custom/legacy dépourvu de cette Qualité. Classification " +
    "VISUELLE (quel gabarit dessiner), pas une FK de logique métier — aucune régression possible.",
  'ui/PartyScreen.tsx:142':
    "CampaignSelect — surligne quelle campagne BUILT-IN correspond à `pendingCampaign` (état PERSISTÉ, " +
    "state/store.ts:552, qui ne porte QU'un `name` — aucun id, #608 Lot 2 en a laissé le champ hors " +
    "périmètre). Highlight d'affichage (bouton « actuelle » désactivé) uniquement : le chargement réel " +
    "(`pick`) route par `c.id` du `key`, pas par cette comparaison. Migrer proprement exigerait un id " +
    "sur `pendingCampaign` (persisté) — lot dédié, pas ce rename.",
  'ui/PartyScreen.tsx:145':
    'Même site que ui/PartyScreen.tsx:142 (branche ternaire du même bouton) — même justification.',
};

// Mécanique de scan (stripComments + BY_LABEL_RX/LABEL_EQ_RX + scanLabelLogic) :
// `scripts/guards/lib/labelLogic.mjs` (module .mjs pur, partagé avec un futur hook pre-commit).

function scanFiles(dirs: string[]): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  for (const d of dirs) walk(join(ROOT, d));
  return files;
}

function findingsIn(dirs: string[]): { rel: string; line: number; detail: string }[] {
  const out: { rel: string; line: number; detail: string }[] = [];
  for (const f of scanFiles(dirs)) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (EXCLUDED(rel)) continue;
    const contenu = readFileSync(f, 'utf8');
    for (const finding of scanLabelLogic(rel, contenu)) out.push({ rel, line: finding.line, detail: finding.detail });
  }
  return out;
}

describe('garde-fou « logique par label interdite » (#142)', () => {
  it('src/engine + src/state : TOLÉRANCE ZÉRO, aucune carte/comparaison par label', () => {
    const offenders = findingsIn(STRICT_DIRS).map((f) => `${f.rel}:${f.line}: ${f.detail}`);
    expect(
      offenders,
      'Logique par LABEL détectée dans src/engine ou src/state — doctrine : `id` stable pour la logique, ' +
        '`label` = affichage seul. Migrer vers un keying par id (cf. `src/data/index.ts` pour la seule ' +
        'couture label→id tolérée, au CHARGEMENT).',
    ).toEqual([]);
  });

  it('src/gameIso + src/ui (#289) : aucune régression hors des exceptions justifiées', () => {
    const offenders: string[] = [];
    for (const f of findingsIn(RATCHET_DIRS)) {
      // `f.rel` est relatif à la racine (`src/gameIso/...`/`src/ui/...`) ; les clés d'exception omettent `src/`.
      const shortKey = `${f.rel.replace(/^src\//, '')}:${f.line}`;
      if (!(shortKey in RATCHET_EXCEPTIONS)) offenders.push(`${f.rel}:${f.line}: ${f.detail}`);
    }
    expect(
      offenders,
      "Logique par LABEL non-exceptée dans src/gameIso/src/ui — migrer vers un keying par id, ou ajouter " +
        'une entrée JUSTIFIÉE à RATCHET_EXCEPTIONS (label-logic-guard.test.ts) :\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  it('CLIQUET : toute exception dont le site a bougé/disparu doit être RETIRÉE ou re-justifiée', () => {
    const findings = findingsIn(RATCHET_DIRS);
    const present = new Set(findings.map((f) => `${f.rel.replace(/^src\//, '')}:${f.line}`));
    const stale = Object.keys(RATCHET_EXCEPTIONS).filter((k) => !present.has(k));
    expect(stale, 'Exception(s) PÉRIMÉE(s) (site déplacé ou assaini) — retirer/re-pointer ces entrées de RATCHET_EXCEPTIONS :\n' + stale.join('\n')).toEqual([]);
  });

  it('scanLabelLogic : détecte un champ d’AFFICHAGE interpolé dans une CLÉ (#598)', () => {
    // Cas PLANTÉ = le motif EXACT qui vivait en `state/triggeredEffects.ts` (Atouts d'arme keyés par
    // LIBELLÉ, corrigé en `weaponIdentity`) : la garde `.label` d'origine n'en voyait NI le champ
    // `name`, NI la construction de clé par littéral de gabarit — c'est ce trou qui l'a laissé vivre.
    const src = [
      'out.push({ effects: w.onHitEffects, cap: 1, key: `weapon:${weapon.name}`, label: weapon.name });',
      'const key = `zone-${zone.label}-${t.x}`;',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2]);
    expect(findings.map((f) => f.rule)).toEqual(['display-key', 'display-key']);
  });

  it('scanLabelLogic : ne flague PAS la LECTURE d’affichage d’un libellé (interpolation de journal)', () => {
    // Contre-épreuve indispensable : ~700 interpolations d'AFFICHAGE existent dans src/ (`${c.name} touche
    // ${d.name}`). Les flaguer rendrait la garde inutilisable — seule la construction d'une CLÉ est visée.
    const src = [
      'log: `${attacker.name} manque ${defender.name}.`,',
      'lines.push(`${f.label} : ${rolled} Moral.`);',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src)).toEqual([]);
  });

  it('scanLabelLogic : détecte un champ d’AFFICHAGE en CLÉ DE COLLECTION (#602)', () => {
    // Cas PLANTÉ = les motifs EXACTS du ticket #602 — `owned` (Set de talents possédés) keyé par LIBELLÉ
    // concret faute d'identité de spécialisation (`engine/character.ts`, corrigé en `refKey(id, spec)`),
    // et un repli d'UI keyé par le nom d'un sous-groupe (`compendium/CompendiumScreen.tsx`).
    const src = [
      'const free = specs.filter((s) => !owned.has(concreteLabel(entry.label, s)));',
      'if (!owned.has(entry.label)) return entry.label;',
      'const open = manualOpen[cl.name] ?? hasActive;',
      'seen.delete(other.label);',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4]);
    expect(findings.map((f) => f.rule)).toEqual(['collection-key', 'collection-key', 'collection-key', 'collection-key']);
  });

  it('scanLabelLogic : ne flague NI la résolution par id NI la CONSTRUCTION d’un index de texte (#602)', () => {
    // Contre-épreuves : (1) lire le libellé d'un lookup PAR ID est l'usage légitime du label (~50 sites
    // dans src/data) ; (2) REMPLIR un index depuis du texte est la conversion label→id tolérée
    // (CLAUDE.md) — auto-liage de prose, import de statbloc —, seule l'INTERROGATION est une décision.
    const src = [
      'return DISEASE_BY_ID.get(id)?.label ?? id;',
      'const l = byId.get(mm.entityId)?.label ?? byId.get(mm.entityId)?.ref;',
      'idx.exact.set(it.label, it);',
      'teamOf.set(named[i].name, named[i].kind === \'hero\' ? \'ally\' : \'enemy\');',
      'roots.add(e.label);',
      'NAME_TO_GROUP[norm(t.label)] = t.subType;',
      '(acc[it.name] ??= { name: it.name, uids: [] }).uids.push(it.uid);',
      '...Object.fromEntries(TRAVEL_VEHICLES.map((v) => [v.id, v.label])),',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src)).toEqual([]);
  });

  it('scanLabelLogic : détecte les prédicats sur `.label` (regex .test, méthode de chaîne, switch)', () => {
    const src = [
      "const isOgre = /ogre/i.test(sp.label);",
      "const isPermanent = !/amputation|cécité|surdité/i.test(t.label);",
      "const isAffaler = eff.label.startsWith('Affaler');",
      "switch (x.label) { case 'A': break; }",
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4]);
  });
});
