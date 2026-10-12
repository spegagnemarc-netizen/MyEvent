
/* Identité visuelle ORÉVAMI uniquement.
   Les identifiants techniques existants restent inchangés. */
(() => {
  'use strict';

  const markup = `
    <span class="orevamiBrand">
      <img
        class="orevamiLogoLight"
        src="/assets/orevami/logo-light.png"
        alt="ORÉVAMI — Vos sorties prennent vie"
      >
      <img
        class="orevamiLogoDark"
        src="/assets/orevami/logo-transparent.png"
        alt="ORÉVAMI — Vos sorties prennent vie"
      >
    </span>
  `;

  window.OrevamiBrand = Object.freeze({
    name: 'ORÉVAMI',
    slogan: 'Vos sorties prennent vie',
    markup,
    create() {
      const holder = document.createElement('span');
      holder.innerHTML = markup;
      return holder.firstElementChild;
    }
  });
})();
