// Runs in <head> before the page paints (a plain script, not a module),
// so the chosen colour theme never flashes.
(function () {
  var theme = null;
  try { theme = localStorage.getItem('komorebi-theme'); } catch (e) { /* storage blocked */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
