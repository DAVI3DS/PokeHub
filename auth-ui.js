/* ===== AUTH UI ===== */

const AuthUI = window.AuthUI || (function() {
  'use strict';

  let dropdownOpen = false;

  function init() {
    // Injetar área de auth no cabeçalho
    const header = document.querySelector('.abas-modo-principal');
    if (!header) return;

    const authArea = document.createElement('div');
    authArea.id = 'authArea';
    authArea.innerHTML = `<button type="button" class="auth-btn" id="authLoginBtn">🎮 Entrar com Discord</button>`;
    document.body.appendChild(authArea);

    // Overlay para fechar dropdown
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.id = 'authOverlay';
    overlay.addEventListener('click', fecharDropdown);
    document.body.appendChild(overlay);

    // Conectar botão de login
    document.getElementById('authLoginBtn')?.addEventListener('click', () => {
      AuthService.login();
    });

    // Escutar mudanças de auth
    AuthService.onAuthChange((user, event) => {
      if (event === 'SIGNED_IN' && user) {
        renderizarUsuario(user);
      } else if (event === 'SIGNED_OUT') {
        renderizarLogout();
      }
    });

    // Se já estiver logado (callback processado), atualizar
    const user = AuthService.getUser();
    if (user) renderizarUsuario(user);
  }

  function renderizarUsuario(user) {
    const area = document.getElementById('authArea');
    if (!area) return;

    const avatar = user.avatar_url || user.picture || `https://cdn.discordapp.com/embed/avatars/0.png`;
    const nome = user.full_name || user.name || user.custom_claims?.global_name || user.email || 'Usuário';

    area.innerHTML = `
      <div class="auth-user" id="authUserBtn">
        <img class="auth-avatar" src="${avatar}" alt="Avatar" referrerpolicy="no-referrer">
        <span class="auth-username">${nome.split(' ')[0]}</span>
        <span class="auth-dropdown-arrow">▾</span>
      </div>
      <div class="auth-dropdown" id="authDropdown">
        <button type="button" class="auth-dropdown-item" onclick="AuthUI._abrirPerfil()">👤 Meu Perfil</button>
        <div class="auth-dropdown-divider"></div>
        <button type="button" class="auth-dropdown-item danger" onclick="AuthUI._logout()">🚪 Sair</button>
      </div>
    `;

    document.getElementById('authUserBtn')?.addEventListener('click', toggleDropdown);
  }

  function renderizarLogout() {
    const area = document.getElementById('authArea');
    if (!area) return;
    area.innerHTML = `<button type="button" class="auth-btn" id="authLoginBtn">🎮 Entrar com Discord</button>`;
    document.getElementById('authLoginBtn')?.addEventListener('click', () => AuthService.login());

    // Esconder profile se estiver visível
    const pc = document.getElementById('profileContainer');
    if (pc) pc.hidden = true;
  }

  function toggleDropdown() {
    const dd = document.getElementById('authDropdown');
    const ov = document.getElementById('authOverlay');
    if (!dd) return;
    dropdownOpen = !dropdownOpen;
    dd.classList.toggle('open', dropdownOpen);
    if (ov) ov.classList.toggle('active', dropdownOpen);
  }

  function fecharDropdown() {
    dropdownOpen = false;
    document.getElementById('authDropdown')?.classList.remove('open');
    document.getElementById('authOverlay')?.classList.remove('active');
  }

  function _abrirPerfil() {
    fecharDropdown();

    const user = AuthService.getUser();
    if (!user) return;

    // Garantir que o container existe
    let pc = document.getElementById('profileContainer');
    if (!pc) {
      pc = document.createElement('div');
      pc.id = 'profileContainer';
      document.getElementById('resultado')?.after(pc);
    }

    // Esconder outros containers
    document.getElementById('teamBuilderContainer').hidden = true;
    document.getElementById('teamAnalyzerContainer').hidden = true;
    document.getElementById('resultado').innerHTML = '';

    const avatar = user.avatar_url || user.picture || `https://cdn.discordapp.com/embed/avatars/0.png`;
    const nome = user.full_name || user.name || user.custom_claims?.global_name || user.email || 'Usuário';
    const tag = user.email ? user.email : '';
    const dataCriacao = user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—';

    pc.hidden = false;
    pc.innerHTML = `
      <img class="profile-avatar" src="${avatar}" alt="Avatar" referrerpolicy="no-referrer">
      <h2>${nome}</h2>
      <p class="profile-tag">${tag}</p>
      <div class="profile-meta">
        <p><strong>ID:</strong> ${user.id}</p>
        <p><strong>Conta criada em:</strong> ${dataCriacao}</p>
      </div>
      <div class="profile-placeholder">
        ⚙️ Em breve: suas equipes salvos, estatísticas e mais!
      </div>
    `;

    // Voltar pra aba Pokedex visualmente
    alternarModo('pokemon');
  }

  function _logout() {
    fecharDropdown();
    AuthService.logout();
    alternarModo('pokemon');
  }

  // Init quando DOM carregar
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  return { init, _abrirPerfil, _logout };
})();
