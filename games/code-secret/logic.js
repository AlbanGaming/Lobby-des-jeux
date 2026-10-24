// Code Secret — génération du code, notation des essais, déductions automatiques.

export const LENGTH = 4;
export const MAX_TRIES = 10;

/** Code de 4 chiffres (le premier peut être 0). `unique` : pas de chiffre répété. */
export function makeCode(rng, unique = true) {
  const out = [];
  while (out.length < LENGTH) {
    const d = rng.int(0, 9);
    if (unique && out.includes(d)) continue;
    out.push(d);
  }
  return out;
}

/** Bien placés (exact) et mal placés (misplaced), règles classiques avec doublons. */
export function score(code, guess) {
  let exact = 0;
  const restCode = [];
  const restGuess = [];
  for (let i = 0; i < LENGTH; i++) {
    if (guess[i] === code[i]) exact++;
    else {
      restCode.push(code[i]);
      restGuess.push(guess[i]);
    }
  }
  let misplaced = 0;
  for (const d of restGuess) {
    const k = restCode.indexOf(d);
    if (k >= 0) {
      misplaced++;
      restCode.splice(k, 1);
    }
  }
  return { exact, misplaced };
}

/**
 * Déductions sûres à partir de l'historique (aide au joueur, jamais de triche) :
 * - un essai sans aucun chiffre présent élimine tous ses chiffres ;
 * - en mode chiffres uniques, un essai à 4 présents confirme exactement ces chiffres.
 */
export function deductions(history, unique) {
  const excluded = new Set();
  const confirmed = new Set();
  for (const h of history) {
    const present = h.exact + h.misplaced;
    if (present === 0) h.guess.forEach((d) => excluded.add(d));
    if (unique && present === LENGTH) {
      h.guess.forEach((d) => confirmed.add(d));
      for (let d = 0; d <= 9; d++) if (!h.guess.includes(d)) excluded.add(d);
    }
  }
  return { excluded, confirmed };
}

/** Points d'un coffre ouvert. */
export function vaultPoints({ tries, tools, mult = 1 }) {
  return Math.max(100, Math.round((1000 - (tries - 1) * 90 - tools * 150) * mult));
}
