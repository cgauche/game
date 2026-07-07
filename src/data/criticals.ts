import type { HitLocation, Difficulty } from '../engine/types';
import type { GameOp } from '../engine/ops';
import criticalsJson from './criticals.json';

/**
 * Tables de Blessures critiques — Livre de base, « Traumatisme » (Source/Warhammer v4 - Livre de
 * base version corrigée/18 - Traumatisme.md), transcrites verbatim. `00` est encodé `max: 100`.
 *
 * La DONNÉE vit dans `criticals.json` (éditable, comme `creatures.json`) ; ce module n'est que le
 * TYPE + le chargement + le mapping des Localisations. 4 tables UNIQUES (bras gauche = bras droit,
 * jambe gauche = jambe droite) projetées sur les 6 Localisations. Ajouter/régler un Critique = éditer
 * le JSON, jamais ce fichier.
 *
 * EFFET IMMÉDIAT du coup = `ops: GameOp[]` (PB en ignorant BE+PA via `{op:'wounds', ignoreTB, ignoreAP}`
 * (l.62), États via `{op:'condition'}`), appliqué par `applyOps` — MÊME langue que sorts/traits/maladies.
 * `resist` = Test de Résistance auto-résolu (RNG seedé) dont l'ÉCHEC ajoute ses `onFail` ops. `lethal` =
 * résultat « Mort » (instantané + sauvetage par Destin — PAS un simple `reduceToZero`). `traumas` = SPEC de
 * Trauma à engendrer (entité posée par `rollCritical`, comme la Corruption engendre une Mutation) — sa
 * mécanique permanente est déjà GameOp via `passiveMods`. `desc` = texte canon (LONG TERME), verbatim.
 */
export interface CritEntry {
  /** id STABLE (slug) — toute référence passe par l'id, jamais le `name` (libellé). */
  id: string;
  min: number;
  max: number;
  name: string;
  /** Effet IMMÉDIAT du coup (PB + États), appliqué par `applyOps`. Absent = aucun effet immédiat (létal). */
  ops?: GameOp[];
  /** Test de Résistance (LDB 18) : ÉCHEC → ses `onFail` ops s'ajoutent à l'effet. Auto-résolu (seedé). */
  resist?: { difficulty: Difficulty; onFail: GameOp[] };
  lethal?: boolean;
  /** Amputation (LDB 18 l.328-333) déclarée STRUCTURELLEMENT (plus de regex sur `desc`) : `difficulty` =
   *  Test de Résistance, `sequels` = ids de fiches de séquelle PERMANENTE (`traumas.json`). */
  amputation?: { difficulty: Difficulty; sequels: string[] };
  /** Traumatismes ENGENDRÉS (LDB 18) — refs d'id de fiches `traumas.json` ; la localisation vient de la table. */
  traumas?: string[];
  /** Escalade GATÉE d'une Blessure critique (LDB / Aux Armes) : sans soin, la séquelle S'AGGRAVE (ou n'est
   *  levée que par un traitement). `fingerLossPerRound` (« Main ouverte ») : 1 doigt de plus par Round de
   *  combat tant que l'Aide Médicale n'est pas reçue (4+ doigts → main tranchée). `amputateAfter1d10Days`
   *  (« Pied écrasé ») : perte définitive du membre (`amputateSequel`) si la Chirurgie de la plaie n'intervient
   *  pas dans le délai (1d10 jours). `medicalAidGate` (« Épaule luxée »/« Genou démis ») : membre désactivé
   *  jusqu'à un Test étendu de Guérison réussi APRÈS Aide Médicale. */
  escalation?: CritEscalation;
  /** Texte canon (LONG TERME), DISPLAY-ONLY — jamais parsé pour de la mécanique. */
  desc: string;
}
/** Déclaration d'escalade gatée par les soins — partagée LDB (`criticals.json`) et Aux Armes (`aa-criticals.json`).
 *  Instanciée par `stampCriticalEscalation` (trauma.ts) sur la plaie chirurgicale du critique. */
export interface CritEscalation {
  fingerLossPerRound?: boolean;
  amputateAfter1d10Days?: boolean;
  amputateSequel?: string;
  /** « Épaule luxée » (AA l.125 / LDB l.120) / « Genou démis » (AA l.179 / LDB l.179) : le membre est
   *  DÉSACTIVÉ (séquelle portant `disable` en `ops` passives : bras `maxWeaponHands:1` / jambe `moveScale`),
   *  en attente d'Aide Médicale (`awaitingMedicalAid`). Après l'Aide Médicale, un Test ÉTENDU de Guérison
   *  Accessible (+20) de `restoreDR` DR rend l'usage du membre : la séquelle est retirée et `recoveryPenalty`
   *  (charMod −10 / `moveScale` jambe, durée 1d10 jours) est posé à la cible. Instancié par
   *  `stampCriticalEscalation` (nouvelle séquelle, pas une plaie chirurgicale) ; joué à l'Infirmerie (acte
   *  « Guérison », `medicFlow`). */
  medicalAidGate?: { label: string; disable: GameOp[]; restoreDR: number; recoveryPenalty: GameOp[] };
  /** « Réouverture » (LDB 18 l.101/118/143/145/148/175 ; AA 07 l.119/147/149/152/175) : tant que la plaie n'a
   *  pas été recousue par Chirurgie, chaque nouveau Dégât à la MÊME Localisation octroie `amount` État
   *  Hémorragique. `stampCriticalEscalation` pose une séquelle chirurgicale (`Trauma.bleedOnReinjury`,
   *  `needsSurgery`) que la Chirurgie retire ; le déclencheur est `reinjuryBleed` au point d'application des
   *  Dégâts localisés (`applyAttackResult`/Projectile). `label` = nom de la plaie (liste de Chirurgie). */
  bleedOnReinjury?: { amount: number; label: string };
  /** « Si vous tombez une seconde fois sur cette blessure… » (Blessure majeure à l'oreille, LDB 18 l.71 /
   *  AA 07 l.96) : à la 2e OCCURRENCE de CETTE entrée sur le personnage (compteur `critEntriesSuffered`),
   *  l'effet ALTERNATIF s'applique — `traumas` REMPLACE les séquelles de base (perte auditive partielle →
   *  Surdité totale), `ops` s'AJOUTE à l'effet immédiat de base. Évalué par `rollCritical`/`resolveAACritical`. */
  onRepeat?: { traumas?: string[]; ops?: GameOp[] };
  /** « Si vous recevez une autre Blessure critique à la tête alors que vous êtes Exténué… » (Commotion
   *  cérébrale, LDB 18 l.74) : `stampCriticalEscalation` pose une séquelle porteuse de `Trauma.critTrigger`
   *  (dédupliquée) ; tant que le personnage porte l'État `whileCondition`, tout critique SUBSÉQUENT à
   *  `location` (ou toute Localisation si absente) impose le Test de sauvegarde `resist` (échec → ses `onFail`),
   *  évalué par `fireCritTriggers` au point unique de résolution. `label` = nom de la séquelle affichée. */
  onNextCritWhileCondition?: {
    label: string;
    location?: HitLocation;
    whileCondition: string;
    resist: { difficulty: Difficulty; onFail: GameOp[] };
  };
}
export type CritTable = CritEntry[];

const T = criticalsJson as { tete: CritTable; bras: CritTable; corps: CritTable; jambe: CritTable };

export const CRITICAL_TABLES: Record<HitLocation, CritTable> = {
  tete: T.tete,
  brasG: T.bras,
  brasD: T.bras,
  corps: T.corps,
  jambeG: T.jambe,
  jambeD: T.jambe,
};
