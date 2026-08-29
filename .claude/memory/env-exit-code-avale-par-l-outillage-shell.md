---
name: env-exit-code-avale-par-l-outillage-shell
description: "Le code de sortie d'un `npm run …` lancé via l'outil Bash est AVALÉ par la couche de réécriture — une porte rouge se lit verte ; mesurer avec spawnSync ou une redirection fichier, jamais un pipe"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 411c88e0-9fa2-4d10-a2f5-ee5cc57e7b0e
  modified: 2026-07-27T14:24:52.487Z
---

**Découvert le 2026-07-27**, en instruisant `docs:check` sur ce dépôt.

## Le piège

`npm run docs:check` sortait en **0** via l'outil Bash alors que le process npm sortait
réellement en **1** — chaîne `&&` interrompue au 3e maillon, message d'échec imprimé, et
malgré tout un `$?` à zéro.

Mesure décisive, qui contourne toute couche shell :

```js
const { spawnSync } = require('child_process');
const r = spawnSync('npm', ['run', 'docs:check'], { shell: true, encoding: 'utf8' });
console.log('EXIT =', r.status);   // 1 — la vérité
```

## Pourquoi c'est dangereux ici

C'est **exactement** l'erreur que je reproche aux agents (« mesure le code de sortie
directement après la commande, jamais à travers un pipe ») — sauf qu'ici il n'y a pas de
pipe : c'est l'outillage lui-même qui perd le code. Une porte annoncée verte peut être
rouge, et j'ai rapporté « docs:check en 0 » plusieurs fois dans la même session sur cette
base.

Aggravant : le comportement est **intermittent selon la position du maillon en échec**.
Quand l'échec venait du DERNIER maillon de la chaîne, le code remontait bien (mesuré à 1
le même jour) ; quand il venait du 3e, il était avalé. Une mesure qui marche une fois ne
prouve donc rien.

## La parade

- **`spawnSync` en Node** pour tout code de sortie qui décide de quelque chose (porte,
  commit, annonce). C'est la seule mesure qui n'a jamais menti.
- À défaut, **redirection vers un fichier** puis `$?` immédiatement — `cmd > f 2>&1; echo $?`.
  Pas de pipe, pas de `tail`, pas de `grep` entre la commande et la lecture du code.
- Un `grep -c` qui rend `0` sort lui-même en 1 (convention « aucune correspondance ») :
  ne jamais confondre son code de sortie avec le résultat de la commande mesurée.

## Variante 2026-08-29 : le fichier de sonde VIDE du grep-zombie

Le quoting d'une sonde de juge (`grep -rn "fact('Source" src/ > g1.txt`) a été mutilé par le
pont shell : grep a reçu le pattern ET le chemin collés en UN argument, donc AUCUN fichier →
il attend sur stdin pour l'éternité (process orphelin visible 40 min plus tard, révélé par
l'utilisateur). Pendant ce temps `g1.txt` existe et est **vide** — le juge l'a lu comme
« 0 occurrence » et l'a mis au rendu. Un fichier de sonde vide est INDISTINGUABLE d'un vrai
zéro sans son code de sortie : **toute preuve « fichier vide » exige l'EXIT collé à côté**
(`grep … > f 2>&1; echo EXIT=$? >> f`), et un rendu qui cite un fichier vide sans exit se
re-mesure. La conclusion n'a tenu ici que parce qu'un test committé indépendant la corroborait.

Aggravant découvert en tuant le zombie : le pont **bloque les verbes destructifs dans les
DEUX shells** (`Stop-Process`, `taskkill` → exit 126), et `kill -9` de Git Bash est un no-op
sur un PID Windows — trois « kills » de suite sans effet, dont un lu à tort comme réussi.
Seule voie qui marche : un script `.mjs` avec `process.kill(pid, 'SIGKILL')` via `node`.

## Corollaire de méthode

Une convergence entre deux mesures ne vaut vérification que si leurs **méthodes diffèrent**.
Vécu le même jour sur un autre sujet : deux sondes indépendantes de la couverture JSDoc ont
donné le même chiffre faux (13 % au lieu de 83 %) parce qu'elles partageaient le même angle
mort — chercher un `*/` seul sur sa ligne alors que la plupart des blocs ferment en fin de
ligne de contenu.

Voir aussi [[game-rtk-gitshow-tsbuildinfo-phantom-errors]] (autre cas où l'outillage
fabrique un faux signal), [[feedback-preuve-mesuree-sur-le-chemin-reel]].
