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
  disabled = false
}: {
  first: SplitPerson;
  second: SplitPerson;
  firstShareBp: number;
  onChange: (firstShareBp: number) => void;
  disabled?: boolean;
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
      <legend className={styles.legend}>חלוקת ההוצאה</legend>
      <p className={styles.help}>הסכום נשמר באגורות. שינוי כאן משפיע על ההוצאה הזו בלבד.</p>

      <div className={styles.people}>
        <label className={styles.person} htmlFor={`${id}-first`}>
          <span>{first.displayName}</span>
          <span className={styles.value} dir="ltr">{percentage(safe)}%</span>
        </label>
        <label className={styles.person} htmlFor={`${id}-second`}>
          <span>{second.displayName}</span>
          <span className={styles.value} dir="ltr">{percentage(secondShareBp)}%</span>
        </label>
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
