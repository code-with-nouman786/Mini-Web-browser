"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FrameController } from "../browser/frame-controller";
import {
  buildFrameDocument,
  FRAME_PERMISSIONS,
  FRAME_SANDBOX,
} from "../browser/frame-document";
import type { SessionEntry } from "../browser/session";
import type { ScrollPosition } from "../browser/viewport-state";

export function SecureViewport({
  entry,
  parentOrigin,
  onNavigate,
  onSaveScroll,
  onAttachViewport,
}: {
  entry: SessionEntry;
  parentOrigin: string;
  onNavigate: (address: string) => void;
  onSaveScroll: (entryId: number, position: ScrollPosition) => void;
  onAttachViewport: (
    entryId: number,
    capture: () => Promise<ScrollPosition>,
  ) => () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const controller = useRef<FrameController | null>(null);
  const [channel] = useState(() => crypto.randomUUID());
  // Freeze the entry's arrival position. Live scroll updates must not rebuild
  // srcdoc or jump the reader back to an older position.
  const [initialScroll] = useState(() => ({ ...entry.scroll }));
  const document = useMemo(
    () =>
      buildFrameDocument(
        entry.sanitizedHtml,
        channel,
        parentOrigin,
        initialScroll,
      ),
    [entry.sanitizedHtml, channel, parentOrigin, initialScroll],
  );

  useEffect(() => {
    const frameWindow = frame.current?.contentWindow;
    if (!frameWindow) return;
    const bridge = new FrameController(
      frameWindow,
      channel,
      onNavigate,
      (position) => onSaveScroll(entry.id, position),
    );
    controller.current = bridge;
    const detach = onAttachViewport(entry.id, bridge.capture);
    window.addEventListener("message", bridge.receive);
    bridge.initialize();
    return () => {
      window.removeEventListener("message", bridge.receive);
      detach();
      bridge.dispose();
      controller.current = null;
    };
  }, [channel, entry.id, onNavigate, onSaveScroll, onAttachViewport]);

  return (
    <iframe
      ref={frame}
      className="page-frame"
      title={`Page: ${entry.title}`}
      srcDoc={document}
      sandbox={FRAME_SANDBOX}
      allow={FRAME_PERMISSIONS}
      referrerPolicy="no-referrer"
      onLoad={() => controller.current?.initialize()}
    />
  );
}
