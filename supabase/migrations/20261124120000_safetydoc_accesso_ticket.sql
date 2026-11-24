-- safetyDoc v0.9 – accesso con account e ticket di assistenza.
-- Progetto Supabase condiviso con l'app DVR: stessi account (auth.users), tabelle con prefisso sd_.
-- I dati dell'impresa (adempimenti, lavoratori, macchine, allegati) NON vengono salvati qui:
-- restano sul dispositivo. Qui vanno solo account, dispositivi autorizzati e ticket.
-- Richiede le migrazioni dell'app DVR (dvr_user_profiles, dvr_admin_users, dvr_is_admin).

create extension if not exists pgcrypto;

-- ---------- profili e dispositivi ----------

create table if not exists public.sd_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','blocked','revoked')),
  max_devices integer not null default 2 check (max_devices between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.sd_user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id_hash text not null,
  device_label text,
  app_version text,
  status text not null default 'active' check (status in ('active','blocked','revoked')),
  block_reason text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_id_hash)
);

alter table public.sd_user_profiles enable row level security;
alter table public.sd_user_devices enable row level security;
revoke all on public.sd_user_profiles from public, anon, authenticated;
revoke all on public.sd_user_devices from public, anon, authenticated;

-- Operatori dell'assistenza = amministratori dell'app DVR.
create or replace function public.sd_sono_operatore()
returns boolean language sql stable security definer set search_path = public, auth
as $$ select public.dvr_is_admin(); $$;

-- Un account bloccato nell'app DVR è bloccato anche in safetyDoc.
create or replace function public.sd_stato_account(p_user uuid)
returns text language sql stable security definer set search_path = public
as $$
  select case
    when exists (select 1 from public.dvr_user_profiles d where d.user_id = p_user and d.status <> 'active')
      then (select d.status from public.dvr_user_profiles d where d.user_id = p_user)
    else coalesce((select s.status from public.sd_user_profiles s where s.user_id = p_user), 'active')
  end;
$$;

create or replace function public.sd_account_attivo()
returns boolean language sql stable security definer set search_path = public, auth
as $$ select auth.uid() is not null and public.sd_stato_account(auth.uid()) = 'active'; $$;

create or replace function public.sd_registra_dispositivo(p_device_id_hash text, p_device_label text, p_app_version text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_stato text;
  v_profilo public.sd_user_profiles%rowtype;
  v_disp public.sd_user_devices%rowtype;
  v_attivi integer;
begin
  if v_user is null then return jsonb_build_object('allowed', false, 'status', 'unauthenticated', 'message', 'Accesso richiesto.'); end if;
  if nullif(trim(p_device_id_hash), '') is null then return jsonb_build_object('allowed', false, 'status', 'blocked', 'message', 'Identificativo del dispositivo mancante.'); end if;
  insert into public.sd_user_profiles(user_id) values (v_user) on conflict (user_id) do nothing;
  select * into v_profilo from public.sd_user_profiles where user_id = v_user;
  v_stato := public.sd_stato_account(v_user);
  if v_stato <> 'active' then return jsonb_build_object('allowed', false, 'status', v_stato, 'message', 'Account non autorizzato.'); end if;

  select * into v_disp from public.sd_user_devices where user_id = v_user and device_id_hash = p_device_id_hash;
  if found then
    if v_disp.status <> 'active' then
      return jsonb_build_object('allowed', false, 'status', v_disp.status, 'message', coalesce(v_disp.block_reason, 'Dispositivo non autorizzato.'));
    end if;
    update public.sd_user_devices set last_seen_at = now(), device_label = left(coalesce(p_device_label, ''), 250), app_version = left(coalesce(p_app_version, ''), 40) where id = v_disp.id;
  else
    select count(*) into v_attivi from public.sd_user_devices where user_id = v_user and status = 'active';
    if v_attivi >= v_profilo.max_devices then
      return jsonb_build_object('allowed', false, 'status', 'device_limit', 'max_devices', v_profilo.max_devices,
        'message', 'Hai già raggiunto il numero massimo di dispositivi per questo account.');
    end if;
    insert into public.sd_user_devices(user_id, device_id_hash, device_label, app_version)
    values (v_user, p_device_id_hash, left(coalesce(p_device_label, ''), 250), left(coalesce(p_app_version, ''), 40));
  end if;
  update public.sd_user_profiles set last_login_at = now(), updated_at = now() where user_id = v_user;
  return jsonb_build_object('allowed', true, 'status', 'active', 'operatore', public.sd_sono_operatore(), 'max_devices', v_profilo.max_devices);
end;
$$;

create or replace function public.sd_controlla_dispositivo(p_device_id_hash text, p_app_version text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_stato text;
  v_disp public.sd_user_devices%rowtype;
begin
  if v_user is null then return jsonb_build_object('allowed', false, 'status', 'unauthenticated', 'message', 'Accesso richiesto.'); end if;
  v_stato := public.sd_stato_account(v_user);
  if v_stato <> 'active' then return jsonb_build_object('allowed', false, 'status', v_stato, 'message', 'Account non autorizzato.'); end if;
  select * into v_disp from public.sd_user_devices where user_id = v_user and device_id_hash = p_device_id_hash;
  if not found then return jsonb_build_object('allowed', false, 'status', 'device_not_registered', 'message', 'Questo dispositivo non è registrato.'); end if;
  if v_disp.status <> 'active' then return jsonb_build_object('allowed', false, 'status', v_disp.status, 'message', coalesce(v_disp.block_reason, 'Dispositivo non autorizzato.')); end if;
  update public.sd_user_devices set last_seen_at = now(), app_version = left(coalesce(p_app_version, ''), 40) where id = v_disp.id;
  update public.sd_user_profiles set last_login_at = now(), updated_at = now() where user_id = v_user;
  return jsonb_build_object('allowed', true, 'status', 'active', 'operatore', public.sd_sono_operatore());
end;
$$;

-- ---------- ticket di assistenza ----------

create table if not exists public.sd_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_email text,
  impresa text check (char_length(impresa) <= 200),
  contatto text check (char_length(contatto) <= 200),
  argomento text not null check (char_length(argomento) between 1 and 300),
  scheda_id text check (char_length(scheda_id) <= 80),
  contesto jsonb not null default '{}'::jsonb,
  stato text not null default 'aperto' check (stato in ('aperto','risposto','chiuso')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sd_ticket_messaggi (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.sd_tickets(id) on delete cascade,
  autore uuid not null default auth.uid() references auth.users(id) on delete cascade,
  da_operatore boolean not null default false,
  testo text not null check (char_length(testo) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists sd_tickets_user_idx on public.sd_tickets(user_id, updated_at desc);
create index if not exists sd_tickets_stato_idx on public.sd_tickets(stato, updated_at desc);
create index if not exists sd_ticket_messaggi_ticket_idx on public.sd_ticket_messaggi(ticket_id, created_at);

-- Valori che il client non può decidere: proprietario, email, stato iniziale.
create or replace function public.sd_ticket_prima_di_inserire()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  new.user_id := auth.uid();
  new.user_email := auth.jwt() ->> 'email';
  new.stato := 'aperto';
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sd_ticket_inserimento on public.sd_tickets;
create trigger trg_sd_ticket_inserimento before insert on public.sd_tickets
for each row execute function public.sd_ticket_prima_di_inserire();

-- Ogni messaggio: autore e ruolo decisi dal server; lo stato del ticket segue l'ultimo messaggio.
create or replace function public.sd_messaggio_prima_di_inserire()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  new.autore := auth.uid();
  new.da_operatore := public.sd_sono_operatore();
  new.created_at := now();
  update public.sd_tickets
     set stato = case when new.da_operatore then 'risposto' else 'aperto' end, updated_at = now()
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists trg_sd_messaggio_inserimento on public.sd_ticket_messaggi;
create trigger trg_sd_messaggio_inserimento before insert on public.sd_ticket_messaggi
for each row execute function public.sd_messaggio_prima_di_inserire();

alter table public.sd_tickets enable row level security;
alter table public.sd_ticket_messaggi enable row level security;
revoke all on public.sd_tickets from public, anon, authenticated;
revoke all on public.sd_ticket_messaggi from public, anon, authenticated;
grant select, insert on public.sd_tickets to authenticated;
grant select, insert on public.sd_ticket_messaggi to authenticated;

drop policy if exists sd_tickets_lettura on public.sd_tickets;
create policy sd_tickets_lettura on public.sd_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.sd_sono_operatore()));

drop policy if exists sd_tickets_inserimento on public.sd_tickets;
create policy sd_tickets_inserimento on public.sd_tickets for insert to authenticated
  with check ((select public.sd_account_attivo()));

drop policy if exists sd_messaggi_lettura on public.sd_ticket_messaggi;
create policy sd_messaggi_lettura on public.sd_ticket_messaggi for select to authenticated
  using (exists (select 1 from public.sd_tickets t where t.id = ticket_id
                 and (t.user_id = (select auth.uid()) or (select public.sd_sono_operatore()))));

drop policy if exists sd_messaggi_inserimento on public.sd_ticket_messaggi;
create policy sd_messaggi_inserimento on public.sd_ticket_messaggi for insert to authenticated
  with check (exists (select 1 from public.sd_tickets t where t.id = ticket_id
                      and (t.user_id = (select auth.uid()) or (select public.sd_sono_operatore()))));

-- Chiudere o riaprire un ticket: il proprietario o un operatore.
create or replace function public.sd_imposta_stato_ticket(p_ticket uuid, p_stato text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_stato not in ('aperto', 'chiuso') then raise exception 'Stato non valido'; end if;
  update public.sd_tickets set stato = p_stato, updated_at = now()
   where id = p_ticket and (user_id = auth.uid() or public.sd_sono_operatore());
  if not found then raise exception 'Ticket non trovato'; end if;
end;
$$;

-- Le funzioni interne non si chiamano dal browser; quelle per l'app solo da utenti autenticati.
revoke all on function public.sd_stato_account(uuid) from public, anon, authenticated;
revoke all on function public.sd_ticket_prima_di_inserire() from public, anon, authenticated;
revoke all on function public.sd_messaggio_prima_di_inserire() from public, anon, authenticated;
revoke all on function public.sd_sono_operatore() from public, anon;
revoke all on function public.sd_account_attivo() from public, anon;
revoke all on function public.sd_registra_dispositivo(text, text, text) from public, anon;
revoke all on function public.sd_controlla_dispositivo(text, text) from public, anon;
revoke all on function public.sd_imposta_stato_ticket(uuid, text) from public, anon;
grant execute on function public.sd_sono_operatore() to authenticated;
grant execute on function public.sd_account_attivo() to authenticated;
grant execute on function public.sd_registra_dispositivo(text, text, text) to authenticated;
grant execute on function public.sd_controlla_dispositivo(text, text) to authenticated;
grant execute on function public.sd_imposta_stato_ticket(uuid, text) to authenticated;

-- Amministrazione manuale, esempi:
-- update public.sd_user_profiles set max_devices = 3 where user_id = '<uuid>';
-- update public.sd_user_devices set status = 'revoked', block_reason = 'Dispositivo sostituito' where id = '<uuid>';
