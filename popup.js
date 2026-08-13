const select = document.getElementById("ratingSelect");
const applyBtn = document.getElementById("applyBtn");
const statusEl = document.getElementById("status");

chrome.storage?.local?.get(["lastRating"], (res) => {
  if (res && res.lastRating) select.value = res.lastRating;
});

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = type || "";
}

applyBtn.addEventListener("click", async () => {
  const rating = select.value;

  applyBtn.disabled = true;
  setStatus("Applying...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("samvidha.iare.ac.in")) {
      setStatus("Open the IARE feedback page first.", "error");
      applyBtn.disabled = false;
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { type: "APPLY_RATING", rating },
      (response) => {
        applyBtn.disabled = false;

        if (chrome.runtime.lastError) {
          setStatus("Couldn't reach the page. Reload it and try again.", "error");
          return;
        }

        if (!response || response.total === 0) {
          setStatus(
            "No feedback rating fields found.\nPlease make sure the IARE feedback form is open.",
            "error"
          );
          return;
        }

        chrome.storage?.local?.set({ lastRating: rating });

        if (response.updated === response.total) {
          setStatus(`Successfully selected "${rating}" for ${response.updated} question(s).`, "success");
        } else {
          setStatus(
            `Rating applied to ${response.updated} question(s).\n${response.total - response.updated} question(s) could not be detected.`,
            "partial"
          );
        }
      }
    );
  } catch (e) {
    applyBtn.disabled = false;
    setStatus("Something went wrong: " + e.message, "error");
  }
});
