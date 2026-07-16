/* ===== TEAMS UI — Minhas Equipes ===== */

const TeamsUI = window.TeamsUI || (function() {
  'use strict';

  let modoEditor = 'criar'; // 'criar' | 'editar'
  let editandoId = null;
  let timeEditor = [null, null, null, null, null, null];
  let slotSelecionado = -1;
  let listenerRemover = null;

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
      if (btn) btn.addEventListener('click', () => { try { _novaEquipe(); } catch(e) { console.error('novaEquipe error:', e); } });
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

    // Conectar eventos
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

  /* ─── Seletor de Pokémon (reusa TeamAnalyzer) ─── */

  function _abrirSeletorSlot(idx) {
    slotSelecionado = idx;
    const TB = window.TeamBuilder;
    if (!TB) return;

    if (TB.DB.ready && TB.DB.pokemons.length > 0) {
      renderizarSeletorPokemon();
      return;
    }

    // Mostra loading e inicia carregamento
    const pagina = document.getElementById('teamsContainer');
    if (pagina) pagina.innerHTML = '<div class="ta-loading"><div class="ta-spinner"></div><p>Carregando Pokémon...</p></div>';

    if (!TB.DB.loading) TB.carregarBase();

    // Tenta de novo quando a base estiver pronta
    var check = setInterval(function() {
      if (TB.DB.ready && TB.DB.pokemons.length > 0) {
        clearInterval(check);
        if (slotSelecionado === idx) renderizarSeletorPokemon();
      }
    }, 300);
  }

  function renderizarSeletorPokemon() {
    const pagina = document.getElementById('teamsContainer');
    if (!pagina) return;

    const filtros = lerFiltrosSeletor();
    const lista = listarPokemons(filtros).slice(0, 60);

    const tipos = ["","normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];
    const geracoes = ["todas","1","2","3","4","5","6","7","8","9"];
    const ordenacao = [
      { value: "id", label: "Nº Pokédex" }, { value: "nome", label: "Nome" },
      { value: "hp", label: "HP" }, { value: "atk", label: "Ataque" },
      { value: "def", label: "Defesa" }, { value: "spA", label: "Atq. Esp." },
      { value: "spD", label: "Def. Esp." }, { value: "spe", label: "Velocidade" }
    ];

    pagina.innerHTML = `<div style="margin-bottom:14px;">
        <button type="button" class="tm-btn tm-btn-secondary" onclick="TeamsUI._voltarEditor()">← Voltar</button>
      </div>
      <div class="ta-search-filters">
        <input type="text" id="ta-sel-search" placeholder="Pesquisar por nome..." oninput="TeamsUI._atualizarSeletor()">
        <select id="ta-sel-tipo" onchange="TeamsUI._atualizarSeletor()">
          ${tipos.map(t => `<option value="${t}">${t ? TeamBuilder.capitalizar(t) : "Todos os tipos"}</option>`).join("")}
        </select>
        <select id="ta-sel-geracao" onchange="TeamsUI._atualizarSeletor()">
          ${geracoes.map(g => `<option value="${g}">${g === "todas" ? "Todas gerações" : "Geração "+g}</option>`).join("")}
        </select>
        <select id="ta-sel-ordem" class="ta-filter-full" onchange="TeamsUI._atualizarSeletor()">
          ${ordenacao.map(o => `<option value="${o.value}">Ordenar por: ${o.label}</option>`).join("")}
        </select>
      </div>
      <div id="ta-sel-grid" class="ta-selector-grid">${renderizarGridSeletor(lista)}</div>
    `;
    document.getElementById("ta-sel-search")?.focus();
  }

  function renderizarGridSeletor(lista) {
    if (!lista || lista.length === 0) return `<div class="ta-empty"><p>Nenhum Pokémon encontrado.</p></div>`;
    const TB = window.TeamBuilder;
    return lista.map(p => {
      const role = TB.classificarRole(p.stats);
      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
      const typesHtml = p.types.map(t => `<span style="padding:2px 6px;border-radius:4px;font-size:0.6rem;font-weight:700;color:#fff;background:${corTipo(t)}">${t}</span>`).join("");
      return `<div class="ta-selector-item" onclick="TeamsUI._selecionarPokemon(${p.id})">
        <img src="${spriteUrl}" alt="${TB.escapar(p.name)}" loading="lazy">
        <div class="ta-sel-name">${TB.capitalizar(p.name)}</div>
        <div class="ta-sel-types">${typesHtml}</div>
      </div>`;
    }).join("");
  }

  function _atualizarSeletor() {
    const div = document.getElementById("ta-sel-grid");
    if (!div) return;
    const lista = listarPokemons(lerFiltrosSeletor()).slice(0, 60);
    div.innerHTML = renderizarGridSeletor(lista);
  }

  function lerFiltrosSeletor() {
    return {
      nome: document.getElementById("ta-sel-search")?.value || "",
      tipo: document.getElementById("ta-sel-tipo")?.value || "",
      geracao: document.getElementById("ta-sel-geracao")?.value || "todas",
      ordenar: document.getElementById("ta-sel-ordem")?.value || "id"
    };
  }

  function listarPokemons(filtros) {
    const TB = window.TeamBuilder;
    if (!TB || !TB.DB.pokemons) return [];
    let pool = [...TB.DB.pokemons];
    if (filtros.nome) {
      const q = filtros.nome.toLowerCase();
      pool = pool.filter(p => p.name.includes(q));
    }
    if (filtros.geracao && filtros.geracao !== "todas") {
      pool = pool.filter(p => p.generation === parseInt(filtros.geracao, 10));
    }
    if (filtros.tipo) {
      pool = pool.filter(p => p.types.includes(filtros.tipo));
    }
    const sortKey = filtros.ordenar || "id";
    pool.sort((a, b) => {
      if (sortKey === "nome") return a.name.localeCompare(b.name);
      if (sortKey === "id") return a.id - b.id;
      return (b.stats[sortKey] || 0) - (a.stats[sortKey] || 0);
    });
    return pool;
  }

  function corTipo(tipo) {
    const cores = {
      normal:"#A8A77A",fire:"#EE8130",water:"#6390F0",electric:"#F7D02C",
      grass:"#7AC74C",ice:"#96D9D6",fighting:"#C22E28",poison:"#A33EA1",
      ground:"#E2BF65",flying:"#A98FF3",psychic:"#F95587",bug:"#A6B91A",
      rock:"#B6A136",ghost:"#735797",dragon:"#6F35FC",dark:"#705746",
      steel:"#B7B7CE",fairy:"#D685AD"
    };
    return cores[tipo] || "#999";
  }

  function _selecionarPokemon(id) {
    const TB = window.TeamBuilder;
    const p = TB.DB.pokemons.find(p => p.id === id);
    if (!p || slotSelecionado < 0) return;
    timeEditor[slotSelecionado] = p;
    renderizarEditor();
  }

  function _removerSlot(idx) {
    timeEditor[idx] = null;
    renderizarEditor();
  }

  function _voltarEditor() {
    renderizarEditor();
  }

  /* ─── Salvar ─── */

  function _salvarEquipe() {
    const nome = document.getElementById('tmNome')?.value?.trim();
    if (!nome) { alert('Digite um nome para a equipe.'); return; }
    const desc = document.getElementById('tmDesc')?.value?.trim() || '';
    const pokemon = timeEditor.filter(Boolean);

    const dados = {
      name: nome,
      description: desc,
      pokemon: pokemon
    };

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
    const eq = TeamsData.obter(id);
    if (!eq) return;
    alternarModo('teambuilder');
    // Aguardar renderizar e tentar preencher — o TeamBuilder gera times, não aceita pré-preenchimento
    renderizarPagina('💡 Abra o Team Builder e use "Aleatória Inteligente" para montar um time similar.');
  }

  function _abrirNoAnalyzer(id) {
    const eq = TeamsData.obter(id);
    if (!eq?.pokemon) return;
    const slots = TeamsData.exportarParaSlots(eq);

    // Preencher o TeamAnalyzer com os Pokémon da equipe
    alternarModo('teamanalyzer');
    setTimeout(() => {
      slots.forEach((p, i) => {
        if (p && window.TeamAnalyzer) {
          // Acessar o time internamente e preencher
          const ta = window.TeamAnalyzer;
          if (ta._preencherSlot) ta._preencherSlot(i, p);
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
      TeamsData.remover(id);
      overlay.remove();
      renderizarPagina('🗑️ Equipe excluída.');
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

  /* ─── API Pública ─── */

  window.TeamsUI = {
    mostrar,
    _novaEquipe, _abrirEditor, _abrirNoBuilder, _abrirNoAnalyzer,
    _duplicar, _confirmarExcluir, _salvarEquipe,
    _abrirSeletorSlot, _selecionarPokemon, _removerSlot,
    _atualizarSeletor, _filtrar, _voltar, _voltarEditor
  };

  return { mostrar };
})();
