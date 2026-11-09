import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { LoadingState } from "./loading-state";

describe("LoadingState", () => {
  it("shows nothing at first, then placeholders", async () => {
    const screen = await render(<LoadingState delay={100} />);
    const status = screen.getByRole("status", { name: "Loading" });

    await expect.element(status).toBeInTheDocument();
    expect(status.element().children).toHaveLength(0);

    await expect.poll(() => status.element().children.length).toBe(3);
  });
});
