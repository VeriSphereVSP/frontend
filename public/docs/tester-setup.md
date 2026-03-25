# Verisphere Tester Setup Guide

## 1. Install MetaMask

1. Go to [metamask.io](https://metamask.io) and click **Download**.
2. Install the browser extension (Chrome, Firefox, Brave, or Edge).
3. Follow the setup wizard to create a new wallet.
4. **Write down your seed phrase** and store it safely. Never share it.

## 2. Add Avalanche Fuji Testnet

1. Open MetaMask and click the network dropdown at the top (it says "Ethereum Mainnet").
2. Click **Add network** → **Add a network manually**.
3. Enter:

| Field | Value |
|-------|-------|
| Network Name | Avalanche Fuji |
| RPC URL | https://api.avax-test.network/ext/bc/C/rpc |
| Chain ID | 43113 |
| Currency Symbol | AVAX |
| Block Explorer | https://testnet.snowtrace.io |

4. Click **Save** and switch to Avalanche Fuji.

## 3. Get Test AVAX (Optional)

You don't need AVAX to use Verisphere (gas is covered), but if you want some for other testing:

1. Go to [faucet.avax.network](https://faucet.avax.network/).
2. Paste your MetaMask wallet address and request test AVAX.

## 4. Connect to Verisphere

1. Go to **https://verisphere.co** (or the test URL provided).
2. Click **Connect Wallet** in the top-right corner.
3. MetaMask will pop up — approve the connection.
4. Your wallet address and balances will appear in the header bar.

## 5. Get Test USDC

Ask the project admin to send test USDC to your wallet address. Copy your address from MetaMask (click the address at the top to copy it) and share it.

## 6. Buy VSP Tokens

1. Click **Buy @ X.XX** in the header bar.
2. Enter the amount of USDC to spend (start with 10-20 USDC).
3. MetaMask will ask you to sign a permit — approve it.
4. VSP tokens appear in your balance immediately.

## 7. Start Testing

- **Explore**: Type a topic in the search bar (e.g., "Climate Change", "Bitcoin") to see articles with stakeable claims.
- **Create a claim**: Click **+ Add claim**, type a factual assertion, set your stake, and create.
- **Stake**: Click any underlined claim to open it, then use the stake controls.
- **Portfolio**: Click **Portfolio** in the nav bar to see all your positions.
- **Claims Explorer**: Click **Claims** to see all on-chain claims with metrics.

## Troubleshooting

**MetaMask doesn't connect:** Make sure you're on the Avalanche Fuji network (check the network dropdown).

**"Claim creation failed":** Check your VSP balance — you need at least 2 VSP (1 for the posting fee + 1 for the initial stake).

**Transaction seems stuck:** Refresh the page and try again. Verisphere handles gas fees through meta-transactions, so you won't be double-charged.

**Can't see my stakes:** Check the Portfolio tab. If positions don't appear, click Refresh — the indexer may need a moment to sync.
