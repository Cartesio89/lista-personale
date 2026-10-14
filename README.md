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
- Se due dispositivi modificano insieme, i dati vengono uniti elemento per elemento (vince la modifica più recente).
- Lo storico dei commit del repo dati è il backup. In più: Altro → Sincronizzazione → Esporta JSON.

## Limiti noti
- "Aggiungi a Google Calendar" crea l'evento una volta; non è una sincronizzazione a due vie.
- Il drag & drop funziona nella lista "Da fare", senza ricerca attiva; l'ordine vale anche quando filtri.
