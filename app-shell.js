/*
 * Portal da Consciência Universal — App Shell
 * Adiciona: barra de navegação inferior (estilo Instagram), registro do
 * service worker (instalação como app) e aviso de "Adicionar à tela de início".
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

  // ---------- 2. Estrutura de navegação ----------
  var TABS = [
    { href: '/consulta', label: 'Início', icon: 'home' },
    { href: '/meditacao', label: 'Meditar', icon: 'lotus' },
    { href: '/mentor-ufologico', label: 'Mentor', icon: 'star' },
    { href: '/sonho', label: 'Sonhos', icon: 'moon' },
    { href: '#menu', label: 'Menu', icon: 'menu' }
  ];

  var MENU_ITEMS = [
    { href: '/mentoria', label: 'Mentoria', icon: 'compass' },
    { href: '/frequencias', label: 'Frequências e Mantras', icon: 'wave' },
    { href: '/reflexoes', label: 'Reflexões', icon: 'feather' },
    { href: '/historico', label: 'Histórico', icon: 'clock' },
    { href: '/perfil', label: 'Perfil', icon: 'user' },
    { href: '/planos', label: 'Planos', icon: 'gem' }
  ];

  var ICONS = {
    home: '<path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h5v-5h2v5h5v-9" />',
    lotus: '<path d="M12 21c-4-1.5-6-4.5-6-8 2 .3 4 1.5 6 4 2-2.5 4-3.7 6-4 0 3.5-2 6.5-6 8Z"/><path d="M12 13c-2-3-2-6 0-9 2 3 2 6 0 9Z"/>',
    star: '<path d="M12 3.5 14.3 9l6 .5-4.5 4 1.4 5.9L12 16.8 6.8 19.4 8.2 13.5l-4.5-4 6-.5Z"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
    menu: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-6 2 2-6 6-2Z"/>',
    wave: '<path d="M2 12c1.5-3 3.5-3 5 0s3.5 3 5 0 3.5-3 5 0 3.5 3 5 0"/>',
    feather: '<path d="M20 4c-6 0-13 4-15 12-.6 2 .5 3 2.3 2.3C15 16.5 20 10 20 4Z"/><path d="M11 13 4 20"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6"/>',
    gem: '<path d="m3 9 4-5h10l4 5-9 11z"/><path d="M3 9h18M9 4l3 5-3 11M15 4l-3 5 3 11"/>'
  };

  function svgIcon(name) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>'
    );
  }

  // ---------- 3. CSS ----------
  var style = document.createElement('style');
  style.textContent = [
    ':root{--pcu-nav-h: 64px;}',
    'body{padding-bottom: calc(var(--pcu-nav-h) + env(safe-area-inset-bottom)) !important;}',
    '.pcu-navbar{position:fixed;left:0;right:0;bottom:0;z-index:9999;',
    'display:flex;align-items:stretch;justify-content:space-around;',
    'height:var(--pcu-nav-h);padding-bottom:env(safe-area-inset-bottom);',
    'background:rgba(10,8,22,0.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
    'border-top:1px solid rgba(147,109,255,0.18);font-family:"Inter",sans-serif;}',
    '.pcu-navbar a, .pcu-navbar button{flex:1;display:flex;flex-direction:column;align-items:center;',
    'justify-content:center;gap:3px;background:none;border:none;color:#9b94c4;',
    'text-decoration:none;font-size:11px;font-family:inherit;cursor:pointer;',
    'transition:color .2s ease;}',
    '.pcu-navbar svg{width:24px;height:24px;transition:transform .2s ease;}',
    '.pcu-navbar a.active, .pcu-navbar button.active{color:#f0c96b;}',
    '.pcu-navbar a.active svg, .pcu-navbar button.active svg{transform:translateY(-1px);',
    'filter:drop-shadow(0 0 6px rgba(240,201,107,.6));}',
    '.pcu-navbar a:active svg, .pcu-navbar button:active svg{transform:scale(0.88);}',
    '.pcu-sheet-backdrop{position:fixed;inset:0;background:rgba(2,1,8,0.6);',
    'backdrop-filter:blur(2px);z-index:9998;opacity:0;pointer-events:none;transition:opacity .25s ease;}',
    '.pcu-sheet-backdrop.open{opacity:1;pointer-events:auto;}',
    '.pcu-sheet{position:fixed;left:0;right:0;bottom:0;z-index:9999;',
    'background:linear-gradient(180deg, rgba(20,17,40,0.98), rgba(5,4,15,0.98));',
    'border-top:1px solid rgba(147,109,255,0.3);border-radius:20px 20px 0 0;',
    'padding:20px 8px calc(20px + env(safe-area-inset-bottom));',
    'transform:translateY(100%);transition:transform .3s ease;box-shadow:0 -10px 40px rgba(0,0,0,.5);}',
    '.pcu-sheet.open{transform:translateY(0);}',
    '.pcu-sheet-handle{width:36px;height:4px;border-radius:2px;background:rgba(147,109,255,0.4);',
    'margin:0 auto 16px;}',
    '.pcu-sheet-title{font-family:"Cinzel",serif;color:#ede9ff;font-size:15px;',
    'text-align:center;margin-bottom:14px;letter-spacing:.05em;}',
    '.pcu-sheet-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}',
    '.pcu-sheet-grid a{display:flex;flex-direction:column;align-items:center;gap:8px;',
    'padding:14px 6px;border-radius:14px;text-decoration:none;color:#ede9ff;',
    'background:rgba(147,109,255,0.06);border:1px solid rgba(147,109,255,0.14);',
    'font-size:12px;text-align:center;}',
    '.pcu-sheet-grid svg{width:22px;height:22px;color:#c4b5fd;}',
    '.pcu-install-banner{position:fixed;left:12px;right:12px;z-index:9997;',
    'bottom:calc(var(--pcu-nav-h) + env(safe-area-inset-bottom) + 12px);',
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

  // ---------- 4. Montar a barra ----------
  var nav = document.createElement('nav');
  nav.className = 'pcu-navbar';

  var currentPath = window.location.pathname.replace(/\/$/, '') || '/';

  TABS.forEach(function (tab) {
    var el;
    if (tab.href === '#menu') {
      el = document.createElement('button');
      el.type = 'button';
      el.addEventListener('click', openSheet);
    } else {
      el = document.createElement('a');
      el.href = tab.href;
      if (currentPath === tab.href) el.classList.add('active');
    }
    el.innerHTML = svgIcon(tab.icon) + '<span>' + tab.label + '</span>';
    nav.appendChild(el);
  });

  // ---------- 5. Montar o menu (sheet) ----------
  var backdrop = document.createElement('div');
  backdrop.className = 'pcu-sheet-backdrop';

  var sheet = document.createElement('div');
  sheet.className = 'pcu-sheet';
  var sheetInner = '<div class="pcu-sheet-handle"></div><div class="pcu-sheet-title">Mais do Portal</div><div class="pcu-sheet-grid">';
  MENU_ITEMS.forEach(function (item) {
    sheetInner += '<a href="' + item.href + '">' + svgIcon(item.icon) + '<span>' + item.label + '</span></a>';
  });
  sheetInner += '</div>';
  sheet.innerHTML = sheetInner;

  function openSheet() {
    backdrop.classList.add('open');
    sheet.classList.add('open');
  }
  function closeSheet() {
    backdrop.classList.remove('open');
    sheet.classList.remove('open');
  }
  backdrop.addEventListener('click', closeSheet);

  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    document.body.appendChild(nav);
  });
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    document.body.appendChild(nav);
  }

  // ---------- 6. Aviso "Adicionar à tela de início" ----------
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
