/*
 * Portal da Consciência Universal — App Shell
 * Barra de navegação inferior com 3 itens: Início, Compartilhar e Perfil
 * (o botão Perfil mostra a própria foto do usuário, estilo Instagram).
 * Também registra o service worker e mostra o aviso de instalação do app.
 *
 * Como usar: incluir <script src="/app-shell.js" defer></script>
 * antes de </body> nas páginas internas do portal (depois do login).
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
  var SITE_URL = 'https://www.portaldaconscienciauniversal.com';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

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
    '.pcu-avatar-circle{width:24px;height:24px;border-radius:50%;overflow:hidden;',
    'display:flex;align-items:center;justify-content:center;border:1.5px solid #9b94c4;',
    'background:linear-gradient(135deg, rgba(109,40,217,.4), rgba(167,139,250,.2));',
    'font-family:"Cinzel",serif;font-size:11px;color:#c4b5fd;transition:border-color .2s ease;}',
    '.pcu-navbar a.active .pcu-avatar-circle{border-color:#f0c96b;',
    'box-shadow:0 0 6px rgba(240,201,107,.6);}',
    '.pcu-avatar-circle img{width:100%;height:100%;object-fit:cover;}',
    '.pcu-install-banner{position:fixed;left:12px;right:12px;z-index:9997;',
    'bottom:calc(var(--pcu-nav-h) + env(safe-area-inset-bottom) + 12px);',
    'background:rgba(20,17,40,0.97);border:1px solid rgba(240,201,107,0.35);',
    'border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;',
    'font-family:"Inter",sans-serif;color:#ede9ff;font-size:12.5px;',
    'box-shadow:0 8px 30px rgba(0,0,0,.5);}',
    '.pcu-install-banner button.pcu-install-close{background:none;border:none;color:#9b94c4;',
    'font-size:18px;line-height:1;padding:0 2px;cursor:pointer;}',
    '.pcu-install-banner .pcu-install-cta{background:#f0c96b;color:#1a1440;border:none;',
    'border-radius:10px;padding:7px 12px;font-weight:600;font-size:12px;white-space:nowrap;cursor:pointer;}',
    '.pcu-toast{position:fixed;left:50%;transform:translateX(-50%);',
    'bottom:calc(var(--pcu-nav-h) + env(safe-area-inset-bottom) + 14px);z-index:10000;',
    'background:rgba(20,17,40,0.97);border:1px solid rgba(147,109,255,0.35);',
    'color:#ede9ff;padding:10px 16px;border-radius:12px;font-family:"Inter",sans-serif;',
    'font-size:12.5px;box-shadow:0 8px 24px rgba(0,0,0,.5);}'
  ].join('');
  document.head.appendChild(style);

  var ICONS = {
    home: '<path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h5v-5h2v5h5v-9" />',
    share: '<circle cx="18" cy="5" r="2.4"/><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="19" r="2.4"/><path d="m8.1 10.8 7.8-4.1M8.1 13.2l7.8 4.1"/>'
  };

  function svgIcon(name) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>'
    );
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('akashic_user') || sessionStorage.getItem('akashic_user') || '{}');
    } catch (e) {
      return {};
    }
  }

  function md5(str) {
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function ad(x, y) { var l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
    function cmn(q, a, b, x, s, t) { return ad(rl(ad(ad(a, q), ad(x, t)), s), b); }
    function ff(a,b,c,d,x,s,t){return cmn((b&c)|(~b&d),a,b,x,s,t);}
    function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&~d),a,b,x,s,t);}
    function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t);}
    function ii(a,b,c,d,x,s,t){return cmn(c^(b|~d),a,b,x,s,t);}
    function toWords(s){var n=s.length,words=[];for(var i=0;i<n*8;i+=8)words[i>>5]|=(s.charCodeAt(i/8)&0xff)<<(i%32);return words;}
    function toHex(n){var s='',b;for(var i=0;i<4;i++){b=(n>>>(i*8))&255;s+=(b<16?'0':'')+b.toString(16);}return s;}
    var x = toWords(unescape(encodeURIComponent(str)));
    var len = str.length * 8;
    x[len >> 5] |= 0x80 << (len % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;
    var a=1732584193,b=-271733879,c=-1732584194,d=271733878,olda,oldb,oldc,oldd;
    for (var i = 0; i < x.length; i += 16) {
      olda=a;oldb=b;oldc=c;oldd=d;
      a=ff(a,b,c,d,x[i+0]||0,7,-680876936); d=ff(d,a,b,c,x[i+1]||0,12,-389564586); c=ff(c,d,a,b,x[i+2]||0,17,606105819); b=ff(b,c,d,a,x[i+3]||0,22,-1044525330);
      a=ff(a,b,c,d,x[i+4]||0,7,-176418897); d=ff(d,a,b,c,x[i+5]||0,12,1200080426); c=ff(c,d,a,b,x[i+6]||0,17,-1473231341); b=ff(b,c,d,a,x[i+7]||0,22,-45705983);
      a=ff(a,b,c,d,x[i+8]||0,7,1770035416); d=ff(d,a,b,c,x[i+9]||0,12,-1958414417); c=ff(c,d,a,b,x[i+10]||0,17,-42063); b=ff(b,c,d,a,x[i+11]||0,22,-1990404162);
      a=ff(a,b,c,d,x[i+12]||0,7,1804603682); d=ff(d,a,b,c,x[i+13]||0,12,-40341101); c=ff(c,d,a,b,x[i+14]||0,17,-1502002290); b=ff(b,c,d,a,x[i+15]||0,22,1236535329);
      a=gg(a,b,c,d,x[i+1]||0,5,-165796510); d=gg(d,a,b,c,x[i+6]||0,9,-1069501632); c=gg(c,d,a,b,x[i+11]||0,14,643717713); b=gg(b,c,d,a,x[i+0]||0,20,-373897302);
      a=gg(a,b,c,d,x[i+5]||0,5,-701558691); d=gg(d,a,b,c,x[i+10]||0,9,38016083); c=gg(c,d,a,b,x[i+15]||0,14,-660478335); b=gg(b,c,d,a,x[i+4]||0,20,-405537848);
      a=gg(a,b,c,d,x[i+9]||0,5,568446438); d=gg(d,a,b,c,x[i+14]||0,9,-1019803690); c=gg(c,d,a,b,x[i+3]||0,14,-187363961); b=gg(b,c,d,a,x[i+8]||0,20,1163531501);
      a=gg(a,b,c,d,x[i+13]||0,5,-1444681467); d=gg(d,a,b,c,x[i+2]||0,9,-51403784); c=gg(c,d,a,b,x[i+7]||0,14,1735328473); b=gg(b,c,d,a,x[i+12]||0,20,-1926607734);
      a=hh(a,b,c,d,x[i+5]||0,4,-378558); d=hh(d,a,b,c,x[i+8]||0,11,-2022574463); c=hh(c,d,a,b,x[i+11]||0,16,1839030562); b=hh(b,c,d,a,x[i+14]||0,23,-35309556);
      a=hh(a,b,c,d,x[i+1]||0,4,-1530992060); d=hh(d,a,b,c,x[i+4]||0,11,1272893353); c=hh(c,d,a,b,x[i+7]||0,16,-155497632); b=hh(b,c,d,a,x[i+10]||0,23,-1094730640);
      a=hh(a,b,c,d,x[i+13]||0,4,681279174); d=hh(d,a,b,c,x[i+0]||0,11,-358537222); c=hh(c,d,a,b,x[i+3]||0,16,-722521979); b=hh(b,c,d,a,x[i+6]||0,23,76029189);
      a=hh(a,b,c,d,x[i+9]||0,4,-640364487); d=hh(d,a,b,c,x[i+12]||0,11,-421815835); c=hh(c,d,a,b,x[i+15]||0,16,530742520); b=hh(b,c,d,a,x[i+2]||0,23,-995338651);
      a=ii(a,b,c,d,x[i+0]||0,6,-198630844); d=ii(d,a,b,c,x[i+7]||0,10,1126891415); c=ii(c,d,a,b,x[i+14]||0,15,-1416354905); b=ii(b,c,d,a,x[i+5]||0,21,-57434055);
      a=ii(a,b,c,d,x[i+12]||0,6,1700485571); d=ii(d,a,b,c,x[i+3]||0,10,-1894986606); c=ii(c,d,a,b,x[i+10]||0,15,-1051523); b=ii(b,c,d,a,x[i+1]||0,21,-2054922799);
      a=ii(a,b,c,d,x[i+8]||0,6,1873313359); d=ii(d,a,b,c,x[i+15]||0,10,-30611744); c=ii(c,d,a,b,x[i+6]||0,15,-1560198380); b=ii(b,c,d,a,x[i+13]||0,21,1309151649);
      a=ii(a,b,c,d,x[i+4]||0,6,-145523070); d=ii(d,a,b,c,x[i+11]||0,10,-1120210379); c=ii(c,d,a,b,x[i+2]||0,15,718787259); b=ii(b,c,d,a,x[i+9]||0,21,-343485551);
      a=ad(a,olda); b=ad(b,oldb); c=ad(c,oldc); d=ad(d,oldd);
    }
    return toHex(a)+toHex(b)+toHex(c)+toHex(d);
  }

  function getSupabaseAvatarUrl(email) {
    if (!email) return null;
    var key = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return SUPABASE_URL + '/storage/v1/object/public/avatars/' + key + '.jpg';
  }

  function getGravatarUrl(email) {
    if (!email) return null;
    var hash = md5(email.trim().toLowerCase());
    return 'https://www.gravatar.com/avatar/' + hash + '?s=96&d=404';
  }

  function buildAvatarCircle(user, isActive) {
    var wrap = document.createElement('span');
    wrap.className = 'pcu-avatar-circle';
    var initial = (user && user.nome ? user.nome : (user && user.email ? user.email : '?')).trim().charAt(0).toUpperCase();
    wrap.textContent = initial || '?';

    if (user && user.email) {
      var img = new Image();
      img.onload = function () {
        wrap.textContent = '';
        wrap.appendChild(img);
      };
      img.onerror = function () {
        var gravatar = new Image();
        gravatar.onload = function () {
          wrap.textContent = '';
          wrap.appendChild(gravatar);
        };
        gravatar.src = getGravatarUrl(user.email);
      };
      img.src = getSupabaseAvatarUrl(user.email);
    }
    return wrap;
  }

  var user = getStoredUser();
  var currentPath = window.location.pathname.replace(/\/$/, '') || '/';

  var nav = document.createElement('nav');
  nav.className = 'pcu-navbar';

  var homeLink = document.createElement('a');
  homeLink.href = '/consulta';
  if (currentPath === '/consulta') homeLink.classList.add('active');
  homeLink.innerHTML = svgIcon('home') + '<span>Início</span>';
  nav.appendChild(homeLink);

  var shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.innerHTML = svgIcon('share') + '<span>Compartilhar</span>';
  shareBtn.addEventListener('click', function () {
    compartilharConvite();
  });
  nav.appendChild(shareBtn);

  async function compartilharConvite() {
    var mensagem =
      'Encontrei um espaço lindo para quem busca autoconhecimento e conexão com o universo: ' +
      'o Portal da Consciência Universal. Tem Mentoria, Meditação Guiada, Análise de Sonhos, ' +
      'Reflexões, Frequências, Geometria Sagrada, Fórum Ufológico e Relatos Pessoais. ' +
      'Vem conhecer! ' + SITE_URL;

    var shareData = { title: 'Portal da Consciência Universal', text: mensagem };

    try {
      var resp = await fetch('/icons/icon-512.png');
      var blob = await resp.blob();
      var file = new File([blob], 'portal-consciencia-universal.png', { type: blob.type || 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        shareData.files = [file];
      }
    } catch (e) {
      // Sem imagem, o compartilhamento continua só com o texto.
    }

    if (navigator.share) {
      navigator.share(shareData).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(mensagem).then(function () {
        showToast('Convite copiado! Agora é só colar e enviar 💫');
      });
    }
  }

  var perfilLink = document.createElement('a');
  perfilLink.href = '/perfil';
  var perfilActive = currentPath === '/perfil';
  if (perfilActive) perfilLink.classList.add('active');
  perfilLink.appendChild(buildAvatarCircle(user, perfilActive));
  var perfilLabel = document.createElement('span');
  perfilLabel.textContent = 'Perfil';
  perfilLink.appendChild(perfilLabel);
  nav.appendChild(perfilLink);

  function mountNav() {
    document.body.appendChild(nav);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    mountNav();
  } else {
    document.addEventListener('DOMContentLoaded', mountNav);
  }

  function showToast(text) {
    var toast = document.createElement('div');
    toast.className = 'pcu-toast';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3000);
  }

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
      showInstallBanner(false);
    }
  });

  function showInstallBanner(iosMode) {
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
      showInstallBanner(true);
    }
  });
})();
