# Migrations

`../schema.sql` is the full, re-runnable schema. Run it once on a new Supabase project (it already includes every change below).

For an existing project, each file here holds only that change, named `YYYY-MM-DD_short_name.sql`. To apply one: Supabase > SQL Editor > New query > paste the file > Run. Apply them in date order. Every file is safe to run twice.

| File | What it adds |
| --- | --- |
| `2026-09-28_finance.sql` | Payment amount (kobo), method and pack on `credit_ledger`, the `expenses` table, and the new `grant_seconds` that records money. Needed for /admin/finance. |
| `2026-09-28_paystack.sql` | The `payments` table and `complete_payment()`. Depends on the 9-argument `grant_seconds` from `2026-09-28_finance.sql`, so it must run after it. Needed for Paystack checkout. |

Every change here must also be merged into `schema.sql` so a fresh project always gets the full picture.
