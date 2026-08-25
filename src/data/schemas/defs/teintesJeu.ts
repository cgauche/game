/**
 * Schéma de `teintesJeu.json` — les TEINTES DE JEU du terrain : surbrillances tactiques (portées,
 * zones, bandes de tir, anneaux de cible, halos, télégraphes) ET identité d'unité (anneaux réservés,
 * couleurs d'équipe, couleurs par héros). Objet PLAT `id → #rrggbb`, groupé par PRÉFIXE d'id.
 *
 * QUI CONSOMME. Deux façades TS, et elles seules — aucun consommateur ne lit ce JSON en direct :
 *  - `src/gameIso/highlightTints.ts` (surbrillances : `WALK_TINT`, `RANGE_BAND_TINT`, …) ;
 *  - `src/gameIso/teamColors.ts` (identité : `HERO_RING`, `ALLY_TINT`, `relationColor`, …).
 * Les peintres volumiques lisent ces façades — `THREE.Color` ne résout pas `var(--x)`, et
 * l'environnement de test `node` n'a pas de CSS. Les vars CSS homonymes de `src/ui/styles/base.css`
 * servent les feuilles de style ; leur égalité avec ce JSON est gardée par
 * `src/gameIso/highlightTints.test.ts`.
 *
 * COMMENT ÉTENDRE (une « famille de teinte » de plus). 1) Ajouter l'entrée au JSON sous l'un des
 * préfixes ci-dessous (`zone-`, `bande-`, `signal-`, `or-`, `anneau-`, `equipe-`, `identite-heros-`) ;
 * 2) l'inscrire dans `TEINTE_KEYS` (recopie gardée par la parité, cf. plus bas) ; 3) l'exposer par la
 * façade qui la sert. Un nouveau préfixe se déclare dans `GROUPES_SURBRILLANCE` ou `GROUPES_IDENTITE`
 * — un préfixe inconnu échoue au chargement, il ne tombe pas dans un angle mort de la non-collision.
 *
 * TROIS INVARIANTS, tenus par `refine` :
 *  (a) NON-COLLISION surbrillance ⇄ identité : un octet servi par une surbrillance transitoire
 *      (`zone-`/`bande-`/`signal-`/`or-`) ne peut pas être celui d'une identité persistante
 *      (`anneau-`/`equipe-`/`identite-`) — sinon un tapis de portée peint la couleur d'un héros.
 *      Un partage VOULU (même signal, deux surfaces) s'inscrit NOMINATIVEMENT ci-dessous.
 *  (b) SÉPARATION des quatre `identite-heros-*` : `teamColors.ts` les veut « 4 couleurs FROIDES
 *      distinctes » — l'invariant en fait une distance mesurée, pas une intention en prose.
 *  (c) DISTANCE des paires SUPERPOSÉES (`PAIRES_SUPERPOSEES`) : deux teintes qui se touchent dans le
 *      même cadre (le tapis peint SOUS le pion) tiennent le même plancher que (b) — octets distincts
 *      ne suffit pas quand les deux couleurs se jouxtent à quelques pixels.
 */
import { z } from 'zod';

export const file = 'teintesJeu.json';
export const famille = 'record';

/** Couleur écrite en HEXA `#rrggbb` — la forme que lisent `THREE.Color` comme le SVG (même regex que
 *  `ambiance.ts`, forme unique du dépôt). */
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'couleur hexadécimale « #rrggbb » attendue');

/** Ids admis — RECOPIE de ce que servent les deux façades (`src/gameIso/highlightTints.ts` et
 *  `src/gameIso/teamColors.ts`) : `src/data` ne dépend jamais RUNTIME de `src/gameIso`
 *  (`data-purity.test.ts`). La parité des deux listes est gardée par
 *  `src/gameIso/highlightTints.test.ts` (patron `WALL_PART_KEYS` ⇄ `relief.test.ts`). */
export const TEINTE_KEYS = [
  // Surbrillances de TERRAIN — tapis de cases posés sous les pions.
  'zone-marche', 'zone-course', 'zone-intention', 'zone-fumee', 'zone-feu',
  // Bandes de portée d'un tir, par ton de modificateur.
  'bande-bonus', 'bande-neutre', 'bande-malus',
  // Signaux PONCTUELS — anneaux de cible, télégraphes, liens, refus de visée.
  'signal-cible', 'signal-foule', 'signal-allie', 'signal-ennemi', 'signal-engagement', 'signal-menace', 'signal-invalide',
  // L'OR du joueur — trajet d'aperçu, réticule héros, halo d'interaction, contour du glyphe.
  'or-surbrillance', 'or-contour', 'or-halo',
  // Anneaux RÉSERVÉS (jamais une équipe, jamais un héros).
  'anneau-actif', 'anneau-ennemi',
  // Appartenance sémantique d'une case/d'un voile.
  'equipe-allie', 'equipe-ennemi', 'equipe-neutre',
  // Identité par héros, cyclique.
  'identite-heros-1', 'identite-heros-2', 'identite-heros-3', 'identite-heros-4',
] as const;

export type TeinteId = (typeof TEINTE_KEYS)[number];

/** Préfixes des teintes TRANSITOIRES (surbrillance d'un geste en cours). */
export const GROUPES_SURBRILLANCE = ['zone-', 'bande-', 'signal-', 'or-'] as const;
/** Préfixes des teintes PERSISTANTES (identité d'une unité à l'écran). */
export const GROUPES_IDENTITE = ['anneau-', 'equipe-', 'identite-'] as const;

/** Les quatre identités de héros, dans l'ordre cyclique de `HERO_RING`. */
export const IDENTITE_HEROS_KEYS = ['identite-heros-1', 'identite-heros-2', 'identite-heros-3', 'identite-heros-4'] as const;

/**
 * Partages d'octet VOULUS — NOMINATIFS, jamais un motif générique. Chaque paire dit le SIGNAL commun
 * qui justifie la couleur unique ; la paire est ORIENTÉE-LIBRE (deux entrées de n'importe quelle
 * famille), et sa réalité est gardée (`highlightTints.test.ts` : une exemption morte échoue).
 *
 * DOCTRINE (une entrée = un SIGNAL, pas un octet). Deux consommateurs qui désignent le MÊME référent
 * sur des surfaces différentes lisent UNE entrée (`anneau-actif` : anneau d'unité, voile, halo de
 * case). Deux consommateurs sur des AXES différents gardent DEUX entrées même à octet égal, et le
 * partage se déclare ici : `anneau-ennemi` est le cran non-héros de l'axe d'IDENTITÉ PAR UNITÉ
 * (`ENEMY_RING`, frère des quatre `HERO_RING` : `builders/dynamicMarks.teamRingDecor`, et les
 * portraits `ui/ActionBar`/`ui/CharFrame`/`ui/TeamPortrait`), `equipe-ennemi` est le cran ennemi de l'axe
 * d'APPARTENANCE (`ENEMY_TINT` : `teamColors.tileTint`/`veilTint`/`relationColor`, et
 * `topoMarkers.stationTint`, qui colore une STATION de la carte, jamais un anneau d'unité).
 */
export const PARTAGES_NOMMES: { a: TeinteId; b: TeinteId; signal: string }[] = [
  {
    a: 'or-surbrillance',
    b: 'equipe-neutre',
    signal: "l'or du joueur EST la couleur d'une cible neutre — même signal « ni allié ni ennemi, à toi de voir », deux surfaces (le trajet/réticule, la case du PNJ).",
  },
  {
    a: 'anneau-ennemi',
    b: 'equipe-ennemi',
    signal: "le rouge du camp adverse, porté par deux AXES distincts (l'anneau d'identité d'une unité non-héros ; l'appartenance d'une case, d'un voile, d'une station de la carte topo) — même camp, deux axes, donc deux entrées qu'un artiste peut désaccorder.",
  },
];

/**
 * Paires SUPERPOSÉES dans le même cadre : la surbrillance est peinte SOUS le pion qui porte
 * l'identité — les deux couleurs se touchent à l'écran. Elles se lisent donc au plancher des
 * identités entre elles (`SEUIL_IDENTITE_HEROS`), et pas seulement « octets différents » : un tapis
 * de Marche à 49 de l'anneau du héros 1 se lit comme ce héros.
 *
 * PÉRIMÈTRE : les paires nommées ci-dessous. ANGLE MORT (mesuré 2026-08-21) : les 16 autres
 * croisements surbrillance ⇄ identité sous le seuil ne sont tenus QUE par la non-collision d'octet —
 * la plus serrée est `zone-course` ⇄ `identite-heros-4`, à 71,2.
 */
export const PAIRES_SUPERPOSEES: { surbrillance: TeinteId; identite: TeinteId }[] = IDENTITE_HEROS_KEYS.map(
  (identite) => ({ surbrillance: 'zone-marche' as TeinteId, identite }),
);

/** Distance PERCEPTUELLE bon marché entre deux `#rrggbb` (pondération RVB classique 2/4/3 : l'œil
 *  discrimine le vert le plus finement, le rouge le moins). L'échelle va de 0 à ~765. */
export function distanceTeinte(a: string, b: string): number {
  const c = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = c(a);
  const [r2, g2, b2] = c(b);
  return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2);
}

/** Plancher de séparation des quatre identités de héros. Distance MESURÉE la plus courte sur la
 *  donnée du dépôt : 102 (`identite-heros-1` ⇄ `identite-heros-3`) — le plancher laisse la marge
 *  d'un ajustement d'artiste, et refuse deux jumelles (une paire à moins de 90 se confond sur un
 *  anneau de 2 px). */
export const SEUIL_IDENTITE_HEROS = 90;

const prefixeConnu = (id: string) => [...GROUPES_SURBRILLANCE, ...GROUPES_IDENTITE].some((p) => id.startsWith(p));

export const schema = z
  .record(z.enum(TEINTE_KEYS), hexColor)
  .refine((t) => Object.keys(t).every(prefixeConnu), {
    message: 'teintesJeu : chaque id porte un préfixe de groupe déclaré (`GROUPES_SURBRILLANCE` / `GROUPES_IDENTITE`)',
  })
  .refine(
    (t) => {
      const exempt = new Set(PARTAGES_NOMMES.flatMap((p) => [`${p.a}|${p.b}`, `${p.b}|${p.a}`]));
      const surbrillances = TEINTE_KEYS.filter((k) => GROUPES_SURBRILLANCE.some((p) => k.startsWith(p)));
      const identites = TEINTE_KEYS.filter((k) => GROUPES_IDENTITE.some((p) => k.startsWith(p)));
      return surbrillances.every((s) =>
        identites.every((i) => t[s].toLowerCase() !== t[i].toLowerCase() || exempt.has(`${s}|${i}`)),
      );
    },
    {
      message:
        "teintesJeu : une teinte de SURBRILLANCE (zone-/bande-/signal-/or-) partage son octet avec une teinte d'IDENTITÉ (anneau-/equipe-/identite-) — un tapis de portée peindrait la couleur d'une unité. Séparer les deux, ou inscrire le partage dans `PARTAGES_NOMMES` avec le signal commun.",
    },
  )
  .refine(
    (t) =>
      IDENTITE_HEROS_KEYS.every((a, i) =>
        IDENTITE_HEROS_KEYS.slice(i + 1).every((b) => distanceTeinte(t[a], t[b]) >= SEUIL_IDENTITE_HEROS),
      ),
    {
      message: `teintesJeu : deux \`identite-heros-*\` sont à moins de ${SEUIL_IDENTITE_HEROS} de distance perceptuelle — les anneaux de deux héros se confondraient.`,
    },
  )
  .refine(
    (t) => PAIRES_SUPERPOSEES.every((p) => distanceTeinte(t[p.surbrillance], t[p.identite]) >= SEUIL_IDENTITE_HEROS),
    {
      message: `teintesJeu : une paire SUPERPOSÉE (\`PAIRES_SUPERPOSEES\` — la surbrillance est peinte sous le pion qui porte l'identité) est à moins de ${SEUIL_IDENTITE_HEROS} de distance perceptuelle ; à ce contact la surbrillance se lit comme la couleur de l'unité.`,
    },
  );
