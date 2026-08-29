# Tests des widgets Heurix

Suite de tests pour les trois widgets **distribués aux clients** :
`heurix-search.js`, `heurix-tracker.js`, `heurix-browse-widget.js`.

## Lancer les tests

```bash
npm install    # une seule fois
npm test
```

En développement, relance automatique à chaque modification :
```bash
npm run test:watch
```

## Le principe : tester le contrat, pas seulement le code

Ces tests existent à cause d'un bug précis. Le widget de recherche
envoyait ses filtres de facette au format `"DIAM:DIAM_M8"`, alors que le
moteur compare les filtres directement aux annotations (`"DIAM_M8"`).
Cliquer une facette renvoyait donc **zéro résultat**, en production.

Les tests d'alors ne l'ont pas vu : ils **inventaient eux-mêmes** la
réponse de l'API. Un mock accepte n'importe quel format — il ne peut
pas signaler qu'on parle à côté du vrai serveur.

D'où la structure ici : `tests/fixtures/generate.py` fait tourner le
**vrai moteur Python**, capture ses réponses exactes et — surtout —
détermine empiriquement **quels formats de requête il accepte**. Les
tests JS s'appuient sur ce contrat plutôt que sur des suppositions.

### Régénérer le contrat

**Pas nécessaire pour lancer les tests** — le contrat généré
(`engine-contract.json`) est versionné, `npm test` fonctionne seul.

Uniquement après une modification de l'API du moteur, et il faut alors
indiquer où se trouve son code source :

```bash
HEURIX_ENGINE_PATH=/chemin/vers/heurix-engine npm run fixtures
npm test
```

Le script cherche aussi tout seul dans `~/heurix-engine`,
`~/Documents/GitHub/heurix-engine`, `~/Downloads/heurix-engine` et
`/opt/heurix-engine` — la variable n'est utile que si votre copie est
ailleurs.

Un test qui tombe après régénération est le signal recherché : le
widget et le moteur ne sont plus d'accord. C'est exactement ce qui
aurait dû alerter au moment du bug des facettes.

## Ce qui est couvert

| Fichier | Ce qu'il vérifie |
|---|---|
| `heurix-search.test.js` | Contrat avec le moteur (format des filtres, forme des hits), rendu, humanisation des facettes, navigation clavier, seuil de caractères, garde-fou clé serveur |
| `widgets.test.js` | Tracker (clic, achat, identifiant visiteur persistant) et widget Browse (URL, tri), garde-fou clé serveur sur les deux |

## Pièges connus de l'environnement de test

Deux comportements de jsdom qui font perdre du temps, déjà encapsulés
dans les utilitaires de test :

- **La bibliothèque s'attache au scope global de Node**, pas à `window`,
  quand elle est évaluée via `window.eval` — d'où les `global.Heurix`
  dans les tests plutôt que `window.Heurix`.
- **`scrollIntoView` n'est pas implémenté** par jsdom — il faut le
  définir à vide avant de charger un widget qui l'utilise.

## Ce qui n'est pas couvert

`console.js` (1 447 lignes) n'a pas de tests. C'est le prochain
candidat, mais il présente moins de risque immédiat : c'est votre
interface, pas du code distribué chez des clients — un bug s'y voit
tout de suite, alors qu'un widget cassé chez un client peut passer
inaperçu longtemps.

## Une lenteur qui frôle le délai d'expiration (relevé du 29 août 2026)

`index-recherche.test.js` porte quatre sous-tests qui lancent chacun le
vérificateur d'index dans un sous-processus Python. Mesurés **au repos** :

```
sort 0 quand l'index correspond aux pages          2 846 ms
tourne SANS le moteur ni sa wheel                  2 766 ms
NOMME la page fautive plutôt que de sortir 1       2 771 ms
détecte une page AJOUTÉE                           2 772 ms
```

Le délai d'expiration de vitest est celui par défaut, **5 000 ms** : ce dépôt
n'a pas de `vitest.config`. La marge est donc d'environ 2,2 s.

**Sous charge, ces mêmes sous-tests ont été mesurés entre 3,2 et 4,2 s** —
machine occupée par deux serveurs `uvicorn` et deux serveurs HTTP statiques.
La marge tombe alors sous la seconde.

Le même après-midi, **un échec unique est apparu deux fois** pendant cette
période chargée, puis **treize passes consécutives vertes** une fois la
machine calme, dont trois immédiatement après régénération de l'index. Le nom
du test en échec n'a pas été capturé, et le défaut n'a jamais été reproduit.

**Ce relevé ne conclut pas.** La corrélation entre charge et durée est
mesurée ; le lien avec les deux échecs est une hypothèse, pas un fait. Il est
écrit ici pour que la prochaine personne qui voit rougir cette suite sans
raison apparente commence par regarder la durée des sous-tests plutôt que
leur logique — et, si l'hypothèse se confirme, sache que le remède tient en
un `testTimeout` explicite.
