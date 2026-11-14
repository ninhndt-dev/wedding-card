(function () {
  const canvas = document.querySelector(".miu-canvas");
  if (!canvas) return;
  const preview =
    new URLSearchParams(location.search).has("editorPreview") &&
    parent !== window;
  const controls =
    "a,button,input,select,textarea,label,summary,video,audio,iframe";
  let dialog,
    image,
    viewport,
    stage,
    counter,
    caption,
    original,
    zoomButton,
    status;
  let items = [],
    index = 0,
    zoomed = false,
    previousFocus,
    previousOverflow,
    queued = false,
    touch;

  function source(img) {
    const raw =
      img.dataset.fullSrc ||
      img.closest("[data-miu-album-item]")?.dataset.src ||
      img.src ||
      img.currentSrc;
    try {
      const url = new URL(raw, document.baseURI);
      return ["http:", "https:", "blob:"].includes(url.protocol) ||
        /^data:image\/(png|jpeg|webp|gif);/i.test(raw)
        ? url.href
        : "";
    } catch {
      return "";
    }
  }
  function eligible(img) {
    if (
      !(img instanceof HTMLImageElement) ||
      img.closest(
        "#weddingPhotoViewer,#miuOpening,#miuBootLoading,#miuAlbumModal,template",
      )
    )
      return false;
    if (!img.closest(".miu-canvas")) return false;
    const inAlbum = img.closest(
      "[data-miu-album-item],[data-miu-album-main],.ww-album",
    );
    if (!inAlbum && img.dataset.photoKind !== "wedding") return false;
    if (!img.getClientRects().length || !source(img)) return false;
    const control = img.closest(controls);
    if (!control) return true;
    return (
      !!control.matches(
        "[data-miu-album-item],[data-miu-album-main],.ww-album a",
      ) ||
      (control.matches("a") && control.href === source(img))
    );
  }
  function candidates() {
    return [
      ...document.querySelectorAll(
        '.miu-canvas img,[role="dialog"] img,.miu-modal-overlay img,#miuRuntimeModal img',
      ),
    ].filter(eligible);
  }
  function description(img) {
    return (
      img.closest("[data-miu-album-item]")?.title ||
      (img.alt && img.alt !== "image" ? img.alt : "Ảnh trong thiệp")
    );
  }
  function refresh() {
    for (const img of document.querySelectorAll('img[data-photo-view="1"]')) {
      if (!eligible(img)) {
        delete img.dataset.photoView;
        img.removeAttribute("tabindex");
        img.removeAttribute("role");
        img.removeAttribute("aria-haspopup");
        img.removeAttribute("aria-label");
      }
    }
    for (const img of candidates()) {
      img.dataset.photoView = "1";
      if (!img.closest(controls)) {
        img.tabIndex = 0;
        img.setAttribute("role", "button");
        img.setAttribute("aria-haspopup", "dialog");
        img.setAttribute("aria-label", "Xem ảnh: " + description(img));
      }
    }
  }
  function prepare() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.id = "weddingPhotoViewer";
    dialog.setAttribute("aria-label", "Xem ảnh phóng lớn");
    dialog.innerHTML =
      '<header class="photo-toolbar"><span data-photo-count aria-live="polite"></span><button type="button" data-photo-zoom aria-label="Xem ảnh ở kích thước gốc">100%</button><a data-photo-original target="_blank" rel="noopener noreferrer">Ảnh gốc ↗</a><button type="button" data-photo-close aria-label="Đóng ảnh">×</button></header><div class="photo-main"><div class="photo-viewport"><div class="photo-stage"><img class="photo-image" alt="" decoding="async"></div></div><button type="button" class="photo-nav photo-prev" data-photo-prev aria-label="Ảnh trước">‹</button><button type="button" class="photo-nav photo-next" data-photo-next aria-label="Ảnh tiếp theo">›</button></div><footer class="photo-footer"><p data-photo-caption></p><p data-photo-status role="status"></p><small>Vuốt hoặc dùng phím ← → để chuyển ảnh · Esc để đóng</small></footer>';
    document.body.appendChild(dialog);
    image = dialog.querySelector(".photo-image");
    viewport = dialog.querySelector(".photo-viewport");
    stage = dialog.querySelector(".photo-stage");
    counter = dialog.querySelector("[data-photo-count]");
    caption = dialog.querySelector("[data-photo-caption]");
    status = dialog.querySelector("[data-photo-status]");
    original = dialog.querySelector("[data-photo-original]");
    zoomButton = dialog.querySelector("[data-photo-zoom]");
    dialog.querySelector("[data-photo-close]").addEventListener("click", close);
    dialog
      .querySelector("[data-photo-prev]")
      .addEventListener("click", () => step(-1));
    dialog
      .querySelector("[data-photo-next]")
      .addEventListener("click", () => step(1));
    zoomButton.addEventListener("click", toggleZoom);
    image.addEventListener("dblclick", toggleZoom);
    image.addEventListener("load", () => {
      image.hidden = false;
      status.textContent = "";
    });
    image.addEventListener("error", () => {
      image.hidden = true;
      status.textContent =
        "Không tải được ảnh này. Bạn có thể chuyển ảnh hoặc thử mở ảnh gốc.";
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener("close", () => {
      if (!dialog.open) restore();
    });
    dialog.addEventListener("click", (event) => {
      if (
        !zoomed &&
        [dialog, viewport, stage, dialog.querySelector(".photo-main")].includes(
          event.target,
        )
      )
        close();
    });
    viewport.addEventListener("pointerdown", (event) => {
      touch =
        !zoomed && event.pointerType === "touch"
          ? { x: event.clientX, y: event.clientY }
          : null;
    });
    viewport.addEventListener("pointerup", (event) => {
      if (!touch) return;
      const dx = event.clientX - touch.x,
        dy = event.clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
        step(dx < 0 ? 1 : -1);
    });
    viewport.addEventListener("pointercancel", () => {
      touch = null;
    });
  }
  function setZoom(value) {
    zoomed = value;
    dialog.classList.toggle("is-zoomed", zoomed);
    zoomButton.textContent = zoomed ? "Vừa màn hình" : "100%";
    zoomButton.setAttribute(
      "aria-label",
      zoomed ? "Thu ảnh vừa màn hình" : "Xem ảnh ở kích thước gốc",
    );
    zoomButton.setAttribute("aria-pressed", String(zoomed));
    requestAnimationFrame(() => {
      viewport.scrollLeft = zoomed
        ? (viewport.scrollWidth - viewport.clientWidth) / 2
        : 0;
      viewport.scrollTop = zoomed
        ? (viewport.scrollHeight - viewport.clientHeight) / 2
        : 0;
    });
  }
  function toggleZoom() {
    setZoom(!zoomed);
  }
  function show() {
    const selected = items[index];
    setZoom(false);
    image.hidden = false;
    status.textContent = "Đang tải ảnh…";
    caption.textContent = selected.caption;
    counter.textContent = index + 1 + " / " + items.length;
    original.href = selected.src;
    image.alt = selected.caption;
    image.src = selected.src;
    dialog
      .querySelectorAll(".photo-nav")
      .forEach((button) => (button.hidden = items.length < 2));
    // Preload adjacent images only, rather than downloading every original at once.
    for (const next of new Set([
      (index + 1) % items.length,
      (index - 1 + items.length) % items.length,
    ])) {
      if (next !== index) {
        const preload = new Image();
        preload.src =
          window.weddingMediaPreview?.(items[next].src, 960) || items[next].src;
      }
    }
  }
  function open(img) {
    if (!eligible(img)) return;
    prepare();
    const all = candidates();
    if (!all.includes(img)) all.push(img);
    items = [
      ...new Map(
        all.map((node) => [
          source(node),
          { src: source(node), caption: description(node) },
        ]),
      ).values(),
    ];
    index = items.findIndex((item) => item.src === source(img));
    if (!dialog.open) {
      previousFocus = img;
      previousOverflow = {
        root: document.documentElement.style.overflow,
        body: document.body.style.overflow,
      };
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      dialog.showModal();
    }
    show();
    dialog.querySelector("[data-photo-close]").focus({ preventScroll: true });
  }
  function restore() {
    if (!previousOverflow) return;
    const saved = previousOverflow;
    previousOverflow = null;
    document.documentElement.style.overflow = saved.root;
    document.body.style.overflow = saved.body;
    if (previousFocus?.isConnected)
      previousFocus.focus({ preventScroll: true });
  }
  function close() {
    if (dialog?.open) {
      dialog.close();
      restore();
    }
  }
  function step(direction) {
    if (!dialog?.open || !items.length) return;
    index = (index + direction + items.length) % items.length;
    show();
  }
  function editing() {
    return (
      preview && document.documentElement.dataset.editorInteractive !== "1"
    );
  }
  function openingVisible() {
    const cover = document.getElementById("miuOpening");
    return (
      cover?.dataset.open === "1" && getComputedStyle(cover).display !== "none"
    );
  }
  function hit(target, event) {
    if (target.closest?.("#weddingPhotoViewer,#miuOpening,#miuBootLoading"))
      return null;
    const control = target.closest?.(controls);
    if (
      control &&
      !control.matches(
        "[data-miu-album-item],[data-miu-album-main],.ww-album a",
      )
    ) {
      if (!(
        control.matches("a") &&
        [...control.querySelectorAll("img")].some(
          (img) => control.href === source(img),
        )
      ))
        return null;
    }
    if (eligible(target)) return target;
    const node = target.closest?.(
      "[data-node-id],[data-miu-album-item],.ww-album a",
    );
    const images = node
      ? [...node.querySelectorAll("img")].filter(eligible)
      : [];
    if (images.length === 1) return images[0];
    // Text and gradient layers may cover a photo without being its descendants.
    return (
      document.elementsFromPoint(event.clientX, event.clientY).find(eligible) ||
      null
    );
  }
  window.addEventListener(
    "click",
    (event) => {
      if (editing() || openingVisible() || !(event.target instanceof Element))
        return;
      const img = hit(event.target, event);
      if (!img) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open(img);
    },
    true,
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (dialog?.open) {
        if (
          ["Escape", "ArrowLeft", "ArrowRight", "Home", "End"].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.key === "Escape") close();
          else if (event.key === "ArrowLeft") step(-1);
          else if (event.key === "ArrowRight") step(1);
          else {
            index = event.key === "Home" ? 0 : items.length - 1;
            show();
          }
        }
      } else if (
        !editing() &&
        !openingVisible() &&
        ["Enter", " "].includes(event.key) &&
        eligible(event.target)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        open(event.target);
      }
    },
    true,
  );
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      refresh();
    });
  }).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "data-full-src", "data-photo-kind"],
  });
  refresh();
})();
