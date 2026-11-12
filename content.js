// Liste des phrases du défi (phrases.js, chargé avant ce script).
// Repli au cas où phrases.js ne serait pas chargé.
const LISTE_PHRASES =
  typeof PHRASES !== "undefined" && Array.isArray(PHRASES) && PHRASES.length
    ? PHRASES
    : ["Je ferme cet onglet inutile et je me remets au travail tout de suite"];

const DUREE_GRIMPE = 12;      // secondes, durée de la rampe normale
const DUREE_GRIMPE_RAPIDE = 0.4; // secondes, rampe rapide pour domaine frappé

// Style imposé à l'hôte (inline) : le site peut difficilement le déplacer,
// le masquer ou le dimensionner autrement. `pointer-events` est ajouté au
// scellement.
const CSS_HOTE = [
  "position:fixed",
  "top:0",
  "right:0",
  "bottom:0",
  "left:0",
  "width:100vw",
  "height:100vh",
  "display:block",
  "box-sizing:border-box",
  "margin:0",
  "padding:0",
  "border:0",
  "background:transparent",
  "overflow:hidden",
  "z-index:2147483647",
  "pointer-events:none",
  "transform:none",
  "opacity:1",
  "visibility:visible",
  "user-select:none",
  "-webkit-user-select:none",
  "color:#f2f2f4",
  "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
  "font-size:16px",
  "font-style:normal",
  "font-weight:400",
  "line-height:1.5",
  "letter-spacing:normal",
  "text-align:left",
  "text-transform:none",
  "direction:ltr"
]
  // Chaque déclaration en !important : seules les propriétés héritées du
  // site (letter-spacing, font-family, color...) pourraient sinon fuiter
  // dans l'arbre fantôme, et une règle !important du site battrait un
  // style inline non important.
  .map((declaration) => `${declaration} !important`)
  .join(";");

// Événements que la page ne doit plus recevoir une fois l'écran scellé.
const TYPES_EVENEMENTS = [
  "click", "auxclick", "dblclick", "contextmenu", "selectstart",
  "mousedown", "mouseup", "mousemove", "mouseover", "mouseout",
  "pointerdown", "pointerup", "pointermove", "pointerover", "pointerout",
  "pointercancel", "pointerleave", "wheel", "mousewheel",
  "touchstart", "touchmove", "touchend", "touchcancel",
  "gesturestart", "gesturechange", "gestureend",
  "keydown", "keyup", "keypress",
  "beforeinput", "input", "change",
  "paste", "copy", "cut",
  "dragstart", "drag", "dragend", "drop",
  "scroll", "scrollend", "resize",
  "focus", "blur", "focusin", "focusout"
];

let hote = null;          // élément hôte, enfant de <html> (donc hors de <body>)
let racine = null;        // ShadowRoot
let overlay = null;
let panneau = null;
let boutonPleinEcran = null;

let bloquee = false;      // écran scellé : toutes les interactions suspendues
let resolu = false;
let minuteurScellement = null;
let minuterieDefi = null;
let observateurs = [];
let ecouteursActifs = false;
let memoPage = null;      // état de la page avant scellement
let ecouteurPleinEcran = null;
let cssTextHoteAttendu = "";

// Signale au service worker que le script est prêt : couvre le cas où le
// message "declencherCrasse" arriverait avant l'injection du content script.
// Signale sa présence au service worker et demande si ce domaine est
// déjà "frappé" : dans ce cas, on se scelle immédiatement, sans attendre
// la moindre minuterie (voie la plus fiable : elle part du document).
chrome.runtime
  .sendMessage({ action: "contenuPret" })
  .then((reponse) => {
    if (reponse && reponse.frappe) declencherCrasse(true);
  })
  .catch(() => {});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.action === "declencherCrasse") {
    declencherCrasse(!!message.immediat);
  }
});

function declencherCrasse(immediat) {
  if (hote) return; // déjà en cours (doublon de déclenchement)

  chrome.storage.local.get(
    { retypePhrase: true, blockSeconds: 120 },
    (reglages) => {
      if (hote) return;
      if (!document.body) {
        document.addEventListener(
          "DOMContentLoaded",
          () => creerOverlay(reglages, immediat),
          { once: true }
        );
        return;
      }
      creerOverlay(reglages, immediat);
    }
  );
}

/* ------------------------------------------------------------------
   Construction de l'overlay — en Shadow DOM, à l'abri du CSS du site
   ------------------------------------------------------------------ */
function creerOverlay(reglages, immediat) {
  if (hote) return;
  // Premier passage : la crasse rampe lentement. Domaine déjà frappé :
  // rampe ultra-rapide (0.4s) pour que le site soit inutilisable quasi immédiatement.
  const duree = immediat
    ? DUREE_GRIMPE_RAPIDE * 1000
    : DUREE_GRIMPE * 1000;
  resolu = false;
  bloquee = false;

  hote = document.createElement("div");
  hote.setAttribute("data-timeout", "crasse");
  appliquerStylesHote();

  racine = hote.attachShadow({ mode: "open" });

  // Le CSS de la page ne pénètre pas dans l'arbre fantôme : on y applique
  // nos propres feuilles (constructed stylesheet, insensible au CSP).
  const feuille = new CSSStyleSheet();
  feuille.replaceSync(CSS_CRASSE);
  racine.adoptedStyleSheets = [feuille];

  overlay = document.createElement("div");
  overlay.className = "crasse-overlay";
  overlay.style.setProperty("--duree", `${duree}ms`);

  const fond = document.createElement("div");
  fond.className = "crasse-fond";

  const grime = document.createElement("div");
  grime.className = "crasse-grime";

  const poussiere = document.createElement("div");
  poussiere.className = "crasse-poussiere";

  panneau = document.createElement("div");
  panneau.className = "crasse-panneau";

  construireDefi(panneau, reglages);
  panneau.appendChild(ajouterBoutonPleinEcran());

  overlay.append(fond, grime, poussiere, panneau);
  racine.appendChild(overlay);

  // Hors de <body> : le gel de <body> (inert) n'atteint pas l'overlay.
  document.documentElement.appendChild(hote);

  installerObservateurs();

  // Laisse le navigateur peindre l'état initial avant l'animation.
  requestAnimationFrame(() => overlay && overlay.classList.add("is-grimpe"));

  // Une fois la crasse arrivée au centre : blocage total + défi.
  minuteurScellement = setTimeout(sceller, duree + 120);
}

/* ------------------------------------------------------------------
   Scellement : couverture totale + toutes les interactions coupées
   ------------------------------------------------------------------ */
function sceller() {
  if (!hote || bloquee || resolu) return;
  bloquee = true;
  overlay.classList.add("is-bloque");
  appliquerStylesHote(); // fait passer pointer-events à "auto"

  bloquerPage();
  installerEcouteurs();

  // Le temps mort démarre au scellement — sauf si la phrase est
  // exigée : il attendra la validation de la phrase.
  if (!phraseExigee) demarrerMinuteur();

  // Le service worker mémorise la frappe : rechargement ou nouvel onglet
  // de ce domaine => ré-scellement immédiat.
  chrome.runtime.sendMessage({ action: "scelle" }).catch(() => {});

  // Le défi prend le focus, au milieu de l'écran.
  const champ = racine.querySelector(".crasse-champ");
  if (champ) {
    setTimeout(() => {
      try {
        champ.focus({ preventScroll: true });
      } catch (e) {}
    }, 380);
  } else {
    try {
      hote.tabIndex = -1;
      hote.focus({ preventScroll: true });
    } catch (e) {}
  }
}

function bloquerPage() {
  const html = document.documentElement;
  const corps = document.body;
  const PROPPRISE = { overflow: "hidden", "user-select": "none", "overscroll-behavior": "none" };

  memoPage = { html: {}, corps: {}, inertAvant: corps.hasAttribute("inert") };

  [html, corps].forEach((noeud) => {
    const cible = noeud === html ? memoPage.html : memoPage.corps;
    Object.keys(PROPPRISE).forEach((nom) => {
      cible[nom] = {
        valeur: noeud.style.getPropertyValue(nom),
        priorite: noeud.style.getPropertyPriority(nom)
      };
      noeud.style.setProperty(nom, PROPPRISE[nom], "important");
    });
  });

  // inert : plus aucun focus, clic, touche, sélection ni défilement
  // clavier sur la page derrière le voile.
  corps.inert = true;
}

function debloquerPage() {
  if (!memoPage) return;
  const noeuds = [document.documentElement, document.body];
  [memoPage.html, memoPage.corps].forEach((etat, i) => {
    const noeud = noeuds[i];
    if (!noeud) return;
    Object.keys(etat).forEach((nom) => {
      const avant = etat[nom];
      if (avant.valeur) noeud.style.setProperty(nom, avant.valeur, avant.priorite);
      else noeud.style.removeProperty(nom);
    });
  });
  if (!memoPage.inertAvant) document.body.removeAttribute("inert");
  memoPage = null;
}

/* ------------------------------------------------------------------
   Écouteurs : la page ne reçoit plus rien, l'overlay reste utilisable
   ------------------------------------------------------------------ */
function installerEcouteurs() {
  if (ecouteursActifs) return;
  ecouteursActifs = true;
  TYPES_EVENEMENTS.forEach((type) => {
    // Capture au plus haut niveau : tout ce qui ne vient pas de l'overlay
    // est étouffé avant d'atteindre le site.
    window.addEventListener(type, surCaptureExterne, true);
    // À la sortie de l'overlay : le site ne voit pas non plus ce qui se
    // passe à l'intérieur du défi (frappe, clics...).
    hote.addEventListener(type, surSortieInterne, false);
  });
}

function retirerEcouteurs() {
  if (!ecouteursActifs) return;
  ecouteursActifs = false;
  TYPES_EVENEMENTS.forEach((type) => {
    window.removeEventListener(type, surCaptureExterne, true);
    if (hote) hote.removeEventListener(type, surSortieInterne, false);
  });
}

function surCaptureExterne(e) {
  if (!bloquee) return;
  if (e.composedPath().includes(hote)) return; // géré à la sortie de l'overlay
  if (e.cancelable) e.preventDefault();
  e.stopImmediatePropagation();
}

function surSortieInterne(e) {
  if (!bloquee) return;

  const cible = e.composedPath()[0];
  const dansUnChamp =
    cible instanceof Element && cible.matches("input, textarea, [contenteditable]");

  // Copier-coller totalement désactivé dans la fenêtre de crasse.
  if (e.type === "paste" || e.type === "copy" || e.type === "cut" || e.type === "drop") {
    e.preventDefault();
  }
  // Menu contextuel désactivé (il proposerait coller/copier).
  if (e.type === "contextmenu") e.preventDefault();
  // Toutes les touches sauf la saisie dans le champ (Tab compris) sont
  // neutralisées.
  if (e.type === "keydown" && (!dansUnChamp || e.key === "Tab")) e.preventDefault();
  // Un glisser-déposer de texte ne doit pas remplir le champ.
  if (e.type === "beforeinput" && e.inputType === "insertFromPaste") e.preventDefault();

  // Les écouteurs du site (sur document/window) ne capteront rien :
  // ni la frappe, ni les clics, ni les événements du voile.
  e.stopPropagation();
}

/* ------------------------------------------------------------------
   Résistance aux tentatives du site de casser l'overlay
   ------------------------------------------------------------------ */
function appliquerStylesHote() {
  if (!hote) return;
  hote.style.cssText = bloquee
    ? `${CSS_HOTE};pointer-events:auto !important`
    : CSS_HOTE;
  cssTextHoteAttendu = hote.style.cssText; // relu après normalisation
}

function installerObservateurs() {
  // 1. L'hôte ne doit jamais être détaché du document.
  const obsHote = new MutationObserver(() => {
    if (resolu || !hote) return;
    if (!hote.isConnected) document.documentElement.appendChild(hote);
  });
  obsHote.observe(document.documentElement, { childList: true });

  // 2. Le style inline de l'hôte ne doit pas être réécrit par le site.
  //    Comparaison sur le cssText complet : stable, pas de boucle.
  const obsStyle = new MutationObserver(() => {
    if (resolu || !hote) return;
    if (hote.style.cssText !== cssTextHoteAttendu) appliquerStylesHote();
  });
  obsStyle.observe(hote, { attributes: true, attributeFilter: ["style"] });

  // 3. Le contenu de l'overlay ne doit pas être supprimé par le site.
  const obsRacine = new MutationObserver(() => {
    if (resolu || !racine || !overlay) return;
    if (!overlay.isConnected) racine.appendChild(overlay);
  });
  obsRacine.observe(racine, { childList: true });

  observateurs = [obsHote, obsStyle, obsRacine];
}

/* ------------------------------------------------------------------
   Défi : le temps mort est TOUJOURS exigé ; recopier la phrase n'est
   qu'une option (case à cocher dans le popup). La libération a lieu
   quand le minuteur est écoulé ET, si la case est cochée, quand la
   phrase a été recopiée.
   ------------------------------------------------------------------ */
let phraseExigee = false;
let minuteurFini = false;
let phraseRecopiee = false;
let compteMinuteur = null;
let minuteurRestant = 0;
let conteneurDefi = null;
let phraseCiblee = "";     // phrase tirée au hasard pour ce défi
let elementPhrase = null;  // <blockquote> affiché (mot à mot)
let champPhrase = null;    // <input> de saisie

function construireDefi(conteneur, reglages) {
  phraseExigee = reglages.retypePhrase !== false;
  minuteurFini = false;
  phraseRecopiee = false;
  compteMinuteur = null;
  conteneurDefi = conteneur;
  minuteurRestant = Math.max(10, Number(reglages.blockSeconds) || 120);

  const titre = document.createElement("h2");
  titre.textContent = phraseExigee ? "Écran encrassé" : "Temps mort forcé";
  conteneur.appendChild(titre);

  // Option "retype a phrase" : d'abord la phrase ; le compte à rebours
  // n'apparaît (et ne démarre) qu'après validation. Sinon : directement
  // le temps mort classique.
  if (phraseExigee) {
    construireDefiSaisie(conteneur);
  } else {
    afficherMinuteur(conteneur);
  }
}

// Les deux conditions du défi doivent être réunies pour libérer l'écran.
function tenterLiberation() {
  if (resolu || !minuteurFini) return;
  if (phraseExigee && !phraseRecopiee) return;
  liberer();
}

function construireDefiSaisie(conteneur) {
  // Phrase tirée au hasard parmi les 40 (phrases.js).
  phraseCiblee = LISTE_PHRASES[Math.floor(Math.random() * LISTE_PHRASES.length)];

  const bloc = document.createElement("div");
  bloc.className = "crasse-phrase-bloc";

  const introPhrase = document.createElement("p");
  introPhrase.textContent =
    "Pour nettoyer l'écran, recopiez scrupuleusement cette phrase :";

  const phrase = document.createElement("blockquote");
  phrase.className = "crasse-phrase";
  elementPhrase = phrase;

  const champ = document.createElement("input");
  champ.type = "text";
  champ.className = "crasse-champ";
  champ.autocomplete = "off";
  champ.spellcheck = false;
  champ.placeholder = "Tapez la phrase ici…";
  champ.setAttribute("aria-label", "Phrase à recopier");
  champPhrase = champ;

  const aide = document.createElement("p");
  aide.className = "crasse-aide";
  aide.textContent =
    "Casse, accents, espaces et ponctuation ignorés : le texte doit être complet. Les mots faux sont surlignés en gris et le copier-coller est bloqué. Le compte à rebours démarrera ensuite.";

  bloc.append(introPhrase, phrase, champ, aide);
  conteneur.appendChild(bloc);

  champ.addEventListener("input", () => {
    dessinerPhrase();
    if (normaliser(champ.value) !== normaliser(phraseCiblee)) return;
    phraseRecopiee = true;
    validerPhrase();
  });

  dessinerPhrase();
}

/* Affiche la phrase mot à mot :
   - mot déjà tapé (ou simple préfixe en cours de frappe) : blanc normal,
   - mot pas encore atteint : gris très discret,
   - mot fautif : surligné sur fond gris clair.
   Le champ de saisie passe en style "erreur" tant qu'un mot diffère. */
function dessinerPhrase() {
  if (!elementPhrase) return;

  const valeur = (champPhrase ? champPhrase.value : "").trim();
  const saisies = valeur ? valeur.replace(/\s+/g, " ").split(/\s+/) : [];
  const cibles = phraseCiblee.split(/\s+/);

  elementPhrase.textContent = "";
  elementPhrase.appendChild(document.createTextNode("« "));

  let faux = false;
  cibles.forEach((mot, i) => {
    const span = document.createElement("span");
    span.className = "mot";

    if (i >= saisies.length) {
      span.classList.add("mot-attente");
    } else if (normaliser(mot).startsWith(normaliser(saisies[i]))) {
      span.classList.add("mot-ok");
    } else {
      span.classList.add("mot-faux");
      faux = true;
    }

    span.textContent = mot;
    elementPhrase.appendChild(span);
    if (i < cibles.length - 1) elementPhrase.appendChild(document.createTextNode(" "));
  });

  elementPhrase.appendChild(document.createTextNode(" »"));

  if (champPhrase) {
    // Un mot de trop compte aussi comme une différence.
    const enTrop = saisies.length > cibles.length;
    champPhrase.classList.toggle("is-erreur", faux || enTrop);
  }
}

// Phrase validée : le champ disparaît, le compte à rebours classique
// prend la place et démarre immédiatement.
function validerPhrase() {
  if (resolu || minuteurFini || minuterieDefi || !conteneurDefi) return;

  const bloc = conteneurDefi.querySelector(".crasse-phrase-bloc");
  if (bloc) bloc.remove();
  elementPhrase = null;
  champPhrase = null;

  const titre = conteneurDefi.querySelector("h2");
  if (titre) titre.textContent = "Temps mort forcé";

  afficherMinuteur(conteneurDefi);
  demarrerMinuteur();

  // La saisie disparaît : le focus repasse sur l'hôte du défi.
  try {
    if (hote) {
      hote.tabIndex = -1;
      hote.focus({ preventScroll: true });
    }
  } catch (e) {}
}

function normaliser(texte) {
  return String(texte)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:«»"'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------
   Défi : temps mort (toujours présent). Avec l'option "retype a
   phrase", il n'apparaît qu'après validation de la phrase ; sinon il
   démarre au moment du scellement.
   ------------------------------------------------------------------ */
function afficherMinuteur(conteneur) {
  const intro = document.createElement("p");
  intro.textContent = "Revenez à la réalité. L'écran se nettoie tout seul dans :";

  const compte = document.createElement("p");
  compte.className = "crasse-minuteur";
  compte.textContent = formater(minuteurRestant);

  conteneur.append(intro, compte);
  compteMinuteur = compte;
}

function demarrerMinuteur() {
  if (!compteMinuteur || minuterieDefi || minuteurFini) return;

  minuterieDefi = setInterval(() => {
    minuteurRestant -= 1;
    compteMinuteur.textContent = formater(Math.max(0, minuteurRestant));
    if (minuteurRestant <= 0) {
      clearInterval(minuterieDefi);
      minuterieDefi = null;
      minuteurFini = true;
      tenterLiberation();
    }
  }, 1000);
}

function formater(secondes) {
  const min = Math.floor(secondes / 60);
  const sec = secondes % 60;
  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

/* ------------------------------------------------------------------
   Plein écran : la crasse couvre aussi les barres du navigateur
   ------------------------------------------------------------------ */
function ajouterBoutonPleinEcran() {
  boutonPleinEcran = document.createElement("button");
  boutonPleinEcran.type = "button";
  boutonPleinEcran.className = "crasse-plein-ecran";
  boutonPleinEcran.textContent = "Masquer les barres du navigateur (plein écran)";
  boutonPleinEcran.addEventListener("click", () => {
    if (document.fullscreenElement) {
      // Déjà en plein écran : on sort
      document.exitFullscreen().catch(() => {});
    } else {
      const cible = hote || document.documentElement;
      const promesse = cible.requestFullscreen && cible.requestFullscreen();
      if (promesse && promesse.catch) promesse.catch(() => {});
    }
  });

  ecouteurPleinEcran = () => {
    if (!boutonPleinEcran) return;
    const enPleinEcran = !!document.fullscreenElement;
    boutonPleinEcran.hidden = false;
    boutonPleinEcran.textContent = enPleinEcran
      ? "Quitter le mode plein écran"
      : "Masquer les barres du navigateur (plein écran)";
  };
  document.addEventListener("fullscreenchange", ecouteurPleinEcran);

  return boutonPleinEcran;
}

/* ------------------------------------------------------------------
   Libération après le défi
   ------------------------------------------------------------------ */
function liberer() {
  if (resolu) return;
  resolu = true;
  phraseExigee = false;
  minuteurFini = false;
  phraseRecopiee = false;
  compteMinuteur = null;
  conteneurDefi = null;
  phraseCiblee = "";
  elementPhrase = null;
  champPhrase = null;

  if (minuteurScellement) {
    clearTimeout(minuteurScellement);
    minuteurScellement = null;
  }
  if (minuterieDefi) {
    clearInterval(minuterieDefi);
    minuterieDefi = null;
  }
  if (ecouteurPleinEcran) {
    document.removeEventListener("fullscreenchange", ecouteurPleinEcran);
    ecouteurPleinEcran = null;
  }

  retirerEcouteurs();
  debloquerPage();
  observateurs.forEach((obs) => obs.disconnect());
  observateurs = [];

  if (document.fullscreenElement === hote && document.exitFullscreen) {
    const promesse = document.exitFullscreen();
    if (promesse && promesse.catch) promesse.catch(() => {});
  }
  if (hote) hote.remove();

  hote = null;
  racine = null;
  overlay = null;
  panneau = null;
  boutonPleinEcran = null;
  bloquee = false;

  // "Time before grime" repart sur ce même site, sans rechargement :
  // le service worker re-planifie une période de grâce complète pour
  // cet onglet (la frappe du domaine est conservée, mais ignorée ici).
  chrome.runtime
    .sendMessage({ action: "replanifierApresDefi" })
    .catch(() => {});
}
