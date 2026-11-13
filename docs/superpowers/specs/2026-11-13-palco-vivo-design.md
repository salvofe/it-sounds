# Palco vivo (design)

Data: 2026-11-13 · Stato: approvato a voce, in attesa della revisione di questo documento

## Obiettivo

Oggi ogni palco è una colonna di carte impilate e l'unica cosa che si muove è la carta che vola
dalla mano al palco. Salvo vuole che il tavolo prenda vita: **ogni carta è un personaggio o un
oggetto che entra fisicamente in scena**, il palco ha la forma della carta palco giocata, e
giocare una carta ha un effetto visibile sul campo, con un avatar che si muove.

Decisioni prese in conversazione (2026-11-13):
- **Stile:** pixel art con profondità. Niente 3D vero, niente figure a strati: resta lo stile a
  pixel del gioco, ma il palco è una scena vista di tre quarti (pavimento, fondale, luci) e i
  personaggi sono sprite animati a pochi fotogrammi, disegnati dal codice come i disegni delle
  carte di oggi (`lib/sprites.ts`).
- **Dove:** **tutti e sei i palchi** (i tuoi tre e i tre dell'AI) diventano scene vive, sempre
  visibili. Non una scena sola al centro.
- **Personalizzazione:** ogni tipo di carta (i 29 modelli di `TEMPLATES`) ha un soggetto unico,
  con il suo modo di entrare, stare e agire; il genere musicale cambia colori e vestiti. Niente
  editor del giocatore (idea tenuta per dopo).
- **Regola degli effetti:** ogni carta entra fisicamente in scena; gli attacchi sono creature o
  intrusi che corrono verso il palco avversario e colpiscono.

**Successo**
- Guardando il tavolo per cinque secondi si capisce cosa c'è su ogni palco senza leggere: quanti
  artisti, se c'è attrezzatura, se è protetto, quanto è grande.
- Ogni carta giocata, tua o dell'AI, si vede arrivare e fare qualcosa; nessun personaggio
  "compare" e basta.
- Gli attacchi si vedono partire da un lato, attraversare il tavolo e colpire la vittima giusta.
- Il gioco non aspetta mai la scena: lo stato è già aggiornato, la scena lo racconta (come oggi
  con le animazioni a tempo). Tutte le azioni della plancia restano possibili.
- Fluido a 1280×800 su un portatile normale con sei scene vive; usabile sul telefono a 390 px.
- Con "riduci movimento" niente movimento continuo: personaggi fermi in posa, cambi a dissolvenza.

## Fuori ambito

Il motore e le regole (`lib/engine`) non cambiano. Nuovi suoni. L'aspetto delle carte in mano e
nell'anteprima (restano come oggi, con lo stesso disegno 32×32: il personaggio in scena è lo
stesso soggetto, riconoscibile). Un editor dei propri artisti. Il 3D. La folla animata davanti al
palco (solo accennata, ferma).

## Cosa si vede

### La scena

Ogni zona-palco (`StageZone`) contiene una **scena**: un rettangolo 16:10 circa, in pixel a scala
intera (`image-rendering: pixelated`), con tre piani:
1. **fondale** (muro, schermo o cielo a seconda del palco), con le luci che partono dall'alto;
2. **palco**: il pavimento in prospettiva di tre quarti (le linee delle assi convergono verso il
   fondo), dove stanno i personaggi; le cose più in basso sono più vicine e si disegnano sopra;
3. **bordo del palco e prima fila**: un bordo scuro con qualche testa di pubblico, ferma.

**Forma del palco** = la carta palco giocata (`stage`):

| Carta | Scena |
|---|---|
| nessuna | palco al buio: tavolato spoglio, un faro spento; sul tuo lato la scritta "STAGE" come oggi |
| Small Stage | palchetto basso di legno, un faro, fondale a muro |
| Medium Stage | palco con due americane di luci, fondale a tenda, una cassa per lato |
| Large Stage | palco largo con torri di casse ai lati, tre fari, fondale a schermo spento |
| Festival Main | palco enorme con schermi laterali accesi, batteria di fari, bandiere; il pavimento occupa tutta la scena |

Il palco cresce davvero: più posti dove stare (gli artisti si dispongono su "segni" prefissati per
ogni taglia), e i fari in più si accendono con i brani.

**Chi sta in scena**, per ogni carta sul palco (`StageState`):

| Tipo | Soggetto | In scena |
|---|---|---|
| `artist` | il personaggio della carta (Synth Wizard al sintetizzatore, Beat Machine alla batteria, Neural Vocalist al microfono, Bass Controller al basso, The Manager in giacca con il telefono) | sul suo segno, in posa "idle" a 2-4 fotogrammi (respiro, dondolio, mano sullo strumento) |
| `track` | un disco luminoso / una nota che gira sopra il palco (Data Stream un flusso di cifre, Bit Residue frammenti, Hypnotic Loop una spirale, Megahit un disco d'oro) | fluttua in alto a sinistra; con ogni brano in più gli artisti suonano "di più" (fotogrammi più ampi) e i fari pulsano |
| `hardware` | il rack / amplificatore (Valve Pre-Amp con le valvole che brillano, Eurorack Drive con i cavi, Studio Engineer è un tecnico al banco) | a lato del palco, con una spia che pulsa |
| `defense` | Firewall: una barriera di pixel verde davanti al bordo del palco; Decoy Booth: un chiosco finto sul bordo | fissi; lo scudo scompare quando il palco perde la protezione |
| `guest` (`collab`, `viral`) | Guest Feature: un ospite sale sul palco e resta; Encore: lo stesso con le luci che restano accese; Viral Hit: un uccellino pixel che gira sopra il palco con dei cuoricini | sul segno dell'ospite |

`sponsor` e `draw` non restano sul palco: hanno solo l'effetto d'ingresso (sotto).

**Genere musicale.** Ogni personaggio ha una tavolozza "a ruoli" (pelle, vestito, accessorio,
luce): il genere del proprietario sostituisce i colori di vestito, accessorio e luce con quelli
della sua skin (`lib/skins.ts`), e la famiglia della skin cambia un accessorio (Neon: visiera
luminosa; Collezionabile: cappello; Poster: giubbotto). Così lo stesso Synth Wizard è
riconoscibile in Synthwave e in Jazz, ma vestito diverso. Le scene dell'AI usano il suo genere.

### Cosa succede quando si gioca una carta

La carta vola dalla mano al palco come oggi (volo a tempo, atterraggio sul battito); **all'atterraggio
la carta si dissolve nel suo soggetto**, che entra in scena. La coreografia, per tipo:

| Tipo | Ingresso |
|---|---|
| `stage` | il palco si monta: il tavolato scorre da sotto, le luci si accendono una a una (sul battito), i fari fanno un giro |
| `artist` | entra camminando dalla quinta (il lato del proprietario), raggiunge il suo segno, saluta e si mette in posa |
| `track` | il disco scende dall'alto, al tocco del battito gli artisti fanno un colpo di strumento e i fari lampeggiano del colore del genere |
| `hardware` | un tecnico lo porta sul palco con un carrello, lo posa e se ne va; la spia si accende |
| `defense` | Firewall: la barriera si alza dal pavimento riga per riga; Decoy: il chiosco viene calato dall'alto |
| `collab`, `viral` | l'ospite entra di corsa dalla quinta; l'uccellino plana dal cielo |
| `sponsor` | un furgoncino attraversa il bordo del palco e lascia una pioggia di monete (Hype) che vola verso il contatore |
| `draw` | resta nella mano: un nastro (Demo Tape) o un vinile (Bootleg) che gira sulla mano, come oggi la carta |

**Attacchi.** Una creatura o un intruso parte dalla quinta dell'attaccante, attraversa il tavolo
(passando sopra la fascia centrale) ed entra nel palco bersaglio:
- Malware Worm: un verme di pixel striscia fino all'attrezzatura e la divora pezzo a pezzo;
- Track Corruptor: un glitch ambulante salta sul disco, che si sgretola;
- Artist Poacher: un tipo in impermeabile afferra l'artista e lo trascina fuori dalla quinta;
- EMP Blast: una sfera che scende dall'alto ed esplode in un lampo (opacità massima 0,35): spie
  spente, disco e attrezzatura si frantumano;
- bloccato da Firewall: la creatura sbatte contro la barriera, onda sullo scudo, rimbalza via;
- bloccato da Decoy: la creatura attacca il chiosco, che si frantuma; lei se ne va soddisfatta.

Il colpo cade sul battito, come oggi. La carta distrutta si frantuma in pixel (già esiste): ora
si frantuma il soggetto in scena, non la carta. Il palco colpito trema.

**Ritorno in mano e spostamento** (↩ e ↔): il soggetto esce dalla quinta e il volo della carta
riparte da lì; sul palco di destinazione rientra con la coreografia d'ingresso abbreviata.

**Fasi e risultati** (già esistenti) continuano a valere, applicati alle scene: nel Live Show i
fari girano e gli artisti suonano a fotogrammi pieni; palco che vince la soglia: fari a
ventaglio; round perso: le scene si spengono una a una; "riduci movimento": tutto fermo.

### Le carte restano a portata di mano

Sotto ogni scena del tuo lato, una **riga di chip** (icona 16×16 del soggetto + nome breve) per le
carte sul palco: al passaggio o al focus mostra l'anteprima della carta (`CardPreview`), e tiene i
pulsanti ↩ e ↔ di oggi. Sul lato dell'AI la riga è di sola lettura (anteprima). Il punteggio, lo
scudo, i combo e i pulsanti BOOST/potenziamento restano nella testa e nel piede della zona.

### Telefono (< 760 px)

Le scene restano, più piccole (altezza minima 110 px), con i soggetti disegnati a scala 2 invece
di 3; le quinte sono il bordo della scena. Nessun movimento continuo sotto i 110 px di altezza:
i personaggi stanno in posa e si animano solo per gli ingressi e gli attacchi.

## Componenti

| Unità | Responsabilità |
|---|---|
| `lib/scene/actors.ts` | **pura**: da uno `StageState` + genere + proprietario → la lista degli attori (soggetto, segno, posa) e la taglia del palco. Testata. |
| `lib/scene/sprites/*.ts` | i fogli di sprite dei soggetti, disegnati dal codice come `lib/sprites.ts` (classe `Pix`): per ogni soggetto i fotogrammi `idle`, `walk`, `act`, più i pezzi del palco (4 taglie), le creature d'attacco, tecnico, furgone, uccellino. Tavolozza a ruoli per la ricolorazione per genere. Un test controlla che ogni modello di `TEMPLATES` abbia il suo soggetto e ogni soggetto tutti i fotogrammi richiesti. |
| `lib/scene/choreo.ts` | **pura**: da un `FxStep` (`lib/fx/queue.ts`) → la coreografia della scena: sequenza di `SceneCue` con tempi relativi all'atterraggio sul battito (cammina, posa, lampo, frantuma…). Testata. |
| `lib/scene/stage.ts` | geometria di ogni taglia di palco: dimensioni, segni per artisti/ospite/attrezzatura/disco, quinte, fari. Testata (i segni stanno dentro il palco, nessuna sovrapposizione). |
| `components/board/Scene.tsx` | un `<canvas>` per scena: disegna fondale, palco, attori e cue; registra il proprio `draw` presso lo scheduler; legge `useGameStore` (stato) e `useFx` (cue in corso). |
| `lib/scene/scheduler.ts` | un solo `requestAnimationFrame` per tutte le scene: ridisegna solo le scene "sporche" o con cue in corso; a riposo 8 fotogrammi al secondo, durante una cue 30; si ferma con la scheda nascosta. |
| `lib/scene/sheet.ts` | pre-rendering di ogni sprite ricolorato in un `OffscreenCanvas` (o canvas nascosto) una volta per genere, in cache. |
| `components/board/StageZone.tsx` | sostituisce la pila di carte con `Scene` + la riga di chip (`FieldChips`), tiene testa, piede e pulsanti. `anchor.ts` espone l'ancora della scena (per i voli) e dei chip. |
| `lib/fx/runner.ts` | i voli finiscono sull'ancora della scena; all'atterraggio chiama `Scene` per la cue d'ingresso; gli `attack` diventano una cue di "traversata" tra due scene (disegnata da `FxLayer`, che già ha il canvas sopra il tavolo) e una cue di colpo nella scena bersaglio. |

Flusso: `commit(state, events)` → stato aggiornato subito (come oggi) → `buildSteps` → per ogni
step il runner avvia il volo e, all'atterraggio, la coreografia (`choreo`) nella scena giusta.
Saltare la coda (clic/tasto) porta le scene allo stato finale senza cue. Gli attori "a riposo"
vengono sempre da `actors(StageState)`: la scena non tiene stato di gioco proprio, solo le cue in
corso.

Nessun nuovo campo nello store di gioco. Nuove dipendenze: nessuna (canvas 2D e Motion già in uso).

## Errori e casi limite

- Soggetto mancante per una carta (non dovrebbe accadere, il test lo impedisce): si disegna un
  segnaposto a forma di carta con l'icona del tipo; nessun errore in pagina.
- Ancora o canvas non disponibili (zona non montata, ridimensionamento): niente cue, la scena si
  ridisegna nello stato finale.
- Nuova azione del giocatore durante le mosse dell'AI: la coda viene saltata (come oggi), le
  scene vanno allo stato finale.
- Cambio di scheda: lo scheduler si ferma; al ritorno ridisegna tutto nello stato finale.
- Riduci movimento: nessuna posa animata, nessuna traversata; ingressi e uscite a dissolvenza
  150 ms; il lampo dell'EMP diventa un bordo rosso di 300 ms.
- Budget: con sei scene a riposo meno di 2 ms per fotogramma a 8 fps; durante una cue meno di
  6 ms. Se un disegno supera il budget per tre fotogrammi di fila, lo scheduler abbassa la scala.
- Memoria: fogli ricolorati in cache per al massimo 2 generi (tuo e AI); si svuotano a nuova partita.

## Test e verifica

- Vitest: `actors` (ogni combinazione di slot produce gli attori giusti, segni per taglia),
  `choreo` (ogni tipo di `FxStep` → cue con tempi; attacco bloccato/decoy/EMP), `stage`
  (geometria), `sprites` (copertura dei 29 modelli e dei fotogrammi), `scheduler` (ridisegna solo
  le scene sporche, si ferma nascosto).
- Board check (`scripts/board-check.mjs`, Chrome headless): giocare un artista → nella scena
  compare un attore (contatore esposto dall'hook e2e) e la carta è nei chip; un attacco dell'AI che
  distrugge → la traversata parte e l'attore sparisce; Firewall → la traversata rimbalza; skip
  durante la coda dell'AI → scene allo stato finale; riduci movimento emulato → zero cue animate;
  ritorno in mano e spostamento funzionano dai chip; tutte le 13 azioni della parità della plancia
  restano eseguibili.
- Screenshot a 1440×900, 1280×800 e 390 px: le 4 taglie di palco, un palco pieno (3 artisti,
  hardware, 3 brani, ospite, scudo) per una skin di ogni famiglia; nessuno scorrimento nuovo su
  desktop.
- Misura: fotogrammi al secondo e tempo di disegno con sei scene piene, in Edge, 1280×800.
- **Bozzetto prima del codice**: una tavola (canvas HTML) con le 4 taglie di palco e i 5 artisti in
  posa, in due generi, da approvare con Salvo prima di disegnare gli altri soggetti.

## Come procedere (tre sottoprogetti)

1. **Scene e palchi**: `stage`, `actors`, scheduler, `Scene` nelle zone con i chip; artisti e
   attrezzatura in posa fissa; le 4 taglie. Risultato: il tavolo si legge a colpo d'occhio.
2. **Coreografie**: `choreo`, ingressi per tipo, attacchi con traversata e colpo, Live Show e
   risultati sulle scene, riduci movimento, telefono.
3. **Costumi e rifiniture**: ricolorazione per genere con accessori per famiglia, pubblico in
   prima fila, luci che seguono i brani, misure di prestazione e taratura.

Ogni sottoprogetto si chiude con screenshot da far vedere a Salvo e con il check della plancia.
