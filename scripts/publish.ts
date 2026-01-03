#!/usr/bin/env bun

import { $ } from 'bun';

const PACKAGES = {
  plugin: {
    name: '@jcamps/opencode-web-blocker-plugin',
    dir: new URL('../packages/opencode-plugin', import.meta.url).pathname,
  },
  server: {
    name: '@jcamps/opencode-web-blocker-server',
    dir: new URL('../packages/server', import.meta.url).pathname,
  },
} as const;

type PackageKey = keyof typeof PACKAGES;

const packageArg = process.argv[2] as PackageKey | undefined;
const bump = process.env.BUMP as "major" | "minor" | "patch" | undefined;
const versionOverride = process.env.VERSION;
const otp = process.env.OTP;

if (!packageArg || !PACKAGES[packageArg]) {
  console.error('Usage: BUMP=<patch|minor|major> bun scripts/publish.ts <plugin|server>');
  console.error('  BUMP=patch bun scripts/publish.ts plugin');
  console.error('  BUMP=minor bun scripts/publish.ts server');
  console.error('  VERSION=1.0.0 bun scripts/publish.ts plugin');
  process.exit(1);
}

if (!bump && !versionOverride) {
  console.error("Error: BUMP or VERSION environment variable is required");
  console.error("  BUMP=patch|minor|major OTP=123456 bun scripts/publish.ts " + packageArg);
  console.error("  VERSION=1.0.0 OTP=123456 bun scripts/publish.ts " + packageArg);
  process.exit(1);
}

if (!otp && !process.env.CI) {
  console.error("Error: OTP environment variable is required for npm 2FA");
  console.error("  BUMP=" + (bump ?? "patch") + " OTP=123456 bun scripts/publish.ts " + packageArg);
  process.exit(1);
}

const pkg = PACKAGES[packageArg];
console.log(`=== Publishing ${pkg.name} ===\n`);

async function fetchPreviousVersion(): Promise<string> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg.name}/latest`);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    const data = (await res.json()) as { version: string };
    console.log(`Previous version: ${data.version}`);
    return data.version;
  } catch {
    console.log('No previous version found, starting from 0.0.0');
    return '0.0.0';
  }
}

function bumpVersion(version: string, type: 'major' | 'minor' | 'patch'): string {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${(major ?? 0) + 1}.0.0`;
    case 'minor':
      return `${major ?? 0}.${(minor ?? 0) + 1}.0`;
    case 'patch':
      return `${major ?? 0}.${minor ?? 0}.${(patch ?? 0) + 1}`;
  }
}

async function updatePackageVersion(newVersion: string): Promise<void> {
  const pkgPath = `${pkg.dir}/package.json`;
  let content = await Bun.file(pkgPath).text();
  content = content.replace(/"version": "[^"]+"/, `"version": "${newVersion}"`);
  await Bun.write(pkgPath, content);
  console.log(`Updated version in: ${pkgPath}`);
}

async function buildAndPublish(): Promise<void> {
  console.log("\nBuilding...");
  await $`bun run build`.cwd(pkg.dir);

  console.log("\nPublishing to npm...");
  if (process.env.CI) {
    await $`npm publish --access public --provenance`.cwd(pkg.dir);
  } else {
    await $`npm publish --access public --otp ${otp}`.cwd(pkg.dir);
  }
}

async function gitTagAndRelease(newVersion: string): Promise<void> {
  if (!process.env.CI) {
    console.log('\nSkipping git tag/release (not in CI)');
    return;
  }

  const tagName = `${packageArg}-v${newVersion}`;

  console.log('\nCommitting and tagging...');
  await $`git config user.email "github-actions[bot]@users.noreply.github.com"`;
  await $`git config user.name "github-actions[bot]"`;
  await $`git add ${pkg.dir}/package.json`;

  const hasStagedChanges = await $`git diff --cached --quiet`.nothrow();
  if (hasStagedChanges.exitCode !== 0) {
    await $`git commit -m "release: ${pkg.name}@${newVersion}"`;
  } else {
    console.log('No changes to commit (version already updated)');
  }

  const tagExists = await $`git rev-parse ${tagName}`.nothrow();
  if (tagExists.exitCode !== 0) {
    await $`git tag ${tagName}`;
  } else {
    console.log(`Tag ${tagName} already exists`);
  }

  await $`git push origin HEAD --tags`;

  console.log('\nCreating GitHub release...');
  const releaseExists = await $`gh release view ${tagName}`.nothrow();
  if (releaseExists.exitCode !== 0) {
    await $`gh release create ${tagName} --title "${pkg.name}@${newVersion}" --notes "Release ${pkg.name}@${newVersion}"`;
  } else {
    console.log(`Release ${tagName} already exists`);
  }
}

async function checkVersionExists(version: string): Promise<boolean> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg.name}/${version}`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const previous = await fetchPreviousVersion();
  const newVersion = versionOverride ?? bumpVersion(previous, bump!);
  console.log(`New version: ${newVersion}\n`);

  if (await checkVersionExists(newVersion)) {
    console.log(`Version ${newVersion} already exists on npm. Skipping publish.`);
    process.exit(0);
  }

  await updatePackageVersion(newVersion);
  await buildAndPublish();
  await gitTagAndRelease(newVersion);

  console.log(`\n=== Successfully published ${pkg.name}@${newVersion} ===`);
}

main();
