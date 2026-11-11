import { readFrameMessage } from "./frame-document";
import type { ScrollPosition } from "./viewport-state";

/** Coordinates only: never grant DOM access to the opaque content document. */
export class FrameController {
  private ready = false;
  private closed = false;
  private sequence = 0;
  private pending = new Map<
    number,
    {
      resolve: (position: ScrollPosition) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(
    private readonly frame: Window,
    private readonly channel: string,
    private readonly onNavigate: (address: string) => void,
    private readonly onScroll: (position: ScrollPosition) => void,
  ) {}

  private send(message: object): void {
    // srcdoc has an opaque origin; '*' is necessary here. The bridge validates
    // the parent WindowProxy, its exact origin, channel and every command field.
    this.frame.postMessage({ ...message, channel: this.channel }, "*");
  }
  initialize(): void {
    if (!this.closed) this.send({ type: "wyxan:initialize" });
  }
  capture = (): Promise<ScrollPosition> => {
    if (this.closed) return Promise.reject(new Error("The page was closed."));
    const requestId = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("The page did not respond. Try again."));
      }, 1500);
      this.pending.set(requestId, { resolve, reject, timer });
      if (this.ready) this.send({ type: "wyxan:capture-scroll", requestId });
      else this.initialize();
    });
  };
  receive = (event: Pick<MessageEvent, "source" | "origin" | "data">): void => {
    if (this.closed) return;
    const message = readFrameMessage(event, this.frame, this.channel);
    if (!message) return;
    if (message.type === "wyxan:navigate") {
      this.onNavigate(message.address);
    } else if (message.type === "wyxan:captured-scroll") {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      this.onScroll(message.position);
      pending.resolve(message.position);
    } else {
      this.onScroll(message.position);
      if (message.type === "wyxan:ready" && !this.ready) {
        this.ready = true;
        this.pending.forEach((_pending, requestId) =>
          this.send({ type: "wyxan:capture-scroll", requestId }),
        );
      }
    }
  };
  dispose(): void {
    this.closed = true;
    this.pending.forEach((pending) => {
      clearTimeout(pending.timer);
      pending.reject(new Error("The page was closed."));
    });
    this.pending.clear();
  }
}
