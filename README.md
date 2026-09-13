# Poker Ledger

The chip stack for a real poker game played with real cards and no chips.

You deal the cards and read the hands. This app owns the money: it collects the boot,
tracks every bet, builds side pots, works out who can win what, and keeps a running
record of the night. No real money is involved and none is ever handled.

---

## Running it

```bash
npm install
npm run dev
```

Then open the address it prints. On a phone, use the `Network:` address it shows and make
sure the phone is on the same wifi.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static bundle into `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Re-run tests as you edit |
| `npm run typecheck` | Type check without building |

## Putting it somewhere everyone can reach

`npm run build` produces a plain static folder. There is no server, no database and no
API, so anywhere that serves files will host it:

- **Netlify / Vercel / Cloudflare Pages** — point them at the repo. Build command
  `npm run build`, publish directory `dist`.
- **GitHub Pages** — push the contents of `dist/` to a `gh-pages` branch.
- **No hosting at all** — copy `dist/` onto the device and open `dist/index.html`
  directly. The build uses relative paths, so it works straight off the filesystem with
  no internet.

## How it is used at the table

One phone or laptop runs the app and one person taps for everybody — the same person who
used to keep the notebook. Everyone can see the screen anyway.

The game is **no-limit Texas Hold'em played with a boot**: every player pays the same
fixed amount at the start of each hand, rather than small and big blinds. Four betting
rounds, then you read the cards and tap the winner.

### What it does

- Takes the boot from everyone and opens betting at zero
- Optionally takes a small **table charge** per player per hand that goes back to the bank
  instead of the pot (a rake). Off by default
- Enforces the real rules — minimum bet, minimum raise, whose turn it is — with an
  override for when the table agrees to something non-standard
- Builds side pots correctly when somebody is all-in, including whose money is in which
  pot and who is allowed to win it
- Returns a bet nobody covered before paying anything out
- Splits pots, handing the odd chip clockwise from the dealer
- Lets anyone re-buy from the bank, sit out, join late or cash out and leave
- Records every hand: what each player put in, the pot, and who took it
- Tells you at the end who is up and who is down, and proves the books balance

### What it does not do

- No real money, no gambling, no payments
- No card dealing and no card images — you deal real cards
- No accounts, no server, no database, nothing leaves the device
- No online or remote play

### Never played before?

Tap the **ⓘ** button in the top corner. It opens a 21-step walkthrough — one idea per
step, with Back and Next — covering every button and what it does: whose turn it is, what
the dealer marker means, fold, check, call, raise, all-in, side pots, the four betting
rounds, naming the winner, and undo. It opens by itself the first time the app is used.

Each step shows a small live copy of the real screen with the relevant button picked out,
so you can match what you are reading to what you will actually tap.

### If nobody can agree who won

There is a **Compare cards** button on the winner screen. Tap in the five shared cards and
each remaining player's two cards, and the app names every hand and picks the winner —
kickers included, which is the part people get wrong by eye. It is never required; the
normal path is to read the cards and tap a name.

There is also a **Guide** tab with the hand rankings and what each action means.

---

## Is the money safe?

The bank is the only place money is created and none is ever destroyed, so this must hold
after every single tap:

```
bank + every player's stack + whatever is in the middle  ==  money the bank ever issued
```

It is checked after every action. If it ever fails, a red banner appears at the top of
every screen with the actual numbers. The end-of-night totals make the stronger claim:
every player's result added together comes to exactly zero, which proves not only that no
money appeared or vanished but that every rupee is credited to the right person.

Every amount is a whole number. There are no decimals anywhere, because thousands of
additions across a long night would otherwise drift.

## Does it survive a refresh?

Yes. The session is saved to this browser's local storage after every action, so a stray
refresh, a locked phone or a closed tab does not lose the night. Nothing is uploaded
anywhere. **New game** wipes it, and asks first.

What gets stored is the list of actions, not the current state — so loading is just
replaying them. Anything corrupt or written by an older version is discarded and the app
starts clean rather than opening a broken ledger.

Private browsing usually blocks storage. The app notices, says so, and carries on
working — it just will not survive a reload.

## Made a mistake?

- **Undo** takes back the last action, as many times as you like, all the way to the
  start of the hand.
- **Scrap hand** throws the current hand away and gives everyone their chips back.
- **Hands → Scrap this hand** rewinds past the most recent finished hand. Only the latest
  one can go: every hand since an older one was played against the stacks it produced.

---

## How it is built

Vite, React and TypeScript. No backend, no state library, no UI kit.

```
src/
  engine/     pure rules and money. No React, no DOM, heavily tested.
  state/      event log, undo, localStorage
  screens/    setup, table, players, hands, guide, totals
  components/ pieces specific to this app
  ui/         generic building blocks
```

The engine is **event-sourced**: every change is an event appended to a log, and the
state is recomputed by replaying it. That is what makes undo exact rather than
approximate, and it is where the hand records come from.

### Tests

```bash
npm test
```

The hand evaluator is verified exhaustively. One test enumerates **all 2,598,960**
five-card hands and asserts the count of each category matches the known mathematical
constants — 40 straight flushes, 624 four of a kind, 3,744 full houses, and so on — and
that the number of genuinely distinct hand strengths is 7,462. That last figure only comes
out right if every kicker is ranked correctly too.

See [PLAN.md](PLAN.md) for the full design, the decisions behind it, and what was
deliberately left out.
