/**
 * presenca.js — Portal Registros Akáshicos
 * Rastreia presença online do consulente em TODAS as páginas.
 * Inclua com: <script src="/presenca.js"></script>
 * Funciona em Samsung, iPhone, desktop — qualquer browser.
 */
(function () {
  var SB  = 'https://opykejeaxehvzogrrwto.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9weWtlamVheGVodnpvZ3Jyd3RvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDQ3MCwiZXhwIjoyMDkyODgwNDcwfQ.diVBu6fBq0uLhuAQoud78ddCsijyZLeuTRYk1_uIkcw';

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

    var email = user.email.toLowerCase().trim();
    var body  = JSON.stringify({
      email:     email,
      nome:      user.nome || '',
      pagina:    window.location.pathname,
      last_seen: new Date().toISOString()
    });

    console.log('[presenca] enviando heartbeat para', email);
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', SB + '/rest/v1/presencas_online?on_conflict=email', true);
      xhr.setRequestHeader('Content-Type',  'application/json');
      xhr.setRequestHeader('apikey',        KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + KEY);
      xhr.setRequestHeader('Prefer',        'return=minimal,resolution=merge-duplicates');
      xhr.onload = function() { console.log('[presenca] resposta:', xhr.status); };
      xhr.onerror = function() { console.error('[presenca] erro XHR'); };
      xhr.send(body);
    } catch (e) { console.error('[presenca] exceção:', e); }
  }

  // ── Remove presença ao sair ──
  function _remove() {
    var user = _userCache || _getUser();
    if (!user || !user.email) return;
    clearInterval(_interval);
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('DELETE', SB + '/rest/v1/presencas_online?email=eq.' +
        encodeURIComponent(user.email.toLowerCase().trim()), true);
      xhr.setRequestHeader('apikey',        KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + KEY);
      xhr.send();
    } catch (e) {}
  }

  // ── Inicia o rastreamento ──
  function _init() {
    var user = _getUser();
    console.log('[presenca] init, user:', user && user.email);
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
