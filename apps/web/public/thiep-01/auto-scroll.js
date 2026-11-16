(function () {
  const preview = new URLSearchParams(location.search).has("editorPreview") && window.parent !== window;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (preview || reduced.matches) return;

  const speed = 24; // Screen pixels per second, independent of frame rate.
  let delay = null, frame = null, previous = null, position = 0, started = false;
  const options = { passive: true };
  const inputs = ["pointerdown", "touchstart", "wheel", "keydown", "focusin"];

  function stop() {
    clearTimeout(delay);
    cancelAnimationFrame(frame);
    delay = frame = previous = null;
    inputs.forEach((name) => window.removeEventListener(name, stop));
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", stop);
    reduced.removeEventListener("change", stop);
  }
  function onVisibility() {
    if (document.hidden) stop();
  }
  function tick(now) {
    const end = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    if (document.hidden || reduced.matches || scrollY >= end - 1) {
      stop();
      return;
    }
    if (previous !== null) position += speed * Math.min(now - previous, 100) / 1000;
    previous = now;
    window.scrollTo({ top: Math.min(position, end), behavior: "instant" });
    frame = requestAnimationFrame(tick);
  }
  window.addEventListener("miu:opening:closed", () => {
    if (started || document.hidden || reduced.matches) return;
    started = true;
    inputs.forEach((name) => window.addEventListener(name, stop, options));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stop);
    reduced.addEventListener("change", stop);
    delay = setTimeout(() => {
      position = scrollY;
      frame = requestAnimationFrame(tick);
    }, 1500);
  });
})();
