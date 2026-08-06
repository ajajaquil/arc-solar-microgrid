require('dotenv').config();
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

async function main() {
  if (!process.env.NODE_A_WALLET_ID) {
    console.error('NODE_A_WALLET_ID not found in .env — run setup-wallets.js first.');
    process.exit(1);
  }

  const response = await client.getWalletTokenBalance({ id: process.env.NODE_A_WALLET_ID });
  const balances = response.data?.tokenBalances ?? [];

  if (!balances.length) {
    console.log(
      'No token balances found yet for this wallet.\n' +
      'Did you fund it via https://faucet.circle.com/ (Arc Testnet + USDC) and wait a minute?'
    );
    return;
  }

  console.log('Token balances found on this wallet:\n');
  console.log(JSON.stringify(balances, null, 2));

  const usdcEntries = balances.filter((b) => b.token?.symbol === 'USDC');
  if (usdcEntries.length > 1) {
    console.log(
      `\n⚠️  Found ${usdcEntries.length} entries labeled USDC with different token IDs — ` +
      'this needs a closer look before picking one (see the full JSON above for ' +
      'each entry\'s "blockchain", "tokenAddress"/"isNative", or "standard" field, ' +
      'whichever fields are present).'
    );
  } else if (usdcEntries.length === 1) {
    console.log('\n✅ Add this to your .env:');
    console.log(`USDC_TOKEN_ID=${usdcEntries[0].token.id}`);
  } else {
    console.log('\nNo USDC balance found specifically — check the list above for the right symbol.');
  }
}

main().catch((err) => console.error('Failed:', err.message || err));