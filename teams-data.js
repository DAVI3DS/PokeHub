/* ===== TEAMS DATA — Minhas Equipes (localStorage) ===== */
/* Preparado para migrar ao Supabase no futuro — mesma estrutura de dados */

const TeamsData = window.TeamsData || (function() {
  'use strict';

  const STORAGE_PREFIX = 'pokehub-teams-';

  function getUserId() {
    const user = AuthService.getUser();
    return user?.id || user?.sub || null;
  }

  function getStorageKey() {
    const uid = getUserId();
    return uid ? STORAGE_PREFIX + uid : null;
  }

  function carregar() {
    const key = getStorageKey();
    if (!key) return [];
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  function salvarLista(teams) {
    const key = getStorageKey();
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(teams)); } catch {}
  }

  function gerarId() {
    return 'team_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* ─── API Pública ─── */

  function listar() {
    return carregar();
  }

  function buscar(query) {
    const teams = carregar();
    if (!query) return teams;
    const q = query.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(q));
  }

  function ordenar(equipes, criterio, ordem) {
    const dir = ordem === 'asc' ? 1 : -1;
    const copia = [...equipes];
    copia.sort((a, b) => {
      let va = a[criterio] || '';
      let vb = b[criterio] || '';
      if (criterio === 'name') {
        va = va.toLowerCase();
        vb = vb.toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return copia;
  }

  function salvar(team) {
    const teams = carregar();
    const idx = teams.findIndex(t => t.id === team.id);
    team.updatedAt = new Date().toISOString();

    if (idx >= 0) {
      teams[idx] = team;
    } else {
      team.id = gerarId();
      team.createdAt = new Date().toISOString();
      team.updatedAt = team.createdAt;
      team.isPublic = false;
      teams.push(team);
    }
    salvarLista(teams);
    return team;
  }

  function remover(id) {
    const teams = carregar().filter(t => t.id !== id);
    salvarLista(teams);
  }

  function duplicar(id) {
    const teams = carregar();
    const original = teams.find(t => t.id === id);
    if (!original) return null;
    const copia = {
      ...JSON.parse(JSON.stringify(original)),
      name: original.name + ' (cópia)',
      pokemon: [...(original.pokemon || [])]
    };
    delete copia.id;
    copia.createdAt = new Date().toISOString();
    copia.updatedAt = copia.createdAt;
    copia.isPublic = false;
    return salvar(copia);
  }

  function obter(id) {
    return carregar().find(t => t.id === id) || null;
  }

  function exportarParaSlots(team) {
    // Retorna array de 6 posições pra preencher nos slots
    const slots = [null, null, null, null, null, null];
    if (!team?.pokemon) return slots;
    team.pokemon.forEach((p, i) => {
      if (i < 6) slots[i] = p;
    });
    return slots;
  }

  return { listar, buscar, ordenar, salvar, remover, duplicar, obter, exportarParaSlots, getUserId };
})();
