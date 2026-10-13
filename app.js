"use strict";
/* Solana-Builder hub — browser-local educational models. No wallet, no network, no live data.
   Pure functions are exported for the node test suite. */

/* ---------- exact decimal helpers (9 dp, BigInt-scaled) ---------- */
var SCALE = 1000000000n;

function parseScaled(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  var parts = s.split(".");
  var whole = BigInt(parts[0]);
  var frac = parts[1] || "";
  if (frac.length > 9) return null;
  frac = (frac + "000000000").slice(0, 9);
  return whole * SCALE + BigInt(frac);
}

function formatScaled(v) {
  var neg = v < 0n;
  if (neg) v = -v;
  var whole = v / SCALE;
  var frac = (v % SCALE).toString().padStart(9, "0").replace(/0+$/, "");
  return (neg ? "-" : "") + whole.toString() + (frac ? "." + frac : "");
}

/* ---------- Tool 1: SOL <-> lamports (exact) ---------- */
/* 1 SOL = 1,000,000,000 lamports, by definition of the Solana runtime. */
function solToLamports(solStr) {
  var scaled = parseScaled(solStr); /* SOL scaled by 1e9 IS the lamport count */
  if (scaled === null) return null;
  return scaled.toString();
}

function lamportsToSol(lamStr) {
  if (typeof lamStr !== "string") return null;
  var s = lamStr.trim();
  if (!/^\d+$/.test(s)) return null;
  return formatScaled(BigInt(s));
}

/* ---------- Tool 2: constant-product swap model ---------- */
/* x*y=k pool, fee charged on the input in basis points, exact scaled-BigInt math.
   out = effIn * reserveOut / (reserveIn + effIn), floored like an on-chain u64 division. */
function cpSwap(reserveInStr, reserveOutStr, amountInStr, feeBps) {
  var rIn = parseScaled(reserveInStr);
  var rOut = parseScaled(reserveOutStr);
  var aIn = parseScaled(amountInStr);
  var bps = Number(feeBps);
  if (rIn === null || rOut === null || aIn === null) return null;
  if (rIn <= 0n || rOut <= 0n || aIn <= 0n) return null;
  if (!Number.isInteger(bps) || bps < 0 || bps >= 10000) return null;
  var fee = (aIn * BigInt(bps)) / 10000n;
  var eff = aIn - fee;
  if (eff <= 0n) return null;
  var out = (eff * rOut) / (rIn + eff);
  if (out <= 0n || out >= rOut) return null;
  /* price impact vs the spot price, as a percentage (display only) */
  var spot = Number(rOut) / Number(rIn);
  var effPrice = Number(out) / Number(eff);
  var impactPct = (1 - effPrice / spot) * 100;
  return {
    fee: formatScaled(fee),
    effectiveIn: formatScaled(eff),
    amountOut: formatScaled(out),
    priceImpactPct: impactPct
  };
}

/* ---------- Tool 3: rent-exempt minimum ---------- */
/* Solana rent: an account is rent-exempt when it holds two years of rent.
   Lamports per byte-year is 3,480 and every account carries a fixed 128-byte
   storage overhead, so rentExempt = (128 + dataLen) * 3480 * 2 lamports. */
var RENT_LAMPORTS_PER_BYTE_YEAR = 3480;
var ACCOUNT_STORAGE_OVERHEAD = 128;
var RENT_EXEMPTION_YEARS = 2;

function rentExempt(dataLen) {
  var n = Number(dataLen);
  if (!Number.isInteger(n) || n < 0) return null;
  var perYear = (ACCOUNT_STORAGE_OVERHEAD + n) * RENT_LAMPORTS_PER_BYTE_YEAR;
  return {
    dataLen: n,
    rentPerYearLamports: perYear,
    rentExemptLamports: perYear * RENT_EXEMPTION_YEARS,
    rentExemptSol: formatScaled(BigInt(perYear * RENT_EXEMPTION_YEARS))
  };
}

/* ---------- Tool 5: transaction fee (base + priority) ---------- */
/* Total fee = base fee + prioritization fee.
   Base fee: 5,000 lamports per signature.
   Prioritization fee: ceil(computeUnitLimit * computeUnitPriceMicroLamports / 1,000,000)
   lamports — charged on the CU LIMIT you request, not the CU you actually use.
   A transaction's CU limit is capped at 1,400,000 by the runtime. */
var BASE_FEE_LAMPORTS_PER_SIGNATURE = 5000;
var MAX_COMPUTE_UNIT_LIMIT = 1400000;

function txFee(signatures, cuLimit, cuPriceMicro) {
  var sigs = Number(signatures);
  var cu = Number(cuLimit);
  var price = Number(cuPriceMicro);
  if (!Number.isInteger(sigs) || sigs < 1) return null;
  if (!Number.isInteger(cu) || cu < 1 || cu > MAX_COMPUTE_UNIT_LIMIT) return null;
  if (!Number.isInteger(price) || price < 0) return null;
  var base = BigInt(sigs) * BigInt(BASE_FEE_LAMPORTS_PER_SIGNATURE);
  var prod = BigInt(cu) * BigInt(price);
  var priority = (prod + 999999n) / 1000000n; /* ceil division; 0 when price is 0 */
  var total = base + priority;
  return {
    signatures: sigs,
    baseFeeLamports: Number(base),
    priorityFeeLamports: Number(priority),
    totalFeeLamports: Number(total),
    totalFeeSol: formatScaled(total)
  };
}

/* ---------- Tool 4: impermanent loss (two-asset 50/50 pool) ---------- */
/* IL(r) = 2*sqrt(r)/(1+r) - 1 where r is the price ratio new/old. */
function impermanentLoss(ratioStr) {
  var r = Number(ratioStr);
  if (!isFinite(r) || r <= 0) return null;
  var il = (2 * Math.sqrt(r)) / (1 + r) - 1;
  return { ratio: r, ilPct: il * 100 };
}

/* ---------- catalogue filter ---------- */
function catalogueMatch(cat, filter) {
  if (filter === "all") return true;
  return cat.split(" ").indexOf(filter) !== -1;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseScaled, formatScaled, solToLamports, lamportsToSol, cpSwap,
    rentExempt, impermanentLoss, txFee, catalogueMatch,
    RENT_LAMPORTS_PER_BYTE_YEAR, ACCOUNT_STORAGE_OVERHEAD, SCALE,
    BASE_FEE_LAMPORTS_PER_SIGNATURE, MAX_COMPUTE_UNIT_LIMIT
  };
}

/* ---------- browser wiring ---------- */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    function val(id) { return document.getElementById(id).value; }
    function setText(id, t) { document.getElementById(id).textContent = t; }

    var lampForm = document.getElementById("lamp-calc");
    if (lampForm) lampForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var sol = val("sol-in").trim(), lam = val("lam-in").trim();
      if (sol) {
        var l = solToLamports(sol);
        setText("lamp-result", l === null
          ? "Enter a SOL amount with at most 9 decimal places (1 lamport is the smallest unit)."
          : sol + " SOL = " + l + " lamports, exactly. Lamports are the unit balances are actually stored in; a SOL figure with more than 9 decimals cannot exist on-chain.");
        if (l !== null) document.getElementById("lam-out").value = l;
      } else if (lam) {
        var s = lamportsToSol(lam);
        setText("lamp-result", s === null
          ? "Enter lamports as a whole number — lamports do not subdivide."
          : lam + " lamports = " + s + " SOL, exactly.");
        if (s !== null) document.getElementById("sol-out").value = s;
      } else {
        setText("lamp-result", "Fill in either the SOL amount or the lamport count, then convert.");
      }
    });

    var swapForm = document.getElementById("swap-calc");
    if (swapForm) swapForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = cpSwap(val("swap-rin"), val("swap-rout"), val("swap-ain"), val("swap-fee"));
      if (res === null) {
        setText("swap-result", "Check the inputs: reserves and amount must be positive numbers with at most 9 decimals, and the fee must be a whole number of basis points under 10,000.");
        return;
      }
      document.getElementById("swap-out").value = res.amountOut;
      setText("swap-result", "Model output: fee " + res.fee + " taken on the input, " + res.effectiveIn +
        " traded against the pool, " + res.amountOut + " out — a price impact of about " + res.priceImpactPct.toFixed(4) +
        "% against the spot price. An educational constant-product model with the fee on the input, not a live quote: a real pool's reserves, fee tier and routing differ trade by trade. Not financial advice.");
    });

    var rentForm = document.getElementById("rent-calc");
    if (rentForm) rentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = rentExempt(val("rent-len"));
      if (res === null) {
        setText("rent-result", "Enter the account's data length in bytes as a whole number, 0 or more.");
        return;
      }
      document.getElementById("rent-out").value = String(res.rentExemptLamports);
      setText("rent-result", "Model output: an account with " + res.dataLen + " bytes of data pays " +
        res.rentPerYearLamports + " lamports of rent per year and is rent-exempt at " + res.rentExemptLamports +
        " lamports (" + res.rentExemptSol + " SOL) — two years of rent held up front, using the network's long-standing 3,480 lamports per byte-year and the fixed 128-byte account overhead. Rent parameters are set by the network and can change by governance; check a live cluster before funding a real account. This page executes nothing.");
    });

    var ilForm = document.getElementById("il-calc");
    if (ilForm) ilForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = impermanentLoss(val("il-ratio"));
      if (res === null) {
        setText("il-result", "Enter the price ratio (new price divided by entry price) as a positive number, for example 2 if the price doubled.");
        return;
      }
      document.getElementById("il-out").value = res.ilPct.toFixed(4) + "%";
      setText("il-result", "Model output: at a price ratio of " + res.ratio + ", a 50/50 constant-product position is worth " +
        Math.abs(res.ilPct).toFixed(4) + "% " + (res.ilPct < 0 ? "less" : "the same") +
        " than simply holding the two assets, before fees. Fees earned can offset this; concentrated-liquidity positions differ. An educational model, not a live quote. Not financial advice.");
    });

    var feeForm = document.getElementById("fee-calc");
    if (feeForm) feeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = txFee(val("fee-sigs"), val("fee-cu"), val("fee-price"));
      if (res === null) {
        setText("fee-result", "Check the inputs: signatures must be a whole number of 1 or more, the compute-unit limit a whole number from 1 to 1,400,000 (the runtime cap), and the compute-unit price a whole number of micro-lamports, 0 or more.");
        return;
      }
      document.getElementById("fee-out").value = String(res.totalFeeLamports);
      setText("fee-result", "Model output: base fee " + res.baseFeeLamports + " lamports (" + res.signatures +
        " signature" + (res.signatures === 1 ? "" : "s") + " at 5,000 each) + priority fee " + res.priorityFeeLamports +
        " lamports = " + res.totalFeeLamports + " lamports total (" + res.totalFeeSol +
        " SOL). The priority fee is charged on the compute-unit limit you request, not the compute you actually use — simulate first and set the limit close to real usage. Base and priority rates are set by the network and can change; this is an educational model, not a live fee quote. Not financial advice.");
    });

    /* catalogue filter */
    var buttons = document.querySelectorAll("[data-filter]");
    var items = document.querySelectorAll("[data-cat]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.toggle("active", b === btn); });
        var f = btn.getAttribute("data-filter");
        items.forEach(function (it) {
          it.style.display = catalogueMatch(it.getAttribute("data-cat"), f) ? "" : "none";
        });
      });
    });

    /* copy donation address */
    var copyBtn = document.getElementById("copy-address");
    if (copyBtn) copyBtn.addEventListener("click", function () {
      var addr = document.getElementById("donation-address").textContent.trim();
      var done = function () { setText("copy-status", "SOL address copied."); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addr).then(done, function () {
          setText("copy-status", "Copy failed — select the address text manually.");
        });
      } else {
        setText("copy-status", "Select the address text to copy it.");
      }
    });
  });
}
