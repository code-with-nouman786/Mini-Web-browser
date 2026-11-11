import { isCanonicalInternalAddress } from "./address";
import { isScrollPosition, type ScrollPosition } from "./viewport-state";

export const FRAME_SANDBOX = "allow-scripts";
export const FRAME_PERMISSIONS =
  "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'";
export const FRAME_MESSAGE_TYPE = "wyxan:navigate";

// Author scripts never reach this document. Only this hash-pinned bridge can
// intercept links and exchange bounded scroll coordinates across the opaque origin.
export const BRIDGE_SCRIPT = String.raw`(() => {
  "use strict";
  const script = document.currentScript;
  const channel = script.getAttribute("data-channel");
  const parentOrigin = script.getAttribute("data-parent-origin");
  const initialX = Number(script.getAttribute("data-scroll-x"));
  const initialY = Number(script.getAttribute("data-scroll-y"));
  let restored = false;
  let restoring = false;
  let scrollQueued = false;
  function position() {
    return { x: Math.max(0, window.scrollX), y: Math.max(0, window.scrollY) };
  }
  function send(type, extra) {
    window.parent.postMessage({ type, channel, ...extra }, parentOrigin);
  }
  function initialize() {
    if (restored) {
      send("wyxan:ready", { position: position() });
      return;
    }
    if (restoring) return;
    restoring = true;
    requestAnimationFrame(() => {
      window.scrollTo(initialX, initialY);
      restored = true;
      send("wyxan:ready", { position: position() });
    });
  }
  window.addEventListener("load", initialize, { once: true });
  if (document.readyState === "complete") initialize();
  window.addEventListener("message", (event) => {
    // An opaque child needs '*' as the parent's target origin. Bind commands to
    // the actual parent window, exact parent origin, channel and message shape.
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const data = event.data;
    if (!data || typeof data !== "object" || Array.isArray(data) || data.channel !== channel) return;
    const keys = Object.keys(data).sort().join(",");
    if (data.type === "wyxan:initialize" && keys === "channel,type") initialize();
    if (restored && data.type === "wyxan:capture-scroll" && keys === "channel,requestId,type" && Number.isSafeInteger(data.requestId) && data.requestId > 0) {
      send("wyxan:captured-scroll", { requestId: data.requestId, position: position() });
    }
  });
  window.addEventListener("scroll", () => {
    if (!restored || scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      send("wyxan:scroll", { position: position() });
    });
  }, { passive: true });
  function anchorFor(event) {
    return event.target instanceof Element ? event.target.closest("a") : null;
  }
  function intercept(event) {
    const anchor = anchorFor(event);
    if (!anchor) return;
    event.preventDefault();
    event.stopPropagation();
    const address = anchor.getAttribute("data-internal-address");
    if (address && event.button !== 2) send("wyxan:navigate", { address });
  }
  document.addEventListener("click", intercept, true);
  document.addEventListener("auxclick", intercept, true);
  document.addEventListener("contextmenu", (event) => {
    if (anchorFor(event)) event.preventDefault();
  }, true);
})();`;

export const FRAME_STYLES = String.raw`:root{color:#24332f;background:#fffefa;font-family:Georgia,"Times New Roman",serif;font-size:17px;line-height:1.85;color-scheme:light}*{box-sizing:border-box}body{margin:0;padding:44px clamp(22px,6vw,78px) 60px;overflow-wrap:anywhere}h1,h2,h3,h4,h5,h6{font-family:Arial,Helvetica,sans-serif;line-height:1.22;color:#183e35;letter-spacing:-.025em}h1{font-size:clamp(29px,4vw,42px);margin:0 0 28px;max-width:21ch}h2{margin-top:36px}p,li{max-width:76ch}p{margin:0 0 24px}a{color:#166653;text-decoration-color:#84b7a5;text-underline-offset:4px}a:hover{color:#0b4437}a:focus-visible{outline:2px solid #166653;outline-offset:4px}ul,ol{padding-left:24px}blockquote{margin:24px 0;padding:12px 24px;border-left:3px solid #95b7a9;color:#53645a}pre,code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.87em;background:#edf2eb}code{padding:2px 5px}pre{overflow:auto;padding:20px;border-radius:8px}pre code{padding:0}table{border-collapse:collapse;max-width:100%;margin:24px 0}th,td{border:1px solid #d7dfd6;padding:10px 16px;text-align:left}th{background:#edf2eb}hr{border:0;border-top:1px solid #d7dfd6;margin:32px 0}`;

export const BRIDGE_HASH = "ubuf8N81EAjW2LLIdaAtEufshEJ2Mv5ScKZX5HM1+PM=";
export const STYLE_HASH = "LB24MdpVdqiwzwY2Yg6cBptjdohaobhyGesDVonyRlc=";
export const FRAME_CSP = [
  "default-src 'none'",
  `script-src 'sha256-${BRIDGE_HASH}'`,
  "script-src-attr 'none'",
  `style-src 'sha256-${STYLE_HASH}'`,
  "style-src-attr 'none'",
  "connect-src 'none'",
  "img-src 'none'",
  "font-src 'none'",
  "media-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "manifest-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function attribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildFrameDocument(
  sanitizedHtml: string,
  channel: string,
  parentOrigin: string,
  scroll: ScrollPosition = { x: 0, y: 0 },
): string {
  if (!isScrollPosition(scroll)) throw new Error("Invalid scroll position");
  if (!/^[a-f0-9-]{36}$/i.test(channel))
    throw new Error("Invalid frame channel");
  const origin = new URL(parentOrigin);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.origin !== parentOrigin
  )
    throw new Error("Invalid parent origin");
  // Sanitization happens on the backend first. CSP precedes all page content,
  // then only our pinned stylesheet and bridge are added by trusted code.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${attribute(FRAME_CSP)}"><meta name="referrer" content="no-referrer"><style>${FRAME_STYLES}</style></head><body>${sanitizedHtml}<script data-channel="${attribute(channel)}" data-parent-origin="${attribute(parentOrigin)}" data-scroll-x="${scroll.x}" data-scroll-y="${scroll.y}">${BRIDGE_SCRIPT}</script></body></html>`;
}

export type FrameMessage =
  | { type: "wyxan:navigate"; address: string }
  | { type: "wyxan:ready" | "wyxan:scroll"; position: ScrollPosition }
  | {
      type: "wyxan:captured-scroll";
      requestId: number;
      position: ScrollPosition;
    };

export function readFrameMessage(
  event: Pick<MessageEvent, "source" | "origin" | "data">,
  expectedWindow: MessageEventSource | null,
  channel: string,
): FrameMessage | null {
  // No allow-same-origin means an opaque "null" origin. Origin alone is not
  // identity: require this frame's WindowProxy and its per-document channel.
  if (
    !expectedWindow ||
    event.source !== expectedWindow ||
    event.origin !== "null"
  )
    return null;
  const data: unknown = event.data;
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return null;
  const message = data as Record<string, unknown>;
  if (message.channel !== channel) return null;
  const keys = Object.keys(message).sort().join(",");
  if (
    message.type === FRAME_MESSAGE_TYPE &&
    keys === "address,channel,type" &&
    isCanonicalInternalAddress(message.address)
  )
    return { type: message.type, address: message.address };
  if (
    (message.type === "wyxan:ready" || message.type === "wyxan:scroll") &&
    keys === "channel,position,type" &&
    isScrollPosition(message.position)
  )
    return { type: message.type, position: { ...message.position } };
  if (
    message.type === "wyxan:captured-scroll" &&
    keys === "channel,position,requestId,type" &&
    typeof message.requestId === "number" &&
    Number.isSafeInteger(message.requestId) &&
    message.requestId > 0 &&
    isScrollPosition(message.position)
  )
    return {
      type: message.type,
      requestId: message.requestId,
      position: { ...message.position },
    };
  return null;
}

export function frameNavigationAddress(
  event: Pick<MessageEvent, "source" | "origin" | "data">,
  expectedWindow: MessageEventSource | null,
  channel: string,
): string | null {
  const message = readFrameMessage(event, expectedWindow, channel);
  return message?.type === "wyxan:navigate" ? message.address : null;
}
