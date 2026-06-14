/**
 * Domaine de la Vie (Ghyran) — LDB 48 « Magie des Arcanes (Vie) », 8 sorts.
 * Curation B4 : durcissement de peau (Écorce, charMod), zones de soin (Sang de la Terre) et de
 * ronces (Forêt d'épines), Régénération accordée, jaillissement de terre (téléportation) ; les
 * sorts de fertilité/cartographie/sustentation restent narratifs. L'attribut de Domaine (Ghyran :
 * purge Exténué/Hémorragique des vivants, dégâts aux morts-vivants) reste assuré par
 * domainAttributes.ts. Aucune op nouvelle (ZoneEffect.heal est un champ de zone).
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_VIE: SpellSpec[] = [
  {
    label: 'Configuration du terrain',
    // « Vous percevez une carte mentale détaillée des caractéristiques naturelles à portée. » —
    //   perception du terrain (hors combat) : arbitré.
    ops: [{ op: 'narrative', text: 'Configuration du terrain : après 1 minute de communion, vous percevez une carte mentale des reliefs/forêts/rivières naturels à portée (les zones habitées restent floues) — arbitrage MJ.' }],
    durationRounds: null, // Spécial
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Configuration du terrain »',
  },
  {
    label: 'Don de Vie',
    // « Une rivière asséchée recoule, un puits redevient potable, un champ atteint sa maturité, un
    //   animal malade guérit… » — régénérescence naturelle : arbitré.
    ops: [{ op: 'narrative', text: 'Don de Vie : une rivière/un puits asséché renaît, un champ fructifie immédiatement, ou un animal malade guérit complètement — arbitrage MJ.' }],
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
    ops: [{ op: 'narrative', text: 'Eau de la terre : vous jaillissez du sol — les ennemis que vous Engagez à l’arrivée gagnent l’État Surpris ; vous ne traversez pas la pierre (mais l’eau, oui) — arbitrage MJ.' }],
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
    ops: [
      { op: 'charMod', char: 'E', mod: 20 },
      { op: 'charMod', char: 'Ag', mod: -10 },
      { op: 'charMod', char: 'Dex', mod: -10 },
    ],
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
    ops: [{ op: 'narrative', text: 'Forêt d’épines : traverser la zone sans le Talent Magie des Arcanes (Vie) impose un Test d’Agilité Difficile (−20) ; l’Empêtré subi utilise votre Force Mentale comme Force d’entrave — arbitrage MJ.' }],
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
    ops: [{ op: 'narrative', text: 'Graisse de la terre : pour la durée (jours), la cible n’a pas besoin de manger ni de boire — arbitrage MJ.' }],
    durationRounds: null, // « (Bonus de Force Mentale) jours »
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Graisse de la terre »',
  },
  {
    label: 'Régénération',
    // « Votre cible gagne le Trait de créature Régénération. »
    ops: [{ op: 'grantTrait', trait: 'Régénération' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Vie « Régénération »',
  },
  {
    label: 'Sang de la Terre',
    // « Toutes les créatures en contact direct avec la terre à l'intérieur de la ZdE guérissent d'un
    //   nombre de Blessures égal à votre Bonus de Force Mentale au début de chaque round. » — zone de
    //   soin persistante (disque BFM m, soin récurrent) ; le « pieds nus / contact direct » reste journalisé.
    ops: [{ op: 'narrative', text: 'Sang de la Terre : seules les créatures en contact direct avec la terre (et vous, debout pieds nus) bénéficient du soin — arbitrage MJ.' }],
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
