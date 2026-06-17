import { makePregens } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import { flowFromEffects } from '../../state/flow';
import { findSkill } from '../../data';
import { slugId } from '../../data/slug';
import type { TestScenario } from './_shared';
import type { Combatant, CharKey } from '../../engine/types';

/** Garantit qu'un héros peut TENTER une Compétence d'incantation (avancée ≥ 1, LDB 09). */
function ensureSkill(h: Combatant, name: string, characteristic: CharKey, spec?: string) {
  const skillId = findSkill(name)?.id ?? slugId(name);
  const sk = h.skills.find((s) => s.skillId === skillId && (spec == null || s.spec === spec));
  if (sk) sk.advances = Math.max(sk.advances, 10);
  else h.skills.push({ skillId, spec, characteristic, advances: 10 });
}

const scene = arena({ id: 'test-magie-jalon2', nom: 'Magie — Jalon 2 (Péché, Corruption, ZdE, Surincantation)', w: 16, h: 10, heroStart: { x: 2, y: 4 } });
scene.startMessage =
  'Recette Jalon 2. EXPLORATION : fiche Wilhelmina → Avancement (mémoriser un sort aux PX) ; marchez sur la ' +
  'zone à l’est pour une Influence corruptrice (modale + Sombre Pacte 🩸 ensuite dans tout Test raté). ' +
  'COMBAT (rencontre au centre) : sélectionnez « Explosion » puis cliquez une CASE (gabarit ZdE violet) ; ' +
  'surincantez une Bénédiction (surplus de DR → +Durée/+Cible) ; le Prêtre a 3 Péchés — un dé des unités ≤ 3 ' +
  'sur une Prière déclenche la Colère des dieux même réussie.';

// Influence corruptrice à l'entrée Est (LDB 19) + un grimoire à trouver (learnSpell).
scene.triggers = [
  {
    id: 'trg-corruption',
    rect: { x: 12, y: 2, w: 2, h: 6 },
    once: true,
    flow: flowFromEffects([
      { type: 'journal', text: 'Une malepierre suinte entre les pavés — l’air poisse (Influence corruptrice modérée).' },
      { type: 'corruptionExposure', level: 'moderee', skill: 'Résistance' },
    ]),
  },
];
setEncounters(scene, [
  {
    id: 'enc-jalon2',
    enemies: [
      { ref: 'Zombie', pos: { x: 8, y: 4 } },
      { ref: 'Zombie', pos: { x: 9, y: 4 } },
      { ref: 'Zombie', pos: { x: 9, y: 6 } },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'magie-jalon2',
  order: 14,
  icon: '🕯️',
  title: 'Magie — Jalon 2',
  tests:
    'Péché → Colère sur Prière réussie ; exposition → Corruption (seuil → mutation) ; Sombre Pacte ; ' +
    'ZdE au clic-case (Explosion) ; Surincantation (+Durée/+Cible) ; Incantation Critique (choix) ; mémorisation aux PX.',
  partyNote: 'Wilhelmina (Sorcière : Explosion ZdE, 300 PX, corruption proche du seuil) + Frère Anselm (Prêtre, 3 Péchés)',
  makeParty: () => {
    const P = makePregens();
    const wiz = P.find((p) => p.name.startsWith('Wilhelmina'))!;
    const priest = P.find((p) => p.name.startsWith('Frère Anselm'))!;
    // Sorcière : Explosion (Projectile ZdE) + un Domaine pour la mémorisation + PX à dépenser.
    wiz.talents.push({ talentId: 'magie-des-arcanes', spec: 'Feu', times: 1 });
    if (!wiz.spells?.includes('Explosion')) wiz.spells = ['Explosion', ...(wiz.spells ?? [])];
    if (!wiz.spells?.includes('Armure Aethyrique')) wiz.spells = ['Armure Aethyrique', ...wiz.spells];
    ensureSkill(wiz, 'Langue', 'Int', 'Magick');
    ensureSkill(wiz, 'Focalisation', 'FM', 'Feu');
    wiz.xp = 300;
    wiz.corruption = 5; // proche du seuil BFM+BE → l'exposition peut faire MUTER
    // Prêtre : 3 Péchés → ~30 % de Colère par Prière (dé des unités ≤ 3), même réussie.
    ensureSkill(priest, 'Prière', 'Soc');
    priest.sinPoints = 3;
    return [wiz, priest];
  },
  scene,
  // pas d'autoCombat : on teste l'exploration (exposition, fiche) PUIS le combat via la rencontre.
};
