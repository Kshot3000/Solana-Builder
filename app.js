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

/* ---------- Tool 6: SPL token amount conversion (mint decimals) ---------- */
/* Every SPL mint carries its own decimals count: token accounts store RAW integer
   amounts in the mint's smallest unit, and wallets/explorers show the UI amount
   raw / 10^decimals. SOL itself is the 9-decimal special case (Tool 1); USDC uses 6,
   many mints use 9, some use 0. A UI amount with more fractional digits than the
   mint's decimals cannot exist for that mint and is rejected, never rounded.
   Decimals here is capped at 18 for sanity; conversion itself is exact BigInt. */
var MAX_TOKEN_DECIMALS = 18;

function validDecimals(decimals) {
  var d = Number(decimals);
  return Number.isInteger(d) && d >= 0 && d <= MAX_TOKEN_DECIMALS ? d : null;
}

function tokenToRaw(uiStr, decimals) {
  var d = validDecimals(decimals);
  if (d === null || typeof uiStr !== "string") return null;
  var s = uiStr.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  var parts = s.split(".");
  var frac = parts[1] || "";
  if (frac.length > d) return null;
  var scale = 10n ** BigInt(d);
  var padded = (frac + "0".repeat(d)).slice(0, d);
  return (BigInt(parts[0]) * scale + (padded ? BigInt(padded) : 0n)).toString();
}

function rawToToken(rawStr, decimals) {
  var d = validDecimals(decimals);
  if (d === null || typeof rawStr !== "string") return null;
  var s = rawStr.trim();
  if (!/^\d+$/.test(s)) return null;
  var v = BigInt(s);
  if (d === 0) return v.toString();
  var scale = 10n ** BigInt(d);
  var whole = v / scale;
  var frac = (v % scale).toString().padStart(d, "0").replace(/0+$/, "");
  return whole.toString() + (frac ? "." + frac : "");
}

/* ---------- Tool 7: Solana address checker (base58, 32 bytes) ---------- */
/* A Solana public key / address is 32 bytes written in base58 — the alphabet
   Bitcoin introduced, which omits 0, O, I and l so addresses can't be misread.
   Leading '1' characters are leading zero bytes (the System Program address
   111...1 is 32 zero bytes). Valid FORMAT is exactly: every character in the
   alphabet and a decoded length of exactly 32 bytes. That is all this checks,
   locally: it does NOT prove the account exists, holds anything, is on the
   ed25519 curve (program-derived addresses are valid 32-byte addresses that
   are deliberately off-curve), or is safe to send to — always compare the full
   address character-for-character with the source you trust. */
var BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(str) {
  if (typeof str !== "string" || str.length === 0) return null;
  var n = 0n;
  for (var i = 0; i < str.length; i++) {
    var idx = BASE58_ALPHABET.indexOf(str[i]);
    if (idx < 0) return null;
    n = n * 58n + BigInt(idx);
  }
  var zeros = 0;
  while (zeros < str.length && str[zeros] === "1") zeros++;
  var body = [];
  while (n > 0n) { body.unshift(Number(n % 256n)); n = n / 256n; }
  var out = [];
  for (var z = 0; z < zeros; z++) out.push(0);
  return out.concat(body);
}

function base58Encode(bytes) {
  if (!bytes || typeof bytes.length !== "number") return null;
  var zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  var n = 0n;
  for (var i = 0; i < bytes.length; i++) {
    if (!Number.isInteger(bytes[i]) || bytes[i] < 0 || bytes[i] > 255) return null;
    n = n * 256n + BigInt(bytes[i]);
  }
  var s = "";
  while (n > 0n) { s = BASE58_ALPHABET[Number(n % 58n)] + s; n = n / 58n; }
  return "1".repeat(zeros) + s;
}

function checkAddress(str) {
  if (typeof str !== "string") return { valid: false, charLength: 0, byteLength: null, reason: "empty" };
  var s = str.trim();
  if (s.length === 0) return { valid: false, charLength: 0, byteLength: null, reason: "empty" };
  for (var i = 0; i < s.length; i++) {
    if (BASE58_ALPHABET.indexOf(s[i]) < 0) {
      return { valid: false, charLength: s.length, byteLength: null, reason: "invalid-character", badCharacter: s[i] };
    }
  }
  var bytes = base58Decode(s);
  if (bytes.length !== 32) {
    return { valid: false, charLength: s.length, byteLength: bytes.length, reason: "wrong-length" };
  }
  return { valid: true, charLength: s.length, byteLength: 32, reason: null };
}

/* ---------- Tool 8: staking rewards estimator (epoch compounding model) ---------- */
/* Solana pays staking rewards once per epoch. An epoch is 432,000 slots —
   at the target ~400 ms per slot that is about 2 days, so a year holds about
   182.5 epochs (actual epochs drift with real slot times). Rewards credited
   to an active stake account are added to its balance, so they compound from
   the next epoch on. Validators take their commission as a percentage OF the
   reward, not of the stake. This model takes the gross annual yield as a
   USER ASSUMPTION (it is not a live network yield — real yield moves with
   inflation, total stake and validator performance, and liquid-staking tokens
   differ again), spreads it evenly over the epochs of a year, deducts
   commission each epoch, and compounds the net reward epoch by epoch.
   Because of that per-epoch compounding, the effective return over a full
   year lands slightly above the nominal annual rate entered. */
var SLOTS_PER_EPOCH = 432000;
var EPOCHS_PER_YEAR = 182.5; /* ~2-day epochs: 365 / 2 */
var MAX_STAKING_EPOCHS = 1825; /* ~10 years of epochs — a model cap, not a network limit */

function stakingRewards(stakeStr, annualYieldPct, epochs, commissionPct) {
  if (parseScaled(stakeStr) === null) return null;
  var stake = Number(stakeStr);
  var y = Number(annualYieldPct);
  var n = Number(epochs);
  var c = Number(commissionPct);
  if (!isFinite(stake) || stake <= 0) return null;
  if (!isFinite(y) || y < 0 || y > 100) return null;
  if (!Number.isInteger(n) || n < 1 || n > MAX_STAKING_EPOCHS) return null;
  if (!isFinite(c) || c < 0 || c > 100) return null;
  var perEpochGrossRate = (y / 100) / EPOCHS_PER_YEAR;
  var balance = stake;
  var firstEpochNet = null;
  for (var i = 0; i < n; i++) {
    var gross = balance * perEpochGrossRate;
    var net = gross * (1 - c / 100);
    if (i === 0) firstEpochNet = net;
    balance += net;
  }
  return {
    stake: stake,
    annualYieldPct: y,
    epochs: n,
    commissionPct: c,
    firstEpochNetSol: firstEpochNet,
    totalRewardsSol: balance - stake,
    finalStakeSol: balance
  };
}

/* ---------- Tool 9: Solana Pay transfer-request URLs (build & parse) ---------- */
/* Solana Pay encodes a payment request as one URL:
   solana:<recipient>?amount=<amount>&spl-token=<mint>&reference=<ref>
     &label=<label>&message=<message>&memo=<memo>
   The recipient is the base58 address of a NATIVE SOL account — an associated
   token account must not be used as the recipient; for a token payment the
   wallet derives the recipient's token account from the spl-token mint.
   Amount is in user units (SOL, not lamports; a token's UI amount, not raw
   units), is non-negative (0 is valid — omitting it makes the wallet ask the
   payer), needs a leading 0 before the point when below 1, and scientific
   notation is prohibited. An amount finer than the asset's decimals is
   malformed: 9 for SOL, the mint's own decimals for a token. This builder
   knows two mints' decimals locally (USDC and USDG, 6 each); for any other
   mint it cannot check precision without an RPC lookup, so it builds the
   URL and the wallet remains the check — stated plainly in the UI.
   Reference is the ONLY repeatable field (order preserved — wallets attach
   the keys to the transfer in order, so a merchant can find the payment by
   reference later); every other field is single-value and a URL carrying one
   twice is rejected as ambiguous, never first-wins or last-wins. Label and
   message are display-only; a memo is written on-chain in an SPL Memo
   instruction and is public forever. Present-but-empty spl-token / reference
   values are rejected, never silently dropped into a different payment.
   Local string work only: nothing is sent and no wallet opens. */
var KNOWN_MINT_DECIMALS = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 6, /* USDC */
  "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH": 6  /* USDG */
};

function payAmountDecimals(amountStr, splToken) {
  if (!splToken) return 9; /* SOL */
  return Object.prototype.hasOwnProperty.call(KNOWN_MINT_DECIMALS, splToken)
    ? KNOWN_MINT_DECIMALS[splToken] : null; /* unknown mint: cannot check locally */
}

function validPayAmount(amountStr, splToken) {
  if (typeof amountStr !== "string") return false;
  var s = amountStr.trim();
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(s)) return false;
  var maxDec = payAmountDecimals(s, splToken || null);
  if (maxDec === null) return true;
  var frac = (s.split(".")[1] || "").replace(/0+$/, ""); /* trailing zeros carry no precision */
  return frac.length <= maxDec;
}

function buildSolanaPayUrl(f) {
  if (!f || !checkAddress(f.recipient || "").valid) return null;
  var hasSpl = f.splToken !== undefined && f.splToken !== null;
  if (hasSpl && !checkAddress(f.splToken).valid) return null;
  var spl = hasSpl ? f.splToken.trim() : null;
  var params = [];
  if (f.amount !== undefined && f.amount !== null && String(f.amount).trim() !== "") {
    var a = String(f.amount).trim();
    if (!validPayAmount(a, spl)) return null;
    params.push("amount=" + encodeURIComponent(a));
  }
  if (hasSpl) params.push("spl-token=" + encodeURIComponent(spl));
  var refs = [];
  if (Array.isArray(f.references)) refs = f.references;
  else if (f.reference !== undefined && f.reference !== null) refs = [f.reference];
  for (var i = 0; i < refs.length; i++) {
    if (!checkAddress(refs[i] || "").valid) return null;
    params.push("reference=" + encodeURIComponent(String(refs[i]).trim()));
  }
  var textFields = [["label", f.label], ["message", f.message], ["memo", f.memo]];
  for (var j = 0; j < textFields.length; j++) {
    var v = textFields[j][1];
    if (v !== undefined && v !== null && String(v) !== "") {
      params.push(textFields[j][0] + "=" + encodeURIComponent(String(v)));
    }
  }
  return "solana:" + String(f.recipient).trim() + (params.length ? "?" + params.join("&") : "");
}

function parseSolanaPayUrl(url) {
  if (typeof url !== "string") return null;
  var s = url.trim();
  if (s.indexOf("solana:") !== 0) return null;
  var rest = s.slice("solana:".length);
  var qIdx = rest.indexOf("?");
  var recipient = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
  if (!checkAddress(recipient).valid) return null;
  var out = { recipient: recipient, amount: null, splToken: null, references: [], label: null, message: null, memo: null, asset: "SOL" };
  if (qIdx < 0) return out;
  var SINGLE = { amount: 1, "spl-token": 1, label: 1, message: 1, memo: 1 };
  var seen = {};
  try {
    var pairs = rest.slice(qIdx + 1).split("&");
    for (var i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue;
      var eq = pairs[i].indexOf("=");
      var k = decodeURIComponent(eq >= 0 ? pairs[i].slice(0, eq) : pairs[i]);
      var v = eq >= 0 ? decodeURIComponent(pairs[i].slice(eq + 1)) : "";
      if (k === "reference") { out.references.push(v); continue; }
      if (SINGLE[k]) { if (seen[k]) return null; seen[k] = true; }
      if (k === "amount") out.amount = v;
      else if (k === "spl-token") out.splToken = v;
      else if (k === "label") out.label = v;
      else if (k === "message") out.message = v;
      else if (k === "memo") out.memo = v;
    }
  } catch (e) { return null; /* malformed percent-encoding */ }
  if (out.amount !== null && !validPayAmount(out.amount, out.splToken)) return null;
  if (out.splToken !== null && !checkAddress(out.splToken).valid) return null;
  for (var r = 0; r < out.references.length; r++) {
    if (!checkAddress(out.references[r]).valid) return null;
  }
  out.asset = out.splToken ? "SPL" : "SOL";
  return out;
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
    rentExempt, impermanentLoss, txFee, tokenToRaw, rawToToken, catalogueMatch,
    base58Decode, base58Encode, checkAddress, stakingRewards,
    buildSolanaPayUrl, parseSolanaPayUrl, validPayAmount, KNOWN_MINT_DECIMALS,
    RENT_LAMPORTS_PER_BYTE_YEAR, ACCOUNT_STORAGE_OVERHEAD, SCALE,
    SLOTS_PER_EPOCH, EPOCHS_PER_YEAR, MAX_STAKING_EPOCHS,
    BASE_FEE_LAMPORTS_PER_SIGNATURE, MAX_COMPUTE_UNIT_LIMIT, MAX_TOKEN_DECIMALS,
    BASE58_ALPHABET
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

    var tokForm = document.getElementById("tok-calc");
    if (tokForm) tokForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var dec = val("tok-dec").trim(), ui = val("tok-ui").trim(), raw = val("tok-raw").trim();
      if (ui) {
        var r = tokenToRaw(ui, dec);
        setText("tok-result", r === null
          ? "Check the inputs: decimals must be a whole number from 0 to 18, and the UI amount may carry at most that many decimal places — a finer amount cannot exist for this mint and is never rounded here."
          : ui + " (UI amount) at " + dec + " decimals = " + r + " raw units. Token accounts store the raw integer; wallets divide by 10^decimals to display the UI amount.");
        if (r !== null) document.getElementById("tok-raw-out").value = r;
      } else if (raw) {
        var u = rawToToken(raw, dec);
        setText("tok-result", u === null
          ? "Check the inputs: decimals must be a whole number from 0 to 18, and the raw amount must be a whole number — raw units do not subdivide."
          : raw + " raw units at " + dec + " decimals = " + u + " (UI amount). The decimals count comes from the mint itself — the same raw number means different UI amounts under different mints.");
        if (u !== null) document.getElementById("tok-ui-out").value = u;
      } else {
        setText("tok-result", "Set the mint's decimals, fill in either the UI amount or the raw amount, then convert.");
      }
    });

    var addrForm = document.getElementById("addr-calc");
    if (addrForm) addrForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = checkAddress(val("addr-in"));
      if (res.valid) {
        document.getElementById("addr-out").value = "Valid format — 32 bytes";
        setText("addr-result", "Format check passed: " + res.charLength + " base58 characters decoding to exactly 32 bytes. This local check proves only the format — not that the account exists, holds anything, or is the address you meant. Compare the full address character-for-character with the source you trust before sending anything to it.");
      } else {
        document.getElementById("addr-out").value = "Invalid";
        setText("addr-result", res.reason === "invalid-character"
          ? "Invalid: the character '" + res.badCharacter + "' is not in the base58 alphabet — base58 omits 0, O, I and l precisely so addresses cannot be misread. This string is not a Solana address."
          : res.reason === "wrong-length"
            ? "Invalid: this is well-formed base58 but decodes to " + res.byteLength + " bytes, and a Solana address is exactly 32 bytes. A pasted address with extra or missing characters lands here — re-copy it from the source and compare in full."
            : "Enter an address to check — a string of base58 characters that should decode to exactly 32 bytes.");
      }
    });

    var stakeForm = document.getElementById("stake-calc");
    if (stakeForm) stakeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = stakingRewards(val("stake-amt"), val("stake-yield"), val("stake-epochs"), val("stake-comm"));
      if (res === null) {
        setText("stake-result", "Check the inputs: stake must be a positive SOL amount, the assumed annual yield a number from 0 to 100%, epochs a whole number from 1 to 1,825, and commission a number from 0 to 100%.");
        return;
      }
      document.getElementById("stake-out").value = res.finalStakeSol.toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
      setText("stake-result", "Model output: at an assumed gross annual yield of " + res.annualYieldPct +
        "% spread over ~182.5 epochs a year, the first epoch nets about " + res.firstEpochNetSol.toFixed(6) +
        " SOL after " + res.commissionPct + "% validator commission, and over " + res.epochs + " epochs the stake grows by about " +
        res.totalRewardsSol.toFixed(6) + " SOL to about " + res.finalStakeSol.toFixed(6) +
        " SOL, because each epoch's reward is added to the stake and compounds. The yield here is your assumption, not a live network yield — real returns move with inflation, total stake, validator performance and commission changes, and rewards only start after a stake activates (about an epoch) and arrive at epoch boundaries. An educational model, not a live quote. Not financial advice.");
    });

    var payForm = document.getElementById("pay-calc");
    if (payForm) payForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var ref = val("pay-ref").trim();
      var url = buildSolanaPayUrl({
        recipient: val("pay-recipient"),
        amount: val("pay-amount"),
        splToken: document.getElementById("pay-spl").value === "" ? undefined : val("pay-spl"),
        references: ref ? [ref] : [],
        label: val("pay-label"),
        message: val("pay-message"),
        memo: val("pay-memo")
      });
      if (url === null) {
        setText("pay-result", "Check the inputs: the recipient must be a valid-format 32-byte address (a native account — an associated token account must not be used as the recipient); the amount, if given, must be a plain decimal with a leading 0 below 1, no scientific notation, and no more decimal places than the asset supports (9 for SOL, 6 for the USDC and USDG mints this page knows); a filled-in mint or reference must be a valid-format address — a present-but-invalid one is refused, never silently dropped.");
        return;
      }
      document.getElementById("pay-out").value = url;
      var parsed = parseSolanaPayUrl(url);
      setText("pay-result", "Built locally: a Solana Pay transfer request for " +
        (parsed.amount !== null ? parsed.amount + " " : "an amount the payer's wallet will ask for, in ") +
        (parsed.asset === "SPL" ? "the SPL token named by the mint field" : "SOL") +
        " to " + parsed.recipient + ". Nothing was sent and no wallet opened — this URL (or a QR code of it) is what a payer's wallet reads to compose the transfer. Read it back in full before sharing: the recipient in the string is where the money goes. For a mint this page does not know, precision past the mint's decimals cannot be checked here and the wallet will reject the URL as malformed.");
    });

    var payParseForm = document.getElementById("payparse-calc");
    if (payParseForm) payParseForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = parseSolanaPayUrl(val("payparse-in"));
      if (res === null) {
        document.getElementById("payparse-out").value = "Not a well-formed transfer request";
        setText("payparse-result", "This string is not a well-formed Solana Pay transfer request: it needs the solana: scheme, a valid-format 32-byte recipient, a plain-decimal amount (leading 0 below 1, no scientific notation, no finer than the asset's decimals), valid-format mint and reference addresses when present, no single-value field carried twice, and intact percent-encoding. A wallet would reject it as malformed — do not try to pay it.");
        return;
      }
      document.getElementById("payparse-out").value = "Well-formed — " + res.asset + " transfer request";
      var parts = ["Recipient: " + res.recipient,
        res.amount !== null ? "Amount: " + res.amount + " (user units)" : "Amount: not fixed — the wallet must ask the payer",
        res.splToken ? "SPL token mint: " + res.splToken : "Asset: native SOL"];
      if (res.references.length) parts.push("Reference" + (res.references.length === 1 ? "" : "s") + ": " + res.references.join(", "));
      if (res.label) parts.push("Label: " + res.label);
      if (res.message) parts.push("Message: " + res.message);
      if (res.memo) parts.push("Memo (public, on-chain): " + res.memo);
      setText("payparse-result", parts.join(" · ") + ". Checked locally only: well-formed says the URL follows the format, not that the recipient is who you meant — compare the recipient in full with the source you trust before paying.");
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
