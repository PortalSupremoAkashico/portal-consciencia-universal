/**
 * presenca.js — Portal da Consciência Universal
 * Rastreia presença online do consulente em TODAS as páginas.
 * Inclua com: <script src="/presenca.js"></script>
 * Funciona em Samsung, iPhone, desktop — qualquer browser.
 *
 * Segurança: este arquivo roda no navegador, então NUNCA guarda chaves do
 * Supabase aqui. Toda a gravação/remoção passa pela rota /api/presenca,
 * que mantém a chave service_role só no servidor.
 */
(function () {
  var _interval  = null;
  var _lastSent  = 0;
  var _userCache = null;

  // ── Lê o usuário do localStorage (mesma chave usada pelo portal) ──
  function _getUser() {
    try { return JSON.parse(localStorage.getItem('akashic_user') || '{}'); }
    catch (e) { return {}; }
  }

  // ── Envia heartbeat via XHR (máxima compatibilidade mobile) ──
  function _send(user) {
    if (!user || !user.email) return;
    var now = Date.now();
    if (now - _lastSent < 10000) return; // throttle: no máximo 1 envio a cada 10s
    _lastSent = now;

    var body = JSON.stringify({
      email:  user.email,
      nome:   user.nome || '',
      pagina: window.location.pathname
    });

    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/presenca', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(body);
    } catch (e) {}
  }

  // ── Remove presença ao sair (sendBeacon é mais confiável no unload) ──
  function _remove() {
    var user = _userCache || _getUser();
    if (!user || !user.email) return;
    clearInterval(_interval);

    var body = JSON.stringify({ action: 'remover', email: user.email });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/presenca', new Blob([body], { type: 'application/json' }));
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/presenca', false); // síncrono só aqui, no unload
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(body);
      }
    } catch (e) {}
  }

  // ── Inicia o rastreamento ──
  function _init() {
    var user = _getUser();
    if (!user || !user.email) return; // não logado, não rastreia
    _userCache = user;
    _lastSent  = 0;
    _send(user);
    clearInterval(_interval);
    _interval = setInterval(function () {
      _lastSent = 0;
      _send(_getUser());
    }, 15000);
  }

  // ── Eventos que reiniciam ou disparam o heartbeat ──

  // Volta para a aba (Android/iOS/desktop)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      _lastSent = 0;
      var u = _userCache || _getUser();
      if (u && u.email) {
        _send(u);
        // Reinicia interval (pode ter sido suspenso pelo OS)
        clearInterval(_interval);
        _interval = setInterval(function () { _lastSent = 0; _send(_getUser()); }, 15000);
      }
    }
  });

  // bfcache: Android Chrome restaura páginas congeladas
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      _lastSent = 0;
      var u = _getUser();
      if (u && u.email) {
        _userCache = u;
        _send(u);
        clearInterval(_interval);
        _interval = setInterval(function () { _lastSent = 0; _send(_getUser()); }, 15000);
      }
    }
  });

  // Toque na tela (mobile) → dispara se parou de enviar há mais de 2 min
  document.addEventListener('touchstart', function () {
    if (Date.now() - _lastSent > 120000) {
      _lastSent = 0;
      _send(_userCache || _getUser());
    }
  }, { passive: true });

  // Foco na janela (desktop)
  window.addEventListener('focus', function () {
    if (Date.now() - _lastSent > 120000) {
      _lastSent = 0;
      _send(_userCache || _getUser());
    }
  });

  // Remove presença ao fechar/navegar para fora
  window.addEventListener('beforeunload', _remove);
  window.addEventListener('pagehide',     _remove);

  // ── Inicia assim que o DOM estiver pronto ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // ── Fallback: tenta novamente após tudo carregar ──
  window.addEventListener('load', function () {
    if (!_userCache) { _init(); }
  });

  // ── Expõe para uso interno (ex: login bem-sucedido chama window._presenca.reiniciar()) ──
  window._presenca = { reiniciar: _init, remover: _remove };

})();
