// Read-aloud (text-to-speech) for every page. CSP-safe: external self-origin
// script, no inline, no fetch — uses only the browser-native Web Speech API
// (window.speechSynthesis). Progressive enhancement: the trigger button ships
// hidden and is only revealed when the API is available, so unsupported
// browsers see no broken control.
(function () {
  "use strict";

  var synth = window.speechSynthesis;
  var button = document.getElementById("tts-toggle");
  if (!button || !synth || typeof window.SpeechSynthesisUtterance !== "function") {
    return;
  }

  // Reveal the control now that we know speech is supported.
  button.hidden = false;

  var ICON_PLAY = "🔊"; // 🔊
  var ICON_STOP = "⏹"; // ⏹
  var icon = button.querySelector(".tts-toggle-icon");
  var queue = [];
  var index = 0;
  var speaking = false;

  function setState(active) {
    speaking = active;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("aria-label", active ? "Stop reading this page" : "Listen to this page");
    button.setAttribute("title", active ? "Stop reading" : "Listen to this page");
    button.classList.toggle("is-speaking", active);
    if (icon) {
      icon.textContent = active ? ICON_STOP : ICON_PLAY;
    }
  }

  // Collect the readable text of the main content region. Hidden elements and
  // the search/results widgets are skipped so the reader stays on the article.
  // Standalone pages without a #main region (the self-contained simulations)
  // fall back to <body> so read-aloud still works there.
  function pageText() {
    var root = document.getElementById("main") || document.body;
    if (!root) {
      return "";
    }
    var clone = root.cloneNode(true);
    var drop = clone.querySelectorAll("script, style, noscript, [aria-hidden='true'], .site-search-results, #tts-toggle, .tts-fab");
    for (var i = 0; i < drop.length; i += 1) {
      drop[i].parentNode.removeChild(drop[i]);
    }
    return (clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  // Split into utterance-sized chunks on sentence boundaries. Some engines cap
  // a single utterance (~32k chars) and cut off long pages, so we queue chunks.
  function chunk(text) {
    var sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
    var chunks = [];
    var current = "";
    for (var i = 0; i < sentences.length; i += 1) {
      if ((current + sentences[i]).length > 240 && current) {
        chunks.push(current.trim());
        current = "";
      }
      current += sentences[i];
    }
    if (current.trim()) {
      chunks.push(current.trim());
    }
    return chunks;
  }

  function speakNext() {
    if (index >= queue.length) {
      stop();
      return;
    }
    var utterance = new window.SpeechSynthesisUtterance(queue[index]);
    utterance.lang = document.documentElement.lang || "en";
    utterance.onend = function () {
      index += 1;
      // Guard against late events firing after an explicit stop.
      if (speaking) {
        speakNext();
      }
    };
    utterance.onerror = function () {
      stop();
    };
    synth.speak(utterance);
  }

  function start() {
    var text = pageText();
    if (!text) {
      return;
    }
    synth.cancel();
    queue = chunk(text);
    index = 0;
    setState(true);
    speakNext();
  }

  function stop() {
    setState(false);
    queue = [];
    index = 0;
    synth.cancel();
  }

  button.addEventListener("click", function () {
    if (speaking) {
      stop();
    } else {
      start();
    }
  });

  // Cancel any in-flight speech when leaving the page so it does not bleed
  // across navigations (notably with the bfcache).
  window.addEventListener("pagehide", stop);
  window.addEventListener("beforeunload", stop);
})();
