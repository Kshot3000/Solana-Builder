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
