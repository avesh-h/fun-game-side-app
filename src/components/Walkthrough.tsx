import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { ArtActions, ArtButton, ArtCard, ArtPot, ArtRow, Frame } from './TourArt'

/**
 * The walkthrough.
 *
 * One idea per step, each with a small live copy of the thing being described.
 * Written for somebody who has never played poker and is about to be handed the
 * phone — so no jargon goes past without being explained, and every step points
 * at something they will actually see on screen.
 */

interface Step {
  readonly title: string
  readonly body: ReactNode
  readonly art: ReactNode
}

const STEPS: readonly Step[] = [
  {
    title: 'What this app is for',
    body: (
      <>
        You play with real cards, exactly as you always have. This app is only the{' '}
        <strong className="text-ink">money</strong> — it remembers every stack, builds the
        pot, and works out who gets what. It never deals cards and never decides anything
        about them.
      </>
    ),
    art: (
      <Frame>
        <ArtPot round="Pre-flop" roundStep="Hand 1" amount="450" toMatch="150" />
      </Frame>
    ),
  },
  {
    title: 'The bank',
    body: (
      <>
        All money starts in the bank. Players take from it at the start and whenever they
        run out. It is the only place money comes from — nothing is ever invented.
      </>
    ),
    art: (
      <Frame>
        <div className="flex items-baseline justify-between rounded-lg border border-line bg-surface px-3 py-2">
          <span className="text-[0.625rem] uppercase tracking-wider text-faint">Bank</span>
          <span className="tnum text-lg font-semibold">14,600</span>
        </div>
        <p className="text-center text-[0.625rem] text-faint">
          Shown at the top of every screen
        </p>
      </Frame>
    ),
  },
  {
    title: 'Setting up the game',
    body: (
      <>
        Before you start you set four things: how much the bank holds, the{' '}
        <strong className="text-ink">boot</strong> (what everyone pays each hand), the
        smallest bet allowed, and everyone&rsquo;s name with their starting chips.
      </>
    ),
    art: (
      <Frame>
        <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-2.5 text-[0.6875rem]">
          {[
            ['Bank', '10,000'],
            ['Boot', '50'],
            ['Minimum bet', '50'],
            ['Each player starts with', '1,000'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-faint">{label}</span>
              <span className="tnum">{value}</span>
            </div>
          ))}
        </div>
      </Frame>
    ),
  },
  {
    title: 'Dealing a hand',
    body: (
      <>
        Between hands there is one big button. Tap it, then deal the real cards. The app
        takes the boot from everybody automatically — you never collect it by hand.
      </>
    ),
    art: (
      <Frame>
        <div className="flex justify-center py-1">
          <ArtButton label="Deal hand 3" tone="primary" />
        </div>
      </Frame>
    ),
  },
  {
    title: 'The boot',
    body: (
      <>
        Every player pays the same fixed amount at the start of each hand. That is what
        makes a pot worth playing for. Five players paying 50 means the pot starts at 250
        before anyone has bet anything.
      </>
    ),
    art: (
      <Frame>
        <ArtRow name="userA" stack="950" bet="−50" dealer />
        <ArtRow name="userB" stack="950" bet="−50" />
        <ArtRow name="userC" stack="950" bet="−50" />
        <ArtPot amount="150" />
      </Frame>
    ),
  },
  {
    title: 'The pot',
    body: (
      <>
        The pot is all the money in the middle. It grows as people bet and goes to whoever
        wins the hand. The big number at the top is always the current total.
      </>
    ),
    art: (
      <Frame>
        <ArtPot round="Flop" roundStep="Hand 3" amount="1,240" toMatch="250" />
      </Frame>
    ),
  },
  {
    title: 'Whose turn is it?',
    body: (
      <>
        This is the important one. The <strong className="text-ink">blue row</strong> marked{' '}
        <em>their turn</em> is the person you are acting for, and their name is in large
        text above the buttons.{' '}
        <strong className="text-ink">You never choose who acts</strong> — the app goes
        round the table in order and moves on by itself after every tap.
      </>
    ),
    art: (
      <Frame>
        <ArtRow name="userA" stack="950" dealer />
        <ArtRow name="userB" stack="800" bet="150" />
        <ArtRow name="userC" stack="800" turn />
        <ArtActions name="userC" status="to call 150" mode="call" />
      </Frame>
    ),
  },
  {
    title: 'The little D',
    body: (
      <>
        The <strong className="text-ink">D</strong> is the dealer marker. It is{' '}
        <strong className="text-ink">not</strong> a selection and does not mean that player
        is doing anything. It only decides who speaks first, and it moves one seat every
        hand so the same person is not always last.
      </>
    ),
    art: (
      <Frame>
        <ArtRow name="userA" stack="950" dealer />
        <ArtRow name="userB" stack="950" turn />
        <ArtRow name="userC" stack="950" />
        <p className="text-center text-[0.625rem] text-faint">
          userA deals · the player to their left acts first
        </p>
      </Frame>
    ),
  },
  {
    title: 'Fold',
    body: (
      <>
        Give up the hand. Anything already put in stays in the pot — you do not get it
        back. Use this when the cards are not worth paying for.
      </>
    ),
    art: (
      <Frame>
        <ArtActions name="userC" status="to call 150" mode="call" highlight="fold" />
      </Frame>
    ),
  },
  {
    title: 'Check',
    body: (
      <>
        Pass for free. You stay in the hand and pay nothing. This is only possible when
        nobody has bet yet this round — otherwise the button is greyed out and you must
        call, raise or fold.
      </>
    ),
    art: (
      <Frame>
        <ArtActions name="userC" status="nothing to call" highlight="check" />
      </Frame>
    ),
  },
  {
    title: 'Call',
    body: (
      <>
        Match whatever the current bet is, so you can carry on. The button always shows the
        exact amount, so there is nothing to work out — just tap it.
      </>
    ),
    art: (
      <Frame>
        <ArtActions name="userC" status="to call 150" mode="call" highlight="call" />
      </Frame>
    ),
  },
  {
    title: 'Bet and Raise',
    body: (
      <>
        Put in more than the current bet, so everyone else has to match you or fold. This
        one opens a second screen because you have to choose an amount — with quick buttons
        for half the pot, the whole pot, or everything.
      </>
    ),
    art: (
      <Frame>
        <ArtActions name="userC" status="nothing to call" highlight="raise" />
        <div className="grid grid-cols-2 gap-1.5">
          <ArtButton label="Min 50" />
          <ArtButton label="½ pot 200" />
          <ArtButton label="Pot 400" />
          <ArtButton label="All-in 800" />
        </div>
      </Frame>
    ),
  },
  {
    title: 'All-in',
    body: (
      <>
        Push every chip in. You are still in the hand, but you cannot bet again — so the
        app shows <em>all-in</em> next to your name and skips your turn from then on.
      </>
    ),
    art: (
      <Frame>
        <ArtActions name="userC" status="to call 150" mode="call" highlight="allin" />
        <ArtRow name="userC" stack="0" allIn bet="350" />
      </Frame>
    ),
  },
  {
    title: 'Side pots',
    body: (
      <>
        If someone is all-in for less than the others are betting, they can only win the
        part of the pot they actually paid into. The extra becomes a{' '}
        <strong className="text-ink">side pot</strong> that only the remaining players can
        win. The app splits this out for you and names who is eligible for each.
      </>
    ),
    art: (
      <Frame>
        <ArtPot
          round="River"
          amount="1,240"
          sides={[
            { label: 'Main', who: 'userA, userB, userC', amount: '600' },
            { label: 'Side 1', who: 'userA, userB', amount: '640' },
          ]}
        />
        <p className="text-center text-[0.625rem] text-faint">
          userC went all-in early, so cannot win Side 1
        </p>
      </Frame>
    ),
  },
  {
    title: 'The four rounds',
    body: (
      <>
        Betting goes round the table up to four times in a hand — after the cards are
        dealt, then after the three shared cards, the fourth, and the fifth. The app tells
        you which round you are in and moves on by itself once everyone has matched.
      </>
    ),
    art: (
      <Frame>
        {['Pre-flop', 'Flop', 'Turn', 'River'].map((round, i) => (
          <div
            key={round}
            className={[
              'flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[0.6875rem]',
              i === 1 ? 'border-accent bg-accent-soft' : 'border-line bg-surface opacity-50',
            ].join(' ')}
          >
            <span className={i === 1 ? 'font-semibold text-accent' : ''}>{round}</span>
            <span className="text-faint">round {i + 1} of 4</span>
          </div>
        ))}
      </Frame>
    ),
  },
  {
    title: 'Saying who won',
    body: (
      <>
        When betting finishes, look at the cards and tap the winner&rsquo;s name. Tapping{' '}
        <strong className="text-ink">two or more names</strong> splits the pot between
        them. You always see exactly what each person will receive before you confirm.
      </>
    ),
    art: (
      <Frame>
        <div className="rounded-lg border border-line bg-surface p-2.5">
          <p className="mb-1.5 text-xs font-semibold">Who won?</p>
          <p className="mb-1.5 text-[0.625rem] text-faint">Pot · 450</p>
          <div className="flex gap-1.5">
            <ArtButton label="userA" />
            <ArtButton label="userB" tone="primary" />
            <ArtButton label="userC" />
          </div>
          <div className="mt-2 rounded border border-line-soft bg-raised px-2 py-1.5 text-[0.625rem]">
            <span className="text-faint">Before you confirm</span>
            <div className="mt-0.5 flex justify-between">
              <span>userB</span>
              <span className="tnum text-good">+450 → 1,250</span>
            </div>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    title: 'If you cannot agree who won',
    body: (
      <>
        There is a <strong className="text-ink">Compare cards</strong> button. Tap in the
        shared cards and each player&rsquo;s two cards, and the app names every hand and
        picks the winner — including kickers, which is the part people argue about. It is
        never required.
      </>
    ),
    art: (
      <Frame>
        <div className="flex items-center justify-between rounded-lg border border-good/40 bg-good/10 px-2.5 py-2">
          <span className="flex items-center gap-2">
            <span className="text-xs">userB</span>
            <span className="rounded border border-good/40 bg-good/10 px-1 py-px text-[0.5625rem] font-medium uppercase text-good">
              wins
            </span>
          </span>
          <span className="flex gap-1">
            <ArtCard label="A♥" red />
            <ArtCard label="A♦" red />
          </span>
        </div>
        <p className="text-center text-[0.625rem] text-muted">Three of a kind, aces</p>
      </Frame>
    ),
  },
  {
    title: 'Tapped the wrong thing?',
    body: (
      <>
        <strong className="text-ink">Undo</strong> takes back the last tap, and you can
        keep pressing it right back to the start of the hand. It always says what it is
        about to undo. Nothing you do at the table is permanent.
      </>
    ),
    art: (
      <Frame>
        <div className="flex items-center gap-2">
          <ArtButton label="Undo · Call" />
          <span className="text-[0.625rem] text-faint">4 steps back to the start</span>
        </div>
      </Frame>
    ),
  },
  {
    title: 'When somebody runs out',
    body: (
      <>
        If a player loses everything, a message appears between hands. They can take more
        from the bank in one tap, or sit out for a while. Nobody can be dealt in with no
        chips.
      </>
    ),
    art: (
      <Frame>
        <div className="rounded-lg border border-warn/40 bg-warn-soft p-2.5">
          <p className="text-[0.6875rem] text-warn">
            <strong className="font-semibold">userC</strong> has no chips left.
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <ArtButton label="Re-buy 1,000" tone="primary" />
            <ArtButton label="Sit out" />
          </div>
        </div>
      </Frame>
    ),
  },
  {
    title: 'The other tabs',
    body: (
      <>
        <strong className="text-ink">Players</strong> for re-buys, sitting out, latecomers
        and people leaving. <strong className="text-ink">Hands</strong> for a record of
        every hand played. <strong className="text-ink">Guide</strong> for hand rankings.{' '}
        <strong className="text-ink">Totals</strong> for who is up and who is down.
      </>
    ),
    art: (
      <Frame>
        <div className="flex gap-1">
          {['Table', 'Players', 'Hands', 'Guide', 'Totals'].map((tab, i) => (
            <span
              key={tab}
              className={[
                'flex min-h-8 flex-1 items-center justify-center rounded-lg px-1 text-[0.625rem]',
                i === 0 ? 'bg-accent-soft text-ink' : 'text-faint',
              ].join(' ')}
            >
              {tab}
            </span>
          ))}
        </div>
      </Frame>
    ),
  },
  {
    title: 'At the end of the night',
    body: (
      <>
        The <strong className="text-ink">Totals</strong> tab shows what each person took
        from the bank against what they finished with. The pluses and minuses always add up
        to exactly zero — that is the app proving it recorded the night correctly.
      </>
    ),
    art: (
      <Frame>
        <div className="rounded-lg border border-line bg-surface p-2.5 text-[0.6875rem]">
          {[
            ['userB', '+260', 'text-good'],
            ['userA', '−30', 'text-bad'],
            ['userC', '−230', 'text-bad'],
          ].map(([name, net, tone]) => (
            <div key={name} className="flex justify-between py-0.5">
              <span>{name}</span>
              <span className={`tnum ${tone}`}>{net}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line-soft pt-1 text-faint">
            <span>Adds up to</span>
            <span className="tnum">0</span>
          </div>
        </div>
      </Frame>
    ),
  },
]

export function Walkthrough({
  open,
  onClose,
}: {
  readonly open: boolean
  readonly onClose: () => void
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  const step = STEPS[index]
  const first = index === 0
  const last = index === STEPS.length - 1
  if (!step) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`How it works · ${index + 1} of ${STEPS.length}`}
      footer={
        <div className="flex items-center gap-2">
          <Button disabled={first} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            Back
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={() => (last ? onClose() : setIndex((i) => i + 1))}
          >
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-line-soft"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {step.art}

        <div>
          <h3 className="text-base font-semibold">{step.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
        </div>

        {!last && (
          <button
            type="button"
            onClick={onClose}
            className="self-start text-xs text-faint underline"
          >
            Skip — I can reopen this from the ⓘ button any time
          </button>
        )}
      </div>
    </Modal>
  )
}
