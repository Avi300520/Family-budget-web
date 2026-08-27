# Split-control design note

The control exposes one editable percentage and an always-visible complementary percentage, so the
sum is comprehensible and cannot drift. A range gives fast keyboard operation; a labelled decimal
field accepts every basis-point increment as 0.01%. `חצי חצי` is a one-action reset, not a hidden
default. The monetary share is server-resolved and shown separately from an unsaved ratio. Rejected:
two independent fields, percentage-only display, client-side shekel arithmetic, and a slider with
no precise keyboard entry.
