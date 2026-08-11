/**
 * LES CONSTRUCTEURS DE LA PORTE (#1262 lot 0) — `monoStep`, `tableStep`/`tableStepDone`, `hostStep`,
 * les portes d'APPEND (`push*`) et `openSequence`. Ce que ces tests verrouillent :
 *  - la MARQUE d'étape est REQUISE : un littéral nu ne franchit ni le type ni `openSequence` ;
 *  - une étape hôte ne s'ouvre PAS sans le `pending*` qui porte sa donnée (fenêtre fantôme) ;
 *  - une étape mono sans cible ne s'ouvre pas (elle serait validée sans qu'aucun dé ne tombe) ;
 *  - table À POSER et table RÉSOLUE sont DEUX entrées, et la résolue fait descendre l'enjeu ;
 *  - la voie d'APPEND passe par la garde de possession et distingue ses ids par l'index.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import {
  monoStep, tableStep, tableStepDone, hostStep, openSequence,
  pushMono, pushChoice, pushHost, pushTable, pushTableDone, pushBand,
  type BuiltCascadeStep, type HostJet, type HostSpec,
} from './rollSeam';
import { pushStep, registerTableStep, stepInteraction } from './cascade';
import { pushCombatStep } from './combatEffects';
import { modalOwnerOf } from './modalArbiter';
import { ownsLocally, seatOwns } from './netOwnership';
import type { PendingKey } from './stateFields';
import type { CascadeStep } from './pendings';
import type { Combatant, Weapon } from '../engine/types';

const hero = (id: string): Combatant =>
  ({
    id, label: `Héros ${id}`, kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    skills: [], conditions: [], talents: [], fortune: 2, resilience: 3,
  }) as unknown as Combatant;

const TABLE = 'test-mints-table';

beforeEach(() => {
  useGame.setState({ battle: null, party: [hero('H1')], pendingCascade: null, suspendedCascades: [] } as never);
  useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {} } } as never);
  registerTableStep(TABLE, {
    label: 'Table des mints',
    rows: [{ min: 1, max: 50, id: 'basse' }, { min: 51, max: 100, id: 'haute' }],
    lines: (die) => [`ligne ${die}`],
    entryCategory: 'mutations',
  });
});

const etapes = (): CascadeStep[] => useGame.getState().pendingCascade?.participants ?? [];

describe('#1262 — monoStep : un porteur, un jet, une cible', () => {
  it('pose la POSSESSION et la SURFACE, et monte sa ligne par le monteur canonique', () => {
    const step = monoStep({ id: 'calme', kind: 'psych', label: 'Garder son calme', actor: hero('H1'), difficulty: 'intermediaire', ligne: { test: { char: 'force-mentale' } } })!;
    expect(step.actorId, 'le mint NOMME le porteur — c’est ce qui donne à l’arbitre un owner à router (sans lui : fenêtre hôte seul)').toBe('H1');
    expect(step.interactive).toBe(true);
    expect(step.result, 'le dé n’est pas tombé : c’est la fenêtre qui le jette').toBeNull();
    expect(step.target, 'FM 40, Difficulté intermédiaire +0').toBe(40);
    expect(step.base).toBe(40);
    expect(step.rollLabel, 'la ligne NOMME la Compétence dérivée du catalogue').toBe('Force Mentale');
    expect(stepInteraction(step)).toBe('jet');
  });

  it('cible NON CALCULABLE → refusé (DEV : throw) : une étape sans cible serait « prête » d’office', () => {
    expect(() => monoStep({
      id: 'fantome', kind: 'k', label: 'L', actor: hero('H1'), difficulty: 'intermediaire',
      ligne: { valeur: Number.NaN, valeurEtrangere: true },
    })).toThrow(/cible non calculable/);
  });

  it('les slots HYBRIDES (révélation, lignes de conséquence) voyagent tels quels', () => {
    const step = monoStep({
      id: 'h', kind: 'k', label: 'L', actor: hero('H1'), difficulty: 'intermediaire',
      reveal: { kind: 'effet', title: 'Ce qui vient d’arriver', lines: ['a'] },
    })!;
    expect(step.reveal!.title).toBe('Ce qui vient d’arriver');
  });
});

describe('#1262 — tableStep / tableStepDone : DEUX entrées, jamais un drapeau', () => {
  it('table À POSER : le dé n’est pas tombé, l’interaction est `table`', () => {
    const step = tableStep({ id: 'tir', kind: 'mutation', label: 'Tirage', actorId: 'H1', table: { tableId: TABLE } })!;
    expect(step.table!.result).toBeUndefined();
    expect(stepInteraction(step)).toBe('table');
    expect(step.actorId).toBe('H1');
  });

  it('table À POSER portant DÉJÀ un résultat → refusée (le dé serait re-jeté par la fenêtre)', () => {
    expect(() => tableStep({
      id: 'tir', kind: 'mutation', label: 'Tirage', actorId: 'H1',
      table: { tableId: TABLE, result: { roll: 60, die: 60, id: 'haute', lines: ['x'] } },
    })).toThrow(/tableStepDone/);
  });

  it('table RÉSOLUE : le résultat est posé, et l’ENJEU descend à la LIGNE tirée (jamais au seul `kind`)', () => {
    const step = tableStepDone({
      id: 'fait', kind: 'mutation', label: 'Tirage', actorId: 'H1',
      table: { tableId: TABLE },
      result: { roll: 60, die: 60, id: 'haute', lines: ['ligne 60'] },
      stake: { key: { dataset: 'combat', kind: 'mutation' } },
    })!;
    expect(step.table!.result!.id).toBe('haute');
    expect(stepInteraction(step), 'une table résolue s’affiche, elle ne se retire pas').toBe('affichage');
    expect(step.stake!.key.entryId, 'la ligne jouée, pas le kind').toBe('haute');
    expect(step.stake!.key.entryCategory, 'catégorie DÉCLARÉE PAR LA TABLE').toBe('mutations');
  });
});

/** Miroir de `PENDING_BY_JET` (privé au mint) — TOTAL par le type : un `jet` de plus dans l'union
 *  ne compile plus sans sa ligne ici, comme dans le mint. */
const SLOT_ATTENDU: Record<HostJet, PendingKey | null> = {
  attack: 'pendingAttack',
  trample: 'pendingTrample',
  defense: 'pendingDefense',
  fumble: null,
  cast: 'pendingCast',
  test: 'pendingTest',
  extended: 'pendingExtendedTest',
  disengage: 'pendingDisengage',
  forceDoor: 'pendingForceDoor',
};

const ARME = { label: 'Épée', damage: 4 } as unknown as Weapon;

describe('#1262 — hostStep : jamais de fenêtre sans la donnée qu’elle rend', () => {
  it('les NEUF jets sont couverts (union fermée × table totale)', () => {
    expect(Object.keys(SLOT_ATTENDU)).toHaveLength(9);
  });

  for (const [jet, slot] of Object.entries(SLOT_ATTENDU) as [HostJet, PendingKey | null][]) {
    if (!slot) continue;
    it(`jet:'${jet}' sans \`${slot}\` → refusé (DEV : throw) — la cadence auto validerait la fenêtre à vide`, () => {
      expect(() => hostStep(useGame.getState, { id: 'h', kind: 'k', jet, actorId: 'H1' } as never)).toThrow(new RegExp(slot));
    });

    it(`jet:'${jet}' avec son \`${slot}\` posé → étape hôte montée`, () => {
      useGame.setState({ [slot]: { marqueur: true } } as never);
      const step = hostStep(useGame.getState, { id: 'h', kind: 'k', jet, actorId: 'H1' } as never)!;
      expect(step.jet).toBe(jet);
      expect(step.actorId).toBe('H1');
      useGame.setState({ [slot]: null } as never);
    });
  }

  it('jet:\'fumble\' : aucun pending à attendre, sa charge vit SUR l’étape', () => {
    const step = hostStep(useGame.getState, { id: 'f', kind: 'fumbleJet', jet: 'fumble', actorId: 'H1', fumble: { weapon: ARME, result: null } })!;
    expect(step.fumble!.weapon.label).toBe('Épée');
  });

  it('jet:\'fumble\' SANS sa charge → refusé au TYPE (union discriminée)', () => {
    // @ts-expect-error — `fumble` requis par la branche `jet:'fumble'`
    const nu: HostSpec = { id: 'f', kind: 'fumbleJet', jet: 'fumble', actorId: 'H1' };
    expect(nu.jet).toBe('fumble');
  });

  it('une charge de Maladresse sur un AUTRE jet est inexprimable', () => {
    // @ts-expect-error — `fumble` interdit hors de sa branche
    const croise: HostSpec = { id: 'x', kind: 'k', jet: 'attack', actorId: 'H1', fumble: { weapon: ARME, result: null } };
    expect(croise.jet).toBe('attack');
  });

  it('`groupOwner` est le SEUL canal de possession partagée de la famille (moment de cast partagé)', () => {
    useGame.setState({ pendingCast: { marqueur: true } } as never);
    const step = hostStep(useGame.getState, { id: 'c', kind: 'cast', jet: 'cast', actorId: 'H1', groupOwner: true })!;
    expect(step.groupOwner).toBe(true);
    useGame.setState({ pendingCast: null } as never);
  });
});

describe('#1262 — la MARQUE mure la porte', () => {
  it('un littéral nu n’est PAS une étape mintée', () => {
    // @ts-expect-error — marque absente
    const nu: BuiltCascadeStep = { id: 'e', kind: 'k', label: 'L', interactive: true };
    expect(nu.id).toBe('e');
  });

  it('`openSequence` refuse un littéral monté à la main (le contrôle du juge)', () => {
    // @ts-expect-error — `steps` n'accepte que des étapes MINTÉES
    openSequence(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [{ id: 'e', kind: 'k', label: 'L', interactive: true }] });
    expect(true).toBe(true);
  });

  it('`openSequence` ouvre la séquence d’une étape MINTÉE', () => {
    const step = monoStep({ id: 'm', kind: 'k', label: 'L', actor: hero('H1'), difficulty: 'intermediaire' })!;
    openSequence(useGame.getState, useGame.setState, { title: 'Titre', purpose: 'test', steps: [step] });
    expect(useGame.getState().pendingCascade!.title).toBe('Titre');
    expect(etapes()).toHaveLength(1);
  });

  /**
   * LE MURAGE DE LA VAGUE COMBAT (#1262 B4) — `pushCombatStep` est le point d'append historique des
   * étapes de combat. Retypé à la MARQUE, il ne prend plus que ce qu'un mint a monté : le site qui
   * bâtirait son étape à la main NE COMPILE PLUS, dans les deux formes (déclaration directe ET
   * fabrique indexée). Le verrou est celui du COMPILATEUR : c'est la ligne `@ts-expect-error` qui
   * l'atteste (sans l'erreur attendue, `tsc` échoue) — l'exécution, elle, ignore les types, et l'étape
   * atterrit bel et bien dans la séquence. Ce qui suit le mesure, pour ne rien promettre de plus.
   */
  it('`pushCombatStep` refuse au TYPE un littéral d’étape monté à la main', () => {
    // @ts-expect-error — `step` n'accepte que des étapes MINTÉES (marque absente)
    pushCombatStep(useGame.setState, { id: 'e', kind: 'k', label: 'L', actorId: 'H1', interactive: true });
    expect(etapes().map((s) => s.id)).toEqual(['e']);
  });

  it('`pushCombatStep` refuse au TYPE la FABRIQUE qui rend un littéral', () => {
    // @ts-expect-error — la fabrique doit rendre une étape MINTÉE
    pushCombatStep(useGame.setState, (index: number) => ({ id: `e-${index}`, kind: 'k', label: 'L', actorId: 'H1', interactive: true }));
    expect(etapes().map((s) => s.id)).toEqual(['e-0']);
  });

  it('`pushCombatStep` accepte l’étape MINTÉE (la voie qui reste ouverte)', () => {
    const step = monoStep({ id: 'm', kind: 'k', label: 'L', actor: hero('H1'), difficulty: 'intermediaire' })!;
    pushCombatStep(useGame.setState, step);
    expect(etapes().map((s) => s.id)).toEqual(['m']);
    expect(useGame.getState().pendingCascade!.purpose).toBe('combat');
  });
});

describe('#1262 — les portes d’APPEND', () => {
  it('l’appelant ne fournit NI titre NI purpose : l’étape rejoint la séquence de combat', () => {
    pushMono(useGame.setState, { id: 'a', kind: 'k', label: 'Étape A', actor: hero('H1'), difficulty: 'intermediaire' });
    expect(useGame.getState().pendingCascade!.purpose).toBe('combat');
    expect(etapes()[0].id).toBe('a');
  });

  it('FABRIQUE-INDEX : deux étapes de MÊME clé prennent des ids DISTINCTS dans la séquence', () => {
    const decl = (index: number) => ({ id: `miscast-${index}`, kind: 'k', label: 'Imparfaite', actor: hero('H1'), difficulty: 'intermediaire' as const });
    pushMono(useGame.setState, decl);
    pushMono(useGame.setState, decl);
    expect(etapes().map((s) => s.id)).toEqual(['miscast-0', 'miscast-1']);
  });

  it('une déclaration REFUSÉE par son mint n’appende RIEN', () => {
    pushMono(useGame.setState, { id: 'ok', kind: 'k', label: 'L', actor: hero('H1'), difficulty: 'intermediaire' });
    expect(() => pushTable(useGame.setState, {
      id: 'ko', kind: 'k', label: 'L', actorId: 'H1',
      table: { tableId: TABLE, result: { roll: 60, die: 60, id: 'haute', lines: [] } },
    })).toThrow(/tableStepDone/);
    expect(etapes().map((s) => s.id), 'la séquence n’a pas bougé').toEqual(['ok']);
  });

  it('`pushHost` refuse aussi la fenêtre fantôme (le mint est le même des deux côtés)', () => {
    expect(() => pushHost(useGame.getState, useGame.setState, { id: 'h', kind: 'k', jet: 'attack', actorId: 'H1' })).toThrow(/pendingAttack/);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('`pushChoice` ne peut pas produire un choix de GROUPE (le mint ne pose que le porteur)', () => {
    pushChoice(useGame.setState, { id: 'c', kind: 'pick', label: 'Choix', actorId: 'H1', options: [{ key: 'a', label: 'A' }] });
    expect(etapes()[0].groupOwner).toBeUndefined();
    expect(etapes()[0].actorId).toBe('H1');
  });

  it('la GARDE de possession mord sur la voie d’APPEND, comme à l’ouverture (#1262 B8)', () => {
    const partage = { id: 'e', kind: 'sonde-choix', label: 'Étape', interactive: true, groupOwner: true, options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] } as CascadeStep;
    expect(() => pushStep(useGame.setState, partage, 'combat')).toThrow(/groupOwner/);
    expect(useGame.getState().pendingCascade, 'aucune étape partagée n’a été appendue').toBeNull();
  });

  it('`pushTableDone` : la table résolue rejoint la séquence, enjeu DESCENDU à la ligne tirée', () => {
    pushTableDone(useGame.setState, {
      id: 'crit', kind: 'mutation', label: 'Tirage', actorId: 'H1',
      table: { tableId: TABLE },
      result: { roll: 60, die: 60, id: 'haute', lines: ['ligne 60'] },
      stake: { key: { dataset: 'combat', kind: 'mutation' } },
      outcome: [{ text: 'ligne 60' }],
    });
    const [st] = etapes();
    expect(st.table!.result!.id).toBe('haute');
    expect(st.stake!.key.entryId, 'un append ne court-circuite pas la re-pose post-tirage').toBe('haute');
    expect(st.outcome).toHaveLength(1);
  });
});

/**
 * `pushBand` est la SEULE porte d'append qui traverse `surfaceRow` — donc la seule dont la
 * régression se joue sur la POSSESSION. En SOLO elle est invisible (`surfaceOf` ≡ « quelqu'un a la
 * main ici ») : le harnais monte deux sièges, H1 à l'invité, et mesure chez l'HÔTE (#1262 B7).
 */
describe('#1262 — pushBand : la bande APPENDUE porte sa possession (assertion COOP)', () => {
  const h1 = hero('H1');
  const h2 = hero('H2');

  beforeEach(() => {
    useGame.setState({ battle: null, party: [h1, h2], pendingCascade: null, suspendedCascades: [] } as never);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { H1: 1, H2: 0 } } } as never);
  });

  it('DEUX porteurs de sièges distincts → bande de GROUPE, et la rangée de l’INVITÉ reste à JOUER', () => {
    pushBand(useGame.getState, useGame.setState, {
      id: 'peur', kind: 'combatPsych', label: 'Peur', difficulty: 'intermediaire',
      porteurs: [{ actor: h1, ligne: { test: { char: 'force-mentale' } } }, { actor: h2, ligne: { test: { char: 'force-mentale' } } }],
    });
    const [st] = etapes();
    expect(st.groupOwner, 'deux porteurs ⇒ chaque siège voit la fenêtre où se tient SA rangée').toBe(true);
    expect(modalOwnerOf(useGame.getState())).toBe('*');
    const invite = st.participants!.find((p) => p.id === 'H1')!;
    expect(invite.interactive, 'chez l’hôte, le jet de l’invité ne se roule pas en silence').toBe(true);
    expect(invite.result).toBeNull();
    expect(invite.target, 'FM 40, Difficulté intermédiaire +0').toBe(40);
  });

  it('porteur UNIQUE de l’invité → l’étape le NOMME, et la fenêtre va à SON siège (jamais à l’hôte)', () => {
    pushBand(useGame.getState, useGame.setState, {
      id: 'terreur', kind: 'combatPsych', label: 'Terreur', difficulty: 'intermediaire',
      porteurs: [{ actor: h1, ligne: { test: { char: 'force-mentale' } } }],
    });
    const [st] = etapes();
    expect(st.groupOwner).toBeUndefined();
    expect(st.actorId, 'porteur unique → l’étape le NOMME : l’arbitre a un owner à router (sans lui : fenêtre hôte seul)').toBe('H1');
    expect(modalOwnerOf(useGame.getState())).toBe('H1');
    expect(ownsLocally(useGame.getState(), 'H1'), 'chez l’hôte, la fenêtre n’est pas à lui').toBe(false);
    expect(seatOwns(useGame.getState(), 1, 'H1'), 'elle est au siège 1, qui possède le porteur').toBe(true);
  });

  it('zéro porteur → rien n’est appendu (aucune règle mise en jeu)', () => {
    pushBand(useGame.getState, useGame.setState, { id: 'vide', kind: 'k', label: 'L', difficulty: 'intermediaire', porteurs: [] });
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});
