import { useConnectionState } from "@rocicorp/zero/react";

/** Zero queues writes while connecting and rejects them once disconnected. */
export function useCanWrite() {
  const connection = useConnectionState();
  return connection.name === "connected" || connection.name === "connecting";
}
