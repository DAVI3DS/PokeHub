/* ===== AUTH UI ===== */

const AuthUI = window.AuthUI || (function() {
  'use strict';

  let dropdownOpen = false;

  function init() {
    const authArea = document.createElement('div');
    authArea.id = 'authArea';
    authArea.innerHTML = `<button type="button" class="auth-btn" id="authLoginBtn">🎮 Entrar com Discord</button>`;
    document.body.appendChild(authArea);

    document.getElementById('authLoginBtn')?.addEventListener('click', () => {
      AuthService.login();
    });

    AuthService.onAuthChange((user, event) => {
      if (event === 'SIGNED_IN' && user) {
        renderizarUsuario(user);
      } else if (event === 'SIGNED_OUT') {
        renderizarLogout();
      }
    });

    const user = AuthService.getUser();
    if (user) { renderizarUsuario(user); }
  }

  function renderizarUsuario(user) {
    const area = document.getElementById('authArea');
    if (!area) return;

    const avatar = user.avatar_url || user.picture || `https://cdn.discordapp.com/embed/avatars/0.png`;
    const nome = user.global_name || user.full_name || user.name || user.email || 'Usuário';

    area.innerHTML = `
      <div class="auth-user" id="authUserBtn">
        <img class="auth-avatar" src="${avatar}" alt="Avatar" referrerpolicy="no-referrer">
        <span class="auth-username">${nome.split(' ')[0]}</span>
        <span class="auth-dropdown-arrow">▾</span>
      </div>
      <div class="auth-dropdown" id="authDropdown">
        <button type="button" class="auth-dropdown-item" onclick="AuthUI._irPerfil()">👤 Meu Perfil</button>
        <button type="button" class="auth-dropdown-item" onclick="AuthUI._irEquipes()">📋 Minhas Equipes</button>
        <div class="auth-dropdown-divider"></div>
        <button type="button" class="auth-dropdown-item danger" onclick="AuthUI._logout()">🚪 Sair</button>
      </div>
    `;

    document.getElementById('authUserBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });
  }

  function renderizarLogout() {
    const area = document.getElementById('authArea');
    if (!area) return;
    area.innerHTML = `<button type="button" class="auth-btn" id="authLoginBtn">🎮 Entrar com Discord</button>`;
    document.getElementById('authLoginBtn')?.addEventListener('click', () => AuthService.login());
  }

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
    document.getElementById('authDropdown')?.classList.toggle('open', dropdownOpen);
  }

  function fecharDropdown() {
    dropdownOpen = false;
    document.getElementById('authDropdown')?.classList.remove('open');
  }

  // Fechar dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    if (dropdownOpen && !e.target.closest('#authArea')) {
      fecharDropdown();
    }
  });

  function _irPerfil() {
    fecharDropdown();
    alternarModo('profile');
  }

  function _irEquipes() {
    fecharDropdown();
    alternarModo('teams');
  }

  function _renderizarPerfil() {
    const container = document.getElementById('profileContainer');
    if (!container) return;

    container.innerHTML = `<div class="ta-loading"><div class="ta-spinner"></div><p>Carregando perfil...</p></div>`;

    // Tenta obter user — pode ser que o init ainda não terminou
    const tentar = () => {
      const user = AuthService.getUser();
      if (!user) {
        // Tenta de novo em 300ms
        setTimeout(tentar, 300);
        return;
      }

      const avatar = user.avatar_url || user.picture || 'https://cdn.discordapp.com/embed/avatars/0.png';
      const nome = user.global_name || user.full_name || user.name || user.email || 'Usuário';
      const tag = user.email ? user.email : '';
      const dataCriacao = user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—';

      container.innerHTML = `
        <div style="text-align:center;">
          <img src="${avatar}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,0.12);" referrerpolicy="no-referrer">
          <h2 style="margin:0 0 4px;font-size:clamp(1.3rem,3vw,1.6rem);color:#1d1d1f;">${nome}</h2>
          <p style="margin:0 0 20px;font-size:0.9rem;color:#5f838a;font-weight:700;">${tag}</p>
          <div style="text-align:left;padding:16px 18px;border-radius:16px;background:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.75);margin-bottom:16px;">
            <p style="margin:6px 0;font-size:0.9rem;color:#3a3a4a;"><strong>ID:</strong> ${user.provider_id || user.id}</p>
            <p style="margin:6px 0;font-size:0.9rem;color:#3a3a4a;"><strong>Conta criada em:</strong> ${dataCriacao}</p>
          </div>
          <div style="padding:24px;border-radius:16px;background:rgba(255,255,255,0.3);border:1px dashed rgba(26,26,46,0.15);color:#5f838a;font-size:0.9rem;">
            ⚙️ Em breve: suas equipes, estatísticas e mais!
          </div>
        </div>
      `;
    };
    tentar();
  }

  function _logout() {
    fecharDropdown();
    AuthService.logout();
    alternarModo('pokemon');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  return { init, _irPerfil, _irEquipes, _renderizarPerfil, _logout };
})();
