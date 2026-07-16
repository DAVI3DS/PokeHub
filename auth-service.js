/* ===== AUTH SERVICE — Sistema de Contas ===== */
/* Usa Supabase + Discord OAuth */

const AuthService = window.AuthService || (function() {
  'use strict';

  const { supabaseUrl, supabaseAnonKey } = window.AUTH_CONFIG || {};
  let supabase = null;
  let currentUser = null;
  let callbacks = [];
  let initialized = false;
  let processandoCallback = false;

  /* ─── Carregar Supabase SDK ─── */

  function carregarSDK() {
    return new Promise((resolve, reject) => {
      if (window.supabase) { resolve(window.supabase); return; }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@supabase/supabase-js@2';
      script.onload = () => resolve(window.supabase);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function init() {
    if (initialized) return;
    if (processandoCallback) return;
    try {
      const sdk = await carregarSDK();
      supabase = sdk.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: 'pokehub-auth',
          flowType: 'implicit'
        }
      });

      // Verificar se tem token na URL (callback do OAuth)
      if (window.location.hash && window.location.hash.includes('access_token')) {
        processandoCallback = true;
        // O Supabase detecta automaticamente e processa o hash
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session) {
          currentUser = processarUser(session);
          // Limpar hash da URL sem recarregar
          history.replaceState(null, '', window.location.pathname);
        }
      } else {
        // Verificar sessão existente no localStorage
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          currentUser = processarUser(session);
        }
      }

      // Escutar mudanças de auth
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          currentUser = processarUser(session);
        } else if (event === 'SIGNED_OUT') {
          currentUser = null;
        }
        callbacks.forEach(cb => { try { cb(currentUser, event); } catch(e) {} });
      });

      initialized = true;
    } catch (e) {
      console.error('Auth init error:', e);
    }
  }

  function processarUser(session) {
    const meta = session.user.user_metadata || {};
    return {
      id: session.user.id,
      name: meta.name || meta.full_name || 'Usuário',
      full_name: meta.full_name || meta.name || 'Usuário',
      email: session.user.email || '',
      avatar_url: meta.avatar_url || meta.picture || '',
      global_name: meta.custom_claims?.global_name || meta.name || 'Usuário',
      created_at: session.user.created_at,
      provider_id: meta.provider_id || ''
    };
  }

  /* ─── API ─── */

  async function login() {
    if (!supabase) await init();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: window.location.origin + '/PokeHub/',
          scopes: 'identify email'
        }
      });
      if (error) console.error('Login error:', error);
    } catch (e) {
      console.error('Login error:', e);
    }
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    currentUser = null;
  }

  function getUser() { return currentUser; }

  function onAuthChange(cb) {
    callbacks.push(cb);
    if (currentUser) cb(currentUser, 'SIGNED_IN');
    return () => { callbacks = callbacks.filter(c => c !== cb); };
  }

  /* ─── Init automático ─── */
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  return { init, login, logout, getUser, onAuthChange };
})();
