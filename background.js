// Délai de grâce en mode test (hook used by the E2E suites, which set
// testMode: true in storage): triggers after 5 seconds instead of the
// configured duration. Off by default.
const DELAI_TEST_MS = 5 * 1000;

// Un domaine déjà "frappé" (écran scellé au moins une fois) est ré-scellé
// quasi instantanément au rechargement, dans un nouvel onglet, et même
// après un rechargement ou une mise à jour de l'extension.
// (Les frappes vivent dans storage.local : storage.session serait effacée
// à chaque rechargement de l'extension et à chaque redémarrage du
// navigateur — seule la désinstallation l'efface.)
const DELAI_FRAPPE_MS = 0;

// Liste des domaines déjà frappés. Elle survit aux rechargements de
// page, de l'extension et du navigateur ; elle n'est effacée que par le
// bouton du popup, en retirant le site de la liste noire, ou en
// désinstallant l'extension.
const CLE_FRAPPES = "frappes";

// Valeurs écrites au premier lancement, puis modifiables depuis le popup.
const REGLAGES_DEFAUT = {
  retypePhrase: true, // true => la phrase doit aussi être recopiée
  duration: 120,      // secondes avant déclenchement (minimum 120)
  testMode: false,    // true => déclenchement au bout de 5 s (tests E2E)
  blockSeconds: 120,  // durée du temps mort (minimum 120)
  blacklist: ["twitter.com", "youtube.com", "reddit.com"]
};

// Durées minimales, en secondes : la salissure et le temps mort durent
// au moins 2 minutes.
const DUREE_MIN_SEC = 120;

// Un minuteur par onglet.
let timers = {};

function hoteDe(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}

function normaliserSite(site) {
  return String(site || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[/.]+$/, "");
}

// Compare l'hôte réel de la page avec la liste noire (évite les faux
// positifs du type "url.includes('youtube.com')" sur "notyoutube.com").
function estToxique(url, blacklist) {
  const hote = hoteDe(url);
  if (!hote) return false;
  return blacklist.some((site) => {
    const s = normaliserSite(site);
    return s.length > 0 && (hote === s || hote.endsWith("." + s));
  });
}

function lireReglages() {
  return chrome.storage.local.get(REGLAGES_DEFAUT);
}

function lireFrappes() {
  return chrome.storage.local.get({ [CLE_FRAPPES]: {} }).then((res) => res[CLE_FRAPPES]);
}

function enregistrerFrappes(frappes) {
  return chrome.storage.local.set({ [CLE_FRAPPES]: frappes });
}

// Retire les frappes dont le domaine n'est plus dans la liste noire.
function purgerFrappes(blacklist) {
  lireFrappes()
    .then((frappes) => {
      const conservees = {};
      Object.keys(frappes).forEach((hote) => {
        if (estToxique(`https://${hote}/`, blacklist)) conservees[hote] = frappes[hote];
      });
      if (Object.keys(conservees).length !== Object.keys(frappes).length) {
        return enregistrerFrappes(conservees);
      }
      return null;
    })
    .catch(() => {});
}

function annulerMinuteur(tabId) {
  if (timers[tabId]) {
    clearTimeout(timers[tabId]);
    delete timers[tabId];
  }
}

function delaiApresReglages(reglages) {
  if (reglages.testMode) return DELAI_TEST_MS;
  const secondes = Math.max(DUREE_MIN_SEC, Number(reglages.duration) || REGLAGES_DEFAUT.duration);
  return secondes * 1000;
}

// (Re)planifie le déclenchement pour un onglet donné.
// `ignorerFrappe` : programme une période de grâce complète même si le
// domaine est "frappé" (utilisé après résolution du défi : le temps mort
// écoulé fait repartir "Time before grime" sur le même onglet, sans
// rechargement — la frappe, elle, reste pour les rechargements et les
// nouveaux onglets).
async function planifierOnglet(tabId, url, ignorerFrappe = false) {
  if (!tabId || !url || !/^https?:/i.test(url)) {
    annulerMinuteur(tabId);
    return;
  }

  const [reglages, frappes] = await Promise.all([lireReglages(), lireFrappes()]);
  annulerMinuteur(tabId);
  if (!estToxique(url, reglages.blacklist)) return;

  const hote = hoteDe(url);
  const dejaFrappe =
    !ignorerFrappe && Object.prototype.hasOwnProperty.call(frappes, hote);
  const delai = dejaFrappe ? DELAI_FRAPPE_MS : delaiApresReglages(reglages);

  timers[tabId] = setTimeout(() => {
    delete timers[tabId];
    // Aucun listener sur une page non concernée : on ignore l'erreur.
    chrome.tabs
      .sendMessage(tabId, { action: "declencherCrasse", immediat: dejaFrappe })
      .catch(() => {});
  }, delai);
}

function verifierOnglet(tabId, url) {
  planifierOnglet(tabId, url).catch(() => {});
}

function reverifierTousLesOnglets() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id != null && tab.url) verifierOnglet(tab.id, tab.url);
    });
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) verifierOnglet(tabId, tab.url);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    if (tab.url) verifierOnglet(activeInfo.tabId, tab.url);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  annulerMinuteur(tabId);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || !sender.tab) return;

  // Le content script signale sa présence : on lui répond tout de suite
  // si son domaine est déjà "frappé" — il scelle alors lui-même, sans
  // attendre la moindre minuterie (la plus fiable des voies, car elle
  // part du cœur du document).
  if (message.action === "contenuPret") {
    verifierOnglet(sender.tab.id, sender.tab.url);
    const url = sender.tab.url || "";
    lireFrappes()
      .then((frappes) => {
        const hote = hoteDe(url);
        try {
          sendResponse({
            frappe: !!hote && Object.prototype.hasOwnProperty.call(frappes, hote)
          });
        } catch (e) {}
      })
      .catch(() => {});
    return true; // réponse asynchrone
  }

  // L'écran s'est scellé : ce domaine devient "frappé", tout rechargement
  // ou nouvel onglet le scellera presque immédiatement.
  if (message.action === "scelle") {
    const hote = hoteDe(sender.tab.url || "");
    if (!hote) return;
    lireFrappes()
      .then((frappes) => {
        if (Object.prototype.hasOwnProperty.call(frappes, hote)) return null;
        frappes[hote] = Date.now();
        return enregistrerFrappes(frappes);
      })
      .catch(() => {});
  }

  // Défi résolu : "Time before grime" repart sur ce même onglet, sans
  // rechargement — une grâce complète, même si le domaine est frappé.
  if (message.action === "replanifierApresDefi") {
    planifierOnglet(sender.tab.id, sender.tab.url, true).catch(() => {});
  }
});

// Les réglages changent (popup) => on purge les frappes devenues obsolètes
// et on re-planifie immédiatement les onglets ouverts.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // Liste noire modifiée => purge des frappes devenues obsolètes.
  if (changes.blacklist) purgerFrappes(changes.blacklist.newValue || []);
  // Tout changement local (réglages OU frappes relâchées par le popup)
  // re-planifie immédiatement les onglets ouverts.
  reverifierTousLesOnglets();
});

// Persiste les valeurs par défaut au premier installation.
chrome.runtime.onInstalled.addListener(() => {
  lireReglages().then((reglages) => chrome.storage.local.set(reglages));
});

// Redémarrage du navigateur : les minuteurs en mémoire ont été perdus,
// mais les frappes (storage.local) survivent => les onglets restaurés
// sont ré-scellés presque immédiatement.
chrome.runtime.onStartup.addListener(reverifierTousLesOnglets);
