import { useConnectionState } from "@rocicorp/zero/react";
import { cn } from "cn";

type ConnectionName = ReturnType<typeof useConnectionState>["name"];

const labels: Record<ConnectionName, string> = {
  initializing: "Connecting…",
  connecting: "Connecting…",
  connected: "Synced",
  disconnected: "Offline. Changes sync when you reconnect.",
  "needs-auth": "Checking your session…",
  error: "Cannot sync",
  closed: "Cannot sync",
};

const waiting = new Set<ConnectionName>(["initializing", "connecting", "needs-auth"]);

/**
 * Shows whether Zero is in sync with the server. While connected it is a
 * quiet dot, and otherwise it says what is happening.
 */
export function ConnectionStatus() {
  const connection = useConnectionState();
  const connected = connection.name === "connected";
  const label = labels[connection.name];

  return (
    <output
      aria-label={`Sync: ${label}`}
      className="flex items-center gap-2 px-2 text-xs text-muted-foreground"
      title={label}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          connected
            ? "bg-primary"
            : waiting.has(connection.name)
              ? "bg-muted-foreground"
              : "bg-destructive",
        )}
      />
      {!connected && <span>{label}</span>}
    </output>
  );
}
