/**
 * Find an element whose visible trimmed text exactly matches `text`.
 *
 * When several candidates share the same text (typical of NR1's nested
 * wrapper spans), prefer one that looks clickable: `cursor: pointer` first,
 * then a true leaf (no element children), otherwise the first match.
 */
export function findByExactText(
  root: ParentNode,
  text: string,
  tagSelectors: string[] = ["a", "button", "span", "div"],
): HTMLElement | null {
  const selector = tagSelectors.join(",");
  const candidates: HTMLElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (!isVisible(el)) continue;
    if ((el.textContent ?? "").trim() === text) {
      candidates.push(el);
    }
  }
  if (candidates.length === 0) return null;
  const pointer = candidates.find((el) => getComputedStyle(el).cursor === "pointer");
  if (pointer) return pointer;
  const leaf = candidates.find((el) => el.children.length === 0);
  if (leaf) return leaf;
  return candidates[0];
}

/**
 * Programmatically set an `<input>`'s value in a way that React's
 * controlled-input handler will observe and re-render with.
 * The native `value` setter is invoked so React's internal value-tracker
 * sees the change, then `input` + `change` events are dispatched.
 */
export function setReactInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  const setter = descriptor?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.offsetParent === null && el.tagName !== "BODY") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Poll `predicate` every `intervalMs` until it returns a truthy value or `timeoutMs` elapses.
 * Returns the truthy value, or null on timeout.
 */
export async function waitFor<T>(
  predicate: () => T | null,
  timeoutMs: number,
  intervalMs = 200,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}
