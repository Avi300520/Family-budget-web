# Going live with הפרדת כספים (separate accounts)

**Everything is built, tested, reviewed and merged. One environment variable stands between the
feature and your users, and only you can set it.**

This page is written for you at a keyboard, not for an engineer. Follow it top to bottom. It takes
about ten minutes, and about five of those are Vercel rebuilding on its own.

---

## Before you start: what is already true

| | |
|---|---|
| **Backend** | Deployed and **live**. Release `41680ca`. Three feature flags **armed**. |
| **Backend routes** | All nine separate-accounts routes answer for real. Verified by probing them, not assumed. |
| **Frontend** | Merged to `main` and dormancy-proven. It ships **dormant**: no separate-accounts surface at all until you set the variable. |
| **Your users right now** | See nothing. Nothing has changed for anybody. This is deliberate. |

**Why nothing is visible yet.** The frontend reads one variable, `NEXT_PUBLIC_SEPACCT_UI`. It is not
set, so the four new screens render as "page not found" and the settings menu shows no card for the
feature. The backend is answering; no client is asking.

**That is the whole gap.** Set the variable and the feature appears.

---

## Step 1 - Set the variable on Vercel

1. Go to **vercel.com** and open the **pingtally** project - the consumer site, the one serving
   `pingtally.com`. Not `admin`.
2. **Settings**, then **Environment Variables**.
3. Add a new variable.
4. **Key:** `NEXT_PUBLIC_SEPACCT_UI`
5. **Value:** `1`
6. **Choose the plain, non-sensitive visibility option.** Vercel offers a "Sensitive" or "Secret"
   choice for values it will hide from you afterwards. **Do not pick it.**

   Any key beginning `NEXT_PUBLIC_` is baked into the JavaScript every visitor downloads, so it is
   public by definition, and Vercel refuses to store such a key as a secret. **The error message it
   shows does not tell you that** - it will simply look as though the save failed for no reason. If
   you get an error at this step, this is why: switch the visibility back to the plain option and
   save again.
7. **Environment:** tick **Production** only. Leave Preview and Development alone.

   *(Preview has no connection to the live API, so enabling it there would show you a picture of the
   product rather than the product.)*
8. **Save.**

---

## Step 2 - Redeploy. Saving alone does nothing.

**This step is not optional, and it is the one people skip.**

`NEXT_PUBLIC_` variables are read when the site is **built**, not when a visitor loads it. The site
running right now was built before the variable existed, so it does not contain the feature. Saving
the variable changes nothing at all until a new build happens.

1. In the same project, open **Deployments**.
2. Find the newest one at the top - it should say **Production** and **Ready**.
3. Open its **...** menu, then **Redeploy**.
4. **Untick "Use existing Build Cache."** A cached build can reuse the old compiled pages and
   quietly hand you the old site back.
5. Confirm, and wait for green. Two to four minutes is normal.

---

## Step 3 - The walk. Do this yourself before you tell anybody.

You need **two adults in one household** - you and one other adult member. A child account cannot
take part and will not see any of this.

1. Open **pingtally.com** and sign in.
2. Go to **הגדרות**. There should now be a new card: **הפרדת כספים**.

   *Not there? The redeploy did not pick up the variable. Go back to Step 2.*
3. Open it. Read the panel headed **מה קורה כשמפעילים**. That is the complete list of what changes.
   Nothing outside that list changes.
4. Tick **אנחנו מנהלים חשבונות נפרדים**.
5. Set the ratio. **חצי חצי** is the default and is fine.
6. Press **שמירה**.
7. The panel heading should change to **מה השתנה**, and a line should appear saying when the
   arrangement was recorded.

   **Your partner gets a WhatsApp message. You do not** - you made the change, so you are already
   looking at the result.
8. Now split one real expense. From the dashboard, open the **קטגוריות** card and press
   **פירוט** - that is the page titled **הוצאות החודש**. (The arrangement screen links straight
   there too, from the words "הוצאות החודש" in its own list.)
9. Find an expense you recorded since turning the arrangement on. It carries a small **חלוקה**
   link beside the merchant name. Press it.

   *No **חלוקה** on a row? That is deliberate, and the page says so when none of your rows have
   one. You can only split an expense you recorded yourself, unless you are an owner or admin;
   and an expense recorded before you turned the arrangement on can never be split.*
10. The slider opens at **חצי חצי**. Adjust it if you want, then press **שמירת חלוקה**.
11. In WhatsApp, ask the bot **"כמה נשאר"** or **"מה המצב שלי"**.

### The sentence that means it worked

The bot replies with a line shaped like this:

> `נרשמו על שמך 600₪ · חלקך 300₪`

**`חלקך` is not zero.** That is the whole test.

If `חלקך` comes back as `0`, step 10 did not take - go back and check the split actually saved.

---

## What will feel odd, and is supposed to

**The household income figure disappears.** On **הגדרות → פרטי משק הבית** and on **תקציבי
קטגוריות**, the income you typed during setup is replaced by **פרטית** and a short explanation.
That is the feature working.

**The number is not deleted.** It is still stored - it is hidden while the arrangement is on, and it
comes back if the arrangement is turned off. Each person's own income now lives on **ההכנסה שלי**
(`/my-income`), where only they can see it. The screens say all of this where the number used to be,
so nobody has to guess.

**Two WhatsApp notifications go quiet.** The monthly digest and the wishlist halfway nudge stop
arriving for a household under the arrangement. That is by design - both of them name household-wide
totals.

**Nothing splits by itself.** Every split is set by hand, on the individual expense, from
**הוצאות החודש**. The ratio you choose on the settings screen is stored with the arrangement but is
**not** applied to anything automatically - the expense page always opens at חצי חצי and you change
it there. If you were expecting new expenses to start dividing themselves, they will not, and the
screens say so plainly rather than implying otherwise.

**The first Sunday is when the summary changes.** The weekly WhatsApp summary goes out on Sundays
only. From the next one, it shows each person their own expenses instead of the household total.
**Declare on a Monday and that is six days away.** Until then the weekly summary is the one thing
that will not look any different, which is exactly why the screens tell your household so.

---

## If you want to undo it

**One line, and it is complete:**

> Delete `NEXT_PUBLIC_SEPACCT_UI` from Vercel → Settings → Environment Variables, then **redeploy
> without the build cache**, exactly as in Step 2.

The site returns to precisely what it was. The four screens become "page not found" again and the
settings card disappears.

**You do not need to touch the server, and you should not. The backend can stay armed.** With no
client asking, those routes are inert - and that is measured, not assumed: a production build of the
site with the variable unset renders all four screens as the not-found page, keeps the wizard at its
original seven steps, and makes **zero** calls to any separate-accounts route.

**What undoing does NOT do.** A household that already declared stays declared in the database: its
income stays hidden and its existing splits stay as recorded. Removing the variable takes away the
screens, not the arrangement. To genuinely end an arrangement, have a manager turn it off on the
**הפרדת כספים** screen *before* you remove the variable - that also sends the partner the WhatsApp
notice that simply deleting the variable would not.

---

## If something looks wrong

| What you see | What it means |
|---|---|
| No **הפרדת כספים** card under הגדרות | The redeploy did not take. Redo Step 2 with the build cache **off**. |
| The card is there, but the page says "not found" | You are not an owner or admin of that household. Only managers configure the arrangement. |
| **שמירה** refuses, mentioning two adult members | The arrangement needs two adult members. Invite the second adult first. Turning it **off** never needs two. |
| `חלקך` is `0` in WhatsApp | No expense has been split yet. That is steps 8 to 10. |
| No **חלוקה** link on any expense row | You can split only expenses you recorded yourself, unless you are an owner or admin - and never one recorded before the arrangement began. When no row on the page is splittable, the page says so above the total. |
| The income figure is gone and you did not expect it | That is this feature. See "What will feel odd" above - nothing was deleted. |

---

---

## One thing that was nearly wrong, and is worth knowing

A review of this feature stopped the release one step from merging, because **no user could create
the first split of any expense.** The only page that listed expenses to split was one that showed
only expenses *already* split - so the feature could be started only from a state it had no way of
reaching. Everything else worked; the way in did not exist.

It is fixed, and the fix was one link per row on a page that already existed. The walk in Step 3 is
the proof: if steps 8 to 11 give you a non-zero `חלקך`, the thing that was broken is not broken.

<sub>Written 2026-08-30, for backend release `41680ca` and the frontend `feat/sepacct-splitkey`
merge. The backend facts on this page were verified against the live server and the live database on
that date, not read from documentation.</sub>
