// Must match background.js defaults.
const REGLAGES_DEFAUT = {
  retypePhrase: true,
  duration: 120,
  blockSeconds: 120,
  blacklist: ["twitter.com", "youtube.com", "reddit.com"]
};

const $ = (id) => document.getElementById(id);

let sites = [];
let frappes = {};

document.addEventListener("DOMContentLoaded", () => {
  charger();
  chargerFrappes();

  $("reset-frappes").addEventListener("click", relacherFrappes);

  $("retypePhrase").addEventListener("change", marquerModifie);
  ["duration", "blockSeconds"].forEach((id) => {
    $(id).addEventListener("input", marquerModifie);
  });

  $("add-site").addEventListener("click", ajouterSite);
  $("new-site").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ajouterSite();
    }
  });

  $("save").addEventListener("click", enregistrer);
});

function charger() {
  chrome.storage.local.get(REGLAGES_DEFAUT, (reglages) => {
    sites = (reglages.blacklist || []).slice();
    $("retypePhrase").checked = reglages.retypePhrase !== false;
    $("duration").value = Math.max(120, Number(reglages.duration) || 120);
    $("blockSeconds").value = reglages.blockSeconds;
    rendreSites();
  });
}

function marquerModifie() {
  setStatut("Settings changed — remember to save.", "");
}

/* --- Active blocks: already "struck" sites ------------------------ */
function chargerFrappes() {
  chrome.storage.local.get({ frappes: {} }, (res) => {
    if (chrome.runtime.lastError) return;
    frappes = (res && res.frappes) || {};
    rendreFrappes();
  });
}

function rendreFrappes() {
  const liste = $("frappes-list");
  liste.textContent = "";
  const hotes = Object.keys(frappes).sort();
  $("frappes-vide").hidden = hotes.length > 0;

  hotes.forEach((hote) => {
    const puce = document.createElement("span");
    puce.className = "puce plain";
    puce.textContent = hote;
    puce.title = `Blocked on reload (${new Date(frappes[hote]).toLocaleTimeString()})`;
    liste.appendChild(puce);
  });
}

function relacherFrappes() {
  chrome.storage.local.set({ frappes: {} }, () => {
    if (chrome.runtime.lastError) {
      setStatut("Failed to reset sites.", "erreur");
      return;
    }
    frappes = {};
    rendreFrappes();
    setStatut("Sites reset — grace period restored.", "ok");
  });
}

function setStatut(texte, classe) {
  const el = $("statut");
  el.textContent = texte;
  el.className = `statut ${classe}`.trim();
}

function normaliserSite(site) {
  return String(site || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function ajouterSite() {
  const champ = $("new-site");
  const site = normaliserSite(champ.value);

  if (!site || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(site)) {
    setStatut("Enter a valid domain, e.g. reddit.com", "erreur");
    champ.focus();
    return;
  }
  if (sites.some((s) => normaliserSite(s) === site)) {
    setStatut("This site is already in the list.", "erreur");
    champ.select();
    return;
  }

  sites.push(site);
  champ.value = "";
  rendreSites();
  marquerModifie();
  champ.focus();
}

function retirerSite(site) {
  sites = sites.filter((s) => s !== site);
  rendreSites();
  marquerModifie();
}

function rendreSites() {
  const liste = $("sites-list");
  liste.textContent = "";
  $("sites-vide").hidden = sites.length > 0;

  sites.forEach((site) => {
    const puce = document.createElement("span");
    puce.className = "puce";

    const texte = document.createElement("span");
    texte.textContent = site;

    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.textContent = "×";
    bouton.title = `Remove ${site}`;
    bouton.setAttribute("aria-label", `Remove ${site}`);
    bouton.addEventListener("click", () => retirerSite(site));

    puce.append(texte, bouton);
    liste.appendChild(puce);
  });
}

function enregistrer() {
  // Durations in seconds: grime trigger min 2 minutes (max 2h),
  // time out min 10 seconds (max 1h).
  const duration = Math.min(7200, Math.max(120, parseInt($("duration").value, 10) || REGLAGES_DEFAUT.duration));
  const blockSeconds = Math.min(3600, Math.max(10, parseInt($("blockSeconds").value, 10) || REGLAGES_DEFAUT.blockSeconds));

  $("duration").value = duration;
  $("blockSeconds").value = blockSeconds;

  const reglages = {
    retypePhrase: $("retypePhrase").checked,
    duration,
    blockSeconds,
    blacklist: sites
  };

  chrome.storage.local.set(reglages, () => {
    if (chrome.runtime.lastError) {
      setStatut("Failed to save.", "erreur");
      return;
    }
    setStatut("Saved ✓ applied to open tabs.", "ok");
  });
}
