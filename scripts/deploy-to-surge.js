#!/usr/bin/env node
/**
 * deploy-to-surge.js
 * output/dashboard.html を Surge.sh にデプロイして毎日同じURLで最新状態を公開する
 */

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function deployToSurge() {
  console.log('🚀 Surge.sh にデプロイ中...');

  const htmlPath = path.join(__dirname, '..', 'output', 'dashboard.html');
  try {
    await fs.access(htmlPath);
  } catch {
    console.error('❌ output/dashboard.html が見つかりません。先に npm run generate-dashboard を実行してください');
    process.exit(1);
  }

  const domain = process.env.INSTA_SURGE_DOMAIN;
  if (!domain) {
    console.error('❌ INSTA_SURGE_DOMAIN が設定されていません');
    process.exit(1);
  }

  // dist/ に index.html としてコピー
  const distDir = path.join(__dirname, '..', 'dist');
  await fs.mkdir(distDir, { recursive: true });
  await fs.copyFile(htmlPath, path.join(distDir, 'index.html'));

  // screenshot.png があれば一緒にデプロイ
  const screenshotPath = path.join(__dirname, '..', 'output', 'screenshot.png');
  try {
    await fs.access(screenshotPath);
    await fs.copyFile(screenshotPath, path.join(distDir, 'screenshot.png'));
    console.log('📷 screenshot.png をデプロイに含めます');
  } catch {
    // スクリーンショットがなくてもデプロイは続行
  }

  // キャラクター画像をデプロイに含める
  const charSrcDir = path.join(__dirname, '..', 'assets', 'character');
  const charDistDir = path.join(distDir, 'character');
  try {
    await fs.access(charSrcDir);
    await fs.mkdir(charDistDir, { recursive: true });
    const files = await fs.readdir(charSrcDir);
    for (const f of files) {
      await fs.copyFile(path.join(charSrcDir, f), path.join(charDistDir, f));
    }
    console.log('🎨 character/ をデプロイに含めます');
  } catch {
    // キャラ画像がなくてもデプロイは続行
  }

  console.log(`📝 デプロイ先: https://${domain}`);
  console.log('📤 アップロード中...');

  try {
    const { stdout } = await execAsync(
      `npx surge --project "${distDir}" --domain "${domain}"`,
      {
        env: {
          ...process.env,
          SURGE_LOGIN: process.env.INSTA_SURGE_LOGIN,
          SURGE_TOKEN: process.env.INSTA_SURGE_TOKEN,
        },
      },
    );
    console.log(stdout);
  } catch (err) {
    console.error('❌ Surge デプロイ失敗:', err.stderr || err.message);
    console.log('💡 npx surge login でログイン状態を確認してください');
    process.exit(1);
  }

  // デプロイ済みURLを保存
  const dataDir = path.join(__dirname, '..', 'data');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'deployed-url.txt'), `https://${domain}`);

  console.log(`✅ デプロイ完了: https://${domain}`);
}

deployToSurge().catch((err) => {
  console.error('❌ 予期しないエラー:', err.message);
  process.exit(1);
});
