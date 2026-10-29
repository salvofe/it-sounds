# Animazioni a tempo (design)

Data: 2026-10-29 · Stato: in revisione

## Obiettivo

It Sounds è un gioco musicale e colorato: le mosse devono divertire a vederle. Le carte volano e
atterrano, gli attacchi esplodono, il Live Show e i risultati sono una festa. I colpi visivi cadono sul
battito della musica (base viva), così vedi e senti la stessa cosa nello stesso istante.

**Successo**
- Ogni carta giocata, ripresa o spostata si vede viaggiare; nessuna carta "compare" e basta.
- Le mosse dell'AI si leggono una alla volta e si possono saltare con un clic o un tasto.
- Atterraggi, lampi e colpi d'attacco cadono sul battito quando la musica suona.
- Il gioco non aspetta mai le animazioni: lo stato è già aggiornato, le animazioni lo mostrano.
- Con "riduci movimento" del sistema non ci sono tremolii né particelle.
- Nessun calo di fluidità a 1280×800 su un portatile normale.

## Decisioni prese

- Ambiti: **carte che prendono vita**, **attacchi spettacolari**, **Live Show e risultati**. Il tavolo che
  pulsa a tempo resta fuori (in futuro).
- **Mosse dell'AI una alla volta**, circa mezzo secondo ciascuna, saltabili.
- **Colpi sul battito**: la carta parte subito, l'impatto cade sul battito successivo.
- **Motion** (`motion/react`) per i movimenti delle carte, **un solo canvas** per pixel, scintille e
  coriandoli.

## Cosa si vede

**Carte**
- Giocata: vola dalla mano al palco con un arco e una piccola rotazione; atterra sul prossimo battito
  (se mancano meno di 180 ms, su quello dopo) con schiacciamento e rimbalzo e un anello di luce del colore
  del tuo genere; la carta dello strato che entra lampeggia.
- Ripresa in mano: volo all'indietro, più breve (circa 250 ms, non legato al battito).
- Spostata: scivola tra i palchi (circa 300 ms).
- Carte dell'AI: dal suo mazzo coperto al suo campo, una alla volta, circa 500 ms l'una; dopo le carte
  vengono gli attacchi.

**Attacchi**
- Scarica pixel dalla carta d'attacco (o dal lato dell'attaccante) al palco bersaglio; l'impatto è sul
  battito.
- Colpito: la carta distrutta si frantuma in pixel dei suoi colori; il palco trema circa 300 ms; la musica
  fa il suo glitch (già esistente).
- Bloccato da scudo: onda sullo scudo, la scarica rimbalza. Esca: l'esca si frantuma.
- Vale nei due sensi (tuoi attacchi all'AI e dell'AI a te).

**Fasi e risultati**
- Ingresso nel Live Show: fari a ventaglio e un lampo breve (opacità massima 0,35, mai a tutto schermo
  bianco pieno), sul battito; il tappeto resta un po' più luminoso per tutto il Live Show.
- Round vinto: coriandoli pixel nei colori del tuo genere, circa 2 s.
- Round perso: i tuoi palchi si spengono uno a uno.
- Partita vinta: fuochi d'artificio pixel.

## Componenti

| Unità | Responsabilità |
|---|---|
| `lib/fx/queue.ts` | funzione pura: dagli eventi di una `commit` costruisce la sequenza di animazioni (`FxStep[]`) con ritardi; le mosse dell'AI in fila, le tue subito |
| `lib/fx/beat.ts` | funzione pura `landingDelay(msToBeat, beatMs, min = 180)`; senza musica restituisce una durata fissa |
| `Music.nextBeatIn()` | in `lib/music/player.ts`: ms al prossimo quarto e durata del quarto, o `null` se la musica è spenta o muta |
| `store` | stato d'interfaccia `fx: { queue, playing, skip() }`; nessun campo di gioco |
| `components/board/FxLayer.tsx` | canvas sopra la plancia per particelle, scariche, coriandoli, fuochi; rispetta riduci movimento |
| `components/board/FlyingCard.tsx` | la carta in volo (Motion) da un'ancora a un'altra |
| `components/board/anchor.ts` | già esistente: posizioni di mano, palchi e mazzi, da riusare per i voli |

**Flusso**: `commit(state, events)` aggiorna subito lo stato come oggi, poi passa gli eventi alla coda. La
coda mostra i voli nascondendo la carta di destinazione finché non atterra, così il giocatore vede la carta
viaggiare e non due copie. Saltare svuota la coda e mostra tutto nello stato finale.

## Errori e casi limite

- Ancora non trovata (elemento non montato, schermo ridimensionato): niente volo, la carta compare con una
  dissolvenza breve.
- Nuova azione del giocatore mentre la coda dell'AI gira: la coda viene saltata prima di applicare
  l'azione.
- Cambio di scheda: le animazioni in corso si chiudono subito al ritorno.
- Riduci movimento: voli sostituiti da dissolvenze di 150 ms; nessuna particella, nessun tremolio, nessun
  lampo.
- Canvas: al massimo circa 400 particelle vive; le nuove sostituiscono le più vecchie.

## Test e verifica

- Vitest `queue`: le tue carte subito; le mosse dell'AI in ordine con 500 ms tra l'una e l'altra; carte
  prima degli attacchi; `skip` svuota.
- Vitest `landingDelay`: battito lontano, vicino (salta al successivo), musica spenta.
- Board check: giocare una carta mostra `flying-card` e poi la carta sul palco; un attacco dell'AI che
  distrugge fa partire particelle (contatore esposto dall'hook e2e); con riduci movimento emulato il
  contatore resta a zero; un clic durante la coda dell'AI la salta; nessuno scorrimento nuovo a 1280×800.
- Ascolto e visione: l'utente giudica divertimento e sincronia.

## Fuori ambito

Tavolo che pulsa a tempo, nuovi suoni, animazioni di cassetto e tutorial, trascinamento delle carte.
