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
check("cache keys present", html.includes("styles.css?v=1") && html.includes("app.js?v=1"));
check("css non-trivial", css.length > 1500);
for (const id of ["sol-in", "lam-out", "lam-in", "sol-out", "swap-rin", "swap-rout", "swap-ain", "swap-fee", "swap-out", "rent-len", "rent-out", "il-ratio", "il-out"]) {
  check("control labelled: " + id, html.includes(`for="${id}"`) && html.includes(`id="${id}"`));
}
for (const id of ["lamp-calc", "swap-calc", "rent-calc", "il-calc", "lamp-result", "swap-result", "rent-result", "il-result", "donation-address", "copy-address"]) {
  check("element present: " + id, html.includes(`id="${id}"`));
}
check("four tool forms", (html.match(/<form id=/g) || []).length === 4);

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

/* catalogue filter logic */
check("filter all matches anything", app.catalogueMatch("dex", "all") === true);
check("filter matches a category token", app.catalogueMatch("mine payments", "payments") === true);
check("filter rejects other categories", app.catalogueMatch("mine payments", "dex") === false);
check("filter does not substring-match", app.catalogueMatch("core", "cor") === false);

console.log(failures === 0 ? "ALL TESTS PASS" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
