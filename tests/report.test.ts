import { describe, it, expect, mock } from 'bun:test';
import {
  COMMENT_SENTINEL,
  renderCommentBody,
  upsertPrComment,
} from '../src/report';
import type { Failure, ValidationStats } from '../src/types';

const emptyStats: ValidationStats = {
  fileCount: 2,
  blockCount: 3,
  errorCount: 0,
  warningCount: 0,
};

const failingStats: ValidationStats = {
  fileCount: 1,
  blockCount: 2,
  errorCount: 1,
  warningCount: 1,
};

const sampleFailures: Failure[] = [
  {
    file: 'docs/a.md',
    line: 42,
    message: 'Unexpected token "-->"',
    diagramType: 'flowchart',
    severity: 'error',
  },
  {
    file: 'docs/a.md',
    line: 88,
    message: 'Unknown diagram type | weird',
    diagramType: undefined,
    severity: 'warning',
  },
];

describe('renderCommentBody', () => {
  it('includes the sentinel marker', () => {
    const body = renderCommentBody([], emptyStats, '2026-05-29T00:00:00Z');
    expect(body.startsWith(COMMENT_SENTINEL)).toBe(true);
  });

  it('renders a passing message when no failures', () => {
    const body = renderCommentBody([], emptyStats, '2026-05-29T00:00:00Z');
    expect(body).toContain('Mermaid validation passed');
    expect(body).toContain('3 diagram(s)');
    expect(body).toContain('2 file(s)');
  });

  it('renders a failure table when failures present', () => {
    const body = renderCommentBody(
      sampleFailures,
      failingStats,
      '2026-05-29T00:00:00Z',
    );
    expect(body).toContain('1 error(s), 1 warning(s)');
    expect(body).toContain('| `docs/a.md` | 42 |');
    expect(body).toContain('| `docs/a.md` | 88 |');
  });

  it('escapes pipes inside messages', () => {
    const body = renderCommentBody(
      sampleFailures,
      failingStats,
      '2026-05-29T00:00:00Z',
    );
    expect(body).toContain('Unknown diagram type \\| weird');
  });

  it('escapes backslashes before pipes so prefix escapes cannot break the table', () => {
    const trickyFailures: Failure[] = [
      {
        file: 'a.md',
        line: 1,
        message: 'bad \\| injected | here',
        severity: 'error',
      },
    ];
    const body = renderCommentBody(
      trickyFailures,
      { fileCount: 1, blockCount: 1, errorCount: 1, warningCount: 0 },
      '2026-05-29T00:00:00Z',
    );
    expect(body).toContain('bad \\\\\\| injected \\| here');
    expect(body).not.toContain('bad \\| injected');
  });

  it('collapses CRLF and multiple newlines into a single space', () => {
    const multiline: Failure[] = [
      {
        file: 'a.md',
        line: 1,
        message: 'line1\r\n\nline2\n\n\nline3',
        severity: 'error',
      },
    ];
    const body = renderCommentBody(
      multiline,
      { fileCount: 1, blockCount: 1, errorCount: 1, warningCount: 0 },
      '2026-05-29T00:00:00Z',
    );
    expect(body).toContain('line1 line2 line3');
  });

  it('includes timestamp footer', () => {
    const body = renderCommentBody([], emptyStats, '2026-05-29T12:34:56Z');
    expect(body).toContain('Last updated 2026-05-29T12:34:56Z');
  });
});

function makeIssues(existingBody: string | null) {
  const listComments = mock(async () => ({
    data: existingBody === null ? [] : [{ id: 999, body: existingBody }],
  }));
  const createComment = mock(async () => ({}));
  const updateComment = mock(async () => ({}));
  return { listComments, createComment, updateComment };
}

describe('upsertPrComment', () => {
  it('creates a new comment when no sentinel found', async () => {
    const issues = makeIssues(null);
    const res = await upsertPrComment({
      failures: [],
      stats: emptyStats,
      owner: 'o',
      repo: 'r',
      prNumber: 7,
      issues,
      now: () => new Date('2026-05-29T00:00:00Z'),
    });
    expect(res.action).toBe('created');
    expect(issues.createComment).toHaveBeenCalledTimes(1);
    expect(issues.updateComment).not.toHaveBeenCalled();
  });

  it('updates the existing sentinel comment', async () => {
    const issues = makeIssues(`${COMMENT_SENTINEL}\nold body`);
    const res = await upsertPrComment({
      failures: sampleFailures,
      stats: failingStats,
      owner: 'o',
      repo: 'r',
      prNumber: 7,
      issues,
      now: () => new Date('2026-05-29T00:00:00Z'),
    });
    expect(res.action).toBe('updated');
    expect(res.commentId).toBe(999);
    expect(issues.updateComment).toHaveBeenCalledTimes(1);
    expect(issues.createComment).not.toHaveBeenCalled();
  });

  it('ignores comments without the sentinel', async () => {
    const issues = makeIssues('unrelated comment from a bot');
    const res = await upsertPrComment({
      failures: [],
      stats: emptyStats,
      owner: 'o',
      repo: 'r',
      prNumber: 7,
      issues,
      now: () => new Date('2026-05-29T00:00:00Z'),
    });
    expect(res.action).toBe('created');
  });

  it('produces identical body for identical input (idempotent w/ fixed clock)', async () => {
    const captured: string[] = [];
    const captureIssues = () => ({
      listComments: async () => ({ data: [] }),
      createComment: async (p: { body: string }) => {
        captured.push(p.body);
      },
      updateComment: async () => {},
    });
    const fixedNow = () => new Date('2026-05-29T00:00:00Z');
    await upsertPrComment({
      failures: sampleFailures,
      stats: failingStats,
      owner: 'o',
      repo: 'r',
      prNumber: 7,
      issues: captureIssues(),
      now: fixedNow,
    });
    await upsertPrComment({
      failures: sampleFailures,
      stats: failingStats,
      owner: 'o',
      repo: 'r',
      prNumber: 7,
      issues: captureIssues(),
      now: fixedNow,
    });
    expect(captured).toHaveLength(2);
    expect(captured[0]).toBe(captured[1]!);
  });
});
