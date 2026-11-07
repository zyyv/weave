import { defineConfig } from 'bumpp';

export default defineConfig({
  release: 'patch',
  files: ['package.json', 'package-lock.json', 'mygo.json', 'frontend/version.js'],
  noGitCheck: false,
  all: false,
  execute: 'npm run check',
  commit: 'chore: release v%s',
  tag: 'v%s',
  push: true,
});
