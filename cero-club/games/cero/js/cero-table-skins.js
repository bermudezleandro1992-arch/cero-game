'use strict';

/** Aplica mesa equipada desde la tienda (localStorage / Firestore sync). */
const CeroTableSkins = (() => {
  const SKINS = {
    table_classic: '',
    table_dark:    'table-skin-dark',
    table_madera:  'table-skin-wood',
    table_cuero:   'table-skin-leather',
    table_marmol:  'table-skin-marble',
    table_oro:     'table-skin-gold',
    table_living:  'table-skin-living',
  };

  function apply() {
    let equipped = {};
    try { equipped = JSON.parse(localStorage.getItem('cero_equipped') || '{}'); } catch (_) {}
    const id = equipped.tables || 'table_classic';
    const cls = SKINS[id] || '';
    const oval = document.querySelector('.table-oval');
    if (!oval) return;
    Object.values(SKINS).forEach(c => { if (c) oval.classList.remove(c); });
    if (cls) oval.classList.add(cls);
    document.body.dataset.ceroTable = id;
  }

  /** En partida online todos ven la misma mesa (Dark Arena por defecto). */
  function applyOnline() {
    const oval = document.querySelector('.table-oval');
    if (!oval) return;
    Object.values(SKINS).forEach(c => { if (c) oval.classList.remove(c); });
    document.body.dataset.ceroTable = 'table_classic';
  }

  return { apply, applyOnline, SKINS };
})();

window.CeroTableSkins = CeroTableSkins;
