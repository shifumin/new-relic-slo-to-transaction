// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { findByExactText, isVisible, setReactInputValue, waitFor } from "./clicker";

function setBody(html: string): void {
  document.body.innerHTML = html;
  // happy-dom doesn't compute layout — stub the visibility check by giving
  // every element a non-zero bounding rect.
  for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
    Object.defineProperty(el, "offsetParent", { configurable: true, value: el });
    el.getBoundingClientRect = () =>
      ({ width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 }) as DOMRect;
  }
}

describe("findByExactText", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns a button whose trimmed text exactly equals the target", () => {
    setBody("<button>  View full table  </button>");
    const el = findByExactText(document, "View full table");
    expect(el?.tagName).toBe("BUTTON");
  });

  it("returns an anchor by exact text", () => {
    setBody('<a class="link">View full table</a>');
    const el = findByExactText(document, "View full table");
    expect(el?.tagName).toBe("A");
  });

  it("returns null when no element matches", () => {
    setBody("<div>some other text</div>");
    expect(findByExactText(document, "View full table")).toBeNull();
  });

  it("matches only on exact text — not partial", () => {
    setBody("<a>View full table extra</a>");
    expect(findByExactText(document, "View full table")).toBeNull();
  });

  it("returns the first match when multiple elements share the text", () => {
    setBody('<a id="first">Same</a><a id="second">Same</a>');
    expect(findByExactText(document, "Same")?.id).toBe("first");
  });

  it("respects the tagSelectors filter", () => {
    setBody('<div>Target</div><a id="link">Target</a>');
    const el = findByExactText(document, "Target", ["a"]);
    expect(el?.id).toBe("link");
  });

  it("prefers the clickable child when text-only-wrappers also match", () => {
    // Mirrors NR1's pattern: an outer <span> wraps an inner clickable <span>.
    // The outer wrapper's textContent === inner's textContent. We want the inner.
    setBody(
      '<span id="wrapper"><span id="link" style="cursor: pointer">View full table</span></span>',
    );
    // Force happy-dom to report cursor:pointer on the inner element.
    const link = document.querySelector<HTMLElement>("#link");
    if (link) link.style.cursor = "pointer";
    Object.defineProperty(window, "getComputedStyle", {
      configurable: true,
      value: (el: HTMLElement) =>
        ({ cursor: el.id === "link" ? "pointer" : "auto" }) as CSSStyleDeclaration,
    });
    const found = findByExactText(document, "View full table");
    expect(found?.id).toBe("link");
  });
});

describe("setReactInputValue", () => {
  beforeEach(() => {
    document.body.innerHTML = '<input type="search" />';
  });

  it("sets the input value via the native HTMLInputElement.value setter", () => {
    // biome-ignore lint/style/noNonNullAssertion: the <input> is set in beforeEach
    const input = document.querySelector<HTMLInputElement>("input")!;
    setReactInputValue(input, "Controller/admin/create");
    expect(input.value).toBe("Controller/admin/create");
  });

  it("dispatches both input and change events", () => {
    // biome-ignore lint/style/noNonNullAssertion: the <input> is set in beforeEach
    const input = document.querySelector<HTMLInputElement>("input")!;
    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));
    setReactInputValue(input, "x");
    expect(events).toEqual(["input", "change"]);
  });
});

describe("waitFor", () => {
  it("resolves with the predicate's value once it is truthy", async () => {
    let counter = 0;
    const result = await waitFor(() => (++counter >= 3 ? "ready" : null), 1000, 10);
    expect(result).toBe("ready");
    expect(counter).toBeGreaterThanOrEqual(3);
  });

  it("resolves null when the predicate never returns a value within the timeout", async () => {
    const result = await waitFor(() => null, 50, 10);
    expect(result).toBeNull();
  });
});

describe("isVisible", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns true for an element with a non-zero bounding rect", () => {
    setBody("<div>x</div>");
    // biome-ignore lint/style/noNonNullAssertion: <div> is set by setBody above
    expect(isVisible(document.querySelector("div")!)).toBe(true);
  });

  it("returns false for a non-HTMLElement (text-only)", () => {
    expect(isVisible(document.documentElement.cloneNode(false) as Element)).toBe(false);
  });
});
