import sanitizeHtml from "sanitize-html";
import { normalizeAddress } from "../common/normalize-address";

const internalAddress = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._~%+-]+)*$/;

function canonicalInternalAddress(value: string): string | null {
  const address = normalizeAddress(value);
  return address.length <= 2048 && internalAddress.test(address)
    ? address
    : null;
}

function linkAddress(attributes: Record<string, string>): string | null {
  const href = attributes.href?.trim();
  if (!href) return null;
  const address = canonicalInternalAddress(href);
  if (!address) return null;

  // Absolute URL spelling is accepted only with a matching explicit internal
  // marker. It is an opaque database address, never a URL the browser may load.
  if (attributes["data-address"] !== undefined) {
    return canonicalInternalAddress(attributes["data-address"]) === address
      ? address
      : null;
  }
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")
    ? null
    : address;
}

/** No author CSS or active resources survive this backend boundary. */
export function sanitizeSiteHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "div",
      "span",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "s",
      "blockquote",
      "pre",
      "code",
      "ul",
      "ol",
      "li",
      "dl",
      "dt",
      "dd",
      "table",
      "caption",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "a",
    ],
    allowedAttributes: { a: ["href", "data-internal-address"] },
    allowedSchemes: [],
    allowProtocolRelative: false,
    parseStyleAttributes: false,
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "title",
      "noscript",
      "iframe",
      "object",
      "embed",
      "form",
      "template",
      "svg",
      "math",
      "xmp",
      "plaintext",
    ],
    transformTags: {
      a: (_tag, attributes): sanitizeHtml.Tag => {
        const address = linkAddress(attributes);
        return address
          ? {
              tagName: "a",
              attribs: { href: "#", "data-internal-address": address },
            }
          : { tagName: "span", attribs: {} };
      },
    },
  });
}
