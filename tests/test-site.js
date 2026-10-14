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
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=6"));
check("css non-trivial", css.length > 1500);
for (const id of ["sol-in", "lam-out", "lam-in", "sol-out", "swap-rin", "swap-rout", "swap-ain", "swap-fee", "swap-out", "rent-len", "rent-out", "il-ratio", "il-out", "fee-sigs", "fee-cu", "fee-price", "fee-out", "tok-dec", "tok-ui", "tok-raw-out", "tok-raw", "tok-ui-out", "addr-in", "addr-out", "stake-amt", "stake-yield", "stake-epochs", "stake-comm", "stake-out", "pay-recipient", "pay-amount", "pay-spl", "pay-ref", "pay-label", "pay-message", "pay-memo", "pay-out", "payparse-in", "payparse-out"]) {
  check("control labelled: " + id, html.includes(`for="${id}"`) && html.includes(`id="${id}"`));
}
for (const id of ["lamp-calc", "swap-calc", "rent-calc", "il-calc", "fee-calc", "tok-calc", "addr-calc", "stake-calc", "pay-calc", "payparse-calc", "lamp-result", "swap-result", "rent-result", "il-result", "fee-result", "tok-result", "addr-result", "stake-result", "pay-result", "payparse-result", "donation-address", "copy-address"]) {
  check("element present: " + id, html.includes(`id="${id}"`));
}
check("ten tool forms (nine tools, Tool 9 has build + inspect)", (html.match(/<form id=/g) || []).length === 10);

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

/* catalogue filter logic */
check("filter all matches anything", app.catalogueMatch("dex", "all") === true);
check("filter matches a category token", app.catalogueMatch("mine payments", "payments") === true);
check("filter rejects other categories", app.catalogueMatch("mine payments", "dex") === false);
check("filter does not substring-match", app.catalogueMatch("core", "cor") === false);

console.log(failures === 0 ? "ALL TESTS PASS" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
