"use client";

import { useId } from "react";
import styles from "./split-control.module.css";

export interface SplitPerson {
  userId: string;
  displayName: string;
}

function percentage(bp: number): string {
  return (bp / 100).toFixed(2).replace(/\.00$/, "");
}

export function SplitControl({
  first,
  second,
  firstShareBp,
  onChange,
  disabled = false,
  scope = "expense"
}: {
  first: SplitPerson;
  second: SplitPerson;
  firstShareBp: number;
  onChange: (firstShareBp: number) => void;
  disabled?: boolean;
  /** WHICH ratio this control edits. `expense` is one purchase; `household` is the default that
   *  every future shared expense is divided by. The two are not the same statement and the control
   *  must not make the same one on both screens. */
  scope?: "expense" | "household";
}) {
  const id = useId();
  const safe = Math.max(0, Math.min(10000, Math.round(firstShareBp)));
  const secondShareBp = 10000 - safe;
  const setFromPercent = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.max(0, Math.min(10000, Math.round(parsed * 100))));
  };

  return (
    <fieldset className={styles.control} disabled={disabled}>
      {/* ── `R-2` FINDING 4 — **THE SAME CONTROL MEANS OPPOSITE THINGS ON ITS TWO SCREENS.** ──────
          This copy was written for the per-expense page and rendered unchanged on the household
          default, three lines below a sentence saying the ratio applies to every FUTURE expense.
          Two sentences, three lines apart, contradicting each other, on a money screen.
          `הסכום נשמר באגורות` also went: it is a storage detail, shown to a parent. */}
      <legend className={styles.legend}>{scope === "household" ? "חלוקת ההוצאות המשותפות" : "חלוקת ההוצאה"}</legend>
      <p className={styles.help}>
        {scope === "household"
          ? "כך מתחלקות הוצאות משותפות חדשות בין שניכם."
          : "שינוי כאן משפיע על ההוצאה הזו בלבד."}
      </p>

      {/* A READOUT, not a label. These were <label htmlFor> and gave each percent field a SECOND
          label (axe form-field-multiple-labels): the accessible name became the readout plus the
          field's own label, and it changed on every drag because the readout carries a live value. */}
      <div className={styles.people}>
        <p className={styles.person}>
          <span>{first.displayName}</span>
          <span className={styles.value} dir="ltr">{percentage(safe)}%</span>
        </p>
        <p className={styles.person}>
          <span>{second.displayName}</span>
          <span className={styles.value} dir="ltr">{percentage(secondShareBp)}%</span>
        </p>
      </div>

      <label className={styles.rangeLabel} htmlFor={`${id}-range`}>
        חלקה של {first.displayName}
      </label>
      <input
        id={`${id}-range`}
        className={styles.range}
        type="range"
        min="0"
        max="10000"
        step="100"
        value={safe}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className={styles.entryRow}>
        <div className={styles.entry}>
          <label htmlFor={`${id}-first`}>{first.displayName}</label>
          <div className={styles.percentInput}>
            <input
              id={`${id}-first`}
              className="input mono"
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={percentage(safe)}
              onChange={(event) => setFromPercent(event.target.value)}
              dir="ltr"
            />
            <span aria-hidden>%</span>
          </div>
        </div>
        <div className={styles.entry}>
          <label htmlFor={`${id}-second`}>{second.displayName}</label>
          <div className={styles.percentInput}>
            <input id={`${id}-second`} className="input mono" value={percentage(secondShareBp)} readOnly dir="ltr" />
            <span aria-hidden>%</span>
          </div>
        </div>
      </div>
      <button type="button" className="button secondary" onClick={() => onChange(5000)}>
        חצי חצי
      </button>
    </fieldset>
  );
}
