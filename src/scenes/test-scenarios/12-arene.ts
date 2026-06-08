import { makeArenaParty } from '../../data/pregens';
import { arena } from './_shared';
import type { TestScenario } from './_shared';
import type { Effect, EncounterDef } from '../../state/scene';

/**
 * Arène (#3) — gauntlet : 10 vagues croissantes piochées dans le bestiaire + maître d'arène (= marchand)
 * entre les vagues. 100 % DONNÉES (encounters + dialogue gated par flags), zéro mécanique dédiée.
 * Entre les vagues, le maître permet de : MARCHANDER/ÉVALUER (le butin magique non identifié), DORMIR à
 * l'auberge (Repos payant — RAW LDB 66 : chambre groupe ~20 pistoles ; répétable, anti-abus économique),
 * et MÉDITER pour retrouver la Chance (tous les 3 paliers). Blessures persistantes (attrition).
 */

// Une vague = des ennemis (ref bestiaire + nombre) + un butin optionnel supplémentaire (objet magique…).
const WAVES: { label: string; force: { ref: string; n: number }[]; bonus?: Effect[] }[] = [
  { label: 'Vermine', force: [{ ref: 'Snotling', n: 4 }] },
  { label: 'Charognards', force: [{ ref: 'Chien', n: 3 }, { ref: 'Serpent', n: 1 }] },
  { label: 'Raid gobelin', force: [{ ref: 'Gobelin', n: 3 }, { ref: 'Snotling', n: 1 }] },
  // Palier 4 : butin MAGIQUE — une dague Dévastatrice, NON identifiée (à faire évaluer chez le maître).
  { label: 'Meute', force: [{ ref: 'Loup', n: 3 }, { ref: 'Sanglier', n: 1 }], bonus: [{ type: 'giveTrapping', trapping: 'Dague', qualities: ['Dévastatrice'], identified: false }] },
  { label: 'Charnier', force: [{ ref: 'Squelette', n: 3 }, { ref: 'Goule de crypte', n: 1 }] },
  { label: 'Hommes-bêtes', force: [{ ref: 'Gor', n: 2 }, { ref: 'Ungor', n: 2 }] },
  { label: 'Warband orque', force: [{ ref: 'Orc', n: 2 }, { ref: 'Squig des cavernes', n: 1 }] },
  { label: 'Loups funestes', force: [{ ref: 'Loup funeste', n: 2 }, { ref: 'Orc', n: 1 }] },
  // Palier 9 : butin LÉGENDAIRE — épée bâtarde « De plaies atroces » (ADE2), non identifiée, skin bleuté.
  { label: 'La Brute', force: [{ ref: 'Ogre', n: 1 }, { ref: 'Gobelin', n: 2 }], bonus: [{ type: 'giveTrapping', trapping: 'Épée bâtarde', qualities: ['De plaies atroces'], identified: false, skin: { metal: '#7faaff' } }] },
  { label: 'Le Boss : Troll', force: [{ ref: 'Troll', n: 1 }, { ref: 'Gor', n: 2 }] },
];

// Place les ennemis d'une vague en grille (4 de large) depuis (13,3) — données lisibles, pas de pos à la main.
const place = (force: { ref: string; n: number }[]): EncounterDef['enemies'] =>
  force.flatMap((s) => Array<string>(s.n).fill(s.ref)).map((ref, k) => ({ ref, pos: { x: 13 + (k % 4), y: 3 + Math.floor(k / 4) } }));

const scene = arena({ id: 'test-arene', nom: 'Arène — gauntlet & maître d’arène', w: 18, h: 12, heroStart: { x: 2, y: 6 } });
scene.startMessage = 'L’ARÈNE. Dix vagues vous attendent. Entre chacune : le maître vend, évalue votre butin, loge (payant) et soigne. Survivez.';

scene.entities.push({ id: 'maitre', kind: 'personnage', label: 'Maître d’arène', pos: { x: 9, y: 1 }, dialogueId: 'dlg-arene', merchant: { archetype: 'armurier' } });

// Encounters = vagues. onVictory = butin croissant (or + PX) + butin magique éventuel + flag de
// progression + (tous les 3 paliers) la Chance redevient méditable.
scene.encounters = WAVES.map((w, i) => {
  const n = i + 1;
  const fortuneWave = n % 3 === 0; // paliers 3, 6, 9 → Chance à nouveau dispo
  return {
    id: `wave-${n}`,
    enemies: place(w.force),
    onVictory: [
      { type: 'giveMoney', gold: 8 + i * 4 },
      { type: 'giveXp', amount: 20 + i * 15 },
      ...(w.bonus ?? []),
      { type: 'setFlag', flag: `arene_v${n}` },
      ...(fortuneWave ? [{ type: 'setFlag', flag: 'chance_dispo' } as Effect] : []),
      { type: 'journal', text: n < WAVES.length ? `Vague ${n}/${WAVES.length} (${w.label}) vaincue ! Voyez le maître d’arène.` : 'ARÈNE VAINCUE ! Les dix vagues sont tombées. Champion !' },
    ],
  };
});

// Choix « Lancer la vague N » gated par flags composés (séquence stricte). Généré depuis WAVES (DRY).
const waveChoices = WAVES.map((w, i) => {
  const n = i + 1;
  return {
    text: `⚔️ Vague ${n} : ${w.label}.`,
    condition: n === 1 ? '!arene_v1' : `arene_v${n - 1},!arene_v${n}`,
    effects: [{ type: 'startCombat', encounter: `wave-${n}` } as Effect],
  };
});

scene.dialogues = [
  {
    id: 'dlg-arene',
    start: 'accueil',
    nodes: [
      {
        id: 'accueil',
        speaker: 'Maître d’arène',
        text: 'Repose-toi, équipe-toi, fais évaluer ton butin… puis retourne saigner pour la foule.',
        choices: [
          { text: '🛒 Marchander / faire évaluer / s’équiper.', effects: [{ type: 'openMerchant', entityId: 'maitre' }] },
          // Auberge : Repos PAYANT (RAW LDB 66, grande chambre groupe = 2× privée = 20 pistoles). Répétable.
          { text: '🛏️ Dormir à l’auberge (chambre pour le groupe).', cost: { silver: 20 }, effects: [{ type: 'rest' }] },
          // Chance : seulement quand le maître l'autorise (tous les 3 paliers), puis consommée.
          { text: '🍀 Méditer — retrouver la Chance.', condition: 'chance_dispo', effects: [{ type: 'restoreFortune' }, { type: 'setFlag', flag: 'chance_dispo', value: false }] },
          ...waveChoices,
          { text: '🏆 Savourer ta gloire de champion.', condition: 'arene_v10', effects: [{ type: 'journal', text: 'Le maître s’incline : « CHAMPION DE L’ARÈNE ! »' }, { type: 'endDialogue' }] },
          { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
        ],
      },
    ],
  },
];

// Bourse de départ (nouvelle partie = 0) — de quoi s'équiper et payer quelques nuits.
scene.triggers = [
  { id: 'bourse', rect: { x: 3, y: 4, w: 5, h: 5 }, once: true, effects: [{ type: 'giveMoney', gold: 30 }, { type: 'journal', text: 'L’intendant vous avance 30 couronnes.' }] },
];

export const scenario: TestScenario = {
  id: 'arene',
  order: 12,
  icon: '🏟️',
  title: 'Arène',
  tests: '10 vagues croissantes (bestiaire) + maître d’arène (marchand/évaluation) + Repos payant (RAW) + Chance/3 paliers + butin magique non identifié. 100 % données.',
  partyNote: 'Quatuor showcase (Soldat · Tueur · Sorcier · Chasseur) vs 10 vagues',
  makeParty: () => makeArenaParty(),
  scene,
};
