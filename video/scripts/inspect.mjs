import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Users/marti/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
});
await mkdir("public/assets/captures", { recursive: true });
const records = [];
for (const [format, viewport] of [
  ["wide", { width: 1920, height: 1080 }],
  ["vertical", { width: 720, height: 1280 }],
]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await context.addInitScript(() =>
    localStorage.setItem("looma-theme", "light"),
  );
  const page = await context.newPage();
  const capture = async (name) => {
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `public/assets/captures/${format}-${name}.png`,
    });
    records.push({
      format,
      name,
      url: page.url(),
      text: await page.locator("body").innerText(),
      rects: await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            'main, .workspace-content, .home-feed-stream, .home-main-scroll, .home-right-rail, .explore-header, [aria-label="Contas para conhecer"], [aria-label="Criar publicação"], [aria-label="Assuntos em alta"], [aria-label="Categorias de exploração"]',
          ),
        ).map((el) => ({
          selector: el.className,
          aria: el.getAttribute("aria-label"),
          rect: el.getBoundingClientRect().toJSON(),
        })),
      ),
    });
  };
  await page.goto("https://looma-feed.vercel.app/explorar");
  await page.waitForTimeout(5500);
  await capture("explore");
  await page.getByRole("button", { name: "Em alta", exact: true }).click();
  await capture("trends");
  await page.getByRole("button", { name: "Projetos", exact: true }).click();
  await capture("projects");
  await page.getByRole("button", { name: "Explorar", exact: true }).click();
  await page.getByPlaceholder("Buscar na Looma").first().fill("Looma");
  await capture("people");
  await page.goto("https://looma-feed.vercel.app/oportunidades");
  await page.waitForTimeout(4500);
  await capture("opportunities");
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await capture("design");
  await page.goto("https://looma-feed.vercel.app/");
  await page.waitForTimeout(5500);
  await capture("home");
  await page
    .getByPlaceholder("O que está acontecendo?")
    .fill("Uma ideia. Novas possibilidades. Vamos construir juntos?");
  await capture("composer");
  await context.close();
}
await writeFile(
  "public/assets/captures/inspection.json",
  JSON.stringify(records, null, 2),
);
await browser.close();
console.log("Captured desktop and native responsive mobile states.");
