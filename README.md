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
