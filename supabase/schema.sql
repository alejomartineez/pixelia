-- =====================================================================
-- Pixelia Online — esquema de base de datos para Supabase (Postgres)
-- =====================================================================
-- Cómo usarlo: abrí tu proyecto de Supabase → SQL Editor → New query,
-- pegá TODO este archivo y tocá "Run". Se puede correr varias veces
-- (es idempotente): no borra datos.
--
-- Principios:
--  * La economía del juego vive en el cliente. El servidor solo guarda la
--    partida, el perfil público y los movimientos entre amigas (regalos,
--    intercambios, visitas, pedidos), y aplica los límites anti-abuso.
--  * RLS estricta: las tablas solo se LEEN directamente (y `saves` también
--    se escribe), siempre filtradas por dueño/amigas. Todas las altas y
--    cambios sociales pasan por funciones RPC `security definer` que
--    validan auth.uid(), la amistad y los límites diarios.
--  * Los días se cuentan con current_date del servidor (UTC en Supabase).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Perfil público (entre amigas). La fila la crea ensure_profile().
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name        text not null default 'Princesa',
  city_name   text not null default 'Pixelia',
  level       int  not null default 1,
  look        jsonb not null default '{}'::jsonb,   -- princesa
  car         jsonb not null default '{}'::jsonb,   -- auto
  city        jsonb not null default '{}'::jsonb,   -- {buildings:[{id,x,z,rot,level}], expansions, flagColor}
  stats       jsonb not null default '{}'::jsonb,   -- {pop, happy, best:{...}, week:{id, match3, blocks, parking, driving, stars}}
  updated_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

-- Partida completa en la nube (solo la dueña la ve).
create table if not exists public.saves (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null,
  rev         int  not null default 1,
  updated_at  timestamptz not null default now()
);

-- Amistades: una fila por par, siempre con a < b.
create table if not exists public.friendships (
  a            uuid not null references auth.users(id) on delete cascade,
  b            uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_by uuid not null,
  points       int  not null default 0,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (a, b),
  check (a < b)
);
-- Amistad por días (ampliación social)
alter table public.friendships add column if not exists days int not null default 0;
alter table public.friendships add column if not exists last_day date;

-- Buzón: regalos, ayudas, entregas de intercambio, likes, pedidos completados.
create table if not exists public.gifts (
  id          bigserial primary key,
  from_id     uuid not null references auth.users(id) on delete cascade,
  to_id       uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('gift', 'help', 'trade', 'sticker', 'like', 'request_fill')),
  payload     jsonb not null default '{}'::jsonb,
  ref         bigint,          -- id del intercambio / pedido relacionado
  note        text,            -- texto corto para el buzón ("Intercambio aceptado", ...)
  day         date not null default current_date,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz
);

-- Intercambios (con escrow del lado del cliente: ver DESIGN-ONLINE.md)
create table if not exists public.trades (
  id          bigserial primary key,
  from_id     uuid not null references auth.users(id) on delete cascade,
  to_id       uuid not null references auth.users(id) on delete cascade,
  offer       jsonb not null default '{}'::jsonb,
  request     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  is_sticker  boolean not null default false,
  day         date not null default current_date,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- Visitas: una fila por (anfitriona, visitante, día)
create table if not exists public.visits (
  host        uuid not null references auth.users(id) on delete cascade,
  visitor     uuid not null references auth.users(id) on delete cascade,
  day         date not null default current_date,
  visited     boolean not null default false,
  liked       boolean not null default false,
  helped      int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (host, visitor, day)
);
alter table public.visits add column if not exists note text;
do $$ begin
  alter table public.visits add constraint visits_note_len check (note is null or char_length(note) <= 80);
exception when duplicate_object then null; end $$;

-- Pedidos de ayuda ("Pedí una mano")
create table if not exists public.requests (
  id          bigserial primary key,
  from_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('item', 'coins', 'speedup', 'sticker')),
  payload     jsonb not null default '{}'::jsonb,
  qty         int not null default 1 check (qty between 1 and 99),
  filled_by   uuid references auth.users(id) on delete set null,
  filled_at   timestamptz,
  day         date not null default current_date,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours'
);

-- Meta cooperativa semanal ("Obra en Equipo")
create table if not exists public.coop (
  user_id     uuid not null references auth.users(id) on delete cascade,
  week        text not null check (week ~ '^\d{4}-W\d{2}$'),
  points      int not null default 0,
  day         date not null default current_date,
  day_points  int not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, week)
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index if not exists friendships_b_idx        on public.friendships (b);
create index if not exists friendships_req_idx      on public.friendships (requested_by) where status = 'pending';
create index if not exists gifts_inbox_idx          on public.gifts (to_id, created_at) where claimed_at is null;
create index if not exists gifts_daily_idx          on public.gifts (from_id, to_id, kind, day);
create unique index if not exists gifts_one_gift_per_day on public.gifts (from_id, to_id, day) where kind = 'gift';
create index if not exists trades_from_idx          on public.trades (from_id, status);
create index if not exists trades_to_idx            on public.trades (to_id, status);
create index if not exists visits_host_idx          on public.visits (host, updated_at desc);
create index if not exists requests_from_idx        on public.requests (from_id, created_at desc);
create index if not exists requests_open_idx        on public.requests (expires_at) where filled_by is null;
create index if not exists coop_week_idx            on public.coop (week);

-- ---------------------------------------------------------------------
-- Funciones auxiliares (internas)
-- ---------------------------------------------------------------------

-- Devuelve auth.uid() o corta con un mensaje amable si no hay sesión.
create or replace function public.require_uid() returns uuid
language plpgsql stable set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then
    raise exception 'Tenés que iniciar sesión para usar las funciones online';
  end if;
  return u;
end $$;

-- ¿a y b son amigas aceptadas? Solo responde si quien pregunta es una de las dos.
create or replace function public.is_friend(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and auth.uid() in (p_a, p_b)
     and exists (
       select 1 from public.friendships f
       where f.a = least(p_a, p_b) and f.b = greatest(p_a, p_b) and f.status = 'accepted'
     );
$$;

-- Código de amiga: 6 caracteres sin ambiguos (sin 0/O/1/I).
create or replace function public.gen_code() returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

-- Semana ISO 'YYYY-Www'
create or replace function public.iso_week(d date default current_date) returns text
language sql stable set search_path = public as $$
  select to_char(d, 'IYYY-"W"IW');
$$;

-- Bloquea la fila de amistad del par (serializa límites diarios) y exige que sea aceptada.
create or replace function public.pair_lock(p_me uuid, p_other uuid) returns public.friendships
language plpgsql security definer set search_path = public as $$
declare f public.friendships;
begin
  select * into f from public.friendships
   where a = least(p_me, p_other) and b = greatest(p_me, p_other) and status = 'accepted'
   for update;
  if not found then
    raise exception 'Solo podés hacer eso con tus amigas';
  end if;
  return f;
end $$;

-- Suma puntos de amistad y, como máximo una vez por día calendario, un día de amistad.
create or replace function public.bump_friendship(p_a uuid, p_b uuid, p_points int default 1) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.friendships
     set points   = points + greatest(coalesce(p_points, 0), 0),
         days     = days + case when last_day is distinct from current_date then 1 else 0 end,
         last_day = current_date
   where a = least(p_a, p_b) and b = greatest(p_a, p_b) and status = 'accepted';
end $$;

-- Valida un payload de recursos {coins, gems, xp, items:{id:n}, stickers:{id:n}, ...}.
-- El servidor no conoce la economía: solo controla forma, signo y tamaño.
create or replace function public.check_payload(p jsonb, p_max_bytes int default 4096) returns jsonb
language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; k2 text; v2 jsonb;
begin
  if p is null or p = 'null'::jsonb then return '{}'::jsonb; end if;
  if jsonb_typeof(p) <> 'object' then raise exception 'Los datos del regalo no son válidos'; end if;
  if octet_length(p::text) > p_max_bytes then raise exception 'Ese paquete es demasiado grande'; end if;
  for k, v in select * from jsonb_each(p) loop
    if k in ('coins', 'gems', 'xp', 'minutes', 'stars', 'uid', 'qty') then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric > 1000000000 then
        raise exception 'Los datos del regalo no son válidos (%)', k;
      end if;
    elsif k in ('items', 'stickers') then
      if jsonb_typeof(v) <> 'object' then raise exception 'Los datos del regalo no son válidos (%)', k; end if;
      for k2, v2 in select * from jsonb_each(v) loop
        if jsonb_typeof(v2) <> 'number' or (v2 #>> '{}')::numeric < 1 or (v2 #>> '{}')::numeric > 9999
           or (v2 #>> '{}')::numeric <> trunc((v2 #>> '{}')::numeric) or char_length(k2) > 40 then
          raise exception 'Los datos del regalo no son válidos (%)', k;
        end if;
      end loop;
    end if;
  end loop;
  return p;
end $$;

-- ¿Cuántos intercambios de figuritas hizo hoy esta jugadora? (propuestos + aceptados)
create or replace function public.sticker_trades_today(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.trades
   where is_sticker
     and ((from_id = p_user and day = current_date)
       or (to_id = p_user and status = 'accepted' and resolved_at::date = current_date));
$$;

-- Devuelve lo ofrecido a quien propuso (rechazo/cancelación/fin de amistad).
create or replace function public.refund_trade(p_trade public.trades, p_from uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_trade.offer is not null and p_trade.offer <> '{}'::jsonb then
    insert into public.gifts (from_id, to_id, kind, payload, ref, note)
    values (p_from, p_trade.from_id, 'trade', p_trade.offer, p_trade.id, p_note);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------

-- Crea mi perfil si no existe (con código único) y lo devuelve.
create or replace function public.ensure_profile(p_name text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_uid();
  r public.profiles;
  tries int := 0;
begin
  select * into r from public.profiles where id = me;
  if found then return to_jsonb(r); end if;
  loop
    begin
      insert into public.profiles (id, code, name)
      values (me, public.gen_code(), coalesce(nullif(left(trim(p_name), 24), ''), 'Princesa'))
      returning * into r;
      return to_jsonb(r);
    exception when unique_violation then
      -- o chocó el código (reintentamos) o otra pestaña creó el perfil a la vez
      select * into r from public.profiles where id = me;
      if found then return to_jsonb(r); end if;
      tries := tries + 1;
      if tries > 25 then raise exception 'No pudimos crear tu código de amiga, probá de nuevo'; end if;
    end;
  end loop;
end $$;

-- Alias pedido por el diseño.
create or replace function public.create_profile(p_name text default null) returns jsonb
language sql security definer set search_path = public as $$
  select public.ensure_profile(p_name);
$$;

-- Publica (actualiza) mi perfil. Acepta claves: name, cityName, level, look, car, city, stats.
create or replace function public.publish_profile(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); r public.profiles;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Perfil inválido'; end if;
  if octet_length(coalesce(p->'city', '{}')::text)  > 65536 then raise exception 'Tu ciudad es demasiado grande para publicarla'; end if;
  if octet_length(coalesce(p->'stats', '{}')::text) > 8192  then raise exception 'Estadísticas demasiado grandes'; end if;
  if octet_length(coalesce(p->'look', '{}')::text)  > 2048 or octet_length(coalesce(p->'car', '{}')::text) > 2048 then
    raise exception 'Datos de personaje demasiado grandes';
  end if;
  perform public.ensure_profile(p->>'name');
  update public.profiles set
    name       = coalesce(nullif(left(trim(p->>'name'), 24), ''), name),
    city_name  = coalesce(nullif(left(trim(p->>'cityName'), 24), ''), city_name),
    level      = case when jsonb_typeof(p->'level') = 'number'
                      then least(greatest(floor((p->>'level')::numeric)::int, 1), 999) else level end,
    look       = case when jsonb_typeof(p->'look')  = 'object' then p->'look'  else look end,
    car        = case when jsonb_typeof(p->'car')   = 'object' then p->'car'   else car end,
    city       = case when jsonb_typeof(p->'city')  = 'object' then p->'city'  else city end,
    stats      = case when jsonb_typeof(p->'stats') = 'object' then p->'stats' else stats end,
    updated_at = now(),
    last_seen  = now()
  where id = me
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.get_my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p) from public.profiles p where p.id = auth.uid();
$$;

-- Búsqueda pública por código: solo datos no sensibles.
create or replace function public.find_by_code(p_code text)
returns table (id uuid, code text, name text, level int)
language sql stable security definer set search_path = public as $$
  select p.id, p.code, p.name, p.level
    from public.profiles p
   where auth.uid() is not null
     and p.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Perfiles por ids: columnas sensibles (ciudad, look, stats...) solo para mí y mis amigas.
create or replace function public.get_profiles(p_ids uuid[])
returns table (id uuid, code text, name text, level int, city_name text, look jsonb, car jsonb,
               city jsonb, stats jsonb, last_seen timestamptz, updated_at timestamptz, friend boolean)
language sql stable security definer set search_path = public as $$
  with v as (
    select p.*, (p.id = auth.uid() or public.is_friend(auth.uid(), p.id)) as ok
      from public.profiles p
     where auth.uid() is not null
       and p.id = any (p_ids[1:100])
  )
  select v.id, v.code, v.name, v.level,
         case when v.ok then v.city_name end,
         case when v.ok then v.look end,
         case when v.ok then v.car end,
         case when v.ok then v.city end,
         case when v.ok then v.stats end,
         case when v.ok then v.last_seen end,
         case when v.ok then v.updated_at end,
         v.ok and v.id <> auth.uid()
    from v;
$$;

-- ---------------------------------------------------------------------
-- Partida en la nube
-- ---------------------------------------------------------------------
create or replace function public.pull_save() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); s public.saves;
begin
  update public.profiles set last_seen = now() where id = me;
  select * into s from public.saves where user_id = me;
  if not found then return null; end if;
  return jsonb_build_object('data', s.data, 'rev', s.rev, 'updated_at', s.updated_at);
end $$;

-- Sube la partida. p_rev = la revisión que el cliente bajó por última vez.
-- Si en la nube hay otra revisión (otro dispositivo guardó), devuelve conflict:true
-- salvo que p_force sea true (la jugadora eligió conservar la local).
create or replace function public.push_save(p_data jsonb, p_rev int default null, p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); s public.saves;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Partida inválida'; end if;
  if octet_length(p_data::text) > 1500000 then raise exception 'La partida es demasiado grande para guardarla en la nube'; end if;
  select * into s from public.saves where user_id = me for update;
  if not found then
    insert into public.saves (user_id, data, rev) values (me, p_data, 1) returning * into s;
  elsif not coalesce(p_force, false) and p_rev is distinct from s.rev then
    return jsonb_build_object('ok', false, 'conflict', true, 'rev', s.rev, 'updated_at', s.updated_at);
  else
    update public.saves set data = p_data, rev = s.rev + 1, updated_at = now()
     where user_id = me returning * into s;
  end if;
  update public.profiles set last_seen = now() where id = me;
  return jsonb_build_object('ok', true, 'rev', s.rev, 'updated_at', s.updated_at);
end $$;

-- ---------------------------------------------------------------------
-- Amigas
-- ---------------------------------------------------------------------
create or replace function public.request_friend(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_uid();
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  o public.profiles;
  f public.friendships;
begin
  if not exists (select 1 from public.profiles where id = me) then
    raise exception 'Primero creá tu perfil online';
  end if;
  if char_length(c) <> 6 then raise exception 'El código tiene 6 letras y números'; end if;
  select * into o from public.profiles where code = c;
  if not found then raise exception 'No encontramos a nadie con el código %', c; end if;
  if o.id = me then raise exception 'Ese es tu propio código 😄'; end if;

  select * into f from public.friendships
   where a = least(me, o.id) and b = greatest(me, o.id) for update;
  if found then
    if f.status = 'accepted' then raise exception 'Ya son amigas con %', o.name; end if;
    if f.requested_by = me then raise exception 'Ya le mandaste una solicitud a %, falta que acepte', o.name; end if;
    -- ella ya me había pedido amistad: se acepta directamente
    update public.friendships set status = 'accepted', accepted_at = now()
     where a = f.a and b = f.b;
    return jsonb_build_object('id', o.id, 'name', o.name, 'status', 'accepted');
  end if;

  if (select count(*) from public.friendships where requested_by = me and status = 'pending') >= 30 then
    raise exception 'Tenés muchas solicitudes sin responder. Esperá que te acepten';
  end if;
  if (select count(*) from public.friendships where me in (a, b) and status = 'accepted') >= 100 then
    raise exception 'Llegaste al máximo de 100 amigas';
  end if;
  insert into public.friendships (a, b, status, requested_by)
  values (least(me, o.id), greatest(me, o.id), 'pending', me)
  on conflict do nothing;
  return jsonb_build_object('id', o.id, 'name', o.name, 'status', 'pending');
end $$;

create or replace function public.respond_friend(p_other uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); f public.friendships;
begin
  select * into f from public.friendships
   where a = least(me, p_other) and b = greatest(me, p_other) for update;
  if not found or f.status <> 'pending' or f.requested_by = me then
    raise exception 'Esa solicitud ya no está disponible';
  end if;
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now() where a = f.a and b = f.b;
    return jsonb_build_object('status', 'accepted');
  end if;
  delete from public.friendships where a = f.a and b = f.b;
  return jsonb_build_object('status', 'declined');
end $$;

-- Borra la amistad (o la solicitud). Los intercambios pendientes entre ambas se cancelan con devolución.
create or replace function public.remove_friend(p_other uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); t public.trades;
begin
  delete from public.friendships where a = least(me, p_other) and b = greatest(me, p_other);
  if not found then raise exception 'No son amigas'; end if;
  for t in
    update public.trades set status = 'cancelled', resolved_at = now()
     where status = 'pending'
       and ((from_id = me and to_id = p_other) or (from_id = p_other and to_id = me))
    returning *
  loop
    perform public.refund_trade(t, t.to_id, 'Devolución: intercambio cancelado');
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- Lista de amigas y solicitudes con datos de perfil.
create or replace function public.friends_view()
returns table (id uuid, name text, code text, level int, city_name text, look jsonb,
               points int, days int, status text, incoming boolean, last_seen timestamptz, since timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.code, p.level,
         case when f.status = 'accepted' then p.city_name end,
         case when f.status = 'accepted' then p.look end,
         f.points, f.days, f.status,
         (f.status = 'pending' and f.requested_by <> auth.uid()),
         case when f.status = 'accepted' then p.last_seen end,
         coalesce(f.accepted_at, f.created_at)
    from public.friendships f
    join public.profiles p on p.id = case when f.a = auth.uid() then f.b else f.a end
   where auth.uid() in (f.a, f.b)
   order by (f.status = 'pending') desc, p.last_seen desc;
$$;

-- ---------------------------------------------------------------------
-- Regalos / buzón
-- ---------------------------------------------------------------------
-- kind: 'gift' (1 por amiga por día), 'help' (máx 3 por día por anfitriona),
--       'sticker' (máx 3 por amiga por día). Los demás tipos los crea el servidor.
create or replace function public.send_gift(p_to uuid, p_kind text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); pl jsonb; pts int; gid bigint;
begin
  if p_kind not in ('gift', 'help', 'sticker') then raise exception 'Ese tipo de regalo no existe'; end if;
  if p_to = me then raise exception 'No te podés mandar regalos a vos misma 😄'; end if;
  perform public.pair_lock(me, p_to);
  pl := public.check_payload(p_payload);

  if p_kind = 'gift' then
    if exists (select 1 from public.gifts where from_id = me and to_id = p_to and kind = 'gift' and day = current_date) then
      raise exception 'Ya le mandaste el regalo de hoy 🎁 ¡Volvé mañana!';
    end if;
    pts := 2;
  elsif p_kind = 'help' then
    insert into public.visits (host, visitor, day) values (p_to, me, current_date) on conflict do nothing;
    update public.visits set helped = helped + 1, updated_at = now()
     where host = p_to and visitor = me and day = current_date and helped < 3;
    if not found then raise exception 'Ya ayudaste 3 veces hoy en esta ciudad. ¡Mañana más!'; end if;
    pts := 1;
  else -- sticker
    if (select count(*) from public.gifts where from_id = me and to_id = p_to and kind = 'sticker' and day = current_date) >= 3 then
      raise exception 'Ya le regalaste 3 figuritas hoy';
    end if;
    pts := 2;
  end if;

  insert into public.gifts (from_id, to_id, kind, payload) values (me, p_to, p_kind, pl) returning id into gid;
  perform public.bump_friendship(me, p_to, pts);
  return jsonb_build_object('ok', true, 'id', gid);
end $$;

-- Mis regalos sin cobrar, con el nombre de quien los mandó.
create or replace function public.my_inbox()
returns table (id bigint, from_id uuid, from_name text, kind text, payload jsonb, ref bigint, note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.from_id, p.name, g.kind, g.payload, g.ref, g.note, g.created_at
    from public.gifts g
    left join public.profiles p on p.id = g.from_id
   where g.to_id = auth.uid() and g.claimed_at is null
   order by g.created_at
   limit 200;
$$;

-- Cobra un regalo: devuelve el payload UNA sola vez (después, null).
create or replace function public.claim_gift(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); pl jsonb;
begin
  update public.gifts set claimed_at = now()
   where id = p_id and to_id = me and claimed_at is null
  returning payload into pl;
  if not found then return null; end if;
  return coalesce(pl, '{}'::jsonb);
end $$;

-- Cobra todo el buzón de una (atómico). Devuelve [{id, kind, from_id, payload}].
create or replace function public.claim_all_gifts() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); res jsonb;
begin
  with c as (
    update public.gifts set claimed_at = now()
     where to_id = me and claimed_at is null
    returning id, kind, from_id, payload
  )
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb) into res from c;
  return res;
end $$;

-- ---------------------------------------------------------------------
-- Intercambios
-- ---------------------------------------------------------------------
create or replace function public.propose_trade(p_to uuid, p_offer jsonb, p_request jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_uid();
  f public.friendships;
  o jsonb; r jsonb;
  st boolean; os numeric; rs numeric;
  tid bigint;
begin
  if p_to = me then raise exception 'No podés intercambiar con vos misma'; end if;
  f := public.pair_lock(me, p_to);
  o := public.check_payload(p_offer);
  r := public.check_payload(p_request);
  if o = '{}'::jsonb and r = '{}'::jsonb then raise exception 'El intercambio está vacío'; end if;
  if (select count(*) from public.trades where from_id = me and status = 'pending') >= 5 then
    raise exception 'Tenés 5 intercambios esperando respuesta. Esperá a que te contesten o cancelá alguno';
  end if;

  -- Figuritas: 1 por lado, solo figuritas, estrellas parecidas.
  st := (o ? 'stickers') or (r ? 'stickers');
  if st then
    if exists (select 1 from jsonb_object_keys(o) k where k not in ('stickers', 'stars'))
       or exists (select 1 from jsonb_object_keys(r) k where k not in ('stickers', 'stars')) then
      raise exception 'En un intercambio de figuritas solo van figuritas (sin monedas ni objetos)';
    end if;
    if not (o ? 'stickers' and r ? 'stickers') then
      raise exception 'Hace falta una figurita de cada lado';
    end if;
    if (select count(*) from jsonb_each(o->'stickers')) <> 1 or (select count(*) from jsonb_each(r->'stickers')) <> 1
       or (select sum((value #>> '{}')::numeric) from jsonb_each(o->'stickers')) <> 1
       or (select sum((value #>> '{}')::numeric) from jsonb_each(r->'stickers')) <> 1 then
      raise exception 'Se intercambia de a una figurita por lado';
    end if;
    if jsonb_typeof(o->'stars') is distinct from 'number' or jsonb_typeof(r->'stars') is distinct from 'number' then
      raise exception 'Faltan las estrellas de las figuritas';
    end if;
    os := (o->>'stars')::numeric; rs := (r->>'stars')::numeric;
    if os not between 1 and 5 or rs not between 1 and 5 or os <> trunc(os) or rs <> trunc(rs) then
      raise exception 'Las estrellas van de 1 a 5';
    end if;
    if abs(os - rs) > 1 then
      raise exception 'Las figuritas tienen que tener estrellas parecidas (como mucho 1 de diferencia)';
    end if;
    if greatest(os, rs) = 5 and f.days < 14 then
      raise exception 'Las figuritas de 5 estrellas se cambian con amigas de 14 días o más';
    end if;
    if public.sticker_trades_today(me) >= 5 then
      raise exception 'Ya hiciste 5 intercambios de figuritas hoy. ¡Mañana más!';
    end if;
  end if;

  insert into public.trades (from_id, to_id, offer, request, is_sticker)
  values (me, p_to, o, r, st) returning id into tid;
  return jsonb_build_object('ok', true, 'id', tid);
end $$;

create or replace function public.list_trades()
returns table (id bigint, from_id uuid, to_id uuid, other_id uuid, other_name text, outgoing boolean,
               offer jsonb, request jsonb, status text, is_sticker boolean, created_at timestamptz, resolved_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.from_id, t.to_id,
         case when t.from_id = auth.uid() then t.to_id else t.from_id end,
         p.name, t.from_id = auth.uid(), t.offer, t.request, t.status, t.is_sticker, t.created_at, t.resolved_at
    from public.trades t
    left join public.profiles p on p.id = case when t.from_id = auth.uid() then t.to_id else t.from_id end
   where auth.uid() in (t.from_id, t.to_id)
     and (t.status = 'pending' or t.resolved_at > now() - interval '7 days')
   order by (t.status = 'pending') desc, t.created_at desc
   limit 50;
$$;

-- Aceptar/rechazar: transición atómica solo desde 'pending'.
-- Al aceptar: el cliente que acepta descuenta `request`; se crean las entregas por buzón.
create or replace function public.respond_trade(p_id bigint, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); t public.trades;
begin
  select * into t from public.trades where id = p_id and to_id = me for update;
  if not found then raise exception 'No encontramos ese intercambio'; end if;
  if t.status <> 'pending' then
    raise exception 'Ese intercambio ya no está disponible (%)',
      case t.status when 'accepted' then 'ya fue aceptado' when 'declined' then 'fue rechazado' else 'fue cancelado' end;
  end if;

  if p_accept then
    perform public.pair_lock(me, t.from_id);
    if t.is_sticker and public.sticker_trades_today(me) >= 5 then
      raise exception 'Ya hiciste 5 intercambios de figuritas hoy. ¡Mañana más!';
    end if;
    update public.trades set status = 'accepted', resolved_at = now() where id = t.id;
    if t.offer <> '{}'::jsonb then
      insert into public.gifts (from_id, to_id, kind, payload, ref, note)
      values (t.from_id, t.to_id, 'trade', t.offer, t.id, 'Intercambio aceptado');
    end if;
    if t.request <> '{}'::jsonb then
      insert into public.gifts (from_id, to_id, kind, payload, ref, note)
      values (t.to_id, t.from_id, 'trade', t.request, t.id, 'Intercambio aceptado');
    end if;
    perform public.bump_friendship(t.from_id, t.to_id, 3);
    return jsonb_build_object('ok', true, 'status', 'accepted', 'offer', t.offer, 'request', t.request);
  end if;

  update public.trades set status = 'declined', resolved_at = now() where id = t.id;
  perform public.refund_trade(t, t.to_id, 'Devolución: intercambio rechazado');
  return jsonb_build_object('ok', true, 'status', 'declined');
end $$;

create or replace function public.cancel_trade(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); t public.trades;
begin
  update public.trades set status = 'cancelled', resolved_at = now()
   where id = p_id and from_id = me and status = 'pending'
  returning * into t;
  if not found then raise exception 'Ese intercambio ya no se puede cancelar'; end if;
  perform public.refund_trade(t, t.from_id, 'Devolución: intercambio cancelado');
  return jsonb_build_object('ok', true, 'status', 'cancelled');
end $$;

-- ---------------------------------------------------------------------
-- Visitas, likes y notas
-- ---------------------------------------------------------------------
create or replace function public.visit(p_host uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); is_first boolean;
begin
  if p_host = me then raise exception 'Esa es tu ciudad 😄'; end if;
  perform public.pair_lock(me, p_host);
  insert into public.visits (host, visitor, day) values (p_host, me, current_date) on conflict do nothing;
  update public.visits set visited = true, updated_at = now()
   where host = p_host and visitor = me and day = current_date and not visited;
  is_first := found;
  if is_first then perform public.bump_friendship(me, p_host, 1); end if;
  return jsonb_build_object('first', is_first);
end $$;

create or replace function public.give_like(p_host uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid();
begin
  if p_host = me then raise exception 'No te podés dar corazón a vos misma 😄'; end if;
  perform public.pair_lock(me, p_host);
  insert into public.visits (host, visitor, day) values (p_host, me, current_date) on conflict do nothing;
  update public.visits set liked = true, updated_at = now()
   where host = p_host and visitor = me and day = current_date and not liked;
  if not found then raise exception 'Ya le diste ❤️ hoy. ¡Mañana podés de nuevo!'; end if;
  insert into public.gifts (from_id, to_id, kind, payload, note) values (me, p_host, 'like', '{}'::jsonb, '❤️');
  perform public.bump_friendship(me, p_host, 2);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.leave_note(p_host uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); t text := trim(coalesce(p_text, ''));
begin
  if p_host = me then raise exception 'Esa es tu ciudad 😄'; end if;
  if char_length(t) = 0 then raise exception 'Escribí algo cortito'; end if;
  if char_length(t) > 80 then raise exception 'La nota puede tener hasta 80 letras'; end if;
  perform public.pair_lock(me, p_host);
  insert into public.visits (host, visitor, day) values (p_host, me, current_date) on conflict do nothing;
  update public.visits set note = t, updated_at = now()
   where host = p_host and visitor = me and day = current_date and note is null;
  if not found then raise exception 'Ya le dejaste una nota hoy'; end if;
  perform public.bump_friendship(me, p_host, 1);
  return jsonb_build_object('ok', true);
end $$;

-- Quién me visitó (con likes, ayudas y notas) desde una fecha.
create or replace function public.visitors_to_me(p_since timestamptz default null)
returns table (id uuid, name text, day date, visited boolean, liked boolean, helped int, note text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.visitor, p.name, v.day, v.visited, v.liked, v.helped, v.note, v.updated_at
    from public.visits v
    left join public.profiles p on p.id = v.visitor
   where v.host = auth.uid()
     and v.updated_at >= coalesce(p_since, now() - interval '7 days')
   order by v.updated_at desc
   limit 100;
$$;

-- ---------------------------------------------------------------------
-- Pedidos de ayuda ("Pedí una mano")
-- ---------------------------------------------------------------------
create or replace function public.create_request(p_kind text, p_payload jsonb default '{}'::jsonb, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); pl jsonb; r public.requests;
begin
  if p_kind not in ('item', 'coins', 'speedup', 'sticker') then raise exception 'Ese tipo de pedido no existe'; end if;
  if p_qty is null or p_qty not between 1 and 99 then raise exception 'Cantidad inválida'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'Primero creá tu perfil online'; end if;
  pl := public.check_payload(p_payload);
  perform pg_advisory_xact_lock(hashtext('requests:' || me::text));
  if (select count(*) from public.requests where from_id = me and day = current_date) >= 3 then
    raise exception 'Ya pediste 3 manos hoy. ¡Mañana podés pedir más!';
  end if;
  insert into public.requests (from_id, kind, payload, qty) values (me, p_kind, pl, p_qty) returning * into r;
  return jsonb_build_object('ok', true, 'id', r.id, 'expires_at', r.expires_at);
end $$;

-- Pedidos abiertos (no vencidos, sin completar) de mis amigas.
create or replace function public.list_friend_requests()
returns table (id bigint, from_id uuid, from_name text, kind text, payload jsonb, qty int, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.from_id, p.name, r.kind, r.payload, r.qty, r.created_at, r.expires_at
    from public.requests r
    join public.profiles p on p.id = r.from_id
   where r.filled_by is null
     and r.expires_at > now()
     and r.from_id <> auth.uid()
     and public.is_friend(auth.uid(), r.from_id)
   order by r.expires_at
   limit 100;
$$;

-- Mis pedidos de los últimos 3 días.
create or replace function public.my_requests()
returns table (id bigint, kind text, payload jsonb, qty int, filled_by uuid, filled_by_name text,
               filled_at timestamptz, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.kind, r.payload, r.qty, r.filled_by, p.name, r.filled_at, r.created_at, r.expires_at
    from public.requests r
    left join public.profiles p on p.id = r.filled_by
   where r.from_id = auth.uid()
     and r.created_at > now() - interval '3 days'
   order by r.created_at desc;
$$;

-- Completar el pedido de una amiga (una sola vez, atómico). Le llega por buzón (kind 'request_fill').
-- Devuelve ok + el pedido para que el cliente de quien ayuda descuente y se acredite su recompensa.
create or replace function public.fill_request(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); r public.requests;
begin
  select * into r from public.requests where id = p_id for update;
  if not found then raise exception 'No encontramos ese pedido'; end if;
  if r.from_id = me then raise exception 'No podés completar tu propio pedido 😅'; end if;
  if r.filled_by is not null then raise exception 'Otra amiga ya completó ese pedido 💨'; end if;
  if r.expires_at <= now() then raise exception 'Ese pedido ya venció'; end if;
  perform public.pair_lock(me, r.from_id);
  update public.requests set filled_by = me, filled_at = now() where id = r.id;
  insert into public.gifts (from_id, to_id, kind, payload, ref, note)
  values (me, r.from_id, 'request_fill',
          r.payload || jsonb_build_object('request', jsonb_build_object('id', r.id, 'kind', r.kind, 'qty', r.qty)),
          r.id, 'Pedido completado');
  perform public.bump_friendship(me, r.from_id, 3);
  return jsonb_build_object('ok', true, 'id', r.id, 'from_id', r.from_id, 'kind', r.kind, 'payload', r.payload, 'qty', r.qty);
end $$;

-- ---------------------------------------------------------------------
-- Obra en Equipo (meta cooperativa semanal)
-- ---------------------------------------------------------------------
create or replace function public.add_coop_points(p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_uid(); wk text := public.iso_week(current_date); c public.coop; dp int; n_add int;
begin
  if p_n is null or p_n <= 0 or p_n > 100000 then raise exception 'Cantidad inválida'; end if;
  insert into public.coop (user_id, week) values (me, wk) on conflict do nothing;
  select * into c from public.coop where user_id = me and week = wk for update;
  dp := case when c.day = current_date then c.day_points else 0 end;
  n_add := greatest(0, least(p_n, 2000 - dp));   -- tope 2000 puntos por día
  update public.coop set points = points + n_add, day = current_date, day_points = dp + n_add, updated_at = now()
   where user_id = me and week = wk;
  return jsonb_build_object('week', wk, 'mine', c.points + n_add, 'added', n_add, 'capped', n_add < p_n);
end $$;

create or replace function public.coop_status(p_week text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.require_uid(); wk text := coalesce(p_week, public.iso_week(current_date)); m jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'points', x.points, 'me', x.id = me)
                            order by x.points desc, x.name), '[]'::jsonb)
    into m
    from (
      select p.id, p.name, coalesce(c.points, 0) as points
        from public.profiles p
        left join public.coop c on c.user_id = p.id and c.week = wk
       where p.id = me
          or exists (select 1 from public.friendships f
                      where f.status = 'accepted' and me in (f.a, f.b) and p.id in (f.a, f.b))
    ) x;
  return jsonb_build_object(
    'week', wk,
    'mine', coalesce((select points from public.coop where user_id = me and week = wk), 0),
    'total', coalesce((select sum((e->>'points')::int) from jsonb_array_elements(m) e), 0),
    'members', m);
end $$;

-- ---------------------------------------------------------------------
-- Ranking semanal de amigas (stats.week lo publica el cliente)
-- ---------------------------------------------------------------------
create or replace function public.friends_leaderboard(p_week text default null)
returns table (id uuid, name text, level int, week jsonb, me boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.level,
         case when p_week is null or p.stats->'week'->>'id' = p_week then p.stats->'week' end,
         p.id = auth.uid()
    from public.profiles p
   where auth.uid() is not null
     and (p.id = auth.uid()
          or exists (select 1 from public.friendships f
                      where f.status = 'accepted' and auth.uid() in (f.a, f.b) and p.id in (f.a, f.b)))
   order by p.level desc, p.name;
$$;

-- ---------------------------------------------------------------------
-- Seguridad: RLS y permisos
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.saves       enable row level security;
alter table public.friendships enable row level security;
alter table public.gifts       enable row level security;
alter table public.trades      enable row level security;
alter table public.visits      enable row level security;
alter table public.requests    enable row level security;
alter table public.coop        enable row level security;

-- Nadie escribe directo salvo su propia partida; todo lo demás va por RPC.
revoke all on table public.profiles, public.saves, public.friendships, public.gifts,
                    public.trades, public.visits, public.requests, public.coop from anon, authenticated;
grant select on table public.profiles, public.saves, public.friendships, public.gifts,
                      public.trades, public.visits, public.requests, public.coop to authenticated;
grant insert, update on table public.saves to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_friend(auth.uid(), id));

drop policy if exists saves_owner_read on public.saves;
create policy saves_owner_read on public.saves for select to authenticated using (user_id = auth.uid());
drop policy if exists saves_owner_insert on public.saves;
create policy saves_owner_insert on public.saves for insert to authenticated with check (user_id = auth.uid());
drop policy if exists saves_owner_update on public.saves;
create policy saves_owner_update on public.saves for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select to authenticated using (auth.uid() in (a, b));

drop policy if exists gifts_read on public.gifts;
create policy gifts_read on public.gifts for select to authenticated using (auth.uid() in (from_id, to_id));

drop policy if exists trades_read on public.trades;
create policy trades_read on public.trades for select to authenticated using (auth.uid() in (from_id, to_id));

drop policy if exists visits_read on public.visits;
create policy visits_read on public.visits for select to authenticated using (auth.uid() in (host, visitor));

drop policy if exists requests_read on public.requests;
create policy requests_read on public.requests for select to authenticated
  using (from_id = auth.uid() or public.is_friend(auth.uid(), from_id));

drop policy if exists coop_read on public.coop;
create policy coop_read on public.coop for select to authenticated
  using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));

-- Funciones internas: nadie de afuera las puede llamar.
revoke execute on function public.pair_lock(uuid, uuid)                 from public, anon, authenticated;
revoke execute on function public.bump_friendship(uuid, uuid, int)      from public, anon, authenticated;
revoke execute on function public.refund_trade(public.trades, uuid, text)     from public, anon, authenticated;
revoke execute on function public.sticker_trades_today(uuid)            from public, anon, authenticated;
revoke execute on function public.gen_code()                            from public, anon, authenticated;
revoke execute on function public.check_payload(jsonb, int)             from public, anon, authenticated;

-- Funciones públicas (RPC): solo usuarias con sesión.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.require_uid()',
    'public.is_friend(uuid, uuid)',
    'public.iso_week(date)',
    'public.ensure_profile(text)',
    'public.create_profile(text)',
    'public.publish_profile(jsonb)',
    'public.get_my_profile()',
    'public.find_by_code(text)',
    'public.get_profiles(uuid[])',
    'public.pull_save()',
    'public.push_save(jsonb, int, boolean)',
    'public.request_friend(text)',
    'public.respond_friend(uuid, boolean)',
    'public.remove_friend(uuid)',
    'public.friends_view()',
    'public.send_gift(uuid, text, jsonb)',
    'public.my_inbox()',
    'public.claim_gift(bigint)',
    'public.claim_all_gifts()',
    'public.propose_trade(uuid, jsonb, jsonb)',
    'public.list_trades()',
    'public.respond_trade(bigint, boolean)',
    'public.cancel_trade(bigint)',
    'public.visit(uuid)',
    'public.give_like(uuid)',
    'public.leave_note(uuid, text)',
    'public.visitors_to_me(timestamptz)',
    'public.create_request(text, jsonb, int)',
    'public.list_friend_requests()',
    'public.my_requests()',
    'public.fill_request(bigint)',
    'public.add_coop_points(int)',
    'public.coop_status(text)',
    'public.friends_leaderboard(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
