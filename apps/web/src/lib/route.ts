// Hash routes (studio-experience 2.3, 10.5): `#/` is the Story, `#/studio/<step>` a Studio Step.
// The hash works on static hosting without rewrites. Unknown Steps fall back to Design.
import { useEffect, useState } from "react";

export const STEPS = ["design", "check", "weave", "cards"] as const;
export type Step = (typeof STEPS)[number];

export type Route = { readonly page: "story" } | { readonly page: "studio"; readonly step: Step };

export function isStep(value: string): value is Step {
  return (STEPS as readonly string[]).includes(value);
}

/** Reads a `location.hash` value. Anything that is not a Studio route is the Story. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  const [page, step] = path.split("/");
  if (page !== "studio") return { page: "story" };
  return { page: "studio", step: step !== undefined && isStep(step) ? step : "design" };
}

export function hrefFor(route: Route): string {
  return route.page === "story" ? "#/" : `#/studio/${route.step}`;
}

function currentHash(): string {
  return typeof window === "undefined" ? "" : window.location.hash;
}

/** Changes the hash (adds a history entry), which `useRoute` hears through `hashchange`. */
export function navigate(route: Route): void {
  if (typeof window === "undefined") return;
  const href = hrefFor(route);
  if (window.location.hash !== href) window.location.hash = href;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(currentHash()));
  useEffect(() => {
    const onChange = (): void => setRoute(parseHash(currentHash()));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
