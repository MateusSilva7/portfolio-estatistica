/* Giro Reverso — demonstração estática. Dados: dados.js (ERP sintético exportado do app em Python). Regra: regra.js. */
(function () {
  "use strict";
  var D = window.GR_DADOS, R = window.GRRegra;
  var LOJAS = D.lojas, CODIGOS = Object.keys(LOJAS);
  var NIVEIS = [0.80, 0.90, 0.95, 0.98, 0.99], COBERTURAS = [15, 30, 45, 60, 90];
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var CHAVE = "giro-reverso-demo";
  var tela = document.getElementById("tela"), dlg = document.getElementById("ficha");
  var graficos = [];

  // ── estado ──────────────────────────────────────────────────────────────
  var est = { params: Object.assign({}, D.padrao), loja: CODIGOS[0], motivo: "Toda a lista", origem: "", busca: "", pagina: 0, lojaSens: "" };
  try { var salvo = JSON.parse(localStorage.getItem(CHAVE) || "null"); if (salvo && salvo.params) Object.assign(est.params, salvo.params); } catch (e) { /* sem armazenamento: segue com o padrão */ }
  function guardar() { try { localStorage.setItem(CHAVE, JSON.stringify({ params: est.params })); } catch (e) { /* ignora */ } }

  var prep = R.preparar(D.itens, D.padrao.alfa), res = [], porLoja = {};
  function recalcular() {
    res = R.calcular(prep, est.params);
    porLoja = {};
    CODIGOS.forEach(function (c) { porLoja[c] = []; });
    res.forEach(function (r) { (porLoja[r.it.l] = porLoja[r.it.l] || []).push(r); });
  }
  recalcular();

  // ── formatação ──────────────────────────────────────────────────────────
  function num(v, c) { if (v == null || !isFinite(v)) return "—"; return v.toLocaleString("pt-BR", { minimumFractionDigits: c || 0, maximumFractionDigits: c || 0 }); }
  function moeda(v) { return "R$ " + num(v, 2); }
  function mil(v) { return v >= 1e6 ? "R$ " + num(v / 1e6, 2) + " mi" : "R$ " + num(v / 1e3, 0) + " mil"; }
  function pct(a, b) { return b ? num(a / b * 100, 1) + "%" : "—"; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  function cor(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }
  function soma(lista, f) { return lista.reduce(function (s, x) { return s + f(x); }, 0); }
  function origemTipo(o) { return !o ? "Compra direta" : o.split("—")[0].trim(); }
  function rotulosMeses() {
    var g = new Date(D.gerado_em + "T12:00:00"), out = [];
    for (var k = 11; k >= 0; k--) { var d = new Date(g.getFullYear(), g.getMonth() - k, 1); out.push(MESES[d.getMonth()] + "/" + String(d.getFullYear()).slice(2)); }
    return out;
  }

  function metricas(lista, cd) {
    var volta = lista.filter(function (r) { return r.volta; });
    var cmv = cd ? D.cmv[cd] : soma(CODIGOS, function (c) { return D.cmv[c]; });
    var ve = soma(lista, function (r) { return r.valorEstoque; }), vr = soma(volta, function (r) { return r.valorRetirar; });
    return { skus: lista.length, skusLista: volta.length, pecas: soma(lista, function (r) { return r.it.e; }),
             pecasRetirar: soma(volta, function (r) { return r.retirar; }), valorEstoque: ve, valorRetirar: vr, cmv: cmv,
             dias: cmv ? ve / cmv * 30 : null, diasDepois: cmv ? (ve - vr) / cmv * 30 : null };
  }

  // ── gráficos (Chart.js) ─────────────────────────────────────────────────
  function limparGraficos() { graficos.forEach(function (g) { g.destroy(); }); graficos = []; }
  function baseOpcoes(extra) {
    var tinta = cor("--ink-2"), grade = cor("--line");
    Chart.defaults.font.family = "'Source Sans 3', system-ui, sans-serif";
    Chart.defaults.color = tinta;
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: {} } },
      scales: { x: { grid: { display: false }, ticks: { color: tinta } },
                y: { grid: { color: grade }, border: { display: false }, ticks: { color: tinta, callback: function (v) { return num(v, 0); } } } },
    }, extra || {});
  }
  function barras(canvas, rotulos, valores, opc) {
    opc = opc || {};
    var horizontal = !!opc.horizontal, o = baseOpcoes({ indexAxis: horizontal ? "y" : "x" });
    if (horizontal) {
      o.scales = { y: { grid: { display: false }, ticks: { color: cor("--ink-2") } },
                   x: { grid: { color: cor("--line") }, border: { display: false }, ticks: { color: cor("--ink-2"), callback: function (v) { return num(v, 0); } } } };
    }
    o.plugins.tooltip.callbacks.label = function (c) { return (opc.rotulo || "") + (opc.moeda ? moeda(c.parsed[horizontal ? "x" : "y"]) : num(c.parsed[horizontal ? "x" : "y"], opc.casas || 0)); };
    var conj = [{ type: "bar", label: opc.rotulo || "", data: valores, backgroundColor: cor("--brand"), borderRadius: 4, borderSkipped: "start", maxBarThickness: 46, order: 2 }];
    if (opc.linha != null) {
      conj.push({ type: "line", label: opc.rotuloLinha, data: valores.map(function () { return opc.linha; }), borderColor: cor("--s2"), borderWidth: 2, pointRadius: 0, order: 1 });
      o.plugins.legend = { display: true, position: "bottom", labels: { boxWidth: 12, color: cor("--ink-2") } };
      o.plugins.tooltip.callbacks.label = function (c) { return c.dataset.label + ": " + num(c.parsed.y, 1); };
    }
    graficos.push(new Chart(canvas, { data: { labels: rotulos, datasets: conj }, options: o }));
  }

  // ── navegação ───────────────────────────────────────────────────────────
  var TELAS = { gestao: telaGestao, lista: telaLista, sensibilidade: telaSensibilidade, perfil: telaPerfil, acompanhamento: telaAcompanhamento, regra: telaRegra };
  function rota() {
    var nome = (location.hash || "#gestao").slice(1);
    if (!TELAS[nome]) nome = "gestao";
    document.querySelectorAll("#menu a").forEach(function (a) { a.classList.toggle("ativo", a.getAttribute("href") === "#" + nome); if (a.classList.contains("ativo")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    limparGraficos();
    TELAS[nome]();
    tela.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", rota);

  function seletorLoja(id, valor, comRede) {
    return '<div class="controle"><label for="' + id + '">Loja</label><select id="' + id + '">' +
      (comRede ? '<option value="">Rede inteira</option>' : "") +
      CODIGOS.map(function (c) { return '<option value="' + c + '"' + (c === valor ? " selected" : "") + ">" + esc(LOJAS[c]) + "</option>"; }).join("") + "</select></div>";
  }
  function kpi(rot, val, sub) { return '<div class="kpi"><div class="rot">' + rot + '</div><div class="val">' + val + "</div>" + (sub ? '<div class="sub">' + sub + "</div>" : "") + "</div>"; }
  function faixaDemo() { return '<div class="faixa-demo" role="note">Demonstração estática com dados sintéticos: a regra roda no navegador. O app completo em Python/Streamlit (ciclo diário, vínculo de pedidos no ERP, perfis de acesso) está no repositório.</div>'; }

  // ── Visão de gestão ─────────────────────────────────────────────────────
  function telaGestao() {
    var p = est.params;
    tela.innerHTML = '<h1>Visão de gestão</h1><p class="lead">Quanto volta das lojas para o CD com a regra em vigor, e o quanto isso reduz os dias de estoque da rede. Ajuste os parâmetros: tudo é recalculado na hora.</p>' + faixaDemo() +
      '<h2>Parâmetros da regra</h2><div class="painel"><div class="controles">' +
      '<div class="controle"><label for="p-ns">Nível de serviço: <output id="o-ns">' + num(p.nivel_servico * 100, 0) + '%</output></label><input id="p-ns" type="range" min="80" max="99" step="1" value="' + Math.round(p.nivel_servico * 100) + '"></div>' +
      '<div class="controle"><label for="p-cob">Cobertura-alvo: <output id="o-cob">' + p.cobertura_dias + ' dias</output></label><input id="p-cob" type="range" min="0" max="120" step="5" value="' + p.cobertura_dias + '"></div>' +
      '<div class="controle"><label for="p-min">Valor mínimo por item: <output id="o-min">' + moeda(p.valor_minimo) + '</output></label><input id="p-min" type="range" min="0" max="200" step="5" value="' + p.valor_minimo + '"></div>' +
      '<div class="controle"><button class="chip" id="p-padrao" type="button">Voltar ao padrão (95% · 30 dias · R$ 20)</button></div>' +
      '</div><p class="legenda">Nível de serviço: probabilidade de a loja não ficar sem o item até a próxima reposição. Cobertura: dias de venda que a loja mantém além do prazo de reposição.</p></div>' +
      '<div id="res-gestao"></div>';
    function ligar(id, saida, chave, conv, fmt) {
      document.getElementById(id).addEventListener("input", function (ev) {
        est.params[chave] = conv(ev.target.value);
        document.getElementById(saida).textContent = fmt(est.params[chave]);
        recalcular(); guardar(); resultadoGestao();
      });
    }
    ligar("p-ns", "o-ns", "nivel_servico", function (v) { return Number(v) / 100; }, function (v) { return num(v * 100, 0) + "%"; });
    ligar("p-cob", "o-cob", "cobertura_dias", Number, function (v) { return v + " dias"; });
    ligar("p-min", "o-min", "valor_minimo", Number, moeda);
    document.getElementById("p-padrao").addEventListener("click", function () { est.params = Object.assign({}, D.padrao); recalcular(); guardar(); rota(); });
    resultadoGestao();
  }
  function resultadoGestao() {
    limparGraficos();
    var m = metricas(res), linhas = CODIGOS.map(function (c) { return [c, metricas(porLoja[c], c)]; });
    var pedidos = estadoPedidos(), andamento = pedidos.filter(function (x) { return !x.concluido; });
    document.getElementById("res-gestao").innerHTML =
      '<h2>Rede</h2><div class="kpis">' +
      kpi("Itens a retirar", num(m.skusLista), pct(m.skusLista, m.skus) + " dos itens") +
      kpi("Peças a retirar", num(m.pecasRetirar)) +
      kpi("Valor a retirar", mil(m.valorRetirar), pct(m.valorRetirar, m.valorEstoque) + " do estoque") +
      kpi("Dias de estoque", num(m.dias), "→ " + num(m.diasDepois) + " depois da devolução") + "</div>" +
      '<div class="tabela-wrap"><table><thead><tr><th>Loja</th><th class="n">Itens</th><th class="n">Itens a retirar</th><th class="n">Peças a retirar</th><th class="n">Valor a retirar</th><th class="n">Dias de estoque</th><th class="n">Depois</th></tr></thead><tbody>' +
      linhas.map(function (l) { var x = l[1]; return "<tr><td>" + esc(LOJAS[l[0]]) + '</td><td class="n">' + num(x.skus) + '</td><td class="n">' + num(x.skusLista) + '</td><td class="n">' + num(x.pecasRetirar) + '</td><td class="n">' + moeda(x.valorRetirar) + '</td><td class="n">' + num(x.dias) + '</td><td class="n">' + num(x.diasDepois) + "</td></tr>"; }).join("") +
      "</tbody></table></div><p class=\"legenda\">Dias de estoque = valor em estoque ÷ CMV do mês × 30.</p>" +
      '<h2>Valor a retirar por loja</h2><div class="graf"><canvas id="g-lojas" aria-label="Valor a retirar por loja"></canvas></div>' +
      '<h2>Pedidos de devolução</h2><div class="kpis">' +
      kpi("Em andamento", num(andamento.length)) +
      kpi("Em atenção", num(andamento.filter(function (x) { return x.atencao; }).length), "parados há mais de " + D.limite_alerta_h + " h") +
      kpi("Concluídos", num(pedidos.length - andamento.length), "meta: até " + D.meta_ciclo_dias + " dias") +
      "</div><p class=\"legenda\">Os pedidos são exemplos fixos. Veja o quadro em <a href=\"#acompanhamento\">Acompanhamento</a>.</p>";
    barras(document.getElementById("g-lojas"), linhas.map(function (l) { return LOJAS[l[0]]; }), linhas.map(function (l) { return l[1].valorRetirar; }), { moeda: true });
  }

  // ── Lista diária ────────────────────────────────────────────────────────
  var POR_PAGINA = 40;
  function telaLista() {
    var motivos = ["Toda a lista"].concat(R.MOTIVOS);
    tela.innerHTML = '<h1>Lista diária</h1><p class="lead">O que volta ao CD em cada loja com a regra em vigor. Clique num item para ver a conta da regra e o histórico de vendas.</p>' +
      '<div class="painel"><div class="controles">' + seletorLoja("f-loja", est.loja) +
      '<div class="controle"><label for="f-origem">Origem</label><select id="f-origem"><option value="">Todas</option><option>CD</option><option>Transferência</option><option>Compra direta</option></select></div>' +
      '<div class="controle" style="flex:1"><label for="f-busca">Buscar SKU, referência, descrição ou fabricante</label><input id="f-busca" type="search" placeholder="Ex.: amortecedor hatch" value="' + esc(est.busca) + '"></div></div>' +
      '<div class="chips" style="margin-top:12px" role="group" aria-label="Motivo">' + motivos.map(function (m) { return '<button type="button" class="chip" data-motivo="' + esc(m) + '" aria-pressed="' + (m === est.motivo) + '">' + esc(m) + "</button>"; }).join("") + "</div></div>" +
      '<div id="res-lista"></div>';
    document.getElementById("f-origem").value = est.origem;
    document.getElementById("f-loja").addEventListener("change", function (e) { est.loja = e.target.value; est.pagina = 0; resultadoLista(); });
    document.getElementById("f-origem").addEventListener("change", function (e) { est.origem = e.target.value; est.pagina = 0; resultadoLista(); });
    document.getElementById("f-busca").addEventListener("input", function (e) { est.busca = e.target.value; est.pagina = 0; resultadoLista(); });
    tela.querySelectorAll("[data-motivo]").forEach(function (b) {
      b.addEventListener("click", function () { est.motivo = b.dataset.motivo; est.pagina = 0; tela.querySelectorAll("[data-motivo]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); resultadoLista(); });
    });
    resultadoLista();
  }
  function filtrada() {
    var termos = est.busca.trim().toUpperCase().split(/\s+/).filter(Boolean);
    return porLoja[est.loja].filter(function (r) {
      if (!r.volta) return false;
      if (est.motivo !== "Toda a lista" && r.motivo !== est.motivo) return false;
      if (est.origem && origemTipo(r.it.o) !== est.origem) return false;
      if (termos.length) { var alvo = (r.it.s + " " + r.it.r + " " + r.it.d + " " + r.it.f + " " + r.it.a).toUpperCase(); return termos.every(function (t) { return alvo.indexOf(t) >= 0; }); }
      return true;
    }).sort(function (a, b) { return b.valorRetirar - a.valorRetirar; });
  }
  function resultadoLista() {
    var lista = filtrada(), paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    est.pagina = Math.min(est.pagina, paginas - 1);
    var pag = lista.slice(est.pagina * POR_PAGINA, (est.pagina + 1) * POR_PAGINA);
    document.getElementById("res-lista").innerHTML = '<div class="kpis">' + kpi("Itens", num(lista.length)) +
      kpi("Peças a retirar", num(soma(lista, function (r) { return r.retirar; }))) + kpi("Valor a retirar", moeda(soma(lista, function (r) { return r.valorRetirar; }))) + "</div>" +
      (lista.length ? '<div class="tabela-wrap"><table><thead><tr><th>SKU</th><th>Descrição</th><th>Fabricante</th><th class="n">Estoque</th><th class="n">Alvo</th><th class="n">A retirar</th><th class="n">Previsão/mês</th><th class="n">Cobertura (dias)</th><th>Motivo</th><th>Origem</th><th class="n">Valor a retirar</th></tr></thead><tbody>' +
        pag.map(function (r, i) { return '<tr class="clicavel" tabindex="0" data-i="' + i + '"><td class="mono">' + r.it.s + "</td><td>" + esc(r.it.d) + "</td><td>" + esc(r.it.f) + '</td><td class="n">' + num(r.it.e) + '</td><td class="n">' + num(r.alvo) + '</td><td class="n">' + num(r.retirar) + '</td><td class="n">' + num(r.previsao, 1) + '</td><td class="n">' + num(r.cobertura) + "</td><td>" + esc(r.motivo) + "</td><td>" + esc(r.it.o) + '</td><td class="n">' + moeda(r.valorRetirar) + "</td></tr>"; }).join("") +
        '</tbody></table></div><div class="pag"><button type="button" id="pg-ant"' + (est.pagina ? "" : " disabled") + '>← Anterior</button><span>Página ' + (est.pagina + 1) + " de " + paginas + '</span><button type="button" id="pg-prox"' + (est.pagina < paginas - 1 ? "" : " disabled") + ">Próxima →</button></div>"
        : '<p class="vazio">Nada na lista com esses filtros.</p>');
    document.querySelectorAll("#res-lista tr.clicavel").forEach(function (tr) {
      function abrir() { abrirFicha(pag[Number(tr.dataset.i)]); }
      tr.addEventListener("click", abrir);
      tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } });
    });
    var a = document.getElementById("pg-ant"), b = document.getElementById("pg-prox");
    if (a) a.addEventListener("click", function () { est.pagina--; resultadoLista(); });
    if (b) b.addEventListener("click", function () { est.pagina++; resultadoLista(); });
  }

  var DECISOES = { "retornar": "Volta ao CD", "nada a retirar": "Fica: o estoque não passa do alvo", "lançamento": "Fica: menos de 90 dias de loja",
                   "sazonal": "Fica: item sazonal", "em promoção": "Fica: item em promoção", "abaixo do valor mínimo": "Fica: valor a retirar abaixo do mínimo" };
  var graficoFicha = null;
  function abrirFicha(r) {
    var it = r.it, kv = [["Estoque na loja", num(it.e)], ["Previsão de venda/mês", num(r.previsao, 1)], ["Desvio-padrão/mês", num(r.sigma, 1)],
      ["Prazo de reposição", num(it.t) + " dias"], ["Estoque de segurança", num(r.es, 1)], ["Mínimo de exposição", num(it.x)],
      ["Múltiplo de transferência", num(it.m)], ["Alvo (fica na loja)", num(r.alvo)], ["A retirar", num(r.retirar)],
      ["Cobertura atual", num(r.cobertura) + " dias"], ["Custo unitário", moeda(it.u)], ["Valor a retirar", moeda(r.valorRetirar)]];
    var p = est.params;
    dlg.innerHTML = '<button class="fechar" type="button" id="fechar">Fechar</button><h2 id="ficha-titulo" style="margin-top:0">' + esc(it.d) + "</h2>" +
      '<p class="legenda">' + it.s + " · " + esc(it.f) + " · ref. " + esc(it.r) + " · " + esc(it.c) + " · " + esc(LOJAS[it.l]) + " · " + esc(it.o) + "</p>" +
      "<p><b>" + DECISOES[r.decisao] + "</b>" + (r.volta ? " · " + esc(r.motivo) : "") + "</p>" +
      '<div class="kv">' + kv.map(function (x) { return '<div><div class="r">' + x[0] + '</div><div class="v">' + x[1] + "</div></div>"; }).join("") + "</div>" +
      '<div class="formula">S = d·(C + L) + z·σ·√((C + L)/30)\n  = ' + num(r.previsao / 30, 2) + "·(" + p.cobertura_dias + " + " + num(it.t) + ") + " + num(R.zNormal(p.nivel_servico), 2) + "·" + num(r.sigma, 1) + "·√(" + num(p.cobertura_dias + it.t) + "/30)\n  = " + num(r.previsao / 30 * (p.cobertura_dias + it.t) + r.es, 1) + "  → alvo " + num(r.alvo) + " (inteiro, mínimo de exposição e múltiplo)</div>" +
      '<h3 style="margin:14px 0 6px">Vendas mensais na loja</h3><div class="graf" style="height:230px"><canvas id="g-ficha" aria-label="Vendas mensais"></canvas></div>' +
      '<p class="legenda">O último mês são os últimos 30 dias. A linha é a previsão para o próximo mês (suavização exponencial).</p>';
    dlg.showModal();
    document.getElementById("fechar").addEventListener("click", function () { dlg.close(); });
    if (graficoFicha) graficoFicha.destroy();
    var antes = graficos.length;
    barras(document.getElementById("g-ficha"), rotulosMeses(), it.v, { rotulo: "Peças vendidas", linha: Math.round(r.previsao * 10) / 10, rotuloLinha: "Previsão/mês" });
    graficoFicha = graficos.splice(antes, 1)[0];
  }
  dlg.addEventListener("close", function () { if (graficoFicha) { graficoFicha.destroy(); graficoFicha = null; } });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });

  // ── Sensibilidade ───────────────────────────────────────────────────────
  function telaSensibilidade() {
    tela.innerHTML = '<h1>Sensibilidade da regra</h1><p class="lead">O trade-off que a Gestão decide: mais nível de serviço (menos ruptura) ou mais cobertura seguram mais estoque na loja e devolvem menos capital ao CD. A regra roda de novo em cada uma das 25 combinações.</p>' +
      '<div class="painel"><div class="controles">' + seletorLoja("s-loja", est.lojaSens, true) + "</div></div><div id=\"res-sens\"></div>";
    document.getElementById("s-loja").addEventListener("change", function (e) { est.lojaSens = e.target.value; limparGraficos(); resultadoSens(); });
    resultadoSens();
  }
  function resultadoSens() {
    var base = est.lojaSens ? prep.filter(function (x) { return x.it.l === est.lojaSens; }) : prep;
    var valorEst = soma(base, function (x) { return Math.max(x.it.e, 0) * x.it.u; });
    var grade = NIVEIS.map(function (ns) {
      return COBERTURAS.map(function (c) {
        var l = R.calcular(base, Object.assign({}, est.params, { nivel_servico: ns, cobertura_dias: c })).filter(function (r) { return r.volta; });
        return { itens: l.length, valor: soma(l, function (r) { return r.valorRetirar; }) };
      });
    });
    function tabela(campo, fmt) {
      return '<div class="tabela-wrap"><table><thead><tr><th>Nível de serviço</th>' + COBERTURAS.map(function (c) { return '<th class="n">' + c + " dias</th>"; }).join("") + "</tr></thead><tbody>" +
        NIVEIS.map(function (ns, i) { return "<tr><td>" + num(ns * 100, 0) + "%</td>" + COBERTURAS.map(function (c, j) { var atual = Math.abs(ns - est.params.nivel_servico) < 1e-9 && c === est.params.cobertura_dias; return '<td class="n"' + (atual ? ' style="background:var(--brand-soft);font-weight:700"' : "") + ">" + fmt(grade[i][j][campo]) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
    }
    var p = est.params, i0 = NIVEIS.indexOf(p.nivel_servico), j0 = COBERTURAS.indexOf(p.cobertura_dias);
    var atual = (i0 >= 0 && j0 >= 0) ? grade[i0][j0] : null;
    document.getElementById("res-sens").innerHTML =
      (atual ? '<div class="kpis">' + kpi("Itens a retirar (regra em vigor)", num(atual.itens)) + kpi("Valor a retirar", mil(atual.valor)) + kpi("Do valor em estoque", pct(atual.valor, valorEst)) + "</div>" :
        '<p class="legenda">A regra em vigor (' + num(p.nivel_servico * 100, 0) + "%, " + p.cobertura_dias + " dias) está fora da grade; ajuste em Visão de gestão.</p>") +
      "<h2>Valor a retirar (R$ mil)</h2>" + tabela("valor", function (v) { return num(v / 1e3, 0); }) +
      "<h2>Itens a retirar</h2>" + tabela("itens", function (v) { return num(v); }) +
      '<p class="legenda">Destacada: a combinação em vigor.</p><h2>Curva de trade-off</h2><div class="graf" style="height:320px"><canvas id="g-sens" aria-label="Valor a retirar por nível de serviço, uma linha por cobertura"></canvas></div>' +
      '<p class="legenda">Cada linha é uma cobertura-alvo; andar para a direita é pedir mais disponibilidade na loja.</p>';
    var series = ["--s1", "--s2", "--s3", "--s4", "--s5"];
    var o = baseOpcoes();
    o.scales.x = { type: "linear", min: 80, max: 99, grid: { display: false }, title: { display: true, text: "Nível de serviço (%)" }, ticks: { color: cor("--ink-2") } };
    o.scales.y.title = { display: true, text: "Valor a retirar (R$ mil)" };
    o.plugins.legend = { display: true, position: "bottom", labels: { boxWidth: 12, color: cor("--ink-2") } };
    o.interaction = { mode: "nearest", intersect: false };
    o.plugins.tooltip.callbacks.label = function (c) { return c.dataset.label + ": R$ " + num(c.parsed.y, 0) + " mil"; };
    o.plugins.tooltip.callbacks.title = function (c) { return "Nível de serviço " + num(c[0].parsed.x, 0) + "%"; };
    graficos.push(new Chart(document.getElementById("g-sens"), { type: "line", options: o, data: { datasets: COBERTURAS.map(function (c, j) {
      return { label: c + " dias", data: NIVEIS.map(function (ns, i) { return { x: ns * 100, y: grade[i][j].valor / 1e3 }; }), borderColor: cor(series[j]), backgroundColor: cor(series[j]), borderWidth: 2, pointRadius: 4 };
    }) } }));
  }

  // ── Perfil da loja ──────────────────────────────────────────────────────
  var FAIXAS = [[0, 30, "Até 30 dias"], [30, 60, "30–60 dias"], [60, 90, "60–90 dias"], [90, 180, "90–180 dias"], [180, 365, "180–365 dias"], [365, Infinity, "Mais de 1 ano"]];
  function telaPerfil() {
    tela.innerHTML = '<h1>Perfil da loja</h1><p class="lead">A loja em números: cobertura do estoque, o que volta ao CD e onde está concentrado.</p><div class="painel"><div class="controles">' + seletorLoja("pf-loja", est.loja) + '</div></div><div id="res-perfil"></div>';
    document.getElementById("pf-loja").addEventListener("change", function (e) { est.loja = e.target.value; limparGraficos(); resultadoPerfil(); });
    resultadoPerfil();
  }
  function resultadoPerfil() {
    var lista = porLoja[est.loja], m = metricas(lista, est.loja), volta = lista.filter(function (r) { return r.volta; });
    var faixas = FAIXAS.map(function (f) { return [f[2], soma(lista.filter(function (r) { return r.cobertura >= f[0] && r.cobertura < f[1]; }), function (r) { return r.valorEstoque; })]; });
    faixas.push(["Sem venda prevista", soma(lista.filter(function (r) { return !isFinite(r.cobertura); }), function (r) { return r.valorEstoque; })]);
    var motivos = R.MOTIVOS.map(function (mo) { var l = volta.filter(function (r) { return r.motivo === mo; }); return [mo, soma(l, function (r) { return r.valorRetirar; }), l.length]; });
    var cats = {};
    lista.forEach(function (r) { var c = cats[r.it.c] = cats[r.it.c] || { itens: 0, valor: 0, ret: 0, n: 0 }; c.itens++; c.valor += r.valorEstoque; if (r.volta) { c.ret += r.valorRetirar; c.n++; } });
    var catLinhas = Object.keys(cats).map(function (k) { return [k, cats[k]]; }).sort(function (a, b) { return b[1].ret - a[1].ret; });
    var cmv = D.cmv_mensal[est.loja] || [];
    document.getElementById("res-perfil").innerHTML = '<div class="kpis">' + kpi("Itens na loja", num(m.skus)) + kpi("Valor em estoque", mil(m.valorEstoque)) +
      kpi("CMV do mês", mil(m.cmv)) + kpi("Dias de estoque", num(m.dias), "→ " + num(m.diasDepois) + " depois da devolução") +
      kpi("Valor a retirar", mil(m.valorRetirar), pct(m.valorRetirar, m.valorEstoque) + " do estoque") + "</div>" +
      '<div class="duas"><div><h2>Valor em estoque por cobertura</h2><p class="legenda">Cobertura = estoque ÷ venda diária prevista.</p><div class="graf"><canvas id="g-cob" aria-label="Valor em estoque por faixa de cobertura"></canvas></div></div>' +
      '<div><h2>Valor a retirar por motivo</h2><p class="legenda">' + motivos.map(function (x) { return esc(x[0]) + ": " + num(x[2]) + " itens"; }).join(" · ") + '</p><div class="graf"><canvas id="g-mot" aria-label="Valor a retirar por motivo"></canvas></div></div></div>' +
      '<h2>CMV mensal</h2><p class="legenda">O último mês é parcial.</p><div class="graf" style="height:240px"><canvas id="g-cmv" aria-label="CMV mensal"></canvas></div>' +
      '<h2>Por categoria</h2><div class="tabela-wrap"><table><thead><tr><th>Categoria</th><th class="n">Itens</th><th class="n">Valor em estoque</th><th class="n">Itens a retirar</th><th class="n">Valor a retirar</th><th class="n">% do valor</th></tr></thead><tbody>' +
      catLinhas.map(function (c) { var x = c[1]; return "<tr><td>" + esc(c[0]) + '</td><td class="n">' + num(x.itens) + '</td><td class="n">' + moeda(x.valor) + '</td><td class="n">' + num(x.n) + '</td><td class="n">' + moeda(x.ret) + '</td><td class="n">' + pct(x.ret, x.valor) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    barras(document.getElementById("g-cob"), faixas.map(function (f) { return f[0]; }), faixas.map(function (f) { return f[1]; }), { horizontal: true, moeda: true });
    barras(document.getElementById("g-mot"), motivos.map(function (f) { return f[0]; }), motivos.map(function (f) { return f[1]; }), { horizontal: true, moeda: true });
    barras(document.getElementById("g-cmv"), cmv.map(function (x) { var d = new Date(x[0] + "T12:00:00"); return MESES[d.getMonth()] + "/" + String(d.getFullYear()).slice(2); }), cmv.map(function (x) { return x[1]; }), { moeda: true });
  }

  // ── Acompanhamento ──────────────────────────────────────────────────────
  function estadoPedidos() {
    var ordem = {}; D.etapas.forEach(function (e, i) { ordem[e.chave] = i; });
    return D.pedidos.map(function (p) {
      var ev = p.eventos.slice().sort(function (a, b) { return b[1] - a[1]; });   // do mais antigo ao mais recente (mais horas atrás primeiro)
      var atual = ev[ev.length - 1], idx = ordem[atual[0]], concluido = idx === D.etapas.length - 1;
      return { p: p, eventos: ev, etapa: idx, horas: atual[1], concluido: concluido, atencao: !concluido && atual[1] > D.limite_alerta_h,
               ciclo: concluido ? ev[0][1] - atual[1] : null };
    });
  }
  function dur(h) { var d = Math.floor(h / 24), r = Math.round(h % 24); return (d ? d + "d " : "") + String(r).padStart(d ? 2 : 1, "0") + "h"; }
  function telaAcompanhamento() {
    var ps = estadoPedidos();
    var tempos = D.etapas.slice(0, -1).map(function (e, i) {
      var amostras = ps.map(function (x) { var a = x.eventos.filter(function (v) { return v[0] === e.chave; })[0], b = x.eventos.filter(function (v) { return v[0] === D.etapas[i + 1].chave; })[0]; return a && b ? a[1] - b[1] : null; }).filter(function (v) { return v != null; });
      return [e, amostras.length ? soma(amostras, function (v) { return v; }) / amostras.length : null, amostras.length];
    });
    tela.innerHTML = '<h1>Acompanhamento por etapa</h1><p class="lead">Cada pedido de devolução, da emissão à reintegração no CD. Emissão e separação vêm do ERP; as demais etapas são confirmadas por quem é dono de cada uma. Parado há mais de ' + D.limite_alerta_h + ' h numa etapa fica em atenção.</p>' + faixaDemo() +
      '<div class="kanban">' + D.etapas.map(function (e, i) {
        var cards = ps.filter(function (x) { return x.etapa === i; });
        return '<div class="coluna"><h3><span>' + esc(e.nome) + "</span><span>" + cards.length + "</span></h3>" + (cards.length ? cards.map(function (x) {
          return '<button type="button" class="card' + (x.atencao ? " alerta" : "") + '" data-num="' + x.p.numero + '"><b>' + x.p.numero + " / " + x.p.serie + '</b><small>' + esc(LOJAS[x.p.loja]) + " · lote " + x.p.lote + '</small><span class="tag ' + (x.concluido ? "tag-ok" : x.atencao ? "tag-alerta" : "tag-ok") + '">' + (x.concluido ? "ciclo " + dur(x.ciclo) : (x.atencao ? "⚠ " : "") + dur(x.horas) + " parado") + "</span>" +
            (x.concluido ? "<small>Concluído</small>" : "<small>Próx.: " + esc(D.etapas[x.etapa + 1].papel) + "</small>") + "</button>";
        }).join("") : '<div class="vazio">Nenhum pedido</div>') + "</div>";
      }).join("") + "</div>" +
      '<h2>Tempo médio em cada etapa</h2><p class="legenda">Quanto tempo, em média, o pedido ficou numa etapa até a seguinte. O maior é o gargalo.</p><div class="tabela-wrap"><table><thead><tr><th>Etapa</th><th>Quem registra</th><th class="n">Tempo médio</th><th class="n">Pedidos medidos</th></tr></thead><tbody>' +
      tempos.map(function (t) { return "<tr><td>" + esc(t[0].nome) + "</td><td>" + esc(t[0].papel) + '</td><td class="n">' + (t[1] == null ? "—" : dur(t[1])) + '</td><td class="n">' + t[2] + "</td></tr>"; }).join("") + "</tbody></table></div>";
    tela.querySelectorAll(".card").forEach(function (b) { b.addEventListener("click", function () { abrirPedido(ps.filter(function (x) { return x.p.numero === b.dataset.num; })[0]); }); });
  }
  function abrirPedido(x) {
    var quando = {}; x.eventos.forEach(function (v) { quando[v[0]] = v[1]; });
    var agora = Date.now(), indice = {};
    D.itens.forEach(function (it) { if (it.l === x.p.loja) indice[it.s] = it; });
    dlg.innerHTML = '<button class="fechar" type="button" id="fechar">Fechar</button><h2 id="ficha-titulo" style="margin-top:0">Pedido ' + x.p.numero + " / " + x.p.serie + "</h2>" +
      '<p class="legenda">' + esc(LOJAS[x.p.loja]) + " · lote " + x.p.lote + ' · <span class="tag tag-ex">exemplo</span></p><div class="etapas">' +
      D.etapas.map(function (e, i) { var h = quando[e.chave]; return '<div class="etapa' + (i === x.etapa && !x.concluido ? " atual" : h != null ? " feita" : "") + '"><b>' + esc(e.nome) + "</b><br><small>" + (h != null ? new Date(agora - h * 3600e3).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : esc(e.papel)) + "</small></div>"; }).join("") + "</div>" +
      '<div class="tabela-wrap"><table><thead><tr><th>SKU</th><th>Descrição</th><th>Fabricante</th><th class="n">Qtde</th></tr></thead><tbody>' +
      x.p.itens.map(function (i) { var it = indice[i[0]] || {}; return '<tr><td class="mono">' + i[0] + "</td><td>" + esc(it.d) + "</td><td>" + esc(it.f) + '</td><td class="n">' + num(i[1]) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    dlg.showModal();
    document.getElementById("fechar").addEventListener("click", function () { dlg.close(); });
  }

  // ── Como a regra funciona ───────────────────────────────────────────────
  function telaRegra() {
    tela.innerHTML = '<h1>Como a regra funciona</h1><p class="lead">Para cada item de cada loja, o app calcula quanto a loja precisa manter até a próxima reposição chegar, com uma margem para a incerteza da demanda. O que passa disso volta ao CD.</p>' +
      '<div class="formula">μ = suavização exponencial simples das vendas mensais (12 meses, α = 0,3)\nσ = desvio-padrão dos erros de previsão um passo à frente, com piso de Poisson √μ\nS = d·(C + L) + z·σ·√((C + L)/30)     d = μ/30 · C = cobertura-alvo · L = prazo de reposição · z = Φ⁻¹(nível de serviço)\nS ↑ mínimo de exposição · S ↑ múltiplo de transferência\nretirar = estoque − S, arredondado para baixo no múltiplo</div>' +
      "<h2>Exclusões</h2><p>Vale a primeira que se aplicar: <b>nada a retirar</b> → <b>lançamento</b> (menos de 90 dias de loja, histórico curto para prever) → <b>sazonal</b> → <b>em promoção</b> → <b>abaixo do valor mínimo</b> (não compensa o manuseio).</p>" +
      "<h2>Motivos</h2><p>Quem volta é classificado como <b>sem venda em 6 meses</b>, <b>sem venda em 90 dias</b> ou <b>excesso sobre o alvo</b>.</p>" +
      "<h2>Dados</h2><p>Base sintética e reprodutível: ~1.200 peças em 14 categorias, 5 lojas e 1 CD, ~3.300 combinações loja × item com 12 meses de venda. Cada combinação tem um perfil de demanda (ativo com sazonalidade leve, em queda, parado há alguns meses ou sem venda no ano); a venda de cada mês é Poisson da demanda daquele mês. Nenhum dado é real.</p>" +
      "<h2>Fidelidade</h2><p>Esta página roda a regra em JavaScript. Ela foi conferida item a item contra a implementação em Python do app: os " + num(D.itens.length) + " itens dão o mesmo alvo, a mesma quantidade a retirar, a mesma decisão e o mesmo motivo.</p>" +
      '<p style="margin-top:18px"><a href="https://github.com/MateusSilva7/giro-reverso" target="_blank" rel="noopener">Código do app no GitHub →</a> · <a href="../case-giro-reverso/index.html">Ver o case →</a></p>';
  }

  rota();
})();
