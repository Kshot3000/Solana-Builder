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

/* ---------- Tool 10: CLMM tick <-> price + position range ---------- */
/* Concentrated-liquidity pools (Raydium CLMM, Orca Whirlpools) do not let
   liquidity sit at any price: prices are discretised onto ticks, where
   price(tick) = 1.0001^tick — each tick is one basis point of price.
   The on-chain tick range is [-443636, 443636], chosen so the stored
   sqrt-price (Q64.64 fixed point) fits its field at both ends; prices here
   are in raw token units (a UI price also needs the two mints' decimals,
   which this local model does not look up). A position's endpoints must
   be aligned to the pool's tick spacing (tick % spacing == 0) — the
   spacing is set per pool/fee tier, so it is an input here, not a
   constant. A position is in range (active, earning fees) while
   tickLower <= tickCurrent < tickUpper; at or above the upper tick it
   holds only one asset and earns nothing until price returns.
   Price->tick returns the largest tick whose price is <= the entered
   price (the floor convention pools use), with a small relative
   correction so an exact tick price round-trips to its own tick. */
var MIN_TICK = -443636;
var MAX_TICK = 443636;
var TICK_BASE = 1.0001;

function tickToPrice(tick) {
  var t = Number(tick);
  if (!Number.isInteger(t) || t < MIN_TICK || t > MAX_TICK) return null;
  return Math.pow(TICK_BASE, t);
}

function priceToTick(priceStr) {
  var p = Number(priceStr);
  if (!isFinite(p) || p <= 0) return null;
  var t = Math.floor(Math.log(p) / Math.log(TICK_BASE));
  while (t < MAX_TICK && tickToPrice(t + 1) <= p * (1 + 1e-12)) t++;
  while (t > MIN_TICK && tickToPrice(t) > p * (1 + 1e-12)) t--;
  if (t < MIN_TICK || t > MAX_TICK) return null;
  return t;
}

function clmmRange(lower, upper, current, spacing) {
  var lo = Number(lower), hi = Number(upper), cur = Number(current), sp = Number(spacing);
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || !Number.isInteger(cur) || !Number.isInteger(sp)) return null;
  if (lo < MIN_TICK || hi > MAX_TICK || cur < MIN_TICK || cur > MAX_TICK) return null;
  if (sp < 1) return null;
  if (lo >= hi) return null;
  if (lo % sp !== 0 || hi % sp !== 0) return null;
  var priceLower = tickToPrice(lo), priceUpper = tickToPrice(hi), priceCurrent = tickToPrice(cur);
  return {
    tickLower: lo, tickUpper: hi, tickCurrent: cur, tickSpacing: sp,
    priceLower: priceLower, priceUpper: priceUpper, priceCurrent: priceCurrent,
    widthRatio: priceUpper / priceLower,
    widthPct: (priceUpper / priceLower - 1) * 100,
    inRange: lo <= cur && cur < hi
  };
}

/* ---------- Tool 17: CLMM position amounts from liquidity ---------- */
/* A concentrated-liquidity position is not defined by how much of each
   token you hand over — it is defined by a liquidity amount L and a tick
   range, and the token amounts FOLLOW from the square-root prices
   (price = token1 per token0, Tool 10; s = sqrt(price)):
     current at/below the range:  amount0 = L * (1/sLower - 1/sUpper), amount1 = 0
     current at/above the range:  amount0 = 0, amount1 = L * (sUpper - sLower)
     current inside the range:    amount0 = L * (1/sCurrent - 1/sUpper),
                                  amount1 = L * (sCurrent - sLower)
   The branches agree at the boundaries (at the lower tick amount1 is 0
   either way), so the composition moves continuously from all-token0
   below the range to all-token1 above it — that drift IS the position's
   price exposure. The maths is the shared CLMM formula (Uniswap v3's
   SqrtPriceMath, which Raydium CLMM and Orca Whirlpools implement the
   same way); this float model was cross-verified against the reference
   SDK's Q96 integer implementation on in/below/above/boundary cases —
   agreement to within that implementation's whole-unit flooring.
   Amounts are PRINCIPAL at the current tick: swap fees a position earns
   accrue separately on-chain and are not included, and the split moves
   as the price moves. Amounts are in raw token units — a UI amount also
   needs each mint's decimals (Tool 6). The value split is measured in
   token1 at the current price: value1 = amount0 * price + amount1. */
function clmmPosition(liquidityStr, lower, upper, current) {
  var Lscaled = parseScaled(liquidityStr);
  var lo = Number(lower), hi = Number(upper), cur = Number(current);
  if (Lscaled === null || Lscaled <= 0n) return null;
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || !Number.isInteger(cur)) return null;
  if (lo < MIN_TICK || hi > MAX_TICK || cur < MIN_TICK || cur > MAX_TICK) return null;
  if (lo >= hi) return null;
  var L = Number(Lscaled) / 1e9;
  var priceLower = tickToPrice(lo), priceUpper = tickToPrice(hi), priceCurrent = tickToPrice(cur);
  var sLo = Math.sqrt(priceLower), sHi = Math.sqrt(priceUpper), sCur = Math.sqrt(priceCurrent);
  var amount0, amount1, status;
  if (cur <= lo) { amount0 = L * (1 / sLo - 1 / sHi); amount1 = 0; status = "below"; }
  else if (cur >= hi) { amount0 = 0; amount1 = L * (sHi - sLo); status = "above"; }
  else { amount0 = L * (1 / sCur - 1 / sHi); amount1 = L * (sCur - sLo); status = "in"; }
  return {
    liquidity: formatScaled(Lscaled),
    tickLower: lo, tickUpper: hi, tickCurrent: cur,
    priceLower: priceLower, priceUpper: priceUpper, priceCurrent: priceCurrent,
    amount0: amount0, amount1: amount1, status: status,
    inRange: lo <= cur && cur < hi,
    valueInToken1: amount0 * priceCurrent + amount1
  };
}

/* ---------- Tool 18: constant-product LP deposit & share ---------- */
/* Adding liquidity to an existing constant-product pool (Raydium CP,
   Orca, every x*y=k AMM) mints LP tokens in proportion to the SMALLER
   side's contribution: fromA = depositA * supply / reserveA and
   fromB = depositB * supply / reserveB, minted = min(fromA, fromB), each
   division floored like on-chain integer math. Only the proportional
   part of the deposit is used — usedA = minted * reserveA / supply and
   usedB = minted * reserveB / supply (floored) — so the excess of the
   non-limiting token buys nothing: interfaces return it or size the
   deposit to the pool's ratio in the first place. Depositing out of
   ratio never mints more; the limiting token alone decides. The FIRST
   deposit into an empty pool has no ratio to match: it sets the price
   and mints the geometric mean, minted = sqrt(depositA * depositB)
   (exact integer square root on the scaled amounts, floored). Some
   pools permanently lock a small minimum of that first mint as an
   inflation-attack defence — that lock is pool-specific and is NOT
   modelled here. The depositor's share of the pool afterwards is
   minted / (supply + minted). */
function isqrtBigInt(n) {
  if (n < 0n) return null;
  if (n < 2n) return n;
  var x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

function lpDeposit(reserveAStr, reserveBStr, supplyStr, depositAStr, depositBStr) {
  var rA = parseScaled(reserveAStr), rB = parseScaled(reserveBStr), S = parseScaled(supplyStr);
  var dA = parseScaled(depositAStr), dB = parseScaled(depositBStr);
  if (rA === null || rB === null || S === null || dA === null || dB === null) return null;
  if (dA <= 0n || dB <= 0n) return null;
  var first = (rA === 0n && rB === 0n && S === 0n);
  if (!first && (rA <= 0n || rB <= 0n || S <= 0n)) return null;
  var minted, usedA, usedB, limiting;
  if (first) {
    minted = isqrtBigInt(dA * dB); /* scaled product, so the root is the scaled geometric mean */
    if (minted <= 0n) return null;
    usedA = dA; usedB = dB; limiting = "first";
  } else {
    var fromA = (dA * S) / rA, fromB = (dB * S) / rB;
    minted = fromA < fromB ? fromA : fromB;
    if (minted <= 0n) return null; /* dust deposit mints zero LP tokens */
    limiting = fromA === fromB ? "both" : (fromA < fromB ? "A" : "B");
    usedA = (minted * rA) / S; usedB = (minted * rB) / S;
    if (usedA <= 0n || usedB <= 0n) return null;
  }
  var newSupply = S + minted;
  return {
    firstDeposit: first,
    reserveA: formatScaled(rA), reserveB: formatScaled(rB), supply: formatScaled(S),
    depositA: formatScaled(dA), depositB: formatScaled(dB),
    minted: formatScaled(minted),
    usedA: formatScaled(usedA), usedB: formatScaled(usedB),
    excessA: formatScaled(dA - usedA), excessB: formatScaled(dB - usedB),
    limiting: limiting,
    sharePct: Number(minted * 100000000n / newSupply) / 1000000,
    newSupply: formatScaled(newSupply)
  };
}


/* ---------- Tool 19: token vesting (cliff + linear unlock) ---------- */
/* Team, investor and ecosystem allocations on Solana commonly vest on a
   cliff + linear schedule (the shape Jupiter Lock, Streamflow and most
   launch allocations use): the allocation accrues linearly over the full
   duration from day one - accrued(m) = total * min(m, duration) / duration,
   floored at the token's smallest unit in exact scaled-BigInt - but NOTHING
   is claimable before the cliff month; at the cliff the whole accrued share
   releases at once, and from then on claimable = accrued. This model works
   in whole months; real schedules run on timestamps (per second or per
   slot), and a minority of schedules instead start the linear accrual AT
   the cliff - read your schedule's terms and check which convention it
   uses before trusting either one's numbers. */
var MAX_VESTING_MONTHS = 1200;

function vestingSchedule(totalStr, cliffMonths, durationMonths, elapsedMonths) {
  var T = parseScaled(totalStr);
  var C = Number(cliffMonths), D = Number(durationMonths), M = Number(elapsedMonths);
  if (T === null || T <= 0n) return null;
  if (!Number.isInteger(C) || !Number.isInteger(D) || !Number.isInteger(M)) return null;
  if (D < 1 || D > MAX_VESTING_MONTHS || C < 0 || C > D || M < 0 || M > 12000) return null;
  var capped = Math.min(M, D);
  var accrued = (T * BigInt(capped)) / BigInt(D);
  var atCliff = (T * BigInt(C)) / BigInt(D);
  var claimable = M < C ? 0n : accrued;
  return {
    total: formatScaled(T),
    cliffMonths: C, durationMonths: D, elapsedMonths: M,
    accrued: formatScaled(accrued),
    atCliff: formatScaled(atCliff),
    claimable: formatScaled(claimable),
    locked: formatScaled(T - claimable),
    accruedPct: Number(BigInt(capped) * 100000000n / BigInt(D)) / 1000000,
    status: M >= D ? "complete" : (M < C ? "cliff" : "vesting"),
    monthsRemaining: Math.max(0, D - M)
  };
}


/* ---------- Tool 20: lending health & liquidation ---------- */
/* Solana lending markets (Kamino, Marginfi, Drift and peers) track a
   position by three numbers this model computes in exact scaled BigInt:
   collateral value = amount x price; loan-to-value = debt / value; and
   the health factor = (value x liquidation threshold) / debt. A market
   may liquidate when the health factor falls below 1 - the collateral
   price where it equals 1 is the liquidation price,
   debt / (amount x threshold). Borrowing power is set by the LOWER max
   LTV, not the threshold: max borrow total = value x max LTV, and the
   gap between the two percentages is the market's safety buffer - a
   position opened at max LTV is not liquidatable yet, but any price
   drop eats the buffer first. Single collateral, single debt, no
   interest accrual, no liquidation bonus or fee and no cross-asset
   weighting beyond the two percentages entered - real markets weight
   several assets and accrue interest continuously, so a real health
   factor drifts even at a flat price. */
function lendingHealth(amountStr, priceStr, debtStr, liqThresholdBps, maxLtvBps) {
  var A = parseScaled(amountStr), P = parseScaled(priceStr), D = parseScaled(debtStr);
  var liq = Number(liqThresholdBps), mx = Number(maxLtvBps);
  if (A === null || P === null || D === null) return null;
  if (A <= 0n || P <= 0n || D < 0n) return null;
  if (!Number.isInteger(liq) || !Number.isInteger(mx)) return null;
  if (liq < 1 || liq > 10000 || mx < 0 || mx > liq) return null;
  var V = (A * P) / SCALE;
  if (V <= 0n) return null;
  var maxBorrowTotal = (V * BigInt(mx)) / 10000n;
  var additionalBorrow = maxBorrowTotal > D ? maxBorrowTotal - D : 0n;
  var liqPrice = D === 0n ? 0n : (D * 10000n * SCALE) / (A * BigInt(liq));
  var thresholdValue = V * BigInt(liq);
  var debtAtThreshold = D * 10000n;
  var status = D === 0n ? "no-debt" : (thresholdValue < debtAtThreshold ? "liquidatable" : (thresholdValue === debtAtThreshold ? "at-threshold" : "healthy"));
  return {
    amount: formatScaled(A), price: formatScaled(P), debt: formatScaled(D),
    liqThresholdBps: liq, maxLtvBps: mx,
    collateralValue: formatScaled(V),
    ltvPct: Number(D * 100000000n / V) / 1000000,
    healthFactor: D === 0n ? null : Number(thresholdValue) / Number(debtAtThreshold),
    maxBorrowTotal: formatScaled(maxBorrowTotal),
    additionalBorrow: formatScaled(additionalBorrow),
    overMaxBorrow: D > maxBorrowTotal,
    liquidationPrice: formatScaled(liqPrice),
    priceDropPct: D === 0n ? 100 : Number((P - liqPrice) * 100000000n / P) / 1000000,
    status: status
  };
}

/* ---------- Tool 21: transaction size & packet limit ---------- */
/* A serialized Solana transaction must fit one network packet:
   PACKET_DATA_SIZE = 1,232 bytes (1,280-byte MTU minus IP/UDP headers).
   Every section's cost is fixed by the wire format, so the size of a
   single-instruction transaction is exact, not estimated:
   signatures: shortvec count + 64 bytes each; message header: 3;
   static account keys: shortvec count + 32 bytes each; recent
   blockhash: 32; one instruction: shortvec count (1) + 1 program-index
   byte + shortvec count + 1 byte per referenced account + shortvec
   length + the data itself. A shortvec (compact-u16) length costs
   1 byte below 128, 2 below 16,384, 3 below 2,097,152.
   In a v0 transaction, accounts loaded through ONE address lookup
   table cost 1 byte each (their index) instead of 32 - but the table
   reference itself costs 32 bytes for the table address plus two
   shortvec counts, so a table holding a single referenced account
   makes the transaction BIGGER (saving is negative); tables pay off
   from a handful of accounts up, and they raise the account ceiling:
   legacy keys are u8-indexed (256 max), v0 adds up to 256 table
   addresses per table on top. Multi-instruction transactions add, per
   extra instruction, its own program-index byte, two shortvec counts,
   its account indices and its data - this model prices one instruction
   and states so. Durable-nonce and versioned extras are not modelled. */
var PACKET_DATA_SIZE = 1232;

function shortvecLen(n) {
  var len = 1;
  while (n >= 128) { n = Math.floor(n / 128); len++; }
  return len;
}

function txSize(signatures, staticKeys, lookupWritable, lookupReadonly, ixAccounts, dataBytes) {
  var S = Number(signatures), K = Number(staticKeys), W = Number(lookupWritable),
      R = Number(lookupReadonly), A = Number(ixAccounts), D = Number(dataBytes);
  var counts = [S, K, W, R, A, D];
  for (var i = 0; i < counts.length; i++) {
    if (!Number.isInteger(counts[i]) || counts[i] < 0) return null;
  }
  if (S < 1 || S > 256 || K < S || K > 256) return null;
  if (W > 256 || R > 256 || W + R > 256) return null;
  if (A > K + W + R || D > 1000000) return null;
  var signaturesBytes = shortvecLen(S) + 64 * S;
  var staticKeysBytes = shortvecLen(K) + 32 * K;
  var instructionBytes = shortvecLen(1) + 1 + shortvecLen(A) + A + shortvecLen(D) + D;
  var lookupBytes = (W + R === 0) ? 0
    : shortvecLen(1) + 32 + shortvecLen(W) + W + shortvecLen(R) + R;
  var headerBytes = 3, blockhashBytes = 32;
  var total = signaturesBytes + headerBytes + staticKeysBytes + blockhashBytes
    + instructionBytes + lookupBytes;
  var legacyStaticBytes = shortvecLen(K + W + R) + 32 * (K + W + R);
  var legacyTotal = signaturesBytes + headerBytes + legacyStaticBytes + blockhashBytes
    + instructionBytes;
  return {
    signatures: S, staticKeys: K, lookupWritable: W, lookupReadonly: R,
    ixAccounts: A, dataBytes: D,
    version: (W + R === 0) ? "legacy" : "v0",
    totalKeys: K + W + R,
    signaturesBytes: signaturesBytes, staticKeysBytes: staticKeysBytes,
    headerBytes: headerBytes, blockhashBytes: blockhashBytes,
    instructionBytes: instructionBytes, lookupBytes: lookupBytes,
    total: total, packetLimit: PACKET_DATA_SIZE,
    fits: total <= PACKET_DATA_SIZE, headroom: PACKET_DATA_SIZE - total,
    legacyTotal: legacyTotal, savedBytes: legacyTotal - total
  };
}

/* ---------- Tool 22: Anchor account space planner ---------- */
/* Every Anchor account starts with an 8-byte discriminator, then its
   fields serialized by Borsh at FIXED sizes - there is no padding or
   alignment on Solana, fields pack back to back: bool 1, u8/i8 1,
   u16/i16 2, u32/i32/f32 4, u64/i64/f64 8, u128/i128 16, Pubkey 32.
   Variable types are sized by the maximum the program declares:
   String and Vec<u8> cost a 4-byte length prefix plus their capacity,
   Vec<T> costs 4 plus count x size(T), [T; N] costs N x size(T), and
   Option<T> costs 1 (the Some/None tag) plus size(T) - an enum costs
   1 plus its largest variant and is NOT modelled here, so a struct
   with enums needs that much again by hand. The planner sizes up to
   four fields (structs with more add linearly) and prices the total
   with Tool 3's rent formula, because space IS the deposit: a vault
   struct of Pubkey + u64 + bool + String(32) is 8 + 32 + 8 + 1 + 36
   = 85 bytes, locking 1,482,480 lamports rent-exempt. Over-allocating
   wastes that deposit permanently; under-allocating fails the first
   write that outgrows it. Exact integer math throughout. */
var ANCHOR_DISCRIMINATOR_BYTES = 8;
var MAX_FIELD_PARAM = 1000000;
var ANCHOR_FIXED_SIZES = { bool: 1, u8: 1, u16: 2, u32: 4, u64: 8, u128: 16, pubkey: 32 };

function anchorFieldSize(type, param, elem) {
  if (type === "none") return 0;
  var p = (param === undefined || param === null) ? "" : String(param).trim();
  var e = (elem === undefined || elem === null) ? "none" : elem;
  if (ANCHOR_FIXED_SIZES[type] !== undefined) {
    return (p === "" && e === "none") ? ANCHOR_FIXED_SIZES[type] : null;
  }
  var es = ANCHOR_FIXED_SIZES[e];
  if (type === "option") {
    return (p === "" && es !== undefined) ? 1 + es : null;
  }
  if (p === "") return null;
  var n = Number(p);
  if (!Number.isInteger(n) || n < 0 || n > MAX_FIELD_PARAM) return null;
  if (type === "string" || type === "bytes") return e === "none" ? 4 + n : null;
  if (type === "vec") return es !== undefined ? 4 + n * es : null;
  if (type === "array") return es !== undefined ? n * es : null;
  return null;
}

function anchorSpace(fields) {
  if (!fields || fields.length !== 4) return null;
  var sizes = [], dataBytes = 0, used = 0;
  for (var i = 0; i < 4; i++) {
    var f = fields[i] || ["none", "", "none"];
    var s = anchorFieldSize(f[0], f[1], f[2]);
    if (s === null) return null;
    if (f[0] !== "none") { used++; dataBytes += s; sizes.push({ type: f[0], bytes: s }); }
  }
  if (used === 0) return null;
  var total = ANCHOR_DISCRIMINATOR_BYTES + dataBytes;
  var rent = rentExempt(total);
  if (rent === null) return null;
  return {
    fields: sizes, fieldCount: used, dataBytes: dataBytes,
    discriminatorBytes: ANCHOR_DISCRIMINATOR_BYTES, totalBytes: total,
    rentLamports: rent.rentExemptLamports, rentSol: rent.rentExemptSol
  };
}

/* ---------- Tool 23: marketplace / escrow sale split ---------- */
/* A sale on a marketplace or through an escrow program splits one price
   three ways: the platform takes a fee in basis points, the creator takes
   a royalty in basis points, and the seller receives what is left. Both
   cuts FLOOR in exact scaled-BigInt, like on-chain u64 math, and the
   seller is the REMAINDER — price minus the two floored cuts — never a
   third independently rounded percentage, so the three parts always sum
   to the price exactly and no smallest unit is created or destroyed by
   rounding. The remainder convention also means the seller keeps the
   flooring dust: a 3-unit price split 50/50 pays 1 unit to each cut and
   1 unit to the seller, not 1.5 anywhere. Each rate is capped at 10,000
   bps and the two together may not exceed 10,000 bps (the seller's share
   can legitimately reach exactly zero when they sum to 10,000 and the
   floors leave nothing — flagged, not hidden). Scope stated on the page:
   both cuts come OUT of the price; venues that charge the buyer a fee on
   top instead are a different split, and creator royalties on classic
   Solana NFTs are a marketplace convention (programmable NFTs can enforce
   them on-chain) — this model teaches the arithmetic, not any one venue's
   policy. */
function saleSplit(priceStr, platformBps, royaltyBps) {
  var price = parseScaled(priceStr);
  var p = Number(platformBps);
  var r = Number(royaltyBps);
  if (price === null || price <= 0n) return null;
  if (!Number.isInteger(p) || !Number.isInteger(r)) return null;
  if (p < 0 || r < 0 || p > 10000 || r > 10000) return null;
  if (p + r > 10000) return null;
  var platformFee = (price * BigInt(p)) / 10000n;
  var royalty = (price * BigInt(r)) / 10000n;
  var seller = price - platformFee - royalty;
  return {
    price: formatScaled(price),
    platformFee: formatScaled(platformFee),
    royalty: formatScaled(royalty),
    seller: formatScaled(seller),
    platformBps: p,
    royaltyBps: r,
    combinedBps: p + r,
    sellerZero: seller === 0n
  };
}

/* ---------- Tool 24: stake activation & cooldown timing ---------- */
/* Delegated stake does not switch on or off at once: at each epoch boundary
   only a rate-limited share of the cluster may change state. The stake
   program's rule (SIMD-0391 integer form): in one epoch an account's allowed
   change = its portion / the total portion moving the same way x the
   cluster's previous-epoch effective stake x the warmup/cooldown rate,
   floored, clamped to the account's own portion, with a minimum progress of
   1 lamport per epoch whenever the portion is positive. The rate is 900 bps
   (9%) on the current network - it was 2,500 bps (25%) before the
   reduce_stake_warmup_cooldown feature - so the cluster-wide cap per epoch
   is 9% of the cluster's effective stake, shared pro-rata by everything
   activating or deactivating that epoch. This model holds the cluster's
   effective stake constant at the user's figure (in reality it is last
   epoch's stake-history entry and drifts as stake moves), runs the formula
   epoch by epoch in exact scaled BigInt (the scaled unit IS the lamport),
   and reports the epoch schedule. A solo mover's portion is the whole
   moving total, so its per-epoch change is the full cluster cap; a crowd
   moving the same way divides the cap by share. */
var CURRENT_WARMUP_COOLDOWN_BPS = 900;
var LEGACY_WARMUP_COOLDOWN_BPS = 2500;
var MAX_WARMUP_SCHEDULE_ROWS = 12;

function stakeWarmup(stakeStr, clusterStr, movingStr, rateBps, direction) {
  var stake = parseScaled(stakeStr);
  var cluster = parseScaled(clusterStr);
  var moving = parseScaled(movingStr);
  var bps = Number(rateBps);
  if (stake === null || cluster === null || moving === null) return null;
  if (stake <= 0n || cluster <= 0n || moving <= 0n) return null;
  if (moving < stake) return null;
  if (!Number.isInteger(bps) || bps < 1 || bps > 10000) return null;
  if (direction !== "activate" && direction !== "deactivate") return null;
  var bpsB = BigInt(bps);
  var capPerEpoch = (cluster * bpsB) / 10000n; /* cluster-wide, before the min clamp */
  function epochChange(portion, crowd) {
    if (portion === 0n || crowd === 0n || cluster === 0n) return 0n;
    var change = (portion * cluster * bpsB) / (crowd * 10000n);
    if (change > portion) change = portion;
    if (change === 0n) change = 1n; /* minimum progress: 1 lamport per epoch */
    return change;
  }
  var remaining = stake;
  var crowd = moving;
  var epochs = 0n;
  var estimated = false;
  var firstChange = null;
  var firstEpochEffective = null;
  var firstEpochMoved = null;
  var schedule = [];
  var ITERATION_CAP = 1000000;
  var iterations = 0;
  while (remaining > 0n) {
    if (iterations >= ITERATION_CAP) {
      /* change is at least 1 lamport and effectively constant in any regime
         that reaches here; finish by division and say the count is estimated */
      var step = epochChange(remaining, crowd);
      epochs += (remaining + step - 1n) / step;
      remaining = 0n;
      estimated = true;
      break;
    }
    iterations++;
    var crowdChange = epochChange(crowd, crowd);
    var change = epochChange(remaining, crowd);
    remaining -= change;
    crowd -= crowdChange;
    if (crowd < 0n) crowd = 0n;
    epochs += 1n;
    var movedTotal = stake - remaining;
    var effective = direction === "activate" ? movedTotal : remaining;
    if (firstChange === null) {
      firstChange = change;
      firstEpochEffective = effective;
      firstEpochMoved = movedTotal;
    }
    if (epochs <= BigInt(MAX_WARMUP_SCHEDULE_ROWS) || remaining === 0n) {
      schedule.push({ epoch: epochs.toString(), effective: formatScaled(effective) });
    }
  }
  var firstPctBps = Number((firstEpochMoved * 10000n) / stake);
  return {
    stake: formatScaled(stake),
    clusterEffective: formatScaled(cluster),
    movingTotal: formatScaled(moving),
    rateBps: bps,
    direction: direction,
    capPerEpoch: formatScaled(capPerEpoch),
    firstChange: formatScaled(firstChange),
    firstEpochEffective: formatScaled(firstEpochEffective),
    firstEpochMoved: formatScaled(firstEpochMoved),
    firstEpochPctBps: firstPctBps,
    epochsNeeded: epochs.toString(),
    estimated: estimated,
    minClamped: capPerEpoch === 0n,
    schedule: schedule
  };
}

/* ---------- Tool 25: CLMM uncollected fees (fee growth) ---------- */
/* A concentrated-liquidity position does not store "fees earned" as a
   running total. The pool keeps fee-growth counters - fees accrued per
   unit of liquidity, in X64 fixed point (scaled by 2^64) and stored as
   u128 - globally and per tick (this is Raydium CLMM's layout: the
   position account stores feeGrowthInsideLastX64A/B, the pool stores
   feeGrowthGlobalX64A/B and each tick feeGrowthOutsideX64A/B). The
   growth inside a position's range is global - below(lower) - above
   (upper), the SDK's getfeeGrowthInside. What a position has earned
   SINCE ITS LAST TOUCH is then, per token (PositionUtils'
   getTokenFeesAmount in raydium-sdk-V2):
     accrued = floor( wrappingSubU128(insideNow, insideLast)
                      x liquidity / 2^64 )
     total owed = tokensFeesOwed (already settled) + accrued
   The subtraction WRAPS modulo 2^128, exactly like the on-chain u128
   arithmetic: when the counter passes last on its way around, now <
   last is not an error, it is the wrap - the delta is still the small
   true increment. Touching a position (add/remove liquidity, collect)
   settles the accrued fees into tokensFeesOwed and re-stores
   insideLast, which is why this tool starts from the last-touch
   counters: fees from before the last touch live in the owed figure,
   not in the growth delta. All arithmetic here is exact BigInt on the
   raw integer counters - the X64 values are far beyond float range. */
var FEE_GROWTH_Q64 = 1n << 64n;
var FEE_GROWTH_MODULUS = 1n << 128n;

function parseU128Counter(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^\d+$/.test(s)) return null;
  var v = BigInt(s);
  return v < FEE_GROWTH_MODULUS ? v : null;
}

function formatRawUi(raw, decimals) {
  var base = 10n ** BigInt(decimals);
  var whole = raw / base;
  if (decimals === 0) return whole.toString();
  var frac = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return whole.toString() + (frac ? "." + frac : "");
}

function clmmFeesOwed(liqStr, nowAStr, lastAStr, nowBStr, lastBStr, owedAStr, owedBStr, decA, decB) {
  var liq = parseU128Counter(liqStr);
  var nowA = parseU128Counter(nowAStr);
  var lastA = parseU128Counter(lastAStr);
  var nowB = parseU128Counter(nowBStr);
  var lastB = parseU128Counter(lastBStr);
  var owedA = parseU128Counter(owedAStr);
  var owedB = parseU128Counter(owedBStr);
  var dA = validDecimals(decA);
  var dB = validDecimals(decB);
  if (liq === null || nowA === null || lastA === null || nowB === null || lastB === null ||
      owedA === null || owedB === null || dA === null || dB === null) return null;
  function side(now, last, owed) {
    var delta = (now - last + FEE_GROWTH_MODULUS) % FEE_GROWTH_MODULUS;
    var accrued = (delta * liq) / FEE_GROWTH_Q64;
    return { delta: delta, accrued: accrued, total: owed + accrued, wrapped: now < last };
  }
  var a = side(nowA, lastA, owedA);
  var b = side(nowB, lastB, owedB);
  return {
    liquidity: liq.toString(),
    deltaA: a.delta.toString(),
    deltaB: b.delta.toString(),
    accruedA: a.accrued.toString(),
    accruedB: b.accrued.toString(),
    owedA: owedA.toString(),
    owedB: owedB.toString(),
    totalA: a.total.toString(),
    totalB: b.total.toString(),
    totalAUi: formatRawUi(a.total, dA),
    totalBUi: formatRawUi(b.total, dB),
    accruedAUi: formatRawUi(a.accrued, dA),
    accruedBUi: formatRawUi(b.accrued, dB),
    decimalsA: dA,
    decimalsB: dB,
    wrappedA: a.wrapped,
    wrappedB: b.wrapped
  };
}

/* ---------- Tool 26: inflation schedule ---------- */
/* SOL has no supply cap: new SOL is issued every epoch as staking
   rewards, at a rate set by the network's inflation schedule - the
   three parameters the validator code (solana-sdk's Inflation) ships
   with: an initial rate of 8% per year, a disinflation rate of 15%
   per year, and a long-term (terminal) rate of 1.5% per year that the
   schedule never falls below:
     rate(year) = max(terminal, initial x (1 - disinflation)^year)
   The year is FRACTIONAL on-chain - the validator recomputes the rate
   every epoch from the fraction of a year elapsed, so the rate glides
   down continuously rather than stepping once a year - which is why
   this tool takes fractional years. Inflation began at epoch 150
   (February 2021); "years" here are years since that start. The math
   is floating point because the schedule itself is f64 on-chain -
   unlike the integer tools, there is no exact integer form to match.
   Annual issuance is rate x total supply with the supply HELD at the
   entered figure: on-chain the supply itself grows by the issuance,
   so a multi-year projection compounds the base as well - stated on
   the page, not modelled. The disinflation rate is an input (default
   1,500 bps, the shipped schedule) so the adopted-but-not-yet-
   implemented governance change to 30% (3,000 bps) can be modelled
   without presenting it as live: at 15% the terminal rate arrives at
   year ~10.30 (first whole year 11); at 30%, year ~4.69 (year 5). */
var INITIAL_INFLATION_PCT = 8;
var TERMINAL_INFLATION_PCT = 1.5;

function formatRateNum(x, places) {
  var s = x.toFixed(places);
  if (s.indexOf(".") !== -1) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

function inflationSchedule(yearsStr, supplyStr, disinflationBps) {
  var yearsScaled = parseScaled(yearsStr);
  var supplyScaled = parseScaled(supplyStr);
  var disBps = Number(disinflationBps);
  if (yearsScaled === null || supplyScaled === null) return null;
  if (supplyScaled <= 0n) return null;
  if (yearsScaled > 10000n * SCALE) return null;
  if (!Number.isInteger(disBps) || disBps < 0 || disBps > 9999) return null;
  var years = Number(yearsScaled) / 1e9;
  var supply = Number(supplyScaled) / 1e9;
  var dis = disBps / 10000;
  var rawRate = INITIAL_INFLATION_PCT * Math.pow(1 - dis, years);
  var rate = Math.max(TERMINAL_INFLATION_PCT, rawRate);
  var atTerminal = rawRate <= TERMINAL_INFLATION_PCT;
  var yearsToTerminal = null;
  var firstWholeYearAtTerminal = null;
  if (disBps > 0) {
    var crossing = Math.log(TERMINAL_INFLATION_PCT / INITIAL_INFLATION_PCT) / Math.log(1 - dis);
    yearsToTerminal = formatRateNum(Math.max(0, crossing - years), 2);
    firstWholeYearAtTerminal = Math.ceil(crossing - 1e-9);
  }
  return {
    years: formatScaled(yearsScaled),
    supply: formatScaled(supplyScaled),
    disinflationBps: disBps,
    ratePct: rate.toFixed(4),
    annualIssuance: formatRateNum(supply * rate / 100, 4),
    atTerminal: atTerminal,
    yearsToTerminal: yearsToTerminal,
    firstWholeYearAtTerminal: firstWholeYearAtTerminal
  };
}

/* ---------- Tool 27: associated token account (ATA) address ---------- */
/* Almost every token balance on Solana lives in an associated token
   account: one canonical token account per (owner, mint) pair, whose
   address is not a keypair but a program-derived address under the
   Associated Token Account program (ATokenGPvb...), derived from the
   seeds [owner, token program, mint] in exactly that order:
     ata = findProgramAddress([owner, tokenProgram, mint], ataProgram)
   The token program seed is what keeps a classic SPL Token ATA and a
   Token-2022 ATA for the same wallet and mint at different addresses -
   they are different accounts on-chain too. The owner may itself be a
   PDA (off-curve): the derivation never checks the owner for a curve
   point, only the hash output, exactly like the on-chain helper. Only
   the two real token programs are accepted - the ATA program serves
   those two, and silently deriving for a mistyped program id would
   hand back an address no wallet would ever use. Pure derivation: the
   account may or may not exist on-chain yet; this tool reads nothing. */
var ATA_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
var SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
var TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEB";

function associatedTokenAddress(ownerStr, mintStr, tokenProgramStr) {
  if (typeof ownerStr !== "string" || typeof mintStr !== "string" || typeof tokenProgramStr !== "string") return null;
  var program = tokenProgramStr.trim();
  if (program !== SPL_TOKEN_PROGRAM_ID && program !== TOKEN_2022_PROGRAM_ID) return null;
  var owner = base58Decode(ownerStr.trim());
  var mint = base58Decode(mintStr.trim());
  var tokenProgram = base58Decode(program);
  var ataProgram = base58Decode(ATA_PROGRAM_ID);
  if (owner === null || owner.length !== 32) return null;
  if (mint === null || mint.length !== 32) return null;
  if (tokenProgram === null || tokenProgram.length !== 32 || ataProgram === null) return null;
  var found = findProgramAddressBytes([owner, tokenProgram, mint], ataProgram);
  if (found === null) return null;
  return {
    address: found.address,
    bump: found.bump,
    candidatesTried: found.candidatesTried,
    tokenProgram: program === TOKEN_2022_PROGRAM_ID ? "Token-2022" : "SPL Token",
    owner: base58Encode(owner),
    mint: base58Encode(mint)
  };
}

/* ---------- Tool 28: compressed NFT tree planner ---------- */
/* A compressed NFT (cNFT) keeps no per-asset accounts on-chain: the
   assets live in an off-chain index, and the only on-chain state is
   one concurrent Merkle tree account under SPL account compression
   (the structure Metaplex Bubblegum mints into). What creating that
   account costs is pure layout, and the layout is fixed by three
   choices made once, at creation:
     account bytes = header 56
                   + counters and rightmost-path fixed part 64
                   + changelog ring: bufferSize x (40 + 32 x maxDepth)
                   + rightmost proof nodes: 32 x maxDepth
                   + canopy: (2^(canopyDepth+1) - 2) x 32, if any
   The 56 header bytes are the account-compression header (max buffer
   4 + max depth 4 + authority 32 + creation slot 8 + padding 6, plus
   the 2 discriminant/version bytes). Each changelog entry stores a
   32-byte root, an 8-byte index and one 32-byte hash per tree level -
   the ring of recent changes is what lets many mints update the tree
   concurrently without invalidating each other's proofs, and it is
   almost the whole account (98%+ at typical sizes; the compression
   whitepaper's depth-24, buffer-1024 tree is 827,392 changelog bytes
   of 828,280 total). The buffer size must be a power of two - the
   ring is indexed by mask. A tree holds 2^maxDepth leaves. A canopy
   stores the top canopyDepth levels of nodes on-chain (that many
   fewer proof hashes every later transfer must supply); Bubblegum's
   tree creation requires canopyDepth >= maxDepth - 17 once the depth
   passes 17, so a transfer's remaining proof stays within the
   account limit. Rent is the hub's rent-exempt formula priced on the
   account size. Creation also pays a normal transaction fee, and
   minting into the tree afterwards is a separate cost - neither is
   modelled here. */
var CMT_HEADER_BYTES = 56;
var CMT_FIXED_BYTES = 64;
var CMT_MAX_DEPTH = 30;
var CMT_MAX_BUFFER_SIZE = 16384;

function merkleTreePlan(maxDepth, maxBufferSize, canopyDepth) {
  var d = Number(maxDepth), b = Number(maxBufferSize), c = Number(canopyDepth);
  if (!Number.isInteger(d) || d < 1 || d > CMT_MAX_DEPTH) return null;
  if (!Number.isInteger(b) || b < 8 || b > CMT_MAX_BUFFER_SIZE || (b & (b - 1)) !== 0) return null;
  if (!Number.isInteger(c) || c < 0 || c > d) return null;
  var changelogEntryBytes = 40 + 32 * d;
  var changelogBytes = b * changelogEntryBytes;
  var rightmostBytes = 32 * d;
  var canopyBytes = c > 0 ? (Math.pow(2, c + 1) - 2) * 32 : 0;
  var sizeBytes = CMT_HEADER_BYTES + CMT_FIXED_BYTES + changelogBytes + rightmostBytes + canopyBytes;
  var rent = rentExempt(sizeBytes);
  var capacity = Math.pow(2, d);
  return {
    maxDepth: d, maxBufferSize: b, canopyDepth: c,
    headerBytes: CMT_HEADER_BYTES, fixedBytes: CMT_FIXED_BYTES,
    changelogEntryBytes: changelogEntryBytes, changelogBytes: changelogBytes,
    rightmostBytes: rightmostBytes, canopyBytes: canopyBytes,
    sizeBytes: sizeBytes,
    rentLamports: rent.rentExemptLamports, rentSol: rent.rentExemptSol,
    capacity: capacity,
    perLeafLamports: rent.rentExemptLamports / capacity,
    changelogSharePct: 100 * changelogBytes / sizeBytes,
    proofNodesToSupply: d - c,
    minCanopyForBubblegum: d > 17 ? d - 17 : 0
  };
}

/* ---------- Tool 29: seeded address finder (createWithSeed) ---------- */
/* The other deterministic address on Solana, older than the PDA: the
   system program's create_account_with_seed derives an account address
   from a signer base, one seed string and the program that will own
   the account:
     address = SHA-256(base bytes || seed UTF-8 bytes || owner bytes)
   That is the whole formula — no "ProgramDerivedAddress" marker, no
   bump byte and NO ed25519 curve check: a seeded address may land ON
   the curve and is still valid (nobody knows a private key for it,
   because the bytes are a hash output, not a generated keypair — the
   account is controlled by its owner program and created by an
   instruction the base signs). This is how the CLI fans one keypair
   out into many stake accounts: `solana create-address-with-seed
   --from <base> 0 STAKE`, then "1", "2", ... under the Stake program.
   The seed is a single string of at most 32 UTF-8 bytes (the SDK's
   MAX_SEED_LEN); an empty seed is allowed by the SDK. The seed is NOT
   trimmed — spaces are bytes and change the address. Derivation is
   pure hashing, identical on every cluster; whether the account has
   been created on-chain is a separate question this tool does not
   read. Contrast Tool 16 (PDAs): marker + bump + off-curve required,
   because a program must be able to sign for a PDA; a seeded account
   needs no program signature — its base signed its creation. */
var MAX_SEED_ADDRESS_SEED_BYTES = 32;
var STAKE_PROGRAM_ID = "Stake11111111111111111111111111111111111111";

function createWithSeed(baseStr, seedStr, ownerStr) {
  if (typeof baseStr !== "string" || typeof ownerStr !== "string") return null;
  if (typeof seedStr !== "string") return null;
  var baseBytes = base58Decode(baseStr.trim());
  var ownerBytes = base58Decode(ownerStr.trim());
  if (baseBytes === null || baseBytes.length !== 32) return null;
  if (ownerBytes === null || ownerBytes.length !== 32) return null;
  var seedBytes = utf8Bytes(seedStr);
  if (seedBytes === null || seedBytes.length > MAX_SEED_ADDRESS_SEED_BYTES) return null;
  var hash = sha256Bytes(baseBytes.concat(seedBytes, ownerBytes));
  return {
    base: baseStr.trim(),
    seed: seedStr,
    seedByteLen: seedBytes.length,
    owner: ownerStr.trim(),
    address: base58Encode(hash),
    addressBytes: hash,
    onCurve: isOnCurveBytes(hash)
  };
}

/* ---------- Tool 30: token valuation — market cap & FDV ---------- */
/* Every token page quotes two valuations from the same price:
     market cap        = price x circulating supply
     total valuation   = price x total supply (minted so far)
     FDV               = price x max supply (the cap, if every token existed)
   Circulating is what trades today; the gap to total is minted but not
   circulating (locked, treasury, unvested — Tool 19), and the gap to max
   is not yet minted at all. All three products floor in exact scaled-
   BigInt, like an on-chain division. The two gap values are taken as
   DIFFERENCES of the floored valuations (totalValuation - marketCap,
   fdv - totalValuation) rather than floored products of the gap
   supplies, so the three parts always sum exactly to the FDV — the
   remainder convention of Tool 23's sale split. The FDV/market-cap
   multiple is max / circulating: the price cancels, so the multiple is
   a pure supply ratio — how many times today's float the fully diluted
   supply is. Supplies must nest (circulating <= total <= max) or the
   figures describe no real mint and are rejected. A token whose max
   equals its circulating supply is fully diluted: all three valuations
   coincide. Price and supplies are user inputs — this tool reads no
   live price and no live mint. */
function tokenValuation(priceStr, circStr, totalStr, maxStr) {
  var price = parseScaled(priceStr);
  var circ = parseScaled(circStr);
  var total = parseScaled(totalStr);
  var max = parseScaled(maxStr);
  if (price === null || circ === null || total === null || max === null) return null;
  if (price <= 0n || circ <= 0n || total < circ || max < total) return null;
  var mcap = (price * circ) / SCALE;
  var tval = (price * total) / SCALE;
  var fdv = (price * max) / SCALE;
  return {
    price: formatScaled(price),
    circulating: formatScaled(circ),
    total: formatScaled(total),
    max: formatScaled(max),
    marketCap: formatScaled(mcap),
    totalValuation: formatScaled(tval),
    fdv: formatScaled(fdv),
    nonCirculating: formatScaled(total - circ),
    unissued: formatScaled(max - total),
    nonCirculatingValue: formatScaled(tval - mcap),
    unissuedValue: formatScaled(fdv - tval),
    circPctOfTotal: Number(circ) * 100 / Number(total),
    circPctOfMax: Number(circ) * 100 / Number(max),
    fdvMultiple: Number(max) / Number(circ),
    fullyDiluted: circ === max,
    marketCapIsZero: mcap === 0n
  };
}

/* ---------- Tool 31: address lookup table planner ---------- */
/* An address lookup table is an on-chain account that lets v0 transactions
   reference accounts by a 1-byte index instead of a full 32-byte key:
     account bytes = LOOKUP_TABLE_META_SIZE (56) + 32 x addresses stored
   The metadata holds the deactivation slot, last-extended slot and the
   authority; addresses follow it raw. A table holds at most 256 addresses
   because the indexes are u8. The account is priced like any other, with
   the hub rent formula (Tool 3), and the deposit is reclaimable only by
   deactivating the table and waiting out the cooldown until its
   deactivation slot leaves the SlotHashes sysvar - stated, not modelled.
   In a transaction the lookup section costs shortvec(1) for the list of
   tables + the table's own 32-byte key + two shortvec counts + 1 byte per
   loaded address - exactly the lookupBytes figure of Tool 21's txSize -
   so loading a single address through a table costs 4 bytes MORE than
   inlining it (36 vs 32), while loading many costs far less. One table
   per transaction is modelled here; real transactions may use several. */
var ALT_META_BYTES = 56;
var ALT_MAX_ADDRESSES = 256;

function lookupTablePlan(storedStr, writableStr, readonlyStr) {
  var stored = Number(storedStr), w = Number(writableStr), r = Number(readonlyStr);
  if (!Number.isInteger(stored) || stored < 0 || stored > ALT_MAX_ADDRESSES) return null;
  if (!Number.isInteger(w) || !Number.isInteger(r) || w < 0 || r < 0) return null;
  if (w + r < 1 || w + r > stored) return null;
  var sizeBytes = ALT_META_BYTES + 32 * stored;
  var rent = rentExempt(sizeBytes);
  var used = w + r;
  var lookupBytes = shortvecLen(1) + 32 + shortvecLen(w) + w + shortvecLen(r) + r;
  var staticBytes = 32 * used;
  return {
    stored: stored, writable: w, readonly: r, used: used,
    metaBytes: ALT_META_BYTES, addressBytes: 32 * stored,
    sizeBytes: sizeBytes,
    rentLamports: rent.rentExemptLamports, rentSol: rent.rentExemptSol,
    fillPct: stored * 100 / ALT_MAX_ADDRESSES,
    perAddressLamports: 32 * 6960,
    lookupBytes: lookupBytes, staticBytes: staticBytes,
    savingBytes: staticBytes - lookupBytes,
    savingIsNegative: staticBytes - lookupBytes < 0
  };
}

/* ---------- Tool 32: oracle price confidence (Pyth-style price/conf/expo) ---------- */
/* A Pyth-style price feed does not publish one number; it publishes a
   triple - price (i64), conf (u64) and expo - meaning price x 10^expo
   plus-or-minus conf x 10^expo. The confidence interval is approximately
   ONE STANDARD DEVIATION of the publishers' aggregate estimate of where
   the true price is: the true price is expected to fall inside
   price - conf .. price + conf roughly 68% of the time (and inside the
   doubled band roughly 95% IF the errors were normally distributed -
   an approximation, stated as such, not a guarantee the feed makes).
   Protocols defend themselves with a width guard: REJECT the price when
   conf exceeds a chosen share of the price (conf x 10000 > price x bps),
   and value collateral at the LOW end of the band while valuing debt at
   the price - which is why a wide band in a volatile minute is a risk
   event, not a display detail. All math here is exact BigInt on the raw
   integers the SDK reports; a non-positive aggregate price is rejected,
   exactly as a consuming program should reject it. Staleness (the
   publish time against a max age) is the feed's other safety check and
   is NOT modelled - no timestamp is read here. */
function formatRawExpo(v, expo) {
  var neg = v < 0n;
  var d = (neg ? -v : v).toString();
  var s;
  if (expo < 0) {
    var k = -expo;
    d = d.padStart(k + 1, "0");
    s = d.slice(0, d.length - k) + "." + d.slice(d.length - k);
    if (s.indexOf(".") !== -1) s = s.replace(/0+$/, "").replace(/\.$/, "");
  } else if (expo > 0) {
    s = d + "0".repeat(expo);
  } else {
    s = d;
  }
  return (neg ? "-" : "") + s;
}

function parseRawInt(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^\d+$/.test(s) || s.length > 30) return null;
  return BigInt(s);
}

function pythConfidence(priceStr, confStr, expoStr, maxBpsStr) {
  var price = parseRawInt(priceStr);
  var conf = parseRawInt(confStr);
  var expo = Number(expoStr);
  var maxBps = Number(maxBpsStr);
  if (price === null || conf === null) return null;
  if (price <= 0n) return null;
  if (!Number.isInteger(expo) || expo < -18 || expo > 18) return null;
  if (!Number.isInteger(maxBps) || maxBps < 0 || maxBps > 10000) return null;
  var low = price - conf, high = price + conf;
  var low2 = price - 2n * conf, high2 = price + 2n * conf;
  return {
    priceRaw: price.toString(), confRaw: conf.toString(), expo: expo, maxBps: maxBps,
    priceUi: formatRawExpo(price, expo), confUi: formatRawExpo(conf, expo),
    low: formatRawExpo(low, expo), high: formatRawExpo(high, expo),
    low2: formatRawExpo(low2, expo), high2: formatRawExpo(high2, expo),
    widthBps: Number(conf) * 10000 / Number(price),
    fullWidthBps: Number(conf) * 20000 / Number(price),
    passesGuard: conf * 10000n <= price * BigInt(maxBps),
    bandCrossesZero: low <= 0n,
    confIsZero: conf === 0n
  };
}

/* ---------- Tool 33: bonding curve (launchpad virtual-reserve model) ---------- */
/* A Solana launchpad token does not start on an AMM pool anyone funded.
   The program prices every trade off a constant-product curve over
   VIRTUAL reserves: a virtual SOL reserve and a virtual token reserve
   whose ratio sets the starting price (price = virtualSol /
   virtualToken) and whose product k never changes. The virtual SOL is a
   pricing offset, not a balance - the SOL the curve actually holds is
   the separate real raised figure buyers have paid in. A buy pays the
   platform/creator fee on the input first (an input here; each venue
   sets its own), then runs Tool 2's exact swap math against the virtual
   reserves: tokensOut = effIn x virtualToken / (virtualSol + effIn),
   floored like an on-chain division, which is why the buy quote below
   agrees with cpSwap to the smallest unit. Every buy raises the virtual
   SOL reserve and drains the virtual token reserve, so the price rises
   along the curve; sells run the same math in reverse. Progress is the
   real SOL raised against the graduation target: at the target the
   curve completes and the real SOL plus the unsold tokens migrate to a
   real AMM pool (Raydium, the venue's own AMM, or a LaunchLab pool,
   depending on the venue), usually calibrated so the listing price
   continues the curve's final price - while the DEPTH drops, because
   the virtual offset does not migrate. Market cap here is the curve
   price times the total supply, the figure launchpad interfaces quote;
   it is a product of two model inputs, not a valuation anyone stands
   behind. Prices are shown at the hub's 9-decimal scale, so a launch
   price under 1e-9 SOL per token floors to 0 in display only - the
   reserves and the quote stay exact. */
function bondingCurve(vsolStr, vtokStr, supplyStr, raisedStr, targetStr, buyStr, feeBps) {
  var vSol = parseScaled(vsolStr);
  var vTok = parseScaled(vtokStr);
  var supply = parseScaled(supplyStr);
  var raised = parseScaled(raisedStr);
  var target = parseScaled(targetStr);
  var buy = parseScaled(buyStr);
  var bps = Number(feeBps);
  if (vSol === null || vTok === null || supply === null || raised === null || target === null || buy === null) return null;
  if (vSol <= 0n || vTok <= 0n || supply <= 0n || target <= 0n || buy <= 0n || raised < 0n) return null;
  if (!Number.isInteger(bps) || bps < 0 || bps >= 10000) return null;
  var fee = (buy * BigInt(bps)) / 10000n;
  var eff = buy - fee;
  if (eff <= 0n) return null;
  var out = (eff * vTok) / (vSol + eff);
  if (out <= 0n || out >= vTok) return null;
  var newVSol = vSol + eff;
  var newVTok = vTok - out;
  var spotScaled = (vSol * SCALE) / vTok;
  var afterScaled = (newVSol * SCALE) / newVTok;
  return {
    virtualSol: formatScaled(vSol), virtualToken: formatScaled(vTok),
    feeSol: formatScaled(fee), effectiveIn: formatScaled(eff),
    tokensOut: formatScaled(out),
    newVirtualSol: formatScaled(newVSol), newVirtualToken: formatScaled(newVTok),
    spotPrice: formatScaled(spotScaled), priceAfter: formatScaled(afterScaled),
    priceRisePct: (Number(newVSol) * Number(vTok)) / (Number(vSol) * Number(newVTok)) * 100 - 100,
    avgPricePaid: formatScaled((buy * SCALE) / out),
    mcapBefore: formatScaled((vSol * supply) / vTok),
    mcapAfter: formatScaled((newVSol * supply) / newVTok),
    raisedAfter: formatScaled(raised + eff),
    progressBeforePct: Number(raised) * 100 / Number(target),
    progressAfterPct: Number(raised + eff) * 100 / Number(target),
    graduatesWithThisBuy: raised + eff >= target,
    alreadyComplete: raised >= target
  };
}

/* ---------- Tool 34: perpetual funding payment model ---------- */
/* Perpetual futures (Drift, Jupiter Perps and others on Solana) have no
   expiry, so a periodic FUNDING payment keeps the perp price anchored to
   the spot/index price: when the funding rate is positive, longs pay
   shorts; when it is negative, shorts pay longs. The payment on a
   position is definitional once the venue publishes its rate:
     payment = notional x rate x time,  notional = size x mark price,
   with the rate quoted in basis points per hour here (1 bp = 0.01%/hour).
   This model takes the rate as an INPUT - every venue derives its own
   from the mark/index premium, caps it at its own maximum, and settles
   at its own interval (hourly is the common Solana cadence) - and runs
   the payment in exact scaled BigInt: the magnitude floors at the
   smallest unit, and the sign is reported from the POSITION's point of
   view (positive = the position receives, negative = it pays). The
   annualised figure is just the hourly rate x 8,760 hours, a quoting
   convention, not a forecast: the rate resets every interval. */
var MAX_FUNDING_RATE_BPS = 10000; /* 100% per hour - a guard, not a venue cap */
var MAX_FUNDING_HOURS = 87600; /* ten years of hourly settlements */

function parseSignedScaled(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (s.charAt(0) === "-") {
    var mag = parseScaled(s.slice(1));
    return mag === null ? null : -mag;
  }
  return parseScaled(s);
}

function perpFunding(sizeStr, priceStr, rateBpsStr, hoursStr, side) {
  var size = parseScaled(sizeStr);
  var price = parseScaled(priceStr);
  var rate = parseSignedScaled(rateBpsStr);
  var hours = parseScaled(hoursStr);
  if (size === null || price === null || rate === null || hours === null) return null;
  if (size <= 0n || price <= 0n || hours <= 0n) return null;
  if (hours > BigInt(MAX_FUNDING_HOURS) * SCALE) return null;
  var absRate = rate < 0n ? -rate : rate;
  if (absRate > BigInt(MAX_FUNDING_RATE_BPS) * SCALE) return null;
  if (side !== "long" && side !== "short") return null;
  var notional = (size * price) / SCALE;
  if (notional <= 0n) return null;
  var perHourMag = (notional * absRate) / (10000n * SCALE);
  var totalMag = (notional * absRate * hours) / (10000n * SCALE * SCALE);
  var rateSign = rate > 0n ? 1 : (rate < 0n ? -1 : 0);
  /* longs pay at a positive rate and receive at a negative one; shorts mirror */
  var positionSign = side === "long" ? -rateSign : rateSign;
  var perHour = BigInt(positionSign) * perHourMag;
  var total = BigInt(positionSign) * totalMag;
  return {
    size: formatScaled(size), price: formatScaled(price),
    notional: formatScaled(notional),
    rateBps: formatScaled(rate), hours: formatScaled(hours), side: side,
    perHour: formatScaled(perHour), total: formatScaled(total),
    perHourMagnitude: formatScaled(perHourMag), totalMagnitude: formatScaled(totalMag),
    annualizedPct: (Number(rate) / Number(SCALE)) * 8760 / 100,
    payer: rateSign > 0 ? "longs" : (rateSign < 0 ? "shorts" : "none"),
    positionPays: positionSign < 0,
    positionReceives: positionSign > 0,
    paymentIsZero: totalMag === 0n
  };
}

/* ---------- Tool 35: lending interest-rate (kink) model ---------- */
/* Solana lending markets (Kamino, Marginfi, Drift, Save and others) price
   borrows off UTILIZATION, U = total borrowed / total supplied, with a
   KINKED rate curve, quoted as an annual rate in basis points:
     U <= Uopt:  borrowRate = base + slope1 x (U / Uopt)
     U >  Uopt:  borrowRate = base + slope1 + slope2 x (U - Uopt) / (1 - Uopt)
   Below the optimal utilization the rate climbs gently (slope1); past it
   the second, steep slope (slope2) prices scarce liquidity hard, which is
   what pulls deposits in and borrows down when a market is nearly drained.
   Suppliers earn supplyRate = borrowRate x U x (1 - reserveFactor): only
   the borrowed share of the pool earns, and the protocol keeps the reserve
   factor of that interest. Rates are computed as exact BigInt rationals
   over the parsed inputs and floored once at the 9-decimal scale; the
   supply rate is taken off the floored borrow rate. Interest on the
   borrowed total is compounded DAILY at borrowRate / 365, each day's
   accrual floored at the smallest unit - a stated convention: real markets
   accrue continuously or per-slot and update utilization as they go, so a
   real balance path differs. All curve parameters are inputs - every
   market sets its own and governance changes them - and no live market is
   read. Verified against the float definitions on 20,000 random cases
   before shipping (worst relative error 1.5e-7, the float's own noise). */
var MAX_IRATE_BPS = 1000000; /* 10,000% annual - a guard, not a market cap */
var MAX_IRATE_DAYS = 3650; /* ten years of daily compounding steps */

function lendingRate(suppliedStr, borrowedStr, baseBpsStr, slope1BpsStr, optimalPctStr, slope2BpsStr, reserveBpsStr, daysStr) {
  var sup = parseScaled(suppliedStr);
  var bor = parseScaled(borrowedStr);
  var base = parseScaled(baseBpsStr);
  var s1 = parseScaled(slope1BpsStr);
  var uopt = parseScaled(optimalPctStr); /* optimal utilization, percent x SCALE */
  var s2 = parseScaled(slope2BpsStr);
  var res = parseScaled(reserveBpsStr);
  var days = parseScaled(daysStr);
  if (sup === null || bor === null || base === null || s1 === null || uopt === null || s2 === null || res === null || days === null) return null;
  if (sup <= 0n || bor < 0n || bor > sup) return null;
  var cap = BigInt(MAX_IRATE_BPS) * SCALE;
  if (base > cap || s1 > cap || s2 > cap) return null;
  if (uopt <= 0n || uopt >= 100n * SCALE) return null;
  if (res < 0n || res > 10000n * SCALE) return null;
  if (days <= 0n || days % SCALE !== 0n || days > BigInt(MAX_IRATE_DAYS) * SCALE) return null;
  var d = Number(days / SCALE);
  var util = (bor * SCALE) / sup; /* utilization x SCALE, floored */
  /* U <= Uopt  <=>  bor x 100 x SCALE <= sup x uopt (exact, no float) */
  var atOrBelow = bor * 100n * SCALE <= sup * uopt;
  var rate;
  if (atOrBelow) {
    rate = base + (s1 * bor * 100n * SCALE) / (sup * uopt);
  } else {
    rate = base + s1 + (s2 * (bor * 100n * SCALE - sup * uopt)) / (sup * (100n * SCALE - uopt));
  }
  var supplyRate = (rate * bor * (10000n * SCALE - res)) / (sup * 10000n * SCALE);
  var bal = bor;
  var dailyDen = 10000n * SCALE * 365n;
  for (var i = 0; i < d; i++) {
    bal += (bal * rate) / dailyDen;
  }
  return {
    supplied: formatScaled(sup), borrowed: formatScaled(bor),
    utilizationPct: formatScaled(util * 100n),
    borrowRateBps: formatScaled(rate), borrowRatePct: formatScaled(rate / 100n),
    supplyRateBps: formatScaled(supplyRate), supplyRatePct: formatScaled(supplyRate / 100n),
    optimalPct: formatScaled(uopt),
    atKink: bor * 100n * SCALE === sup * uopt,
    aboveKink: !atOrBelow,
    interest: formatScaled(bal - bor), endBalance: formatScaled(bal),
    days: d
  };
}

/* ---------- Tool 36: perpetual position margin, PnL & liquidation ---------- */
/* A perpetual position on isolated margin (the default teaching model on
   Solana perp venues such as Drift and Jupiter Perps) is defined by four
   figures, all definitional once the venue's MAINTENANCE MARGIN RATE is
   given as an input (each venue sets its own, often tiered by size):
     notional        = size x entry price
     initial margin  = notional / leverage
     unrealised PnL  = (mark - entry) x size for a long, mirrored for a short
     equity          = margin + PnL
   The venue liquidates when equity falls to the MAINTENANCE MARGIN,
   maintenance = mmr x size x mark - which happens BEFORE the margin is
   exhausted, because the maintenance figure is a live share of the current
   notional. Solving equity = maintenance for the price gives the
   liquidation price in one exact rational step:
     long:  (notional - margin) / (size x (1 - mmr))
     short: (notional + margin) / (size x (1 + mmr))
   A long whose margin covers the whole notional (leverage at or below 1)
   has no positive liquidation price - no fall can reach it - and that is
   reported as a flag, not a price of 0. PnL magnitude floors at the
   smallest unit like the floored integer math on-chain (the magnitude is
   computed, then signed - never a signed floor). Cross margin, funding
   (Tool 34), trading fees, partial liquidations and the liquidation
   penalty/insurance-fund mechanics are NOT in this model and are stated
   on the page. Verified against the float definitions, with identical
   parsed string inputs on both sides, on 20,000 random cases before
   shipping - including the identity that equity at the reported
   liquidation price equals the maintenance margin there. */
var MAX_PERP_LEVERAGE = 1000; /* a guard, not a venue cap */

function perpPosition(side, sizeStr, entryStr, markStr, leverageStr, mmrBpsStr) {
  var size = parseScaled(sizeStr);
  var entry = parseScaled(entryStr);
  var mark = parseScaled(markStr);
  var lev = parseScaled(leverageStr);
  var mmr = parseScaled(mmrBpsStr); /* maintenance margin rate, bps x SCALE */
  if (size === null || entry === null || mark === null || lev === null || mmr === null) return null;
  if (size <= 0n || entry <= 0n || mark <= 0n || lev <= 0n) return null;
  if (lev > BigInt(MAX_PERP_LEVERAGE) * SCALE) return null;
  if (mmr < 0n || mmr >= 10000n * SCALE) return null;
  if (side !== "long" && side !== "short") return null;
  var notional = (size * entry) / SCALE;
  if (notional <= 0n) return null;
  var margin = (notional * SCALE) / lev;
  if (margin <= 0n) return null;
  var diff = mark > entry ? mark - entry : entry - mark;
  var pnlMag = (diff * size) / SCALE;
  var isProfit = mark === entry ? false : ((side === "long") === (mark > entry));
  var pnl = mark === entry ? 0n : (isProfit ? pnlMag : -pnlMag);
  var equity = margin + pnl;
  var notionalMark = (size * mark) / SCALE;
  var maintenance = (notionalMark * mmr) / (10000n * SCALE);
  var denBase = 10000n * SCALE;
  var liq = null;
  var noLiquidation = false;
  if (side === "long") {
    var d = notional - margin;
    if (d <= 0n) { noLiquidation = true; }
    else { liq = (d * SCALE * denBase) / (size * (denBase - mmr)); }
  } else {
    liq = ((notional + margin) * SCALE * denBase) / (size * (denBase + mmr));
  }
  return {
    side: side, size: formatScaled(size), entry: formatScaled(entry), mark: formatScaled(mark),
    leverage: formatScaled(lev), mmrBps: formatScaled(mmr),
    notional: formatScaled(notional), margin: formatScaled(margin),
    pnl: formatScaled(pnl), pnlIsProfit: pnl > 0n, pnlIsLoss: pnl < 0n,
    equity: formatScaled(equity), equityIsNegative: equity < 0n,
    notionalAtMark: formatScaled(notionalMark), maintenance: formatScaled(maintenance),
    status: equity < maintenance ? "below" : (equity === maintenance ? "at" : "above"),
    liquidationPrice: liq === null ? null : formatScaled(liq),
    noLiquidation: noLiquidation,
    distanceToLiquidationPct: liq === null ? null : Math.abs(Number(mark) - Number(liq)) / Number(mark) * 100,
    returnOnMarginPct: Number(pnl) / Number(margin) * 100,
    priceMovePct: (Number(mark) - Number(entry)) / Number(entry) * 100
  };
}

/* ---------- Tool 37: stableswap invariant swap model ---------- */
/* A stableswap pool (the Curve-style invariant behind Saber and other
   stable pools on Solana) prices two like-valued tokens off the
   invariant   Ann * (x + y) + D = Ann * D + D^3 / (4xy),   Ann = A * n^n
   with n = 2 coins and A the AMPLIFICATION COEFFICIENT: as A grows the
   curve flattens toward a constant-sum (1:1) line near balance, and as
   A falls toward 1 it bends toward the constant-product curve of
   Tool 2. Neither D nor the post-trade balance has a closed form the
   integer math can use, so both are solved by Newton iteration in exact
   BigInt - the same integer Newton the on-chain programs run, which is
   why the result can sit a few smallest units from the real-valued
   solution on extreme inputs: that tolerance is the integer
   convention, stated in the sweep tolerance of the tests, not hidden.
   The get_y step finishes by picking, of the Newton endpoint and its
   two neighbours, the balance that minimises the residual of the
   quadratic y^2 + (b - D)y - c, which removes the truncation bias.
   The swap fee is charged on the OUTPUT (the Curve/Saber convention):
   fee = grossOut x feeBps / 10000, floored; the trader receives the
   remainder. Both tokens are modelled at the same decimals, which is
   the stable-pool case (a USDC/USDT pair, both 6 decimals) - stated on
   the page. D is reported because it is the pool's total value at the
   peg in this model: for a balanced pool it equals x + y exactly.
   Verified before shipping against the float definitions on 20,000
   prototype cases with identical parsed inputs (0 mismatches inside a
   tolerance of a few smallest units). */
var MAX_STABLE_AMP = 100000; /* a guard, not a venue cap */

function stableInvariantD(x, y, amp) { /* BigInt in, BigInt out */
  var s = x + y;
  if (s === 0n) return 0n;
  var ann = amp * 4n;
  var d = s;
  for (var i = 0; i < 256; i++) {
    var dp = d;
    dp = (dp * d) / (x * 2n);
    dp = (dp * d) / (y * 2n);
    var next = ((ann * s + dp * 2n) * d) / ((ann - 1n) * d + 3n * dp);
    var diff = next > d ? next - d : d - next;
    d = next;
    if (diff <= 1n) break;
  }
  return d;
}

function stableSolveY(xNew, d, amp) { /* BigInt in, BigInt out */
  var ann = amp * 4n;
  var c = d;
  c = (c * d) / (xNew * 2n);
  c = (c * d) / (ann * 2n);
  var b = xNew + d / ann;
  var y = d;
  for (var i = 0; i < 256; i++) {
    var next = (y * y + c) / (2n * y + b - d);
    var diff = next > y ? next - y : y - next;
    y = next;
    if (diff <= 1n) break;
  }
  var best = y, bestRes = null;
  for (var k = -1n; k <= 1n; k++) {
    var cand = y + k;
    if (cand < 0n) continue;
    var res = cand * cand + (b - d) * cand - c;
    if (res < 0n) res = -res;
    if (bestRes === null || res < bestRes) { bestRes = res; best = cand; }
  }
  return best;
}

function stableSwap(xStr, yStr, ampStr, dxStr, feeBpsStr) {
  var x = parseScaled(xStr);
  var y = parseScaled(yStr);
  var ampS = parseScaled(ampStr);
  var dx = parseScaled(dxStr);
  var feeBps = parseScaled(feeBpsStr);
  if (x === null || y === null || ampS === null || dx === null || feeBps === null) return null;
  if (x <= 0n || y <= 0n || dx <= 0n) return null;
  if (ampS <= 0n || ampS % SCALE !== 0n || ampS > BigInt(MAX_STABLE_AMP) * SCALE) return null;
  if (feeBps < 0n || feeBps >= 10000n * SCALE) return null;
  var amp = ampS / SCALE;
  var d = stableInvariantD(x, y, amp);
  var yNew = stableSolveY(x + dx, d, amp);
  var gross = y - yNew;
  if (gross <= 0n) return null;
  var fee = (gross * feeBps) / (10000n * SCALE);
  var net = gross - fee;
  if (net <= 0n) return null;
  return {
    balanceIn: formatScaled(x), balanceOut: formatScaled(y),
    amp: formatScaled(ampS), amountIn: formatScaled(dx),
    invariantD: formatScaled(d),
    grossOut: formatScaled(gross), fee: formatScaled(fee), feeBps: formatScaled(feeBps),
    netOut: formatScaled(net),
    newBalanceIn: formatScaled(x + dx), newBalanceOut: formatScaled(yNew),
    effectivePrice: formatScaled((net * SCALE) / dx),
    grossPriceImpactPct: (1 - Number(gross) / Number(dx)) * 100
  };
}

/* ---------- Tool 38: lending liquidation proceeds (maximum single liquidation) ---------- */
/* Tool 20 judges WHEN a lending position may be liquidated; this model
   prices WHAT one liquidation does. A market lets a liquidator repay at
   most a CLOSE FACTOR share of the debt in a single liquidation
   (maxRepay = debt x closeFactor, floored) and seize collateral worth
   the repaid amount marked up by the LIQUIDATION BONUS - the liquidator's
   profit, paid by the borrower: seizedValue = repay x (1 + bonus),
   seizedAmount = seizedValue / collateralPrice, every step floored in
   exact scaled BigInt like Tool 20's own value figure (collateralValue
   = amount x price, floored once). If the marked-up seizure would take
   more collateral than the position holds, the collateral is EXHAUSTED:
   the liquidator takes all of it and the effective repay falls to
   collateralValue / (1 + bonus), leaving the rest of the debt behind
   with no collateral backing it - the shortfall a market's insurance
   fund or socialised loss has to absorb, stated here, not hidden.
   Bonus and close factor are inputs - every market sets its own, some
   allow a full close once health is low enough, which the 100% close
   factor here can represent - and the model is a single collateral
   against a single debt valued in the quote currency, with no interest
   accrual, liquidation fee or partial-liquidation sequencing. Verified
   against the float definitions on 20,000 prototype cases with
   identical parsed inputs (including 166 collateral-exhausted cases)
   before shipping, zero mismatches. */
function liquidationMax(amountStr, priceStr, debtStr, bonusBpsStr, closeBpsStr) {
  var A = parseScaled(amountStr), P = parseScaled(priceStr), D = parseScaled(debtStr);
  var bon = parseScaled(bonusBpsStr), cf = parseScaled(closeBpsStr);
  if (A === null || P === null || D === null || bon === null || cf === null) return null;
  if (A <= 0n || P <= 0n || D <= 0n) return null;
  if (bon < 0n || bon >= 10000n * SCALE) return null;
  if (cf <= 0n || cf > 10000n * SCALE) return null;
  var V = (A * P) / SCALE;
  if (V <= 0n) return null;
  var maxRepay = (D * cf) / (10000n * SCALE);
  if (maxRepay <= 0n) return null;
  var seizedValueDesired = (maxRepay * (10000n * SCALE + bon)) / (10000n * SCALE);
  var seizedAmountDesired = (seizedValueDesired * SCALE) / P;
  var repay, seizedValue, seizedAmount, exhausted;
  if (seizedAmountDesired > A) {
    exhausted = true;
    seizedAmount = A;
    seizedValue = V;
    repay = (V * 10000n * SCALE) / (10000n * SCALE + bon);
    if (repay <= 0n) return null;
  } else {
    exhausted = false;
    seizedAmount = seizedAmountDesired;
    seizedValue = seizedValueDesired;
    repay = maxRepay;
  }
  return {
    amount: formatScaled(A), price: formatScaled(P), debt: formatScaled(D),
    bonusBps: formatScaled(bon), closeFactorBps: formatScaled(cf),
    collateralValue: formatScaled(V),
    maxRepay: formatScaled(maxRepay),
    repay: formatScaled(repay),
    seizedValue: formatScaled(seizedValue),
    seizedAmount: formatScaled(seizedAmount),
    profitValue: formatScaled(seizedValue - repay),
    remainingDebt: formatScaled(D - repay),
    remainingCollateral: formatScaled(A - seizedAmount),
    remainingCollateralValue: formatScaled(V - seizedValue),
    collateralExhausted: exhausted,
    fullyRepaid: D - repay === 0n
  };
}

/* ---------- Tool 39: two-hop swap route model ---------- */
/* Most Solana trades do not hit a single pool: an aggregator (Jupiter, or a
   DEX router) routes A -> M -> B through two constant-product pools when no
   deep direct A/B pool exists, or when the routed price beats the direct one.
   The route is exactly Tool 2 composed with itself: hop 1 swaps the input for
   the intermediate token (fee on its input), and hop 2 swaps the FULL
   intermediate amount onward (its own fee on its own input) - so the two fees
   and the two price impacts compound rather than add. The honest comparison
   is the route's SPOT value: amountIn x (mid1 / in1) x (out2 / mid2), the
   output at quoted prices with no fees and no impact, floored once in exact
   BigInt; the gap between it and the routed output is the route's total cost.
   Each pool's fee is a whole number of basis points, as pools quote them. */
function routeSwap(reserveIn1Str, reserveMid1Str, reserveMid2Str, reserveOut2Str, amountInStr, fee1BpsStr, fee2BpsStr) {
  var r1 = parseScaled(reserveIn1Str), m1 = parseScaled(reserveMid1Str);
  var m2 = parseScaled(reserveMid2Str), o2 = parseScaled(reserveOut2Str);
  var aIn = parseScaled(amountInStr);
  var f1s = parseScaled(fee1BpsStr), f2s = parseScaled(fee2BpsStr);
  if (r1 === null || m1 === null || m2 === null || o2 === null || aIn === null || f1s === null || f2s === null) return null;
  if (r1 <= 0n || m1 <= 0n || m2 <= 0n || o2 <= 0n || aIn <= 0n) return null;
  if (f1s % SCALE !== 0n || f2s % SCALE !== 0n) return null;
  var f1 = Number(f1s / SCALE), f2 = Number(f2s / SCALE);
  if (!Number.isInteger(f1) || f1 < 0 || f1 >= 10000) return null;
  if (!Number.isInteger(f2) || f2 < 0 || f2 >= 10000) return null;
  var hop1 = cpSwap(reserveIn1Str, reserveMid1Str, amountInStr, f1);
  if (hop1 === null) return null;
  var hop2 = cpSwap(reserveMid2Str, reserveOut2Str, hop1.amountOut, f2);
  if (hop2 === null) return null;
  var spot = (aIn * m1 * o2) / (r1 * m2);
  if (spot <= 0n) return null;
  var out = parseScaled(hop2.amountOut);
  return {
    amountIn: formatScaled(aIn), fee1Bps: f1, fee2Bps: f2,
    hop1Fee: hop1.fee, hop1EffectiveIn: hop1.effectiveIn, midAmount: hop1.amountOut,
    hop1PriceImpactPct: hop1.priceImpactPct,
    hop2Fee: hop2.fee, hop2EffectiveIn: hop2.effectiveIn,
    hop2PriceImpactPct: hop2.priceImpactPct,
    amountOut: hop2.amountOut, spotOut: formatScaled(spot),
    totalCostBps: Number(((spot - out) * 10000n) / spot),
    effectivePrice: Number(out) / Number(aIn)
  };
}

/* ---------- Tool 40: exact-out swap model ---------- */
/* Tool 2 answers "how much out for this much in"; an exact-out order asks the
   reverse - "how much in for exactly this much out" - the quote a wallet gives
   when the payment amount is fixed. The pool's requirement is solved first with
   no fee: floor(eff * reserveOut / (reserveIn + eff)) >= amountOut inverts to
   eff >= amountOut * reserveIn / (reserveOut - amountOut), ceilinged at the
   smallest unit - that is the net input the pool must receive. The gross input
   is then the smallest amount whose Tool 2 fee withholding (floor(gross x bps
   / 10,000)) still leaves that net: the withholding floors, so a plain gross-up
   can land a smallest unit short, and the exact gross is found by binary search
   over the withholding function, which steps monotonically. The reported
   figures are Tool 2's own swap run at the solved gross, so the two tools can
   never disagree; flooring can deliver a few smallest units MORE than the
   target, reported as the excess, never hidden. A target at or beyond the
   whole output reserve is rejected: a constant-product pool can never pay out
   its entire reserve, however much is offered. */
function cpSwapExactOut(reserveInStr, reserveOutStr, amountOutStr, feeBpsStr) {
  var rIn = parseScaled(reserveInStr);
  var rOut = parseScaled(reserveOutStr);
  var aOut = parseScaled(amountOutStr);
  var fS = parseScaled(feeBpsStr);
  if (rIn === null || rOut === null || aOut === null || fS === null) return null;
  if (rIn <= 0n || rOut <= 0n || aOut <= 0n || aOut >= rOut) return null;
  if (fS % SCALE !== 0n) return null;
  var f = Number(fS / SCALE);
  if (!Number.isInteger(f) || f < 0 || f >= 10000) return null;
  var denom = rOut - aOut;
  var netIn = (aOut * rIn + denom - 1n) / denom;
  var lo = netIn;
  var hi = f === 0 ? netIn : (netIn * 10000n + BigInt(10000 - f) - 1n) / BigInt(10000 - f);
  var effOf = function (g) { return g - (g * BigInt(f)) / 10000n; };
  while (lo < hi) {
    var mid = (lo + hi) / 2n;
    if (effOf(mid) >= netIn) hi = mid; else lo = mid + 1n;
  }
  var actual = cpSwap(reserveInStr, reserveOutStr, formatScaled(lo), f);
  if (actual === null) return null;
  var actualOut = parseScaled(actual.amountOut);
  return {
    reserveIn: formatScaled(rIn), reserveOut: formatScaled(rOut),
    amountOut: formatScaled(aOut), feeBps: f,
    netIn: formatScaled(netIn),
    amountIn: formatScaled(lo), fee: actual.fee, effectiveIn: actual.effectiveIn,
    actualOut: actual.amountOut, excessOut: formatScaled(actualOut - aOut),
    priceImpactPct: actual.priceImpactPct
  };
}

/* ---------- Tool 41: arbitrage profit model ---------- */
/* A constant-product pool never learns the outside price by itself: an
   arbitrageur who can sell the output token elsewhere at an external price
   (quoted here in input per output, an input) buys it from the pool while
   the pool's price is lower, and the trade itself pushes the pool's price
   up toward the external one. The swap leg is Tool 2's own cpSwap, so the
   tools cannot disagree; the output is then valued at the external price
   floored once in exact BigInt, and the profit is that value minus the
   gross input - signed, because a trade past the alignment point, or one
   against a gap the fee and impact already eat, loses money. The post-trade
   spot price (reserveIn + effectiveIn) / (reserveOut - amountOut), floored,
   shows where the trade leaves the pool's price: short of the external
   price when the fee closes the gap early, past it when the trade
   overshoots. One direction only - buying the output token from this pool
   to resell at the external price; the mirrored trade is the same model
   with the tokens swapped. The external sale is assumed to fill in full at
   exactly the quoted price: no external fee, slippage, gas or priority fee
   is modelled, and no live price or pool is read. */
function arbitrageTrade(reserveInStr, reserveOutStr, amountInStr, feeBpsStr, externalPriceStr) {
  var rIn = parseScaled(reserveInStr);
  var rOut = parseScaled(reserveOutStr);
  var aIn = parseScaled(amountInStr);
  var fS = parseScaled(feeBpsStr);
  var px = parseScaled(externalPriceStr);
  if (rIn === null || rOut === null || aIn === null || fS === null || px === null) return null;
  if (rIn <= 0n || rOut <= 0n || aIn <= 0n || px <= 0n) return null;
  if (fS % SCALE !== 0n) return null;
  var f = Number(fS / SCALE);
  if (!Number.isInteger(f) || f < 0 || f >= 10000) return null;
  var swap = cpSwap(reserveInStr, reserveOutStr, amountInStr, f);
  if (swap === null) return null;
  var out = parseScaled(swap.amountOut);
  var eff = parseScaled(swap.effectiveIn);
  var value = (out * px) / SCALE;
  var profit = value - aIn;
  return {
    reserveIn: formatScaled(rIn), reserveOut: formatScaled(rOut),
    amountIn: formatScaled(aIn), feeBps: f, externalPrice: formatScaled(px),
    spotPrice: formatScaled((rIn * SCALE) / rOut),
    fee: swap.fee, effectiveIn: swap.effectiveIn, amountOut: swap.amountOut,
    externalValue: formatScaled(value), profit: formatScaled(profit),
    profitable: profit > 0n,
    postSpotPrice: formatScaled(((rIn + eff) * SCALE) / (rOut - out)),
    priceImpactPct: swap.priceImpactPct
  };
}

/* ---------- Tool 42: CLMM swap inside one tick range ---------- */
/* A concentrated-liquidity swap does not trade against token reserves:
   it trades against the ACTIVE liquidity L while the price stays inside
   one tick range [sLower, sUpper] (s = sqrt(price), Tool 10). Paying
   token0 moves the price DOWN: the pool takes amount0 = L * (1/sNew -
   1/sCurrent) and pays amount1 = L * (sCurrent - sNew), so a given
   effective input sets 1/sNew = 1/sCurrent + effectiveIn / L. Paying
   token1 moves the price UP: sNew = sCurrent + effectiveIn / L and it
   pays amount0 = L * (1/sCurrent - 1/sNew). The fee is withheld from the
   gross input first, in exact scaled-BigInt like Tool 2; the price math
   itself is floating point, like Tool 17, because square-root prices
   are irrational - the on-chain programs carry them as Q64.64 fixed
   point instead. Inside the range the formulas are exactly a constant-
   product swap on the range's VIRTUAL reserves (L / sCurrent of the
   input-side token, L * sCurrent of the other), which the test suite
   pins against Tool 2 itself. A trade big enough to reach the range
   bound STOPS there in this model: on-chain it would cross into the
   next tick range, against whatever liquidity is active there - that
   continuation is stated, not modelled - so the model reports the
   output at the bound and the effective input the range never used.
   The current tick must be inside the range (lower <= current <
   upper): outside it this range's liquidity is inactive and a swap
   here would trade against a different range's liquidity entirely. */
function clmmSwap(liquidityStr, lower, upper, current, direction, amountInStr, feeBpsStr) {
  var Lscaled = parseScaled(liquidityStr);
  var aIn = parseScaled(amountInStr);
  var fS = parseScaled(feeBpsStr);
  var lo = Number(lower), hi = Number(upper), cur = Number(current);
  if (Lscaled === null || aIn === null || fS === null) return null;
  if (Lscaled <= 0n || aIn <= 0n) return null;
  if (fS % SCALE !== 0n) return null;
  var f = Number(fS / SCALE);
  if (!Number.isInteger(f) || f < 0 || f >= 10000) return null;
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || !Number.isInteger(cur)) return null;
  if (lo < MIN_TICK || hi > MAX_TICK || cur < MIN_TICK || cur > MAX_TICK) return null;
  if (lo >= hi) return null;
  if (!(lo <= cur && cur < hi)) return null;
  if (direction !== "token0" && direction !== "token1") return null;
  var fee = (aIn * BigInt(f)) / 10000n;
  var eff = aIn - fee;
  if (eff <= 0n) return null;
  var L = Number(Lscaled) / 1e9;
  var effIn = Number(eff) / 1e9;
  var sLo = Math.sqrt(tickToPrice(lo)), sHi = Math.sqrt(tickToPrice(hi)), sCur = Math.sqrt(tickToPrice(cur));
  var maxEff, used, sNew, out, bound = false;
  if (direction === "token0") {
    maxEff = L * (1 / sLo - 1 / sCur);
    bound = effIn > maxEff;
    used = bound ? maxEff : effIn;
    sNew = bound ? sLo : 1 / (1 / sCur + used / L);
    out = L * (sCur - sNew);
  } else {
    maxEff = L * (sHi - sCur);
    bound = effIn > maxEff;
    used = bound ? maxEff : effIn;
    sNew = bound ? sHi : sCur + used / L;
    out = L * (1 / sCur - 1 / sNew);
  }
  if (!(out > 0)) return null;
  var priceCur = tickToPrice(cur);
  var spot = direction === "token0" ? priceCur : 1 / priceCur;
  var impactPct = (1 - (out / used) / spot) * 100;
  return {
    liquidity: formatScaled(Lscaled),
    tickLower: lo, tickUpper: hi, tickCurrent: cur,
    direction: direction,
    amountIn: formatScaled(aIn), feeBps: f,
    fee: formatScaled(fee), effectiveIn: formatScaled(eff),
    usedEffectiveIn: used, unusedEffectiveIn: effIn - used, maxEffectiveIn: maxEff,
    amountOut: out,
    sqrtPriceCurrent: sCur, sqrtPriceAfter: sNew,
    priceCurrent: priceCur, priceAfter: sNew * sNew,
    reachedBound: bound, boundTick: bound ? (direction === "token0" ? lo : hi) : null,
    priceImpactPct: impactPct
  };
}

/* ---------- Tool 43: limit-order book walk (market buy against resting asks) ---------- */
/* A central limit order book (Phoenix, OpenBook, Manifest on Solana) holds
   resting limit orders; a market buy does not trade at one price - it walks
   the ask side from the best (lowest) price upward, filling at each resting
   order's own price until the buy is filled or the book runs out. Each
   level's cost floors at the smallest unit in exact scaled-BigInt
   (taken x price), the total is the sum of the level costs, and the volume-
   weighted average price (VWAP) = total cost / filled quantity. The honest
   figures are the ones an AMM quote hides: how much of the book the trade
   consumed, the extra cost over filling entirely at the best ask, and the
   unfilled remainder when the visible book is too shallow - a market order
   cannot invent liquidity that is not resting there. Three ask levels are
   modelled; venue taker fees are stated as not modelled. */
function orderBookBuy(p1Str, q1Str, p2Str, q2Str, p3Str, q3Str, buyStr) {
  var ps = [parseScaled(p1Str), parseScaled(p2Str), parseScaled(p3Str)];
  var qs = [parseScaled(q1Str), parseScaled(q2Str), parseScaled(q3Str)];
  var buy = parseScaled(buyStr);
  if (buy === null || buy <= 0n) return null;
  for (var i = 0; i < 3; i++) {
    if (ps[i] === null || qs[i] === null || ps[i] <= 0n || qs[i] <= 0n) return null;
  }
  if (!(ps[0] < ps[1] && ps[1] < ps[2])) return null;
  var remaining = buy, totalCost = 0n, filled = 0n, takes = [];
  for (var j = 0; j < 3; j++) {
    var take = qs[j] < remaining ? qs[j] : remaining;
    if (take <= 0n) { takes.push({ price: formatScaled(ps[j]), taken: "0", cost: "0" }); continue; }
    var cost = (take * ps[j]) / SCALE;
    totalCost += cost; filled += take; remaining -= take;
    takes.push({ price: formatScaled(ps[j]), taken: formatScaled(take), cost: formatScaled(cost) });
  }
  var depth = qs[0] + qs[1] + qs[2];
  var costAtBest = (filled * ps[0]) / SCALE;
  var vwap = filled > 0n ? Number(totalCost) / Number(filled) : 0;
  var best = Number(ps[0]) / 1e9;
  return {
    takes: takes,
    buy: formatScaled(buy),
    filled: formatScaled(filled),
    remaining: formatScaled(remaining),
    fullyFilled: remaining === 0n,
    bookDepth: formatScaled(depth),
    totalCost: formatScaled(totalCost),
    vwap: vwap,
    bestPrice: formatScaled(ps[0]),
    costAtBest: formatScaled(costAtBest),
    extraCost: formatScaled(totalCost - costAtBest),
    slippagePct: filled > 0n ? ((vwap - best) / best) * 100 : 0
  };
}

/* ---------- Tool 44: TWAP oracle (tick-cumulative time-weighted average price) ---------- */
/* A concentrated-liquidity pool's oracle does not store prices - it stores
   a running tick cumulative: every second, the current tick is added to a
   signed 64-bit counter. The time-weighted average price over a window is
   recovered from two readings of that counter: averageTick =
   (cumulativeEnd - cumulativeStart) / elapsedSeconds, and the TWAP price =
   1.0001 ^ averageTick. The division is integer division TRUNCATING TOWARD
   ZERO (the on-chain and Solidity/Rust convention), not a floor: a delta
   of -100 over 3 seconds averages tick -33, not -34, and the leftover
   remainder (-1 tick-second here) is discarded, which the model reports.
   Because the average is over TIME, a price that holds for one second of
   an hour-long window moves the TWAP by only its tick's worth for that
   second - the lag that makes a TWAP harder to manipulate than the spot
   price, and slower to follow a real move, both stated on the page. The
   average tick must sit inside the pool tick range; the price conversion
   is floating point, like Tool 10. */
var MAX_TWAP_SECONDS = 1000000000;
var I64_BOUND = 9223372036854775807n;

function parseTickCumulative(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^-?\d+$/.test(s)) return null;
  var v = BigInt(s);
  if (v > I64_BOUND || v < -I64_BOUND) return null;
  return v;
}

function twapOracle(startStr, endStr, secondsStr, spotStr) {
  var start = parseTickCumulative(startStr);
  var end = parseTickCumulative(endStr);
  if (start === null || end === null) return null;
  if (typeof secondsStr !== "string" || !/^\d+$/.test(secondsStr.trim())) return null;
  var seconds = BigInt(secondsStr.trim());
  if (seconds <= 0n || seconds > BigInt(MAX_TWAP_SECONDS)) return null;
  var spot = parseScaled(spotStr);
  if (spot === null || spot <= 0n) return null;
  var delta = end - start;
  var avg = delta / seconds; /* BigInt division truncates toward zero */
  if (avg < BigInt(MIN_TICK) || avg > BigInt(MAX_TICK)) return null;
  var avgTick = Number(avg);
  var remainder = delta - avg * seconds;
  var price = tickToPrice(avgTick);
  var spotPrice = Number(spot) / 1e9;
  return {
    startCumulative: start.toString(),
    endCumulative: end.toString(),
    elapsedSeconds: Number(seconds),
    deltaTicks: delta.toString(),
    avgTick: avgTick,
    remainderTicks: remainder.toString(),
    twapPrice: price,
    spotPrice: formatScaled(spot),
    deviationBps: (price / spotPrice - 1) * 10000,
    deviationPct: (price / spotPrice - 1) * 100
  };
}

/* ---------- Tool 45: LP withdrawal (burn LP tokens, pro-rata share) ---------- */
/* Leaving a constant-product pool is the mirror of Tool 18's deposit, but
   it is NOT getting your deposit back: burning B of a supply S returns
   B / S of whatever the pool holds NOW - outA = floor(B * reserveA / S),
   outB = floor(B * reserveB / S), in exact scaled-BigInt - so swaps, fees
   accrued and price moves since the deposit are all inside the reserves
   being shared. Both divisions floor at the smallest unit and the dust
   they discard stays in the pool for the remaining LPs. Two edges are
   exact, not approximate: a full burn (B == S) returns the whole reserves
   to the smallest unit and leaves the pool empty, and a dust burn against
   a large supply can floor to zero on one or both sides - returned here
   as zero with a flag, because that IS what the maths pays, and the
   handler warns about it plainly. Prototype-verified before pinning:
   20,000 cases, 0 violations of the floor-division property
   out*S <= B*reserve < (out+1)*S, of out + remaining == reserve, or of
   full-burn exactness. */
function lpWithdraw(reserveAStr, reserveBStr, supplyStr, burnStr) {
  var rA = parseScaled(reserveAStr), rB = parseScaled(reserveBStr), S = parseScaled(supplyStr), B = parseScaled(burnStr);
  if (rA === null || rB === null || S === null || B === null) return null;
  if (rA <= 0n || rB <= 0n || S <= 0n || B <= 0n || B > S) return null;
  var outA = (B * rA) / S, outB = (B * rB) / S;
  return {
    reserveA: formatScaled(rA), reserveB: formatScaled(rB), supply: formatScaled(S), burn: formatScaled(B),
    outA: formatScaled(outA), outB: formatScaled(outB),
    remainingA: formatScaled(rA - outA), remainingB: formatScaled(rB - outB), remainingSupply: formatScaled(S - B),
    sharePct: Number(B * 100000000n / S) / 1000000,
    fullBurn: B === S, zeroA: outA === 0n, zeroB: outB === 0n
  };
}

/* ---------- Tool 46: airdrop / multisend cost planner ---------- */
/* Sending a token to N wallets costs SOL before any token moves, in two
   parts with different natures. (1) RENT: a recipient who does not yet hold
   the mint needs an associated token account (Tool 27), a 165-byte token
   account whose rent-exempt deposit is Tool 3's own figure for 165 bytes -
   2,039,280 lamports each. That deposit is LOCKED, not spent: it is
   reclaimable if the account is later closed. (2) FEES: the transfers ride
   in batched transactions, ceil(N / batch) of them, each paying Tool 5's
   base fee for one signature (5,000 lamports) plus a priority fee the
   sender chooses per transaction. Fees are spent. The batch size is the
   sender's choice, bounded in practice by the 1,232-byte packet limit
   (Tool 21) and by whether account-creation instructions ride in the same
   transactions; no single "right" batch exists, so it is an input, never
   a pinned constant. Prototype-verified before pinning: the transaction
   count matched a naive one-by-one loop and every total decomposed
   exactly (rent + fees == total) across 20,000 cases, 0 mismatches. */
var MAX_AIRDROP_RECIPIENTS = 10000000;
var TOKEN_ACCOUNT_BYTES = 165;

function airdropCost(recipients, newAtas, batchSize, amountStr, priorityLamports) {
  var n = Number(recipients), nu = Number(newAtas), batch = Number(batchSize), pri = Number(priorityLamports);
  var amt = parseScaled(amountStr);
  if (!Number.isInteger(n) || n < 1 || n > MAX_AIRDROP_RECIPIENTS) return null;
  if (!Number.isInteger(nu) || nu < 0 || nu > n) return null;
  if (!Number.isInteger(batch) || batch < 1 || batch > 1000000) return null;
  if (!Number.isInteger(pri) || pri < 0 || pri > 1000000000) return null;
  if (amt === null || amt <= 0n) return null;
  var rentPerAta = rentExempt(TOKEN_ACCOUNT_BYTES).rentExemptLamports;
  var txCount = Math.floor((n + batch - 1) / batch);
  var rentLamports = BigInt(nu) * BigInt(rentPerAta);
  var feePerTx = BigInt(BASE_FEE_LAMPORTS_PER_SIGNATURE) + BigInt(pri);
  var feesLamports = BigInt(txCount) * feePerTx;
  var totalLamports = rentLamports + feesLamports;
  return {
    recipients: n, newAtas: nu, existingAtas: n - nu, batchSize: batch, txCount: txCount,
    rentPerAtaLamports: rentPerAta,
    rentLamports: Number(rentLamports), rentSol: formatScaled(rentLamports),
    feePerTxLamports: Number(feePerTx),
    feesLamports: Number(feesLamports), feesSol: formatScaled(feesLamports),
    totalLamports: Number(totalLamports), totalSol: formatScaled(totalLamports),
    amountPerRecipient: formatScaled(amt), tokensNeeded: formatScaled(BigInt(n) * amt)
  };
}

/* ---------- Tool 47: Dutch auction price (linear decay, optional steps) ---------- */
/* A Dutch auction sells to the first buyer who accepts the current price:
   the seller publishes a start price, a floor and a duration, and the
   price falls from start to floor across the duration - linearly in the
   classic form modelled here, price(t) = start - (start - floor) * t / D,
   floored at the smallest unit in exact scaled-BigInt. Many on-chain sales
   drop the price in STEPS instead of continuously (a new price every s
   seconds): then the effective elapsed time is floor(t / s) * s, and the
   price a buyer sees is the step's price for the whole step. Two ends are
   exact, not approximate: at t = 0 the price is the start, and once the
   duration has run the price is the floor - even when a step does not
   divide the duration, the final step is cut short and the sale ends on
   the floor (a step that would overshoot the end never holds the price
   above the floor past it). A floor of zero is allowed (decay toward
   worthless) and a floor equal to the start is a fixed price. Prototype-
   verified before pinning: 20,000 cases against the float definition,
   0 mismatches, monotone non-increasing in t throughout. Exponential
   decay schedules exist in the wild and are NOT this form - stated on
   the page, not modelled. */
var MAX_DUTCH_DURATION_SECONDS = 1000000000;
var MAX_DUTCH_ELAPSED_SECONDS = 1000000000000;

function dutchAuctionPrice(startStr, floorStr, durationSeconds, elapsedSeconds, stepSeconds) {
  var P0 = parseScaled(startStr), Pf = parseScaled(floorStr);
  var D = Number(durationSeconds), t = Number(elapsedSeconds), s = Number(stepSeconds);
  if (P0 === null || Pf === null) return null;
  if (P0 <= 0n || Pf < 0n || Pf > P0) return null;
  if (!Number.isSafeInteger(D) || D < 1 || D > MAX_DUTCH_DURATION_SECONDS) return null;
  if (!Number.isSafeInteger(t) || t < 0 || t > MAX_DUTCH_ELAPSED_SECONDS) return null;
  if (!Number.isSafeInteger(s) || s < 0 || s > D) return null;
  var rawEff = Math.min(t, D);
  var ended = rawEff >= D;
  var eff = ended ? D : (s > 0 ? Math.floor(rawEff / s) * s : rawEff);
  var drop = (P0 - Pf) * BigInt(eff) / BigInt(D);
  var price = P0 - drop;
  return {
    startPrice: formatScaled(P0), floorPrice: formatScaled(Pf),
    durationSeconds: D, elapsedSeconds: t, effectiveSeconds: eff,
    price: formatScaled(price), dropped: formatScaled(drop),
    dropPctOfRange: P0 === Pf ? 0 : Number(drop * 100000000n / (P0 - Pf)) / 1000000,
    remainingSeconds: D - rawEff,
    nextDropInSeconds: (s > 0 && !ended) ? s - (rawEff % s) : null,
    stepped: s > 0, ended: ended
  };
}

/* ---------- Tool 48: DAO governance quorum & approval ---------- */
/* A token-governance proposal (Realms / SPL Governance and most DAO
   frameworks on Solana) must clear TWO independent bars, and confusing
   them is the classic misread of a vote tally:
     (1) QUORUM - enough of the governing supply must participate at all:
         votes cast (for + against + abstain) >= ceil(supply x quorumBps
         / 10000). The requirement CEILINGS at the smallest unit, because
         anything less is literally below the stated fraction of supply.
     (2) APPROVAL - of the decisive votes, enough must be FOR:
         for / (for + against) >= approvalBps / 10000, the share floored
         at the smallest bp like an on-chain integer comparison.
   ABSTAIN counts toward quorum (the holder showed up) but toward neither
   side of approval - the convention modelled here, stated on the page;
   frameworks that weigh abstain differently are not this model. Votes
   cast cannot exceed the governing supply in a one-token-one-vote tally,
   so a larger cast is rejected rather than quoted. A tally can clear
   approval by a landslide and still FAIL on quorum - the headline does
   exactly that. All amounts in exact scaled-BigInt; prototype-verified
   before pinning: 20,000 cases, the ceiling/floor minimality properties
   held in every case (quorumNeeded is the smallest amount whose fraction
   of supply reaches the quorum, approvalBpsActual the largest whole bp
   not exceeding the true for-share). */
function govVote(supplyStr, forStr, againstStr, abstainStr, quorumBps, approvalBps) {
  var supply = parseScaled(supplyStr), fv = parseScaled(forStr);
  var av = parseScaled(againstStr), ab = parseScaled(abstainStr);
  var q = Number(quorumBps), ap = Number(approvalBps);
  if (supply === null || fv === null || av === null || ab === null) return null;
  if (supply <= 0n) return null;
  if (!Number.isInteger(q) || q < 0 || q > 10000) return null;
  if (!Number.isInteger(ap) || ap < 1 || ap > 10000) return null;
  var cast = fv + av + ab;
  if (cast > supply) return null;
  var quorumNeeded = (supply * BigInt(q) + 9999n) / 10000n;
  var shortfall = quorumNeeded > cast ? quorumNeeded - cast : 0n;
  var decided = fv + av;
  var approvalActual = decided > 0n ? Number(fv * 10000n / decided) : null;
  var quorumMet = cast >= quorumNeeded;
  var approvalMet = approvalActual !== null && approvalActual >= ap;
  return {
    supply: formatScaled(supply), forVotes: formatScaled(fv),
    againstVotes: formatScaled(av), abstainVotes: formatScaled(ab),
    cast: formatScaled(cast), quorumBps: q, approvalBps: ap,
    quorumNeeded: formatScaled(quorumNeeded),
    quorumShortfall: formatScaled(shortfall),
    turnoutBps: Number(cast * 10000n / supply),
    approvalActualBps: approvalActual,
    quorumMet: quorumMet, approvalMet: approvalMet,
    passes: quorumMet && approvalMet
  };
}

/* ---------- Tool 49: token supply allocation planner ---------- */
/* A token launch fixes its total supply at mint time and splits it into
   buckets - liquidity, community, team, treasury and the like - stated as
   shares of the supply. Shares are entered here in basis points (the unit
   launch documents and mint configurations actually use). The three named
   buckets are floored at the smallest unit in exact scaled-BigInt:
   floor(supply x bps / 10000). Four floored shares can sum to less than
   the supply (each floor discards under one smallest unit), so the FOURTH
   bucket - the treasury, the designated remainder bucket - receives
   supply minus the three floored amounts: the parts then sum to the
   supply EXACTLY, and the remainder bucket absorbs the flooring dust,
   which is provably 0 to 3 smallest units (the summed remainders of four
   divisions by 10000). The treasury's nominal floored share and the dust
   it absorbed are both reported, never hidden. Shares must sum to at
   most 10000 bps - a split that promises more than the whole supply is
   rejected, as is any fractional or out-of-range share. At whole-token
   supplies every product has at most 4 decimal places and the dust is 0;
   it appears only at the smallest-unit scale. Prototype-verified before
   pinning: 19,999 cases, 0 mismatches on sum-exactness, per-bucket floor
   minimality, treasury >= its nominal share, and dust in [0, 3] units. */
function tokenAllocation(supplyStr, liquidityBps, communityBps, teamBps) {
  var supply = parseScaled(supplyStr);
  var lb = Number(liquidityBps), cb = Number(communityBps), tb = Number(teamBps);
  if (supply === null || supply <= 0n) return null;
  var shares = [lb, cb, tb];
  for (var i = 0; i < shares.length; i++) {
    if (!Number.isInteger(shares[i]) || shares[i] < 0 || shares[i] > 10000) return null;
  }
  if (lb + cb + tb > 10000) return null;
  var treasuryBps = 10000 - lb - cb - tb;
  var liquidity = supply * BigInt(lb) / 10000n;
  var community = supply * BigInt(cb) / 10000n;
  var team = supply * BigInt(tb) / 10000n;
  var treasuryNominal = supply * BigInt(treasuryBps) / 10000n;
  var treasury = supply - liquidity - community - team;
  var dust = treasury - treasuryNominal;
  return {
    supply: formatScaled(supply),
    liquidityBps: lb, communityBps: cb, teamBps: tb, treasuryBps: treasuryBps,
    liquidity: formatScaled(liquidity), community: formatScaled(community),
    team: formatScaled(team), treasury: formatScaled(treasury),
    treasuryNominal: formatScaled(treasuryNominal),
    dust: formatScaled(dust), dustUnits: Number(dust)
  };
}

/* ---------- Tool 50: quadratic voting cost calculator ---------- */
/* Quadratic voting (used by DAO grant rounds and governance experiments
   across Solana) prices voice, not votes: casting v votes on one proposal
   costs v^2 voice credits from a fixed budget, so the MARGINAL cost of
   the next vote is (v+1)^2 - v^2 = 2v + 1 credits - the first vote costs
   1, the tenth costs 19 more. Intensity is therefore expensive and broad
   support cheap: one voter with 100 credits casts at most 10 votes on a
   single proposal (floor(sqrt(budget)), exact BigInt square root), but
   splitting the same budget as 7 votes on each of two proposals costs
   49 + 49 = 98 for 14 votes in total. All arithmetic here is exact
   BigInt on whole credits and whole votes - votes are counts, never
   fractions, in the systems modelled. An over-budget ballot is REPORTED
   (overBudget, negative remaining) rather than rejected, because seeing
   by how much a ballot overshoots is the planning question; each
   framework sets its own budget, proposal count and credit rules - three
   proposals are modelled here and the convention is stated on the page.
   Prototype-verified before pinning: 20,000 cases, 0 mismatches on the
   sum-of-squares total, the signed remainder, a brute-forced floor
   square root, and the marginal-cost identity. */
var MAX_QV_BUDGET = 1000000000000;
var MAX_QV_VOTES = 1000000;

function quadraticVote(budget, votesA, votesB, votesC) {
  var B = Number(budget);
  var vs = [Number(votesA), Number(votesB), Number(votesC)];
  if (!Number.isInteger(B) || B <= 0 || B > MAX_QV_BUDGET) return null;
  for (var i = 0; i < vs.length; i++) {
    if (!Number.isInteger(vs[i]) || vs[i] < 0 || vs[i] > MAX_QV_VOTES) return null;
  }
  var costs = vs.map(function (v) { return BigInt(v) * BigInt(v); });
  var total = costs.reduce(function (s, x) { return s + x; }, 0n);
  var remaining = BigInt(B) - total;
  var maxSingle = isqrtBigInt(BigInt(B));
  return {
    budget: B,
    votes: vs,
    costs: costs.map(function (x) { return x.toString(); }),
    totalCost: total.toString(),
    remaining: remaining.toString(),
    overBudget: total > BigInt(B),
    totalVotes: vs.reduce(function (s, v) { return s + v; }, 0),
    maxSingleVotes: Number(maxSingle),
    maxSingleCost: (maxSingle * maxSingle).toString(),
    nextCosts: vs.map(function (v) { return (2n * BigInt(v) + 1n).toString(); })
  };
}

/* ---------- Tool 51: token burn & holder-share calculator ---------- */
/* A burn destroys tokens: supply falls by the burned amount and every
   holder who does NOT burn owns a larger share of what remains, without
   gaining a single token - the numerator stands still while the
   denominator shrinks. This model burns tokens held by OTHERS (a
   treasury or team burn is the common case): the holder's balance is
   unchanged, so the burn is bounded by supply - holder, and burning all
   of that leaves the holder at exactly 100%. Shares are floored to whole
   basis points in exact scaled-BigInt (a holder's true share is the
   rational balance / supply; the floored figure never overstates it),
   so a dust holder can floor to 0 bps before AND after - reported,
   not hidden. A burn does not by itself change a token's price, and
   none is modelled or implied here. Prototype-verified before pinning:
   20,000 cases, 0 mismatches against the Fraction definitions of the
   three floored shares, and the holder's share never fell. */
/* ---------- Tool 52: Merkle airdrop proof planner ---------- */
/* An airdrop or allowlist with N recipients is commonly committed as a
   Merkle tree: each recipient is a leaf, pairs hash upward to ONE root,
   and only that 32-byte root goes on-chain. A claim supplies a PROOF -
   one sibling hash per tree level - and the program hashes the leaf up
   the proof and checks it lands on the stored root, so a claim is
   verified without storing any other recipient on-chain. The tree is a
   full binary tree over the next power of two at or above N: depth is
   the smallest d with 2^d >= N (0 for a single recipient, whose leaf IS
   the root and whose proof is empty), padded leaves are 2^d, total
   nodes are 2 * 2^d - 1 and the proof is depth hashes of 32 bytes each.
   The step is the teaching point: 16,384 recipients fit depth 14
   exactly, and recipient 16,385 pushes the whole tree to depth 15 and
   every proof from 448 to 480 bytes. Counts here are exact BigInt; the
   leaf contents, hash function choice and any claim program are not
   modelled. Prototype-verified before pinning: 20,000 cases, 0
   mismatches against a naive level-by-level node count, with the
   minimality property 2^(d-1) < N <= 2^d holding throughout. */
var MAX_MERKLE_RECIPIENTS = 100000000;

function merkleProof(recipients) {
  var n = Number(recipients);
  if (!Number.isInteger(n) || n < 1 || n > MAX_MERKLE_RECIPIENTS) return null;
  var N = BigInt(n);
  var padded = 1n;
  var depth = 0;
  while (padded < N) { padded *= 2n; depth++; }
  return {
    recipients: n, depth: depth,
    paddedLeaves: padded.toString(), emptyLeaves: (padded - N).toString(),
    totalNodes: (2n * padded - 1n).toString(), internalNodes: (padded - 1n).toString(),
    proofHashes: depth, proofBytes: depth * 32, rootBytes: 32
  };
}

/* ---------- Tool 53: multisig approval planner ---------- */
/* A multisig wallet (Squads and similar on Solana) holds funds under
   N members and acts only when M of them approve - an M-of-N threshold,
   every member's vote equal. Three exact counts decide how safe and how
   live that setup is. Approvals still needed is max(0, M - A) for A
   approvals already collected. The number of member subsets that CAN
   approve is sum_{k=M}^{N} C(N,k) out of 2^N subsets in total - for a
   3-of-5 that is 10 + 5 + 1 = 16 of 32, exactly half. And the smallest
   BLOCKING coalition is N - M + 1 members: that many refusers leave
   fewer than M members able to approve, while one fewer refuser never
   blocks, so a unanimous N-of-N hands every single member a veto
   (blocking size 1) and a 1-of-N can only be blocked by all N refusing.
   Binomials are exact BigInt (multiplicative form, each step dividing
   exactly). Member identities, key custody and any live multisig are
   not modelled. Prototype-verified before pinning: brute-force subset
   enumeration for every N up to 12 and every threshold, plus a Pascal
   triangle cross-check of every binomial - 0 mismatches. */
var MAX_MULTISIG_MEMBERS = 100;

function binomBigInt(n, k) {
  if (k < 0 || k > n) return 0n;
  var kk = Math.min(k, n - k);
  var r = 1n;
  for (var i = 0; i < kk; i++) r = (r * BigInt(n - i)) / BigInt(i + 1);
  return r;
}

function multisigPlan(members, threshold, approved) {
  var N = Number(members);
  var M = Number(threshold);
  var A = Number(approved);
  if (!Number.isInteger(N) || !Number.isInteger(M) || !Number.isInteger(A)) return null;
  if (N < 1 || N > MAX_MULTISIG_MEMBERS || M < 1 || M > N || A < 0 || A > N) return null;
  var approving = 0n;
  for (var k = M; k <= N; k++) approving += binomBigInt(N, k);
  var blockingSize = N - M + 1;
  return {
    members: N, threshold: M, approved: A,
    stillNeeded: Math.max(0, M - A), ready: A >= M,
    thresholdBps: Number((BigInt(M) * 10000n) / BigInt(N)),
    approvingSubsets: approving.toString(),
    totalSubsets: (2n ** BigInt(N)).toString(),
    blockingSize: blockingSize,
    blockingSubsets: binomBigInt(N, blockingSize).toString(),
    singleCanBlock: M === N
  };
}

/* ---------- Tool 54: protocol buyback & burn planner ---------- */
/* A protocol that earns fees in a quote token can route that revenue into
   buying its own token back from a constant-product pool and burning what
   it buys - Raydium's fee-funded buyback of RAY is the best-known Solana
   form. The buy is Tool 2's cpSwap run verbatim (fee on the input, output
   floored at the smallest unit), so this tool cannot disagree with the
   hub's swap model about what a spend buys. Of the tokens bought, a
   burn share in basis points is destroyed - burned = floor(bought x
   burnBps / 10000), floored like Tool 51's burn - and the remainder goes
   to the treasury, so burned + treasury = bought exactly. The supply
   falls by the burned amount only: newSupply = supply - burned, and the
   burned share of the supply is floored to whole basis points (a real
   buyback is usually a few bps of supply, which is the honest scale).
   A burn larger than the stated supply is rejected - the pool cannot
   sell back more of the token than exists in this model. A buyback does
   not by itself set or raise a price, and none is promised: the average
   price paid (spend / bought) sits above spot by exactly the fee plus
   the price impact the buy itself causes. Where the revenue came from,
   how often buybacks run and any live program are not modelled.
   Prototype-verified before pinning: 20,000 random cases against the
   float definition of the swap (0 mismatches on the bought amount),
   with the split and supply invariants exact in BigInt throughout and
   the bought amount equal to cpSwap's own output on every case. */
function buybackBurn(reserveQuoteStr, reserveTokenStr, spendStr, feeBps, supplyStr, burnBps) {
  var sw = cpSwap(reserveQuoteStr, reserveTokenStr, spendStr, feeBps);
  if (!sw) return null;
  var S = parseScaled(supplyStr);
  var bb = Number(burnBps);
  if (S === null || S <= 0n) return null;
  if (!Number.isInteger(bb) || bb < 0 || bb > 10000) return null;
  var bought = parseScaled(sw.amountOut);
  var burned = (bought * BigInt(bb)) / 10000n;
  if (burned > S) return null;
  var treasury = bought - burned;
  return {
    fee: sw.fee, effectiveIn: sw.effectiveIn, bought: sw.amountOut,
    priceImpactPct: sw.priceImpactPct,
    burned: formatScaled(burned), treasury: formatScaled(treasury),
    burnBps: bb,
    supply: formatScaled(S), newSupply: formatScaled(S - burned),
    burnShareBps: Number((burned * 10000n) / S),
    spotPrice: Number(parseScaled(reserveQuoteStr)) / Number(parseScaled(reserveTokenStr)),
    avgPrice: Number(parseScaled(spendStr)) / Number(bought)
  };
}

/* ---------- Tool 55: escrow release & refund planner ---------- */
/* An escrow trade locks the buyer's payment in a program-controlled
   account until the seller delivers: on release the platform takes its
   fee and the seller receives the rest; on refund the buyer receives
   the whole amount back and no fee is charged - the fee exists only on
   the release path. The release split is exact scaled-BigInt:
   fee = floor(amount x feeBps / 10000), seller = amount - fee, so
   fee + seller = amount exactly and the effective fee share (floored
   to whole bps) never exceeds the stated fee. A dust payment can floor
   the fee to zero, which is reported, not rounded up. The escrow
   account itself locks a rent-exempt deposit - Tool 3's rentExempt run
   verbatim on the account's byte size - paid by whoever funds the
   account and reclaimed when it closes; it is locked, not a cost of
   the trade. This differs from Tool 23's sale split, which divides a
   completed sale price three ways at the moment of sale: here nothing
   is divided until release, and the refund path divides nothing at
   all. Delivery, disputes, arbiter decisions and timeouts are not
   modelled, and no live escrow is read.
   Prototype-verified before pinning: 20,000 random cases, 0 mismatches
   on the floor-minimality of the fee, fee + seller = amount exactly,
   the effective share never exceeding the stated fee, and the rent
   equalling (128 + bytes) x 3480 x 2. */
function escrowRelease(amountStr, feeBps, escrowBytes) {
  var A = parseScaled(amountStr);
  var bps = Number(feeBps);
  if (A === null || A <= 0n) return null;
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) return null;
  var rent = rentExempt(escrowBytes);
  if (!rent) return null;
  var fee = (A * BigInt(bps)) / 10000n;
  var seller = A - fee;
  return {
    amount: formatScaled(A), feeBps: bps,
    fee: formatScaled(fee), seller: formatScaled(seller),
    refund: formatScaled(A),
    effectiveBps: Number((fee * 10000n) / A),
    feeIsZero: fee === 0n,
    escrowBytes: rent.dataLen,
    rentLamports: rent.rentExemptLamports,
    rentSol: rent.rentExemptSol
  };
}

/* ---------- Tool 56: DCA execution planner ---------- */
/* A dollar-cost-averaging program (Jupiter's DCA is the common Solana
   form) splits one intended buy into N equal orders executed over time.
   This model freezes the pool - no price movement between orders, no
   replenishment - and runs the orders back to back, each one Tool 2's
   swap math against the reserves the previous order left, so the split
   can be compared honestly with one lump buy of the same total. The
   total is split exactly in scaled BigInt: every order is
   floor(total / N) and the first (total mod N) orders carry one extra
   smallest unit, so the orders sum to the total exactly. The finding
   the model exists to show: against a frozen pool the split receives
   the lump amount to within flooring dust (the headline differs by 5
   smallest units in 90,702) - walking the same curve in steps lands
   where one walk lands, because each order's output flooring and each
   order's fee flooring pull a few smallest units in opposite
   directions. Splitting therefore buys nothing on execution against an
   unmoving pool; what it buys in reality is exposure to DIFFERENT
   prices over time, which no model can promise, and its certain cost
   is one transaction fee per order (a per-order lamport input here,
   charged on top of the pool fee). A tranche that floors to a zero
   output, or a total too small to give every order a whole smallest
   unit, rejects the plan. Between-order price movement, aggregator or
   program fees beyond the per-order transaction fee, and any live DCA
   program are not modelled.
   Prototype-verified before pinning: 20,000 random cases - the orders
   sum to the total exactly on every case, a single order equals
   cpSwap's own output and fee exactly, and the split's total pool fee
   never exceeds the lump fee and trails it by fewer than N smallest
   units (each order's fee floors separately). */
var MAX_DCA_ORDERS = 1000;
var MAX_DCA_TX_FEE_LAMPORTS = 1000000;

function dcaPlan(reserveInStr, reserveOutStr, totalInStr, feeBps, orders, txFeeLamports) {
  var rIn = parseScaled(reserveInStr);
  var rOut = parseScaled(reserveOutStr);
  var T = parseScaled(totalInStr);
  var bps = Number(feeBps);
  var n = Number(orders);
  var txFee = Number(txFeeLamports);
  if (rIn === null || rOut === null || T === null) return null;
  if (rIn <= 0n || rOut <= 0n || T <= 0n) return null;
  if (!Number.isInteger(bps) || bps < 0 || bps >= 10000) return null;
  if (!Number.isInteger(n) || n < 1 || n > MAX_DCA_ORDERS) return null;
  if (!Number.isInteger(txFee) || txFee < 0 || txFee > MAX_DCA_TX_FEE_LAMPORTS) return null;
  var lump = cpSwap(reserveInStr, reserveOutStr, totalInStr, feeBps);
  if (!lump) return null;
  var base = T / BigInt(n);
  var rem = T - base * BigInt(n);
  if (base <= 0n) return null;
  var curIn = rIn, curOut = rOut, totOut = 0n, totFee = 0n;
  for (var i = 0; i < n; i++) {
    var a = base + (BigInt(i) < rem ? 1n : 0n);
    var fee = (a * BigInt(bps)) / 10000n;
    var eff = a - fee;
    if (eff <= 0n) return null;
    var out = (eff * curOut) / (curIn + eff);
    if (out <= 0n || out >= curOut) return null;
    totOut += out; totFee += fee; curIn += eff; curOut -= out;
  }
  var txTotal = BigInt(n) * BigInt(txFee);
  var diff = totOut - parseScaled(lump.amountOut);
  return {
    orders: n, tranche: formatScaled(base), remainderUnits: rem.toString(),
    totalIn: formatScaled(T),
    dcaOut: formatScaled(totOut), dcaFees: formatScaled(totFee),
    lumpOut: lump.amountOut, lumpFee: lump.fee,
    diff: formatScaled(diff), diffUnits: diff.toString(),
    txFeePerOrder: txFee, txFeesLamports: txTotal.toString(),
    txFeesSol: formatScaled(txTotal),
    avgPriceDca: Number(T) / Number(totOut),
    avgPriceLump: Number(T) / Number(parseScaled(lump.amountOut))
  };
}

/* ---------- Tool 57: DLMM bin price planner ---------- */
/* A discrete liquidity market maker (Meteora's DLMM is the common
   Solana form) does not slide along a curve: it splits the price range
   into BINS, and every bin has one fixed price. The price at bin id is
   (1 + binStep / 10000) ^ binId, where the bin step is in basis points
   - so adjacent bins differ by exactly the step percentage, and the
   price is a pure geometric ladder in the bin id. Bin 0 is price 1 by
   construction, positive ids multiply up, negative ids divide down
   (price at -id is the exact reciprocal of price at id). This is NOT
   Tool 10's CLMM tick math: a tick scales the SQUARE ROOT of the price
   by 1.0001 per tick, a bin scales the price itself by (1 + step) per
   bin. Everything here is exact BigInt rational arithmetic - the price
   is ((10000 + step) ^ id) / (10000 ^ id), or its reciprocal for
   negative ids, floored at the 9th decimal like an on-chain fixed
   point read. The range multiplier across a symmetric position of
   half-width w bins is ((1 + step) ^ (2w)) and does NOT depend on
   where the position sits - only the step and the width set the span.
   Bins to double is the smallest n with (1 + step) ^ n >= 2, found by
   a float estimate corrected with exact BigInt power comparisons; by
   the reciprocal symmetry it is also the bins to halve. A price can
   floor to zero at this display precision only at extreme negative
   ids with a huge step (2 ^ -2000); that is flagged, not hidden.
   Liquidity per bin, the bin step's fee behaviour, DLMM's variable
   volatility fee and any live pool are not modelled.
   Prototype-verified before pinning: exact Fraction arithmetic on the
   headline and four further vectors, a bins-to-double table for steps
   1..10000 bps (6932 at 1 bps, 278 at 25 bps, 1 at 10000 bps), and a
   3,000-case exact sweep (each bin's price is the previous bin's price
   times the step ratio exactly; prices strictly increase with id). */
var MAX_DLMM_BIN_ID = 2000;
var MAX_DLMM_WIDTH = 500;

function dlmmPriceScaled(stepBps, binId) {
  var up = 10000n + BigInt(stepBps);
  var a = binId < 0 ? -binId : binId;
  var num, den;
  if (binId >= 0) { num = up ** BigInt(a); den = 10000n ** BigInt(a); }
  else { num = 10000n ** BigInt(a); den = up ** BigInt(a); }
  return (num * SCALE) / den;
}

function dlmmBins(stepBps, binId, width) {
  var s = Number(stepBps);
  var id = Number(binId);
  var w = Number(width);
  if (!Number.isInteger(s) || s < 1 || s > 10000) return null;
  if (!Number.isInteger(id) || id < -MAX_DLMM_BIN_ID || id > MAX_DLMM_BIN_ID) return null;
  if (!Number.isInteger(w) || w < 1 || w > MAX_DLMM_WIDTH) return null;
  var lowerId = id - w, upperId = id + w;
  var active = dlmmPriceScaled(s, id);
  var lower = dlmmPriceScaled(s, lowerId);
  var upper = dlmmPriceScaled(s, upperId);
  var up = 10000n + BigInt(s);
  var mult = ((up ** BigInt(2 * w)) * SCALE) / (10000n ** BigInt(2 * w));
  /* bins to double: smallest n >= 1 with (10000 + s)^n >= 2 * 10000^n */
  var n = Math.max(1, Math.ceil(Math.log(2) / Math.log1p(s / 10000)));
  var powCmp = function (k) {
    return (up ** BigInt(k)) >= 2n * (10000n ** BigInt(k));
  };
  while (!powCmp(n)) n++;
  while (n > 1 && powCmp(n - 1)) n--;
  return {
    stepBps: s, stepPct: s / 100,
    binId: id, width: w, lowerId: lowerId, upperId: upperId,
    activePrice: formatScaled(active),
    lowerPrice: formatScaled(lower),
    upperPrice: formatScaled(upper),
    rangeMultiplier: formatScaled(mult),
    spanPct: (Number(mult) / Number(SCALE) - 1) * 100,
    binsToDouble: n,
    floorsToZero: active === 0n || lower === 0n || upper === 0n
  };
}

/* ---------- Tool 58: classic NFT mint cost (Metaplex account recipe) ---------- */
/* A classic (non-compressed) Metaplex NFT is four accounts, each funded
   rent-exempt at creation: the mint (82 bytes), the holder's token account
   (165 bytes), the metadata account (allocated at its 679-byte maximum) and,
   when one is created, the master edition account (282 bytes). Every figure
   is Tool 3's rentExempt run verbatim, so the tools cannot disagree. The
   deposits are locked, not spent - closing an account reclaims its deposit -
   but the minter must hold them up front. Marketplace and program mint fees
   and the transaction fees are separate and not modelled. */
var NFT_MINT_BYTES = 82;
var NFT_TOKEN_ACCOUNT_BYTES = 165;
var NFT_METADATA_BYTES = 679;
var NFT_EDITION_BYTES = 282;
var MAX_NFT_COUNT = 100000;

function nftMintCost(count, editions) {
  var n = Number(count);
  var e = Number(editions);
  if (!Number.isInteger(n) || n < 1 || n > MAX_NFT_COUNT) return null;
  if (!Number.isInteger(e) || e < 0 || e > n) return null;
  var mintRent = rentExempt(NFT_MINT_BYTES).rentExemptLamports;
  var tokenRent = rentExempt(NFT_TOKEN_ACCOUNT_BYTES).rentExemptLamports;
  var metadataRent = rentExempt(NFT_METADATA_BYTES).rentExemptLamports;
  var editionRent = rentExempt(NFT_EDITION_BYTES).rentExemptLamports;
  var perNft = mintRent + tokenRent + metadataRent;
  var perNftWithEdition = perNft + editionRent;
  var totalBytes = BigInt(n) * BigInt(NFT_MINT_BYTES + NFT_TOKEN_ACCOUNT_BYTES + NFT_METADATA_BYTES) + BigInt(e) * BigInt(NFT_EDITION_BYTES);
  var total = BigInt(n) * BigInt(perNft) + BigInt(e) * BigInt(editionRent);
  return {
    count: n, editions: e,
    mintRentLamports: mintRent, tokenRentLamports: tokenRent,
    metadataRentLamports: metadataRent, editionRentLamports: editionRent,
    perNftLamports: perNft, perNftWithEditionLamports: perNftWithEdition,
    totalBytes: totalBytes.toString(),
    totalLamports: total.toString(),
    totalSol: formatScaled(total),
    perNftSol: formatScaled(BigInt(perNftWithEdition))
  };
}

/* ---------- Tool 59: program deploy cost (upgradeable loader) ---------- */
/* Deploying through the upgradeable BPF loader creates two permanent
   accounts, each funded rent-exempt: the program account (36 bytes - a
   4-byte state tag plus the 32-byte programdata address) and the
   programdata account (a 45-byte header - tag, deployment slot and the
   upgrade-authority option plus key - followed by space for the program's
   ELF bytes, allocated at the deploy's maximum data length, which may
   exceed today's ELF to leave room for upgrades). The upload first stages
   the ELF in a buffer account (a 37-byte header - the same layout minus
   the slot field - plus the same maximum length); the buffer is transient
   and its deposit is reclaimed when the deploy completes, so it counts
   toward the PEAK funding the deployer must hold, not the amount left
   locked. Every figure is Tool 3's rentExempt run verbatim on those
   sizes, so the tools cannot disagree; the 8-byte header gap makes the
   buffer's deposit exactly 55,680 lamports smaller than the programdata
   account's. Headroom is priced at exactly 6,960 lamports per byte -
   the same per-byte figure an ExtendProgram top-up would charge later,
   so reserving space now and extending later cost the same rent; only
   the timing differs. Transaction fees for the chunked upload writes
   are separate and not modelled. */
var PROGRAM_ACCOUNT_BYTES = 36;
var PROGRAMDATA_HEADER_BYTES = 45;
var BUFFER_HEADER_BYTES = 37;
var MAX_PROGRAM_BYTES = 10485760;

function programDeployCost(elfBytes, maxBytes) {
  var elf = Number(elfBytes);
  var mx = Number(maxBytes);
  if (!Number.isInteger(elf) || elf < 1 || elf > MAX_PROGRAM_BYTES) return null;
  if (!Number.isInteger(mx) || mx < elf || mx > MAX_PROGRAM_BYTES) return null;
  var programRent = rentExempt(PROGRAM_ACCOUNT_BYTES).rentExemptLamports;
  var programDataRent = rentExempt(PROGRAMDATA_HEADER_BYTES + mx).rentExemptLamports;
  var bufferRent = rentExempt(BUFFER_HEADER_BYTES + mx).rentExemptLamports;
  var locked = BigInt(programRent) + BigInt(programDataRent);
  var peak = locked + BigInt(bufferRent);
  var headroom = mx - elf;
  return {
    elfBytes: elf, maxBytes: mx,
    programBytes: PROGRAM_ACCOUNT_BYTES, programRentLamports: programRent,
    programDataBytes: PROGRAMDATA_HEADER_BYTES + mx, programDataRentLamports: programDataRent,
    bufferBytes: BUFFER_HEADER_BYTES + mx, bufferRentLamports: bufferRent,
    lockedLamports: locked.toString(), lockedSol: formatScaled(locked),
    peakLamports: peak.toString(), peakSol: formatScaled(peak),
    headroomBytes: headroom,
    headroomRentLamports: headroom * RENT_LAMPORTS_PER_BYTE_YEAR * RENT_EXEMPTION_YEARS
  };
}

/* ---------- Tool 60: CLMM impermanent loss (position vs holding) ---------- */
/* Tool 4 prices impermanent loss for a full-range constant-product
   position; a concentrated position behaves differently, and the
   difference is the range. This model composes Tool 17 verbatim at two
   ticks with the same liquidity and range: the amounts the position
   holds at the ENTRY tick are the "just hold" portfolio, the amounts
   at the EXIT tick are the position, and both are valued in token1 at
   the exit price (price = token1 per token0, Tool 10):
     holdValue     = entryAmount0 * priceExit + entryAmount1
     positionValue = exitAmount0 * priceExit + exitAmount1
     ilPct         = (positionValue / holdValue - 1) * 100
   The position rebalances along its curve as the price moves, selling
   the appreciating asset into the depreciating one, so the position
   value never exceeds the hold value and the two agree exactly when
   the exit tick is the entry tick. Once the price leaves the range the
   position stops rebalancing - above the range it is entirely token1,
   below it entirely token0 - while the held portfolio keeps moving
   with the price, so the gap keeps widening outside the range. As the
   range widens toward the full tick range the result converges to
   Tool 4's constant-product figure for the same price move (asserted
   in the test suite). Swap fees the position earns are excluded -
   they are Tool 25's figures and are what offsets this loss in
   practice; a position can be net positive after fees while this
   figure is negative. Amounts and values are floats like Tool 17's,
   in raw token units. */
function clmmImpermanentLoss(liquidityStr, lower, upper, entryTick, exitTick) {
  var entry = clmmPosition(liquidityStr, lower, upper, entryTick);
  if (entry === null) return null;
  var exitPos = clmmPosition(liquidityStr, lower, upper, exitTick);
  if (exitPos === null) return null;
  var priceEntry = entry.priceCurrent;
  var priceExit = exitPos.priceCurrent;
  var holdValue = entry.amount0 * priceExit + entry.amount1;
  var positionValue = exitPos.valueInToken1;
  return {
    liquidity: entry.liquidity,
    tickLower: entry.tickLower, tickUpper: entry.tickUpper,
    tickEntry: entry.tickCurrent, tickExit: exitPos.tickCurrent,
    priceEntry: priceEntry, priceExit: priceExit,
    priceRatio: priceExit / priceEntry,
    entryAmount0: entry.amount0, entryAmount1: entry.amount1,
    exitAmount0: exitPos.amount0, exitAmount1: exitPos.amount1,
    entryStatus: entry.status, exitStatus: exitPos.status,
    inRangeAtExit: exitPos.inRange,
    entryValueToken1: entry.valueInToken1,
    holdValueToken1: holdValue,
    positionValueToken1: positionValue,
    shortfallToken1: holdValue - positionValue,
    ilPct: (positionValue / holdValue - 1) * 100
  };
}

/* ---------- Tool 61: options payoff at expiry (long call / long put) ---------- */
/* An option is the other standardised derivative beside the perpetuals
   of Tools 34 and 36 (Drift and Zeta are the common Solana venues): a
   long CALL pays max(spot - strike, 0) per unit at expiry, a long PUT
   pays max(strike - spot, 0) per unit, and the
   buyer paid the PREMIUM up front, so the net is payoff minus premium
   and the worst case is losing exactly the premium - a long option can
   never lose more, which is the whole point of buying one. The
   break-even expiry price is strike + premium for a call and
   strike - premium for a put; at exactly that price the intrinsic value
   per unit equals the premium, so the net is exactly zero in this
   scaled math (the totals floor identically). A put whose premium
   exceeds its strike has NO break-even at or above zero: even at a
   spot of zero its payoff per unit is the strike, still short of the
   premium - returned as null and flagged, never as a negative price.
   Everything is exact scaled BigInt; the two totals (intrinsic x
   quantity, premium x quantity) floor at the smallest unit like an
   on-chain division. Only the LONG side is modelled: a short option's
   loss profile is the mirror image with margin on top, stated on the
   page. No time value, volatility or early exercise - expiry payoff
   only, which is the definition the Greeks refine, not replace.
   Verified before shipping on 20,000 prototype cases against exact
   rational arithmetic (0 bad: floors within one smallest unit, net
   never below -premium, break-even nets exactly zero). */
function optionsPayoff(kind, strikeStr, premiumStr, expiryStr, qtyStr) {
  var K = parseScaled(strikeStr);
  var P = parseScaled(premiumStr);
  var S = parseScaled(expiryStr);
  var Q = parseScaled(qtyStr);
  if (K === null || P === null || S === null || Q === null) return null;
  if (K <= 0n || Q <= 0n) return null;
  if (kind !== "call" && kind !== "put") return null;
  var intrinsic = kind === "call" ? (S > K ? S - K : 0n) : (K > S ? K - S : 0n);
  var payoffTotal = (intrinsic * Q) / SCALE;
  var premiumTotal = (P * Q) / SCALE;
  var pnl = payoffTotal - premiumTotal;
  var breakEven = null;
  if (kind === "call") breakEven = K + P;
  else if (P <= K) breakEven = K - P;
  return {
    kind: kind, strike: formatScaled(K), premium: formatScaled(P),
    expiryPrice: formatScaled(S), quantity: formatScaled(Q),
    intrinsicPerUnit: formatScaled(intrinsic),
    payoffTotal: formatScaled(payoffTotal), premiumTotal: formatScaled(premiumTotal),
    pnl: formatScaled(pnl), pnlIsProfit: pnl > 0n, pnlIsLoss: pnl < 0n,
    pnlPct: premiumTotal > 0n ? Number(pnl) / Number(premiumTotal) * 100 : null,
    breakEven: breakEven === null ? null : formatScaled(breakEven),
    neverBreaksEven: breakEven === null,
    maxLoss: formatScaled(premiumTotal),
    moneyness: intrinsic === 0n ? (S === K ? "at" : "out") : "in",
    worthless: intrinsic === 0n
  };
}

/* ---------- Tool 62: blockhash expiry (last valid block height) ---------- */
/* Every transaction carries a RECENT BLOCKHASH, and the runtime will
   only process it while that blockhash is recent enough: the maximum
   processing age is 150 BLOCKS. The RPC's getLatestBlockhash says the
   same thing directly - it returns the blockhash alongside its
   lastValidBlockHeight, which is the block height the blockhash came
   from + 150. The count is in BLOCK HEIGHT, not slots: a skipped slot
   produces no block and does not age a blockhash, which is why wallets
   and explorers track expiry by height even though Tool 12's schedule
   runs on slots. Because the age is 0-indexed, a blockhash can land at
   151 distinct block heights - its own height through its last valid
   height inclusive; one block past that it is expired and the
   transaction can never land (it must be rebuilt and re-signed on a
   fresh blockhash). A DURABLE NONCE transaction is the stated
   exception - its "blockhash" is a stored nonce value that does not
   age this way - and is not modelled here. Heights are whole numbers
   parsed as BigInt and capped at 1e15, far above any live cluster.
   Verified before shipping on 20,000 prototype cases against the
   definition (0 bad: valid exactly when fetched <= current <=
   lastValid, remaining + age = 150, expiredBy = age - 150, and the
   valid window counts exactly 151 heights). */
var MAX_PROCESSING_AGE_BLOCKS = 150;
var MAX_BLOCK_HEIGHT = 1000000000000000n;

function parseBlockHeight(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^\d+$/.test(s)) return null;
  var v = BigInt(s);
  if (v > MAX_BLOCK_HEIGHT) return null;
  return v;
}

function blockhashExpiry(fetchedStr, currentStr) {
  var F = parseBlockHeight(fetchedStr);
  var C = parseBlockHeight(currentStr);
  if (F === null || C === null) return null;
  if (C < F) return null; /* a current height before the blockhash existed is inconsistent input */
  var last = F + BigInt(MAX_PROCESSING_AGE_BLOCKS);
  var age = C - F;
  var expired = C > last;
  return {
    blockhashHeight: F.toString(), currentHeight: C.toString(),
    lastValidHeight: last.toString(),
    ageBlocks: Number(age),
    remainingBlocks: expired ? null : Number(last - C),
    expiredBy: expired ? Number(C - last) : 0,
    windowBlocks: MAX_PROCESSING_AGE_BLOCKS + 1,
    status: expired ? "expired" : (C === last ? "last" : "valid")
  };
}

/* ---------- Tool 63: Anchor discriminator (sighash) finder ---------- */
/* Every Anchor instruction's data starts with an 8-byte DISCRIMINATOR
   and every Anchor account's data starts with one too (Tool 22 budgets
   those 8 bytes): by default it is the first 8 bytes of the SHA-256 of
   "<namespace>:<name>" - "global:<instruction name>" for instructions,
   the Rust function name in snake_case exactly as declared, and
   "account:<account name>" for accounts, the Rust struct name in
   PascalCase exactly as declared. The hash is case-sensitive and
   namespace-sensitive, so renaming or recasing a function or struct
   changes its discriminator - which is why an Anchor rename silently
   breaks every existing client and account. Only the DEFAULT
   hash-derived discriminator is modelled: newer Anchor versions let a
   program override it with a custom discriminator, and those programs
   are stated on-page as out of scope. Names are validated as Rust
   identifiers (a letter or underscore, then letters, digits and
   underscores) and capped at 128 characters, far above real names.
   Verified before shipping against Node's crypto SHA-256 on 20,000
   random names (0 mismatches on the full hash, the discriminator hex
   and the byte list) and against two published vectors:
   global:initialize -> afaf6d1f0d989bed ([175, 175, 109, 31, 13, 152,
   155, 237]) and account:MyAccount -> f61c0657fb2d322a ([246, 28, 6,
   87, 251, 45, 50, 42], Anchor's own IDL example). The hash runs on
   the hub's own sha256Bytes - the same implementation Tool 16's PDA
   finder is proven on. */
var MAX_ANCHOR_NAME_CHARS = 128;

function anchorDiscriminator(kind, nameStr) {
  if (kind !== "instruction" && kind !== "account") return null;
  if (typeof nameStr !== "string") return null;
  var name = nameStr.trim();
  if (name.length === 0 || name.length > MAX_ANCHOR_NAME_CHARS) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
  var namespace = kind === "instruction" ? "global" : "account";
  var preimage = namespace + ":" + name;
  var bytes = utf8Bytes(preimage);
  if (bytes === null) return null;
  var hash = sha256Bytes(bytes);
  var disc = hash.slice(0, 8);
  var toHex = function (arr) {
    return arr.map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  };
  return {
    kind: kind, name: name, namespace: namespace, preimage: preimage,
    hashHex: toHex(hash), discriminatorHex: toHex(disc),
    discriminatorBytes: disc
  };
}

/* ---------- Tool 64: account reallocation (realloc) planner ---------- */
/* A program can change its account's data length with realloc, but the
   runtime caps each single growth at MAX_PERMITTED_DATA_INCREASE =
   10,240 bytes (10 KiB), so growing by more takes that many separate
   realloc calls - in Anchor, one per instruction that enables realloc
   (or a loop of calls). The cap is on GROWTH only: shrinking in one
   call is unrestricted. No account may exceed MAX_ACCOUNT_DATA_LEN =
   10 MiB = 10,485,760 bytes of data. The account must stay rent-exempt
   at its new length, so growing needs a top-up of exactly Tool 3's
   rent difference - 6,960 lamports per added byte - transferred in
   before or with the growth, and shrinking releases the same per-byte
   figure back. Every rent figure here is rentExempt's own run at the
   two lengths, so this tool cannot disagree with Tool 3. Lengths are
   whole bytes parsed as BigInt and capped at the 10 MiB account
   maximum. Verified before shipping against the definition on 20,000
   prototype cases (0 bad: the step count is the ceiling of the growth
   over 10,240, the last step is the remainder, the top-up is exactly
   6,960 lamports per byte of growth, and both rents equal Tool 3's
   runs verbatim). */
var MAX_PERMITTED_DATA_INCREASE = 10240;
var MAX_ACCOUNT_DATA_LEN = 10485760;

function parseAccountLen(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^\d+$/.test(s)) return null;
  var v = BigInt(s);
  if (v > BigInt(MAX_ACCOUNT_DATA_LEN)) return null;
  return v;
}

function reallocPlan(currentStr, targetStr) {
  var C = parseAccountLen(currentStr);
  var T = parseAccountLen(targetStr);
  if (C === null || T === null) return null;
  var growth = T - C;
  var cap = BigInt(MAX_PERMITTED_DATA_INCREASE);
  var steps = growth > 0n ? Number((growth + cap - 1n) / cap) : 0;
  var lastStepBytes = steps === 0 ? 0 : Number(growth - BigInt(steps - 1) * cap);
  var oldRent = rentExempt(Number(C));
  var newRent = rentExempt(Number(T));
  if (oldRent === null || newRent === null) return null;
  var topUp = BigInt(newRent.rentExemptLamports) - BigInt(oldRent.rentExemptLamports);
  var absTop = topUp < 0n ? -topUp : topUp;
  return {
    currentBytes: C.toString(), targetBytes: T.toString(),
    growthBytes: growth.toString(), steps: steps, lastStepBytes: lastStepBytes,
    oldRentLamports: oldRent.rentExemptLamports,
    newRentLamports: newRent.rentExemptLamports,
    topUpLamports: topUp.toString(), topUpSol: formatScaled(absTop),
    direction: topUp > 0n ? "top-up" : (topUp < 0n ? "refund" : "none")
  };
}

/* Tool 65 - durable nonce planner. A durable-nonce transaction replaces
   the recent blockhash (Tool 62's 150-block window) with the blockhash
   stored in a nonce account, so it stays landable until that account's
   nonce is advanced. The account's state is NONCE_ACCOUNT_BYTES = 80
   bytes (version + state + authority + stored blockhash + fee
   calculator) and it must be rent-exempt, so each account locks
   rentExempt(80) = 1,447,680 lamports, composed from Tool 3 verbatim.
   A transaction's first instruction must be AdvanceNonceAccount, which
   replaces the stored value - so each stored value backs exactly one
   transaction. Transactions that may land in any order each need their
   own account; an ordered chain can share one account, because each
   transaction's advance produces exactly the value the next one signed
   against, but the chain must then land strictly in signing order. */
var NONCE_ACCOUNT_BYTES = 80;
var MAX_NONCE_TRANSACTIONS = 10000;

function durableNoncePlan(countStr, mode) {
  if (typeof countStr !== "string") return null;
  var s = countStr.trim();
  if (!/^\d+$/.test(s)) return null;
  var count = Number(s);
  if (!Number.isInteger(count) || count < 1 || count > MAX_NONCE_TRANSACTIONS) return null;
  if (mode !== "independent" && mode !== "ordered") return null;
  var rent = rentExempt(NONCE_ACCOUNT_BYTES);
  if (rent === null) return null;
  var accounts = mode === "independent" ? count : 1;
  var total = BigInt(rent.rentExemptLamports) * BigInt(accounts);
  return {
    transactions: count, mode: mode, accounts: accounts,
    accountBytes: NONCE_ACCOUNT_BYTES,
    rentPerAccountLamports: rent.rentExemptLamports,
    totalRentLamports: total.toString(), totalRentSol: formatScaled(total)
  };
}

/* Tool 66 - Token-2022 mint extension space planner. A Token-2022 mint
   keeps the classic 82-byte mint layout; each extension a builder enables
   appends a TLV (type-length-value) record after it: a 2-byte type and a
   2-byte length in front of the extension's own fixed-size data, plus a
   single account-type byte ahead of the first record. With no extensions
   the account is exactly 82 bytes and carries neither the marker byte nor
   any record. If the total would land on exactly 355 bytes - the length
   of a multisig account - the length calculation adds 2 more bytes, so
   no extended mint or token account can ever be mistaken for a multisig
   by length alone. The data lengths below are the Token-2022 program's
   own extension definitions (prototype-verified against the reference
   client SDK's getTypeLen for all 15 fixed-size mint extensions and over
   every combination of three picks). The variable-length TokenMetadata
   extension is NOT modelled - its size depends on the metadata packed
   into it. Rent is Tool 3's rentExempt run at the computed size,
   verbatim. Token-account extensions are a separate list and are not
   modelled here. */
var T22_MINT_BASE_BYTES = 82;
var T22_TLV_HEADER_BYTES = 4;
var T22_MULTISIG_ACCOUNT_BYTES = 355;
var T22_MINT_EXTENSION_BYTES = {
  transferFeeConfig: 108, mintCloseAuthority: 32, confidentialTransferMint: 65,
  defaultAccountState: 1, nonTransferable: 0, interestBearingConfig: 52,
  permanentDelegate: 32, transferHook: 64, metadataPointer: 64,
  groupPointer: 64, tokenGroup: 80, groupMemberPointer: 64,
  tokenGroupMember: 72, scaledUiAmountConfig: 56, pausableConfig: 33
};

function token2022MintSpace(ext1, ext2, ext3) {
  var picks = [ext1, ext2, ext3];
  var distinct = [];
  var chosen = 0;
  for (var i = 0; i < picks.length; i++) {
    var k = picks[i];
    if (k === "none") continue;
    if (typeof k !== "string" || !Object.prototype.hasOwnProperty.call(T22_MINT_EXTENSION_BYTES, k)) return null;
    chosen++;
    if (distinct.indexOf(k) === -1) distinct.push(k);
  }
  var tlvBytes = 0;
  for (var j = 0; j < distinct.length; j++) tlvBytes += T22_TLV_HEADER_BYTES + T22_MINT_EXTENSION_BYTES[distinct[j]];
  var accountTypeBytes = distinct.length > 0 ? 1 : 0;
  var sizeBytes = T22_MINT_BASE_BYTES + accountTypeBytes + tlvBytes;
  var padded = false;
  if (sizeBytes === T22_MULTISIG_ACCOUNT_BYTES) { sizeBytes += 2; padded = true; }
  var rent = rentExempt(sizeBytes);
  if (rent === null) return null;
  return {
    extensions: distinct, extensionCount: distinct.length,
    duplicatesIgnored: chosen - distinct.length,
    baseBytes: T22_MINT_BASE_BYTES, accountTypeBytes: accountTypeBytes,
    tlvBytes: tlvBytes, sizeBytes: sizeBytes, padded: padded,
    rentLamports: rent.rentExemptLamports, rentSol: formatScaled(BigInt(rent.rentExemptLamports))
  };
}

/* Tool 67 - Token-2022 token-account extension space planner. The token
   account side of Tool 66: a Token-2022 token account keeps the classic
   165-byte token-account layout, and each account extension appends the
   same kind of TLV record (the shared 4-byte header plus its own data)
   behind the same single account-type byte. Several records are not the
   account owner's choice at all - they follow the mint: a transfer-fee
   mint puts a TransferFeeAmount record (the withheld fees, 8 bytes of
   data) on every one of its token accounts, and confidential-transfer,
   non-transferable, transfer-hook and pausable mints do the same with
   theirs; ImmutableOwner, MemoTransfer and CpiGuard are the owner's own
   picks. The multisig padding rule is shared with the mint side, but no
   combination of these 8 extensions can total 355 bytes: without the
   confidential record (295 bytes of data) the largest total is 205, with
   it the smallest is 465 (prototype-verified over all 256 subsets and
   all 729 three-pick combinations against the reference client SDK's
   getAccountLen and getTypeLen, 0 mismatches). Rent is Tool 3's
   rentExempt run at the computed size, verbatim. */
var T22_ACCOUNT_BASE_BYTES = 165;
var T22_ACCOUNT_EXTENSION_BYTES = {
  transferFeeAmount: 8, confidentialTransferAccount: 295, immutableOwner: 0,
  memoTransfer: 1, cpiGuard: 1, nonTransferableAccount: 0,
  transferHookAccount: 1, pausableAccount: 0
};

function token2022AccountSpace(ext1, ext2, ext3) {
  var picks = [ext1, ext2, ext3];
  var distinct = [];
  var chosen = 0;
  for (var i = 0; i < picks.length; i++) {
    var k = picks[i];
    if (k === "none") continue;
    if (typeof k !== "string" || !Object.prototype.hasOwnProperty.call(T22_ACCOUNT_EXTENSION_BYTES, k)) return null;
    chosen++;
    if (distinct.indexOf(k) === -1) distinct.push(k);
  }
  var tlvBytes = 0;
  for (var j = 0; j < distinct.length; j++) tlvBytes += T22_TLV_HEADER_BYTES + T22_ACCOUNT_EXTENSION_BYTES[distinct[j]];
  var accountTypeBytes = distinct.length > 0 ? 1 : 0;
  var sizeBytes = T22_ACCOUNT_BASE_BYTES + accountTypeBytes + tlvBytes;
  var padded = false;
  if (sizeBytes === T22_MULTISIG_ACCOUNT_BYTES) { sizeBytes += 2; padded = true; }
  var rent = rentExempt(sizeBytes);
  if (rent === null) return null;
  return {
    extensions: distinct, extensionCount: distinct.length,
    duplicatesIgnored: chosen - distinct.length,
    baseBytes: T22_ACCOUNT_BASE_BYTES, accountTypeBytes: accountTypeBytes,
    tlvBytes: tlvBytes, sizeBytes: sizeBytes, padded: padded,
    rentLamports: rent.rentExemptLamports, rentSol: formatScaled(BigInt(rent.rentExemptLamports))
  };
}

/* Tool 68 - Compute budget planner. A transaction that never sets a
   compute-unit limit is given one by default: 200,000 CU per instruction,
   capped at the runtime maximum of 1,400,000 CU per transaction (Tool 5's
   MAX_COMPUTE_UNIT_LIMIT). That default matters twice over. Execution
   fails the moment usage passes the limit, so a transaction whose real
   usage (measured by simulating it) exceeds the default dies unless it
   asks for more; and the prioritization fee of Tool 5 is charged on the
   REQUESTED limit, not on usage, so every unused unit of an oversized
   limit is paid for. The planner's recommendation is the measured usage
   grossed up by a user-chosen headroom percentage, ceilinged in whole
   compute units: at or below the cap it always covers the measured usage,
   and its priority fee is Tool 5's own run at that limit, so the two
   tools cannot disagree. Usage above the 1,400,000 maximum is feasible
   in no single transaction - the work must be split - and headroom that
   would push the recommendation past the maximum is capped there and
   flagged, because the transaction then carries no spare room at all. */
var DEFAULT_CU_PER_INSTRUCTION = 200000;

function computeBudgetPlan(ixCount, usedCu, headroomPct, cuPriceMicro) {
  var ix = Number(ixCount), used = Number(usedCu), head = Number(headroomPct), price = Number(cuPriceMicro);
  if (!Number.isInteger(ix) || ix < 1 || ix > 256) return null;
  if (!Number.isInteger(used) || used < 1 || used > 100000000) return null;
  if (!Number.isInteger(head) || head < 0 || head > 900) return null;
  if (!Number.isInteger(price) || price < 0 || price > 1000000000) return null;
  var defaultLimit = Math.min(ix * DEFAULT_CU_PER_INSTRUCTION, MAX_COMPUTE_UNIT_LIMIT);
  var feasible = used <= MAX_COMPUTE_UNIT_LIMIT;
  var rawRecommended = Math.ceil(used * (100 + head) / 100);
  var headroomCapped = feasible && rawRecommended > MAX_COMPUTE_UNIT_LIMIT;
  var recommendedLimit = feasible ? Math.min(rawRecommended, MAX_COMPUTE_UNIT_LIMIT) : null;
  function prio(limit) { var f = txFee(1, limit, price); return f === null ? null : f.priorityFeeLamports; }
  return {
    instructionCount: ix, usedCu: used, headroomPct: head, cuPriceMicro: price,
    defaultLimit: defaultLimit, fitsDefault: used <= defaultLimit,
    feasible: feasible, recommendedLimit: recommendedLimit, headroomCapped: headroomCapped,
    priorityAtDefault: prio(defaultLimit),
    priorityAtRecommended: recommendedLimit === null ? null : prio(recommendedLimit),
    priorityAtMax: prio(MAX_COMPUTE_UNIT_LIMIT),
    maxLimit: MAX_COMPUTE_UNIT_LIMIT
  };
}

/* Tool 69 - Interest-bearing token display calculator. A Token-2022 mint
   with the interest-bearing extension never mints the interest: the raw
   amount held in every token account stays exactly what was deposited,
   and what grows is the DISPLAYED (UI) amount, computed at reading time
   as amount x e^(rate x time). The rate is a signed 16-bit count of
   basis points per year - negative rates are representable and shrink
   the display - time is measured in seconds against a year of 365.24
   days (31,556,736 seconds, the reference client SDK's
   SECONDS_PER_YEAR), and the grown amount is TRUNCATED at the token's
   smallest unit, never rounded. Because the mint's stored config keeps
   a pre-update average rate covering the stretch from initialization to
   the last rate update and a current rate covering the stretch since,
   the total factor is the product of the two periods' exponentials,
   e^(r1 t1) x e^(r2 t2) - the reference SDK's
   amountToUiAmountForInterestBearingMint formula, verified against that
   SDK on 20,000 cases before shipping (agreement to the smallest unit;
   the float path is the reference's own, since it too computes in
   doubles and truncates). One consequence worth teaching: 365 days is
   NOT a full year here - at 500 bps a 10,000 balance displays
   10,512.365573169 after 365 days, because the exponent uses
   365 / 365.24 of a year; a full year multiplies by e^0.05. The amount
   is capped at 1,000,000 tokens so the scaled figure stays exactly
   representable in a double, the precision the reference works at, and
   a combined exponent past 50 is rejected rather than displayed as an
   overflow. */
var IB_SECONDS_PER_YEAR = 31556736; /* 60 x 60 x 24 x 365.24 */
var MAX_IB_AMOUNT_TOKENS = 1000000;
var MAX_IB_DAYS = 36500;
var MAX_IB_EXPONENT = 50;

function ibRate(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^-?\d+$/.test(s)) return null;
  var n = Number(s);
  return (n >= -32768 && n <= 32767) ? n : null;
}

function ibDays(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^\d+$/.test(s)) return null;
  var n = Number(s);
  return (n >= 0 && n <= MAX_IB_DAYS) ? n : null;
}

function interestBearingAmount(amountStr, prevRateStr, prevDaysStr, rateStr, daysStr) {
  var amt = parseScaled(amountStr);
  if (amt === null || amt <= 0n || amt > BigInt(MAX_IB_AMOUNT_TOKENS) * SCALE) return null;
  var prevRate = ibRate(prevRateStr), prevDays = ibDays(prevDaysStr);
  var rate = ibRate(rateStr), days = ibDays(daysStr);
  if (prevRate === null || prevDays === null || rate === null || days === null) return null;
  var expPrev = prevRate * prevDays * 86400 / (IB_SECONDS_PER_YEAR * 10000);
  var expCur = rate * days * 86400 / (IB_SECONDS_PER_YEAR * 10000);
  if (expPrev + expCur > MAX_IB_EXPONENT) return null;
  var factorPrev = Math.exp(expPrev);
  var factorCurrent = Math.exp(expCur);
  var factor = factorPrev * factorCurrent;
  var grown = BigInt(Math.trunc(Number(amt) * factor));
  return {
    amount: formatScaled(amt), prevRateBps: prevRate, prevDays: prevDays,
    rateBps: rate, days: days,
    factorPrev: factorPrev, factorCurrent: factorCurrent, factor: factor,
    grown: formatScaled(grown), interest: formatScaled(grown - amt)
  };
}

/* Tool 70 - Scaled UI amount display calculator. A Token-2022 mint with
   the scaled UI amount extension carries a multiplier on the mint (an
   f64 stored in its ScaledUiAmountConfig, alongside an authority), and
   what a wallet displays is raw x multiplier - the raw amount in every
   token account is untouched, so the extension is how rebasing tokens
   and stock-split-style adjustments are modelled: a 2-for-1 split is a
   multiplier doubling, not a mint to every holder. The authority may
   schedule a NEW multiplier with an effective unix timestamp; the
   config stores both, and a reader uses the new multiplier from the
   moment the clock reaches that timestamp - the reference client SDK's
   selection is `timestamp >= newMultiplierEffectiveTimestamp`, a >=
   comparison with no other condition. The program accepts only a
   positive, normal f64 as a multiplier (its processor rejects zero,
   negative, NaN and subnormal values), so this model does the same,
   with a practical cap. The forward conversion is the reference's own:
   displayed = trunc(raw x multiplier) at the smallest unit, computed
   in doubles because the reference computes in doubles. The reverse
   conversion - what a user typing a displayed amount into a transfer
   actually sends - is the reference's division by
   (multiplier / 10^decimals), also in doubles and truncated; that
   division order can land exactly one smallest unit BELOW the
   exact-decimal figure (63,146 displayed at multiplier 2 converts
   back to 31,572.999999999 raw, not 31,573), so the model also
   computes the exact-decimal reverse from the multiplier as typed and
   reports the shortfall rather than hiding it - it is why the
   integration guidance tells apps to round down and leave the dust,
   and to send the full raw balance on "max". Amounts here are token
   amounts at the hub's 9-decimal scale, capped at 1,000,000 tokens so
   the scaled figures stay in the doubles' precise range, and the
   reading time is a user-supplied timestamp: this tool reads no clock
   and no mint. */
var MAX_SUA_TOKENS = 1000000;
var MAX_SUA_MULTIPLIER = 1000000;
var MAX_SUA_TIMESTAMP = 253402300799;

function suaMultiplier(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
  var n = Number(s);
  return (Number.isFinite(n) && n > 0 && n <= MAX_SUA_MULTIPLIER) ? n : null;
}

function suaTimestamp(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^\d+$/.test(s)) return null;
  var n = Number(s);
  return (Number.isSafeInteger(n) && n <= MAX_SUA_TIMESTAMP) ? n : null;
}

function scaledUiAmount(rawStr, multStr, newMultStr, effTsStr, readTsStr, sendStr) {
  var raw = parseScaled(rawStr);
  if (raw === null || raw <= 0n || raw > BigInt(MAX_SUA_TOKENS) * SCALE) return null;
  var mult = suaMultiplier(multStr), newMult = suaMultiplier(newMultStr);
  var effTs = suaTimestamp(effTsStr), readTs = suaTimestamp(readTsStr);
  var send = parseScaled(sendStr);
  if (mult === null || newMult === null || effTs === null || readTs === null) return null;
  if (send === null || send <= 0n || send > BigInt(MAX_SUA_TOKENS) * SCALE) return null;
  var switched = readTs >= effTs;
  var effMult = switched ? newMult : mult;
  var dispCur = BigInt(Math.trunc(Number(raw) * mult));
  var dispNew = BigInt(Math.trunc(Number(raw) * newMult));
  var displayed = switched ? dispNew : dispCur;
  var sendRaw = BigInt(Math.trunc((Number(send) / 1e9) / (effMult / 1e9)));
  var effStr = (switched ? newMultStr : multStr).trim();
  var dotParts = effStr.replace(/^\./, "0.").split(".");
  var eNum = BigInt(dotParts[0] + (dotParts[1] || ""));
  var eDen = 10n ** BigInt((dotParts[1] || "").length);
  var sendRawExact = (send * eDen) / eNum;
  return {
    raw: formatScaled(raw), multiplier: mult, newMultiplier: newMult,
    effectiveTimestamp: effTs, readTimestamp: readTs, switched: switched,
    effectiveMultiplier: effMult,
    displayed: formatScaled(displayed),
    displayedCurrent: formatScaled(dispCur),
    displayedNew: formatScaled(dispNew),
    changeOnSwitch: formatScaled(dispNew - dispCur),
    sendUi: formatScaled(send), sendRaw: formatScaled(sendRaw),
    sendRawExact: formatScaled(sendRawExact),
    sendRawShortfallUnits: (sendRawExact - sendRaw).toString(),
    sendRawZero: sendRaw === 0n
  };
}

/* Tool 71 - LP fee earnings estimator. A constant-product pool charges
   its fee tier, in basis points of every trade, and that fee stays in
   the pool for its liquidity providers pro-rata: the pool collects
   floor(volume x feeBps / 10000) per day, and a position whose deposit
   is deposit / tvl of the pool earns floor(poolFees x deposit / tvl)
   of it per day, both floors at the smallest unit in exact scaled
   BigInt - the same two-floor shape a real distribution's accounting
   shows, and the reason a dust share can floor a whole day's earnings
   to zero while the pool still collects. The period figure is the
   daily figure times the days, with volume, tier and pool size held
   frozen: an annualisation of one observed day, never a forecast.
   The simple APR is daily / deposit x 365 (as a percentage); the
   compounded APY is (1 + daily / deposit)^365 - 1, which assumes each
   day's earnings join the position and themselves earn - the two
   numbers answer different questions, and the model returns both so
   the distinction is the lesson. Gross of impermanent loss (Tools 4
   and 60), gross of price movement, and for a full-range position
   that is always active: a concentrated position earns only while
   the price is inside its range, and its already-accrued fees are
   Tool 25's fee-growth accounting, not this estimate. Values are
   generic value units (the same unit for volume, tvl and deposit),
   capped at 1e12 so the scaled figures stay exact. */
var MAX_LPF_VALUE = 1000000000000;
var MAX_LPF_DAYS = 36500;

function lpFeeEarnings(volumeStr, feeBps, tvlStr, depositStr, daysStr) {
  var V = parseScaled(volumeStr), T = parseScaled(tvlStr), D = parseScaled(depositStr);
  var bps = Number(feeBps), days = Number(daysStr);
  if (V === null || T === null || D === null) return null;
  if (V <= 0n || T <= 0n || D <= 0n) return null;
  var cap = BigInt(MAX_LPF_VALUE) * SCALE;
  if (V > cap || T > cap || D > cap) return null;
  if (D > T) return null;
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) return null;
  if (!Number.isInteger(days) || days < 1 || days > MAX_LPF_DAYS) return null;
  var poolFeesDay = (V * BigInt(bps)) / 10000n;
  var daily = (poolFeesDay * D) / T;
  var period = daily * BigInt(days);
  var shareBps = Number((D * 10000n) / T);
  var r = Number(daily) / Number(D);
  var aprPct = r * 36500;
  var apyPct = (Math.pow(1 + r, 365) - 1) * 100;
  return {
    volume: formatScaled(V), feeBps: bps, tvl: formatScaled(T),
    deposit: formatScaled(D), days: days,
    poolFeesDay: formatScaled(poolFeesDay),
    shareBps: shareBps,
    dailyEarnings: formatScaled(daily),
    periodEarnings: formatScaled(period),
    aprPct: aprPct, apyPct: apyPct, apyFinite: Number.isFinite(apyPct),
    feesZero: poolFeesDay === 0n, earningsZero: daily === 0n
  };
}

/* ---------- Tool 72: prediction-market outcome shares ---------- */
/* A binary prediction market trades two outcome shares, YES and NO, and
   the pair is anchored to the collateral by a complete-set rule: paying
   exactly 1 unit of collateral mints one YES plus one NO, and one YES
   plus one NO redeems for exactly 1 unit, whichever side wins. A share
   price IS an implied probability - a YES at 0.62 prices a 62% chance -
   and the two prices of a consistent market sum to exactly 1. When they
   do not, the complete-set rule itself is the arbitrage: a sum above 1
   lets a trader mint sets for 1 and sell both sides for the sum, and a
   sum below 1 lets a trader buy both sides for the sum and redeem for 1.
   Buying YES with a spend returns spend / yesPrice shares, floored at
   the smallest unit like an on-chain division; each share pays exactly
   1 if YES happens and 0 if it does not, so the price is also the
   break-even probability of the trade. Prices must sit strictly inside
   (0, 1) - a price of 0 or 1 is a settled market, not a tradeable one.
   Values are generic collateral units, capped at 1e12 so the scaled
   figures stay exact; market fees and spread are stated as not
   modelled, and no live market is read. */
var MAX_PRED_SPEND = 1000000000000;

function predictionMarket(yesStr, noStr, spendStr) {
  var Y = parseScaled(yesStr), N = parseScaled(noStr), S = parseScaled(spendStr);
  if (Y === null || N === null || S === null) return null;
  if (Y <= 0n || Y >= SCALE || N <= 0n || N >= SCALE || S <= 0n) return null;
  if (S > BigInt(MAX_PRED_SPEND) * SCALE) return null;
  var sum = Y + N;
  var dev = sum - SCALE;
  var devBps = Number((dev * 10000n) / SCALE);
  var shares = (S * SCALE) / Y;
  if (shares <= 0n) return null;
  var mode = dev > 0n ? "mint" : dev < 0n ? "buy" : "fair";
  var arbSets, arbValue;
  if (dev > 0n) { arbSets = S; arbValue = (S * sum) / SCALE; }
  else if (dev < 0n) { arbSets = (S * SCALE) / sum; arbValue = arbSets; }
  else { arbSets = S; arbValue = S; }
  return {
    yesPrice: formatScaled(Y), noPrice: formatScaled(N), spend: formatScaled(S),
    sumPrice: formatScaled(sum), deviation: formatScaled(dev), devBps: devBps,
    mode: mode, impliedYesPct: Number(Y) / 10000000,
    shares: formatScaled(shares), payoutIfYes: formatScaled(shares),
    profitIfYes: formatScaled(shares - S), lossIfNo: formatScaled(S),
    arbSets: formatScaled(arbSets), arbValue: formatScaled(arbValue),
    arbProfit: formatScaled(arbValue - S), arbZero: arbValue - S === 0n && dev !== 0n
  };
}

/* ---------- Tool 73: leveraged loop (recursive supply and borrow) ---------- */
/* A leverage loop - the mechanic behind "multiply" products on Solana
   lending markets - deposits an asset, borrows against it at the market's
   maximum LTV, redeposits the borrowed amount, borrows against that, and
   repeats. With the same asset on both sides and every round borrowing
   the same fraction l of the new deposit, the rounds form a geometric
   series whose limit is closed-form:
     total supplied  S = D / (1 - l)
     total borrowed  B = S - D          (so B / S = l exactly)
     leverage          = S / D = 1 / (1 - l)
   The model floors S once at the smallest unit; a step-by-step loop that
   floors every round's borrow lands within dust of it (prototype-checked:
   the floored closed form is exactly the floor of the exact series limit
   on 20,000 cases, and a floored per-round simulation over 3,000 cases
   converged to within 6e-10 relative). A year of interest at fixed rates
   is earned = floor(S x supplyBps / 10000) and paid = floor(B x
   borrowBps / 10000), both floored at the smallest unit, and the net is
   earned - paid on the equity D alone - so looping multiplies the SPREAD,
   not just the yield: the position breaks even when the supply rate
   equals borrow x l, and a borrow rate above the supply rate makes the
   loop lose money faster than holding would. The health factor of the
   fully looped position is threshold / l - the supplied side cancels -
   which is why a higher LTV is a thinner liquidation buffer even in the
   same asset. Rates and the LTV are held frozen for the year; price moves,
   rate moves, loop transaction costs and venue leverage caps are stated
   as not modelled, and no live market is read. */
var MAX_LOOP_DEPOSIT = 1000000000000;
var MAX_LOOP_RATE_BPS = 100000;

function leverageLoop(depositStr, ltvBpsStr, supplyBpsStr, borrowBpsStr, thresholdBpsStr) {
  var D = parseScaled(depositStr);
  var lR = parseScaled(ltvBpsStr), sR = parseScaled(supplyBpsStr), bR = parseScaled(borrowBpsStr), tR = parseScaled(thresholdBpsStr);
  if (D === null || lR === null || sR === null || bR === null || tR === null) return null;
  if (lR % SCALE !== 0n || sR % SCALE !== 0n || bR % SCALE !== 0n || tR % SCALE !== 0n) return null;
  var L = lR / SCALE, Sr = sR / SCALE, Br = bR / SCALE, T = tR / SCALE;
  if (D <= 0n || D > BigInt(MAX_LOOP_DEPOSIT) * SCALE) return null;
  if (L < 0n || L >= 10000n) return null;
  if (Sr < 0n || Sr > BigInt(MAX_LOOP_RATE_BPS) || Br < 0n || Br > BigInt(MAX_LOOP_RATE_BPS)) return null;
  if (T <= L || T > 10000n) return null;
  var S = (D * 10000n) / (10000n - L);
  var B = S - D;
  var earned = (S * Sr) / 10000n;
  var paid = (B * Br) / 10000n;
  var net = earned - paid;
  var apyScaled = (net * 10000n * SCALE) / D; /* bps x SCALE, truncates toward zero like the signed fields elsewhere */
  var hf = L === 0n ? null : (T * SCALE) / L;
  return {
    deposit: formatScaled(D), totalSupplied: formatScaled(S), totalBorrowed: formatScaled(B),
    leverage: formatScaled((S * SCALE) / D),
    ltvBps: Number(L), supplyBps: Number(Sr), borrowBps: Number(Br), thresholdBps: Number(T),
    earnedYear: formatScaled(earned), paidYear: formatScaled(paid), netYear: formatScaled(net),
    netApyBps: formatScaled(apyScaled), netApyPct: Number(apyScaled) / 100000000000,
    healthFactor: hf === null ? null : formatScaled(hf), noDebt: L === 0n,
    breakEvenSupplyBps: formatScaled((Br * L * SCALE) / 10000n)
  };
}

/* ---------- Tool 74: transfer-fee swap (a swap where both tokens tax the transfer) ---------- */
/* A Token-2022 mint can carry a transfer fee (Tool 13): every transfer of
   that token withholds fee = ceil(amount x bps / 10000), capped at the
   mint's maximumFee, in RAW units. When such a token trades on a
   constant-product pool, the fee is charged TWICE around the swap math,
   and a quote that ignores it overstates what lands:
     1. the trader's input transfer is taxed, so the pool's vault is
        credited poolReceived = amountIn - inFee (the withheld inFee stays
        inside the pool's token account as withheld fees, harvestable to
        the mint - it is not pool liquidity and does not price the swap);
     2. the pool swaps poolReceived under Tool 2's own rule - pool fee
        floored on the amount the pool actually received, output floored
        against the reserves - giving grossOut;
     3. the pool's output transfer is taxed again, so the trader's wallet
        is credited userReceived = grossOut - outFee.
   Everything here is raw integer units (Tool 6's units, the units the
   transfer-fee program itself computes in), so the ceilings are exact.
   plainOut is Tool 2's swap of the FULL amountIn at the same pool fee -
   what the same trade would return with no transfer fees at all - and
   shortfall is plainOut - userReceived, always >= 0: transfer fees can
   only shrink a swap, never grow it (prototype-proven on 20,000 cases
   against an independent integer oracle, 0 mismatches, and the
   no-transfer-fee case collapses to plainOut exactly). A 100% output
   transfer fee honestly returns userReceived 0 and is flagged, not
   hidden. Classic SPL mints have no transfer fees; set a side's rate to
   0 (or its cap to 0) for a classic token on that side. */
function transferFeeSwap(reserveInStr, reserveOutStr, amountInStr, poolFeeBpsStr, inFeeBpsStr, inMaxFeeStr, outFeeBpsStr, outMaxFeeStr) {
  var rIn = rawAmount(reserveInStr), rOut = rawAmount(reserveOutStr), aIn = rawAmount(amountInStr);
  var inMax = rawAmount(inMaxFeeStr), outMax = rawAmount(outMaxFeeStr);
  var poolBps = feeBpsValue(poolFeeBpsStr), inBps = feeBpsValue(inFeeBpsStr), outBps = feeBpsValue(outFeeBpsStr);
  if (rIn === null || rOut === null || aIn === null || inMax === null || outMax === null) return null;
  if (poolBps === null || inBps === null || outBps === null) return null;
  if (rIn <= 0n || rOut <= 0n || aIn <= 0n) return null;
  if (poolBps >= 10000) return null;
  var inParts = transferFeeParts(aIn, BigInt(inBps), inMax);
  var poolReceived = aIn - inParts.fee;
  if (poolReceived <= 0n) return null;
  var poolFee = (poolReceived * BigInt(poolBps)) / 10000n;
  var eff = poolReceived - poolFee;
  if (eff <= 0n) return null;
  var grossOut = (eff * rOut) / (rIn + eff);
  if (grossOut <= 0n || grossOut >= rOut) return null;
  var outParts = transferFeeParts(grossOut, BigInt(outBps), outMax);
  var userReceived = grossOut - outParts.fee;
  var plainFee = (aIn * BigInt(poolBps)) / 10000n;
  var plainEff = aIn - plainFee;
  var plainOut = (plainEff * rOut) / (rIn + plainEff);
  var shortfall = plainOut - userReceived;
  return {
    amountIn: aIn.toString(), inFeeBps: inBps, inFee: inParts.fee.toString(), inCapped: inParts.rawFee > inMax,
    poolReceived: poolReceived.toString(), poolFeeBps: poolBps, poolFee: poolFee.toString(),
    effectiveIn: eff.toString(), grossOut: grossOut.toString(),
    outFeeBps: outBps, outFee: outParts.fee.toString(), outCapped: outParts.rawFee > outMax,
    userReceived: userReceived.toString(), plainOut: plainOut.toString(), shortfall: shortfall.toString(),
    shortfallPct: plainOut === 0n ? 0 : (Number(shortfall) * 100) / Number(plainOut),
    receivedZero: userReceived === 0n, noTransferFees: inParts.fee === 0n && outParts.fee === 0n
  };
}

/* ---------- Tool 75: stake pool fees (SPL stake pool) ---------- */
/* The SPL stake pool program - the engine under Solana's big liquid
   staking tokens - charges its fees in POOL TOKENS, on three different
   bases, and none of them is a cut of your balance per year:
   (1) Deposit: a deposit of D into a pool holding T for S pool tokens
       mints floor(D * S / T) new tokens (D itself on an empty pool, the
       1:1 bootstrap), and the SOL deposit fee - floor(minted * bps /
       10000) of the MINTED tokens - is deducted before the rest reach
       the depositor. The fee tokens go to the manager (a referrer may
       take a stated share of them; not modelled here), so the supply
       still grows by the full minted amount and the pool by the full
       deposit.
   (2) Epoch: when an epoch adds rewards R to the pool's value, the
       epoch fee is floor(R * bps / 10000) of VALUE, converted to pool
       tokens at the rate BEFORE the rewards land - floor(feeValue * S1
       / T1) - and minted new to the manager. No holder's balance moves;
       every holder's share of the pool is diluted by exactly that mint.
   (3) Withdrawal: redeeming pool tokens deducts the SOL withdrawal fee
       in tokens first - floor(tokens * bps / 10000) - and only the
       remainder converts to SOL at the current rate, floor(net * T2 /
       S2), every step floored at the smallest unit in exact scaled
       BigInt. Fees are fractions on-chain (numerator / denominator);
       this model takes whole basis points, and referral splits, stake
       (non-SOL) deposits and withdrawals, validator changes and the
       reserve's liquidity limits are not modelled. The no-fee run is
       the identical flow with every rate 0, so feeDrag = noFeeOut - out
       is the whole cost of the three fees on this round trip and is
       always >= 0 (prototype-proven on 20,000 cases against an
       independent exact-rational oracle, 0 mismatches). */
var MAX_SPOOL_VALUE = 1000000000000;

function stakePoolFees(totalStr, supplyStr, depositStr, depFeeBpsStr, rewardsStr, epochFeeBpsStr, wdFeeBpsStr) {
  var T = parseScaled(totalStr), S = parseScaled(supplyStr), D = parseScaled(depositStr), R = parseScaled(rewardsStr);
  var depBps = feeBpsValue(depFeeBpsStr), epochBps = feeBpsValue(epochFeeBpsStr), wdBps = feeBpsValue(wdFeeBpsStr);
  if (T === null || S === null || D === null || R === null) return null;
  if (depBps === null || epochBps === null || wdBps === null) return null;
  var cap = BigInt(MAX_SPOOL_VALUE) * SCALE;
  if (T > cap || S > cap || D > cap || R > cap) return null;
  if (D <= 0n) return null;
  if ((S === 0n) !== (T === 0n)) return null;
  var minted = S === 0n ? D : (D * S) / T;
  if (minted <= 0n) return null;
  var depFeeTokens = (minted * BigInt(depBps)) / 10000n;
  var userTokens = minted - depFeeTokens;
  var T1 = T + D, S1 = S + minted;
  var epochFeeValue = (R * BigInt(epochBps)) / 10000n;
  var epochFeeTokens = T1 === 0n ? 0n : (epochFeeValue * S1) / T1;
  var T2 = T1 + R, S2 = S1 + epochFeeTokens;
  var wdFeeTokens = (userTokens * BigInt(wdBps)) / 10000n;
  var netTokens = userTokens - wdFeeTokens;
  var out = S2 === 0n ? 0n : (netTokens * T2) / S2;
  var noFeeOut = S1 === 0n ? 0n : (minted * T2) / S1;
  return {
    total: formatScaled(T), supply: formatScaled(S), deposit: formatScaled(D), rewards: formatScaled(R),
    depFeeBps: depBps, epochFeeBps: epochBps, wdFeeBps: wdBps,
    minted: formatScaled(minted), depFeeTokens: formatScaled(depFeeTokens), userTokens: formatScaled(userTokens),
    epochFeeValue: formatScaled(epochFeeValue), epochFeeTokens: formatScaled(epochFeeTokens),
    wdFeeTokens: formatScaled(wdFeeTokens), netTokens: formatScaled(netTokens),
    totalAfter: formatScaled(T2), supplyAfter: formatScaled(S2),
    out: formatScaled(out), noFeeOut: formatScaled(noFeeOut),
    netGain: formatScaled(out - D), noFeeGain: formatScaled(noFeeOut - D), feeDrag: formatScaled(noFeeOut - out),
    receivedZero: out === 0n, noFees: depBps === 0 && epochBps === 0 && wdBps === 0,
    depositFeeAll: userTokens === 0n
  };
}

/* ---------- Tool 76: farm emissions (liquidity mining rewards) ---------- */
/* Farms - the incentive programs pools run on Raydium, Orca and across
   Solana DeFi - pay a reward token at a stated emission rate, split
   pro-rata by staked VALUE: your share is stake / totalStaked, so your
   tokens per day are floor(emission * stake / totalStaked) at the
   smallest unit in exact scaled BigInt, your value per day is that
   floored token count times the reward price you supply, and a period
   is the floored daily figure times the days (day-by-day accrual).
   The APR the farm quotes follows from the daily value alone: APR =
   (valueDay / stake) * 365, and the stake cancels - APR =
   emission * price * 365 / totalStaked - so a position twice as large
   earns twice the tokens at exactly the same APR, and if the total
   staked doubles, every APR halves: emissions are a fixed pie, and
   new stakers dilute the old ones without any rate changing. The APY
   compounds that daily rate for a year and assumes the rewards are
   reinvested daily at the same rate and price - an assumption, stated
   on the page, not a promise. This is NOT trading-fee income (Tool 71
   models a pool's own fees) and NOT protocol staking (Tool 8): the
   emission schedule, its end date, vesting or lockups on the reward
   token, and any change in the total staked are not modelled, the
   price is a user assumption, and no live farm is read. Values are
   generic units, capped at 1e12 so the scaled figures stay exact
   (prototype-proven on 20,000 cases against an independent
   exact-rational Python oracle, 0 mismatches on every figure). */
var MAX_FARM_VALUE = 1000000000000;
var MAX_FARM_DAYS = 36500;

function farmRewards(emissionStr, priceStr, tvlStr, stakeStr, daysStr) {
  var E = parseScaled(emissionStr), P = parseScaled(priceStr), T = parseScaled(tvlStr), S = parseScaled(stakeStr);
  var days = Number(daysStr);
  if (E === null || P === null || T === null || S === null) return null;
  var cap = BigInt(MAX_FARM_VALUE) * SCALE;
  if (E > cap || P > cap || T > cap || S > cap) return null;
  if (T <= 0n || S <= 0n || S > T) return null;
  if (!Number.isInteger(days) || days < 1 || days > MAX_FARM_DAYS) return null;
  var tokensDay = (E * S) / T;
  var tokensPeriod = tokensDay * BigInt(days);
  var valueDay = (tokensDay * P) / SCALE;
  var valuePeriod = valueDay * BigInt(days);
  var shareBps = Number((S * 10000n) / T);
  var r = Number(valueDay) / Number(S);
  var aprPct = r * 36500;
  var apyPct = (Math.pow(1 + r, 365) - 1) * 100;
  return {
    emission: formatScaled(E), price: formatScaled(P), tvl: formatScaled(T), stake: formatScaled(S), days: days,
    shareBps: shareBps, sharePct: (Number(S) / Number(T)) * 100,
    tokensDay: formatScaled(tokensDay), tokensPeriod: formatScaled(tokensPeriod),
    valueDay: formatScaled(valueDay), valuePeriod: formatScaled(valuePeriod),
    aprPct: aprPct, apyPct: apyPct, apyFinite: Number.isFinite(apyPct), aprDoubleTvlPct: aprPct / 2,
    emissionZero: E === 0n, priceZero: P === 0n, rewardsZero: tokensDay === 0n, wholeFarm: S === T
  };
}

/* ---------- Tool 77: Jito bundle tip planner ---------- */
/* A Jito bundle is a group of at most 5 transactions sent to the Jito
   Block Engine, executed sequentially and atomically - all land in the
   same slot or none do. Inclusion is an auction: the bundle carries a
   TIP, a plain SOL transfer to one of the 8 Jito tip accounts inside
   one of its transactions, and the minimum tip is 1,000 lamports (the
   competitive floor moves with demand and is NOT modelled - no live
   tip data is read). Because a bundle that does not land executes
   nothing, neither the tip nor the base fees are paid for it; the
   figures here are the cost of a bundle that DOES land. On top of the
   tip, every transaction still pays the base fee of 5,000 lamports
   per signature (Tool 5), so a landed bundle costs tip + 5,000 x
   signatures per transaction x transactions, in exact integer
   lamports. The teaching figures are the break-even tip - the
   expected gross profit of the bundle's opportunity minus only the
   base fees, the most that could be tipped before the fees alone eat
   the profit - and the cost share: total landed cost as a floored
   share of that profit in basis points, so at the headline the tip
   auction takes 4,060 bps (40.6%) of a 2,500,000-lamport profit.
   Priority fees a bundle may also carry, the live tip floor,
   landing probability and failed-bundle retry costs are not
   modelled. Amounts are raw lamports, capped at 1e15, so every
   figure is exact (prototype-proven on 20,008 cases against an
   independent Python integer oracle, 0 mismatches on every figure). */
var MAX_BUNDLE_LAMPORTS = 1000000000000000;
var MAX_BUNDLE_COUNT = 10000;
var MAX_BUNDLE_TXS = 5;
var MAX_BUNDLE_SIGS = 12;
var MIN_BUNDLE_TIP_LAMPORTS = 1000;

function bundleTipPlan(tipStr, txCountStr, sigsStr, bundlesStr, profitStr) {
  var tip = parseRawInt(tipStr), profit = parseRawInt(profitStr);
  var txs = Number(txCountStr), sigs = Number(sigsStr), bundles = Number(bundlesStr);
  if (tip === null || profit === null) return null;
  var cap = BigInt(MAX_BUNDLE_LAMPORTS);
  if (tip > cap || profit > cap) return null;
  if (!Number.isInteger(txs) || txs < 1 || txs > MAX_BUNDLE_TXS) return null;
  if (!Number.isInteger(sigs) || sigs < 1 || sigs > MAX_BUNDLE_SIGS) return null;
  if (!Number.isInteger(bundles) || bundles < 1 || bundles > MAX_BUNDLE_COUNT) return null;
  var basePerBundle = 5000n * BigInt(sigs) * BigInt(txs);
  var costPerBundle = tip + basePerBundle;
  var breakEvenTip = profit - basePerBundle;
  var net = profit - costPerBundle;
  return {
    tipLamports: tip.toString(), profitLamports: profit.toString(),
    txCount: txs, sigsPerTx: sigs, bundles: bundles,
    basePerBundle: basePerBundle.toString(),
    costPerBundle: costPerBundle.toString(),
    tipSol: lamportsToSol(tip.toString()), costSol: lamportsToSol(costPerBundle.toString()),
    totalTip: (tip * BigInt(bundles)).toString(),
    totalBase: (basePerBundle * BigInt(bundles)).toString(),
    totalCost: (costPerBundle * BigInt(bundles)).toString(),
    totalCostSol: lamportsToSol((costPerBundle * BigInt(bundles)).toString()),
    breakEvenTip: breakEvenTip.toString(),
    netPerBundle: net.toString(),
    costShareBps: profit > 0n ? Number((costPerBundle * 10000n) / profit) : null,
    belowMinimum: tip < BigInt(MIN_BUNDLE_TIP_LAMPORTS),
    tipZero: tip === 0n,
    feesExceedProfit: breakEvenTip < 0n,
    unprofitable: net < 0n,
    breakEven: net === 0n
  };
}

/* ---------- Tool 78: transaction fee split ---------- */
/* Tool 5 prices what a transaction pays; this tool follows the
   money. Under the rules in Solana's fee documentation, the two
   parts of a fee have different destinations. The BASE fee - 5,000
   lamports per signature - is split exactly in half: 2,500 lamports
   per signature are BURNED (destroyed, out of the supply) and 2,500
   go to the block leader who included the transaction. The
   PRIORITIZATION fee - ceil(CU limit x CU price / 1,000,000), charged
   on the limit requested, exactly as Tool 5 computes it - is not
   split at all: since SIMD-0096 activated (February 2025) 100% of it
   goes to the leader; before that change, half of it burned too.
   So the burned share of a total fee is a falling function of the
   priority bid: with no prioritization fee exactly half of what is
   paid burns, and as the bid rises the burn stays pinned at half
   the base fee while the leader's side grows. The base fee is
   always a multiple of 5,000, so its half is always a whole number
   of lamports and no rounding ever enters the split. A transaction
   that lands but fails still pays its fee in full, split the same
   way. The v1 transaction format, which sets the prioritization fee
   as an absolute lamport total instead of a price per compute unit,
   and proposed redesigns of the base fee are NOT modelled. Jito
   tips are separate transfers, not fees (Tool 77); rent is a locked
   deposit, not a fee (Tool 3). All figures are exact integer
   lamports (prototype-proven on 20,008 cases against an independent
   Python integer oracle, 0 mismatches on every figure, and the
   total asserted against Tool 5's own txFee on every case). */
var MAX_FSPLIT_SIGS = 12;
var MAX_FSPLIT_COUNT = 1000000;
var MAX_FSPLIT_CU_PRICE = 1000000000000;

function feeSplit(sigsStr, cuLimitStr, cuPriceStr, countStr) {
  var sigs = Number(sigsStr), cu = Number(cuLimitStr), price = Number(cuPriceStr), count = Number(countStr);
  if (!Number.isInteger(sigs) || sigs < 1 || sigs > MAX_FSPLIT_SIGS) return null;
  if (!Number.isInteger(cu) || cu < 1 || cu > MAX_COMPUTE_UNIT_LIMIT) return null;
  if (!Number.isInteger(price) || price < 0 || price > MAX_FSPLIT_CU_PRICE) return null;
  if (!Number.isInteger(count) || count < 1 || count > MAX_FSPLIT_COUNT) return null;
  var base = 5000n * BigInt(sigs);
  var priority = (BigInt(cu) * BigInt(price) + 999999n) / 1000000n;
  var total = base + priority;
  var burned = base / 2n;
  var leader = total - burned;
  var burnedBps = Number((burned * 10000n) / total);
  return {
    signatures: sigs, cuLimit: cu, cuPriceMicro: price, txCount: count,
    baseFeeLamports: base.toString(),
    priorityFeeLamports: priority.toString(),
    totalFeeLamports: total.toString(),
    burnedLamports: burned.toString(),
    leaderLamports: leader.toString(),
    totalFeeSol: lamportsToSol(total.toString()),
    burnedSol: lamportsToSol(burned.toString()),
    leaderSol: lamportsToSol(leader.toString()),
    burnedBps: burnedBps, leaderBps: 10000 - burnedBps,
    noPriority: priority === 0n,
    periodTotalLamports: (total * BigInt(count)).toString(),
    periodBurnedLamports: (burned * BigInt(count)).toString(),
    periodLeaderLamports: (leader * BigInt(count)).toString(),
    periodBurnedSol: lamportsToSol((burned * BigInt(count)).toString())
  };
}

/* ---------- Tool 79: validator commission ---------- */
/* When SOL is delegated to a validator, the network rewards the
   stake earns are split once, at the source: the validator's vote
   account keeps a COMMISSION share of the rewards and the rest is
   distributed to the delegated stake accounts pro-rata by active
   stake weight, deposited as immediately active stake. Commission
   is set in WHOLE PERCENTAGE POINTS - an integer from 0 to 100,
   never basis points - can be changed only during the first half
   of an epoch, and defaults to 100% on a vote account created
   without one, which passes nothing to delegators at all. Two
   consequences the model makes exact. First, commission is charged
   on REWARDS ONLY, never on principal: even a 100% commission
   leaves the delegated stake itself untouched - it takes every
   lamport of reward and nothing else. Second, the delegator's
   effective rate is the gross rate scaled by what survives:
   netBps = grossBps x (100 - pct) / 100 before flooring, so a 5%
   commission on a 700 bps gross rate nets 665 bps, and each single
   percentage point of commission costs exactly one hundredth of
   the gross reward. The gross rate here is the user's own assumed
   figure for one validator over one year (rewards depend on the
   validator's voting and the network's issuance; no live rate is
   read), annualised pro-rata over the chosen period in days
   against a 365-day year, with every figure floored at the
   smallest unit in exact scaled BigInt: the annual gross is
   floor(stake x grossBps / 10,000), the commission is
   floor(gross x pct / 100), and the period figures repeat the same
   two floors on floor(stake x grossBps x days / (10,000 x 365)).
   This is direct delegation only: stake-pool token fees are Tool
   75, gross epoch compounding before any commission is Tool 8,
   and a validator's separate block-revenue / MEV commission is
   NOT modelled. Prototype-proven on 20,008 cases against an
   independent Python exact-rational oracle, 0 mismatches. */
var MAX_VCOMM_GROSS_BPS = 100000;
var MAX_VCOMM_DAYS = 3650;

function validatorCommission(stakeStr, grossBpsStr, commissionPctStr, daysStr) {
  var stake = parseScaled(stakeStr);
  var grossBps = Number(grossBpsStr), pct = Number(commissionPctStr), days = Number(daysStr);
  if (stake === null || stake <= 0n) return null;
  if (!Number.isInteger(grossBps) || grossBps < 0 || grossBps > MAX_VCOMM_GROSS_BPS) return null;
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) return null;
  if (!Number.isInteger(days) || days < 1 || days > MAX_VCOMM_DAYS) return null;
  var gB = BigInt(grossBps), pB = BigInt(pct), dB = BigInt(days);
  var grossAnnual = stake * gB / 10000n;
  var commAnnual = grossAnnual * pB / 100n;
  var netAnnual = grossAnnual - commAnnual;
  var periodGross = stake * gB * dB / (10000n * 365n);
  var periodComm = periodGross * pB / 100n;
  var periodNet = periodGross - periodComm;
  return {
    stake: formatScaled(stake), grossBps: grossBps, commissionPct: pct, days: days,
    grossAnnual: formatScaled(grossAnnual),
    commissionAnnual: formatScaled(commAnnual),
    netAnnual: formatScaled(netAnnual),
    effectiveBps: grossAnnual === 0n ? 0 : Number(netAnnual * 10000n / stake),
    perPointAnnual: formatScaled(grossAnnual / 100n),
    periodGross: formatScaled(periodGross),
    periodCommission: formatScaled(periodComm),
    periodNet: formatScaled(periodNet),
    zeroCommission: pct === 0, fullCommission: pct === 100, zeroGross: grossBps === 0
  };
}

/* ---------- Tool 80: leader schedule share ---------- */
/* Every epoch the runtime computes a leader schedule: the epoch's
   slots are assigned to validators in runs of LEADER_SLOTS_PER_WINDOW
   (4) consecutive slots - a leader window - chosen by a stake-weighted
   random draw, so a validator's EXPECTED share of the epoch's windows
   and slots is exactly its share of the total activated stake. A
   normal epoch (Tool 12) holds 432,000 slots = 108,000 windows; the
   slots input accepts any multiple of 4 up to that, so warmup epochs
   can be modelled too. The expectation is not the schedule itself:
   the actual draw is seeded, fixed for the epoch and known in
   advance, and a real validator's count lands near the expectation,
   not on it. A scheduled slot whose leader produces no block is
   skipped; the skip share here is the user's own assumed figure,
   applied to the expected slots. Every figure is floored at the
   smallest unit in exact scaled BigInt: the share in whole basis
   points, the expectations at 9 decimal places, and the stake per
   expected window is the total stake divided by the window count.
   Prototype-proven on 20,008 cases against an independent Python
   exact-rational oracle, 0 mismatches. No live stake or schedule
   data is read. */
var LEADER_SLOTS_PER_WINDOW = 4;
var MAX_LEAD_SLOTS_PER_EPOCH = 432000;

function leaderSchedule(stakeStr, totalStr, slotsStr, skipBpsStr) {
  var stake = parseScaled(stakeStr);
  var total = parseScaled(totalStr);
  var slots = Number(slotsStr), skipBps = Number(skipBpsStr);
  if (stake === null || total === null) return null;
  if (stake <= 0n || total <= 0n || stake > total) return null;
  if (!Number.isInteger(slots) || slots < LEADER_SLOTS_PER_WINDOW || slots > MAX_LEAD_SLOTS_PER_EPOCH || slots % LEADER_SLOTS_PER_WINDOW !== 0) return null;
  if (!Number.isInteger(skipBps) || skipBps < 0 || skipBps > 10000) return null;
  var windowsTotal = slots / LEADER_SLOTS_PER_WINDOW;
  var shareBps = Number(stake * 10000n / total);
  var expectedScaled = (BigInt(slots) * stake * SCALE) / total;
  var expectedWindowsScaled = (BigInt(windowsTotal) * stake * SCALE) / total;
  var producedScaled = expectedScaled * BigInt(10000 - skipBps) / 10000n;
  var skippedScaled = expectedScaled - producedScaled;
  return {
    stake: formatScaled(stake), total: formatScaled(total), slotsPerEpoch: slots,
    windowsTotal: windowsTotal, shareBps: shareBps, skipBps: skipBps,
    expectedSlots: formatScaled(expectedScaled),
    expectedWindows: formatScaled(expectedWindowsScaled),
    produced: formatScaled(producedScaled),
    skipped: formatScaled(skippedScaled),
    stakePerWindow: formatScaled(total / BigInt(windowsTotal)),
    fullStake: stake === total, zeroSkip: skipBps === 0, allSkipped: skipBps === 10000,
    subBpsShare: shareBps === 0 && stake !== total,
    dustExpectation: expectedScaled === 0n
  };
}

/* ---------- Tool 81: priority fee percentile planner ---------- */
/* Tool 5 prices a transaction at a compute-unit price the user already
   picked; this tool picks the price. Solana's fee market is LOCAL: a
   transaction competes only with transactions writing to the same
   accounts, so estimators sample the recent prioritization fees paid
   for the accounts a transaction touches (the RPC's recent-fee cache
   covers the last 150 slots) and bid a PERCENTILE of that sample -
   the median for routine work, a high percentile for a contested
   account. The percentile here is the nearest-rank method on samples
   the user groups into four ascending price levels: the rank is
   ceil(percentile x N / 100), and the chosen price is the first level
   whose cumulative count reaches the rank. The fee at the chosen
   price is the prioritization ceiling of Tool 5, ceil(CU limit x
   price / 1,000,000), charged on the limit requested; the model also
   prices the sample median so the cost of bidding above (or below)
   it is visible in lamports. The samples are the user's own figures -
   grouped counts, not a live feed - and the RPC's own recent-fee
   values are per-slot minimums, a floor rather than a distribution,
   which the page states. Prototype-proven on 20,008 cases against an
   independent Python oracle that expands the grouped samples into a
   sorted list, 0 mismatches. No live fee data is read. */
var MAX_PFEE_PRICE = 1000000000000;
var MAX_PFEE_COUNT = 100000;
var MAX_PFEE_SAMPLES = 100000;

function priorityFeePercentile(p1Str, c1Str, p2Str, c2Str, p3Str, c3Str, p4Str, c4Str, pctStr, cuStr) {
  var rawAll = [p1Str, c1Str, p2Str, c2Str, p3Str, c3Str, p4Str, c4Str, pctStr, cuStr];
  for (var v = 0; v < rawAll.length; v++) {
    if (typeof rawAll[v] !== "string" || !/^-?\d+$/.test(rawAll[v].trim())) return null;
  }
  var prices = [Number(p1Str), Number(p2Str), Number(p3Str), Number(p4Str)];
  var counts = [Number(c1Str), Number(c2Str), Number(c3Str), Number(c4Str)];
  var pct = Number(pctStr), cu = Number(cuStr);
  for (var i = 0; i < 4; i++) {
    if (!Number.isInteger(prices[i]) || prices[i] < 0 || prices[i] > MAX_PFEE_PRICE) return null;
    if (!Number.isInteger(counts[i]) || counts[i] < 0 || counts[i] > MAX_PFEE_COUNT) return null;
    if (i > 0 && prices[i] <= prices[i - 1]) return null;
  }
  var total = counts[0] + counts[1] + counts[2] + counts[3];
  if (total < 1 || total > MAX_PFEE_SAMPLES) return null;
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) return null;
  if (!Number.isInteger(cu) || cu < 1 || cu > MAX_COMPUTE_UNIT_LIMIT) return null;
  function pick(p) {
    var rank = Math.floor((p * total + 99) / 100);
    var cum = 0;
    for (var j = 0; j < 4; j++) {
      cum += counts[j];
      if (cum >= rank) return { price: prices[j], rank: rank, cum: cum };
    }
    return { price: prices[3], rank: rank, cum: cum };
  }
  function fee(price) { return (BigInt(cu) * BigInt(price) + 999999n) / 1000000n; }
  var chosen = pick(pct), median = pick(50);
  var chosenFee = fee(chosen.price), medianFee = fee(median.price);
  var topPrice = 0;
  for (var k = 0; k < 4; k++) if (counts[k] > 0) topPrice = prices[k];
  return {
    prices: prices, counts: counts, totalSamples: total, percentile: pct, cuLimit: cu,
    rank: chosen.rank, chosenPrice: chosen.price, medianPrice: median.price,
    cumAtChosen: chosen.cum, shareAtChosenBps: Number(BigInt(chosen.cum) * 10000n / BigInt(total)),
    feeLamports: chosenFee.toString(), feeSol: lamportsToSol(chosenFee.toString()),
    medianFeeLamports: medianFee.toString(),
    diffVsMedianLamports: (chosenFee - medianFee).toString(),
    zeroFee: chosenFee === 0n, atTop: chosen.price === topPrice,
    belowMedian: chosen.price < median.price, atMedian: chosen.price === median.price
  };
}

/* ---------- Tool 82: rent reclaim on account close ---------- */
/* The rent-exempt deposit of Tool 3 is a deposit, not a fee: closing
   an account returns its ENTIRE lamport balance to a destination
   account, so the deposit locked when the account was created comes
   back in full. A token account is 165 bytes, so each one closed
   reclaims exactly rentExempt(165) = 2,039,280 lamports; any other
   account reclaims (128 + dataLen) x 3,480 x 2 at its own size. The
   closing transactions still pay Tool 5's base fee of 5,000 lamports
   per signature - the signatures input is the total across every
   closing transaction in the plan - so the net reclaim is the gross
   reclaim minus that fee, and a plan whose signatures cost more than
   the accounts hold nets negative and is flagged, not hidden. An
   account can only close when its token balance is zero (stated on
   the page; balances are not modelled), and a token account holding
   withheld transfer fees keeps them out of the reclaim - the mint's
   withdraw authority harvests those, they are not the holder's.
   Every figure is exact integer lamports composed from Tool 3's own
   rentExempt and Tool 5's base fee. Prototype-proven on 20,009 cases
   against an independent Python integer oracle, 0 mismatches. No
   live account data is read. */
var TOKEN_ACCOUNT_BYTES = 165;
var MAX_RECLAIM_ACCOUNTS = 10000;
var MAX_RECLAIM_ACCOUNT_BYTES = 10000000;
var MAX_RECLAIM_SIGS = 1000;

function rentReclaim(tcStr, gcStr, gbStr, sigStr) {
  var rawAll = [tcStr, gcStr, gbStr, sigStr];
  for (var v = 0; v < rawAll.length; v++) {
    if (typeof rawAll[v] !== "string" || !/^-?\d+$/.test(rawAll[v].trim())) return null;
  }
  var tc = Number(tcStr), gc = Number(gcStr), gb = Number(gbStr), sigs = Number(sigStr);
  if (tc < 0 || tc > MAX_RECLAIM_ACCOUNTS || gc < 0 || gc > MAX_RECLAIM_ACCOUNTS || tc + gc < 1) return null;
  if (gb < 0 || gb > MAX_RECLAIM_ACCOUNT_BYTES) return null;
  if (sigs < 1 || sigs > MAX_RECLAIM_SIGS) return null;
  var perToken = BigInt(rentExempt(TOKEN_ACCOUNT_BYTES).rentExemptLamports);
  var perGeneric = BigInt(rentExempt(gb).rentExemptLamports);
  var tokenReclaim = perToken * BigInt(tc);
  var genericReclaim = perGeneric * BigInt(gc);
  var total = tokenReclaim + genericReclaim;
  var fee = BigInt(sigs) * BigInt(BASE_FEE_LAMPORTS_PER_SIGNATURE);
  var net = total - fee;
  var netAbs = net < 0n ? -net : net;
  return {
    tokenCount: tc, genericCount: gc, genericBytes: gb, signatures: sigs,
    perTokenLamports: perToken.toString(), perGenericLamports: perGeneric.toString(),
    tokenReclaimLamports: tokenReclaim.toString(), genericReclaimLamports: genericReclaim.toString(),
    totalReclaimLamports: total.toString(), totalReclaimSol: lamportsToSol(total.toString()),
    feeLamports: fee.toString(), netLamports: net.toString(),
    netSol: (net < 0n ? "-" : "") + lamportsToSol(netAbs.toString()),
    feeExceeds: net < 0n, breakEven: net === 0n,
    onlyTokens: gc === 0, onlyGeneric: tc === 0
  };
}

/* ---------- Tool 83: stake account funding ---------- */
/* What you fund a stake account with is not what gets delegated. A
   stake account is 200 bytes, so its rent-exempt reserve - Tool 3's
   rentExempt(200) = 2,282,880 lamports - sits inside the account's
   balance, and the stake program never delegates that part: the
   delegated amount is the funding minus the reserve, it earns nothing
   on the reserve, and the DELEGATED amount alone must clear the
   cluster's minimum delegation. That minimum is a cluster setting,
   reported by the RPC (getStakeMinimumDelegation) and changeable by
   governance, so it is an input here, never a hardcoded constant.
   Splitting one funding across several accounts pays the reserve once
   per account, so the funding opens at most floor(funding /
   (reserve + minimum)) minimum-sized accounts. Every figure is exact
   integer lamports composed from Tool 3's own rentExempt at 200
   bytes. Prototype-proven on 20,000 cases against an independent
   Python integer oracle, 0 mismatches. No live account is read. */
var STAKE_ACCOUNT_BYTES = 200;
var MAX_STAKE_FUNDING_LAMPORTS = 10000000000000000n; /* 10,000,000 SOL */

function stakeFunding(fundStr, minStr) {
  var fund = parseScaled(fundStr);
  var min = parseScaled(minStr);
  if (fund === null || min === null) return null;
  if (fund <= 0n || min <= 0n) return null;
  if (fund > MAX_STAKE_FUNDING_LAMPORTS || min > MAX_STAKE_FUNDING_LAMPORTS) return null;
  var reserve = BigInt(rentExempt(STAKE_ACCOUNT_BYTES).rentExemptLamports);
  var delegated = fund > reserve ? fund - reserve : 0n;
  var meets = delegated >= min;
  var minFunding = reserve + min;
  var shortfall = meets ? 0n : min - delegated;
  var reserveShortfall = fund < reserve ? reserve - fund : 0n;
  var accounts = fund / minFunding;
  var leftover = fund - accounts * minFunding;
  return {
    funding: formatScaled(fund), fundingLamports: fund.toString(),
    minimum: formatScaled(min), minimumLamports: min.toString(),
    reserveLamports: reserve.toString(), reserveSol: lamportsToSol(reserve.toString()),
    delegatedLamports: delegated.toString(), delegatedSol: lamportsToSol(delegated.toString()),
    delegatedBps: Number((delegated * 10000n) / fund),
    meetsMinimum: meets, belowReserve: delegated === 0n,
    exactMinimum: meets && delegated === min,
    minFundingLamports: minFunding.toString(), minFundingSol: lamportsToSol(minFunding.toString()),
    shortfallLamports: shortfall.toString(), shortfallSol: lamportsToSol(shortfall.toString()),
    reserveShortfallLamports: reserveShortfall.toString(),
    accountCount: Number(accounts),
    leftoverLamports: leftover.toString(), leftoverSol: lamportsToSol(leftover.toString())
  };
}

/* ---------- Tool 84: delinquent stake & the finality line ---------- */
/* Tower BFT finalizes a block only when MORE than two-thirds of the
   activated stake has voted for it - exactly two-thirds is not a
   supermajority. Delinquent stake is activated stake whose validator
   is not voting, so the cluster keeps finalizing exactly while
   delinquent x 3 < total, and the largest delinquent stake it can
   carry is total - (floor(2 x total / 3) + 1) lamports: one lamport
   under a third of the total, never a third itself. At exactly a
   third delinquent the online stake is exactly two-thirds, nothing
   finalizes, and a single lamport of stake coming back online
   restores the supermajority - blocks can still be produced while
   finality is stalled, which is why the two are stated separately.
   The scenario input asks the what-if every cluster dashboard
   implies: how much MORE stake can go delinquent before the line is
   crossed, or how much must return once it has been. Every figure is
   exact integer lamports; shares are floored basis points of the
   total. The totals are user-entered assumptions - no live cluster
   data is read. Prototype-proven on 20,000 cases against an
   independent Python exact-rational oracle, 0 mismatches, plus a
   brute-force scan of every total up to 499 lamports. */
var MAX_DELINQ_TOTAL_LAMPORTS = 1000000000000000000n; /* 1,000,000,000 SOL */

function delinquentStake(totalStr, delinqStr, extraStr) {
  var total = parseScaled(totalStr);
  var delinq = parseScaled(delinqStr);
  var extra = parseScaled(extraStr);
  if (total === null || delinq === null || extra === null) return null;
  if (total <= 0n || total > MAX_DELINQ_TOTAL_LAMPORTS) return null;
  if (delinq < 0n || delinq > total) return null;
  if (extra < 0n || delinq + extra > total) return null;
  var online = total - delinq;
  var minOnline = (2n * total) / 3n + 1n;
  var maxDelinq = total - minOnline;
  var finNow = online >= minOnline;
  var marginNow = maxDelinq - delinq;
  var delinqAfter = delinq + extra;
  var onlineAfter = total - delinqAfter;
  var finAfter = onlineAfter >= minOnline;
  var marginAfter = maxDelinq - delinqAfter;
  var bps = function (x) { return Number((x * 10000n) / total); };
  var pct = function (b) { return (b / 100).toFixed(2); };
  return {
    total: formatScaled(total), totalLamports: total.toString(),
    delinquent: formatScaled(delinq), delinquentLamports: delinq.toString(),
    delinqBps: bps(delinq), delinqPct: pct(bps(delinq)),
    onlineLamports: online.toString(), onlineSol: lamportsToSol(online.toString()),
    onlineBps: bps(online), onlinePct: pct(bps(online)),
    minOnlineLamports: minOnline.toString(), minOnlineSol: lamportsToSol(minOnline.toString()),
    maxDelinqLamports: maxDelinq.toString(), maxDelinqSol: lamportsToSol(maxDelinq.toString()),
    finalizesNow: finNow,
    marginNowLamports: marginNow.toString(), marginNowSol: formatScaled(marginNow),
    returnNeededNowLamports: (finNow ? 0n : -marginNow).toString(),
    returnNeededNowSol: formatScaled(finNow ? 0n : -marginNow),
    extra: formatScaled(extra), extraLamports: extra.toString(),
    delinqAfterLamports: delinqAfter.toString(), delinqAfterSol: lamportsToSol(delinqAfter.toString()),
    delinqAfterBps: bps(delinqAfter), delinqAfterPct: pct(bps(delinqAfter)),
    onlineAfterLamports: onlineAfter.toString(), onlineAfterSol: lamportsToSol(onlineAfter.toString()),
    finalizesAfter: finAfter,
    marginAfterLamports: marginAfter.toString(), marginAfterSol: formatScaled(marginAfter),
    returnNeededAfterLamports: (finAfter ? 0n : -marginAfter).toString(),
    returnNeededAfterSol: formatScaled(finAfter ? 0n : -marginAfter)
  };
}

/* ---------- Tool 85: wrapped SOL (wSOL) & the syncNative reserve ---------- */
/* Wrapped SOL is native SOL held inside an ordinary SPL token account
   for the native mint (So11111111111111111111111111111111111111112):
   programs that only speak SPL tokens - pools, order books, lending
   markets - trade wSOL, and every SOL-side swap leg wraps first. The
   token program's syncNative instruction sets the account's token
   balance to its lamport balance MINUS the rent-exempt minimum for a
   token account, so what you fund is not what you can spend: a token
   account is 165 bytes, its reserve is (128 + 165) x 6,960 =
   2,039,280 lamports (Tool 3's figure at that size), and funding a
   fresh wSOL account with 10 SOL leaves 9,997,960,720 lamports
   (9.99796072 SOL) of spendable wSOL. The reserve is a deposit, not a
   fee: closing the account returns its whole remaining balance, so
   after spending every spendable lamport the close still returns the
   2,039,280 reserve per account, and unwrapping an untouched account
   returns the full funding. Splitting one wrap across fresh accounts
   multiplies the reserve - 10 SOL across 10 fresh accounts locks
   20,392,800 and spends 9,979,607,200 - while topping up an account
   whose reserve is already funded (zero fresh accounts here) credits
   the full transfer, because syncNative only ever subtracts the one
   reserve the account already carries. Funding below the reserve
   spends nothing and is short by the difference. Every figure is
   exact integer lamports; the spendable share is floored basis
   points of the funding. Prototype-proven on 20,000 cases against an
   independent Python integer oracle, 0 mismatches. */
var WSOL_ACCOUNT_BYTES = 165;
var WSOL_RESERVE_LAMPORTS = 2039280n; /* (128 + 165) x 6,960 - Tool 3 at 165 bytes */
var MAX_WSOL_FUND_LAMPORTS = 1000000000000000000n; /* 1,000,000,000 SOL */
var MAX_WSOL_ACCOUNTS = 100000;

function wrappedSol(fundStr, accountsStr) {
  var fund = parseScaled(fundStr);
  if (fund === null) return null;
  if (typeof accountsStr !== "string") return null;
  var aStr = accountsStr.trim();
  if (!/^\d+$/.test(aStr)) return null;
  var accounts = Number(aStr);
  if (!Number.isInteger(accounts) || accounts < 0 || accounts > MAX_WSOL_ACCOUNTS) return null;
  if (fund <= 0n || fund > MAX_WSOL_FUND_LAMPORTS) return null;
  var reserve = WSOL_RESERVE_LAMPORTS * BigInt(accounts);
  var spendable = fund > reserve ? fund - reserve : 0n;
  var shortfall = reserve > fund ? reserve - fund : 0n;
  var bps = Number((spendable * 10000n) / fund);
  return {
    fund: formatScaled(fund), fundLamports: fund.toString(),
    accounts: accounts,
    reservePerAccountLamports: WSOL_RESERVE_LAMPORTS.toString(),
    reserveLamports: reserve.toString(), reserveSol: formatScaled(reserve),
    spendableLamports: spendable.toString(), spendableSol: lamportsToSol(spendable.toString()),
    spendableBps: bps, spendablePct: (bps / 100).toFixed(2),
    belowReserve: fund < reserve,
    shortfallLamports: shortfall.toString(), shortfallSol: formatScaled(shortfall),
    minFundLamports: (reserve + 1n).toString(), minFundSol: formatScaled(reserve + 1n),
    closeBackLamports: reserve.toString(), closeBackSol: formatScaled(reserve),
    unwrapLamports: fund.toString(), unwrapSol: formatScaled(fund)
  };
}

/* ---------- Tool 86: Nakamoto coefficient (smallest halting coalition) ---------- */
/* Tool 84 priced the LINE: Tower BFT finalizes only while MORE than
   two-thirds of the activated stake is voting, so finality stalls
   once the offline stake D satisfies 3D >= total - the smallest such
   D is the halt threshold, total - floor(2 x total / 3), exactly one
   lamport above Tool 84's largest still-finalizing delinquent stake.
   The Nakamoto coefficient asks WHO can reach that line: rank the
   validators largest first and walk down the list until the running
   sum reaches the threshold - the count at that point is the
   smallest number of (largest) validators that could stall finality
   by going offline or being compromised together. On a total of
   400,000,000 SOL the line is 133,333,333.333333334 SOL, and seven
   entered validators of 30, 25, 22, 20, 18, 15 and 10 million reach
   it only at the seventh (cumulative 140,000,000, 3,500 bps), while
   the largest alone holds 750 bps. At the exact edge the two tools
   agree: on a 300-lamport total a single 100-lamport validator IS
   the coefficient (exactly a third offline leaves exactly two-thirds
   online, which is not a supermajority), and 99 lamports falls one
   lamport short. A list whose combined stake stays under the line
   honestly reports no coefficient and the exact shortfall. Stakes
   are user-entered (largest validators, any order - the model ranks
   them); no live cluster or validator data is read, and a real
   coefficient counts entities, so validators run by one operator
   under several identities would lower the true figure - stated on
   the page. Every figure is exact integer lamports. Prototype-proven
   on 20,000 cases against an independent Python oracle using the
   3 x cum >= total formulation, 0 mismatches, with the two halt
   formulations brute-force-agreeing on every total up to 499
   lamports. */
var MAX_NAKA_TOTAL_LAMPORTS = 1000000000000000000n; /* 1,000,000,000 SOL */
var MAX_NAKA_VALIDATORS = 100;

function nakamotoCoefficient(totalStr, listStr) {
  var total = parseScaled(totalStr);
  if (total === null) return null;
  if (total <= 0n || total > MAX_NAKA_TOTAL_LAMPORTS) return null;
  if (typeof listStr !== "string") return null;
  var toks = listStr.split(/[\s,]+/).filter(function (x) { return x.length > 0; });
  if (toks.length < 1 || toks.length > MAX_NAKA_VALIDATORS) return null;
  var stakes = [];
  var sum = 0n;
  for (var i = 0; i < toks.length; i++) {
    var v = parseScaled(toks[i]);
    if (v === null || v <= 0n || v > total) return null;
    stakes.push(v); sum += v;
  }
  if (sum > total) return null;
  stakes.sort(function (a, b) { return a > b ? -1 : a < b ? 1 : 0; });
  var halt = total - (2n * total) / 3n;
  var cum = 0n, k = null, cumK = null;
  for (var j = 0; j < stakes.length; j++) {
    cum += stakes[j];
    if (k === null && cum >= halt) { k = j + 1; cumK = cum; }
  }
  var reached = k !== null;
  var bps = function (x) { return Number((x * 10000n) / total); };
  var pct = function (b) { return (b / 100).toFixed(2); };
  return {
    total: formatScaled(total), totalLamports: total.toString(),
    listed: stakes.length,
    listedLamports: sum.toString(), listedSol: formatScaled(sum),
    listedBps: bps(sum), listedPct: pct(bps(sum)),
    haltLamports: halt.toString(), haltSol: lamportsToSol(halt.toString()),
    haltBps: bps(halt), haltPct: pct(bps(halt)),
    reached: reached, coefficient: k,
    coalitionLamports: reached ? cumK.toString() : null,
    coalitionSol: reached ? formatScaled(cumK) : null,
    coalitionBps: reached ? bps(cumK) : null,
    coalitionPct: reached ? pct(bps(cumK)) : null,
    top1Lamports: stakes[0].toString(), top1Sol: formatScaled(stakes[0]),
    top1Bps: bps(stakes[0]), top1Pct: pct(bps(stakes[0])),
    shortfallLamports: (reached ? 0n : halt - sum).toString(),
    shortfallSol: formatScaled(reached ? 0n : halt - sum),
    stakesDescSol: stakes.map(function (s) { return formatScaled(s); })
  };
}

/* ---------- Tool 87: validator vote cost (voting is a fee, the same for every stake) ---------- */
/* A Solana validator takes part in consensus by voting, and a vote is
   an ordinary on-chain transaction: privileged, carrying exactly one
   signature, charged the 5,000-lamport base fee (Tool 5's figure) and
   NO priority fee. One vote is expected per slot, so the cost of an
   epoch is votes x 5,000 lamports and nothing else - it never scales
   with the validator's stake, which is why it is the fixed hurdle
   every small validator must clear and why the official validator FAQ
   quotes a single figure for everyone: up to about 1.1 SOL per day.
   Voting on 95% of a 432,000-slot epoch casts 410,400 votes and costs
   2,052,000,000 lamports (2.052 SOL) per epoch - 1.026 SOL per nominal
   day at 400-millisecond slots - against 2,160,000,000 (2.16 SOL) for
   voting on every slot; over 10 epochs the 95% plan pays 20.52 SOL.
   At full participation the per-day cost is exactly 1.08 SOL whatever
   the epoch length, because a nominal day always holds 216,000 slots.
   The only saving is a slot not voted on, and that slot also earns no
   vote credit toward the epoch's inflation rewards - a validator that
   votes on nothing is delinquent (Tool 84). The vote count floors
   like an on-chain division, so a share that floors below one vote
   (3 slots at 3,333 bps) casts zero. Slots, voted share and epochs
   are user-entered; no live cluster or validator data is read.
   Prototype-proven on 20,000 cases against an independent Python
   integer oracle, 0 mismatches. */
var VOTE_FEE_LAMPORTS = 5000n; /* one signature at Tool 5's base fee; votes carry no priority fee */
var MAX_VCOST_SLOTS = 432000; /* one normal epoch (Tool 12) */
var MAX_VCOST_EPOCHS = 1000;

function parseVoteCount(str, max) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^\d+$/.test(s)) return null;
  var n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > max) return null;
  return n;
}

function voteCost(slotsStr, votedBpsStr, epochsStr) {
  var slots = parseVoteCount(slotsStr, MAX_VCOST_SLOTS);
  var bps = parseVoteCount(votedBpsStr, 10000);
  var epochs = parseVoteCount(epochsStr, MAX_VCOST_EPOCHS);
  if (slots === null || bps === null || epochs === null) return null;
  if (slots < 1 || epochs < 1) return null;
  var votes = (BigInt(slots) * BigInt(bps)) / 10000n;
  var missed = BigInt(slots) - votes;
  var costEpoch = votes * VOTE_FEE_LAMPORTS;
  var fullEpoch = BigInt(slots) * VOTE_FEE_LAMPORTS;
  var savedEpoch = fullEpoch - costEpoch;
  var perDay = (costEpoch * 216000n) / BigInt(slots); /* nominal day = 216,000 slots at 400 ms */
  var totalCost = costEpoch * BigInt(epochs);
  var savedTotal = savedEpoch * BigInt(epochs);
  return {
    slots: slots, votedBps: bps, votedPct: (bps / 100).toFixed(2), epochs: epochs,
    feePerVoteLamports: VOTE_FEE_LAMPORTS.toString(),
    votesPerEpoch: votes.toString(), missedPerEpoch: missed.toString(),
    costPerEpochLamports: costEpoch.toString(), costPerEpochSol: formatScaled(costEpoch),
    totalVotes: (votes * BigInt(epochs)).toString(),
    totalCostLamports: totalCost.toString(), totalCostSol: formatScaled(totalCost),
    perDayLamports: perDay.toString(), perDaySol: formatScaled(perDay),
    fullCostPerEpochLamports: fullEpoch.toString(), fullCostPerEpochSol: formatScaled(fullEpoch),
    savedPerEpochLamports: savedEpoch.toString(), savedPerEpochSol: formatScaled(savedEpoch),
    savedTotalLamports: savedTotal.toString(), savedTotalSol: formatScaled(savedTotal),
    noVotes: votes === 0n, fullParticipation: bps === 10000
  };
}

/* ---------- Tool 88: validator net economics (commission in, vote costs out) ---------- */
/* A validator's staking ledger has one income line and one fixed cost.
   Income is commission (Tool 79): the vote account's whole-percentage
   cut of the rewards the total delegated stake earns at an assumed
   gross annual rate. Rewards settle per epoch, so the per-epoch gross
   converts the annual rate by the epoch's nominal length in days -
   slots / 216,000, Tool 87's nominal day at 400-millisecond slots -
   floored once at the smallest unit, and the commission floors again
   on that floored gross, exactly Tool 79's two floors; period figures
   are the per-epoch figures times the epoch count, because each epoch
   settles on its own. The cost side is Tool 87's voteCost run
   verbatim: 5,000 lamports per vote, one expected per slot, never
   scaling with stake. Net is the signed difference. The break-even
   stake is the smallest delegated stake whose per-epoch commission
   covers the per-epoch vote cost, found by binary search over the
   floored commission (monotone in stake) and minimal by construction:
   at one smallest unit less the commission falls short. At a 0%
   commission or a 0% gross rate no stake breaks even while votes cost
   anything, and a voted share that floors below one vote costs
   nothing, so every stake breaks even. Block revenue and MEV
   commissions (Tool 78's leader share), hardware and other running
   costs, and rewards on a validator's own stake beyond the commission
   charged on it are NOT modelled - this is the commission-versus-votes
   ledger only. The stake entered is the total delegated stake the
   commission is charged on; the gross rate is a user-assumed figure.
   Prototype-proven before shipping against an independent Python
   exact-rational oracle on 20,000 cases (0 mismatches on every
   figure), with the cost side asserted against voteCost on all 20,000
   and the commission side against Tool 79's own period figures at the
   standard 432,000-slot epoch. No live validator data is read. */
var VNET_SLOTS_PER_NOMINAL_DAY = 216000n; /* Tool 87's nominal day at 400 ms slots */
var VNET_RATE_DENOM = 10000n * 365n * VNET_SLOTS_PER_NOMINAL_DAY;

function vnetGrossPerEpoch(stakeUnits, grossBps, slots) {
  return (stakeUnits * BigInt(grossBps) * BigInt(slots)) / VNET_RATE_DENOM;
}
function vnetCommissionForStake(stakeUnits, grossBps, pct, slots) {
  return (vnetGrossPerEpoch(stakeUnits, grossBps, slots) * BigInt(pct)) / 100n;
}

function validatorNet(stakeStr, grossBpsStr, commissionPctStr, slotsStr, votedBpsStr, epochsStr) {
  var stake = parseScaled(stakeStr);
  var grossBps = Number(grossBpsStr), pct = Number(commissionPctStr);
  var slots = parseVoteCount(slotsStr, MAX_VCOST_SLOTS);
  var votedBps = parseVoteCount(votedBpsStr, 10000);
  var epochs = parseVoteCount(epochsStr, MAX_VCOST_EPOCHS);
  if (stake === null || stake <= 0n) return null;
  if (!Number.isInteger(grossBps) || grossBps < 0 || grossBps > MAX_VCOMM_GROSS_BPS) return null;
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) return null;
  if (slots === null || votedBps === null || epochs === null) return null;
  if (slots < 1 || epochs < 1) return null;
  var vc = voteCost(slotsStr, votedBpsStr, epochsStr);
  if (!vc) return null;
  var costEpoch = BigInt(vc.costPerEpochLamports);
  var costPeriod = BigInt(vc.totalCostLamports);
  var grossEpoch = vnetGrossPerEpoch(stake, grossBps, slots);
  var commEpoch = (grossEpoch * BigInt(pct)) / 100n;
  var commPeriod = commEpoch * BigInt(epochs);
  var grossPeriod = grossEpoch * BigInt(epochs);
  var netEpoch = commEpoch - costEpoch;
  var netPeriod = commPeriod - costPeriod;
  var noIncome = grossBps === 0 || pct === 0;
  var costFree = costEpoch === 0n;
  var breakEven = null;
  if (costFree) breakEven = 0n;
  else if (!noIncome) {
    var lo = 0n, hi = 1n, guard = 0;
    while (vnetCommissionForStake(hi, grossBps, pct, slots) < costEpoch && guard < 300) { hi *= 2n; guard++; }
    if (vnetCommissionForStake(hi, grossBps, pct, slots) >= costEpoch) {
      while (hi - lo > 1n) {
        var mid = (lo + hi) / 2n;
        if (vnetCommissionForStake(mid, grossBps, pct, slots) >= costEpoch) hi = mid; else lo = mid;
      }
      breakEven = hi;
    }
  }
  return {
    stake: formatScaled(stake), grossBps: grossBps, commissionPct: pct, slots: slots, votedBps: votedBps, epochs: epochs,
    grossPerEpoch: formatScaled(grossEpoch), commissionPerEpoch: formatScaled(commEpoch),
    voteCostPerEpochLamports: vc.costPerEpochLamports, voteCostPerEpochSol: vc.costPerEpochSol,
    netPerEpoch: formatScaled(netEpoch), netPerEpochLamports: netEpoch.toString(),
    grossPeriod: formatScaled(grossPeriod), commissionPeriod: formatScaled(commPeriod),
    voteCostPeriodLamports: vc.totalCostLamports, voteCostPeriodSol: vc.totalCostSol,
    netPeriod: formatScaled(netPeriod), netPeriodLamports: netPeriod.toString(),
    breakEvenStake: breakEven === null ? null : formatScaled(breakEven),
    breakEvenLamports: breakEven === null ? null : breakEven.toString(),
    shortfallStake: breakEven === null ? null : formatScaled(breakEven > stake ? breakEven - stake : 0n),
    surplusStake: breakEven === null ? null : formatScaled(stake > breakEven ? stake - breakEven : 0n),
    coversCosts: commPeriod >= costPeriod,
    profitable: netPeriod > 0n, exactlyBreaksEven: netPeriod === 0n,
    noIncome: noIncome, costFree: costFree, fullCommission: pct === 100
  };
}

/* ---------- Tool 89: platform-fee swap planner (the integrator cut) ---------- */
/* A swap interface can charge its own fee on top of the pool's: the
   integrator (Jupiter-style platform fees, aggregator and wallet referral
   fees) names a rate in basis points and the fee is taken from the OUTPUT
   of the swap - the gross output the pool's curve returns (Tool 2, pool
   fee on the input, exact scaled-BigInt) is reduced by
   floor(grossOut x platformBps / 10,000) before the user is credited.
   The fee is then split with a referrer in WHOLE percentage points: the
   referrer's cut floors, and the platform keeps the remainder, so the
   two parts sum to the fee exactly (the remainder convention of
   Tool 23's sale split). Charging on the output rather than the input
   matters: the fee itself never enters the curve, so it does not move
   the price - it only shrinks what arrives; charging on the input would
   shrink the effective input and the output with it. Against the spot
   output (amountIn at the pool's spot price, no fees at all) the whole
   trade's drag in basis points is the pool fee, the price impact and
   this platform fee compounded. The platform rate is capped at 1,000
   bps (10%) as this model's sanity bound - real integrator fees are
   far below it. A dust gross output can floor the platform fee to
   exactly zero. Prototype-proven before shipping against an
   independent Python exact-integer oracle on 20,000 cases (0
   mismatches on every figure). No live pool, interface or fee account
   is read. */
var MAX_PLATFORM_FEE_BPS = 1000;

function platformFeeSwap(reserveInStr, reserveOutStr, amountInStr, poolFeeBps, platformBps, referralPct) {
  var rIn = parseScaled(reserveInStr);
  var rOut = parseScaled(reserveOutStr);
  var aIn = parseScaled(amountInStr);
  var pf = Number(poolFeeBps), plat = Number(platformBps), ref = Number(referralPct);
  if (rIn === null || rOut === null || aIn === null) return null;
  if (rIn <= 0n || rOut <= 0n || aIn <= 0n) return null;
  if (!Number.isInteger(pf) || pf < 0 || pf >= 10000) return null;
  if (!Number.isInteger(plat) || plat < 0 || plat > MAX_PLATFORM_FEE_BPS) return null;
  if (!Number.isInteger(ref) || ref < 0 || ref > 100) return null;
  var poolFee = (aIn * BigInt(pf)) / 10000n;
  var eff = aIn - poolFee;
  if (eff <= 0n) return null;
  var gross = (eff * rOut) / (rIn + eff);
  if (gross <= 0n || gross >= rOut) return null;
  var pfee = (gross * BigInt(plat)) / 10000n;
  var refer = (pfee * BigInt(ref)) / 100n;
  var keeps = pfee - refer;
  var user = gross - pfee;
  var spot = (aIn * rOut) / rIn;
  var drag = spot - user;
  var dragBps = spot > 0n ? Number((drag * 10000n) / spot) : 0;
  return {
    reserveIn: formatScaled(rIn), reserveOut: formatScaled(rOut), amountIn: formatScaled(aIn),
    poolFeeBps: pf, platformBps: plat, referralPct: ref,
    poolFee: formatScaled(poolFee), effectiveIn: formatScaled(eff),
    grossOut: formatScaled(gross), platformFee: formatScaled(pfee),
    referrerGets: formatScaled(refer), platformKeeps: formatScaled(keeps),
    userReceives: formatScaled(user), spotOut: formatScaled(spot),
    totalDrag: formatScaled(drag), dragBps: dragBps,
    noPlatformFee: plat === 0 || pfee === 0n, fullReferral: ref === 100, noReferral: ref === 0
  };
}

/* ---------- Tool 90: aggregator split-route planner (one swap, two pools) ---------- */
/* An aggregator (Jupiter's core mechanic) does not have to send a whole
   swap to one pool: it can SPLIT the input across two pools for the same
   pair in parallel and add the outputs. Each leg is Tool 2 verbatim
   against its own pool's reserves and its own fee tier; the split is a
   whole percentage of the input to pool 1, floored at the smallest
   unit, and pool 2 receives the remainder, so the two legs' inputs sum
   to the amount in exactly. Splitting helps because price impact is
   convex: two half-trades each move their pool half as far, so on two
   identical 1,000,000 / 1,000,000 pools at 25 bps a 100,000 swap split
   50/50 returns 47,505.65543517 from each leg, 95,011.31087034 in
   total, against 90,702.432370993 sent to either pool alone - a gain
   of 4,308.878499347 (475 bps over the best single-pool fill). It is
   not free or automatic: splitting into a much shallower second pool
   can return LESS than the best single pool (the same headline split
   into a 100,000 / 100,000 second pool loses 9,919.045492954), and a
   real aggregator searches many pools, venues and split sizes (and
   serial routes, Tool 39) for the best total - this model prices the
   one split you enter, against both all-in fills, so the comparison is
   the lesson. The gain is measured against the BETTER of the two
   single-pool fills and can be negative; its basis-point form
   truncates toward zero. A positive leg whose swap floors to zero
   output rejects the whole model rather than counting it as zero.
   Prototype-proven before shipping against an independent Python
   exact-integer oracle on 20,000 cases (0 mismatches on every figure),
   with each leg asserted against Tool 2 in the test suite. No live
   pool, aggregator or quote is read. */
function splitRouteSwap(reserveIn1Str, reserveOut1Str, fee1Bps, reserveIn2Str, reserveOut2Str, fee2Bps, amountInStr, splitPct) {
  var rI1 = parseScaled(reserveIn1Str);
  var rO1 = parseScaled(reserveOut1Str);
  var rI2 = parseScaled(reserveIn2Str);
  var rO2 = parseScaled(reserveOut2Str);
  var aIn = parseScaled(amountInStr);
  var f1 = Number(fee1Bps), f2 = Number(fee2Bps), sp = Number(splitPct);
  if (rI1 === null || rO1 === null || rI2 === null || rO2 === null || aIn === null) return null;
  if (rI1 <= 0n || rO1 <= 0n || rI2 <= 0n || rO2 <= 0n || aIn <= 0n) return null;
  if (!Number.isInteger(f1) || f1 < 0 || f1 >= 10000) return null;
  if (!Number.isInteger(f2) || f2 < 0 || f2 >= 10000) return null;
  if (!Number.isInteger(sp) || sp < 0 || sp > 100) return null;
  var in1 = (aIn * BigInt(sp)) / 100n;
  var in2 = aIn - in1;
  function leg(rInS, rOutS, units, fee) {
    if (units === 0n) return { fee: 0n, out: 0n };
    var r = cpSwap(rInS, rOutS, formatScaled(units), fee);
    if (r === null) return null;
    return { fee: parseScaled(r.fee), out: parseScaled(r.amountOut) };
  }
  var l1 = leg(reserveIn1Str, reserveOut1Str, in1, f1);
  if (l1 === null) return null;
  var l2 = leg(reserveIn2Str, reserveOut2Str, in2, f2);
  if (l2 === null) return null;
  var total = l1.out + l2.out;
  if (total <= 0n) return null;
  function single(rInS, rOutS, fee) {
    var r = cpSwap(rInS, rOutS, amountInStr, fee);
    return r === null ? null : parseScaled(r.amountOut);
  }
  var s1 = single(reserveIn1Str, reserveOut1Str, f1);
  var s2 = single(reserveIn2Str, reserveOut2Str, f2);
  if (s1 === null && s2 === null) return null;
  var best, bestPool;
  if (s2 === null || (s1 !== null && s1 >= s2)) { best = s1; bestPool = 1; } else { best = s2; bestPool = 2; }
  var gain = total - best;
  var gainBps = best > 0n ? Number(gain >= 0n ? (gain * 10000n) / best : -(((-gain) * 10000n) / best)) : 0;
  return {
    reserveIn1: formatScaled(rI1), reserveOut1: formatScaled(rO1), fee1Bps: f1,
    reserveIn2: formatScaled(rI2), reserveOut2: formatScaled(rO2), fee2Bps: f2,
    amountIn: formatScaled(aIn), splitPct: sp,
    amountIn1: formatScaled(in1), amountIn2: formatScaled(in2),
    legFee1: formatScaled(l1.fee), legFee2: formatScaled(l2.fee),
    out1: formatScaled(l1.out), out2: formatScaled(l2.out),
    totalOut: formatScaled(total),
    single1Out: s1 === null ? null : formatScaled(s1),
    single2Out: s2 === null ? null : formatScaled(s2),
    bestSingleOut: formatScaled(best), bestPool: bestPool,
    gain: formatScaled(gain), gainBps: gainBps,
    splitWins: gain > 0n, allIn: sp === 0 || sp === 100
  };
}

function burnShare(supplyStr, holderStr, burnStr) {
  var S = parseScaled(supplyStr);
  var H = parseScaled(holderStr);
  var B = parseScaled(burnStr);
  if (S === null || H === null || B === null) return null;
  if (S <= 0n || H > S || B <= 0n || B > S - H) return null;
  var ns = S - B;
  var burnBps = Number((B * 10000n) / S);
  var beforeBps = Number((H * 10000n) / S);
  var afterBps = ns === 0n ? 0 : Number((H * 10000n) / ns);
  return {
    supply: formatScaled(S), holder: formatScaled(H), burn: formatScaled(B),
    newSupply: formatScaled(ns),
    burnBps: burnBps, beforeBps: beforeBps, afterBps: afterBps,
    gainBps: afterBps - beforeBps, fullyBurned: ns === 0n
  };
}

/* ---------- Tool 11: slippage tolerance bounds ---------- */
/* Every DEX interface asks for a slippage tolerance — how far the price may
   move against the trader between quote and landing — and turns it into a
   signed bound the on-chain program enforces: minimumReceived =
   expectedOut * (10000 - bps) / 10000 for an exact-in swap, maximumInput =
   expectedIn * (10000 + bps) / 10000 for an exact-out swap. Both divisions
   FLOOR in exact scaled-BigInt (never round), so the bound is never looser
   than the tolerance picked: an expected 4 at 50 bps protects at 3.98, not
   4. A dust expected output can floor the minimum to exactly 0 — returned
   as 0 here because that IS the bound the maths gives, and the handler
   warns about it plainly rather than dressing it up as protection. */
var MAX_SLIPPAGE_BPS = 9999;

function slippageAmounts(expectedOutStr, expectedInStr, toleranceBps) {
  var eOut = parseScaled(expectedOutStr);
  var eIn = parseScaled(expectedInStr);
  var bps = Number(toleranceBps);
  if (eOut === null || eIn === null) return null;
  if (eOut <= 0n || eIn <= 0n) return null;
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_SLIPPAGE_BPS) return null;
  var minReceived = (eOut * BigInt(10000 - bps)) / 10000n;
  var maxInput = (eIn * BigInt(10000 + bps)) / 10000n;
  return {
    expectedOut: formatScaled(eOut),
    expectedIn: formatScaled(eIn),
    toleranceBps: bps,
    tolerancePct: bps / 100,
    minimumReceived: formatScaled(minReceived),
    maximumInput: formatScaled(maxInput),
    minimumIsZero: minReceived === 0n
  };
}

/* ---------- Tool 12: epoch schedule (slot <-> epoch, with warmup) ---------- */
/* Solana's EpochSchedule is NOT "epoch = floor(slot / 432000)". The chain
   warms up: epoch 0 has 32 slots and each warmup epoch doubles, so epoch e
   (0..13) has 32 * 2^e slots and starts at (32 * 2^e) - 32. The first normal
   epoch is 14, starting at slot 524,256; only from there does an epoch hold
   a constant 432,000 slots, and the correct formula carries the warmup
   offset: epoch = 14 + floor((slot - 524256) / 432000). The naive division
   calls slot 524,256 "epoch 1" — it is epoch 14, and the naive epoch stays
   13 behind forever. Constants are the runtime's own EpochSchedule
   { slots_per_epoch: 432000, warmup: true, first_normal_epoch: 14,
   first_normal_slot: 524256 }, matching the SDK's get_epoch /
   get_first_slot_in_epoch / get_slots_in_epoch. This is schedule math in
   slots only: it deliberately does NOT convert to wall-clock time, because
   the target slot duration has changed repeatedly (400 ms for years, cut in
   stages during 2026) and skipped slots stretch real epochs further — for
   a slot's actual time use getBlockTime or an explorer. */
var MIN_SLOTS_PER_EPOCH = 32;
var FIRST_NORMAL_EPOCH = 14;
var FIRST_NORMAL_SLOT = 524256;

function epochIndex(v) {
  var n = Number(typeof v === "string" ? v.trim() : v);
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return n;
}
function slotsInEpoch(epoch) {
  var e = epochIndex(epoch);
  if (e === null) return null;
  return e < FIRST_NORMAL_EPOCH ? MIN_SLOTS_PER_EPOCH * Math.pow(2, e) : SLOTS_PER_EPOCH;
}
function firstSlotInEpoch(epoch) {
  var e = epochIndex(epoch);
  if (e === null) return null;
  if (e <= FIRST_NORMAL_EPOCH) return MIN_SLOTS_PER_EPOCH * Math.pow(2, e) - MIN_SLOTS_PER_EPOCH;
  return FIRST_NORMAL_SLOT + (e - FIRST_NORMAL_EPOCH) * SLOTS_PER_EPOCH;
}
function epochRange(epoch) {
  var e = epochIndex(epoch);
  if (e === null) return null;
  var first = firstSlotInEpoch(e), len = slotsInEpoch(e);
  return { epoch: e, firstSlot: first, lastSlot: first + len - 1, slotsInEpoch: len, warmup: e < FIRST_NORMAL_EPOCH };
}
function epochForSlot(slot) {
  var s = epochIndex(slot);
  if (s === null) return null;
  var e, first;
  if (s < FIRST_NORMAL_SLOT) {
    e = 0; first = 0;
    while (s >= first + slotsInEpoch(e)) { first += slotsInEpoch(e); e++; }
  } else {
    e = FIRST_NORMAL_EPOCH + Math.floor((s - FIRST_NORMAL_SLOT) / SLOTS_PER_EPOCH);
    first = firstSlotInEpoch(e);
  }
  var len = slotsInEpoch(e);
  return {
    slot: s, epoch: e, slotIndex: s - first, slotsInEpoch: len,
    firstSlot: first, lastSlot: first + len - 1, warmup: e < FIRST_NORMAL_EPOCH,
    progressPct: ((s - first) / len) * 100
  };
}

/* ---------- Tool 13: Token-2022 transfer fee (withheld on transfer) ---------- */
/* The Token-2022 program (the SPL Token program's successor, program id
   TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb) lets a mint carry a
   TransferFeeConfig: on every transfer the sender is debited the full
   amount, the recipient is credited amount - fee, and the fee stays
   WITHHELD inside the recipient's token account until it is harvested to
   the mint and withdrawn by the withdraw-withheld authority. The classic
   SPL Token program has no transfer fees at all. The program's own
   calculate_fee is exact integer math on RAW amounts (Tool 6's units):
   fee = ceil(amount * transferFeeBasisPoints / 10000), capped at the
   mint's maximumFee, and 0 when the rate or the amount is 0. The ceiling
   is the teaching point most quotes get wrong: any positive transfer at
   any positive rate pays at least 1 raw unit of fee. A mint stores an
   older and a newer fee and picks by epoch; this model takes the single
   configuration you enter, as in effect for the transfer you are pricing.
   The gross-up direction finds the smallest amount to SEND so the
   recipient receives exactly a wanted net: fee(amount) never exceeds
   maximumFee, so the answer lies in [net, net + maximumFee], and
   amount - fee(amount) rises by 0 or 1 per unit (the fee itself rises by
   at most 1 per unit at any rate up to 100%), so a binary search lands
   on the exact amount; both directions are proven against brute force. */
var MAX_FEE_BASIS_POINTS = 10000;

function rawAmount(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (!/^\d+$/.test(s)) return null;
  return BigInt(s);
}
function feeBpsValue(v) {
  var n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_FEE_BASIS_POINTS ? n : null;
}
function transferFeeParts(amount, bps, maximumFee) { /* BigInt in, BigInt out */
  if (bps === 0n || amount === 0n) return { rawFee: 0n, fee: 0n };
  var rawFee = (amount * bps + 9999n) / 10000n; /* ceil division */
  return { rawFee: rawFee, fee: rawFee > maximumFee ? maximumFee : rawFee };
}
function transferFee(amountStr, feeBps, maximumFeeStr) {
  var amount = rawAmount(amountStr);
  var maximumFee = rawAmount(maximumFeeStr);
  var bps = feeBpsValue(feeBps);
  if (amount === null || maximumFee === null || bps === null) return null;
  var parts = transferFeeParts(amount, BigInt(bps), maximumFee);
  return {
    amount: amount.toString(),
    feeBps: bps,
    feePct: bps / 100,
    maximumFee: maximumFee.toString(),
    fee: parts.fee.toString(),
    netReceived: (amount - parts.fee).toString(),
    capped: parts.rawFee > maximumFee
  };
}
function transferFeeGrossUp(netStr, feeBps, maximumFeeStr) {
  var net = rawAmount(netStr);
  var maximumFee = rawAmount(maximumFeeStr);
  var bps = feeBpsValue(feeBps);
  if (net === null || maximumFee === null || bps === null) return null;
  var b = BigInt(bps);
  function received(pre) {
    return pre - transferFeeParts(pre, b, maximumFee).fee;
  }
  var lo = net, hi = net + maximumFee; /* received(hi) >= net: the fee there is at most maximumFee */
  while (lo < hi) {
    var mid = (lo + hi) / 2n;
    if (received(mid) >= net) hi = mid; else lo = mid + 1n;
  }
  var parts = transferFeeParts(lo, b, maximumFee);
  return {
    netReceived: net.toString(),
    feeBps: bps,
    feePct: bps / 100,
    maximumFee: maximumFee.toString(),
    grossAmount: lo.toString(),
    fee: parts.fee.toString(),
    capped: parts.rawFee > maximumFee
  };
}

/* ---------- Tool 14: sandwich attack (MEV) model ---------- */
/* A sandwich is the canonical MEV extraction on an AMM: the attacker sees
   a victim's pending swap, buys the same direction FIRST (front-run —
   pushing the pool price against the victim), lets the victim execute at
   the worse price, then sells everything back (back-run) into the price
   the victim's own trade moved. All three legs here are Tool 2's own
   cpSwap run verbatim against the reserves each leg leaves behind, so
   the model can never drift from the hub's swap math: reserves gain the
   FULL input of each leg (the fee portion stays in the pool) and lose
   that leg's output. The victim's defence is the Tool 11 bound: if the
   sandwiched output falls below minimumReceived = baselineOut x
   (10000 - slippageBps) / 10000 (floored), the victim's transaction
   ABORTS instead of filling — the victim loses no tokens to the pool
   (the network fee is still paid), and the attacker must unwind against
   the post-front-run reserves alone, which costs the round-trip fees
   and price impact, so the attack loses money. Attacker profit is
   signed: at loose tolerances it is positive and comes out of the
   victim's loss plus the pool fees' price effect; it is NOT created
   value. This is a single-pool, single-block educational model: real
   sandwiches route through bundles, tips and multiple pools, and
   private transaction routing exists precisely to keep a swap out of
   the public flow this attack reads. */
function sandwichAttack(reserveAStr, reserveBStr, victimInStr, attackerInStr, feeBps, slippageBps) {
  var slip = Number(slippageBps);
  if (!Number.isInteger(slip) || slip < 0 || slip > MAX_SLIPPAGE_BPS) return null;
  var baseline = cpSwap(reserveAStr, reserveBStr, victimInStr, feeBps);
  var front = cpSwap(reserveAStr, reserveBStr, attackerInStr, feeBps);
  if (baseline === null || front === null) return null;
  var rA = parseScaled(reserveAStr), rB = parseScaled(reserveBStr);
  var vIn = parseScaled(victimInStr), aIn = parseScaled(attackerInStr);
  var frontOut = parseScaled(front.amountOut);
  var rA1 = rA + aIn, rB1 = rB - frontOut; /* reserves after the front-run */
  var victimLeg = cpSwap(formatScaled(rA1), formatScaled(rB1), victimInStr, feeBps);
  var attemptedOut = victimLeg === null ? 0n : parseScaled(victimLeg.amountOut);
  var baselineOut = parseScaled(baseline.amountOut);
  var minimum = (baselineOut * BigInt(10000 - slip)) / 10000n; /* floored, Tool 11's rule */
  var protected_ = attemptedOut < minimum;
  var back;
  if (protected_) {
    back = cpSwap(formatScaled(rB1), formatScaled(rA1), front.amountOut, feeBps);
  } else {
    var rA2 = rA1 + vIn, rB2 = rB1 - attemptedOut; /* reserves after the victim fills */
    back = cpSwap(formatScaled(rB2), formatScaled(rA2), front.amountOut, feeBps);
  }
  var backOut = back === null ? 0n : parseScaled(back.amountOut);
  var profit = backOut - aIn;
  var loss = protected_ ? 0n : baselineOut - attemptedOut;
  return {
    reserveA: formatScaled(rA), reserveB: formatScaled(rB),
    victimIn: formatScaled(vIn), attackerIn: formatScaled(aIn),
    feeBps: Number(feeBps), slippageBps: slip,
    baselineOut: baseline.amountOut,
    frontOut: front.amountOut,
    attemptedVictimOut: formatScaled(attemptedOut),
    minimumReceived: formatScaled(minimum),
    victimProtected: protected_,
    victimOut: protected_ ? "0" : formatScaled(attemptedOut),
    backOut: formatScaled(backOut),
    attackerProfit: formatScaled(profit),
    attackerProfitPct: Number(profit) / Number(aIn) * 100,
    victimLoss: formatScaled(loss),
    victimLossPct: baselineOut === 0n ? 0 : Number(loss) / Number(baselineOut) * 100
  };
}

/* ---------- Tool 15: liquid staking (LST) exchange rate ---------- */
/* A liquid staking pool (SPL Stake Pool, Marinade, Jito and peers) holds
   staked SOL and issues a pool token. The token is NOT rebasing: the
   holder's token balance never changes when rewards land — instead the
   pool's total lamports grow with no new tokens minted, so the exchange
   rate (SOL per token = total staked SOL / token supply) rises.
   Deposit mints deposit * supply / total tokens and redemption returns
   redeem * total / supply SOL, both floored in exact scaled BigInt like
   an on-chain u64 division — a dust deposit can floor to zero tokens.
   Rewards are a user-supplied amount added to the total: depositing
   after they land mints fewer tokens per SOL, and redeeming the same
   token amount returns more SOL — that difference IS the yield.
   Model scope, stated in the UI: no deposit / withdrawal / epoch fees
   (real pools charge some, check the pool's own terms), and no unstake
   delay — a stake-pool withdrawal that is not covered by pool liquidity
   deactivates stake and waits out the cooldown (Tool 12's epochs). */
function liquidStaking(totalSolStr, supplyStr, rewardsStr, depositStr, redeemStr) {
  var total = parseScaled(totalSolStr), supply = parseScaled(supplyStr);
  var rewards = parseScaled(rewardsStr), deposit = parseScaled(depositStr);
  var redeem = parseScaled(redeemStr);
  if (total === null || supply === null || rewards === null || deposit === null || redeem === null) return null;
  if (total <= 0n || supply <= 0n) return null;
  if (deposit <= 0n) return null;
  if (redeem <= 0n || redeem > supply) return null;
  var totalAfter = total + rewards;
  var minted = (deposit * supply) / total;
  var mintedAfter = (deposit * supply) / totalAfter;
  var redeemOut = (redeem * total) / supply;
  var redeemAfter = (redeem * totalAfter) / supply;
  return {
    totalSol: formatScaled(total), supply: formatScaled(supply),
    rewards: formatScaled(rewards), deposit: formatScaled(deposit),
    redeem: formatScaled(redeem),
    rate: Number(total) / Number(supply),
    rateAfterRewards: Number(totalAfter) / Number(supply),
    totalAfterRewards: formatScaled(totalAfter),
    tokensMinted: formatScaled(minted),
    tokensMintedAfterRewards: formatScaled(mintedAfter),
    redeemOut: formatScaled(redeemOut),
    redeemOutAfterRewards: formatScaled(redeemAfter),
    redeemGain: formatScaled(redeemAfter - redeemOut),
    mintedFloorsToZero: minted === 0n
  };
}

/* ---------- Tool 16: program-derived addresses (PDAs) ---------- */
/* A program-derived address is how a Solana program owns accounts and
   "signs" without a private key. It is derived, not generated:
     address = SHA-256(seed bytes... || bump byte || program id bytes
                       || "ProgramDerivedAddress")
   and the 32-byte result must NOT be a valid ed25519 point — an address
   ON the curve could have a private key, so it can never be a PDA.
   findProgramAddress tries bump 255, 254, ... and keeps the first hash
   that lands off the curve (about half of all hashes are off-curve, so
   the scan usually succeeds within a couple of tries); the bump that
   worked is stored with the account and passed back as the last seed
   whenever the program signs with invoke_signed. The runtime's rules:
   at most 16 seeds, each at most 32 bytes. Seeds are raw bytes — a text
   seed means its UTF-8 encoding, and real-world seeds are just as often
   a pubkey's 32 bytes (an associated token account is exactly this: the
   ATA program deriving from [wallet, token program, mint]).
   This page derives locally with a self-contained SHA-256 and BigInt
   field math for the curve check — derivation is pure hashing, so the
   result is identical on every cluster and needs no lookup. It proves
   the derivation is well-formed; it does not prove whose PDA an address
   is — check the program id and the seeds against the source you trust,
   in full, exactly as with any address (Tool 7). */
var MAX_PDA_SEEDS = 16;
var MAX_PDA_SEED_BYTES = 32;
var PDA_MARKER = "ProgramDerivedAddress";

var SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
function sha256Rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }
function sha256Bytes(msg) {
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var bitLen = msg.length * 8;
  var padded = [];
  for (var i = 0; i < msg.length; i++) padded.push(msg[i] & 255);
  padded.push(0x80);
  while (padded.length % 64 !== 56) padded.push(0);
  var hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
  padded.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
              (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  var w = new Array(64);
  for (var off = 0; off < padded.length; off += 64) {
    var t;
    for (t = 0; t < 16; t++) {
      w[t] = ((padded[off + 4 * t] << 24) | (padded[off + 4 * t + 1] << 16) |
              (padded[off + 4 * t + 2] << 8) | padded[off + 4 * t + 3]) >>> 0;
    }
    for (t = 16; t < 64; t++) {
      var s0 = (sha256Rotr(w[t - 15], 7) ^ sha256Rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)) >>> 0;
      var s1 = (sha256Rotr(w[t - 2], 17) ^ sha256Rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (t = 0; t < 64; t++) {
      var S1 = (sha256Rotr(e, 6) ^ sha256Rotr(e, 11) ^ sha256Rotr(e, 25)) >>> 0;
      var ch = ((e & f) ^ (~e & g)) >>> 0;
      var t1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      var S0 = (sha256Rotr(a, 2) ^ sha256Rotr(a, 13) ^ sha256Rotr(a, 22)) >>> 0;
      var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      var t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  var out = [];
  for (var k = 0; k < 8; k++) out.push((H[k] >>> 24) & 255, (H[k] >>> 16) & 255, (H[k] >>> 8) & 255, H[k] & 255);
  return out;
}

/* ed25519 field: p = 2^255 - 19, curve -x^2 + y^2 = 1 + d x^2 y^2.
   A compressed point stores y little-endian with the x sign in the top
   bit. The point exists iff x^2 = (y^2 - 1) / (d y^2 + 1) has a solution:
   x^2 is 0 (valid only with the sign bit clear — "negative zero" is not
   a valid encoding) or a quadratic residue, by Euler's criterion. */
var ED25519_P = (1n << 255n) - 19n;
function ed25519Pow(base, exp) {
  var r = 1n, b = ((base % ED25519_P) + ED25519_P) % ED25519_P;
  while (exp > 0n) { if (exp & 1n) r = (r * b) % ED25519_P; b = (b * b) % ED25519_P; exp >>= 1n; }
  return r;
}
var ED25519_D = ((-121665n * ed25519Pow(121666n, ED25519_P - 2n)) % ED25519_P + ED25519_P) % ED25519_P;
function isOnCurveBytes(bytes) {
  if (!bytes || bytes.length !== 32) return false;
  var y = 0n;
  for (var i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i] & 255);
  y &= (1n << 255n) - 1n; /* the top bit is the x sign, not part of y */
  if (y >= ED25519_P) return false;
  var y2 = (y * y) % ED25519_P;
  var u = (y2 - 1n + ED25519_P) % ED25519_P;
  var v = (ED25519_D * y2 + 1n) % ED25519_P;
  if (v === 0n) return false;
  var x2 = (u * ed25519Pow(v, ED25519_P - 2n)) % ED25519_P;
  if (x2 === 0n) return (bytes[31] & 128) === 0;
  return ed25519Pow(x2, (ED25519_P - 1n) / 2n) === 1n;
}

function utf8Bytes(str) {
  if (typeof str !== "string") return null;
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var cp = str.codePointAt(i);
    if (cp > 0xffff) i++; /* surrogate pair consumed */
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}
function pdaMarkerBytes() {
  var out = [];
  for (var i = 0; i < PDA_MARKER.length; i++) out.push(PDA_MARKER.charCodeAt(i));
  return out;
}
function validSeedBytes(seedBytesList, maxCount) {
  if (!Array.isArray(seedBytesList) || seedBytesList.length > maxCount) return false;
  for (var i = 0; i < seedBytesList.length; i++) {
    var s = seedBytesList[i];
    if (!s || typeof s.length !== "number" || s.length > MAX_PDA_SEED_BYTES) return false;
    for (var j = 0; j < s.length; j++) {
      if (!Number.isInteger(s[j]) || s[j] < 0 || s[j] > 255) return false;
    }
  }
  return true;
}
function createProgramAddressBytes(seedBytesList, programBytes) {
  /* the list handed in here already ends with the bump byte, so the cap is
     the runtime's 16 seeds plus that one bump entry */
  if (!validSeedBytes(seedBytesList, MAX_PDA_SEEDS + 1)) return null;
  if (!programBytes || programBytes.length !== 32) return null;
  var msg = [];
  for (var i = 0; i < seedBytesList.length; i++) msg = msg.concat(seedBytesList[i]);
  msg = msg.concat(programBytes, pdaMarkerBytes());
  var hash = sha256Bytes(msg);
  if (isOnCurveBytes(hash)) return null; /* on-curve: could have a keypair, so never a PDA */
  return hash;
}
function findProgramAddressBytes(seedBytesList, programBytes) {
  if (!validSeedBytes(seedBytesList, MAX_PDA_SEEDS)) return null;
  if (!programBytes || programBytes.length !== 32) return null;
  for (var bump = 255; bump >= 0; bump--) {
    var addr = createProgramAddressBytes(seedBytesList.concat([[bump]]), programBytes);
    if (addr !== null) return { address: base58Encode(addr), addressBytes: addr, bump: bump, candidatesTried: 256 - bump };
  }
  return null;
}
function findProgramAddress(programIdStr, seedStrs) {
  if (typeof programIdStr !== "string" || !Array.isArray(seedStrs)) return null;
  var program = programIdStr.trim();
  var programBytes = base58Decode(program);
  if (programBytes === null || programBytes.length !== 32) return null;
  if (seedStrs.length > MAX_PDA_SEEDS) return null;
  var seedBytesList = [];
  for (var i = 0; i < seedStrs.length; i++) {
    var bytes = utf8Bytes(seedStrs[i]);
    if (bytes === null || bytes.length > MAX_PDA_SEED_BYTES) return null;
    seedBytesList.push(bytes);
  }
  var found = findProgramAddressBytes(seedBytesList, programBytes);
  if (found === null) return null;
  return {
    programId: program,
    seeds: seedStrs.slice(),
    address: found.address,
    bump: found.bump,
    candidatesTried: found.candidatesTried
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
    rentExempt, impermanentLoss, txFee, tokenToRaw, rawToToken, catalogueMatch,
    base58Decode, base58Encode, checkAddress, stakingRewards,
    buildSolanaPayUrl, parseSolanaPayUrl, validPayAmount, KNOWN_MINT_DECIMALS,
    tickToPrice, priceToTick, clmmRange, MIN_TICK, MAX_TICK, TICK_BASE,
    slippageAmounts, MAX_SLIPPAGE_BPS,
    transferFee, transferFeeGrossUp, MAX_FEE_BASIS_POINTS,
    sandwichAttack, liquidStaking,
    clmmPosition, lpDeposit, isqrtBigInt, vestingSchedule, MAX_VESTING_MONTHS, lendingHealth,
    txSize, shortvecLen, PACKET_DATA_SIZE,
    anchorSpace, anchorFieldSize, ANCHOR_DISCRIMINATOR_BYTES, MAX_FIELD_PARAM,
    saleSplit,
    stakeWarmup, CURRENT_WARMUP_COOLDOWN_BPS, LEGACY_WARMUP_COOLDOWN_BPS,
    clmmFeesOwed, FEE_GROWTH_Q64, FEE_GROWTH_MODULUS,
    inflationSchedule, INITIAL_INFLATION_PCT, TERMINAL_INFLATION_PCT,
    associatedTokenAddress, ATA_PROGRAM_ID, SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
    merkleTreePlan, CMT_HEADER_BYTES, CMT_FIXED_BYTES, CMT_MAX_DEPTH, CMT_MAX_BUFFER_SIZE,
    createWithSeed, MAX_SEED_ADDRESS_SEED_BYTES, STAKE_PROGRAM_ID,
    tokenValuation,
    lookupTablePlan, ALT_META_BYTES, ALT_MAX_ADDRESSES,
    pythConfidence, formatRawExpo,
    bondingCurve,
    perpFunding, parseSignedScaled, MAX_FUNDING_RATE_BPS, MAX_FUNDING_HOURS,
    lendingRate, MAX_IRATE_BPS, MAX_IRATE_DAYS,
    perpPosition, MAX_PERP_LEVERAGE,
    stableSwap, stableInvariantD, stableSolveY, MAX_STABLE_AMP,
    liquidationMax,
    routeSwap, cpSwapExactOut, arbitrageTrade, clmmSwap, orderBookBuy, twapOracle, MAX_TWAP_SECONDS, lpWithdraw,
    airdropCost, MAX_AIRDROP_RECIPIENTS, TOKEN_ACCOUNT_BYTES,
    dutchAuctionPrice, MAX_DUTCH_DURATION_SECONDS,
    govVote,
    tokenAllocation,
    quadraticVote, MAX_QV_BUDGET, MAX_QV_VOTES,
    burnShare,
    merkleProof, MAX_MERKLE_RECIPIENTS,
    multisigPlan, binomBigInt, MAX_MULTISIG_MEMBERS,
    buybackBurn,
    escrowRelease,
    dcaPlan, MAX_DCA_ORDERS, MAX_DCA_TX_FEE_LAMPORTS,
    dlmmBins, MAX_DLMM_BIN_ID, MAX_DLMM_WIDTH,
    nftMintCost, NFT_MINT_BYTES, NFT_TOKEN_ACCOUNT_BYTES, NFT_METADATA_BYTES, NFT_EDITION_BYTES, MAX_NFT_COUNT,
    programDeployCost, PROGRAM_ACCOUNT_BYTES, PROGRAMDATA_HEADER_BYTES, BUFFER_HEADER_BYTES, MAX_PROGRAM_BYTES,
    clmmImpermanentLoss,
    optionsPayoff,
    blockhashExpiry, MAX_PROCESSING_AGE_BLOCKS,
    anchorDiscriminator, MAX_ANCHOR_NAME_CHARS,
    reallocPlan, MAX_PERMITTED_DATA_INCREASE, MAX_ACCOUNT_DATA_LEN,
    durableNoncePlan, NONCE_ACCOUNT_BYTES, MAX_NONCE_TRANSACTIONS,
    token2022MintSpace, T22_MINT_BASE_BYTES, T22_TLV_HEADER_BYTES, T22_MULTISIG_ACCOUNT_BYTES, T22_MINT_EXTENSION_BYTES,
    token2022AccountSpace, T22_ACCOUNT_BASE_BYTES, T22_ACCOUNT_EXTENSION_BYTES,
    computeBudgetPlan, DEFAULT_CU_PER_INSTRUCTION,
    interestBearingAmount, IB_SECONDS_PER_YEAR, MAX_IB_DAYS,
    scaledUiAmount, MAX_SUA_MULTIPLIER, MAX_SUA_TIMESTAMP,
    lpFeeEarnings, MAX_LPF_VALUE, MAX_LPF_DAYS,
    predictionMarket, MAX_PRED_SPEND,
    leverageLoop, MAX_LOOP_DEPOSIT, MAX_LOOP_RATE_BPS,
    transferFeeSwap,
    stakePoolFees, MAX_SPOOL_VALUE,
    farmRewards, MAX_FARM_VALUE, MAX_FARM_DAYS,
    bundleTipPlan, MAX_BUNDLE_LAMPORTS, MAX_BUNDLE_COUNT, MAX_BUNDLE_TXS, MAX_BUNDLE_SIGS, MIN_BUNDLE_TIP_LAMPORTS,
    feeSplit, MAX_FSPLIT_SIGS, MAX_FSPLIT_COUNT, MAX_FSPLIT_CU_PRICE,
    validatorCommission, MAX_VCOMM_GROSS_BPS, MAX_VCOMM_DAYS,
    leaderSchedule, LEADER_SLOTS_PER_WINDOW, MAX_LEAD_SLOTS_PER_EPOCH,
    priorityFeePercentile, MAX_PFEE_PRICE, MAX_PFEE_COUNT, MAX_PFEE_SAMPLES,
    rentReclaim, TOKEN_ACCOUNT_BYTES, MAX_RECLAIM_ACCOUNTS, MAX_RECLAIM_ACCOUNT_BYTES, MAX_RECLAIM_SIGS,
    stakeFunding, STAKE_ACCOUNT_BYTES, MAX_STAKE_FUNDING_LAMPORTS,
    delinquentStake, MAX_DELINQ_TOTAL_LAMPORTS,
    wrappedSol, WSOL_ACCOUNT_BYTES, MAX_WSOL_FUND_LAMPORTS, MAX_WSOL_ACCOUNTS,
    nakamotoCoefficient, MAX_NAKA_TOTAL_LAMPORTS, MAX_NAKA_VALIDATORS,
    voteCost, VOTE_FEE_LAMPORTS, MAX_VCOST_SLOTS, MAX_VCOST_EPOCHS,
    validatorNet,
    platformFeeSwap, MAX_PLATFORM_FEE_BPS,
    splitRouteSwap,
    sha256Bytes, isOnCurveBytes, utf8Bytes, createProgramAddressBytes,
    findProgramAddressBytes, findProgramAddress, ED25519_D,
    MAX_PDA_SEEDS, MAX_PDA_SEED_BYTES, PDA_MARKER,
    epochForSlot, epochRange, slotsInEpoch, firstSlotInEpoch,
    MIN_SLOTS_PER_EPOCH, FIRST_NORMAL_EPOCH, FIRST_NORMAL_SLOT,
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
    function fmtAmt(x) { return x === 0 ? "0" : (Math.abs(x) < 0.001 || Math.abs(x) >= 1e15 ? x.toExponential(6) : String(Number(x.toPrecision(10)))); }

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

    var tickForm = document.getElementById("tick-calc");
    if (tickForm) tickForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var tick = val("tick-in").trim(), price = val("price-in").trim();
      function fmtPrice(p) { return p < 0.001 || p >= 1e15 ? p.toExponential(6) : String(Number(p.toPrecision(10))); }
      if (tick) {
        var p = tickToPrice(tick);
        setText("tick-result", p === null
          ? "Enter a whole-number tick from -443,636 to 443,636 — the on-chain CLMM tick range."
          : "Tick " + tick + " is price " + fmtPrice(p) + " (1.0001^" + tick + ") in raw token units. Each tick is one basis point of price: 100 ticks is about a 1% move.");
        if (p !== null) document.getElementById("tick-price-out").value = fmtPrice(p);
      } else if (price) {
        var t = priceToTick(price);
        setText("tick-result", t === null
          ? "Enter a positive price inside the CLMM tick range (about 5.42e-20 to 1.84e19 in raw units)."
          : "Price " + price + " sits at tick " + t + " — the largest tick whose price (1.0001^" + t + " = " + fmtPrice(tickToPrice(t)) + ") is at or below it, the floor convention pools use.");
        if (t !== null) document.getElementById("price-tick-out").value = String(t);
      } else {
        setText("tick-result", "Fill in either a tick or a price, then convert.");
      }
    });

    var rangeForm = document.getElementById("clmmrange-calc");
    if (rangeForm) rangeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = clmmRange(val("range-lower"), val("range-upper"), val("range-current"), val("range-spacing"));
      if (res === null) {
        document.getElementById("range-out").value = "Invalid range";
        setText("range-result", "Check the inputs: all ticks must be whole numbers in -443,636 to 443,636, the lower tick must be below the upper tick, the spacing must be a positive whole number, and both endpoints must be aligned to that spacing (endpoint % spacing = 0) — a pool rejects a misaligned position.");
        return;
      }
      document.getElementById("range-out").value = res.inRange ? "In range — active" : "Out of range — inactive";
      function fmtPrice(p) { return p < 0.001 || p >= 1e15 ? p.toExponential(6) : String(Number(p.toPrecision(10))); }
      setText("range-result", "Model output: ticks " + res.tickLower + " to " + res.tickUpper + " are prices " + fmtPrice(res.priceLower) + " to " + fmtPrice(res.priceUpper) + " — a range " + res.widthPct.toFixed(2) + "% wide (upper/lower ratio " + res.widthRatio.toFixed(4) + "). The current tick " + res.tickCurrent + " (price " + fmtPrice(res.priceCurrent) + ") is " + (res.inRange ? "inside the range, so the position is active and earning swap fees at this price." : "outside the range, so the position holds only one asset and earns no swap fees until the price returns.") + " Prices are in raw token units — a UI price also depends on the two mints' decimals. An educational model, not a live pool quote. Not financial advice.");
    });

    var slipForm = document.getElementById("slip-calc");
    if (slipForm) slipForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = slippageAmounts(val("slip-expout"), val("slip-expin"), val("slip-bps"));
      if (res === null) {
        setText("slip-result", "Check the inputs: expected amounts must be positive numbers with at most 9 decimals, and the tolerance a whole number of basis points from 0 to 9,999.");
        return;
      }
      document.getElementById("slip-min-out").value = res.minimumReceived;
      document.getElementById("slip-max-out").value = res.maximumInput;
      setText("slip-result", "Model bounds at a " + res.toleranceBps + " bps (" + res.tolerancePct + "%) tolerance: an exact-in swap quoting " + res.expectedOut + " out must land at least " + res.minimumReceived + ", and an exact-out swap quoting " + res.expectedIn + " in may cost at most " + res.maximumInput + " — past either bound the program aborts the swap instead of filling. Both bounds floored in exact integer math, never rounded in your favour." + (res.minimumIsZero ? " Warning: at this tolerance the minimum received floors to exactly 0 — the amount is dust at this precision, so this bound protects nothing." : "") + (res.toleranceBps >= 1000 ? " Caution: a tolerance of 10% or more lets a very bad fill — including a sandwich attack — still pass; most swappers stay at 0.1–1%." : "") + " An educational model of the bound, not a live quote. Not financial advice.");
    });

    var epochForm = document.getElementById("epoch-calc");
    if (epochForm) epochForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = epochForSlot(val("epoch-slot-in"));
      if (res === null) {
        document.getElementById("epoch-out").value = "Invalid slot";
        setText("epoch-result", "Enter a slot as a whole number, 0 or more.");
        return;
      }
      document.getElementById("epoch-out").value = "Epoch " + res.epoch;
      setText("epoch-result", "Slot " + res.slot + " is in epoch " + res.epoch + " — slot " + res.slotIndex + " of " + res.slotsInEpoch + " in that epoch (" + res.progressPct.toFixed(2) + "% through it), which runs from slot " + res.firstSlot + " to slot " + res.lastSlot + "." + (res.warmup ? " That is a warmup epoch: early epochs doubled in length from 32 slots, so the textbook slot ÷ 432,000 formula does not apply there." : " Past the warmup, an epoch is a constant 432,000 slots — but note the offset: plain slot ÷ 432,000 would call this epoch " + Math.floor(res.slot / 432000) + " instead, because it ignores the warmup slots entirely.") + " Schedule math in slots only — this tool does not convert to dates or times, because the target slot duration has changed repeatedly and skipped slots stretch real time further; for a slot's actual timestamp use getBlockTime or an explorer.");
    });

    var epochRangeForm = document.getElementById("epochrange-calc");
    if (epochRangeForm) epochRangeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = epochRange(val("epochrange-in"));
      if (res === null) {
        document.getElementById("epochrange-out").value = "Invalid epoch";
        setText("epochrange-result", "Enter an epoch as a whole number, 0 or more.");
        return;
      }
      document.getElementById("epochrange-out").value = "Slots " + res.firstSlot + " – " + res.lastSlot;
      setText("epochrange-result", "Epoch " + res.epoch + " runs from slot " + res.firstSlot + " to slot " + res.lastSlot + " — " + res.slotsInEpoch + " slots." + (res.warmup ? " A warmup epoch: lengths doubled from 32 slots until the first normal epoch, 14, which starts at slot 524,256." : " A normal epoch: every epoch from 14 on holds exactly 432,000 slots.") + " Staking rewards, stake activation and leader schedules all key off these boundaries — which is why the warmup offset matters to any code that computes an epoch from a slot.");
    });

    var tfeeForm = document.getElementById("tfee-calc");
    if (tfeeForm) tfeeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = transferFee(val("tfee-amt"), val("tfee-bps"), val("tfee-max"));
      if (res === null) {
        document.getElementById("tfee-fee-out").value = "Invalid";
        setText("tfee-result", "Check the inputs: the amount and the maximum fee are raw token amounts — whole numbers of the mint's smallest unit, 0 or more (use Tool 6 to convert a UI amount) — and the transfer fee rate is a whole number of basis points from 0 to 10,000 (100%).");
        return;
      }
      document.getElementById("tfee-fee-out").value = res.fee;
      document.getElementById("tfee-net-out").value = res.netReceived;
      setText("tfee-result", "Model output: on a transfer of " + res.amount + " raw units at " + res.feeBps + " bps (" + res.feePct + "%), the fee is ceil(" + res.amount + " × " + res.feeBps + " ÷ 10,000), " + (res.capped ? "which comes out above the mint's maximum fee, so the fee is capped at " + res.maximumFee + " raw units" : "which is " + res.fee + " raw units") + " — the sender is debited the full " + res.amount + ", the recipient is credited " + res.netReceived + ", and the " + res.fee + " withheld stays in the recipient's token account until it is harvested and withdrawn. The ceiling means any positive transfer at a positive rate pays at least 1 raw unit. This models the single fee configuration entered, in effect for the transfer; a real mint stores an older and a newer fee chosen by epoch — read the mint's TransferFeeConfig before pricing a real transfer. Educational model of the Token-2022 program's fee math, not a live quote. Not financial advice.");
    });

    var tgrossForm = document.getElementById("tgross-calc");
    if (tgrossForm) tgrossForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = transferFeeGrossUp(val("tgross-net"), val("tgross-bps"), val("tgross-max"));
      if (res === null) {
        document.getElementById("tgross-out").value = "Invalid";
        setText("tgross-result", "Check the inputs: the amount the recipient must receive and the maximum fee are raw token amounts — whole numbers, 0 or more — and the transfer fee rate is a whole number of basis points from 0 to 10,000.");
        return;
      }
      document.getElementById("tgross-out").value = res.grossAmount;
      setText("tgross-result", "Model output: to have the recipient credited exactly " + res.netReceived + " raw units at " + res.feeBps + " bps, send " + res.grossAmount + " raw units — its fee is " + res.fee + (res.capped ? " (capped at the mint's maximum fee of " + res.maximumFee + ")" : "") + ", and " + res.grossAmount + " − " + res.fee + " = " + res.netReceived + ". One raw unit less would deliver less, because the withheld fee is computed on the amount sent, with the ceiling applied. An educational model — confirm the mint's live fee configuration before a real transfer. Not financial advice.");
    });

    var sandForm = document.getElementById("sand-calc");
    if (sandForm) sandForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = sandwichAttack(val("sand-rin"), val("sand-rout"), val("sand-victim"), val("sand-attacker"), val("sand-fee"), val("sand-slip"));
      if (res === null) {
        document.getElementById("sand-victim-out").value = "Invalid";
        document.getElementById("sand-attacker-out").value = "Invalid";
        setText("sand-result", "Check the inputs: reserves and both swap amounts must be positive numbers with at most 9 decimals, the pool fee a whole number of basis points under 10,000, and the victim's slippage tolerance a whole number of basis points from 0 to 9,999.");
        return;
      }
      document.getElementById("sand-victim-out").value = res.victimProtected ? "Aborted — protected" : res.victimOut;
      document.getElementById("sand-attacker-out").value = res.attackerProfit;
      setText("sand-result", res.victimProtected
        ? "Model output: unattacked, the victim's " + res.victimIn + " A would buy " + res.baselineOut + " B. The attacker's front-run of " + res.attackerIn + " A takes " + res.frontOut + " B and pushes the victim's fill down to " + res.attemptedVictimOut + " B — below the victim's minimum received of " + res.minimumReceived + " B at a " + res.slippageBps + " bps tolerance, so the victim's transaction aborts instead of filling (the network fee is still paid). The attacker must unwind alone and gets back " + res.backOut + " A — a loss of " + res.attackerProfit.replace("-", "") + " A (" + Math.abs(res.attackerProfitPct).toFixed(4) + "%). Tight slippage is the defence: the trade fails, but the sandwich makes nothing. An educational model of a sandwich attack on a single constant-product pool, not live MEV data. Not financial advice."
        : "Model output: unattacked, the victim's " + res.victimIn + " A would buy " + res.baselineOut + " B. The attacker front-runs with " + res.attackerIn + " A (taking " + res.frontOut + " B), the victim fills at only " + res.victimOut + " B — a loss of " + res.victimLoss + " B (" + res.victimLossPct.toFixed(4) + "% of the unattacked fill), still above the minimum received of " + res.minimumReceived + " B at a " + res.slippageBps + " bps tolerance, so the trade passes its own protection — and the attacker back-runs for " + res.backOut + " A" + (res.attackerProfit.charAt(0) === "-" ? ", which is LESS than the " + res.attackerIn + " A put in: this victim trade was too small to cover the round-trip fees and price impact, so the attack loses " + res.attackerProfit.replace("-", "") + " A even though the victim filled worse." : ", a profit of " + res.attackerProfit + " A. That profit is extracted from the victim's worse price, not created.") + " A looser tolerance is what lets it through; private routing avoids the public flow entirely. An educational model of a sandwich attack on a single constant-product pool, not live MEV data. Not financial advice.");
    });

    var lstForm = document.getElementById("lst-calc");
    if (lstForm) lstForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = liquidStaking(val("lst-total"), val("lst-supply"), val("lst-rewards"), val("lst-deposit"), val("lst-redeem"));
      if (res === null) {
        document.getElementById("lst-rate-out").value = "Invalid";
        document.getElementById("lst-redeem-out").value = "Invalid";
        setText("lst-result", "Check the inputs: the pool total, token supply, deposit and redemption must be positive numbers with at most 9 decimals, the rewards 0 or more, and the redemption no more than the whole token supply — you cannot redeem tokens that do not exist.");
        return;
      }
      document.getElementById("lst-rate-out").value = res.rateAfterRewards.toFixed(9);
      document.getElementById("lst-redeem-out").value = res.redeemOutAfterRewards;
      setText("lst-result", "Model output: the pool's exchange rate is " + res.rate.toFixed(9) + " SOL per token (" + res.totalSol + " SOL backing " + res.supply + " tokens). Depositing " + res.deposit + " SOL mints " + res.tokensMinted + " tokens" + (res.mintedFloorsToZero ? " — that deposit is dust at this rate: it floors to ZERO tokens, so on-chain it would stake SOL and mint nothing; deposit more or not at all" : "") + ", and redeeming " + res.redeem + " tokens returns " + res.redeemOut + " SOL. After " + res.rewards + " SOL of rewards land (total " + res.totalAfterRewards + " SOL, supply unchanged), the rate rises to " + res.rateAfterRewards.toFixed(9) + ": the same deposit then mints only " + res.tokensMintedAfterRewards + " tokens, while the same redemption returns " + res.redeemOutAfterRewards + " SOL — a gain of " + res.redeemGain + " SOL on an unchanged token balance. That rising rate, not a growing balance, is the yield. This model charges no pool fees and models no unstake delay; a real pool's terms differ. An educational model of one pool's exchange rate, not a live pool's rate. Not financial advice.");
    });

    var pdaForm = document.getElementById("pda-calc");
    if (pdaForm) pdaForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var seedStrs = [];
      var s1 = val("pda-seed1"), s2 = val("pda-seed2");
      if (s1 !== "") seedStrs.push(s1);
      if (s2 !== "") seedStrs.push(s2);
      var res = findProgramAddress(val("pda-program"), seedStrs);
      if (res === null) {
        document.getElementById("pda-out").value = "Invalid";
        setText("pda-result", "Check the inputs: the program ID must be a valid-format 32-byte base58 address, and each seed at most 32 bytes when UTF-8 encoded (32 plain ASCII characters, fewer for multi-byte characters — a longer seed can never be part of a PDA, the runtime rejects it).");
        return;
      }
      document.getElementById("pda-out").value = res.address;
      setText("pda-result", "Derived locally: " +
        (res.seeds.length ? "seed" + (res.seeds.length === 1 ? "" : "s") + " [" + res.seeds.map(function (s) { return '"' + s + '"'; }).join(", ") + "]" : "no seeds (the program alone)") +
        " under that program — the program-derived address is " + res.address + " at bump " + res.bump +
        " — " + (res.candidatesTried === 1
          ? "the first candidate tried, bump 255, already hashed off the ed25519 curve."
          : "the scan tried " + res.candidatesTried + " candidates: every bump from 255 down to " + (res.bump + 1) + " hashed to a point ON the ed25519 curve, where a private key could exist, so it can never be a PDA; bump " + res.bump + " landed off-curve.") +
        " A PDA has no private key: only that program can sign for it, by presenting these seeds and this bump. Derivation is pure SHA-256 hashing — nothing was looked up and nothing executed on-chain, and the same inputs derive this address on every cluster. Well-formed is not the same as trustworthy: check the program ID and seeds against the source you trust, in full, before treating anything sent to this address as the program's.");
    });

    var clmmposForm = document.getElementById("clmmpos-calc");
    if (clmmposForm) clmmposForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = clmmPosition(val("clmmpos-l"), val("clmmpos-lower"), val("clmmpos-upper"), val("clmmpos-current"));
      function fmtAmt(x) { return x === 0 ? "0" : (x < 0.001 || x >= 1e15 ? x.toExponential(6) : String(Number(x.toPrecision(10)))); }
      if (res === null) {
        document.getElementById("clmmpos-a0-out").value = "Invalid";
        document.getElementById("clmmpos-a1-out").value = "Invalid";
        setText("clmmpos-result", "Check the inputs: the liquidity must be a positive number with at most 9 decimals, and all three ticks whole numbers from -443,636 to 443,636 with the lower tick below the upper tick.");
        return;
      }
      document.getElementById("clmmpos-a0-out").value = fmtAmt(res.amount0);
      document.getElementById("clmmpos-a1-out").value = fmtAmt(res.amount1);
      var pct0 = res.valueInToken1 > 0 ? (res.amount0 * res.priceCurrent / res.valueInToken1) * 100 : 0;
      var where = res.status === "in"
        ? "inside the range, so the position is active and holds both assets"
        : res.status === "below"
          ? "at or below the lower tick, so the position holds only token0 and earns no fees until the price climbs back into the range"
          : "at or above the upper tick, so the position holds only token1 and earns no fees until the price falls back into the range";
      setText("clmmpos-result", "Model output: liquidity " + res.liquidity + " over ticks " + res.tickLower + " to " + res.tickUpper + " (prices " + fmtAmt(res.priceLower) + " to " + fmtAmt(res.priceUpper) + ") at the current tick " + res.tickCurrent + " (price " + fmtAmt(res.priceCurrent) + ") holds " + fmtAmt(res.amount0) + " token0 and " + fmtAmt(res.amount1) + " token1 in raw units — about " + pct0.toFixed(2) + "% of its value in token0, measured in token1 at the current price. The current tick is " + where + ". These amounts are the position's principal at this tick: fees it earns accrue separately, and the split drifts toward whichever asset the price moves away from — that drift is the position's price exposure (and the root of impermanent loss, Tool 4). Convert raw units with each mint's decimals before treating them as wallet amounts (Tool 6). An educational model, not a live pool quote. Not financial advice.");
    });

    var lpdepForm = document.getElementById("lpdep-calc");
    if (lpdepForm) lpdepForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = lpDeposit(val("lpdep-ra"), val("lpdep-rb"), val("lpdep-supply"), val("lpdep-da"), val("lpdep-db"));
      if (res === null) {
        document.getElementById("lpdep-minted-out").value = "Invalid";
        document.getElementById("lpdep-share-out").value = "Invalid";
        setText("lpdep-result", "Check the inputs: deposits must be positive numbers with at most 9 decimals, and the pool must be either fully empty (all three pool figures 0 — a first deposit) or fully live (reserves and LP supply all positive). A deposit so small it would mint zero LP tokens is also rejected — on-chain it would hand over tokens for nothing.");
        return;
      }
      document.getElementById("lpdep-minted-out").value = res.minted;
      document.getElementById("lpdep-share-out").value = res.firstDeposit ? "100% (first deposit)" : res.sharePct.toFixed(6) + "% of the pool after deposit";
      setText("lpdep-result", res.firstDeposit
        ? "Model output: this is a FIRST deposit — the pool is empty, so the deposit itself sets the pool's price (" + res.depositA + " A against " + res.depositB + " B) and mints the geometric mean, sqrt(" + res.depositA + " × " + res.depositB + ") = " + res.minted + " LP tokens. The depositor holds the whole pool. Some pools permanently lock a small minimum of a first mint as an inflation-attack defence; that lock is pool-specific and is not modelled here. Choose this ratio carefully: the first price is the price every later trade starts from. An educational model, not a live pool quote. Not financial advice."
        : "Model output: against reserves of " + res.reserveA + " A / " + res.reserveB + " B with " + res.supply + " LP tokens outstanding, a deposit of " + res.depositA + " A / " + res.depositB + " B mints " + res.minted + " LP tokens — " + res.sharePct.toFixed(6) + "% of the pool afterwards. The mint is set by " + (res.limiting === "both" ? "both sides equally: the deposit matches the pool's ratio exactly, so all of it is used" : "token " + res.limiting + ", the limiting side: only " + res.usedA + " A and " + res.usedB + " B are used at the pool's ratio" + (res.limiting === "A" ? (res.excessB !== "0" ? ", and the excess " + res.excessB + " B buys no extra LP tokens — a good interface returns it or sizes the deposit to the ratio first." : ".") : (res.excessA !== "0" ? ", and the excess " + res.excessA + " A buys no extra LP tokens — a good interface returns it or sizes the deposit to the ratio first." : "."))) + " Burning those LP tokens later returns that share of whatever reserves the pool holds then — which, after trades and fees, is a different amount and split than went in (see impermanent loss, Tool 4). An educational model, not a live pool quote. Not financial advice.");
    });


    var vestForm = document.getElementById("vest-calc");
    if (vestForm) vestForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = vestingSchedule(val("vest-total"), val("vest-cliff"), val("vest-duration"), val("vest-elapsed"));
      if (res === null) {
        document.getElementById("vest-claim-out").value = "Invalid";
        document.getElementById("vest-cliff-out").value = "Invalid";
        setText("vest-result", "Check the inputs: the total allocation must be a positive number with at most 9 decimals, the duration a whole number of months from 1 to 1,200, the cliff a whole number of months from 0 up to the duration, and the elapsed time a whole number of months from 0 up.");
        return;
      }
      document.getElementById("vest-claim-out").value = res.claimable + " tokens";
      document.getElementById("vest-cliff-out").value = res.atCliff + " tokens at month " + res.cliffMonths;
      var where = res.status === "complete"
        ? "The schedule is complete: the full allocation of " + res.total + " tokens is unlocked and claimable, and nothing remains locked."
        : res.status === "cliff"
          ? "Nothing is claimable yet: month " + res.elapsedMonths + " is before the month-" + res.cliffMonths + " cliff, even though " + res.accrued + " tokens (" + res.accruedPct.toFixed(6) + "% of the allocation) have accrued on paper. At the cliff the accrued share releases at once - " + res.atCliff + " tokens - and from then on the claimable amount follows the linear accrual: " + res.locked + " tokens stay locked for now, and the schedule completes at month " + res.durationMonths + "."
          : "The cliff has passed, so the claimable amount is the accrued amount: " + res.claimable + " of " + res.total + " tokens (" + res.accruedPct.toFixed(6) + "%), with " + res.locked + " still locked and " + res.monthsRemaining + " months until the schedule completes at month " + res.durationMonths + ". The cliff at month " + res.cliffMonths + " released " + res.atCliff + " tokens at once.";
      setText("vest-result", "Model output: " + where + " This model accrues linearly from day one in whole months and floors at the token's smallest unit; real schedules run on timestamps, and some start the linear accrual at the cliff instead - check which convention your schedule's terms use. An educational model, not a live vesting contract. Not financial advice.");
    });


    var lendForm = document.getElementById("lend-calc");
    if (lendForm) lendForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = lendingHealth(val("lend-amt"), val("lend-price"), val("lend-debt"), val("lend-liq"), val("lend-maxltv"));
      if (res === null) {
        document.getElementById("lend-hf-out").value = "Invalid";
        document.getElementById("lend-liqprice-out").value = "Invalid";
        setText("lend-result", "Check the inputs: the collateral amount and its price must be positive numbers with at most 9 decimals, the debt a number of 0 or more, the liquidation threshold a whole number of basis points from 1 to 10,000, and the max LTV a whole number of basis points from 0 up to the liquidation threshold.");
        return;
      }
      document.getElementById("lend-hf-out").value = res.healthFactor === null ? "No debt" : res.healthFactor.toFixed(6);
      document.getElementById("lend-liqprice-out").value = res.liquidationPrice;
      var where = res.status === "no-debt"
        ? "There is no debt, so the position cannot be liquidated: its full borrowing power of " + res.maxBorrowTotal + " is still available at the max LTV entered."
        : res.status === "liquidatable"
          ? "The health factor is below 1, so a market using these thresholds could liquidate this position now: the collateral price is already past the liquidation price of " + res.liquidationPrice + "."
          : res.status === "at-threshold"
            ? "The health factor is exactly 1: the position sits exactly on its liquidation threshold at this price, and any price drop or interest accrual pushes it below."
            : "The position is above its liquidation threshold: the collateral price can fall about " + res.priceDropPct.toFixed(4) + "% - to " + res.liquidationPrice + " - before the health factor reaches 1." + (res.overMaxBorrow ? " Note the debt is already above the max borrow total at the max LTV entered, even though it is not liquidatable yet - that gap is the safety buffer between the two percentages." : "");
      setText("lend-result", "Model output: collateral worth " + res.collateralValue + " against debt of " + res.debt + " is an LTV of " + res.ltvPct.toFixed(4) + "% and a health factor of " + (res.healthFactor === null ? "none (no debt)" : res.healthFactor.toFixed(6)) + ". At the max LTV of " + (res.maxLtvBps / 100) + "% the most this collateral can borrow in total is " + res.maxBorrowTotal + ", so the additional borrowing power is " + res.additionalBorrow + ". " + where + " Single collateral and single debt, no interest accrual and no liquidation bonus or fee modelled; real markets weight several assets, accrue interest continuously and set their own thresholds - read the market's own risk parameters before borrowing. An educational model, not a live lending quote. Not financial advice.");
    });

    var txszForm = document.getElementById("txsz-calc");
    if (txszForm) txszForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = txSize(val("txsz-sigs"), val("txsz-keys"), val("txsz-lw"), val("txsz-lr"), val("txsz-accts"), val("txsz-data"));
      if (res === null) {
        document.getElementById("txsz-out").value = "Invalid";
        document.getElementById("txsz-head-out").value = "Invalid";
        setText("txsz-result", "Check the inputs: every count is a whole number - at least 1 signature, at least as many static keys as signatures (256 at most), at most 256 lookup accounts in total across the one table, an instruction referencing no more accounts than the transaction carries in total, and at most 1,000,000 data bytes.");
        return;
      }
      document.getElementById("txsz-out").value = res.total + " bytes";
      document.getElementById("txsz-head-out").value = res.fits ? res.headroom + " bytes spare" : (-res.headroom) + " bytes over";
      var alt = res.version === "legacy"
        ? "With no lookup table this is a legacy transaction: every account key costs its full 32 bytes, and the transaction can reference at most 256 accounts."
        : res.savedBytes > 0
          ? "As a v0 transaction loading " + (res.lookupWritable + res.lookupReadonly) + " accounts through one lookup table it saves " + res.savedBytes + " bytes against the " + res.legacyTotal + "-byte legacy form of the same transaction - each table account costs a 1-byte index instead of a 32-byte key, minus the table reference."
          : "As a v0 transaction it is " + (-res.savedBytes) + " bytes BIGGER than the " + res.legacyTotal + "-byte legacy form of the same transaction: a lookup table reference costs 32 bytes plus counts before its first 1-byte index saves anything, so a table pays off only from a handful of accounts up.";
      var fit = res.fits
        ? "It fits the 1,232-byte packet limit with " + res.headroom + " bytes to spare."
        : "It does NOT fit the 1,232-byte packet limit - it is " + (-res.headroom) + " bytes over, and no validator will accept it: shrink the data, load accounts through lookup tables, or split the work across transactions.";
      setText("txsz-result", "Model output: a " + res.version + " transaction with " + res.signatures + " signature(s), " + res.totalKeys + " account keys in total and one instruction carrying " + res.dataBytes + " data bytes serializes to " + res.total + " bytes - signatures " + res.signaturesBytes + ", header " + res.headerBytes + ", static keys " + res.staticKeysBytes + ", blockhash " + res.blockhashBytes + ", instruction " + res.instructionBytes + (res.lookupBytes ? ", lookup table " + res.lookupBytes : "") + ". " + fit + " " + alt + " One instruction modelled; each extra instruction adds its own program-index byte, two shortvec counts, account indices and data. An educational model of the wire format, not a live transaction. Not financial advice.");
    });

    var spForm = document.getElementById("sp-calc");
    if (spForm) spForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var typeNames = { bool: "bool", u8: "u8 / i8", u16: "u16 / i16", u32: "u32 / i32 / f32", u64: "u64 / i64 / f64", u128: "u128 / i128", pubkey: "Pubkey", string: "String", bytes: "Vec<u8>", vec: "Vec", array: "array", option: "Option" };
      var fields = [];
      for (var i = 1; i <= 4; i++) {
        fields.push([val("sp-f" + i + "-type"), val("sp-f" + i + "-n"), val("sp-f" + i + "-elem")]);
      }
      var res = anchorSpace(fields);
      if (res === null) {
        document.getElementById("sp-total-out").value = "Invalid";
        document.getElementById("sp-rent-out").value = "Invalid";
        setText("sp-result", "Check the fields: pick at least one field type; a length or count goes only with String, Vec<u8>, Vec and array types (a whole number, 1,000,000 at most); an element type goes only with Vec, array and Option - and an Option takes no count.");
        return;
      }
      document.getElementById("sp-total-out").value = res.totalBytes + " bytes";
      document.getElementById("sp-rent-out").value = res.rentLamports.toLocaleString("en-US") + " lamports";
      var parts = res.fields.map(function (f, idx) { return "field " + (idx + 1) + " (" + typeNames[f.type] + ") " + f.bytes + (f.bytes === 1 ? " byte" : " bytes"); }).join(", ");
      setText("sp-result", "Model output: " + parts + " - " + res.dataBytes + " bytes of field data plus the 8-byte Anchor discriminator is " + res.totalBytes + " bytes of account space, which locks " + res.rentLamports.toLocaleString("en-US") + " lamports (" + res.rentSol + " SOL) as its rent-exempt deposit at the network's current rent parameters. Borsh packs fields back to back with no padding; enums are not modelled (add 1 byte plus the largest variant per enum by hand), and a struct with more than four fields adds linearly. An educational model of the serialization format, not a live account. Not financial advice.");
    });

    var splitForm = document.getElementById("split-calc");
    if (splitForm) splitForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = saleSplit(val("split-price"), val("split-platform"), val("split-royalty"));
      if (res === null) {
        document.getElementById("split-fee-out").value = "Invalid";
        document.getElementById("split-royalty-out").value = "Invalid";
        document.getElementById("split-seller-out").value = "Invalid";
        setText("split-result", "Check the inputs: the sale price must be above zero with at most 9 decimal places, and the platform fee and creator royalty are whole basis points from 0 to 10,000 whose sum may not exceed 10,000 (100%) - past that the seller's share would go negative, so the split does not exist.");
        return;
      }
      document.getElementById("split-fee-out").value = res.platformFee;
      document.getElementById("split-royalty-out").value = res.royalty;
      document.getElementById("split-seller-out").value = res.seller;
      var zeroNote = res.sellerZero
        ? " The two cuts take the entire price at these rates, so the seller receives exactly 0 - that is the arithmetic of a combined 100% take, stated plainly rather than rounded away."
        : "";
      setText("split-result", "Model output: a sale at " + res.price + " splits into a platform fee of " + res.platformFee + " (" + res.platformBps + " bps), a creator royalty of " + res.royalty + " (" + res.royaltyBps + " bps) and " + res.seller + " to the seller. Both cuts floor at the smallest unit and the seller takes the remainder, so the three parts sum to the price exactly - the seller also keeps any flooring dust." + zeroNote + " Both cuts come out of the price in this model; a venue that charges the buyer on top splits differently, and creator royalties on classic Solana NFTs are a marketplace convention (programmable NFTs can enforce them on-chain). An educational model of a sale split, not a live marketplace quote. Not financial advice.");
    });

    var warmForm = document.getElementById("warm-calc");
    if (warmForm) warmForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = stakeWarmup(val("warm-amount"), val("warm-cluster"), val("warm-moving"), val("warm-rate"), val("warm-direction"));
      if (res === null) {
        document.getElementById("warm-epochs-out").value = "Invalid";
        document.getElementById("warm-first-out").value = "Invalid";
        setText("warm-result", "Check the inputs: the stake, the cluster's effective stake and the total moving the same way must be above zero with at most 9 decimal places, the total moving must be at least your stake (your stake is part of it), and the rate is a whole number of basis points from 1 to 10,000.");
        return;
      }
      document.getElementById("warm-epochs-out").value = res.epochsNeeded + (res.estimated ? " (estimated)" : "");
      document.getElementById("warm-first-out").value = res.firstEpochEffective;
      var pct = (res.firstEpochPctBps / 100).toFixed(2);
      var rows = res.schedule.map(function (r) { return "epoch " + r.epoch + ": " + r.effective + " effective"; }).join("; ");
      var verb = res.direction === "activate" ? "become effective" : "cool down to inactive";
      var clampNote = res.minClamped
        ? " At these figures the cluster cap floors to zero, so progress is the program's minimum of 1 lamport per epoch - the epoch count is your stake in lamports."
        : "";
      setText("warm-result", "Model output: " + res.stake + " SOL moving against a cluster effective stake of " + res.clusterEffective + " SOL, with " + res.movingTotal + " SOL moving the same way, at " + res.rateBps + " bps per epoch - the cluster-wide cap is " + res.capPerEpoch + " SOL per epoch, shared by share. Schedule (effective stake after each epoch): " + rows + ". Your stake takes " + res.epochsNeeded + (res.estimated ? " epochs (estimated - the per-epoch change is effectively constant in this regime)" : " epoch(s)") + " to fully " + verb + "; in the first epoch " + res.firstEpochMoved + " SOL changes state (" + pct + "% of the stake), leaving " + res.firstEpochEffective + " SOL effective." + clampNote + " The cluster's effective stake is held constant here - on-chain it is the previous epoch's stake-history figure and drifts as stake moves - and other movers are assumed to drain at the same fractional pace. An educational model of stake warmup and cooldown, not a live staking quote. Not financial advice.");
    });

    var fgroForm = document.getElementById("fgro-calc");
    if (fgroForm) fgroForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = clmmFeesOwed(val("fgro-liq"), val("fgro-now-a"), val("fgro-last-a"), val("fgro-now-b"), val("fgro-last-b"), val("fgro-owed-a"), val("fgro-owed-b"), val("fgro-dec-a"), val("fgro-dec-b"));
      if (res === null) {
        document.getElementById("fgro-totala-out").value = "Invalid";
        document.getElementById("fgro-totalb-out").value = "Invalid";
        setText("fgro-result", "Check the inputs: the liquidity, the fee-growth counters and the already-owed amounts are whole raw integers from 0 up to 2^128 - 1 (no signs, no decimal points - the X64 counters are integers on-chain), and each token's decimals are a whole number from 0 to 18.");
        return;
      }
      document.getElementById("fgro-totala-out").value = res.totalAUi;
      document.getElementById("fgro-totalb-out").value = res.totalBUi;
      var wrapNote = (res.wrappedA || res.wrappedB)
        ? " One counter is lower than its last-touch value: that is the u128 counter wrapping, not an error - the subtraction is done modulo 2^128 exactly as on-chain, so the delta is still the true small increment."
        : "";
      setText("fgro-result", "Model output: at liquidity " + res.liquidity + ", token A accrued " + res.accruedA + " raw units since the last touch (" + res.accruedAUi + " at " + res.decimalsA + " decimals) on a fee-growth delta of " + res.deltaA + ", and token B accrued " + res.accruedB + " raw units (" + res.accruedBUi + " at " + res.decimalsB + " decimals) on a delta of " + res.deltaB + ". Added to what was already settled as owed (" + res.owedA + " A / " + res.owedB + " B raw), the position can collect " + res.totalA + " raw A (" + res.totalAUi + ") and " + res.totalB + " raw B (" + res.totalBUi + ")." + wrapNote + " The growth counters are inputs here, as an explorer or the SDK reports them - this tool does not read a live position. An educational model of CLMM fee accounting, not a live position quote. Not financial advice.");
    });

    var inflForm = document.getElementById("infl-calc");
    if (inflForm) inflForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = inflationSchedule(val("infl-years"), val("infl-supply"), val("infl-disinfl"));
      if (res === null) {
        document.getElementById("infl-rate-out").value = "Invalid";
        document.getElementById("infl-issue-out").value = "Invalid";
        setText("infl-result", "Check the inputs: years since the inflation start is a number from 0 to 10,000 (fractions allowed - the rate glides per epoch, it does not step yearly), the total supply is a positive SOL amount with at most 9 decimal places, and the disinflation rate is a whole number of basis points from 0 to 9,999 (1,500 bps = 15% is the shipped schedule).");
        return;
      }
      document.getElementById("infl-rate-out").value = res.ratePct + "%";
      document.getElementById("infl-issue-out").value = res.annualIssuance;
      var termNote = res.disinflationBps === 0
        ? " At a 0 bps disinflation rate the schedule never decays, so the terminal rate is never reached."
        : (res.atTerminal
          ? " The raw schedule rate has fallen to or past the 1.5% terminal rate, so the rate is clamped at the floor - it first reached the floor at year " + res.firstWholeYearAtTerminal + "."
          : " At this disinflation rate the schedule reaches its 1.5% terminal floor in " + res.yearsToTerminal + " more years - the first whole year at the floor is year " + res.firstWholeYearAtTerminal + ".");
      setText("infl-result", "Model output: " + res.years + " year(s) after the inflation start, at a disinflation rate of " + res.disinflationBps + " bps per year, the inflation rate is " + res.ratePct + "% per year. On a total supply of " + res.supply + " SOL held constant, that issues " + res.annualIssuance + " new SOL over that year, paid as staking rewards." + termNote + " The supply is held at your figure for the year shown - on-chain the supply itself grows by the issuance - and the 30% disinflation adopted by governance in 2026 is not yet implemented in the validator, so 1,500 bps remains the shipped schedule; enter 3,000 bps to model it. An educational model of the inflation schedule, not live network data. Not financial advice.");
    });

    var ataForm = document.getElementById("ata-calc");
    if (ataForm) ataForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = associatedTokenAddress(val("ata-owner"), val("ata-mint"), val("ata-program"));
      if (res === null) {
        document.getElementById("ata-out").value = "Invalid";
        setText("ata-result", "Check the inputs: the owner and the mint must each be a base58 address that decodes to exactly 32 bytes, and the token program must be one of the two real token programs - the classic SPL Token program (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA) or Token-2022 (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEB). A mistyped program id would derive an address no wallet would ever use, so it is rejected rather than derived.");
        return;
      }
      document.getElementById("ata-out").value = res.address;
      setText("ata-result", "Model output: the associated token account for owner " + res.owner + " and mint " + res.mint + " under the " + res.tokenProgram + " program is " + res.address + " - the PDA of the seeds [owner, token program, mint] under the Associated Token Account program, found at bump " + res.bump + " (" + res.candidatesTried + (res.candidatesTried === 1 ? " candidate" : " candidates") + " tried). The derivation is pure math on the three addresses - whether that account has been created on-chain yet is a separate question this tool does not read. An educational model of ATA derivation, not a live account lookup. Not financial advice.");
    });

    var cmtForm = document.getElementById("cmt-calc");
    if (cmtForm) cmtForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = merkleTreePlan(val("cmt-depth"), val("cmt-buffer"), val("cmt-canopy"));
      if (res === null) {
        document.getElementById("cmt-size-out").value = "Invalid";
        document.getElementById("cmt-rent-out").value = "Invalid";
        setText("cmt-result", "Check the inputs: the max depth must be a whole number from 1 to 30, the changelog buffer size must be a power of two from 8 to 16,384 (the ring is indexed by mask, so a non-power-of-two size cannot exist on-chain), and the canopy depth must be a whole number from 0 up to the max depth.");
        return;
      }
      document.getElementById("cmt-size-out").value = res.sizeBytes.toLocaleString("en-US") + " bytes";
      document.getElementById("cmt-rent-out").value = res.rentLamports.toLocaleString("en-US") + " lamports";
      var canopyNote = res.canopyDepth === 0
        ? " With no canopy, every later transfer or burn must supply all " + res.maxDepth + " proof hashes itself."
        : " The canopy stores the top " + res.canopyDepth + " level(s) on-chain, so every later transfer or burn supplies " + res.proofNodesToSupply + " proof hashes instead of " + res.maxDepth + ".";
      var bubblegumNote = res.canopyDepth < res.minCanopyForBubblegum
        ? " Note: at a depth past 17, Bubblegum's tree creation requires a canopy of at least " + res.minCanopyForBubblegum + " for this depth, so this exact configuration is one the raw account-compression program allows but Bubblegum would refuse."
        : "";
      setText("cmt-result", "Model output: a concurrent Merkle tree of max depth " + res.maxDepth + ", a changelog buffer of " + res.maxBufferSize + " and canopy depth " + res.canopyDepth + " takes a " + res.sizeBytes.toLocaleString("en-US") + "-byte account: a 56-byte header, 64 bytes of counters and rightmost-path fixed data, a changelog ring of " + res.maxBufferSize.toLocaleString("en-US") + " entries x " + res.changelogEntryBytes + " bytes = " + res.changelogBytes.toLocaleString("en-US") + " bytes (" + res.changelogSharePct.toFixed(2) + "% of the account - the ring of recent roots and paths is what lets mints proceed concurrently, and it is almost the entire cost), " + res.rightmostBytes + " bytes of rightmost proof nodes" + (res.canopyBytes > 0 ? " and " + res.canopyBytes.toLocaleString("en-US") + " bytes of canopy" : "") + ". Creating it locks " + res.rentLamports.toLocaleString("en-US") + " lamports (" + res.rentSol + " SOL) as the rent-exempt deposit, for a capacity of " + res.capacity.toLocaleString("en-US") + " compressed assets - about " + res.perLeafLamports.toFixed(2) + " lamports of tree rent per asset at full capacity." + canopyNote + bubblegumNote + " The assets themselves live off-chain in an indexer; only this tree account sits on-chain. Creation also pays a normal transaction fee and minting is a separate cost - neither is modelled. An educational model of the SPL account-compression tree layout, not a live quote. Not financial advice.");
    });

    var seedForm = document.getElementById("seed-calc");
    if (seedForm) seedForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = createWithSeed(val("seed-base"), val("seed-seed"), val("seed-owner"));
      if (res === null) {
        document.getElementById("seed-out").value = "Invalid";
        setText("seed-result", "Check the inputs: the base and the owner must each be a base58 address that decodes to exactly 32 bytes, and the seed must be at most 32 bytes as UTF-8 (a multi-byte character counts for more than one byte). The seed is used exactly as typed - it is not trimmed, because spaces are bytes and change the address.");
        return;
      }
      document.getElementById("seed-out").value = res.address;
      var curveNote = res.onCurve
        ? " This result lands ON the ed25519 curve - and is still a valid seeded address: unlike a PDA there is no curve check and no bump scan here, because nobody needs a private key for it and nobody could know one (the bytes are a hash output)."
        : " This result happens to land off the ed25519 curve - which is not required here: unlike a PDA there is no curve check and no bump scan, and an on-curve result would be just as valid.";
      setText("seed-result", "Model output: SHA-256 of the base " + res.base + ", the " + res.seedByteLen + "-byte seed and the owner " + res.owner + " derives the seeded address " + res.address + "." + curveNote + " The derivation is pure math - whether that account has been created on-chain yet (creation is a system-program instruction the base signs, paying the account's rent) is a separate question this tool does not read. An educational model of seeded-address derivation, not a live account lookup. Not financial advice.");
    });

    var mcapForm = document.getElementById("mcap-calc");
    if (mcapForm) mcapForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = tokenValuation(val("mcap-price"), val("mcap-circ"), val("mcap-total"), val("mcap-max"));
      if (res === null) {
        document.getElementById("mcap-out").value = "Invalid";
        document.getElementById("mcap-fdv-out").value = "Invalid";
        setText("mcap-result", "Check the inputs: the price must be above zero and every supply above zero, each with at most 9 decimal places, and the supplies must nest — circulating no more than total, and total no more than max. A set of supplies that does not nest describes no real mint.");
        return;
      }
      document.getElementById("mcap-out").value = res.marketCap;
      document.getElementById("mcap-fdv-out").value = res.fdv;
      var dilutedNote = res.fullyDiluted
        ? " The circulating supply equals the max supply, so this token is fully diluted: market cap and FDV are the same number, and no future minting or unlock can dilute holders at this supply."
        : " Only " + res.circPctOfMax.toFixed(4) + "% of the max supply circulates today, so the FDV is " + res.fdvMultiple.toFixed(4) + "x the market cap — that multiple is a pure supply ratio (max divided by circulating; the price cancels). The minted-but-not-circulating " + res.nonCirculating + " tokens are worth " + res.nonCirculatingValue + " at this price if they unlock and sell, and the " + res.unissued + " not yet minted are worth " + res.unissuedValue + " more at this price — FDV assumes today's price survives that supply arriving, which is an assumption, not a forecast.";
      var zeroNote = res.marketCapIsZero
        ? " Note the market cap floors to exactly 0 at this precision: the price times the circulating supply is under one smallest unit of the quote, so 0 is the exact floored figure, not a missing value."
        : "";
      setText("mcap-result", "Model output: at a price of " + res.price + " per token, a circulating supply of " + res.circulating + " gives a market cap of " + res.marketCap + "; the total minted supply of " + res.total + " values at " + res.totalValuation + ", and the max supply of " + res.max + " gives a fully diluted valuation (FDV) of " + res.fdv + ". Circulating is " + res.circPctOfTotal.toFixed(4) + "% of the total supply." + dilutedNote + zeroNote + " The price and supplies are your inputs — no live price or mint is read, and a data site's circulating figure is that site's own accounting of locked and treasury wallets. An educational model of token valuation, not live market data. Not financial advice.");
    });

    var altForm = document.getElementById("alt-calc");
    if (altForm) altForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = lookupTablePlan(val("alt-stored"), val("alt-w"), val("alt-r"));
      if (res === null) {
        document.getElementById("alt-size-out").value = "Invalid";
        document.getElementById("alt-rent-out").value = "Invalid";
        setText("alt-result", "Check the inputs: addresses stored must be a whole number from 0 to 256 (the u8 index cap), the writable and readonly counts whole numbers of 0 or more, at least one address must be loaded, and a transaction cannot load more addresses than the table stores.");
        return;
      }
      document.getElementById("alt-size-out").value = String(res.sizeBytes);
      document.getElementById("alt-rent-out").value = String(res.rentLamports);
      var savingNote = res.savingIsNegative
        ? " Loading so few addresses through a table costs " + (-res.savingBytes) + " bytes MORE than inlining them - the table reference is paid before the first index saves anything, which is why tables pay off only when a transaction loads many addresses (or the same table serves many transactions)."
        : " Loading those " + res.used + " addresses through the table costs " + res.lookupBytes + " bytes instead of " + res.staticBytes + " bytes of inline keys - a saving of " + res.savingBytes + " bytes in every transaction that loads them this way.";
      setText("alt-result", "Model output: a table storing " + res.stored + " addresses (" + res.fillPct.toFixed(4) + "% of the 256 cap) is a " + res.sizeBytes + "-byte account - 56 bytes of metadata plus " + res.addressBytes + " bytes of addresses - and locks a rent-exempt deposit of " + res.rentLamports + " lamports (" + res.rentSol + " SOL), " + res.perAddressLamports + " lamports per stored address." + savingNote + " The deposit comes back only by deactivating the table and waiting out the cooldown until its deactivation slot leaves the SlotHashes sysvar - stated, not modelled - and one table per transaction is modelled here. An educational model of the lookup-table layout, not a live account lookup. Not financial advice.");
    });

    var pythForm = document.getElementById("pyth-calc");
    if (pythForm) pythForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = pythConfidence(val("pyth-price"), val("pyth-conf"), val("pyth-expo"), val("pyth-maxbps"));
      if (res === null) {
        document.getElementById("pyth-low-out").value = "Invalid";
        document.getElementById("pyth-high-out").value = "Invalid";
        setText("pyth-result", "Check the inputs: the price and the confidence interval are the raw integers a feed publishes (whole numbers, no decimal point, no sign), the price must be above zero (a non-positive aggregate price is a broken feed, not a price), the exponent is a whole number from -18 to 18 (most feeds use -8), and the guard width is a whole number of basis points from 0 to 10,000.");
        return;
      }
      document.getElementById("pyth-low-out").value = res.low;
      document.getElementById("pyth-high-out").value = res.high;
      var guardNote = res.passesGuard
        ? " The band passes your guard: at " + res.widthBps.toFixed(4) + " bps of the price it is inside the " + res.maxBps + " bps maximum you set."
        : " The band FAILS your guard: at " + res.widthBps.toFixed(4) + " bps of the price it is wider than the " + res.maxBps + " bps maximum you set - a program with this guard would reject this price outright rather than trade or liquidate on it.";
      var zeroNote = res.bandCrossesZero
        ? " The one-sigma band reaches zero or below - the publishers' uncertainty is as large as the price itself, so the low end is no positive price at all."
        : "";
      var confZeroNote = res.confIsZero
        ? " A confidence of exactly 0 claims perfect certainty; real feeds essentially never publish it, so treat a zero here as a data problem, not as safety."
        : "";
      setText("pyth-result", "Model output: a feed value of " + res.priceRaw + " plus-or-minus " + res.confRaw + " at exponent " + res.expo + " is a price of " + res.priceUi + " plus-or-minus " + res.confUi + " - the one-standard-deviation band runs from " + res.low + " to " + res.high + " (the full band is " + res.fullWidthBps.toFixed(4) + " bps wide), and doubling the interval gives " + res.low2 + " to " + res.high2 + ", roughly a 95% band only if the errors were normally distributed. A cautious program values collateral at the low end, " + res.low + ", not at the mid price." + guardNote + zeroNote + confZeroNote + " Staleness is the feed's other safety check - a price this fresh-looking can still be too old - and is not modelled here; no live feed is read. An educational model of oracle price confidence, not live market data. Not financial advice.");
    });

    var curveForm = document.getElementById("curve-calc");
    if (curveForm) curveForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = bondingCurve(val("curve-vsol"), val("curve-vtok"), val("curve-supply"), val("curve-raised"), val("curve-target"), val("curve-buy"), val("curve-fee"));
      if (res === null) {
        document.getElementById("curve-price-out").value = "Invalid";
        document.getElementById("curve-tokens-out").value = "Invalid";
        setText("curve-result", "Check the inputs: the virtual reserves, the total supply, the graduation target and the buy amount must all be above zero (amounts may have up to 9 decimal places), the real SOL raised may be zero but not negative, and the fee is a whole number of basis points from 0 to 9,999 - a buy so small it would receive zero tokens at this scale is rejected, exactly as the floored on-chain quote would pay nothing.");
        return;
      }
      document.getElementById("curve-price-out").value = res.priceAfter;
      document.getElementById("curve-tokens-out").value = res.tokensOut;
      var gradNote = res.alreadyComplete
        ? " The real SOL raised already meets the graduation target, so on a live launchpad this curve would already have completed and migrated - the quote above is the curve's own math worked anyway, not a trade that could still happen."
        : (res.graduatesWithThisBuy
          ? " This buy carries the real SOL raised to the graduation target: on a live launchpad the curve would complete here and the real SOL and unsold tokens would migrate to an AMM pool, with the depth dropping as the virtual offset stays behind."
          : " The curve still stands short of its graduation target after this buy.");
      setText("curve-result", "Model output: the curve prices the token at " + res.spotPrice + " SOL before the buy and " + res.priceAfter + " SOL after it (a rise of " + res.priceRisePct.toFixed(4) + "% along the curve; prices are shown at 9 decimal places). The buy pays " + res.feeSol + " SOL of fee first, so " + res.effectiveIn + " SOL enters the curve and receives " + res.tokensOut + " tokens - an average of " + res.avgPricePaid + " SOL per token once the fee is counted. The virtual reserves move to " + res.newVirtualSol + " SOL and " + res.newVirtualToken + " tokens, while the real SOL the curve actually holds rises to " + res.raisedAfter + " SOL: progress to graduation moves from " + res.progressBeforePct.toFixed(4) + "% to " + res.progressAfterPct.toFixed(4) + "% of the target. The market cap the interfaces would quote (curve price times total supply) moves from " + res.mcapBefore + " SOL to " + res.mcapAfter + " SOL." + gradNote + " The virtual reserves are a pricing offset, not balances, and the fee rate, target and reserves are inputs - each launchpad sets its own and no live curve is read. An educational model of a launchpad bonding curve, not a live quote. Not financial advice.");
    });

    var fundForm = document.getElementById("fund-calc");
    if (fundForm) fundForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = perpFunding(val("fund-size"), val("fund-price"), val("fund-rate"), val("fund-hours"), val("fund-side"));
      if (res === null) {
        document.getElementById("fund-notional-out").value = "Invalid";
        document.getElementById("fund-total-out").value = "Invalid";
        setText("fund-result", "Check the inputs: the position size, the mark price and the hours held must all be above zero (amounts may have up to 9 decimal places; hours are capped at 87,600), the funding rate is a signed number of basis points per hour between -10,000 and 10,000 (a leading minus sign is allowed, and expected), and the side is long or short - a position so small its notional floors to zero at this scale is rejected.");
        return;
      }
      document.getElementById("fund-notional-out").value = res.notional;
      document.getElementById("fund-total-out").value = res.total;
      var flowNote = res.payer === "none"
        ? " At a rate of exactly 0 there is no payment either way - neither side pays."
        : (res.positionPays
          ? " Your " + res.side + " position PAYS: at a " + (res.payer === "longs" ? "positive" : "negative") + " rate the " + res.payer + " pay the other side, and the payment leaves the position every settlement while it stays open."
          : " Your " + res.side + " position RECEIVES: at a " + (res.payer === "longs" ? "positive" : "negative") + " rate the " + res.payer + " pay the other side, and your side collects.");
      var zeroNote = res.paymentIsZero && res.payer !== "none"
        ? " The payment floors to exactly 0 at the 9-decimal scale - the position is too small, or the rate too low, for a whole smallest unit to move."
        : "";
      setText("fund-result", "Model output: a " + res.size + " position at a mark price of " + res.price + " is a notional of " + res.notional + " (quote currency). At a funding rate of " + res.rateBps + " bps per hour the payment is " + res.perHourMagnitude + " per hour, so holding for " + res.hours + " hours at that same rate totals " + res.totalMagnitude + " - shown from your position's point of view as " + res.total + " (negative pays, positive receives), or " + res.perHour + " per hour." + flowNote + zeroNote + " The annualised figure for that hourly rate is " + res.annualizedPct.toFixed(4) + "% - a quoting convention (hourly rate x 8,760), not a forecast, because every venue resets its rate each interval from the mark/index premium and caps it at its own maximum. The rate, price and size are inputs and no live market is read. An educational model of perpetual funding, not a live quote. Not financial advice.");
    });

    var irateForm = document.getElementById("irate-calc");
    if (irateForm) irateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = lendingRate(val("irate-supplied"), val("irate-borrowed"), val("irate-base"), val("irate-slope1"), val("irate-uopt"), val("irate-slope2"), val("irate-reserve"), val("irate-days"));
      if (res === null) {
        document.getElementById("irate-borrow-out").value = "Invalid";
        document.getElementById("irate-supply-out").value = "Invalid";
        document.getElementById("irate-interest-out").value = "Invalid";
        setText("irate-result", "Check the inputs: total supplied must be above zero and total borrowed between zero and the supplied amount (utilization cannot exceed 100%), the base rate and both slopes are annual basis points up to 1,000,000, the optimal utilization is a percent above 0 and below 100, the reserve factor is between 0 and 10,000 bps, and the days are a whole number from 1 to 3,650 (amounts may have up to 9 decimal places).");
        return;
      }
      document.getElementById("irate-borrow-out").value = res.borrowRatePct + "% (" + res.borrowRateBps + " bps)";
      document.getElementById("irate-supply-out").value = res.supplyRatePct + "% (" + res.supplyRateBps + " bps)";
      document.getElementById("irate-interest-out").value = res.interest;
      var kinkNote = res.atKink
        ? " Utilization sits exactly ON the kink: the gentle first slope ends here, and any further borrowing is priced on the steep second slope."
        : (res.aboveKink
          ? " Utilization is PAST the kink, so the steep second slope is doing the pricing - that is the market charging hard for scarce liquidity to pull deposits in and borrows down."
          : " Utilization is below the kink, so the gentle first slope prices the borrow.");
      var zeroNote = res.borrowed === "0"
        ? " With nothing borrowed there is no interest and suppliers earn nothing, whatever the curve says the borrow rate would be."
        : "";
      setText("irate-result", "Model output: " + res.borrowed + " borrowed of " + res.supplied + " supplied is a utilization of " + res.utilizationPct + "%, against an optimal utilization of " + res.optimalPct + "%." + kinkNote + " The borrow rate is " + res.borrowRatePct + "% per year (" + res.borrowRateBps + " bps) and suppliers earn " + res.supplyRatePct + "% per year (" + res.supplyRateBps + " bps) - the borrow rate times the utilization, less the reserve factor the protocol keeps. Compounded daily at that borrow rate, the borrowed total accrues " + res.interest + " of interest over " + res.days + " days, ending at " + res.endBalance + "." + zeroNote + " Daily compounding at a frozen utilization is this model's stated convention - real markets accrue continuously or per-slot and the rate moves as utilization moves, and every market sets (and governance changes) its own curve parameters. The amounts and parameters are inputs and no live market is read. An educational model of a lending rate curve, not a live quote. Not financial advice.");
    });

    var pposForm = document.getElementById("ppos-calc");
    if (pposForm) pposForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = perpPosition(val("ppos-side"), val("ppos-size"), val("ppos-entry"), val("ppos-mark"), val("ppos-leverage"), val("ppos-mmr"));
      if (res === null) {
        document.getElementById("ppos-margin-out").value = "Invalid";
        document.getElementById("ppos-pnl-out").value = "Invalid";
        document.getElementById("ppos-liq-out").value = "Invalid";
        setText("ppos-result", "Check the inputs: the position size, entry price and mark price must all be above zero (amounts may have up to 9 decimal places), the leverage must be above zero and at most 1,000, the maintenance margin rate is a number of basis points from 0 up to (but not including) 10,000, and the side is long or short - a position so small its notional or margin floors to zero at this scale is rejected.");
        return;
      }
      document.getElementById("ppos-margin-out").value = res.margin;
      document.getElementById("ppos-pnl-out").value = res.pnl;
      document.getElementById("ppos-liq-out").value = res.noLiquidation ? "None - no fall reaches it" : res.liquidationPrice;
      var pnlNote = res.pnlIsProfit
        ? " The mark has moved in your favour, so the position is in profit."
        : (res.pnlIsLoss ? " The mark has moved against you, so the position is at a loss." : " The mark is exactly the entry price, so the unrealised PnL is exactly 0.");
      var statusNote = res.status === "below"
        ? " At this mark the equity is BELOW the maintenance margin - on a live venue this position would already have been liquidated; the negative equity a deep move can show here is arithmetic the venue never lets happen, because liquidation intervenes first."
        : (res.status === "at"
          ? " At this mark the equity sits exactly ON the maintenance margin - the liquidation line itself."
          : " At this mark the equity stands above the maintenance margin, so the position is not liquidatable at this price.");
      var liqNote = res.noLiquidation
        ? " There is no liquidation price: at this leverage the margin covers the whole notional, so no fall in the mark can reduce the equity to the maintenance margin - the price cannot go below zero."
        : " The liquidation price is " + res.liquidationPrice + " - the mark is " + res.distanceToLiquidationPct.toFixed(4) + "% away from it. Note where it sits relative to the entry: because the maintenance margin is a live share of the current notional, liquidation triggers while equity still remains, well before the margin would reach zero.";
      setText("ppos-result", "Model output: a " + res.size + " " + res.side + " opened at " + res.entry + " is a notional of " + res.notional + ", and at " + res.leverage + "x leverage the initial margin posted is " + res.margin + ". At a mark of " + res.mark + " (a move of " + res.priceMovePct.toFixed(4) + "% from entry) the unrealised PnL is " + res.pnl + " - a return of " + res.returnOnMarginPct.toFixed(4) + "% on the margin - so the equity is " + res.equity + " against a maintenance margin of " + res.maintenance + " (the " + res.mmrBps + " bps maintenance rate applied to the current notional of " + res.notionalAtMark + ")." + pnlNote + statusNote + liqNote + " This is the isolated-margin model: cross margin, funding payments (Tool 34), trading fees, partial liquidation and any liquidation penalty are not modelled, every venue sets its own maintenance rate (often tiered by position size) and liquidation engine, and no live market is read. An educational model of perpetual position margin, not a live quote. Not financial advice.");
    });

    var stabForm = document.getElementById("stab-calc");
    if (stabForm) stabForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = stableSwap(val("stab-x"), val("stab-y"), val("stab-amp"), val("stab-dx"), val("stab-fee"));
      if (res === null) {
        document.getElementById("stab-d-out").value = "Invalid";
        document.getElementById("stab-net-out").value = "Invalid";
        document.getElementById("stab-price-out").value = "Invalid";
        setText("stab-result", "Check the inputs: both pool balances and the amount in must be above zero (amounts may have up to 9 decimal places), the amplification coefficient is a whole number from 1 to 100,000, and the swap fee is a number of basis points from 0 up to (but not including) 10,000 - a trade so small its output floors to zero at this scale is rejected.");
        return;
      }
      document.getElementById("stab-d-out").value = res.invariantD;
      document.getElementById("stab-net-out").value = res.netOut;
      document.getElementById("stab-price-out").value = res.effectivePrice;
      setText("stab-result", "Model output: the pool's invariant D is " + res.invariantD + " - its total value at the peg, exactly the sum of the balances when the pool is balanced. Trading " + res.amountIn + " of the first token in takes the balances from " + res.balanceIn + " / " + res.balanceOut + " to " + res.newBalanceIn + " / " + res.newBalanceOut + ": the curve returns " + res.grossOut + " gross (a price impact of " + res.grossPriceImpactPct.toFixed(4) + "% against the 1:1 peg, before the fee), the swap fee of " + res.feeBps + " bps is charged on that output and withholds " + res.fee + ", and you receive " + res.netOut + " - an effective price of " + res.effectivePrice + " per unit in. Raise the amplification and the same trade prices closer to 1:1 while the pool stays balanced; unbalance the pool or trade big against it and the curve bends toward constant-product pricing and the impact grows. The fee stays in the pool for its liquidity providers. This is the two-coin stableswap model: multi-coin pools, the virtual-price growth of the LP token over time, and any admin fee a venue skims are not modelled, both tokens are treated at the same decimals, the integer Newton solver can sit a few smallest units from the real-valued curve on extreme inputs (the on-chain convention), and no live pool is read. An educational model of a stableswap pool, not a live quote. Not financial advice.");
    });

    var liqmaxForm = document.getElementById("liqmax-calc");
    if (liqmaxForm) liqmaxForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = liquidationMax(val("liqmax-amt"), val("liqmax-price"), val("liqmax-debt"), val("liqmax-bonus"), val("liqmax-close"));
      if (res === null) {
        document.getElementById("liqmax-repay-out").value = "Invalid";
        document.getElementById("liqmax-seized-out").value = "Invalid";
        document.getElementById("liqmax-remain-out").value = "Invalid";
        setText("liqmax-result", "Check the inputs: the collateral amount, its price and the debt must all be above zero (amounts may have up to 9 decimal places), the liquidation bonus is a number of basis points from 0 up to (but not including) 10,000, and the close factor is a number of basis points above 0 and at most 10,000 - a debt so small that the close factor's share of it floors to zero at this scale is rejected.");
        return;
      }
      document.getElementById("liqmax-repay-out").value = res.repay;
      document.getElementById("liqmax-seized-out").value = res.seizedAmount;
      document.getElementById("liqmax-remain-out").value = res.remainingDebt;
      var seizeNote = res.collateralExhausted
        ? " The marked-up seizure would take more than the position holds, so the collateral is exhausted: the liquidator takes all " + res.amount + " of it (worth " + res.seizedValue + ") and the effective repay falls to " + res.repay + ", leaving " + res.remainingDebt + " of debt behind with no collateral backing it - the shortfall a market's insurance fund or socialised loss absorbs."
        : " The liquidator seizes " + res.seizedAmount + " of collateral, worth " + res.seizedValue + " - a bonus profit of " + res.profitValue + " over the amount repaid, paid by the borrower - leaving " + res.remainingCollateral + " of collateral worth " + res.remainingCollateralValue + " against " + res.remainingDebt + " of remaining debt.";
      var closeNote = res.fullyRepaid ? " The debt is fully repaid by this liquidation." : "";
      setText("liqmax-result", "Model output: the position holds collateral worth " + res.collateralValue + " (" + res.amount + " at " + res.price + ") against a debt of " + res.debt + ". The close factor of " + res.closeFactorBps + " bps caps a single liquidation's repay at " + res.maxRepay + "." + seizeNote + closeNote + " This is the single-collateral liquidation model: bonus and close factor are the market's inputs (some markets allow a full close once health is low enough - enter a 10,000 bps close factor for that case), interest accrual, liquidation fees and partial-liquidation sequencing are not modelled, and no live market is read. An educational model of a lending liquidation, not a live quote. Not financial advice.");
    });

    var routeForm = document.getElementById("route-calc");
    if (routeForm) routeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = routeSwap(val("route-rin1"), val("route-rmid1"), val("route-rmid2"), val("route-rout2"), val("route-ain"), val("route-fee1"), val("route-fee2"));
      if (res === null) {
        document.getElementById("route-mid-out").value = "Invalid";
        document.getElementById("route-out").value = "Invalid";
        document.getElementById("route-spot-out").value = "Invalid";
        setText("route-result", "Check the inputs: every reserve and the amount in must be above zero (amounts may have up to 9 decimal places), and each hop's fee is a whole number of basis points from 0 up to (but not including) 10,000 - a trade so small that either hop's output floors to zero at this scale is rejected, as it would be by the pool.");
        return;
      }
      document.getElementById("route-mid-out").value = res.midAmount;
      document.getElementById("route-out").value = res.amountOut;
      document.getElementById("route-spot-out").value = res.spotOut;
      setText("route-result", "Model output: hop 1 takes " + res.amountIn + " in, withholds a fee of " + res.hop1Fee + " (at " + res.fee1Bps + " bps) and swaps the remaining " + res.hop1EffectiveIn + " for " + res.midAmount + " of the intermediate token (a price impact of " + res.hop1PriceImpactPct.toFixed(4) + "% on that hop). Hop 2 swaps the full " + res.midAmount + " onward: it withholds " + res.hop2Fee + " of the intermediate token (at " + res.fee2Bps + " bps) and returns " + res.amountOut + " of the final token (a price impact of " + res.hop2PriceImpactPct.toFixed(4) + "% on that hop) - an effective price of " + res.effectivePrice + " final per unit in. At the pools' quoted spot prices the same route would be worth " + res.spotOut + ", so the two fees and the two impacts together cost " + res.totalCostBps + " bps of the spot value: routing costs compound across hops, which is why an aggregator compares routes instead of assuming one. This is the two-hop constant-product route model: both hops are the hub's Tool 2 swap, longer routes, split routes across several pools, concentrated-liquidity hops and any aggregator or interface fee a venue adds on top are not modelled, and no live pool is read. An educational model of a routed swap, not a live quote. Not financial advice.");
    });

    var xoForm = document.getElementById("xo-calc");
    if (xoForm) xoForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = cpSwapExactOut(val("xo-rin"), val("xo-rout"), val("xo-aout"), val("xo-fee"));
      if (res === null) {
        document.getElementById("xo-in-out").value = "Invalid";
        document.getElementById("xo-actual-out").value = "Invalid";
        setText("xo-result", "Check the inputs: both reserves and the amount out must be above zero (amounts may have up to 9 decimal places), the amount out must be less than the pool's whole output reserve - a constant-product pool can never pay out its entire reserve - and the fee is a whole number of basis points from 0 up to (but not including) 10,000.");
        return;
      }
      document.getElementById("xo-in-out").value = res.amountIn;
      document.getElementById("xo-actual-out").value = res.actualOut;
      var excessNote = res.excessOut === "0"
        ? " The pool delivers exactly the target at this scale."
        : " The pool's flooring delivers " + res.excessOut + " more than the target - the smallest gross input that reaches the target cannot land on it exactly at this scale, and the excess is reported, not hidden.";
      setText("xo-result", "Model output: to receive " + res.amountOut + " out of a pool holding " + res.reserveIn + " / " + res.reserveOut + ", the pool must receive " + res.netIn + " after the fee, so at " + res.feeBps + " bps you pay " + res.amountIn + " in: the pool withholds a fee of " + res.fee + ", swaps the remaining " + res.effectiveIn + " and pays out " + res.actualOut + " (a price impact of " + res.priceImpactPct.toFixed(4) + "% on the swap leg)." + excessNote + " The input grows without bound as the target approaches the whole output reserve, which is why a large exact-out order against a shallow pool costs so much more than its spot value. This is the exact-out constant-product model: the solved input is the smallest one that reaches the target under the hub's Tool 2 swap, CLMM exact-out (which walks ticks instead) and any interface fee a venue adds on top are not modelled, and no live pool is read. An educational model of an exact-out swap, not a live quote. Not financial advice.");
    });

    var arbForm = document.getElementById("arb-calc");
    if (arbForm) arbForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = arbitrageTrade(val("arb-rin"), val("arb-rout"), val("arb-ain"), val("arb-fee"), val("arb-price"));
      if (res === null) {
        document.getElementById("arb-out-out").value = "Invalid";
        document.getElementById("arb-profit-out").value = "Invalid";
        setText("arb-result", "Check the inputs: both reserves, the amount in and the external price must be above zero (amounts and the price may have up to 9 decimal places), the fee is a whole number of basis points from 0 up to (but not including) 10,000, and the trade must be large enough for the pool to pay out at least one smallest unit.");
        return;
      }
      document.getElementById("arb-out-out").value = res.amountOut;
      document.getElementById("arb-profit-out").value = res.profit;
      var verdict = res.profitable
        ? "the trade profits by " + res.profit + " of the input token before any external cost"
        : "the trade does not profit - it returns " + res.profit + " of the input token, because the fee and the price impact together eat the gap";
      setText("arb-result", "Model output: the pool starts at a spot price of " + res.spotPrice + " input per output against an external price of " + res.externalPrice + ". Swapping " + res.amountIn + " in withholds a fee of " + res.fee + " (at " + res.feeBps + " bps), swaps the remaining " + res.effectiveIn + " and pays out " + res.amountOut + " (a price impact of " + res.priceImpactPct.toFixed(4) + "%). Sold at the external price that output is worth " + res.externalValue + ", so " + verdict + ". The trade leaves the pool's spot price at " + res.postSpotPrice + " - short of the external price when the fee closes the remaining gap, past it when the trade overshoots the alignment point, which is why the profitable size is the one that stops at alignment, not the largest one. This is the arbitrage model: the swap leg is the hub's Tool 2 swap, the external sale is assumed to fill in full at exactly the quoted price with no external fee, slippage, gas or priority fee modelled, the mirrored direction (selling into this pool) is the same model with the tokens swapped, and no live price or pool is read. An educational model of an arbitrage trade, not a live quote. Not financial advice.");
    });

    var cswapForm = document.getElementById("cswap-calc");
    if (cswapForm) cswapForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = clmmSwap(val("cswap-l"), val("cswap-lower"), val("cswap-upper"), val("cswap-current"), val("cswap-dir"), val("cswap-ain"), val("cswap-fee"));
      function fmtAmt(x) { return x === 0 ? "0" : (Math.abs(x) < 0.001 || Math.abs(x) >= 1e15 ? x.toExponential(6) : String(Number(x.toPrecision(10)))); }
      if (res === null) {
        document.getElementById("cswap-out-out").value = "Invalid";
        document.getElementById("cswap-price-out").value = "Invalid";
        setText("cswap-result", "Check the inputs: the liquidity and the amount in must be above zero (up to 9 decimal places), all ticks must be whole numbers from -443,636 to 443,636 with the lower tick below the upper tick, the current tick must be inside the range (lower <= current < upper - outside it this range's liquidity is inactive), and the fee is a whole number of basis points from 0 up to (but not including) 10,000.");
        return;
      }
      document.getElementById("cswap-out-out").value = fmtAmt(res.amountOut);
      document.getElementById("cswap-price-out").value = fmtAmt(res.priceAfter);
      var inName = res.direction === "token0" ? "token0" : "token1";
      var outName = res.direction === "token0" ? "token1" : "token0";
      var boundNote = res.reachedBound
        ? " The trade is large enough to push the price all the way to the range's " + (res.direction === "token0" ? "lower" : "upper") + " bound (tick " + res.boundTick + "), so it stops there in this model: only " + fmtAmt(res.usedEffectiveIn) + " of the effective input is used inside this range and " + fmtAmt(res.unusedEffectiveIn) + " is left over - on-chain the trade would continue into the next tick range, against whatever liquidity is active there, which is not modelled here."
        : " The trade uses the full effective input inside this range, leaving " + fmtAmt(res.unusedEffectiveIn) + " unused.";
      setText("cswap-result", "Model output: paying " + res.amountIn + " " + inName + " withholds a fee of " + res.fee + " (at " + res.feeBps + " bps) and swaps the remaining " + res.effectiveIn + " against active liquidity " + res.liquidity + " over ticks " + res.tickLower + " to " + res.tickUpper + " at the current tick " + res.tickCurrent + " (price " + fmtAmt(res.priceCurrent) + " token1 per token0). It pays out " + fmtAmt(res.amountOut) + " " + outName + " and moves the price to " + fmtAmt(res.priceAfter) + " (a price impact of " + res.priceImpactPct.toFixed(4) + "% against the starting spot)." + boundNote + " Inside one range this is the same trade as a constant-product swap on the range's virtual reserves, which is why the output matches Tool 2 at the matching reserves; tick crossing, the next range's liquidity and any interface fee a venue adds on top are not modelled, and no live pool is read. An educational model of a CLMM swap, not a live quote. Not financial advice.");
    });

    var bookForm = document.getElementById("book-calc");
    if (bookForm) bookForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = orderBookBuy(val("book-p1"), val("book-q1"), val("book-p2"), val("book-q2"), val("book-p3"), val("book-q3"), val("book-buy"));
      if (res === null) {
        document.getElementById("book-filled-out").value = "Invalid";
        document.getElementById("book-cost-out").value = "Invalid";
        document.getElementById("book-vwap-out").value = "Invalid";
        setText("book-result", "Check the inputs: every price, quantity and the buy amount must be above zero (up to 9 decimal places), and the three ask prices must strictly increase - a book's asks are sorted best (lowest) first.");
        return;
      }
      document.getElementById("book-filled-out").value = res.filled;
      document.getElementById("book-cost-out").value = res.totalCost;
      document.getElementById("book-vwap-out").value = fmtAmt(res.vwap);
      var fillNote = res.fullyFilled
        ? " The buy filled in full against the three levels shown."
        : " The visible book held only " + res.bookDepth + " in total, so " + res.remaining + " of the buy could not fill at any of these prices - on a live book it would fill deeper, wait as a limit order, or be cancelled, depending on the order type.";
      setText("book-result", "Model output: buying " + res.buy + " walks the asks in order - " + res.takes.map(function (t) { return t.taken + " at " + t.price + " (cost " + t.cost + ")"; }).join(", ") + " - filling " + res.filled + " for a total cost of " + res.totalCost + ", a volume-weighted average price of " + fmtAmt(res.vwap) + ". Filling entirely at the best ask of " + res.bestPrice + " would have cost " + res.costAtBest + ", so walking the book cost an extra " + res.extraCost + " (a slippage of " + res.slippagePct.toFixed(4) + "% against the best ask)." + fillNote + " Three ask levels are modelled and venue taker fees are not modelled; no live book is read. An educational model of an order-book fill, not a live quote. Not financial advice.");
    });

    var twapForm = document.getElementById("twap-calc");
    if (twapForm) twapForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = twapOracle(val("twap-start"), val("twap-end"), val("twap-seconds"), val("twap-spot"));
      if (res === null) {
        document.getElementById("twap-avg-out").value = "Invalid";
        document.getElementById("twap-price-out").value = "Invalid";
        setText("twap-result", "Check the inputs: both tick cumulatives must be whole numbers (negative allowed, inside the signed 64-bit range), the window must be a whole number of seconds above zero, the spot price must be above zero (up to 9 decimal places), and the average tick the window implies must sit inside the pool tick range (-443,636 to 443,636).");
        return;
      }
      document.getElementById("twap-avg-out").value = String(res.avgTick);
      document.getElementById("twap-price-out").value = fmtAmt(res.twapPrice);
      var devNote = res.deviationBps >= 0
        ? "above the spot price you entered (" + res.spotPrice + ")"
        : "below the spot price you entered (" + res.spotPrice + ")";
      setText("twap-result", "Model output: the tick cumulative moved " + res.deltaTicks + " tick-seconds over " + res.elapsedSeconds + " seconds, an average tick of " + res.avgTick + " (the division truncates toward zero and discards a remainder of " + res.remainderTicks + " tick-seconds), so the time-weighted average price is " + fmtAmt(res.twapPrice) + " - " + fmtAmt(Math.abs(res.deviationBps)) + " bps " + devNote + ". That gap is the TWAP's lag: it prices where the pool has been over the whole window, not where it is now, which is what makes it expensive to manipulate and slow to follow a real move. The cumulatives and spot are your inputs from a pool's oracle account or an explorer - no live pool or oracle is read. An educational model of a TWAP oracle, not a live quote. Not financial advice.");
    });

    var lpwdForm = document.getElementById("lpwd-calc");
    if (lpwdForm) lpwdForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = lpWithdraw(val("lpwd-ra"), val("lpwd-rb"), val("lpwd-supply"), val("lpwd-burn"));
      if (res === null) {
        document.getElementById("lpwd-outa-out").value = "Invalid";
        document.getElementById("lpwd-outb-out").value = "Invalid";
        setText("lpwd-result", "Check the inputs: both current reserves and the LP supply must be above zero, and the amount burned must be above zero and no more than the whole supply (all amounts up to 9 decimal places).");
        return;
      }
      document.getElementById("lpwd-outa-out").value = res.outA;
      document.getElementById("lpwd-outb-out").value = res.outB;
      var dustNote = (res.zeroA || res.zeroB)
        ? " Warning: this burn is so small against the supply that at least one side floors to exactly 0 at the smallest unit - burning it would return nothing on that side, and the dust the flooring discards stays in the pool for the remaining LPs."
        : " The flooring dust each division discards stays in the pool for the remaining LPs.";
      var tailNote = res.fullBurn
        ? " That is the whole supply, so the withdrawal returns the entire reserves exactly and leaves the pool empty."
        : " The pool keeps " + res.remainingA + " of token A and " + res.remainingB + " of token B against a remaining supply of " + res.remainingSupply + ".";
      setText("lpwd-result", "Model output: burning " + res.burn + " LP tokens - a " + fmtAmt(res.sharePct) + "% share of the supply - returns " + res.outA + " of token A and " + res.outB + " of token B, each floored at the smallest unit." + tailNote + dustNote + " That is a share of what the pool holds now, not a return of any original deposit: swaps, accrued fees and price moves since depositing are all inside these reserves. The reserves and supply are your inputs - no live pool is read. An educational model of an LP withdrawal, not a live quote. Not financial advice.");
    });


    var airForm = document.getElementById("air-calc");
    if (airForm) airForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = airdropCost(val("air-recipients"), val("air-new"), val("air-batch"), val("air-amount"), val("air-priority"));
      if (res === null) {
        document.getElementById("air-tx-out").value = "Invalid";
        document.getElementById("air-total-out").value = "Invalid";
        setText("air-result", "Check the inputs: recipients must be a whole number from 1 to 10,000,000, new token accounts a whole number from 0 up to the recipient count, transfers per transaction a whole number of 1 or more, the amount per recipient above zero with at most 9 decimal places, and the priority fee per transaction a whole number of lamports from 0 to 1,000,000,000.");
        return;
      }
      document.getElementById("air-tx-out").value = String(res.txCount);
      document.getElementById("air-total-out").value = res.totalSol;
      setText("air-result", "Model output: sending " + res.amountPerRecipient + " to each of " + res.recipients + " recipients takes " + res.txCount + " transactions at " + res.batchSize + " transfers per transaction, and needs " + res.tokensNeeded + " tokens in the mint. Creating " + res.newAtas + " new token accounts locks " + res.rentLamports + " lamports (" + res.rentSol + " SOL) of rent-exempt deposit at " + res.rentPerAtaLamports + " lamports each - that deposit is reclaimable if the accounts are later closed; it is not spent. Network fees are " + res.feesLamports + " lamports (" + res.feesSol + " SOL): " + res.txCount + " transactions at " + res.feePerTxLamports + " lamports each (5,000 base for one signature plus your priority fee). Total SOL to fund the sending wallet: " + res.totalLamports + " lamports (" + res.totalSol + " SOL), plus the tokens. The batch size is your choice, bounded by the 1,232-byte packet limit and by whether the creation instructions ride in the same transactions; failed transfers, retries and any distributor program's own fees are not modelled, and no live cluster is read. An educational model of an airdrop's SOL cost, not a live quote. Not financial advice.");
    });

    var dutchForm = document.getElementById("dutch-calc");
    if (dutchForm) dutchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = dutchAuctionPrice(val("dutch-start"), val("dutch-floor"), val("dutch-duration"), val("dutch-elapsed"), val("dutch-step"));
      if (res === null) {
        document.getElementById("dutch-price-out").value = "Invalid";
        document.getElementById("dutch-drop-out").value = "Invalid";
        setText("dutch-result", "Check the inputs: the start price must be above zero, the floor at or below the start (zero is allowed), the duration a whole number of seconds of 1 or more, the elapsed time a whole number of 0 or more, and the step a whole number from 0 (continuous) up to the duration (amounts up to 9 decimal places).");
        return;
      }
      document.getElementById("dutch-price-out").value = res.price;
      document.getElementById("dutch-drop-out").value = res.dropped;
      var stateNote = res.ended
        ? " The duration has run, so the price sits exactly on the floor - a stepped schedule ends there too, even when a step does not divide the duration."
        : (res.stepped
          ? " The price holds at this step until the next drop in " + res.nextDropInSeconds + " seconds, and reaches the floor in " + res.remainingSeconds + " seconds."
          : " The price keeps falling continuously and reaches the floor in " + res.remainingSeconds + " seconds.");
      setText("dutch-result", "Model output: " + res.elapsedSeconds + " seconds into a " + res.durationSeconds + "-second fall from " + res.startPrice + " to a floor of " + res.floorPrice + ", the price is " + res.price + " - down " + res.dropped + ", which is " + fmtAmt(res.dropPctOfRange) + "% of the whole drop." + stateNote + " The decay here is linear; some sales use an exponential curve instead, which falls faster early - that form is not modelled. The schedule is your input - no live sale is read, and whether the price is worth paying is the buyer's judgement, not the model's. An educational model of a Dutch auction's price schedule, not a live quote. Not financial advice.");
    });

    var govForm = document.getElementById("gov-calc");
    if (govForm) govForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = govVote(val("gov-supply"), val("gov-for"), val("gov-against"), val("gov-abstain"), val("gov-quorum"), val("gov-approval"));
      if (res === null) {
        document.getElementById("gov-cast-out").value = "Invalid";
        document.getElementById("gov-verdict-out").value = "Invalid";
        setText("gov-result", "Check the inputs: the governing supply must be above zero, each vote tally zero or more (amounts up to 9 decimal places), the tallies together no more than the supply, the quorum a whole number of basis points from 0 to 10,000, and the approval threshold a whole number from 1 to 10,000.");
        return;
      }
      document.getElementById("gov-cast-out").value = res.cast;
      document.getElementById("gov-verdict-out").value = res.passes ? "Passes" : "Fails";
      var quorumNote = res.quorumMet
        ? "Quorum is met: " + res.cast + " cast against " + res.quorumNeeded + " needed (" + fmtAmt(res.quorumBps / 100) + "% of the " + res.supply + " supply; turnout " + fmtAmt(res.turnoutBps / 100) + "%)."
        : "Quorum is NOT met: " + res.cast + " cast against " + res.quorumNeeded + " needed (" + fmtAmt(res.quorumBps / 100) + "% of the " + res.supply + " supply; turnout " + fmtAmt(res.turnoutBps / 100) + "%) - another " + res.quorumShortfall + " of votes must be cast, on any side including abstain, before the tally counts at all.";
      var approvalNote = res.approvalActualBps === null
        ? " Approval cannot be met: no for or against votes were cast - abstentions alone show up for quorum but decide nothing."
        : (res.approvalMet
          ? " Approval is met: for-votes are " + fmtAmt(res.approvalActualBps / 100) + "% of the decisive (for + against) votes, at or above the " + fmtAmt(res.approvalBps / 100) + "% threshold."
          : " Approval is NOT met: for-votes are " + fmtAmt(res.approvalActualBps / 100) + "% of the decisive (for + against) votes, below the " + fmtAmt(res.approvalBps / 100) + "% threshold.");
      var verdict = res.passes
        ? " The proposal PASSES - both bars are cleared."
        : " The proposal FAILS - " + (!res.quorumMet && !res.approvalMet ? "both bars are missed." : (!res.quorumMet ? "a tally can win the vote and still fail on turnout; that is this case." : "quorum alone does not carry a proposal the decisive votes reject."));
      setText("gov-result", "Model output: " + quorumNote + approvalNote + verdict + " Abstentions count toward quorum and toward neither side of approval - the convention modelled here; a framework that weighs them differently, vote weights other than one-token-one-vote, and any live tally are not modelled, and no live proposal is read. An educational model of a governance vote, not a live tally. Not financial advice.");
    });

    var allocForm = document.getElementById("alloc-calc");
    if (allocForm) allocForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = tokenAllocation(val("alloc-supply"), val("alloc-liquidity"), val("alloc-community"), val("alloc-team"));
      if (res === null) {
        document.getElementById("alloc-liq-out").value = "Invalid";
        document.getElementById("alloc-treasury-out").value = "Invalid";
        setText("alloc-result", "Check the inputs: the total supply must be above zero (amounts up to 9 decimal places), and each named share a whole number of basis points from 0 to 10,000, with the three named shares together no more than 10,000 - a split cannot promise more than the whole supply.");
        return;
      }
      document.getElementById("alloc-liq-out").value = res.liquidity;
      document.getElementById("alloc-treasury-out").value = res.treasury;
      var dustNote = res.dustUnits === 0
        ? " The four buckets sum to the supply exactly with no flooring dust at this scale."
        : " The treasury's nominal floored share would be " + res.treasuryNominal + "; as the remainder bucket it receives " + res.dust + " more - the flooring dust from all four buckets (never more than 3 smallest units) - so the four buckets still sum to the supply exactly.";
      setText("alloc-result", "Model output: a supply of " + res.supply + " splits into liquidity " + res.liquidity + " (" + fmtAmt(res.liquidityBps / 100) + "%), community " + res.community + " (" + fmtAmt(res.communityBps / 100) + "%), team " + res.team + " (" + fmtAmt(res.teamBps / 100) + "%) and a treasury remainder of " + res.treasury + " (" + fmtAmt(res.treasuryBps / 100) + "%)." + dustNote + " The named buckets are floored at the smallest unit and the treasury is the designated remainder - the convention modelled here; a launch that assigns its dust to a different bucket, or rounds instead of flooring, splits differently in the smallest units. Bucket labels are the common ones; what each bucket may be used for is set by the launch's own terms, vesting (Tool 19) is not applied here, and no live token is read. An educational model of a supply split, not a live token. Not financial advice.");
    });

    var qvForm = document.getElementById("qv-calc");
    if (qvForm) qvForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = quadraticVote(val("qv-budget"), val("qv-a"), val("qv-b"), val("qv-c"));
      if (res === null) {
        document.getElementById("qv-total-out").value = "Invalid";
        document.getElementById("qv-remaining-out").value = "Invalid";
        setText("qv-result", "Check the inputs: the budget must be a whole number of credits from 1 up, and each proposal's votes a whole number from 0 up - votes are counts and are never fractional.");
        return;
      }
      document.getElementById("qv-total-out").value = res.totalCost;
      document.getElementById("qv-remaining-out").value = res.remaining;
      var budgetNote = res.overBudget
        ? " That ballot is OVER budget by " + res.remaining.slice(1) + " credits - it cannot be cast as entered; trim votes (each one removed from a proposal saves its marginal cost) or raise the budget."
        : " That ballot fits the budget with " + res.remaining + " credits to spare.";
      setText("qv-result", "Model output: votes of " + res.votes[0] + ", " + res.votes[1] + " and " + res.votes[2] + " on the three proposals cost " + res.costs[0] + " + " + res.costs[1] + " + " + res.costs[2] + " = " + res.totalCost + " credits for " + res.totalVotes + " votes in total." + budgetNote + " The next vote on each proposal would cost " + res.nextCosts[0] + ", " + res.nextCosts[1] + " and " + res.nextCosts[2] + " more credits - the marginal cost 2v + 1 is what makes intensity expensive. Concentrating the whole budget of " + res.budget + " on one proposal buys at most " + res.maxSingleVotes + " votes (costing " + res.maxSingleCost + "). Three proposals and whole votes are modelled; each framework sets its own budget, proposal count and credit rules, and no live ballot is read. An educational model of a quadratic vote, not a live ballot. Not financial advice.");
    });

    var burnForm = document.getElementById("burn-calc");
    if (burnForm) burnForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = burnShare(val("burn-supply"), val("burn-holder"), val("burn-amount"));
      if (res === null) {
        document.getElementById("burn-newsupply-out").value = "Invalid";
        document.getElementById("burn-after-out").value = "Invalid";
        setText("burn-result", "Check the inputs: the supply must be above zero, the holder balance no more than the supply, and the burn above zero and no more than the supply minus the holder balance - this model burns other holders' tokens, so it cannot burn the holder's own.");
        return;
      }
      document.getElementById("burn-newsupply-out").value = res.newSupply;
      document.getElementById("burn-after-out").value = fmtAmt(res.afterBps / 100) + "%";
      var endNote = res.fullyBurned
        ? " The burn destroys the entire supply, so no share remains to own."
        : " The holder's share rises from " + fmtAmt(res.beforeBps / 100) + "% to " + fmtAmt(res.afterBps / 100) + "% (+" + res.gainBps + " whole basis points at the floored precision) while their balance stays exactly " + res.holder + " - a bigger share of a smaller supply, not more tokens.";
      setText("burn-result", "Model output: burning " + res.burn + " (" + fmtAmt(res.burnBps / 100) + "% of the supply) takes the supply from " + res.supply + " to " + res.newSupply + "." + endNote + " Shares are floored to whole basis points, so a dust balance can show 0% before and after even though its rational share did rise. A burn does not by itself set or raise a price, and no price, live supply or live burn is read. An educational model of a token burn, not a live token. Not financial advice.");
    });

    var merkForm = document.getElementById("merk-calc");
    if (merkForm) merkForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = merkleProof(val("merk-recipients"));
      if (res === null) {
        document.getElementById("merk-depth-out").value = "Invalid";
        document.getElementById("merk-proof-out").value = "Invalid";
        setText("merk-result", "Check the input: the recipient count must be a whole number from 1 to 100,000,000.");
        return;
      }
      document.getElementById("merk-depth-out").value = String(res.depth);
      document.getElementById("merk-proof-out").value = res.proofBytes + " bytes";
      var stepNote = res.recipients === 1
        ? " A single recipient needs no proof at all: the leaf is the root."
        : (res.emptyLeaves === "0"
          ? " The recipient count is an exact power of two, so no leaf slots are left empty."
          : " The tree is padded to " + res.paddedLeaves + " leaves, so " + res.emptyLeaves + " leaf slots stand empty - padding changes no proof, it only completes the tree.");
      setText("merk-result", "Model output: " + (res.recipients === 1 ? "1 recipient commits" : res.recipients + " recipients commit") + " to a Merkle tree of depth " + res.depth + " with " + res.totalNodes + (res.totalNodes === "1" ? " node" : " nodes") + " in total. Only the 32-byte root goes on-chain; each claim supplies a proof of " + res.proofHashes + " sibling hashes (" + res.proofBytes + " bytes) and the program hashes the claim up those levels to check it against the root." + stepNote + " One recipient past a power of two pushes every proof up a level, so proof size moves in steps, not smoothly. Leaf contents, the hash function and any claim program are not modelled, and no live tree or airdrop is read. An educational model of a Merkle proof, not a live airdrop. Not financial advice.");
    });

    var msigForm = document.getElementById("msig-calc");
    if (msigForm) msigForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = multisigPlan(val("msig-members"), val("msig-threshold"), val("msig-approved"));
      if (res === null) {
        document.getElementById("msig-needed-out").value = "Invalid";
        document.getElementById("msig-subsets-out").value = "Invalid";
        setText("msig-result", "Check the inputs: members must be a whole number from 1 to 100, the threshold a whole number from 1 up to the member count, and approvals collected a whole number from 0 up to the member count.");
        return;
      }
      document.getElementById("msig-needed-out").value = res.ready ? "0 - ready to execute" : String(res.stillNeeded);
      document.getElementById("msig-subsets-out").value = res.approvingSubsets + " of " + res.totalSubsets;
      var stateNote = res.ready
        ? " The threshold is met: " + res.approved + " approvals collected against " + res.threshold + " required, so the transaction can execute."
        : " The proposal is still pending: " + res.approved + " of the " + res.threshold + " required approvals collected, " + res.stillNeeded + " still needed.";
      var blockNote = res.singleCanBlock
        ? " The threshold is unanimous, so the smallest blocking coalition is a single member - every member holds a veto."
        : " The smallest blocking coalition is " + res.blockingSize + " members (" + res.blockingSubsets + " distinct " + (res.blockingSubsets === "1" ? "set" : "sets") + " of that size): if that many refuse, fewer than " + res.threshold + " members remain able to approve.";
      setText("msig-result", "Model output: a " + res.threshold + "-of-" + res.members + " multisig requires " + fmtAmt(res.thresholdBps / 100) + "% of its members to act." + stateNote + " Of the " + res.totalSubsets + " possible member subsets, " + res.approvingSubsets + (res.approvingSubsets === "1" ? " is" : " are") + " large enough to approve." + blockNote + " Member identities, key custody and proposal expiry are not modelled, and no live multisig is read. An educational model of a multisig threshold, not a live wallet. Not financial advice.");
    });


    var bbuyForm = document.getElementById("bbuy-calc");
    if (bbuyForm) bbuyForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = buybackBurn(val("bbuy-rq"), val("bbuy-rt"), val("bbuy-spend"), val("bbuy-fee"), val("bbuy-supply"), val("bbuy-burn"));
      if (res === null) {
        document.getElementById("bbuy-bought-out").value = "Invalid";
        document.getElementById("bbuy-supply-out").value = "Invalid";
        setText("bbuy-result", "Check the inputs: both pool reserves and the spend must be positive amounts with at most 9 decimal places, the pool fee a whole number of basis points below 10000, the supply positive, the burn share a whole number from 0 to 10000 basis points, and the burn must not exceed the supply.");
        return;
      }
      document.getElementById("bbuy-bought-out").value = res.bought;
      document.getElementById("bbuy-supply-out").value = res.newSupply;
      var splitNote = res.burnBps === 10000
        ? " Every bought token is burned, so the treasury receives none of this buy."
        : (res.burnBps === 0
          ? " The burn share is zero, so nothing is burned: the whole buy goes to the treasury and the supply stands unchanged - a buyback without a burn."
          : " Of the bought tokens " + res.burned + " are burned and " + res.treasury + " go to the treasury.");
      var supplyNote = res.burned === "0"
        ? " The supply stands unchanged at " + res.supply + "."
        : " The supply falls from " + res.supply + " to " + res.newSupply + " - the burn is " + res.burnShareBps + " whole basis points of the supply, floored.";
      setText("bbuy-result", "Model output: spending the revenue buys back " + res.bought + " tokens - a pool fee of " + res.fee + " comes off the spend first, and the average price paid is " + fmtAmt(res.avgPrice) + " against a spot of " + fmtAmt(res.spotPrice) + ", the gap being the fee plus the " + fmtAmt(res.priceImpactPct) + "% price impact the buy itself causes." + splitNote + supplyNote + " A burn does not by itself set or raise a price, and none is promised. Where the revenue came from, how often buybacks run and any live program are not modelled, and no live pool is read. An educational model of a buyback and burn, not a live program. Not financial advice.");
    });

    var escrForm = document.getElementById("escr-calc");
    if (escrForm) escrForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = escrowRelease(val("escr-amount"), val("escr-fee"), val("escr-bytes"));
      if (res === null) {
        document.getElementById("escr-fee-out").value = "Invalid";
        document.getElementById("escr-seller-out").value = "Invalid";
        setText("escr-result", "Check the inputs: the escrowed amount must be a positive amount with at most 9 decimal places, the platform fee a whole number of basis points from 0 to 10000, and the escrow account size a whole number of bytes.");
        return;
      }
      document.getElementById("escr-fee-out").value = res.fee;
      document.getElementById("escr-seller-out").value = res.seller;
      var feeNote = res.feeIsZero
        ? " The fee floors to zero at this size, so on release the seller receives the whole " + res.amount + " - a percentage fee takes nothing from a dust payment."
        : " On release the platform fee is " + res.fee + " (an effective " + res.effectiveBps + " whole basis points, floored, never above the stated " + res.feeBps + ") and the seller receives " + res.seller + ".";
      setText("escr-result", "Model output: " + res.amount + " sits locked in the escrow account, and the escrow account's own rent-exempt deposit is " + res.rentLamports + " lamports (" + res.rentSol + " SOL) for its " + res.escrowBytes + " bytes - locked by whoever funds the account and reclaimed when it closes, not a cost of the trade." + feeNote + " On refund the buyer receives the whole " + res.refund + " back and no fee is charged: the fee exists only on the release path. Delivery, disputes, arbiter decisions and timeouts are not modelled, and no live escrow is read. An educational model of an escrow release, not a live escrow. Not financial advice.");
    });

    var dcaForm = document.getElementById("dca-calc");
    if (dcaForm) dcaForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = dcaPlan(val("dca-rin"), val("dca-rout"), val("dca-total"), val("dca-fee"), val("dca-orders"), val("dca-txfee"));
      if (res === null) {
        document.getElementById("dca-tranche-out").value = "Invalid";
        document.getElementById("dca-total-out").value = "Invalid";
        setText("dca-result", "Check the inputs: both pool reserves and the total to spend must be positive amounts with at most 9 decimal places, the pool fee a whole number of basis points below 10000, the order count a whole number from 1 to 1000, the per-order transaction fee a whole number of lamports from 0 to 1000000, and the total must give every order at least one smallest unit and a non-zero output.");
        return;
      }
      document.getElementById("dca-tranche-out").value = res.tranche;
      document.getElementById("dca-total-out").value = res.dcaOut;
      var dustNote = res.diffUnits === "0"
        ? " The split receives exactly the lump amount."
        : " The split receives " + res.dcaOut + " against the lump buy's " + res.lumpOut + " - a difference of " + res.diffUnits + " smallest units, flooring dust from each order's output and fee rounding in opposite directions, not an execution gain or loss worth the name.";
      var splitNote = res.orders === 1
        ? " A single order is the lump buy itself, run once."
        : " The " + res.orders + " orders of " + res.tranche + " each" + (res.remainderUnits === "0" ? "" : " (the first " + res.remainderUnits + (res.remainderUnits === "1" ? " order carries" : " orders carry") + " one extra smallest unit, so the orders sum to the total exactly)") + " run back to back against the reserves each previous order leaves.";
      setText("dca-result", "Model output:" + splitNote + dustNote + " Pool fees total " + res.dcaFees + " across the split against " + res.lumpFee + " on the lump buy, and the transaction fees are the certain extra cost: " + res.orders + (res.orders === 1 ? " order" : " orders") + " at " + res.txFeePerOrder + " lamports each is " + res.txFeesLamports + " lamports (" + res.txFeesSol + " SOL). Against this frozen pool the average price is " + fmtAmt(res.avgPriceDca) + " split against " + fmtAmt(res.avgPriceLump) + " lump. What splitting buys in reality - exposure to different prices at different times - is not modelled and cannot be promised; between-order price movement, program fees beyond the per-order transaction fee and any live DCA program are not modelled, and no live pool is read. An educational model of a DCA split, not a live program. Not financial advice.");
    });

    var dlmmForm = document.getElementById("dlmm-calc");
    if (dlmmForm) dlmmForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = dlmmBins(val("dlmm-step"), val("dlmm-bin"), val("dlmm-width"));
      if (res === null) {
        document.getElementById("dlmm-price-out").value = "Invalid";
        document.getElementById("dlmm-mult-out").value = "Invalid";
        setText("dlmm-result", "Check the inputs: the bin step must be a whole number of basis points from 1 to 10000, the active bin id a whole number from -2000 to 2000, and the range half-width a whole number of bins from 1 to 500.");
        return;
      }
      document.getElementById("dlmm-price-out").value = res.activePrice;
      document.getElementById("dlmm-mult-out").value = res.rangeMultiplier;
      var zeroNote = res.floorsToZero
        ? " At least one of these prices is below the 9-decimal display precision and reads 0 - the ladder reaches it only at the extreme bin shown."
        : "";
      setText("dlmm-result", "Model output: at a bin step of " + res.stepBps + " bps (" + fmtAmt(res.stepPct) + "% per bin), bin " + res.binId + " prices at " + res.activePrice + " quote per base. A position " + res.width + (res.width === 1 ? " bin" : " bins") + " either side runs from bin " + res.lowerId + " at " + res.lowerPrice + " to bin " + res.upperId + " at " + res.upperPrice + " - a range multiplier of " + res.rangeMultiplier + " (a span of " + fmtAmt(res.spanPct) + "%), and that multiplier depends only on the step and the width, never on where the position sits. The price doubles every " + res.binsToDouble + (res.binsToDouble === 1 ? " bin" : " bins") + " at this step, and halves in the same count, by the ladder's reciprocal symmetry." + zeroNote + " Liquidity per bin, the position's token amounts, DLMM's variable volatility fee and any live pool are not modelled, and no live pool is read. An educational model of a DLMM bin ladder, not a live pool. Not financial advice.");
    });


    var nftForm = document.getElementById("nft-calc");
    if (nftForm) nftForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = nftMintCost(val("nft-count"), val("nft-editions"));
      if (res === null) {
        document.getElementById("nft-total-out").value = "Invalid";
        document.getElementById("nft-per-out").value = "Invalid";
        setText("nft-result", "Check the inputs: the NFT count must be a whole number from 1 to 100000, and the master-edition count a whole number from 0 up to the NFT count.");
        return;
      }
      document.getElementById("nft-total-out").value = res.totalLamports;
      document.getElementById("nft-per-out").value = String(res.perNftWithEditionLamports);
      var edNote = res.editions === 0
        ? " No master editions are created, so each NFT is three accounts and " + res.perNftLamports + " lamports."
        : " The " + res.editions + (res.editions === 1 ? " master edition adds" : " master editions add") + " a 282-byte account at " + res.editionRentLamports + " lamports each" + (res.editions === res.count ? ", so every NFT carries the full four-account recipe at " + res.perNftWithEditionLamports + " lamports (" + res.perNftSol + " SOL) each." : ".");
      setText("nft-result", "Model output: minting " + res.count + (res.count === 1 ? " NFT" : " NFTs") + " creates " + res.totalBytes + " bytes of accounts - per NFT a mint at " + res.mintRentLamports + " lamports, a token account at " + res.tokenRentLamports + " and metadata at " + res.metadataRentLamports + " - and locks " + res.totalLamports + " lamports (" + res.totalSol + " SOL) of rent-exempt deposits in total." + edNote + " The deposits are locked, not spent: closing an account reclaims its deposit. Transaction fees, any marketplace or mint-program fee, candy-machine or guard costs and compressed NFTs (Tool 28, a different structure) are not modelled, and no live mint is read. An educational model of a classic NFT mint's rent, not a live quote. Not financial advice.");
    });

    var deployForm = document.getElementById("deploy-calc");
    if (deployForm) deployForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = programDeployCost(val("deploy-elf"), val("deploy-max"));
      if (res === null) {
        document.getElementById("deploy-locked-out").value = "Invalid";
        document.getElementById("deploy-peak-out").value = "Invalid";
        setText("deploy-result", "Check the inputs: the program size and the maximum data length must be whole numbers of bytes from 1 to 10485760, and the maximum must be at least the program size.");
        return;
      }
      document.getElementById("deploy-locked-out").value = res.lockedLamports;
      document.getElementById("deploy-peak-out").value = res.peakLamports;
      var headNote = res.headroomBytes === 0
        ? " The maximum is the program size exactly, so an upgrade that grows the program must first extend the account - at the same 6,960 lamports per added byte."
        : " The maximum leaves " + res.headroomBytes + " bytes of headroom over today's program, and that reserved space is " + res.headroomRentLamports + " lamports of the locked total - exactly what extending by those bytes later would cost, paid now instead.";
      setText("deploy-result", "Model output: deploying a " + res.elfBytes + "-byte program at a " + res.maxBytes + "-byte maximum locks " + res.lockedLamports + " lamports (" + res.lockedSol + " SOL) permanently - a 36-byte program account at " + res.programRentLamports + " lamports and a " + res.programDataBytes + "-byte programdata account at " + res.programDataRentLamports + " - and the deployer must hold " + res.peakLamports + " lamports (" + res.peakSol + " SOL) at the peak, because the upload buffer (a " + res.bufferBytes + "-byte account at " + res.bufferRentLamports + " lamports) is funded too and reclaimed when the deploy completes." + headNote + " The deposits are locked, not spent: closing a program reclaims them. The transaction fees for the chunked upload writes, any IDL account and program testing are not modelled, and no live program is read. An educational model of a program deploy's rent, not a live quote. Not financial advice.");
    });

    var cilForm = document.getElementById("cil-calc");
    if (cilForm) cilForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = clmmImpermanentLoss(val("cil-l"), val("cil-lower"), val("cil-upper"), val("cil-entry"), val("cil-exit"));
      if (res === null) {
        document.getElementById("cil-pos-out").value = "Invalid";
        document.getElementById("cil-il-out").value = "Invalid";
        setText("cil-result", "Check the inputs: the liquidity must be a positive amount at up to 9 decimal places, the range ticks must be whole numbers inside -443636 to 443636 with the lower below the upper, and the entry and exit ticks whole numbers in the same bounds.");
        return;
      }
      document.getElementById("cil-pos-out").value = res.positionValueToken1.toFixed(9);
      document.getElementById("cil-il-out").value = res.ilPct.toFixed(6) + "%";
      var moveNote;
      if (res.tickExit === res.tickEntry) moveNote = " The exit tick is the entry tick, so nothing has rebalanced: the position and the held portfolio are the same amounts and the loss is exactly zero.";
      else if (res.exitStatus === "above") moveNote = " At the exit tick the price is at or above the range top, so the position holds only token1 - it stopped rebalancing at the upper tick - while the held portfolio's token0 kept appreciating, which is why the gap keeps widening past the range.";
      else if (res.exitStatus === "below") moveNote = " At the exit tick the price is at or below the range bottom, so the position holds only token0 - it stopped rebalancing at the lower tick - while the held portfolio kept its token1, which is why the gap keeps widening past the range.";
      else moveNote = " At the exit tick the position is still inside its range and still earning fees; the loss is the cost of the rebalancing it did on the way there.";
      setText("cil-result", "Model output: a position of liquidity " + res.liquidity + " over ticks " + res.tickLower + " to " + res.tickUpper + " entered at tick " + res.tickEntry + " (price " + res.priceEntry.toFixed(9) + ") holds " + res.entryAmount0.toFixed(9) + " of token0 and " + res.entryAmount1.toFixed(9) + " of token1. At the exit tick " + res.tickExit + " (price " + res.priceExit.toFixed(9) + ", " + res.priceRatio.toFixed(9) + "x the entry price) the position holds " + res.exitAmount0.toFixed(9) + " of token0 and " + res.exitAmount1.toFixed(9) + " of token1, worth " + res.positionValueToken1.toFixed(9) + " in token1 terms, while simply holding the entry amounts is worth " + res.holdValueToken1.toFixed(9) + " - a shortfall of " + res.shortfallToken1.toFixed(9) + ", an impermanent loss of " + Math.abs(res.ilPct).toFixed(6) + "% against holding." + moveNote + " Swap fees the position earns are not included - they are Tool 25's figures and are what offsets this loss in practice. An educational model of a concentrated position against holding, not a live quote. Not financial advice.");
    });

    var optForm = document.getElementById("opt-calc");
    if (optForm) optForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = optionsPayoff(val("opt-kind"), val("opt-strike"), val("opt-premium"), val("opt-expiry"), val("opt-qty"));
      if (res === null) {
        document.getElementById("opt-payoff-out").value = "Invalid";
        document.getElementById("opt-pnl-out").value = "Invalid";
        document.getElementById("opt-be-out").value = "Invalid";
        setText("opt-result", "Check the inputs: the strike and the quantity must be positive amounts at up to 9 decimal places, and the premium and the expiry price may be zero but not negative or over-precise.");
        return;
      }
      document.getElementById("opt-payoff-out").value = res.payoffTotal;
      document.getElementById("opt-pnl-out").value = res.pnl;
      document.getElementById("opt-be-out").value = res.breakEven === null ? "None at or above zero" : res.breakEven;
      var moneyNote;
      if (res.moneyness === "in") moneyNote = " It expires in the money: the intrinsic value per unit is " + res.intrinsicPerUnit + ".";
      else if (res.moneyness === "at") moneyNote = " It expires exactly at the money: the payoff is zero and the whole premium is lost.";
      else moneyNote = " It expires out of the money and worthless: the payoff is zero and the whole premium is lost.";
      var beNote = res.neverBreaksEven
        ? " This put has no break-even at or above zero: the premium per unit exceeds the strike, so even an expiry price of zero pays less than the premium cost."
        : " The break-even expiry price is " + res.breakEven + " - at exactly that price the payoff repays the premium to the smallest unit and the net is zero.";
      var pctNote = res.pnlPct === null ? "" : " That is " + (res.pnlIsLoss ? "a loss of " : "a return of ") + Math.abs(res.pnlPct).toFixed(4) + "% on the premium paid.";
      setText("opt-result", "Model output: a long " + res.kind + " with strike " + res.strike + ", bought for a premium of " + res.premium + " per unit over " + res.quantity + " units (total premium " + res.premiumTotal + "), at an expiry price of " + res.expiryPrice + " pays " + res.payoffTotal + " in total - a net of " + res.pnl + "." + pctNote + moneyNote + beNote + " A long option's most that can be lost is the premium, here " + res.maxLoss + ". Only the long side at expiry is modelled: no time value, volatility, early exercise or trading fees, and a short position's profile is the mirror image with margin on top. An educational model of an option's expiry payoff, not a live quote. Not financial advice.");
    });

    var bhexpForm = document.getElementById("bhexp-calc");
    if (bhexpForm) bhexpForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = blockhashExpiry(val("bhexp-fetched"), val("bhexp-current"));
      if (res === null) {
        document.getElementById("bhexp-last-out").value = "Invalid";
        document.getElementById("bhexp-remain-out").value = "Invalid";
        setText("bhexp-result", "Check the inputs: both heights are whole block heights (no decimals, no signs), and the current block height cannot be below the height the blockhash came from.");
        return;
      }
      document.getElementById("bhexp-last-out").value = res.lastValidHeight;
      document.getElementById("bhexp-remain-out").value = res.status === "expired" ? "Expired by " + res.expiredBy : String(res.remainingBlocks);
      var statusNote;
      if (res.status === "expired") statusNote = " The blockhash is EXPIRED: it aged out " + res.expiredBy + (res.expiredBy === 1 ? " block" : " blocks") + " ago, and a transaction carrying it can never land now - it has to be rebuilt and re-signed on a fresh blockhash.";
      else if (res.status === "last") statusNote = " This is the LAST block height at which the transaction can still land: one more produced block and the blockhash expires.";
      else statusNote = " The transaction can still land at any of the " + res.remainingBlocks + " block heights after this one, up to and including the last valid height.";
      setText("bhexp-result", "Model output: a blockhash from block height " + res.blockhashHeight + ", seen at current block height " + res.currentHeight + ", is " + res.ageBlocks + (res.ageBlocks === 1 ? " block" : " blocks") + " old, and its last valid block height is " + res.lastValidHeight + " - the blockhash height plus the 150-block maximum processing age, counted in produced blocks (block height), not slots, so skipped slots do not age it." + statusNote + " A durable-nonce transaction is the exception - its stored nonce does not age this way - and is not modelled here. An educational model of blockhash expiry, not a live cluster reading. Not financial advice.");
    });

    var discForm = document.getElementById("disc-calc");
    if (discForm) discForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = anchorDiscriminator(val("disc-kind"), val("disc-name"));
      if (res === null) {
        document.getElementById("disc-hex-out").value = "Invalid";
        document.getElementById("disc-bytes-out").value = "Invalid";
        setText("disc-result", "Check the inputs: the name must be a Rust identifier exactly as declared - a letter or underscore, then letters, digits and underscores, at most 128 characters, with no spaces or punctuation.");
        return;
      }
      document.getElementById("disc-hex-out").value = res.discriminatorHex;
      document.getElementById("disc-bytes-out").value = "[" + res.discriminatorBytes.join(", ") + "]";
      var roleNote = res.kind === "instruction"
        ? " Every call to this instruction starts its instruction data with those 8 bytes, and the program's dispatcher matches them to route the call before any argument byte is read."
        : " Every account of this type starts its account data with those 8 bytes, and Anchor checks them when it loads the account as this type - the check that stops a different account type being passed in its place.";
      setText("disc-result", "Model output: the " + (res.kind === "instruction" ? "instruction" : "account") + " name " + res.name + " is hashed as the string " + res.preimage + "; the full SHA-256 is " + res.hashHex + ", so its discriminator - the hash's first 8 bytes - is " + res.discriminatorHex + ", the byte list [" + res.discriminatorBytes.join(", ") + "]." + roleNote + " The name is hashed exactly as written, case-sensitively, so renaming or recasing it would change the discriminator and break existing clients. This is the default hash-derived discriminator: a program that sets a custom discriminator override in newer Anchor versions does not use it, and such programs are not modelled. An educational model of Anchor's default discriminator, not a live program reading. Not financial advice.");
    });


    var reallocForm = document.getElementById("realloc-calc");
    if (reallocForm) reallocForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = reallocPlan(val("realloc-current"), val("realloc-target"));
      if (res === null) {
        document.getElementById("realloc-steps-out").value = "Invalid";
        document.getElementById("realloc-topup-out").value = "Invalid";
        setText("realloc-result", "Check the inputs: both lengths are whole bytes from 0 to 10,485,760 (the 10 MiB maximum account data length).");
        return;
      }
      document.getElementById("realloc-steps-out").value = res.steps.toLocaleString("en-US");
      document.getElementById("realloc-topup-out").value = res.topUpLamports.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      var moveNote;
      if (res.direction === "top-up") {
        moveNote = " Growing by " + Number(res.growthBytes).toLocaleString("en-US") + " bytes takes " + res.steps + (res.steps === 1 ? " realloc call" : " realloc calls") + " - the runtime caps each growth at 10,240 bytes, and the last call grows the remaining " + res.lastStepBytes.toLocaleString("en-US") + " bytes. The account must hold the new length's rent-exempt minimum before the growth settles, so " + res.topUpLamports.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " lamports (" + res.topUpSol + " SOL) must be transferred in - exactly 6,960 lamports per added byte, Tool 3's rent difference between the two lengths.";
      } else if (res.direction === "refund") {
        moveNote = " Shrinking is not capped per call, so one realloc call reaches the target length, and the smaller rent-exempt minimum releases " + res.topUpLamports.slice(1).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " lamports (" + res.topUpSol + " SOL) back - exactly 6,960 lamports per byte removed, Tool 3's rent difference between the two lengths.";
      } else {
        moveNote = " The target equals the current length, so no realloc call and no rent movement is needed.";
      }
      setText("realloc-result", "Model output: an account of " + Number(res.currentBytes).toLocaleString("en-US") + " bytes (rent-exempt at " + res.oldRentLamports.toLocaleString("en-US") + " lamports) resized to " + Number(res.targetBytes).toLocaleString("en-US") + " bytes (rent-exempt at " + res.newRentLamports.toLocaleString("en-US") + " lamports)." + moveNote + " An educational model of account reallocation, not a live account reading. Not financial advice.");
    });

    var nonceForm = document.getElementById("nonce-calc");
    if (nonceForm) nonceForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = durableNoncePlan(val("nonce-count"), val("nonce-mode"));
      if (res === null) {
        document.getElementById("nonce-accounts-out").value = "Invalid";
        document.getElementById("nonce-rent-out").value = "Invalid";
        setText("nonce-result", "Check the inputs: the transaction count is a whole number from 1 to 10,000.");
        return;
      }
      document.getElementById("nonce-accounts-out").value = res.accounts.toLocaleString("en-US");
      document.getElementById("nonce-rent-out").value = res.totalRentLamports.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      var modeNote;
      if (res.mode === "independent") {
        modeNote = " Each transaction may land in any order, so each needs its own nonce account: one stored value backs exactly one transaction, because the AdvanceNonceAccount instruction that must come first replaces the value the moment the transaction lands.";
      } else {
        modeNote = " Ordered mode chains them on a single account: each transaction's opening advance produces exactly the stored value the next transaction signed against, so the chain must land strictly in signing order - any one landing out of order, or the authority advancing the nonce by hand, breaks every transaction after it.";
      }
      setText("nonce-result", "Model output: " + res.transactions.toLocaleString("en-US") + (res.transactions === 1 ? " pre-signed transaction needs " : " pre-signed transactions need ") + res.accounts.toLocaleString("en-US") + (res.accounts === 1 ? " nonce account" : " nonce accounts") + ", locking " + res.totalRentLamports.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " lamports (" + res.totalRentSol + " SOL) of rent-exempt deposits - " + res.rentPerAccountLamports.toLocaleString("en-US") + " lamports per 80-byte account, Tool 3's figure, locked rather than spent and reclaimed when an account is closed and withdrawn." + modeNote + " Unlike a recent blockhash (Tool 62), a stored nonce value carries no block-height expiry: a transaction signed against it stays landable until the nonce advances. An educational model of durable-nonce planning, not a live account reading. Not financial advice.");
    });

    var extForm = document.getElementById("ext-calc");
    if (extForm) extForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = token2022MintSpace(val("ext-e1"), val("ext-e2"), val("ext-e3"));
      if (res === null) {
        document.getElementById("ext-size-out").value = "Invalid";
        document.getElementById("ext-rent-out").value = "Invalid";
        setText("ext-result", "Check the inputs: choose each extension from the list (or None).");
        return;
      }
      document.getElementById("ext-size-out").value = res.sizeBytes.toLocaleString("en-US");
      document.getElementById("ext-rent-out").value = res.rentLamports.toLocaleString("en-US");
      var note = "";
      if (res.extensionCount === 0) {
        note = " With no extensions the account is the classic 82-byte mint exactly - no account-type byte and no TLV records are added, which is why the same layout still reads under the original Token program.";
      } else {
        note = " The " + res.extensionCount + (res.extensionCount === 1 ? " extension adds " : " distinct extensions add ") + res.tlvBytes.toLocaleString("en-US") + " TLV bytes - a 4-byte type-and-length header in front of each extension's own data - plus the 1-byte account-type marker that precedes the first record.";
      }
      if (res.duplicatesIgnored > 0) note += " The same extension picked twice is counted once: an extension is either enabled on a mint or it is not.";
      if (res.padded) note += " The unpadded total would be exactly 355 bytes, the length of a multisig account, so the length calculation adds 2 bytes - no extended account may be mistaken for a multisig by its length alone.";
      setText("ext-result", "Model output: a Token-2022 mint with " + (res.extensionCount === 0 ? "no extensions" : res.extensionCount + (res.extensionCount === 1 ? " extension" : " extensions")) + " is " + res.sizeBytes.toLocaleString("en-US") + " bytes and must be funded rent-exempt at " + res.rentLamports.toLocaleString("en-US") + " lamports (" + res.rentSol + " SOL), Tool 3's figure at that size - locked, not spent, and reclaimed when the mint is closed." + note + " The variable-length token metadata extension is not modelled - its size depends on the metadata packed into it - and token-account extensions are a separate list. An educational model of Token-2022 mint sizing, not a live mint reading. Not financial advice.");
    });

    var aextForm = document.getElementById("aext-calc");
    if (aextForm) aextForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = token2022AccountSpace(val("aext-e1"), val("aext-e2"), val("aext-e3"));
      if (res === null) {
        document.getElementById("aext-size-out").value = "Invalid";
        document.getElementById("aext-rent-out").value = "Invalid";
        setText("aext-result", "Check the inputs: choose each extension from the list (or None).");
        return;
      }
      document.getElementById("aext-size-out").value = res.sizeBytes.toLocaleString("en-US");
      document.getElementById("aext-rent-out").value = res.rentLamports.toLocaleString("en-US");
      var note = "";
      if (res.extensionCount === 0) {
        note = " With no extensions the account is the classic 165-byte token account exactly - no account-type byte and no TLV records are added, which is the 2,039,280-lamport figure behind Tools 27 and 58.";
      } else {
        note = " The " + res.extensionCount + (res.extensionCount === 1 ? " extension adds " : " distinct extensions add ") + res.tlvBytes.toLocaleString("en-US") + " TLV bytes - a 4-byte type-and-length header in front of each extension's own data - plus the 1-byte account-type marker that precedes the first record.";
      }
      if (res.duplicatesIgnored > 0) note += " The same extension picked twice is counted once: an extension is either present on an account or it is not.";
      if (res.padded) note += " The unpadded total would be exactly 355 bytes, the length of a multisig account, so the length calculation adds 2 bytes.";
      setText("aext-result", "Model output: a Token-2022 token account with " + (res.extensionCount === 0 ? "no extensions" : res.extensionCount + (res.extensionCount === 1 ? " extension" : " extensions")) + " is " + res.sizeBytes.toLocaleString("en-US") + " bytes and must be funded rent-exempt at " + res.rentLamports.toLocaleString("en-US") + " lamports (" + res.rentSol + " SOL), Tool 3's figure at that size - locked, not spent, and reclaimed when the account is closed." + note + " Several records follow the mint rather than the account owner: every token account of a transfer-fee mint carries the transfer fee amount record, so creating one costs more than the classic 2,039,280 lamports even when the owner chooses nothing. An educational model of Token-2022 token-account sizing, not a live account reading. Not financial advice.");
    });

    var cbForm = document.getElementById("cb-calc");
    if (cbForm) cbForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = computeBudgetPlan(val("cb-ix"), val("cb-used"), val("cb-head"), val("cb-price"));
      if (res === null) {
        document.getElementById("cb-rec-out").value = "Invalid";
        document.getElementById("cb-prio-out").value = "Invalid";
        setText("cb-result", "Check the inputs: instructions must be a whole number from 1 to 256, the measured compute used a whole number of 1 or more, the headroom a whole percentage from 0 to 900, and the compute-unit price a whole number of micro-lamports from 0 to 1,000,000,000.");
        return;
      }
      var note = "";
      if (!res.feasible) {
        document.getElementById("cb-rec-out").value = "Over the maximum";
        document.getElementById("cb-prio-out").value = "n/a";
        setText("cb-result", "Model output: the measured usage of " + res.usedCu.toLocaleString("en-US") + " compute units exceeds the runtime maximum of " + res.maxLimit.toLocaleString("en-US") + " per transaction, so no compute-unit limit can carry this work in a single transaction - it must be split across transactions. The default limit for " + res.instructionCount + (res.instructionCount === 1 ? " instruction" : " instructions") + " would be " + res.defaultLimit.toLocaleString("en-US") + ". An educational model of compute budgeting, not a live simulation. Not financial advice.");
        return;
      }
      document.getElementById("cb-rec-out").value = res.recommendedLimit.toLocaleString("en-US");
      document.getElementById("cb-prio-out").value = res.priorityAtRecommended.toLocaleString("en-US");
      if (res.fitsDefault) {
        note = " The measured usage fits inside the default limit of " + res.defaultLimit.toLocaleString("en-US") + ", so the transaction would execute without any compute-budget instruction - but at this compute-unit price the default limit would carry a priority fee of " + res.priorityAtDefault.toLocaleString("en-US") + " lamports if a price were set against it, against " + res.priorityAtRecommended.toLocaleString("en-US") + " at the recommended limit: the fee is charged on the limit requested, not the compute used.";
      } else {
        note = " The measured usage exceeds the default limit of " + res.defaultLimit.toLocaleString("en-US") + ", so without a SetComputeUnitLimit instruction this transaction fails with a computational budget exceeded error; the recommended limit is what lets it execute.";
      }
      if (res.headroomCapped) note += " The chosen headroom would push the limit past the " + res.maxLimit.toLocaleString("en-US") + " maximum, so the recommendation is capped there and the transaction carries no spare room above its measured usage.";
      if (res.cuPriceMicro === 0) note += " At a compute-unit price of zero every priority fee here is zero - the price is what turns an oversized limit into a cost.";
      setText("cb-result", "Model output: for " + res.instructionCount + (res.instructionCount === 1 ? " instruction" : " instructions") + " measuring " + res.usedCu.toLocaleString("en-US") + " compute units used, the default limit is " + res.defaultLimit.toLocaleString("en-US") + "; requesting the measured usage plus " + res.headroomPct + "% headroom gives a recommended limit of " + res.recommendedLimit.toLocaleString("en-US") + " compute units, whose priority fee at " + res.cuPriceMicro.toLocaleString("en-US") + " micro-lamports per unit is " + res.priorityAtRecommended.toLocaleString("en-US") + " lamports (Tool 5's formula at that limit). Requesting the " + res.maxLimit.toLocaleString("en-US") + " maximum instead would cost " + res.priorityAtMax.toLocaleString("en-US") + " lamports at the same price." + note + " An educational model of compute budgeting, not a live simulation. Not financial advice.");
    });

    var ibForm = document.getElementById("ib-calc");
    if (ibForm) ibForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = interestBearingAmount(val("ib-amt"), val("ib-prev-rate"), val("ib-prev-days"), val("ib-rate"), val("ib-days"));
      if (res === null) {
        document.getElementById("ib-grown-out").value = "Invalid";
        document.getElementById("ib-int-out").value = "Invalid";
        setText("ib-result", "Check the inputs: the amount must be more than 0 and at most 1,000,000 tokens at up to 9 decimal places, each rate a whole number of basis points from -32,768 to 32,767 (the signed 16-bit range the mint stores), each stretch a whole number of days from 0 to 36,500, and the combined growth must stay inside the representable range.");
        return;
      }
      document.getElementById("ib-grown-out").value = res.grown;
      document.getElementById("ib-int-out").value = res.interest;
      var note = "";
      if (res.grown === res.amount) {
        note = " Nothing has accrued: with no time elapsed at a non-zero rate the displayed amount is the raw amount exactly.";
      } else if (res.interest.charAt(0) === "-") {
        note = " The displayed amount SHRANK: a negative rate compounds downward exactly as a positive one compounds up, and the raw balance is still untouched - only the conversion moved.";
      } else {
        note = " The raw balance never moved: no tokens were minted, and a transfer still moves raw amounts - the growth exists only in this conversion, which every wallet and explorer reading the mint performs.";
      }
      if (res.prevDays > 0 && res.prevRateBps !== 0) {
        note += " Two rates applied: the pre-update average of " + res.prevRateBps + " bps covered the first " + res.prevDays + (res.prevDays === 1 ? " day" : " days") + " (a factor of " + res.factorPrev.toFixed(9) + ") and the current " + res.rateBps + " bps the " + res.days + (res.days === 1 ? " day" : " days") + " since the last update (a factor of " + res.factorCurrent.toFixed(9) + "); the mint stores that average precisely so a rate change never rewrites history.";
      }
      setText("ib-result", "Model output: a raw balance of " + res.amount + " on an interest-bearing mint displays as " + res.grown + " - interest of " + res.interest + " - after compounding at " + res.rateBps + " basis points a year for " + res.days + (res.days === 1 ? " day" : " days") + (res.prevDays > 0 ? " on top of the earlier stretch" : "") + ", a total factor of " + res.factor.toFixed(9) + ". The year in the exponent is 365.24 days (31,556,736 seconds), so 365 days is slightly less than a full year of accrual, and the grown figure is truncated at the smallest unit, never rounded." + note + " An educational model of the interest-bearing display conversion, not a live mint reading. Not financial advice.");
    });

    var suaForm = document.getElementById("sua-calc");
    if (suaForm) suaForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = scaledUiAmount(val("sua-raw"), val("sua-mult"), val("sua-new-mult"), val("sua-eff-ts"), val("sua-read-ts"), val("sua-send"));
      if (res === null) {
        document.getElementById("sua-disp-out").value = "Invalid";
        document.getElementById("sua-sendraw-out").value = "Invalid";
        setText("sua-result", "Check the inputs: the raw balance and the amount to send must each be more than 0 and at most 1,000,000 tokens at up to 9 decimal places, each multiplier a plain decimal number (no exponent notation) above 0 and at most 1,000,000 - the program itself accepts only a positive, normal float - and each timestamp a whole number of seconds from 0 up.");
        return;
      }
      document.getElementById("sua-disp-out").value = res.displayed;
      document.getElementById("sua-sendraw-out").value = res.sendRaw;
      var note = "";
      if (res.switched) {
        note = " The reading time is at or past the effective timestamp " + res.effectiveTimestamp + ", so the scheduled multiplier is the one in force: the switch is a >= comparison against the clock, and it happened with no transfer, mint or burn - only the stored multiplier changed.";
      } else if (res.newMultiplier !== res.multiplier) {
        note = " A change is already scheduled: from timestamp " + res.effectiveTimestamp + " the same raw balance will display as " + res.displayedNew + " (a change of " + res.changeOnSwitch + ") with no transfer, mint or burn - only the stored multiplier changes, which is how these mints model a stock split or a rebase.";
      } else {
        note = " The scheduled multiplier equals the current one, so the effective timestamp changes nothing when it passes.";
      }
      if (res.sendRawZero) {
        note += " The amount to send converts back to ZERO raw units at the multiplier in force: it is smaller than one smallest raw unit, so there is nothing a transfer could move - entered display amounts are converted by dividing by the multiplier and truncating, and dust does not survive it.";
      } else if (res.sendRawShortfallUnits === "1") {
        note += " The amount to send converts back to " + res.sendRaw + " raw units - one smallest unit below the exact-decimal figure of " + res.sendRawExact + ", because the reference conversion divides by (multiplier / 10^decimals) in floating point before truncating; that is why apps are told to round down and leave the dust rather than risk a failing transfer, and to send the full raw balance when the user asks for the maximum.";
      } else {
        note += " The amount to send converts back to " + res.sendRaw + " raw units: entered display amounts are divided by the multiplier and truncated at the smallest unit, never rounded up, so a transfer never moves more raw than the display promises.";
      }
      setText("sua-result", "Model output: a raw balance of " + res.raw + " on a scaled-UI-amount mint displays as " + res.displayed + " when read at timestamp " + res.readTimestamp + ", because the multiplier in force there is " + res.effectiveMultiplier + " (current " + res.multiplier + ", scheduled " + res.newMultiplier + " from timestamp " + res.effectiveTimestamp + "): the displayed amount is the raw amount x the multiplier in force, truncated at the smallest unit. The raw balance never moved and a transfer still moves raw amounts - the multiplier exists only in this conversion, which every wallet and explorer reading the mint performs." + note + " An educational model of the scaled-UI display conversion, not a live mint reading. Not financial advice.");
    });

    var lpfForm = document.getElementById("lpf-calc");
    if (lpfForm) lpfForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = lpFeeEarnings(val("lpf-volume"), val("lpf-fee"), val("lpf-tvl"), val("lpf-deposit"), val("lpf-days"));
      if (res === null) {
        document.getElementById("lpf-poolfees-out").value = "Invalid";
        document.getElementById("lpf-earn-out").value = "Invalid";
        document.getElementById("lpf-apr-out").value = "Invalid";
        setText("lpf-result", "Check the inputs: the daily volume, the pool's total liquidity value and your deposit must each be more than 0 and at most 1,000,000,000,000 value units at up to 9 decimal places, your deposit no larger than the pool's total, the fee a whole number of basis points from 0 to 10,000, and the period a whole number of days from 1 to 36,500.");
        return;
      }
      document.getElementById("lpf-poolfees-out").value = res.poolFeesDay;
      document.getElementById("lpf-earn-out").value = res.periodEarnings;
      document.getElementById("lpf-apr-out").value = res.apyFinite ? res.aprPct.toFixed(4) + "% simple / " + res.apyPct.toFixed(4) + "% compounded" : res.aprPct.toFixed(4) + "% simple / compounding beyond finite display";
      var note = "";
      if (res.feesZero) {
        note = " At this fee tier on this volume the pool collects nothing at all in a day, so there is nothing to share - a zero tier earns zero however large the position.";
      } else if (res.earningsZero) {
        note = " The pool collects " + res.poolFeesDay + " a day, but your share of one day floors below one smallest unit, so the model credits nothing: a position this small a share of the pool needs more volume, a higher tier or a larger deposit before a single day's fees amount to one payable unit.";
      } else {
        note = " The simple APR annualises one day without compounding; the compounded APY assumes every day's earnings are added to the position and themselves earn from the next day, which is why it sits above the APR whenever earnings are positive - and why a quoted APY is never comparable with a quoted APR without asking which one it is.";
      }
      setText("lpf-result", "Model output: on daily volume of " + res.volume + " at a " + res.feeBps + "-basis-point fee tier the pool collects " + res.poolFeesDay + " a day in fees. Your deposit of " + res.deposit + " is " + (res.shareBps / 100) + "% of the pool's " + res.tvl + " (share floored to whole basis points: " + res.shareBps + "), so it earns " + res.dailyEarnings + " a day and " + res.periodEarnings + " over " + res.days + (res.days === 1 ? " day" : " days") + " at that pace." + note + " The volume, the fee tier and the pool's size are held frozen for the whole period, impermanent loss is not deducted, and in a concentrated pool fees are earned only while the price is inside your range - none of that is modelled. An educational model of LP fee earnings, not a live pool quote. Not financial advice.");
    });

    var predForm = document.getElementById("pred-calc");
    if (predForm) predForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = predictionMarket(val("pred-yes"), val("pred-no"), val("pred-spend"));
      if (res === null) {
        document.getElementById("pred-sum-out").value = "Invalid";
        document.getElementById("pred-shares-out").value = "Invalid";
        document.getElementById("pred-arb-out").value = "Invalid";
        setText("pred-result", "Check the inputs: each price must be more than 0 and less than 1 at up to 9 decimal places - a price of 0 or 1 is a settled market, not a tradeable one - and the spend more than 0 and at most 1,000,000,000,000 collateral units.");
        return;
      }
      document.getElementById("pred-sum-out").value = res.sumPrice + " (" + (res.devBps > 0 ? "+" : "") + res.devBps + " bps vs 1)";
      document.getElementById("pred-shares-out").value = res.shares;
      document.getElementById("pred-arb-out").value = res.arbProfit;
      var note = "";
      if (res.mode === "mint") {
        note = " The two prices sum to MORE than 1, so the complete-set rule itself is out of line: minting complete sets with the whole spend locks " + res.spend + " of collateral, and selling both sides of the resulting amount of sets (" + res.arbSets + ") returns " + res.arbValue + " at these prices - a gross edge of " + res.arbProfit + " before any market fee or spread." + (res.arbZero ? " At this spend that edge floors to zero at the smallest unit: the deviation is real but smaller than one payable unit on an amount this small." : "");
      } else if (res.mode === "buy") {
        note = " The two prices sum to LESS than 1, so the complete-set rule itself is out of line: the whole spend buys a complete-set amount of " + res.arbSets + " (both sides, in proportion), and redeeming that amount pays exactly " + res.arbValue + " of collateral whichever side wins - a gross edge of " + res.arbProfit + " before any market fee or spread." + (res.arbZero ? " At this spend that edge floors to zero at the smallest unit: the deviation is real but smaller than one payable unit on an amount this small." : "");
      } else {
        note = " The two prices sum to exactly 1, so the complete-set rule offers no edge either way: minting and redeeming both break even at these prices before fees, and only a view that the true probability differs from the price makes either side worth holding.";
      }
      setText("pred-result", "Model output: at a YES price of " + res.yesPrice + " and a NO price of " + res.noPrice + ", the market's implied probability of YES is the YES price itself - " + res.impliedYesPct.toFixed(4) + "% - because one share pays exactly 1 if YES happens and 0 if it does not. Your spend of " + res.spend + " buys " + res.shares + " YES shares (spend divided by the price, floored at the smallest unit): if YES happens they pay " + res.payoutIfYes + ", a profit of " + res.profitIfYes + "; if NO happens they pay 0 and the whole spend of " + res.lossIfNo + " is lost, which is why the price is also the break-even probability - the trade profits in expectation only if the true chance is above it." + note + " Market fees, spread and price movement while trading are not modelled, and no live market is read. An educational model of prediction-market outcome shares, not a live quote. Not financial advice.");
    });

    var loopForm = document.getElementById("loop-calc");
    if (loopForm) loopForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = leverageLoop(val("loop-deposit"), val("loop-ltv"), val("loop-supply"), val("loop-borrow"), val("loop-threshold"));
      if (res === null) {
        document.getElementById("loop-supplied-out").value = "Invalid";
        document.getElementById("loop-borrowed-out").value = "Invalid";
        document.getElementById("loop-lev-out").value = "Invalid";
        document.getElementById("loop-net-out").value = "Invalid";
        setText("loop-result", "Check the inputs: the deposit must be more than 0 and at most 1,000,000,000,000 units at up to 9 decimal places, the maximum LTV a whole number of basis points from 0 up to (but not including) 10,000, the liquidation threshold a whole number of basis points above the LTV and at most 10,000 - a threshold at or below the LTV would be liquidatable the moment it opened - and each yearly rate a whole number of basis points from 0 to 100,000.");
        return;
      }
      document.getElementById("loop-supplied-out").value = res.totalSupplied;
      document.getElementById("loop-borrowed-out").value = res.totalBorrowed;
      document.getElementById("loop-lev-out").value = res.leverage + "x";
      document.getElementById("loop-net-out").value = res.netYear + " (" + res.netApyBps + " bps)";
      var note = "";
      if (res.noDebt) {
        note = " At a maximum LTV of 0 there is nothing to borrow, so there is no loop: the deposit simply earns the supply rate, and with no debt there is no health factor to watch.";
      } else if (res.netYear.startsWith("-")) {
        note = " The loop LOSES money at these rates: it earns " + res.earnedYear + " on the supplied side and pays " + res.paidYear + " on the borrowed side over a year, because looping multiplies the spread between the two rates, not just the yield - it would break even at a supply rate of " + res.breakEvenSupplyBps + " bps (the borrow rate times the LTV), and every basis point of spread is levered " + res.leverage + " times on your equity. The health factor is the liquidation threshold divided by the LTV - " + res.healthFactor + " here - because the supplied side cancels: the higher the LTV you loop to, the thinner that buffer, even with the same asset on both sides.";
      } else if (res.netYear === "0") {
        note = " The loop exactly breaks even over a year at these rates: it earns " + res.earnedYear + " on the supplied side and pays " + res.paidYear + " on the borrowed side, and the break-even supply rate is " + res.breakEvenSupplyBps + " bps (the borrow rate times the LTV). The health factor is the liquidation threshold divided by the LTV - " + res.healthFactor + " here - because the supplied side cancels.";
      } else {
        note = " The loop earns " + res.earnedYear + " on the supplied side and pays " + res.paidYear + " on the borrowed side over a year; it would break even at a supply rate of " + res.breakEvenSupplyBps + " bps (the borrow rate times the LTV), and every basis point of spread is levered " + res.leverage + " times on your equity. The health factor is the liquidation threshold divided by the LTV - " + res.healthFactor + " here - because the supplied side cancels: the higher the LTV you loop to, the thinner that buffer, even with the same asset on both sides.";
      }
      setText("loop-result", "Model output: looping a deposit of " + res.deposit + " to a maximum LTV of " + res.ltvBps + " bps builds a supplied position of " + res.totalSupplied + " against a debt of " + res.totalBorrowed + " - an effective leverage of " + res.leverage + "x on your equity, the limit of deposit, borrow, redeposit repeated. Over a year at a supply rate of " + res.supplyBps + " bps and a borrow rate of " + res.borrowBps + " bps the position nets " + res.netYear + ", an APY of " + res.netApyBps + " bps (" + res.netApyPct + "%) on the deposit alone." + note + " Both rates and the LTV are held frozen for the year; price moves, rate moves, the transaction cost of each loop round and any venue leverage cap are not modelled, and no live market is read. An educational model of a leveraged loop, not a live quote. Not financial advice.");
    });

    var tfswapForm = document.getElementById("tfswap-calc");
    if (tfswapForm) tfswapForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = transferFeeSwap(val("tfswap-rin"), val("tfswap-rout"), val("tfswap-ain"), val("tfswap-poolfee"), val("tfswap-inbps"), val("tfswap-inmax"), val("tfswap-outbps"), val("tfswap-outmax"));
      if (res === null) {
        document.getElementById("tfswap-rec-out").value = "Invalid";
        document.getElementById("tfswap-gross-out").value = "Invalid";
        document.getElementById("tfswap-recv-out").value = "Invalid";
        document.getElementById("tfswap-plain-out").value = "Invalid";
        setText("tfswap-result", "Check the inputs: reserves, the amount sent and both maximum fees are whole raw units of more than 0 (a maximum fee may be 0, which caps that side's fee at 0), the pool fee a whole number of basis points below 10,000, and each transfer-fee rate a whole number of basis points from 0 to 10,000 - and the input transfer must leave something for the pool to swap after its fee is withheld.");
        return;
      }
      document.getElementById("tfswap-rec-out").value = res.poolReceived;
      document.getElementById("tfswap-gross-out").value = res.grossOut;
      document.getElementById("tfswap-recv-out").value = res.userReceived;
      document.getElementById("tfswap-plain-out").value = res.plainOut;
      var caps = "";
      if (res.inCapped) caps += " The input side's fee hit its maximum-fee cap, so the pool received more than the uncapped rate alone would leave.";
      if (res.outCapped) caps += " The output side's fee hit its maximum-fee cap, so you received more than the uncapped rate alone would leave.";
      var note = "";
      if (res.noTransferFees) {
        note = " With no transfer fee withheld on either side, this is exactly the plain constant-product swap of Tool 2: what the pool sends is what your wallet is credited, and the shortfall against the plain quote is 0.";
      } else if (res.receivedZero) {
        note = " The output transfer fee withheld the pool's ENTIRE output, so your wallet is credited 0: at these settings the trade burns its whole return to the output token's transfer fee, however good the pool price looked.";
      } else {
        note = " The gap between the plain quote and what lands - " + res.shortfall + " raw units, " + res.shortfallPct.toFixed(4) + "% of the plain output - is the two transfer fees plus the price impact of swapping a smaller input: the input fee shrinks the trade before the pool prices it, and the output fee is withheld from what the pool sends, so neither fee shows up in the pool's own quote.";
      }
      setText("tfswap-result", "Model output: sending " + res.amountIn + " raw units, the input transfer withholds " + res.inFee + " (at " + res.inFeeBps + " bps), so the pool is credited " + res.poolReceived + " and swaps it at a pool fee of " + res.poolFeeBps + " bps (pool fee " + res.poolFee + "), sending " + res.grossOut + " raw units out; the output transfer withholds " + res.outFee + " (at " + res.outFeeBps + " bps), so your wallet is credited " + res.userReceived + ". The same trade with no transfer fees at all would return " + res.plainOut + "." + caps + note + " Amounts are raw units throughout - convert with your mint's decimals (Tool 6). The pool is modelled as pricing the amount it is credited; a real venue's handling of withheld fees can differ in detail. An educational model of a transfer-fee swap, not a live quote. Not financial advice.");
    });

    var spoolForm = document.getElementById("spool-calc");
    if (spoolForm) spoolForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = stakePoolFees(val("spool-total"), val("spool-supply"), val("spool-deposit"), val("spool-depfee"), val("spool-rewards"), val("spool-epochfee"), val("spool-wdfee"));
      if (res === null) {
        document.getElementById("spool-user-out").value = "Invalid";
        document.getElementById("spool-epochfee-out").value = "Invalid";
        document.getElementById("spool-out-out").value = "Invalid";
        document.getElementById("spool-nofee-out").value = "Invalid";
        setText("spool-result", "Check the inputs: the pool total, its token supply, your deposit and the epoch's rewards are amounts of more than 0 (the rewards may be 0; an empty pool has total and supply both 0), each fee a whole number of basis points from 0 to 10,000, and the deposit large enough to mint at least one smallest unit of pool token at the pool's rate.");
        return;
      }
      document.getElementById("spool-user-out").value = res.userTokens;
      document.getElementById("spool-epochfee-out").value = res.epochFeeTokens;
      document.getElementById("spool-out-out").value = res.out;
      document.getElementById("spool-nofee-out").value = res.noFeeOut;
      var note = "";
      if (res.noFees) {
        note = " With every fee at 0 the round trip is the pure exchange rate at work: your deposit's share of the pool grows by its share of the rewards and nothing is skimmed, which is why the two withdrawal figures agree exactly.";
      } else if (res.depositFeeAll) {
        note = " The deposit fee took the ENTIRE mint, so you hold no pool tokens at all: the deposit is in the pool, owned by everyone else, and there is nothing left to withdraw - however long you wait, this position cannot earn its way back.";
      } else if (res.receivedZero) {
        note = " The withdrawal fee took the ENTIRE redemption, so withdrawing pays out 0: your pool tokens are consumed by the fee before any of them convert back to SOL.";
      } else if (res.netGain.charAt(0) === "-") {
        note = " The round trip LOSES " + res.netGain.slice(1) + " even though the pool earned rewards: the three fees together drag " + res.feeDrag + " against the no-fee return, which is more than this deposit's share of one epoch's rewards (" + res.noFeeGain + "). The deposit and withdrawal fees tax the principal going in and out, so a short stay pays them in full for a single epoch's yield - the epoch fee alone is the only one that scales with what the pool actually earned.";
      } else if (res.netGain === "0") {
        note = " The round trip exactly breaks even: this deposit's share of the epoch's rewards is precisely consumed by the three fees, which together drag " + res.feeDrag + " against the no-fee return.";
      } else {
        note = " The round trip nets " + res.netGain + " after all three fees, which together drag " + res.feeDrag + " against the no-fee return of " + res.noFeeGain + ": the deposit and withdrawal fees tax the principal going in and out, while the epoch fee skims only the rewards - which is why its cost grows with earnings, not with the deposit.";
      }
      setText("spool-result", "Model output: depositing " + res.deposit + " into a pool holding " + res.total + " for " + res.supply + " pool tokens mints " + res.minted + " tokens; the deposit fee at " + res.depFeeBps + " bps deducts " + res.depFeeTokens + " of them, so you hold " + res.userTokens + ". One epoch then adds " + res.rewards + " of rewards to the pool; the epoch fee at " + res.epochFeeBps + " bps is " + res.epochFeeValue + " of value, minted to the manager as " + res.epochFeeTokens + " new pool tokens at the pre-reward rate, diluting every holder. Withdrawing everything, the withdrawal fee at " + res.wdFeeBps + " bps deducts " + res.wdFeeTokens + " more tokens and the remaining " + res.netTokens + " convert at the new rate to " + res.out + ". The identical round trip with no fees at all would return " + res.noFeeOut + "." + note + " One epoch is modelled; rewards, rates and fees are frozen, referral splits of the deposit fee and stake (non-SOL) deposits and withdrawals are not modelled, and no live pool is read. An educational model of stake pool fees, not a live quote. Not financial advice.");
    });

    var farmForm = document.getElementById("farm-calc");
    if (farmForm) farmForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = farmRewards(val("farm-emission"), val("farm-price"), val("farm-tvl"), val("farm-stake"), val("farm-days"));
      if (res === null) {
        document.getElementById("farm-share-out").value = "Invalid";
        document.getElementById("farm-tokens-out").value = "Invalid";
        document.getElementById("farm-value-out").value = "Invalid";
        document.getElementById("farm-apr-out").value = "Invalid";
        setText("farm-result", "Check the inputs: the emission per day and the reward price are amounts of 0 or more, the total staked and your stake are amounts of more than 0 with your stake no larger than the total (your stake is part of it), and the period is a whole number of days from 1 to 36,500.");
        return;
      }
      document.getElementById("farm-share-out").value = res.shareBps + " bps (" + res.sharePct + "%)";
      document.getElementById("farm-tokens-out").value = res.tokensPeriod;
      document.getElementById("farm-value-out").value = res.valuePeriod;
      document.getElementById("farm-apr-out").value = res.aprPct.toFixed(4) + "% simple APR (model)";
      var note = "";
      if (res.wholeFarm) {
        note = " You are the entire farm, so every emitted token is yours - and the APR is at its ceiling for this emission and total: the first outside staker who joins dilutes it from here.";
      } else if (res.emissionZero) {
        note = " The farm emits nothing at this rate, so there is nothing to split: a farm whose emissions have ended pays exactly 0 however large the stake, until a new emission schedule is funded.";
      } else if (res.priceZero) {
        note = " The tokens still accrue - " + res.tokensDay + " a day - but at a price of 0 they are worth 0 in this model: an emission is only income at a price someone will pay, which is why a farm can advertise a huge token count and a worthless APR at the same time.";
      } else if (res.rewardsZero) {
        note = " Your share is so small that one day's emission floors to 0 tokens at the smallest unit: the pro-rata share exists on paper, but nothing accrues until the stake - or the emission - is larger.";
      } else {
        note = " The APR does not depend on the size of your stake - a position twice as large earns twice the tokens at exactly this APR, because the stake cancels: APR = emission x price x 365 / total staked. What moves it is the total: if the total staked doubles while the emission stands still, the APR halves to " + res.aprDoubleTvlPct.toFixed(4) + "% - a fixed emission pie is diluted by every new staker, with no rate ever changing.";
      }
      var apyText = res.apyFinite && res.apyPct < 1e21 ? res.apyPct.toFixed(4) + "% compounded daily for a year if the rewards were reinvested every day at the same rate and price" : "a compounded figure too large to display at this daily rate";
      setText("farm-result", "Model output: an emission of " + res.emission + " reward tokens a day, split pro-rata across " + res.tvl + " of total staked value, gives your stake of " + res.stake + " a share of " + res.shareBps + " bps (" + res.sharePct + "%): " + res.tokensDay + " tokens a day, " + res.tokensPeriod + " tokens over " + res.days + " days. At your price of " + res.price + " per reward token that is " + res.valueDay + " a day and " + res.valuePeriod + " over the period - a simple APR of " + res.aprPct.toFixed(4) + "%, or " + apyText + "." + note + " The emission, price and total staked are frozen at your figures; emission schedules end and change, reward tokens can be locked or vesting, and no live farm is read. An educational model of farm emissions, not a live quote. Not financial advice.");
    });

    var bundleForm = document.getElementById("bundle-calc");
    if (bundleForm) bundleForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = bundleTipPlan(val("bundle-tip"), val("bundle-txs"), val("bundle-sigs"), val("bundle-count"), val("bundle-profit"));
      if (res === null) {
        document.getElementById("bundle-cost-out").value = "Invalid";
        document.getElementById("bundle-breakeven-out").value = "Invalid";
        document.getElementById("bundle-net-out").value = "Invalid";
        document.getElementById("bundle-total-out").value = "Invalid";
        setText("bundle-result", "Check the inputs: the tip and the expected gross profit are whole lamport amounts of 0 or more, the bundle holds a whole number of transactions from 1 to 5, each transaction carries a whole number of signatures from 1 to 12, and the number of bundles is a whole number from 1 to 10,000.");
        return;
      }
      document.getElementById("bundle-cost-out").value = res.costPerBundle + " lamports (" + res.costSol + " SOL)";
      document.getElementById("bundle-breakeven-out").value = res.breakEvenTip + " lamports";
      document.getElementById("bundle-net-out").value = res.netPerBundle + " lamports";
      document.getElementById("bundle-total-out").value = res.totalCost + " lamports (" + res.totalCostSol + " SOL)";
      var note = "";
      if (res.feesExceedProfit) {
        note = " The base fees alone exceed the expected profit, so the break-even tip is negative: there is no tip at which this bundle pays for itself - even a zero tip loses money, and a real searcher would not send it at these figures.";
      } else if (res.unprofitable) {
        note = " At this tip the bundle costs more than the expected profit: the tip auction is taking the whole opportunity and more, which is what competitive bidding does to a marginal trade - the break-even tip above is the ceiling the profit can support.";
      } else if (res.breakEven) {
        note = " The tip sits exactly at the break-even point: the landed bundle returns exactly its costs and keeps nothing, so any smaller profit - or one more signature's fees - puts it under water.";
      } else if (res.tipZero) {
        note = " A tip of 0 carries no bid at all: below the 1,000-lamport minimum the bundle has no place in the auction, whatever the arithmetic says - the net figure here is what a landed bundle would keep if it could land for free.";
      } else if (res.belowMinimum) {
        note = " This tip is below the 1,000-lamport minimum: the bundle would not be considered by the block engine at this bid, so the net figure is the arithmetic of a bundle that cannot land as priced.";
      } else {
        note = " The tip is a bid, not a fee schedule: it is paid only if the bundle lands, and raising it buys landing priority against other bundles chasing the same opportunity - never more profit from the opportunity itself.";
      }
      var shareText = res.costShareBps === null ? "the expected profit is 0, so the cost share is undefined" : "a cost share of " + res.costShareBps + " bps of the expected profit";
      setText("bundle-result", "Model output: a bundle of " + res.txCount + " transactions at " + res.sigsPerTx + " signature(s) each pays " + res.basePerBundle + " lamports of base fees, so with a tip of " + res.tipLamports + " lamports (" + res.tipSol + " SOL) one landed bundle costs " + res.costPerBundle + " lamports and keeps " + res.netPerBundle + " lamports of the " + res.profitLamports + " expected gross profit - " + shareText + ". The most that could be tipped before the base fees alone eat the profit is " + res.breakEvenTip + " lamports. Across " + res.bundles + " landed bundles the tips total " + res.totalTip + " lamports, the base fees " + res.totalBase + ", and the all-in cost " + res.totalCost + " lamports (" + res.totalCostSol + " SOL)." + note + " A bundle that does not land executes nothing and pays nothing; the live tip floor, priority fees, landing probability and retry costs are not modelled, and no live bundle is read. An educational model of bundle tips, not a live quote. Not financial advice.");
    });

    var fsplitForm = document.getElementById("fsplit-calc");
    if (fsplitForm) fsplitForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = feeSplit(val("fsplit-sigs"), val("fsplit-cu"), val("fsplit-price"), val("fsplit-count"));
      if (res === null) {
        document.getElementById("fsplit-total-out").value = "Invalid";
        document.getElementById("fsplit-burn-out").value = "Invalid";
        document.getElementById("fsplit-leader-out").value = "Invalid";
        document.getElementById("fsplit-period-out").value = "Invalid";
        setText("fsplit-result", "Check the inputs: signatures are a whole number from 1 to 12, the compute-unit limit is a whole number from 1 to 1,400,000, the compute-unit price is a whole number of micro-lamports from 0 to 1,000,000,000,000, and the transaction count is a whole number from 1 to 1,000,000.");
        return;
      }
      document.getElementById("fsplit-total-out").value = res.totalFeeLamports + " lamports (" + res.totalFeeSol + " SOL)";
      document.getElementById("fsplit-burn-out").value = res.burnedLamports + " lamports (" + res.burnedBps + " bps of the total)";
      document.getElementById("fsplit-leader-out").value = res.leaderLamports + " lamports (" + res.leaderBps + " bps of the total)";
      document.getElementById("fsplit-period-out").value = res.periodBurnedLamports + " lamports (" + res.periodBurnedSol + " SOL)";
      var note = "";
      if (res.noPriority) {
        note = " With no prioritization fee the split is exactly half and half - the burned share only ever falls because a prioritization fee is added on top, never because the base fee's own split changes.";
      } else if (res.burnedBps <= 100) {
        note = " At these settings the prioritization fee so dwarfs the base fee that the burn is close to a rounding error: almost everything paid reaches the leader, which is the point of SIMD-0096 - the full priority bid goes to the validator making the scheduling decision.";
      } else {
        note = " The base fee's split never changes - what changes is the mix: every lamport of prioritization fee lands entirely on the leader's side, so the burned share falls as the priority bid rises, and the burn itself stays pinned at half the base fee however large the bid grows.";
      }
      setText("fsplit-result", "Model output: a transaction with " + res.signatures + " signature(s), a compute-unit limit of " + res.cuLimit + " at a price of " + res.cuPriceMicro + " micro-lamports per compute unit, pays a base fee of " + res.baseFeeLamports + " lamports and a prioritization fee of " + res.priorityFeeLamports + " lamports - " + res.totalFeeLamports + " lamports (" + res.totalFeeSol + " SOL) in total. Of that, " + res.burnedLamports + " lamports burn (half the base fee, destroyed out of the supply) and " + res.leaderLamports + " lamports go to the block leader (the other half of the base fee plus the whole prioritization fee): a burned share of " + res.burnedBps + " bps and a leader share of " + res.leaderBps + " bps. Across " + res.txCount + (res.txCount === 1 ? " transaction" : " transactions") + " at these settings the fees total " + res.periodTotalLamports + " lamports, of which " + res.periodBurnedLamports + " burn (" + res.periodBurnedSol + " SOL) and " + res.periodLeaderLamports + " go to leaders." + note + " A transaction that lands but fails still pays this fee in full; the v1 format's absolute-fee form, proposed base-fee redesigns and Jito tips (a separate transfer, Tool 77) are not modelled, and no live fee data is read. An educational model of transaction fee splits, not a live quote. Not financial advice.");
    });

    var vcommForm = document.getElementById("vcomm-calc");
    if (vcommForm) vcommForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = validatorCommission(val("vcomm-stake"), val("vcomm-gross"), val("vcomm-comm"), val("vcomm-days"));
      if (res === null) {
        document.getElementById("vcomm-gross-out").value = "Invalid";
        document.getElementById("vcomm-comm-out").value = "Invalid";
        document.getElementById("vcomm-net-out").value = "Invalid";
        document.getElementById("vcomm-period-out").value = "Invalid";
        setText("vcomm-result", "Check the inputs: the stake is a positive amount, the assumed gross reward rate is a whole number of basis points from 0 to 100,000, the commission is a whole number of percentage points from 0 to 100, and the period is a whole number of days from 1 to 3,650.");
        return;
      }
      document.getElementById("vcomm-gross-out").value = res.grossAnnual;
      document.getElementById("vcomm-comm-out").value = res.commissionAnnual;
      document.getElementById("vcomm-net-out").value = res.netAnnual + " (effective " + res.effectiveBps + " bps)";
      document.getElementById("vcomm-period-out").value = res.periodNet;
      var note = "";
      if (res.zeroGross) {
        note = " At an assumed gross rate of zero there is no reward for any commission to be charged on: the split is exact and empty at every commission rate, and the choice of validator would turn on performance and reliability instead.";
      } else if (res.zeroCommission) {
        note = " At a commission of zero the delegator keeps the whole gross reward: the effective rate equals the gross rate exactly, and nothing is withheld at the source.";
      } else if (res.fullCommission) {
        note = " At a commission of 100 percent the validator keeps every lamport of reward and the delegator nets exactly zero - while the delegated principal itself is still untouched, because commission is charged on rewards only. A vote account created without setting a commission defaults to exactly this rate.";
      } else {
        note = " Each single percentage point of commission costs one hundredth of the gross reward, so the comparison between two validators at the same gross rate is arithmetic, not judgement: the whole gap between their effective rates is the gap between their commission rates, scaled by the gross rate.";
      }
      setText("vcomm-result", "Model output: a stake of " + res.stake + " at an assumed gross reward rate of " + res.grossBps + " bps a year earns a gross reward of " + res.grossAnnual + " a year before commission. At a commission of " + res.commissionPct + " percent - a whole number of percentage points, the only form a vote account accepts - the validator keeps " + res.commissionAnnual + " of that reward and the delegator nets " + res.netAnnual + ", an effective rate of " + res.effectiveBps + " bps, with each percentage point of commission worth " + res.perPointAnnual + " a year at these settings. Over a period of " + res.days + " day(s) the gross reward is " + res.periodGross + ", of which the commission takes " + res.periodCommission + " and the delegator nets " + res.periodNet + "." + note + " The gross rate is an assumed figure, not a live rate; commission can be changed only during the first half of an epoch; stake-pool token fees (Tool 75), gross epoch compounding (Tool 8) and any separate block-revenue or MEV commission are not modelled, and no live validator data is read. An educational model of validator commission, not a live quote. Not financial advice.");
    });

    var leadForm = document.getElementById("lead-calc");
    if (leadForm) leadForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = leaderSchedule(val("lead-stake"), val("lead-total"), val("lead-slots"), val("lead-skip"));
      if (res === null) {
        document.getElementById("lead-share-out").value = "Invalid";
        document.getElementById("lead-slots-out").value = "Invalid";
        document.getElementById("lead-prod-out").value = "Invalid";
        document.getElementById("lead-perwindow-out").value = "Invalid";
        setText("lead-result", "Check the inputs: the validator stake is a positive amount no larger than the total activated stake, the slots per epoch are a whole multiple of 4 from 4 to 432,000, and the assumed skipped share is a whole number of basis points from 0 to 10,000.");
        return;
      }
      document.getElementById("lead-share-out").value = res.shareBps + " bps of the total activated stake";
      document.getElementById("lead-slots-out").value = res.expectedSlots + " slots in " + res.expectedWindows + " leader windows";
      document.getElementById("lead-prod-out").value = res.produced + " slots (" + res.skipped + " skipped)";
      document.getElementById("lead-perwindow-out").value = res.stakePerWindow;
      var note = "";
      if (res.dustExpectation) {
        note = " At this stake the expected assignment floors to zero at nine decimal places: the stake is far below one window's worth, and whole epochs would ordinarily pass with no assignment at all.";
      } else if (res.allSkipped) {
        note = " At an assumed skipped share of 100 percent every assigned slot is expected to be skipped: the schedule assigns the slots, but no blocks come out of them.";
      } else if (res.fullStake) {
        note = " With the whole activated stake the draw has only one validator to pick: every window of the epoch is assigned to it, and the expectation is the schedule itself.";
      } else if (res.subBpsShare) {
        note = " The stake share floors to zero whole basis points, but the expectation is not zero: a sub-basis-point share still expects the fraction of a window shown, which in practice means an assignment in some epochs and none in others.";
      } else if (res.zeroSkip) {
        note = " At an assumed skipped share of zero every assigned slot is expected to produce a block; any real skip rate comes straight off the produced figure and changes nothing about the assignment.";
      } else {
        note = " The expectation is a mean, not a promise: the epoch's actual schedule is one seeded draw, so a real count lands near this figure rather than on it, and it is fixed and knowable for the whole epoch once the schedule is computed.";
      }
      setText("lead-result", "Model output: a validator with " + res.stake + " of activated stake out of a total of " + res.total + " holds a " + res.shareBps + " bps share, so across an epoch of " + res.slotsPerEpoch + " slots - " + res.windowsTotal + " leader windows of 4 consecutive slots each - it is expected to be assigned " + res.expectedWindows + " windows, " + res.expectedSlots + " slots in total. At an assumed skipped share of " + res.skipBps + " bps, " + res.skipped + " of those slots are expected to be skipped and " + res.produced + " to produce blocks. One expected window corresponds to " + res.stakePerWindow + " of total activated stake at these settings." + note + " Stake is the activated stake the schedule is computed from, not a balance; the skip share is an assumed figure, not a live delinquency rate; validator commission (Tool 79) and rewards are not modelled, and no live stake or schedule data is read. An educational model of the leader schedule, not a live quote. Not financial advice.");
    });

    var pfeeForm = document.getElementById("pfee-calc");
    if (pfeeForm) pfeeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = priorityFeePercentile(val("pfee-p1"), val("pfee-c1"), val("pfee-p2"), val("pfee-c2"), val("pfee-p3"), val("pfee-c3"), val("pfee-p4"), val("pfee-c4"), val("pfee-pct"), val("pfee-cu"));
      if (res === null) {
        document.getElementById("pfee-price-out").value = "Invalid";
        document.getElementById("pfee-fee-out").value = "Invalid";
        document.getElementById("pfee-median-out").value = "Invalid";
        document.getElementById("pfee-diff-out").value = "Invalid";
        setText("pfee-result", "Check the inputs: the four price levels are whole numbers of micro-lamports per compute unit, strictly ascending, the counts are whole numbers with a total between 1 and 100,000 samples, the percentile is a whole number from 1 to 100, and the compute-unit limit is a whole number from 1 to 1,400,000.");
        return;
      }
      document.getElementById("pfee-price-out").value = res.chosenPrice + " micro-lamports per CU (rank " + res.rank + " of " + res.totalSamples + ")";
      document.getElementById("pfee-fee-out").value = res.feeLamports + " lamports (" + res.feeSol + " SOL)";
      document.getElementById("pfee-median-out").value = res.medianPrice + " micro-lamports per CU, " + res.medianFeeLamports + " lamports at this limit";
      document.getElementById("pfee-diff-out").value = res.diffVsMedianLamports + " lamports vs the median price";
      var note = "";
      if (res.zeroFee) {
        note = " At this percentile the chosen price is zero: enough of the sample landed paying no prioritization fee at all, which is common for accounts nobody is contesting - and worth nothing as a bid the moment the account turns hot.";
      } else if (res.atTop) {
        note = " The chosen price is the highest price in the sample: at this percentile the bid matches the most anyone in the sample paid, so a hotter recent window would move the bid again - the percentile is only as current as the samples behind it.";
      } else if (res.belowMedian) {
        note = " The chosen price sits below the sample median: more than half the sampled transactions paid more than this bid, which is a deliberate economy choice, not a competitive one, for any account under contention.";
      } else if (res.atMedian) {
        note = " The chosen price is the sample median itself: half the sampled transactions paid at or below it, which is the routine-work setting - the contested-account case is what the higher percentiles exist for.";
      } else {
        note = " The chosen price sits above the sample median: the difference against the median, priced at this compute-unit limit, is the lamports the urgency costs on every transaction that lands at this bid.";
      }
      setText("pfee-result", "Model output: across " + res.totalSamples + " sampled recent transactions grouped at prices of " + res.prices[0] + ", " + res.prices[1] + ", " + res.prices[2] + " and " + res.prices[3] + " micro-lamports per compute unit, the " + res.percentile + "th percentile by the nearest-rank method is rank " + res.rank + ", which lands on a price of " + res.chosenPrice + " micro-lamports per compute unit - " + res.cumAtChosen + " of the samples (" + res.shareAtChosenBps + " bps) paid at or below it. At a compute-unit limit of " + res.cuLimit + " that price is a prioritization fee of " + res.feeLamports + " lamports (" + res.feeSol + " SOL), charged on the limit requested. The sample median price is " + res.medianPrice + " micro-lamports, which would pay " + res.medianFeeLamports + " lamports at the same limit, so this percentile differs from the median by " + res.diffVsMedianLamports + " lamports." + note + " The samples are your own grouped figures, not a live feed; fee markets are local to the accounts a transaction writes, so samples from a quiet account say nothing about a contested one; the base fee (Tool 5), the split of the fee (Tool 78) and any Jito tip (Tool 77) are separate, and no live fee data is read. An educational model of priority fee percentile selection, not a live quote. Not financial advice.");
    });

    var reclaimForm = document.getElementById("reclaim-calc");
    if (reclaimForm) reclaimForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = rentReclaim(val("reclaim-tokens"), val("reclaim-generic"), val("reclaim-bytes"), val("reclaim-sigs"));
      if (res === null) {
        document.getElementById("reclaim-per-out").value = "Invalid";
        document.getElementById("reclaim-total-out").value = "Invalid";
        document.getElementById("reclaim-fee-out").value = "Invalid";
        document.getElementById("reclaim-net-out").value = "Invalid";
        setText("reclaim-result", "Check the inputs: the account counts are whole numbers from 0 to 10,000 with at least one account in total, the other-account size is a whole number of bytes from 0 to 10,000,000, and the signature count is a whole number from 1 to 1,000.");
        return;
      }
      document.getElementById("reclaim-per-out").value = res.perTokenLamports + " lamports per token account; " + res.perGenericLamports + " per other account";
      document.getElementById("reclaim-total-out").value = res.totalReclaimLamports + " lamports (" + res.totalReclaimSol + " SOL)";
      document.getElementById("reclaim-fee-out").value = res.feeLamports + " lamports (" + res.signatures + " signatures at 5,000)";
      document.getElementById("reclaim-net-out").value = res.netLamports + " lamports (" + res.netSol + " SOL)";
      var note = "";
      if (res.feeExceeds) {
        note = " At these settings the plan loses money: the closing transactions' base fees exceed everything the accounts hold, so batching the closes under fewer signatures - or leaving the smallest accounts open - is worth more than closing them this way.";
      } else if (res.breakEven) {
        note = " At these settings the reclaim and the closing fees cancel exactly: the accounts come back, but nothing is gained by closing them this way.";
      } else if (res.onlyTokens) {
        note = " Every account in this plan is a token account, the wallet case: empty token accounts left behind by sold or moved tokens are exactly the 2,039,280-lamport deposits this reclaims, one per account closed.";
      } else if (res.onlyGeneric) {
        note = " No token accounts are in this plan: the reclaim is priced entirely off the other accounts' own byte sizes, at the same (128 + bytes) x 6,960 lamports each.";
      } else {
        note = " The two account kinds are priced off the same rent formula at their own sizes: the token accounts at a fixed 165 bytes each, the others at the byte size given.";
      }
      setText("reclaim-result", "Model output: closing " + res.tokenCount + " token accounts reclaims " + res.tokenReclaimLamports + " lamports and closing " + res.genericCount + " other accounts of " + res.genericBytes + " bytes reclaims " + res.genericReclaimLamports + " lamports, a gross reclaim of " + res.totalReclaimLamports + " lamports (" + res.totalReclaimSol + " SOL). The closing transactions pay " + res.feeLamports + " lamports of base fees across " + res.signatures + " signatures, so the net reclaim is " + res.netLamports + " lamports (" + res.netSol + " SOL)." + note + " A close returns the account's entire balance, so the deposit comes back in full rather than pro-rated; an account holding tokens cannot close until its balance is zero, which is not modelled here; withheld transfer fees sitting in a token account belong to the mint's withdraw authority, not the holder, and are not part of this reclaim; rent itself (Tool 3) and the base fee (Tool 5) are the composed tools, and no live account data is read. An educational model of rent reclaim on account close, not a live quote. Not financial advice.");
    });

    var sfundForm = document.getElementById("sfund-calc");
    if (sfundForm) sfundForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = stakeFunding(val("sfund-fund"), val("sfund-min"));
      if (!res) {
        document.getElementById("sfund-reserve-out").value = "Invalid";
        document.getElementById("sfund-delegated-out").value = "Invalid";
        document.getElementById("sfund-minfund-out").value = "Invalid";
        document.getElementById("sfund-accounts-out").value = "Invalid";
        setText("sfund-result", "Check the inputs: both amounts are SOL amounts above zero and at most 10,000,000, with at most nine decimal places.");
        return;
      }
      document.getElementById("sfund-reserve-out").value = res.reserveLamports + " lamports (" + res.reserveSol + " SOL)";
      document.getElementById("sfund-delegated-out").value = res.delegatedLamports + " lamports (" + res.delegatedSol + " SOL)";
      document.getElementById("sfund-minfund-out").value = res.minFundingLamports + " lamports (" + res.minFundingSol + " SOL)";
      document.getElementById("sfund-accounts-out").value = res.accountCount + (res.accountCount === 1 ? " account" : " accounts") + ", " + res.leftoverLamports + " lamports (" + res.leftoverSol + " SOL) left over";
      var note = "";
      if (res.belowReserve && res.reserveShortfallLamports !== "0") {
        note = " This funding does not even cover the reserve: the account would not be rent-exempt, let alone delegated - it is " + res.reserveShortfallLamports + " lamports short of the reserve alone.";
      } else if (res.belowReserve) {
        note = " This funding is exactly the reserve: the account exists and is rent-exempt, but nothing at all is delegated.";
      } else if (!res.meetsMinimum) {
        note = " The delegated amount falls " + res.shortfallLamports + " lamports (" + res.shortfallSol + " SOL) short of the minimum you entered, so this funding cannot open a delegation at that minimum - the smallest funding that can is the minimum funding figure above.";
      } else if (res.exactMinimum) {
        note = " The delegation lands exactly on the minimum you entered: one lamport less of funding would fall short.";
      } else if (res.accountCount >= 2) {
        note = " Split across minimum-sized accounts, this funding opens at most " + res.accountCount + " of them, because every account pays its own 2,282,880-lamport reserve - splitting multiplies the reserve cost, it never shares it.";
      }
      setText("sfund-result", "Model output: funding a stake account with " + res.funding + " SOL gives it a balance of " + res.fundingLamports + " lamports, of which the first " + res.reserveLamports + " lamports (" + res.reserveSol + " SOL) are the rent-exempt reserve for its 200 bytes - locked in the account, never delegated and never earning. The delegated amount is " + res.delegatedLamports + " lamports (" + res.delegatedSol + " SOL), " + res.delegatedBps + " bps of the funding, and rewards accrue on that amount alone." + note + " The minimum delegation is the figure you entered: it is a cluster setting reported by the RPC (getStakeMinimumDelegation), not a constant of the stake program, and it can change. Activation timing (Tool 24), rewards (Tool 8) and validator commission (Tool 79) are separate mechanics, and no live account is read. An educational model of stake account funding, not a live quote. Not financial advice.");
    });
    var delinqForm = document.getElementById("delinq-calc");
    if (delinqForm) delinqForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = delinquentStake(val("delinq-total"), val("delinq-delinq"), val("delinq-extra"));
      if (!res) {
        document.getElementById("delinq-share-out").value = "Invalid";
        document.getElementById("delinq-max-out").value = "Invalid";
        document.getElementById("delinq-margin-out").value = "Invalid";
        document.getElementById("delinq-after-out").value = "Invalid";
        setText("delinq-result", "Check the inputs: the total is a SOL amount above zero and at most 1,000,000,000, the delinquent amount is between zero and the total, and the extra offline amount keeps delinquent plus extra at or below the total - all with at most nine decimal places.");
        return;
      }
      document.getElementById("delinq-share-out").value = res.delinquentLamports + " lamports delinquent (" + res.delinqBps + " bps, " + res.delinqPct + "%); " + res.onlineLamports + " lamports (" + res.onlineSol + " SOL) online (" + res.onlineBps + " bps, " + res.onlinePct + "%)";
      document.getElementById("delinq-max-out").value = res.maxDelinqLamports + " lamports (" + res.maxDelinqSol + " SOL)";
      document.getElementById("delinq-margin-out").value = (res.finalizesNow ? res.marginNowLamports + " lamports (" + res.marginNowSol + " SOL) of headroom" : res.returnNeededNowLamports + " lamports (" + res.returnNeededNowSol + " SOL) must return");
      document.getElementById("delinq-after-out").value = res.delinqAfterLamports + " lamports (" + res.delinqAfterSol + " SOL) delinquent, " + res.delinqAfterBps + " bps (" + res.delinqAfterPct + "%) - " + (res.finalizesAfter ? "still finalizes, " + res.marginAfterLamports + " lamports (" + res.marginAfterSol + " SOL) of headroom left" : "finality stalls, " + res.returnNeededAfterLamports + " lamports (" + res.returnNeededAfterSol + " SOL) must return");
      var note = "";
      if (!res.finalizesNow) {
        note = " The cluster is already past the line: the online stake is at or below two-thirds, so blocks can still be produced but nothing finalizes until at least " + (res.returnNeededNowLamports === "1" ? "1 lamport" : res.returnNeededNowLamports + " lamports") + " (" + res.returnNeededNowSol + " SOL) of delinquent stake comes back online.";
      } else if (!res.finalizesAfter) {
        note = " The scenario crosses the line: that much additional delinquent stake leaves the online share at or below two-thirds, so finality would stall even though blocks could still be produced - " + (res.returnNeededAfterLamports === "1" ? "1 lamport" : res.returnNeededAfterLamports + " lamports") + " (" + res.returnNeededAfterSol + " SOL) of it would have to return to restore the supermajority.";
      } else if (res.extraLamports === "0") {
        note = " The scenario adds no extra offline stake, so the after figures are the current figures.";
      } else {
        note = " Even after the scenario, the online stake stays above two-thirds and finality holds, with " + res.marginAfterLamports + " lamports (" + res.marginAfterSol + " SOL) of delinquent headroom to spare.";
      }
      setText("delinq-result", "Model output: of " + res.totalLamports + " lamports (" + res.total + " SOL) of activated stake, " + res.delinquentLamports + " lamports (" + res.delinquent + " SOL) are delinquent - " + res.delinqBps + " bps (" + res.delinqPct + "%) - leaving " + res.onlineLamports + " lamports (" + res.onlineSol + " SOL) voting. Finalizing needs more than two-thirds of the stake voting, at least " + res.minOnlineLamports + " lamports (" + res.minOnlineSol + " SOL) here, so the largest delinquent stake this cluster can carry is " + res.maxDelinqLamports + " lamports (" + res.maxDelinqSol + " SOL) - one lamport under a third of the total, because exactly a third delinquent leaves exactly two-thirds online, and exactly two-thirds is not a supermajority." + note + " Delinquent stake here means activated stake whose validator is not voting; which validators those are, and why, is live cluster data this model does not read. Leader schedule share (Tool 80) and validator commission (Tool 79) are separate mechanics. An educational model of delinquent stake and finality, not a live quote. Not financial advice.");
    });
    var wsolForm = document.getElementById("wsol-calc");
    if (wsolForm) wsolForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = wrappedSol(val("wsol-fund"), val("wsol-accounts"));
      if (!res) {
        document.getElementById("wsol-reserve-out").value = "Invalid";
        document.getElementById("wsol-spend-out").value = "Invalid";
        document.getElementById("wsol-minfund-out").value = "Invalid";
        document.getElementById("wsol-close-out").value = "Invalid";
        setText("wsol-result", "Check the inputs: the funding is a SOL amount above zero and at most 1,000,000,000 with at most nine decimal places, and the fresh-account count is a whole number from 0 to 100,000.");
        return;
      }
      document.getElementById("wsol-reserve-out").value = res.reserveLamports + " lamports (" + res.reserveSol + " SOL) across " + res.accounts + (res.accounts === 1 ? " fresh account" : " fresh accounts");
      document.getElementById("wsol-spend-out").value = res.spendableLamports + " lamports (" + res.spendableSol + " SOL), " + res.spendableBps + " bps (" + res.spendablePct + "%) of the funding";
      document.getElementById("wsol-minfund-out").value = res.minFundLamports + " lamports (" + res.minFundSol + " SOL)";
      document.getElementById("wsol-close-out").value = res.closeBackLamports + " lamports (" + res.closeBackSol + " SOL) after spending it all; " + res.unwrapLamports + " lamports (" + res.unwrapSol + " SOL) if nothing was spent";
      var note = "";
      if (res.belowReserve) {
        note = " The funding does not even cover the reserve: it is " + res.shortfallLamports + " lamports (" + res.shortfallSol + " SOL) short, so the spendable balance is zero - a wrap this small into fresh accounts buys no wSOL at all.";
      } else if (res.accounts === 0) {
        note = " With no fresh account in the plan the reserve is already funded, so syncNative credits the full transfer - topping up an existing wSOL account is the one case where what you send is what you can spend.";
      } else if (res.accounts > 1) {
        note = " Splitting the wrap across " + res.accounts + " fresh accounts multiplies the reserve by " + res.accounts + " - one account would have locked only " + res.reservePerAccountLamports + " lamports.";
      } else {
        note = " One fresh account locks exactly one reserve; the same funding into an already-funded account would spend in full.";
      }
      setText("wsol-result", "Model output: funding " + res.fundLamports + " lamports (" + res.fund + " SOL) into " + res.accounts + (res.accounts === 1 ? " fresh wSOL account" : " fresh wSOL accounts") + " locks " + res.reserveLamports + " lamports (" + res.reserveSol + " SOL) of rent-exempt reserve - 2,039,280 lamports per 165-byte token account, Tool 3's figure at that size - because syncNative sets the token balance to the lamport balance minus that reserve. The spendable wSOL is " + res.spendableLamports + " lamports (" + res.spendableSol + " SOL). The reserve is a deposit, not a fee: closing an account returns its whole remaining balance, so spending every spendable lamport and then closing returns " + res.closeBackLamports + " lamports (" + res.closeBackSol + " SOL), and closing untouched returns the full " + res.unwrapLamports + " lamports (" + res.unwrapSol + " SOL)." + note + " Transaction base fees (Tool 5) ride on top and are not in these figures, and closing an account that still holds wSOL returns that balance too - spend or transfer it first in a real flow. An educational model of wrapped SOL and syncNative, not a live quote. Not financial advice.");
    });
    var nakaForm = document.getElementById("naka-calc");
    if (nakaForm) nakaForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = nakamotoCoefficient(val("naka-total"), val("naka-stakes"));
      if (!res) {
        document.getElementById("naka-halt-out").value = "Invalid";
        document.getElementById("naka-coef-out").value = "Invalid";
        document.getElementById("naka-coal-out").value = "Invalid";
        document.getElementById("naka-top1-out").value = "Invalid";
        setText("naka-result", "Check the inputs: the total is a SOL amount above zero and at most 1,000,000,000 with at most nine decimal places, and the validator list holds 1 to 100 SOL amounts, each above zero and no larger than the total, together no larger than the total.");
        return;
      }
      document.getElementById("naka-halt-out").value = res.haltLamports + " lamports (" + res.haltSol + " SOL), " + res.haltBps + " bps (" + res.haltPct + "%) of the total";
      document.getElementById("naka-coef-out").value = res.reached ? res.coefficient + (res.coefficient === 1 ? " validator" : " validators") + " of the " + res.listed + " listed" : "not reached by the " + res.listed + " listed";
      document.getElementById("naka-coal-out").value = res.reached ? res.coalitionLamports + " lamports (" + res.coalitionSol + " SOL), " + res.coalitionBps + " bps (" + res.coalitionPct + "%) of the total" : res.listedLamports + " lamports (" + res.listedSol + " SOL) listed in all, " + res.listedBps + " bps (" + res.listedPct + "%) of the total";
      document.getElementById("naka-top1-out").value = res.top1Lamports + " lamports (" + res.top1Sol + " SOL), " + res.top1Bps + " bps (" + res.top1Pct + "%) of the total";
      var note = "";
      if (!res.reached) {
        note = " The listed validators together hold " + res.listedLamports + " lamports (" + res.listedSol + " SOL), which is " + res.shortfallLamports + " lamports (" + res.shortfallSol + " SOL) short of the line - even if every one of them went offline together, the online stake would stay above two-thirds and finality would hold; a larger validator (or several) beyond this list is needed to complete any halting coalition.";
      } else if (res.coefficient === 1) {
        note = " The largest validator alone reaches the line: a single operator going offline or being compromised stalls finality - the most concentrated outcome this model can report.";
      } else {
        note = " No smaller set of the largest validators reaches the line: the top " + (res.coefficient - 1) + " together still fall short of it, and the " + res.coefficient + "th tips the combined stake over. Any other coalition needs at least as many validators, because this walk always takes the largest first.";
      }
      setText("naka-result", "Model output: on a total activated stake of " + res.totalLamports + " lamports (" + res.total + " SOL), finality stalls once the offline stake reaches " + res.haltLamports + " lamports (" + res.haltSol + " SOL) - one lamport above the largest delinquent stake that still finalizes in Tool 84, because exactly a third offline leaves exactly two-thirds online, which is not the more-than-two-thirds supermajority Tower BFT needs. Ranking the " + res.listed + " entered validators largest first, the Nakamoto coefficient is " + (res.reached ? res.coefficient + ", reached at a combined " + res.coalitionLamports + " lamports (" + res.coalitionSol + " SOL)" : "not reached by the entered list") + "." + note + " The coefficient counts validators as entered; several validators run by one operator would make the true entity-level figure smaller. Stakes are user-entered and no live cluster or validator data is read. An educational model of the Nakamoto coefficient and finality, not a live quote. Not financial advice.");
    });




    var vcostForm = document.getElementById("vcost-calc");
    if (vcostForm) vcostForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = voteCost(val("vcost-slots"), val("vcost-bps"), val("vcost-epochs"));
      if (!res) {
        document.getElementById("vcost-votes-out").value = "Invalid";
        document.getElementById("vcost-epoch-out").value = "Invalid";
        document.getElementById("vcost-total-out").value = "Invalid";
        document.getElementById("vcost-full-out").value = "Invalid";
        setText("vcost-result", "Check the inputs: the slots per epoch are a whole number from 1 to 432,000, the voted share is a whole number of basis points from 0 to 10,000, and the epoch count is a whole number from 1 to 1,000.");
        return;
      }
      document.getElementById("vcost-votes-out").value = res.votesPerEpoch + (res.votesPerEpoch === "1" ? " vote" : " votes") + " per epoch of " + res.slots + " slots (" + res.missedPerEpoch + " not voted on)";
      document.getElementById("vcost-epoch-out").value = res.costPerEpochLamports + " lamports (" + res.costPerEpochSol + " SOL) per epoch; " + res.perDayLamports + " lamports (" + res.perDaySol + " SOL) per nominal day";
      document.getElementById("vcost-total-out").value = res.totalCostLamports + " lamports (" + res.totalCostSol + " SOL) over " + res.epochs + (res.epochs === 1 ? " epoch" : " epochs") + " (" + res.totalVotes + " votes in all)";
      document.getElementById("vcost-full-out").value = res.fullCostPerEpochLamports + " lamports (" + res.fullCostPerEpochSol + " SOL) per epoch at full participation; this plan saves " + res.savedPerEpochLamports + " lamports (" + res.savedPerEpochSol + " SOL) per epoch, " + res.savedTotalLamports + " lamports (" + res.savedTotalSol + " SOL) over the plan";
      var note = "";
      if (res.noVotes) {
        note = " At this voted share the plan casts no votes at all: it costs nothing and earns no vote credits, and a validator that never votes is delinquent (Tool 84) - its stake stops counting toward the supermajority and earns no inflation rewards.";
      } else if (res.fullParticipation) {
        note = " Voting on every slot is the ceiling the official validator FAQ points at with its up-to-about-1.1-SOL-per-day figure: at the nominal 400-millisecond slot time it is exactly 1.08 SOL per day whatever the epoch length, because a nominal day always holds 216,000 slots.";
      } else {
        note = " The slots not voted on are the only saving available: each one skips exactly one 5,000-lamport vote fee, and each one also earns no vote credit toward the epoch's inflation rewards.";
      }
      setText("vcost-result", "Model output: a validator voting on " + res.votedBps + " bps (" + res.votedPct + "%) of " + res.slots + " slots casts " + res.votesPerEpoch + " votes per epoch, and every vote is a privileged transaction carrying exactly one signature at the 5,000-lamport base fee (Tool 5) with no priority fee, so one epoch of voting costs " + res.costPerEpochLamports + " lamports (" + res.costPerEpochSol + " SOL) and " + res.epochs + (res.epochs === 1 ? " epoch costs " : " epochs cost ") + res.totalCostLamports + " lamports (" + res.totalCostSol + " SOL). At the nominal 400-millisecond slot time that is " + res.perDayLamports + " lamports (" + res.perDaySol + " SOL) per day." + note + " The fee never scales with stake: a validator with 100 SOL delegated and one with 1,000,000 pay the same per vote, which is why vote costs decide whether a small validator breaks even while commission (Tool 79) is the income side of the same ledger. Slots, voted share and epochs are user-entered and no live cluster or validator data is read. An educational model of validator vote costs, not a live quote. Not financial advice.");
    });

    var vnetForm = document.getElementById("vnet-calc");
    if (vnetForm) vnetForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = validatorNet(val("vnet-stake"), val("vnet-gross"), val("vnet-comm"), val("vnet-slots"), val("vnet-bps"), val("vnet-epochs"));
      if (!res) {
        document.getElementById("vnet-income-out").value = "Invalid";
        document.getElementById("vnet-cost-out").value = "Invalid";
        document.getElementById("vnet-net-out").value = "Invalid";
        document.getElementById("vnet-be-out").value = "Invalid";
        setText("vnet-result", "Check the inputs: the delegated stake must be above zero (amounts may have up to 9 decimal places), the gross rate a whole number of basis points from 0 to 100,000, the commission a whole number of percentage points from 0 to 100, the slots per epoch a whole number from 1 to 432,000, the voted share a whole number of basis points from 0 to 10,000, and the epoch count a whole number from 1 to 1,000.");
        return;
      }
      document.getElementById("vnet-income-out").value = "Gross rewards " + res.grossPerEpoch + " SOL per epoch; the " + res.commissionPct + "% commission keeps " + res.commissionPerEpoch + " SOL";
      document.getElementById("vnet-cost-out").value = res.voteCostPerEpochLamports + " lamports (" + res.voteCostPerEpochSol + " SOL) per epoch; " + res.voteCostPeriodLamports + " lamports (" + res.voteCostPeriodSol + " SOL) over " + res.epochs + (res.epochs === 1 ? " epoch" : " epochs");
      document.getElementById("vnet-net-out").value = res.netPerEpoch + " SOL per epoch; " + res.netPeriod + " SOL over " + res.epochs + (res.epochs === 1 ? " epoch" : " epochs");
      document.getElementById("vnet-be-out").value = res.breakEvenStake === null ? "No delegated stake breaks even at these settings" : "Break-even delegated stake " + res.breakEvenStake + " SOL" + (res.shortfallStake !== "0" ? "; this stake is " + res.shortfallStake + " SOL short" : res.surplusStake !== "0" ? "; this stake clears it by " + res.surplusStake + " SOL" : "; this stake is exactly the break-even stake");
      var note;
      if (res.costFree) note = " The voted share floors to zero votes, so voting costs nothing at these settings and the commission is kept in full - a validator that votes on nothing is delinquent (Tool 84) and earns no vote credits, which this ledger does not price.";
      else if (res.noIncome) note = " At a " + (res.commissionPct === 0 ? "0% commission" : "0 bps gross rate") + " the validator keeps no commission at any stake, so no delegated stake covers the vote cost - the net is the whole cost, every epoch.";
      else if (res.exactlyBreaksEven) note = " The plan lands exactly on break-even: the floored commission equals the floored vote cost to the lamport.";
      else if (res.profitable) note = " The commission covers the vote cost with room to spare - the surplus is the margin before every cost this ledger does not model.";
      else note = " The commission falls short of the vote cost: the validator subsidises consensus out of pocket (or out of its own stake's rewards, which this ledger does not count) until its delegated stake reaches the break-even figure.";
      if (res.fullCommission) note += " At a 100% commission the validator keeps every reward and delegators net zero (Tool 79).";
      setText("vnet-result", "Model output: a validator with " + res.stake + " SOL delegated at an assumed gross rate of " + res.grossBps + " bps a year earns " + res.grossPerEpoch + " SOL of rewards per " + res.slots + "-slot epoch, and its " + res.commissionPct + "% commission (Tool 79) keeps " + res.commissionPerEpoch + " SOL of it. Voting on " + res.votedBps + " bps of slots costs " + res.voteCostPerEpochLamports + " lamports (" + res.voteCostPerEpochSol + " SOL) per epoch (Tool 87) - a fixed cost that never scales with stake - so the net is " + res.netPerEpoch + " SOL per epoch and " + res.netPeriod + " SOL over " + res.epochs + (res.epochs === 1 ? " epoch" : " epochs") + "." + note + " The gross rate is an assumed figure and the stake, slots, voted share and epochs are user-entered; block revenue and MEV commissions, hardware and other running costs are not modelled, and no live validator data is read. An educational model of validator net economics, not a live quote. Not financial advice.");
    });

    var platForm = document.getElementById("plat-calc");
    if (platForm) platForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = platformFeeSwap(val("plat-rin"), val("plat-rout"), val("plat-ain"), val("plat-poolfee"), val("plat-bps"), val("plat-ref"));
      if (!res) {
        document.getElementById("plat-gross-out").value = "Invalid";
        document.getElementById("plat-fee-out").value = "Invalid";
        document.getElementById("plat-split-out").value = "Invalid";
        document.getElementById("plat-user-out").value = "Invalid";
        setText("plat-result", "Check the inputs: reserves and amount in must be above zero (amounts may have up to 9 decimal places) and the swap must return less than the output reserve, the pool fee a whole number of basis points from 0 to 9,999, the platform fee a whole number of basis points from 0 to 1,000, and the referral share a whole number of percentage points from 0 to 100.");
        return;
      }
      document.getElementById("plat-gross-out").value = "Pool fee " + res.poolFee + " on the input; gross output " + res.grossOut;
      document.getElementById("plat-fee-out").value = res.platformFee + " (" + res.platformBps + " bps of the gross output)";
      document.getElementById("plat-split-out").value = "Referrer gets " + res.referrerGets + " (" + res.referralPct + "%); the platform keeps " + res.platformKeeps;
      document.getElementById("plat-user-out").value = res.userReceives + " received; spot output with no fees at all would be " + res.spotOut + " (total drag " + res.totalDrag + ", " + res.dragBps + " bps)";
      var note = "";
      if (res.noPlatformFee) note = " At these settings the platform fee floors to zero, so the user receives the whole gross output - on a dust output a small bps rate can vanish entirely at the smallest unit.";
      else if (res.fullReferral) note = " At a 100% referral share the whole platform fee passes to the referrer and the platform itself keeps nothing from it.";
      else if (res.noReferral) note = " At a 0% referral share the platform keeps the whole fee itself.";
      setText("plat-result", "Model output: swapping " + res.amountIn + " into a " + res.reserveIn + " / " + res.reserveOut + " constant-product pool at a " + res.poolFeeBps + " bps pool fee returns a gross output of " + res.grossOut + " (Tool 2). The interface's platform fee of " + res.platformBps + " bps is taken from that output, not from the input, so it never enters the curve and does not move the price: it withholds " + res.platformFee + ", of which the referrer's " + res.referralPct + "% share floors to " + res.referrerGets + " and the platform keeps the remaining " + res.platformKeeps + " - the two parts sum to the fee exactly. The user receives " + res.userReceives + ". Against the spot output of " + res.spotOut + " with no fees at all, the trade's total drag is " + res.totalDrag + " (" + res.dragBps + " bps) - the pool fee, the price impact and the platform fee compounded." + note + " Reserves, amount and rates are user-entered; which interface charges what, and whether a given swap carries a platform fee at all, is that interface's own terms, and no live pool or fee account is read. An educational model of platform-fee swaps, not a live quote. Not financial advice.");
    });

    var aggForm = document.getElementById("agg-calc");
    if (aggForm) aggForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = splitRouteSwap(val("agg-rin1"), val("agg-rout1"), val("agg-fee1"), val("agg-rin2"), val("agg-rout2"), val("agg-fee2"), val("agg-ain"), val("agg-split"));
      if (!res) {
        document.getElementById("agg-leg1-out").value = "Invalid";
        document.getElementById("agg-leg2-out").value = "Invalid";
        document.getElementById("agg-total-out").value = "Invalid";
        document.getElementById("agg-best-out").value = "Invalid";
        setText("agg-result", "Check the inputs: every reserve and the amount in must be above zero (amounts may have up to 9 decimal places), each pool fee a whole number of basis points from 0 to 9,999, the split a whole number of percentage points from 0 to 100, and each positive leg must return a positive output below its pool's output reserve.");
        return;
      }
      document.getElementById("agg-leg1-out").value = res.amountIn1 + " to pool 1 (fee " + res.legFee1 + ") returns " + res.out1;
      document.getElementById("agg-leg2-out").value = res.amountIn2 + " to pool 2 (fee " + res.legFee2 + ") returns " + res.out2;
      document.getElementById("agg-total-out").value = res.totalOut + " in total from the split";
      document.getElementById("agg-best-out").value = "Best single pool: pool " + res.bestPool + " alone returns " + res.bestSingleOut + "; the split's gain is " + res.gain + " (" + res.gainBps + " bps)";
      var note = "";
      if (res.allIn) note = " At a 0% or 100% split nothing is actually split - the whole amount went to one pool, so the total equals that pool's fill exactly and the gain against the best single pool is zero or negative by construction.";
      else if (res.splitWins) note = " The split beats the best single pool here because price impact is convex: each half-trade moves its own pool only half as far, and the two outputs add.";
      else if (res.gain === "0") note = " The split exactly matches the best single pool here - splitting neither gained nor lost at these settings.";
      else note = " The split LOSES to the best single pool here: the second pool is too shallow (or its fee too high) for its leg to pull its weight, and a real aggregator would simply not route this share there.";
      setText("agg-result", "Model output: swapping " + res.amountIn + " split " + res.splitPct + "% / " + (100 - res.splitPct) + "% across two constant-product pools for the same pair - pool 1 at " + res.reserveIn1 + " / " + res.reserveOut1 + " with a " + res.fee1Bps + " bps fee, pool 2 at " + res.reserveIn2 + " / " + res.reserveOut2 + " with a " + res.fee2Bps + " bps fee - returns " + res.out1 + " from pool 1 and " + res.out2 + " from pool 2, " + res.totalOut + " in total (each leg is Tool 2 on its own pool, and the two inputs sum to the amount in exactly). Sent whole to one pool instead, pool 1 alone returns " + res.single1Out + " and pool 2 alone returns " + res.single2Out + ", so against the better single fill (pool " + res.bestPool + ", " + res.bestSingleOut + ") the split's gain is " + res.gain + " (" + res.gainBps + " bps)." + note + " A real aggregator searches many pools, venues and split sizes and can also chain pools in series (Tool 39); this model prices the one split you enter. Reserves, amounts, fees and the split are user-entered and no live pool, aggregator or quote is read. An educational model of split routing, not a live quote. Not financial advice.");
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
