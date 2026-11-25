-- safetyDoc · fase B: imprese registrate, link di attivazione, dispositivi, accessi e amministrazione.
-- Progetto Supabase SafetyManagerPro, schema separato «safetydoc» (le tabelle di SafetyManagerPro non vengono toccate).
--
-- Come funziona
-- - L'amministratore crea l'impresa nella sezione Amministratore dell'app e invia il link di attivazione su WhatsApp.
-- - L'impresa apre il link, completa i dati e accetta termini e informativa: il dispositivo riceve una chiave segreta.
-- - A ogni apertura (e almeno ogni 24 ore) l'app verifica la chiave: se impresa o dispositivo sono sospesi, l'app si blocca.
-- - Indirizzi IP: NON vengono salvati (scelta del 25/11/2026).
-- - L'app (chiave pubblica «anon») può solo chiamare safetydoc_invito_info, safetydoc_attiva e safetydoc_verifica.
--   Le funzioni safetydoc_admin_* funzionano solo per gli utenti in safetydoc.amministratori (accesso con email e password).

-- ---------- tabelle ----------

create table if not exists safetydoc.amministratori (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creato_il timestamptz not null default now()
);

create table if not exists safetydoc.imprese (
  id uuid primary key default gen_random_uuid(),
  ragione_sociale text not null check (char_length(ragione_sociale) between 2 and 160),
  partita_iva text check (partita_iva ~ '^[0-9]{11}$'),
  codice_fiscale text check (char_length(codice_fiscale) <= 16),
  ateco text check (char_length(ateco) <= 12),
  comune text check (char_length(comune) <= 80),
  provincia text check (provincia ~ '^[A-Z]{2}$'),
  email text check (char_length(email) <= 160),
  telefono text check (char_length(telefono) <= 30),
  referente text check (char_length(referente) <= 120),
  note text check (char_length(note) <= 2000),
  stato text not null default 'invitata' check (stato in ('invitata', 'attiva', 'sospesa')),
  motivo_sospensione text check (char_length(motivo_sospensione) <= 500),
  sospesa_il timestamptz,
  termini_accettati_il timestamptz,
  max_dispositivi integer not null default 5 check (max_dispositivi between 1 and 50),
  creata_il timestamptz not null default now()
);

create table if not exists safetydoc.inviti (
  token text primary key,
  impresa_id uuid not null references safetydoc.imprese (id) on delete cascade,
  creato_il timestamptz not null default now(),
  revocato_il timestamptz,
  usi integer not null default 0
);
create index if not exists inviti_impresa on safetydoc.inviti (impresa_id);

create table if not exists safetydoc.dispositivi (
  id uuid primary key,
  impresa_id uuid not null references safetydoc.imprese (id) on delete cascade,
  chiave_hash text not null,
  attivato_il timestamptz not null default now(),
  ultimo_accesso timestamptz,
  versione text check (char_length(versione) <= 20),
  piattaforma text check (char_length(piattaforma) <= 20),
  installata boolean,
  stato text not null default 'attivo' check (stato in ('attivo', 'bloccato')),
  motivo_blocco text check (char_length(motivo_blocco) <= 500)
);
create index if not exists dispositivi_impresa on safetydoc.dispositivi (impresa_id);

create table if not exists safetydoc.accessi (
  id bigint generated always as identity primary key,
  dispositivo_id uuid not null references safetydoc.dispositivi (id) on delete cascade,
  impresa_id uuid not null references safetydoc.imprese (id) on delete cascade,
  ts timestamptz not null default now(),
  versione text,
  esito text not null check (esito in ('attivo', 'sospeso', 'bloccato'))
);
create index if not exists accessi_impresa_ts on safetydoc.accessi (impresa_id, ts);

alter table safetydoc.amministratori enable row level security;
alter table safetydoc.imprese enable row level security;
alter table safetydoc.inviti enable row level security;
alter table safetydoc.dispositivi enable row level security;
alter table safetydoc.accessi enable row level security;
revoke all on all tables in schema safetydoc from public, anon, authenticated;

-- amministratore: l'account albertocentrella.av@gmail.com del progetto
insert into safetydoc.amministratori (user_id)
select id from auth.users where email = 'albertocentrella.av@gmail.com'
on conflict do nothing;

-- ---------- funzioni di servizio ----------

create or replace function safetydoc.e_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from safetydoc.amministratori where user_id = (select auth.uid()));
$$;

create or replace function safetydoc.hash(testo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(testo, 'sha256'), 'hex');
$$;

create or replace function safetydoc.nuovo_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(18), 'hex');
$$;

-- ---------- funzioni per l'app (chiave pubblica) ----------

-- Nome dell'impresa collegata a un link, per mostrare «Attivazione per: …» prima della registrazione.
create or replace function public.safetydoc_invito_info(token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'valido', i.revocato_il is null and m.stato <> 'sospesa',
    'ragione_sociale', m.ragione_sociale,
    'partita_iva', m.partita_iva,
    'ateco', m.ateco,
    'comune', m.comune,
    'provincia', m.provincia,
    'email', m.email,
    'telefono', m.telefono,
    'referente', m.referente
  )
  from safetydoc.inviti i join safetydoc.imprese m on m.id = i.impresa_id
  where i.token = safetydoc_invito_info.token;
$$;

-- Attiva un dispositivo con il link: aggiorna i dati dell'impresa, registra l'accettazione dei termini
-- e restituisce una chiave segreta (salvata solo sul dispositivo; nel database ne resta l'impronta).
create or replace function public.safetydoc_attiva(token text, dispositivo uuid, dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invito safetydoc.inviti;
  v_impresa safetydoc.imprese;
  v_chiave text := encode(extensions.gen_random_bytes(32), 'hex');
  v_quanti integer;
begin
  select * into v_invito from safetydoc.inviti where inviti.token = safetydoc_attiva.token;
  if not found or v_invito.revocato_il is not null then raise exception 'link non valido' using errcode = 'P0001'; end if;
  select * into v_impresa from safetydoc.imprese where id = v_invito.impresa_id;
  if v_impresa.stato = 'sospesa' then raise exception 'impresa sospesa' using errcode = 'P0001'; end if;
  if coalesce((dati ->> 'termini')::boolean, false) is not true then raise exception 'termini non accettati' using errcode = 'P0001'; end if;

  select count(*) into v_quanti from safetydoc.dispositivi where impresa_id = v_impresa.id and stato = 'attivo' and id <> dispositivo;
  if v_quanti >= v_impresa.max_dispositivi then raise exception 'troppi dispositivi' using errcode = 'P0001'; end if;

  update safetydoc.imprese set
    ragione_sociale = coalesce(nullif(trim(dati ->> 'ragione_sociale'), ''), ragione_sociale),
    partita_iva = coalesce(nullif(regexp_replace(coalesce(dati ->> 'partita_iva', ''), '[^0-9]', '', 'g'), ''), partita_iva),
    codice_fiscale = coalesce(nullif(upper(trim(dati ->> 'codice_fiscale')), ''), codice_fiscale),
    ateco = coalesce(nullif(trim(dati ->> 'ateco'), ''), ateco),
    comune = coalesce(nullif(trim(dati ->> 'comune'), ''), comune),
    provincia = coalesce(nullif(upper(trim(dati ->> 'provincia')), ''), provincia),
    email = coalesce(nullif(trim(dati ->> 'email'), ''), email),
    telefono = coalesce(nullif(trim(dati ->> 'telefono'), ''), telefono),
    referente = coalesce(nullif(trim(dati ->> 'referente'), ''), referente),
    stato = 'attiva',
    termini_accettati_il = now()
  where id = v_impresa.id
  returning * into v_impresa;

  insert into safetydoc.dispositivi as d (id, impresa_id, chiave_hash, versione, piattaforma, installata, ultimo_accesso)
  values (dispositivo, v_impresa.id, safetydoc.hash(v_chiave), left(dati ->> 'versione', 20), left(dati ->> 'piattaforma', 20), (dati ->> 'installata')::boolean, now())
  on conflict (id) do update set impresa_id = excluded.impresa_id, chiave_hash = excluded.chiave_hash, attivato_il = now(),
    versione = excluded.versione, piattaforma = excluded.piattaforma, installata = excluded.installata, ultimo_accesso = now(),
    stato = 'attivo', motivo_blocco = null;

  update safetydoc.inviti set usi = usi + 1 where inviti.token = safetydoc_attiva.token;
  insert into safetydoc.accessi (dispositivo_id, impresa_id, versione, esito) values (dispositivo, v_impresa.id, left(dati ->> 'versione', 20), 'attivo');

  return jsonb_build_object('chiave', v_chiave, 'impresa', jsonb_build_object('id', v_impresa.id, 'ragione_sociale', v_impresa.ragione_sociale));
end;
$$;

-- Verifica a ogni apertura: stato dell'impresa e del dispositivo. Registra al massimo un accesso all'ora.
create or replace function public.safetydoc_verifica(dispositivo uuid, chiave text, info jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d safetydoc.dispositivi;
  v_m safetydoc.imprese;
  v_esito text;
begin
  select * into v_d from safetydoc.dispositivi where id = dispositivo and chiave_hash = safetydoc.hash(chiave);
  if not found then return jsonb_build_object('stato', 'sconosciuto'); end if;
  select * into v_m from safetydoc.imprese where id = v_d.impresa_id;
  v_esito := case when v_m.stato = 'sospesa' then 'sospeso' when v_d.stato = 'bloccato' then 'bloccato' else 'attivo' end;

  update safetydoc.dispositivi set ultimo_accesso = now(), versione = left(coalesce(info ->> 'versione', versione), 20),
    installata = coalesce((info ->> 'installata')::boolean, installata)
  where id = v_d.id;
  if not exists (select 1 from safetydoc.accessi where dispositivo_id = v_d.id and ts > now() - interval '1 hour') then
    insert into safetydoc.accessi (dispositivo_id, impresa_id, versione, esito) values (v_d.id, v_m.id, left(info ->> 'versione', 20), v_esito);
  end if;
  delete from safetydoc.accessi where ts < now() - interval '12 months';

  return jsonb_build_object(
    'stato', v_esito,
    'motivo', case when v_esito = 'sospeso' then v_m.motivo_sospensione when v_esito = 'bloccato' then v_d.motivo_blocco end,
    'impresa', jsonb_build_object('id', v_m.id, 'ragione_sociale', v_m.ragione_sociale)
  );
end;
$$;

-- ---------- funzioni per l'amministratore (utente autenticato in safetydoc.amministratori) ----------

create or replace function public.safetydoc_admin_elenco()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not safetydoc.e_admin() then raise exception 'non autorizzato' using errcode = '42501'; end if;
  return jsonb_build_object(
    'imprese', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'ragione_sociale', m.ragione_sociale, 'partita_iva', m.partita_iva, 'codice_fiscale', m.codice_fiscale,
        'ateco', m.ateco, 'comune', m.comune, 'provincia', m.provincia, 'email', m.email, 'telefono', m.telefono,
        'referente', m.referente, 'note', m.note, 'stato', m.stato, 'motivo_sospensione', m.motivo_sospensione,
        'sospesa_il', m.sospesa_il, 'termini_accettati_il', m.termini_accettati_il, 'creata_il', m.creata_il,
        'max_dispositivi', m.max_dispositivi,
        'ultimo_accesso', (select max(d.ultimo_accesso) from safetydoc.dispositivi d where d.impresa_id = m.id),
        'accessi_30', (select count(*) from safetydoc.accessi a where a.impresa_id = m.id and a.ts > now() - interval '30 days'),
        'invito', (select i.token from safetydoc.inviti i where i.impresa_id = m.id and i.revocato_il is null order by i.creato_il desc limit 1),
        'dispositivi', coalesce((select jsonb_agg(jsonb_build_object(
            'id', d.id, 'attivato_il', d.attivato_il, 'ultimo_accesso', d.ultimo_accesso, 'versione', d.versione,
            'piattaforma', d.piattaforma, 'installata', d.installata, 'stato', d.stato, 'motivo_blocco', d.motivo_blocco,
            'eventi_30', (select count(*) from safetydoc.eventi_uso e where e.installazione_id = d.id and e.ts > now() - interval '30 days'))
            order by d.ultimo_accesso desc nulls last) from safetydoc.dispositivi d where d.impresa_id = m.id), '[]'::jsonb),
        'funzioni', coalesce((select jsonb_agg(f) from (
            select jsonb_build_object('tipo', e.tipo, 'nome', e.nome, 'volte', count(*)) as f
            from safetydoc.eventi_uso e join safetydoc.dispositivi d on d.id = e.installazione_id
            where d.impresa_id = m.id and e.ts > now() - interval '30 days'
            group by e.tipo, e.nome order by count(*) desc limit 15) x), '[]'::jsonb)
      ) order by m.creata_il desc)
      from safetydoc.imprese m), '[]'::jsonb),
    'riepilogo', jsonb_build_object(
      'imprese', (select count(*) from safetydoc.imprese),
      'attive', (select count(*) from safetydoc.imprese where stato = 'attiva'),
      'invitate', (select count(*) from safetydoc.imprese where stato = 'invitata'),
      'sospese', (select count(*) from safetydoc.imprese where stato = 'sospesa'),
      'dispositivi', (select count(*) from safetydoc.dispositivi),
      'attivi_7', (select count(*) from safetydoc.dispositivi where ultimo_accesso > now() - interval '7 days'),
      'attivi_30', (select count(*) from safetydoc.dispositivi where ultimo_accesso > now() - interval '30 days'),
      'anonimi', (select count(*) from safetydoc.installazioni i where not exists (select 1 from safetydoc.dispositivi d where d.id = i.id))
    ),
    'funzioni', coalesce((select jsonb_agg(row_to_json(f)) from (select * from safetydoc.cruscotto_funzioni limit 30) f), '[]'::jsonb),
    'versioni', coalesce((select jsonb_agg(row_to_json(v)) from safetydoc.cruscotto_versioni v), '[]'::jsonb),
    'giorni', coalesce((select jsonb_agg(row_to_json(g)) from (select * from safetydoc.cruscotto_giorni limit 30) g), '[]'::jsonb)
  );
end;
$$;

-- Crea o modifica un'impresa (senza id: nuova impresa con link di attivazione).
create or replace function public.safetydoc_admin_salva_impresa(dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(dati ->> 'id', '')::uuid;
  v_token text;
begin
  if not safetydoc.e_admin() then raise exception 'non autorizzato' using errcode = '42501'; end if;
  if v_id is null then
    insert into safetydoc.imprese (ragione_sociale, partita_iva, ateco, comune, provincia, email, telefono, referente, note, max_dispositivi)
    values (trim(dati ->> 'ragione_sociale'), nullif(regexp_replace(coalesce(dati ->> 'partita_iva', ''), '[^0-9]', '', 'g'), ''), nullif(trim(dati ->> 'ateco'), ''),
      nullif(trim(dati ->> 'comune'), ''), nullif(upper(trim(dati ->> 'provincia')), ''), nullif(trim(dati ->> 'email'), ''), nullif(trim(dati ->> 'telefono'), ''),
      nullif(trim(dati ->> 'referente'), ''), nullif(dati ->> 'note', ''), coalesce((dati ->> 'max_dispositivi')::integer, 5))
    returning id into v_id;
    v_token := safetydoc.nuovo_token();
    insert into safetydoc.inviti (token, impresa_id) values (v_token, v_id);
  else
    update safetydoc.imprese set
      ragione_sociale = coalesce(nullif(trim(dati ->> 'ragione_sociale'), ''), ragione_sociale),
      telefono = case when dati ? 'telefono' then nullif(trim(dati ->> 'telefono'), '') else telefono end,
      email = case when dati ? 'email' then nullif(trim(dati ->> 'email'), '') else email end,
      referente = case when dati ? 'referente' then nullif(trim(dati ->> 'referente'), '') else referente end,
      note = case when dati ? 'note' then nullif(dati ->> 'note', '') else note end,
      max_dispositivi = coalesce((dati ->> 'max_dispositivi')::integer, max_dispositivi)
    where id = v_id;
  end if;
  return jsonb_build_object('id', v_id, 'invito', v_token);
end;
$$;

-- Nuovo link di attivazione (il precedente smette di funzionare; i dispositivi già attivi restano attivi).
create or replace function public.safetydoc_admin_nuovo_invito(impresa uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := safetydoc.nuovo_token();
begin
  if not safetydoc.e_admin() then raise exception 'non autorizzato' using errcode = '42501'; end if;
  update safetydoc.inviti set revocato_il = now() where impresa_id = impresa and revocato_il is null;
  insert into safetydoc.inviti (token, impresa_id) values (v_token, impresa);
  return v_token;
end;
$$;

-- Sospende o riattiva un'impresa (tutti i suoi dispositivi si bloccano alla verifica successiva).
create or replace function public.safetydoc_admin_stato_impresa(impresa uuid, sospendi boolean, motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not safetydoc.e_admin() then raise exception 'non autorizzato' using errcode = '42501'; end if;
  update safetydoc.imprese set
    stato = case when sospendi then 'sospesa' when termini_accettati_il is null then 'invitata' else 'attiva' end,
    motivo_sospensione = case when sospendi then left(motivo, 500) end,
    sospesa_il = case when sospendi then now() end
  where id = impresa;
end;
$$;

-- Blocca o sblocca un singolo dispositivo.
create or replace function public.safetydoc_admin_stato_dispositivo(dispositivo uuid, blocca boolean, motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not safetydoc.e_admin() then raise exception 'non autorizzato' using errcode = '42501'; end if;
  update safetydoc.dispositivi set stato = case when blocca then 'bloccato' else 'attivo' end, motivo_blocco = case when blocca then left(motivo, 500) end
  where id = dispositivo;
end;
$$;

-- Elimina un'impresa con dispositivi, inviti e accessi (es. dati di prova o richiesta di cancellazione).
create or replace function public.safetydoc_admin_elimina_impresa(impresa uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not safetydoc.e_admin() then raise exception 'non autorizzato' using errcode = '42501'; end if;
  delete from safetydoc.installazioni where id in (select id from safetydoc.dispositivi where impresa_id = impresa);
  delete from safetydoc.imprese where id = impresa;
end;
$$;

-- ---------- permessi ----------

revoke all on function public.safetydoc_invito_info(text) from public;
revoke all on function public.safetydoc_attiva(text, uuid, jsonb) from public;
revoke all on function public.safetydoc_verifica(uuid, text, jsonb) from public;
grant execute on function public.safetydoc_invito_info(text) to anon, authenticated;
grant execute on function public.safetydoc_attiva(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.safetydoc_verifica(uuid, text, jsonb) to anon, authenticated;

revoke all on function public.safetydoc_admin_elenco() from public, anon;
revoke all on function public.safetydoc_admin_salva_impresa(jsonb) from public, anon;
revoke all on function public.safetydoc_admin_nuovo_invito(uuid) from public, anon;
revoke all on function public.safetydoc_admin_stato_impresa(uuid, boolean, text) from public, anon;
revoke all on function public.safetydoc_admin_stato_dispositivo(uuid, boolean, text) from public, anon;
revoke all on function public.safetydoc_admin_elimina_impresa(uuid) from public, anon;
grant execute on function public.safetydoc_admin_elenco() to authenticated;
grant execute on function public.safetydoc_admin_salva_impresa(jsonb) to authenticated;
grant execute on function public.safetydoc_admin_nuovo_invito(uuid) to authenticated;
grant execute on function public.safetydoc_admin_stato_impresa(uuid, boolean, text) to authenticated;
grant execute on function public.safetydoc_admin_stato_dispositivo(uuid, boolean, text) to authenticated;
grant execute on function public.safetydoc_admin_elimina_impresa(uuid) to authenticated;

revoke all on function safetydoc.e_admin() from public;
revoke all on function safetydoc.hash(text) from public;
revoke all on function safetydoc.nuovo_token() from public;
