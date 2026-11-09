(function () {
  const cover = document.getElementById("miuOpening");
  const stage = document.getElementById("miuOpeningSides");
  if (!cover || !stage) return;
  const preview =
    new URLSearchParams(location.search).has("editorPreview") &&
    parent !== window;
  const buttons = [
    document.getElementById("miuOpeningBtn"),
    document.getElementById("miuOpeningCtaBtn"),
  ].filter(Boolean);
  let running = false,
    closed = false,
    revealed = false,
    timer;
  let animations = [];
  const event = (name) =>
    window.dispatchEvent(new Event("miu:opening:" + name));

  function syncSize() {
    if (running) return;
    const main = document.querySelector(".miu-stage");
    stage.style.setProperty(
      "--miu-opening-w",
      Math.round(Math.min(main?.clientWidth || 575, innerWidth)) + "px",
    );
  }
  function reveal() {
    if (revealed) return;
    revealed = true;
    event("willClose");
  }
  function finish() {
    if (closed) return;
    const focusInside = cover.contains(document.activeElement);
    closed = true;
    running = false;
    clearTimeout(timer);
    reveal();
    cover.style.display = "none";
    cover.dataset.open = "0";
    cover.dataset.motion = "closed";
    cover.setAttribute("aria-hidden", "true");
    cover.setAttribute("aria-busy", "false");
    cover.inert = true;
    delete document.documentElement.dataset.editorOpening;
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    animations.forEach((animation) => animation.cancel());
    animations = [];
    buttons.forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-expanded", "true");
    });
    if (focusInside && !preview) {
      const main = document.querySelector(".miu-stage");
      main?.setAttribute("tabindex", "-1");
      main?.focus({ preventScroll: true });
    }
    event("closed");
  }
  function animate(element, frames, options) {
    if (!element) return Promise.resolve();
    const animation = element.animate(frames, { fill: "both", ...options });
    animations.push(animation);
    return animation.finished.catch(() => {});
  }
  function play() {
    if (running || cover.dataset.open === "0") return;
    syncSize();
    running = true;
    closed = false;
    revealed = false;
    cover.dataset.motion = "opening";
    cover.setAttribute("aria-busy", "true");
    buttons.forEach((button) => (button.disabled = true));
    // The reference starts the page entrances as soon as the cover starts moving.
    reveal();
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !stage.animate
    ) {
      if (!stage.animate) {
        finish();
        return;
      }
      animate(stage, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 140,
        easing: "linear",
      }).then(finish);
      timer = setTimeout(finish, 220);
      return;
    }
    // Reference: two complete envelope layers travel in opposite vertical directions.
    // Keep the white paper visible for the entire 1000 ms transition.
    const options = { duration: 1000, easing: "cubic-bezier(.22,.61,.36,1)" };
    const work = [
      animate(
        stage.querySelector(".card-side.left"),
        [{ transform: "translateY(0)" }, { transform: "translateY(-115%)" }],
        options,
      ),
      animate(
        stage.querySelector(".card-side.right"),
        [{ transform: "translateY(0)" }, { transform: "translateY(115%)" }],
        options,
      ),
    ];
    timer = setTimeout(finish, 1150);
    Promise.all(work).then(finish);
  }
  cover.addEventListener("click", () => {
    if (!preview || document.documentElement.dataset.editorOpening === "1")
      play();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && running) finish();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) finish();
  });
  window.addEventListener("resize", syncSize, { passive: true });
  window.weddingOpening = { play };
  syncSize();
  cover.dataset.motion = "idle";
  cover.inert = false;
  if (!preview) {
    cover.style.display = "block";
    cover.dataset.open = "1";
    cover.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    buttons.forEach((button) => button.setAttribute("aria-expanded", "false"));
  }
  for (const img of [
    ...stage.querySelectorAll("img"),
    document.querySelector(".miu-canvas img"),
  ].filter(Boolean)) {
    img.decoding = "async";
    img.decode?.().catch(() => {});
  }
})();
