# Shared agent configuration

Open **InvoiceUI itself** as the editor workspace so native project rules and ignores resolve from the correct root. Existing running agents may need a fresh chat or rules reload. No global settings or app code were changed by this setup.

## Maintenance

- Edit `.cursor/rules/00-12-*.mdc` as the single source of project guidance.
- Edit `.cursor/skills/<name>/SKILL.md` for project skills; the sync copies them to Claude and Agents destinations.
- Edit `.cursorignore` for common exclusions. `.cursorindexingignore` stays Cursor-only.
- Run `npm run sync:agents` to refresh native adapters.
- Run `npm run sync:agents:check` to detect drift without writing files.
- When adding or renaming a topic, put it in `.cursor/rules` with description, `alwaysApply`, and `globs` for scoped rules. The sync copies every numbered topic into each agent's native rules directory. It refuses to replace unrelated existing configurations. It merges Claude deny entries while preserving other settings. Stale numbered copies and leftover pointer files are removed. Extra copied skills that are no longer in Cursor are removed too.

Rules are numbered **00-12**: project contract, efficient collaboration, mandatory UI stack, frontend quality, auth/privacy, money/lifecycle, persistence/autosave, documents, delivery/automation, verification, release/restore, rule maintenance and punctuation. Numbers organise topics; they are not a universal precedence mechanism.

The short startup set contains 00, 01, 02, 11 and 12. Detailed topics load by file scope where supported, or through explicit instructions to read only the relevant topic. All agents share the same content; do not hand-edit generated copies. This reduces repeated context without dropping the user's hard requirement: **shadcn/ui, Motion, Animate UI, Magic UI and React Bits must all have real product usage**. The phrase Animated/Animation UI is interpreted as Animate UI; if a different library is intended, update Cursor rule 02 and sync.

## Agent coverage and actual entry points

| Agent | Rules configured | Exclusions configured / limitation |
| --- | --- | --- |
| Cursor | `.cursor/rules/00-12-*.mdc`, always-on core and scoped topics; project skills in `.cursor/skills` | `.cursorignore`; `.cursorindexingignore` additionally keeps lockfiles and generated Worker bindings out of indexing while available for direct inspection |
| Codex | Root `AGENTS.md` plus numbered copies in `.codex/rules`; skills copied to `.agents/skills` | Shared agent guidance and existing Git exclusions. No documented universal `.codexignore` assumed |
| Antigravity | Numbered copies in `.agents/rules` and `.antigravity/rules` | Shared policy is guidance; no invented `.antigravityignore` or unsupported security setting |
| Claude Code | `CLAUDE.md` plus numbered `.claude/rules/00-12-*.md` (always-on and path-scoped); skills copied to `.claude/skills` | `.claude/settings.json` denies selected secret reads through native permissions; shared policy handles remaining context noise. No fabricated `.claudeignore` |
| Gemini CLI | `GEMINI.md` | `.geminiignore` for tools that honour it; restart session after changes |
| Gemini Code Assist | Root guidance can be attached; automatic loading varies by product/mode | `.aiexclude`; no claim that every Code Assist mode automatically reads GEMINI.md |
| GitHub Copilot | `.github/copilot-instructions.md` | Shared guidance. Organization/repository content exclusions require GitHub settings and vary by surface; no fake `.copilotignore` |
| Windsurf | Numbered copies in `.windsurf/rules` | `.codeiumignore` for indexing |
| Cline | Numbered copies in `.clinerules` | `.clineignore` |
| Roo Code | Numbered copies in `.roo/rules` | `.rooignore` |
| Kilo Code | Numbered copies in `.kilocode/rules` plus root AGENTS.md compatibility | `.kilocodeignore`, retained compatibility format; current versions migrate it to permissions |
| Continue | Numbered copies in `.continue/rules` | `.continueignore` for codebase indexing where supported; not a universal agent tool block |
| Aider | `.aider.conf.yml` adds root AGENTS.md as read-only context | `.aiderignore` |
| OpenCode | Root `AGENTS.md` with explicit topic loading instructions | Shared guidance and normal Git-aware search behavior; no invented `.opencodeignore` |
| Junie | `.junie/AGENTS.md` plus numbered copies in `.junie/rules` | `.aiignore` for the IDE plugin; do not assume identical CLI enforcement |
| Amazon Q Developer | Numbered copies in `.amazonq/rules` | Shared guidance; no unsupported product-specific ignore file claimed |
| Augment / Auggie | Numbered copies in `.augment/rules` | `.augmentignore` for indexing |

This covers the listed tools, not a promise of support for every agent ever released. Unlisted tools that support AGENTS.md can use the shared entry point. Native formats were checked against official documentation on 2026-09-12; installed versions can differ. No extensions, providers or agents were installed or launched.

## Ignore design and boundaries

The common list excludes dependencies/recovery copies, caches, build output, provider runtime state, environment secrets, credentials, logs, private exports/backups, database dumps, archives and local agent transcripts. It deliberately keeps source, tests, SQL migrations, package manifests/lockfiles, environment examples, Worker bindings and public design assets accessible. Whole PDF/image/CSV extensions are not blocked: synthetic document fixtures and visual verification need them. Put private/generated exports in the excluded folders.

Ignore files are context controls with tool-specific enforcement. They do not create an operating-system sandbox, revoke already-loaded context, remove tracked secrets or necessarily block terminal/MCP reads. The rule against bypassing exclusions applies across agents. Claude's selected read-deny patterns are intentionally separate from Gitignore syntax and do not block environment examples; they are not a complete terminal sandbox or blanket exclusion for every possible secret filename.

The existing `.gitignore` is kept separate from AI-only indexing noise. A small appended block protects additional local outputs/secrets and allows sanitized environment examples to be committed. Do not put real secrets in example files.

## Official references

- [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md/)
- [Cursor rules](https://prod.cursor.com/docs/rules), [ignore files](https://prod.cursor.com/help/customization/ignore-files)
- [Antigravity rules](https://antigravity.google/docs/rules-workflows)
- [Claude memory and rules](https://code.claude.com/docs/en/memory), [permissions](https://code.claude.com/docs/en/permissions)
- [Gemini CLI ignores](https://geminicli.com/docs/cli/gemini-ignore/), [Code Assist exclusions](https://docs.cloud.google.com/gemini/docs/codeassist/create-aiexclude-file)
- [Copilot instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions), [content exclusions](https://docs.github.com/en/copilot/how-tos/configure-content-exclusion/exclude-content-from-copilot)
- [Windsurf rules](https://docs.windsurf.com/windsurf/cascade/memories), [index exclusions](https://docs.windsurf.com/context-awareness/windsurf-ignore)
- [Cline rules](https://docs.cline.bot/customization/cline-rules), [ignores](https://docs.cline.bot/customization/clineignore)
- [Roo instructions](https://docs.roocode.com/features/custom-instructions), [ignores](https://docs.roocode.com/features/rooignore)
- [Kilo rules](https://kilo.ai/docs/customize/custom-rules), [ignore compatibility](https://kilo.ai/docs/customize/context/kilocodeignore)
- [Continue rules](https://docs.continue.dev/customize/rules), [codebase exclusions](https://docs.continue.dev/reference/deprecated-codebase)
- [Aider configuration](https://aider.chat/docs/config/aider_conf.html), [ignores](https://aider.chat/docs/faq.html)
- [OpenCode instructions](https://opencode.ai/v2/docs/instructions)
- [Junie guidelines](https://junie.jetbrains.com/docs/guidelines-and-memory.html), [IDE exclusions](https://junie.jetbrains.com/docs/junie-plugin-project-settings.html)
- [Amazon Q rules](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/context-project-rules.html)
- [Augment rules](https://docs.augmentcode.com/cli/rules), [index exclusions](https://docs.augmentcode.com/setup-augment/workspace-indexing)
