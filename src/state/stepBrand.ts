/**
 * MARQUE D'ORIGINE d'une étape de cascade (#1262) — module FEUILLE, entièrement TYPE : il ne déclare
 * aucune valeur d'exécution, donc tout import de ce fichier s'efface à la compilation. C'est ce qui
 * lui permet d'être partagé par les DEUX minteurs sans cycle : `rollSeam.ts` (la porte : bande, choix,
 * mono, table, hôte) et `revealStep.ts` (la révélation — module feuille consommé par `pushReveal` ET
 * par la migration de save, qui ne peut pas tirer `rollSeam`).
 *
 * La propriété est REQUISE : un littéral nu n'est plus assignable à `BuiltCascadeStep`, et le SEUL
 * moyen d'en produire une est le cast interne d'un minteur (lint `no-restricted-syntax`,
 * `eslint.config.js` : `as BuiltCascadeStep` hors des minteurs et de `saves.ts` échoue).
 *
 * DEUX LIMITES, dites ensemble — ce que NI le type NI le lint ne couvrent :
 *  1. le SPREAD blanchit. `{ ...étapeMintée, kind: 'autre' }` porte encore la marque et reste
 *     assignable, alors que rien n'a été revérifié. Les variantes fabrique-index des portes d'append
 *     suppriment ce motif dans les fichiers migrés ; le spread au sens large reste hors garantie.
 *  2. l'ANNOTATION d'une valeur `any`/`unknown` déjà élargie (`const s: BuiltCascadeStep = brut;`)
 *     passe sans cast : il n'y a pas de nœud de cast à interdire, et lui refuser l'annotation
 *     reviendrait à interdire de NOMMER le type — ce que le lint ne peut pas faire proprement.
 * Dans les deux cas c'est la relecture du site qui couvre, pas le compilateur. Le lint mure les
 * routes de FORGE (`x as T`, `<T>x`, y compris sous tableau/`readonly`/générique).
 *
 * AUCUNE existence à l'exécution (calque `BuiltRollRow`, `ui/rollRowBuild.ts`) : une étape marquée
 * traverse le JSON d'une sauvegarde sans rien perdre, et `Object.getOwnPropertySymbols` la rend vide.
 */
import type { CascadeStep } from './pendings';

declare const CASCADE_STEP_BRAND: unique symbol;

/** Étape de cascade MONTÉE par un constructeur de la porte (ou par `revealToStep`). */
export type BuiltCascadeStep = CascadeStep & { readonly [CASCADE_STEP_BRAND]: true };
