import type { Types } from "mongoose";
import type { Site } from "./site.schema";
import { sanitizeSiteHtml } from "./sanitize-site-html";

export interface RenderableSite {
  _id: Types.ObjectId;
  address: string;
  title: string;
  plainText: string;
  author: Types.ObjectId;
  publishedAt: Date;
  sanitizedHtml: string;
}

export function renderableSite(
  site: Site & { _id: Types.ObjectId },
): RenderableSite {
  // Explicit projection keeps raw stored HTML out of GET and POST responses.
  return {
    _id: site._id,
    address: site.address,
    title: site.title,
    plainText: site.plainText,
    author: site.author,
    publishedAt: site.publishedAt,
    sanitizedHtml: sanitizeSiteHtml(site.html),
  };
}
