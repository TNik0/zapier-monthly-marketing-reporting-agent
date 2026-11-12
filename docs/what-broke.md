# What broke, and what I changed

A log of every problem hit while building and testing the Zap.

| # | What broke | Why | Fix |
|---|---|---|---|
| 1 | Google Sheets turned `2026-01` into a date (1 Jan 2026) on import | Sheets guesses formats when it imports a CSV | Set the month column to **Plain text** and re-entered the values, so the Zap can match `2026-04` as text |
| 2 | Month values landed one row too low when I pasted them back | Pasted into the wrong starting cell | Re-entered all 18 months as a block into A2:A19 and checked that every month has its three channels |
| 3 | Overnight, the Sheets step showed a ⚠ warning | Zapier test data expires, so the step needed re-testing | Clicked **Test step** again. Nothing was actually broken |
| 4 | Couldn't edit the prompt, everything greyed out | I was in **run view** (a read-only record of a test run) | Closed it and clicked **Edit draft** |
| 5 | Mapping plain "Rows" would have merged cells with commas (`notes, , , ,`), so blank cells could disappear | Zapier flattens line items into text | Mapped **Raw Rows** (JSON) instead, so every cell, blank ones included, stays in place |
| 6 | Email showed literal `[INSERT …]` text | Placeholder text not yet swapped for Zapier field chips | Replaced each placeholder with a mapped field |
| 7 | "What changed" and "Recommendations" came out as one long paragraph in the email | HTML ignores ordinary line breaks | Added `white-space:pre-line` to those blocks |
| 8 | The report told the business owner "ALERTS: None." | The AI copied my internal label from the prompt | Prompt rule: *"If ALERTS says None, write 'Nothing unusual this month.' Never write the word ALERTS."* |
| 9 | Recommendations were sometimes numbered on separate lines and sometimes one paragraph | The AI isn't consistent about formatting | Prompt rule: *each recommendation on its own line, numbered 1-3* |
| 10 | Zapier rejected `report_month` with an empty value ("Invalid input data") | An input needs a name **and** a value | Removed the row. The code falls back to last month when it's missing |
| 11 | Zapier renamed my AI step and generated 5 output fields by itself | AI by Zapier builds fields from the prompt's structure | Kept them, since separate fields made the email layout easy. If the prompt changes, check the "fields may be out of date" warning |
| 12 | The first scheduled run (1 Dec) falls after the Pro trial ends (25 Nov) | Multi-step Zaps and Paths need a paid plan | Documented. The project is shown as **built and tested**, not running in production |

## Test cases

| Month tested | What it checks | Result |
|---|---|---|
| **June vs May** | Meta cost per lead ₹76.25 → ₹112.73 (+47.8%) | Flagged → "Needs review" email ✅ |
| **April vs March** | Google Search leads blank (tracking broken 8–20 Apr) | Reported as **MISSING** with the reason from the notes. Total leads INCOMPLETE, no number guessed → review ✅ |
| **May vs April** | Last month's leads are missing | Flagged, because cost per lead can't be compared → review ✅ |
| **February vs January** | Clean baseline | Not flagged → Gmail **draft** only, Path A skipped ✅ |
| **October (no data)** | Automatic month with nothing in the sheet | "No data found for 2026-10" → review, no empty report sent ✅ |
