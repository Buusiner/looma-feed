import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile, copyFile, stat } from "node:fs/promises";
import path from "node:path";

// Only the live product is captured. No fixtures, intercepted requests, UI
// replacement, hidden error states, or remote writes are used.
const BASE = "https://looma-feed.vercel.app";
const executablePath =
  process.env.LOOMA_CHROME ||
  "C:/Users/marti/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const destination = path.resolve("public/assets/captures");
await mkdir(destination, { recursive: true });
await mkdir("public/assets/branding", { recursive: true });
await copyFile(
  "../public/looma-logo-mark.svg",
  "public/assets/branding/looma-logo-mark.svg",
);
const browser = await chromium.launch({ headless: true, executablePath });
const log = [];
const ease = (t) => t * t * (3 - 2 * t);

for (const [format, viewport] of [
  ["wide", { width: 1920, height: 1080 }],
  ["vertical", { width: 720, height: 1280 }],
]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await context.addInitScript(() =>
    localStorage.setItem("looma-theme", "light"),
  );
  const page = await context.newPage();
  const goto = async (route) => {
    await page.goto(BASE + route);
    await page.waitForTimeout(route === "/" ? 14000 : 4500);
    await page.evaluate(() => document.fonts.ready);
    // Frame capture runs against an already settled live page.
  };
  const still = async (name, clip) =>
    page.screenshot({
      path: path.join(destination, `${format}-${name}-detail.png`),
      clip,
    });
  const take = async (name, seconds, clip, action) => {
    const output = path.join(destination, `${format}-${name}.mp4`);
    const fps = 60,
      frames = Math.round(seconds * fps);
    const recapture = (process.env.LOOMA_RECAPTURE || "")
      .split(",")
      .includes(`${format}-${name}`);
    if ((await stat(output).catch(() => null))?.size > 1000 && !recapture) {
      log.push({
        format,
        name,
        seconds,
        fps,
        clip,
        source: page.url(),
        output,
        events: [],
      });
      console.log(`Reusing completed capture: ${format}-${name}`);
      return;
    }
    const encoder = spawn(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-framerate",
        String(fps),
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "15",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        output,
      ],
      { windowsHide: true },
    );
    let errors = "";
    encoder.stderr.on("data", (data) => (errors += data));
    const completed = new Promise((resolve, reject) => {
      encoder.on("error", reject);
      encoder.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(errors)),
      );
    });
    // Suppress browser spelling annotations while preserving product markup.
    await page.evaluate(() =>
      document
        .querySelectorAll("input,textarea")
        .forEach((el) => (el.spellcheck = false)),
    );
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    for (let frame = 0; frame < frames; frame++) {
      if (action) await action(frame, page);
      await page.clock.runFor(frame % 3 === 0 ? 16 : 17);
      const image = await page.screenshot({ type: "jpeg", quality: 96, clip });
      if (!encoder.stdin.write(image)) await once(encoder.stdin, "drain");
    }
    encoder.stdin.end();
    await completed;
    await page.clock.resume();
    await still(name, clip);
    log.push({
      format,
      name,
      seconds,
      fps,
      clip,
      source: page.url(),
      output,
      events: [],
    });
    console.log(
      `${format}: ${name} captured (${seconds}s, true 60fps, ${clip.width * 2}×${clip.height * 2})`,
    );
  };
  if (format === "wide")
    await page.setViewportSize({ width: 1920, height: 720 });
  await goto("/explorar");
  // Filter to the real official account before scrolling; avoid test bios.
  await page.getByPlaceholder("Buscar na Looma").first().fill("Looma");
  await page.waitForTimeout(400);
  await page.getByPlaceholder("Buscar na Looma").first().blur();
  const exploreClip =
    format === "wide"
      ? { x: 524, y: 0, width: 680, height: 590 }
      : { x: 0, y: 140, width: 720, height: 750 };
  await take("discover", 4, exploreClip, async (frame) => {
    const t = ease(Math.max(0, Math.min(1, (frame - 65) / 130)));
    await page.evaluate(
      ({ top, mobile }) => {
        const scroll = document.querySelector(".home-main-scroll");
        if (mobile) window.scrollTo(0, top);
        else scroll.scrollTop = top;
      },
      { top: Math.round(t * 175), mobile: format === "vertical" },
    );
  });
  await page.setViewportSize(viewport);
  await goto("/oportunidades");
  const oppClip =
    format === "wide"
      ? { x: 672, y: 0, width: 1056, height: 710 }
      : { x: 0, y: 48, width: 720, height: 810 };
  const designBox = await page
    .getByRole("button", { name: "Design", exact: true })
    .boundingBox();
  await take("opportunities", 6, oppClip, async (frame) => {
    if (frame === 100)
      await page
        .getByRole("button", { name: "Design", exact: true })
        .click({ force: true });
    if (frame === 220)
      await page
        .getByRole("button", { name: "Design", exact: true })
        .click({ force: true });
  });
  log.at(-1).events = [
    {
      frame: 100,
      point: {
        x: designBox.x + designBox.width / 2 - oppClip.x,
        y: designBox.y + designBox.height / 2 - oppClip.y,
      },
      action: "Design filter",
    },
    {
      frame: 220,
      point: {
        x: designBox.x + designBox.width / 2 - oppClip.x,
        y: designBox.y + designBox.height / 2 - oppClip.y,
      },
      action: "Reset Design filter",
    },
  ];
  await goto("/oportunidades");
  const search = page.getByPlaceholder("Buscar oportunidades");
  const searchBox = await search.boundingBox();
  await take("search", 4, oppClip, async (frame) => {
    if (frame === 45) await search.click({ force: true });
    if (frame >= 55 && frame < 119 && (frame - 55) % 8 === 0)
      await search.fill("interface".slice(0, Math.floor((frame - 55) / 8) + 1));
    if (frame === 125) await search.fill("interface");
    if (frame === 160) await search.blur();
  });
  log.at(-1).events = [
    {
      frame: 45,
      point: {
        x: searchBox.x + searchBox.width * 0.3 - oppClip.x,
        y: searchBox.y + searchBox.height / 2 - oppClip.y,
      },
      action: "Search interface",
    },
  ];
  await goto("/explorar");
  const peopleSearch = page.getByPlaceholder("Buscar na Looma").first();
  await peopleSearch.fill("Looma");
  await page.waitForTimeout(450);
  await peopleSearch.blur();
  // The live account row is framed in full, without its test publications.
  const officialArticle = page
    .locator("article")
    .filter({ has: page.locator('a[href="/perfil/loomaoficial"]') })
    .first();
  const accountBox = await officialArticle.boundingBox();
  if (!accountBox) throw new Error("Official live account row was not found.");
  await still("account", {
    x: Math.max(0, Math.floor(accountBox.x)),
    y: Math.floor(accountBox.y),
    width: Math.min(
      viewport.width - Math.floor(accountBox.x),
      Math.ceil(accountBox.width),
    ),
    height: Math.ceil(accountBox.height),
  });
  const peopleClip =
    format === "wide"
      ? { x: 524, y: 0, width: 680, height: 1020 }
      : { x: 0, y: 355, width: 720, height: 750 };
  await take("people", 5, peopleClip, async (frame) => {
    if (frame === 45) await peopleSearch.click({ force: true });
    if (frame >= 65 && frame < 140 && (frame - 65) % 15 === 0)
      await peopleSearch.fill(
        "Looma".slice(0, Math.floor((frame - 65) / 15) + 1),
      );
    if (frame === 145) await peopleSearch.fill("Looma");
    if (frame === 175) await peopleSearch.blur();
  });
  await goto("/");
  const composer = page.getByRole("region", {
    name: "Criar publicação",
    exact: true,
  });
  await composer.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const element = document.querySelector(".brand-intro");
      return (
        !element ||
        getComputedStyle(element).display === "none" ||
        +getComputedStyle(element).opacity < 0.01
      );
    },
    {},
    { timeout: 30000 },
  );
  const cb = await composer.boundingBox();
  const composerClip = {
    x: Math.floor(cb.x),
    y: Math.floor(cb.y),
    width: Math.ceil(cb.width),
    height: Math.ceil(cb.height) + 2,
  };
  const text = "Uma ideia. Novas possibilidades. Vamos construir juntos?";
  await take("composer", 6, composerClip, async (frame) => {
    if (frame === 25)
      await page
        .getByPlaceholder("O que está acontecendo?")
        .click({ force: true });
    if (frame >= 45 && frame < 210 && (frame - 45) % 3 === 0)
      await page
        .getByPlaceholder("O que está acontecendo?")
        .fill(text.slice(0, Math.floor((frame - 45) / 3) + 1));
    if (frame === 212)
      await page.getByPlaceholder("O que está acontecendo?").fill(text);
    if (frame === 260)
      await page
        .getByRole("radio", { name: "Trabalho", exact: true })
        .click({ force: true });
    if (frame === 305)
      await page
        .getByRole("radio", { name: "Publicação", exact: true })
        .click({ force: true });
    if (frame === 330)
      await page.getByPlaceholder("O que está acontecendo?").blur();
  });
  if (format === "wide") {
    await goto("/explorar");
    await page.getByPlaceholder("Buscar na Looma").first().fill("Looma");
    await page.waitForTimeout(400);
    await page.getByPlaceholder("Buscar na Looma").first().blur();
    const themeClip = { x: 300, y: 0, width: 904, height: 790 };
    const themeBox = await page
      .getByRole("button", { name: "Ativar modo escuro", exact: true })
      .boundingBox();
    await take("theme", 4, themeClip, async (frame) => {
      if (frame === 100)
        await page
          .getByRole("button", { name: "Ativar modo escuro", exact: true })
          .click({ force: true });
    });
    log.at(-1).events = [
      {
        frame: 100,
        point: {
          x: themeBox.x + themeBox.width / 2 - themeClip.x,
          y: themeBox.y + themeBox.height / 2 - themeClip.y,
        },
        action: "Actual light to dark toggle",
      },
    ];
    if (
      await page
        .getByRole("button", { name: "Ativar modo escuro", exact: true })
        .count()
    ) {
      await page
        .getByRole("button", { name: "Ativar modo escuro", exact: true })
        .click();
      await page.waitForTimeout(500);
    }
    await still("dark-explore", { x: 524, y: 0, width: 680, height: 590 });
    await page
      .getByRole("button", { name: "Ativar modo claro", exact: true })
      .click();
    await still("light-explore", { x: 524, y: 0, width: 680, height: 590 });
  }
  await context.close();
}
await browser.close();
await writeFile(
  path.join(destination, "manifest.json"),
  JSON.stringify(log, null, 2),
);
console.log(
  "Capture manifest saved. No publication, connection, chat, or proposal was submitted.",
);
