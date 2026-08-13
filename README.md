# IARE Feedback Filler

A Chrome/Edge extension for the "Early Semester Feedback Form" on
`samvidha.iare.ac.in`. It selects the same rating (Poor / Average / Good /
Very Good / Excellent) for every question — including the final
"Overall rating of the Teacher" — in one click. It never touches Submit.

## Install (unpacked, no Chrome Web Store needed)
`Clone this repo in am empty folder named 'iare-feedback-filler' or anything as such or either download the zip file`
1. Unzip this folder somewhere permanent (don't delete it after installing).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `iare-feedback-filler` folder.
5. The extension icon should now appear in your toolbar.

## Use

1. Log in to `samvidha.iare.ac.in`, select the subject, and open the
   feedback form as usual.
2. Click the extension icon.
3. Pick a rating from the dropdown (Poor / Average / Good / Very Good /
   Excellent).
4. Click **Apply Rating**.
5. The status line tells you how many questions were updated, e.g.
   `Successfully selected "Excellent" for 21 question(s).`
6. **Review every row yourself**, then click Submit on the page — the
   extension never submits the form for you.

## How it detects each question

For every question (each table row containing radio buttons), the
content script tries, in order:

1. Match the visible label text of each radio (`<label for>`, a
   wrapping `<label>`, `aria-label`/`title`, or the text in the radio's
   own table cell) against the chosen rating.
2. If no radio's label is readable, fall back to matching the row's
   position against the table's column headers (Poor / Average / Good /
   Very Good / Excellent), so it still works if `value="1".."5"` are
   just numeric codes.
3. As a last resort, if a row has exactly 5 radios and no header can be
   found, it assumes the standard left-to-right Poor→Excellent order.

This means it should keep working even if question numbers, IDs, or the
exact HTML shift slightly between forms/sections.

## If some questions aren't detected

Open the extension's console output for details:

1. Right-click the page → **Inspect** → **Console** tab.
2. Look for lines starting with `[IARE Feedback Filler]` — they show how
   many question groups were found and which ones couldn't be matched.
3. If a specific row consistently fails, right-click that radio →
   Inspect, and send me the HTML snippet so I can tighten the matching
   logic in `content.js`.

## Notes

- Only runs on `samvidha.iare.ac.in`, per `host_permissions` in
  `manifest.json`.
- Never clicks Submit, never navigates away, and only touches radio
  buttons it identifies as feedback-rating questions.
