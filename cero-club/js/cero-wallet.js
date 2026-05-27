'use strict';

/**
 * Gestión de Cero Coins — 1 CC = 1 ARS (Skill Gaming · Argentina)
 * Compras: comprobante obligatorio · revisión manual (sin acreditación automática).
 */
const CeroWallet = (() => {
  const CC_RATE = 1;
  const PACKS = [500, 1000, 1500, 2000, 3000, 5000, 10000, 15000, 20000, 30000, 50000, 100000];
  const PAYMENT_ALIAS = 'cero.club.mp';
  const RECEIPT_MAX_BYTES = 850_000;
  let _tab = 'adquirir';
  let _selectedPack = null;
  let _receiptData = null;
  let _receiptName = '';
  let _cameraStream = null;
  let _pendingUnsub = null;

  function _session() {
    try { return JSON.parse(sessionStorage.getItem('cero_user') || 'null'); } catch (_) { return null; }
  }

  function _hub() { return window.FBHub; }

  function _coins() {
    const s = _session();
    return s?.coins ?? window._fbUser?.coins ?? 0;
  }

  function _format(n) {
    return Number(n || 0).toLocaleString('es-AR');
  }

  function open() {
    if (typeof openModal === 'function') openModal('modalCoins');
    else document.getElementById('modalCoins')?.classList.add('active');
    refresh();
    _bindPendingListener();
  }

  function refresh() {
    const bal = document.getElementById('walletBalance');
    if (bal) bal.textContent = _format(_coins());
    const verified = _isVerified();
    const badge = document.getElementById('walletVerifiedBadge');
    if (badge) {
      badge.hidden = !verified;
      badge.textContent = verified ? '✓ Identidad verificada' : '';
    }
    _renderPacks();
    _renderRedeem();
    _renderPendingList();
    _updateTabs();
  }

  function _isVerified() {
    const s = _session();
    return !!(s?.identityVerified || window._fbUser?.identityVerified || window._lastFbProfile?.identityVerified);
  }

  function switchTab(tab) {
    _tab = tab;
    _updateTabs();
    const acquire = document.getElementById('walletPanelAcquire');
    const redeem = document.getElementById('walletPanelRedeem');
    const transfer = document.getElementById('walletPanelTransfer');
    if (acquire) acquire.hidden = tab !== 'adquirir';
    if (redeem) redeem.hidden = tab !== 'canjear';
    if (transfer) transfer.hidden = tab !== 'transferir';
    if (tab === 'canjear' && !_isVerified()) {
      const gate = document.getElementById('walletVerifyGate');
      if (gate) gate.hidden = false;
    }
  }

  function _updateTabs() {
    document.querySelectorAll('[data-wallet-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.walletTab === _tab);
    });
  }

  function _renderPacks() {
    const grid = document.getElementById('walletPackGrid');
    if (!grid) return;
    grid.innerHTML = PACKS.map(amt => `
      <button type="button" class="wallet-pack-card" data-pack="${amt}" onclick="CeroWallet.selectPack(${amt})">
        <span class="wpc-tag">DISPONIBLE</span>
        <span class="wpc-amount">${_format(amt)}</span>
        <span class="wpc-lbl">Cero Coins</span>
        <span class="wpc-ars">= $${_format(amt)} ARS</span>
      </button>`).join('');
  }

  function _renderRedeem() {
    const grid = document.getElementById('walletRedeemGrid');
    const gate = document.getElementById('walletVerifyGate');
    const content = document.getElementById('walletRedeemContent');
    const bal = _coins();
    const verified = _isVerified();
    if (gate) gate.hidden = verified;
    if (content) content.hidden = !verified;
    if (!grid || !verified) return;
    grid.innerHTML = PACKS.map(amt => {
      const ok = bal >= amt;
      return `<button type="button" class="wallet-pack-card wallet-pack-sell${ok ? '' : ' disabled'}" ${ok ? `onclick="CeroWallet.selectRedeem(${amt})"` : 'disabled'}>
        <span class="wpc-tag ${ok ? 'wpc-sell' : 'wpc-nope'}">${ok ? 'VENDER' : 'NO ALCANZA'}</span>
        <span class="wpc-amount">${_format(amt)}</span>
        <span class="wpc-lbl">Cero Coins</span>
        <span class="wpc-ars">= $${_format(amt)} ARS</span>
      </button>`;
    }).join('');
  }

  function _renderPendingList() {
    const el = document.getElementById('walletPendingList');
    if (!el) return;
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
    }
  }

  function _bindPendingListener() {
    const hub = _hub();
    const s = _session();
    if (!hub || !s?.uid) return;
    if (_pendingUnsub) _pendingUnsub();
    const colRef = hub.collection(hub.db, 'users', s.uid, 'coin_requests');
    _pendingUnsub = hub.onSnapshot(colRef, snap => {
      const el = document.getElementById('walletPendingList');
      if (!el) return;
      const rows = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.type === 'purchase')
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      const pending = rows.filter(r => r.status === 'pending' || r.status === 'reviewing');
      if (!pending.length) {
        el.innerHTML = '';
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.innerHTML = `
        <p class="wallet-section-lbl">TUS COMPRAS EN REVISIÓN</p>
        ${pending.map(r => `
          <div class="wallet-pending-row">
            <span>◈ ${_format(r.amount)} CC</span>
            <span class="wallet-pending-st">${r.status === 'reviewing' ? 'En revisión' : 'Pendiente'}</span>
          </div>`).join('')}`;
    }, () => {});
  }

  function selectPack(amount) {
    _selectedPack = amount;
    _receiptData = null;
    _receiptName = '';
    const panel = document.getElementById('walletPurchasePanel');
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = `
      <h4 class="wallet-panel-title">Resumen de compra</h4>
      <p class="wallet-panel-body">Pack <strong>◈ ${_format(amount)} CC</strong> = <strong>$${_format(amount)} ARS</strong></p>
      <div class="wallet-pay-box">
        <span class="wallet-pay-lbl">1. Transferí exactamente $${_format(amount)} ARS a:</span>
        <code class="wallet-pay-alias">${PAYMENT_ALIAS}</code>
        <button type="button" class="notif-btn" onclick="navigator.clipboard?.writeText('${PAYMENT_ALIAS}');alert('Alias copiado')">Copiar alias</button>
      </div>
      <div class="wallet-receipt-box">
        <span class="wallet-pay-lbl">2. Subí el comprobante (obligatorio)</span>
        <p class="wallet-hint">PDF, JPG o PNG · máx. ~800 KB · Sin comprobante no se acredita.</p>
        <input type="file" id="walletReceiptInput" accept="image/jpeg,image/png,image/webp,application/pdf" class="wallet-file-input" onchange="CeroWallet.onReceiptSelected(event)" />
        <div class="wallet-receipt-preview" id="walletReceiptPreview" hidden></div>
      </div>
      <p class="wallet-hint wallet-hint-warn">Las monedas se acreditan <strong>solo después de verificar</strong> tu transferencia (24–48 h hábiles). No hay acreditación instantánea.</p>
      <div class="wallet-panel-actions">
        <button type="button" class="mm-action-btn" id="walletSubmitPurchaseBtn" disabled onclick="CeroWallet.confirmPurchase(${amount})">Enviar comprobante</button>
        <button type="button" class="notif-btn notif-btn-muted" onclick="CeroWallet.closePurchasePanel()">Cancelar</button>
      </div>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function onReceiptSelected(ev) {
    const file = ev.target?.files?.[0];
    const preview = document.getElementById('walletReceiptPreview');
    const btn = document.getElementById('walletSubmitPurchaseBtn');
    if (!file) {
      _receiptData = null;
      _receiptName = '';
      if (preview) { preview.hidden = true; preview.innerHTML = ''; }
      if (btn) btn.disabled = true;
      return;
    }

    const okType = /^(image\/(jpeg|png|webp)|application\/pdf)$/i.test(file.type);
    if (!okType) {
      alert('Formato no válido. Usá PDF, JPG o PNG.');
      ev.target.value = '';
      return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      alert('El archivo es muy pesado. Máximo ~800 KB. Comprimí la imagen o usá otro PDF.');
      ev.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string' || dataUrl.length > RECEIPT_MAX_BYTES) {
        alert('El comprobante es demasiado grande para enviar.');
        return;
      }
      _receiptData = dataUrl;
      _receiptName = file.name;
      if (preview) {
        preview.hidden = false;
        if (file.type.startsWith('image/')) {
          preview.innerHTML = `<img src="${dataUrl}" alt="Comprobante" class="wallet-receipt-img" /><span class="wallet-receipt-name">✓ ${file.name}</span>`;
        } else {
          preview.innerHTML = `<span class="wallet-receipt-pdf">📄 ${file.name}</span><span class="wallet-receipt-name">PDF listo para enviar</span>`;
        }
      }
      if (btn) btn.disabled = false;
    };
    reader.onerror = () => alert('No se pudo leer el archivo.');
    reader.readAsDataURL(file);
  }

  function closePurchasePanel() {
    const panel = document.getElementById('walletPurchasePanel');
    if (panel) { panel.hidden = true; panel.innerHTML = ''; }
    _selectedPack = null;
    _receiptData = null;
    _receiptName = '';
  }

  async function confirmPurchase(amount) {
    if (!_receiptData) {
      alert('Subí el comprobante de transferencia antes de continuar.');
      return;
    }
    const hub = _hub();
    const s = _session();
    if (!hub || !s?.uid || s.anon) {
      alert('Iniciá sesión para adquirir Cero Coins.');
      return;
    }
    const btn = document.getElementById('walletSubmitPurchaseBtn');
    if (btn) btn.disabled = true;
    try {
      const reqRef = await hub.addDoc(hub.collection(hub.db, 'users', s.uid, 'coin_requests'), {
        type: 'purchase',
        amount,
        ars: amount * CC_RATE,
        status: 'pending',
        alias: PAYMENT_ALIAS,
        receiptURL: _receiptData,
        receiptName: _receiptName || 'comprobante',
        receiptMime: _receiptData.startsWith('data:application/pdf') ? 'application/pdf' : 'image',
        createdAt: hub.serverTimestamp(),
      });
      const userName = s.displayName || s.name || window._fbUser?.name || 'Jugador';
      await hub.addDoc(hub.collection(hub.db, 'wallet_queue'), {
        uid: s.uid,
        requestId: reqRef.id,
        type: 'purchase',
        amount,
        ars: amount * CC_RATE,
        status: 'pending',
        alias: PAYMENT_ALIAS,
        userName,
        userEmail: s.email || window._fbUser?.email || null,
        receiptURL: _receiptData,
        receiptName: _receiptName || 'comprobante',
        createdAt: hub.serverTimestamp(),
      });
      if (window.FriendsSocial?.notifyCoins) {
        FriendsSocial.notifyCoins(s.uid, {
          type: 'coins_purchase_pending',
          amount,
          code: `Compra ${amount} CC en revisión`,
        });
      }
      closePurchasePanel();
      refresh();
      alert(`✓ Comprobante enviado.\n\nTu compra de ◈ ${_format(amount)} CC está en revisión. Te avisamos cuando se acrediten (no se suman coins hasta verificar la transferencia).`);
    } catch (e) {
      console.warn('[Wallet] purchase:', e);
      alert('No se pudo enviar el comprobante. Intentá de nuevo.');
      if (btn) btn.disabled = false;
    }
  }

  function selectRedeem(amount) {
    if (_coins() < amount) return;
    const panel = document.getElementById('walletRedeemPanel');
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = `
      <h4 class="wallet-panel-title">Canjear ◈ ${_format(amount)} CC</h4>
      <p class="wallet-panel-body">Recibirás <strong>$${_format(amount)} ARS</strong> en tu cuenta bancaria tras verificación.</p>
      <label class="pf-label">Tu alias o CBU/CVU</label>
      <input type="text" class="pf-input" id="walletRedeemAlias" placeholder="mi.alias.mp o CBU/CVU" />
      <div class="wallet-panel-actions">
        <button type="button" class="mm-action-btn" onclick="CeroWallet.confirmRedeem(${amount})">Solicitar retiro</button>
        <button type="button" class="notif-btn notif-btn-muted" onclick="CeroWallet.closeRedeemPanel()">Cancelar</button>
      </div>`;
  }

  function closeRedeemPanel() {
    const panel = document.getElementById('walletRedeemPanel');
    if (panel) { panel.hidden = true; panel.innerHTML = ''; }
  }

  async function confirmRedeem(amount) {
    const alias = document.getElementById('walletRedeemAlias')?.value?.trim();
    if (!alias) { alert('Ingresá tu alias o CBU.'); return; }
    if (!_isVerified()) {
      alert('Verificá tu identidad antes de canjear CC.');
      CeroWallet.openVerifyModal();
      return;
    }
    const hub = _hub();
    const s = _session();
    if (!hub || !s?.uid) return;
    if (_coins() < amount) { alert('Saldo insuficiente.'); return; }
    try {
      const { db, doc, increment, runTransaction } = hub;
      await runTransaction(db, async tx => {
        const ref = doc(db, 'users', s.uid);
        const snap = await tx.get(ref);
        const cur = snap.data()?.coins ?? 0;
        if (cur < amount) throw new Error('insufficient');
        tx.update(ref, { coins: increment(-amount) });
      });
      const reqRef = await hub.addDoc(hub.collection(hub.db, 'users', s.uid, 'coin_requests'), {
        type: 'withdraw',
        amount,
        ars: amount * CC_RATE,
        payoutAlias: alias,
        status: 'pending',
        createdAt: hub.serverTimestamp(),
      });
      await hub.addDoc(hub.collection(hub.db, 'wallet_queue'), {
        uid: s.uid,
        requestId: reqRef.id,
        type: 'withdraw',
        amount,
        ars: amount * CC_RATE,
        payoutAlias: alias,
        status: 'pending',
        userName: s.displayName || s.name || 'Jugador',
        userEmail: s.email || null,
        createdAt: hub.serverTimestamp(),
      });
      s.coins = (s.coins || 0) - amount;
      sessionStorage.setItem('cero_user', JSON.stringify(s));
      if (window._fbUser) window._fbUser.coins = s.coins;
      if (window.FriendsSocial?.notifyCoins) {
        FriendsSocial.notifyCoins(s.uid, {
          type: 'coins_sent',
          amount,
          counterparty: `Retiro a ${alias}`,
        });
      }
      if (typeof window.syncCoinsUI === 'function') window.syncCoinsUI();
      closeRedeemPanel();
      refresh();
      alert(`Solicitud enviada. Retirás ◈ ${_format(amount)} CC ($${_format(amount)} ARS) a ${alias}. Procesamos en 24–48 h.`);
    } catch (e) {
      alert(e.message === 'insufficient' ? 'Saldo insuficiente.' : 'Error al canjear.');
    }
  }

  function openVerifyModal() {
    document.getElementById('walletVerifyModal')?.classList.add('active');
  }

  function closeVerifyModal() {
    stopCamera();
    document.getElementById('walletVerifyModal')?.classList.remove('active');
  }

  async function startCamera() {
    const video = document.getElementById('walletFaceVideo');
    const wrap = document.getElementById('walletFacePreview');
    if (!video) return;
    try {
      stopCamera();
      _cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = _cameraStream;
      await video.play();
      if (wrap) wrap.classList.add('active');
    } catch (e) {
      alert('No se pudo acceder a la cámara. Permití el acceso o subí una selfie.');
    }
  }

  function stopCamera() {
    if (_cameraStream) {
      _cameraStream.getTracks().forEach(t => t.stop());
      _cameraStream = null;
    }
    const video = document.getElementById('walletFaceVideo');
    if (video) video.srcObject = null;
  }

  function captureFace() {
    const video = document.getElementById('walletFaceVideo');
    const canvas = document.getElementById('walletFaceCanvas');
    const img = document.getElementById('walletFacePreviewImg');
    if (!video || !canvas) return null;
    const w = 320;
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 240;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    if (img) { img.src = dataUrl; img.hidden = false; }
    stopCamera();
    return dataUrl;
  }

  async function submitIdentity() {
    const name = document.getElementById('walletIdName')?.value?.trim();
    const dni = document.getElementById('walletIdDni')?.value?.trim();
    const dob = document.getElementById('walletIdDob')?.value;
    if (!name || !dni || !dob) {
      alert('Completá nombre, DNI y fecha de nacimiento.');
      return;
    }
    let faceUrl = document.getElementById('walletFacePreviewImg')?.src || '';
    if (!faceUrl || faceUrl.length < 50) {
      faceUrl = captureFace() || '';
    }
    if (!faceUrl) {
      alert('Sacá una foto de tu rostro con la cámara para validar tu identidad.');
      return;
    }
    if (faceUrl.length > 115000) {
      alert('La foto es muy pesada. Intentá de nuevo con mejor luz.');
      return;
    }
    const hub = _hub();
    const s = _session();
    if (!hub || !s?.uid) return;
    try {
      await hub.updateDoc(hub.doc(hub.db, 'users', s.uid), {
        identityVerified: true,
        identityName: name,
        identityDni: dni,
        identityDob: dob,
        identityFaceURL: faceUrl,
        identityVerifiedAt: hub.serverTimestamp(),
      });
      s.identityVerified = true;
      s.identityName = name;
      sessionStorage.setItem('cero_user', JSON.stringify(s));
      if (window._fbUser) window._fbUser.identityVerified = true;
      closeVerifyModal();
      refresh();
      alert('✓ Identidad verificada. Ya podés canjear tus Cero Coins.');
    } catch (e) {
      console.warn('[Wallet] identity:', e);
      alert('No se pudo guardar la verificación.');
    }
  }

  return {
    open,
    refresh,
    switchTab,
    selectPack,
    closePurchasePanel,
    confirmPurchase,
    onReceiptSelected,
    selectRedeem,
    closeRedeemPanel,
    confirmRedeem,
    openVerifyModal,
    closeVerifyModal,
    startCamera,
    stopCamera,
    captureFace,
    submitIdentity,
    PACKS,
  };
})();

window.CeroWallet = CeroWallet;
window.openCeroWallet = () => CeroWallet.open();
