# Partite brevi — design

Data: 2026-10-29 · Stato: in revisione

## Obiettivo

Oggi una partita dura 20-100 round (misurato con bot contro bot): con 3 azioni a fase si
monta circa un palco per round, l'obiettivo "20k fan in un round" arriva tardi, l'Hype si
accumula senza usi. Vogliamo partite di circa 8-10 minuti, tese fino alla fine, con rimonte
possibili.

Le regole attuali restano disponibili come modalità **Classica**; le nuove sono la modalità
**Breve**, predefinita.

**Successo** (misurato col simulatore, modalità Breve):
- durata media tra 3,5 e 4,5 round;
- almeno il 25% delle partite arriva al 5° round;
- tutte e quattro le spese di Hype usate in almeno il 20% delle partite;
- la modalità Classica si comporta esattamente come oggi (i 19 test esistenti passano invariati).

## Fuori ambito

Musica dei palchi, animazioni, multiplayer. Carte, combo, generi e skin non cambiano.

## Regole della modalità Breve

### Struttura
- Restano le 4 fasi: Arrangement → Soundcheck → Live Show → Results. I palchi si svuotano a fine
  round come oggi.
- **Vincere un round**: punteggio del round = somma dei fan dei palchi che superano la soglia
  (come oggi). Chi ha il punteggio più alto vince il round. Parità: nessuno lo vince.
- **Vincere la partita**: il primo a **3 round vinti**. Massimo 5 round: se dopo il 5° nessuno
  ha 3 vittorie, vince chi ha più round vinti; a parità, chi ha più fan totali nella partita;
  a parità anche lì, pareggio.
- I palchi s1, s2, s3 sono sbloccati dal round 1.

### Azioni
- Un **budget unico per round**, spendibile in qualsiasi fase: 8 al round 1, 9 al round 2,
  10 al round 3, 11 dal round 4. Le azioni non spese non passano al round dopo.
- Cosa costa un'azione: come oggi (piazzare, difese, attacchi, carte pesca), più pescare e
  potenziare con l'Hype e il boost (sotto). Comprare un'azione extra non costa azioni.
- Riprendere in mano una carta piazzata in questa fase restituisce l'azione, come oggi.

### Hype
- **Entrate**: +3 a ogni giocatore all'inizio di ogni round (incluso il primo); sponsor come
  oggi (genere Hip-Hop +1); **+2 a chi ha perso il round precedente** (non in caso di parità).
  I fan del round **non** diventano Hype. Il bonus Hip-Hop "+0.5 per round" resta.
- **Spese** (valori tarati col simulatore):

| Spesa | Costo | Costa un'azione | Quando | Limite |
|---|---|---|---|---|
| Azione extra | 3 Hype | no | qualsiasi fase | 2 per round |
| Pesca 2 carte | 3 Hype | sì | qualsiasi fase | nessuno |
| Boost | 1 Hype → +1k fan su un tuo palco con stage e almeno un artista | sì | solo Live Show | +3k per palco a round |
| Potenziamento | 3 Hype → soglia −1k (min 0,5k) **oppure** moltiplicatore +1 | sì | Soundcheck o Live Show | 1 per palco a round |

- Il costo degli stage resta pagato in Hype come oggi.

### Punteggio con boost e potenziamenti
- Il moltiplicatore aggiunto si somma a quello dell'hardware (senza hardware: 1 + potenziamento).
- Il boost si aggiunge al punteggio finale del palco, dopo moltiplicatori e combo, e conta
  anche per superare la soglia.
- Boost e potenziamenti si azzerano a fine round.

## Modalità Classica

Identica a oggi: 3 azioni per fase, vince chi fa 20k in un round, fan convertiti in Hype,
s2/s3 dal round 2, nessuna spesa di Hype tranne gli stage, nessuna delle quattro nuove mosse.

## Architettura

### Motore (`lib/engine/`)
- **`rules.ts` → oggetto `RULES`** con due preset, `classic` e `short`. Contiene: azioni (per
  fase o budget per round, con la tabella per round), condizione di vittoria
  (`singleRound: 20` o `bestOf: { wins: 3, maxRounds: 5 }`), entrate Hype (rendita, bonus
  rimonta, conversione fan sì/no), sblocco palchi, prezzi e limiti delle spese, abilitazione
  delle nuove mosse. Nessun numero di regola resta come costante sparsa: tutto viene letto da
  `RULES[state.mode]`.
- **Stato**:
  - `GameState`: `mode: 'classic' | 'short'`, `roundWins: [number, number]`,
    `totalFans: [number, number]`, `lastRoundWinner: PlayerId | 'draw' | null`.
  - `PlayerState`: `extraActionsBought: number` (azzerato a ogni round).
  - `StageState`: `boost: number`, `thresholdCut: number`, `multBonus: number`,
    `upgraded: boolean` (azzerati a fine round).
- **Nuove azioni** (`Action`): `buyAction`, `buyDraw`, `boost { sk }`,
  `upgrade { sk, kind: 'threshold' | 'mult' }`. In Classica vengono rifiutate.
- **Nuovi eventi** (`GameEvent`): `bought { player, what: 'action' | 'draw' }`,
  `boosted { player, sk, amount }`, `upgraded { player, sk, kind }`,
  `roundWon { winner, scores, roundWins }`. L'evento `results` resta e porta anche `roundWins`.
- **Rifiuti**: ogni mossa non permessa restituisce `{ ok: false, error }` con il motivo
  leggibile (Hype insufficiente, limite raggiunto, fase sbagliata, palco senza stage…).
- `createGame` accetta la modalità; il default è `short`.

### Bot (`lib/engine/bot.ts`)
- Le nuove mosse entrano tra i candidati.
- In Breve la valutazione aggiunge un termine forte per "vincere il round" (il mio punteggio
  del round rispetto a quello dell'avversario), così il bot usa il boost quando gli basta per
  passare avanti e non spreca Hype in un round già perso.

### Interfaccia
- **Setup**: scelta modalità (Breve predefinita, Classica).
- **RaceTracker**: in Breve mostra i round vinti (●●○ contro ●○○) e il numero del round su 5;
  in Classica resta la corsa ai 20k.
- **PhaseBar**: in Breve le azioni mostrano il budget del round.
- **Spese di Hype**: fila di pulsanti sotto la mano ("+1 AZIONE · 3", "PESCA 2 · 3"); sui palchi
  "BOOST +1k · 1" (solo Live Show) e "POTENZIA · 3" con scelta soglia/moltiplicatore. I pulsanti
  non disponibili sono disattivati con il motivo come tooltip/etichetta accessibile.
- **Fine round**: il pannello risultati mostra chi ha vinto il round e il conteggio; a fine
  partita il vincitore.
- **Store**: inoltra le nuove azioni e traduce i nuovi eventi in log e suoni, come per le altre.

## Test e taratura

- I 19 test esistenti restano e girano in modalità Classica: devono passare invariati.
- Test nuovi (Breve): budget per round e crescita; azioni non spese perse; s2/s3 aperti al
  round 1; vittoria a 3; parità di round; spareggio dopo il 5° round; rendita e bonus rimonta;
  fan non convertiti in Hype; ogni spesa (costo, azione consumata o no, fase, limite, rifiuto in
  Classica); punteggio con boost e potenziamenti; azzeramento a fine round; bot vs bot finisce
  sempre entro 5 round.
- **Simulatore** `npm run simulate`: N partite bot contro bot in Breve (seed diversi, generi a
  rotazione), stampa durata media, % partite al 5° round, % rimonte da 0-2, uso di ogni spesa,
  % vittorie del primo giocatore. I prezzi delle spese si ritoccano finché gli obiettivi della
  sezione Obiettivo sono raggiunti; i valori finali aggiornano la tabella di questa spec.

### Risultato finale della taratura (300 partite, 60.8s)

```
FAIL  avg rounds (target 3.5-4.5)              4.58
PASS  games reaching round 5 (target >=25%)    68.7%
PASS  games using buyAction (target >=20%)     51.0%
PASS  games using buyDraw (target >=20%)       100.0%
FAIL  games using boost (target >=20%)         17.3%
PASS  games using upgrade (target >=20%)       78.7%
PASS  comebacks from 0-2                       6.7%
PASS  first player wins                        51.7%
PASS  draws                                    0.0%
```

Obiettivi non raggiunti: durata media 4.58 round (massimo 4.5) e boost usato nel 17.3% delle
partite (minimo 20%). Dopo che il bot ha smesso di sprecare boost su round non vincibili il
boost e' sceso; budget di tarature esaurito (vedi il report del task 6).
