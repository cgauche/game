import { makePregens } from '../../data/pregens';
import { spells } from '../../data';
import { blessingsOf, miraclesOf } from '../../engine/cults/registry';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';
import type { Combatant, CharKey, SkillInstance, TalentInstance } from '../../engine/types';

const scene = arena({ id: 'test-magie', nom: 'Magie — sorcière elfe & prêtres', w: 18, h: 12, heroStart: { x: 2, y: 6 } });
scene.startMessage = 'Casters de haut niveau : invoquez (Réanimation, Hurlement du loup), enchantez, drainez, corrompez.';
// Ennemis VIVANTS uniquement (pas de Mort-vivant) → aucun Test de Peur au début de combat, qui
// interromprait la recette des sorts. La Nécromancie reste testable : les invoqués sont des ALLIÉS.
setEncounters(scene, [
  {
    id: 'enc-magie',
    enemies: [
      { ref: 'Bandit de Grand Chemin', pos: { x: 12, y: 4 } },
      { ref: 'Bandit de Grand Chemin', pos: { x: 14, y: 5 } },
      { ref: 'Loup', pos: { x: 12, y: 8 } },
      { ref: 'Loup', pos: { x: 13, y: 6 } },
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

/** Ajoute des Talents (libellés concrets) sans doublon. */
function addTalents(c: Combatant, names: string[]): void {
  for (const name of names) if (!c.talents.some((t) => t.name === name)) c.talents.push({ name, times: 1 } as TalentInstance);
}

/** Labels des sorts d'un type (+ sous-type optionnel) depuis la base. */
const spellsOf = (type: string, subTypes?: (string | null)[]): string[] =>
  spells.filter((s) => s.type === type && (!subTypes || subTypes.includes(s.subType ?? null))).map((s) => s.label);

/** Prêtre COMPLET d'un culte : Prière + Béni/Invocation (Culte) + TOUTES ses Bénédictions ET Miracles. */
function makePriest(base: Combatant, id: string, name: string, cult: string, chars: Partial<Record<CharKey, number>>): Combatant {
  const p = clone(base);
  p.id = id; p.name = name;
  setChars(p, chars);
  p.fate = 3; p.fortune = 3;
  boostSkill(p, 'Prière', undefined, 'Soc', 50);
  addTalents(p, [`Béni (${cult})`, `Invocation (${cult})`]);
  p.spells = [...blessingsOf(cult), ...miraclesOf(cult)]; // roster COMPLET du culte (data-driven)
  return p;
}

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
  const tueur = P.find((p) => p.id === 'pregen-202')!; // Tueur (mêlée, allié martial / cible d'enchantement)

  // — Haute Sorcière elfe : arcane multi-domaine COMPLET + Nécromancie (invocations) —
  const ARC_DOMAINS = ['Feu', 'Mort', 'Cieux', 'Bête', 'Vie'];
  const sorc = clone(wil);
  sorc.id = 'sc-elfe';
  sorc.name = 'Aelindra, Haute Sorcière';
  setChars(sorc, { Int: 75, FM: 70, Ag: 58, Dex: 52, I: 62, E: 45 });
  sorc.wounds = { current: 18, max: 18, base: 18 };
  sorc.fate = 4; sorc.fortune = 4; sorc.resilience = 3; sorc.resolve = 3;
  boostSkill(sorc, 'Langue', 'Magick', 'Int', 55);
  for (const dom of ARC_DOMAINS) boostSkill(sorc, 'Focalisation', dom, 'FM', 40);
  addTalents(sorc, ['Magie mineure', ...ARC_DOMAINS.map((d) => `Magie des Arcanes (${d})`), 'Nécromancie']);
  // Roster COMPLET (data-driven) : Magie mineure + Arcanes communs + ses 5 Domaines + Nécromancie.
  sorc.spells = [
    ...spellsOf('Magie mineure'),
    ...spellsOf('Magie des Arcanes', [null, ...ARC_DOMAINS, 'Nécromancie']),
  ];
  sorc.appearance = { species: 'Hauts Elfes', sex: 'F', build: 0.38 };
  sorc.species = 'Hauts Elfes';
  sorc.pos = { x: 2, y: 5 };

  // — Prêtres COMPLETS (toutes leurs Bénédictions ET Miracles, talents de culte) —
  const sigmar = makePriest(ans, 'pr-sigmar', 'Frère Anselm, Grand Prêtre', 'Sigmar', { Soc: 68, FM: 60, F: 45, E: 45 });
  sigmar.pos = { x: 2, y: 6 };
  const ulric = makePriest(ans, 'pr-ulric', "Wulfric, Prêtre d'Ulric", 'Ulric', { Soc: 66, FM: 58, F: 48, E: 48 });
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
