import { expect, test } from "@playwright/test";

test("shows the repository foundation page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Memory Orchestration Debugger" }),
  ).toBeVisible();
});
