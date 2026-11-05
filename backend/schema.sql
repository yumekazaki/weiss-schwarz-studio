-- Canonical rooms are never readable by browser roles. All commands go through ws-online.
create extension if not exists pgcrypto with schema extensions;
create table public.ws_decks (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null, deck jsonb not null check (octet_length(deck::text)<100000),
 updated_at timestamptz not null default now(), primary key(user_id,id)
);
alter table public.ws_decks enable row level security;
create policy own_decks on public.ws_decks for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.ws_decks to authenticated;
revoke all on public.ws_decks from anon;
create table public.ws_rooms (
 id uuid primary key default gen_random_uuid(), code text unique not null,
 host uuid not null references auth.users(id), guest uuid references auth.users(id),
 password_hash text, version integer not null default 0,
 data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 host_seen timestamptz not null default now(), guest_seen timestamptz
);
alter table public.ws_rooms enable row level security;
revoke all on public.ws_rooms from anon,authenticated;
grant all on public.ws_rooms to service_role;
create index ws_rooms_host on public.ws_rooms(host);
create index ws_rooms_guest on public.ws_rooms(guest);
create table public.ws_join_limits (user_id uuid primary key, since timestamptz not null, attempts int not null);
alter table public.ws_join_limits enable row level security;
revoke all on public.ws_join_limits from anon,authenticated;
grant all on public.ws_join_limits to service_role;
-- Invoker function, executable only by the trusted backend; row locks protect seat reservation.
create function public.ws_join(actor uuid, room_code text, room_password text)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare r public.ws_rooms; a public.ws_join_limits;
begin
 insert into public.ws_join_limits values(actor,now(),1) on conflict(user_id) do update
 set attempts=case when ws_join_limits.since<now()-interval '1 minute' then 1 else ws_join_limits.attempts+1 end,
 since=case when ws_join_limits.since<now()-interval '1 minute' then now() else ws_join_limits.since end
 returning * into a;
 if a.attempts>8 then return jsonb_build_object('error','Too many attempts. Please wait one minute.'); end if;
 select * into r from public.ws_rooms where code=upper(room_code) for update;
 if r.id is null then return jsonb_build_object('error','Room code not found.'); end if;
 if actor=r.host or actor=r.guest then return jsonb_build_object('id',r.id); end if;
 if r.password_hash is not null and crypt(coalesce(room_password,''),r.password_hash)<>r.password_hash then
 return jsonb_build_object('error','Incorrect room password.'); end if;
 if r.guest is not null or r.data->>'status'<>'lobby' then return jsonb_build_object('error','Both seats are occupied.'); end if;
 update public.ws_rooms set guest=actor,guest_seen=now(),version=version+1,
 data=jsonb_set(r.data,'{names,1}',to_jsonb('Player 2'::text)) where id=r.id;
 return jsonb_build_object('id',r.id);
end $$;
revoke all on function public.ws_join(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ws_join(uuid,text,text) to service_role;
create function public.ws_create(actor uuid, room_code text, room_password text)
returns uuid language plpgsql security invoker set search_path=public,extensions as $$
declare rid uuid;
begin
 if (select count(*) from ws_rooms where host=actor and created_at>now()-interval '1 hour')>=10 then
 raise exception 'Room creation limit reached. Try later.'; end if;
 insert into ws_rooms(code,host,password_hash,data) values(room_code,actor,
 case when coalesce(room_password,'')='' then null else crypt(room_password,gen_salt('bf',10)) end,
 '{"status":"lobby","names":["Player 1","Player 2"],"decks":[null,null],"ready":[false,false],"receipts":[]}') returning id into rid;
 return rid;
end $$;
revoke all on function public.ws_create(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ws_create(uuid,text,text) to service_role;
