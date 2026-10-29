# Plancia di gioco — design

Data: 2026-10-29 · Stato: in revisione

## Obiettivo

Oggi lo schermo di gioco è una pagina a pannelli (header, barra fasi, palchi a righe di testo,
mano, palchi AI sotto, colonna laterale). Vogliamo una **plancia da gioco di carte**: un tavolo con
il tuo lato in basso e l'avversario di fronte, zone fisse, carte vere appoggiate sui palchi.
Ispirazione dal genere dei giochi di carte collezionabili (zone, mazzi, mano a ventaglio), con un
aspetto originale di It Sounds — non una copia dell'aspetto o delle regole di Magic.

È il primo di tre sottoprogetti "alla Magic": 1) plancia e carte fisiche (questo),
2) interazione nel turno, 3) deckbuilding e collezione.

**Successo**
- Su desktop (da 1280×800 in su) tutta la partita si vede in una schermata, senza scorrere.
- A colpo d'occhio sembra un tavolo da gioco di carte: due lati contrapposti, zone, mazzi, mano.
- Ogni azione possibile oggi resta possibile sulla plancia (lista di parità sotto).
- I testi rispettano le regole del giro di leggibilità: Press Start 2P solo per etichette brevi e
  mai sotto 9px; testo da leggere in VT323 da 20px.
- Su telefono (390px) è usabile, anche se impilata e con scorrimento.

## Fuori ambito

Regole e motore (nessuna modifica). Animazioni di volo/colpo. Trascinamento delle carte (resta
clic-e-gioca). Interazione nel turno e deckbuilding (sottoprogetti successivi).

## Layout (riferimento: canvas "Plancia A" + elementi di "Plancia C")

Riferimento visivo: https://claude.ai/artifact/4Xz1Vd6ELaxgZpX3nF63f7, riga "Plancia di gioco".

Dall'alto in basso:

1. **Lato AI**: a sinistra badge (genere, Hype, round vinti in Breve); al centro la mano coperta
   come dorsi di carta a ventaglio (quante carte ha); a destra mazzo e scarti come mazzetti con il
   numero.
2. **Campo AI**: tre zone-palco sul tappeto. In ogni zona le carte del palco impilate e
   leggermente sfalsate (stage per primo, poi artisti, hardware, tracce, bonus), con il punteggio
   "fan / soglia" e ✓ quando la soglia è superata; indicatore di scudo/esca. Durante un attacco le
   zone AI sono bersagli cliccabili.
3. **Fascia centrale**: round (Breve "ROUND n / 5" e pallini dei round vinti; Classica la corsa ai
   20k), le quattro fasi con quella corrente evidenziata, azioni rimaste, Hype, pulsanti di spesa
   ("+1 AZIONE", "PESCA") in Breve, mulligan e undo quando disponibili, pulsante fase successiva.
4. **Il tuo campo**: speculare. Una zona-palco è selezionabile (è il palco su cui giochi); i palchi
   bloccati mostrano "Opens in round 2"; sui palchi pieni in Breve compaiono BOOST e potenziamento.
5. **Il tuo lato**: badge, mazzo e scarti; la **mano a ventaglio** che sporge dal bordo inferiore.
   La carta sotto il puntatore si solleva e si raddrizza; quella selezionata resta sollevata e
   bordata di giallo; le carte non giocabili nella fase hanno l'etichetta della fase come oggi.

Elementi da "Plancia C": luci da palco sopra il tappeto, tappeto con bordi morbidi e ombra
interna, carte impilate sui palchi.

**Informazioni spostate dalla colonna laterale**
- **Ispettore carta** → anteprima ingrandita accanto alla carta sotto il puntatore o con focus da
  tastiera (mano e palchi).
- **Log, combo, commento AI, database carte** → un cassetto apribile dal bordo destro. L'ultima
  voce del log e il commento AI compaiono anche come notifica breve sul tavolo.

**Telefono (< 760px)**: lato AI, fascia, tuo campo e mano in colonna; mano in riga scorrevole
orizzontale; il cassetto diventa pannello a tutto schermo.

## Componenti

Cartella nuova `components/board/`. Motore (`lib/engine`) e regole non cambiano.

| Componente | Responsabilità |
|---|---|
| `Board` | griglia del tavolo, sfondo e luci; sostituisce l'impaginazione di `app/page.tsx` |
| `PlayerSide` | badge giocatore + mazzo e scarti; usato per te e per l'AI (prop `who`) |
| `OpponentHand` | dorsi delle carte dell'AI, quanti ne ha in mano |
| `StageZone` | un palco: pila di carte, punteggio, scudo/esca, selezione, bersaglio d'attacco, pulsanti BOOST/potenziamento (solo tuo lato, Breve) |
| `HandFan` | mano a ventaglio, sollevamento al passaggio, selezione, scarto |
| `CenterBand` | round/fasi/azioni/Hype, spese Hype, mulligan, undo, fase successiva |
| `Drawer` | cassetto con log, combo, commento AI, database carte (riusa parti di `SidePanel`) |
| `CardPreview` | anteprima ingrandita della carta sotto puntatore/focus |
| `Card` | **una sola carta** con prop `size: 'hand' \| 'field' \| 'preview'`; nasce da `CardComponent`, stessa skin (`lib/skins.ts`) e stesso schema di informazioni |

Le carte sul campo usano la skin del proprietario (tua o dell'AI). Sulle tue carte sul campo, al
passaggio del puntatore, compaiono i pulsanti ↩ (riprendi in mano) e ↔ (sposta) come oggi negli
slot.

Store: si aggiungono solo stati d'interfaccia — `drawerOpen: boolean` e
`previewCard: { card, owner } | null`. Nessun nuovo campo di gioco.

I componenti a pannelli sostituiti (`PlayerStages`, `AIStages`, `Hand`, `SidePanel`,
`RaceTracker`, `PhaseBar`, `HypeShop` come contenitore) vengono rimossi quando la plancia ne
copre tutte le funzioni. Overlay di tutorial, setup, risultati, cambio fase, combo e toast restano.

## Parità delle azioni

Ogni azione deve essere eseguibile sulla plancia:

1. Selezionare un tuo palco.
2. Giocare una carta dalla mano sul palco selezionato (clic sulla carta), come oggi.
3. Selezionare un palco per una carta stage: la stage va sul palco selezionato o sul primo libero, come oggi.
4. Scartare una carta dalla mano (e scarto obbligatorio dopo Bootleg).
5. Riprendere in mano una carta dal campo (↩).
6. Spostare una carta tra palchi (↔ poi zona di destinazione).
7. Attaccare: carta attacco, poi clic su una zona AI; annullare l'attacco.
8. Mulligan (round 1, Arrangement, una volta).
9. Undo.
10. Fase successiva / chiudere i risultati / nuovo round / nuova partita.
11. Breve: +1 azione, pesca, boost su un palco, potenziamento soglia o moltiplicatore.
12. Aprire/chiudere il cassetto; vedere log, combo, commento, database.
13. Vedere l'anteprima ingrandita di una carta.

## Test e verifica

- I 54 test del motore restano invariati e passano.
- **Prova di parità** in Chrome headless (script di automazione): per ciascuna azione 1–13
  esegue l'azione sulla plancia e controlla l'effetto (stato della pagina o riga di log).
- **Screenshot** a 1440×900, 1280×800 e 390 di larghezza in una partita Breve e una Classica:
  nessuno scorrimento verticale su desktop, nessun testo sovrapposto, carte leggibili.
- **Giro impeccable** sulla plancia costruita (leggibilità, contrasto, focus da tastiera).
