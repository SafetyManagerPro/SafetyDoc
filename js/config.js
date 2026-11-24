// Configurazione pubblica del servizio online (stesso progetto Supabase dell'app DVR).
// La chiave è "publishable": può stare nel browser. Non inserire mai chiavi segrete (service_role) qui.
export const CONFIG = {
  supabaseUrl: 'https://dlorrjlrxnaoyryiqizp.supabase.co',
  supabaseKey: 'sb_publishable_QSIFOUCru-kfEmQPYt31og_zKcghJJW',
  nomeAssistenza: 'Assistenza CNA',
  // Senza connessione l'app resta utilizzabile per questi giorni dall'ultimo controllo riuscito.
  giorniSenzaConnessione: 30
};
