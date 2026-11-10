"use client";

import type { BrowserState } from "../browser/session";
import { SecureViewport } from "./secure-viewport";
import { Icon } from "./icon";

export interface BrowserActions {
  selectPerson(id: string): void;
  setAddress(value: string): void;
  go(): void;
  followLink(address: string): void;
  retryPeople(): void;
  retryNavigation(): void;
}

export function BrowserShell({
  state,
  actions,
  parentOrigin,
}: {
  state: BrowserState;
  actions: BrowserActions;
  parentOrigin: string;
}) {
  const navigation = state.navigation;
  const loading = navigation.phase === "loading";
  const person = state.people.items.find((item) => item._id === state.personId);
  const shown = navigation.phase === "shown";
  const title = shown
    ? navigation.site.title
    : navigation.phase === "not_found"
      ? "Nowhere"
      : loading
        ? "Opening a page…"
        : navigation.phase === "error"
          ? "A connection went missing"
          : "A smaller web. A little more wonder.";
  const visitError =
    shown || navigation.phase === "not_found" ? navigation.visitError : null;
  const author = shown
    ? state.people.items.find((item) => item._id === navigation.site.author)
    : null;

  return (
    <main className="app-shell">
      <header className="masthead">
        <div className="brand" aria-label="Wyxan">
          <span className="brand-mark">
            w<span>↗</span>
          </span>
          <span>
            wyxan<span className="brand-caption">THE LITTLE WEB</span>
          </span>
        </div>
        <div className="masthead-note">
          <span className="live-dot" /> A collection worth getting lost in
        </div>
      </header>

      <section className="browser-window" aria-label="Mini browser">
        <div className="window-bar">
          <div className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="current-tab">
            <Icon name="globe" />
            <span>
              {shown ? navigation.site.title : "Your corner of the web"}
            </span>
          </div>
          <span className="window-caption">WYXAN BROWSER</span>
        </div>
        <div className="browser-toolbar">
          <div className="direction-buttons">
            <button
              type="button"
              disabled
              aria-label="Back"
              title="Back navigation is unavailable"
            >
              <Icon name="back" />
            </button>
            <button
              type="button"
              disabled
              aria-label="Forward"
              title="Forward navigation is unavailable"
            >
              <Icon name="forward" />
            </button>
          </div>
          <form
            className="address-form"
            onSubmit={(event) => {
              event.preventDefault();
              actions.go();
            }}
          >
            <label className="sr-only" htmlFor="site-address">
              Address
            </label>
            <div className="address-control">
              <Icon name="globe" />
              <input
                id="site-address"
                value={state.addressDraft}
                onChange={(event) => actions.setAddress(event.target.value)}
                placeholder="Enter an address, e.g. harbor.local"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={state.formError ? "address-error" : undefined}
                aria-invalid={!!state.formError}
              />
              <span className="address-hint">LOCAL WEB</span>
            </div>
            <button
              className="go-button"
              type="submit"
              disabled={
                !state.personId || loading || !state.addressDraft.trim()
              }
            >
              Go <Icon name="arrow" />
            </button>
          </form>
          <div className="person-control">
            <Icon name="person" />
            <label className="sr-only" htmlFor="browser-person">
              Person
            </label>
            <select
              id="browser-person"
              value={state.personId ?? ""}
              disabled={
                state.people.phase !== "ready" || !state.people.items.length
              }
              onChange={(event) => actions.selectPerson(event.target.value)}
            >
              <option value="">
                {state.people.phase === "loading"
                  ? "Loading people…"
                  : "Choose a person"}
              </option>
              {state.people.items.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state.formError && (
          <div className="notice notice-error" id="address-error" role="alert">
            <Icon name="alert" />
            {state.formError}
          </div>
        )}
        {state.people.phase === "error" && (
          <div className="notice notice-error" role="alert">
            <Icon name="alert" />
            <span>Could not load people. {state.people.error}</span>
            <button type="button" onClick={actions.retryPeople}>
              Try again
            </button>
          </div>
        )}
        {state.people.phase === "ready" && !state.people.items.length && (
          <div className="notice" role="status">
            <span>No people are available yet.</span>
            <button type="button" onClick={actions.retryPeople}>
              Refresh people
            </button>
          </div>
        )}
        {visitError && (
          <div className="notice notice-warning" role="alert">
            <Icon name="alert" />
            <span>
              The page opened, but the visit could not be recorded. {visitError}
            </span>
          </div>
        )}

        <div className="page-heading">
          <div>
            <div className="eyebrow">
              {shown
                ? "YOU ARE HERE"
                : navigation.phase === "not_found"
                  ? "THE END OF THIS ADDRESS"
                  : "TAKE THE SCENIC ROUTE"}
            </div>
            <h1>{title}</h1>
            {shown ? (
              <p>
                {navigation.address}
                <span className="heading-dot">·</span>
                {author?.name ?? "Local author"}
                <span className="heading-dot">·</span>
                {new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(navigation.site.publishedAt))}
              </p>
            ) : (
              <p>
                {state.personId
                  ? "An address is a starting point. A link is an invitation."
                  : "Choose who’s browsing, then open an address to begin."}
              </p>
            )}
          </div>
          <div className="page-stamp" aria-hidden="true">
            <Icon name={shown ? "page" : "globe"} />
          </div>
        </div>

        <section
          className="page-viewport"
          aria-label="Page viewport"
          aria-busy={loading}
        >
          {shown ? (
            <SecureViewport
              key={navigation.id}
              site={navigation.site}
              parentOrigin={parentOrigin}
              onNavigate={actions.followLink}
            />
          ) : loading ? (
            <div className="viewport-state" role="status">
              <div className="loading-ring" />
              <h2>Opening {navigation.address}</h2>
              <p>Finding your page and recording this visit…</p>
            </div>
          ) : navigation.phase === "not_found" ? (
            <div className="viewport-state nowhere">
              <div className="nowhere-number" aria-hidden="true">
                404<span>↗</span>
              </div>
              <div className="eyebrow">ADDRESS NOT FOUND</div>
              <h2>Nowhere, for now.</h2>
              <p>
                <strong>{navigation.address}</strong> isn’t in this collection.
                <br />
                Try another address. There’s still plenty to discover.
              </p>
            </div>
          ) : navigation.phase === "error" ? (
            <div className="viewport-state">
              <div className="state-icon error-icon">
                <Icon name="alert" />
              </div>
              <h2>We couldn’t open that page.</h2>
              <p role="alert">{navigation.error}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={actions.retryNavigation}
              >
                Try again <Icon name="arrow" />
              </button>
            </div>
          ) : (
            <div className="welcome-state">
              <div className="welcome-illustration" aria-hidden="true">
                <div className="illustration-orbit" />
                <div className="illustration-page">
                  <Icon name="globe" />
                  <span />
                  <span />
                  <span />
                  <i>↗</i>
                </div>
                <span className="orbit-dot" />
              </div>
              <div className="eyebrow">
                SMALL PAGES. UNEXPECTED CONNECTIONS.
              </div>
              <h2>Every address has a story.</h2>
              <p>
                Start at <strong>harbor.local</strong>, follow a curious link,
                <br className="desktop-break" /> and see where the little web
                takes you.
              </p>
              <div className="welcome-tip">
                <span>01</span> Choose a person <i /> <span>02</span> Open an
                address <i /> <span>03</span> Follow your curiosity
              </div>
            </div>
          )}
        </section>
        <footer className="browser-status">
          <span>
            <span className={`status-dot ${loading ? "pending" : ""}`} />
            {loading
              ? "Opening page"
              : person
                ? `Browsing as ${person.name}`
                : "Choose a person to begin"}
          </span>
          <span>
            <Icon name="shield" /> Isolated page viewport
          </span>
        </footer>
      </section>
      <footer className="app-footer">
        <span>A quieter kind of browsing.</span>
        <span>
          Built for curious minds <span aria-hidden="true">↗</span>
        </span>
      </footer>
    </main>
  );
}
