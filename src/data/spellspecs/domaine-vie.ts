/**
 * Domaine de la Vie (Ghyran) — LDB 48 « Magie des Arcanes (Vie) », 8 sorts.
 * Curation B4 : durcissement de peau (Écorce, charMod), zones de soin (Sang de la Terre) et de
 * ronces (Forêt d'épines), Régénération accordée, jaillissement de terre (téléportation),
 * sustentation magique (Graisse de la terre → op `noHunger`, exempte de la Faim) ; les sorts de
 * fertilité/cartographie restent narratifs. L'attribut de Domaine (Ghyran : purge Exténué/
 * Hémorragique des vivants, dégâts aux morts-vivants) reste assuré par domainAttributes.ts.
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_VIE: SpellSpec[] = [
  {
    label: 'Configuration du terrain',
    // « Vous percevez une carte mentale détaillée des caractéristiques naturelles à portée. » —
    //   perception du terrain (hors combat) : arbitré.
    durationRounds: null, // Spécial
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Configuration du terrain »',
  },
  {
    label: 'Don de Vie',
    // « Une rivière asséchée recoule, un puits redevient potable, un champ atteint sa maturité, un
    //   animal malade guérit… » — régénérescence naturelle : arbitré.
    durationRounds: null, // Spécial
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Don de Vie »',
  },
  {
    label: 'Eau de la terre',
    // « Vous disparaissez dans le sol et réapparaissez au début du prochain round à une distance
    //   pouvant aller jusqu'à votre Force Mentale (+FM par +2 DR). Les ennemis Engagés à votre
    //   apparition gagnent Surpris. Vous ne traversez pas la pierre, mais traversez l'eau. » —
    //   téléportation du lanceur ; le Surpris aux Engagés et la restriction de matière restent journalisés.
    teleportMeters: { charOf: 'FM' },
    teleportPerSL: { every: 2, metersFormula: { charOf: 'FM' } },
    durationRounds: null,
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Eau de la terre »',
  },
  {
    label: 'Écorce',
    // « La cible gagne +2 à son Bonus d'Endurance, mais subit −10 en Agilité et Dextérité. » — +2 BE
    //   modélisé par +20 en Endurance (le Bonus en dérive et les PB max sont recalculés).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Écorce »',
  },
  {
    label: "Forêt d'épines",
    // « Quiconque traverse la zone sans le Talent Magie des Arcanes (Vie) doit réussir un Test
    //   d'Agilité Difficile (−20). Un échec → 1 État Hémorragique et un État Empêtré (Force = votre
    //   FM). » — zone de ronces persistante (disque BFM m) : États à la traversée ; le Test d'Agilité
    //   et la Force de l'entrave restent journalisés.
    persistentZone: {
      shape: 'disc',
      radiusMeters: { bonusOf: 'FM' },
      onCross: { conditions: [{ name: 'Hémorragique' }, { name: 'Empêtré' }] },
    },
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "LDB 48 — Domaine de la Vie « Forêt d'épines »",
  },
  {
    label: 'Graisse de la terre',
    // « La cible n'a pas besoin de manger ou de boire (mais excrète d'un vert intense). » —
    //   sustentation magique (hors combat) : arbitré.
    durationRounds: null, // « (Bonus de Force Mentale) jours »
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Graisse de la terre »',
  },
  {
    label: 'Régénération',
    // « Votre cible gagne le Trait de créature Régénération. »
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Régénération »',
  },
  {
    label: 'Sang de la Terre',
    // « Toutes les créatures en contact direct avec la terre à l'intérieur de la ZdE guérissent d'un
    //   nombre de Blessures égal à votre Bonus de Force Mentale au début de chaque round. » — zone de
    //   soin persistante (disque BFM m, soin récurrent) ; le « pieds nus / contact direct » reste journalisé.
    persistentZone: {
      shape: 'disc',
      radiusMeters: { bonusOf: 'FM' },
      perRound: { heal: { amount: { bonusOf: 'FM' } } },
    },
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Sang de la Terre »',
  },
];
