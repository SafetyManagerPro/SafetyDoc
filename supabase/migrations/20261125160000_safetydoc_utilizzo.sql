-- safetyDoc · fase A: dati di utilizzo anonimi, inviati solo con il consenso dell'utente.
-- Progetto Supabase: SafetyManagerPro (ref gblcedkfnasqlnrxupzx), condiviso con l'app SafetyManagerPro.
-- Tutto sta nello schema separato «safetydoc»: le tabelle di SafetyManagerPro (schema public) non vengono toccate.
-- Lo schema «safetydoc» NON è esposto dalle API: l'app scrive solo tramite le due funzioni public.safetydoc_*,
-- che accettano dati controllati e non restituiscono nulla. Leggere i dati può solo l'amministratore
-- (dalla dashboard di Supabase: Table Editor → schema safetydoc, viste cruscotto_*).

create schema if not exists safetydoc;
revoke all on schema safetydoc from public, anon, authenticated;

-- Un record per dispositivo che ha dato il consenso. L'id è casuale, generato dall'app solo per questo scopo.
create table if not exists safetydoc.installazioni (
  id uuid primary key,
  prima_apertura timestamptz not null default now(),
  ultima_apertura timestamptz not null default now(),
  invii integer not null default 1,
  versione text check (char_length(versione) <= 20),
  piattaforma text check (piattaforma in ('android', 'ios', 'windows', 'mac', 'linux', 'altro')),
  installata boolean,
  ateco text check (ateco ~ '^[0-9]{2}$'),
  fascia_lavoratori text check (fascia_lavoratori in ('0', '1-5', '6-9', '10-15', '16-49', '50+'))
);

-- Eventi di utilizzo: solo tipo e nome della schermata o del documento, mai contenuti o nomi di persone.
create table if not exists safetydoc.eventi_uso (
  id bigint generated always as identity primary key,
  installazione_id uuid not null references safetydoc.installazioni (id) on delete cascade,
  ts timestamptz not null,
  tipo text not null check (tipo in ('apertura', 'schermata', 'documento', 'promemoria', 'backup', 'ricerca', 'firma')),
  nome text check (nome ~ '^[a-z0-9:-]{0,40}$')
);
create index if not exists eventi_uso_installazione_ts on safetydoc.eventi_uso (installazione_id, ts);
create index if not exists eventi_uso_ts on safetydoc.eventi_uso (ts);

alter table safetydoc.installazioni enable row level security;
alter table safetydoc.eventi_uso enable row level security;
revoke all on all tables in schema safetydoc from public, anon, authenticated;

-- Registra (o aggiorna) un dispositivo e i suoi eventi. Controlli: formato, massimo 100 eventi per invio,
-- massimo 1000 eventi al giorno per dispositivo, date non future e non più vecchie di 30 giorni.
-- Cancella anche gli eventi più vecchi di 12 mesi (conservazione limitata).
create or replace function public.safetydoc_registra(dati jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (dati ->> 'id')::uuid;
  v_eventi jsonb := coalesce(dati -> 'eventi', '[]'::jsonb);
  v_oggi integer;
begin
  if v_id is null then raise exception 'id mancante'; end if;
  if jsonb_typeof(v_eventi) <> 'array' or jsonb_array_length(v_eventi) > 100 then raise exception 'eventi non validi'; end if;

  insert into safetydoc.installazioni as i (id, versione, piattaforma, installata, ateco, fascia_lavoratori)
  values (v_id, dati ->> 'versione', dati ->> 'piattaforma', (dati ->> 'installata')::boolean, nullif(dati ->> 'ateco', ''), nullif(dati ->> 'fascia', ''))
  on conflict (id) do update set
    ultima_apertura = now(),
    invii = i.invii + 1,
    versione = excluded.versione,
    piattaforma = excluded.piattaforma,
    installata = excluded.installata,
    ateco = excluded.ateco,
    fascia_lavoratori = excluded.fascia_lavoratori;

  select count(*) into v_oggi from safetydoc.eventi_uso where installazione_id = v_id and ts > now() - interval '1 day';
  if v_oggi + jsonb_array_length(v_eventi) > 1000 then return; end if;

  insert into safetydoc.eventi_uso (installazione_id, ts, tipo, nome)
  select v_id, (e ->> 'ts')::timestamptz, e ->> 't', nullif(e ->> 'n', '')
  from jsonb_array_elements(v_eventi) as e
  where (e ->> 'ts')::timestamptz between now() - interval '30 days' and now() + interval '5 minutes';

  delete from safetydoc.eventi_uso where ts < now() - interval '12 months';
end;
$$;

-- Diritto alla cancellazione: chi revoca il consenso cancella tutti i dati del proprio dispositivo.
create or replace function public.safetydoc_cancella(id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from safetydoc.installazioni where installazioni.id = safetydoc_cancella.id;
$$;

revoke all on function public.safetydoc_registra(jsonb) from public;
revoke all on function public.safetydoc_cancella(uuid) from public;
grant execute on function public.safetydoc_registra(jsonb) to anon, authenticated;
grant execute on function public.safetydoc_cancella(uuid) to anon, authenticated;

-- ---------- cruscotto per l'amministratore (solo dalla dashboard) ----------

create or replace view safetydoc.cruscotto_riepilogo with (security_invoker = true) as
select
  (select count(*) from safetydoc.installazioni) as installazioni_totali,
  (select count(*) from safetydoc.installazioni where ultima_apertura > now() - interval '7 days') as attive_7_giorni,
  (select count(*) from safetydoc.installazioni where ultima_apertura > now() - interval '30 days') as attive_30_giorni,
  (select count(*) from safetydoc.installazioni where prima_apertura > now() - interval '30 days') as nuove_30_giorni,
  (select count(*) from safetydoc.installazioni where installata) as app_installate,
  (select count(*) from safetydoc.eventi_uso where tipo = 'documento' and ts > now() - interval '30 days') as documenti_30_giorni;

create or replace view safetydoc.cruscotto_versioni with (security_invoker = true) as
select versione, piattaforma, count(*) as dispositivi, max(ultima_apertura) as ultimo_uso
from safetydoc.installazioni group by versione, piattaforma order by dispositivi desc;

create or replace view safetydoc.cruscotto_settori with (security_invoker = true) as
select ateco as divisione_ateco, fascia_lavoratori, count(*) as dispositivi
from safetydoc.installazioni group by ateco, fascia_lavoratori order by dispositivi desc;

create or replace view safetydoc.cruscotto_funzioni with (security_invoker = true) as
select tipo, nome, count(*) as volte, count(distinct installazione_id) as dispositivi
from safetydoc.eventi_uso where ts > now() - interval '30 days'
group by tipo, nome order by volte desc;

create or replace view safetydoc.cruscotto_giorni with (security_invoker = true) as
select date_trunc('day', ts)::date as giorno, count(distinct installazione_id) as dispositivi_attivi, count(*) as eventi
from safetydoc.eventi_uso where ts > now() - interval '90 days'
group by 1 order by 1 desc;

revoke all on all tables in schema safetydoc from public, anon, authenticated;
