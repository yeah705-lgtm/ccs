#!/usr/bin/env node

/**
 * Verify UI bundle size stays reasonable
 *
 * Current stack: React + TanStack Query + Radix UI + shadcn/ui + Recharts
 * Expected range: 800KB - 1.5MB gzipped for full-featured dashboard
 *
 * This is a developer tool, not a public-facing site, so we optimize for
 * features over minimal bundle size. The limit is a sanity check to catch
 * accidental large dependencies, not a hard performance target.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const UI_DIR = path.join(__dirname, '../dist/ui');
const MAX_SIZE = 1.5 * 1024 * 1024; // 1.5MB - reasonable for full-featured React dashboard

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content).length;
}

function walkDir(dir) {
  let totalSize = 0;
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      totalSize += walkDir(filePath);
    } else {
      totalSize += getGzipSize(filePath);
    }
  }

  return totalSize;
}

if (!fs.existsSync(UI_DIR)) {
  console.log('[!] dist/ui not found. Run bun run ui:build first.');
  process.exit(1);
}

const totalSize = walkDir(UI_DIR);
const sizeKB = (totalSize / 1024).toFixed(1);
const maxKB = (MAX_SIZE / 1024).toFixed(0);

if (totalSize > MAX_SIZE) {
  console.log(`[X] Bundle too large: ${sizeKB}KB gzipped (max: ${maxKB}KB)`);
  process.exit(1);
} else {
  console.log(`[OK] Bundle size: ${sizeKB}KB gzipped`);
}
