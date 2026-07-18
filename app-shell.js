/*
 * Portal da Consciência Universal — App Shell
 * Barra de navegação inferior fixa (Início / Compartilhar / Perfil),
 * registro do service worker e aviso de "Adicionar à tela de início".
 *
 * Como usar: incluir <script src="/app-shell.js" defer></script>
 * antes de </body> nas páginas internas do portal (depois do login).
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';

  // ---------- 1. Registrar o Service Worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  // ---------- 2. Ícones SVG inline (sem dependência externa) ----------
  var ICONS = {
    home: '<path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h5v-5h2v5h5v-9" />',
    share: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.7 15.7 6.6M8.3 13.3l7.4 4.1"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6"/>'
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
    '.pcu-navbar .pcu-avatar-icon{width:24px;height:24px;border-radius:50%;object-fit:cover;',
    'border:1.5px solid rgba(155,148,196,0.5);transition:border-color .2s ease, transform .2s ease;}',
    '.pcu-navbar a.active .pcu-avatar-icon{border-color:#f0c96b;transform:translateY(-1px);',
    'box-shadow:0 0 6px rgba(240,201,107,.6);}',
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

  // ---------- 4. Usuário logado (para avatar do Perfil) ----------
  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('akashic_user') || sessionStorage.getItem('akashic_user') || '{}');
    } catch (e) { return {}; }
  }

  // MD5 mínimo (para Gravatar) — implementação compacta, sem dependências
  function md5(str) {
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function ad(a, b) {
      var l = (a & 0xFFFF) + (b & 0xFFFF), m = (a >> 16) + (b >> 16) + (l >> 16);
      return (m << 16) | (l & 0xFFFF);
    }
    function cm(q, a, b, x, s, t) { return ad(rl(ad(ad(a, q), ad(x, t)), s), b); }
    function ff(a,b,c,d,x,s,t){return cm((b&c)|((~b)&d),a,b,x,s,t);}
    function gg(a,b,c,d,x,s,t){return cm((b&d)|(c&(~d)),a,b,x,s,t);}
    function hh(a,b,c,d,x,s,t){return cm(b^c^d,a,b,x,s,t);}
    function ii(a,b,c,d,x,s,t){return cm(c^(b|(~d)),a,b,x,s,t);}
    function cv(str) {
      var x = [], len = str.length << 3, i;
      for (i = 0; i < len; i += 8) x[i >> 5] |= (str.charCodeAt(i / 8) & 255) << (i % 32);
      x[len >> 5] |= 0x80 << (len % 32);
      x[(((len + 64) >>> 9) << 4) + 14] = len;
      return x;
    }
    function toHex(arr) {
      var s = '', h = '0123456789abcdef', i, byte;
      for (i = 0; i < arr.length * 4; i++) {
        byte = (arr[i >> 2] >> ((i % 4) * 8)) & 255;
        s += h.charAt((byte >>> 4) & 15) + h.charAt(byte & 15);
      }
      return s;
    }
    var x = cv(unescape(encodeURIComponent(str)));
    var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878, i, olda, oldb, oldc, oldd;
    for (i = 0; i < x.length; i += 16) {
      olda = a; oldb = b; oldc = c; oldd = d;
      a=ff(a,b,c,d,x[i+0],7,-680876936);d=ff(d,a,b,c,x[i+1],12,-389564586);c=ff(c,d,a,b,x[i+2],17,606105819);b=ff(b,c,d,a,x[i+3],22,-1044525330);
      a=ff(a,b,c,d,x[i+4],7,-176418897);d=ff(d,a,b,c,x[i+5],12,1200080426);c=ff(c,d,a,b,x[i+6],17,-1473231341);b=ff(b,c,d,a,x[i+7],22,-45705983);
      a=ff(a,b,c,d,x[i+8],7,1770035416);d=ff(d,a,b,c,x[i+9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,-42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);
      a=ff(a,b,c,d,x[i+12],7,1804603682);d=ff(d,a,b,c,x[i+13],12,-40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);b=ff(b,c,d,a,x[i+15],22,1236535329);
      a=gg(a,b,c,d,x[i+1],5,-165796510);d=gg(d,a,b,c,x[i+6],9,-1069501632);c=gg(c,d,a,b,x[i+11],14,643717713);b=gg(b,c,d,a,x[i+0],20,-373897302);
      a=gg(a,b,c,d,x[i+5],5,-701558691);d=gg(d,a,b,c,x[i+10],9,38016083);c=gg(c,d,a,b,x[i+15],14,-660478335);b=gg(b,c,d,a,x[i+4],20,-405537848);
      a=gg(a,b,c,d,x[i+9],5,568446438);d=gg(d,a,b,c,x[i+14],9,-1019803690);c=gg(c,d,a,b,x[i+3],14,-187363961);b=gg(b,c,d,a,x[i+8],20,1163531501);
      a=gg(a,b,c,d,x[i+13],5,-1444681467);d=gg(d,a,b,c,x[i+2],9,-51403784);c=gg(c,d,a,b,x[i+7],14,1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);
      a=hh(a,b,c,d,x[i+5],4,-378558);d=hh(d,a,b,c,x[i+8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16,1839030562);b=hh(b,c,d,a,x[i+14],23,-35309556);
      a=hh(a,b,c,d,x[i+1],4,-1530992060);d=hh(d,a,b,c,x[i+4],11,1272893353);c=hh(c,d,a,b,x[i+7],16,-155497632);b=hh(b,c,d,a,x[i+10],23,-1094730640);
      a=hh(a,b,c,d,x[i+13],4,681279174);d=hh(d,a,b,c,x[i+0],11,-358537222);c=hh(c,d,a,b,x[i+3],16,-722521979);b=hh(b,c,d,a,x[i+6],23,76029189);
      a=hh(a,b,c,d,x[i+9],4,-640364487);d=hh(d,a,b,c,x[i+12],11,-421815835);c=hh(c,d,a,b,x[i+15],16,530742520);b=hh(b,c,d,a,x[i+2],23,-995338651);
      a=ii(a,b,c,d,x[i+0],6,-198630844);d=ii(d,a,b,c,x[i+7],10,1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);b=ii(b,c,d,a,x[i+5],21,-57434055);
      a=ii(a,b,c,d,x[i+12],6,1700485571);d=ii(d,a,b,c,x[i+3],10,-1894986606);c=ii(c,d,a,b,x[i+10],15,-1051523);b=ii(b,c,d,a,x[i+1],21,-2054922799);
      a=ii(a,b,c,d,x[i+8],6,1873313359);d=ii(d,a,b,c,x[i+15],10,-30611744);c=ii(c,d,a,b,x[i+6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21,1309151649);
      a=ii(a,b,c,d,x[i+4],6,-145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+2],15,718787259);b=ii(b,c,d,a,x[i+9],21,-343485551);
      a=ad(a,olda);b=ad(b,oldb);c=ad(c,oldc);d=ad(d,oldd);
    }
    return toHex([a, b, c, d]);
  }

  function getAvatarUrl(user, cb) {
    var email = (user && user.email || '').toLowerCase().trim();
    if (!email) { cb(null); return; }
    var key = email.replace(/[^a-z0-9]/gi, '_');
    var supabaseUrl = SUPABASE_URL + '/storage/v1/object/public/avatars/' + key + '.jpg';
    var img = new Image();
    img.onload = function () { cb(supabaseUrl); };
    img.onerror = function () {
      var gravatarUrl = 'https://www.gravatar.com/avatar/' + md5(email) + '?s=96&d=404';
      var img2 = new Image();
      img2.onload = function () { cb(gravatarUrl); };
      img2.onerror = function () { cb(null); };
      img2.src = gravatarUrl;
    };
    img.src = supabaseUrl;
  }

  // ---------- 5. Montar a barra ----------
  var currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  var user = getStoredUser();

  var nav = document.createElement('nav');
  nav.className = 'pcu-navbar';

  // Início
  var elInicio = document.createElement('a');
  elInicio.href = '/consulta';
  if (currentPath === '/consulta') elInicio.classList.add('active');
  elInicio.innerHTML = svgIcon('home') + '<span>Início</span>';
  nav.appendChild(elInicio);

  // Compartilhar
  var elShare = document.createElement('button');
  elShare.type = 'button';
  elShare.innerHTML = svgIcon('share') + '<span>Compartilhar</span>';
  elShare.addEventListener('click', function () {
    var texto = 'Encontrei um espaço lindo para quem busca autoconhecimento e conexão com o universo: ' +
      'o Portal da Consciência Universal. Tem Mentoria, Meditação Guiada, Análise de Sonhos, ' +
      'Reflexões, Frequências, Geometria Sagrada, Fórum Ufológico e Relatos Pessoais. ' +
      'Vem conhecer! https://www.portaldaconscienciauniversal.com';
    if (navigator.share) {
      navigator.share({ text: texto }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(function () {
        alert('Link copiado! Cole onde quiser compartilhar.');
      }).catch(function () {});
    }
  });
  nav.appendChild(elShare);

  // Perfil
  var elPerfil = document.createElement('a');
  elPerfil.href = '/perfil';
  if (currentPath === '/perfil') elPerfil.classList.add('active');
  elPerfil.innerHTML = svgIcon('user') + '<span>Perfil</span>';
  nav.appendChild(elPerfil);

  getAvatarUrl(user, function (url) {
    if (!url) return;
    var img = document.createElement('img');
    img.className = 'pcu-avatar-icon';
    img.src = url;
    img.alt = 'Perfil';
    var svg = elPerfil.querySelector('svg');
    if (svg) elPerfil.replaceChild(img, svg);
  });

  function mountNav() {
    document.body.appendChild(nav);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    mountNav();
  } else {
    document.addEventListener('DOMContentLoaded', mountNav);
  }

  // ---------- 6. Aviso "Adicionar à tela de início" ----------
  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  // ---------- 6b. Remove botões "Voltar" — vale para o site todo (app e navegador) ----------
  function removerBotoesVoltar() {
    var style2 = document.createElement('style');
    style2.textContent = [
      '.btn-voltar,',
      'a.nav-link,',
      '[id*="Voltar"],',
      '[class*="voltar"]{display:none !important;}',
      '#btnVoltarFormulario{display:none !important;padding:0 !important;margin:0 !important;height:0 !important;}'
    ].join('');
    document.head.appendChild(style2);

    // Esconde qualquer link/botão cujo texto contenha a palavra "voltar"
    // (cobre variações como "Voltar", "‹ Voltar", "Voltar ao Portal" etc.),
    // cobrindo casos não pegos pelos seletores de classe/id acima.
    function esconderPorTexto() {
      document.querySelectorAll('a, button').forEach(function (el) {
        var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (/\bvoltar\b/i.test(txt)) {
          el.style.display = 'none';
          var pai = el.parentElement;
          // Se o botão era o único filho visível do pai, remove o espaço reservado dele também.
          if (pai && pai.children.length === 1) {
            pai.style.display = 'none';
          }
        }
      });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      esconderPorTexto();
    } else {
      document.addEventListener('DOMContentLoaded', esconderPorTexto);
    }
    // Alguns botões "Voltar" só existem depois de trocas de tela via JS —
    // reaplica a checagem sempre que o conteúdo da página mudar.
    var observer = new MutationObserver(function () { esconderPorTexto(); });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }
  removerBotoesVoltar();

  // ---------- 6c. Ajustes de layout exclusivos do modo app instalado ----------
  function ajustarModoApp() {
    if (!isStandalone()) return;
    document.documentElement.classList.add('pcu-app-mode');

    var style3 = document.createElement('style');
    style3.textContent = '.pcu-app-mode body{padding-top:env(safe-area-inset-top) !important;}';
    document.head.appendChild(style3);
  }
  ajustarModoApp();

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
