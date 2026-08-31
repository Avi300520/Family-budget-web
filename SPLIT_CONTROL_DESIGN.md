# Split-control design note

The control exposes one editable percentage and an always-visible complementary percentage, so the
sum is comprehensible and cannot drift. A range gives fast keyboard operation; a labelled decimal
field accepts every basis-point increment as 0.01%. `חצי חצי` is a one-action reset, not a hidden
default. The monetary share is server-resolved and shown separately from an unsaved ratio. Rejected:
two independent fields, percentage-only display, client-side shekel arithmetic, and a slider with
no precise keyboard entry.

## RTL

`SEPACCT_FRONTEND_SPEC.md` §15 item 6 calls RTL the largest UX risk in this feature. The code
handles it; this section is why, so the next person does not undo it.

**How the control reads in an RTL line.** The page, the legend, the two person labels and the help
text are Hebrew and flow right-to-left. Every *number* inside them is a left-to-right island: the
percentage beside each name, both percent fields, the previous-share value and every money amount.
So a row reads name-then-number from the right, while `50.00%` and `₪93.35` are internally read
left-to-right, exactly as a Hebrew reader expects a number to be. The `%` is not part of the field's
value at all - it is a separate `aria-hidden` span pinned with `inset-inline-end`, so the layout
engine keeps it on the correct side of the input in either direction without it ever entering the
number's text run.

**Why each number is isolated.** A digit run inside an RTL paragraph is typed as a European Number
by the Unicode Bidirectional Algorithm, but the *neutrals* around and between numbers - `.`, `%`,
`₪`, `-`, `·` - resolve against the surrounding right-to-left base direction, not against the digits.
So the digits alone are never enough: it is the boundary that moves. `dir="ltr"` opens a new
embedding level for the number and its adjacent neutrals; `<bdi>` additionally stops that run from
reordering the Hebrew on either side of it. Money uses both, because a shekel sign is a neutral
sitting at the run's edge, which is the worst case.

**What breaks if someone removes that isolation.** Three things, in rising order of how long they
would take to notice:

1. `50.00%` renders as `%50.00` and `₪93.35` as `93.35₪`. Visibly wrong, so it gets fixed.
2. A signed or hyphenated value flips its sign to the far end - `-5` reads `5-`. Wrong, and quietly
   plausible.
3. **Two amounts on one line silently transpose.** `נרשם ₪186.70 · חלקי ₪93.35` is a single RTL
   paragraph with a neutral `·` between two numbers; without isolation the algorithm may lay the two
   runs out in the opposite visual order. Every character is still correct and every digit is still
   right, so nothing looks broken - the reader simply attributes the wrong number to themselves.
   That is the failure this isolation exists for, and it is the one no screenshot review catches.
