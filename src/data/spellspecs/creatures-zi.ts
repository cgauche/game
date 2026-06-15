/**
 * Sorts de créatures du Zoo Impérial (ZI) — Invocations des divinités de tribus/créatures (ex.
 * Déesse-Araignée). Comme les autres specs depuis la migration : MÉTADONNÉES de résolution
 * seulement (ZdE/durée) ; les EFFETS vivent dans `spells.json` (SpellData.effects, éditables au
 * Compendium). `curated: true` = l'entrée existe au registre (gate de couverture).
 */
import { SpellSpec } from '../../engine/spellspec';

export const CREATURES_ZI: SpellSpec[] = [
  {
    label: "Bon Baiser d'la Fosse Noire",
    type: 'Invocation',
    // « Tout ce qui se trouve à (BSoc) mètres du point ciblé […] reçoit 1d10 + DR Dégâts qui ignorent
    //   les PA et subit un État Empoisonné. » — ZdE excluant le lanceur (ennemis de la tribu) ; dégâts
    //   ignorant les PA SEULEMENT → l'op `wounds` (dans spells.json) pose `ignoreTB:false` (BE déduit).
    durationRounds: null,
    zdeRadiusMeters: { bonusOf: 'Soc' },
    zdeExcludesCaster: true,
    curated: true,
    source: "ZI p.10 « Bon Baiser d'la Fosse Noire »",
  },
  {
    label: "Nuée d'Escampette",
    type: 'Invocation',
    // « Toute créature dans la ZdE subit 1 Blessure (ignore BE et PA), +1 par tranche de 2 DR. Tout le
    //   long, malus de -10 à tous les Tests. » — `wounds` (1 + perSL) + `testMod` -10 pour la durée.
    durationRounds: { bonusOf: 'Soc' },
    zdeRadiusMeters: { bonusOf: 'Soc' },
    zdeExcludesCaster: true,
    curated: true,
    source: "ZI « Nuée d'Escampette »",
  },
  {
    label: 'Toile surprise',
    type: 'Invocation',
    // « Fonctionne exactement comme le Miracle de Taal Enchevêtrement » (toile d'araignée) : ZdE →
    //   État Empêtré (+1 par +2 DR) ; Force d'entrave pour se libérer = votre Force Mentale
    //   (MODÉLISÉE via `condition.escapeStrength`, LDB 16 l.61).
    durationRounds: null,
    zdeRadiusMeters: { bonusOf: 'Soc' },
    zdeExcludesCaster: true,
    curated: true,
    source: 'ZI « Toile surprise » (= Enchevêtrement, Taal)',
  },
];
