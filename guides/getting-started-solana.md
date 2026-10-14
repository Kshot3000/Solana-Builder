# Getting started building on Solana

A checklist for going from zero to a deployed devnet program, written by an independent builder. I'm Kyle Cox — [@kshot9000](https://x.com/kshot9000), [github.com/Kshot3000](https://github.com/Kshot3000). This hub tags the teams whose work it builds on: [@solana-foundation](https://github.com/solana-foundation) / [@solana](https://x.com/solana) and, for the DEX track, [@raydium-io](https://github.com/raydium-io) / [@Raydium](https://x.com/Raydium).

Support this work (SOL): `G7xepVyQSrxtH61ZooXvPAmnS8omQ1TvHqB8qDmHXWm`

I am an independent builder — not affiliated with the Solana Foundation, Raydium, or any project mentioned here.

## 1. Install the tools

- Solana CLI: follow the official installation guide at https://solana.com/docs/intro/installation
- Anchor: https://www.anchor-lang.com — the framework most Solana programs are written in.
- Node.js 18+ for TypeScript clients and tests.

## 2. Set up a devnet wallet

```bash
solana config set --url devnet
solana-keygen new
solana airdrop 2
solana balance
```

Devnet SOL is free and worthless, on purpose: learn there, never on mainnet.

## 3. Learn the five mechanics that decide your costs

1. **Lamports.** 1 SOL = 1,000,000,000 lamports; balances are whole lamports. The hub's converter (Tool 1) shows the exact integer math.
2. **Rent exemption.** An account is rent-exempt holding two years of rent: `(128 + dataLen) × 3,480 × 2` lamports. A token account (165 bytes) therefore locks up 2,039,280 lamports — every account your program creates has a SOL cost you can compute before writing code (Tool 3).
3. **Pool pricing.** AMM swaps price off the constant-product curve. Run the swap model (Tool 2) at a few sizes and watch price impact: that curve is what Raydium, Orca and every aggregator route around.
4. **Transaction fees.** Every transaction pays 5,000 lamports per signature, plus an optional priority fee: `ceil(CU limit × CU price ÷ 1,000,000)` lamports, with the price in micro-lamports per compute unit. The fee is charged on the limit you request (capped at 1,400,000 CU), not the compute you use — simulate first and set the limit close to real usage. The hub's estimator (Tool 5) works the numbers.
5. **Token decimals.** Lamports are the 9-decimal special case: every SPL mint sets its own decimals (USDC 6, many mints 9, some 0), token accounts store raw integer amounts, and the UI amount is raw ÷ 10^decimals. Never hardcode 9 for a token — read the decimals off the mint, and reject amounts finer than they allow instead of rounding them. The hub's converter (Tool 6) shows both directions exactly.

## 4. Scaffold and test

```bash
anchor init my-program
cd my-program
anchor test
```

`anchor test` runs a local validator and TypeScript tests against your program — the same assertions style this hub uses for its own models.

## 5. Deploy to devnet, honestly

```bash
anchor deploy --provider.cluster devnet
```

Only deploy once tests pass, and label everything you show users for what it is: devnet, testnet, model or live. This hub's rule — no modelled data presented as live, no tool presented as a quote — is a good rule for your app too.

## Where next

- Swap mechanics in depth: my [Raydium Renaissance](https://kshot3000.github.io/Raydium-Renaissance/) hub (130+ pool tools).
- Payments: the [Solana Pay Link Desk](https://kshot3000.github.io/solana-pay-link-desk/) builds Solana Pay links locally.
- Docs: https://solana.com/docs and the Anchor book at https://www.anchor-lang.com.
