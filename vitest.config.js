import { defineConfig, configDefaults } from "vitest/config";

// ---------------------------------------------------------------------------
// LE WORKTREE D'UNE SESSION TAXAIT LE pre-push DE TOUTES LES AUTRES
// (30 aout 2026).
//
// `vitest` enumere le disque. Son exclusion PAR DEFAUT ne contient pas
// `.claude` :
//
//     **/node_modules/**  **/dist/**  **/cypress/**
//     **/.{idea,git,cache,output,temp}/**
//     **/{karma,rollup,...}.config.*
//
// Un seul worktree vivant sous `.claude/worktrees/` doublait donc la suite
// ENTIERE pour tout le monde. Mesure du jour, avec la seule copie
// `simulate-overrides` presente :
//
//                            avec la copie   sans
//     fichiers collectes          91          46
//     tests                    1 137         570
//     horloge murale            24,5 s      16,7 s
//     CPU en tests             128,9 s      60,8 s
//     sous-processus --verifier     8           4
//
// Les quatre tests du verificateur d'`index-recherche.test.js` lancent
// chacun un sous-processus Python de ~3 s. Avec la copie ils sont huit, et
// ils se disputent la machine : « detecte une page AJOUTEE » est passe de
// 3 300 ms a 6 017 ms sur la meme machine, du seul fait de la copie.
//
// LA CI N'EN VOYAIT RIEN. Elle part d'un checkout neuf, sans `.claude/`.
// C'est donc le crochet local qui divergeait de la cible qu'il rejoue --
// exactement la famille de defaut que `scripts/hooks/pre-push` nomme a sa
// limite 3 pour `npm ci`.
//
// ON ETEND LE DEFAUT, ON NE LE REMPLACE PAS. Ecrire `exclude: [...]` sans
// `configDefaults.exclude` reintroduirait `node_modules` dans la collecte.
// ---------------------------------------------------------------------------
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
});
