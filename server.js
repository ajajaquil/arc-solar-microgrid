require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const PRICE_PER_KWH_USDC = parseFloat(process.env.PRICE_PER_KWH_USDC || '0.15');

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

const dbEnabled = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = dbEnabled
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

if (!dbEnabled) {
  console.warn('[DB] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — running without persistence.');
}

async function safeInsert(table, row) {
  if (!dbEnabled) return;
  try {
    const { error } = await supabase.from(table).insert(row);
    if (error) console.error(`[DB] insert into ${table} failed:`, error.message);
  } catch (err) {
    console.error(`[DB] insert into ${table} threw:`, err.message || err);
  }
}

const NODE_WALLET = {
  A: { walletId: process.env.NODE_A_WALLET_ID, address: process.env.NODE_A_WALLET_ADDRESS },
  B: { walletId: process.env.NODE_B_WALLET_ID, address: process.env.NODE_B_WALLET_ADDRESS },
};

const nodeState = {
  A: { state: 'idle', solar_kw: 0, load_kw: 0, net_kw: 0, kwh_delta: 0, lastSeen: null },
  B: { state: 'idle', solar_kw: 0, load_kw: 0, net_kw: 0, kwh_delta: 0, lastSeen: null },
};

const totals = { kwhTraded: 0, usdcSettled: 0, tradeCount: 0 };
const recentTrades = []; 

const app = express();
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(payload);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'snapshot',
    nodeState,
    totals,
    recentTrades,
  }));
});

async function settleTrade(sellerId, buyerId, kwh) {
  if (kwh <= 0) return;
  const amountUsdc = (kwh * PRICE_PER_KWH_USDC).toFixed(6);
  const seller = NODE_WALLET[sellerId];
  const buyer = NODE_WALLET[buyerId];

  try {
    const response = await circleClient.createTransaction({
      walletId: buyer.walletId,
      tokenId: process.env.USDC_TOKEN_ID,
      destinationAddress: seller.address,
      amounts: [amountUsdc],
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    });

    const trade = {
      from: buyerId,
      to: sellerId,
      kwh: Number(kwh.toFixed(4)),
      amountUsdc: Number(amountUsdc),
      txId: response.data?.id ?? 'pending',
      timestamp: Date.now(),
    };

    totals.kwhTraded += trade.kwh;
    totals.usdcSettled += trade.amountUsdc;
    totals.tradeCount += 1;
    recentTrades.unshift(trade);
    if (recentTrades.length > 25) recentTrades.pop();

    console.log(`[SETTLED] ${buyerId} -> ${sellerId} | ${trade.kwh} kWh | ${trade.amountUsdc} USDC | txId=${trade.txId}`);
    broadcast({ type: 'settlement', trade, totals });

    safeInsert('trades', {
      from_node: trade.from,
      to_node: trade.to,
      kwh: trade.kwh,
      amount_usdc: trade.amountUsdc,
      tx_id: trade.txId,
      status: 'settled',
    });
  } catch (err) {
    console.error(`[SETTLEMENT FAILED] ${buyerId}->${sellerId}:`, err.message || err);
    broadcast({ type: 'settlement_error', from: buyerId, to: sellerId, error: err.message || String(err) });

    safeInsert('trades', {
      from_node: buyerId,
      to_node: sellerId,
      kwh: Number(kwh.toFixed(4)),
      amount_usdc: Number(amountUsdc),
      tx_id: null,
      status: 'failed',
      error_message: (err.message || String(err)).slice(0, 500),
    });
  }
}

function tryMatch() {
  const a = nodeState.A;
  const b = nodeState.B;

  if (a.state === 'surplus' && b.state === 'deficit') {
    settleTrade('A', 'B', Math.min(a.kwh_delta, Math.abs(b.kwh_delta)));
  } else if (b.state === 'surplus' && a.state === 'deficit') {
    settleTrade('B', 'A', Math.min(b.kwh_delta, Math.abs(a.kwh_delta)));
  }
}

app.post('/api/update', (req, res) => {
  const { node, state, solar_kw, load_kw, net_kw, kwh_delta } = req.body;

  if (node !== 'A' && node !== 'B') {
    return res.status(400).json({ error: 'node must be "A" or "B"' });
  }

  nodeState[node] = { state, solar_kw, load_kw, net_kw, kwh_delta, lastSeen: Date.now() };
  broadcast({ type: 'state', node, state, solar_kw, load_kw, net_kw, kwh_delta });
  tryMatch();

  safeInsert('node_readings', {
    node,
    state,
    solar_kw,
    load_kw,
    net_kw,
    kwh_delta,
  });

  res.json({ ok: true });
});

// Lets the dashboard (or anyone) fetch the current picture without opening a WebSocket
app.get('/api/state', (req, res) => {
  res.json({ nodeState, totals, recentTrades });
});

async function hydrateFromDatabase() {
  if (!dbEnabled) return;

  try {
    const { data: trades, error: tradesErr } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'settled')
      .order('created_at', { ascending: false })
      .limit(25);

    if (tradesErr) {
      console.error('[DB] failed to load trades:', tradesErr.message);
    } else if (trades?.length) {
      trades.forEach((row) => {
        recentTrades.push({
          from: row.from_node,
          to: row.to_node,
          kwh: Number(row.kwh),
          amountUsdc: Number(row.amount_usdc),
          txId: row.tx_id,
          timestamp: new Date(row.created_at).getTime(),
        });
      });
    }

    // totals are computed from ALL settled trades, not just the most recent 25
    const { data: sums, error: sumsErr } = await supabase
      .from('trades')
      .select('kwh, amount_usdc')
      .eq('status', 'settled');

    if (sumsErr) {
      console.error('[DB] failed to load totals:', sumsErr.message);
    } else if (sums?.length) {
      totals.kwhTraded = sums.reduce((sum, r) => sum + Number(r.kwh), 0);
      totals.usdcSettled = sums.reduce((sum, r) => sum + Number(r.amount_usdc), 0);
      totals.tradeCount = sums.length;
    }

    for (const node of ['A', 'B']) {
      const { data: latest, error: latestErr } = await supabase
        .from('node_readings')
        .select('*')
        .eq('node', node)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestErr) {
        console.error(`[DB] failed to load latest reading for ${node}:`, latestErr.message);
      } else if (latest) {
        nodeState[node] = {
          state: latest.state,
          solar_kw: Number(latest.solar_kw),
          load_kw: Number(latest.load_kw),
          net_kw: Number(latest.net_kw),
          kwh_delta: Number(latest.kwh_delta),
          lastSeen: new Date(latest.created_at).getTime(),
        };
      }
    }

    console.log(`[DB] hydrated: ${recentTrades.length} recent trades, ${totals.tradeCount} total trades`);
  } catch (err) {
    console.error('[DB] hydration failed, starting with empty state:', err.message || err);
  }
}

hydrateFromDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server + dashboard running on http://localhost:${PORT}`);
    console.log(`Price: ${PRICE_PER_KWH_USDC} USDC/kWh`);
    console.log(`Persistence: ${dbEnabled ? 'Supabase enabled' : 'in-memory only'}`);
  });
});
