/*
 * Regra da lista do Giro Reverso, em JavaScript: a mesma de domain/regra.py (o app em Python/Streamlit).
 * Estoque-alvo por revisão periódica:
 *   μ = suavização exponencial simples das vendas mensais; σ = desvio-padrão dos erros um passo à frente (piso de Poisson √μ)
 *   S = d·(C + L) + z·σ·√((C + L)/30), d = μ/30; S sobe para o mínimo de exposição e para o múltiplo; retirar = estoque − S (↓ múltiplo)
 *   exclusões: nada a retirar → lançamento → sazonal → em promoção → abaixo do valor mínimo
 */
(function (raiz) {
  "use strict";
  var EPS = 1e-9;
  var MOTIVOS = ["Sem venda em 6 meses", "Sem venda em 90 dias", "Excesso sobre o alvo"];
  var EXCLUSOES = ["nada a retirar", "lançamento", "sazonal", "em promoção", "abaixo do valor mínimo"];

  // Inversa da normal padrão (Acklam), erro relativo < 1,2e-9: o mesmo z que statistics.NormalDist().inv_cdf
  function zNormal(p) {
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var pb = 0.02425, q, r;
    if (p < pb) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pb) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // Suavização exponencial simples: nível inicial = média dos 3 primeiros meses; devolve [previsão, desvio dos erros a partir do 4º mês]
  function previsao(v, alfa) {
    var nivel = (v[0] + v[1] + v[2]) / 3, erros = [];
    for (var t = 3; t < v.length; t++) { erros.push(v[t] - nivel); nivel = alfa * v[t] + (1 - alfa) * nivel; }
    var sigma = 0;
    if (erros.length >= 3) {
      var media = erros.reduce(function (s, e) { return s + e; }, 0) / erros.length;
      sigma = Math.sqrt(erros.reduce(function (s, e) { return s + (e - media) * (e - media); }, 0) / (erros.length - 1));
    }
    return [nivel, sigma];
  }

  function acima(v, m) { return Math.ceil(v / m - EPS) * m; }
  function abaixo(v, m) { return Math.floor(v / m + EPS) * m; }

  // Pré-calcula o que não depende dos parâmetros (previsão e desvio): a sensibilidade roda a regra 25 vezes sobre a mesma base.
  function preparar(itens, alfa) {
    return itens.map(function (it) {
      var pv = previsao(it.v, alfa);
      var u3 = it.v[9] + it.v[10] + it.v[11], u6 = u3 + it.v[6] + it.v[7] + it.v[8];
      return { it: it, mu: pv[0], sigma: Math.max(pv[1], Math.sqrt(Math.max(pv[0], 0))), u3: u3, u6: u6 };
    });
  }

  function calcular(prep, p) {
    var z = zNormal(p.nivel_servico);
    return prep.map(function (x) {
      var it = x.it, est = Math.max(it.e || 0, 0), mult = Math.max(it.m || 1, 1), expo = Math.max(it.x || 0, 0);
      var lt = Math.max(it.t == null ? 7 : it.t, 0), h = p.cobertura_dias + lt;
      var es = z * x.sigma * Math.sqrt(h / 30);
      var alvo = Math.max(x.mu / 30 * h + es, 0);
      alvo = Math.max(acima(alvo, 1), expo);
      alvo = acima(alvo, mult);
      var retirar = abaixo(Math.max(est - alvo, 0), mult), valor = retirar * (it.u || 0);
      var dias = it.n == null ? Infinity : it.n, decisao;
      if (retirar <= 0) decisao = EXCLUSOES[0];
      else if (p.dias_min_loja > 0 && dias < p.dias_min_loja) decisao = EXCLUSOES[1];
      else if (it.z) decisao = EXCLUSOES[2];
      else if (it.p) decisao = EXCLUSOES[3];
      else if (valor < p.valor_minimo) decisao = EXCLUSOES[4];
      else decisao = "retornar";
      var volta = decisao === "retornar";
      return {
        it: it, previsao: x.mu, sigma: x.sigma, es: es, alvo: alvo, decisao: decisao, volta: volta,
        motivo: volta ? (x.u6 === 0 ? MOTIVOS[0] : x.u3 === 0 ? MOTIVOS[1] : MOTIVOS[2]) : "",
        retirar: volta ? retirar : 0, fica: est - (volta ? retirar : 0), valorRetirar: volta ? valor : 0, valorEstoque: est * (it.u || 0),
        cobertura: x.mu > EPS ? est / (x.mu / 30) : Infinity,
      };
    });
  }

  var api = { zNormal: zNormal, previsao: previsao, preparar: preparar, calcular: calcular, MOTIVOS: MOTIVOS, EXCLUSOES: EXCLUSOES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.GRRegra = api;
})(this);
