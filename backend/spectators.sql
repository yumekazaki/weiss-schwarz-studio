create table public.ws_spectators (
  room_id uuid not null references public.ws_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  primary key (room_id, user_id)
);
alter table public.ws_spectators enable row level security;
revoke all on public.ws_spectators from anon, authenticated;
grant all on public.ws_spectators to service_role;
create index ws_spectators_user on public.ws_spectators(user_id);

create function public.ws_watch(actor uuid, room_code text, room_password text)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare r public.ws_rooms; a public.ws_join_limits;
begin
  insert into public.ws_join_limits values(actor, now(), 1)
  on conflict (user_id) do update set
    attempts = case when ws_join_limits.since < now() - interval '1 minute' then 1 else ws_join_limits.attempts + 1 end,
    since = case when ws_join_limits.since < now() - interval '1 minute' then now() else ws_join_limits.since end
  returning * into a;
  if a.attempts > 8 then return jsonb_build_object('error','Too many attempts. Please wait one minute.'); end if;
  select * into r from public.ws_rooms where code = upper(room_code);
  if r.id is null or r.data->>'status' not in ('lobby','playing') then
    return jsonb_build_object('error','Room is unavailable.');
  end if;
  if r.password_hash is not null and crypt(coalesce(room_password,''), r.password_hash) <> r.password_hash then
    return jsonb_build_object('error','Incorrect room password.');
  end if;
  insert into public.ws_spectators values (r.id, actor, now() + interval '12 hours')
  on conflict (room_id,user_id) do update set expires_at = excluded.expires_at;
  return jsonb_build_object('id',r.id);
end $$;
revoke all on function public.ws_watch(uuid,text,text) from public, anon, authenticated;
grant execute on function public.ws_watch(uuid,text,text) to service_role;
