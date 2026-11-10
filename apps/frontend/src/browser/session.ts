import {
  ApiError,
  type BrowserApi,
  type NavigationSource,
  type Person,
  type Site,
} from "./api";
import { enteredAddress } from "./address";

interface Location {
  id: number;
  address: string;
  source: NavigationSource;
}
export type Navigation =
  | { phase: "idle" }
  | (Location & { phase: "loading" })
  | (Location & { phase: "shown"; site: Site; visitError: string | null })
  | (Location & { phase: "not_found"; visitError: string | null })
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
}
const initialState: BrowserState = {
  people: { phase: "loading", items: [], error: null },
  personId: null,
  addressDraft: "harbor.local",
  formError: null,
  navigation: { phase: "idle" },
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The API request could not be completed.";
}

/** One current location plus explicit request state; no navigation stack yet. */
export class BrowserSession {
  private state: BrowserState = initialState;
  private listeners = new Set<() => void>();
  private navigationId = 0;
  private navigationRequest?: AbortController;
  private peopleRequest?: AbortController;

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
      if (!request.signal.aborted)
        this.update({
          people: { phase: "error", items: [], error: errorMessage(error) },
        });
    }
  }

  selectPerson(personId: string): void {
    this.navigationRequest?.abort();
    this.navigationId++;
    const selected = this.state.people.items.some(
      (person) => person._id === personId,
    )
      ? personId
      : null;
    this.update({
      personId: selected,
      navigation: { phase: "idle" },
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

    this.navigationRequest?.abort();
    const request = new AbortController();
    this.navigationRequest = request;
    const location: Location = { id: ++this.navigationId, address, source };
    const current = () =>
      !request.signal.aborted &&
      this.navigationId === location.id &&
      this.state.personId === person;
    this.update({
      addressDraft: address,
      formError: null,
      navigation: { ...location, phase: "loading" },
    });
    try {
      let site: Site | null;
      try {
        site = await this.api.getSite(address, request.signal);
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 404) site = null;
        else throw error;
      }
      if (!current()) return;
      let visitError: string | null = null;
      try {
        await this.api.recordVisit({ person, address, source }, request.signal);
      } catch (error: unknown) {
        if (current()) visitError = errorMessage(error);
      }
      if (!current()) return;
      this.update({
        navigation: site
          ? { ...location, phase: "shown", site, visitError }
          : { ...location, phase: "not_found", visitError },
      });
    } catch (error: unknown) {
      if (current())
        this.update({
          navigation: {
            ...location,
            phase: "error",
            error: errorMessage(error),
          },
        });
    }
  }

  retryNavigation(): Promise<void> {
    const navigation = this.state.navigation;
    return navigation.phase === "error"
      ? this.navigate(navigation.address, navigation.source)
      : Promise.resolve();
  }
  dispose(): void {
    this.navigationId++;
    this.navigationRequest?.abort();
    this.peopleRequest?.abort();
  }
}
