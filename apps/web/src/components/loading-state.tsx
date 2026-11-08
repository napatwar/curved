import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shows placeholder rows while data loads. Zero answers most queries from
 * local data at once, so nothing appears for the first `delay` milliseconds,
 * which avoids a flash on fast loads.
 */
export function LoadingState({
  label = "Loading",
  delay = 300,
}: {
  label?: string;
  delay?: number;
}) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) {
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <output aria-busy="true" aria-label={label} className="flex flex-col gap-3 p-6">
      {visible &&
        ["w-2/3", "w-1/2", "w-3/5"].map((width) => (
          <Skeleton className={`block h-4 ${width}`} key={width} />
        ))}
    </output>
  );
}
