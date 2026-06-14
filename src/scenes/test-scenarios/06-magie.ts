import { makePregens } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';
import type { Combatant, CharKey, SkillInstance } from '../../engine/types';

const scene = arena({ id: 'test-magie', nom: 'Magie — sorcière elfe & prêtres', w: 18, h: 12, heroStart: { x: 2, y: 6 } });
scene.startMessage = 'Casters de haut niveau : invoquez (Réanimation, Hurlement du loup), enchantez, drainez, corrompez.';
setEncounters(scene, [
  {
    id: 'enc-magie',
    enemies: [
      { ref: 'Zombie', pos: { x: 12, y: 4 } },
      { ref: 'Zombie', pos: { x: 12, y: 8 } },
      { ref: 'Bandit de Grand Chemin', pos: { x: 13, y: 6 } },
      { ref: 'Bandit de Grand Chemin', pos: { x: 14, y: 5 } },
    ],
  },
]);

/** Deep-clone d'un pré-tiré (données pures) pour le bricoler sans toucher la base. */
const clone = (c: Combatant): Combatant => JSON.parse(JSON.stringify(c)) as Combatant;

/** Monte (ou ajoute) une Compétence d'incantation à un niveau d'avances donné. */
function boostSkill(c: Combatant, name: string, spec: string | undefined, characteristic: CharKey, advances: number): void {
  const s = c.skills.find((x) => x.name === name && (spec == null || x.spec === spec));
  if (s) s.advances = Math.max(s.advances, advances);
  else c.skills.push({ name, spec, characteristic, advances } as SkillInstance);
}

const setChars = (c: Combatant, over: Partial<Record<CharKey, number>>) => {
  for (const [k, v] of Object.entries(over)) c.characteristics[k as CharKey] = v as number;
};

/**
 * Test « Magie » de haut niveau (recette B4) — la composition couvre TOUTES les familles de sorts
 * curées : une Haute Sorcière elfe MULTI-DOMAINE (RAW : un sorcier elfe maîtrise plusieurs Vents)
 * pour l'arcane + la Nécromancie (invocations), et deux Prêtres (Sigmar guerrier + Ulric, qui
 * invoque le loup blanc). Caractéristiques/avances gonflées pour que les NI élevés passent.
 */
function makeMagicParty(): Combatant[] {
  const P = makePregens();
  const wil = P.find((p) => p.id === 'pregen-707')!; // Sorcier (Langue (Magick))
  const ans = P.find((p) => p.id === 'pregen-808')!; // Prêtre (Prière)
  const tueur = P.find((p) => p.id === 'pregen-202')!; // Tueur (mêlée, allié martial)

  // — Haute Sorcière elfe : arcane multi-domaine + Nécromancie (invocations) —
  const sorc = clone(wil);
  sorc.id = 'sc-elfe';
  sorc.name = 'Aelindra, Haute Sorcière';
  setChars(sorc, { Int: 75, FM: 70, Ag: 58, Dex: 52, I: 62, E: 45 });
  sorc.wounds = { current: 18, max: 18, base: 18 };
  sorc.fate = 4; sorc.fortune = 4; sorc.resilience = 3; sorc.resolve = 3;
  boostSkill(sorc, 'Langue', 'Magick', 'Int', 55);
  for (const dom of ['Feu', 'Mort', 'Cieux', 'Bête', 'Vie']) boostSkill(sorc, 'Focalisation', dom, 'FM', 40);
  sorc.talents = [
    ...sorc.talents,
    { name: 'Magie des Arcanes (Feu)', times: 1 },
    { name: 'Magie des Arcanes (Mort)', times: 1 },
    { name: 'Magie des Arcanes (Cieux)', times: 1 },
    { name: 'Magie des Arcanes (Bête)', times: 1 },
    { name: 'Magie des Arcanes (Vie)', times: 1 },
  ];
  sorc.spells = [
    'Fléchette', 'Téléportation', 'Armure Aethyrique', // mineure + arcanes communs
    "Grands feux d'U'Zhul", // Feu — zone persistante
    'Caresse de Laniph', 'Vol de vie', 'Le Voile violet de Shyish', // Mort — drains + voile
    "Arc de T'Essla", "Le Premier Signe d'Amul", // Cieux — missile + Chance
    "La lance d'Ambre", // Bête — missile perçant
    'Sang de la Terre', // Vie — zone de soin
    'Réanimation', 'Relever les morts', // Nécromancie — INVOCATIONS liées au sorcier
    'Feu rose de Tzeentch', // Chaos — missile + En flammes
  ];
  sorc.appearance = { species: 'Hauts Elfes', sex: 'F', build: 0.38 };
  sorc.species = 'Hauts Elfes';
  sorc.pos = { x: 2, y: 5 };

  // — Grand Prêtre de Sigmar : bénédictions + Comète + marteau enchanté —
  const sigmar = clone(ans);
  sigmar.id = 'pr-sigmar';
  sigmar.name = 'Frère Anselm, Grand Prêtre';
  setChars(sigmar, { Soc: 68, FM: 60, F: 45, E: 45 });
  sigmar.fate = 3; sigmar.fortune = 3;
  boostSkill(sigmar, 'Prière', undefined, 'Soc', 50);
  sigmar.spells = [
    'Bénédiction de Guérison', 'Bénédiction de Bataille', 'Bénédiction de Courage',
    'Comète à Deux Queues', 'Marteau ardent de Sigmar', 'Flambeau de Vertu', 'Vaincre les impies',
  ];
  sigmar.pos = { x: 2, y: 6 };

  // — Prêtre d'Ulric : invoque le loup blanc + Frénésie + châtiment —
  const ulric = clone(ans);
  ulric.id = 'pr-ulric';
  ulric.name = "Wulfric, Prêtre d'Ulric";
  setChars(ulric, { Soc: 66, FM: 58, F: 48, E: 48 });
  ulric.fate = 3; ulric.fortune = 3;
  boostSkill(ulric, 'Prière', undefined, 'Soc', 48);
  ulric.spells = [
    'Hurlement du loup', "Fureur d'Ulric", 'Frisson du givre',
    'Jugement du Roi de la neige', "Morsure de l'hiver", 'Bénédiction de Guérison',
  ];
  ulric.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.62 };
  ulric.pos = { x: 2, y: 7 };

  const grunni = clone(tueur);
  grunni.pos = { x: 3, y: 6 };

  return [sorc, sigmar, ulric, grunni];
}

export const scenario: TestScenario = {
  id: 'magie',
  order: 6,
  icon: '✨',
  title: 'Magie',
  tests: 'Toutes les familles curées (B4) : invocations, drains, enchantements, zones, Corruption, Chance.',
  partyNote: 'Aelindra (Haute Sorcière elfe, multi-domaine + Nécromancie) + Prêtres de Sigmar & Ulric + Tueur',
  makeParty: makeMagicParty,
  scene,
  autoCombat: 'enc-magie',
};
