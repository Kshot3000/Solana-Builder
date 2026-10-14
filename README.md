# Solana Ecosystem Builder

An independent builder hub for the whole Solana ecosystem — tools, a verified project catalogue, and guides, by Kyle Cox ([@kshot9000](https://x.com/kshot9000), [github.com/Kshot3000](https://github.com/Kshot3000)).

**Live hub:** https://kshot3000.github.io/Solana-Builder/

I build, fix and improve across Solana: Raydium, Jupiter, Orca, Anchor, Solana Pay and the wider ecosystem. Raydium-specific work also lives at [Raydium Renaissance](https://kshot3000.github.io/Raydium-Renaissance/); my Solana Pay tool is the [Link Desk](https://kshot3000.github.io/solana-pay-link-desk/).

## Tools (all educational models, browser-local)

1. **SOL ⇄ lamports converter** — exact BigInt conversion; 1 SOL = 1,000,000,000 lamports, no rounding.
2. **Constant-product swap model** — x·y=k with the fee on the input and price impact, exact scaled-BigInt math.
3. **Rent-exempt minimum calculator** — (128 + dataLen) × 3,480 × 2 lamports, the network's rent parameters.
4. **Impermanent-loss calculator** — 2√r/(1+r) − 1 for a 50/50 pool position.
5. **Transaction fee estimator** — 5,000 lamports per signature plus the priority fee, ceil(CU limit × CU price in micro-lamports ÷ 1,000,000), charged on the requested CU limit (capped at 1,400,000).
6. **SPL token amount converter** — UI amount ⇄ raw units by the mint's own decimals (USDC 6, SOL 9, some mints 0), exact BigInt; amounts finer than the mint's decimals are rejected, never rounded.
7. **Solana address checker** — base58 format validation: every character in the base58 alphabet (no 0, O, I or l) and a decoded length of exactly 32 bytes; format only — it does not check that an account exists or is safe to send to.
8. **Staking rewards estimator** — rewards once per epoch (432,000 slots, ~2 days, ~182.5 epochs/year), validator commission taken from the reward, net rewards compounded epoch by epoch; the annual yield is a user assumption, not a live network yield.
9. **Solana Pay URL builder & inspector** — builds and parses transfer-request URLs (`solana:<recipient>?amount=…&spl-token=…&reference=…&label=…&message=…&memo=…`) per the Solana Pay specification: the recipient must be a native account (associated token accounts must not be used), amounts are user units with the asset's decimal precision enforced where the mint is known locally (SOL 9, USDC and USDG 6), duplicate single-value fields and malformed percent-encoding are rejected, and nothing is sent.
10. **CLMM tick ⇄ price converter & range checker** — concentrated liquidity (Raydium CLMM, Orca Whirlpools): price(tick) = 1.0001^tick over the on-chain tick range −443,636 to 443,636, price-to-tick as a floor, and a position-range check that enforces endpoint alignment to the pool's tick spacing and reports whether the current tick is in range; prices are in raw token units.
11. **Slippage tolerance & minimum-received calculator** — the bound every DEX interface signs: minimum received = expected out × (1 − tolerance) and maximum input = expected in × (1 + tolerance), both floored in exact scaled-BigInt so the bound is never looser than the tolerance picked (an expected 4 at 0.5% protects at 3.98); a dust quote whose minimum floors to 0 is flagged as protecting nothing.
12. **Epoch schedule converter** — slot ⇄ epoch using the runtime's real EpochSchedule, warmup included: epochs 0–13 double from 32 slots, the first normal epoch is 14 at slot 524,256, and only then does an epoch hold a constant 432,000 slots — so the textbook `slot ÷ 432,000` is a dozen-plus epochs behind. Schedule math in slots only; no wall-clock conversion, because the target slot duration has changed repeatedly.
13. **Token-2022 transfer fee calculator** — the fee a transfer-fee mint withholds on every transfer: fee = ceil(raw amount × basis points ÷ 10,000), capped at the mint's maximum fee, computed in exact BigInt on raw units, plus the inverse gross-up (the smallest amount to send so the recipient receives an exact net). The ceiling means any positive transfer at a positive rate pays at least 1 raw unit; the classic SPL Token program has no transfer fees.

Every tool is labelled on the page for what it is: an educational model, not live quotes, not live data, not financial advice. No wallet connects and nothing executes on-chain.

## Tests

```bash
node tests/test-site.js
```

## Attribution & support

- SOL donations: `G7xepVyQSrxtH61ZooXvPAmnS8omQ1TvHqB8qDmHXWm`
- X: [@kshot9000](https://x.com/kshot9000)
- Ecosystem thanks: [@solana-foundation](https://github.com/solana-foundation) / [@solana](https://x.com/solana), [@raydium-io](https://github.com/raydium-io) / [@Raydium](https://x.com/Raydium)

I am an independent builder — not affiliated with the Solana Foundation, Raydium, or any catalogued project, and not a member of any of their teams.
