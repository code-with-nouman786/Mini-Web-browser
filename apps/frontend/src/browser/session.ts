import {
  ApiError,
  type BrowserApi,
  type NavigationSource,
  type Person,
  type Site,
} from "./api";
import { enteredAddress } from "./address";
import { isScrollPosition, type ScrollPosition } from "./viewport-state";

interface Location {
  id: number;
  address: string;
  source: NavigationSource;
}
interface EntryState extends Location {
  title: string;
  sanitizedHtml: string;
  scroll: ScrollPosition;
  visitError: string | null;
}
export type SessionEntry =
  | (EntryState & {
      phase: "shown";
      authorName: string;
      publishedAt: string;
    })
  | (EntryState & { phase: "not_found" });
export type Navigation =
  | { phase: "idle" }
  | (Location & { phase: "loading" })
  | SessionEntry
  | (Location & { phase: "error"; error: string });
export interface BrowserState {
  people: {
    phase: "loading" | "ready" | "error";
    items: Person[];
    error: string | null;
  };
  personId: string | null;
  addressDraft: string;
  formError: string | null;
  navigation: Navigation;
  trail: {
    entries: readonly SessionEntry[];
    index: number;
    // Reserve each click's destination while the opaque frame saves its scroll.
    pendingIndex: number | null;
  };
}
const initialState: BrowserState = {
  people: { phase: "loading", items: [], error: null },
  personId: null,
  addressDraft: "harbor.local",
  formError: null,
  navigation: { phase: "idle" },
  trail: { entries: [], index: -1, pendingIndex: null },
};

export function navigationAvailability(state: BrowserState) {
  const index = state.trail.pendingIndex ?? state.trail.index;
  const unresolved =
    state.navigation.phase === "loading" || state.navigation.phase === "error";
  return {
    back: index > 0 || (unresolved && index >= 0),
    forward: index >= 0 && index < state.trail.entries.length - 1,
  };
}
function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The API request could not be completed.";
}
function resolved(navigation: Navigation): navigation is SessionEntry {
  return navigation.phase === "shown" || navigation.phase === "not_found";
}

/** Snapshots belong to one selected person; changing people discards the trail. */
export class BrowserSession {
  private state: BrowserState = initialState;
  private listeners = new Set<() => void>();
  private sequence = 0;
  private personEpoch = 0;
  private navigationRequest?: AbortController;
  private peopleRequest?: AbortController;
  private visitRequests = new Map<number, AbortController>();
  private viewport?: {
    entryId: number;
    capture: () => Promise<ScrollPosition>;
  };

  constructor(private readonly api: BrowserApi) {}
  getSnapshot = (): BrowserState => this.state;
  getServerSnapshot = (): BrowserState => initialState;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(change: Partial<BrowserState>): void {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }
  private cancelNavigation(): number {
    this.navigationRequest?.abort();
    return ++this.sequence;
  }
  private changeEntry(
    id: number,
    change: Partial<Pick<EntryState, "scroll" | "visitError">>,
  ): void {
    const entries = this.state.trail.entries.map((entry) =>
      entry.id === id ? { ...entry, ...change } : entry,
    );
    const navigation = this.state.navigation;
    this.update({
      trail: { ...this.state.trail, entries },
      ...(resolved(navigation) && navigation.id === id
        ? { navigation: { ...navigation, ...change } }
        : {}),
    });
  }

  attachViewport(entryId: number, capture: () => Promise<ScrollPosition>) {
    if (
      this.state.navigation.phase !== "shown" ||
      this.state.navigation.id !== entryId
    )
      return () => undefined;
    const viewport = { entryId, capture };
    this.viewport = viewport;
    return () => {
      if (this.viewport === viewport) this.viewport = undefined;
    };
  }
  saveScroll(entryId: number, scroll: ScrollPosition): void {
    const navigation = this.state.navigation;
    if (
      navigation.phase === "shown" &&
      navigation.id === entryId &&
      isScrollPosition(scroll) &&
      (navigation.scroll.x !== scroll.x || navigation.scroll.y !== scroll.y)
    )
      this.changeEntry(entryId, { scroll: { ...scroll } });
  }
  private async captureScroll(token: number): Promise<boolean> {
    const navigation = this.state.navigation;
    const viewport = this.viewport;
    if (navigation.phase !== "shown" || viewport?.entryId !== navigation.id)
      return token === this.sequence;
    try {
      const scroll = await viewport.capture();
      if (token !== this.sequence) return false;
      if (!isScrollPosition(scroll)) throw new Error("Invalid page position.");
      this.saveScroll(navigation.id, scroll);
      return true;
    } catch (error: unknown) {
      if (token === this.sequence)
        this.update({
          formError: `Could not save the page position. ${errorMessage(error)}`,
          trail: { ...this.state.trail, pendingIndex: null },
        });
      return false;
    }
  }
  private needsCapture(): boolean {
    return (
      this.state.navigation.phase === "shown" &&
      this.viewport?.entryId === this.state.navigation.id
    );
  }

  async loadPeople(): Promise<void> {
    this.peopleRequest?.abort();
    const request = new AbortController();
    this.peopleRequest = request;
    this.update({ people: { phase: "loading", items: [], error: null } });
    try {
      const items = await this.api.listPeople(request.signal);
      if (request.signal.aborted) return;
      if (
        this.state.personId &&
        !items.some((person) => person._id === this.state.personId)
      )
        this.selectPerson("");
      this.update({ people: { phase: "ready", items, error: null } });
    } catch (error: unknown) {
      if (!request.signal.aborted) {
        this.selectPerson("");
        this.update({
          people: { phase: "error", items: [], error: errorMessage(error) },
        });
      }
    }
  }

  selectPerson(personId: string): void {
    const selected = this.state.people.items.some(
      (person) => person._id === personId,
    )
      ? personId
      : null;
    if (selected === this.state.personId) return;
    this.cancelNavigation();
    this.personEpoch++;
    this.visitRequests.forEach((request) => request.abort());
    this.visitRequests.clear();
    this.viewport = undefined;
    this.update({
      personId: selected,
      addressDraft: initialState.addressDraft,
      navigation: { phase: "idle" },
      trail: { entries: [], index: -1, pendingIndex: null },
      formError: null,
    });
  }
  setAddress(addressDraft: string): void {
    this.update({ addressDraft, formError: null });
  }

  async navigate(input: string, source: NavigationSource): Promise<void> {
    const person = this.state.personId;
    if (!person) {
      this.update({ formError: "Choose a person before opening a page." });
      return;
    }
    const address = enteredAddress(input);
    if (!address) {
      this.update({
        formError: "Enter an internal address such as harbor.local.",
      });
      return;
    }
    const token = this.cancelNavigation();
    this.update({ trail: { ...this.state.trail, pendingIndex: null } });
    if (this.needsCapture() && !(await this.captureScroll(token))) return;
    if (token !== this.sequence) return;
    const request = new AbortController();
    this.navigationRequest = request;
    const location: Location = { id: token, address, source };
    const current = () =>
      !request.signal.aborted &&
      token === this.sequence &&
      this.state.personId === person;
    this.update({
      addressDraft: address,
      formError: null,
      navigation: { ...location, phase: "loading" },
    });
    let site: Site | null;
    try {
      try {
        site = await this.api.getSite(address, request.signal);
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 404) site = null;
        else throw error;
      }
      if (!current()) return;
    } catch (error: unknown) {
      if (current())
        this.update({
          navigation: {
            ...location,
            phase: "error",
            error: errorMessage(error),
          },
        });
      return;
    }
    // Copy only rendered values, so later API mutations cannot change a snapshot.
    const snapshot = {
      ...location,
      title: site?.title ?? "Nowhere",
      sanitizedHtml: site?.sanitizedHtml ?? "",
      scroll: { x: 0, y: 0 },
      visitError: null,
    };
    const entry: SessionEntry = site
      ? {
          ...snapshot,
          phase: "shown",
          authorName:
            this.state.people.items.find((item) => item._id === site.author)
              ?.name ?? "Local author",
          publishedAt: site.publishedAt,
        }
      : { ...snapshot, phase: "not_found" };
    const entries = [
      ...this.state.trail.entries.slice(0, this.state.trail.index + 1),
      entry,
    ];
    this.update({
      navigation: entry,
      trail: { entries, index: entries.length - 1, pendingIndex: null },
    });

    // One POST per resolved new entry. Traversal never logs or retries a Visit;
    // an in-flight POST stays tied to its entry even if the cursor moves away.
    const visitRequest = new AbortController();
    const epoch = this.personEpoch;
    this.visitRequests.set(entry.id, visitRequest);
    try {
      await this.api.recordVisit(
        { person, address, source },
        visitRequest.signal,
      );
    } catch (error: unknown) {
      if (
        !visitRequest.signal.aborted &&
        this.personEpoch === epoch &&
        this.state.trail.entries.some((item) => item.id === entry.id)
      )
        this.changeEntry(entry.id, { visitError: errorMessage(error) });
    } finally {
      this.visitRequests.delete(entry.id);
    }
  }

  back(): Promise<void> {
    return this.traverse(-1);
  }
  forward(): Promise<void> {
    return this.traverse(1);
  }
  private async traverse(direction: -1 | 1): Promise<void> {
    const { trail } = this.state;
    // An unfinished/failed request has no entry. Back first dismisses that
    // attempt and returns to the last resolved snapshot, including the first one.
    const dismissAttempt =
      direction === -1 &&
      trail.pendingIndex === null &&
      (this.state.navigation.phase === "loading" ||
        this.state.navigation.phase === "error");
    const target = dismissAttempt
      ? trail.index
      : (trail.pendingIndex ?? trail.index) + direction;
    if (target < 0 || target >= trail.entries.length) return;
    const token = this.cancelNavigation();
    this.update({ trail: { ...trail, pendingIndex: target }, formError: null });
    if (this.needsCapture() && !(await this.captureScroll(token))) return;
    if (token !== this.sequence) return;
    const entry = this.state.trail.entries[target];
    this.update({
      navigation: entry,
      addressDraft: entry.address,
      formError: null,
      trail: { ...this.state.trail, index: target, pendingIndex: null },
    });
  }
  retryNavigation(): Promise<void> {
    const navigation = this.state.navigation;
    return navigation.phase === "error"
      ? this.navigate(navigation.address, navigation.source)
      : Promise.resolve();
  }
  dispose(): void {
    this.cancelNavigation();
    this.personEpoch++;
    this.peopleRequest?.abort();
    this.visitRequests.forEach((request) => request.abort());
    this.visitRequests.clear();
    this.viewport = undefined;
  }
}
