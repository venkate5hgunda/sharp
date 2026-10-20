import { execFileSync } from 'node:child_process';
import { access, chmod } from 'node:fs/promises';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
try {
  const configured = (() => { try { return git('config', '--get', 'core.hooksPath'); } catch { return ''; } })();
  if (configured && configured !== '.githooks') throw new Error(`Existing hooks path: ${configured}. Integrate .githooks/pre-commit into it before installing.`);
  if (!configured) {
    const hook = git('rev-parse', '--git-path', 'hooks/pre-commit');
    const exists = await access(hook).then(() => true, () => false);
    if (exists) throw new Error(`Existing ${hook}; integrate the eval hook before installing.`);
  }
  await chmod('.githooks/pre-commit', 0o755);
  git('config', '--local', 'core.hooksPath', '.githooks');
  console.log('Installed Sharp pre-commit evaluations.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
