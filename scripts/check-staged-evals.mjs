import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
let snapshot;
try {
  const root = git('rev-parse', '--show-toplevel').trim();
  const names = git('diff', '--cached', '--name-only', '--no-renames', '-z').split('\0').filter(Boolean);
  snapshot = await mkdtemp(path.join(tmpdir(), 'sharp-staged-evals-'));
  git('checkout-index', '--all', `--prefix=${snapshot}/`);
  await access(path.join(root, 'node_modules'));
  await symlink(path.join(root, 'node_modules'), path.join(snapshot, 'node_modules'), 'dir');
  const env = { ...process.env, SHARP_EVAL_CHANGED_FILES: JSON.stringify(names) };
  // Git exports repository-local variables to hooks; do not leak them into nested test repos.
  for (const name of git('rev-parse', '--local-env-vars').trim().split('\n')) delete env[name];
  // Use the staged gate, not unstaged prompts, code or baseline evidence.
  const result = spawnSync(process.execPath, ['scripts/check-evals.mjs'], { cwd: snapshot, stdio: 'inherit',
    env });
  if (result.status !== 0) throw new Error('Commit blocked by LLM evaluations.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { if (snapshot) await rm(snapshot, { recursive: true, force: true }); }
