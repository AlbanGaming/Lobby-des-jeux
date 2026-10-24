// Filet de sécurité (script classique, pas un module : il fonctionne même en file://).
// Si la page est ouverte depuis le disque, les navigateurs bloquent les modules JavaScript :
// au lieu d'une page vide, on explique comment lancer GameVerse. Si le site ne démarre pas
// pour une autre raison, on propose de recharger.
(function () {
  var root = document.documentElement;

  function show(kind) {
    if (root.hasAttribute('data-gv-ready') || document.querySelector('.gv-fallback')) return;
    var box = document.createElement('div');
    box.className = 'gv-fallback';
    box.setAttribute('role', 'alert');
    if (kind === 'file') {
      box.innerHTML =
        '<p class="gv-fallback__kicker">Page ouverte depuis un fichier</p>' +
        '<h2 class="gv-fallback__title">Lance GameVerse depuis un serveur</h2>' +
        '<p>Les navigateurs bloquent les jeux quand la page est ouverte directement depuis le disque (adresse en <code>file://</code>). Choisis une de ces solutions :</p>' +
        '<ol>' +
        '<li>Dans le dossier du projet, lance <code>npm run serve</code>, puis ouvre <code>http://localhost:4173/Lobby-des-jeux/</code></li>' +
        '<li>Ou ouvre le dossier dans VS Code avec l’extension <strong>Live Server</strong> (« Go Live »).</li>' +
        '<li>Ou joue en ligne sur <a href="https://albangaming.github.io/Lobby-des-jeux/">albangaming.github.io/Lobby-des-jeux</a> une fois le site publié.</li>' +
        '</ol>';
    } else {
      box.innerHTML =
        '<p class="gv-fallback__kicker">Oups</p>' +
        '<h2 class="gv-fallback__title">Le chargement a échoué</h2>' +
        '<p>Recharge la page. Si le problème continue, vide le cache du navigateur ou essaie un navigateur à jour.</p>' +
        '<p><button class="btn btn--primary" type="button">Recharger</button></p>';
      box.querySelector('button').addEventListener('click', function () {
        location.reload();
      });
    }
    document.body.appendChild(box);
  }

  if (location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', function () {
      show('file');
    });
    return;
  }
  window.addEventListener('load', function () {
    setTimeout(function () {
      show('error');
    }, 4000);
  });
})();
