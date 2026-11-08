import { mutators, queries } from "@curved/zero";
import { useZero } from "@rocicorp/zero/react";
import { useEffect } from "react";

type ZeroHandle = {
  zero: ReturnType<typeof useZero>;
  queries: typeof queries;
  mutators: typeof mutators;
};

declare global {
  interface Window {
    curvedZero?: ZeroHandle;
  }
}

/**
 * Lets Playwright scripts, such as the Zero spike measurements, drive Zero
 * from the page. Production builds leave it out.
 */
export function useExposeZero() {
  const zero = useZero();
  useEffect(() => {
    if (import.meta.env.MODE === "production") {
      return undefined;
    }
    window.curvedZero = { zero, queries, mutators };
    return () => {
      delete window.curvedZero;
    };
  }, [zero]);
}
