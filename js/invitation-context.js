/* Preserve invitations across authentication. Never store session credentials here. */
(() => {
  const valid = {friendInvite: /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, game: /^[A-Z0-9]{8}$/i};
  const memory = {};
  const key = name => 'myevent:invitation:' + name;
  function get(name) {
    const incoming = new URL(location.href).searchParams.get(name);
    if (incoming !== null) {
      if (!valid[name]?.test(incoming)) return incoming;
      memory[name] = {value: incoming, expires: Date.now() + 7 * 86400000};
      try { localStorage.setItem(key(name), JSON.stringify(memory[name])); } catch (_) {}
      return incoming;
    }
    let saved = memory[name];
    try { saved ||= JSON.parse(localStorage.getItem(key(name)) || 'null'); } catch (_) {}
    return saved?.expires > Date.now() && valid[name]?.test(saved.value) ? saved.value : null;
  }
  function clear(name) {
    delete memory[name];
    try { localStorage.removeItem(key(name)); } catch (_) {}
    const url = new URL(location.href); url.searchParams.delete(name);
    history.replaceState(history.state, '', url);
  }
  function redirect() {
    const url = new URL(location.pathname, location.origin);
    for (const name of Object.keys(valid)) { const value = get(name); if (valid[name].test(value || '')) url.searchParams.set(name, value); }
    return url.href;
  }
  Object.keys(valid).forEach(get);
  window.myeventInvitations = {get, clear, redirect};
})();
