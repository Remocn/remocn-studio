import { post, route } from "./bridge";
import { managedIdentity, managedRoot } from "./managed-objects";
import { nearText, OVERLAY_ATTR } from "./picker";
import {
  elementsAt,
  focusSurface,
  lockCamera,
  onViewChange,
  overlayRoot,
  parentAcrossRoot,
  styleRoot,
} from "./surface";

const FIELD = "data-studio-text-field";
const HIDDEN = "data-remocn-editing-text";
const TYPOGRAPHY = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-stretch",
  "font-kerning",
  "font-feature-settings",
  "font-variation-settings",
  "font-variant",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-transform",
  "text-indent",
  "text-decoration",
  "text-shadow",
  "color",
  "direction",
  "tab-size",
] as const;

interface Candidate {
  field: string | null;
  node: HTMLElement;
  text: string;
}

interface Request {
  candidates: Candidate[];
  generation: string;
  objectId: string;
  requestId: string;
  video: string;
}

interface Editor {
  node: HTMLElement;
  restore: () => void;
  textarea: HTMLTextAreaElement;
  update: () => void;
  waiting: boolean;
}

export function createInlineTextEditor(
  container: HTMLElement,
  accent: string,
  depth: number,
  onChange: () => void
) {
  let request: Request | null = null;
  let editor: Editor | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  const notice = document.createElement("div");
  notice.setAttribute(OVERLAY_ATTR, "");
  notice.setAttribute("role", "status");
  Object.assign(notice.style, {
    background: "#222",
    borderRadius: "4px",
    boxShadow: "0 2px 8px #0004",
    color: "#f3f3f3",
    display: "none",
    font: "12px/1.4 system-ui, sans-serif",
    maxWidth: "min(320px, calc(100vw - 16px))",
    padding: "6px 8px",
    pointerEvents: "none",
    position: "fixed",
    zIndex: String(depth + 1),
  });
  overlayRoot().append(notice);

  const explain = (message: string, node?: HTMLElement) => {
    const rect =
      node?.getBoundingClientRect() ?? container.getBoundingClientRect();
    notice.textContent = message;
    notice.style.display = "block";
    notice.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 328))}px`;
    notice.style.top = `${Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 72))}px`;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.style.display = "none";
    }, 5000);
  };

  const clear = () => {
    clearTimeout(timer);
    const previous = editor;
    editor = null;
    lockCamera(notice, false);
    request = null;
    previous?.restore();
    onChange();
  };

  const cancel = () => {
    if (request !== null) {
      post({ requestId: request.requestId, type: "studio.text.cancel" });
    }
    clear();
    notice.style.display = "none";
  };

  const save = () => {
    if (editor === null || request === null || editor.waiting) {
      return;
    }
    editor.waiting = true;
    editor.textarea.readOnly = true;
    post({
      requestId: request.requestId,
      type: "studio.text.commit",
      value: editor.textarea.value,
    });
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (editor !== null) {
        editor.waiting = false;
        editor.textarea.readOnly = false;
        explain(
          "The editor did not respond. Your text is still here; try saving again.",
          editor.node
        );
      }
    }, 6000);
  };
  const onBlur = () => {
    if (editor === null) {
      cancel();
    } else {
      save();
    }
  };
  window.addEventListener("blur", onBlur);

  const open = (candidate: Candidate, value: string, label: string) => {
    const { node } = candidate;
    if (!(node.isConnected && canOverlay(node))) {
      cancel();
      return;
    }
    const style = getComputedStyle(node);
    const textarea = document.createElement("textarea");
    textarea.setAttribute(OVERLAY_ATTR, "");
    textarea.setAttribute("aria-label", label);
    textarea.title =
      "Click outside or press ⌘/Ctrl+Enter to save. Escape cancels.";
    textarea.rows = 1;
    textarea.value = value;
    for (const property of TYPOGRAPHY) {
      textarea.style.setProperty(property, style.getPropertyValue(property));
    }
    Object.assign(textarea.style, {
      appearance: "none",
      background: "transparent",
      border: "0",
      borderRadius: "0",
      boxSizing: "border-box",
      caretColor: style.color,
      cursor: "text",
      display: "block",
      margin: "0",
      outline: `1px solid ${accent}`,
      outlineOffset: "2px",
      overflowWrap: "break-word",
      padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
      pointerEvents: "auto",
      position: "fixed",
      resize: "none",
      transformOrigin: "top left",
      whiteSpace: "pre-wrap",
      zIndex: String(depth),
    });
    const oldHidden = node.getAttribute(HIDDEN);
    const token = crypto.randomUUID();
    const hide = document.createElement("style");
    hide.setAttribute(OVERLAY_ATTR, "");
    hide.textContent = `[${HIDDEN}="${token}"], [${HIDDEN}="${token}"] * {
      color: transparent !important;
      -webkit-text-fill-color: transparent !important;
      text-shadow: none !important;
      text-decoration-color: transparent !important;
    }`;
    node.setAttribute(HIDDEN, token);
    styleRoot().append(hide);
    overlayRoot().append(textarea);

    const update = () => {
      if (!(node.isConnected && canOverlay(node))) {
        cancel();
        return;
      }
      const current = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const sx = rect.width / width;
      const sy = rect.height / height;
      const borderX = Number.parseFloat(current.borderLeftWidth) || 0;
      const borderY = Number.parseFloat(current.borderTopWidth) || 0;
      textarea.style.left = `${rect.left + borderX * sx}px`;
      textarea.style.top = `${rect.top + borderY * sy}px`;
      const borderRight = Number.parseFloat(current.borderRightWidth) || 0;
      textarea.style.width = `${node.clientWidth || Math.max(1, width - borderX - borderRight)}px`;
      textarea.style.transform = `scale(${sx}, ${sy})`;
      textarea.style.height = "0px";
      const line =
        Number.parseFloat(style.lineHeight) ||
        Number.parseFloat(style.fontSize) * 1.2;
      const desired = Math.max(line, textarea.scrollHeight);
      const available = Math.max(
        line,
        (window.innerHeight - rect.top - 8) / sy
      );
      textarea.style.height = `${Math.min(desired, available)}px`;
      textarea.style.overflowY = desired > available ? "auto" : "hidden";
    };
    const resize = new ResizeObserver(update);
    resize.observe(node);
    resize.observe(container);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    textarea.addEventListener("input", update);
    textarea.addEventListener("blur", save);
    textarea.addEventListener("keydown", (event) => {
      if (event.isComposing) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (editor?.waiting) {
          return;
        }
        cancel();
        focusSurface();
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        event.stopPropagation();
        save();
      }
    });
    lockCamera(notice, true);
    const stopView = onViewChange(update);
    editor = {
      node,
      restore: () => {
        stopView();
        resize.disconnect();
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
        textarea.removeEventListener("blur", save);
        textarea.remove();
        hide.remove();
        if (oldHidden === null) {
          node.removeAttribute(HIDDEN);
        } else {
          node.setAttribute(HIDDEN, oldHidden);
        }
      },
      textarea,
      update,
      waiting: false,
    };
    update();
    textarea.focus({ preventScroll: true });
    textarea.select();
    onChange();
  };

  const openRequested = (
    active: Request,
    command: { candidate: number; label: string; value: string }
  ) => {
    clearTimeout(timer);
    const candidate = active.candidates[command.candidate];
    const identity =
      candidate &&
      managedIdentity(managedRoot(candidate.node, container) ?? candidate.node);
    if (
      !(candidate && identity) ||
      identity.generation !== active.generation ||
      identity.objectId !== active.objectId ||
      identity.video !== active.video
    ) {
      cancel();
      return;
    }
    open(candidate, command.value, command.label);
  };

  const closeRequested = (active: Request, error: string | null) => {
    clearTimeout(timer);
    if (error === null) {
      clear();
      return;
    }
    explain(error, editor?.node ?? active.candidates[0]?.node);
    if (editor === null) {
      clear();
    } else {
      editor.waiting = false;
      editor.textarea.readOnly = false;
      editor.textarea.focus({ preventScroll: true });
    }
  };

  const stopCommands = route("inline-text", {
    replay: save,
    seek: save,
    "studio.text.close": (command) => {
      if (request !== null && command.requestId === request.requestId) {
        closeRequested(request, command.error);
      }
    },
    "studio.text.open": (command) => {
      if (request !== null && command.requestId === request.requestId) {
        openRequested(request, command);
      }
    },
    "transport.step": save,
    "transport.toggle": save,
  });

  const mutations = new MutationObserver(() => {
    if (request === null) {
      return;
    }
    const node = editor?.node ?? request.candidates[0]?.node;
    const identity =
      node && managedIdentity(managedRoot(node, container) ?? node);
    if (!node?.isConnected || identity?.generation !== request.generation) {
      cancel();
    }
  });
  mutations.observe(container, {
    attributeFilter: ["data-studio-generation"],
    attributes: true,
    childList: true,
    subtree: true,
  });

  return {
    active: () => editor !== null,
    beforePick: () => {
      if (editor === null) {
        cancel();
      } else {
        save();
        return true;
      }
      return false;
    },
    cancel,
    contains: (target: EventTarget | null) => target === editor?.textarea,
    doubleClick: (event: MouseEvent) => {
      if (editor !== null || event.button !== 0 || event.altKey) {
        return;
      }
      cancel();
      const candidates = candidatesAt(container, event.clientX, event.clientY);
      const [first] = candidates;
      if (!first) {
        return;
      }
      const identity = managedIdentity(
        managedRoot(first.node, container) ?? first.node
      );
      if (identity === null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      request = { ...identity, candidates, requestId: crypto.randomUUID() };
      post({
        ...identity,
        candidates: candidates.map(({ field, text }) => ({ field, text })),
        requestId: request.requestId,
        type: "studio.text.request",
      });
      timer = setTimeout(() => {
        cancel();
        explain(
          "Text editing did not respond. Try again after the preview finishes loading.",
          first.node
        );
      }, 6000);
    },
    stop: () => {
      cancel();
      stopCommands();
      mutations.disconnect();
      window.removeEventListener("blur", onBlur);
      clearTimeout(noticeTimer);
      notice.remove();
    },
  };
}

function candidatesAt(
  container: HTMLElement,
  x: number,
  y: number
): Candidate[] {
  const hit = elementsAt(x, y).find(
    (element) => container.contains(element) && nearText(element, x, y)
  );
  if (!(hit instanceof HTMLElement)) {
    return [];
  }
  const root = managedRoot(hit, container);
  if (root === null) {
    return [];
  }
  const bound = hit.closest(`[${FIELD}]`);
  if (bound instanceof HTMLElement && root.contains(bound)) {
    return canOverlay(bound) && plainText(bound, true)
      ? [
          {
            field: bound.getAttribute(FIELD),
            node: bound,
            text: bound.textContent ?? "",
          },
        ]
      : [];
  }
  const candidates: Candidate[] = [];
  let node: HTMLElement | null = hit;
  while (node !== null && root.contains(node) && candidates.length < 16) {
    if (canOverlay(node) && plainText(node)) {
      candidates.push({ field: null, node, text: node.textContent ?? "" });
    }
    if (node === root) {
      break;
    }
    node = node.parentElement;
  }
  return candidates;
}

function plainText(node: HTMLElement, bound = false): boolean {
  if (
    node.querySelector(
      "[data-studio-object], svg, img, canvas, video, input, button, textarea"
    )
  ) {
    return false;
  }
  const style = getComputedStyle(node);
  return [...node.querySelectorAll("*")].every((child) => {
    const childStyle = getComputedStyle(child);
    return (
      (childStyle.display === "inline" ||
        (bound && childStyle.display === "inline-block")) &&
      TYPOGRAPHY.every(
        (property) =>
          childStyle.getPropertyValue(property) ===
          style.getPropertyValue(property)
      )
    );
  });
}

function canOverlay(node: HTMLElement): boolean {
  if (
    node.offsetWidth <= 0 ||
    node.offsetHeight <= 0 ||
    node.getClientRects().length !== 1
  ) {
    return false;
  }
  for (
    let current: HTMLElement | null = node;
    current !== null;
    current = parentAcrossRoot(current)
  ) {
    const style = getComputedStyle(current);
    if (
      style.writingMode !== "horizontal-tb" ||
      style.visibility !== "visible" ||
      Number(style.opacity) < 0.05
    ) {
      return false;
    }
    if (
      style.perspective !== "none" ||
      (style.rotate !== "none" && style.rotate !== "0deg")
    ) {
      return false;
    }
    if (style.transform !== "none") {
      const matrix = new DOMMatrixReadOnly(style.transform);
      if (
        !matrix.is2D ||
        matrix.b !== 0 ||
        matrix.c !== 0 ||
        matrix.a <= 0 ||
        matrix.d <= 0
      ) {
        return false;
      }
    }
  }
  return true;
}
