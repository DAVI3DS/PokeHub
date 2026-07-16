/* ===== TEAM ANALYZER — PokeHub Team Analyzer Inteligente ===== */
/* Namespace isolado — reusa recursos do TeamBuilder sem conflito */

const TeamAnalyzer = window.TeamAnalyzer || (function() {
  'use strict';

  /* ─── Dependências do TeamBuilder ─── */

  const TB = window.TeamBuilder;
  function garantirBase() {
    if (TB && !TB.DB.ready && !TB.DB.loading) TB.carregarBase();
    return TB && TB.DB.ready ? Promise.resolve() : new Promise(res => { if (TB) TB.carregarBase().then(res); else res(); });
  }

  /* ─── Time State ─── */

  const time = [null, null, null, null, null, null];

  function adicionar(idx, pokemon) { time[idx] = pokemon; atualizarPrevia(); }
  function remover(idx) {
    if (idx < 0 || idx >= 6) return;
    time[idx] = null;
    renderizarSlots();
    atualizarPrevia();
  }

  function obterTimeValido() { return time.filter(Boolean); }

  /* ─── Lista de Pokémons com Filtros ─── */

  function listarPokemons(filtros) {
    if (!TB || !TB.DB.pokemons) return [];
    let pool = [...TB.DB.pokemons];

    if (filtros.nome) {
      const q = filtros.nome.toLowerCase();
      pool = pool.filter(p => p.name.includes(q));
    }
    if (filtros.geracao && filtros.geracao !== "todas") {
      const g = parseInt(filtros.geracao, 10);
      pool = pool.filter(p => p.generation === g);
    }
    if (filtros.tipo) {
      pool = pool.filter(p => p.types.includes(filtros.tipo));
    }
    if (filtros.role) {
      pool = pool.filter(p => TB.classificarRole(p.stats).role === filtros.role);
    }

    // Sort
    const sortKey = filtros.ordenar || "id";
    pool.sort((a, b) => {
      if (sortKey === "nome") return a.name.localeCompare(b.name);
      if (sortKey === "id") return a.id - b.id;
      return (b.stats[sortKey] || 0) - (a.stats[sortKey] || 0);
    });

    return pool;
  }

  /* ─── Preview ao Vivo ─── */

  function atualizarPrevia() {
    const div = document.getElementById("ta-preview");
    if (!div) return;
    const team = obterTimeValido();
    if (team.length === 0) { div.innerHTML = ""; return; }

    const cov = TB ? TB.coberturaCombinada(team) : new Set();
    const weaks = TB ? TB.fraquezasTime(team) : {};
    const resists = TB ? TB.resistenciasTime(team) : {};
    const roles = team.map(p => TB.classificarRole(p.stats).label);
    const avgSpe = Math.round(team.reduce((s, p) => s + p.stats.spe, 0) / team.length);
    const phys = team.filter(p => p.stats.atk > p.stats.spA).length;
    const spec = team.filter(p => p.stats.spA >= p.stats.atk).length;

    let html = `<div class="ta-live-item"><span>Time:</span> ${team.length}/6</div>`;
    html += `<div class="ta-live-item"><span>Cobertura:</span> ${cov.size}/18</div>`;
    html += `<div class="ta-live-item"><span>Vel. Média:</span> ${avgSpe}</div>`;

    // Avisos inteligentes
    const warnings = [];
    if (!roles.some(r => r.includes("Tank") || r.includes("Muro") || r.includes("Defensivo"))) {
      warnings.push({ msg: "Nenhum Pokémon defensivo na equipe.", danger: false });
    }
    if (!roles.some(r => r.includes("Suporte"))) {
      warnings.push({ msg: "Nenhum Pokémon de suporte.", danger: false });
    }
    Object.entries(weaks).forEach(([t, n]) => {
      if (n >= 3) warnings.push({ msg: `${n}x fraqueza a ${TB.capitalizar(t)}.`, danger: true });
      else if (n >= 2) warnings.push({ msg: `${n}x fraqueza a ${TB.capitalizar(t)}.`, danger: false });
    });
    if (cov.size < 8) warnings.push({ msg: "Cobertura ofensiva baixa.", danger: true });

    warnings.forEach(w => {
      html += `<div class="ta-live-warning ${w.danger ? 'danger' : ''}">${w.danger ? '⚠️' : '💡'} ${w.msg}</div>`;
    });

    html += `<div class="ta-live-item"><span>Físicos:</span> ${phys} <span>Especiais:</span> ${spec}</div>`;

    div.innerHTML = html;
  }

  /* ─── Seletor Inline (como o Minhas Equipes) ─── */

  let slotSelecionado = -1;

  function abrirSeletor(idx) {
    slotSelecionado = idx;
    renderizarSeletor();
  }

  function fecharSeletor() {
    slotSelecionado = -1;
  }

  function renderizarSeletor() {
    const container = document.getElementById("teamAnalyzerContainer");
    if (!container) return;

    const TB = window.TeamBuilder;
    const filtros = lerFiltrosSeletor();
    const lista = listarPokemons(filtros).slice(0, 60);

    const tipos = ["","normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];
    const geracoes = ["todas","1","2","3","4","5","6","7","8","9"];
    const roles = ["","Tank","Physical Wall","Special Wall","Mixed Sweeper","Physical Sweeper","Special Sweeper","Support","Pivot","Physical Attacker","Special Attacker","Speedster","Balanced"];
    const ordenacao = [
      { value: "id", label: "Nº Pokédex" },
      { value: "nome", label: "Nome" },
      { value: "hp", label: "HP" },
      { value: "atk", label: "Ataque" },
      { value: "def", label: "Defesa" },
      { value: "spA", label: "Atq. Esp." },
      { value: "spD", label: "Def. Esp." },
      { value: "spe", label: "Velocidade" }
    ];

    container.innerHTML = `
      <div style="margin-bottom:14px;">
        <button type="button" class="tb-build-btn" onclick="TeamAnalyzer._voltarDoSeletor()">← Voltar</button>
      </div>
      <div class="ta-search-filters">
        <input type="text" id="ta-sel-search" placeholder="Pesquisar por nome..." oninput="TeamAnalyzer._filtrarSeletor()">
        <select id="ta-sel-tipo" onchange="TeamAnalyzer._filtrarSeletor()">
          ${tipos.map(t => `<option value="${t}">${t ? TB.capitalizar(t) : "Todos os tipos"}</option>`).join("")}
        </select>
        <select id="ta-sel-geracao" onchange="TeamAnalyzer._filtrarSeletor()">
          ${geracoes.map(g => `<option value="${g}">${g === "todas" ? "Todas gerações" : "Geração "+g}</option>`).join("")}
        </select>
        <select id="ta-sel-role" onchange="TeamAnalyzer._filtrarSeletor()">
          ${roles.map(r => `<option value="${r}">${r ? r : "Todas funções"}</option>`).join("")}
        </select>
        <select id="ta-sel-ordem" class="ta-filter-full" onchange="TeamAnalyzer._filtrarSeletor()">
          ${ordenacao.map(o => `<option value="${o.value}">Ordenar por: ${o.label}</option>`).join("")}
        </select>
      </div>
      <div id="ta-sel-grid" class="ta-selector-grid">${renderizarGridSeletor(lista)}</div>
    `;

    document.getElementById("ta-sel-search")?.focus();
  }

  function renderizarGridSeletor(lista) {
    if (!lista || lista.length === 0) return `<div class="ta-empty"><p>Nenhum Pokémon encontrado.</p></div>`;

    return lista.map(p => {
      const role = TB.classificarRole(p.stats);
      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
      const typesHtml = p.types.map(t => `<span class="ta-sel-type" style="background:${corTipo(t)}">${t}</span>`).join("");
      const bst = p.stats.hp + p.stats.atk + p.stats.def + p.stats.spA + p.stats.spD + p.stats.spe;
      return `<div class="ta-selector-item" onclick="TeamAnalyzer._selecionarPokemon(${p.id})">
        <img src="${spriteUrl}" alt="${TB.escapar(p.name)}" loading="lazy">
        <div class="ta-sel-name">${TB.capitalizar(p.name)}</div>
        <div class="ta-sel-types">${typesHtml}</div>
        <div class="ta-sel-stats">BST ${bst} &middot; ${role.label}</div>
      </div>`;
    }).join("");
  }

  function _filtrarSeletor() {
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
      role: document.getElementById("ta-sel-role")?.value || "",
      ordenar: document.getElementById("ta-sel-ordem")?.value || "id"
    };
  }

  function _selecionarPokemon(id) {
    const pokemon = TB.DB.pokemons.find(p => p.id === id);
    if (!pokemon || slotSelecionado < 0) return;
    adicionar(slotSelecionado, pokemon);
    slotSelecionado = -1;
    mostrar();
  }

  /* ─── Cores dos tipos (para o seletor) ─── */

  function corTipo(tipo) {
    const cores = {
      normal: "#A8A77A", fire: "#EE8130", water: "#6390F0", electric: "#F7D02C",
      grass: "#7AC74C", ice: "#96D9D6", fighting: "#C22E28", poison: "#A33EA1",
      ground: "#E2BF65", flying: "#A98FF3", psychic: "#F95587", bug: "#A6B91A",
      rock: "#B6A136", ghost: "#735797", dragon: "#6F35FC", dark: "#705746",
      steel: "#B7B7CE", fairy: "#D685AD"
    };
    return cores[tipo] || "#999";
  }

  /* ─── Motor de Análise ─── */

  function analisarEquipe() {
    const team = obterTimeValido();
    if (team.length === 0) return null;

    const cov = TB.coberturaCombinada(team);
    const weaks = TB.fraquezasTime(team);
    const resists = TB.resistenciasTime(team);
    const roles = team.map(p => TB.classificarRole(p.stats));

    // Nota baseada em múltiplos fatores
    let score = 5.0;

    // Cobertura ofensiva (peso 2.0)
    score += (cov.size / 18) * 2.0;

    // Fraquezas repetidas (penalidade, peso 1.5)
    let weakPenalty = 0;
    Object.values(weaks).forEach(n => { if (n > 1) weakPenalty += (n - 1); });
    score -= Math.min(weakPenalty * 0.3, 1.5);

    // Resistências únicas (peso 1.0)
    const uniqueRes = Object.keys(resists).length;
    score += Math.min(uniqueRes / 18, 1.0);

    // Balanceamento físico/especial (peso 1.0)
    const phys = team.filter(p => p.stats.atk > p.stats.spA).length;
    const spec = team.filter(p => p.stats.spA >= p.stats.atk).length;
    if (Math.abs(phys - spec) <= 1) score += 1.0;
    else if (Math.abs(phys - spec) <= 2) score += 0.5;

    // Diversidade de funções (peso 1.0)
    const uniqueRoles = new Set(roles.map(r => r.role));
    score += Math.min(uniqueRoles.size * 0.2, 1.0);

    // Nota final 0-10
    score = Math.round(Math.max(0, Math.min(score, 10)) * 10) / 10;

    // Pontos fortes
    const strengths = [];
    if (cov.size >= 14) strengths.push("Excelente cobertura ofensiva — " + cov.size + "/18 tipos cobertos.");
    else if (cov.size >= 10) strengths.push("Boa cobertura ofensiva — " + cov.size + "/18 tipos cobertos.");
    if (Math.abs(phys - spec) <= 1) strengths.push("Bom balanceamento entre atacantes físicos e especiais.");
    if (uniqueRes >= 12) strengths.push("Excelente resistência defensiva contra " + uniqueRes + " tipos.");
    if (uniqueRoles.size >= 5) strengths.push("Ótima diversidade de funções na equipe.");
    const avgSpe = Math.round(team.reduce((s, p) => s + p.stats.spe, 0) / team.length);
    if (avgSpe >= 90) strengths.push("Time rápido — velocidade média de " + avgSpe + ".");
    if (team.every(p => p.stats.spD >= 70)) strengths.push("Defesa especial sólida em todos os membros.");

    // Pontos fracos
    const weaksSorted = Object.entries(weaks).sort((a, b) => b[1] - a[1]);
    const weaknesses = [];
    weaksSorted.forEach(([t, n]) => {
      if (n >= 2) weaknesses.push((n >= 3 ? "Muitos" : "Alguns") + " Pokémon fracos ao tipo " + TB.capitalizar(t) + " (" + n + "x).");
    });
    if (!roles.some(r => r.role === "Tank" || r.role === "Physical Wall" || r.role === "Special Wall")) {
      weaknesses.push("Nenhum Pokémon com função defensiva (Tank/Wall).");
    }
    if (!roles.some(r => r.role === "Support")) {
      weaknesses.push("Nenhum Pokémon de suporte na equipe.");
    }
    if (cov.size < 10) weaknesses.push("Cobertura ofensiva limitada — apenas " + cov.size + "/18 tipos.");
    if (avgSpe < 60) weaknesses.push("Time lento — velocidade média de " + avgSpe + ".");
    if (team.some(p => p.stats.spD < 50)) weaknesses.push("Alguns membros com defesa especial muito baixa.");

    // Cobertura de tipos
    const coverageByType = TB.ALL_TYPES.map(t => {
      const off = TB.calcularCobertura([t]);
      const hasCoverage = [...off].some(at => cov.has(at));
      const weakCount = weaks[t] || 0;
      const resCount = resists[t] || 0;
      const defStatus = weakCount > 0 ? (resCount > 0 ? "neutral" : "bad") : (resCount > 0 ? "good" : "neutral");
      return { type: t, off: hasCoverage, def: defStatus };
    });

    // Sugestões
    const sugestoes = gerarSugestoes(team, weaks, roles);

    return {
      score,
      strengths,
      weaknesses,
      coverage: coverageByType,
      roles: roles.map(r => r.label),
      roleCounts: extrairContagemRoles(roles),
      sugestoes,
      stats: {
        avgSpe,
        avgBST: Math.round(team.reduce((s, p) => s + p.bst, 0) / team.length),
        physCount: phys,
        specCount: spec,
        totalCoverage: cov.size
      }
    };
  }

  function extrairContagemRoles(roles) {
    const map = {};
    roles.forEach(r => { map[r.label] = (map[r.label] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  function gerarSugestoes(team, weaks, roles) {
    const s = [];

    // Sugerir substituição para fraquezas repetidas
    Object.entries(weaks).forEach(([t, n]) => {
      if (n >= 3) {
        s.push({ msg: `Considere substituir um Pokémon fraco a ${TB.capitalizar(t)} por outro que resista a esse tipo para reduzir a vulnerabilidade.`, tipo: "warning" });
      }
    });

    // Sugerir tank se não tem
    if (!roles.some(r => r.role === "Tank" || r.role === "Physical Wall" || r.role === "Special Wall")) {
      s.push({ msg: "Adicionar um Pokémon Tank ou Wall aumenta a resistência geral da equipe.", tipo: "info" });
    }

    // Sugerir suporte se não tem
    if (!roles.some(r => r.role === "Support")) {
      s.push({ msg: "Um Pokémon de Suporte pode fornecer utilidade e recuperação para a equipe.", tipo: "info" });
    }

    // Sugerir cobertura
    const cov = TB.coberturaCombinada(team);
    const uncovered = TB.ALL_TYPES.filter(t => !cov.has(t));
    if (uncovered.length > 6) {
      s.push({ msg: `Cobertura ofensiva baixa. ${uncovered.slice(0, 5).map(TB.capitalizar).join(", ")} e outros tipos não são cobertos.`, tipo: "warning" });
    }

    if (s.length === 0) {
      s.push({ msg: "Sua equipe está bem equilibrada! Parabéns!", tipo: "success" });
    }

    return s;
  }

  /* ─── Melhorar Equipe ─── */

  function melhorarEquipe() {
    const team = obterTimeValido();
    if (team.length === 0) return [];
    if (!TB) return [];

    const result = analisarEquipe();
    if (!result) return [];

    const sugestoes = [];
    const weaks = TB.fraquezasTime(team);

    // Encontra a fraqueza mais repetida e sugere substitutos
    const weaksSorted = Object.entries(weaks).sort((a, b) => b[1] - a[1]);
    if (weaksSorted.length > 0 && weaksSorted[0][1] >= 2) {
      const piorTipo = weaksSorted[0][0];
      const candidatos = TB.DB.pokemons.filter(p =>
        p.types.length > 0 && (TB.TYPE_CHART_RES[piorTipo] || []).includes(p.types[0]) && !team.some(m => m.id === p.id)
      ).sort((a, b) => b.bst - a.bst).slice(0, 3);

      candidatos.forEach(c => {
        const role = TB.classificarRole(c.stats);
        sugestoes.push({
          msg: `Substitua um Pokémon por <strong>${TB.capitalizar(c.name)}</strong> (${role.label}) — resiste a ${TB.capitalizar(piorTipo)} e adiciona ${TB.capitalizar(c.types.join("/"))} à equipe.`,
          pokemon: c
        });
      });
    }

    if (sugestoes.length === 0) {
      sugestoes.push({ msg: "A equipe já está bem ajustada! Tente adicionar mais Pokémon para uma análise mais completa.", pokemon: null });
    }

    return sugestoes;
  }

  /* ─── UI Rendering ─── */

  function renderizar() {
    let html = `<h2>🔍 Team Analyzer</h2>`;
    html += `<div class="ta-slots-grid" id="ta-slots">${renderizarSlotsHtml()}</div>`;
    html += `<div class="ta-live-preview" id="ta-preview"></div>`;
    html += `<div style="text-align:center;"><button type="button" class="ta-analyze-btn" id="ta-analyze-btn">📊 Analisar Equipe</button></div>`;
    html += `<div id="ta-result"></div>`;
    return html;
  }

  function renderizarSlotsHtml() {
    return time.map((p, i) => {
      if (!p) {
        return `<div class="ta-slot" onclick="TeamAnalyzer._abrirSeletor(${i})">
          <div class="ta-slot-icon">+</div>
          <div class="ta-slot-label">Slot ${i + 1}</div>
        </div>`;
      }
      const role = TB.classificarRole(p.stats);
      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
      const typesHtml = p.types.map(t => `<span class="ta-sel-type" style="background:${corTipo(t)}">${t}</span>`).join("");
      return `<div class="ta-slot filled" onclick="TeamAnalyzer._abrirSeletor(${i})">
        <button class="ta-slot-remove" onclick="event.stopPropagation(); TeamAnalyzer._remover(${i})">×</button>
        <img class="ta-slot-sprite" src="${spriteUrl}" alt="${TB.escapar(p.name)}">
        <div class="ta-slot-name">${TB.capitalizar(p.name)}</div>
        <div class="ta-slot-types">${typesHtml}</div>
        <div class="ta-slot-role">${role.label}</div>
      </div>`;
    }).join("");
  }

  function renderizarSlots() {
    const div = document.getElementById("ta-slots");
    if (div) div.innerHTML = renderizarSlotsHtml();
  }

  function renderizarResultado(result) {
    if (!result) return `<div class="ta-error"><p>❌ Monte sua equipe antes de analisar.</p></div>`;

    let html = `<div class="ta-result">`;

    // Nota
    html += `<div class="ta-score"><div class="ta-score-number">${result.score.toFixed(1)}</div><div class="ta-score-label">/ 10</div></div>`;

    // Stats
    html += `<div class="ta-live-preview" style="justify-content:center;">
      <div class="ta-live-item"><span>BST Médio:</span> ${result.stats.avgBST}</div>
      <div class="ta-live-item"><span>Vel. Média:</span> ${result.stats.avgSpe}</div>
      <div class="ta-live-item"><span>Cobertura:</span> ${result.stats.totalCoverage}/18</div>
      <div class="ta-live-item"><span>Físicos:</span> ${result.stats.physCount} <span>Especiais:</span> ${result.stats.specCount}</div>
    </div>`;

    // Pontos fortes
    if (result.strengths.length > 0) {
      html += `<div class="ta-strengths"><h4>✅ Pontos Fortes</h4><ul>${result.strengths.map(s => `<li>${s}</li>`).join("")}</ul></div>`;
    }

    // Pontos fracos
    if (result.weaknesses.length > 0) {
      html += `<div class="ta-weaknesses"><h4>⚠️ Pontos Fracos</h4><ul>${result.weaknesses.map(s => `<li>${s}</li>`).join("")}</ul></div>`;
    }

    // Cobertura de tipos
    html += `<div class="ta-weaknesses"><h4>🎯 Cobertura de Tipos</h4>`;
    html += `<div class="ta-coverage-grid">`;
    result.coverage.forEach(c => {
      const label = TB.capitalizar(c.type);
      const cls = c.off && c.def === "good" ? "good" : (c.def === "bad" ? "bad" : "neutral");
      const icon = c.off ? "✅" : (c.def === "bad" ? "⚠️" : "➖");
      html += `<div class="ta-coverage-cell ${cls}" title="${label}: ofensivo ${c.off ? '✅' : '❌'}, defensivo ${c.def}">${icon} ${label}</div>`;
    });
    html += `</div></div>`;

    // Distribuição de funções
    html += `<div class="ta-weaknesses"><h4>👥 Distribuição de Funções</h4><div class="ta-roles-chart">`;
    result.roleCounts.forEach(([role, count]) => {
      html += `<div class="ta-role-bar">${role} <span class="ta-role-count">${count}</span></div>`;
    });
    html += `</div></div>`;

    // Sugestões
    if (result.sugestoes.length > 0) {
      html += `<div class="ta-suggestions"><h4>💡 Sugestões</h4>`;
      result.sugestoes.forEach(s => {
        html += `<div class="ta-suggestion">${s.msg}</div>`;
      });
      html += `</div>`;
    }

    // Botão melhorar
    html += `<div style="text-align:center;"><button type="button" class="ta-improve-btn" id="ta-improve-btn">✨ Melhorar Equipe</button></div>`;
    html += `<div id="ta-improve-result"></div>`;

    html += `</div>`;
    return html;
  }

  function renderizarMelhorias(melhorias) {
    if (!melhorias || melhorias.length === 0) return `<div class="ta-suggestion">Nenhuma sugestão disponível.</div>`;
    return melhorias.map(m => `<div class="ta-suggestion">${m.msg}</div>`).join("");
  }

  /* ─── Handlers ─── */

  async function handleAnalisar() {
    const div = document.getElementById("ta-result");
    if (!div) return;

    await garantirBase();

    const team = obterTimeValido();
    if (team.length === 0) {
      div.innerHTML = `<div class="ta-empty"><p>❌ Adicione pelo menos um Pokémon à equipe.</p></div>`;
      return;
    }

    div.innerHTML = `<div class="ta-loading"><div class="ta-spinner"></div><p>Analisando equipe...</p></div>`;

    // Pequeno delay pra mostrar o loading
    await new Promise(r => setTimeout(r, 300));

    const result = analisarEquipe();
    div.innerHTML = renderizarResultado(result);

    // Conectar botão melhorar
    document.getElementById("ta-improve-btn")?.addEventListener("click", handleMelhorar);
  }

  function handleMelhorar() {
    const div = document.getElementById("ta-improve-result");
    if (!div) return;
    const melhorias = melhorarEquipe();
    div.innerHTML = renderizarMelhorias(melhorias);
  }

  /* ─── Init ─── */

  function init() {
    const c = document.getElementById("teamAnalyzerContainer");
    if (!c || (c.hasChildNodes() && c.innerHTML.trim() !== "")) return;

    c.innerHTML = renderizar();

    document.getElementById("ta-analyze-btn")?.addEventListener("click", handleAnalisar);

    // Garantir que a base de dados carregue
    garantirBase();
  }

  function _voltarDoSeletor() {
    slotSelecionado = -1;
    mostrar();
  }

  function mostrar() {
    const c = document.getElementById("teamAnalyzerContainer");
    if (!c) return;
    c.hidden = false;
    if (!c.hasChildNodes() || c.innerHTML.trim() === "") init();
  }

  // API pública para o seletor
  window.TeamAnalyzer = {
    init, mostrar,
    _abrirSeletor: abrirSeletor,
    _fecharSeletor: fecharSeletor,
    _voltarDoSeletor,
    _remover: remover,
    _selecionarPokemon,
    _filtrarSeletor
  };
  return window.TeamAnalyzer;
})();
