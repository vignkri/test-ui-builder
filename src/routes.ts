import { useEffect, useState } from "react";

export const SCREENS = ["overview", "resources", "activations", "events", "acknowledgements", "registration"] as const;
export type Screen = (typeof SCREENS)[number];

export const SCREEN_LABEL: Record<Screen, string> = {
  overview: "Overview",
  resources: "Resources",
  activations: "Activations",
  events: "Events",
  acknowledgements: "Acknowledgements",
  registration: "Registration",
};

export interface Route {
  screen: Screen;
  /** Selected resource or activation id, e.g. #/resources/bess-site-c-01 */
  id: string | null;
}

function parse(hash: string): Route {
  const [screen, ...rest] = hash.replace(/^#\/?/, "").split("/");
  const id = rest.length ? decodeURIComponent(rest.join("/")) : null;
  return (SCREENS as readonly string[]).includes(screen) ? { screen: screen as Screen, id } : { screen: "resources", id: null };
}

export function href(screen: Screen, id?: string | null): string {
  return `#/${screen}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

/** Hash routing — every screen and selection is linkable without a router dependency. */
export function useRoute(): [Route, (screen: Screen, id?: string | null) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (screen: Screen, id?: string | null) => {
    window.location.hash = href(screen, id);
  };
  return [route, navigate];
}

/** True below the design's mobile breakpoint. */
export function useIsMobile(): boolean {
  const query = "(max-width: 900px)";
  const [mobile, setMobile] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = () => setMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return mobile;
}
