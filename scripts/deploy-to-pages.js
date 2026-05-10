#!/usr/bin/env node
/**
 * deploy-to-pages.js
 * output/dashboard.html を GitHub Pages 用 dist/ にコピーします。
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildPagesDist() {
  const htmlPath = path.join(__dirname, '..', 'output', 'dashboard.html');
  try {
    await fs.access(htmlPath);
  } catch {
    console.error('❌ output/dashboard.html が見つかりません。先に npm run generate-dashboard を実行してください');
    process.exit(1);
  }

  const distDir = path.join(__dirname, '..', 'dist');
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.copyFile(htmlPath, path.join(distDir, 'index.html'));
  console.log('✅ dist/index.html を作成しました');

  const screenshotPath = path.join(__dirname, '..', 'output', 'screenshot.png');
  try {
    await fs.access(screenshotPath);
    await fs.copyFile(screenshotPath, path.join(distDir, 'screenshot.png'));
    console.log('✅ dist/screenshot.png を作成しました');
  } catch {
    console.log('⚠️ output/screenshot.png が見つかりません。スクリーンショットは含めません');
  }

  const charSrcDir = path.join(__dirname, '..', 'assets', 'character');
  const charDistDir = path.join(distDir, 'character');
  try {
    await fs.access(charSrcDir);
    await fs.mkdir(charDistDir, { recursive: true });
    const files = await fs.readdir(charSrcDir);
    for (const file of files) {
      await fs.copyFile(path.join(charSrcDir, file), path.join(charDistDir, file));
    }
    console.log('✅ dist/character を作成しました');
  } catch {
    console.log('⚠️ assets/character が見つかりません。キャラクター画像は含めません');
  }

  console.log('🚀 GitHub Pages 用 dist が準備できました');
}

buildPagesDist().catch((err) => {
  console.error('❌ 予期しないエラー:', err.message);
  process.exit(1);
});
