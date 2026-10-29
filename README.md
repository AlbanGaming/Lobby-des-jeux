# GameVerse

Un portail de mini-jeux fait main, 100 % statique, gratuit, sans publicité ni traceur.
En ligne : **https://albangaming.github.io/Lobby-des-jeux/**

Tout est en HTML, CSS et JavaScript « à la main » (modules ES), sans étape de construction :
le dépôt est servi tel quel par GitHub Pages. La progression des joueurs reste dans leur
navigateur (localStorage).

## Les jeux

| Catégorie | Jeux |
|---|---|
| Arcade | Volt Rush, Plume, Bubble Pop, Tic Tac, Gratte-Ciel, Orbite, Serpentin *(jeu secret)* |
| Réflexion | Code Secret, Alchimie, Pixel Mystère, Banquise |
| Quiz & mots | Motif, Énigmes Éclair, Le Juste Prix, Globe-trotteur, Lettres en vrac |
| Stratégie | Morpion Dynamique, Conquête, Rempart |
| Gestion & idle | Paint Empire, Le Potager, F1 Manager |

Chaque jeu a une vignette animée au survol, des succès, des choses à débloquer, un défi du jour
(souvent un « … du jour » identique pour tous) et une relance rapide (Espace ou R).

**F1 Manager** (`page-11/`) est conservé volontairement dans sa version d'origine : il n'utilise
pas le socle commun et **ne doit pas être modifié, déplacé ni supprimé**.

## Ce que le joueur gagne

- **XP et niveaux** à chaque partie (record battu : +25 %), **crédits** à chaque partie, à chaque
  niveau et à chaque succès.
- **Série de jours** : jouer chaque jour la prolonge.
- **Défi du jour** : un défi tiré chaque jour parmi les jeux (+150 XP, +40 crédits).
- **Boutique** (bouton crédits du lobby) : thèmes du portail, cadres, accessoires et titres
  d'avatar, célébrations de record, packs de sons, objets (gel de série, relance du défi, boost
  d'XP), coffre surprise et jeux secrets.

## Organisation du dépôt

```
index.html, lobby/        le lobby (accueil, sélection, grille, profil, boutique, réglages)
games/registry.js         la liste des jeux : titre, catégorie, succès, défis du jour…
games/<id>/               un dossier par jeu : index.html, main.js, style.css, thumb.svg
shared/css/               design system : tokens (et thèmes), base, composants, coquille des jeux
shared/js/gameverse.js    bootGame() : relie un jeu à la coquille, à l'audio et à la méta
shared/js/meta.js         progression commune (XP, crédits, succès, série, défi, boutique)
shared/js/shop.js         catalogue de la boutique et application du look équipé
shared/js/storage.js      localStorage robuste : try/catch, préfixe gv:, versions, migrations
shared/js/engine/         boucle, canvas, saisie, particules, effets, audio synthétisé
shared/js/core/           maths, hasard reproductible (seeds du jour), interpolations
shared/js/ui/             coquille (accueil, pause, fin), icônes, toasts, avatars, célébrations
shared/fonts/             polices auto-hébergées (licence SIL OFL, fichiers joints)
page1.html … page10.html  anciennes adresses : redirigent vers les jeux refaits
page-11/                  F1 Manager, d'origine (ne pas toucher)
dev/                      guide de style et bac à sable du moteur (outils de développement)
tests/                    tests Playwright, serveur local, outils (Lighthouse, images)
```

Les anciennes adresses `pageN.html` redirigent vers le nouveau jeu en gardant les paramètres.
Les anciennes sauvegardes (records, favoris) sont reprises une fois par `migrate-legacy.js` ;
les anciennes clés ne sont jamais effacées.

## Ajouter un jeu

1. Créer `games/<id>/` avec `index.html` (copier celui d'un jeu existant : polices, feuilles du
   socle, `fallback.js`), `main.js`, `style.css` et une vignette `thumb.svg` (320 × 200, classes
   préfixées, animations CSS : le lobby les met en pause hors survol).
2. Ajouter son entrée dans `games/registry.js` (catégorie, couleurs, succès, défis du jour,
   `xp: byScore(...)`). Pour un jeu secret de la boutique : `secret: { cost }`.
3. Dans `main.js` :

```js
import { bootGame } from '../../shared/js/gameverse.js';

const gv = bootGame('mon-jeu', {
  hud: [{ id: 'score', label: 'Score' }, { id: 'best', label: 'Record' }],
  howTo: [{ keys: ['Espace', 'icon:touch'], text: 'Sauter' }],
  onStart: startRun,
  onRestart: startRun,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
});
// … en fin de partie :
gv.gameOver({ score, stats: { … }, extraStats: [{ label: 'Pièces', value: 12 }] });
```

`gv.unlock(id)` débloque un succès, `gv.hud(id, valeur)` met à jour la barre du haut,
`gv.after(ms, fn)` enchaîne en respectant la pause, `gv.shell.startExtra` accueille les options
de l'écran d'accueil (modes, thèmes…). Les gros jeux de données vont dans un JSON à part
(`games/<id>/data/`).

Règles : chemins relatifs uniquement, aucun élément sous droits ni nom de marque, sauvegarde via
`createStore()` (jamais `localStorage` en direct), 60 images par seconde avec la boucle commune,
jouable au clavier, à la souris et au doigt.

## Développement

Il faut Node.js (seulement pour les outils ; le site n'en a pas besoin).

```bash
npm install
npx playwright install chromium
npm run serve          # http://localhost:4173/Lobby-des-jeux/
npm test               # tous les tests, sur bureau et téléphone (Pixel 7)
node tests/tools/lighthouse.mjs games/orbite/ mobile   # serveur lancé à côté
```

Les tests enregistrent des captures dans `tests/screenshots/` (ignorées par Git). Le bac à sable
du moteur est sur `dev/sandbox/`, le guide de style sur `dev/styleguide.html`.

## Crédits

Graphismes, sons (synthétisés en direct) et textes créés pour le site. Polices : Big Shoulders
Display, Rubik et Silkscreen, sous licence SIL Open Font (voir `shared/fonts/`).
