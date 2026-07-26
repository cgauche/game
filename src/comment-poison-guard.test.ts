import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXCUSE_GUARD_ACTIVE,
  TOMBSTONE_FAMILIES,
  tombstonesIn,
  untaggedExcuseMatch,
  scanRawClaims,
  scanDecisionClaims,
  extractComments,
  matchLine,
  excerptAt,
} from '../scripts/guards/lib/commentPoison.mjs';

/**
 * Garde-fou commentaires (#136) — l'app détecte elle-même le poison de commentaires (CLAUDE.md règle 6).
 * Deux familles scannées, dans les COMMENTAIRES de `src/**\/*.ts(x)` ET de `scripts/guards/lib/**`
 * (jamais les chaînes ni le texte de scénario) :
 *   1. PIERRE TOMBALE (règle 6c) — rappelle un état de code qui n'existe plus. Tolérance ZÉRO, aucune
 *      liste d'exception : un cas légitime se reformule plutôt que d'être toléré.
 *   2. Commentaire-EXCUSE (règle 6b) — justifie une exception ou une déviation sans validation
 *      traçable. Seul un tag `[entériné AAAA-MM-JJ]` porté par le MÊME commentaire la neutralise.
 * MÉCANIQUE de scan (extraction de commentaires, familles de regex) dans
 * `scripts/guards/lib/commentPoison.mjs` — module .mjs pur, partagé avec un futur hook pre-commit
 * (exécutable par `node` nu, sans tsx), et SOUMIS au scan comme le reste (#828). Ici : uniquement les
 * données de POLICY (EXCUSE_GUARD_ACTIVE), le parcours fs, et les formes plantées en littéraux.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)
const SRC_DIR = join(ROOT, 'src');
// #828 : les gardes sont soumises à la règle qu'elles font respecter — la mécanique de détection est
// scannée par elle-même. Un détecteur qui doit citer un motif le plante en LITTÉRAL DE CHAÎNE ici
// (jamais lu par `extractComments`), il ne l'écrit pas dans sa prose.
const GUARD_LIB_DIR = join(ROOT, 'scripts', 'guards', 'lib');

function scanSrcFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string, exts: RegExp) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p, exts);
      else if (exts.test(e)) files.push(p);
    }
  };
  walk(SRC_DIR, /\.(ts|tsx)$/);
  walk(GUARD_LIB_DIR, /\.(mjs|js|ts)$/);
  return files;
}

// ---------------------------------------------------------------------------------------------
// Famille 1 — PIERRE TOMBALE (CLAUDE.md règle 6c). Tolérance ZÉRO, pas d'exception.
// Familles de regex + `tombstonesIn` : `scripts/guards/lib/commentPoison.mjs` (mécanique partagée).
// ---------------------------------------------------------------------------------------------

describe('garde-fou commentaires — pierres tombales (#136, CLAUDE.md règle 6c)', () => {
  it('cas planté : un rappel d\'ancien emplacement est détecté (preuve TDD)', () => {
    const planted = "// Cette logique vit ici anciennement dans un autre module.";
    expect(tombstonesIn(planted)).toContain('anciennement');
  });

  it('cas planté : "déplacé(e) vers/dans" est détecté même au féminin/pluriel (preuve TDD)', () => {
    expect(tombstonesIn('// Fonction déplacée vers state/foo.ts').length).toBeGreaterThan(0);
    expect(tombstonesIn('// Fonctions déplacées dans state/foo.ts').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "déplacé dans la boîte" (a11y, pas du code — affinage #136)', () => {
    expect(tombstonesIn('// focus déplacé dans la boîte à l\'ouverture.')).toEqual([]);
  });

  it('cas planté : "l\'ancien X a été supprimé" est détecté (preuve TDD affinage #136)', () => {
    expect(tombstonesIn("// L'ancien registre `FOO_BY_LABEL` a été supprimé.").length).toBeGreaterThan(0);
    expect(tombstonesIn('// Le marqueur `(2M)` a été supprimé.').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "une PA/ration a été retirée" (vocabulaire de jeu — affinage #136)', () => {
    expect(tombstonesIn('// RETOURNE true si une PA a été retirée.')).toEqual([]);
    expect(tombstonesIn("// Une ration a été retirée de l'inventaire.")).toEqual([]);
  });

  it('cas planté : "comme avant :" et "avant : «X»" sont détectés (preuve TDD affinage #136)', () => {
    expect(tombstonesIn('// ignorées (comme avant : un libellé non catalogué n\'était pas trouvé).').length).toBeGreaterThan(0);
    expect(tombstonesIn('// doit ouvrir la modale (avant : « hors de portée »)').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "avant" de façade/rendu/entraînement (affinage #136)', () => {
    expect(tombstonesIn("// Cadre d'avant : ARC VU DE CHANT.")).toEqual([]);
    expect(tombstonesIn("// vue de dos (plan avant : couvre le dos, plis)")).toEqual([]);
    expect(tombstonesIn("// qui pointe vers l'avant : sinon de profil la jambe est un poteau nu.")).toEqual([]);
    expect(tombstonesIn('// Espèces mises en avant : celles du Livre de base.')).toEqual([]);
    expect(tombstonesIn('// avant : Esquive pénalisée')).toEqual([]);
    expect(tombstonesIn("// avant : pas d'arme à 2 mains")).toEqual([]);
  });

  it('cas planté : `ex-` nomme un artefact révolu QUELLE QUE SOIT la casse (#828)', () => {
    expect(tombstonesIn("// Mêmes teintes que l'ex-houseWallIso.")).toContain('ex-Nom');
    expect(tombstonesIn("// Reprend la logique de l'ex-mode manœuvre.")).toContain('ex-Nom');
    expect(tombstonesIn('// Promu ici (ex-dupliqué à l’identique dans `qualities.ts`).')).toContain('ex-Nom');
    expect(tombstonesIn("// Ombrée comme l'ex-riser (×0.82).")).toContain('ex-Nom');
    expect(tombstonesIn('// Reprend les champs de l’ex-table PROPS.')).toContain('ex-Nom');
  });

  it('faux positifs écartés : « ex aequo » (locution latine) et tout `ex` NON préfixé (#828)', () => {
    expect(tombstonesIn("// l'ex-aequo de frontière de secteur arrondit au cran horaire suivant.")).toEqual([]);
    expect(tombstonesIn('// Navigation codex-liée : chips vers la fiche.')).toEqual([]);
    expect(tombstonesIn('// index-based : la position dans le tableau fait foi.')).toEqual([]);
  });

  it('cas planté : « l’ancien chemin » désigne du code que le lecteur ne peut plus ouvrir (#828)', () => {
    expect(tombstonesIn("// parité RNG avec l'ancien chemin inline.")).toContain("l'ancien chemin (code disparu)");
    expect(tombstonesIn('// EXACTEMENT le calcul de l’ancien chemin inline.')).toContain("l'ancien chemin (code disparu)");
  });

  it('faux positif écarté : un ancien FORMAT existe encore sur disque (migration — #828)', () => {
    expect(tombstonesIn("// v3 → v4 : les sauvegardes à l'ancien format sont converties au chargement.")).toEqual([]);
    expect(tombstonesIn("// Assainit un document authoré à l'ancien schéma (entrées `null`).")).toEqual([]);
  });

  it('cas planté : « remplace l’ancien X » ne dit que ce qui n’existe plus (#828)', () => {
    expect(tombstonesIn("// Remplace l'ancien marqueur d'affichage `(2M)` re-parsé par regex.")).toContain(
      "remplace l'ancien X",
    );
    expect(tombstonesIn('// Événements STRUCTURÉS — remplacent l’ancien journal en chaînes.')).toContain(
      "remplace l'ancien X",
    );
  });

  it('cas planté : un commentaire neutre ne matche aucune famille (contrôle négatif)', () => {
    expect(tombstonesIn('// Calcule le total des dégâts appliqués à la cible.')).toEqual([]);
  });

  it('aucun commentaire de src/** ni de scripts/guards/lib/** ne porte une pierre tombale (tolérance ZÉRO)', () => {
    const offenders: string[] = [];
    for (const f of scanSrcFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      const text = readFileSync(f, 'utf8');
      for (const c of extractComments(text)) {
        for (const fam of TOMBSTONE_FAMILIES) {
          const m = fam.rx.exec(c.text);
          if (m) offenders.push(`${rel}:${matchLine(c, m.index)} [${fam.label}] ${excerptAt(c, m.index)}`);
        }
      }
    }
    expect(
      offenders,
      `Pierre(s) tombale(s) détectée(s) — à PURGER (jamais à taguer en exception, CLAUDE.md règle 6c) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Famille 2 — commentaire-EXCUSE (CLAUDE.md règle 6b). Un tag `[entériné AAAA-MM-JJ]` dans le MÊME
// commentaire neutralise la détection (décision utilisateur traçable).
// Regex + `untaggedExcuseMatch` : `scripts/guards/lib/commentPoison.mjs` (mécanique partagée).
// ---------------------------------------------------------------------------------------------

describe('garde-fou commentaires — excuses non tracées (#136, CLAUDE.md règle 6b)', () => {
  it('cas planté : une justification sans tag est détectée (preuve TDD)', () => {
    expect(untaggedExcuseMatch("// on garde X pour l'instant")).not.toBeNull();
  });

  it('cas planté : le tag [entériné AAAA-MM-JJ] neutralise la détection (preuve TDD)', () => {
    expect(untaggedExcuseMatch("// on garde X pour l'instant [entériné 2026-07-06]")).toBeNull();
  });

  it('cas planté : un commentaire neutre ne matche pas (contrôle négatif)', () => {
    expect(untaggedExcuseMatch('// Calcule le total des dégâts appliqués à la cible.')).toBeNull();
  });

  it('faux positifs écartés : « pas encore <participe de mécanique> » = état de partie (affinage 2026-07-06)', () => {
    expect(untaggedExcuseMatch('// null = pas encore lancé (rien à re-dériver).')).toBeNull();
    expect(untaggedExcuseMatch('// Round 1 pas encore commencé (sujet HORS-TOUR).')).toBeNull();
    expect(untaggedExcuseMatch('// chargée + pas encore tiré ce Round (Tir rapide).')).toBeNull();
    expect(untaggedExcuseMatch('// pas encore de Contre-sort ce Round.')).toBeNull();
    expect(untaggedExcuseMatch('// Test étendu de Calme pas encore au niveau.')).toBeNull();
  });

  it('faux positifs écartés : « temporairement <durée d\'effet> » et « épargné par <règle> » (affinage 2026-07-06)', () => {
    expect(untaggedExcuseMatch('// Chance accordée temporairement, retirée à expiration.')).toBeNull();
    expect(untaggedExcuseMatch('// temporairement insensible (Détermination, LDB 17).')).toBeNull();
    expect(untaggedExcuseMatch('// les PA magiques sont épargnés par Ulgu.')).toBeNull();
    // Le participe, avec ou sans complément d'objet, reste une excuse : le seul site du dépôt qui
    // aurait bénéficié d'une soustraction « forme transitive » était le commentaire qui l'a demandée
    // (rejeu 2026-07-26 : 1 bénéficiaire sur tout le dépôt) — il a été reformulé, pas exempté.
    expect(untaggedExcuseMatch('// ce cas est épargné, on verra plus tard')).not.toBeNull();
    expect(untaggedExcuseMatch("// on lui épargne la résolution de types.")).not.toBeNull();
  });

  it('affirmation-RAW non ancrée détectée (règle 6a — classe « bélier » 2026-07-06, preuve TDD)', () => {
    // Le verbatim qui a contourné toutes les gardes : thèse sur le RAW, zéro réf, et FAUSSE (ADE II 8 exige l'Équipe).
    expect(scanRawClaims('x.ts', "// mains, via son inventaire/loadout — RAW ne l'exige PAS « servi » en poste pour être manié")).toHaveLength(1);
    expect(scanRawClaims('x.ts', '// arbitrage : laissé au MJ')).toHaveLength(1);
    expect(scanRawClaims('x.ts', '// le RAW est muet sur ce cas')).toHaveLength(1);
  });

  it('affirmation-RAW ANCRÉE à une réf de livre = matériellement vérifiable, pas d\'alerte (preuve TDD)', () => {
    expect(scanRawClaims('x.ts', '// AFFICHAGE (couche UI, hors RAW LDB 16) : icône du registre')).toHaveLength(0);
    expect(scanRawClaims('x.ts', '// cadence laissée au MJ, LDB 13 l.106 — reset au tour')).toHaveLength(0);
    expect(scanRawClaims('x.ts', '// Calcule le total des dégâts appliqués à la cible.')).toHaveLength(0);
  });

  it('revendication d\'autorité SANS trace détectée (classe « servir coûte l\'Action », preuve TDD)', () => {
    expect(scanDecisionClaims('x.ts', '// notre arbitrage : servir la pièce consomme l\'Action')).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', '// choix de modèle assumé pour simplifier la démo')).toHaveLength(1);
  });

  it('SEUL le tag [entériné] trace une revendication (décision utilisateur 2026-07-07) — date/citation/canon/#N ne suffisent PAS', () => {
    expect(scanDecisionClaims('x.ts', '// choix de modèle assumé [entériné 2026-07-07]')).toHaveLength(0);
    expect(scanDecisionClaims('x.ts', '// Décision de design (2026-06-10, retour playtest) : la Peur reste combat-only.')).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', '// arbitrage utilisateur V1 : « pour le moment on ne gère que le combat »')).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', '// choix de design ANCRÉ sur le texte canon : Grande = 2×2')).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', '// arbitrage maison tracé #133, valeur éditable')).toHaveLength(1);
  });

  it('vraies excuses TOUJOURS détectées après affinage (preuve TDD)', () => {
    expect(untaggedExcuseMatch('// pas encore migré vers le registre canonique')).not.toBeNull();
    expect(untaggedExcuseMatch('// paramètre non utilisé pour l\'instant par les appelants')).not.toBeNull();
    expect(untaggedExcuseMatch('// on assume cette exception ici')).not.toBeNull();
  });

  (EXCUSE_GUARD_ACTIVE ? it : it.skip)(
    'aucune excuse de src/** ni de scripts/guards/lib/** sans tag [entériné AAAA-MM-JJ] (ACTIVE depuis #177)',
    () => {
      const offenders: string[] = [];
      for (const f of scanSrcFiles()) {
        const rel = relative(ROOT, f).split('\\').join('/');
        const text = readFileSync(f, 'utf8');
        for (const c of extractComments(text)) {
          const m = untaggedExcuseMatch(c.text);
          if (m) offenders.push(`${rel}:${matchLine(c, m.index)} ${excerptAt(c, m.index)}`);
        }
      }
      expect(
        offenders,
        `Excuse(s) sans tag \`[entériné AAAA-MM-JJ]\` (CLAUDE.md règle 6b) :\n${offenders.join('\n')}`,
      ).toEqual([]);
    },
  );
});
