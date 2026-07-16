/* ===== TEAM BUILDER — Pokédex Team Builder Inteligente ===== */
/* Namespace isolado — não conflita com o código existente */

const TeamBuilder = window.TeamBuilder || (function() {
  'use strict';

  /* ─── Utilities ─── */

  function capitalizar(texto) {
    return texto.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }

  function escapar(texto) {
    return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ─── Type Effectiveness Chart ─── */

  const TYPE_CHART_OFF = {
    normal:[],fire:["grass","ice","bug","steel"],water:["fire","ground","rock"],
    electric:["water","flying"],grass:["water","ground","rock"],ice:["grass","ground","flying","dragon"],
    fighting:["normal","ice","rock","dark","steel"],poison:["grass","fairy"],
    ground:["fire","electric","poison","rock","steel"],flying:["grass","fighting","bug"],
    psychic:["fighting","poison"],bug:["grass","psychic","dark"],rock:["fire","ice","flying","bug"],
    ghost:["psychic","ghost"],dragon:["dragon"],dark:["psychic","ghost"],
    steel:["ice","rock","fairy"],fairy:["fighting","dragon","dark"]
  };

  const TYPE_CHART_RES = {
    normal:["ghost"],fire:["fire","grass","ice","bug","steel","fairy"],
    water:["fire","water","ice","steel"],electric:["electric","flying","steel"],
    grass:["water","electric","grass","ground"],ice:["ice"],
    fighting:["bug","rock","dark"],poison:["grass","fighting","poison","bug","fairy"],
    ground:["electric","poison","rock"],flying:["grass","fighting","bug","ground"],
    psychic:["fighting","psychic"],bug:["grass","fighting","ground"],
    rock:["normal","fire","poison","flying"],ghost:["poison","bug","normal","fighting"],
    dragon:["fire","water","electric","grass"],dark:["psychic","ghost","dark"],
    steel:["normal","grass","ice","flying","psychic","bug","rock","dragon","steel","fairy","poison"],
    fairy:["fighting","bug","dark","dragon"]
  };

  const TYPE_CHART_WEAK = {
    normal:["fighting"],fire:["water","ground","rock"],water:["electric","grass"],
    electric:["ground"],grass:["fire","ice","poison","flying","bug"],
    ice:["fire","fighting","rock","steel"],fighting:["flying","psychic","fairy"],
    poison:["ground","psychic"],ground:["water","grass","ice"],
    flying:["electric","ice","rock"],psychic:["bug","ghost","dark"],
    bug:["fire","flying","rock"],rock:["water","grass","fighting","ground","steel"],
    ghost:["ghost","dark"],dragon:["ice","dragon","fairy"],
    dark:["fighting","bug","fairy"],steel:["fire","fighting","ground"],
    fairy:["poison","steel"]
  };

  const ALL_TYPES = Object.keys(TYPE_CHART_OFF);

  /* ─── Legendary/UB IDs (hardcoded to avoid species API calls) ─── */

  const LEGENDARY_IDS = new Set([
    144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
    480,481,482,483,484,485,486,487,488,489,490,491,492,493,
    494,638,639,640,641,642,643,644,645,646,647,648,649,
    716,717,718,719,720,721,785,786,787,788,789,790,791,792,
    800,801,802,807,808,809,
    888,889,890,891,892,893,894,895,896,897,898,899,900,901,902,903,904,905,
    1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1020,1021,1022,1023,1024,1025
  ]);

  const ULTRA_BEAST_IDS = new Set([793,794,795,796,797,798,799,803,804,805,806,895,896,897,898,899]);

  const PARADOX_IDS = new Set([
    984,985,986,987,988,989,990,991,992,993,994,995,996,997,998,999,1000,
    1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016,1017,1018,1019,
    1020,1021,1022,1023,1024,1025
  ]);

  function obterGeracao(id) {
    if (id <= 151) return 1;
    if (id <= 251) return 2;
    if (id <= 386) return 3;
    if (id <= 493) return 4;
    if (id <= 649) return 5;
    if (id <= 721) return 6;
    if (id <= 809) return 7;
    if (id <= 905) return 8;
    return 9;
  }

  /* ─── Data Layer — carregamento incremental eficiente ─── */

  const DB = {
    ready: false,
    loading: false,
    pokemons: [],
    progress: 0,
    callbacks: []
  };

  const CACHE_KEY = "tb-pokemon-db-v2";

  function salvarCache() {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(DB.pokemons));
    } catch(e) { /* quota exceeded, ignore */ }
  }

  function carregarCache() {
    try {
      const data = sessionStorage.getItem(CACHE_KEY);
      if (data) {
        DB.pokemons = JSON.parse(data);
        if (Array.isArray(DB.pokemons) && DB.pokemons.length > 800) {
          DB.ready = true;
          return true;
        }
      }
    } catch(e) { /* ignore */ }
    return false;
  }

  async function carregarBase() {
    if (DB.ready) return;
    if (carregarCache()) return;

    if (DB.loading) {
      return new Promise(resolve => DB.callbacks.push(resolve));
    }
    DB.loading = true;

    // Get pokemon list
    let list;
    if (window.listaPokemons && window.listaPokemons.length) {
      list = window.listaPokemons;
    } else {
      try {
        const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1000");
        const data = await res.json();
        list = data.results;
      } catch {
        DB.loading = false;
        return;
      }
    }

    // Batch-fetch pokemon basic data (types + stats) — the /pokemon/{id} endpoint gives us everything except species info
    const BATCH = 30;
    const total = list.length;
    const all = [];
    const fetchQueue = [];

    for (let i = 0; i < total; i++) {
      const name = list[i].name;
      const id = i + 1;
      fetchQueue.push({ name, id, idx: i });
    }

    // Process in batches with concurrency control
    for (let start = 0; start < fetchQueue.length; start += BATCH) {
      const batch = fetchQueue.slice(start, start + BATCH);
      const promises = batch.map(async (item) => {
        try {
          const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${item.id}`);
          if (!res.ok) throw new Error('fail');
          const data = await res.json();

          const stats = {
            hp: data.stats.find(s => s.stat.name === "hp")?.base_stat || 50,
            atk: data.stats.find(s => s.stat.name === "attack")?.base_stat || 50,
            def: data.stats.find(s => s.stat.name === "defense")?.base_stat || 50,
            spA: data.stats.find(s => s.stat.name === "special-attack")?.base_stat || 50,
            spD: data.stats.find(s => s.stat.name === "special-defense")?.base_stat || 50,
            spe: data.stats.find(s => s.stat.name === "speed")?.base_stat || 50
          };
          const bst = stats.hp + stats.atk + stats.def + stats.spA + stats.spD + stats.spe;
          const types = data.types.map(t => t.type.name);
          const isMega = item.name.includes("-mega");

          return {
            name: data.name,
            id: data.id,
            types,
            stats,
            bst,
            generation: obterGeracao(data.id),
            isLegendary: LEGENDARY_IDS.has(data.id),
            isUltraBeast: ULTRA_BEAST_IDS.has(data.id),
            isParadox: PARADOX_IDS.has(data.id),
            isMega,
            isGmax: item.name.includes("-gmax")
          };
        } catch {
          // Minimal entry for failed fetches
          return {
            name: item.name,
            id: item.id,
            types: ["normal"],
            stats: { hp: 50, atk: 50, def: 50, spA: 50, spD: 50, spe: 50 },
            bst: 300,
            generation: obterGeracao(item.id),
            isLegendary: false,
            isUltraBeast: false,
            isParadox: false,
            isMega: false,
            isGmax: false
          };
        }
      });

      const results = await Promise.all(promises);
      results.forEach(r => { if (r) all.push(r); });
      DB.progress = Math.round((start + batch.length) / total * 100);
    }

    // Sort by id and remove duplicates (prefer non-form variants)
    const seen = new Map();
    all.forEach(p => {
      const key = p.name.split("-")[0];
      if (!seen.has(key) || !p.name.includes("-")) {
        seen.set(key, p);
      }
      // Keep both if it's a special form OR the base
      if (!seen.has(p.name) || !p.name.includes("-")) {
        seen.set(p.name, p);
      }
    });

    DB.pokemons = Array.from(seen.values()).sort((a, b) => a.id - b.id);
    DB.ready = true;
    DB.loading = false;
    salvarCache();
    DB.callbacks.forEach(cb => cb());
    DB.callbacks = [];
  }

  /* ─── Filtros ─── */

  function filtrarPool(config) {
    let pool = [...DB.pokemons];

    if (config.geracao && config.geracao !== "todas") {
      const gens = config.geracao.split(",").map(Number);
      pool = pool.filter(p => gens.includes(p.generation));
    }

    if (!config.lendarios) {
      pool = pool.filter(p => !p.isLegendary);
    }

    if (!config.mega) {
      pool = pool.filter(p => !p.isMega);
    }

    if (!config.paradox) {
      pool = pool.filter(p => !p.isParadox);
    }

    if (!config.ultraBeasts) {
      pool = pool.filter(p => !p.isUltraBeast);
    }

    if (config.monotypeTipo) {
      pool = pool.filter(p => p.types.includes(config.monotypeTipo));
    }

    // Remove Gmax forms (redundant)
    pool = pool.filter(p => !p.isGmax);

    // Deduplicate by base name
    const seen = new Set();
    pool = pool.filter(p => {
      const base = p.name.split("-")[0];
      if (seen.has(base) && p.name.includes("-")) return false;
      seen.add(base);
      return true;
    });

    return pool;
  }

  /* ─── Role Classification ─── */

  function classificarRole(stats) {
    const { hp, atk, def, spA, spD, spe } = stats;
    const bulk = hp + def + spD;

    if (hp >= 90 && def >= 80 && spD >= 80 && atk < 100 && spA < 100)
      return { role: "Tank", label: "🛡️ Tank" };
    if (def >= 95 && hp >= 80 && spe < 90)
      return { role: "Physical Wall", label: "🧱 Muro Físico" };
    if (spD >= 95 && hp >= 80 && spe < 90)
      return { role: "Special Wall", label: "🧱 Muro Especial" };
    if (atk >= 100 && spA >= 90 && spe >= 80)
      return { role: "Mixed Sweeper", label: "⚡ Sweeper Misto" };
    if (atk >= 100 && spe >= 80)
      return { role: "Physical Sweeper", label: "⚔️ Sweeper Físico" };
    if (spA >= 100 && spe >= 80)
      return { role: "Special Sweeper", label: "✨ Sweeper Especial" };
    if (hp >= 80 && bulk >= 220 && atk < 100 && spA < 100)
      return { role: "Support", label: "🔰 Suporte" };
    if (bulk >= 200 && spe >= 70 && spe < 110)
      return { role: "Pivot", label: "🔄 Pivot" };

    const max = Math.max(atk, spA, def, spD, spe);
    if (max === atk && atk >= 80) return { role: "Physical Attacker", label: "⚔️ Atacante Físico" };
    if (max === spA && spA >= 80) return { role: "Special Attacker", label: "✨ Atacante Especial" };
    if (max === spe && spe >= 80) return { role: "Speedster", label: "💨 Veloz" };

    return { role: "Balanced", label: "⚖️ Balanceado" };
  }

  /* ─── Cobertura Ofensiva ─── */

  function calcularCobertura(tipos) {
    const s = new Set();
    tipos.forEach(t => (TYPE_CHART_OFF[t] || []).forEach(a => s.add(a)));
    return s;
  }

  function coberturaCombinada(team) {
    const s = new Set();
    team.forEach(p => (p.types || []).forEach(t => (TYPE_CHART_OFF[t] || []).forEach(a => s.add(a))));
    return s;
  }

  /* ─── Cobertura Defensiva ─── */

  function fraquezas(tipos) {
    const f = {};
    tipos.forEach(t => (TYPE_CHART_WEAK[t] || []).forEach(w => { f[w] = (f[w] || 0) + 1; }));
    return f;
  }

  function resistencias(tipos) {
    const r = {};
    tipos.forEach(t => (TYPE_CHART_RES[t] || []).forEach(res => { r[res] = (r[res] || 0) + 1; }));
    return r;
  }

  function fraquezasTime(team) {
    const f = {};
    team.forEach(p => {
      Object.entries(fraquezas(p.types || [])).forEach(([t, n]) => { f[t] = (f[t] || 0) + n; });
    });
    return f;
  }

  function resistenciasTime(team) {
    const r = {};
    team.forEach(p => {
      Object.entries(resistencias(p.types || [])).forEach(([t, n]) => { r[t] = (r[t] || 0) + n; });
    });
    return r;
  }

  /* ─── Scoring Engine ─── */

  function statScore(stats, w) {
    let s = 0;
    Object.keys(w).forEach(k => { s += ((stats[k] || 50) / 255) * (w[k] || 1) * 25; });
    return s;
  }

  function coverageBonus(p, team) {
    if (team.length === 0) return 5;
    const newCov = calcularCobertura(p.types || []);
    const existing = coberturaCombinada(team);
    let fresh = 0;
    newCov.forEach(t => { if (!existing.has(t)) fresh++; });
    return fresh * 6;
  }

  function weaknessPenalty(p, team) {
    if (team.length === 0) return 0;
    const teamWeak = fraquezasTime(team);
    const pokeWeak = fraquezas(p.types || []);
    const teamRes = resistenciasTime(team);
    let pen = 0;
    Object.entries(pokeWeak).forEach(([t, n]) => {
      const existing = teamWeak[t] || 0;
      if (existing > 1) pen += n * 3;
      if (teamRes[t]) pen -= Math.min(teamRes[t], n) * 2;
    });
    return Math.max(0, pen * 1.5);
  }

  function defensiveSynergy(p, team) {
    if (team.length === 0) return 10;
    const teamWeak = fraquezasTime(team);
    const pokeRes = resistencias(p.types || []);
    let syn = 0;
    Object.entries(teamWeak).forEach(([t, n]) => {
      if (pokeRes[t]) syn += (pokeRes[t] || 0) * 5;
    });
    const newWeak = fraquezas(p.types || []);
    Object.entries(newWeak).forEach(([t, n]) => {
      if ((teamWeak[t] || 0) >= 2) syn -= 4;
    });
    return syn;
  }

  function speedBalance(p, team) {
    if (team.length === 0) return 5;
    const avg = team.reduce((s, p) => s + p.stats.spe, 0) / team.length;
    return Math.min(10, Math.abs(p.stats.spe - avg) / 20);
  }

  function atkSpdBalance(p, team) {
    if (team.length === 0) return 5;
    const phys = team.filter(p => p.stats.atk > p.stats.spA).length;
    const spec = team.filter(p => p.stats.spA >= p.stats.atk).length;
    const isPhys = p.stats.atk > p.stats.spA;
    if (isPhys && spec > phys) return 8;
    if (!isPhys && phys > spec) return 8;
    return 3;
  }

  /* ─── Build Strategies ─── */

  const STRATEGIES = {
    balanceada: {
      label: "Balanceada",
      desc: "Equipe versátil com equilíbrio entre ataque, defesa e suporte.",
      w: { hp:1.0, atk:1.0, def:1.0, spA:1.0, spD:1.0, spe:0.9 },
      roleW: { "Tank":2, "Physical Wall":1, "Special Wall":1, "Support":2, "Physical Sweeper":2, "Special Sweeper":2, "Mixed Sweeper":1 },
      covW: 1.2, defW: 1.0, spdW: 0.8
    },
    ofensiva: {
      label: "Ofensiva",
      desc: "Foco em ataque e velocidade.",
      w: { hp:0.6, atk:1.4, def:0.5, spA:1.4, spD:0.5, spe:1.3 },
      roleW: { "Physical Sweeper":3, "Special Sweeper":3, "Mixed Sweeper":2, "Tank":0, "Physical Wall":0, "Special Wall":0 },
      covW: 1.5, defW: 0.4, spdW: 1.2
    },
    defensiva: {
      label: "Defensiva",
      desc: "Prioriza resistência e bulk.",
      w: { hp:1.3, atk:0.6, def:1.4, spA:0.6, spD:1.4, spe:0.4 },
      roleW: { "Tank":3, "Physical Wall":2, "Special Wall":2, "Support":1, "Physical Sweeper":0, "Special Sweeper":0, "Mixed Sweeper":0 },
      covW: 0.7, defW: 1.6, spdW: 0.3
    },
    suporte: {
      label: "Suporte",
      desc: "Equipe com foco em suporte e utilidade.",
      w: { hp:1.2, atk:0.6, def:1.1, spA:0.7, spD:1.2, spe:0.7 },
      roleW: { "Support":3, "Tank":2, "Physical Wall":1, "Special Wall":1, "Pivot":2, "Utility":2 },
      covW: 0.6, defW: 1.3, spdW: 0.5
    },
    "hyper-offense": {
      label: "Hyper Offense",
      desc: "Máximo poder ofensivo.",
      w: { hp:0.4, atk:1.5, def:0.3, spA:1.5, spD:0.3, spe:1.5 },
      roleW: { "Physical Sweeper":4, "Special Sweeper":3, "Mixed Sweeper":3, "Tank":0, "Physical Wall":0, "Special Wall":0, "Support":0 },
      covW: 1.8, defW: 0.2, spdW: 1.5
    },
    stall: {
      label: "Stall",
      desc: "Defesa extrema. Desgasta o oponente.",
      w: { hp:1.5, atk:0.3, def:1.5, spA:0.3, spD:1.5, spe:0.2 },
      roleW: { "Tank":3, "Physical Wall":2, "Special Wall":2, "Support":2, "Pivot":1, "Physical Sweeper":0, "Special Sweeper":0, "Mixed Sweeper":0 },
      covW: 0.3, defW: 2.0, spdW: 0.2
    },
    "aleatoria-inteligente": {
      label: "Aleatória Inteligente",
      desc: "Combinação aleatória mas coerente.",
      w: null, roleW: null, covW: null, defW: null, spdW: null
    }
  };

  /* ─── Explanation Engine ─── */

  function gerarExplicacao(pokemon, team, idx, strategy) {
    const f = [];
    const role = classificarRole(pokemon.stats);
    f.push(`Atua como ${role.label.toLowerCase()} na equipe.`);

    if (team.length > 1) {
      const existing = coberturaCombinada(team.filter((_, i) => i !== idx));
      const fresh = [];
      calcularCobertura(pokemon.types || []).forEach(t => { if (!existing.has(t)) fresh.push(t); });
      if (fresh.length > 0) f.push(`Oferece cobertura contra tipos ${fresh.map(capitalizar).join(", ")}.`);

      const cov = [];
      Object.entries(fraquezasTime(team.filter((_, i) => i !== idx))).forEach(([t]) => {
        if (resistencias(pokemon.types || [])[t]) cov.push(t);
      });
      if (cov.length > 0) f.push(`Resiste a ${cov.map(capitalizar).join(", ")}, cobrindo fraquezas do time.`);
    }

    const { stats } = pokemon;
    const high = [];
    if (stats.hp >= 90) high.push(`HP ${stats.hp}`);
    if (stats.atk >= 110) high.push(`Ataque ${stats.atk}`);
    if (stats.spA >= 110) high.push(`Ataque Esp. ${stats.spA}`);
    if (stats.def >= 100) high.push(`Defesa ${stats.def}`);
    if (stats.spD >= 100) high.push(`Defesa Esp. ${stats.spD}`);
    if (stats.spe >= 110) high.push(`Velocidade ${stats.spe}`);
    if (high.length > 0) {
      const prefix = (strategy === "ofensiva" || strategy === "hyper-offense") ? "Excelente poder ofensivo" :
                     (strategy === "defensiva" || strategy === "stall") ? "Excelente capacidade defensiva" :
                     "Stats de destaque";
      f.push(`${prefix}: ${high.join(", ")}.`);
    }

    return f.join(" ");
  }

  /* ─── Team Generation ─── */

  function gerarTime(buildType, config) {
    if (!DB.ready || DB.pokemons.length === 0) return null;

    let pool = filtrarPool(config);
    if (pool.length < config.quantidade) {
      // Relax to full DB if filtered pool too small
      if (config.monotypeTipo) {
        pool = DB.pokemons.filter(p => p.types.includes(config.monotypeTipo));
      } else {
        pool = [...DB.pokemons];
      }
    }
    if (pool.length < config.quantidade) return null;

    // Resolve strategy
    let strategy;
    if (buildType === "aleatoria-inteligente") {
      const rw = () => 0.3 + Math.random() * 1.7;
      strategy = {
        w: { hp:rw(), atk:rw(), def:rw(), spA:rw(), spD:rw(), spe:rw() },
        roleW: null, covW: 0.5 + Math.random() * 1.5, defW: 0.5 + Math.random() * 1.5, spdW: 0.3 + Math.random() * 1.2
      };
    } else if (buildType === "monotype") {
      strategy = STRATEGIES.balanceada;
    } else {
      strategy = STRATEGIES[buildType] || STRATEGIES.balanceada;
    }

    const { w: weights, roleW: roleWeights, covW, defW, spdW } = strategy;

    // Shuffle for variety (monotype keeps natural order)
    if (buildType !== "monotype") pool.sort(() => Math.random() - 0.5);

    const team = [];
    const used = new Set();

    for (let slot = 0; slot < config.quantidade; slot++) {
      let best = null, bestScore = -Infinity;

      for (const p of pool) {
        if (used.has(p.name) || used.has(p.name.split("-")[0])) continue;

        let s = 0;

        // Stat score
        if (weights) s += statScore(p.stats, weights) * 1.5;
        else s += (p.bst / 255) * 15;

        // Role preferences
        if (roleWeights) {
          const role = classificarRole(p.stats).role;
          const target = roleWeights[role];
          if (target === 0) s -= 20;
          const count = team.filter(m => classificarRole(m.stats).role === role).length;
          if (target !== undefined && count < target) s += 12;
          else if (target !== undefined && count >= target) s += 2;
        }

        // Coverage
        s += coverageBonus(p, team) * (covW || 1);

        // Defensive synergy
        s += defensiveSynergy(p, team) * (defW || 1);
        s -= weaknessPenalty(p, team) * 0.5;

        // Speed balance
        s += speedBalance(p, team) * (spdW || 0.8);

        // Atk/SpA balance
        s += atkSpdBalance(p, team);

        // Small random noise
        s += Math.random() * 5;

        if (s > bestScore) { bestScore = s; best = { ...p, _score: Math.round(s) }; }
      }

      if (!best) break;
      used.add(best.name);
      used.add(best.name.split("-")[0]);
      team.push(best);
    }

    // Generate explanations
    const teamResult = team.map((p, i) => ({
      ...p,
      explanation: gerarExplicacao(p, team, i, buildType)
    }));

    // Team analysis
    const avgBST = Math.round(team.reduce((s, p) => s + p.bst, 0) / team.length);
    const avgSpe = Math.round(team.reduce((s, p) => s + p.stats.spe, 0) / team.length);
    const totalCov = coberturaCombinada(team).size;
    const teamFW = fraquezasTime(team);
    const teamFR = resistenciasTime(team);

    return {
      team: teamResult,
      analysis: {
        avgBST, avgSpe,
        totalCoverage: `${totalCov}/18`,
        weaknessCount: Object.keys(teamFW).length,
        resistanceCount: Object.keys(teamFR).length,
        roles: team.map(p => classificarRole(p.stats).label)
      }
    };
  }

  /* ─── UI ─── */

  function lerConfig() {
    return {
      quantidade: parseInt(document.getElementById("tb-qtd")?.value || "6", 10),
      geracao: document.getElementById("tb-geracao")?.value || "todas",
      formato: document.querySelector('input[name="tb-formato"]:checked')?.value || "singles",
      lendarios: document.getElementById("tb-lendarios")?.checked || false,
      mega: document.getElementById("tb-mega")?.checked || false,
      paradox: document.getElementById("tb-paradox")?.checked || false,
      ultraBeasts: document.getElementById("tb-ultraBeasts")?.checked || false,
      monotypeTipo: document.getElementById("tb-monotype-tipo")?.value || ""
    };
  }

  function renderizarConfig() {
    const tipos = ALL_TYPES.sort();
    return `
      <h2>⚡ Team Builder</h2>
      <div class="tb-config">
        <label>Tipo de Build
          <select id="tb-build-type">
            <option value="balanceada">Balanceada</option>
            <option value="ofensiva">Ofensiva</option>
            <option value="defensiva">Defensiva</option>
            <option value="suporte">Suporte</option>
            <option value="hyper-offense">Hyper Offense</option>
            <option value="stall">Stall</option>
            <option value="monotype">Monotype</option>
            <option value="aleatoria-inteligente">Aleatória Inteligente</option>
          </select>
        </label>
        <label>Quantidade
          <select id="tb-qtd">
            ${[2,3,4,5,6].map(n => `<option value="${n}" ${n===6?"selected":""}>${n} Pokémon</option>`).join("")}
          </select>
        </label>
        <label>Geração
          <select id="tb-geracao">
            <option value="todas">Todas</option>
            ${Array.from({length:9},(_,i)=>`<option value="${i+1}">Geração ${i+1}</option>`).join("")}
          </select>
        </label>
        <label id="tb-monotype-label" hidden>Tipo (Monotype)
          <select id="tb-monotype-tipo">
            ${tipos.map(t => `<option value="${t}">${capitalizar(t)}</option>`).join("")}
          </select>
        </label>
        <div class="tb-config-full"><div class="tb-checkboxes">
          <label><input type="checkbox" id="tb-lendarios"> Lendários</label>
          <label><input type="checkbox" id="tb-mega"> Mega Evoluções</label>
          <label><input type="checkbox" id="tb-paradox"> Paradox</label>
          <label><input type="checkbox" id="tb-ultraBeasts"> Ultra Beasts</label>
        </div></div>
        <div class="tb-config-full"><div class="tb-radio-group">
          <label><input type="radio" name="tb-formato" value="singles" checked> Singles</label>
          <label><input type="radio" name="tb-formato" value="doubles"> Doubles</label>
        </div></div>
        <div class="tb-config-full" style="text-align:center;">
          <button type="button" class="tb-build-btn" id="tb-gerar-btn">⚡ Gerar Time</button>
        </div>
      </div>
      <div id="tb-result">
        <div class="tb-idle">
          <span class="tb-idle-icon">⚙️</span>
          <p>Configure seu time ideal e clique em <strong>Gerar Time</strong>.</p>
          <p style="font-size:0.9rem;color:#5f838a;">
            O algoritmo considera tipos, stats, sinergia e cobertura para montar uma equipe coerente.
          </p>
        </div>
      </div>
    `;
  }

  function renderizarLoading() {
    return `<div class="tb-loading"><div class="tb-spinner"></div><p>Montando o time ideal...</p>
      ${!DB.ready ? '<p style="font-size:0.85rem;color:#5f838a;">Carregando dados dos Pokémon...</p>' : ""}</div>`;
  }

  function renderizarCard(p, idx) {
    const role = classificarRole(p.stats);
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
    const typesHtml = p.types.map(t => `<span class="tb-type-badge ${t}">${capitalizar(t)}</span>`).join("");
    const delay = `${idx * 0.05}s`;

    return `<div class="tb-card" style="animation-delay:${delay}">
      <img class="tb-card-sprite" src="${spriteUrl}" alt="${escapar(p.name)}" loading="lazy" decoding="async">
      <div class="tb-card-name">${capitalizar(p.name)}</div>
      <div class="tb-card-types">${typesHtml}</div>
      <div class="tb-card-role">${role.label}</div>
      <div class="tb-card-stats">
        <span class="tb-card-stat">❤️ <strong>${p.stats.hp}</strong></span>
        <span class="tb-card-stat">⚔️ <strong>${p.stats.atk}</strong></span>
        <span class="tb-card-stat">🛡️ <strong>${p.stats.def}</strong></span>
        <span class="tb-card-stat">✨ <strong>${p.stats.spA}</strong></span>
        <span class="tb-card-stat">🔰 <strong>${p.stats.spD}</strong></span>
        <span class="tb-card-stat">💨 <strong>${p.stats.spe}</strong></span>
      </div>
      <div class="tb-card-reason">${escapar(p.explanation)}</div>
    </div>`;
  }

  function renderizarResultado(result) {
    if (!result || !result.team || result.team.length === 0) {
      return `<div class="tb-empty"><p>Nenhum Pokémon encontrado com os filtros atuais.</p></div>`;
    }
    const { team, analysis } = result;
    const cardsHtml = team.map((p, i) => renderizarCard(p, i)).join("");
    const analysisHtml = analysis ? `<div class="tb-analysis">
      <div class="tb-analysis-item"><span>BST Médio:</span> ${analysis.avgBST}</div>
      <div class="tb-analysis-item"><span>Vel. Média:</span> ${analysis.avgSpe}</div>
      <div class="tb-analysis-item"><span>Cobertura:</span> ${analysis.totalCoverage}</div>
      <div class="tb-analysis-item"><span>Funções:</span> ${[...new Set(analysis.roles)].join(", ")}</div>
    </div>` : "";
    return analysisHtml + `<div class="tb-team-grid">${cardsHtml}</div>`;
  }

  async function handleGerar() {
    const resultDiv = document.getElementById("tb-result");
    const btn = document.getElementById("tb-gerar-btn");
    if (!resultDiv) return;

    resultDiv.innerHTML = renderizarLoading();
    if (btn) btn.disabled = true;

    try {
      if (!DB.ready) {
        await carregarBase();
      }

      const config = lerConfig();
      const buildType = document.getElementById("tb-build-type")?.value || "balanceada";

      if (buildType === "monotype") {
        const tipo = document.getElementById("tb-monotype-tipo")?.value;
        if (!tipo) {
          resultDiv.innerHTML = `<div class="tb-error"><p>❌ Selecione um tipo para Monotype.</p></div>`;
          if (btn) btn.disabled = false;
          return;
        }
        config.monotypeTipo = tipo;
      }

      const result = gerarTime(buildType, config);
      resultDiv.innerHTML = renderizarResultado(result);
    } catch (err) {
      resultDiv.innerHTML = `<div class="tb-error"><p>❌ Erro ao gerar o time. Tente novamente.</p></div>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ─── Init ─── */

  function init() {
    const c = document.getElementById("teamBuilderContainer");
    if (!c || c.hasChildNodes() && c.innerHTML.trim() !== "") return;

    c.innerHTML = renderizarConfig();

    const buildTypeSelect = document.getElementById("tb-build-type");
    const monotypeLabel = document.getElementById("tb-monotype-label");
    if (buildTypeSelect && monotypeLabel) {
      buildTypeSelect.addEventListener("change", () => {
        monotypeLabel.hidden = buildTypeSelect.value !== "monotype";
      });
    }

    document.getElementById("tb-gerar-btn")?.addEventListener("click", handleGerar);

    // Start loading DB in background
    carregarBase();
  }

  function mostrar() {
    const c = document.getElementById("teamBuilderContainer");
    if (!c) return;
    c.hidden = false;
    if (!c.hasChildNodes() || c.innerHTML.trim() === "") init();
  }

  window.TeamBuilder = {
    init, mostrar, carregarBase, gerarTime,
    DB,
    TYPE_CHART_OFF, TYPE_CHART_RES, TYPE_CHART_WEAK, ALL_TYPES,
    classificarRole,
    fraquezasTime, resistenciasTime,
    coberturaCombinada, calcularCobertura,
    capitalizar, escapar
  };
  return window.TeamBuilder;
})();
