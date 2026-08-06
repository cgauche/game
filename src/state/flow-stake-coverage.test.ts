/**
 * COUVERTURE de l'id de jet `{flow, phase}` (#1117 L1b) — la garde d'ENSEMBLE qui ferme l'asymétrie
 * laissée par `flowStakeRef(flow: string, phase: string)`.
 *
 * `flowStakeRef` est fail-closed au RUNTIME (une clé inconnue JETTE), mais un throw n'arrive qu'EN
 * JEU : un État qui gagne un `recover` en donnée, ou un pending dont l'union de phase s'élargit,
 * ferait CRASHER sa modale sans qu'aucun test ne rougisse. Cette garde transforme les deux oublis en
 * test rouge, par les deux seules sources d'autorité qui existent :
 *  - le TYPE, pour les phases qui sont une union littérale de pending — `Record<union, true>` : une
 *    valeur ajoutée à l'union et non déclarée ici casse `tsc` (fermeture au compilateur, sans codegen
 *    ; une union TS dérivée du JSON est impraticable — `resolveJsonModule` élargit tout en `string`) ;
 *  - la DONNÉE, pour les phases qui sont des ids de dataset éditable au Codex (`etats.recover`) —
 *    aucune union n'existe au type, la donnée fait foi, dans les DEUX sens.
 *
 * BORD ASSUMÉ — le throw de `flowStakeRef` RESTE, aucun repli sur la fiche de l'État : le repli
 * donnerait le renvoi mais AUCUN texte d'enjeu (la `desc` d'un État décrit l'État, pas ce que le jet
 * met en jeu), donc une zone Z3b muette — exactement l'étape muette que #1117 supprime. Le bon étage
 * pour rattraper l'oubli est CE test, avant le jeu, pas un repli qui le masque à l'écran.
 */
import { describe, it, expect } from 'vitest';
import { FLOW_STAKES, etats } from '../data';
import type { ExposureLevel } from '../engine/corruption';
import type { HealMode } from '../engine/healing';
import type { PendingAppraise, PendingAuContact, PendingDisengage, PendingFall } from './pendings';

/** Phases ATTENDUES par flux, chacune close par le type qui la produit (`Record<union, true>`). */
const PHASES_PAR_TYPE: Record<string, Record<string, true>> = {
  fall: { choice: true, roll: true } satisfies Record<PendingFall['phase'], true>,
  disengage: { choice: true, esquive: true, fuir: true } satisfies Record<PendingDisengage['phase'], true>,
  auContact: { roll: true, choice: true } satisfies Record<PendingAuContact['phase'], true>,
  appraise: { evaluate: true, detect: true } satisfies Record<NonNullable<PendingAppraise['mode']>, true>,
  // Corruption : la phase est le NIVEAU d'exposition, ou `seuil` au franchissement (`PendingCorruption.kind`).
  corruption: { mineure: true, moderee: true, majeure: true, seuil: true } satisfies Record<ExposureLevel | 'seuil', true>,
  // Soin : `PendingHeal.mode` est un `HealMode` PRIVÉ de `surgery`/`recovery` (flux `surgery` dédié,
  // cf. `PendingHeal.mode` — « jamais 'surgery'/'recovery' »). L'exclusion est au TYPE : un mode neuf
  // dans `HealMode` casse `tsc` ici tant qu'il n'est ni déclaré ni exclu.
  heal: { wounds: true, bleed: true, trauma: true, ammo: true } satisfies Record<Exclude<HealMode, 'surgery' | 'recovery'>, true>,
};

const kinds = new Set(FLOW_STAKES.map((e) => `${e.flow}/${e.phase}`));

describe('couverture de l’id de jet {flow, phase} (#1117 L1b)', () => {
  it('chaque phase possible d’un pending câblé a SON entrée d’enjeu', () => {
    const manquantes: string[] = [];
    for (const [flow, phases] of Object.entries(PHASES_PAR_TYPE)) {
      for (const phase of Object.keys(phases)) {
        if (!kinds.has(`${flow}/${phase}`)) manquantes.push(`${flow}/${phase}`);
      }
    }
    expect(manquantes, 'phase atteignable en jeu SANS enjeu — la modale jetterait (flowStakeRef fail-closed)').toEqual([]);
  });

  it('chaque État porteur d’un `recover` en donnée a SON entrée d’enjeu', () => {
    const sans = etats.filter((e) => e.recover).map((e) => e.id).filter((id) => !kinds.has(`recover/${id}`));
    expect(sans, 'État avec `recover` (etats.json, éditable au Codex) sans entrée `recover/<id>` dans flow-stakes.json').toEqual([]);
  });

  it('et réciproquement : aucune entrée `recover/*` MORTE (sans État porteur)', () => {
    const porteurs = new Set(etats.filter((e) => e.recover).map((e) => e.id));
    const mortes = FLOW_STAKES.filter((e) => e.flow === 'recover' && !porteurs.has(e.phase)).map((e) => e.id);
    expect(mortes, 'entrée d’enjeu `recover/*` sans État porteur — l’État a perdu son `recover` ou a été renommé').toEqual([]);
  });
});
