import { expect, test } from "./fixtures";

test.describe("AUB Clubs smoke", () => {
  test("redirects root path to discover in bypass mode", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/discover/);
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
  });

  test("auth page loads", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Sign in to your account or create a new one")).toBeVisible();
  });

  test("discover page loads in bypass mode", async ({ page }) => {
    await page.goto("/discover");
    await expect(page).toHaveURL(/\/discover/);
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
  });

  test("clubs page loads and exposes at least one club link", async ({ page }) => {
    await page.goto("/clubs");
    await expect(page.getByRole("heading", { name: "Available Clubs" })).toBeVisible();

    const firstClubLink = page.locator('a[href^="/clubs/"]:visible').first();
    await expect(firstClubLink).toBeVisible({ timeout: 15000 });
  });

  test("profile page loads", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("Profile details")).toBeVisible();
  });

  test("club details page loads from clubs list", async ({ page }) => {
    await page.goto("/clubs");
    const firstClubLink = page.locator('a[href^="/clubs/"]:visible').first();
    await expect(firstClubLink).toBeVisible({ timeout: 15000 });
    await firstClubLink.click();
    await expect(page).toHaveURL(/\/clubs\/[a-z0-9-]+/i);
    await expect(page.getByRole("tab", { name: "About" })).toBeVisible();
  });
});
