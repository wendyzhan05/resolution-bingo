-- Enable extensions
create extension if not exists "pgcrypto";

-- Rooms
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid not null,
  created_at timestamptz default now()
);

-- Room members
create table if not exists room_members (
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);

-- Cards
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  owner_id uuid not null,
  title text default '',
  data jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid
);

-- RLS
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table cards enable row level security;

-- Rooms policies
create policy "rooms_select" on rooms
  for select using (auth.uid() is not null);

create policy "rooms_insert" on rooms
  for insert with check (created_by = auth.uid());

-- Room members policies
create policy "members_select" on room_members
  for select using (user_id = auth.uid());

create policy "members_insert" on room_members
  for insert with check (user_id = auth.uid());

create policy "members_delete" on room_members
  for delete using (user_id = auth.uid());

-- Cards policies
create policy "cards_select" on cards
  for select using (
    room_id in (select room_id from room_members where user_id = auth.uid())
  );

create policy "cards_insert" on cards
  for insert with check (
    room_id in (select room_id from room_members where user_id = auth.uid())
    and owner_id = auth.uid()
  );

create policy "cards_update" on cards
  for update using (
    room_id in (select room_id from room_members where user_id = auth.uid())
    and owner_id = auth.uid()
  );

create policy "cards_delete" on cards
  for delete using (
    room_id in (select room_id from room_members where user_id = auth.uid())
    and owner_id = auth.uid()
  );
