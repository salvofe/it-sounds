# Base viva: musica che cresce con le carte (design)

Data: 2026-10-29 · Stato: in revisione

## Obiettivo

Mentre giochi suona una base continua nello stile del tuo genere, e ogni carta che metti sui tuoi palchi
la arricchisce di uno strato. Con la plancia vuota la base è scarna; con tre palchi pieni nel Live Show
suona come un brano completo. È il sottoprogetto "il palco che suona". Il giocatore che compone musica
è un sottoprogetto successivo.

Prototipo ascoltato e approvato come base: https://claude.ai/artifact/C5VmWHerFBkpEBWf9TwLVy (versione 2,
copia in `docs/superpowers/specs/assets/base-viva.html`). Le ricette dei generi, i pattern e la logica di
sequenza si portano da lì.

**Successo**
- La musica parte al primo clic della partita e non si interrompe tra le fasi.
- Ogni carta giocata aggiunge il suo strato all'inizio della battuta successiva; ogni carta tolta dal campo
  (ripresa in mano, spostata via, distrutta) lo toglie.
- Gli 8 generi del giocatore si riconoscono a orecchio. La prova d'ascolto la fa l'utente.
- Gli ingressi sono a tempo: niente swing che zoppica, pompa sul battere, melodia che parte da inizio frase.
- Il tasto muto spegne musica ed effetti; se l'audio non parte il gioco continua muto.

## Decisioni prese

- **Solo le tue carte** fanno musica. Le carte dell'AI non aggiungono strati; i suoi attacchi riusciti
  tolgono i tuoi, con un glitch.
- **Strati per tipo di carta**, contati su tutti e tre i tuoi palchi insieme.
- **Le fasi contano**: Arrangement e Soundcheck attutite, Live Show aperto con colpo di piatto,
  Results con finale di vittoria o sconfitta e poi solo la base.
- **Chiptune sintetizzato con Tone.js**, nessun file audio. Le ricette sono dati, così i timbri di un
  genere si possono sostituire con campioni in futuro.

## Come cresce

| Sui tuoi palchi | Strato |
|---|---|
| niente | base: tappeto sull'accordo e tick sui quarti (sempre accesa) |
| stage (palchi con stage: 1, 2, 3) | batteria: livello 1, 2, 3 (es. cassa, rullante, hi-hat; per genere) |
| artisti (somma, conta fino a 4) | basso, accordi, solista, controcanto, in quest'ordine |
| tracce (somma, conta fino a 3) | melodia; con 2 la variazione nelle battute 3-4; con 3 la seconda voce |
| hardware (somma, conta fino a 3) | energia: distorsione e pompa sul battere, livelli 1-3 |
| bonus (almeno una carta nello slot bonus) | arpeggio scintillante |

Oltre il tetto (5° artista, 4ª traccia) la musica non cambia. Scudi, esche e carte istantanee
(sponsor, pesca) non hanno strato: restano i loro effetti sonori attuali.

| Fase | Suono |
|---|---|
| ARRANGEMENT | filtro chiuso (circa 850 Hz), volume ridotto |
| SOUNDCHECK | filtro semichiuso (circa 1700 Hz) |
| LIVE SHOW | filtro aperto, colpo di piatto sul battere d'ingresso |
| RESULTS | se hai vinto il round arpeggio maggiore in salita, se hai perso (o pareggio) discesa minore; dalla battuta dopo resta solo la base |

Il nuovo round parte con i palchi vuoti, quindi la musica torna alla base da sola.

**Tempo**: tutto è sulla griglia di 16 sedicesimi per battuta, giro di 4 battute. I cambi di strati, fase
e genere entrano sulla battuta successiva; il glitch di un attacco entra sulla sedicesima successiva.
Lo swing è applicato dal sequencer a tutta la griglia (forma per ottavi o per sedicesimi), non dal
Transport. La pompa è un inviluppo sul guadagno a ogni quarto. La melodia parte dall'inizio del motivo
quando entra la prima traccia.

## Componenti

Cartella nuova `lib/music/`. Il motore delle regole (`lib/engine`) non cambia.

| File | Responsabilità |
|---|---|
| `lib/music/mix.ts` | funzione pura `mixFor(view, me): MusicMix`; nessun import di Tone |
| `lib/music/recipes.ts` | le 8 ricette (tempo, swing, tonalità, giro, pattern, timbri, motivi), dati puri |
| `lib/music/sequencer.ts` | funzione pura `notesAt(recipe, mix, step, phraseStart)` che dice cosa suona in un sedicesimo; testabile |
| `lib/music/player.ts` | il mixer Tone.js: catena master, voci per genere, Transport, applica il mix a inizio battuta, glitch, piatto, finale |
| `lib/sound.ts` | resta per gli effetti; il muto comanda anche `player` |

```ts
type MusicMix = {
  genre: string            // genere del giocatore; generi sconosciuti → 'Synthwave'
  phase: Phase
  drums: 0 | 1 | 2 | 3
  artists: 0 | 1 | 2 | 3 | 4
  tracks: 0 | 1 | 2 | 3
  energy: 0 | 1 | 2 | 3
  sparkle: boolean
  result: 'win' | 'lose' | null   // solo in RESULTS, dal vincitore dell'ultimo round
}
```

**Flusso**: dopo ogni `commit()` lo store calcola `mixFor(view, ME)` e chiama `Music.apply(mix)`. Se tra
gli eventi c'è un `attacked` dell'AI che ha distrutto tue carte, chiama anche `Music.glitch()`.
`Music.start()` parte con `Sound.unlock()` al primo clic; `Music.stop()` a fine partita (sfuma in 2 s)
e su nuova partita si riparte. Il player tiene il mix "voluto" e lo rende "vivo" sul battere.

**Volumi**: la musica sta sotto gli effetti (master musica circa −10 dB rispetto agli effetti), così i suoni
delle carte restano leggibili. Il volume esatto si tara a orecchio.

## Errori e casi limite

- Tone.js non si carica o il contesto audio non parte → `Music` resta spento in silenzio, nessun errore a
  schermo, il gioco continua.
- Scheda in background: il browser sospende l'audio; al ritorno si riprende dal punto del Transport.
- Muto attivo: il Transport continua ma il master musica è a −∞, così togliendo il muto si rientra a tempo.
- Cambio di genere solo a nuova partita; il player ricostruisce le voci sul battere.
- Ogni nota è protetta: un errore su una nota non ferma il sequencer.

## Test e verifica

- **Vitest `mixFor`**: plancia vuota → tutto 0; conteggi su tre palchi; tetti (5 artisti → 4); palco
  bloccato ignorato; slot bonus → sparkle; carte dell'AI non contano; fase e `result` dopo un round vinto,
  perso e pari; genere sconosciuto → Synthwave.
- **Vitest ricette**: tutti gli 8 generi hanno 3 parti di batteria, 4 voci, motivi A e B; ogni pattern è
  lungo 16; i passi dei motivi stanno in 0-31.
- **Vitest `notesAt`**: con `drums: 0` nessuna nota di batteria; ogni strato suona solo sopra la sua soglia;
  la melodia al passo `phraseStart` usa il primo passo del motivo; in RESULTS dalla seconda battuta solo base.
- **Board check**: l'hook `?e2e=1` espone `Music.debug()` (mix vivo); giocare una carta stage porta
  `drums` a 1 dopo al massimo una battuta.
- **Ascolto**: l'utente prova gli 8 generi nel gioco; le ricette si ritoccano su sua indicazione.

## Fuori ambito

Il giocatore che compone, la musica dell'AI, campioni di strumenti veri, volume musica separato dal muto,
animazioni legate al ritmo.
