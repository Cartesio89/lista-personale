# Lista personale

App personale (to-do, viaggi, link utili, appunti) in HTML/JS puro, senza build.
Funziona su GitHub Pages. I dati **non** stanno in questo repo: vivono in un file `data.json`
dentro un repo **privato** separato, letto e scritto tramite l'API di GitHub con un token personale.

## Struttura
- `index.html`, `style.css`, `app.js` — l'app
- `vendor/Sortable.min.js` — drag & drop (SortableJS 1.15.6, MIT)
- `manifest.webmanifest`, `icon*.png`, `icon.svg` — installabile sulla home del telefono

## Attivare GitHub Pages
Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch `main`, cartella `/ (root)` → Save.
Dopo circa un minuto l'app è su `https://<utente>.github.io/<repo>/`.

## Collegare i dati
1. Crea un token: Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
   - Repository access: *Only select repositories* → solo il repo dati privato.
   - Permissions → Repository → **Contents: Read and write**.
2. Nell'app: Altro → Sincronizzazione → inserisci utente, repo dati, token → *Salva e sincronizza*.
3. Salva il token nel password manager: serve su ogni dispositivo e dopo aver cancellato i dati del browser.

## Come funziona il salvataggio
- Ogni modifica va subito in cache locale e, dopo ~1 secondo, viene scritta su `data.json` come commit.
- L'app rilegge i dati quando la apri, quando ci torni e ogni 90 secondi mentre è aperta e visibile (solo lettura: non crea commit se non cambia nulla).
- Se due dispositivi modificano insieme, i dati vengono uniti elemento per elemento (vince la modifica più recente).
- Lo storico dei commit del repo dati è il backup. In più: Altro → Sincronizzazione → Esporta JSON.

## Etichette e progetti
- **Progetto**: uno per attività (es. Casa Roma).
- **Etichette**: quante ne vuoi per attività. Urgente e Sogno sono fisse; le altre le crei dal dettaglio di un'attività ("+ Nuova etichetta") o da Altro → Progetti ed etichette.
- Nella lista Attività ogni etichetta e ogni progetto è un filtro (si possono combinare).

## Viaggi
- Nelle liste di un viaggio ogni voce ha uno stato (schema dell'Excel): ☆ visto · ○ non completato · ● annullato. Si cambia toccando il simbolo.
- Valutazione da 1 a 5 stelle per il viaggio, per i posti visitati e per le voci viste.

## Magic e Lego (Altro)
- **Magic**: un tab per ogni foglio dell'Excel del mazzo Jarad. Ogni cella si modifica aprendo la riga; ogni riga può avere link e note; in ogni sezione si aggiungono voci e commenti.
- Simbolo delle carte (tocco): vuoto = da prendere · ✓ posseduta · ✓* posseduta ma non più necessaria · ○ non più necessaria. Il possesso è condiviso fra tutti i tab, "non più necessaria" vale per singolo tab.
- **Recap acquisti**: ogni acquisto è una carta singola o un lotto con prezzo totale; le carte inserite risultano possedute ovunque. Totale spesa calcolato.
- **Lego**: set con flag acquistato, stato spedizione, hashtag (temi da Brickset), link e note; filtri per hashtag e totale speso.

## Pagamenti da Documenti casa
- I documenti "Da pagare" o "Addebito" dell'app Documenti casa (bollette, condominio, multe…) compaiono in Attività e in Scadenze; i pagati negli ultimi 90 giorni in Fatte.
- La spunta qui scrive lo stato "pagato" direttamente nel `data.json` di `documenti-casa-data` (solo quel documento); l'app Documenti casa lo vede alla sua prossima sincronizzazione. Vale anche al contrario.
- Nessuna copia dei documenti: la fonte è una sola. Senza rete la spunta resta in coda e viene scritta al ritorno della connessione.
- Serve che il token della lista abbia accesso anche al repo `documenti-casa-data` (Contents: read and write). Si attiva da Altro → Sincronizzazione → Documenti casa.

## Limiti noti
- "Aggiungi a Google Calendar" crea l'evento una volta; non è una sincronizzazione a due vie.
- Il drag & drop funziona nella lista "Da fare", senza ricerca attiva; l'ordine vale anche quando filtri.
