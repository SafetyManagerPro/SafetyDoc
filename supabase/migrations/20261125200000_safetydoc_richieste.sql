-- safetyDoc · richieste delle imprese (ticket): aiuto, informazioni, modifiche e migliorie.
-- Progetto Supabase SafetyManagerPro, schema separato «safetydoc».
-- L'impresa scrive dall'app con la chiave del proprio dispositivo (vede solo le richieste della sua impresa);
-- l'amministratore risponde dalla sezione Amministratore. Niente allegati e niente indirizzi IP.

create table if not exists safetydoc.richieste (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  impresa_id uuid not null references safetydoc.imprese (id) on delete cascade,
  dispositivo_id uuid references safetydoc.dispositivi (id) on delete set null,
  tipo text not null check (tipo in ('aiuto', 'informazione', 'modifica', 'miglioria', 'errore')),
  oggetto text not null check (char_length(oggetto) between 3 and 140),
  schermata text check (char_length(schermata) <= 60),
  versione text check (char_length(versione) <= 20),
  stato text not null default 'aperta' check (stato in ('aperta', 'in_lavorazione', 'risposta', 'chiusa')),
  creata_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now(),
  letta_impresa boolean not null default true,
  letta_admin boolean not null default false
);
create index if not exists richieste_impresa on safetydoc.richieste (impresa_id, aggiornata_il desc);
create index if not exists richieste_stato on safetydoc.richieste (stato, aggiornata_il desc);

create table if not exists safetydoc.messaggi (
  id bigint generated always as identity primary key,
  richiesta_id uuid not null references safetydoc.richieste (id) on delete cascade,
  autore text not null check (autore in ('impresa', 'admin')),
  testo text not null check (char_length(testo) between 1 and 4000),
  ts timestamptz not null default now()
);
create index if not exists messaggi_richiesta on safetydoc.messaggi (richiesta_id, ts);

alter table safetydoc.richieste enable row level security;
alter table safetydoc.messaggi enable row level security;
revoke all on all tables in schema safetydoc from public, anon, authenticated;

-- Dispositivo attivo (chiave giusta, impresa non sospesa, dispositivo non bloccato): restituisce l'impresa.
create or replace function safetydoc.impresa_del_dispositivo(dispositivo uuid, chiave text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.impresa_id
  from safetydoc.dispositivi d join safetydoc.imprese m on m.id = d.impresa_id
  where d.id = dispositivo and d.chiave_hash = safetydoc.hash(chiave) and d.stato = 'attivo' and m.stato = 'attiva';
$$;
revoke all on function safetydoc.impresa_del_dispositivo(uuid, text) from public;

-- ---------- per l'impresa (chiave pubblica + chiave del dispositivo) ----------

create or replace function public.safetydoc_richieste_elenco(dispositivo uuid, chiave text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_impresa uuid := safetydoc.impresa_del_dispositivo(dispositivo, chiave);
begin
  if v_impresa is null then raise exception 'dispositivo non attivo' using errcode = 'P0001'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'numero', r.numero, 'tipo', r.tipo, 'oggetto', r.oggetto, 'stato', r.stato,
      'creata_il', r.creata_il, 'aggiornata_il', r.aggiornata_il, 'letta', r.letta_impresa,
      'messaggi', (select jsonb_agg(jsonb_build_object('autore', m.autore, 'testo', m.testo, 'ts', m.ts) order by m.ts) from safetydoc.messaggi m where m.richiesta_id = r.id)
    ) order by r.aggiornata_il desc)
    from safetydoc.richieste r where r.impresa_id = v_impresa), '[]'::jsonb);
end;
$$;

create or replace function public.safetydoc_richiesta_nuova(dispositivo uuid, chiave text, dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_impresa uuid := safetydoc.impresa_del_dispositivo(dispositivo, chiave);
  v_id uuid;
  v_numero bigint;
begin
  if v_impresa is null then raise exception 'dispositivo non attivo' using errcode = 'P0001'; end if;
  if (select count(*) from safetydoc.richieste where impresa_id = v_impresa and creata_il > now() - interval '1 day') >= 20 then
    raise exception 'troppe richieste' using errcode = 'P0001';
  end if;
  insert into safetydoc.richieste (impresa_id, dispositivo_id, tipo, oggetto, schermata, versione, letta_admin)
  values (v_impresa, dispositivo, dati ->> 'tipo', trim(dati ->> 'oggetto'), left(dati ->> 'schermata', 60), left(dati ->> 'versione', 20), false)
  returning id, numero into v_id, v_numero;
  insert into safetydoc.messaggi (richiesta_id, autore, testo) values (v_id, 'impresa', trim(dati ->> 'testo'));
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end;
$$;

-- Risposta dell'impresa (riapre la richiesta se era chiusa o con risposta) o chiusura da parte dell'impresa.
create or replace function public.safetydoc_richiesta_scrivi(dispositivo uuid, chiave text, richiesta uuid, testo text default null, chiudi boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_impresa uuid := safetydoc.impresa_del_dispositivo(dispositivo, chiave);
begin
  if v_impresa is null then raise exception 'dispositivo non attivo' using errcode = 'P0001'; end if;
  if not exists (select 1 from safetydoc.richieste where id = richiesta and impresa_id = v_impresa) then raise exception 'richiesta non trovata' using errcode = 'P0001'; end if;
  if nullif(trim(testo), '') is not null then
    if (select count(*) from safetydoc.messaggi m join safetydoc.richieste r on r.id = m.richiesta_id where r.impresa_id = v_impresa and m.autore = 'impresa' and m.ts > now() - interval '1 day') >= 100 then
      raise exception 'troppi messaggi' using errcode = 'P0001';
    end if;
    insert into safetydoc.messaggi (richiesta_id, autore, testo) values (richiesta, 'impresa', trim(testo));
    update safetydoc.richieste set stato = 'aperta', aggiornata_il = now(), letta_admin = false, letta_impresa = true where id = richiesta;
  end if;
  if chiudi then
    update safetydoc.richieste set stato = 'chiusa', aggiornata_il = now(), letta_impresa = true where id = richiesta;
  end if;
end;
$$;

-- Segna come lette le risposte dell'amministratore.
create or replace function public.safetydoc_richiesta_letta(dispositivo uuid, chiave text, richiesta uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update safetydoc.richieste set letta_impresa = true
  where id = richiesta and impresa_id = safetydoc.impresa_del_dispositivo(dispositivo, chiave);
$$;

-- La verifica giornaliera restituisce anche le risposte non lette (per l'avviso nell'app).
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
    'impresa', jsonb_build_object('id', v_m.id, 'ragione_sociale', v_m.ragione_sociale),
    'risposte_da_leggere', (select count(*) from safetydoc.richieste where impresa_id = v_m.id and not letta_impresa)
  );
end;
$$;

-- ---------- per l'amministratore ----------

create or replace function public.safetydoc_admin_richieste()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not safetydoc.e_admin() then raise exception 'non autorizzato' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'numero', r.numero, 'tipo', r.tipo, 'oggetto', r.oggetto, 'stato', r.stato, 'schermata', r.schermata,
      'versione', r.versione, 'creata_il', r.creata_il, 'aggiornata_il', r.aggiornata_il, 'letta', r.letta_admin,
      'impresa', jsonb_build_object('id', m.id, 'ragione_sociale', m.ragione_sociale, 'telefono', m.telefono, 'email', m.email, 'referente', m.referente),
      'messaggi', (select jsonb_agg(jsonb_build_object('autore', x.autore, 'testo', x.testo, 'ts', x.ts) order by x.ts) from safetydoc.messaggi x where x.richiesta_id = r.id)
    ) order by (r.stato = 'chiusa'), r.aggiornata_il desc)
    from safetydoc.richieste r join safetydoc.imprese m on m.id = r.impresa_id), '[]'::jsonb);
end;
$$;

-- Risposta e/o cambio di stato da parte dell'amministratore.
create or replace function public.safetydoc_admin_richiesta(richiesta uuid, testo text default null, stato text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not safetydoc.e_admin() then raise exception 'non autorizzato' using errcode = '42501'; end if;
  if nullif(trim(testo), '') is not null then
    insert into safetydoc.messaggi (richiesta_id, autore, testo) values (richiesta, 'admin', trim(testo));
    update safetydoc.richieste set stato = coalesce(safetydoc_admin_richiesta.stato, 'risposta'), letta_impresa = false, letta_admin = true, aggiornata_il = now() where id = richiesta;
  elsif safetydoc_admin_richiesta.stato is not null then
    update safetydoc.richieste set stato = safetydoc_admin_richiesta.stato, letta_admin = true, aggiornata_il = now() where id = richiesta;
  else
    update safetydoc.richieste set letta_admin = true where id = richiesta;
  end if;
end;
$$;

revoke all on function public.safetydoc_richieste_elenco(uuid, text) from public;
revoke all on function public.safetydoc_richiesta_nuova(uuid, text, jsonb) from public;
revoke all on function public.safetydoc_richiesta_scrivi(uuid, text, uuid, text, boolean) from public;
revoke all on function public.safetydoc_richiesta_letta(uuid, text, uuid) from public;
grant execute on function public.safetydoc_richieste_elenco(uuid, text) to anon, authenticated;
grant execute on function public.safetydoc_richiesta_nuova(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.safetydoc_richiesta_scrivi(uuid, text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.safetydoc_richiesta_letta(uuid, text, uuid) to anon, authenticated;

revoke all on function public.safetydoc_admin_richieste() from public, anon;
revoke all on function public.safetydoc_admin_richiesta(uuid, text, text) from public, anon;
grant execute on function public.safetydoc_admin_richieste() to authenticated;
grant execute on function public.safetydoc_admin_richiesta(uuid, text, text) to authenticated;
