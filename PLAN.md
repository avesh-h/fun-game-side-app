# Poker Ledger — Project Plan

A web app that acts as the **chip stack** for a physical home poker game.
You deal real cards and read real hands; the app owns every rupee of fake money.

**Status: complete.** All 12 phases done, 84 of 84 tasks. 173 tests passing, including the
exhaustive 2,598,960-hand verification. Typecheck clean, production build clean. Playable
end to end on a phone.

### Fix after first real use

The first person to actually play a hand could not tell whose turn it was. They read the
dealer marker **D** as a selection, tapped Check four times without knowing who each tap
applied to, and went looking for a way to "choose" the next player. None of that was their
mistake — the screen never said who was acting.

Three changes, all in the direction of saying it louder:

- The name of the player to act is now **large text** at the top of the action bar,
  instead of the same size as everything around it.
- Their row gets a **thick accent left edge and a "their turn" badge**, so it cannot be
  confused with the quiet little D sitting on another row.
- The action bar shows **what the previous tap did** — "userB checked" — which is the
  confirmation that was missing. Press Check and you can see whose check it was.

The guide gained a *How a hand runs* section covering the one thing nobody had been told:
you never pick who acts, the turn moves itself, and D is only the dealer marker.

### Second fix after real use — layouts that use the screen

The app had been built phone-first and stayed phone-shaped everywhere: a 448px column
stranded in the middle of a laptop display. Every screen now widens in steps rather than
staying pinned to one width.

```
phone      < 768   one column, full width, action bar welded to the bottom
tablet     768+    one column at 48rem
laptop    1024+    two columns at 64rem
desktop   1280+    two columns at 72rem
large     1536+    capped at 80rem so lines stay readable
```

**The table splits in two on a laptop.** Pot and players on the left, actions on the
right, the sidebar sticky so the controls stay put while the player list scrolls. The
action bar is `sticky bottom-0` on a phone and an ordinary panel in the sidebar from `lg`
up, so it stops covering the table when there is room for it not to.

The DOM order is the phone order — the action bar has to come last there to sit under the
thumb — and `order` lifts it to the top of the sidebar on wide screens, where the most
important control should lead rather than trail.

**The other screens tile.** Players become a 2- then 3-column grid of cards, hand records
go two across, the guide puts rankings beside the written explanations so the whole thing
fits without scrolling, and the totals table sits next to its reconciliation panel.

Verified at 360, 390, 768, 1024, 1512 and 1920 — no horizontal overflow at any of them,
the action panel correctly stops being sticky from `lg`, and the phone layout is unchanged.

### Third fix after real use — a walkthrough for people who do not play poker

[Walkthrough.tsx](src/components/Walkthrough.tsx) · [TourArt.tsx](src/components/TourArt.tsx)

A 21-step guide behind an **ⓘ** button in the header, one idea per step, with Back and
Next and a progress bar. It opens by itself the first time the app is used and then stays
out of the way.

**Built from live UI, not screenshots.** Each step carries a miniature of the real thing —
a player row with the highlight on it, the action buttons with one picked out and the rest
dimmed, a pot with its side pots. Screenshots would have been heavier, blurry when zoomed,
wrong in the other colour scheme, and — the real objection — they would start lying the
first time a button changed. These are made from the same styles as the screens they
describe, so they cannot drift.

Steps cover: what the app is for, the bank, setup, dealing, the boot, the pot, whose turn
it is, the dealer marker, each of the five actions one at a time, side pots, the four
rounds, naming the winner, comparing cards, undo, running out of chips, the tabs, and the
end-of-night totals.

**Three changes to the game screen itself**, so the app explains rather than assumes:

- The round now reads **"Flop · Round 2 of 4"**. "Flop" means nothing to a new player;
  "round 2 of 4" always does.
- The action bar carries a plain-English line about the situation — *"They pay 150 to stay
  in, or fold and lose what is already in"* — so nobody needs to know what "call" means to
  use the app correctly.
- A one-tap ⓘ sits in the header on every screen, and on the setup screen as a labelled
  **How it works** button, since that is where a first-time user lands.

### Fourth fix after real use — the showdown looked stalled

Someone reached the end of a hand and did not know what to do next. Fair: the action
buttons vanish, the turn highlight goes, and what is left is a panel of plain name buttons
above a big dark button reading *"Pick a winner for every pot"* — which is disabled, and
so reads as broken rather than as an instruction.

The screen now says what it is waiting for:

- The panel is headed **"Betting is finished"** and tells you plainly to turn the cards
  over, look at them, and tap whoever has the best hand.
- It carries an accent border, because on a wide layout it sits away from where the eye has
  been for the whole hand.
- The pot panel on the left points at it — *"Betting is finished — say who won it on the
  right"*, which reads "below" on a phone.
- Name buttons are full-size in a two-column grid and tick when chosen, rather than being
  small secondary-looking chips.
- The confirm button says **"Tap a name above first"** while it is disabled, then becomes
  **"Award pot"**. A disabled button that does not explain itself is worse than no button.

**A pot with only one possible winner is now chosen automatically.** When everybody folds
there was never a question to ask, so that case drops from two taps to one.

### Fifth fix after real use — the rotating deal looked like a bug

Hand 2 opened on the third player rather than the first, and that read as the app picking
somebody at random. It was correct — the deal had moved one seat, so the player to the new
dealer's left starts — but nothing on screen said so, and the reason is the least obvious
rule in poker: acting last is an advantage, so the deal rotates to share it out.

**One genuine defect underneath it.** Between hands the **D** was drawn on the *previous*
dealer, so it appeared to jump the instant you pressed Deal. It now points at whoever is
about to deal, which is both more useful and stops the jump.

Three lines of explanation, each appearing exactly where the question arises:

- Between hands — *"userB deals next — marked D below. The deal moves one seat each hand."*
- At the top of every hand, until the first action — *"userB deals this hand, so userC goes
  first. The deal moves one seat every hand, so nobody is always last."*
- On the D itself, a hover title: *"Deals this hand — decides who acts first."*

### Added after release — an optional table charge

[rake.test.ts](src/engine/rake.test.ts)

A fixed amount every player pays each hand **on top of the boot**, which goes back to the
**bank** rather than into the pot. Zero by default, which is the normal case. Set in the
setup form as *Table charge*; the word "rake" appears only in the hint, since it is jargon.

**The money still cannot go missing.** The running invariant is untouched — the charge
moves from stacks to bank, and `bank + stacks + pot` still equals everything ever issued.
What changes is the settlement identity, which becomes:

```
every player's net  +  pot in play  +  total charged  ==  0
```

The Totals screen shows the charge as its own line and says in words that the results
coming to minus the charge *is* the books balancing, rather than leaving it looking like
money went astray.

**Scrapping a hand refunds the charge too.** A hand that never happened must cost nobody
anything, so the bank gives it back and the running total is reduced.

**Nobody is dealt in short any more.** What it costs to sit down is now boot + charge, and
anyone who cannot cover it is held back with a prompt — borrow from the bank, or sit out —
rather than being quietly put all-in before seeing a card. That is a house rule rather than
casino practice, chosen because the alternative is easy to miss. The setup form enforces
the same thing: a starting stack below the entry is an error, not a warning, because that
player could not play a single hand.

### An orphaned button, found by a user asking where it went

The **New game** action existed in the store but nothing called it — the button was lost
during the responsive rework and the function sat unused. It is back, on the Totals screen
under *Finishing up*, beside **End session**, with the two spelled out as different things:
one stops the dealing and keeps everything, the other erases the session entirely.

**The fairness claim is now a test, not an assurance.** Two cases in
[betting.test.ts](src/engine/betting.test.ts): five players over twenty hands each take the
button exactly four times and act first exactly four times; and with one player sitting
out, the remaining three each take it exactly three times while the absent player never
does. Equal by construction rather than equal on average — which is the argument for a
rotation over picking at random.
**Last updated:** 2026-09-13

---

## 1. The Problem

We play Texas Hold'em with physical cards, but we have **no chips and no fake money** —
only a pen and a notebook. Every hand we manually track who bet what, what the pot is,
who won, and who needs to borrow more from the shared bank. It is slow, error-prone,
and causes arguments.

This app replaces the notebook. It is **not** a card game — it deals nothing, shows no
cards, and judges no hands. It is a **money ledger with a poker rules engine**.

### Non-goals (explicitly NOT building)

- No real money, no gambling, no payments of any kind
- No card dealing and no card images — you deal real cards, the app never shows one
- No accounts, no login, no server, no database
- No online / remote play
- No heavy animation or decorative graphics

---

## 2. Locked Decisions

All confirmed before planning. Changing any of these means revisiting the plan.

| # | Decision | Choice | Consequence |
|---|---|---|---|
| 1 | Bet tracking detail | **Full action tracking** | App is the chip stack. Every Fold/Check/Call/Bet/Raise/All-in goes through it. Pot and side pots computed automatically. |
| 2 | Device model | **One shared device** | Pure static app. No server, no sync, no internet required. |
| 3 | Bank borrowing | **Re-buy, no debt** | Bank shrinks when a player takes money. Nothing is "owed". Up/down measured at settlement. |
| 4 | Persistence | **localStorage auto-save** | Survives refresh / phone lock / accidental close. Nothing leaves the device. Explicit "New Game" wipes it. |
| 5 | Game variant | **Texas Hold'em, No Limit** | 4 betting rounds per hand. All-ins and side pots supported. |
| 6 | Money into pot | **Boot — everyone pays the same** | No small/big blinds. Every active player pays a fixed boot each hand. |
| 7 | Stakes | **Fixed all session** | Boot and minimum bet never change. Re-buy any time. Session ends when you decide. |
| 8 | Rule enforcement | **Enforce + override button** | Illegal actions blocked by default; a clearly-marked override exists for house rules. |
| 9 | Roster | **Fully flexible** | Join mid-session, sit out temporarily, cash out and leave. |
| 10 | Winner | **Operator taps the winner's name** | App has no idea who won — you read the cards and tell it. Pot moves to that player. |
| 11 | Undo | **Unlimited, back to start of hand** | Plus a separate "cancel this hand" for already-finished hands. |
| 12 | Tech stack | **Vite + React + TypeScript** | Type-safe money math. Builds to a static folder — host it or open it locally. |
| 13 | Main layout | **Player list + bottom action bar** | Compact rows, thumb-reachable actions, works with 10 players on a phone. |
| 14 | Hand rankings guide | **Yes — (i) button, always available** | Dark-themed rankings screen so nobody has to remember if a flush beats a straight. |
| 15 | Hand comparison | **Built-in evaluator, optional to use** | Type the cards in and the app names the winner. Pure local computation — no API, no LLM, no lookup table. |
| 16 | Card entry | **Tap a 52-card grid** | Used cards grey out, so the same card can never be entered twice. |
| 17 | Theme | **Dark blue / dark, simple, professional** | Minimal animation. Clarity over decoration. |

### Scope note

The original brief asked for *"all records entry of each round"*. A hand-by-hand record
(hand #, boot, each player's contribution, pot, winner) is therefore **core scope**. The
heavy action-by-action replay viewer is **out of scope**. The event log needed for Undo
produces these records almost for free.

---

## 3. The Money Model

### The one invariant that must never break

```
initialBank  ==  bank
              +  SUM(stack of every seated player)
              +  SUM(all pot layers)
              +  SUM(all uncommitted bets on the current street)
```

The Bank is the **only** place money is created. Money is never destroyed. This equation
is checked after **every single state change**, and a visible warning appears if it ever
fails. If this holds, the ledger is correct by construction.

### Money flows

| Event | Bank | Player stack | Pot |
|---|---|---|---|
| Buy-in / Re-buy | −amount | +amount | — |
| Post boot | — | −boot | +boot |
| Bet / Call / Raise | — | −amount | +amount |
| Win pot | — | +amount | −amount |
| Uncalled bet returned | — | +excess | −excess |
| Cash out (leave game) | +stack | → 0 | — |
| Bank top-up (admin) | +amount | — | — |

### Rules

- **All amounts are integers.** No floats anywhere, no decimals ever. Floating point
  rounding would slowly corrupt the ledger over a long session.
- **Bank cannot go negative.** If a re-buy would overdraw it, the app blocks and offers
  an explicit admin "top up bank" action.
- A player with a **0 stack cannot be dealt into a hand** — they must re-buy or sit out.

---

## 4. Poker Rules Specification

This is the part that has to be exactly right. Each item below becomes a test.

### 4.1 Starting a hand — the boot

- Every **active** player pays the same fixed **boot** into the pot before any betting.
- Example: boot 20, five players → pot starts at 100.
- If a player cannot cover the full boot, they go **all-in for less**. The hand continues
  and a side pot forms automatically (see 4.5).
- The boot is **dead money** in the pot, not a bet to be matched. So the current bet level
  is **0** when betting opens, and the first player may **check**.

### 4.2 Dealer and action order

- A **dealer marker** rotates clockwise to the next active player each hand. It exists only
  to decide who acts first and to break odd-chip ties — there are no blinds attached to it.
- **First to act = the player left of the dealer**, on every betting round.
- Action then proceeds clockwise, skipping folded, all-in, and sitting-out players.

### 4.3 Legal bet sizing (No Limit)

- **Minimum bet** = the configured minimum bet (defaults to the boot amount).
- **Minimum raise** = the size of the previous raise increment.
  Example: min bet 20 → someone raises to 60 (increment 40) → the next legal raise is to 100 or more.
- **Maximum** is always the player's entire stack (all-in).
- **An all-in for less than a full raise does NOT reopen betting** for players who have
  already acted — they may only call or fold. This is the single subtlest rule in No Limit
  and a common source of home-game disputes.

### 4.4 The four betting rounds, and how each one ends

Each hand has **four** betting rounds:

| # | Name | When it happens |
|---|---|---|
| 1 | Pre-flop | Right after the boot, once everyone has their cards |
| 2 | Flop | After the 3 shared cards are turned over |
| 3 | Turn | After the 4th shared card |
| 4 | River | After the 5th shared card |

The app shows which round you are on and advances automatically when a round closes. It
never asks anything about the cards themselves — you deal those.

A round closes when **both** of the following are true:

- Every non-folded, non-all-in player has acted at least once this round, **and**
- All such players have matched the current highest bet.

Bets from a closed round are swept into the pot, and the next round opens with the current
bet back at **0** — so the first player to act may check again.

Short-circuits:

- If only one non-folded player remains → hand ends immediately, no cards need showing.
- If all remaining players are all-in → skip straight to the winner screen.

### 4.5 Side pots

Built from **every** contribution in the hand, including boot money from players who folded.

```
levels = sorted unique contribution amounts
for each level L (ascending):
    layerAmount = (L - previousLevel) × count(players who contributed >= L)
    eligible    = players who contributed >= L AND did not fold
```

Folded players' money stays in the pot; they are simply never eligible to win it.
The lowest layer is the **main pot**; each subsequent layer is a **side pot**.

### 4.6 Uncalled bet return

If a player bets more than anyone else matched (typically because everyone folded), the
**unmatched excess is returned to them before the pot is awarded**. Forgetting this is the
most common pen-and-paper error.

### 4.7 Picking the winner, splitting, and odd chips

- When betting is done, the app shows a **winner screen**: tap the name of the player who won.
- If side pots exist, it asks pot by pot — main pot first, then each side pot. Only players
  **eligible** for that pot are tappable.
- **Split pot:** select more than one name. The pot divides evenly between them.
- If it does not divide evenly, the **remainder goes one unit at a time to the winner(s)
  closest clockwise from the dealer marker** — standard poker convention.

### 4.8 What the four actions mean (for the in-app guide)

| Action | Meaning |
|---|---|
| **Check** | Pass. Pay nothing, stay in. Only legal if nobody has bet this round. |
| **Call** | Match the current bet. |
| **Bet / Raise** | Put in more than the current bet. Everyone else must call it or fold. |
| **Fold** | Throw the hand away. Forfeits everything already put in. |
| **All-in** | Push the entire remaining stack in. Creates a side pot if others bet more. |

### 4.9 Hand rankings and the card comparison tool

Normally you read the cards yourself and tap the winner. When the table can't agree, a
**Compare cards** button opens a modal: tap the 5 shared cards and each remaining player's
2 cards from a 52-card grid, and the app names the winner.

#### The ten rankings, strongest first

| # | Hand | How many exist | Odds of being dealt |
|---|---|---|---|
| 1 | Royal flush | 4 | 1 in 649,740 |
| 2 | Straight flush | 36 | 1 in 72,193 |
| 3 | Four of a kind | 624 | 1 in 4,165 |
| 4 | Full house | 3,744 | 1 in 694 |
| 5 | Flush | 5,108 | 1 in 509 |
| 6 | Straight | 10,200 | 1 in 255 |
| 7 | Three of a kind | 54,912 | 1 in 47 |
| 8 | Two pair | 123,552 | 1 in 21 |
| 9 | One pair | 1,098,240 | 1 in 2.4 |
| 10 | High card | 1,302,540 | 1 in 2 |

Total = **2,598,960** possible 5-card hands, collapsing to **7,462** genuinely distinct strengths.

#### Why this is plain code, not a data table or an API

- A **JSON table** of all cases would be millions of rows for something a function computes
  in microseconds. Pure bloat.
- A **third-party API** would add internet dependency to an app deliberately built to work
  offline at the table, plus latency and an external point of failure.
- An **LLM** is probabilistic and will eventually get a comparison wrong. The entire point
  of this app is to end arguments, not create new ones. Rejected outright.

#### Algorithm

```
for each player still in the hand:
    cards   = their 2 hole cards + the 5 shared cards   (7 total)
    for each of the 21 possible 5-card picks from those 7:
        score = rankCategory × 10^10  +  tiebreak ranks packed in order
    best    = max(score)
winner(s)   = players tied on the highest best-score
```

Roughly 150 lines. No dependencies.

#### Edge cases that must be handled

- **A-2-3-4-5 is a valid straight** (the lowest one, "the wheel"). Ace counts low there and
  high everywhere else.
- **Q-K-A-2-3 is not a straight** — rankings do not wrap around.
- **Kickers decide ties.** Same pair means the remaining cards are compared, in order. All
  five cards count, never a sixth.
- **Playing the board** — the best hand may use one or even zero of a player's hole cards.
  If the 5 shared cards beat everyone's hole cards, every remaining player splits.
- **Exact ties split the pot** — far more common in Hold'em than people expect.
- **Duplicate cards are impossible to enter** — the grid greys out anything already used.

#### Proof of correctness

A test enumerates **all 2,598,960** five-card hands and asserts the category counts come out
as exactly `4 / 36 / 624 / 3,744 / 5,108 / 10,200 / 54,912 / 123,552 / 1,098,240 / 1,302,540`.
Those are fixed mathematical constants. If the evaluator reproduces them exactly, it is
correct — not "probably right". The test runs in a couple of seconds.

---

## 5. Architecture

### Event-sourced core

Every change is an **append-only event**. State is derived by folding events through a
pure reducer.

```
events[]  ──reducer──▶  GameState  ──▶  UI
```

This buys three things at once:

- **Undo** = drop the last event and recompute. Always correct, never drifts. Unlimited
  undo back to the start of the hand costs nothing extra.
- **Hand records** = already in the log, no extra bookkeeping.
- **Testability** = the whole engine is pure functions — no React, no DOM.

### Project structure

```
side-app/
├── PLAN.md                      ← this file
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── engine/                  ← pure, no React, fully tested
    │   ├── types.ts             player, seat, hand, event, state types
    │   ├── events.ts            event definitions + constructors
    │   ├── reducer.ts           events → state
    │   ├── betting.ts           legal actions, min-raise, round closing
    │   ├── pots.ts              side pot layering, odd-chip distribution
    │   ├── seating.ts           dealer rotation, boot collection, action order
    │   ├── handEval.ts          5-card scorer, best-5-of-7, winner comparison
    │   └── invariants.ts        money conservation check
    ├── state/
    │   ├── store.ts             React context wrapping the reducer
    │   └── persistence.ts       localStorage save / load / version migration
    ├── screens/
    │   ├── Setup.tsx            new game configuration form
    │   ├── Table.tsx            main game screen
    │   ├── Winner.tsx           tap the winner, award pots
    │   ├── CompareCards.tsx     optional: enter cards, app decides the winner
    │   ├── Players.tsx          re-buy, sit out, add, cash out
    │   ├── History.tsx          hand-by-hand records
    │   ├── Guide.tsx            hand rankings + action meanings
    │   └── Settlement.tsx       end-of-night scoreboard
    ├── components/
    │   ├── PlayerRow.tsx
    │   ├── CardGrid.tsx
    │   ├── ActionBar.tsx
    │   ├── RaiseInput.tsx
    │   ├── PotDisplay.tsx
    │   └── BankBadge.tsx
    └── styles/theme.css
```

### Tech

- **Vite** + **React 19** + **TypeScript** (strict mode)
- **Tailwind CSS v4** for styling
- **Vitest** for engine tests
- Zero runtime dependencies beyond React — no state library, no UI kit, no server

---

## 6. Screens

| Screen | Purpose |
|---|---|
| **Setup** | The opening form: bank amount, boot, minimum bet, and every player's name + starting money. |
| **Table** | The main screen. Pot, bank, player rows, action bar. 95% of the time is spent here. |
| **Winner** | Tap who won. Handles split pots and side pots. |
| **Compare cards** | Optional. Tap in the 5 shared cards and each player's 2 cards; the app names the winner and explains why. |
| **Players** | Re-buy, sit out / sit in, add latecomer, cash out and leave. |
| **History** | Hand-by-hand records. Cancel a hand if it was entered wrong. |
| **Guide (i)** | Hand rankings, highest to lowest, plus what each action means. Reachable from anywhere. |
| **Settlement** | End of night. Total taken from bank vs final stack per player = who's up, who's down. |

### Setup form fields

- Bank starting amount (the pool everyone borrows from)
- Boot amount (what each player pays every hand)
- Minimum bet (defaults to the boot amount)
- Per player: name + starting money on the table

### Table screen layout (target)

```
┌──────────────────────────────┐
│ POT 450     BANK 42,300  (i) │
│ FLOP · round 2 of 4          │
├──────────────────────────────┤
│ D   Raj       1,200    ✓ 100 │
│     Amit        800  ▸ to act│
│     Vikram        0    ALL-IN│
│     Sunny       540    folded│
│     Dev       2,100    ✓ 100 │
├──────────────────────────────┤
│ AMIT · to call 100           │
│ [ Fold ] [ Call 100 ] [Raise]│
│ [ Undo ]                     │
└──────────────────────────────┘
```

---

## 7. Build Plan

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

### Phase 0 — Scaffold

- [x] Init Vite + React + TypeScript project
- [x] Enable TypeScript strict mode (plus `noUncheckedIndexedAccess` for array safety)
- [x] Add Tailwind CSS v4 + dark blue theme tokens
- [x] Add Vitest and confirm a trivial test runs
- [x] Set viewport / mobile meta tags correctly

### Phase 1 — Domain model

- [x] Define core types: `Player`, `Hand`, `HandPlayer`, `BettingRound`, `HandRecord`, `GameState`, `GameConfig` — [types.ts](src/engine/types.ts)
- [x] Define the full event union + constructors — [events.ts](src/engine/events.ts)
- [x] Money as a branded integer type to prevent accidental float use — [money.ts](src/engine/money.ts)

**Two deliberate changes from the original event list:**

- `PostBoot` was folded into `HandStarted`. The boot is collected atomically when a
  hand begins, so it can never be half-collected, and undoing the hand start returns
  everyone's boot in one step.
- `NextRound` was dropped. Moving from pre-flop to flop to turn to river happens
  automatically inside the reducer when a betting round closes. Making it an event
  would mean an extra tap during play and, worse, a separate undo step — you would
  have to undo the round change and then the action that caused it.

### Phase 2 — Money and card engine (pure + tested)

**Pots** — [pots.ts](src/engine/pots.ts) · [pots.test.ts](src/engine/pots.test.ts)

- [x] Side pot layering algorithm
- [x] Folded-player contributions included in layers, excluded from eligibility
- [x] Uncalled bet return
- [x] Even split among multiple winners
- [x] Odd-chip distribution clockwise from dealer
- [x] **Tests:** simple pot · one all-in · two all-ins · three-way all-in at different levels · folded player's dead money · split pot with remainder · everyone folds to a bet · player short on the boot · layer nobody can claim

Every pot test also asserts the balance property: what was paid out plus what was
refunded equals exactly what went in.

**Hand evaluator** — [handEval.ts](src/engine/handEval.ts) · [cards.ts](src/engine/cards.ts) · [handEval.test.ts](src/engine/handEval.test.ts)

- [x] 5-card hand scorer producing a single comparable number
- [x] Best-5-of-7 selection (21 combinations per player)
- [x] Ace-low straight (A-2-3-4-5) supported; no wrap-around straights
- [x] Kicker comparison across all five cards
- [x] Exact ties detected and reported as a split
- [x] **Proof test:** enumerates all 2,598,960 five-card hands and asserts the category
      counts are exactly 40 / 624 / 3,744 / 5,108 / 10,200 / 54,912 / 123,552 /
      1,098,240 / 1,302,540, that exactly 4 of them are royal flushes, and that the
      number of genuinely distinct hand strengths is 7,462. Runs in about a second.

### Phase 3 — Betting state machine

[seating.ts](src/engine/seating.ts) · [betting.ts](src/engine/betting.ts) · [reducer.ts](src/engine/reducer.ts) · [betting.test.ts](src/engine/betting.test.ts)

- [x] Dealer rotation + first-to-act order
- [x] Boot collection at hand start, including all-in-for-less on the boot
- [x] Legal action computation (which buttons are enabled, and their amounts)
- [x] Min-bet and min-raise calculation
- [x] Short all-in does not reopen betting
- [x] Betting-round closing detection, and advancing through all four rounds
- [x] Skip straight to winner screen when all remaining players are all-in
- [x] Auto-award when all but one player folds
- [x] **Tests:** one case per rule above, plus table stakes, hand cancelling and
      undo-by-replay. Every test also asserts the money invariant holds.

**The reducer landed here rather than in Phase 4.** Transitions like collecting the
boot and moving between rounds cannot be tested without it, and half-building it would
have been worse than finishing it. Phase 4 is now purely the layers on top: the
invariant module, localStorage, and the undo controls.

**`PotAwarded` now carries winners, not amounts.** The event says *who* won each pot;
the reducer works out the uncalled-bet refund, the pot layers and the split itself. The
arithmetic lives in one place, so the UI has no way to disagree with the ledger.

**Table stakes enforced.** Chips cannot be added to a stack mid-hand — a re-buy is
refused while the player is still contesting. Otherwise a top-up part-way through would
silently invalidate the side-pot maths.

### Phase 4 — Persistence, undo, invariants

[invariants.ts](src/engine/invariants.ts) · [persistence.ts](src/state/persistence.ts) · [store.ts](src/state/store.ts) · [InvariantBanner.tsx](src/components/InvariantBanner.tsx)

- [x] Money conservation invariant, checked after every event
- [x] Visible warning banner if the invariant ever fails
- [x] localStorage auto-save after every event
- [x] Load on startup + schema version field for safe future changes
- [x] Unlimited undo back to the start of the current hand
- [x] Cancel an entire finished hand and restore stacks
- [~] "New Game" wipe works; the **confirm dialog is still missing** — it needs the
      Modal primitive from Phase 5, so it is finished there rather than bodged with a
      browser alert now

**The event log is what gets saved, not the state.** State is only ever derived, so
storing events is smaller, survives changes to how state is shaped, and makes a reload
just a replay. Saved events are replayed before being trusted — anything corrupt or
written by an older version is discarded and the app starts clean rather than booting
into a broken ledger.

**Storage failure is never fatal.** Private browsing exposes `localStorage` and then
throws on write, so availability is proved with a test write before being trusted. If it
is unavailable the app runs normally and simply will not survive a reload.

**Illegal actions cannot crash the app.** Every dispatch runs the reducer first; if the
rules refuse, nothing is recorded and the reason is shown as a dismissible message.

### Phase 5 — UI shell and theme

[theme.css](src/styles/theme.css) · [ui/](src/ui/) · [AppShell.tsx](src/components/AppShell.tsx)

- [x] Dark blue palette, typography scale, spacing tokens
- [x] App shell with navigation between screens
- [x] Reusable primitives: Button, NumberInput, Modal, Badge, Panel
- [x] Confirm-dialog pattern for destructive actions
- [x] *(carried from Phase 4)* "New Game" now asks before wiping

**Primitives live in `src/ui/`**, separate from `src/components/` which holds
app-specific pieces. The original plan put everything in one folder; splitting them
keeps the generic building blocks obviously reusable.

**Every tap target clears 44px**, even the small buttons. This app gets used on a phone
lying on a table in bad light with people waiting — a mis-tap costs real time.

**Verified in a real browser at 390px**, not just by typecheck: setup screen, boot
collection, correctly disabled Call and Raise buttons, and the confirm sheet. Console is
clean.

Three details that only matter on a phone, all handled in `theme.css`: inputs are forced
to 16px so iOS does not zoom and wreck the layout mid-hand; the focus ring shows for
keyboard users and stays hidden for tappers; and the page cannot rubber-band when someone
jabs at buttons quickly.

### Phase 6 — Setup screen

[Setup.tsx](src/screens/Setup.tsx) · [setupModel.ts](src/screens/setupModel.ts) · [setupModel.test.ts](src/screens/setupModel.test.ts)

- [x] Configure bank total, boot, minimum bet, default buy-in
- [x] Add players with names and starting money, up to ten
- [x] Validate: min 2 players, unique non-empty names, positive amounts, bank must
      cover every buy-in
- [x] Start game

**Validation lives in `setupModel.ts`, not the component.** It is a pure function from
form strings to either a valid game or a list of what is wrong, so it is covered by 12
tests rather than only by clicking.

**The minimum bet follows the boot until you change it.** Almost nobody wants them
different, and nobody should have to think about it. Once edited by hand it stops
following and the hint says so.

**Errors appear only after the first attempt to start.** The button is never disabled —
a disabled button that will not say why is worse than one that explains itself.

**A buy-in below the boot warns rather than blocks.** It is legal: that player is simply
all-in on the first hand, and the side-pot engine already handles it.

### Phase 7 — Table screen

[Table.tsx](src/screens/Table.tsx) · [PotDisplay.tsx](src/components/PotDisplay.tsx) · [PlayerRow.tsx](src/components/PlayerRow.tsx) · [ActionBar.tsx](src/components/ActionBar.tsx) · [RaiseSheet.tsx](src/components/RaiseSheet.tsx)

- [x] Pot display, including side pots when they exist
- [x] Bank badge *(in the shell header, on every screen)*
- [x] Player rows: name, stack, dealer marker, current bet, status
- [x] Clear "to act" highlight
- [x] Action bar: Fold / Check / Call / Bet / Raise / All-in with live amounts
- [x] Raise input: numeric entry + quick buttons (min, ½ pot, pot, all-in)
- [x] Betting round indicator (Pre-flop / Flop / Turn / River)
- [x] Override toggle to bypass rule enforcement, visibly marked when active
- [x] Undo button always reachable
- [x] Guide always reachable *(as a tab in the sticky nav rather than a separate ⓘ)*

**Side pots are shown only once somebody is all-in.** Before that there is one pot and
labelling it "main pot" would be noise. The moment a short stack is in the middle, who
can win what stops being obvious, so each layer is listed with the names eligible for it.

**The pot breakdown on screen is computed by the same functions the reducer uses** to pay
out — uncalled bet returned, then layered. What you read can never disagree with what
gets paid.

**Quick raise buttons clamp and de-duplicate.** A ½-pot or full-pot button that exceeds
the player's stack is dropped rather than shown broken, so a short stack sees just Min
and All-in.

**Override waives sizing, never arithmetic.** With it on, a bet under the minimum or a
raise smaller than the last one is allowed, and a player can raise when the betting was
not reopened. It still cannot put in more than they have, and a raise still has to be a
raise. The flag is written onto the event, so a hand played off-book says so in the log
instead of hiding it. A standard bet carries no flag at all, which keeps older saved
sessions readable.

Verified in the browser on a seeded side-pot hand: pot 1,240 split into a 600 main pot
(all three eligible) and a 640 side pot (Amit excluded, being all-in for 200).

### Phase 8 — Winner screen and card comparison

[WinnerPicker.tsx](src/components/WinnerPicker.tsx) · [CompareCards.tsx](src/components/CompareCards.tsx) · [CardGrid.tsx](src/components/CardGrid.tsx)

- [x] Detect winner-selection vs auto-award
- [x] Tap a name to award the pot
- [x] Award main pot, then each side pot in turn
- [x] Only eligible players tappable per pot
- [x] Multi-select for split pots, with the resulting stack change shown before confirming
- [x] 52-card tap grid, with already-used cards greyed out
- [x] Enter the 5 shared cards plus 2 cards per remaining player
- [x] "Compare cards" button sitting beside manual winner selection (never forced)
- [x] Result view: each player's best hand named in plain English, winner highlighted
- [x] Feed the evaluated winner into pot award, including side pots and splits

**The card grid runs 13 rows down, 4 suits across — not 13 columns.** Thirteen columns
works out at roughly 26px per card on a phone, which is not a tap target anyone can hit
reliably with people waiting. Turned on its side every card gets a proper button and the
list scrolls, which is natural inside a sheet.

**`bestEligiblePerPot` is what makes comparison work with side pots.** The strongest hand
at the table does not automatically win a pot it never paid into, so each layer is decided
among *its own* eligible players. Ties come back as several winners, which is a split.

**The preview runs the real award code.** What the confirm panel shows is produced by the
same `returnUncalledBet` → `buildPots` → `awardPots` chain the reducer runs, so the numbers
on screen are the numbers that land in the stacks.

Verified in the browser on the case that matters most: Amit all-in for 200 holding trip
aces, Vikram holding trip kings. Amit takes the 600 main pot; Vikram takes the 640 side
pot despite the weaker hand, because Amit never paid into it.

### Phase 9 — Player management

[Players.tsx](src/screens/Players.tsx) · [AmountSheet.tsx](src/components/AmountSheet.tsx) · [reducer.test.ts](src/engine/reducer.test.ts)

- [x] Re-buy from bank (prompted automatically when a player busts)
- [x] Sit out / sit back in
- [x] Add a player mid-session
- [x] Cash out and leave — stack returns to bank
- [x] Admin: top up bank
- [x] Block any action that would overdraw the bank

**The bust prompt appears on the table, not just the Players screen.** Anyone sitting at
zero between hands gets an amber panel right where the operator already is, with the usual
re-buy as a single tap and "other amount" behind it. Walking to another screen every time
somebody busts would be the most repeated annoyance of the night.

**Buttons go quiet mid-hand rather than failing when tapped.** Table stakes means chips
cannot move while a player is still contesting, and the reducer enforces it — but the UI
disables those buttons and says why instead of letting someone tap and get an error.

**Cashed-out players stay on the books.** Their stack goes back to the bank and they stop
being dealt in, but they keep their record of what they took, so the end-of-night totals
still show how they finished.

**Topping up is the honest escape hatch for a dry bank.** It genuinely creates money, so
it raises `totalIssued` rather than breaking the invariant — the ledger still balances and
the totals account for it. The screen says as much before you do it.

Every player-management event is covered by tests that also assert the money invariant.

### Phase 10 — Hand records

[History.tsx](src/screens/History.tsx) · [store.test.ts](src/state/store.test.ts)

- [x] Hand list: hand #, boot, pot size, winner(s), newest first
- [x] Expand a hand to see each player's total contribution and result
- [x] Scrap the most recent hand from here

**Only the most recent hand can be scrapped, and the screen says why.** Every hand since
an older one was played against the stacks that hand produced, so unpicking it in
isolation would leave the rest of the night resting on numbers that never existed. The
honest operation is a rewind to just before the last deal — including any re-buys or
joins that happened after it, which the confirm dialog spells out.

**Each expanded hand is a four-column ledger** — put in, took, net — that foots to zero.
If the money ever stopped balancing, this is the screen that would show which hand did it.

### Phase 11 — Guide and settlement

[Guide.tsx](src/screens/Guide.tsx) · [Settlement.tsx](src/screens/Settlement.tsx) · [settlement.ts](src/engine/settlement.ts) · [settlement.test.ts](src/engine/settlement.test.ts)

- [x] Hand rankings screen, royal flush → high card, with example hands
- [x] Action meanings table (check / call / raise / fold / all-in)
- [x] Settlement: per player total taken from bank, what they finished with, net, sorted
- [x] Bank reconciliation line proving the invariant closed
- [x] End session (keeps the totals readable, blocks further dealing)

### A real bug this phase found

Writing the totals exposed a genuine defect in the ledger. Cashing out sets a player's
stack to zero and returns the chips to the bank — so a player who took 1,000 and walked
away with 1,260 was being reported as **down 1,000**, because the only figures available
were "stack now" and "took from the bank".

Fixed by adding `totalReturnedToBank` to `Player`, updated when somebody cashes out. What
a player finished with is now `stack + totalReturnedToBank`, so leaving the table no
longer erases the night's result. Persistence stores events rather than state, so replay
rebuilds the new field with no migration.

The Players screen had the same wrong arithmetic; both screens now share `netResult`.

**Every result added together must come to exactly zero.** That is the check the totals
screen leads with, and it is stronger than the running invariant: it proves not only that
no money appeared or vanished, but that every rupee is attributed to the right person.
Mid-hand the sum comes to minus the pot, which the screen says plainly rather than
pretending the standings are final.

The guide uses the same ten example hands as a standard rankings chart, plus the two
rules that actually cause arguments — the ace-low straight, and kickers deciding level
hands.

### Phase 12 — Polish and ship

- [x] Responsive QA: 360px phone → 820px tablet → 1280px desktop, no horizontal overflow
      at any width, action bar pinned correctly at all three
- [x] 10-player stress check on a 360px screen, mid-hand with five pot layers
- [x] Tap targets large enough for real use at a table
- [x] Full manual playthrough by clicking: deal, all-in, bust, re-buy, second hand
- [x] `npm run build` produces a clean static bundle — three files, nothing stray
- [x] Short [README.md](README.md): running it, hosting it, and what it guarantees

### What the QA pass actually found

**The pot header disagreed with its own breakdown.** At a full table the header read 1,410
while the layers below it summed to 1,360. Both numbers were individually right: the
display was returning an uncalled bet *mid-hand*, when three players had yet to act and
could still have called it. A bet is only uncalled once betting is over. The refund is now
applied only at `awaitingWinner`, so the layers always add up to the pot shown above them —
and Om's 50 correctly appears as a fifth pot only he is eligible for while betting runs.

**Ten players buried the action.** Naming every eligible player across five pot layers
wrapped to eleven lines and pushed the player rows off screen. Eligible lists longer than
four now collapse to a count, and the row whose turn it is scrolls itself into view —
using `block: 'nearest'`, so nothing jumps when it is already visible.

**Tap targets were measured, not assumed.** Every interactive element was checked against
the 44px guideline; the five navigation tabs came back at 36px and were raised. Everything
in the action loop already passed.

**A full-page screenshot made the action bar look broken** — it appeared to overlay the
player list. That was an artifact of how `position: sticky` captures; in a real viewport
it pins correctly at every width tested.

The click-through playthrough ended with bank 2,300 + stacks 2,550 + pot 150 = 5,000, the
dealer marker correctly moved on, and the busted player re-bought and was dealt back in.

---

## 8. Progress

| Phase | Tasks | Done | Status |
|---|---|---|---|
| 0 — Scaffold | 5 | 5 | **Done** |
| 1 — Domain model | 3 | 3 | **Done** |
| 2 — Money and card engine | 12 | 12 | **Done** |
| 3 — Betting machine | 9 | 9 | **Done** |
| 4 — Persistence / undo | 7 | 7 | **Done** |
| 5 — UI shell | 4 | 4 | **Done** |
| 6 — Setup screen | 4 | 4 | **Done** |
| 7 — Table screen | 10 | 10 | **Done** |
| 8 — Winner + card comparison | 10 | 10 | **Done** |
| 9 — Players | 6 | 6 | **Done** |
| 10 — Hand records | 3 | 3 | **Done** |
| 11 — Guide + settlement | 5 | 5 | **Done** |
| 12 — Polish | 6 | 6 | **Done** |
| **Total** | **84** | **84** | **100%** |

---

## 9. Deferred (agreed out of scope)

Not being built now. Listed so they stay visible if we ever want them.

- Per-player statistics (hands won, biggest pot, bust count)
- Action-by-action hand replay viewer
- Export / share session summary as a file
- Multi-device sync (would require a server)
- Small blind / big blind mode
- Tournament mode with rising stakes
- Teen Patti / Omaha engines
- Hand timer / shot clock

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Side pot logic is genuinely hard to get right | Pure functions with a dedicated test suite, written before the UI |
| Operator mis-taps during a live game | Unlimited undo within the hand + cancel-hand, both always reachable |
| A ledger bug silently corrupts the session | Money invariant asserted after every event, with a visible failure banner |
| Too many taps slows the game down | Action bar shows exact amounts so most actions are one tap |
| localStorage cleared by the browser | Warn on New Game; settlement screen is the durable output |
| Nobody remembers the hand rankings | (i) guide button reachable from every screen |
