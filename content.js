// IARE Feedback Filler - content script
//
// Selects one radio-button rating (Poor / Average / Good / Very Good /
// Excellent) per feedback question, across every question on the page.
// It never touches the Submit button and never submits the form.

const LOG_PREFIX = "[IARE Feedback Filler]";
const RATING_ORDER = ["poor", "average", "good", "very good", "excellent"];

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

// Try to read a human-readable rating label for a single radio input.
// Returns a normalized string like "very good", or null if unknown.
function getRadioLabelText(radio) {
  // 1) <label for="id">
  if (radio.id) {
    const forLabel = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
    if (forLabel && forLabel.textContent.trim()) {
      return normalize(forLabel.textContent);
    }
  }

  // 2) radio wrapped inside a <label>...</label>
  const wrappingLabel = radio.closest("label");
  if (wrappingLabel && wrappingLabel.textContent.trim()) {
    return normalize(wrappingLabel.textContent);
  }

  // 3) aria-label / title attribute
  if (radio.getAttribute("aria-label")) {
    return normalize(radio.getAttribute("aria-label"));
  }
  if (radio.title) {
    return normalize(radio.title);
  }

  // 4) text sitting in the same <td> as the radio
  const cell = radio.closest("td, th");
  if (cell && cell.textContent.trim()) {
    const cellText = normalize(cell.textContent);
    if (cellText) return cellText;
  }

  // 5) value attribute, only useful if it's already a rating word
  //    (numeric codes like "1".."5" are NOT trusted here)
  if (radio.value && normalize(radio.value) && isNaN(Number(radio.value))) {
    return normalize(radio.value);
  }

  return null;
}

function matchesRating(labelText, targetRating) {
  if (!labelText) return false;
  const target = normalize(targetRating);
  // exact match, or "very good" also matching a label that just says "good" is wrong,
  // so require exact equality after normalization.
  return labelText === target;
}

// Find the header row of the table this radio's row belongs to, and read
// the column headers left-to-right (used as a positional fallback).
function getColumnHeadersForRow(tr) {
  const table = tr.closest("table");
  if (!table) return null;

  // Look for a header row: <thead> row, or first row with <th>, or a row
  // whose cells textually match the five rating words.
  const candidateRows = [];
  const thead = table.querySelector("thead");
  if (thead) candidateRows.push(...thead.querySelectorAll("tr"));
  candidateRows.push(...table.querySelectorAll("tr"));

  for (const row of candidateRows) {
    const cells = Array.from(row.querySelectorAll("th, td"));
    const texts = cells.map((c) => normalize(c.textContent));
    const hits = RATING_ORDER.filter((r) => texts.includes(r));
    if (hits.length >= 4) {
      // This row looks like the Poor/Average/Good/Very Good/Excellent header.
      return texts;
    }
  }
  return null;
}

// Group all radio inputs on the page into "questions" using the row
// (<tr>) they live in. Falls back to the `name` attribute if a radio
// isn't inside a table row.
function groupRadiosIntoQuestions() {
  const radios = Array.from(document.querySelectorAll("input[type='radio']"));
  const groups = new Map(); // key -> { key, radios: [] }

  radios.forEach((radio) => {
    const tr = radio.closest("tr");
    let key;
    if (tr) {
      key = tr;
    } else if (radio.name) {
      key = "name:" + radio.name;
    } else {
      key = radio; // last resort: its own group
    }

    if (!groups.has(key)) groups.set(key, { key, radios: [] });
    groups.get(key).radios.push(radio);
  });

  // Only keep groups that actually look like a rating group (2+ radios).
  return Array.from(groups.values()).filter((g) => g.radios.length >= 2);
}

function selectRatingInGroup(group, targetRating) {
  const { radios } = group;

  // Strategy A: match by readable label text per radio.
  const labeled = radios.map((r) => ({ radio: r, label: getRadioLabelText(r) }));
  const directMatch = labeled.find((x) => matchesRating(x.label, targetRating));
  if (directMatch) {
    directMatch.radio.checked = true;
    directMatch.radio.dispatchEvent(new Event("input", { bubbles: true }));
    directMatch.radio.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // Strategy B: positional fallback using the table's column headers,
  // only used when labels on the radios themselves were not readable,
  // and only when the row has exactly 5 radios (Poor..Excellent).
  if (radios.length === 5) {
    const tr = radios[0].closest("tr");
    const headerTexts = tr ? getColumnHeadersForRow(tr) : null;

    if (headerTexts) {
      // Map each radio (in DOM order) to the header word at the same
      // left-to-right position among the rating columns.
      const ratingHeaderIdxs = headerTexts
        .map((t, i) => (RATING_ORDER.includes(t) ? i : -1))
        .filter((i) => i !== -1);

      if (ratingHeaderIdxs.length === 5) {
        const targetPos = RATING_ORDER.indexOf(normalize(targetRating));
        const radioIndex = ratingHeaderIdxs.indexOf(ratingHeaderIdxs[targetPos]);
        // radios are assumed to appear in the same left-to-right order
        // as the rating columns.
        const candidate = radios[targetPos];
        if (candidate) {
          candidate.checked = true;
          candidate.dispatchEvent(new Event("input", { bubbles: true }));
          candidate.dispatchEvent(new Event("change", { bubbles: true }));
          console.log(
            `${LOG_PREFIX} Used positional fallback (no readable labels) for a question.`
          );
          return true;
        }
      }
    } else {
      // No header found at all, but exactly 5 radios in fixed
      // Poor..Excellent order is the documented shape of this form —
      // use plain left-to-right position as a last resort.
      const targetPos = RATING_ORDER.indexOf(normalize(targetRating));
      const candidate = radios[targetPos];
      if (candidate) {
        candidate.checked = true;
        candidate.dispatchEvent(new Event("input", { bubbles: true }));
        candidate.dispatchEvent(new Event("change", { bubbles: true }));
        console.log(
          `${LOG_PREFIX} Used plain positional fallback (no header, no labels) for a question.`
        );
        return true;
      }
    }
  }

  return false;
}

function applyRatingToAllQuestions(targetRating) {
  console.log(`${LOG_PREFIX} Feedback form scan starting...`);

  const groups = groupRadiosIntoQuestions();
  console.log(`${LOG_PREFIX} Found ${groups.length} question group(s)`);

  let updated = 0;
  groups.forEach((group, i) => {
    const ok = selectRatingInGroup(group, targetRating);
    if (ok) {
      updated++;
    } else {
      console.log(`${LOG_PREFIX} Could not confidently match a radio in question group #${i + 1}`);
    }
  });

  console.log(`${LOG_PREFIX} Selected rating: ${targetRating}`);
  console.log(`${LOG_PREFIX} Updated ${updated}/${groups.length} questions`);

  return { updated, total: groups.length };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "APPLY_RATING") {
    const result = applyRatingToAllQuestions(message.rating);
    sendResponse(result);
  }
  return true;
});
