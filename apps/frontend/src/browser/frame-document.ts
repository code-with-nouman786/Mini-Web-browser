import { isCanonicalInternalAddress } from "./address";

export const FRAME_SANDBOX = "allow-scripts";
export const FRAME_PERMISSIONS =
  "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'";
export const FRAME_MESSAGE_TYPE = "wyxan:navigate";

// Author scripts never reach this document. This one fixed script only forwards
// inert links; its CSP hash is tested so a source change cannot silently drift.
export const BRIDGE_SCRIPT = String.raw`(() => {
  "use strict";
  const script = document.currentScript;
  const channel = script.getAttribute("data-channel");
  const parentOrigin = script.getAttribute("data-parent-origin");
  function anchorFor(event) {
    return event.target instanceof Element ? event.target.closest("a") : null;
  }
  function intercept(event) {
    const anchor = anchorFor(event);
    if (!anchor) return;
    event.preventDefault();
    event.stopPropagation();
    const address = anchor.getAttribute("data-internal-address");
    if (address && event.button !== 2) {
      window.parent.postMessage({ type: "wyxan:navigate", channel, address }, parentOrigin);
    }
  }
  document.addEventListener("click", intercept, true);
  document.addEventListener("auxclick", intercept, true);
  document.addEventListener("contextmenu", (event) => {
    if (anchorFor(event)) event.preventDefault();
  }, true);
})();`;

export const FRAME_STYLES = String.raw`:root{color:#24332f;background:#fffefa;font-family:Georgia,"Times New Roman",serif;font-size:17px;line-height:1.85;color-scheme:light}*{box-sizing:border-box}body{margin:0;padding:44px clamp(22px,6vw,78px) 60px;overflow-wrap:anywhere}h1,h2,h3,h4,h5,h6{font-family:Arial,Helvetica,sans-serif;line-height:1.22;color:#183e35;letter-spacing:-.025em}h1{font-size:clamp(29px,4vw,42px);margin:0 0 28px;max-width:21ch}h2{margin-top:36px}p,li{max-width:76ch}p{margin:0 0 24px}a{color:#166653;text-decoration-color:#84b7a5;text-underline-offset:4px}a:hover{color:#0b4437}a:focus-visible{outline:2px solid #166653;outline-offset:4px}ul,ol{padding-left:24px}blockquote{margin:24px 0;padding:12px 24px;border-left:3px solid #95b7a9;color:#53645a}pre,code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.87em;background:#edf2eb}code{padding:2px 5px}pre{overflow:auto;padding:20px;border-radius:8px}pre code{padding:0}table{border-collapse:collapse;max-width:100%;margin:24px 0}th,td{border:1px solid #d7dfd6;padding:10px 16px;text-align:left}th{background:#edf2eb}hr{border:0;border-top:1px solid #d7dfd6;margin:32px 0}`;

export const BRIDGE_HASH = "0X9CQtNuYOCo3aBc01gKXgEjGKK+0W6MTMuin8ux1cM=";
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
): string {
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${attribute(FRAME_CSP)}"><meta name="referrer" content="no-referrer"><style>${FRAME_STYLES}</style></head><body>${sanitizedHtml}<script data-channel="${attribute(channel)}" data-parent-origin="${attribute(parentOrigin)}">${BRIDGE_SCRIPT}</script></body></html>`;
}

export function frameNavigationAddress(
  event: Pick<MessageEvent, "source" | "origin" | "data">,
  expectedWindow: MessageEventSource | null,
  channel: string,
): string | null {
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
  if (
    Object.keys(message).sort().join(",") !== "address,channel,type" ||
    message.type !== FRAME_MESSAGE_TYPE ||
    message.channel !== channel ||
    !isCanonicalInternalAddress(message.address)
  )
    return null;
  return message.address;
}
