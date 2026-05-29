import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import { extractBlocks } from './extractBlocks.js';
import { detectType } from './detectType.js';
import { validate } from './validate.js';
import { emitAnnotations, emitJobSummary, upsertPrComment } from './report.js';
import type { Failure, ValidationStats } from './types.js';

interface Inputs {
  files: string;
  workingDirectory: string;
  failOnWarning: boolean;
  commentOnPr: boolean;
  githubToken: string;
}

function readInputs(): Inputs {
  return {
    files: core.getInput('files') || '**/*.md',
    workingDirectory: core.getInput('working-directory') || '.',
    failOnWarning: core.getBooleanInput('fail-on-warning'),
    commentOnPr: core.getBooleanInput('comment-on-pr'),
    githubToken: core.getInput('github-token'),
  };
}

async function resolveFiles(patterns: string, cwd: string): Promise<string[]> {
  const absoluteCwd = path.resolve(cwd);
  const lines = patterns
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const rooted = lines
    .map((line) => {
      if (line.startsWith('!')) {
        const body = line.slice(1);
        return path.isAbsolute(body)
          ? line
          : `!${path.join(absoluteCwd, body)}`;
      }
      return path.isAbsolute(line) ? line : path.join(absoluteCwd, line);
    })
    .join('\n');

  const globber = await glob.create(rooted, {
    matchDirectories: false,
    implicitDescendants: false,
  });
  const all = await globber.glob();
  return all.filter((p) => p.toLowerCase().endsWith('.md'));
}

function toRelative(absolute: string, cwd: string): string {
  const rel = path.relative(path.resolve(cwd), absolute);
  return rel === '' ? path.basename(absolute) : rel;
}

async function validateFile(
  absolutePath: string,
  cwd: string,
): Promise<{ failures: Failure[]; blockCount: number }> {
  const relativePath = toRelative(absolutePath, cwd);
  const source = await readFile(absolutePath, 'utf8');
  const blocks = extractBlocks(relativePath, source);
  const failures: Failure[] = [];

  for (const block of blocks) {
    const result = await validate(block.value);
    if (result.ok) continue;

    const diagramLine = result.line ?? 1;
    const absoluteLine = block.startLine + diagramLine;
    const fallbackType = detectType(block.value) ?? undefined;

    failures.push({
      file: relativePath,
      line: absoluteLine,
      column: result.column,
      message: result.message,
      diagramType: fallbackType,
      severity: 'error',
    });
  }

  return { failures, blockCount: blocks.length };
}

export async function run(): Promise<void> {
  const inputs = readInputs();
  const cwd = path.resolve(inputs.workingDirectory);

  core.info(`mermaid-validation-action scanning ${inputs.files} in ${cwd}`);

  const files = await resolveFiles(inputs.files, cwd);
  core.info(`Resolved ${files.length} Markdown file(s) to scan`);

  const failures: Failure[] = [];
  let totalBlocks = 0;

  for (const file of files) {
    const { failures: fileFailures, blockCount } = await validateFile(
      file,
      cwd,
    );
    failures.push(...fileFailures);
    totalBlocks += blockCount;
  }

  const stats: ValidationStats = {
    fileCount: files.length,
    blockCount: totalBlocks,
    errorCount: failures.filter((f) => f.severity === 'error').length,
    warningCount: failures.filter((f) => f.severity === 'warning').length,
  };

  emitAnnotations(failures);
  await emitJobSummary(failures, stats);

  if (
    inputs.commentOnPr &&
    github.context.eventName === 'pull_request' &&
    inputs.githubToken
  ) {
    try {
      const octokit = github.getOctokit(inputs.githubToken);
      const pr = github.context.payload.pull_request;
      if (pr) {
        await upsertPrComment({
          failures,
          stats,
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          prNumber: pr.number,
          issues: octokit.rest.issues,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      core.warning(`Could not upsert PR comment: ${msg}`);
    }
  }

  core.setOutput('error-count', stats.errorCount);
  core.setOutput('warning-count', stats.warningCount);
  core.setOutput('file-count', stats.fileCount);
  core.setOutput('block-count', stats.blockCount);

  if (
    stats.errorCount > 0 ||
    (inputs.failOnWarning && stats.warningCount > 0)
  ) {
    core.setFailed(
      `Mermaid validation failed: ${stats.errorCount} error(s), ${stats.warningCount} warning(s).`,
    );
  }
}

run().catch((err) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  core.setFailed(`Unhandled error: ${msg}`);
});
