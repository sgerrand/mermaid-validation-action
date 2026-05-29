import * as core from '@actions/core';
import type { Failure, ValidationStats } from './types.js';

export const COMMENT_SENTINEL = '<!-- mermaid-validation-action -->';

export function emitAnnotations(failures: Failure[]): void {
  for (const f of failures) {
    const props = {
      file: f.file,
      startLine: f.line,
      ...(f.column !== undefined ? { startColumn: f.column } : {}),
      title:
        f.severity === 'warning' ? 'Mermaid warning' : 'Mermaid syntax error',
    };
    if (f.severity === 'warning') {
      core.warning(f.message, props);
    } else {
      core.error(f.message, props);
    }
  }
}

export async function emitJobSummary(
  failures: Failure[],
  stats: ValidationStats,
): Promise<void> {
  const heading =
    stats.errorCount === 0 && stats.warningCount === 0
      ? `Mermaid validation: all ${stats.blockCount} diagram(s) across ${stats.fileCount} file(s) passed`
      : `Mermaid validation: ${stats.errorCount} error(s), ${stats.warningCount} warning(s) in ${stats.fileCount} file(s)`;

  core.summary.addHeading(heading, 3);

  if (failures.length > 0) {
    core.summary.addTable([
      [
        { data: 'File', header: true },
        { data: 'Line', header: true },
        { data: 'Severity', header: true },
        { data: 'Diagram', header: true },
        { data: 'Message', header: true },
      ],
      ...failures.map((f) => [
        f.file,
        String(f.line),
        f.severity,
        f.diagramType ?? '—',
        f.message.replace(/\n+/g, ' ').slice(0, 200),
      ]),
    ]);
  }

  await core.summary.write();
}

export function renderCommentBody(
  failures: Failure[],
  stats: ValidationStats,
  isoTimestamp: string,
): string {
  const lines: string[] = [COMMENT_SENTINEL];

  if (stats.errorCount === 0 && stats.warningCount === 0) {
    lines.push(
      `### ✓ Mermaid validation passed`,
      ``,
      `${stats.blockCount} diagram(s) across ${stats.fileCount} file(s) — no issues.`,
    );
  } else {
    lines.push(
      `### Mermaid validation — ${stats.errorCount} error(s), ${stats.warningCount} warning(s)`,
      ``,
      `| File | Line | Severity | Diagram | Message |`,
      `| --- | --- | --- | --- | --- |`,
    );
    for (const f of failures) {
      const msg = f.message.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
      lines.push(
        `| \`${f.file}\` | ${f.line} | ${f.severity} | ${
          f.diagramType ?? '—'
        } | ${msg} |`,
      );
    }
  }

  lines.push(``, `_Last updated ${isoTimestamp} by mermaid-validation-action._`);
  return lines.join('\n');
}

type IssuesApi = {
  listComments: (params: {
    owner: string;
    repo: string;
    issue_number: number;
    per_page?: number;
  }) => Promise<{ data: { id: number; body?: string | null }[] }>;
  createComment: (params: {
    owner: string;
    repo: string;
    issue_number: number;
    body: string;
  }) => Promise<unknown>;
  updateComment: (params: {
    owner: string;
    repo: string;
    comment_id: number;
    body: string;
  }) => Promise<unknown>;
};

export interface PrCommentInput {
  failures: Failure[];
  stats: ValidationStats;
  owner: string;
  repo: string;
  prNumber: number;
  issues: IssuesApi;
  now?: () => Date;
}

export async function upsertPrComment(input: PrCommentInput): Promise<{
  action: 'created' | 'updated';
  commentId?: number;
}> {
  const now = (input.now ?? (() => new Date()))().toISOString();
  const body = renderCommentBody(input.failures, input.stats, now);

  const existing = await input.issues.listComments({
    owner: input.owner,
    repo: input.repo,
    issue_number: input.prNumber,
    per_page: 100,
  });

  const prior = existing.data.find((c) => c.body?.includes(COMMENT_SENTINEL));

  if (prior) {
    await input.issues.updateComment({
      owner: input.owner,
      repo: input.repo,
      comment_id: prior.id,
      body,
    });
    return { action: 'updated', commentId: prior.id };
  }

  await input.issues.createComment({
    owner: input.owner,
    repo: input.repo,
    issue_number: input.prNumber,
    body,
  });
  return { action: 'created' };
}
