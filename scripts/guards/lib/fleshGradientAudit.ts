/**
 * AUDIT de la CHAIR GRAVÉE dans les tenues (#583 — couture au poignet) — définition UNIQUE, partagée
 * par la garde `src/gameIso/rig/parts/tenues/flesh-gradient.test.ts` et le régénérateur
 * `scripts/rig/regen-flesh-gradient-stock.mts`.
 *
 * `g_flesh` (`fxGradients.ts`) est un dégradé de peau CLAIRE FIXE (`#e8b88e -> #b07a52`), gravé dans
 * une tenue — il ignore la palette de l'espèce (`@peau`/`@peauO`/`@peauH`, résolue par
 * `raceAppearance.json`). Sur un personnage à peau non claire, l'avant-bras/torse peint par la
 * tenue reste clair pendant que le reste du corps (résolu en tokens) prend la bonne teinte : couture
 * visible. Interdiction MÉCANISABLE SANS FAUX POSITIF (`fill="url(#g_flesh)"` est sans ambiguïté —
 * contrairement aux littéraux hex chair, indiscernables à coup sûr du cuir/tissu brun par un
 * détecteur automatique, cf. mesure manuelle #583 : rendu au juge, pas gardé).
 *
 * Ne scanne QUE les TENUES (`TENUE_DEFS`) — aucune occurrence dans `parts/armour/defs/` à la mesure
 * (#583). Étendre le périmètre si une armure en gagne une.
 */
import { TENUE_DEFS } from '../../../src/gameIso/rig/parts/tenues/_registry.generated';
import type { TenueDef } from '../../../src/gameIso/rig/parts/tenues/types';
import type { PartArt } from '../../../src/gameIso/rig/parts/types';
import { slugId } from '../../../src/data/slug';
import { fichierDeDef, REGISTRE_TENUES } from './registreDeDefs';
import type { Site } from './stock.mjs';

export const BODY_SLOTS = ['torse', 'jambes', 'bras', 'tete'] as const;
export type BodySlot = (typeof BODY_SLOTS)[number];
export const VIEWS = ['front', 'back', 'profile'] as const;
export type View = (typeof VIEWS)[number];

const G_FLESH = /url\(#g_flesh\)/;

function viewsOf(art: PartArt): Partial<Record<View, string>> {
  return typeof art === 'string' ? { front: art } : art;
}

/**
 * Un SITE par vue dont l'art contient `fill="…url(#g_flesh)…"` :
 * `{ file: <le def qui grave>, ref: '<tenueId>:<slot>:<vue>' }`. Le FICHIER est dans le site parce
 * qu'un stock ne se relit pas sans lui : c'est lui que la porte de plage voit, et lui que l'artiste
 * doit ouvrir pour migrer vers `@peau*`. `sitesEnEntrees` (`stock.mjs`) l'ordinalise en entrée.
 */
export function auditFleshGradient(defs: readonly TenueDef[] = TENUE_DEFS): Site[] {
  const sites: Site[] = [];
  for (const def of defs) {
    const id = slugId(def.label);
    for (const slot of BODY_SLOTS) {
      const art = def.set[slot];
      if (art == null) continue;
      for (const [view, svg] of Object.entries(viewsOf(art))) {
        if (svg && G_FLESH.test(svg)) sites.push({ file: fichierDeDef(REGISTRE_TENUES, def), ref: `${id}:${slot}:${view}` });
      }
    }
  }
  return sites;
}
