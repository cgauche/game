/**
 * AUDIT du LITTÉRAL == JETON dans les tenues (#583 point 1) — définition UNIQUE, partagée par la
 * garde `src/gameIso/rig/parts/tenues/palette-literal.test.ts` et le régénérateur
 * `scripts/rig/regen-palette-literal-stock.mts`.
 *
 * Classe de défaut mesurée : un littéral hex (`fill`/`stroke`/`stop-color`) qui vaut EXACTEMENT
 * (distance ZÉRO, insensible à la casse) une valeur déclarée dans la `palette` du MÊME def. Ce
 * littéral devait être le jeton `@<clé>` correspondant — quelle que soit la MATIÈRE peinte (chair,
 * cuir, tissu, plume…), la réponse mécanique est identique. Interdiction MÉCANISABLE SANS FAUX
 * POSITIF : on ne compare QUE contre les valeurs déclarées PAR LE MÊME def (jamais une distance
 * colorimétrique globale — cf. `fleshGradientAudit.ts`, faux positifs confirmés #583).
 *
 * Cas fondateur vérifié (#583) : `Messager` bras.front utilise `@peau`/`@peauO` correctement, mais
 * bras.back/bras.profile recopient `#e2b48c`/`#8c4a28` — exactement `peau`/dérivés de `peauO` du
 * même def. Idem `Naufrageur` (`#8a4f2a` == son `peauO`), `Bailli` (panache de plume == `@peauH`/
 * `@peauO` — CE cas confirme que la matière n'importe pas : plume ou peau, même faute).
 *
 * Ne scanne QUE les TENUES avec une `palette` déclarée non vide (rien à comparer sinon).
 *
 * Clé au grain de l'OCCURRENCE (`slot:vue#n`), pas seulement `slot:vue` (#583 morsure du juge,
 * 2026-07-18) : un `break` au premier match dans une vue DÉJÀ fautive masquait toute occurrence
 * NEUVE ajoutée dans un slot:vue déjà au stock (40 littéraux injectés dans `archer:torse:front`,
 * déjà stocké → 0 clé neuve, garde verte à tort). Chaque occurrence compte désormais sa propre clé.
 *
 * ⚠ Angle mort résiduel du grain `#n` (mesuré, pas grave — la dette n'augmente pas, la classe est
 * déjà stockée) : c'est un RANG dans l'ordre d'apparition, pas une empreinte du littéral lui-même.
 * Remplacer UN littéral fautif par UN AUTRE littéral fautif (toujours == une valeur de `palette`,
 * hex différent) laisse le COMPTE et l'ORDRE inchangés → `neuves=0, perimees=0`, garde verte, alors
 * que le contenu fautif a changé sous la même clé. Cette classe-là (substitution fautif→fautif)
 * n'est PAS couverte par ce détecteur ; seule la DISPARITION d'une occurrence (littéral → jeton)
 * fait bouger le compte.
 */
import { TENUE_DEFS } from '../../../src/gameIso/rig/parts/tenues/_registry.generated';
import type { TenueDef } from '../../../src/gameIso/rig/parts/tenues/types';
import type { PartArt } from '../../../src/gameIso/rig/parts/types';
import { slugId } from '../../../src/data/slug';

export const BODY_SLOTS = ['torse', 'jambes', 'bras', 'tete'] as const;
export type BodySlot = (typeof BODY_SLOTS)[number];
export const VIEWS = ['front', 'back', 'profile'] as const;
export type View = (typeof VIEWS)[number];

const LITERAL = /(?:fill|stroke|stop-color)\s*=\s*("|')(#[0-9a-fA-F]{3,8})\1/g;

function viewsOf(art: PartArt): Partial<Record<View, string>> {
  return typeof art === 'string' ? { front: art } : art;
}

/** `<tenueId>:<slot>:<vue>#<n>` pour CHAQUE occurrence d'un littéral == une valeur de `palette`
 *  (`n` = rang de l'occurrence FAUTIVE dans la vue, base 0 — pas le rang de tout littéral). */
export function auditPaletteLiteral(defs: readonly TenueDef[] = TENUE_DEFS): Set<string> {
  const found = new Set<string>();
  for (const def of defs) {
    const palette = def.palette;
    if (!palette) continue;
    const hexSet = new Set(Object.values(palette).map((v) => v.toLowerCase()));
    if (hexSet.size === 0) continue;
    const id = slugId(def.name);
    for (const slot of BODY_SLOTS) {
      const art = def.set[slot];
      if (art == null) continue;
      for (const [view, svg] of Object.entries(viewsOf(art))) {
        if (!svg) continue;
        LITERAL.lastIndex = 0;
        let m: RegExpExecArray | null;
        let n = 0;
        while ((m = LITERAL.exec(svg))) {
          if (hexSet.has(m[2].toLowerCase())) { found.add(`${id}:${slot}:${view}#${n}`); n++; }
        }
      }
    }
  }
  return found;
}
