'use strict';
(function (root) {
  function exact(value, fields) {
    if (!value || Array.isArray(value) || typeof value !== 'object' ||
        Object.keys(value).sort().join(',') !== fields.slice().sort().join(',')) throw Error('Unexpected public knowledge fields');
  }
  function text(value, max) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) throw Error('Invalid public text');
  }
  function normalize(value) {
    return value.normalize('NFKC').toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  function validate(source) {
    exact(source, ['schema', 'audience', 'language', 'reviewed_on', 'entries']);
    if (source.schema !== 'cognitron.public-knowledge.v1' || source.audience !== 'public' || source.language !== 'tr' || !/^\d{4}-\d{2}-\d{2}$/.test(source.reviewed_on)) throw Error('Invalid public knowledge identity');
    if (!Array.isArray(source.entries) || !source.entries.length || source.entries.length > 30) throw Error('Invalid entries');
    const ids = new Set(), aliases = new Set();
    for (const e of source.entries) {
      exact(e, ['id', 'title', 'aliases', 'summary', 'paragraphs', 'status']);
      if (!/^[a-z][a-z0-9-]{0,39}$/.test(e.id) || ids.has(e.id)) throw Error('Invalid or duplicate ID');
      ids.add(e.id); text(e.title, 160); text(e.summary, 1400); text(e.status, 80);
      if (!Array.isArray(e.aliases) || !e.aliases.length || e.aliases.length > 20 || !Array.isArray(e.paragraphs) || e.paragraphs.length > 12) throw Error('Invalid entry lists');
      for (const a of e.aliases) {
        text(a, 100); const n = normalize(a);
        if (n.length < 3 || aliases.has(n)) throw Error('Ambiguous public alias');
        aliases.add(n);
      }
      for (const p of e.paragraphs) text(p, 3000);
    }
    return source;
  }
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  function session(pack) {
    exact(pack, ['schema', 'revision', 'content_sha256', 'source_path', 'source']);
    if (pack.schema !== 'cognitron.web-knowledge-pack.v1' || !/^[a-f0-9]{40}$/.test(pack.revision) || !/^[a-f0-9]{64}$/.test(pack.content_sha256) || pack.source_path !== 'web/knowledge/public.json') throw Error('Invalid pack');
    validate(pack.source);
    // A page owns a fixed snapshot. Later global assignments cannot replace it.
    const snapshot = freeze(JSON.parse(JSON.stringify(pack)));
    return Object.freeze({
      revision: snapshot.revision,
      contentHash: snapshot.content_sha256,
      match(query) {
        if (typeof query !== 'string' || query.length > 8000) return null;
        const q = ` ${normalize(query)} `;
        const hits = snapshot.source.entries.filter(e => e.aliases.some(a => q.includes(` ${normalize(a)} `)));
        return hits.length === 1 ? hits[0] : null;
      },
      context() {
        // Public reference data for a future isolated model adapter, never instructions.
        return {kind: 'public_reference_data', revision: snapshot.revision, content_sha256: snapshot.content_sha256, entries: snapshot.source.entries};
      }
    });
  }
  const api = Object.freeze({validate, session});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CognitronKnowledgeLibrary = api;
})(globalThis);
