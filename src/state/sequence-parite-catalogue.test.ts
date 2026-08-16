/**
 * GARDE DE MIGRATION du texte joueur passé au catalogue (#1318 V8b + V8c₀) — la PARITÉ À L'OCTET.
 *
 * Ce que la vague a fait : remplacer des gabarits FR écrits au flux par des sorties de catalogue
 * (`t()` et les fabriques t()-backed de `rollSeam`). Une migration de ce genre ne se prouve pas par
 * « ça compile » : elle se prouve en montrant que la phrase RENDUE n'a pas bougé d'un octet. Les
 * cliquets de la vague comptent des littéraux ; AUCUN ne compare des phrases — c'est le trou que ce
 * fichier ferme.
 *
 * Le côté « avant » est le littéral tel qu'il était écrit au site (relu au diff de migration), gardé
 * ICI comme oracle figé ; le côté « après » monte le CATALOGUE RÉEL (`fr.ts`) par les mêmes appels que
 * la production. Retoucher une de ces entrées de catalogue sans le vouloir rougit donc ici, à la
 * phrase près — y compris sur un tiret cadratin, une espace ou un exposant.
 *
 * Ce test ne dit RIEN de la 2ᵉ langue : il verrouille la locale FR (la seule montée en v1). Une
 * locale ajoutée ne le fait pas mentir — elle ne passe simplement pas par lui.
 */
import { describe, it, expect } from 'vitest';
import { t } from '../i18n';
import { stepDetail, stepFraction, stepPrecision } from './rollSeam';
import { dataLabel } from '../data';
import type { PlayerText } from '../i18n/playerText';

/** Un site migré : ce que le flux écrivait AVANT, ce que le catalogue rend APRÈS. */
interface Site {
  /** `fichier:ligne` du site de production migré. */
  site: string;
  /** La phrase telle que le gabarit inline la produisait (oracle figé, relu au diff). */
  avant: string;
  /** La MÊME phrase, montée depuis le catalogue par les appels de la production. */
  apres: string;
}

/* ── V8b : les positions NOMMÉES du contrat de séquence (`state/sequenceContract.ts`) ────────────*/

const MANCHE = 3, DIST = { distance: 4, escapeAt: 10 };
const distanceDite = (p: { distance: number; escapeAt: number }): PlayerText =>
  t('pursuit.titreDistance', { distance: p.distance, evasion: p.escapeAt });

/* Libellés de DONNÉE des fixtures (nom de jeu, nom de héros, nom de camp) : ils passent par des
 * CONSTANTES, jamais en littéral à l'appel de `dataLabel` — le minteur du texte authored n'accepte
 * aucune prose écrite au call-site (cliquet 3, `player-text-ratchet.test.ts`), et un test ne s'exempte
 * pas d'une règle qu'il sert. */
const JEU_OPTION = 'Bras de fer', HEROS = 'Sigrid', ADVERSAIRE = 'Brandt';
const CAMP_MIEN = 'les Assiégeants', CAMP_SIEN = 'les Assiégés';

const SEQUENCE: Site[] = [
  {
    site: 'pursuitFlow.ts:268 — SequenceRound.title (manche de course)',
    avant: `Poursuite — manche ${MANCHE} (Distance ${DIST.distance}/${DIST.escapeAt})`,
    apres: stepPrecision(t('pursuit.titreManche', { n: MANCHE }), distanceDite(DIST)),
  },
  {
    site: 'pursuitFlow.ts:278 — SequenceRound.title (rattrapés)',
    avant: `Poursuite — rattrapés ! (Distance ${0}/${10})`,
    apres: stepPrecision(t('pursuit.titreRattrapes'), distanceDite({ distance: 0, escapeAt: 10 })),
  },
  {
    site: 'pursuitFlow.ts:168 — repli du libellé de rangée (ligne de journal)',
    avant: 'Mouvement',
    apres: t('step.pursuitMouvement'),
  },
  {
    site: 'tavernFlow.ts:542 — SequenceRound.title (choix d’option)',
    avant: `${JEU_OPTION} — ${t('tavern.optionTitre')}`,
    apres: stepDetail(dataLabel(JEU_OPTION), t('tavern.optionTitre')),
  },
  {
    site: 'tavernFlow.ts:716 — SequenceRound.title (volée de lancers)',
    avant: `Torchon trempé — lancer ${2}/${5}`,
    apres: t('tavern.volleyLancer', { jeu: 'Torchon trempé', n: 2, total: 5 }),
  },
  {
    site: 'tavernFlow.ts:818 — SequenceRound.title (mi-temps)',
    avant: `Middenball — ${2}ᵉ mi-temps, tour ${1}/${3}`,
    apres: t('tavern.miTempsTitre', { jeu: 'Middenball', phase: 2, n: 1, total: 3 }),
  },
  {
    site: 'tavernFlow.ts:1740 — SequenceBoardCamp.label (camps asymétriques, mien)',
    avant: `${HEROS} (${CAMP_MIEN})`,
    apres: stepPrecision(dataLabel(HEROS), dataLabel(CAMP_MIEN)),
  },
  {
    site: 'tavernFlow.ts:1741 — SequenceBoardCamp.label (camps asymétriques, sien)',
    avant: `${ADVERSAIRE} (${CAMP_SIEN})`,
    apres: stepPrecision(dataLabel(ADVERSAIRE), dataLabel(CAMP_SIEN)),
  },
];

/* ── V8b₂ : les positions rougies par le MARQUAGE `PlayerText` du contrat (8 positions) ──────────
 * Le lot précédent avait migré ces textes par relecture ; celui-ci les rend IMPOSSIBLES à réécrire au
 * flux (le type les refuse). Ce que le type ne dit pas, c'est que la phrase n'a pas bougé — d'où ces
 * entrées, au même standard que les précédentes. */

const JEU_EQUIPE = 'Middenball', HEROS2 = 'Kurt', ADVERSAIRE2 = 'Otto';
const TOUR = { n: 2, mien: 27, sien: 14 };

const MARQUAGE: Site[] = [
  {
    site: 'tavernFlow.ts:877 — SequenceRound.title (manche ordinaire, les deux camps)',
    avant: `${JEU_OPTION} — ${HEROS2} contre ${ADVERSAIRE2}`,
    apres: stepDetail(dataLabel(JEU_OPTION), t('tavern.contre', { who: HEROS2, adversaire: ADVERSAIRE2 })),
  },
  {
    site: 'tavernFlow.ts:1083 — ligne de journal d’un tour d’équipe (sans but)',
    avant: `${JEU_EQUIPE} — tour ${TOUR.n} : ${TOUR.mien} DR contre ${TOUR.sien}`,
    apres: t('tavern.equipeTour', { jeu: JEU_EQUIPE, ...TOUR }),
  },
  {
    site: 'tavernFlow.ts:1082 — ligne de journal d’un tour d’équipe (but du GROUPE)',
    avant: `${JEU_EQUIPE} — tour ${TOUR.n} : ${TOUR.mien} DR contre ${TOUR.sien} — BUT pour votre équipe !`,
    apres: t('tavern.equipeTourBut', { jeu: JEU_EQUIPE, ...TOUR, qui: t('tavern.equipeQui') }),
  },
  {
    site: 'tavernFlow.ts:1082 — ligne de journal d’un tour d’équipe (but de l’ADVERSAIRE)',
    avant: `${JEU_EQUIPE} — tour ${TOUR.n} : ${TOUR.mien} DR contre ${TOUR.sien} — BUT pour ${ADVERSAIRE2} !`,
    apres: t('tavern.equipeTourBut', { jeu: JEU_EQUIPE, ...TOUR, qui: ADVERSAIRE2 }),
  },
  {
    site: 'tavernFlow.ts:1699 — SequenceBoard.phase (fraction PUREMENT numérique)',
    avant: `${2}/${2}`,
    apres: stepFraction(2, 2),
  },
  {
    site: 'SequencePanel.tsx:29 — compteur, partie OUVERTE (aucun total prévu)',
    avant: `Manche ${4}`,
    apres: t('seqPanel.manche', { n: 4 }),
  },
  {
    site: 'SequencePanel.tsx:28 — compteur, total prévu et pas de phase',
    avant: `Manche ${3}/${6}`,
    apres: t('seqPanel.manche', { n: stepFraction(3, 6) }),
  },
  {
    site: 'SequencePanel.tsx:27 — compteur, total prévu ET phase',
    avant: `Manche ${3}/${6} · phase ${'1/2'}`,
    apres: t('seqPanel.manchePhase', { n: stepFraction(3, 6), phase: stepFraction(1, 2) }),
  },
  {
    site: 'SequencePanel.tsx:48 — format de jauge : fraction du seam + repli d’unité (des DR)',
    avant: `${3}/${10} DR`,
    apres: `${stepFraction(3, 10)} ${t('seqPanel.uniteDr')}`,
  },
];

/* ── Le DR d'une rangée de poursuite : le SIGNE est porté par l'appelant, jamais par le gabarit ──*/

const drAvant = (sl: number): string => `${sl >= 0 ? '+' : ''}${sl} DR`;
const drApres = (sl: number): string => t('pursuit.dr', { dr: `${sl >= 0 ? '+' : ''}${sl}` });

const SIGNES: Site[] = [3, 0, -2].map((sl) => ({
  site: `pursuitFlow.ts:369 — issue de jet, DR ${sl}`,
  avant: drAvant(sl),
  apres: drApres(sl),
}));

/* ── V8c₀ : la narration de combat rendue au catalogue (`state/combatFlow.ts`, invariant ZÉRO) ───*/

const COMBAT: Site[] = [
  {
    site: 'combatFlow.ts:1862 — chute de passerelle',
    avant: `Gustav chute de la passerelle qui s'effondre.`,
    apres: t('cf.gangwayCollapse', { name: 'Gustav' }),
  },
  {
    site: 'combatFlow.ts:2461 — mise hors de combat',
    avant: `Gustav est mis hors de combat !`,
    apres: t('cf.outOfAction', { name: 'Gustav' }),
  },
  {
    site: 'combatFlow.ts:4014 — sort introuvable',
    avant: `Sort « Dard de feu » introuvable.`,
    apres: t('cf.spellNotFound', { spell: 'Dard de feu' }),
  },
  {
    site: 'combatFlow.ts:4020 — incantation bloquée',
    avant: `Gustav ne peut pas incanter : Propos ésotériques.`,
    apres: t('cf.cannotCast', { name: 'Gustav', reason: 'Propos ésotériques' }),
  },
  {
    site: 'combatFlow.ts:4399 — prière bloquée',
    avant: `Gustav ne peut pas prier : Vous abusez de ma patience.`,
    apres: t('cf.cannotPray', { name: 'Gustav', reason: 'Vous abusez de ma patience' }),
  },
  {
    site: 'combatFlow.ts:4051 — pas de ligne de vue',
    avant: `Dard de feu : pas de ligne de vue.`,
    apres: t('cf.noLineOfSight', { spell: 'Dard de feu' }),
  },
  {
    // `effet` = le `label` de la ligne d'`oups.json` (ponctuation comprise) — la donnée, telle quelle.
    site: 'combatFlow.ts:2656 — en-tête du Tableau des Oups !',
    avant: `Gustav — Maladresse ! Arme abîmée (1 Dégât) ; vous agirez en dernier au prochain Round.`,
    apres: t('cf.oups', { name: 'Gustav', effet: 'Arme abîmée (1 Dégât) ; vous agirez en dernier au prochain Round.' }),
  },
];

/* ── V8c₁ : les trois plus gros flux hors combat rendus au catalogue (invariant ZÉRO) ────────────
 * `interludeFlow` (`if.*`), `massBattleFlow` (`mbf.*`), `merchantFlow` (`mf.*`). Échantillons pris
 * sur les formes qui se cassent le plus vite : pluriel porté par une variable, composition de deux
 * clés, ponctuation typographique (« », —, ≤, −), fragments optionnels. */

const HEROS3 = 'Sigrid', OBJET = 'Épée runique', ARGENT = '12 CO', ACTIVITE = 'Artisanat';

const V8C1: Site[] = [
  {
    site: 'interludeFlow.ts:195 — bandeau d’ouverture (pluriel porté par la variable)',
    avant: `— Entre deux aventures : ${3} semaine${3 > 1 ? 's' : ''} —`,
    apres: t('if.openBanner', { n: 3, s: 3 > 1 ? 's' : '' }),
  },
  {
    site: 'interludeFlow.ts:240 — ligne d’Événement du héros',
    avant: `${HEROS3} — Événement (${47}) : Un vieil ami. Vous croisez une connaissance.`,
    apres: t('if.eventLine', { name: HEROS3, roll: 47, label: 'Un vieil ami', text: 'Vous croisez une connaissance.' }),
  },
  {
    site: 'interludeFlow.ts:832 — ouvrage achevé (fragments Atouts/Défauts optionnels)',
    avant: `${HEROS3} achève son ouvrage : ${OBJET}${' (Fiable)'}${''} !`,
    apres: t('if.craftDone', { name: HEROS3, label: OBJET, atouts: ' (Fiable)', defauts: '' }),
  },
  {
    site: 'interludeFlow.ts:1316 — dépôt investi (la même variable rendue trois fois)',
    avant: `${HEROS3} investit ${ARGENT} (Indice d'intérêts ${4} — ${4} % de gains, faillite sur ≤ ${4}).`,
    apres: t('if.bankInvest', { name: HEROS3, money: ARGENT, rate: 4 }),
  },
  {
    site: 'interludeFlow.ts:1366 — dépôt perdu (issue composée d’une 2ᵉ clé)',
    avant: `${HEROS3} — ${3} ≤ ${4} : ${'la banque a fait faillite'} — ${ARGENT} perdus !`,
    apres: t('if.bankLost', { name: HEROS3, roll: 3, threshold: 4, what: t('if.bankFailBank'), money: ARGENT }),
  },
  {
    site: 'massBattleFlow.ts:696 — libellé d’issue chiffrée (camp composé, signe porté par l’appelant)',
    avant: `Puissance ${'ennemie'} ${''}${-3}`,
    apres: t('mbf.outMight', { side: t('mbf.sideEnemy'), amount: `${''}${-3}` }),
  },
  {
    site: 'massBattleFlow.ts:727 — « Tenez votre position » tenue (signe MOINS typographique)',
    avant: `Tenez votre position : la position tient (Point de rupture ${2}/${5}) — Puissance ennemie −2. L'ennemi redoublera d'efforts (opposition +${10} au prochain Round).`,
    apres: t('mbf.holdHeld', { bp: 2, max: 5, bonus: 10 }),
  },
  {
    site: 'massBattleFlow.ts:870 — Test spectaculaire de Puissance du Round',
    avant: `Round ${2}/${4} — Test spectaculaire de Puissance : les Personnages réduisent l'ennemi de ${7}, l'ennemi réduit les Personnages de ${5}.`,
    apres: t('mbf.clash', { n: 2, total: 4, enemyLoss: 7, allyLoss: 5 }),
  },
  {
    site: 'merchantFlow.ts:553 — panier payé (pluriel porté par la variable)',
    avant: `Payé : ${ARGENT} (${1} article${1 > 1 ? 's' : ''}).`,
    apres: t('mf.paid', { total: ARGENT, count: 1, s: 1 > 1 ? 's' : '' }),
  },
  {
    site: 'merchantFlow.ts:710 — troc conclu (ratio recomposé au call-site)',
    avant: `Troc : ${2} × ${'Corde'} contre ${1} × ${'Torche'} (${'commun'} ${2}:${1} ${'rare'}).`,
    apres: t('mf.barterDone', { giveCount: 2, giveLabel: 'Corde', getCount: 1, getLabel: 'Torche', giveAv: 'commun', ratio: `${2}:${1}`, getAv: 'rare' }),
  },
  {
    site: 'merchantFlow.ts:466 — achat GRATUIT « Tenir les comptes » (branche VRAIE du ternaire)',
    avant: `Achat : ${OBJET} (dans les moyens du Statut du groupe — Tenir les comptes).`,
    apres: t('mf.buyFree', { label: OBJET }),
  },
  {
    site: 'merchantFlow.ts:466 — achat payé (branche FAUSSE du même ternaire)',
    avant: `Achat : ${OBJET}.`,
    apres: t('mf.buy', { label: OBJET }),
  },
  {
    site: 'merchantFlow.ts:986 — fourchette d’estimation (le séparateur est de la typographie, pas du code)',
    avant: `${'2 CO'} – ${'3 CO'}`,
    apres: t('mf.estimateRange', { min: '2 CO', max: '3 CO' }),
  },
  {
    site: 'interludeFlow.ts:1230 — MALADRESSE d’Activité (jumeau de `cf.oups`, V8c₀)',
    avant: `${HEROS3} — MALADRESSE (${99}) !`,
    apres: t('if.fumble', { name: HEROS3, roll: String(99) }),
  },
  {
    site: 'interludeFlow.ts:937 — fausses Particularités CITÉES (jointure au catalogue)',
    avant: `${HEROS3} confond ${OBJET} avec un objet similaire et le croit doté de « ${['Fiable', 'Précise'].join(' » et « ')} » — certitude(s) erronée(s).`,
    apres: t('if.identifyFakes', { name: HEROS3, item: OBJET, fakes: ['Fiable', 'Précise'].join(t('if.fakesJoin')) }),
  },
  {
    site: 'interludeFlow.ts:622 — libellé d’Activité composé (la fabrique remplace le gabarit inline)',
    avant: `${ACTIVITE} — ${OBJET}`,
    apres: stepDetail(dataLabel(ACTIVITE), dataLabel(OBJET)),
  },
  {
    site: 'merchantFlow.ts:369 — recherche active (sujet + détail par `stepDetail`)',
    avant: `${HEROS3} — recherche active (Ragot ${31}) : une journée aux marchés porte ses fruits (Disponibilité +10 %, LDB 59 l.50).`,
    apres: stepDetail(dataLabel(HEROS3), t('mf.searchOk', { roll: 31 })),
  },
];

const TOUS: Site[] = [...SEQUENCE, ...MARQUAGE, ...SIGNES, ...COMBAT, ...V8C1];

describe('#1318 V8b/V8b₂/V8c₀/V8c₁ — la migration au catalogue est à PARITÉ D’OCTET', () => {
  it.each(TOUS)('$site', ({ avant, apres }) => {
    expect(apres).toBe(avant);
  });

  it('le recensement couvre les TROIS lots et les trois signes de DR — un site migré s’y ajoute', () => {
    expect(SEQUENCE.length, 'les 8 positions de séquence migrées (V8b)').toBe(8);
    expect(MARQUAGE.length, 'les sites rougis par le MARQUAGE du contrat (V8b₂), panneau compris').toBe(9);
    expect(SIGNES.length, 'DR positif, nul, négatif — le signe ne vit pas dans le gabarit').toBe(3);
    expect(COMBAT.length, 'les littéraux de combatFlow rendus au catalogue (V8c₀)').toBe(6 + 1);
    expect(V8C1.length, 'échantillons des trois flux passés MIGRÉS par V8c₁ (interlude / bataille de masse / marchand)').toBe(17);
    expect(TOUS.length).toBe(44);
  });

  it('MUTATION : l’oracle est SENSIBLE — un tiret cadratin changé en tiret court diverge', () => {
    // Ce que le test attraperait si une édition du catalogue rabotait la ponctuation.
    expect(stepPrecision(t('pursuit.titreManche', { n: 3 }), distanceDite(DIST)))
      .not.toBe('Poursuite - manche 3 (Distance 4/10)');
  });
});
