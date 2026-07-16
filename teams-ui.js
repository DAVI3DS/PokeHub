/* ===== TEAMS UI — Minhas Equipes ===== */

const TeamsUI = window.TeamsUI || (function() {
  'use strict';

  let modoEditor = 'criar';
  let editandoId = null;
  let timeEditor = [null, null, null, null, null, null];

  /* ─── Inicializar ─── */

  function mostrar() {
    renderizarPagina();
  }

  /* ─── Renderizar Lista ─── */

  function renderizarPagina(msg) {
    const container = document.getElementById('teamsContainer');
    if (!container) return;
    container.innerHTML = '';

    const equipes = TeamsData.listar();

    let html = `<div class="tm-header">
      <h2>📋 Minhas Equipes</h2>
      <div class="tm-header-actions">
        <input type="text" class="tm-search" id="tmSearch" placeholder="Pesquisar..." oninput="TeamsUI._filtrar()">
        <select class="tm-order" id="tmOrder" onchange="TeamsUI._filtrar()">
          <option value="updatedAt">Última modificação</option>
          <option value="name">Nome</option>
          <option value="createdAt">Data de criação</option>
        </select>
        <button type="button" class="tm-btn tm-btn-primary" id="tmBtnNova">➕ Nova Equipe</button>
      </div>
    </div>`;

    if (msg) {
      html += `<div style="padding:10px 14px;margin-bottom:14px;border-radius:12px;background:rgba(108,207,99,0.12);border:1px solid rgba(108,207,99,0.25);color:#2d7a22;font-weight:700;font-size:0.85rem;">${msg}</div>`;
    }

    if (equipes.length === 0) {
      html += `<div class="tm-empty">
        <span class="tm-empty-icon">📭</span>
        <p>Nenhuma equipe ainda.</p>
        <p style="font-size:0.9rem;">Crie sua primeira equipe para começar!</p>
      </div>`;
    } else {
      html += `<div class="tm-grid" id="tmGrid">${equipes.map(e => renderizarCard(e)).join('')}</div>`;
    }

    container.innerHTML = html;
    setTimeout(() => {
      const btn = document.getElementById('tmBtnNova');
      if (btn) btn.addEventListener('click', () => { try { _novaEquipe(); } catch(e) { console.error(e); } });
    }, 0);
  }

  function renderizarCard(equipe) {
    const pokemons = equipe.pokemon || [];
    const dataCriacao = new Date(equipe.createdAt).toLocaleDateString('pt-BR');
    const dataEdicao = new Date(equipe.updatedAt).toLocaleDateString('pt-BR');
    const sprites = pokemons.slice(0, 6).map(p =>
      `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png" alt="${p.name}" loading="lazy">`
    ).join('');

    return `<div class="tm-card">
      <div class="tm-card-name">${escapar(equipe.name)}</div>
      <div class="tm-card-meta">${pokemons.length}/6 Pokémon · Criado ${dataCriacao} · Editado ${dataEdicao}</div>
      <div class="tm-card-preview">${sprites || '<span style="font-size:0.8rem;color:#aaa;">Nenhum Pokémon</span>'}</div>
      <div class="tm-card-actions">
        <button type="button" class="tm-card-action" onclick="TeamsUI._abrirEditor('${equipe.id}')">✏️ Editar</button>
        <button type="button" class="tm-card-action" onclick="TeamsUI._abrirNoBuilder('${equipe.id}')">🏗️ Builder</button>
        <button type="button" class="tm-card-action" onclick="TeamsUI._abrirNoAnalyzer('${equipe.id}')">🔍 Analyzer</button>
        <button type="button" class="tm-card-action" onclick="TeamsUI._duplicar('${equipe.id}')">📋 Duplicar</button>
        <button type="button" class="tm-card-action danger" onclick="TeamsUI._confirmarExcluir('${equipe.id}')">🗑️</button>
      </div>
    </div>`;
  }

  /* ─── Editor ─── */

  function renderizarEditor() {
    const container = document.getElementById('teamsContainer');
    if (!container) return;

    const titulo = modoEditor === 'criar' ? '➕ Nova Equipe' : '✏️ Editar Equipe';
    const eq = modoEditor === 'editar' ? TeamsData.obter(editandoId) : null;

    if (eq) timeEditor = TeamsData.exportarParaSlots(eq);
    else timeEditor = [null, null, null, null, null, null];

    const slotsHtml = timeEditor.map((p, i) => {
      if (!p) return `<div class="tm-slot" data-slot="${i}"><span class="tm-slot-empty">+ Slot ${i+1}</span></div>`;
      return `<div class="tm-slot filled" data-slot="${i}">
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png" alt="${p.name}">
        <div class="tm-slot-name">${p.name}</div>
        <button type="button" class="tm-slot-rm" data-idx="${i}">×</button>
      </div>`;
    }).join('');

    container.innerHTML = `<div class="tm-editor">
      <h3>${titulo}</h3>
      <div class="tm-field">
        <label>Nome da equipe</label>
        <input type="text" id="tmNome" placeholder="Ex: Time dos Campeões" value="${eq ? escapar(eq.name) : ''}">
      </div>
      <div class="tm-field">
        <label>Descrição (opcional)</label>
        <textarea id="tmDesc" placeholder="Descreva sua estratégia...">${eq ? escapar(eq.description || '') : ''}</textarea>
      </div>
      <div class="tm-slots" id="tmEditSlots">${slotsHtml}</div>
      <div class="tm-editor-actions">
        <button type="button" class="tm-btn tm-btn-primary" id="tmBtnSalvar">💾 Salvar</button>
        <button type="button" class="tm-btn tm-btn-secondary" id="tmBtnCancelar">Cancelar</button>
      </div>
    </div>`;

    document.querySelectorAll('[data-slot]').forEach(el => {
      el.addEventListener('click', function() {
        const i = parseInt(this.dataset.slot);
        _abrirSeletorSlot(i);
      });
    });
    document.querySelectorAll('.tm-slot-rm').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        _removerSlot(parseInt(this.dataset.idx));
      });
    });
    document.getElementById('tmBtnSalvar')?.addEventListener('click', _salvarEquipe);
    document.getElementById('tmBtnCancelar')?.addEventListener('click', _voltar);
  }

  /* ─── Seletor reusado do Team Analyzer ─── */

  function _abrirSeletorSlot(idx) {
    const container = document.getElementById('teamsContainer');
    if (!container) return;
    const TA = window.TeamAnalyzer;
    if (!TA) return;

    TA.abrirSeletorExterno(container, idx, function(p) { timeEditor[idx] = p; renderizarEditor(); }, renderizarEditor);
  }

  function _removerSlot(idx) {
    timeEditor[idx] = null;
    renderizarEditor();
  }

  /* ─── Salvar ─── */

  function _salvarEquipe() {
    const nome = document.getElementById('tmNome')?.value?.trim();
    if (!nome) { alert('Digite um nome para a equipe.'); return; }
    const desc = document.getElementById('tmDesc')?.value?.trim() || '';
    const pokemon = timeEditor.filter(Boolean);

    const dados = { name: nome, description: desc, pokemon: pokemon };
    if (modoEditor === 'editar' && editandoId) dados.id = editandoId;

    TeamsData.salvar(dados);
    modoEditor = 'criar';
    editandoId = null;
    timeEditor = [null, null, null, null, null, null];
    renderizarPagina('✅ Equipe salva com sucesso!');
  }

  /* ─── Ações ─── */

  function _novaEquipe() {
    modoEditor = 'criar';
    editandoId = null;
    timeEditor = [null, null, null, null, null, null];
    renderizarEditor();
  }

  function _abrirEditor(id) {
    const eq = TeamsData.obter(id);
    if (!eq) return;
    modoEditor = 'editar';
    editandoId = id;
    timeEditor = TeamsData.exportarParaSlots(eq);
    renderizarEditor();
  }

  function _abrirNoBuilder(id) {
    renderizarPagina('💡 Abra o Team Builder e use "Aleatória Inteligente".');
  }

  function _abrirNoAnalyzer(id) {
    const eq = TeamsData.obter(id);
    if (!eq?.pokemon) return;
    const slots = TeamsData.exportarParaSlots(eq);
    alternarModo('teamanalyzer');
    setTimeout(() => {
      slots.forEach((p, i) => {
        if (p && window.TeamAnalyzer) {
          window.TeamAnalyzer._adicionarNoSlot ? window.TeamAnalyzer._adicionarNoSlot(i, p) : null;
        }
      });
    }, 100);
  }

  function _duplicar(id) {
    const copia = TeamsData.duplicar(id);
    if (copia) renderizarPagina('✅ Equipe duplicada com sucesso!');
  }

  function _confirmarExcluir(id) {
    const eq = TeamsData.obter(id);
    if (!eq) return;
    const nome = eq.name;

    const overlay = document.createElement('div');
    overlay.className = 'tm-confirm-overlay active';
    overlay.innerHTML = `<div class="tm-confirm">
      <h3>🗑️ Excluir equipe</h3>
      <p>Tem certeza que deseja excluir <strong>${escapar(nome)}</strong>?</p>
      <div class="tm-confirm-actions">
        <button type="button" class="tm-btn tm-btn-danger" id="tmConfirmYes">Sim, excluir</button>
        <button type="button" class="tm-btn tm-btn-secondary" id="tmConfirmNo">Cancelar</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('tmConfirmYes').onclick = () => {
      TeamsData.remover(id); overlay.remove(); renderizarPagina('🗑️ Equipe excluída.');
    };
    document.getElementById('tmConfirmNo').onclick = () => { overlay.remove(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function _voltar() {
    renderizarPagina();
  }

  function _filtrar() {
    const query = document.getElementById('tmSearch')?.value || '';
    const criterio = document.getElementById('tmOrder')?.value || 'updatedAt';
    const equipes = TeamsData.buscar(query);
    const ordenadas = TeamsData.ordenar(equipes, criterio, 'desc');
    const grid = document.getElementById('tmGrid');
    if (grid) grid.innerHTML = ordenadas.map(e => renderizarCard(e)).join('');
  }

  function escapar(texto) {
    return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  window.TeamsUI = {
    mostrar, _novaEquipe, _abrirEditor, _abrirNoBuilder, _abrirNoAnalyzer,
    _duplicar, _confirmarExcluir, _salvarEquipe, _filtrar, _voltar
  };
  return { mostrar };
})();
