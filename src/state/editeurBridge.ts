/**
 * Pont composant↔clavier de l'ÉDITEUR (patron `hotbarBridge.ts`) : l'éditeur PUBLIE ici ses commandes
 * PAR NOM, le registre de raccourcis (`keybindings.ts`, section `editeur`) les appelle. L'état de
 * l'éditeur (sélection, presse-papier, pile d'annulation, menu fichier ouvert) est LOCAL à React et
 * n'entre pas dans l'état de jeu : le pont porte l'INTENTION, jamais la donnée.
 *
 * State-clean : aucune DONNÉE d'état ne traverse le pont, ni aucun ReactNode — seules des INTENTIONS
 * (des commandes sans argument d'état). L'éditeur REPUBLIE les siennes à chaque rendu et les retire
 * au démontage : ce qui est publié ferme donc toujours sur l'état du rendu courant. Une commande
 * ABSENTE = éditeur démonté (ou geste non applicable dans son contexte) : la touche ne fait rien et
 * ne jette pas.
 *
 * `fermerMenuFichier` n'est publiée QUE tant que le menu fichier est ouvert : sa PRÉSENCE est ce qui
 * arbitre Échap (fermer le menu d'abord, désélectionner ensuite) — aucun état dupliqué.
 */
export interface CommandesEditeur {
  /** Rotation caméra de l'éditeur, d'un quart de tour (`-1` = anti-horaire). */
  tourner: (dir: 1 | -1) => void;
  /** Mode panoramique au glisser, tant que la touche est tenue. */
  pan: (on: boolean) => void;
  annuler: () => void;
  retablir: () => void;
  copier: () => void;
  coller: () => void;
  dupliquer: () => void;
  supprimer: () => void;
  /** Décale la sélection d'une case dans le sens écran donné. */
  deplacer: (dx: number, dy: number) => void;
  deselectionner: () => void;
  /**
   * Ouvre PAR ID un projet enregistré (`projectsLoad`), une campagne du jeu (`allBuiltinCampaigns`)
   * ou un scénario de test (`testScenarios`) — la MÊME voie que la modale « Ouvrir »
   * (`loadSaved`/`loadBuiltin`/`loadScenario`), jamais une reconstruction parallèle. Rend
   * `✓ …` ou `✗ « id » introuvable — …` avec les ids des trois familles.
   *
   * L'id est un ARGUMENT D'INTENTION, pas une donnée d'état (comme `deplacer(dx, dy)`) : le pont
   * reste state-clean — rien de l'état de l'éditeur ne le traverse.
   */
  ouvrir: (id: string) => string;
  fermerMenuFichier: () => void;
}

export const editeur: Partial<CommandesEditeur> = {};

/**
 * Publie un jeu de commandes et rend le retrait à appeler au démontage : seules les entrées ENCORE
 * identiques à celles publiées sont retirées (un remontage qui republie avant le nettoyage du
 * précédent garde donc les siennes).
 */
export function publierEditeur(cmds: Partial<CommandesEditeur>): () => void {
  Object.assign(editeur, cmds);
  return () => {
    for (const cle of Object.keys(cmds) as (keyof CommandesEditeur)[]) {
      if (editeur[cle] === cmds[cle]) delete editeur[cle];
    }
  };
}
