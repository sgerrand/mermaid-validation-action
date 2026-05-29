# mermaid-validation-action

A GitHub Action that validates [Mermaid](https://mermaid.js.org/) diagrams embedded in Markdown files. Use it as a PR check to catch broken diagrams before they merge and render as error boxes on github.com.

- **Fast**: pure Node, no headless browser. ~1–3s per run on a typical repo.
- **Accurate**: uses the official `mermaid` package, so any diagram GitHub can render is recognised here.
- **Informative**: failures appear as inline annotations on the Files Changed tab, a sticky PR comment, and the Actions job summary.

## Quickstart

```yaml
# .github/workflows/mermaid.yml
name: mermaid
on:
  pull_request:
    paths:
      - '**/*.md'

permissions:
  contents: read
  pull-requests: write # only if you want the sticky PR comment

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sgerrand/mermaid-validation-action@v0
```

That's it. On every PR that touches Markdown, the action scans `**/*.md`, validates every fenced `mermaid` block, and fails the job if any block has a syntax error.

## Inputs

| Input               | Default               | Description                                                                                      |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `files`             | `**/*.md`             | Newline-separated glob patterns. Supports `!` negation.                                          |
| `working-directory` | `.`                   | Directory to resolve globs against.                                                              |
| `fail-on-warning`   | `false`               | If `true`, treat warnings (e.g. unknown diagram type) as failures.                               |
| `comment-on-pr`     | `true`                | Post or update a sticky PR comment with the validation summary. Requires `pull-requests: write`. |
| `github-token`      | `${{ github.token }}` | Token used for the sticky comment.                                                               |

### Globs

```yaml
- uses: sgerrand/mermaid-validation-action@v0
  with:
    files: |
      docs/**/*.md
      README.md
      !docs/archive/**
```

## Outputs

| Output          | Description                                |
| --------------- | ------------------------------------------ |
| `error-count`   | Number of diagrams that failed validation. |
| `warning-count` | Number of diagrams that produced warnings. |
| `file-count`    | Number of Markdown files scanned.          |
| `block-count`   | Number of mermaid code blocks found.       |

```yaml
- uses: sgerrand/mermaid-validation-action@v0
  id: mermaid
- run: echo "Found ${{ steps.mermaid.outputs.block-count }} diagrams"
```

## Permissions

Minimum:

```yaml
permissions:
  contents: read
```

Add `pull-requests: write` if you want the sticky PR comment. When the action can't comment (missing permission, fork PR, etc.) it logs a warning and continues — annotations and the job summary still appear.

## How it works

1. Each Markdown file is parsed with `remark-parse` to find fenced `mermaid` code blocks.
2. Each block's text is handed to `mermaid.parse()`, which uses the official Mermaid grammar — the same one GitHub uses to render.
3. A small `happy-dom` polyfill provides the DOM globals Mermaid expects, so no headless browser is needed.
4. Failures become `::error file=...,line=...::` annotations anchored back to the source Markdown line, plus a Markdown table in `GITHUB_STEP_SUMMARY` and an upserted sticky PR comment marked with `<!-- mermaid-validation-action -->`.

## Supported diagram types

Everything the bundled `mermaid` version (currently 11.x) supports: `flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram` / `stateDiagram-v2`, `erDiagram`, `journey`, `gantt`, `pie`, `mindmap`, `timeline`, `quadrantChart`, `requirementDiagram`, `gitGraph`, `C4Context` / `C4Container` / `C4Component` / `C4Dynamic` / `C4Deployment`, `sankey-beta`, `xychart-beta`, `block-beta`, `packet-beta`, `architecture-beta`.

## Development

```bash
bun install
bun run typecheck
bun test
bun run build
```

The `dist/index.js` bundle is checked in because Node-based GitHub Actions run from the repo state at the ref they're pinned to — there is no `bun install` step on the runner. CI fails if `dist/` drifts from `src/`.

### Local hooks

`bun install` wires up [lefthook](https://github.com/evilmartians/lefthook) automatically via the `prepare` script. The hooks call five external binaries — install them once via Homebrew:

```bash
brew install gitleaks mado actionlint check-jsonschema
brew install crate-ci/committed/committed
```

- `gitleaks` — scans staged content for secrets on every commit.
- `mado` — markdownlint-compatible Markdown lint.
- `actionlint` — schema + expression + shellcheck lint for GitHub Actions workflows.
- `check-jsonschema` — JSON Schema validation for `dependabot.yml` (and anything else with a SchemaStore entry).
- `committed` — Conventional Commits check on commit messages.

If any of these is missing the matching hook fails fast; the rest still run.

## Roadmap

- Render-mode opt-in (`mode: render`) backed by `mmdc` for layout-level validation.
- Custom lint rules beyond pure syntax.
- `.mdx` support.

## Releases

Releases are automated by [release-please](https://github.com/googleapis/release-please) via [release-mate/action](https://github.com/release-mate/action), driven by Conventional Commits.

- Every push to `main` opens or updates a release PR with a generated CHANGELOG and version bump.
- Merging the release PR cuts a new GitHub Release and tag (e.g. `v0.2.0`).
- `.github/workflows/publish.yml` then runs [`actions/publish-action`](https://github.com/actions/publish-action), which force-moves the matching `vMAJOR` and `vMAJOR.MINOR` tags so consumers pinning `@v0` always get the latest compatible release.

Two organisation/repository secrets are required for the release workflow:

- `RELEASE_MATE_CLIENT_ID` — Release Mate GitHub App client ID.
- `RELEASE_MATE_PRIVATE_KEY` — PEM-encoded private key for the same App.

See [release-mate/action](https://github.com/release-mate/action) for App installation instructions.

## License

BSD 2-Clause — see [LICENSE](LICENSE).
