import { describe, expect, it } from "vitest";

import { ActionLink } from "./action-link";

describe("ActionLink", () => {
  it("renders a shared styled anchor contract", () => {
    const element = ActionLink({
      children: "Check system health",
      href: "/api/health",
    });

    expect(element.type).toBe("a");
    expect(element.props).toMatchObject({
      children: "Check system health",
      href: "/api/health",
    });
    expect(element.props.className).toContain("bg-sky-400");
  });
});
