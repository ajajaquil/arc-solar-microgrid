require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const { registerEntitySecretCiphertext } = require('@circle-fin/developer-controlled-wallets');

async function main() {
  if (!process.env.CIRCLE_API_KEY) {
    console.error(
      'CIRCLE_API_KEY not found in .env.\n' +
      'Get one from console.circle.com → API & Client Keys → Create Key,\n' +
      'add it to .env as CIRCLE_API_KEY=..., then re-run this script.'
    );
    process.exit(1);
  }

  // A 32-byte random value, hex-encoded — this IS the entity secret,
  // generated locally on your machine, never sent to Circle in this raw form.
  const entitySecret = crypto.randomBytes(32).toString('hex');

  console.log('Registering your new entity secret with Circle...');
  const response = await registerEntitySecretCiphertext({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret,
  });

  console.log('\n✅ Registered successfully.\n');
  console.log('Add this EXACT line to your .env file:');
  console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);

  if (response?.data?.recoveryFile) {
    fs.writeFileSync('circle-recovery-file.dat', response.data.recoveryFile);
    console.log(
      '\n⚠️  Circle also returned a recovery file — saved here as ' +
      'circle-recovery-file.dat.\nKeep it somewhere safe and private (never in a ' +
      'public repo/GitHub). It is the\nonly way to recover wallet access if this ' +
      'entity secret is ever lost.'
    );
  }

  console.log('\nNext: add CIRCLE_ENTITY_SECRET to .env, then run: node setup-wallets.js');
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  console.error(
    'If this says the entity secret is already registered, you likely already ' +
    'ran this before — check whether CIRCLE_ENTITY_SECRET is already saved ' +
    'somewhere from an earlier attempt instead of generating a new one.'
  );
});
