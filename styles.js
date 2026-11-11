// Styles de l'overlay, injectés dans le Shadow Root via
// adoptedStyleSheets (le CSS de la page ne pénètre pas l'arbre
// fantôme, et un <style>/<link> serait soumis au CSP du site).
//
// Thème : noir mat et noir brillant, textes blanc cassé.
const CSS_CRASSE = `
/* ---------------------------------------------------------------
   TimeOut — effet "crasse"
   Rendu à l'intérieur d'un Shadow DOM : le CSS du site ne peut pas
   toucher ce qui suit.
   --------------------------------------------------------------- */

/* Permet d'animer le front de la crasse (pourcentage) via CSS. */
@property --creep {
  syntax: "<percentage>";
  inherits: true;
  initial-value: 105%;
}

.crasse-overlay,
.crasse-overlay * {
  box-sizing: border-box;
}

.crasse-overlay {
  /* --creep : position du front. 105% => crasse hors écran,
     -20% => la crasse a tout recouvert. */
  --creep: 105%;
  --duree: 12s;

  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", sans-serif;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 400;
  font-style: normal;
  letter-spacing: normal;
  text-align: center;
  text-transform: none;
  color: #f2f2f4;
  background: transparent;
  pointer-events: none; /* la page reste utilisable pendant la montée */
  user-select: none;
  -webkit-user-select: none;
  overscroll-behavior: none;
}

/* Scellé : le voile absorbe toutes les interactions. */
.crasse-overlay.is-bloque {
  pointer-events: auto;
}

.crasse-overlay.is-grimpe {
  animation: crasse-rampe var(--duree) cubic-bezier(0.45, 0.05, 0.55, 0.95)
    forwards;
}

@keyframes crasse-rampe {
  from {
    --creep: 105%;
  }
  to {
    --creep: -20%;
  }
}

/* Opacité de la crasse : un cran de plus chaque seconde jusqu'au
   scellement (steps(12) sur 12 s => +1/12 par seconde). */
@keyframes crasse-opacite {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes crasse-opacite-grain {
  from {
    opacity: 0;
  }
  to {
    opacity: 0.4;
  }
}

/* Fond pleinement opaque (noir mat), révélé au blocage complet. */
.crasse-fond {
  position: absolute;
  inset: 0;
  background: #050505;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.crasse-overlay.is-bloque .crasse-fond {
  opacity: 1;
}

/* --- La crasse elle-même : dégradé sombre qui avance ----------- */
.crasse-grime {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 50%,
    transparent var(--creep),
    rgba(74, 74, 76, 0.55) calc(var(--creep) + 8%),
    rgba(20, 20, 22, 0.97) calc(var(--creep) + 20%),
    #080809 calc(var(--creep) + 35%)
  );
}

/* Poussière / grain, masqué sur le même front que la crasse. */
.crasse-poussiere {
  position: absolute;
  inset: -12px;
  opacity: 0.4;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23g)' opacity='0.6'/%3E%3C/svg%3E");
  background-size: 240px 240px;
  -webkit-mask-image: radial-gradient(
    circle at 50% 50%,
    transparent var(--creep),
    #000 calc(var(--creep) + 12%)
  );
  mask-image: radial-gradient(
    circle at 50% 50%,
    transparent var(--creep),
    #000 calc(var(--creep) + 12%)
  );
  animation: crasse-grain 0.45s steps(1) infinite;
}

@keyframes crasse-grain {
  0% {
    background-position: 0 0;
  }
  25% {
    background-position: -30px 18px;
  }
  50% {
    background-position: 22px -26px;
  }
  75% {
    background-position: -14px -12px;
  }
  100% {
    background-position: 16px 30px;
  }
}

/* La crasse monte en opacité, un cran par seconde, pendant la rampe. */
.crasse-overlay.is-grimpe .crasse-grime {
  animation: crasse-opacite var(--duree) steps(12) forwards;
}

.crasse-overlay.is-grimpe .crasse-poussiere {
  animation:
    crasse-grain 0.45s steps(1) infinite,
    crasse-opacite-grain var(--duree) steps(12) forwards;
}

/* --- Le défi : carte en noir brillant, strictement centrée ------ */
.crasse-panneau {
  position: relative;
  width: min(560px, 94vw);
  max-height: calc(100vh - 48px);
  overflow-x: hidden;
  overflow-y: auto;
  padding: 30px 32px 28px;
  background: linear-gradient(
    165deg,
    rgba(34, 34, 37, 0.985) 0%,
    rgba(15, 15, 17, 0.985) 45%,
    rgba(6, 6, 7, 0.985) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  box-shadow: 0 34px 90px rgba(0, 0, 0, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 -1px 0 rgba(0, 0, 0, 0.6);
  opacity: 0;
  transform: translateY(16px) scale(0.97);
  transition: opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s;
  text-align: center;
  color: #f2f2f4;
}

/* Reflet spéculaire sur le haut de la carte (noir brillant). */
.crasse-panneau::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    130% 55% at 50% -8%,
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0) 62%
  );
  pointer-events: none;
}

.crasse-overlay.is-bloque .crasse-panneau {
  opacity: 1;
  transform: none;
}

.crasse-panneau h2 {
  position: relative;
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #ffffff;
}

.crasse-panneau p {
  position: relative;
  margin: 0 0 16px;
  font-size: 13.5px;
  color: #b9b9c0;
}

.crasse-phrase {
  position: relative;
  display: block;
  margin: 0 0 16px;
  padding: 13px 15px;
  background: rgba(255, 255, 255, 0.055);
  border: 1px dashed rgba(255, 255, 255, 0.35);
  border-radius: 10px;
  font-style: italic;
  font-size: 14.5px;
  color: #f5f5f7;
  user-select: text;
  -webkit-user-select: text;
}

.crasse-champ {
  position: relative;
  display: block;
  width: 100%;
  padding: 12px 14px;
  font: inherit;
  font-size: 14.5px;
  color: #f5f5f7;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  user-select: text;
  -webkit-user-select: text;
}

.crasse-champ::placeholder {
  color: #77777e;
}

.crasse-champ:focus {
  border-color: rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.16);
}

.crasse-aide {
  position: relative;
  margin-top: 12px !important;
  margin-bottom: 0 !important;
  font-size: 11.5px !important;
  color: #8b8b93 !important;
}

.crasse-minuteur {
  position: relative;
  margin: 10px 0 0;
  font-size: 60px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  color: #ffffff;
}

/* Masque les barres du navigateur : la crasse couvre tout l'écran. */
.crasse-plein-ecran {
  position: relative;
  display: inline-block;
  margin-top: 18px;
  padding: 8px 16px;
  font: inherit;
  font-size: 12.5px;
  color: #c9c9d0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.crasse-plein-ecran:hover {
  color: #0a0a0b;
  background: #ffffff;
  border-color: #ffffff;
}

:host(:fullscreen),
:host(:-webkit-full-screen) {
  background: #050505;
}
`;
