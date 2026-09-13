import { useEffect, useState } from 'react'
import { formatMoney, parseMoney, type Money } from '../engine/money'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { NumberInput } from '../ui/NumberInput'
import { TextInput } from '../ui/TextInput'

interface AmountSheetProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly confirmLabel: string
  readonly defaultAmount: Money
  /** Hard ceiling — the bank cannot hand out what it does not hold. */
  readonly max?: Money
  readonly maxLabel?: string
  readonly hint?: string
  /** Present when a name is needed too, as when a latecomer sits down. */
  readonly nameField?: { readonly label: string; readonly taken: readonly string[] }
  readonly onConfirm: (amount: Money, name: string) => void
}

export function AmountSheet({
  open,
  onClose,
  title,
  confirmLabel,
  defaultAmount,
  max,
  maxLabel,
  hint,
  nameField,
  onConfirm,
}: AmountSheetProps) {
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) {
      setAmount(String(defaultAmount))
      setName('')
    }
  }, [open, defaultAmount])

  const parsed = parseMoney(amount)
  const amountError =
    parsed === null
      ? 'Enter a whole number'
      : parsed <= 0
        ? 'Must be more than zero'
        : max !== undefined && parsed > max
          ? `${maxLabel ?? 'Only'} ${formatMoney(max)} available`
          : null

  const trimmed = name.trim()
  const nameError = !nameField
    ? null
    : !trimmed
      ? 'Needs a name'
      : nameField.taken.some((t) => t.toLowerCase() === trimmed.toLowerCase())
        ? 'Somebody already has that name'
        : null

  const ready = amountError === null && nameError === null && parsed !== null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!ready}
          onClick={() => {
            if (ready && parsed !== null) {
              onConfirm(parsed, trimmed)
              onClose()
            }
          }}
        >
          {confirmLabel}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {nameField && (
          <TextInput
            label={nameField.label}
            value={name}
            onChange={setName}
            placeholder="Name"
            error={nameError}
            autoFocus
          />
        )}

        <NumberInput
          label="Amount"
          value={amount}
          onChange={setAmount}
          error={amountError}
          hint={hint}
          autoFocus={!nameField}
        />

        {max !== undefined && (
          <p className="tnum text-xs text-faint">
            Bank holds {formatMoney(max)}
            {parsed !== null && amountError === null && (
              <> · {formatMoney((max - parsed) as Money)} left afterwards</>
            )}
          </p>
        )}
      </div>
    </Modal>
  )
}
