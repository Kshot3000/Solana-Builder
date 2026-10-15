"use strict";
/* Solana-Builder site tests — run: node tests/test-site.js */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const guide = fs.readFileSync(path.join(root, "guides", "getting-started-solana.md"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = require(path.join(root, "app.js"));

const SOL = "G7xepVyQSrxtH61ZooXvPAmnS8omQ1TvHqB8qDmHXWm";
const SOL_INVALID_45 = SOL + "ED"; /* the stray-paste form — must never appear */
const SOL_OTHER = "9WMsvgpQQgtvfV4g2Mm7U6mHRGpVvEmFvQGAAu4aArU8"; /* Raydium-Renaissance address, not this hub's */

let failures = 0;
function check(name, cond) {
  console.log((cond ? "PASS" : "FAIL") + " " + name);
  if (!cond) failures++;
}
function near(name, got, want, tol) {
  check(name + " (got " + got + ", want ~" + want + ")", typeof got === "number" && Math.abs(got - want) <= tol);
}

/* attribution on every user-facing surface */
check("donation address is 43 chars", SOL.length === 43);
for (const [label, doc] of [["index.html", html], ["README", readme], ["guide", guide]]) {
  check("SOL donation address in " + label, doc.includes(SOL));
  check("invalid 45-char address absent from " + label, !doc.includes(SOL_INVALID_45));
  check("other workstream SOL address absent from " + label, !doc.includes(SOL_OTHER));
  check("@kshot9000 in " + label, doc.includes("@kshot9000"));
  check("Solana team GitHub tag in " + label, doc.includes("@solana-foundation"));
  check("Solana team X tag in " + label, doc.includes("https://x.com/solana"));
  check("Raydium team GitHub tag in " + label, doc.includes("@raydium-io"));
  check("Raydium team X tag in " + label, doc.includes("@Raydium"));
  check("not-affiliated honesty in " + label, /not affiliated with/i.test(doc));
}
check("no @RaydiumProtocol anywhere", !html.includes("@RaydiumProtocol") && !readme.includes("@RaydiumProtocol") && !guide.includes("@RaydiumProtocol"));
check("models labelled not-live / not-financial-advice in index.html",
  html.includes("not live quotes") && html.includes("not financial advice"));

/* structure */
check("exactly one <h1>", (html.match(/<h1[ >]/g) || []).length === 1);
check("has <main> landmark", /<main[\s>]/.test(html));
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=48"));
check("css non-trivial", css.length > 1500);
for (const id of ["sol-in", "lam-out", "lam-in", "sol-out", "swap-rin", "swap-rout", "swap-ain", "swap-fee", "swap-out", "rent-len", "rent-out", "il-ratio", "il-out", "fee-sigs", "fee-cu", "fee-price", "fee-out", "tok-dec", "tok-ui", "tok-raw-out", "tok-raw", "tok-ui-out", "addr-in", "addr-out", "stake-amt", "stake-yield", "stake-epochs", "stake-comm", "stake-out", "pay-recipient", "pay-amount", "pay-spl", "pay-ref", "pay-label", "pay-message", "pay-memo", "pay-out", "payparse-in", "payparse-out", "tick-in", "tick-price-out", "price-in", "price-tick-out", "range-lower", "range-upper", "range-current", "range-spacing", "range-out", "slip-expout", "slip-expin", "slip-bps", "slip-min-out", "slip-max-out", "epoch-slot-in", "epoch-out", "epochrange-in", "epochrange-out", "tfee-amt", "tfee-bps", "tfee-max", "tfee-fee-out", "tfee-net-out", "tgross-net", "tgross-bps", "tgross-max", "tgross-out", "sand-rin", "sand-rout", "sand-victim", "sand-attacker", "sand-fee", "sand-slip", "sand-victim-out", "sand-attacker-out", "lst-total", "lst-supply", "lst-rewards", "lst-deposit", "lst-redeem", "lst-rate-out", "lst-redeem-out", "pda-program", "pda-seed1", "pda-seed2", "pda-out", "clmmpos-l", "clmmpos-lower", "clmmpos-upper", "clmmpos-current", "clmmpos-a0-out", "clmmpos-a1-out", "lpdep-ra", "lpdep-rb", "lpdep-supply", "lpdep-da", "lpdep-db", "lpdep-minted-out", "lpdep-share-out", "vest-total", "vest-cliff", "vest-duration", "vest-elapsed", "vest-claim-out", "vest-cliff-out", "lend-amt", "lend-price", "lend-debt", "lend-liq", "lend-maxltv", "lend-hf-out", "lend-liqprice-out", "txsz-sigs", "txsz-keys", "txsz-lw", "txsz-lr", "txsz-accts", "txsz-data", "txsz-out", "txsz-head-out", "sp-f1-type", "sp-f1-n", "sp-f1-elem", "sp-f2-type", "sp-f2-n", "sp-f2-elem", "sp-f3-type", "sp-f3-n", "sp-f3-elem", "sp-f4-type", "sp-f4-n", "sp-f4-elem", "sp-total-out", "sp-rent-out", "split-price", "split-platform", "split-royalty", "split-fee-out", "split-royalty-out", "split-seller-out", "warm-amount", "warm-cluster", "warm-moving", "warm-rate", "warm-direction", "warm-epochs-out", "warm-first-out", "fgro-liq", "fgro-now-a", "fgro-last-a", "fgro-owed-a", "fgro-dec-a", "fgro-now-b", "fgro-last-b", "fgro-owed-b", "fgro-dec-b", "fgro-totala-out", "fgro-totalb-out", "infl-years", "infl-supply", "infl-disinfl", "infl-rate-out", "infl-issue-out", "ata-owner", "ata-mint", "ata-program", "ata-out", "cmt-depth", "cmt-buffer", "cmt-canopy", "cmt-size-out", "cmt-rent-out", "seed-base", "seed-seed", "seed-owner", "seed-out", "mcap-price", "mcap-circ", "mcap-total", "mcap-max", "mcap-out", "mcap-fdv-out", "alt-stored", "alt-w", "alt-r", "alt-size-out", "alt-rent-out", "pyth-price", "pyth-conf", "pyth-expo", "pyth-maxbps", "pyth-low-out", "pyth-high-out", "curve-vsol", "curve-vtok", "curve-supply", "curve-raised", "curve-target", "curve-buy", "curve-fee", "curve-price-out", "curve-tokens-out", "fund-size", "fund-price", "fund-rate", "fund-hours", "fund-side", "fund-notional-out", "fund-total-out", "irate-supplied", "irate-borrowed", "irate-base", "irate-slope1", "irate-uopt", "irate-slope2", "irate-reserve", "irate-days", "irate-borrow-out", "irate-supply-out", "irate-interest-out", "ppos-side", "ppos-size", "ppos-entry", "ppos-mark", "ppos-leverage", "ppos-mmr", "ppos-margin-out", "ppos-pnl-out", "ppos-liq-out", "stab-x", "stab-y", "stab-amp", "stab-dx", "stab-fee", "stab-d-out", "stab-net-out", "stab-price-out", "liqmax-amt", "liqmax-price", "liqmax-debt", "liqmax-bonus", "liqmax-close", "liqmax-repay-out", "liqmax-seized-out", "liqmax-remain-out", "route-rin1", "route-rmid1", "route-rmid2", "route-rout2", "route-ain", "route-fee1", "route-fee2", "route-mid-out", "route-out", "route-spot-out", "xo-rin", "xo-rout", "xo-aout", "xo-fee", "xo-in-out", "xo-actual-out", "arb-rin", "arb-rout", "arb-ain", "arb-fee", "arb-price", "arb-out-out", "arb-profit-out", "cswap-l", "cswap-lower", "cswap-upper", "cswap-current", "cswap-dir", "cswap-ain", "cswap-fee", "cswap-out-out", "cswap-price-out", "book-p1", "book-q1", "book-p2", "book-q2", "book-p3", "book-q3", "book-buy", "book-filled-out", "book-cost-out", "book-vwap-out", "twap-start", "twap-end", "twap-seconds", "twap-spot", "twap-avg-out", "twap-price-out", "lpwd-ra", "lpwd-rb", "lpwd-supply", "lpwd-burn", "lpwd-outa-out", "lpwd-outb-out", "air-recipients", "air-new", "air-batch", "air-amount", "air-priority", "air-tx-out", "air-total-out", "dutch-start", "dutch-floor", "dutch-duration", "dutch-elapsed", "dutch-step", "dutch-price-out", "dutch-drop-out", "gov-supply", "gov-for", "gov-against", "gov-abstain", "gov-quorum", "gov-approval", "gov-cast-out", "gov-verdict-out", "alloc-supply", "alloc-liquidity", "alloc-community", "alloc-team", "alloc-liq-out", "alloc-treasury-out", "qv-budget", "qv-a", "qv-b", "qv-c", "qv-total-out", "qv-remaining-out", "burn-supply", "burn-holder", "burn-amount", "burn-newsupply-out", "burn-after-out"]) {
  check("control labelled: " + id, html.includes(`for="${id}"`) && html.includes(`id="${id}"`));
}
for (const id of ["lamp-calc", "swap-calc", "rent-calc", "il-calc", "fee-calc", "tok-calc", "addr-calc", "stake-calc", "pay-calc", "payparse-calc", "tick-calc", "clmmrange-calc", "slip-calc", "lamp-result", "swap-result", "rent-result", "il-result", "fee-result", "tok-result", "addr-result", "stake-result", "pay-result", "payparse-result", "tick-result", "range-result", "slip-result", "epoch-calc", "epochrange-calc", "epoch-result", "epochrange-result", "tfee-calc", "tgross-calc", "tfee-result", "tgross-result", "sand-calc", "sand-result", "lst-calc", "lst-result", "pda-calc", "pda-result", "clmmpos-calc", "clmmpos-result", "lpdep-calc", "lpdep-result", "vest-calc", "vest-result", "lend-calc", "lend-result", "txsz-calc", "txsz-result", "sp-calc", "sp-result", "split-calc", "split-result", "warm-calc", "warm-result", "fgro-calc", "fgro-result", "infl-calc", "infl-result", "ata-calc", "ata-result", "cmt-calc", "cmt-result", "seed-calc", "seed-result", "mcap-calc", "mcap-result", "alt-calc", "alt-result", "pyth-calc", "pyth-result", "curve-calc", "curve-result", "fund-calc", "fund-result", "irate-calc", "irate-result", "ppos-calc", "ppos-result", "stab-calc", "stab-result", "liqmax-calc", "liqmax-result", "route-calc", "route-result", "xo-calc", "xo-result", "arb-calc", "arb-result", "cswap-calc", "cswap-result", "book-calc", "book-result", "twap-calc", "twap-result", "lpwd-calc", "lpwd-result", "air-calc", "air-result", "dutch-calc", "dutch-result", "gov-calc", "gov-result", "alloc-calc", "alloc-result", "qv-calc", "qv-result", "burn-calc", "burn-result", "donation-address", "copy-address"]) {
  check("element present: " + id, html.includes(`id="${id}"`));
}
check("fifty-five tool forms (fifty-one tools, Tools 9, 10, 12 and 13 each have two)", (html.match(/<form id=/g) || []).length === 55);

/* catalogue: 15 entries, Kyle's two flagged, filters cover the categories used */
const liCount = (html.match(/<li data-cat=/g) || []).length;
check("catalogue has 15 entries (got " + liCount + ")", liCount === 15);
check("exactly two entries flagged as my work", (html.match(/— my work/g) || []).length === 2);
for (const f of ["all", "mine", "core", "dex", "staking", "payments", "wallets", "nft"]) {
  check("filter button: " + f, html.includes(`data-filter="${f}"`));
}
for (const u of ["https://solana.com", "https://raydium.io", "https://jup.ag", "https://www.orca.so", "https://marinade.finance", "https://www.jito.network", "https://www.drift.trade", "https://www.anchor-lang.com", "https://solanapay.com", "https://phantom.app", "https://www.helius.dev", "https://solana.fm", "https://magiceden.io", "https://kshot3000.github.io/solana-pay-link-desk/", "https://kshot3000.github.io/Raydium-Renaissance/"]) {
  check("catalogue link: " + u, html.includes(u));
}

/* Tool 1 — lamports conversion, exact */
check("1.5 SOL = 1500000000 lamports", app.solToLamports("1.5") === "1500000000");
check("smallest unit: 0.000000001 SOL = 1 lamport", app.solToLamports("0.000000001") === "1");
check("10 decimal places rejected", app.solToLamports("0.0000000001") === null);
check("whole SOL", app.solToLamports("2") === "2000000000");
check("890880 lamports = 0.00089088 SOL", app.lamportsToSol("890880") === "0.00089088");
check("0 lamports = 0 SOL", app.lamportsToSol("0") === "0");
check("fractional lamports rejected", app.lamportsToSol("1.5") === null);
check("round trip 3.25", app.lamportsToSol(app.solToLamports("3.25")) === "3.25");

/* Tool 2 — constant-product swap */
const sw = app.cpSwap("1000000", "1000000", "10000", 25);
check("swap fee is 25 (25 bps of 10000)", sw && sw.fee === "25");
check("swap effective in is 9975", sw && sw.effectiveIn === "9975");
check("swap out exact", sw && sw.amountOut === "9876.48209114");
near("swap price impact ~0.9876%", sw && sw.priceImpactPct, 0.9876482091, 1e-6);
const sw0 = app.cpSwap("500000", "250000", "5000", 0);
check("zero-fee swap out matches raw x*y=k", sw0 && sw0.amountOut === "2475.247524752" && sw0.fee === "0");
check("swap rejects zero reserve", app.cpSwap("0", "100", "10", 25) === null);
check("swap rejects fee >= 10000 bps", app.cpSwap("100", "100", "10", 10000) === null);
check("swap rejects negative fee", app.cpSwap("100", "100", "10", -1) === null);
check("swap rejects dust that floors to zero out", app.cpSwap("1000000000", "0.000000001", "0.000000001", 0) === null);

/* Tool 3 — rent exemption, against the network's canonical figures */
const r0 = app.rentExempt(0);
check("0-byte account rent-exempt = 890880 lamports", r0 && r0.rentExemptLamports === 890880);
const rMint = app.rentExempt(82);
check("mint (82 bytes) rent-exempt = 1461600 lamports", rMint && rMint.rentExemptLamports === 1461600);
const rTok = app.rentExempt(165);
check("token account (165 bytes) rent-exempt = 2039280 lamports", rTok && rTok.rentExemptLamports === 2039280);
check("rent per year is half the exempt minimum", rTok && rTok.rentPerYearLamports * 2 === rTok.rentExemptLamports);
check("rent rejects negative length", app.rentExempt(-1) === null);
check("rent rejects fractional length", app.rentExempt(1.5) === null);

/* Tool 4 — impermanent loss */
near("IL at 4x is -20%", app.impermanentLoss("4").ilPct, -20, 1e-9);
near("IL at 0.25x is -20% (symmetric)", app.impermanentLoss("0.25").ilPct, -20, 1e-9);
near("IL at 1x is 0%", app.impermanentLoss("1").ilPct, 0, 1e-12);
near("IL at 2x is about -5.7191%", app.impermanentLoss("2").ilPct, -5.719095, 1e-4);
check("IL rejects zero ratio", app.impermanentLoss("0") === null);
check("IL rejects junk", app.impermanentLoss("abc") === null);

/* Tool 5 — transaction fee (base + priority), checked against the canonical formula */
const tf = app.txFee(1, 200000, 10000);
check("base fee is 5000 lamports per signature", tf && tf.baseFeeLamports === 5000);
check("200k CU @10,000 micro = 2000 lamports priority", tf && tf.priorityFeeLamports === 2000);
check("total fee 7000 lamports = 0.000007 SOL", tf && tf.totalFeeLamports === 7000 && tf.totalFeeSol === "0.000007");
const tf2 = app.txFee(1, 300000, 50000);
check("300k CU @50,000 micro = 15000 lamports priority, 20000 total", tf2 && tf2.priorityFeeLamports === 15000 && tf2.totalFeeLamports === 20000 && tf2.totalFeeSol === "0.00002");
const tf3 = app.txFee(2, 200000, 10000);
check("two signatures double the base fee", tf3 && tf3.baseFeeLamports === 10000 && tf3.totalFeeLamports === 12000);
check("zero price means zero priority fee", (() => { const t = app.txFee(1, 200000, 0); return t && t.priorityFeeLamports === 0 && t.totalFeeLamports === 5000; })());
check("priority fee rounds UP, not down (1 CU @ 1 micro = 1 lamport)", (() => { const t = app.txFee(1, 1, 1); return t && t.priorityFeeLamports === 1 && t.totalFeeLamports === 5001; })());
check("CU limit capped at 1400000", (() => { const t = app.txFee(1, 1400000, 100000); return t && t.priorityFeeLamports === 140000 && t.totalFeeLamports === 145000; })());
check("txFee rejects CU limit above the runtime cap", app.txFee(1, 1400001, 1000) === null);
check("txFee rejects zero CU limit", app.txFee(1, 0, 1000) === null);
check("txFee rejects zero signatures", app.txFee(0, 200000, 1000) === null);
check("txFee rejects negative price", app.txFee(1, 200000, -1) === null);
check("txFee rejects fractional CU limit", app.txFee(1, 200000.5, 1000) === null);
check("txFee exposes the base-fee and CU-limit constants", app.BASE_FEE_LAMPORTS_PER_SIGNATURE === 5000 && app.MAX_COMPUTE_UNIT_LIMIT === 1400000);

/* Tool 6 — SPL token amounts: UI <-> raw by the mint's own decimals, exact BigInt */
check("1.5 at 6 decimals (USDC-style) = 1500000 raw", app.tokenToRaw("1.5", 6) === "1500000");
check("smallest USDC unit: 0.000001 = 1 raw", app.tokenToRaw("0.000001", 6) === "1");
check("finer than the mint allows rejected, not rounded", app.tokenToRaw("0.0000001", 6) === null);
check("at 9 decimals the token converter agrees with Tool 1", app.tokenToRaw("2", 9) === app.solToLamports("2"));
check("zero-decimal mint: whole amounts only", app.tokenToRaw("5", 0) === "5" && app.tokenToRaw("5.1", 0) === null);
check("large amount stays exact beyond u64/float precision", app.tokenToRaw("123456789.123456789", 9) === "123456789123456789");
check("1500000 raw at 6 decimals = 1.5", app.rawToToken("1500000", 6) === "1.5");
check("1 raw at 6 decimals = 0.000001", app.rawToToken("1", 6) === "0.000001");
check("trailing zeros trimmed: 1000000 raw = 1", app.rawToToken("1000000", 6) === "1");
check("0 raw = 0 at any decimals", app.rawToToken("0", 6) === "0" && app.rawToToken("0", 0) === "0");
check("fractional raw rejected", app.rawToToken("1.5", 6) === null);
check("negative amounts rejected both ways", app.tokenToRaw("-1", 6) === null && app.rawToToken("-1", 6) === null);
check("decimals above the 18 cap rejected", app.tokenToRaw("1", 19) === null && app.rawToToken("1", 19) === null);
check("negative or fractional decimals rejected", app.tokenToRaw("1", -1) === null && app.tokenToRaw("1", 2.5) === null);
check("round trip 42.42 at 6 decimals", app.rawToToken(app.tokenToRaw("42.42", 6), 6) === "42.42");
check("token converter exposes the decimals cap", app.MAX_TOKEN_DECIMALS === 18);
check("guide teaches token decimals (Tool 6)", guide.includes("Tool 6") && guide.includes("10^decimals"));

/* Tool 7 — address checker: base58 format, exactly 32 decoded bytes */
check("hub donation address is valid format (43 chars, 32 bytes)", (() => { const r = app.checkAddress(SOL); return r.valid && r.charLength === 43 && r.byteLength === 32; })());
check("invalid 45-char stray-paste form rejected as wrong length (33 bytes)", (() => { const r = app.checkAddress(SOL_INVALID_45); return !r.valid && r.reason === "wrong-length" && r.byteLength === 33; })());
check("System Program address (32 ones) is 32 zero bytes and valid", (() => { const r = app.checkAddress("11111111111111111111111111111111"); const b = app.base58Decode("11111111111111111111111111111111"); return r.valid && b.length === 32 && b.every((x) => x === 0); })());
check("wrapped SOL mint valid", app.checkAddress("So11111111111111111111111111111111111111112").valid === true);
check("USDC mint valid (44 chars)", app.checkAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").valid === true);
check("SPL Token program valid", app.checkAddress("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").valid === true);
check("characters 0 O I l each rejected as invalid-character", ["0", "O", "I", "l"].every((c) => app.checkAddress("abc" + c + "def").reason === "invalid-character"));
check("bad character is named", app.checkAddress("abc0def").badCharacter === "0");
check("empty and whitespace-only rejected as empty", app.checkAddress("").reason === "empty" && app.checkAddress("   ").reason === "empty");
check("short base58 rejected as wrong length", (() => { const r = app.checkAddress("1111"); return !r.valid && r.reason === "wrong-length" && r.byteLength === 4; })());
check("internal space rejected as invalid character", app.checkAddress("G7xep VyQ").reason === "invalid-character");
check("outer whitespace trimmed before checking", app.checkAddress("  " + SOL + " ").valid === true);
check("non-string rejected", app.checkAddress(null).valid === false && app.checkAddress(42).valid === false);
check("decode-encode round trip on real addresses", [SOL, "So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "11111111111111111111111111111111"].every((a) => app.base58Encode(app.base58Decode(a)) === a));
check("encode of 32 zero bytes is 32 ones", app.base58Encode(new Array(32).fill(0)) === "11111111111111111111111111111111");
check("base58Decode rejects junk and empty", app.base58Decode("0") === null && app.base58Decode("") === null);
check("base58 alphabet omits 0 O I l and has 58 chars", app.BASE58_ALPHABET.length === 58 && !/[0OIl]/.test(app.BASE58_ALPHABET));
check("guide teaches address format (Tool 7)", guide.includes("Tool 7") && guide.includes("32 bytes"));
check("address checker labelled format-only in index.html", html.includes("This checks format only"));

/* Tool 8 — staking rewards: per-epoch compounding, commission off the reward.
   Headline vectors prototype-verified in a clean foreground run before pinning:
   7.3% / 182.5 epochs-per-year = exactly 0.04% per epoch. */
near("staking: first epoch net at 7.3%, 10% commission = 0.036 SOL on 100", app.stakingRewards("100", 7.3, 1, 10).firstEpochNetSol, 0.036, 1e-12);
near("staking: one epoch, no commission = 0.04 SOL", app.stakingRewards("100", 7.3, 1, 0).totalRewardsSol, 0.04, 1e-12);
near("staking: 182 epochs at 7.3%, no commission compounds to ~7.55 SOL", app.stakingRewards("100", 7.3, 182, 0).totalRewardsSol, 7.549975710464878, 1e-9);
check("staking: compounding beats simple interest over 182 epochs", app.stakingRewards("100", 7.3, 182, 0).totalRewardsSol > 100 * 0.0004 * 182);
near("staking: 365 epochs at 7.3%, 5% commission", app.stakingRewards("100", 7.3, 365, 5).totalRewardsSol, 14.874914876097733, 1e-9);
check("staking: zero yield earns nothing", app.stakingRewards("100", 0, 182, 0).totalRewardsSol === 0);
check("staking: 100% commission earns nothing", app.stakingRewards("100", 7.3, 182, 100).totalRewardsSol === 0);
check("staking: final = stake + rewards", (() => { const r = app.stakingRewards("1000", 5, 10, 8); return Math.abs(r.finalStakeSol - (1000 + r.totalRewardsSol)) < 1e-9; })());
near("staking: 1000 SOL at 5%, 10 epochs, 8% commission first epoch", app.stakingRewards("1000", 5, 10, 8).firstEpochNetSol, 0.25205479452054796, 1e-12);
check("staking rejects zero stake", app.stakingRewards("0", 7.3, 10, 5) === null);
check("staking rejects yield over 100%", app.stakingRewards("100", 101, 10, 5) === null);
check("staking rejects negative yield", app.stakingRewards("100", -1, 10, 5) === null);
check("staking rejects zero epochs", app.stakingRewards("100", 7.3, 0, 5) === null);
check("staking rejects epochs above the model cap", app.stakingRewards("100", 7.3, 1826, 5) === null);
check("staking rejects fractional epochs", app.stakingRewards("100", 7.3, 10.5, 5) === null);
check("staking rejects commission over 100%", app.stakingRewards("100", 7.3, 10, 101) === null);
check("staking rejects junk stake", app.stakingRewards("abc", 7.3, 10, 5) === null);
check("staking exposes epoch constants", app.SLOTS_PER_EPOCH === 432000 && app.EPOCHS_PER_YEAR === 182.5 && app.MAX_STAKING_EPOCHS === 1825);
check("guide teaches staking rewards (Tool 8)", guide.includes("Tool 8") && guide.includes("432,000 slots"));
check("staking labelled assumption-not-live in index.html", html.includes("The yield is your assumption"));

/* Tool 9 — Solana Pay transfer-request URLs. The three build vectors are the
   official specification's own examples, byte-for-byte. */
const MV = "mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
check("pay: spec example 1 builds byte-for-byte", app.buildSolanaPayUrl({ recipient: MV, amount: "1", label: "Michael", message: "Thanks for all the fish", memo: "OrderId12345" }) === "solana:" + MV + "?amount=1&label=Michael&message=Thanks%20for%20all%20the%20fish&memo=OrderId12345");
check("pay: spec example 2 (0.01 USDC) builds byte-for-byte", app.buildSolanaPayUrl({ recipient: MV, amount: "0.01", splToken: USDC_MINT }) === "solana:" + MV + "?amount=0.01&spl-token=" + USDC_MINT);
check("pay: spec example 3 (label only, amount left to the wallet)", app.buildSolanaPayUrl({ recipient: MV, label: "Michael" }) === "solana:" + MV + "?label=Michael");
check("pay: spec example 1 parses back to its fields", (() => { const p = app.parseSolanaPayUrl("solana:" + MV + "?amount=1&label=Michael&message=Thanks%20for%20all%20the%20fish&memo=OrderId12345"); return p && p.recipient === MV && p.amount === "1" && p.splToken === null && p.label === "Michael" && p.message === "Thanks for all the fish" && p.memo === "OrderId12345" && p.asset === "SOL" && p.references.length === 0; })());
check("pay: amount 0 is valid (spec)", app.buildSolanaPayUrl({ recipient: MV, amount: "0" }) === "solana:" + MV + "?amount=0");
check("pay: amount below 1 without a leading 0 rejected", app.buildSolanaPayUrl({ recipient: MV, amount: ".5" }) === null);
check("pay: scientific notation rejected", app.buildSolanaPayUrl({ recipient: MV, amount: "1e3" }) === null && app.validPayAmount("1e3", null) === false);
check("pay: SOL amount at 9 decimals ok, 10 rejected", app.buildSolanaPayUrl({ recipient: MV, amount: "0.000000001" }) !== null && app.buildSolanaPayUrl({ recipient: MV, amount: "0.0000000001" }) === null);
check("pay: trailing zeros past 9 decimals carry no precision", app.buildSolanaPayUrl({ recipient: MV, amount: "1.0000000000" }) !== null);
check("pay: USDC amount at 7 decimals rejected, 6 ok", app.buildSolanaPayUrl({ recipient: MV, amount: "0.0000001", splToken: USDC_MINT }) === null && app.buildSolanaPayUrl({ recipient: MV, amount: "0.000001", splToken: USDC_MINT }) !== null);
check("pay: unknown mint precision cannot be checked locally", app.buildSolanaPayUrl({ recipient: MV, amount: "0.000000000001", splToken: "So11111111111111111111111111111111111111112" }) !== null);
check("pay: known-mint table holds USDC + USDG at 6", app.KNOWN_MINT_DECIMALS[USDC_MINT] === 6 && app.KNOWN_MINT_DECIMALS["2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH"] === 6);
check("pay: two references keep their order both ways", (() => { const u = app.buildSolanaPayUrl({ recipient: MV, amount: "2", references: ["11111111111111111111111111111111", USDC_MINT] }); const p = app.parseSolanaPayUrl(u); return u === "solana:" + MV + "?amount=2&reference=11111111111111111111111111111111&reference=" + USDC_MINT && p.references[0] === "11111111111111111111111111111111" && p.references[1] === USDC_MINT; })());
check("pay: build-parse-build round trip with memo needing encoding", (() => { const f = { recipient: MV, amount: "3.25", splToken: USDC_MINT, reference: "11111111111111111111111111111111", label: "A B", memo: "x&y" }; return app.buildSolanaPayUrl(app.parseSolanaPayUrl(app.buildSolanaPayUrl(f))) === app.buildSolanaPayUrl(f); })());
check("pay: memo ampersand is percent-encoded", app.buildSolanaPayUrl({ recipient: MV, memo: "x&y" }) === "solana:" + MV + "?memo=x%26y");
check("pay: duplicate amount in a parsed URL rejected, not first/last-wins", app.parseSolanaPayUrl("solana:" + MV + "?amount=1&amount=999") === null);
check("pay: duplicate spl-token in a parsed URL rejected", app.parseSolanaPayUrl("solana:" + MV + "?spl-token=" + USDC_MINT + "&spl-token=So11111111111111111111111111111111111111112") === null);
check("pay: malformed percent-encoding rejected", app.parseSolanaPayUrl("solana:" + MV + "?label=%E0%A4%A") === null);
check("pay: wrong scheme rejected", app.parseSolanaPayUrl("https:" + MV + "?amount=1") === null && app.parseSolanaPayUrl("solana-pay:" + MV) === null);
check("pay: invalid recipient rejected both ways", app.buildSolanaPayUrl({ recipient: "abc0def", amount: "1" }) === null && app.parseSolanaPayUrl("solana:abc0def?amount=1") === null);
check("pay: 45-char stray-paste recipient rejected", app.buildSolanaPayUrl({ recipient: SOL_INVALID_45, amount: "1" }) === null);
check("pay: present-but-empty mint refused, not dropped into a SOL link", app.buildSolanaPayUrl({ recipient: MV, splToken: "" }) === null && app.parseSolanaPayUrl("solana:" + MV + "?spl-token=") === null);
check("pay: present-but-empty reference refused", app.buildSolanaPayUrl({ recipient: MV, reference: "" }) === null && app.parseSolanaPayUrl("solana:" + MV + "?reference=abc") === null);
check("pay: bare recipient parses with the amount left to the wallet", (() => { const p = app.parseSolanaPayUrl("solana:" + MV); return p && p.amount === null && p.asset === "SOL"; })());
check("pay: hub donation address builds a link", app.buildSolanaPayUrl({ recipient: SOL, amount: "0.1", label: "Solana Ecosystem Builder" }) === "solana:" + SOL + "?amount=0.1&label=Solana%20Ecosystem%20Builder");
check("guide teaches Solana Pay (Tool 9)", guide.includes("Tool 9") && guide.includes("associated token accounts must not be used"));
check("pay tool labelled local / nothing sent in index.html", html.includes("nothing is sent and no wallet opens") && html.includes("associated token accounts must not be used"));

/* Tool 10 — CLMM ticks: price(tick) = 1.0001^tick, range [-443636, 443636] */
near("clmm: tick 0 is price 1", app.tickToPrice(0), 1, 1e-12);
near("clmm: tick 1 is price 1.0001", app.tickToPrice(1), 1.0001, 1e-12);
near("clmm: tick 100 is price ~1.01004966", app.tickToPrice(100), 1.0100496620928754, 1e-12);
near("clmm: tick -100 is price ~0.99005033", app.tickToPrice(-100), 0.9900503287412106, 1e-12);
near("clmm: tick 10000 is price ~2.71814593", app.tickToPrice(10000), 2.7181459268249255, 1e-9);
check("clmm: tick bounds exposed", app.MIN_TICK === -443636 && app.MAX_TICK === 443636 && app.TICK_BASE === 1.0001);
check("clmm: tick above max rejected", app.tickToPrice(443637) === null);
check("clmm: tick below min rejected", app.tickToPrice(-443637) === null);
check("clmm: fractional tick rejected", app.tickToPrice(1.5) === null);
check("clmm: price 1 is tick 0", app.priceToTick("1") === 0);
check("clmm: price 1.0001 is tick 1 (exact power round-trips)", app.priceToTick("1.0001") === 1);
check("clmm: price 2 floors to tick 6931", app.priceToTick("2") === 6931);
check("clmm: price 0.5 floors to tick -6932", app.priceToTick("0.5") === -6932);
check("clmm: tick->price->tick round trip", [0, 1, -1, 100, -100, 10000, -20000, 443636, -443636].every((t) => app.priceToTick(String(app.tickToPrice(t))) === t));
check("clmm: price above the tick range rejected", app.priceToTick("1e20") === null);
check("clmm: price below the tick range rejected", app.priceToTick("1e-20") === null);
check("clmm: zero / negative / junk price rejected", app.priceToTick("0") === null && app.priceToTick("-2") === null && app.priceToTick("abc") === null);
const rng = app.clmmRange(-600, 600, 0, 60);
check("clmm range: centred range is in range at tick 0", rng && rng.inRange === true);
near("clmm range: width ratio for -600..600", rng && rng.widthRatio, 1.1274900870695084, 1e-9);
near("clmm range: lower price", rng && rng.priceLower, Math.pow(1.0001, -600), 1e-12);
check("clmm range: current == lower is IN range", app.clmmRange(-600, 600, -600, 60).inRange === true);
check("clmm range: current == upper is OUT of range", app.clmmRange(-600, 600, 600, 60).inRange === false);
check("clmm range: current below range is out", app.clmmRange(-600, 600, -660, 60).inRange === false);
check("clmm range: misaligned endpoint rejected (spacing 60, tick 610)", app.clmmRange(-600, 610, 0, 60) === null);
check("clmm range: negative misaligned endpoint rejected", app.clmmRange(-610, 600, 0, 60) === null);
check("clmm range: spacing 1 aligns everything", app.clmmRange(-611, 613, 0, 1) !== null);
check("clmm range: lower >= upper rejected", app.clmmRange(600, 600, 0, 60) === null && app.clmmRange(600, -600, 0, 60) === null);
check("clmm range: zero spacing rejected", app.clmmRange(-600, 600, 0, 0) === null);
check("clmm range: out-of-bounds tick rejected", app.clmmRange(-443640, 600, 0, 60) === null);
check("guide teaches CLMM ticks (Tool 10)", guide.includes("Tool 10") && guide.includes("1.0001^tick"));
check("clmm tool labelled raw-units / not-live in index.html", html.includes("raw token units") && html.includes("not a live pool quote"));

/* Tool 11 — slippage bounds: min = out*(10000-bps)/10000 floored, max = in*(10000+bps)/10000 floored.
   Vectors prototype-verified in a clean foreground run before pinning. */
const sl1 = app.slippageAmounts("10000", "10000", 25);
check("slip: 10000 at 25 bps -> min 9975 / max 10025", sl1 && sl1.minimumReceived === "9975" && sl1.maximumInput === "10025" && sl1.tolerancePct === 0.25);
const sl2 = app.slippageAmounts("9876.48209114", "10000", 50);
check("slip: Tool 2 headline out at 50 bps -> min 9827.099680684", sl2 && sl2.minimumReceived === "9827.099680684" && sl2.maximumInput === "10050");
check("slip: expected 4 at 0.5% protects at 3.98, never rounded back to 4", app.slippageAmounts("4", "199", 50).minimumReceived === "3.98");
check("slip: max input floors too (199 at 0.5% -> 199.995, not 200)", app.slippageAmounts("4", "199", 50).maximumInput === "199.995");
check("slip: zero tolerance returns the quotes unchanged", (() => { const r = app.slippageAmounts("100", "100", 0); return r.minimumReceived === "100" && r.maximumInput === "100" && r.minimumIsZero === false; })());
check("slip: dust minimum floors to exactly 0 and is flagged", (() => { const r = app.slippageAmounts("0.000000001", "0.000000001", 1); return r.minimumReceived === "0" && r.minimumIsZero === true && r.maximumInput === "0.000000001"; })());
check("slip: minimum never exceeds the quote, maximum never below it (sweep)", [1, 10, 50, 100, 500, 5000, 9999].every((b) => { const r = app.slippageAmounts("12345.6789", "12345.6789", b); return Number(r.minimumReceived) <= 12345.6789 && Number(r.maximumInput) >= 12345.6789; }));
check("slip: rejects tolerance at/over 10000 bps and negative/fractional", app.slippageAmounts("100", "100", 10000) === null && app.slippageAmounts("100", "100", -1) === null && app.slippageAmounts("100", "100", 2.5) === null);
check("slip: rejects zero/junk amounts and >9dp", app.slippageAmounts("0", "100", 25) === null && app.slippageAmounts("abc", "100", 25) === null && app.slippageAmounts("0.0000000001", "100", 25) === null);
check("slip: exposes the bps cap", app.MAX_SLIPPAGE_BPS === 9999);
check("guide teaches slippage (Tool 11)", guide.includes("Tool 11") && guide.includes("3.98"));
check("slip tool labelled model / not-live in index.html", html.includes("An educational model of the bound, not a live quote"));

/* Tool 12 — epoch schedule WITH warmup: epochs 0..13 hold 32*2^e slots,
   first normal epoch 14 starts at slot 524256, then 432000 slots/epoch.
   Vectors prototype-verified in a clean foreground run before pinning. */
check("epoch: constants exposed", app.MIN_SLOTS_PER_EPOCH === 32 && app.FIRST_NORMAL_EPOCH === 14 && app.FIRST_NORMAL_SLOT === 524256 && app.SLOTS_PER_EPOCH === 432000);
check("epoch: slot 0 is epoch 0, 32 slots, warmup", (() => { const r = app.epochForSlot(0); return r.epoch === 0 && r.slotIndex === 0 && r.slotsInEpoch === 32 && r.firstSlot === 0 && r.lastSlot === 31 && r.warmup === true; })());
check("epoch: slot 31 closes epoch 0, slot 32 opens epoch 1 (64 slots)", app.epochForSlot(31).epoch === 0 && (() => { const r = app.epochForSlot(32); return r.epoch === 1 && r.firstSlot === 32 && r.lastSlot === 95 && r.slotsInEpoch === 64; })());
check("epoch: warmup lengths double (epoch 2 = 128, epoch 13 = 262144)", app.slotsInEpoch(2) === 128 && app.slotsInEpoch(13) === 262144 && app.slotsInEpoch(14) === 432000);
check("epoch: last warmup slot 524255 is epoch 13", (() => { const r = app.epochForSlot(524255); return r.epoch === 13 && r.slotIndex === 262143 && r.warmup === true; })());
check("epoch: slot 524256 is epoch 14, NOT the naive epoch 1", (() => { const r = app.epochForSlot(524256); return r.epoch === 14 && r.slotIndex === 0 && r.warmup === false && Math.floor(524256 / 432000) === 1; })());
check("epoch: epoch 14 runs 524256..956255, epoch 15 starts 956256", (() => { const a = app.epochRange(14); const b = app.epochForSlot(956256); return a.firstSlot === 524256 && a.lastSlot === 956255 && a.slotsInEpoch === 432000 && b.epoch === 15 && b.firstSlot === 956256; })());
check("epoch: modern slot 350,000,000 is epoch 822, index 419,744", (() => { const r = app.epochForSlot(350000000); return r.epoch === 822 && r.slotIndex === 419744 && r.firstSlot === 349580256 && r.lastSlot === 350012255; })());
check("epoch: slot ranges are contiguous and invert for epochs 0..30", (() => { for (let e = 0; e <= 30; e++) { const rg = app.epochRange(e); if (app.epochForSlot(rg.firstSlot).epoch !== e || app.epochForSlot(rg.lastSlot).epoch !== e) return false; if (e > 0 && rg.firstSlot !== app.epochRange(e - 1).lastSlot + 1) return false; } return true; })());
check("epoch: firstSlot + slotIndex returns the slot (sweep)", [0, 1, 31, 32, 1000, 524255, 524256, 524257, 1000000, 123456789, 350000000].every((s) => { const r = app.epochForSlot(s); return r.firstSlot + r.slotIndex === s; }));
check("epoch: naive division never recovers the real epoch past warmup", [524256, 1000000, 10000000, 350000000].every((s) => app.epochForSlot(s).epoch - Math.floor(s / 432000) >= 12));
check("epoch: epoch 0 range is slots 0..31", (() => { const r = app.epochRange(0); return r.firstSlot === 0 && r.lastSlot === 31 && r.warmup === true; })());
check("epoch: rejects negative / fractional / junk / unsafe", app.epochForSlot(-1) === null && app.epochForSlot(1.5) === null && app.epochForSlot("abc") === null && app.epochForSlot(Math.pow(2, 60)) === null && app.epochRange(-1) === null && app.slotsInEpoch("x") === null);
check("epoch: string inputs accepted like the other tools", app.epochForSlot("524256").epoch === 14 && app.epochRange("14").firstSlot === 524256);
check("guide teaches the epoch schedule (Tool 12)", guide.includes("Tool 12") && guide.includes("524,256"));
check("epoch tool labelled slots-only / not-live in index.html", html.includes("does not convert to dates or times") || html.includes("it deliberately does not convert to dates or times"));

/* Tool 13 — Token-2022 transfer fee: fee = ceil(amount * bps / 10000) capped
   at maximumFee, on raw amounts; gross-up = smallest send whose net lands
   exactly. Vectors prototype-verified before pinning: the fee direction
   against a naive ceiling sweep, the gross-up against full enumeration on
   12,060 small cases plus O(1) minimality on large ones — zero mismatches. */
check("tfee: headline cap — 1,000,000 at 100 bps, max 5,000 -> fee 5,000 capped, net 995,000", (() => { const r = app.transferFee("1000000", 100, "5000"); return r.fee === "5000" && r.netReceived === "995000" && r.capped === true; })());
check("tfee: 10,000 at 25 bps -> fee 25, net 9,975, not capped", (() => { const r = app.transferFee("10000", 25, "1000000"); return r.fee === "25" && r.netReceived === "9975" && r.capped === false; })());
check("tfee: ceiling rounds up — 101 at 50 bps -> fee 1 (0.505 ceils), net 100", (() => { const r = app.transferFee("101", 50, "1000000"); return r.fee === "1" && r.netReceived === "100"; })());
check("tfee: smallest transfer pays the 1-unit minimum — 1 at 1 bp -> fee 1, net 0", (() => { const r = app.transferFee("1", 1, "1000000"); return r.fee === "1" && r.netReceived === "0"; })());
check("tfee: zero amount pays zero fee", (() => { const r = app.transferFee("0", 500, "100"); return r.fee === "0" && r.netReceived === "0" && r.capped === false; })());
check("tfee: zero rate pays zero fee", (() => { const r = app.transferFee("1000000", 0, "5000"); return r.fee === "0" && r.netReceived === "1000000"; })());
check("tfee: zero maximum fee caps every fee to zero", (() => { const r = app.transferFee("1000", 500, "0"); return r.fee === "0" && r.netReceived === "1000" && r.capped === true; })());
check("tfee: raw fee exactly at the maximum is not capped past it", (() => { const r = app.transferFee("1000000", 50, "5000"); return r.fee === "5000" && r.capped === false; })());
check("tfee: 100% rate with a cap — 1,000 at 10,000 bps, max 10 -> fee 10", (() => { const r = app.transferFee("1000", 10000, "10"); return r.fee === "10" && r.netReceived === "990" && r.capped === true; })());
check("tfee: 100% rate uncapped delivers nothing", (() => { const r = app.transferFee("777", 10000, "999999999"); return r.fee === "777" && r.netReceived === "0"; })());
check("tfee: huge raw amounts stay exact beyond float precision", (() => { const r = app.transferFee("123456789123456789", 33, "999999999999999999"); return r.fee === "407407404107408" && r.netReceived === "123049381719349381"; })());
check("tfee: fee + net always reconstruct the amount (sweep)", [[1, 1, "0"], [7, 9999, "3"], [100, 50, "1000000"], [999983, 123, "456"], [500000, 10000, "0"]].every(([a, b, m]) => { const r = app.transferFee(String(a), b, m); return BigInt(r.fee) + BigInt(r.netReceived) === BigInt(a); }));
check("tfee: rejects rate over 10000 bps, negative and fractional rates", app.transferFee("100", 10001, "10") === null && app.transferFee("100", -1, "10") === null && app.transferFee("100", 2.5, "10") === null);
check("tfee: rejects fractional / junk / negative raw amounts and caps", app.transferFee("1.5", 50, "10") === null && app.transferFee("abc", 50, "10") === null && app.transferFee("-5", 50, "10") === null && app.transferFee("100", 50, "1.5") === null && app.transferFee("100", 50, "-1") === null);
check("tfee: exposes the basis-point cap", app.MAX_FEE_BASIS_POINTS === 10000);
check("tgross: headline — net 995,000 at 100 bps, max 5,000 -> send 1,000,000, fee 5,000 capped", (() => { const r = app.transferFeeGrossUp("995000", 100, "5000"); return r.grossAmount === "1000000" && r.fee === "5000" && r.capped === true; })());
check("tgross: net 100 at 50 bps -> send 101, fee 1", (() => { const r = app.transferFeeGrossUp("100", 50, "1000000"); return r.grossAmount === "101" && r.fee === "1"; })());
check("tgross: net 1 at 1 bp -> send 2 (the ceiling takes 1 from any positive send)", (() => { const r = app.transferFeeGrossUp("1", 1, "1000000"); return r.grossAmount === "2" && r.fee === "1"; })());
check("tgross: net 0 -> send 0", (() => { const r = app.transferFeeGrossUp("0", 500, "100"); return r.grossAmount === "0" && r.fee === "0"; })());
check("tgross: net 100 at 100% rate, max 10 -> send 110, fee 10", (() => { const r = app.transferFeeGrossUp("100", 10000, "10"); return r.grossAmount === "110" && r.fee === "10"; })());
check("tgross: zero rate sends the net itself", (() => { const r = app.transferFeeGrossUp("12345", 0, "5000"); return r.grossAmount === "12345" && r.fee === "0"; })());
check("tgross: gross-up lands exactly and one unit less under-delivers (sweep)", [["1", 1, "1000000"], ["100", 50, "1000000"], ["995000", 100, "5000"], ["999", 9999, "3"], ["123456789123456789", 33, "999999999999999999"], ["500", 10000, "0"]].every(([n, b, m]) => { const g = app.transferFeeGrossUp(n, b, m); if (app.transferFee(g.grossAmount, b, m).netReceived !== n) return false; if (g.grossAmount === "0") return true; return app.transferFee((BigInt(g.grossAmount) - 1n).toString(), b, m).netReceived !== n; }));
check("tgross: rejects junk like the fee direction", app.transferFeeGrossUp("1.5", 50, "10") === null && app.transferFeeGrossUp("100", 10001, "10") === null && app.transferFeeGrossUp("100", 50, "-1") === null);
check("guide teaches Token-2022 transfer fees (Tool 13)", guide.includes("Tool 13") && guide.includes("ceil(amount"));
check("tfee tool labelled model / not-live in index.html", html.includes("An educational model of the program's fee math, not a live quote") && html.includes("classic SPL Token program has no transfer fees"));

/* Tool 14 — sandwich attack: three cpSwap legs (front, victim, back) against
   the reserves each leg leaves; victim protected iff attempted fill < floored
   minimum at the tolerance. Vectors prototyped against cpSwap before pinning. */
check("sand: headline loose tolerance — victim loses 15.10132183 B, attacker profits 17.478992956 A", (() => { const r = app.sandwichAttack("1000", "1000", "100", "100", 25, 2000); return r.baselineOut === "90.70243237" && r.frontOut === "90.70243237" && r.attemptedVictimOut === "75.60111054" && r.minimumReceived === "72.561945896" && r.victimProtected === false && r.victimOut === "75.60111054" && r.backOut === "117.478992956" && r.attackerProfit === "17.478992956" && r.victimLoss === "15.10132183"; })());
check("sand: tight 50 bps tolerance protects — victim aborts, attacker loses 0.454183462 unwinding", (() => { const r = app.sandwichAttack("1000", "1000", "100", "100", 25, 50); return r.victimProtected === true && r.minimumReceived === "90.248920208" && r.victimOut === "0" && r.victimLoss === "0" && r.backOut === "99.545816538" && r.attackerProfit === "-0.454183462"; })());
check("sand: protection boundary is exact — 1665 bps passes, 1664 bps protects", app.sandwichAttack("1000", "1000", "100", "100", 25, 1665).victimProtected === false && app.sandwichAttack("1000", "1000", "100", "100", 25, 1664).victimProtected === true);
check("sand: zero-fee headline — victim 75.757575757, attacker profit 18.032786885", (() => { const r = app.sandwichAttack("1000", "1000", "100", "100", 0, 2000); return r.attemptedVictimOut === "75.757575757" && r.attackerProfit === "18.032786885" && r.victimLoss === "15.151515152"; })());
check("sand: small victim cannot cover round-trip — attack loses even when the fill passes", (() => { const r = app.sandwichAttack("1000", "1000", "1", "1000", 25, 9999); return r.victimProtected === false && r.attackerProfit === "-1.754940477" && r.victimLoss === "0.746943346"; })());
check("sand: legs are cpSwap verbatim (front = baseline for equal inputs; back leg recomputed)", (() => { const r = app.sandwichAttack("1000", "2000", "50", "200", 30, 2000); if (r.frontOut !== app.cpSwap("1000", "2000", "200", 30).amountOut) return false; const ra1 = app.formatScaled(app.parseScaled("1000") + app.parseScaled("200")); const rb1 = app.formatScaled(app.parseScaled("2000") - app.parseScaled(r.frontOut)); return r.attemptedVictimOut === app.cpSwap(ra1, rb1, "50", 30).amountOut; })());
check("sand: deeper pool blunts the same attack (victim loss shrinks)", (() => { const shallow = app.sandwichAttack("1000", "1000", "100", "100", 25, 9999); const deep = app.sandwichAttack("10000", "10000", "100", "100", 25, 9999); return app.parseScaled(deep.victimLoss) < app.parseScaled(shallow.victimLoss); })());
check("sand: protected sweep — loss is 0 and profit negative whenever protected", [["1000", "1000", "100", "10", 25, 50], ["1000", "2000", "50", "200", 30, 100], ["500", "5000", "25", "75", 100, 200]].every(([a, b, v, t, f, s]) => { const r = app.sandwichAttack(a, b, v, t, f, s); return !r.victimProtected || (r.victimLoss === "0" && r.attackerProfit.charAt(0) === "-"); }));
check("sand: rejects junk inputs and out-of-range tolerances/fees", app.sandwichAttack("0", "1000", "100", "100", 25, 50) === null && app.sandwichAttack("1000", "1000", "0", "100", 25, 50) === null && app.sandwichAttack("1000", "1000", "100", "100", 25, 10000) === null && app.sandwichAttack("1000", "1000", "100", "100", 25, -1) === null && app.sandwichAttack("1000", "1000", "100", "100", 25, 2.5) === null && app.sandwichAttack("1000", "1000", "100", "100", 10000, 50) === null && app.sandwichAttack("abc", "1000", "100", "100", 25, 50) === null);
check("guide teaches sandwich attacks (Tool 14)", guide.includes("Tool 14") && guide.includes("17.478992956"));
check("sand tool labelled model / not-live in index.html", html.includes("An educational model of a sandwich on a single pool, not live MEV data"));

/* Tool 15 — liquid staking exchange rate: rate = total / supply; deposits
   mint deposit*supply/total and redemptions return redeem*total/supply,
   floored; rewards grow the total only, so the rate (never the balance)
   carries the yield. Vectors pre-computed in a clean foreground prototype. */
check("lst: headline — rate 1.1, deposit 110 mints 100, redeem 100 returns 110", (() => { const r = app.liquidStaking("1100", "1000", "55", "110", "100"); return r.rate === 1.1 && r.tokensMinted === "100" && r.redeemOut === "110"; })());
check("lst: rewards raise the rate, not the balance — redeem 100 returns 115.5, gain 5.5", (() => { const r = app.liquidStaking("1100", "1000", "55", "110", "100"); return r.totalAfterRewards === "1155" && r.rateAfterRewards === 1.155 && r.redeemOutAfterRewards === "115.5" && r.redeemGain === "5.5" && r.tokensMintedAfterRewards === "95.238095238"; })());
check("lst: fresh pool is exactly 1:1 and zero rewards change nothing", (() => { const r = app.liquidStaking("1000", "1000", "0", "100", "100"); return r.rate === 1 && r.rateAfterRewards === 1 && r.tokensMinted === "100" && r.redeemOut === "100" && r.redeemGain === "0"; })());
check("lst: rate-2 pool — deposit 100 mints 50, redeem 500 returns 1000", (() => { const r = app.liquidStaking("2000", "1000", "100", "100", "500"); return r.rate === 2 && r.tokensMinted === "50" && r.redeemOut === "1000" && r.redeemOutAfterRewards === "1050"; })());
check("lst: dust deposit at a high rate floors to zero tokens and is flagged", (() => { const r = app.liquidStaking("1000000", "1000", "0", "0.000000001", "1"); return r.tokensMinted === "0" && r.mintedFloorsToZero === true; })());
check("lst: round-trip — redeeming freshly minted tokens returns at most the deposit", (() => { const m = app.liquidStaking("1100", "1000", "0", "33.3", "1"); return m.tokensMinted === "30.272727272" && app.parseScaled(app.liquidStaking("1100", "1000", "0", "1", m.tokensMinted).redeemOut) <= app.parseScaled("33.3"); })());
check("lst: rejects junk — zero total/supply, dust deposit of zero, redemption above supply", app.liquidStaking("0", "1000", "0", "1", "1") === null && app.liquidStaking("1000", "0", "0", "1", "1") === null && app.liquidStaking("1000", "1000", "0", "0", "1") === null && app.liquidStaking("1000", "1000", "0", "1", "1001") === null && app.liquidStaking("1000", "1000", "0", "1", "0") === null && app.liquidStaking("abc", "1000", "0", "1", "1") === null && app.liquidStaking("1000", "1000", "-5", "1", "1") === null && app.liquidStaking("1000.0000000001", "1000", "0", "1", "1") === null);
check("guide teaches liquid staking (Tool 15)", guide.includes("Tool 15") && guide.includes("115.5"));
check("lst tool labelled model / not-live in index.html", html.includes("An educational model of one pool's exchange rate, not a live pool's rate"));

/* Tool 16 — program-derived addresses. Every vector cross-verified in a clean
   foreground prototype against @solana/web3.js + @solana/spl-token BEFORE
   pinning: SHA-256 vs node:crypto on 17 lengths incl. block edges, the curve
   check vs PublicKey.isOnCurve on 1,520 byte strings incl. crafted edges,
   60 random findProgramAddress cases, and a real ATA derivation. */
const TOKEN_PROG = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const hexOf = (bs) => bs.map((b) => b.toString(16).padStart(2, "0")).join("");
check("pda: sha256 of the empty input is the known digest", hexOf(app.sha256Bytes([])) === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
check("pda: sha256 of 'abc' is the known digest", hexOf(app.sha256Bytes(app.utf8Bytes("abc"))) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
check("pda: sha256 of a 1000-byte pattern (multi-block + padding edges)", (() => { const pat = []; for (let i = 0; i < 1000; i++) pat.push((i * 7) % 256); return hexOf(app.sha256Bytes(pat)) === "89f4ff56a25dd1db06a4ce6033603775d705fb96f30f8693733fef602a1ca532"; })());
check("pda: ed25519 d is the canonical constant", app.ED25519_D.toString() === "37095705934669439343138083508754565189542113879843219016388785533085940283555");
check("pda: utf8 encodes multi-byte characters as bytes, not characters", app.utf8Bytes("é").join(",") === "195,169" && app.utf8Bytes("a").join(",") === "97" && app.utf8Bytes("").length === 0);
check("pda: real pubkeys are on the curve (hub wallet, USDC mint, System Program)", [SOL, USDC_MINT, "11111111111111111111111111111111"].every((a) => app.isOnCurveBytes(app.base58Decode(a)) === true));
check("pda: y=1 with the sign bit set is 'negative zero' — NOT a valid point", (() => { const b = new Array(32).fill(0); b[0] = 1; b[31] = 128; const c = new Array(32).fill(0); c[0] = 1; return app.isOnCurveBytes(b) === false && app.isOnCurveBytes(c) === true; })());
check("pda: headline — seed 'vault' under the Token program derives at bump 254 after 2 candidates", (() => { const r = app.findProgramAddress(TOKEN_PROG, ["vault"]); return r.address === "AispKP3Ls5d2m6t411kMtP1xkPemdZPGPJUvemsBqmXA" && r.bump === 254 && r.candidatesTried === 2; })());
check("pda: the headline's bump-255 candidate lands ON the curve and is refused", app.createProgramAddressBytes([app.utf8Bytes("vault"), [255]], app.base58Decode(TOKEN_PROG)) === null);
check("pda: create at the found bump returns the headline bytes", (() => { const b = app.createProgramAddressBytes([app.utf8Bytes("vault"), [254]], app.base58Decode(TOKEN_PROG)); return b !== null && app.base58Encode(b) === "AispKP3Ls5d2m6t411kMtP1xkPemdZPGPJUvemsBqmXA"; })());
check("pda: two seeds — ['vault','usdc'] derives at bump 254", (() => { const r = app.findProgramAddress(TOKEN_PROG, ["vault", "usdc"]); return r.address === "Ebehkhj7FHLPEsbSyWpwMJac88BKzVNcCWCvG9dtwkTx" && r.bump === 254; })());
check("pda: seed 'a' lands off-curve on the first candidate (bump 255, 1 try)", (() => { const r = app.findProgramAddress(TOKEN_PROG, ["a"]); return r.address === "3MsEZk7CJgp5wQrHtasn7QbEHeTtFeDpb59C458uZtnG" && r.bump === 255 && r.candidatesTried === 1; })());
check("pda: no seeds at all still derives (program alone)", (() => { const r = app.findProgramAddress(TOKEN_PROG, []); return r.address === "29aDZ12ST2mQkLeVfoeKkkm7WA83MCyiGU3Zf8MjDDGV" && r.bump === 255; })());
check("pda: a multi-byte seed hashes as its UTF-8 bytes ('é' = 2 bytes)", (() => { const r = app.findProgramAddress(TOKEN_PROG, ["é"]); return r.address === "8akeFFyVSWT5gnL3H7eWnrbAAFkywTnrR6HMp4P8yQuC" && r.bump === 253; })());
check("pda: a 32-byte seed is allowed, 33 bytes refused — bytes, not characters", app.findProgramAddress(TOKEN_PROG, ["a".repeat(32)]).address === "9KYV7PK8igxf6M2uYriB9BA1KgRsNgHG2pJTu8gAAyUE" && app.findProgramAddress(TOKEN_PROG, ["a".repeat(33)]) === null && app.findProgramAddress(TOKEN_PROG, ["é".repeat(17)]) === null);
check("pda: a derived PDA is itself off-curve and valid address format", (() => { const r = app.findProgramAddress(TOKEN_PROG, ["vault"]); return app.isOnCurveBytes(app.base58Decode(r.address)) === false && app.checkAddress(r.address).valid === true; })());
check("pda: real-world check — the hub wallet's USDC associated token account", (() => { const f = app.findProgramAddressBytes([app.base58Decode(SOL), app.base58Decode(TOKEN_PROG), app.base58Decode(USDC_MINT)], app.base58Decode("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")); return f.address === "BeJv9nhxhAhGVUpVaN4USa9TgpGiYhauc6VU5QyQZrbq" && f.bump === 255; })());
check("pda: rejects a bad program id (junk, wrong length, the 45-char stray-paste form)", app.findProgramAddress("abc0def", ["a"]) === null && app.findProgramAddress("1111", ["a"]) === null && app.findProgramAddress(SOL_INVALID_45, ["a"]) === null);
check("pda: 16 seeds allowed (bump 251, matching the reference SDK), 17 refused", (() => { const r = app.findProgramAddress(TOKEN_PROG, new Array(16).fill("a")); return r.address === "81BvRrbDHRavuraA1z3Nv7rP9GhgfVMXRvZ5FZ5e5eQS" && r.bump === 251 && app.findProgramAddress(TOKEN_PROG, new Array(17).fill("a")) === null; })());
check("pda: exposes the runtime limits and marker", app.MAX_PDA_SEEDS === 16 && app.MAX_PDA_SEED_BYTES === 32 && app.PDA_MARKER === "ProgramDerivedAddress");
check("guide teaches PDAs (Tool 16)", guide.includes("Tool 16") && guide.includes("AispKP3Ls5d2m6t411kMtP1xkPemdZPGPJUvemsBqmXA") && guide.includes("BeJv9nhxhAhGVUpVaN4USa9TgpGiYhauc6VU5QyQZrbq"));
check("pda tool labelled model / no private key in index.html", html.includes("A PDA has no private key") && html.includes("no lookup, no execution"));

/* Tool 17 — CLMM position amounts: cross-verified against the @uniswap/v3-sdk
   reference implementation (Q96 integer SqrtPriceMath) in a foreground prototype —
   every vector below agreed to within that implementation's whole-unit flooring */
check("clmmpos: headline L=1e6 over -600..600 at tick 0 holds ~29,553 of each", (() => { const r = app.clmmPosition("1000000", -600, 600, 0); return r !== null && r.status === "in" && r.inRange; })());
near("clmmpos: headline amount0", app.clmmPosition("1000000", -600, 600, 0).amount0, 29553.010879133868, 0.001);
near("clmmpos: headline amount1 (symmetric range at price 1)", app.clmmPosition("1000000", -600, 600, 0).amount1, 29553.010879133977, 0.001);
check("clmmpos: below the range holds only token0, the full-range amount", (() => { const r = app.clmmPosition("1000000", -600, 600, -1200); return r.status === "below" && r.amount1 === 0 && !r.inRange; })());
near("clmmpos: below-range amount0", app.clmmPosition("1000000", -600, 600, -1200).amount0, 60005.99925504313, 0.001);
check("clmmpos: above the range holds only token1, the full-range amount", (() => { const r = app.clmmPosition("1000000", -600, 600, 1200); return r.status === "above" && r.amount0 === 0 && !r.inRange; })());
near("clmmpos: above-range amount1", app.clmmPosition("1000000", -600, 600, 1200).amount1, 60005.99925504324, 0.001);
check("clmmpos: boundaries are continuous — at the lower tick amount1 is 0 and amount0 the full amount; at the upper tick the mirror", (() => { const lo = app.clmmPosition("1000000", -600, 600, -600); const hi = app.clmmPosition("1000000", -600, 600, 600); return lo.amount1 === 0 && Math.abs(lo.amount0 - 60005.99925504313) < 0.001 && hi.amount0 === 0 && Math.abs(hi.amount1 - 60005.99925504324) < 0.001; })());
check("clmmpos: in-range flag follows Tool 10's rule (lower <= current < upper)", app.clmmPosition("1000000", -600, 600, -600).inRange === true && app.clmmPosition("1000000", -600, 600, 600).inRange === false);
near("clmmpos: asymmetric vector amount0 (reference SDK: 49794690 floored)", app.clmmPosition("123456789", -10020, 4980, -3360).amount0, 49794690.42533552, 0.01);
near("clmmpos: asymmetric vector amount1 (reference SDK: 29558188 floored)", app.clmmPosition("123456789", -10020, 4980, -3360).amount1, 29558188.053344868, 0.01);
check("clmmpos: amounts scale linearly with L", (() => { const a = app.clmmPosition("1000000", -600, 600, 0); const b = app.clmmPosition("2000000", -600, 600, 0); return Math.abs(b.amount0 - 2 * a.amount0) < 1e-6 && Math.abs(b.amount1 - 2 * a.amount1) < 1e-6; })());
check("clmmpos: value split at price 1 in the symmetric headline is 50/50 in token1 terms", (() => { const r = app.clmmPosition("1000000", -600, 600, 0); return Math.abs(r.valueInToken1 - (r.amount0 + r.amount1)) < 1e-6; })());
check("clmmpos: rejects zero / negative / over-precise liquidity", app.clmmPosition("0", -600, 600, 0) === null && app.clmmPosition("-5", -600, 600, 0) === null && app.clmmPosition("1.0000000001", -600, 600, 0) === null);
check("clmmpos: rejects empty range, inverted range and out-of-bounds ticks", app.clmmPosition("1000", 600, 600, 0) === null && app.clmmPosition("1000", 600, -600, 0) === null && app.clmmPosition("1000", -443637, 600, 0) === null && app.clmmPosition("1000", -600, 443637, 0) === null && app.clmmPosition("1000", -600, 600, 443637) === null);
check("clmmpos: rejects non-integer ticks", app.clmmPosition("1000", -600.5, 600, 0) === null && app.clmmPosition("1000", -600, 600, 0.5) === null);
check("guide teaches CLMM position amounts (Tool 17)", guide.includes("Tool 17") && guide.includes("60,005.999") && guide.includes("fifty mechanics"));
check("clmmpos tool labelled principal-only / model in index.html", html.includes("fees a position earns accrue separately") && html.includes("cross-verified against a reference SDK"));

/* Tool 18 — LP deposit & pool share: the mint rule verified against the
   canonical constant-product formula in a clean foreground prototype
   (5,000-case random sweep against the min-of-two-floors construction and
   a 2,000-case integer-square-root sweep, zero mismatches) BEFORE shipping */
check("lpdep: headline mints 20000, A limiting, 40000 of B used, 10000 B excess", (() => { const r = app.lpDeposit("1000000", "4000000", "2000000", "10000", "50000"); return r !== null && !r.firstDeposit && r.minted === "20000" && r.limiting === "A" && r.usedA === "10000" && r.usedB === "40000" && r.excessA === "0" && r.excessB === "10000" && r.newSupply === "2020000"; })());
near("lpdep: headline share is 0.990099%", app.lpDeposit("1000000", "4000000", "2000000", "10000", "50000").sharePct, 0.990099, 1e-6);
check("lpdep: exact-ratio deposit mints the same with no excess, limiting both", (() => { const r = app.lpDeposit("1000000", "4000000", "2000000", "10000", "40000"); return r.minted === "20000" && r.limiting === "both" && r.excessA === "0" && r.excessB === "0"; })());
check("lpdep: B-limiting mirror — minted 5000, only 2500 of A used", (() => { const r = app.lpDeposit("1000000", "4000000", "2000000", "50000", "10000"); return r.minted === "5000" && r.limiting === "B" && r.usedA === "2500" && r.usedB === "10000" && r.excessA === "47500"; })());
check("lpdep: first deposit mints the geometric mean and holds 100%", (() => { const r = app.lpDeposit("0", "0", "0", "10000", "40000"); return r.firstDeposit && r.minted === "20000" && r.sharePct === 100 && r.limiting === "first"; })());
check("lpdep: first deposit sqrt floors (3 x 5 -> 3.872983346)", app.lpDeposit("0", "0", "0", "3", "5").minted === "3.872983346");
check("lpdep: isqrt exact on squares and floors between them", app.isqrtBigInt(0n) === 0n && app.isqrtBigInt(1n) === 1n && app.isqrtBigInt(15n) === 3n && app.isqrtBigInt(16n) === 4n && app.isqrtBigInt(17n) === 4n && app.isqrtBigInt(1000000000000000000n) === 1000000000n);
check("lpdep: used never exceeds deposited, excess + used = deposit (uneven case)", (() => { const r = app.lpDeposit("1234567", "7654321", "3456789", "9999", "12345"); return r !== null && Number(r.usedA) <= 9999 && Number(r.usedB) <= 12345 && Math.abs(Number(r.excessA) + Number(r.usedA) - 9999) < 1e-9 && Math.abs(Number(r.excessB) + Number(r.usedB) - 12345) < 1e-9; })());
check("lpdep: doubling an exact-ratio deposit doubles the mint", (() => { const a = app.lpDeposit("1000000", "4000000", "2000000", "10000", "40000"); const b = app.lpDeposit("1000000", "4000000", "2000000", "20000", "80000"); return b.minted === "40000" && a.minted === "20000"; })());
check("lpdep: rejects a half-empty pool (mixed zero state)", app.lpDeposit("0", "4000000", "2000000", "1", "1") === null && app.lpDeposit("1000000", "0", "2000000", "1", "1") === null && app.lpDeposit("1000000", "4000000", "0", "1", "1") === null);
check("lpdep: rejects zero / negative / over-precise deposits", app.lpDeposit("1", "1", "1", "0", "1") === null && app.lpDeposit("1", "1", "1", "1", "0") === null && app.lpDeposit("1", "1", "1", "-1", "1") === null && app.lpDeposit("1", "1", "1", "1.0000000001", "1") === null);
check("lpdep: rejects a dust deposit that would mint zero LP tokens", app.lpDeposit("1000000000", "1000000000", "1", "0.000000001", "0.000000001") === null);
check("guide teaches LP deposits (Tool 18)", guide.includes("Tool 18") && guide.includes("0.990099%") && guide.includes("fifty mechanics"));
check("lpdep tool labelled model / first-mint lock not modelled in index.html", html.includes("buys no extra LP tokens") && html.includes("An educational model, not a live pool quote"));


/* Tool 19 - token vesting (cliff + linear unlock): verified in a clean
   foreground prototype BEFORE shipping - 20,000 random cases against an
   independent float-rational floor (zero mismatches), 2,000 schedules
   checked month by month for monotonicity, the pre-cliff zero gate and
   exact completion at the duration */
check("vest: headline month 18 - accrued/claimable 375000, cliff released 250000, locked 625000", (() => { const r = app.vestingSchedule("1000000", 12, 48, 18); return r !== null && r.accrued === "375000" && r.claimable === "375000" && r.atCliff === "250000" && r.locked === "625000" && r.accruedPct === 37.5 && r.status === "vesting" && r.monthsRemaining === 30; })());
check("vest: pre-cliff accrues on paper but claims exactly 0", (() => { const r = app.vestingSchedule("1000000", 12, 48, 6); return r.accrued === "125000" && r.claimable === "0" && r.locked === "1000000" && r.status === "cliff"; })());
check("vest: at the cliff month the accrued share releases at once", (() => { const r = app.vestingSchedule("1000000", 12, 48, 12); return r.claimable === "250000" && r.claimable === r.atCliff && r.status === "vesting"; })());
check("vest: complete at and beyond the duration, to the exact token", app.vestingSchedule("1000000", 12, 48, 48).claimable === "1000000" && app.vestingSchedule("1000000", 12, 48, 60).claimable === "1000000" && app.vestingSchedule("1000000", 12, 48, 60).status === "complete" && app.vestingSchedule("1000000", 12, 48, 60).locked === "0");
check("vest: zero cliff claims the accrual from month 0", (() => { const r = app.vestingSchedule("1200", 0, 12, 0); return r.claimable === "0" && r.atCliff === "0" && app.vestingSchedule("1200", 0, 12, 3).claimable === "300"; })());
check("vest: accrual floors at the smallest unit (100 over 3 months)", app.vestingSchedule("100", 1, 3, 1).accrued === "33.333333333" && app.vestingSchedule("100", 1, 3, 3).claimable === "100");
check("vest: claimable is non-decreasing and gated across a full schedule", (() => { let prev = -1; for (let m = 0; m <= 53; m++) { const r = app.vestingSchedule("999999", 12, 48, m); const c = Number(r.claimable); if (c < prev) return false; if (m < 12 && c !== 0) return false; if (m >= 48 && r.claimable !== "999999") return false; prev = c; } return true; })());
check("vest: cliff equal to duration releases everything at the end", (() => { const r = app.vestingSchedule("500", 12, 12, 11); return r.claimable === "0" && app.vestingSchedule("500", 12, 12, 12).claimable === "500"; })());
check("vest: rejects cliff beyond duration, zero duration and fractional months", app.vestingSchedule("100", 13, 12, 0) === null && app.vestingSchedule("100", 0, 0, 0) === null && app.vestingSchedule("100", 0, 12, 1.5) === null && app.vestingSchedule("100", 0.5, 12, 0) === null && app.vestingSchedule("100", 0, 12, -1) === null);
check("vest: rejects zero / negative / over-precise totals", app.vestingSchedule("0", 0, 12, 0) === null && app.vestingSchedule("-5", 0, 12, 0) === null && app.vestingSchedule("1.0000000001", 0, 12, 0) === null);
check("guide teaches vesting (Tool 19)", guide.includes("Tool 19") && guide.includes("375,000 claimable") && guide.includes("fifty mechanics"));
check("vest tool labelled model / conventions stated in index.html", html.includes("a minority start the linear accrual at the cliff") && html.includes("An educational model, not a live vesting contract"));


/* Tool 20 - lending health & liquidation: verified in a clean foreground
   prototype BEFORE shipping - 5,000 random cases against the float
   definitions (zero mismatches) plus the invariant that collateral value
   at the liquidation price, times the threshold, returns the debt */
check("lend: headline - value 1000, LTV 50, health 1.6, max borrow 750, additional 250, liquidation price 62.5, drop 37.5", (() => { const r = app.lendingHealth("10", "100", "500", 8000, 7500); return r !== null && r.collateralValue === "1000" && r.ltvPct === 50 && r.healthFactor === 1.6 && r.maxBorrowTotal === "750" && r.additionalBorrow === "250" && r.liquidationPrice === "62.5" && r.priceDropPct === 37.5 && r.status === "healthy" && r.overMaxBorrow === false; })());
check("lend: health exactly 1 is its own at-threshold status", (() => { const r = app.lendingHealth("10", "100", "800", 8000, 7500); return r.healthFactor === 1 && r.status === "at-threshold" && r.liquidationPrice === "100" && r.priceDropPct === 0 && r.additionalBorrow === "0" && r.overMaxBorrow === true; })());
check("lend: below 1 is liquidatable and the liquidation price sits above spot", (() => { const r = app.lendingHealth("10", "100", "900", 8000, 7500); return r.status === "liquidatable" && r.liquidationPrice === "112.5" && r.priceDropPct === -12.5 && Math.abs(r.healthFactor - 0.8888888888888888) < 1e-12; })());
check("lend: no debt cannot be liquidated and keeps full borrowing power", (() => { const r = app.lendingHealth("10", "100", "0", 8000, 7500); return r.status === "no-debt" && r.healthFactor === null && r.liquidationPrice === "0" && r.additionalBorrow === "750" && r.ltvPct === 0; })());
check("lend: at the liquidation price the threshold value returns the debt (sweep)", [["10", "100", "500", 8000], ["3", "77.7", "100", 6500], ["250", "0.42", "40", 9000], ["1", "1234.5", "999", 7500]].every(([a, pr, d, t]) => { const r = app.lendingHealth(a, pr, d, t, t - 500); const vAtLiq = Number(r.liquidationPrice) * Number(a); return Math.abs(vAtLiq * t / 10000 - Number(d)) < Math.max(0.01, Number(d) * 0.0002); }));
check("lend: borrowing power is set by max LTV, never the threshold", (() => { const r = app.lendingHealth("10", "100", "0", 8000, 5000); return r.maxBorrowTotal === "500" && app.lendingHealth("10", "100", "0", 8000, 8000).maxBorrowTotal === "800"; })());
check("lend: rejects max LTV above threshold, zero threshold and fractional bps", app.lendingHealth("10", "100", "500", 8000, 8001) === null && app.lendingHealth("10", "100", "500", 0, 0) === null && app.lendingHealth("10", "100", "500", 8000.5, 7500) === null && app.lendingHealth("10", "100", "500", 8000, -1) === null);
check("lend: rejects zero amount / price and negative or over-precise debt", app.lendingHealth("0", "100", "500", 8000, 7500) === null && app.lendingHealth("10", "0", "500", 8000, 7500) === null && app.lendingHealth("10", "100", "-5", 8000, 7500) === null && app.lendingHealth("10", "100", "1.0000000001", 8000, 7500) === null);
check("guide teaches lending health (Tool 20)", guide.includes("Tool 20") && guide.includes("liquidation price of 62.5") && guide.includes("fifty mechanics"));
check("lend tool labelled model / scope stated in index.html", html.includes("no interest accrual and no liquidation bonus or fee modelled") && html.includes("An educational model, not a live lending quote"));

/* Tool 21 - transaction size & packet limit: verified against the wire
   format by hand - a plain SOL transfer (1 sig, 3 keys, 2 ix accounts,
   12 data bytes) is the canonical 215-byte transaction: 65 signatures +
   3 header + 97 static keys + 32 blockhash + 18 instruction. */
check("txsz: headline SOL transfer is exactly 215 bytes and fits with 1017 spare", (() => { const r = app.txSize(1, 3, 0, 0, 2, 12); return r !== null && r.total === 215 && r.signaturesBytes === 65 && r.staticKeysBytes === 97 && r.instructionBytes === 18 && r.lookupBytes === 0 && r.version === "legacy" && r.fits === true && r.headroom === 1017 && r.savedBytes === 0; })());
check("txsz: same transfer via one lookup table is 188 bytes, saving 27", (() => { const r = app.txSize(1, 1, 1, 1, 2, 12); return r.total === 188 && r.version === "v0" && r.lookupBytes === 37 && r.legacyTotal === 215 && r.savedBytes === 27 && r.totalKeys === 3; })());
check("txsz: a single lookup account makes the transaction 4 bytes BIGGER", (() => { const r = app.txSize(1, 2, 1, 0, 2, 12); return r.total === 219 && r.savedBytes === -4 && r.legacyTotal === 215; })());
check("txsz: shortvec boundary - data 127 to 128 costs 2 bytes (one data, one length)", app.txSize(1, 3, 0, 0, 2, 128).total - app.txSize(1, 3, 0, 0, 2, 127).total === 2 && app.shortvecLen(127) === 1 && app.shortvecLen(128) === 2 && app.shortvecLen(16384) === 3);
check("txsz: oversize data does not fit and headroom goes negative", (() => { const r = app.txSize(1, 3, 0, 0, 2, 2000); return r.total === 2204 && r.fits === false && r.headroom === -972 && r.packetLimit === 1232; })());
check("txsz: a second signature costs 64 bytes plus its static key", app.txSize(2, 4, 0, 0, 3, 12).total === 312);
check("txsz: rejects zero signatures and fewer static keys than signatures", app.txSize(0, 3, 0, 0, 2, 12) === null && app.txSize(2, 1, 0, 0, 1, 12) === null);
check("txsz: rejects instruction referencing more accounts than the transaction carries", app.txSize(1, 3, 0, 0, 4, 12) === null && app.txSize(1, 3, 1, 1, 6, 12) === null);
check("txsz: rejects fractional counts and over-256 lookup totals", app.txSize(1, 3, 0, 0, 2, 12.5) === null && app.txSize(1, 3, 200, 100, 2, 12) === null && app.txSize(1, 3, -1, 0, 2, 12) === null);
check("guide teaches transaction size (Tool 21)", guide.includes("Tool 21") && guide.includes("exactly 215 bytes") && guide.includes("fifty mechanics"));
check("txsz tool labelled model / scope stated in index.html", html.includes("One instruction modelled") && html.includes("An educational model of the wire format, not a live transaction"));

/* Tool 22 - Anchor account space planner: verified in a clean foreground
   prototype BEFORE shipping - headline vault struct Pubkey + u64 + bool +
   String(32) = 8 + 32 + 8 + 1 + 36 = 85 bytes, rent (128 + 85) x 6,960 =
   1,482,480 lamports; the prototype caught an uncapped String length,
   fixed before the model was written. */
const N22 = ["none", "", "none"];
check("space: headline vault struct is 85 bytes locking 1,482,480 lamports", (() => { const r = app.anchorSpace([["pubkey", "", "none"], ["u64", "", "none"], ["bool", "", "none"], ["string", "32", "none"]]); return r !== null && r.dataBytes === 77 && r.totalBytes === 85 && r.rentLamports === 1482480 && r.fieldCount === 4 && r.fields.map(f => f.bytes).join(",") === "32,8,1,36"; })());
check("space: a single u8 field is 9 bytes total (discriminator dominates)", (() => { const r = app.anchorSpace([["u8", "", "none"], N22, N22, N22]); return r.totalBytes === 9 && r.rentLamports === 953520; })());
check("space: Vec of 10 Pubkeys is 4 + 320 = 324 field bytes", (() => { const r = app.anchorSpace([["vec", "10", "pubkey"], N22, N22, N22]); return r.fields[0].bytes === 324 && r.totalBytes === 332 && r.rentLamports === 3201600; })());
check("space: array, Option and bytes compose exactly", (() => { const r = app.anchorSpace([["array", "4", "u128"], ["option", "", "u64"], ["bytes", "165", "none"], N22]); return r.fields.map(f => f.bytes).join(",") === "64,9,169" && r.dataBytes === 242 && r.totalBytes === 250 && r.rentLamports === 2630880; })());
check("space: a zero-length String still costs its 4-byte prefix", (() => { const r = app.anchorSpace([["string", "0", "none"], N22, N22, N22]); return r.fields[0].bytes === 4 && r.totalBytes === 12; })());
check("space: rent agrees with Tool 3's formula on the same total", (() => { const r = app.anchorSpace([["pubkey", "", "none"], ["u64", "", "none"], ["bool", "", "none"], ["string", "32", "none"]]); return app.rentExempt(r.totalBytes).rentExemptLamports === r.rentLamports && r.rentSol === "0.00148248"; })());
check("space: field sizes match the Borsh table", app.anchorFieldSize("bool", "", "none") === 1 && app.anchorFieldSize("u16", "", "none") === 2 && app.anchorFieldSize("u32", "", "none") === 4 && app.anchorFieldSize("u128", "", "none") === 16 && app.anchorFieldSize("pubkey", "", "none") === 32 && app.anchorFieldSize("option", "", "pubkey") === 33 && app.anchorFieldSize("none", "", "none") === 0);
check("space: rejects a Vec with no element type and an Option with a count", app.anchorSpace([["vec", "10", "none"], N22, N22, N22]) === null && app.anchorSpace([["option", "3", "u64"], N22, N22, N22]) === null);
check("space: rejects stray counts on fixed types and fractional or negative lengths", app.anchorSpace([["u64", "5", "none"], N22, N22, N22]) === null && app.anchorSpace([["array", "2.5", "u8"], N22, N22, N22]) === null && app.anchorSpace([["string", "-1", "none"], N22, N22, N22]) === null);
check("space: rejects no fields at all and over-cap lengths", app.anchorSpace([N22, N22, N22, N22]) === null && app.anchorSpace([["string", "1000001", "none"], N22, N22, N22]) === null && app.anchorSpace([["vec", "3", "u64"]]) === null);
check("guide teaches account space (Tool 22)", guide.includes("Tool 22") && guide.includes("85 bytes") && guide.includes("fifty mechanics"));
check("space tool labelled model / scope stated in index.html", html.includes("enums are not modelled") && html.includes("An educational model of the serialization format, not a live account"));

/* Tool 23 - sale split: verified in a clean foreground prototype BEFORE
   shipping - 20,000 random cases asserted the three parts sum to the price
   exactly, both cuts are true floors and the seller never goes negative;
   headline 100 @200/500 bps pays 2 / 5 / 93. */
check("split: headline 100 at 200/500 bps pays 2 platform, 5 royalty, 93 seller", (() => { const r = app.saleSplit("100", 200, 500); return r !== null && r.platformFee === "2" && r.royalty === "5" && r.seller === "93" && r.combinedBps === 700 && r.sellerZero === false; })());
check("split: 250 at 250/750 bps pays 6.25 / 18.75 / 225", (() => { const r = app.saleSplit("250", 250, 750); return r.platformFee === "6.25" && r.royalty === "18.75" && r.seller === "225"; })());
check("split: dust price of 3 units split 50/50 pays 1 / 1 / 1 (seller keeps the flooring dust)", (() => { const r = app.saleSplit("0.000000003", 5000, 5000); return r.platformFee === "0.000000001" && r.royalty === "0.000000001" && r.seller === "0.000000001"; })());
check("split: zero rates pay the seller everything", (() => { const r = app.saleSplit("42.5", 0, 0); return r.platformFee === "0" && r.royalty === "0" && r.seller === "42.5"; })());
check("split: cuts summing to 10000 can leave the seller exactly zero, flagged", (() => { const r = app.saleSplit("100", 6000, 4000); return r.seller === "0" && r.sellerZero === true; })());
check("split: cuts floor, never round (1 unit at 1 bp pays no fee)", (() => { const r = app.saleSplit("0.000000001", 1, 1); return r.platformFee === "0" && r.royalty === "0" && r.seller === "0.000000001"; })());
check("split: parts sum to the price exactly across a sweep", (() => { const cases = [["100", 200, 500], ["250", 250, 750], ["0.000000003", 5000, 5000], ["999.999999999", 333, 777], ["1", 9999, 1], ["123456.789", 1, 9999], ["7.77", 425, 575]]; return cases.every(([p, a, b]) => { const r = app.saleSplit(p, a, b); return r !== null && app.parseScaled(r.platformFee) + app.parseScaled(r.royalty) + app.parseScaled(r.seller) === app.parseScaled(p); }); })());
check("split: rejects rates summing past 10000 bps", app.saleSplit("100", 6000, 4001) === null && app.saleSplit("100", 10000, 1) === null);
check("split: rejects a single rate past 10000, fractional or negative bps", app.saleSplit("100", 10001, 0) === null && app.saleSplit("100", 2.5, 0) === null && app.saleSplit("100", -1, 0) === null);
check("split: rejects a zero or over-precise price", app.saleSplit("0", 200, 500) === null && app.saleSplit("1.0000000001", 200, 500) === null && app.saleSplit("abc", 200, 500) === null);
check("guide teaches sale splits (Tool 23)", guide.includes("Tool 23") && guide.includes("pays 2 to the platform, 5 to the creator and 93 to the seller") && guide.includes("fifty mechanics"));
check("split tool labelled model / scope stated in index.html", html.includes("royalties on classic Solana NFTs are a marketplace convention") && html.includes("An educational model of a sale split, not a live marketplace quote"));

/* catalogue filter logic */
check("filter all matches anything", app.catalogueMatch("dex", "all") === true);
check("filter matches a category token", app.catalogueMatch("mine payments", "payments") === true);
check("filter rejects other categories", app.catalogueMatch("mine payments", "dex") === false);
check("filter does not substring-match", app.catalogueMatch("core", "cor") === false);

/* Tool 24 - stake warmup/cooldown: formula grounded in SIMD-0391 (the stake
   program's integer warmup form) and prototype-verified BEFORE the hub code
   was written: solo closed form == epoch simulation on 3,000 random cases,
   crowd pace constant under proportional drain, dust min-clamp, portion
   clamp. */
check("warm: headline 40M solo vs 400M cluster at 900 bps moves 36M in epoch 1, done in 2", (() => { const r = app.stakeWarmup("40000000", "400000000", "40000000", 900, "activate"); return r !== null && r.capPerEpoch === "36000000" && r.firstChange === "36000000" && r.firstEpochEffective === "36000000" && r.firstEpochPctBps === 9000 && r.epochsNeeded === "2" && r.estimated === false && r.schedule.length === 2 && r.schedule[1].effective === "40000000"; })());
check("warm: ordinary stake far below the cap is fully effective in 1 epoch", (() => { const r = app.stakeWarmup("100", "400000000", "100", 900, "activate"); return r.epochsNeeded === "1" && r.firstEpochEffective === "100" && r.firstEpochPctBps === 10000; })());
check("warm: a 10x crowd stretches a 10M move from 1 epoch to 3 at a constant 3.6M pace", (() => { const solo = app.stakeWarmup("10000000", "400000000", "10000000", 900, "activate"); const crowd = app.stakeWarmup("10000000", "400000000", "100000000", 900, "activate"); return solo.epochsNeeded === "1" && crowd.firstChange === "3600000" && crowd.epochsNeeded === "3" && crowd.schedule[1].effective === "7200000" && crowd.schedule[2].effective === "10000000"; })());
check("warm: legacy 2500 bps rate moves the headline stake in 1 epoch (cap 100M)", (() => { const r = app.stakeWarmup("40000000", "400000000", "40000000", app.LEGACY_WARMUP_COOLDOWN_BPS, "activate"); return r.capPerEpoch === "100000000" && r.epochsNeeded === "1"; })());
check("warm: cooldown mirrors activation (effective drains 40M -> 4M -> 0)", (() => { const r = app.stakeWarmup("40000000", "400000000", "40000000", 900, "deactivate"); return r.epochsNeeded === "2" && r.firstEpochEffective === "4000000" && r.firstEpochMoved === "36000000" && r.schedule[1].effective === "0"; })());
check("warm: dust cluster floors the cap to zero, so progress is the 1-lamport minimum", (() => { const r = app.stakeWarmup("0.000000003", "0.000000005", "0.000000003", 900, "activate"); return r.minClamped === true && r.capPerEpoch === "0" && r.firstChange === "0.000000001" && r.epochsNeeded === "3"; })());
check("warm: change clamps to the portion (never moves more than remains)", (() => { const r = app.stakeWarmup("0.0000001", "1000000", "0.0000001", 900, "activate"); return r.epochsNeeded === "1" && r.firstChange === "0.0000001"; })());
check("warm: schedule is monotone and lands exactly on the stake across a sweep", (() => { const cases = [["123456.789", "400000000", "123456.789", 900], ["999999999", "400000000", "999999999", 2500], ["5", "3", "5", 37], ["1000000", "400000000", "50000000", 900], ["0.5", "400000000", "0.5", 1]]; return cases.every(([a, c, m, b]) => { const r = app.stakeWarmup(a, c, m, b, "activate"); if (r === null) return false; const effs = r.schedule.map(x => app.parseScaled(x.effective)); for (let i = 1; i < effs.length; i++) if (effs[i] < effs[i - 1]) return false; return effs[effs.length - 1] === app.parseScaled(a) && Number(r.epochsNeeded) >= r.schedule.length; }); })());
check("warm: rate constants are the current 900 and legacy 2500 bps", app.CURRENT_WARMUP_COOLDOWN_BPS === 900 && app.LEGACY_WARMUP_COOLDOWN_BPS === 2500);
check("warm: rejects a moving total below the stake", app.stakeWarmup("100", "400000000", "99", 900, "activate") === null);
check("warm: rejects zero/negative amounts, bad rates, bad direction, over-precision", app.stakeWarmup("0", "400000000", "100", 900, "activate") === null && app.stakeWarmup("100", "0", "100", 900, "activate") === null && app.stakeWarmup("100", "400000000", "100", 0, "activate") === null && app.stakeWarmup("100", "400000000", "100", 10001, "activate") === null && app.stakeWarmup("100", "400000000", "100", 900.5, "activate") === null && app.stakeWarmup("100", "400000000", "100", 900, "sideways") === null && app.stakeWarmup("1.0000000001", "400000000", "100", 900, "activate") === null);
check("guide teaches stake warmup/cooldown (Tool 24)", guide.includes("Tool 24") && guide.includes("36,000,000 in epoch 1") && guide.includes("fifty mechanics"));
check("warm tool labelled model / scope stated in index.html", html.includes("reduce_stake_warmup_cooldown") && html.includes("An educational model of stake warmup and cooldown, not a live staking quote"));
check("README documents Tool 24", readme.includes("Stake activation & cooldown timer") && readme.includes("900 bps"));

/* Tool 25 - CLMM uncollected fees: formula grounded in raydium-sdk-V2's
   PositionUtils.getTokenFeesAmount (accrued = mulDivFloor(wrappingSubU128(
   insideNow, insideLast), liquidity, Q64); total = tokensFeesOwed +
   accrued) and prototype-verified in Python BEFORE the hub code was
   written: headline, wrap, fractional-delta floor and UI conversion all
   matched an independent implementation on 5,000 random cases. */
check("fgro: headline growth of exactly 2^64 at liquidity 1,000,000 accrues exactly 1,000,000 raw A and 500,000 raw B", (() => { const r = app.clmmFeesOwed("1000000", "18446744073709551616", "0", "9223372036854775808", "0", "0", "0", 6, 6); return r !== null && r.deltaA === "18446744073709551616" && r.accruedA === "1000000" && r.accruedB === "500000" && r.totalA === "1000000" && r.totalB === "500000" && r.totalAUi === "1" && r.totalBUi === "0.5" && r.wrappedA === false && r.wrappedB === false; })());
check("fgro: already-owed from an earlier touch adds exactly (250,000 owed -> total 1,250,000 = 1.25)", (() => { const r = app.clmmFeesOwed("1000000", "18446744073709551616", "0", "9223372036854775808", "0", "250000", "0", 6, 6); return r.totalA === "1250000" && r.totalAUi === "1.25" && r.accruedA === "1000000"; })());
check("fgro: u128 wrap - last 2^128-5, now 7 is delta 12, flagged wrapped, and at liquidity 2^64 accrues exactly 12", (() => { const M = (1n << 128n) - 5n; const r = app.clmmFeesOwed("18446744073709551616", "7", M.toString(), "7", M.toString(), "0", "0", 0, 0); return r.deltaA === "12" && r.deltaB === "12" && r.accruedA === "12" && r.wrappedA === true && r.wrappedB === true; })());
check("fgro: the same wrap delta at ordinary liquidity floors to 0 accrued (12 x 1,000,000 < 2^64)", (() => { const M = (1n << 128n) - 5n; const r = app.clmmFeesOwed("1000000", "7", M.toString(), "0", "0", "0", "0", 6, 6); return r.deltaA === "12" && r.accruedA === "0" && r.totalA === "0"; })());
check("fgro: fractional per-unit growth floors (delta floor(2^64/3) at liquidity 1,000,000 accrues 333,333)", (() => { const r = app.clmmFeesOwed("1000000", "6148914691236517205", "0", "0", "0", "0", "0", 6, 6); return r.accruedA === "333333"; })());
check("fgro: no growth since the touch accrues 0 and the total is the owed figure alone", (() => { const r = app.clmmFeesOwed("1000000", "500", "500", "500", "500", "42", "7", 6, 9); return r.accruedA === "0" && r.accruedB === "0" && r.totalA === "42" && r.totalB === "7" && r.totalBUi === "0.000000007"; })());
check("fgro: zero liquidity accrues 0 at any growth", (() => { const r = app.clmmFeesOwed("0", "18446744073709551616", "0", "18446744073709551616", "0", "0", "0", 6, 6); return r.accruedA === "0" && r.accruedB === "0"; })());
check("fgro: UI conversion is exact at the edges (1 raw at 9 decimals, 0 decimals passes raw through)", (() => { const r = app.clmmFeesOwed("0", "0", "0", "0", "0", "1", "123456789", 9, 0); return r.totalAUi === "0.000000001" && r.totalBUi === "123456789"; })());
check("fgro: accrued is non-decreasing in the current counter and matches an independent recomputation across a sweep", (() => { const cases = [["1000000", "1000", "999999937"], ["123456789", "555", "18446744073709551615"], ["1", "0", "340282366920938463463374607431768211455"], ["999999999999", "9223372036854775808", "18446744073709551616"]]; return cases.every(([liq, last, now]) => { const r = app.clmmFeesOwed(liq, now, last, now, last, "0", "0", 6, 6); if (r === null) return false; const delta = (BigInt(now) - BigInt(last) + (1n << 128n)) % (1n << 128n); const want = (delta * BigInt(liq)) / (1n << 64n); return r.accruedA === want.toString() && r.accruedB === want.toString(); }); })());
check("fgro: Q64 and modulus constants are 2^64 and 2^128", app.FEE_GROWTH_Q64 === (1n << 64n) && app.FEE_GROWTH_MODULUS === (1n << 128n));
check("fgro: rejects signs, decimal points, empty fields and counters at or above 2^128", app.clmmFeesOwed("-1", "0", "0", "0", "0", "0", "0", 6, 6) === null && app.clmmFeesOwed("100", "1.5", "0", "0", "0", "0", "0", 6, 6) === null && app.clmmFeesOwed("100", "", "0", "0", "0", "0", "0", 6, 6) === null && app.clmmFeesOwed("100", (1n << 128n).toString(), "0", "0", "0", "0", "0", 6, 6) === null && app.clmmFeesOwed((1n << 128n).toString(), "0", "0", "0", "0", "0", "0", 6, 6) === null);
check("fgro: rejects bad decimals (19, -1, 1.5) on either side", app.clmmFeesOwed("100", "0", "0", "0", "0", "0", "0", 19, 6) === null && app.clmmFeesOwed("100", "0", "0", "0", "0", "0", "0", 6, -1) === null && app.clmmFeesOwed("100", "0", "0", "0", "0", "0", "0", 1.5, 6) === null);
check("guide teaches CLMM fee growth (Tool 25)", guide.includes("Tool 25") && guide.includes("accrues exactly 1,000,000 raw units") && guide.includes("fifty mechanics"));
check("fgro tool labelled model / scope stated in index.html", html.includes("An educational model of CLMM fee accounting, not a live position quote") && html.includes("wraps modulo"));
check("README documents Tool 25", readme.includes("CLMM uncollected fees calculator") && readme.includes("2^128"));

/* Tool 26 — inflation schedule: rate = max(1.5%, 8% x (1 - dis)^years),
   fractional years (the validator glides per epoch), disinflation an
   input defaulting to the shipped 1,500 bps. Pinned from the formula
   in a foreground prototype BEFORE the hub code was written: years
   0/1/2/5/10 at 15%, the terminal clamp at year 11, the crossing at
   ~10.30 years (15%) and ~4.69 years (30%), issuance on a held supply. */
check("infl: year 0 is the initial 8.0000% and issues 8% of supply", (() => { const r = app.inflationSchedule("0", "500000000", 1500); return r !== null && r.ratePct === "8.0000" && r.annualIssuance === "40000000" && r.atTerminal === false; })());
check("infl: year 1 at 15% disinflation is 6.8000% (34,000,000 on 500M)", (() => { const r = app.inflationSchedule("1", "500000000", 1500); return r.ratePct === "6.8000" && r.annualIssuance === "34000000"; })());
check("infl: year 2 is 5.7800%", (() => { const r = app.inflationSchedule("2", "500000000", 1500); return r.ratePct === "5.7800"; })());
check("infl: headline year 5 is 3.5496% issuing 17,748,212.5 on 500M", (() => { const r = app.inflationSchedule("5", "500000000", 1500); return r.ratePct === "3.5496" && r.annualIssuance === "17748212.5" && r.supply === "500000000" && r.years === "5"; })());
check("infl: year 10 is still above the floor at 1.5750%, crossing in 0.3 years", (() => { const r = app.inflationSchedule("10", "500000000", 1500); return r.ratePct === "1.5750" && r.atTerminal === false && r.yearsToTerminal === "0.3" && r.firstWholeYearAtTerminal === 11; })());
check("infl: year 11 is clamped at the 1.5000% terminal rate", (() => { const r = app.inflationSchedule("11", "500000000", 1500); return r.ratePct === "1.5000" && r.atTerminal === true && r.yearsToTerminal === "0" && r.annualIssuance === "7500000"; })());
check("infl: fractional years glide (year 0.5 is 8 x sqrt(0.85) = 7.3756%)", (() => { const r = app.inflationSchedule("0.5", "500000000", 1500); return r.ratePct === "7.3756"; })());
check("infl: at year 0 the floor is 10.3 years away, first whole year 11", (() => { const r = app.inflationSchedule("0", "500000000", 1500); return r.yearsToTerminal === "10.3" && r.firstWholeYearAtTerminal === 11; })());
check("infl: modelling 30% disinflation pulls the floor to year ~4.69 (first whole year 5)", (() => { const r0 = app.inflationSchedule("0", "500000000", 3000); const r4 = app.inflationSchedule("4", "500000000", 3000); const r5 = app.inflationSchedule("5", "500000000", 3000); return r0.yearsToTerminal === "4.69" && r0.firstWholeYearAtTerminal === 5 && r4.ratePct === "1.9208" && r4.atTerminal === false && r5.ratePct === "1.5000" && r5.atTerminal === true; })());
check("infl: 0 bps disinflation never decays and never reaches the floor", (() => { const r = app.inflationSchedule("50", "500000000", 0); return r.ratePct === "8.0000" && r.atTerminal === false && r.yearsToTerminal === null && r.firstWholeYearAtTerminal === null; })());
check("infl: constants are the shipped 8% initial and 1.5% terminal", app.INITIAL_INFLATION_PCT === 8 && app.TERMINAL_INFLATION_PCT === 1.5);
check("infl: rejects bad years, supply and disinflation inputs", app.inflationSchedule("-1", "500000000", 1500) === null && app.inflationSchedule("abc", "500000000", 1500) === null && app.inflationSchedule("10001", "500000000", 1500) === null && app.inflationSchedule("5", "0", 1500) === null && app.inflationSchedule("5", "-10", 1500) === null && app.inflationSchedule("5", "500000000", 10000) === null && app.inflationSchedule("5", "500000000", -1) === null && app.inflationSchedule("5", "500000000", 1500.5) === null);
check("guide teaches the inflation schedule (Tool 26)", guide.includes("Tool 26") && guide.includes("17,748,212.5 new SOL") && guide.includes("fifty mechanics"));
check("infl tool labelled model / scope stated in index.html", html.includes("An educational model of the inflation schedule, not live network data") && html.includes("not yet implemented"));
check("README documents Tool 26", readme.includes("Inflation schedule calculator") && readme.includes("1,500 bps"));
/* Tool 27 — associated token account: the PDA of [owner, token program,
   mint] under the ATA program. The three vectors below were verified
   against an independent Python implementation (hashlib SHA-256 plus a
   pure-math ed25519 on-curve check) before shipping. */
check("ata: headline (hub donation address + USDC mint, classic program) is BeJv...QZrbq at bump 255", (() => { const r = app.associatedTokenAddress("G7xepVyQSrxtH61ZooXvPAmnS8omQ1TvHqB8qDmHXWm", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", app.SPL_TOKEN_PROGRAM_ID); return r !== null && r.address === "BeJv9nhxhAhGVUpVaN4USa9TgpGiYhauc6VU5QyQZrbq" && r.bump === 255 && r.candidatesTried === 1 && r.tokenProgram === "SPL Token"; })());
check("ata: Token-2022 program gives the different ATA Gfhb...g5vx for the same pair", (() => { const r = app.associatedTokenAddress("G7xepVyQSrxtH61ZooXvPAmnS8omQ1TvHqB8qDmHXWm", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", app.TOKEN_2022_PROGRAM_ID); return r !== null && r.address === "GfhbKRzUHvQd1JLynEqohNX4e4RZrYwcxZxru2J5g5vx" && r.tokenProgram === "Token-2022"; })());
check("ata: system-program owner vector is HJt8...Fqm3M", (() => { const r = app.associatedTokenAddress("11111111111111111111111111111111", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", app.SPL_TOKEN_PROGRAM_ID); return r !== null && r.address === "HJt8Tjdsc9ms9i4WCZEzhzr4oyf3ANcdzXrNdLPFqm3M"; })());
check("ata: seed order matters - swapping owner and mint changes the address", (() => { const a = app.associatedTokenAddress("G7xepVyQSrxtH61ZooXvPAmnS8omQ1TvHqB8qDmHXWm", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", app.SPL_TOKEN_PROGRAM_ID); const b = app.associatedTokenAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "G7xepVyQSrxtH61ZooXvPAmnS8omQ1TvHqB8qDmHXWm", app.SPL_TOKEN_PROGRAM_ID); return a !== null && b !== null && a.address !== b.address; })());
check("ata: constants are the three real program ids", app.ATA_PROGRAM_ID === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" && app.SPL_TOKEN_PROGRAM_ID === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" && app.TOKEN_2022_PROGRAM_ID === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEB");
check("ata: rejects bad base58, short addresses and non-token programs", app.associatedTokenAddress("0bad", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", app.SPL_TOKEN_PROGRAM_ID) === null && app.associatedTokenAddress("1111", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", app.SPL_TOKEN_PROGRAM_ID) === null && app.associatedTokenAddress("G7xepVyQSrxtH61ZooXvPAmnS8omQ1TvHqB8qDmHXWm", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "11111111111111111111111111111111") === null && app.associatedTokenAddress("G7xepVyQSrxtH61ZooXvPAmnS8omQ1TvHqB8qDmHXWm", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "") === null);
check("guide teaches associated token accounts (Tool 27)", guide.includes("Tool 27") && guide.includes("BeJv9nhxhAhGVUpVaN4USa9TgpGiYhauc6VU5QyQZrbq") && guide.includes("fifty mechanics"));
check("ata tool labelled model / scope stated in index.html", html.includes("An educational model of ATA derivation, not a live account lookup") && html.includes("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"));
check("README documents Tool 27", readme.includes("Associated token account finder") && readme.includes("BeJv9nhxhAhGVUpVaN4USa9TgpGiYhauc6VU5QyQZrbq"));

/* Tool 28 — compressed NFT tree planner (concurrent Merkle tree account size & rent) */
const cmt1 = app.merkleTreePlan(14, 64, 0);
check("cmt: headline depth 14 / buffer 64 / canopy 0 is a 31,800-byte account", cmt1 && cmt1.sizeBytes === 31800);
check("cmt: headline changelog ring is 64 x 488 = 31,232 bytes", cmt1 && cmt1.changelogEntryBytes === 488 && cmt1.changelogBytes === 31232);
check("cmt: headline rent is 222,218,880 lamports (0.22221888 SOL)", cmt1 && cmt1.rentLamports === 222218880 && cmt1.rentSol === "0.22221888");
check("cmt: headline capacity is 2^14 = 16,384 assets", cmt1 && cmt1.capacity === 16384);
check("cmt: headline per-leaf rent is ~13,563.164 lamports", cmt1 && Math.abs(cmt1.perLeafLamports - 13563.1640625) < 1e-9);
check("cmt: headline changelog share is ~98.21%", cmt1 && Math.abs(cmt1.changelogSharePct - 98.2138) < 0.001);
check("cmt: no canopy supplies all 14 proof nodes and needs no Bubblegum minimum", cmt1 && cmt1.proofNodesToSupply === 14 && cmt1.minCanopyForBubblegum === 0 && cmt1.canopyBytes === 0);
const cmt2 = app.merkleTreePlan(24, 1024, 0);
check("cmt: whitepaper tree depth 24 / buffer 1024 has 827,392 changelog bytes of 828,280 total", cmt2 && cmt2.changelogBytes === 827392 && cmt2.sizeBytes === 828280);
check("cmt: whitepaper tree rent is 5,765,719,680 lamports and capacity 16,777,216", cmt2 && cmt2.rentLamports === 5765719680 && cmt2.capacity === 16777216);
const cmt3 = app.merkleTreePlan(20, 256, 3);
check("cmt: canopy 3 costs (2^4 - 2) x 32 = 448 bytes and the account is 175,288 bytes", cmt3 && cmt3.canopyBytes === 448 && cmt3.sizeBytes === 175288);
check("cmt: canopy 3 tree rent is 1,220,895,360 lamports, proofs drop to 17, Bubblegum minimum met exactly", cmt3 && cmt3.rentLamports === 1220895360 && cmt3.proofNodesToSupply === 17 && cmt3.minCanopyForBubblegum === 3);
check("cmt: depth 20 with no canopy flags the Bubblegum minimum of 3", (() => { const r = app.merkleTreePlan(20, 256, 0); return r !== null && r.minCanopyForBubblegum === 3; })());
check("cmt: size decomposes exactly (header + fixed + changelog + rightmost + canopy)", [cmt1, cmt2, cmt3].every(r => r && r.sizeBytes === r.headerBytes + r.fixedBytes + r.changelogBytes + r.rightmostBytes + r.canopyBytes));
check("cmt: rent matches the hub rent formula on the account size", [cmt1, cmt2, cmt3].every(r => r && r.rentLamports === app.rentExempt(r.sizeBytes).rentExemptLamports));
check("cmt: rejects depth 0, depth 31 and fractional depth", app.merkleTreePlan(0, 64, 0) === null && app.merkleTreePlan(31, 64, 0) === null && app.merkleTreePlan(14.5, 64, 0) === null);
check("cmt: rejects non-power-of-two, too-small and too-large buffers", app.merkleTreePlan(14, 100, 0) === null && app.merkleTreePlan(14, 4, 0) === null && app.merkleTreePlan(14, 32768, 0) === null);
check("cmt: rejects canopy past the depth and negative canopy", app.merkleTreePlan(14, 64, 15) === null && app.merkleTreePlan(14, 64, -1) === null);
check("guide teaches compressed NFT trees (Tool 28)", guide.includes("Tool 28") && guide.includes("827,392 changelog bytes") && guide.includes("222,218,880 lamports") && guide.includes("fifty mechanics"));
check("cmt tool labelled model / scope stated in index.html", html.includes("An educational model of the tree account layout, not a live quote") && html.includes("222,218,880 lamports (0.22221888 SOL)"));
check("README documents Tool 28", readme.includes("Compressed NFT tree planner") && readme.includes("31,800-byte account"));

/* Tool 29 — seeded address finder (createWithSeed: SHA-256(base || seed || owner), no marker, no bump, no curve check; vectors cross-verified against an independent Python hashlib implementation before shipping) */
const seed1 = app.createWithSeed(SOL, "0", app.STAKE_PROGRAM_ID);
check("seed: headline donation base / seed 0 / Stake owner derives 4z22cSCVREYe519iEet4xdqBSrTDx9muhtRR3fcRxpod", seed1 && seed1.address === "4z22cSCVREYe519iEet4xdqBSrTDx9muhtRR3fcRxpod");
check("seed: headline result lands ON the ed25519 curve and is still returned (no PDA-style rejection)", seed1 && seed1.onCurve === true);
check("seed: headline seed byte length is 1", seed1 && seed1.seedByteLen === 1);
const seed2 = app.createWithSeed(SOL, "1", app.STAKE_PROGRAM_ID);
check("seed: seed 1 derives HzRb6ffS3oM2qBTnRdbwLHF5ATaVNbTsFygbnqq6pMRP (fan-out differs per seed)", seed2 && seed2.address === "HzRb6ffS3oM2qBTnRdbwLHF5ATaVNbTsFygbnqq6pMRP" && seed2.address !== seed1.address);
const seed3 = app.createWithSeed("11111111111111111111111111111111", "", "11111111111111111111111111111111");
check("seed: empty seed allowed — System base/owner derives HXugtXVfQbdnt1bHDJcE9HU6kDMaPEJSQhN3moaHr6Hp (SHA-256 of 64 zero bytes)", seed3 && seed3.address === "HXugtXVfQbdnt1bHDJcE9HU6kDMaPEJSQhN3moaHr6Hp" && seed3.seedByteLen === 0);
const seed4 = app.createWithSeed("11111111111111111111111111111111", "seed", "11111111111111111111111111111111");
check("seed: System base / seed 'seed' / System owner derives 4kneZvoXAM381xtJRSahrcLXy8qTFS6fMgCVcfeNSTy9 and is off-curve", seed4 && seed4.address === "4kneZvoXAM381xtJRSahrcLXy8qTFS6fMgCVcfeNSTy9" && seed4.onCurve === false);
check("seed: a seed of exactly 32 bytes is accepted", app.createWithSeed(SOL, "a".repeat(32), app.STAKE_PROGRAM_ID) !== null && app.createWithSeed(SOL, "a".repeat(32), app.STAKE_PROGRAM_ID).address === "H81jFsutrm6QCVFkERktEDg7mMStBsydSazXkAXVSSD6");
check("seed: a 33-byte seed is rejected, and multi-byte characters count as bytes (17 x 2-byte chars = 34 bytes rejected, 16 accepted)", app.createWithSeed(SOL, "a".repeat(33), app.STAKE_PROGRAM_ID) === null && app.createWithSeed(SOL, "é".repeat(17), app.STAKE_PROGRAM_ID) === null && app.createWithSeed(SOL, "é".repeat(16), app.STAKE_PROGRAM_ID) !== null);
check("seed: the seed is not trimmed — a trailing space derives a different address", (() => { const a = app.createWithSeed(SOL, "0", app.STAKE_PROGRAM_ID); const b = app.createWithSeed(SOL, "0 ", app.STAKE_PROGRAM_ID); return a !== null && b !== null && a.address !== b.address && b.seedByteLen === 2; })());
check("seed: rejects bad base58, short addresses and empty base/owner", app.createWithSeed("0bad", "0", app.STAKE_PROGRAM_ID) === null && app.createWithSeed("1111", "0", app.STAKE_PROGRAM_ID) === null && app.createWithSeed(SOL, "0", "") === null && app.createWithSeed("", "0", app.STAKE_PROGRAM_ID) === null);
check("seed: non-string seed rejected", app.createWithSeed(SOL, null, app.STAKE_PROGRAM_ID) === null && app.createWithSeed(SOL, 0, app.STAKE_PROGRAM_ID) === null);
check("seed: Stake program constant is the real Stake program id", app.STAKE_PROGRAM_ID === "Stake11111111111111111111111111111111111111" && app.MAX_SEED_ADDRESS_SEED_BYTES === 32);
check("guide teaches seeded addresses (Tool 29)", guide.includes("Tool 29") && guide.includes("4z22cSCVREYe519iEet4xdqBSrTDx9muhtRR3fcRxpod") && guide.includes("fifty mechanics"));
check("seed tool labelled model / scope stated in index.html", html.includes("An educational model of seeded-address derivation, not a live account lookup") && html.includes("4z22cSCVREYe519iEet4xdqBSrTDx9muhtRR3fcRxpod"));
check("README documents Tool 29", readme.includes("Seeded address finder (createWithSeed)") && readme.includes("4z22cSCVREYe519iEet4xdqBSrTDx9muhtRR3fcRxpod"));

/* Tool 30 — token valuation (market cap = price x circulating, FDV = price x max, exact floored BigInt; gap values are differences so the parts sum exactly to the FDV; prototype-verified against float on a 20,000-case sweep before shipping) */
const val1 = app.tokenValuation("2.5", "400000000", "800000000", "1000000000");
check("mcap: headline market cap is 1,000,000,000", val1 && val1.marketCap === "1000000000");
check("mcap: headline total valuation is 2,000,000,000", val1 && val1.totalValuation === "2000000000");
check("mcap: headline FDV is 2,500,000,000", val1 && val1.fdv === "2500000000");
check("mcap: headline gaps are 400,000,000 not circulating and 200,000,000 unissued", val1 && val1.nonCirculating === "400000000" && val1.unissued === "200000000");
check("mcap: headline gap values are 1,000,000,000 and 500,000,000 and the parts sum exactly to the FDV", val1 && val1.nonCirculatingValue === "1000000000" && val1.unissuedValue === "500000000" && app.parseScaled(val1.marketCap) + app.parseScaled(val1.nonCirculatingValue) + app.parseScaled(val1.unissuedValue) === app.parseScaled(val1.fdv));
check("mcap: headline circulating is 50% of total and 40% of max, FDV multiple 2.5, not fully diluted", val1 && val1.circPctOfTotal === 50 && val1.circPctOfMax === 40 && val1.fdvMultiple === 2.5 && val1.fullyDiluted === false && val1.marketCapIsZero === false);
const valEq = app.tokenValuation("10", "1000", "1000", "1000");
check("mcap: fully diluted token — all three valuations coincide at 10,000", valEq && valEq.marketCap === "10000" && valEq.totalValuation === "10000" && valEq.fdv === "10000" && valEq.fullyDiluted === true && valEq.fdvMultiple === 1 && valEq.nonCirculating === "0" && valEq.unissued === "0");
const valFrac = app.tokenValuation("0.37", "123456789.123456789", "200000000", "210000000");
check("mcap: fractional vector floors exactly (45,679,011.975679011 / 74,000,000 / 77,700,000)", valFrac && valFrac.marketCap === "45679011.975679011" && valFrac.totalValuation === "74000000" && valFrac.fdv === "77700000");
check("mcap: fractional gap values are differences (28,320,988.024320989 / 3,700,000) summing exactly to the FDV", valFrac && valFrac.nonCirculatingValue === "28320988.024320989" && valFrac.unissuedValue === "3700000" && app.parseScaled(valFrac.marketCap) + app.parseScaled(valFrac.nonCirculatingValue) + app.parseScaled(valFrac.unissuedValue) === app.parseScaled(valFrac.fdv));
const valDust = app.tokenValuation("0.000000001", "1", "2", "3");
check("mcap: dust price of 1 smallest unit values 1/2/3 tokens at 1/2/3 units", valDust && valDust.marketCap === "0.000000001" && valDust.totalValuation === "0.000000002" && valDust.fdv === "0.000000003" && valDust.marketCapIsZero === false);
const valZero = app.tokenValuation("0.000000001", "0.000000001", "0.000000001", "0.000000001");
check("mcap: sub-unit product floors to exactly 0 and is flagged, not hidden", valZero && valZero.marketCap === "0" && valZero.fdv === "0" && valZero.marketCapIsZero === true);
check("mcap: rejects supplies that do not nest (circulating > total, total > max)", app.tokenValuation("1", "10", "9", "10") === null && app.tokenValuation("1", "1", "10", "9") === null);
check("mcap: rejects zero price, zero circulating and finer-than-9dp inputs", app.tokenValuation("0", "1", "1", "1") === null && app.tokenValuation("1", "0", "1", "1") === null && app.tokenValuation("0.0000000001", "1", "1", "1") === null && app.tokenValuation("1", "1.0000000001", "2", "2") === null);
check("mcap: ordering sweep — market cap <= total valuation <= FDV and parts sum to FDV", (() => { const cases = [["3.25", "999", "1000", "1001"], ["0.001", "5000000.5", "9000000", "10000000"], ["1234.567890123", "42", "42000", "42000000"], ["2.5", "400000000", "800000000", "1000000000"]]; return cases.every(([p, c, t, m]) => { const r = app.tokenValuation(p, c, t, m); return r !== null && app.parseScaled(r.marketCap) <= app.parseScaled(r.totalValuation) && app.parseScaled(r.totalValuation) <= app.parseScaled(r.fdv) && app.parseScaled(r.marketCap) + app.parseScaled(r.nonCirculatingValue) + app.parseScaled(r.unissuedValue) === app.parseScaled(r.fdv); }); })());
check("guide teaches token valuation (Tool 30)", guide.includes("Tool 30") && guide.includes("2,500,000,000") && guide.includes("fifty mechanics"));
check("mcap tool labelled model / scope stated in index.html", html.includes("An educational model of token valuation, not live market data") && html.includes("2,500,000,000"));
check("README documents Tool 30", readme.includes("Token valuation calculator (market cap & FDV)") && readme.includes("2,500,000,000"));

/* Tool 31 — address lookup table planner (account = 56-byte metadata + 32 x stored, max 256 (u8 indexes), rent via the hub formula; per-tx lookup bytes identical to Tool 21's txSize lookupBytes; prototype cross-checked against txSize before shipping) */
const alt1 = app.lookupTablePlan("64", "12", "8");
check("alt: headline table is 56 + 64 x 32 = 2,104 bytes", alt1 && alt1.sizeBytes === 2104 && alt1.metaBytes === 56 && alt1.addressBytes === 2048);
check("alt: headline rent is 15,534,720 lamports (0.01553472 SOL)", alt1 && alt1.rentLamports === 15534720 && alt1.rentSol === "0.01553472");
check("alt: headline load of 20 costs 55 lookup bytes vs 640 inline, saving 585", alt1 && alt1.lookupBytes === 55 && alt1.staticBytes === 640 && alt1.savingBytes === 585 && alt1.savingIsNegative === false);
check("alt: headline fill is 25% of the 256 cap, per-address rent 222,720 lamports", alt1 && alt1.fillPct === 25 && alt1.perAddressLamports === 222720);
const altFull = app.lookupTablePlan("256", "0", "256");
check("alt: a full table is 8,248 bytes locking 58,296,960 lamports", altFull && altFull.sizeBytes === 8248 && altFull.rentLamports === 58296960);
check("alt: loading all 256 readonly costs 292 bytes vs 8,192 inline (shortvec counts grow past 127)", altFull && altFull.lookupBytes === 292 && altFull.staticBytes === 8192 && altFull.savingBytes === 7900);
const altOne = app.lookupTablePlan("1", "1", "0");
check("alt: loading one address through a table costs 4 bytes MORE than inlining it (36 vs 32), flagged", altOne && altOne.lookupBytes === 36 && altOne.staticBytes === 32 && altOne.savingBytes === -4 && altOne.savingIsNegative === true && altOne.sizeBytes === 88 && altOne.rentLamports === 1503360);
check("alt: an empty stored table with a load is rejected, as is loading more than stored", app.lookupTablePlan("0", "1", "0") === null && app.lookupTablePlan("10", "6", "5") === null);
check("alt: rejects 257 stored, negative and fractional counts, and loading nothing", app.lookupTablePlan("257", "1", "0") === null && app.lookupTablePlan("10", "-1", "0") === null && app.lookupTablePlan("10.5", "1", "0") === null && app.lookupTablePlan("10", "0", "0") === null);
check("alt: lookup bytes agree with Tool 21 txSize lookupBytes on shared vectors", [[12, 8], [1, 0], [0, 256], [128, 128], [3, 4]].every(([w, r]) => { const plan = app.lookupTablePlan("256", String(w), String(r)); const tx = app.txSize(1, 1, w, r, w + r, 0); return plan !== null && tx !== null && plan.lookupBytes === tx.lookupBytes; }));
check("alt: size decomposes and rent matches the hub rent formula at every fill", [0, 1, 20, 64, 255, 256].every(n => { const plan = n === 0 ? null : app.lookupTablePlan(String(n), "1", "0"); return n === 0 || (plan !== null && plan.sizeBytes === app.ALT_META_BYTES + 32 * n && plan.rentLamports === app.rentExempt(plan.sizeBytes).rentExemptLamports); }));
check("alt: constants are the on-chain layout figures (meta 56, max 256)", app.ALT_META_BYTES === 56 && app.ALT_MAX_ADDRESSES === 256);
check("guide teaches lookup tables (Tool 31)", guide.includes("Tool 31") && guide.includes("15,534,720 lamports") && guide.includes("fifty mechanics"));
check("alt tool labelled model / scope stated in index.html", html.includes("An educational model of the lookup-table layout, not a live account lookup") && html.includes("58,296,960 lamports"));
check("README documents Tool 31", readme.includes("Address lookup table planner") && readme.includes("2,104-byte account"));

/* Tool 32: oracle price confidence (Pyth-style price/conf/expo) */
const pyth1 = app.pythConfidence("15000000000", "7500000", "-8", "100");
check("pyth: headline feed reads 150 plus-or-minus 0.075 at exponent -8", pyth1 && pyth1.priceUi === "150" && pyth1.confUi === "0.075");
check("pyth: headline one-sigma band is 149.925 to 150.075", pyth1 && pyth1.low === "149.925" && pyth1.high === "150.075");
check("pyth: headline doubled band is 149.85 to 150.15", pyth1 && pyth1.low2 === "149.85" && pyth1.high2 === "150.15");
check("pyth: headline width is exactly 5 bps (full band 10) and passes a 100 bps guard", pyth1 && pyth1.widthBps === 5 && pyth1.fullWidthBps === 10 && pyth1.passesGuard === true && pyth1.bandCrossesZero === false && pyth1.confIsZero === false);
const pythBtc = app.pythConfidence("6789000", "68000", "-2", "100");
check("pyth: textbook 67,890 +- 680 band is 67,210 to 68,570", pythBtc && pythBtc.low === "67210" && pythBtc.high === "68570" && pythBtc.low2 === "66530" && pythBtc.high2 === "69250");
check("pyth: textbook band is ~100.162 bps wide and FAILS a strict 100 bps guard", pythBtc && pythBtc.widthBps > 100.16 && pythBtc.widthBps < 100.17 && pythBtc.passesGuard === false);
check("pyth: a band exactly AT the guard passes (rejection is strictly wider)", app.pythConfidence("1000000", "10000", "-6", "100").passesGuard === true && app.pythConfidence("1000000", "10001", "-6", "100").passesGuard === false);
const pythZero = app.pythConfidence("500", "0", "-2", "0");
check("pyth: zero conf collapses the band to the price and is flagged", pythZero && pythZero.low === "5" && pythZero.high === "5" && pythZero.widthBps === 0 && pythZero.confIsZero === true && pythZero.passesGuard === true);
const pythWide = app.pythConfidence("100", "150", "0", "10000");
check("pyth: conf wider than the price crosses zero and is flagged (low -50)", pythWide && pythWide.low === "-50" && pythWide.bandCrossesZero === true);
check("pyth: positive exponent formats whole thousands (12000 to 12600)", (() => { const r = app.pythConfidence("123", "3", "2", "500"); return r && r.low === "12000" && r.high === "12600"; })());
check("pyth: expo formatting keeps needed zeros and trims only trailing ones", app.formatRawExpo(100050n, -4) === "10.005" && app.formatRawExpo(100000n, -4) === "10" && app.formatRawExpo(5n, -8) === "0.00000005" && app.formatRawExpo(-250n, -2) === "-2.5");
check("pyth: rejects a non-positive price, signed or decimal raw values, expo out of range and a guard past 10,000 bps", app.pythConfidence("0", "1", "-8", "100") === null && app.pythConfidence("-5", "1", "-8", "100") === null && app.pythConfidence("100.5", "1", "-8", "100") === null && app.pythConfidence("100", "1", "-19", "100") === null && app.pythConfidence("100", "1", "19", "100") === null && app.pythConfidence("100", "1", "-8", "10001") === null && app.pythConfidence("100", "1", "-8.5", "100") === null);
check("pyth: band ordering and guard agreement sweep through the shipped function", (() => { let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648); for (let i = 0; i < 500; i++) { const p = 1 + (rnd() % 1000000000); const c = rnd() % (p + 1); const bps = [0, 1, 50, 100, 1000, 10000][rnd() % 6]; const r = app.pythConfidence(String(p), String(c), "-6", String(bps)); if (!r) return false; if (r.passesGuard !== (BigInt(c) * 10000n <= BigInt(p) * BigInt(bps))) return false; if (Math.abs(r.widthBps - (c * 10000) / p) > 1e-6) return false; } return true; })());
check("guide teaches oracle price confidence (Tool 32)", guide.includes("Tool 32") && guide.includes("100.16 bps") && guide.includes("fifty mechanics"));
check("pyth tool labelled model / scope stated in index.html", html.includes("An educational model of oracle price confidence, not a live feed reading") && html.includes("100.16 bps"));
check("README documents Tool 32", readme.includes("Oracle price confidence interpreter") && readme.includes("149.925 to 150.075"));

/* Tool 33: bonding curve (launchpad virtual-reserve model) */
const curve1 = app.bondingCurve("30", "1000000000", "1000000000", "42", "85", "3", "100");
check("curve: headline start price is 0.00000003 SOL and market cap 30 SOL", curve1 && curve1.spotPrice === "0.00000003" && curve1.mcapBefore === "30");
check("curve: headline buy pays 0.03 fee, 2.97 enters the curve", curve1 && curve1.feeSol === "0.03" && curve1.effectiveIn === "2.97");
check("curve: headline buy receives 90,081,892.62966333 tokens", curve1 && curve1.tokensOut === "90081892.62966333");
check("curve: headline reserves move to 32.97 virtual SOL and 909,918,107.37033667 virtual tokens", curve1 && curve1.newVirtualSol === "32.97" && curve1.newVirtualToken === "909918107.37033667");
check("curve: headline price after is 0.000000036 (9 dp) with an exact rise of ~20.78%", curve1 && curve1.priceAfter === "0.000000036" && Math.abs(curve1.priceRisePct - 20.78) < 0.01);
check("curve: headline average price paid counts the fee (0.000000033)", curve1 && curve1.avgPricePaid === "0.000000033");
check("curve: headline market cap after is 36.234029999 SOL", curve1 && curve1.mcapAfter === "36.234029999");
check("curve: headline progress moves 49.4118% to 52.9059% and does not graduate", curve1 && Math.abs(curve1.progressBeforePct - 49.4118) < 0.001 && Math.abs(curve1.progressAfterPct - 52.9059) < 0.001 && curve1.graduatesWithThisBuy === false && curve1.alreadyComplete === false && curve1.raisedAfter === "44.97");
check("curve: buy quote agrees with Tool 2's cpSwap on the virtual reserves (headline)", (() => { const s = app.cpSwap("30", "1000000000", "3", 100); return s && curve1 && s.amountOut === curve1.tokensOut && s.fee === curve1.feeSol && s.effectiveIn === curve1.effectiveIn; })());
check("curve: buy quote agrees with cpSwap across a 500-case sweep", (() => { let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648); for (let i = 0; i < 500; i++) { const vs = String(1 + (rnd() % 100000)); const vt = String(1 + (rnd() % 1000000000)); const b = String(1 + (rnd() % 5000)); const fb = [0, 25, 100, 125, 500][rnd() % 5]; const c = app.bondingCurve(vs, vt, vt, "0", "85", b, String(fb)); const s = app.cpSwap(vs, vt, b, fb); if (!c || !s) return false; if (c.tokensOut !== s.amountOut || c.feeSol !== s.fee || c.effectiveIn !== s.effectiveIn) return false; } return true; })());
check("curve: zero fee collapses to the pure curve formula out = in x vTok / (vSol + in)", (() => { const c = app.bondingCurve("30", "1000000000", "1000000000", "0", "85", "3", "0"); const wantScaled = (3000000000n * (10n ** 18n)) / 33000000000n; return c && c.feeSol === "0" && c.tokensOut === app.formatScaled(wantScaled) && c.tokensOut === "90909090.909090909"; })());
check("curve: a bigger buy always lifts the price further (monotone sweep)", (() => { let prev = -1; for (const b of ["0.5", "1", "3", "10", "30", "100"]) { const c = app.bondingCurve("30", "1000000000", "1000000000", "0", "1000000", b, "100"); if (!c || !(c.priceRisePct > prev)) return false; prev = c.priceRisePct; } return true; })());
check("curve: the buy that crosses the target graduates, and a completed curve is flagged", (() => { const cross = app.bondingCurve("30", "1000000000", "1000000000", "84", "85", "3", "100"); const done = app.bondingCurve("30", "1000000000", "1000000000", "85", "85", "3", "100"); return cross && cross.graduatesWithThisBuy === true && cross.alreadyComplete === false && done && done.alreadyComplete === true; })());
check("curve: market cap is the curve price times supply (halving the supply halves both caps)", (() => { const half = app.bondingCurve("30", "1000000000", "500000000", "42", "85", "3", "100"); return half && half.mcapBefore === "15" && half.mcapAfter === "18.117014999" && half.tokensOut === curve1.tokensOut; })());
check("curve: rejects zero reserves, zero target, a zero or dust buy, a 100% fee and >9dp amounts", app.bondingCurve("0", "1000000000", "1000000000", "42", "85", "3", "100") === null && app.bondingCurve("30", "0", "1000000000", "42", "85", "3", "100") === null && app.bondingCurve("30", "1000000000", "1000000000", "42", "0", "3", "100") === null && app.bondingCurve("30", "1000000000", "1000000000", "42", "85", "0", "100") === null && app.bondingCurve("1000000", "1", "1", "0", "85", "0.000000001", "0") === null && app.bondingCurve("30", "1000000000", "1000000000", "42", "85", "3", "10000") === null && app.bondingCurve("30", "1000000000", "1000000000", "42", "85", "3.0000000001", "100") === null);
check("guide teaches bonding curves (Tool 33)", guide.includes("Tool 33") && guide.includes("90,081,892.62966333") && guide.includes("fifty mechanics"));
check("curve tool labelled model / scope stated in index.html", html.includes("An educational model of a launchpad bonding curve, not a live curve reading") && html.includes("90,081,892.62966333 tokens"));
check("README documents Tool 33", readme.includes("Bonding curve model (launchpad pricing)") && readme.includes("90,081,892.62966333"));

/* Tool 34: perpetual funding payment (payment = notional x rate x time, signed rate, position's point of view) */
const fund1 = app.perpFunding("100", "150", "1", "24", "long");
check("fund: headline notional is 15,000 and the long pays 1.5 per hour, 36 over 24 hours", fund1 && fund1.notional === "15000" && fund1.perHour === "-1.5" && fund1.total === "-36" && fund1.totalMagnitude === "36" && fund1.payer === "longs" && fund1.positionPays === true);
check("fund: headline annualised figure is 87.6% (1 bp/hr x 8,760)", fund1 && Math.abs(fund1.annualizedPct - 87.6) < 1e-9);
check("fund: the same position short RECEIVES at a positive rate (exact mirror)", (() => { const s = app.perpFunding("100", "150", "1", "24", "short"); return s && s.perHour === "1.5" && s.total === "36" && s.positionReceives === true && s.payer === "longs"; })());
check("fund: at a negative rate shorts pay and longs receive (headline -2 bps)", (() => { const sh = app.perpFunding("10", "200", "-2", "10", "short"); const lo = app.perpFunding("10", "200", "-2", "10", "long"); return sh && sh.total === "-4" && sh.payer === "shorts" && lo && lo.total === "4" && lo.perHour === "0.4"; })());
check("fund: a zero rate pays nothing either way", (() => { const z = app.perpFunding("100", "150", "0", "24", "long"); return z && z.total === "0" && z.perHour === "0" && z.payer === "none" && z.positionPays === false && z.paymentIsZero === true; })());
check("fund: payment is linear in size, rate and hours (exact scaling sweep)", (() => { for (const [sz, pr, rt, hr] of [["50", "150", "1", "24"], ["100", "150", "2", "24"], ["100", "150", "1", "48"], ["200", "300", "3", "12"]]) { const r = app.perpFunding(sz, pr, rt, hr, "long"); if (!r) return false; const base = 36 * (parseFloat(sz) / 100) * (parseFloat(pr) / 150) * parseFloat(rt) * (parseFloat(hr) / 24); if (r.total !== String(-base)) return false; } return true; })());
check("fund: fractional hours and fractional rates price exactly (2.5 hrs at 0.5 bp)", (() => { const r = app.perpFunding("100", "150", "0.5", "2.5", "long"); return r && r.perHourMagnitude === "0.75" && r.total === "-1.875"; })());
check("fund: a dust payment floors to zero and is flagged, not rounded up", (() => { const r = app.perpFunding("0.000001", "1", "1", "1", "long"); return r && r.totalMagnitude === "0" && r.paymentIsZero === true && r.payer === "longs"; })());
check("fund: rejects zero size/price/hours, an over-cap rate or hours, a bad side and >9dp inputs", app.perpFunding("0", "150", "1", "24", "long") === null && app.perpFunding("100", "0", "1", "24", "long") === null && app.perpFunding("100", "150", "1", "0", "long") === null && app.perpFunding("100", "150", "10001", "24", "long") === null && app.perpFunding("100", "150", "-10001", "24", "long") === null && app.perpFunding("100", "150", "1", "87601", "long") === null && app.perpFunding("100", "150", "1", "24", "flat") === null && app.perpFunding("100", "150", "1.0000000001", "24", "long") === null);
check("guide teaches perpetual funding (Tool 34)", guide.includes("Tool 34") && guide.includes("36 over 24 hours") && guide.includes("fifty mechanics"));
check("fund tool labelled model / scope stated in index.html", html.includes("An educational model of perpetual funding, not a live quote") && html.includes("36 over 24 hours"));
check("README documents Tool 34", readme.includes("Perpetual funding payment model") && readme.includes("36 over 24 hours"));

/* Tool 35: lending interest-rate kink model (rate off utilization, supply rate after reserve factor, daily-compounded interest) */
const ir1 = app.lendingRate("1000000", "800000", "200", "400", "80", "6000", "1000", "365");
check("irate: headline sits exactly on the kink - utilization 80%, borrow 600 bps (6%), supply 432 bps (4.32%)", ir1 && ir1.utilizationPct === "80" && ir1.borrowRateBps === "600" && ir1.borrowRatePct === "6" && ir1.supplyRateBps === "432" && ir1.supplyRatePct === "4.32" && ir1.atKink === true && ir1.aboveKink === false);
check("irate: headline interest over 365 days compounded daily is 49,465.048542105, ending at 849,465.048542105", ir1 && ir1.interest === "49465.048542105" && ir1.endBalance === "849465.048542105" && ir1.days === 365);
check("irate: past the kink the second slope prices it - 90% utilization borrows at 3,600 bps (36%), suppliers earn 2,916 bps (29.16%)", (() => { const r = app.lendingRate("1000000", "900000", "200", "400", "80", "6000", "1000", "365"); return r && r.borrowRateBps === "3600" && r.supplyRateBps === "2916" && r.supplyRatePct === "29.16" && r.aboveKink === true && r.interest === "389767.625329791"; })());
check("irate: at full utilization the borrow rate is base + slope1 + slope2 exactly (6,600 bps)", (() => { const r = app.lendingRate("1000000", "1000000", "200", "400", "80", "6000", "1000", "30"); return r && r.utilizationPct === "100" && r.borrowRateBps === "6600" && r.supplyRateBps === "5940"; })());
check("irate: below the kink the rate is base + slope1 x U/Uopt - half-way to the kink is 400 bps and suppliers earn half the headline supply rate at the same reserve factor", (() => { const r = app.lendingRate("1000000", "400000", "200", "400", "80", "6000", "1000", "365"); return r && r.utilizationPct === "40" && r.borrowRateBps === "400" && r.supplyRateBps === "144"; })());
check("irate: zero borrowed means the base rate, a zero supply rate and zero interest", (() => { const r = app.lendingRate("1000000", "0", "200", "400", "80", "6000", "1000", "365"); return r && r.borrowRateBps === "200" && r.supplyRateBps === "0" && r.interest === "0" && r.endBalance === "0"; })());
check("irate: a zero reserve factor hands suppliers the whole borrow rate x utilization (480 bps on the headline)", (() => { const r = app.lendingRate("1000000", "800000", "200", "400", "80", "6000", "0", "365"); return r && r.supplyRateBps === "480"; })());
check("irate: rates agree with the float kink definitions across a sweep (same string inputs both sides)", (() => { for (const [sup, bor, b, s1, uo, s2, res] of [["1000000", "800000", "200", "400", "80", "6000", "1000"], ["500000", "123456", "50", "900", "75", "12000", "1500"], ["2500000", "2499999", "0", "100", "90", "30000", "500"], ["777777", "111111", "333", "777", "66.666666666", "9999", "2500"], ["1000000", "950000", "200", "400", "80", "6000", "1000"]]) { const r = app.lendingRate(sup, bor, b, s1, uo, s2, res, "30"); if (!r) return false; const U = parseFloat(bor) / parseFloat(sup), uof = parseFloat(uo) / 100; const fb = U <= uof ? parseFloat(b) + parseFloat(s1) * U / uof : parseFloat(b) + parseFloat(s1) + parseFloat(s2) * (U - uof) / (1 - uof); if (Math.abs(parseFloat(r.borrowRateBps) - fb) > Math.max(1e-6, fb * 1e-9)) return false; const fs = fb * U * (1 - parseFloat(res) / 10000); if (Math.abs(parseFloat(r.supplyRateBps) - fs) > Math.max(1e-6, fs * 1e-6)) return false; } return true; })());
check("irate: interest is interest-only on the borrowed total - one day at 6% on 800,000 is the floored daily step 131.506849315", (() => { const r = app.lendingRate("1000000", "800000", "200", "400", "80", "6000", "1000", "1"); return r && r.interest === "131.506849315" && r.endBalance === "800131.506849315"; })());
check("irate: rejects zero supplied, borrowed above supplied, a kink at 0 or 100, a reserve factor over 100%, fractional or over-cap days, an over-cap slope and >9dp inputs", app.lendingRate("0", "0", "200", "400", "80", "6000", "1000", "365") === null && app.lendingRate("100", "101", "200", "400", "80", "6000", "1000", "365") === null && app.lendingRate("100", "50", "200", "400", "0", "6000", "1000", "365") === null && app.lendingRate("100", "50", "200", "400", "100", "6000", "1000", "365") === null && app.lendingRate("100", "50", "200", "400", "80", "6000", "10001", "365") === null && app.lendingRate("100", "50", "200", "400", "80", "6000", "1000", "1.5") === null && app.lendingRate("100", "50", "200", "400", "80", "6000", "1000", "3651") === null && app.lendingRate("100", "50", "200", "400", "80", "1000001", "1000", "365") === null && app.lendingRate("100.0000000001", "50", "200", "400", "80", "6000", "1000", "365") === null);
check("guide teaches lending rate curves (Tool 35)", guide.includes("Tool 35") && guide.includes("49,465.048542105") && guide.includes("fifty mechanics"));
check("irate tool labelled model / scope stated in index.html", html.includes("An educational model of a lending rate curve, not a live quote") && html.includes("49,465.048542105"));
check("README documents Tool 35", readme.includes("Lending interest-rate (kink) model") && readme.includes("49,465.048542105"));

/* Tool 36: perpetual position margin, PnL & liquidation (isolated margin; maintenance rate is an input) */
const pp1 = app.perpPosition("long", "100", "150", "180", "10", "500");
check("ppos: headline long - notional 15,000, margin 1,500 at 10x, PnL 3,000 at a mark of 180, equity 4,500", pp1 && pp1.notional === "15000" && pp1.margin === "1500" && pp1.pnl === "3000" && pp1.pnlIsProfit === true && pp1.equity === "4500" && pp1.returnOnMarginPct === 200 && pp1.priceMovePct === 20);
check("ppos: headline liquidation price is 142.105263157 - liquidation strikes while 710.5263157 of equity would remain at that price, not at zero", pp1 && pp1.liquidationPrice === "142.105263157" && pp1.noLiquidation === false && pp1.status === "above" && pp1.maintenance === "900" && pp1.notionalAtMark === "18000");
check("ppos: short mirror - same PnL at a mark of 120, liquidation price 157.142857142 above the entry", (() => { const r = app.perpPosition("short", "100", "150", "120", "10", "500"); return r && r.pnl === "3000" && r.equity === "4500" && r.liquidationPrice === "157.142857142" && r.maintenance === "600"; })());
check("ppos: at a mark of 140 the headline long is already below maintenance - equity 500 against a maintenance margin of 700, before the margin is exhausted", (() => { const r = app.perpPosition("long", "100", "150", "140", "10", "500"); return r && r.pnl === "-1000" && r.equity === "500" && r.maintenance === "700" && r.status === "below"; })());
check("ppos: a deep short move shows negative equity arithmetically (5000 loss on 1,500 margin) and a below status", (() => { const r = app.perpPosition("short", "100", "150", "200", "10", "500"); return r && r.pnl === "-5000" && r.equity === "-3500" && r.equityIsNegative === true && r.status === "below"; })());
check("ppos: at the entry price the PnL is exactly 0 and neither profit nor loss", (() => { const r = app.perpPosition("long", "100", "150", "150", "10", "500"); return r && r.pnl === "0" && r.pnlIsProfit === false && r.pnlIsLoss === false && r.equity === "1500" && r.returnOnMarginPct === 0; })());
check("ppos: a zero maintenance rate puts the long liquidation price where the margin alone runs out (135 = entry x (1 - 1/leverage))", (() => { const r = app.perpPosition("long", "100", "150", "180", "10", "0"); return r && r.liquidationPrice === "135" && r.maintenance === "0"; })());
check("ppos: leverage at or below 1 has no liquidation price for a long - flagged, never priced at 0", (() => { const a = app.perpPosition("long", "100", "150", "100", "1", "500"); const b = app.perpPosition("long", "100", "150", "100", "0.5", "500"); return a && a.noLiquidation === true && a.liquidationPrice === null && a.margin === "15000" && b && b.noLiquidation === true && b.margin === "30000"; })());
check("ppos: fractional leverage prices exactly - 40 at 250, 2.5x posts 4,000 and liquidates a long at 153.846153846 at a 250 bps maintenance rate", (() => { const r = app.perpPosition("long", "40", "250", "200", "2.5", "250"); return r && r.notional === "10000" && r.margin === "4000" && r.pnl === "-2000" && r.liquidationPrice === "153.846153846"; })());
check("ppos: equity at the reported liquidation price equals the maintenance margin there (both sides, solved back through the model)", (() => { for (const side of ["long", "short"]) { const base = app.perpPosition(side, "100", "150", "150", "10", "500"); if (!base || !base.liquidationPrice) return false; const at = app.perpPosition(side, "100", "150", base.liquidationPrice, "10", "500"); if (!at) return false; const eq = parseFloat(at.equity), mt = parseFloat(at.maintenance); if (Math.abs(eq - mt) > Math.max(1e-4, mt * 1e-6)) return false; } return true; })());
check("ppos: figures agree with the float definitions across a sweep (same string inputs both sides)", (() => { for (const [side, size, entry, mark, lev, mmr] of [["long", "100", "150", "180", "10", "500"], ["short", "25.5", "88.25", "40.5", "3.5", "125"], ["long", "1000", "0.75", "0.5", "20", "1000"], ["short", "7.125", "4200", "5000", "50", "50"], ["long", "500", "12.5", "12.5", "100", "2500"]]) { const r = app.perpPosition(side, size, entry, mark, lev, mmr); if (!r) return false; const S = parseFloat(size), E = parseFloat(entry), M = parseFloat(mark), L = parseFloat(lev), f = parseFloat(mmr) / 10000; const notional = S * E, margin = notional / L; const pnl = (side === "long" ? M - E : E - M) * S; if (Math.abs(parseFloat(r.pnl) - pnl) > Math.max(1e-6, Math.abs(pnl) * 1e-9)) return false; if (Math.abs(parseFloat(r.margin) - margin) > Math.max(1e-9, margin * 1e-9)) return false; const liqF = side === "long" ? (margin >= notional ? 0 : (E - margin / S) / (1 - f)) : (E + margin / S) / (1 + f); if (liqF === 0) { if (!r.noLiquidation) return false; } else if (Math.abs(parseFloat(r.liquidationPrice) - liqF) > Math.max(1e-6, liqF * 1e-8)) return false; } return true; })());
check("ppos: rejects zero size/entry/mark/leverage, leverage over the 1,000 guard, a maintenance rate at or over 100%, a bad side and >9dp inputs", app.perpPosition("long", "0", "150", "180", "10", "500") === null && app.perpPosition("long", "100", "0", "180", "10", "500") === null && app.perpPosition("long", "100", "150", "0", "10", "500") === null && app.perpPosition("long", "100", "150", "180", "0", "500") === null && app.perpPosition("long", "100", "150", "180", "1001", "500") === null && app.perpPosition("long", "100", "150", "180", "10", "10000") === null && app.perpPosition("up", "100", "150", "180", "10", "500") === null && app.perpPosition("long", "100", "150", "180", "10.0000000001", "500") === null && app.MAX_PERP_LEVERAGE === 1000);
check("guide teaches perpetual position margin (Tool 36)", guide.includes("Tool 36") && guide.includes("142.105263157") && guide.includes("fifty mechanics"));
check("ppos tool labelled model / scope stated in index.html", html.includes("An educational model of perpetual position margin, not a live quote") && html.includes("142.105263157"));
check("README documents Tool 36", readme.includes("Perpetual position margin, PnL & liquidation model") && readme.includes("142.105263157"));

/* Tool 37: stableswap invariant swap (integer Newton D and y; fee on the output) */
const ss1 = app.stableSwap("1000000", "1000000", "100", "10000", "4");
check("stab: headline balanced pool at A=100 - D is exactly the 2,000,000 sum of balances, gross 9,999.502463058 (impact under 0.005%, not the CP curve's 9,900), fee 3.999800985 on the output, net 9,995.502662073", ss1 && ss1.invariantD === "2000000" && ss1.grossOut === "9999.502463058" && ss1.fee === "3.999800985" && ss1.netOut === "9995.502662073" && ss1.effectivePrice === "0.999550266" && ss1.newBalanceOut === "990000.497536942");
check("stab: unbalancing the pool bends the curve - 1,500,000 / 500,000 returns 9,910.453997586 gross and D falls to 1,998,345.726703727", (() => { const r = app.stableSwap("1500000", "500000", "100", "10000", "4"); return r && r.invariantD === "1998345.726703727" && r.grossOut === "9910.453997586" && r.netOut === "9906.489815987"; })());
check("stab: at A=1 the balanced pool bends toward constant-product - gross 9,966.775941841, between CP's 9,900 and the A=100 figure", (() => { const r = app.stableSwap("1000000", "1000000", "1", "10000", "4"); return r && r.grossOut === "9966.775941841" && r.netOut === "9962.789231465" && r.invariantD === "2000000"; })());
check("stab: a zero fee leaves the output untouched and the gross price is the effective price", (() => { const r = app.stableSwap("1000000", "1000000", "100", "10000", "0"); return r && r.fee === "0" && r.netOut === r.grossOut && r.effectivePrice === "0.999950246"; })());
check("stab: a trade of half the balanced pool pays real impact - gross 498,355.192196785 at A=100, net 498,155.850119907 after the 4 bps output fee", (() => { const r = app.stableSwap("1000000", "1000000", "100", "500000", "4"); return r && r.grossOut === "498355.192196785" && r.fee === "199.342076878" && r.netOut === "498155.850119907"; })());
check("stab: higher amplification prices the same balanced trade closer to the peg (A=1000 beats A=100 beats A=1 on gross output)", (() => { const a = app.stableSwap("1000000", "1000000", "1", "10000", "0"); const b = app.stableSwap("1000000", "1000000", "100", "10000", "0"); const c = app.stableSwap("1000000", "1000000", "1000", "10000", "0"); return a && b && c && parseFloat(a.grossOut) < parseFloat(b.grossOut) && parseFloat(b.grossOut) < parseFloat(c.grossOut) && parseFloat(c.grossOut) < 10000; })());
check("stab: the invariant is preserved across the trade - D recomputed on the post-trade balances agrees with D before it", (() => { const r = app.stableSwap("1234567", "765432", "250", "54321", "30"); if (!r) return false; const dAfter = app.stableInvariantD(BigInt(Math.round(parseFloat(r.newBalanceIn) * 1e9)), BigInt(Math.round(parseFloat(r.newBalanceOut) * 1e9)), 250n); return Math.abs(Number(dAfter) / 1e9 - parseFloat(r.invariantD)) <= Math.max(0.001, parseFloat(r.invariantD) * 1e-6); })());
check("stab: outputs agree with the float Newton definitions across a sweep (integer tolerance of a few smallest units, same string inputs)", (() => { function dF(x, y, A) { const Ann = A * 4, S = x + y; let D = S; for (let i = 0; i < 256; i++) { let DP = D * D / (2 * x); DP = DP * D / (2 * y); const Dn = (Ann * S + 2 * DP) * D / ((Ann - 1) * D + 3 * DP); if (Math.abs(Dn - D) < 1e-12) { D = Dn; break; } D = Dn; } return D; } function yF(xn, D, A) { const Ann = A * 4; let c = D * D / (2 * xn); c = c * D / (2 * Ann); const b = xn + D / Ann; let y = D; for (let i = 0; i < 256; i++) { const yn = (y * y + c) / (2 * y + b - D); if (Math.abs(yn - y) < 1e-10) { y = yn; break; } y = yn; } return y; } for (const [x, y, A, dx, fee] of [["1000000", "1000000", "100", "10000", "4"], ["1500000", "500000", "100", "10000", "4"], ["250000", "1750000", "500", "25000", "30"], ["5000000", "4500000", "10", "400000", "100"], ["777777", "333333", "2000", "7777", "1"]]) { const r = app.stableSwap(x, y, A, dx, fee); if (!r) return false; const Df = dF(parseFloat(x), parseFloat(y), parseFloat(A)); const grossF = parseFloat(y) - yF(parseFloat(x) + parseFloat(dx), Df, parseFloat(A)); if (Math.abs(parseFloat(r.grossOut) - grossF) > Math.max(0.01, grossF * 1e-5)) return false; if (Math.abs(parseFloat(r.invariantD) - Df) > Math.max(0.01, Df * 1e-5)) return false; } return true; })());
check("stab: rejects zero balances or amount in, a zero/fractional/over-guard amplification, a fee at or over 100%, and >9dp inputs", app.stableSwap("0", "1000000", "100", "10000", "4") === null && app.stableSwap("1000000", "1000000", "100", "0", "4") === null && app.stableSwap("1000000", "1000000", "0", "10000", "4") === null && app.stableSwap("1000000", "1000000", "100.5", "10000", "4") === null && app.stableSwap("1000000", "1000000", "100001", "10000", "4") === null && app.stableSwap("1000000", "1000000", "100", "10000", "10000") === null && app.stableSwap("1000000", "1000000", "100", "0.0000000001", "4") === null && app.MAX_STABLE_AMP === 100000);
check("guide teaches stableswap pricing (Tool 37)", guide.includes("Tool 37") && guide.includes("9,995.502662073") && guide.includes("fifty mechanics"));
check("stab tool labelled model / scope stated in index.html", html.includes("An educational model of a stableswap pool, not a live quote") && html.includes("9,995.502662073"));
check("README documents Tool 37", readme.includes("Stableswap swap model") && readme.includes("9,995.502662073"));

/* Tool 38: lending liquidation proceeds (close-factor cap, bonus-marked seizure, exhaustion) */
const lq1 = app.liquidationMax("10", "100", "500", "500", "5000");
check("liqmax: headline - repay capped at 250 by the 50% close factor, seizes 2.625 worth 262.5 (a 12.5 bonus profit), leaving 250 of debt against 7.375 units worth 737.5", lq1 && lq1.collateralValue === "1000" && lq1.maxRepay === "250" && lq1.repay === "250" && lq1.seizedValue === "262.5" && lq1.seizedAmount === "2.625" && lq1.profitValue === "12.5" && lq1.remainingDebt === "250" && lq1.remainingCollateral === "7.375" && lq1.remainingCollateralValue === "737.5" && lq1.collateralExhausted === false && lq1.fullyRepaid === false);
check("liqmax: underwater position exhausts its collateral - 2 units against 500 of debt seizes all 2, the repay falls to 190.476190476 and 309.523809524 is left unbacked", (() => { const r = app.liquidationMax("2", "100", "500", "500", "5000"); return r && r.collateralExhausted === true && r.seizedAmount === "2" && r.seizedValue === "200" && r.repay === "190.476190476" && r.profitValue === "9.523809524" && r.remainingDebt === "309.523809524" && r.remainingCollateral === "0" && r.remainingCollateralValue === "0"; })());
check("liqmax: a 100% close factor at a 10% bonus fully repays - seizes 5.5 worth 550, no debt remains, 4.5 units worth 450 stay", (() => { const r = app.liquidationMax("10", "100", "500", "1000", "10000"); return r && r.maxRepay === "500" && r.repay === "500" && r.seizedValue === "550" && r.seizedAmount === "5.5" && r.profitValue === "50" && r.remainingDebt === "0" && r.fullyRepaid === true && r.remainingCollateral === "4.5" && r.remainingCollateralValue === "450"; })());
check("liqmax: a zero bonus seizes exactly the repaid value - 2.5 units worth 250, no profit", (() => { const r = app.liquidationMax("10", "100", "500", "0", "5000"); return r && r.seizedValue === "250" && r.seizedAmount === "2.5" && r.profitValue === "0" && r.remainingCollateralValue === "750"; })());
check("liqmax: parts always sum exactly - repay + remaining debt is the debt, seized + remaining collateral is the position, in both branches", (() => { for (const args of [["10", "100", "500", "500", "5000"], ["2", "100", "500", "500", "5000"], ["7.25", "88.5", "1234.5", "750", "2500"], ["1000", "0.75", "9999", "125", "3333"]]) { const r = app.liquidationMax(...args); if (!r) return false; if (Math.abs(parseFloat(r.repay) + parseFloat(r.remainingDebt) - parseFloat(r.debt)) > 1e-9) return false; if (Math.abs(parseFloat(r.seizedAmount) + parseFloat(r.remainingCollateral) - parseFloat(r.amount)) > 1e-9) return false; if (Math.abs(parseFloat(r.seizedValue) + parseFloat(r.remainingCollateralValue) - parseFloat(r.collateralValue)) > 1e-9) return false; if (Math.abs(parseFloat(r.seizedValue) - parseFloat(r.repay) - parseFloat(r.profitValue)) > 1e-9) return false; } return true; })());
check("liqmax: figures agree with the float definitions across a sweep (same string inputs both sides)", (() => { for (const [a, p, d, bon, cf] of [["10", "100", "500", "500", "5000"], ["2", "100", "500", "500", "5000"], ["25.5", "88.25", "4000", "800", "4000"], ["1000", "0.75", "9999", "125", "3333"], ["3.125", "4200", "50000", "1500", "10000"]]) { const r = app.liquidationMax(a, p, d, bon, cf); if (!r) return false; const A = parseFloat(a), P = parseFloat(p), D = parseFloat(d), f = parseFloat(bon) / 10000, c = parseFloat(cf) / 10000; const V = A * P, maxR = D * c, svD = maxR * (1 + f), saD = svD / P; let repayF, svF, saF, exF; if (saD > A) { exF = true; saF = A; svF = V; repayF = V / (1 + f); } else { exF = false; saF = saD; svF = svD; repayF = maxR; } if (r.collateralExhausted !== exF) return false; if (Math.abs(parseFloat(r.seizedAmount) - saF) > Math.max(1e-6, saF * 1e-6)) return false; if (Math.abs(parseFloat(r.repay) - repayF) > Math.max(1e-6, repayF * 1e-6)) return false; if (Math.abs(parseFloat(r.seizedValue) - svF) > Math.max(1e-6, svF * 1e-6)) return false; } return true; })());
check("liqmax: rejects zero collateral, price or debt, a bonus at or over 100%, a zero or over-100% close factor, a dust debt whose capped repay floors to zero, and >9dp inputs", app.liquidationMax("0", "100", "500", "500", "5000") === null && app.liquidationMax("10", "0", "500", "500", "5000") === null && app.liquidationMax("10", "100", "0", "500", "5000") === null && app.liquidationMax("10", "100", "500", "10000", "5000") === null && app.liquidationMax("10", "100", "500", "500", "0") === null && app.liquidationMax("10", "100", "500", "500", "10001") === null && app.liquidationMax("10", "100", "0.000000001", "500", "1") === null && app.liquidationMax("10", "100", "500", "500.0000000001", "5000") === null);
check("guide teaches liquidation proceeds (Tool 38)", guide.includes("Tool 38") && guide.includes("2.625") && guide.includes("fifty mechanics"));
check("liqmax tool labelled model / scope stated in index.html", html.includes("An educational model of a lending liquidation, not a live quote") && html.includes("2.625"));
check("README documents Tool 38", readme.includes("Lending liquidation calculator") && readme.includes("190.476190476"));


/* ---------- Tool 39: two-hop swap route ---------- */
const rt1 = app.routeSwap("500000", "75000000", "30000000", "600000", "100", "25", "25");
check("route: headline - 100 in becomes 14,959.515576642 of the intermediate and 298.293963175 out, against a spot value of exactly 300 (total cost 56 bps floored)", rt1 && rt1.hop1Fee === "0.25" && rt1.hop1EffectiveIn === "99.75" && rt1.midAmount === "14959.515576642" && rt1.hop2Fee === "37.398788941" && rt1.amountOut === "298.293963175" && rt1.spotOut === "300" && rt1.totalCostBps === 56 && Math.abs(rt1.effectivePrice - 2.98293963175) < 1e-12);
check("route: zero fees still lose to compounded impact - 299.790146897 out, a total cost of 6 bps floored", (() => { const r = app.routeSwap("500000", "75000000", "30000000", "600000", "100", "0", "0"); return r && r.midAmount === "14997.00059988" && r.amountOut === "299.790146897" && r.spotOut === "300" && r.totalCostBps === 6 && r.hop1Fee === "0" && r.hop2Fee === "0"; })());
check("route: a tenfold shallower second pool at the same prices returns less - 296.965219193", (() => { const r = app.routeSwap("500000", "75000000", "3000000", "60000", "100", "25", "25"); return r && r.midAmount === "14959.515576642" && r.amountOut === "296.965219193" && r.spotOut === "300" && r.totalCostBps === 101; })());
check("route: agrees with the hub's own cpSwap composed across both hops on a sweep, spot floored once", (() => { const cases = [["500000","75000000","30000000","600000","100","25","25"],["1000000","2000000","500000","4000000","250.5","30","100"],["75000","9000000","12000000","300000","42","4","250"],["2000000","500000","800000","1600000","999.999999999","0","0"],["123456","789012","345678","901234","7.125","77","33"]]; for (const c of cases) { const r = app.routeSwap(...c); if (!r) return false; const h1 = app.cpSwap(c[0], c[1], c[4], Number(c[5])); const h2 = app.cpSwap(c[2], c[3], h1.amountOut, Number(c[6])); if (r.midAmount !== h1.amountOut || r.amountOut !== h2.amountOut) return false; const spot = parseFloat(c[4]) * (parseFloat(c[1]) / parseFloat(c[0])) * (parseFloat(c[3]) / parseFloat(c[2])); if (Math.abs(parseFloat(r.spotOut) - spot) > Math.max(1e-6, spot * 1e-9)) return false; if (!(parseFloat(r.amountOut) < parseFloat(r.spotOut))) return false; } return true; })());
check("route: rejects a zero reserve or amount, a fee at or over 100%, a fractional-bps fee, a dust trade whose hop output floors to zero, and >9dp inputs", app.routeSwap("0", "75000000", "30000000", "600000", "100", "25", "25") === null && app.routeSwap("500000", "75000000", "30000000", "600000", "0", "25", "25") === null && app.routeSwap("500000", "75000000", "30000000", "600000", "100", "10000", "25") === null && app.routeSwap("500000", "75000000", "30000000", "600000", "100", "25", "25.5") === null && app.routeSwap("1000000", "0.000001", "30000000", "600000", "0.000000001", "25", "25") === null && app.routeSwap("500000", "75000000", "30000000", "600000", "100.0000000001", "25", "25") === null);
check("guide teaches routed swaps (Tool 39)", guide.includes("Tool 39") && guide.includes("298.293963175") && guide.includes("fifty mechanics"));
check("route tool labelled model / scope stated in index.html", html.includes("An educational model of a routed swap, not a live quote") && html.includes("298.293963175"));
check("README documents Tool 39", readme.includes("Two-hop swap route model") && readme.includes("296.965219193"));


/* ---------- Tool 40: exact-out swap ---------- */
const xo1 = app.cpSwapExactOut("1000000", "1000000", "100000", "25");
check("xo: headline - exactly 100,000 out of a 1,000,000 / 1,000,000 pool at 25 bps costs 111,389.585073796 in (net 111,111.111111112, fee 278.473962684, excess 0)", xo1 && xo1.amountIn === "111389.585073796" && xo1.netIn === "111111.111111112" && xo1.fee === "278.473962684" && xo1.effectiveIn === "111111.111111112" && xo1.actualOut === "100000" && xo1.excessOut === "0" && xo1.feeBps === 25);
check("xo: zero fee - 100 out of 1,000 / 1,000 costs the ceilinged net 111.111111112 exactly", (() => { const r = app.cpSwapExactOut("1000", "1000", "100", "0"); return r && r.amountIn === "111.111111112" && r.netIn === "111111.111111112".replace("111111", "111") && r.fee === "0" && r.actualOut === "100" && r.excessOut === "0"; })());
check("xo: round-trips Tool 39 hop 1 - the exact-out input for its floored output is one smallest unit under the original 100 in", (() => { const r = app.cpSwapExactOut("500000", "75000000", "14959.515576642", "25"); return r && r.amountIn === "99.999999999" && r.netIn === "99.75" && r.actualOut === "14959.515576642" && r.excessOut === "0"; })());
check("xo: near-drain target explodes - 999 out of 1,000 / 1,000 at 25 bps costs 1,001,503.759398496 in", (() => { const r = app.cpSwapExactOut("1000", "1000", "999", "25"); return r && r.amountIn === "1001503.759398496" && r.netIn === "999000" && r.actualOut === "999"; })());
check("xo: solved input is minimal and sufficient through Tool 2 itself on a sweep (at the input cpSwap reaches the target, one smallest unit less it does not)", (() => { const cases = [["1000000","1000000","100000","25"],["1000","1000","100","0"],["500000","75000000","14959.515576642","25"],["75000","9000000","42000","100"],["2000000","500000","499999","30"],["123456","789012","7.125","77"],["100","100","99.999999999","999"],["10","10","0.000000001","25"]]; for (const c of cases) { const r = app.cpSwapExactOut(...c); if (!r) return false; const at = app.cpSwap(c[0], c[1], r.amountIn, Number(c[3])); if (!at || at.amountOut !== r.actualOut) return false; if (app.parseScaled(at.amountOut) < app.parseScaled(c[2])) return false; const prevScaled = app.parseScaled(r.amountIn) - 1n; if (prevScaled > 0n) { const prev = app.cpSwap(c[0], c[1], app.formatScaled(prevScaled), Number(c[3])); if (prev && app.parseScaled(prev.amountOut) >= app.parseScaled(c[2])) return false; } } return true; })());
check("xo: rejects a target at or beyond the whole reserve, zero inputs, a fee at or over 100%, a fractional-bps fee, and >9dp inputs", app.cpSwapExactOut("1000", "1000", "1000", "25") === null && app.cpSwapExactOut("1000", "1000", "1001", "25") === null && app.cpSwapExactOut("1000", "1000", "0", "25") === null && app.cpSwapExactOut("0", "1000", "100", "25") === null && app.cpSwapExactOut("1000", "1000", "100", "10000") === null && app.cpSwapExactOut("1000", "1000", "100", "25.5") === null && app.cpSwapExactOut("1000", "1000", "100.0000000001", "25") === null);
check("guide teaches exact-out swaps (Tool 40)", guide.includes("Tool 40") && guide.includes("111,389.585073796") && guide.includes("fifty mechanics"));
check("xo tool labelled model / scope stated in index.html", html.includes("An educational model of an exact-out swap, not a live quote") && html.includes("111,389.585073796"));
check("README documents Tool 40", readme.includes("Exact-out swap model") && readme.includes("1,001,503.759398496"));

/* ---------- Tool 41: arbitrage profit ---------- */
const arb1 = app.arbitrageTrade("1000000", "1000000", "100000", "0", "1.21");
check("arb: headline - 100,000 into a 1,000,000 / 1,000,000 pool at no fee against 1.21 outside receives 90,909.09090909 worth 109,999.999999998, a profit of 9,999.999999998, post spot 1.209999999", arb1 && arb1.amountOut === "90909.09090909" && arb1.externalValue === "109999.999999998" && arb1.profit === "9999.999999998" && arb1.profitable === true && arb1.spotPrice === "1" && arb1.postSpotPrice === "1.209999999" && arb1.fee === "0");
check("arb: at 25 bps the same trade profits 9,749.943168901 and stops at a spot of 1.209450062", (() => { const r = app.arbitrageTrade("1000000", "1000000", "100000", "25", "1.21"); return r && r.amountOut === "90702.432370993" && r.fee === "250" && r.profit === "9749.943168901" && r.postSpotPrice === "1.209450062" && r.profitable === true; })());
check("arb: overshoot - doubling the trade collapses the profit to 1,666.666666665 and pushes the spot to 1.439999999, past the external price", (() => { const r = app.arbitrageTrade("1000000", "1000000", "200000", "0", "1.21"); return r && r.profit === "1666.666666665" && r.postSpotPrice === "1.439999999"; })());
check("arb: no gap - at an external price equal to spot, the fee and impact make the trade lose 9,297.567629007", (() => { const r = app.arbitrageTrade("1000000", "1000000", "100000", "25", "1"); return r && r.profit === "-9297.567629007" && r.profitable === false; })());
check("arb: agrees with Tool 2 composed with the external valuation on a sweep (same amount out, value floored once, profit is value minus gross in)", (() => { const cases = [["1000000","1000000","100000","0","1.21"],["500000","75000000","100","25","0.0075"],["2000000","500000","499999","30","3.9"],["123456","789012","7.125","77","0.31"],["1000","1000","999","500","2"]]; for (const c of cases) { const r = app.arbitrageTrade(...c); if (!r) return false; const sw = app.cpSwap(c[0], c[1], c[2], Number(c[3])); if (!sw || sw.amountOut !== r.amountOut || sw.fee !== r.fee) return false; const val = (app.parseScaled(sw.amountOut) * app.parseScaled(c[4])) / app.SCALE; if (app.formatScaled(val) !== r.externalValue) return false; if (app.formatScaled(val - app.parseScaled(c[2])) !== r.profit) return false; } return true; })());
check("arb: rejects zero reserves, amount or price, a fee at or over 100%, a fractional-bps fee, >9dp inputs, and a dust trade whose output floors to zero", app.arbitrageTrade("0", "1000", "100", "25", "1.2") === null && app.arbitrageTrade("1000", "1000", "0", "25", "1.2") === null && app.arbitrageTrade("1000", "1000", "100", "25", "0") === null && app.arbitrageTrade("1000", "1000", "100", "10000", "1.2") === null && app.arbitrageTrade("1000", "1000", "100", "25.5", "1.2") === null && app.arbitrageTrade("1000", "1000", "100.0000000001", "25", "1.2") === null && app.arbitrageTrade("1000000", "1000000", "0.000000001", "25", "1.21") === null);
check("guide teaches arbitrage (Tool 41)", guide.includes("Tool 41") && guide.includes("9,999.999999998") && guide.includes("fifty mechanics"));
check("arb tool labelled model / scope stated in index.html", html.includes("An educational model of an arbitrage trade, not a live quote") && html.includes("9,999.999999998"));
check("README documents Tool 41", readme.includes("Arbitrage profit model") && readme.includes("1,666.666666665"));

/* ---------- Tool 42: CLMM swap inside one tick range ----------
   Vectors prototype-verified with a 50-digit Decimal implementation of the
   square-root-price formulas before pinning; the virtual-reserve sweep pins
   the model against Tool 2 itself. */
const cs1 = app.clmmSwap("1000000", -1000, 1000, 0, "token0", "10000", "0");
near("cswap: headline token0 - 10,000 in at no fee returns 9,900.99009901 token1", cs1 && cs1.amountOut, 9900.990099009901, 1e-6);
near("cswap: headline price after is 0.9802960494", cs1 && cs1.priceAfter, 0.980296049406921, 1e-9);
near("cswap: headline impact ~0.990099%", cs1 && cs1.priceImpactPct, 0.990099009901, 1e-9);
check("cswap: headline uses the full input inside the range", cs1 && cs1.reachedBound === false && cs1.fee === "0" && cs1.effectiveIn === "10000" && cs1.unusedEffectiveIn === 0);
near("cswap: token1 at tick 0 is the mirror - same output, price after exactly 1.0201", (() => { const r = app.clmmSwap("1000000", -1000, 1000, 0, "token1", "10000", "0"); return r && r.amountOut; })(), 9900.990099009901, 1e-6);
near("cswap: token1 price after is 1.0201", (() => { const r = app.clmmSwap("1000000", -1000, 1000, 0, "token1", "10000", "0"); return r && r.priceAfter; })(), 1.0201, 1e-12);
near("cswap: at 25 bps the token0 trade returns 9,876.482091141 - Tool 2's figure at the virtual reserves", (() => { const r = app.clmmSwap("1000000", -1000, 1000, 0, "token0", "10000", "25"); return r && r.amountOut; })(), 9876.48209114087, 1e-6);
check("cswap: fee withheld exactly at 25 bps", (() => { const r = app.clmmSwap("1000000", -1000, 1000, 0, "token0", "10000", "25"); return r && r.fee === "25" && r.effectiveIn === "9975" && r.feeBps === 25; })());
check("cswap: agrees with Tool 2 on the range's virtual reserves across a sweep (both directions, in-range trades)", (() => { const cases = [["1000000", -1000, 1000, 0, "token0", "10000", "25"], ["1000000", -1000, 1000, 0, "token1", "10000", "0"], ["500000", -2000, 500, -300, "token0", "5000", "30"], ["500000", -2000, 500, -300, "token1", "2500", "100"], ["2000000", 100, 9000, 4000, "token1", "100000", "25"], ["2000000", 100, 9000, 4000, "token0", "100000", "25"], ["750000", -443636, 443636, 12345, "token0", "777.5", "42"]]; for (const c of cases) { const r = app.clmmSwap(c[0], c[1], c[2], c[3], c[4], c[5], c[6]); if (!r || r.reachedBound) return false; const L = Number(c[0]); const s = Math.sqrt(app.tickToPrice(c[3])); const vIn = c[4] === "token0" ? L / s : L * s; const vOut = c[4] === "token0" ? L * s : L / s; const cp = app.cpSwap(vIn.toFixed(9), vOut.toFixed(9), c[5], Number(c[6])); if (!cp) return false; if (Math.abs(Number(cp.amountOut) - r.amountOut) > r.amountOut * 1e-6 + 1e-6) return false; } return true; })());
check("cswap: bound - a 10,000 token0 trade in a -100..100 range stops at the lower bound, using 5,012.269623051 and paying 4,987.272070749", (() => { const r = app.clmmSwap("1000000", -100, 100, 0, "token0", "10000", "0"); return r && r.reachedBound === true && r.boundTick === -100 && Math.abs(r.usedEffectiveIn - 5012.269623051204) < 1e-6 && Math.abs(r.unusedEffectiveIn - 4987.730376948796) < 1e-6 && Math.abs(r.amountOut - 4987.272070749096) < 1e-6 && Math.abs(r.priceAfter - app.tickToPrice(-100)) < 1e-12; })());
check("cswap: bound - the mirrored token1 trade stops at the upper bound with the same amounts", (() => { const r = app.clmmSwap("1000000", -100, 100, 0, "token1", "10000", "0"); return r && r.reachedBound === true && r.boundTick === 100 && Math.abs(r.amountOut - 4987.272070749096) < 1e-6 && Math.abs(r.priceAfter - app.tickToPrice(100)) < 1e-12; })());
check("cswap: a trade that exactly reaches the bound is not flagged past it (one unit less stays inside)", (() => { const inside = app.clmmSwap("1000000", -100, 100, 0, "token0", "5012", "0"); return inside && inside.reachedBound === false; })());
check("cswap: output grows and price falls monotonically with size for token0", (() => { const a = app.clmmSwap("1000000", -1000, 1000, 0, "token0", "1000", "25"); const b = app.clmmSwap("1000000", -1000, 1000, 0, "token0", "10000", "25"); return a && b && b.amountOut > a.amountOut && b.priceAfter < a.priceAfter && b.priceImpactPct > a.priceImpactPct; })());
check("cswap: rejects a current tick outside the range (at the upper bound or below the lower), lower >= upper, zero liquidity or amount, a fee at or over 100%, a fractional-bps fee, >9dp inputs and a bad direction", app.clmmSwap("1000000", -1000, 1000, 1000, "token0", "100", "25") === null && app.clmmSwap("1000000", -1000, 1000, -1001, "token0", "100", "25") === null && app.clmmSwap("1000000", 1000, -1000, 0, "token0", "100", "25") === null && app.clmmSwap("0", -1000, 1000, 0, "token0", "100", "25") === null && app.clmmSwap("1000000", -1000, 1000, 0, "token0", "0", "25") === null && app.clmmSwap("1000000", -1000, 1000, 0, "token0", "100", "10000") === null && app.clmmSwap("1000000", -1000, 1000, 0, "token0", "100", "25.5") === null && app.clmmSwap("1000000", -1000, 1000, 0, "token0", "100.0000000001", "25") === null && app.clmmSwap("1000000", -1000, 1000, 0, "token2", "100", "25") === null);
check("guide teaches CLMM swaps (Tool 42)", guide.includes("Tool 42") && guide.includes("9,900.99009901") && guide.includes("fifty mechanics"));
check("cswap tool labelled model / scope stated in index.html", html.includes("An educational model of a CLMM swap, not a live quote") && html.includes("9,900.99009901"));
check("README documents Tool 42", readme.includes("CLMM swap model") && readme.includes("4,987.272070749"));


/* ---------- Tool 43: limit-order book walk ---------- */
const bk1 = app.orderBookBuy("100", "50", "101", "100", "103", "200", "120");
check("book: headline fills 120 for 12,070 (50 at 100 + 70 at 101)", bk1 && bk1.filled === "120" && bk1.totalCost === "12070" && bk1.remaining === "0" && bk1.fullyFilled === true);
near("book: headline VWAP is 100.583333333", bk1 && bk1.vwap, 100.58333333333333, 1e-9);
check("book: headline costs exactly 70 over filling at the best ask", bk1 && bk1.costAtBest === "12000" && bk1.extraCost === "70" && bk1.bestPrice === "100");
check("book: headline takes are per-level exact", bk1 && bk1.takes[0].taken === "50" && bk1.takes[0].cost === "5000" && bk1.takes[1].taken === "70" && bk1.takes[1].cost === "7070" && bk1.takes[2].taken === "0");
check("book: a buy of 1,000 exhausts the book - fills only its 350 depth for 35,700 (VWAP exactly 102) and leaves 650 unfilled", (() => { const r = app.orderBookBuy("100", "50", "101", "100", "103", "200", "1000"); return r && r.filled === "350" && r.remaining === "650" && r.fullyFilled === false && r.totalCost === "35700" && r.vwap === 102 && r.bookDepth === "350"; })());
check("book: a buy inside the first level never touches the deeper asks", (() => { const r = app.orderBookBuy("100", "50", "101", "100", "103", "200", "25"); return r && r.totalCost === "2500" && r.extraCost === "0" && r.slippagePct === 0 && r.takes[1].taken === "0"; })());
check("book: fractional prices and quantities floor each level's cost at the smallest unit", (() => { const r = app.orderBookBuy("0.333", "1.5", "0.334", "1.5", "0.335", "1.5", "2"); return r && r.filled === "2" && r.totalCost === "0.6665"; })());
check("book: figures agree with the float walk across a sweep", (() => { const cases = [["100","50","101","100","103","200","120"],["12.5","1000","12.75","500","13.5","250","1600"],["0.02","100000","0.021","50000","0.025","10000","123456"],["999","1","1000","2","1001","3","5.5"],["3.333","10","3.334","10","3.335","10","29.999"]]; return cases.every(([p1,q1,p2,q2,p3,q3,b]) => { const r = app.orderBookBuy(p1,q1,p2,q2,p3,q3,b); if (!r) return false; let rem = parseFloat(b), cost = 0, filled = 0; for (const [p,q] of [[p1,q1],[p2,q2],[p3,q3]].map(([a,c]) => [parseFloat(a), parseFloat(c)])) { const t = Math.min(q, rem); cost += t * p; filled += t; rem -= t; } return Math.abs(parseFloat(r.totalCost) - cost) <= Math.max(1e-6, cost * 1e-9) && Math.abs(parseFloat(r.filled) - filled) < 1e-9 && Math.abs(r.vwap - (filled ? cost / filled : 0)) < 1e-6; }); })());
check("book: rejects non-increasing asks, zero or negative inputs and >9dp figures", app.orderBookBuy("101", "50", "100", "100", "103", "200", "120") === null && app.orderBookBuy("100", "50", "100", "100", "103", "200", "120") === null && app.orderBookBuy("100", "0", "101", "100", "103", "200", "120") === null && app.orderBookBuy("100", "50", "101", "100", "103", "200", "0") === null && app.orderBookBuy("100.0000000001", "50", "101", "100", "103", "200", "120") === null);
check("guide teaches walking a limit-order book (Tool 43)", guide.includes("Tool 43") && guide.includes("100.583333333") && guide.includes("fifty mechanics"));
check("book tool labelled model / scope stated in index.html", html.includes("An educational model of an order-book fill, not a live quote") && html.includes("12,070"));
check("README documents Tool 43", readme.includes("Limit-order book walk") && readme.includes("100.583333333"));

/* ---------- Tool 44: TWAP oracle ---------- */
const tw1 = app.twapOracle("0", "360000", "3600", "1.02");
check("twap: headline averages tick 100 over the hour with no remainder", tw1 && tw1.avgTick === 100 && tw1.deltaTicks === "360000" && tw1.remainderTicks === "0" && tw1.elapsedSeconds === 3600);
near("twap: headline TWAP price is 1.0001^100", tw1 && tw1.twapPrice, 1.0100496620928754, 1e-12);
near("twap: headline sits 97.5523 bps below a spot of 1.02 (the lag)", tw1 && tw1.deviationBps, -97.55233242279004, 1e-6);
check("twap: a falling window truncates toward zero, not down - -100 over 3s averages -33 with remainder -1 (floor would give -34)", (() => { const r = app.twapOracle("1000", "900", "3", "1"); return r && r.avgTick === -33 && r.deltaTicks === "-100" && r.remainderTicks === "-1" && Math.abs(r.twapPrice - 0.9967056034608865) < 1e-12; })());
check("twap: the same average over any window scaling agrees (delta and seconds scale together)", (() => { const a = app.twapOracle("0", "360000", "3600", "1.02"); const b = app.twapOracle("-720000", "0", "7200", "1.02"); return a && b && b.avgTick === 100 && b.twapPrice === a.twapPrice; })());
check("twap: a longer window over the same cumulative move smooths the average tick toward zero", (() => { const a = app.twapOracle("0", "360000", "3600", "1.02"); const b = app.twapOracle("0", "360000", "36000", "1.02"); return a && b && b.avgTick === 10 && b.twapPrice < a.twapPrice && b.twapPrice > 1; })());
check("twap: figures agree with the truncating float definition across a sweep", (() => { const cases = [["0", "360000", "3600"], ["-500000", "500000", "100000"], ["123456789", "123000000", "777"], ["9007199", "-9007199", "43200"], ["5", "5", "60"]]; return cases.every(([s, e, sec]) => { const r = app.twapOracle(s, e, sec, "2.5"); if (!r) return false; const want = Math.trunc((Number(e) - Number(s)) / Number(sec)); return r.avgTick === want && Math.abs(r.twapPrice - Math.pow(1.0001, want)) <= r.twapPrice * 1e-12 && Math.abs(Number(r.remainderTicks)) < Number(sec); }); })());
check("twap: rejects a zero or fractional window, fractional or out-of-i64 cumulatives, an average tick outside the pool range, and a bad spot", app.twapOracle("0", "100", "0", "1") === null && app.twapOracle("0", "100", "3.5", "1") === null && app.twapOracle("0.5", "100", "10", "1") === null && app.twapOracle("0", "9223372036854775808", "10", "1") === null && app.twapOracle("0", "3600000000", "3600", "1") === null && app.twapOracle("0", "100", "10", "0") === null && app.twapOracle("0", "100", "10", "1.0000000001") === null);
check("guide teaches TWAP oracles (Tool 44)", guide.includes("Tool 44") && guide.includes("1.010049662") && guide.includes("fifty mechanics"));
check("twap tool labelled model / scope stated in index.html", html.includes("An educational model of a TWAP oracle, not a live quote") && html.includes("1.010049662"));
check("README documents Tool 44", readme.includes("TWAP oracle calculator") && readme.includes("360,000"));

/* ---------- Tool 45: LP withdrawal (burn, pro-rata share of current reserves) ----------
   Vectors prototype-verified before pinning: 20,000 cases, 0 violations of
   the floor-division property out*S <= B*reserve < (out+1)*S, of
   out + remaining == reserve, or of full-burn exactness. */
const lw1 = app.lpWithdraw("2000000", "500000", "1000000", "250000");
check("lpwd: headline - burning 250,000 of 1,000,000 returns 500,000 / 125,000 (a 25% share)", lw1 && lw1.outA === "500000" && lw1.outB === "125000" && lw1.sharePct === 25 && lw1.fullBurn === false);
check("lpwd: headline leaves 1,500,000 / 375,000 against a supply of 750,000", lw1 && lw1.remainingA === "1500000" && lw1.remainingB === "375000" && lw1.remainingSupply === "750000");
check("lpwd: a full burn returns the entire reserves exactly and empties the pool", (() => { const r = app.lpWithdraw("1234567.891", "987654.321", "555555", "555555"); return r && r.fullBurn === true && r.outA === "1234567.891" && r.outB === "987654.321" && r.remainingA === "0" && r.remainingB === "0" && r.remainingSupply === "0" && r.sharePct === 100; })());
check("lpwd: asymmetric reserves floor each side at the smallest unit", (() => { const r = app.lpWithdraw("1000000", "333333", "999", "1"); return r && r.outA === "1001.001001001" && r.outB === "333.666666666" && r.remainingA === "998998.998998999" && r.remainingB === "332999.333333334"; })());
check("lpwd: a dust burn against a large supply floors to zero on both sides and is flagged, not hidden", (() => { const r = app.lpWithdraw("3", "3", "1000000", "0.000000001"); return r && r.outA === "0" && r.outB === "0" && r.zeroA === true && r.zeroB === true && r.remainingA === "3" && r.remainingSupply === "999999.999999999"; })());
check("lpwd: outputs satisfy the floor-division property across a sweep (out*S <= B*reserve < (out+1)*S, out + remaining == reserve)", (() => { const cases = [["2000000", "500000", "1000000", "250000"], ["1000000", "333333", "999", "1"], ["777777.777", "123456.789", "424242", "424241"], ["5", "999999999", "31337", "31337"], ["1000000", "1000000", "1000000", "999999.999999999"], ["42.5", "17.25", "100", "33.333333333"]]; return cases.every(([ra, rb, s, b]) => { const r = app.lpWithdraw(ra, rb, s, b); if (!r) return false; const S = app.parseScaled(s), B = app.parseScaled(b); const oA = app.parseScaled(r.outA), oB = app.parseScaled(r.outB); return oA * S <= B * app.parseScaled(ra) && B * app.parseScaled(ra) < (oA + 1n) * S && oB * S <= B * app.parseScaled(rb) && B * app.parseScaled(rb) < (oB + 1n) * S && oA + app.parseScaled(r.remainingA) === app.parseScaled(ra) && oB + app.parseScaled(r.remainingB) === app.parseScaled(rb); }); })());
check("lpwd: doubling the burn doubles the payout when the share divides evenly", (() => { const a = app.lpWithdraw("2000000", "500000", "1000000", "125000"); const b = app.lpWithdraw("2000000", "500000", "1000000", "250000"); return a && b && b.outA === "500000" && a.outA === "250000" && b.outB === "125000" && a.outB === "62500"; })());
check("lpwd: rejects zero reserves or supply, a zero burn, a burn above the supply, negatives and >9dp figures", app.lpWithdraw("0", "500", "1000", "10") === null && app.lpWithdraw("100", "0", "1000", "10") === null && app.lpWithdraw("100", "500", "0", "10") === null && app.lpWithdraw("100", "500", "1000", "0") === null && app.lpWithdraw("100", "500", "1000", "1001") === null && app.lpWithdraw("-100", "500", "1000", "10") === null && app.lpWithdraw("100.0000000001", "500", "1000", "10") === null);
check("guide teaches burning LP tokens (Tool 45)", guide.includes("Tool 45") && guide.includes("500,000 and 125,000") && guide.includes("fifty mechanics"));
check("lpwd tool labelled model / scope stated in index.html", html.includes("An educational model of an LP withdrawal, not a live quote") && html.includes("125,000"));
check("README documents Tool 45", readme.includes("LP withdrawal calculator") && readme.includes("500,000 / 125,000"));

const ac1 = app.airdropCost(1000, 800, 25, "100", 0);
check("air: headline - 1,000 recipients in batches of 25 take 40 transactions", ac1 && ac1.txCount === 40 && ac1.existingAtas === 200);
check("air: headline - 800 new accounts lock 1,631,424,000 lamports (1.631424 SOL) of rent", ac1 && ac1.rentLamports === 1631424000 && ac1.rentSol === "1.631424" && ac1.rentPerAtaLamports === 2039280);
check("air: headline - fees are 200,000 lamports and the total to fund is 1.631624 SOL plus 100,000 tokens", ac1 && ac1.feesLamports === 200000 && ac1.feesSol === "0.0002" && ac1.totalLamports === 1631624000 && ac1.totalSol === "1.631624" && ac1.tokensNeeded === "100000");
check("air: rent per account is Tool 3's own figure for 165 bytes and the per-transaction fee is Tool 5's base fee at zero priority", ac1 && ac1.rentPerAtaLamports === app.rentExempt(165).rentExemptLamports && ac1.feePerTxLamports === app.txFee(1, 1, 0).totalFeeLamports);
check("air: a priority fee of 10,000 lamports per transaction raises fees to 600,000 and the total to 1.632024 SOL", (() => { const r = app.airdropCost(1000, 800, 25, "100", 10000); return r && r.feePerTxLamports === 15000 && r.feesLamports === 600000 && r.totalLamports === 1632024000 && r.totalSol === "1.632024"; })());
check("air: a single recipient needing one account costs 2,044,280 lamports (rent plus one base fee)", (() => { const r = app.airdropCost(1, 1, 25, "0.5", 0); return r && r.txCount === 1 && r.totalLamports === 2044280 && r.totalSol === "0.00204428" && r.tokensNeeded === "0.5"; })());
check("air: no new accounts means no rent - fees only", (() => { const r = app.airdropCost(1000, 0, 25, "100", 0); return r && r.rentLamports === 0 && r.rentSol === "0" && r.totalLamports === 200000; })());
check("air: the transaction count is a ceiling, not a division - 1,001 recipients at 25 per transaction take 41", (() => { const r = app.airdropCost(1001, 800, 25, "100", 0); return r && r.txCount === 41 && r.feesLamports === 205000 && r.tokensNeeded === "100100"; })());
check("air: totals decompose exactly across a sweep (rent + fees == total, tokens == recipients x amount)", (() => { const cases = [[1000, 800, 25, "100", 0], [1, 1, 1, "0.000000001", 0], [10000, 10000, 20, "250", 5000], [777, 123, 13, "3.25", 999], [5000000, 2500000, 100, "1", 0]]; return cases.every(([n, nu, b, a, p]) => { const r = app.airdropCost(n, nu, b, a, p); if (!r) return false; let tx = 0, left = n; while (left > 0) { tx++; left -= b; } return r.txCount === tx && r.rentLamports + r.feesLamports === r.totalLamports && r.rentLamports === nu * 2039280 && r.feesLamports === tx * (5000 + p) && app.parseScaled(r.tokensNeeded) === BigInt(n) * app.parseScaled(a); }); })());
check("air: rejects zero or over-cap recipients, new accounts above the recipient count, a zero batch, a zero or >9dp amount, and negative or fractional fees", app.airdropCost(0, 0, 25, "100", 0) === null && app.airdropCost(10000001, 0, 25, "100", 0) === null && app.airdropCost(100, 101, 25, "100", 0) === null && app.airdropCost(100, 50, 0, "100", 0) === null && app.airdropCost(100, 50, 25, "0", 0) === null && app.airdropCost(100, 50, 25, "0.0000000001", 0) === null && app.airdropCost(100, 50, 25, "100", -1) === null && app.airdropCost(100, 50, 2.5, "100", 0) === null);
check("guide teaches airdrop costs (Tool 46)", guide.includes("Tool 46") && guide.includes("1.631624 SOL") && guide.includes("fifty mechanics"));
check("air tool labelled model / scope stated in index.html", html.includes("An educational model of an airdrop's SOL cost, not a live quote") && html.includes("1,631,424,000 lamports"));
check("README documents Tool 46", readme.includes("Airdrop / multisend cost planner") && readme.includes("1.631624 SOL"));

const du1 = app.dutchAuctionPrice("10", "1", 3600, 900, 0);
check("dutch: headline - 900 seconds into a 10-to-1 hour the price is 7.75, a quarter of the drop gone", du1 && du1.price === "7.75" && du1.dropped === "2.25" && du1.dropPctOfRange === 25 && du1.ended === false && du1.remainingSeconds === 2700 && du1.effectiveSeconds === 900);
check("dutch: halfway the price is 5.5, at the end exactly the floor, and past the end still exactly the floor", (() => { const h = app.dutchAuctionPrice("10", "1", 3600, 1800, 0); const e = app.dutchAuctionPrice("10", "1", 3600, 3600, 0); const p = app.dutchAuctionPrice("10", "1", 3600, 99999, 0); return h && h.price === "5.5" && h.dropPctOfRange === 50 && e && e.price === "1" && e.ended === true && e.remainingSeconds === 0 && p && p.price === "1" && p.ended === true; })());
check("dutch: at elapsed 0 the price is exactly the start and nothing has dropped", (() => { const r = app.dutchAuctionPrice("10", "1", 3600, 0, 0); return r && r.price === "10" && r.dropped === "0" && r.dropPctOfRange === 0; })());
check("dutch: stepped - a 600-second step holds 8.5 at 900 and at 1,199 seconds, then steps to 7 at 1,200", (() => { const a = app.dutchAuctionPrice("10", "1", 3600, 900, 600); const b = app.dutchAuctionPrice("10", "1", 3600, 1199, 600); const c = app.dutchAuctionPrice("10", "1", 3600, 1200, 600); return a && a.price === "8.5" && a.effectiveSeconds === 600 && a.nextDropInSeconds === 300 && b && b.price === "8.5" && b.nextDropInSeconds === 1 && c && c.price === "7" && c.nextDropInSeconds === 600; })());
check("dutch: a step that does not divide the duration still ends exactly on the floor (700-second steps: 1.25 at 3,599, 1 at 3,600)", (() => { const a = app.dutchAuctionPrice("10", "1", 3600, 3599, 700); const b = app.dutchAuctionPrice("10", "1", 3600, 3600, 700); return a && a.price === "1.25" && a.effectiveSeconds === 3500 && b && b.price === "1" && b.ended === true; })());
check("dutch: a zero floor decays toward worthless - 2.5 at 2,700 of 3,600 seconds - and a floor equal to the start never moves", (() => { const z = app.dutchAuctionPrice("10", "0", 3600, 2700, 0); const f = app.dutchAuctionPrice("5", "5", 3600, 1800, 0); return z && z.price === "2.5" && z.dropped === "7.5" && f && f.price === "5" && f.dropped === "0" && f.dropPctOfRange === 0; })());
check("dutch: price + dropped == start exactly and the price never rises, across a sweep", (() => { const cases = [["10", "1", 3600, 0], ["10", "1", 3600, 600], ["123.456", "0.001", 86400, 0], ["0.5", "0.25", 77, 0], ["1000000", "999999", 1000000000, 0]]; return cases.every(([s0, f0, d, st]) => { let prev = null; for (let t = 0; t <= d + 10; t += Math.max(1, Math.floor(d / 25))) { const r = app.dutchAuctionPrice(s0, f0, d, t, st); if (!r) return false; if (app.parseScaled(r.price) + app.parseScaled(r.dropped) !== app.parseScaled(s0)) return false; if (prev !== null && app.parseScaled(r.price) > prev) return false; prev = app.parseScaled(r.price); } return true; }); })());
check("dutch: rejects a floor above the start, a zero start, a zero or fractional duration, negative or fractional elapsed, a step longer than the duration, and >9dp prices", app.dutchAuctionPrice("1", "10", 3600, 0, 0) === null && app.dutchAuctionPrice("0", "0", 3600, 0, 0) === null && app.dutchAuctionPrice("10", "1", 0, 0, 0) === null && app.dutchAuctionPrice("10", "1", 3600.5, 0, 0) === null && app.dutchAuctionPrice("10", "1", 3600, -1, 0) === null && app.dutchAuctionPrice("10", "1", 3600, 1.5, 0) === null && app.dutchAuctionPrice("10", "1", 3600, 0, 3601) === null && app.dutchAuctionPrice("10.0000000001", "1", 3600, 0, 0) === null);
check("guide teaches Dutch auction decay (Tool 47)", guide.includes("Tool 47") && guide.includes("7.75") && guide.includes("fifty mechanics"));
check("dutch tool labelled model / scope stated in index.html", html.includes("An educational model of a Dutch auction's price schedule, not a live quote") && html.includes("8.5"));
check("README documents Tool 47", readme.includes("Dutch auction price calculator") && readme.includes("7.75"));


const gv1 = app.govVote("10000000", "600000", "200000", "100000", 1000, 6000);
check("gov: headline - 900,000 cast of a 10,000,000 supply at a 10% quorum is 100,000 short, so a 75% for-share still fails", gv1 && gv1.cast === "900000" && gv1.quorumNeeded === "1000000" && gv1.quorumShortfall === "100000" && gv1.turnoutBps === 900 && gv1.approvalActualBps === 7500 && gv1.quorumMet === false && gv1.approvalMet === true && gv1.passes === false);
check("gov: 700,000 for reaches quorum exactly (1,000,000 cast) and passes at a 7,777 bp for-share", (() => { const r = app.govVote("10000000", "700000", "200000", "100000", 1000, 6000); return r && r.cast === "1000000" && r.quorumShortfall === "0" && r.turnoutBps === 1000 && r.approvalActualBps === 7777 && r.passes === true; })());
check("gov: abstentions alone meet quorum but can never meet approval (no decisive votes)", (() => { const r = app.govVote("10000000", "0", "0", "1000000", 1000, 5000); return r && r.quorumMet === true && r.approvalActualBps === null && r.approvalMet === false && r.passes === false; })());
check("gov: quorum requirement ceilings at the smallest unit (supply 3 at 3,334 bps needs 1.0002, not 1)", (() => { const r = app.govVote("3", "1", "0", "0", 3334, 5000); return r && r.quorumNeeded === "1.0002" && r.quorumMet === false && r.quorumShortfall === "0.0002"; })());
check("gov: a zero quorum needs no votes, and a unanimous threshold needs every decisive vote", (() => { const a = app.govVote("1000", "1", "0", "0", 0, 10000); const b = app.govVote("1000", "999", "1", "0", 0, 10000); return a && a.quorumNeeded === "0" && a.passes === true && b && b.approvalActualBps === 9990 && b.passes === false; })());
check("gov: quorum is the smallest reaching amount and the for-share the largest whole bp not above the truth, across a sweep", (() => { const cases = [["10000000", "600000", "200000", "100000", 1000, 6000], ["3", "1", "1", "1", 3334, 5000], ["123456.789", "10000.5", "9999.5", "0.000000001", 1, 5001], ["1000", "0", "0", "0", 0, 1], ["999999999", "333333333", "333333333", "333333333", 10000, 5000]]; return cases.every(([su, f, a, ab, q, ap]) => { const r = app.govVote(su, f, a, ap === undefined ? ab : ab, q, ap); if (!r) return false; const S = app.parseScaled(su), need = app.parseScaled(r.quorumNeeded), cast = app.parseScaled(r.cast); const ceilOk = need * 10000n >= S * BigInt(q) && (need === 0n || (need - 1n) * 10000n < S * BigInt(q)); const dec = app.parseScaled(r.forVotes) + app.parseScaled(r.againstVotes); const floorOk = r.approvalActualBps === null ? dec === 0n : (BigInt(r.approvalActualBps) * dec <= app.parseScaled(r.forVotes) * 10000n && app.parseScaled(r.forVotes) * 10000n < BigInt(r.approvalActualBps + 1) * dec); return ceilOk && floorOk && cast === app.parseScaled(r.forVotes) + app.parseScaled(r.againstVotes) + app.parseScaled(r.abstainVotes) && r.passes === (r.quorumMet && r.approvalMet); }); })());
check("gov: rejects a zero supply, a cast above the supply, a quorum above 10,000 bps, a zero or over-range approval threshold, fractional bps, and >9dp tallies", app.govVote("0", "0", "0", "0", 1000, 6000) === null && app.govVote("1000", "600", "300", "200", 1000, 6000) === null && app.govVote("1000", "1", "0", "0", 10001, 6000) === null && app.govVote("1000", "1", "0", "0", 1000, 0) === null && app.govVote("1000", "1", "0", "0", 1000, 10001) === null && app.govVote("1000", "1", "0", "0", 1000.5, 6000) === null && app.govVote("1000.0000000001", "1", "0", "0", 1000, 6000) === null);
check("guide teaches governance quorum and approval (Tool 48)", guide.includes("Tool 48") && guide.includes("100,000 short of quorum") && guide.includes("fifty mechanics"));
check("gov tool labelled model / scope stated in index.html", html.includes("An educational model of a governance vote, not a live tally") && html.includes("100,000 short"));
check("README documents Tool 48", readme.includes("Governance quorum & approval calculator") && readme.includes("77.77%"));


/* Tool 49 - token supply allocation: named buckets floored at the smallest
   unit, treasury as designated remainder so parts sum exactly; dust 0..3
   units. Vectors prototype-verified on 19,999 cases before pinning. */
const al1 = app.tokenAllocation("1000000000", 4000, 2500, 2000);
check("alloc: headline - 1B at 40/25/20 splits 400M/250M/200M with a 150M treasury remainder and no dust", al1 && al1.liquidity === "400000000" && al1.community === "250000000" && al1.team === "200000000" && al1.treasuryBps === 1500 && al1.treasury === "150000000" && al1.treasuryNominal === "150000000" && al1.dust === "0" && al1.dustUnits === 0);
check("alloc: dust case - supply 1.000000001 at 3,333 bps a bucket floors each to 0.3333 and the treasury takes its nominal 0.0001 plus exactly 1 smallest unit of dust", (() => { const r = app.tokenAllocation("1.000000001", 3333, 3333, 3333); return r && r.liquidity === "0.3333" && r.community === "0.3333" && r.team === "0.3333" && r.treasuryBps === 1 && r.treasuryNominal === "0.0001" && r.treasury === "0.000100001" && r.dust === "0.000000001" && r.dustUnits === 1; })());
check("alloc: one bucket at 10,000 bps takes the whole supply and the treasury is zero", (() => { const r = app.tokenAllocation("1000", 10000, 0, 0); return r && r.liquidity === "1000" && r.community === "0" && r.team === "0" && r.treasuryBps === 0 && r.treasury === "0"; })());
check("alloc: all-zero named shares leave the whole supply in the treasury", (() => { const r = app.tokenAllocation("1000", 0, 0, 0); return r && r.treasuryBps === 10000 && r.treasury === "1000" && r.dust === "0"; })());
check("alloc: parts sum to the supply exactly and every named bucket is the largest floored share, across a sweep", (() => { const cases = [["1000000000", 4000, 2500, 2000], ["1.000000001", 3333, 3333, 3333], ["7.000000001", 3333, 3333, 3333], ["123456.789123456", 1, 9999, 0], ["999999999.999999999", 5000, 5000, 0], ["0.000000001", 5000, 2500, 2500], ["42", 0, 0, 10000]]; return cases.every(([su, l, c, t]) => { const r = app.tokenAllocation(su, l, c, t); if (!r) return false; const S = app.parseScaled(su); const parts = [r.liquidity, r.community, r.team, r.treasury]; const shares = [l, c, t]; if (parts.reduce((a, x) => a + app.parseScaled(x), 0n) !== S) return false; const floorOk = shares.every((b, j) => { const a = app.parseScaled(parts[j]); return a * 10000n <= S * BigInt(b) && S * BigInt(b) < (a + 1n) * 10000n; }); return floorOk && app.parseScaled(r.treasury) >= app.parseScaled(r.treasuryNominal) && r.dustUnits >= 0 && r.dustUnits <= 3 && r.treasuryBps === 10000 - l - c - t; }); })());
check("alloc: rejects shares summing past 10,000 bps, a single share past 10,000, fractional or negative shares, a zero supply and >9dp supplies", app.tokenAllocation("1000", 5000, 5000, 1) === null && app.tokenAllocation("1000", 10001, 0, 0) === null && app.tokenAllocation("1000", 2500.5, 0, 0) === null && app.tokenAllocation("1000", -1, 0, 0) === null && app.tokenAllocation("0", 4000, 2500, 2000) === null && app.tokenAllocation("1.0000000001", 4000, 2500, 2000) === null);
check("guide teaches supply allocation (Tool 49)", guide.includes("Tool 49") && guide.includes("0.000100001") && guide.includes("fifty mechanics"));
check("alloc tool labelled model / scope stated in index.html", html.includes("An educational model of a supply split, not a live token") && html.includes("150,000,000"));
check("README documents Tool 49", readme.includes("Token supply allocation planner") && readme.includes("400,000,000"));


/* ---------- Tool 50: quadratic voting cost ---------- */
const qv1 = app.quadraticVote(100, 6, 8, 0);
check("qv: headline - 6 and 8 votes on a 100-credit budget cost 36 + 64 = 100 exactly, 14 votes in total, nothing left", qv1 && qv1.costs[0] === "36" && qv1.costs[1] === "64" && qv1.costs[2] === "0" && qv1.totalCost === "100" && qv1.remaining === "0" && qv1.overBudget === false && qv1.totalVotes === 14);
check("qv: headline - the whole budget concentrated buys at most 10 votes (costing 100), and the next votes cost 13, 17 and 1", qv1 && qv1.maxSingleVotes === 10 && qv1.maxSingleCost === "100" && qv1.nextCosts[0] === "13" && qv1.nextCosts[1] === "17" && qv1.nextCosts[2] === "1");
check("qv: splitting 7 and 7 costs 98 for the same 14 votes - breadth is cheaper than intensity", (() => { const r = app.quadraticVote(100, 7, 7, 0); return r && r.totalCost === "98" && r.remaining === "2" && r.totalVotes === 14; })());
check("qv: an over-budget ballot is reported, not trimmed - 11 votes cost 121, 21 over a 100 budget", (() => { const r = app.quadraticVote(100, 11, 0, 0); return r && r.totalCost === "121" && r.remaining === "-21" && r.overBudget === true; })());
check("qv: a 99-credit budget buys at most 9 votes on one proposal (81), never 10", (() => { const r = app.quadraticVote(99, 0, 0, 0); return r && r.maxSingleVotes === 9 && r.maxSingleCost === "81" && r.remaining === "99"; })());
check("qv: totals, remainders, floor square roots and marginal costs agree with the definitions across a sweep", (() => { const cases = [[100, 6, 8, 0], [99, 9, 0, 0], [1000000, 999, 1, 0], [7, 2, 1, 1], [1000000000000, 1000000, 0, 0], [1, 1, 0, 0], [50, 0, 0, 0]]; return cases.every(([B, a, b, c]) => { const r = app.quadraticVote(B, a, b, c); if (!r) return false; const vs = [a, b, c]; const total = vs.reduce((s, v) => s + v * v, 0); let m = 0; while ((m + 1) * (m + 1) <= B) m++; return r.totalCost === String(total) && r.remaining === String(B - total) && r.overBudget === (total > B) && r.maxSingleVotes === m && r.nextCosts.every((n, j) => n === String(2 * vs[j] + 1)) && r.costs.every((n, j) => n === String(vs[j] * vs[j])); }); })());
check("qv: rejects a zero or over-cap budget, fractional or negative votes, and votes above the cap", app.quadraticVote(0, 0, 0, 0) === null && app.quadraticVote(1000000000001, 0, 0, 0) === null && app.quadraticVote(100, 1.5, 0, 0) === null && app.quadraticVote(100, -1, 0, 0) === null && app.quadraticVote(100, 1000001, 0, 0) === null && app.quadraticVote(100.5, 0, 0, 0) === null);
check("guide teaches quadratic voting (Tool 50)", guide.includes("Tool 50") && guide.includes("36 + 64 = 100") && guide.includes("fifty mechanics"));
check("qv tool labelled model / scope stated in index.html", html.includes("An educational model of a quadratic vote, not a live ballot") && html.includes("10 votes"));
check("README documents Tool 50", readme.includes("Quadratic voting cost calculator") && readme.includes("36 + 64 = 100"));

/* ---------- Tool 51: token burn & holder share ---------- */
const b1 = app.burnShare("1000000000", "10000000", "100000000");
check("burn: headline - burning 100M of 1B leaves 900M", b1 && b1.newSupply === "900000000" && b1.burnBps === 1000);
check("burn: a 10M holder rises from 100 to 111 whole bps (1% to 1.11%) with the same balance", b1 && b1.beforeBps === 100 && b1.afterBps === 111 && b1.gainBps === 11 && b1.holder === "10000000");
check("burn: burning everything except the holder leaves them at exactly 100%", (() => { const r = app.burnShare("10", "5", "5"); return r && r.newSupply === "5" && r.afterBps === 10000 && r.fullyBurned === false; })());
check("burn: a zero holder burning the whole supply leaves nothing and no share", (() => { const r = app.burnShare("10", "0", "10"); return r && r.newSupply === "0" && r.afterBps === 0 && r.fullyBurned === true; })());
check("burn: shares agree with the floored definitions and never fall across a sweep", (() => { const cases = [["1000000000","10000000","100000000"],["10","5","5"],["10","0","10"],["3","1","1"],["1000000","1","999999"],["7","3","4"],["100","33","66"]]; return cases.every(([S,H,B]) => { const r = app.burnShare(S,H,B); if (!r) return false; const s2 = BigInt(S), h = BigInt(H), b = BigInt(B); return r.newSupply === String(s2-b) && r.burnBps === Number(b*10000n/s2) && r.beforeBps === Number(h*10000n/s2) && (s2-b === 0n ? r.afterBps === 0 : r.afterBps === Number(h*10000n/(s2-b))) && r.afterBps >= r.beforeBps; }); })());
check("burn: rejects a burn of the holder own tokens, an over-supply holder, and zero or over-precise amounts", app.burnShare("100", "60", "41") === null && app.burnShare("100", "101", "1") === null && app.burnShare("100", "10", "0") === null && app.burnShare("0", "0", "1") === null && app.burnShare("100", "10", "0.0000000001") === null);
check("guide teaches token burns (Tool 51)", guide.includes("Tool 51") && guide.includes("100 to 111 whole basis points") && guide.includes("fifty mechanics"));
check("burn tool labelled model / scope stated in index.html", html.includes("An educational model of a token burn, not a live token") && html.includes("1.11%"));
check("README documents Tool 51", readme.includes("Token burn & holder-share calculator") && readme.includes("1.11%"));

console.log(failures === 0 ? "ALL TESTS PASS" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
