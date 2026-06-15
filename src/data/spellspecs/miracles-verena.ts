/**
 * Miracles de Verena (déesse de la sagesse, de la justice et de la vérité) — LDB 42, 6 miracles.
 * Curation B4 : « Entraves à la vérité » entrave (Empêtré), « Épée de justice » enchante l'épée,
 * « Sagesse de la chouette » aiguise l'esprit (Int + Talents) ; les Miracles de perception/vérité
 * (détecter mensonges/illusions, arracher des réponses, être cru) restent narratifs. Les volets
 * conditionnels (crime commis, fausse accusation → Péché) relèvent de l'arbitrage.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_VERENA: SpellSpec[] = [
  {
    label: 'Entraves à la vérité',
    // « Si la cible a commis un crime et le nie sous le Miracle, elle gagne un État Empêtré non
    //   retirable pour la durée. Si vous l'avez faussement accusée, vous gagnez +1 Péché et lancez sur
    //   la Colère des dieux. » — l'Empêtré est mécanique ; le gate « a menti sur un crime » et le
    //   retour de fausse accusation restent journalisés (arbitrage).
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Verena « Entraves à la vérité »',
  },
  {
    label: 'Épée de justice',
    // « Si vous portez une épée, elle ignore les PA et est Magique. Les adversaires criminels frappés
    //   testent Résistance (+0) ou subissent Inconscient (≥ BSoc rounds). Tout crime commis contre un
    //   inconscient ainsi vous coûte +1 Péché. » — Magique mécanique ; ignore-PA, la condition
    //   « criminel », le Test/Inconscient et le Péché restent journalisés.
    // « …les adversaires criminels frappés testent Résistance (+20) ou subissent Inconscient. » — le
    //   statut « criminel » est porté par le système de Groupes (marquez les PNJ avec le Groupe
    //   « Criminel » dans l'éditeur, comme pour les Traits psy ciblés) → Test à la touche gaté.
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Verena « Épée de justice »',
  },
  {
    label: 'Justice aveugle',
    // « Test de Perception (+0) pour percer Sorts/Miracles d'illusion ; Test d'Intuition (+20) pour
    //   savoir si un interlocuteur ment (croit dire la vérité). » — perception de la vérité : arbitré.
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Verena « Justice aveugle »',
  },
  {
    label: 'La Vérité éclatera',
    // « Posez une question : les cibles y répondent sincèrement, sauf à contester votre DR par un Test
    //   de Calme (+20) — l'ampleur de la résistance dépend des DR. » — interrogatoire divin : arbitré.
    durationRounds: null, // Instantané
    curated: true,
    source: 'LDB 42 — Miracles de Verena « La Vérité éclatera »',
  },
  {
    label: 'Sagesse de la chouette',
    // « +20 à tous les Tests d'Intelligence ; +1 Talent Menaçant et +1 Talent Sens aiguisé (Vue). » —
    //   +20 Int modélisé par un charMod Int (le Bonus en dérive) ; les Talents accordés.
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Verena « Sagesse de la chouette »',
  },
  {
    label: 'Verena est mon témoin',
    // « Tant que vous ne dites que la vérité, tous les auditeurs croient ce que vous dites (sans pour
    //   autant être d'accord avec vos conclusions). » — crédibilité divine : arbitré.
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Verena « Verena est mon témoin »',
  },
];
