---
name: renovate-review
description: Review Renovate dependency update PRs for breaking changes and compatibility
---

## Available MCP Tools

- **github**: `get_pull_request`, `get_pull_request_diff`, `create_pull_request_review`
- **context7**: Fetch library documentation for the updated package
- **fetch**: Retrieve URLs (changelogs, migration guides)
- **bash**: Run npm build/test commands

## Procedure

### Step 1: Get PR Details

Use the github MCP to get the PR body and diff:

- `get_pull_request` with owner, repo, pullNumber from environment variables
- `get_pull_request_diff` to see what changed

The PR body contains the changelog from Renovate.

### Step 2: Verify the Update

Run and report results:

- `npm run build` - Check for TypeScript/compilation errors
- `npm test` - Verify tests still pass

### Step 3: Research the Package

- Use **context7** to fetch docs for the updated package
- Use **fetch** to get the changelog URL if mentioned in PR body
- Look for BREAKING CHANGE sections in the changelog

### Step 4: Analyze Impact

- Search codebase for usages of the updated package
- Check if deprecated APIs are used in our code
- Identify required code changes

### Step 5: Submit Review

Use `create_pull_request_review` to post your review:

- owner: from `REPO_OWNER` env var
- repo: from `REPO_NAME` env var
- pullNumber: from `PR_NUMBER` env var
- event: COMMENT
- body: Your structured review

## Review Format

Your review MUST include a clear **Judgement** section explaining whether this major update is safe to merge as-is, or what changes are needed.

## Dependency Update Review

**Package:** [name] [old] → [new]
**Build:** ✅ Pass / 🚨 Fail
**Tests:** ✅ Pass / 🚨 Fail

### Breaking Changes in Changelog

[List each breaking change found, or "None identified"]

### Our Code Impact

[Which parts of our codebase use this package and how]

### Judgement

**✅ Safe to merge as-is** (if applicable)

Explain WHY this major update can be merged without code changes:

- "Build and tests pass without modifications"
- "None of the breaking changes affect our usage because..."
- "We don't use any of the deprecated/removed APIs"
- [specific evidence from your analysis]

**OR**

**⚠️ Changes required before merging** (if applicable)

For EACH required change, provide:

**1. `path/to/file.ts` — [Brief description]**

- **What:** The specific code change needed
- **Why:** Which breaking change necessitates this (reference changelog)
- **How:**

    ```typescript
    // Before
    oldCode();

    // After
    newCode();
    ```

**2. `path/to/another.ts` — [Brief description]**

- **What:** ...
- **Why:** ...
- **How:** ...

[Continue for all required changes]
