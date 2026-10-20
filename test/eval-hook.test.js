import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));

test('hook evaluates the index, preserves unstaged edits, and selects smoke/full on staged paths', async () => {
  const repo = await mkdtemp(path.join(tmpdir(), 'sharp-hook-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  try {
    git('init', '-q'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Hook test');
    for (const dir of ['scripts', 'js/intelligence', '.githooks']) await mkdir(path.join(repo, dir), { recursive: true });
    for (const name of ['scripts/check-staged-evals.mjs', 'scripts/evaluation-inputs.mjs', '.githooks/pre-commit']) await cp(path.join(root, name), path.join(repo, name));
    // The bootstrap's dependency lives in the worktree; its staged runner is the fixture below.
    await cp(path.join(root, 'js'), path.join(repo, 'js'), { recursive: true });
    await symlink(path.join(root, 'node_modules'), path.join(repo, 'node_modules'), 'dir');
    await writeFile(path.join(repo, '.gitignore'), 'node_modules\n');
    await writeFile(path.join(repo, 'scripts/check-evals.mjs'), `import { readFileSync } from 'node:fs';\nconsole.log('MODE=' + Number(JSON.parse(process.env.SHARP_EVAL_CHANGED_FILES).some(name => name.startsWith('js/intelligence/'))));\nif (readFileSync('sample.txt', 'utf8') !== 'good') process.exitCode = 1;\n`);
    await writeFile(path.join(repo, 'sample.txt'), 'good'); git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');
    git('config', 'core.hooksPath', '.githooks');
    const hook = () => spawnSync('sh', ['.githooks/pre-commit'], { cwd: repo, encoding: 'utf8' });
    await writeFile(path.join(repo, 'sample.txt'), 'bad'); git('add', 'sample.txt');
    await writeFile(path.join(repo, 'sample.txt'), 'good');
    const before = git('ls-files', '--stage');
    const rejected = hook(); assert.equal(rejected.status, 1); assert.match(rejected.stdout, /MODE=0/, rejected.stderr);
    assert.equal(git('ls-files', '--stage'), before); assert.equal(await readFile(path.join(repo, 'sample.txt'), 'utf8'), 'good');
    git('add', 'sample.txt'); // Return sample to the committed good state.
    await writeFile(path.join(repo, 'README.md'), 'docs'); git('add', 'README.md');
    await writeFile(path.join(repo, 'sample.txt'), 'bad');
    const accepted = hook(); assert.equal(accepted.status, 0, accepted.stderr); assert.match(accepted.stdout, /MODE=0/);
    assert.equal(await readFile(path.join(repo, 'sample.txt'), 'utf8'), 'bad');
    await writeFile(path.join(repo, 'js/intelligence/new-model.js'), '// new model'); git('add', 'js/intelligence/new-model.js');
    const full = hook(); assert.equal(full.status, 0, full.stderr); assert.match(full.stdout, /MODE=1/);
    await writeFile(path.join(repo, 'js/intelligence/prompt-registry.js'), 'invalid unstaged syntax !');
    assert.equal(hook().status, 0, 'unstaged model code must not load in the bootstrap');
    git('rm', '--cached', 'js/intelligence/new-model.js');
    git('rm', '--cached', 'js/intelligence/stub-provider.js');
    const removed = hook(); assert.equal(removed.status, 0, removed.stderr); assert.match(removed.stdout, /MODE=1/);
    // Verify an actual commit invokes the installed hook and is blocked by staged bad output.
    git('add', 'sample.txt');
    const commit = spawnSync('git', ['commit', '-m', 'must fail'], { cwd: repo, encoding: 'utf8' });
    assert.notEqual(commit.status, 0); assert.match(commit.stderr, /Commit blocked/);
  } finally { await rm(repo, { recursive: true, force: true }); }
});
