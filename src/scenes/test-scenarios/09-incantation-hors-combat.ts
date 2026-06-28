import { pregenParty, PREGEN } from '../../data/pregens';
import { arena } from './_shared';
import { findSkill } from '../../data';
import { slugId } from '../../data/slug';
import type { TestScenario } from './_shared';
import type { Combatant, CharKey } from '../../engine/types';

/** Garantit qu'un héros peut TENTER une Compétence d'incantation (avancée ≥ 1, LDB 09-Compétences) —
 *  fixture de vérif : un pré-tiré peut avoir la Compétence à 0 avance (donc non tentable). */
function ensureSkill(h: Combatant, name: string, characteristic: CharKey, spec?: string) {
  const skillId = findSkill(name)?.id ?? slugId(name);
  const sk = h.skills.find((s) => s.skillId === skillId && (spec == null || s.spec === spec));
  if (sk) sk.advances = Math.max(sk.advances, 5);
  else h.skills.push({ skillId, spec, characteristic, advances: 5 });
}

const scene = arena({ id: 'test-magie-hors-combat', nom: 'Magie — incantation hors combat', w: 14, h: 9, heroStart: { x: 2, y: 4 } });
scene.startMessage =
  'Exploration (aucun combat). Cliquez une fiche de lanceur → section « Sorts » : soignez/bénissez ' +
  'l’allié blessé (Prêtre), puis « ✨ Focaliser » et « 🎲 Lancer » un Sort d’Arcane (Sorcier). ' +
  'Les Projectiles magiques restent marqués « en combat ».';

export const scenario: TestScenario = {
  id: 'magie-hors-combat',
  order: 9,
  category: '✨ Magie',
  icon: '🔮',
  title: 'Magie hors combat',
  tests: 'Incantation HORS COMBAT depuis la fiche : soin/bénédiction (Prêtre), Focalisation + Sort d’Arcane (Sorcier), refus des Projectiles magiques.',
  partyNote: 'Wilhelmina (Sorcier, +Armure Aethyrique, blessée) + Frère Anselm (Prêtre)',
  makeParty: () => {
    const [wiz, priest] = pregenParty(PREGEN.sorcier, PREGEN.pretre);
    // Sorcier : ajoute un Sort d'Arcane FOCALISABLE (les sorts pré-tirés Fléchette/Choc sont de la
    // Magie mineure, NON focalisable) pour exercer le bouton « ✨ Focaliser » hors combat.
    if (!wiz.spells?.includes('armure-aethyrique')) wiz.spells = ['armure-aethyrique', ...(wiz.spells ?? [])];
    ensureSkill(wiz, 'Langue', 'Int', 'Magick'); // incantation des Arcanes
    ensureSkill(wiz, 'Focalisation', 'FM'); // Test étendu de Focalisation
    ensureSkill(priest, 'Prière', 'Soc'); // Bénédictions
    // Un allié BLESSÉ → cible visible pour la Bénédiction de Guérison (+1 PB) du Prêtre.
    wiz.wounds.current = Math.max(1, wiz.wounds.max - 4);
    return [wiz, priest];
  },
  scene,
  // pas d'autoCombat : on teste l'incantation EN EXPLORATION (depuis la fiche de personnage).
};
