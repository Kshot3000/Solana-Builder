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
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=19"));
check("css non-trivial", css.length > 1500);
for (const id of ["sol-in", "lam-out", "lam-in", "sol-out", "swap-rin", "swap-rout", "swap-ain", "swap-fee", "swap-out", "rent-len", "rent-out", "il-ratio", "il-out", "fee-sigs", "fee-cu", "fee-price", "fee-out", "tok-dec", "tok-ui", "tok-raw-out", "tok-raw", "tok-ui-out", "addr-in", "addr-out", "stake-amt", "stake-yield", "stake-epochs", "stake-comm", "stake-out", "pay-recipient", "pay-amount", "pay-spl", "pay-ref", "pay-label", "pay-message", "pay-memo", "pay-out", "payparse-in", "payparse-out", "tick-in", "tick-price-out", "price-in", "price-tick-out", "range-lower", "range-upper", "range-current", "range-spacing", "range-out", "slip-expout", "slip-expin", "slip-bps", "slip-min-out", "slip-max-out", "epoch-slot-in", "epoch-out", "epochrange-in", "epochrange-out", "tfee-amt", "tfee-bps", "tfee-max", "tfee-fee-out", "tfee-net-out", "tgross-net", "tgross-bps", "tgross-max", "tgross-out", "sand-rin", "sand-rout", "sand-victim", "sand-attacker", "sand-fee", "sand-slip", "sand-victim-out", "sand-attacker-out", "lst-total", "lst-supply", "lst-rewards", "lst-deposit", "lst-redeem", "lst-rate-out", "lst-redeem-out", "pda-program", "pda-seed1", "pda-seed2", "pda-out", "clmmpos-l", "clmmpos-lower", "clmmpos-upper", "clmmpos-current", "clmmpos-a0-out", "clmmpos-a1-out", "lpdep-ra", "lpdep-rb", "lpdep-supply", "lpdep-da", "lpdep-db", "lpdep-minted-out", "lpdep-share-out", "vest-total", "vest-cliff", "vest-duration", "vest-elapsed", "vest-claim-out", "vest-cliff-out", "lend-amt", "lend-price", "lend-debt", "lend-liq", "lend-maxltv", "lend-hf-out", "lend-liqprice-out", "txsz-sigs", "txsz-keys", "txsz-lw", "txsz-lr", "txsz-accts", "txsz-data", "txsz-out", "txsz-head-out", "sp-f1-type", "sp-f1-n", "sp-f1-elem", "sp-f2-type", "sp-f2-n", "sp-f2-elem", "sp-f3-type", "sp-f3-n", "sp-f3-elem", "sp-f4-type", "sp-f4-n", "sp-f4-elem", "sp-total-out", "sp-rent-out"]) {
  check("control labelled: " + id, html.includes(`for="${id}"`) && html.includes(`id="${id}"`));
}
for (const id of ["lamp-calc", "swap-calc", "rent-calc", "il-calc", "fee-calc", "tok-calc", "addr-calc", "stake-calc", "pay-calc", "payparse-calc", "tick-calc", "clmmrange-calc", "slip-calc", "lamp-result", "swap-result", "rent-result", "il-result", "fee-result", "tok-result", "addr-result", "stake-result", "pay-result", "payparse-result", "tick-result", "range-result", "slip-result", "epoch-calc", "epochrange-calc", "epoch-result", "epochrange-result", "tfee-calc", "tgross-calc", "tfee-result", "tgross-result", "sand-calc", "sand-result", "lst-calc", "lst-result", "pda-calc", "pda-result", "clmmpos-calc", "clmmpos-result", "lpdep-calc", "lpdep-result", "vest-calc", "vest-result", "lend-calc", "lend-result", "txsz-calc", "txsz-result", "sp-calc", "sp-result", "donation-address", "copy-address"]) {
  check("element present: " + id, html.includes(`id="${id}"`));
}
check("twenty-six tool forms (twenty-two tools, Tools 9, 10, 12 and 13 each have two)", (html.match(/<form id=/g) || []).length === 26);

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
check("guide teaches CLMM position amounts (Tool 17)", guide.includes("Tool 17") && guide.includes("60,005.999") && guide.includes("twenty-one mechanics"));
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
check("guide teaches LP deposits (Tool 18)", guide.includes("Tool 18") && guide.includes("0.990099%") && guide.includes("twenty-one mechanics"));
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
check("guide teaches vesting (Tool 19)", guide.includes("Tool 19") && guide.includes("375,000 claimable") && guide.includes("twenty-one mechanics"));
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
check("guide teaches lending health (Tool 20)", guide.includes("Tool 20") && guide.includes("liquidation price of 62.5") && guide.includes("twenty-one mechanics"));
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
check("guide teaches transaction size (Tool 21)", guide.includes("Tool 21") && guide.includes("exactly 215 bytes") && guide.includes("twenty-one mechanics"));
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
check("guide teaches account space (Tool 22)", guide.includes("Tool 22") && guide.includes("85 bytes") && guide.includes("twenty-one mechanics"));
check("space tool labelled model / scope stated in index.html", html.includes("enums are not modelled") && html.includes("An educational model of the serialization format, not a live account"));

/* catalogue filter logic */
check("filter all matches anything", app.catalogueMatch("dex", "all") === true);
check("filter matches a category token", app.catalogueMatch("mine payments", "payments") === true);
check("filter rejects other categories", app.catalogueMatch("mine payments", "dex") === false);
check("filter does not substring-match", app.catalogueMatch("core", "cor") === false);

console.log(failures === 0 ? "ALL TESTS PASS" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
