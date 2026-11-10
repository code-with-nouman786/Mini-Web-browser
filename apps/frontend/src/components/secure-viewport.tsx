"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Site } from "../browser/api";
import {
  buildFrameDocument,
  FRAME_PERMISSIONS,
  FRAME_SANDBOX,
  frameNavigationAddress,
} from "../browser/frame-document";

export function SecureViewport({
  site,
  parentOrigin,
  onNavigate,
}: {
  site: Site;
  parentOrigin: string;
  onNavigate: (address: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [channel] = useState(() => crypto.randomUUID());
  const document = useMemo(
    () => buildFrameDocument(site.sanitizedHtml, channel, parentOrigin),
    [site.sanitizedHtml, channel, parentOrigin],
  );

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const address = frameNavigationAddress(
        event,
        frame.current?.contentWindow ?? null,
        channel,
      );
      if (address) onNavigate(address);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [channel, onNavigate]);

  return (
    <iframe
      ref={frame}
      className="page-frame"
      title={`Page: ${site.title}`}
      srcDoc={document}
      sandbox={FRAME_SANDBOX}
      allow={FRAME_PERMISSIONS}
      referrerPolicy="no-referrer"
    />
  );
}
