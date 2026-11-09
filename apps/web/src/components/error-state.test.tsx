import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ErrorState } from "./error-state";

describe("ErrorState", () => {
  it("explains the problem and retries", async () => {
    const onRetry = vi.fn<() => void>();
    const screen = await render(<ErrorState onRetry={onRetry} />);

    const alert = screen.getByRole("alert");
    await expect
      .element(alert.getByRole("heading", { name: "Something went wrong" }))
      .toBeVisible();
    await screen.getByRole("button", { name: "Try again" }).click();

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("has no retry button without onRetry", async () => {
    const screen = await render(<ErrorState title="No access" />);

    await expect.element(screen.getByRole("heading", { name: "No access" })).toBeVisible();
    expect(screen.getByRole("button").elements()).toHaveLength(0);
  });
});
