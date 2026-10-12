import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveClaudeCodeExecutablePath,
  type ResolveClaudeCodeExecutablePathDependencies,
} from '@/shared/claude-cli-path.js';

test('resolveClaudeCodeExecutablePath resolves the native installer path on macOS', () => {
  const nativePath = '/Users/test/.local/bin/claude';

  const resolved = resolveClaudeCodeExecutablePath('claude', {
    platform: 'darwin',
    homedir: () => '/Users/test',
    pathValue: '/usr/bin:/bin',
    existsSync: (candidate) => candidate === nativePath,
  });

  assert.equal(resolved, nativePath);
});

test('resolveClaudeCodeExecutablePath resolves a command from PATH on Linux', () => {
  const nativePath = '/opt/claude/bin/claude';

  const resolved = resolveClaudeCodeExecutablePath('claude', {
    platform: 'linux',
    homedir: () => '/home/test',
    pathValue: '/usr/bin:/opt/claude/bin',
    existsSync: (candidate) => candidate === nativePath,
  });

  assert.equal(resolved, nativePath);
});

test('resolveClaudeCodeExecutablePath keeps an explicit POSIX path unchanged', () => {
  const nativePath = '/custom/bin/claude';

  const resolved = resolveClaudeCodeExecutablePath(nativePath, {
    platform: 'darwin',
  });

  assert.equal(resolved, nativePath);
});

test('resolveClaudeCodeExecutablePath resolves the npm Claude wrapper to its native exe on Windows', () => {
  const wrapperDir = 'C:\\nvm4w\\nodejs';
  const nativePath = `${wrapperDir}\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe`;
  const execFileSync =
    (() => `${wrapperDir}\\claude\r\n${wrapperDir}\\claude.cmd\r\n`) as unknown as ResolveClaudeCodeExecutablePathDependencies['execFileSync'];
  const readFileSync = (() => '') as unknown as ResolveClaudeCodeExecutablePathDependencies['readFileSync'];

  const resolved = resolveClaudeCodeExecutablePath('claude', {
    platform: 'win32',
    execFileSync,
    existsSync: (candidate) => candidate === nativePath,
    readFileSync,
  });

  assert.equal(resolved, nativePath);
});

test('resolveClaudeCodeExecutablePath keeps an explicit JavaScript launcher path unchanged', () => {
  const scriptPath = 'C:\\tools\\claude.js';

  const resolved = resolveClaudeCodeExecutablePath(scriptPath, {
    platform: 'win32',
  });

  assert.equal(resolved, scriptPath);
});

test('resolveClaudeCodeExecutablePath can parse a wrapper file path containing letters r and n before claude.exe', () => {
  const wrapperPath = 'C:\\tools\\claude';
  const nativePath = 'C:\\tools\\custom\\bin\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe';
  const readFileSync = (() => `exec "$basedir/custom/bin/node_modules/@anthropic-ai/claude-code/bin/claude.exe" "$@"`) as unknown as ResolveClaudeCodeExecutablePathDependencies['readFileSync'];

  const resolved = resolveClaudeCodeExecutablePath(wrapperPath, {
    platform: 'win32',
    existsSync: (candidate) => candidate === nativePath,
    readFileSync,
  });

  assert.equal(resolved, nativePath);
});

test('resolveClaudeCodeExecutablePath falls back to the configured command when PATH lookup fails', () => {
  const execFileSync = (() => {
    throw new Error('not found');
  }) as unknown as ResolveClaudeCodeExecutablePathDependencies['execFileSync'];

  const resolved = resolveClaudeCodeExecutablePath('claude', {
    platform: 'win32',
    execFileSync,
  });

  assert.equal(resolved, 'claude');
});
