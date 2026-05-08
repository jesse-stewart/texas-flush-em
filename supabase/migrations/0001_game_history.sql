-- Game history for replay + audit.
-- Three tables:
--   games            : one row per game session (START_GAME -> game_end)
--   game_events      : every command applied, with full state_after for replay
--   game_connections : connect/disconnect log per player, with IP

create extension if not exists pgcrypto;

-- One row per game session in a room.
create table games (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  options jsonb not null,
  player_ids text[] not null,
  player_names jsonb not null,
  winner_player_id text,
  final_state jsonb
);
create index games_room_idx on games(room_id);
create index games_ended_at_idx on games(ended_at desc);

-- Every command applied through the engine, in order.
-- payload     : the GameCommand exactly as applied
-- state_after : the full GameState after applyCommand returned
-- Replay UI: select * from game_events where game_id = $1 order by seq
create table game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  seq integer not null,
  type text not null,
  player_id text,
  ip text,
  payload jsonb not null,
  state_after jsonb not null,
  created_at timestamptz not null default now(),
  unique (game_id, seq)
);
create index game_events_game_seq_idx on game_events(game_id, seq);
create index game_events_type_idx on game_events(type);

-- Per-connection audit trail. Each reconnect creates a new row.
create table game_connections (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id text not null,
  ip text,
  user_agent text,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz
);
create index game_connections_game_idx on game_connections(game_id);

-- RLS: deny by default. Only the service/secret key (used by PartyKit) can read+write.
-- Add SELECT policies later when the replay UI is built.
alter table games enable row level security;
alter table game_events enable row level security;
alter table game_connections enable row level security;
