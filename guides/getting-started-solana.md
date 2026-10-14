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

## 3. Learn the eleven mechanics that decide your costs

1. **Lamports.** 1 SOL = 1,000,000,000 lamports; balances are whole lamports. The hub's converter (Tool 1) shows the exact integer math.
2. **Rent exemption.** An account is rent-exempt holding two years of rent: `(128 + dataLen) × 3,480 × 2` lamports. A token account (165 bytes) therefore locks up 2,039,280 lamports — every account your program creates has a SOL cost you can compute before writing code (Tool 3).
3. **Pool pricing.** AMM swaps price off the constant-product curve. Run the swap model (Tool 2) at a few sizes and watch price impact: that curve is what Raydium, Orca and every aggregator route around.
4. **Transaction fees.** Every transaction pays 5,000 lamports per signature, plus an optional priority fee: `ceil(CU limit × CU price ÷ 1,000,000)` lamports, with the price in micro-lamports per compute unit. The fee is charged on the limit you request (capped at 1,400,000 CU), not the compute you use — simulate first and set the limit close to real usage. The hub's estimator (Tool 5) works the numbers.
5. **Token decimals.** Lamports are the 9-decimal special case: every SPL mint sets its own decimals (USDC 6, many mints 9, some 0), token accounts store raw integer amounts, and the UI amount is raw ÷ 10^decimals. Never hardcode 9 for a token — read the decimals off the mint, and reject amounts finer than they allow instead of rounding them. The hub's converter (Tool 6) shows both directions exactly.

6. **Address format.** An address is 32 bytes in base58 — the alphabet omits 0, O, I and l so addresses can't be misread, and leading `1`s are leading zero bytes (the System Program is 32 zero bytes). Anything that isn't base58, or decodes to anything but exactly 32 bytes, is not an address: a paste with two stray characters tacked on decodes to 33 bytes and fails. The hub's checker (Tool 7) validates the format locally — then still compare the full address character-for-character with its source, because format says nothing about whose address it is.

7. **Staking rewards.** Rewards are paid once per epoch — 432,000 slots, about 2 days at the target slot time, so about 182.5 epochs a year. A validator's commission is a percentage of the reward, not of the stake, and rewards credited to an active stake account compound from the next epoch on. Model it before you delegate (Tool 8): at an assumed 7.3% gross annual yield, one epoch pays 0.04% of the stake before commission. The yield is an assumption, never a live quote — real yield moves with inflation, total stake and validator performance, stake takes about an epoch to activate, and unstaking takes about an epoch to cool down.

8. **Payment links (Solana Pay).** A transfer request is one URL: `solana:<recipient>?amount=…&spl-token=…&reference=…&label=…&message=…&memo=…`. The recipient is a native account — associated token accounts must not be used as the recipient, because the wallet derives the token account from the `spl-token` mint. The amount is in user units (SOL, not lamports; a token's UI amount, not raw units): 0 is valid, a missing amount means the wallet asks the payer, decimals below 1 need a leading 0, scientific notation is prohibited, and an amount finer than the asset's decimals (9 for SOL, the mint's own otherwise) is malformed. Label and message are display-only; a memo goes on-chain in an SPL Memo instruction and is public forever. Reference is the one repeatable field — wallets attach the keys to the transfer in order, which is how a merchant finds a payment afterwards. The hub's builder and inspector (Tool 9) work both directions locally: build a link, then paste it back and read what it actually says before you share or pay it.

9. **CLMM ticks (concentrated liquidity).** On Raydium CLMM and Orca Whirlpools, prices live on ticks: `price(tick) = 1.0001^tick` — one tick is one basis point, and the on-chain range is −443,636 to 443,636. A position's endpoints must be aligned to the pool's tick spacing (`tick % spacing == 0`), and it is in range — active and earning fees — only while `tickLower ≤ tickCurrent < tickUpper`; at or above the upper tick it holds only one asset and earns nothing. Price-to-tick is a floor: the largest tick whose price is at or below the price you mean. The hub's converter and range checker (Tool 10) work both directions locally; prices there are in raw token units, so a UI price also needs the two mints' decimals.

10. **Slippage tolerance.** Every swap you sign carries a bound derived from a tolerance you pick: minimum received = expected out × (1 − tolerance) for an exact-in swap, maximum input = expected in × (1 + tolerance) for an exact-out swap, both floored in exact integer math so the bound is never looser than the tolerance — an expected 4 at 0.5% protects at 3.98, never rounded back up to 4. The program aborts rather than fill past the bound. Too tight (a few bps on a volatile pair) and ordinary movement fails the swap while the fee is still paid; too loose and a bad fill — or a sandwich attack — passes. The hub's calculator (Tool 11) works both bounds; a dust quote whose minimum floors to exactly 0 is flagged there as protecting nothing, because at that precision it doesn't.

11. **The epoch schedule (warmup is real).** An epoch is 432,000 slots only after the warmup: epoch 0 holds 32 slots and each early epoch doubles (32, 64, 128, …, 262,144 for epoch 13), so the first normal epoch is 14 and it starts at slot 524,256. The correct conversion past the warmup is `epoch = 14 + (slot − 524,256) ÷ 432,000`; the textbook `slot ÷ 432,000` calls slot 524,256 "epoch 1" and stays a dozen-plus epochs behind forever. Anything keyed to epoch boundaries — staking rewards, stake activation and cooldown, leader schedules — is mis-timed by code that divides naively. The hub's converter (Tool 12) implements the runtime's EpochSchedule in both directions. And never turn slots into wall-clock time with a fixed slot duration: the target was 400 ms for years and was cut in stages during 2026, and skipped slots stretch real epochs further — for an actual timestamp use `getBlockTime` or an explorer.

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
- Payments: the [Solana Pay Link Desk](https://kshot3000.github.io/solana-pay-link-desk/) builds Solana Pay links locally, and Tool 9 on this hub builds and inspects transfer-request URLs.
- Docs: https://solana.com/docs and the Anchor book at https://www.anchor-lang.com.
