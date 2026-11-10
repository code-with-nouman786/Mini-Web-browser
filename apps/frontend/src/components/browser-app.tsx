"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createBrowserApi } from "../browser/api";
import { BrowserSession } from "../browser/session";
import { BrowserShell } from "./browser-shell";

export function BrowserApp() {
  const [session] = useState(
    () =>
      new BrowserSession(
        createBrowserApi(
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api",
        ),
      ),
  );
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  useEffect(() => {
    void session.loadPeople();
    return () => session.dispose();
  }, [session]);
  const actions = useMemo(
    () => ({
      selectPerson: (id: string) => session.selectPerson(id),
      setAddress: (value: string) => session.setAddress(value),
      go: () => {
        void session.navigate(session.getSnapshot().addressDraft, "typed");
      },
      followLink: (address: string) => {
        void session.navigate(address, "link");
      },
      retryPeople: () => {
        void session.loadPeople();
      },
      retryNavigation: () => {
        void session.retryNavigation();
      },
    }),
    [session],
  );
  return (
    <BrowserShell
      state={state}
      actions={actions}
      parentOrigin={
        typeof window === "undefined"
          ? "http://localhost:3000"
          : window.location.origin
      }
    />
  );
}
