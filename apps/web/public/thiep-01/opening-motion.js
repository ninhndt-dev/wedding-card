(function () {
  const cover = document.getElementById("miuOpening"),
    stage = document.getElementById("miuOpeningSides");
  if (!cover || !stage) return;
  const preview =
    new URLSearchParams(location.search).has("editorPreview") &&
    window.parent !== window;
  const root = document.documentElement,
    body = document.body;
  const buttons = [
    document.getElementById("miuOpeningBtn"),
    document.getElementById("miuOpeningCtaBtn"),
  ].filter(Boolean);
  let running = false,
    closed = false,
    willCloseSent = false,
    timer = null,
    leadTimer = null,
    animations = [];
  const event = (name) =>
    window.dispatchEvent(new Event("miu:opening:" + name));
  function reveal() {
    if (willCloseSent) return;
    willCloseSent = true;
    event("willClose");
  }
  function syncSize() {
    if (running) return;
    const main = document.querySelector(".miu-stage");
    const width = Math.min(main?.clientWidth || 575, innerWidth);
    stage.style.setProperty("--miu-opening-w", Math.round(width) + "px");
  }
  function finish() {
    if (closed) return;
    const focusInside = cover.contains(document.activeElement);
    closed = true;
    running = false;
    clearTimeout(timer);
    clearTimeout(leadTimer);
    reveal();
    cover.style.display = "none";
    cover.dataset.open = "0";
    cover.dataset.motion = "closed";
    cover.setAttribute("aria-hidden", "true");
    cover.setAttribute("aria-busy", "false");
    cover.inert = true;
    delete root.dataset.editorOpening;
    root.style.overflow = "";
    body.style.overflow = "";
    for (const animation of animations) animation.cancel();
    animations = [];
    buttons.forEach((b) => {
      b.disabled = false;
      b.setAttribute("aria-expanded", "true");
    });
    if (focusInside && !preview) {
      const main = document.querySelector(".miu-stage");
      if (main) {
        main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }
    }
    event("closed");
  }
  function animate(el, frames, options) {
    if (!el) return;
    const animation = el.animate(frames, { fill: "both", ...options });
    animations.push(animation);
    return animation.finished.catch(() => {});
  }
  function play() {
    if (running || cover.dataset.open === "0") return;
    running = true;
    closed = false;
    willCloseSent = false;
    cover.dataset.motion = "opening";
    cover.setAttribute("aria-busy", "true");
    buttons.forEach((b) => (b.disabled = true));
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || !stage.animate) {
      reveal();
      if (stage.animate) {
        animate(stage, [{ opacity: 1 }, { opacity: 0 }], {
          duration: 140,
          easing: "linear",
        }).then(finish);
        timer = setTimeout(finish, 220);
      } else finish();
      return;
    }
    // Let the flowers and seal clear the envelope before flipping its top flap.
    const flowersLeft = stage.querySelectorAll(
      ".card-side.left .miu-env-flower-left",
    );
    const flowersRight = stage.querySelectorAll(
      ".card-side.left .miu-env-flower-right",
    );
    const seal = stage.querySelector(".card-side.left .miu-env-nutthiep");
    const flap = stage.querySelector(".card-side.left .miu-env-flap");
    const letter = stage.querySelector(".card-side.left .miu-env-letter");
    const hint = stage.querySelector(".card-side.left .miu-env-click-btn");
    const work = [
      ...[...flowersLeft].map((flower) =>
        animate(
          flower,
          [
            { translate: "0 0", opacity: 1 },
            { translate: "-130px -12px", opacity: 0 },
          ],
          { duration: 650, easing: "cubic-bezier(.22,.61,.36,1)" },
        ),
      ),
      ...[...flowersRight].map((flower) =>
        animate(
          flower,
          [
            { translate: "0 0", opacity: 1 },
            { translate: "130px 12px", opacity: 0 },
          ],
          { duration: 650, easing: "cubic-bezier(.22,.61,.36,1)" },
        ),
      ),
      animate(
        seal,
        [
          { translate: "0 0", scale: "1", opacity: 1 },
          { translate: "0 75px", scale: ".95", opacity: 1, offset: 0.55 },
          { translate: "0 150px", scale: ".78", opacity: 0 },
        ],
        { duration: 650, delay: 300, easing: "ease-in" },
      ),
      animate(
        flap,
        [{ transform: "rotateX(0deg)" }, { transform: "rotateX(168deg)" }],
        { duration: 650, delay: 980, easing: "cubic-bezier(.25,.8,.25,1)" },
      ),
      animate(letter, [{ translate: "0 12px" }, { translate: "0 -38px" }], {
        duration: 500,
        delay: 1130,
        easing: "cubic-bezier(.22,.61,.36,1)",
      }),
      animate(stage, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 800,
        delay: 1580,
        easing: "ease-in-out",
      }),
      animate(cover, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 850,
        delay: 1600,
        easing: "ease-in-out",
      }),
    ];
    animate(hint, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 180,
      easing: "ease-out",
    });
    leadTimer = setTimeout(reveal, 1600);
    timer = setTimeout(finish, 2600);
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
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    buttons.forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  // Decode the small cover images and the first photo before a guest taps.
  for (const img of [
    ...stage.querySelectorAll("img"),
    document.querySelector(".miu-canvas img"),
  ].filter(Boolean)) {
    img.decoding = "async";
    img.decode?.().catch(() => {});
  }
})();
