(function () {
  const canvas = document.querySelector(".miu-canvas");
  if (!canvas) return;
  const preview =
    new URLSearchParams(location.search).has("editorPreview") &&
    parent !== window;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const looping = new Set([
    "rotate",
    "spin",
    "flicker",
    "pulse",
    "wiggle",
    "heartBeat",
    "swayBottom",
  ]);
  const prepared = new WeakSet();
  let started = false,
    queued = false;
  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                play(entry.target);
                observer.unobserve(entry.target);
              }
            }
          },
          {
            root: null,
            rootMargin: "0px 0px -12% 0px",
            threshold: [0.08, 0.15, 0.22],
          },
        )
      : null;

  function play(element) {
    if (element.dataset.revealState !== "pending") return;
    const preset = element.dataset.animPreset;
    const duration = Math.max(0, Number(element.dataset.animDuration) || 600);
    const delay = Math.max(0, Number(element.dataset.animDelay) || 0);
    let easing = element.dataset.animEasing || "cubic-bezier(0.2,0.8,0.2,1)";
    if (preset === "swayBottom") easing = "cubic-bezier(0.45,0.05,0.55,0.95)";
    if (preset === "typewriter") easing = "steps(14,end)";
    const loop = element.dataset.animLoop === "1" || looping.has(preset);
    const overrides = [...element.style]
      .filter(
        (key) =>
          key.startsWith("animation") &&
          element.style.getPropertyPriority(key) === "important",
      )
      .map((key) => [key, element.style.getPropertyValue(key)]);
    element.dataset.revealState = "running";
    element.style.animation = `miu-${preset} ${duration}ms ${easing} ${delay}ms both${loop ? " infinite" : ""}`;
    overrides.forEach(([key, value]) =>
      element.style.setProperty(key, value, "important"),
    );
    if (element.dataset.animDistance)
      element.style.setProperty(
        "--miu-anim-distance",
        element.dataset.animDistance + "px",
      );
    element.__miuAnimApplied = true;
    const hideAfter = Number(element.dataset.animHideAfter);
    if (!loop && Number.isFinite(hideAfter) && hideAfter > 0) {
      clearTimeout(element.__miuHideTimer);
      element.__miuHideTimer = setTimeout(() => {
        if (!element.isConnected) return;
        element.style.display = "none";
        element.dataset.miuHiddenByAnim = "1";
      }, hideAfter + delay);
    }
  }
  function staticView(element) {
    observer?.unobserve(element);
    element.dataset.revealState = "static";
    element.style.animation = "none";
  }
  function observe(element) {
    if (observer) observer.observe(element);
    else play(element);
  }
  function refresh() {
    for (const element of canvas.querySelectorAll("[data-anim-preset]")) {
      if (preview || reduced.matches) {
        staticView(element);
        continue;
      }
      if (
        prepared.has(element) ||
        !element.dataset.animPreset ||
        element.dataset.animPreset === "none"
      )
        continue;
      prepared.add(element);
      element.dataset.revealState = "pending";
      if (started) observe(element);
    }
    const cover = document.getElementById("miuOpening");
    if (
      !preview &&
      (!cover ||
        cover.dataset.open === "0" ||
        getComputedStyle(cover).display === "none")
    )
      start();
  }
  function start() {
    if (started || preview || reduced.matches) return;
    started = true;
    for (const element of canvas.querySelectorAll(
      '[data-reveal-state="pending"]',
    ))
      observe(element);
  }
  window.weddingReveal = { refresh };
  window.addEventListener("miu:opening:willClose", start);
  window.addEventListener("miu:opening:closed", start);
  reduced.addEventListener("change", () => {
    if (reduced.matches) refresh();
  });
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      refresh();
    });
  }).observe(canvas, { childList: true, subtree: true });
  refresh();
})();
