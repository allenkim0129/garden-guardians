import { expect } from "@playwright/test";

export async function confirmTeam(page, include) {
  await expect(page.locator("#modal")).toHaveAttribute("data-kind", "loadout");
  if (include) {
    const choice = page.locator(`.loadout-choice[data-type="${include}"]`);
    if (await choice.getAttribute("aria-pressed") !== "true") {
      if (await choice.isDisabled()) await page.locator('.loadout-choice[aria-pressed="true"]').last().tap();
      await choice.tap();
    }
  }
  await page.locator("#modal-actions .primary").tap();
  await expect(page.locator("#modal")).not.toBeVisible();
}
