-- Arc Solar Micro-Grid — Supabase schema

create table if not exists node_readings (
  id bigint generated always as identity primary key,
  node text not null check (node in ('A', 'B')),
  state text not null check (state in ('surplus', 'deficit', 'idle')),
  solar_kw numeric,
  load_kw numeric,
  net_kw numeric,
  kwh_delta numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_node_readings_node_created
  on node_readings (node, created_at desc);

-- Every settlement attempt — both successful and failed, so you have a
-- complete audit trail, not just the happy path.
create table if not exists trades (
  id bigint generated always as identity primary key,
  from_node text not null check (from_node in ('A', 'B')),
  to_node text not null check (to_node in ('A', 'B')),
  kwh numeric not null,
  amount_usdc numeric not null,
  tx_id text,
  status text not null default 'settled' check (status in ('settled', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trades_created_at
  on trades (created_at desc);

create index if not exists idx_trades_status
  on trades (status);
