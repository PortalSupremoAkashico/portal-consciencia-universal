/*
 * Portal da Consciência Universal — App Shell
 * Registra o service worker (instalação como app) e mostra o aviso de
 * "Adicionar à tela de início". A barra de navegação foi removida a
 * pedido — o portal já tem seus próprios botões de navegação.
 *
 * Como usar: incluir <script src="/app-shell.js" defer></script>
 * antes de </body> nas páginas internas do portal (depois do login).
 */
(function () {
  'use strict';

  // ---------- 1. Registrar o Service Worker (torna o site instalável) ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  // ---------- 2. CSS do aviso de instalação ----------
  var style = document.createElement('style');
  style.textContent = [
    '.pcu-install-banner{position:fixed;left:12px;right:12px;z-index:9997;',
    'bottom:calc(12px + env(safe-area-inset-bottom));',
    'background:rgba(20,17,40,0.97);border:1px solid rgba(240,201,107,0.35);',
    'border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;',
    'font-family:"Inter",sans-serif;color:#ede9ff;font-size:12.5px;',
    'box-shadow:0 8px 30px rgba(0,0,0,.5);}',
    '.pcu-install-banner button.pcu-install-close{background:none;border:none;color:#9b94c4;',
    'font-size:18px;line-height:1;padding:0 2px;cursor:pointer;}',
    '.pcu-install-banner .pcu-install-cta{background:#f0c96b;color:#1a1440;border:none;',
    'border-radius:10px;padding:7px 12px;font-weight:600;font-size:12px;white-space:nowrap;cursor:pointer;}'
  ].join('');
  document.head.appendChild(style);

  // ---------- 3. Aviso "Adicionar à tela de início" ----------
  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone() && !localStorage.getItem('pcu_install_dismissed')) {
      showBanner(false);
    }
  });

  function showBanner(iosMode) {
    var banner = document.createElement('div');
    banner.className = 'pcu-install-banner';
    var text = iosMode
      ? 'Toque em Compartilhar e depois em "Adicionar à Tela de Início" para instalar o Portal.'
      : 'Instale o Portal como aplicativo no seu celular.';
    banner.innerHTML =
      '<span style="flex:1">' + text + '</span>' +
      (iosMode ? '' : '<button class="pcu-install-cta">Instalar</button>') +
      '<button class="pcu-install-close" aria-label="Fechar">&times;</button>';

    banner.querySelector('.pcu-install-close').addEventListener('click', function () {
      banner.remove();
      localStorage.setItem('pcu_install_dismissed', '1');
    });

    var cta = banner.querySelector('.pcu-install-cta');
    if (cta) {
      cta.addEventListener('click', function () {
        banner.remove();
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt = null;
        }
      });
    }

    document.body.appendChild(banner);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (isIos() && !isStandalone() && !localStorage.getItem('pcu_install_dismissed')) {
      showBanner(true);
    }
  });
})();
