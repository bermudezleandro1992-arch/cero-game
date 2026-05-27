'use strict';

/**
 * Interacción estilo UNO: validar → animar → aplicar. Drop zone pantalla completa.
 */
const CeroDrag = (() => {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  let _inited = false;

  function init() {
    if (_inited) return;
    _inited = true;

    const pile = document.getElementById('playPile');
    if (pile && pile.dataset.bound !== '1') {
      pile.dataset.bound = '1';
      pile.addEventListener('dragover', ev => {
        if (!ev.dataTransfer.types.includes('cero-card-id')) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        pile.classList.add('play-pile-active');
      });
      pile.addEventListener('dragleave', ev => {
        if (ev.target === pile) pile.classList.remove('play-pile-active');
      });
      pile.addEventListener('drop', ev => {
        ev.preventDefault();
        pile.classList.remove('play-pile-active');
        if (!ev.dataTransfer.types.includes('cero-card-id')) return;
        const id = ev.dataTransfer.getData('cero-card-id');
        if (!id) return;
        const cardEl = document.querySelector(`.player-hand .cero-card[data-card-id="${id}"]`);
        void _tryPlay(cardEl, id, ev.clientX, ev.clientY);
      });
    }

    window.addEventListener('wheel', e => {
      const hand = document.getElementById('playerHand');
      if (!hand?.matches(':hover')) return;
      hand.scrollBy({ behavior: 'auto', left: e.deltaY > 0 ? 100 : -100 });
    }, { passive: true });
  }

  function bindHand(handEl, enabled) {
    if (!handEl) return;
    init();
    handEl.classList.toggle('hand-disabled', !enabled);

    handEl.querySelectorAll('.cero-card[data-card-id]').forEach(cardEl => {
      cardEl.draggable = false;
      cardEl.ondragstart = null;
      cardEl.ondragend = null;
      cardEl.onclick = null;
      cardEl.style.visibility = '';
      cardEl.classList.remove('card-playable', 'card-tappable', 'card-unplayable');

      const id = cardEl.dataset.cardId;
      if (!id) return;

      const g = window._ceroGame;
      const block = enabled && g?.getPlayBlockReason
        ? g.getPlayBlockReason(id)
        : (enabled && g?.canPlayCardId?.(id) ? null : 'No podés jugar ahora');
      const canPlay = enabled && block === null;

      if (canPlay) {
        cardEl.classList.add('card-playable', 'card-tappable');
        cardEl.onclick = ev => {
          ev.stopPropagation();
          void _tryPlay(cardEl, id);
        };
        if (!isTouch) {
          cardEl.draggable = true;
          cardEl.ondragstart = ev => {
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('cero-card-id', id);
            cardEl.classList.add('is-dragging');
            document.getElementById('playPile')?.classList.add('play-pile-ready');
          };
          cardEl.ondragend = () => {
            cardEl.classList.remove('is-dragging');
            document.getElementById('playPile')?.classList.remove('play-pile-ready', 'play-pile-active');
          };
        }
        return;
      }

      if (enabled) {
        cardEl.classList.add('card-unplayable');
        const hint = block || cardEl.dataset.hint || 'No podés jugar esa carta — probá otra o robá del mazo.';
        cardEl.dataset.hint = hint;
        cardEl.onclick = ev => {
          ev.stopPropagation();
          _invalidPlay(cardEl);
          if (typeof _showPlayHint === 'function') _showPlayHint(hint);
        };
      }
    });
  }

  function _showError(msg) {
    const alert = document.createElement('div');
    alert.className = 'cero-play-alert';
    alert.textContent = msg;
    alert.addEventListener('animationend', () => alert.remove());
    document.body.appendChild(alert);
  }

  async function _tryPlay(cardEl, id, clientX, clientY) {
    const g = window._ceroGame;
    if (!g) return;

    const block = g.getPlayBlockReason?.(id) ?? (g.canPlayCardId?.(id) ? null : 'No podés jugar esa carta ahora');
    if (block) {
      _invalidPlay(cardEl);
      if (typeof _showPlayHint === 'function') _showPlayHint(block);
      return;
    }

    if (g._busy) {
      if (typeof _showPlayHint === 'function') _showPlayHint('Procesando la jugada anterior…');
      return;
    }

    let ok = false;

    if (g.playCard) {
      try {
        ok = await g.playCard(String(id));
      } catch (_) {
        ok = false;
      }
    } else if (g.tryPlayerPlay) {
      ok = g.tryPlayerPlay(id);
    } else if (g.playerPlay) {
      const before = g.hands?.[0]?.length ?? 0;
      g.playerPlay(id);
      ok = (g.hands?.[0]?.length ?? before) < before;
    }

    if (!ok) {
      _invalidPlay(cardEl);
      const msg = document.getElementById('statusBanner')?.textContent;
      if (msg && typeof _showPlayHint === 'function') _showPlayHint(msg);
      return;
    }

    const cx = clientX ?? (cardEl ? cardEl.getBoundingClientRect().left + cardEl.offsetWidth / 2 : window.innerWidth / 2);
    const cy = clientY ?? (cardEl ? cardEl.getBoundingClientRect().top + cardEl.offsetHeight / 2 : window.innerHeight * 0.55);
    _throwToCenter(cardEl, cx, cy, () => cardEl?.remove());
  }

  function _throwToCenter(cardEl, cx, cy, onDone) {
    if (!cardEl) {
      onDone?.();
      return;
    }
    const tx = window.innerWidth / 2;
    const ty = window.innerHeight * 0.42;
    const rot = Math.random() * 180 - 90;
    const ghost = cardEl.cloneNode(true);
    ghost.className = ghost.className.replace('is-dragging', '').replace('is-selected', '') + ' card-throw-ghost';
    ghost.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;z-index:9999;pointer-events:none;margin:0;transform:translate(-50%,-50%) rotate(${rot}deg)`;
    document.body.appendChild(ghost);
    cardEl.style.visibility = 'hidden';

    ghost.animate([
      { left: `${cx}px`, top: `${cy}px`, transform: `translate(-50%,-50%) rotate(${rot + 15}deg) scale(1.05)` },
      { left: `${tx}px`, top: `${ty}px`, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(.95)` },
    ], { duration: 280, fill: 'forwards', easing: 'ease' }).addEventListener('finish', () => {
      ghost.remove();
      onDone?.();
    });
  }

  function _invalidPlay(cardEl) {
    const handEl = cardEl?.closest('.player-hand');
    handEl?.querySelectorAll('.cero-card.is-selected').forEach(c => c.classList.remove('is-selected'));
    cardEl?.classList.add('is-selected');
    const hint = cardEl?.dataset.hint || 'Esa carta no se puede jugar. Probá otra o robá.';
    if (typeof _showPlayHint === 'function') _showPlayHint(hint);
  }

  return { init, bindHand, isTouch };
})();

window.CeroDrag = CeroDrag;
