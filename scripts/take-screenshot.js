#!/usr/bin/env node
/**
 * take-screenshot.js
 * output/dashboard.html を Playwright で撮影して output/screenshot.png に保存する
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function takeScreenshot() {
  console.log('📸 ダッシュボードのスクリーンショットを撮影中...');

  const htmlPath = path.join(__dirname, '..', 'output', 'dashboard.html');
  const outputPath = path.join(__dirname, '..', 'output', 'screenshot.png');

  // キャラクター画像を output/character/ にコピー（スクリーンショット時の相対パス解決用）
  const charSrc = path.join(__dirname, '..', 'assets', 'character');
  const charDest = path.join(__dirname, '..', 'output', 'character');
  try {
    await fs.mkdir(charDest, { recursive: true });
    const files = await fs.readdir(charSrc);
    for (const f of files) {
      await fs.copyFile(path.join(charSrc, f), path.join(charDest, f));
    }
  } catch {
    // キャラ画像がなくても撮影は続行
  }

  // file:// URL に変換（Windows / Linux 両対応）
  const fileUrl = new URL('file:///' + htmlPath.replace(/\\/g, '/')).href;

  // コンテンツ幅に合わせて幅を絞り、2倍解像度で高画質化
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.setViewportSize({ width: 600, height: 2400 });

  // Tailwind CDN 読み込みを待つため networkidle を使用
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // 「進捗チェック」グリッドの下端を基準にクリップ高さを決定する。
  const clipHeight = await page.evaluate(() => {
    const findLabelByText = (text) =>
      Array.from(document.querySelectorAll('p')).find((el) => el.textContent.includes(text));

    const padding = 16; // 下に余白 16px

    const checksLabel = findLabelByText('進捗チェック');
    if (checksLabel) {
      const grid = checksLabel.nextElementSibling;
      if (grid) {
        const rect = grid.getBoundingClientRect();
        return Math.ceil(rect.bottom + window.scrollY) + padding;
      }
    }

    return 900; // デフォルト
  });

  console.log(`📐 クリップ高さ: ${clipHeight}px`);

  await page.screenshot({
    path: outputPath,
    clip: { x: 0, y: 0, width: 600, height: clipHeight },
  });
  await browser.close();

  console.log('✅ スクリーンショット保存: output/screenshot.png');
}

takeScreenshot().catch((err) => {
  console.error('❌ スクリーンショット撮影失敗:', err.message);
  process.exit(1);
});
