'use strict';
(() => {
  const knowledge = window.CognitronKnowledgeLibrary.session(window.CognitronKnowledgePack);
  Object.defineProperty(window, 'CognitronKnowledge', {value: knowledge, writable: false});
  const form = document.querySelector('form');
  const input = document.getElementById('message');
  const log = document.getElementById('conversation');
  // This script loads before app.js, so its capture listener handles known public
  // topics before the existing generic preview fallback. No visitor transport.
  form.addEventListener('submit', event => {
    window.CognitronSession?.check();
    const message = input.value.trim();
    const entry = knowledge.match(message);
    if (!entry) return;
    event.preventDefault(); event.stopImmediatePropagation();
    for (const [value, kind] of [[message, 'user'], [entry.summary, 'interface']]) {
      const p = document.createElement('p'); p.className = `turn ${kind}`; p.textContent = value; log.append(p);
    }
    input.value = ''; input.style.height = 'auto'; log.scrollTop = log.scrollHeight;
    window.CognitronContent?.open();
    const body = document.querySelector('#content-window .window-body');
    const title = document.getElementById('content-window-title');
    const note = document.querySelector('#content-window .window-note');
    if (body && title && note) {
      title.textContent = entry.title;
      body.replaceChildren();
      for (const text of [entry.summary, ...entry.paragraphs]) {
        const p = document.createElement('p'); p.textContent = text; body.append(p);
      }
      note.textContent = `Ürün bilgisi · ${knowledge.revision.slice(0, 7)} · ${knowledge.contentHash.slice(0, 8)}`;
    }
    window.dispatchEvent(new CustomEvent('cognitron:public-content', {detail: {topic: entry.id}}));
  }, {capture: true});
  // The existing privacy controller clears conversation, input and popup body.
  // This note is also transient UI; the underlying public package is not visitor data.
  for (const name of ['pagehide', 'blur']) addEventListener(name, () => {
    const note = document.querySelector('#content-window .window-note');
    if (note) note.textContent = '';
  });
})();
