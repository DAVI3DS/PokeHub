/* ===== AUTH SERVICE — Sistema de Contas ===== */
/* Usa Supabase + Discord OAuth */

const AuthService = window.AuthService || (function() {
  'use strict';

  const { supabaseUrl, supabaseAnonKey, siteUrl } = window.AUTH_CONFIG || {};
  let supabase = null;
  let currentUser = null;
  let callbacks = [];
  let initialized = false;

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
    try {
      const sdk = await carregarSDK();
      supabase = sdk.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: 'pokehub-auth'
        }
      });

      // Verificar sessão existente
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        currentUser = {
          id: session.user.id,
          ...session.user.user_metadata,
          email: session.user.email,
          created_at: session.user.created_at
        };
      }

      // Escutar mudanças de auth
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          currentUser = {
            id: session.user.id,
            ...session.user.user_metadata,
            email: session.user.email,
            created_at: session.user.created_at
          };
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

  /* ─── API ─── */

  async function login() {
    if (!supabase) await init();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: siteUrl + 'auth-callback.html',
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
