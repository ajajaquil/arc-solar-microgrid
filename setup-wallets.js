require('dotenv').config();
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

async function main() {
  const walletSet = await circleClient.createWalletSet({
    name: 'Solar Micro-Grid Demo',
  });

  const walletSetId = walletSet.data?.walletSet?.id;
  console.log('Created wallet set:', walletSetId);

  const walletsResponse = await circleClient.createWallets({
    blockchains: ['ARC-TESTNET'],
    count: 2,
    walletSetId,
    accountType: 'SCA', // smart-contract account, Circle's recommended default
  });

  const wallets = walletsResponse.data?.wallets ?? [];

  wallets.forEach((wallet, i) => {
    const label = i === 0 ? 'NODE_A' : 'NODE_B';
    console.log(`\n${label}_WALLET_ID=${wallet.id}`);
    console.log(`${label}_WALLET_ADDRESS=${wallet.address}`);
  });

  console.log(
    '\nNext steps:\n' +
    '1. Copy the WALLET_ID / WALLET_ADDRESS lines above into your .env file.\n' +
    '2. Fund both wallets with testnet USDC (Arc testnet faucet, via Circle console).\n' +
    '3. Look up your USDC_TOKEN_ID for Arc Testnet in the Circle console and add it to .env.\n' +
    '4. You are ready to run solar-bridge.js.'
  );
}

main().catch((err) => console.error('Setup failed:', err.message || err));
