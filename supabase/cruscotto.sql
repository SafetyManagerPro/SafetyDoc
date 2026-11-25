-- safetyDoc · cruscotto (sola lettura). Da salvare nel SQL Editor di Supabase (progetto SafetyManagerPro) e lanciare con Run.
select sezione, voce, valore from (
  select 1 as o, 0 as k, 'Riepilogo' as sezione, 'Dispositivi che hanno dato il consenso' as voce, installazioni_totali::text as valore from safetydoc.cruscotto_riepilogo
  union all select 2, 0, 'Riepilogo', 'Attivi negli ultimi 7 giorni', attive_7_giorni::text from safetydoc.cruscotto_riepilogo
  union all select 3, 0, 'Riepilogo', 'Attivi negli ultimi 30 giorni', attive_30_giorni::text from safetydoc.cruscotto_riepilogo
  union all select 4, 0, 'Riepilogo', 'Nuovi negli ultimi 30 giorni', nuove_30_giorni::text from safetydoc.cruscotto_riepilogo
  union all select 5, 0, 'Riepilogo', 'Con l''app installata', app_installate::text from safetydoc.cruscotto_riepilogo
  union all select 6, 0, 'Riepilogo', 'Documenti aperti negli ultimi 30 giorni', documenti_30_giorni::text from safetydoc.cruscotto_riepilogo
  union all select 10, -(giorno - date '2000-01-01'), 'Ultimi 14 giorni', to_char(giorno, 'DD/MM/YYYY'), dispositivi_attivi || ' dispositivi · ' || eventi || ' azioni' from (select * from safetydoc.cruscotto_giorni limit 14) g
  union all select 20, -volte, 'Funzioni più usate (30 giorni)', tipo || coalesce(' · ' || nome, ''), volte || ' volte · ' || dispositivi || ' dispositivi' from (select * from safetydoc.cruscotto_funzioni limit 20) f
  union all select 30, -dispositivi, 'Versioni e dispositivi', coalesce(versione, '?') || ' · ' || coalesce(piattaforma, '?'), dispositivi || ' · ultimo uso ' || to_char(ultimo_uso, 'DD/MM/YYYY') from safetydoc.cruscotto_versioni
  union all select 40, -dispositivi, 'Settori (divisione ATECO · lavoratori)', coalesce(divisione_ateco, 'non indicato') || ' · ' || coalesce(fascia_lavoratori, '?'), dispositivi::text from safetydoc.cruscotto_settori
) t
order by o, k, voce;
