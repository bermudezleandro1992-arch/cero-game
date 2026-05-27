'use strict';

/**
 * Foto de perfil con moderación automática (Cloud Function + Vision API).
 */
const ProfileAvatar = (() => {
  let _unsub = null;
  let _uploading = false;
  let _localPhotoUrl = null;

  function _session() {
    try { return JSON.parse(sessionStorage.getItem('cero_user') || 'null'); } catch (_) { return null; }
  }

  function _els() {
    return {
      wrap:     document.getElementById('profileAvatarWrap'),
      preview:  document.getElementById('profileEditAvatar'),
      status:   document.getElementById('profilePhotoStatus'),
      input:    document.getElementById('profilePhotoInput'),
      btn:      document.getElementById('profilePhotoBtn'),
    };
  }

  function _setStatus(text, kind) {
    const { status } = _els();
    if (!status) return;
    status.textContent = text || '';
    status.className = 'profile-photo-status' + (kind ? ` is-${kind}` : '');
  }

  function _showPhoto(url) {
    const { preview, wrap } = _els();
    if (!preview) return;
    let img = preview.querySelector('img.pf-photo-img');
    const initial = preview.querySelector('.pf-initial');
    if (url) {
      if (!img) {
        img = document.createElement('img');
        img.className = 'pf-photo-img';
        img.alt = 'Tu foto';
        preview.appendChild(img);
      }
      img.src = url;
      preview.classList.add('has-photo');
      if (wrap) wrap.classList.add('has-photo');
      if (initial) initial.style.visibility = 'hidden';
    } else {
      if (img) img.remove();
      preview.classList.remove('has-photo');
      if (wrap) wrap.classList.remove('has-photo');
      if (initial) initial.style.visibility = 'visible';
    }
  }

  function _resolvePhoto(data) {
    const session = _session();
    const st = data?.avatarStatus || session?.avatarStatus || 'none';
    const url = data?.photoURL || data?.photo || session?.photo || _localPhotoUrl || null;
    if (st === 'rejected') return null;
    if (st === 'approved' && url) return url;
    if (url && String(url).startsWith('https://')) return url;
    return null;
  }

  function _persistPhoto(photo) {
    if (!photo) return;
    _localPhotoUrl = photo;
    const session = _session();
    if (session) {
      session.photo = photo;
      session.avatarStatus = 'approved';
      sessionStorage.setItem('cero_user', JSON.stringify(session));
    }
    if (window._fbUser) {
      window._fbUser.photo = photo;
      window._fbUser.avatarStatus = 'approved';
    }
    if (window._lastFbProfile) {
      window._lastFbProfile.photo = photo;
      window._lastFbProfile.avatarStatus = 'approved';
    }
  }

  function _applyProfile(data) {
    const session = _session();
    const st = data?.avatarStatus || session?.avatarStatus || 'none';
    const photo = _resolvePhoto(data);

    if (photo) {
      _showPhoto(photo);
      _persistPhoto(photo);
      if (typeof window.renderProfile === 'function') {
        window.renderProfile({ ...session, photo, displayName: session?.name || session?.displayName });
      }
      if (st === 'approved') {
        _setStatus('Foto de perfil activa', 'ok');
        const activeLbl = document.getElementById('profilePhotoActiveLbl');
        if (activeLbl) activeLbl.hidden = false;
      }
      if (typeof window.syncAllAvatars === 'function') {
        const session = _session();
        window.syncAllAvatars({
          displayName: session?.name || data?.displayName,
          name: session?.name,
          photo,
          level: session?.level || 1,
        });
      }
      return;
    }

    if (_uploading || _localPhotoUrl) return;

    _showPhoto(null);
    if (st === 'pending') {
      _setStatus('Tu foto está en revisión (unos segundos)...', 'pending');
    } else if (st === 'approved' && photo) {
      _setStatus('Foto de perfil activa', 'ok');
    } else if (st === 'rejected') {
      _setStatus(data?.avatarRejectReason || 'Foto rechazada. Elegí otra imagen.', 'rejected');
    } else {
      _setStatus('Subí una foto. Revisamos que sea apta para todos.', 'hint');
    }
  }

  async function onFileSelected(ev) {
    const file = ev.target?.files?.[0];
    ev.target.value = '';
    if (!file) return;

    const session = _session();
    if (!session?.uid || session.anon) {
      alert('Creá una cuenta para subir tu foto de perfil.');
      window.location.href = 'login.html';
      return;
    }
    const hub = window.FBHub;
    if (!hub?.uploadAvatarForReview) {
      alert('Conexión no disponible. Recargá la página.');
      return;
    }

    const { btn } = _els();
    if (btn) btn.disabled = true;
    _setStatus('Subiendo foto...', 'pending');

    try {
      _uploading = true;
      const previewUrl = URL.createObjectURL(file);
      _showPhoto(previewUrl);
      _setStatus('Comprimiendo y revisando foto...', 'pending');

      const result = await hub.uploadAvatarForReview(session.uid, file);
      URL.revokeObjectURL(previewUrl);

      if (result?.status === 'approved' && result.photoURL) {
        _persistPhoto(result.photoURL);
        _applyProfile({ photoURL: result.photoURL, avatarStatus: 'approved' });
        _setStatus('¡Foto guardada!', 'ok');
        const activeLbl = document.getElementById('profilePhotoActiveLbl');
        if (activeLbl) activeLbl.hidden = false;
        if (typeof window.syncAllAvatars === 'function') {
          const session = _session();
          window.syncAllAvatars({ name: session?.name, photo: result.photoURL, level: session?.level || 1 });
        }
      } else if (result?.status === 'rejected') {
        _localPhotoUrl = null;
        _showPhoto(null);
        _setStatus('Foto rechazada: no cumple las normas de la comunidad.', 'rejected');
      } else {
        _setStatus('Foto en revisión...', 'pending');
      }
    } catch (e) {
      _localPhotoUrl = null;
      _showPhoto(null);
      const code = e?.code || '';
      let msg = e.message || 'No se pudo subir la foto';
      if (code.includes('functions/not-found') || code.includes('unavailable')) {
        msg = 'Moderación en línea no disponible aún. Reintentá en unos minutos.';
      }
      if (code.includes('permission-denied') || code.includes('unauthenticated')) {
        msg = 'Iniciá sesión con tu cuenta para subir foto.';
      }
      _setStatus(msg, 'rejected');
    } finally {
      _uploading = false;
      if (btn) btn.disabled = false;
    }
  }

  function _resizeImage(file, maxPx) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const scale = Math.min(1, maxPx / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => {
            if (!blob) { reject(new Error('No se pudo procesar la imagen')); return; }
            resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Imagen inválida'));
      };
      img.src = url;
    });
  }

  function bind() {
    const { input, btn } = _els();
    if (input) input.addEventListener('change', onFileSelected);
    if (btn && input) {
      btn.addEventListener('click', () => {
        if (!_session()?.uid || _session()?.anon) {
          alert('Creá una cuenta para subir tu foto.');
          return;
        }
        input.click();
      });
    }

    window.addEventListener('fb:profileReady', (e) => {
      _applyProfile(e.detail || {});
      _startWatch();
    });
  }

  function _startWatch() {
    const hub = window.FBHub;
    const session = _session();
    if (!hub?.watchUserProfile || !session?.uid || session.anon) return;
    if (_unsub) _unsub();
    _unsub = hub.watchUserProfile(session.uid, data => _applyProfile(data));
  }

  function initModal() {
    const fb = window._lastFbProfile || window._fbUser;
    if (fb) _applyProfile(fb);
    _startWatch();
  }

  return { bind, initModal, onFileSelected };
})();

window.ProfileAvatar = ProfileAvatar;

document.addEventListener('DOMContentLoaded', () => ProfileAvatar.bind());
