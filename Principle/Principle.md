# Principle.md

> Integrated engineering principles and workflow guide.
>
> This file merges and English-translates the Chinese documents `跨项目开发准则 v1.1.md` and `工作流.md`, then appends the existing English documents `CLAUDE.md` and `EXAMPLES.md`.

---

# Part I. Cross-Project Development Principles v1.1

## 1. General Principles

| Principle | Requirement |
|---|---|
| Boundary First | Before adding a feature, determine which module it belongs to. |
| User Experience First | Prioritize clarity, usability, and the user's core workflow; do not let technical convenience, feature quantity, or internal architecture degrade the actual user experience. |
| One-Way Dependency | Use `UI → service → repository → adapter`; reverse calls are not allowed. |
| Mature Solutions First | Prefer mature frameworks, libraries, and components when they are available. |
| Custom Code Only for Business Logic | Build custom logic only where the project has domain-specific requirements. |
| Small-Step Delivery | Change only one related problem set at a time; do not mix unrelated directions. |
| Minimal Patches | Deliver only changed files; do not deliver the full project unless explicitly required. |
| Regressible | Every change must explain how to verify it. |
| Traceable | Key tasks, pipelines, trades, orders, and execution results must have logs or states. |
| Replaceable | Use adapters to isolate data sources, models, strategies, execution endpoints, and UI components where possible. |
| Removable | Once new logic is stable, old logic must be deleted or explicitly marked as deprecated. |



---

# 2. Project Structure Principles

## 2.1 Split by Business Capability, Not by Technical Category

Not recommended:

```text
src/
  components/
  utils/
  services/
  api/
  pages/
```

Recommended:

```text
src/
  app/
  account/
  market/
  strategy/
  backtest/
  tracking/
  editor/
  assets/
  jobs/
  shared/
```

Reason:
Technical-layer grouping looks clear early on, but inevitably bloats later. Everything gets dumped into `utils`, `components`, and `services`, and boundaries eventually collapse.

---

## 2.2 Use Fixed Internal Layers Within Each Module

Recommended structure:

```text
module_name/
  api/
  service/
  repository/
  adapter/
  types/
  components/
  hooks/
  tests/
  README.md
```

| Layer | Responsibility |
|---|---|
| api | Public interfaces, routes, request/response handling. |
| service | Business rules and workflow orchestration. |
| repository | Data reads and writes. |
| adapter | Third-party systems, external libraries, and platform capability wrappers. |
| types | Types, enums, schemas. |
| components | UI presentation components. |
| hooks | Frontend state and interaction logic. |
| tests | Unit tests, integration tests, regression tests. |
| README.md | Module boundaries, data flow, forbidden actions. |

---

# 3. Dependency Principles

## 3.1 Allowed Dependency Direction

```text
UI / Page
  ↓
Hook / Controller
  ↓
Service
  ↓
Repository
  ↓
Adapter / DB / FileSystem / Third-party API
```

## 3.2 Forbidden Patterns

| Forbidden Behavior | Reason |
|---|---|
| UI directly reads/writes the database or files. | Hard to reuse and test later. |
| Repository contains business rules. | Pollutes the data layer. |
| Service directly manipulates the DOM. | Couples business logic to presentation. |
| Adapter calls service in reverse. | Lets external integration control the business layer. |
| shared depends on business modules. | Makes the shared layer uncontrolled. |
| One module bypasses another module's public interface. | Breaks encapsulation. |

---

# 4. File Size Principles

| Indicator | Handling Rule |
|---|---|
| Single file > 300 lines | Check whether it should be split. |
| Single file > 500 lines | In principle, it must be split. |
| Single function > 60 lines | Check whether it has too many responsibilities. |
| Single function > 100 lines | In principle, it must be split. |
| Single file imports > 12 | Check module responsibility boundaries. |
| Similar logic appears a third time | Extract it into a service/helper. |
| One bug touches more than 4 files | Indicates boundaries may need restructuring. |
| One module is directly depended on by more than 5 modules | Consider extracting a public capability or facade. |

---

# 5. shared / utils Principles

## 5.1 shared Should Contain Only Truly Common Capabilities

Allowed:

```text
shared/
  logger/
  result/
  date/
  path/
  error/
  http/
  ui/
```

Use cautiously:

```text
shared/
  utils.ts
  helper.ts
  common.ts
```

## 5.2 How to Decide Whether Something Belongs in shared

| Question | Decision |
|---|---|
| Is it reused by 3 or more modules? | If no, do not put it in shared. |
| Does it contain business meaning? | If yes, put it back into the business module. |
| Does it depend on business types? | If yes, it cannot go into shared. |
| Is it only placed there for “convenient imports”? | If yes, it should not be in shared. |

---

# 6. New Feature Development Principles

Every new feature must answer six questions first:

| Question | Purpose |
|---|---|
| Which business module does it belong to? | Prevent random placement. |
| Is there similar existing logic? | Prevent duplicate implementation. |
| Can a mature library be reused? | Reduce maintenance cost. |
| What is the public interface? | Clarify boundaries. |
| Which existing features are affected? | Control risk. |
| How can success be verified? | Ensure regression capability. |

Default workflow:

```text
Requirement confirmation
  ↓
Search existing logic
  ↓
Design the minimum-change solution
  ↓
Implement
  ↓
Local verification
  ↓
Package patch
  ↓
Explain changed files and verification commands
```

---

# 7. Existing Feature Modification Principles

When modifying existing features, do not only check whether “it can run.” You must also check:

| Check Item | Requirement |
|---|---|
| Does it break old interfaces? | Not allowed without explanation. |
| Does it introduce duplicate logic? | Not allowed. |
| Does it leave deprecated code behind? | Must clean it after stabilization. |
| Does it affect data definitions or metrics? | Must explain. |
| Does it affect frontend display? | Must check together. |
| Does it affect task chains? | Must check logs and states. |
| Is there a rollback plan? | Required for critical modules. |

---

# 8. Data and Task-Chain Principles

Applicable to quant projects, order systems, automation systems, editor file processing, and other projects.

## 8.1 Critical Chains Must Be Traceable

| Chain | Required Records |
|---|---|
| Data synchronization | Date, data source, quantity, failure reason. |
| Strategy computation | Parameters, version, input date, output count. |
| Backtest | `run_id`, configuration, equity curve, attribution, error. |
| Automatic delivery | Order number, template, card key, send state, failure reason. |
| Browser automation | Session, risk-control state, screenshots, error node. |
| File processing | Original file, save path, resource references, failure reason. |
| Export | Input document, export format, output path, exception. |

## 8.2 Task States Must Be Explicit

Do not use only:

```text
success / failed
```

Recommended:

```text
queued
running
success
partial_success
failed
cancelled
manual_required
expired
skipped
```

---

# 9. Frontend Development Principles

## 9.1 Do Not Overload Pages With Features

Every complex page must be divided into:

| Layer | Purpose |
|---|---|
| Normal Mode | Main user path, fewer buttons, fewer parameters. |
| Advanced Mode | Professional configuration, tuning, diagnostics. |
| Diagnostic Area | Errors, logs, data quality. |
| History Area | Tasks, snapshots, records. |

## 9.2 Frontend File Splitting Rules

Recommended:

```text
frontend/
  pages/
    dashboard/
      index.tsx
      components/
      hooks/
      service.ts
      types.ts
  shared/
    components/
    hooks/
    utils/
```

A single page file must not simultaneously handle:

```text
API requests
State management
Table rendering
Chart configuration
Modal logic
Business decisions
Error handling
```

---

# 10. Backend Development Principles

## 10.1 Backend Must Follow Layering

```text
routes / controllers
  ↓
services
  ↓
repositories
  ↓
db / external adapters
```

| Layer | Forbidden |
|---|---|
| routes | Must not write SQL directly. |
| service | Must not directly assemble HTTP response formats. |
| repository | Must not make business decisions. |
| db | Must not know upper-layer business semantics. |
| adapter | Must not pollute the business model. |

---

# 11. Third-Party Dependency Principles

## 11.1 Mature Solutions First

| Scenario | Prefer |
|---|---|
| Charts | ECharts / Recharts / TradingView-like mature solutions. |
| Markdown | Milkdown / CodeMirror / markdown-it / unified ecosystem. |
| Tables | TanStack Table / AG Grid, etc. |
| State management | Zustand / Redux Toolkit / Vue Pinia. |
| Backend API | FastAPI / Django / NestJS. |
| Task queues | Celery / RQ / Dramatiq. |
| Data validation | Pydantic / Zod. |
| ORM/SQL | SQLAlchemy / Prisma / Drizzle. |
| Automation | Playwright. |
| Logging | structlog / loguru / standard logging wrapper. |

## 11.2 When to Build Custom Logic

Build custom logic only under the following conditions:

| Condition | Build Custom? |
|---|---|
| It is the core competitive capability of the project. | Yes. |
| A third-party solution clearly fails to meet business requirements. | Yes. |
| It is just ordinary infrastructure. | Not recommended. |
| It is only because “writing it myself feels faster.” | Not recommended. |
| Future maintenance cost is uncontrollable. | Not recommended. |

---

# 12. Patch and Delivery Principles

Default delivery format:

```text
Goal of this change:
- xxx

Changed files:
- path/to/file1
- path/to/file2

Core changes:
- xxx
- xxx

Verification commands:
- xxx

Expected result:
- xxx

Risks:
- xxx
```

If delivering a patch package:

```text
Only include changed files
Preserve the original directory structure
Do not send the full project
Do not overwrite unrelated files
```

---

# 13. Technical Debt Management Principles

After each development round, perform a convergence check:

| Check Item | Action |
|---|---|
| Was duplicate logic added? | Merge it. |
| Was temporary code left behind? | Delete it or mark it as TODO. |
| Were useless parameters added? | Delete them. |
| Were useless interfaces added? | Delete them. |
| Does old logic coexist with new logic? | Define migration or deprecation. |
| Is there a test gap? | Add it to the regression checklist. |
| Is there a documentation gap? | Update module documentation. |

---

# 14. Version Iteration Rules

This guideline evolves by version.

| Version | Trigger |
|---|---|
| v1.0 | Current common baseline. |
| v1.1 | A project repeatedly hits the same problem and requires a new rule. |
| v1.2 | A class of architecture problems repeatedly loses control and needs stronger boundaries. |
| v2.0 | Multi-project experience matures enough to restructure it into a formal engineering manual. |

Every new rule must explain:

```text
New rule:
Why added:
Scope of applicability:
Out of scope:
Execution method:
```

---

# 15. The Most Important Hard Rules

All projects must follow these ten rules by default:

| No. | Hard Rule |
|---|---|
| 1 | Before adding a feature, check whether similar logic already exists. |
| 2 | Do not reinvent the wheel; mature solutions first. |
| 3 | Business logic must not be placed in UI components. |
| 4 | Routes must not operate the database directly. |
| 5 | Services must not depend directly on a concrete third-party platform. |
| 6 | The shared layer must not become a junk drawer. |
| 7 | A chain must have only one main entry point. |
| 8 | Every change must include a verification method. |
| 9 | Delete old logic once the new logic is stable. |
| 10 | Perform technical debt convergence after every development round. |

---

# 16. Multi-Mode / Multi-Rendering-Channel Development Principles

## 16.1 New Rule

Whenever a feature must support multiple display modes, editing modes, runtime modes, or rendering channels, develop it using:

```text
Capability abstraction + mode adapters + matrix regression
```

Typical scenarios:

| Scenario | Example |
|---|---|
| Multiple editing modes | Source mode / writing mode / split mode. |
| Multiple rendering modes | Markdown / HTML / PDF / print. |
| Multiple runtime modes | Local runtime / packaged runtime / service mode. |
| Multiple data-source modes | Redis / MySQL / file cache / third-party API. |
| Multiple execution modes | Simulation / manual confirmation / automatic execution. |

## 16.2 Why This Rule Was Added

This rule comes from real failure experience in the MarkdownEditor project.

In the early stage, features such as images, find/replace, keyboard shortcuts, and font settings were mostly implemented around source mode. After adding writing mode, namely the Milkdown/ProseMirror real-time rendering mode, many features began to fail with the pattern: “source mode works, writing mode fails.”

The root cause was not a single bug. The project did not abstract “editor capability” early enough. Feature logic was scattered across concrete UI and concrete DOM handling. After adding writing mode, old features were not uniformly adapted to ProseMirror state, transactions, CSS variables, and lifecycle events.

## 16.3 Scope of Applicability

Applies to all projects with multiple modes, multiple engines, or multiple data channels.

Examples:

| Project Type | Applicable Points |
|---|---|
| Markdown editor | Source mode, writing mode, split mode, export mode. |
| Quant system | Backtest mode, live trading mode, paper trading mode. |
| Automation system | Browser automation, manual takeover, background tasks. |
| Data platform | Offline data, real-time data, cached data. |
| Frontend application | Normal mode, advanced mode, diagnostic mode. |

## 16.4 Out of Scope

The following scenarios do not strictly require this rule:

1. One-off scripts.
2. Pure display pages with no shared state.
3. Small tools explicitly serving only one mode.
4. Prototype verification stages; however, once formal development starts, the rule must be applied.

## 16.5 Execution Method

Before adding or modifying a feature, list the mode matrix first:

| Feature | Source Mode | Writing Mode | Split Mode | Export/Print | Notes |
|---|---:|---:|---:|---:|---|
| Image insertion | Must test | Must test | Must test | Must test | Asset paths must be consistent. |
| Find/replace | Must test | Must test | Must test | N/A | Writing mode must not directly modify DOM. |
| Shortcuts | Must test | Must test | Must test | N/A | Centralized dispatch at the app layer. |
| Font and size | Must test | Must test | Must test | Optional | Watch third-party CSS overrides. |
| Save/autosave | Must test | Must test | Must test | N/A | Markdown content is the single source of truth. |

## 16.6 Hard Rules

| No. | Rule |
|---|---|
| 1 | When adding a new mode, regress all core features. |
| 2 | Do not verify only the feature currently being developed; verify the core loop. |
| 3 | Multi-mode shared capabilities must be abstracted into services/adapters/hooks and must not be scattered across concrete components. |
| 4 | Do not directly manipulate third-party editor DOM; use its official state mechanism or adapter. |
| 5 | Before integrating a third-party editor, read its events, styles, lifecycle, and serialization mechanisms. |
| 6 | Keyboard shortcuts must be managed by the global app layer and dispatched to the current active editor. |
| 7 | Images, saving, exporting, and close guards are core chains; any mode-related change must force regression on them. |
| 8 | For style issues, check CSS variables, reset.css, specificity, and shadow/internal DOM first; do not blindly add `!important`. |
| 9 | Fixing one mode must not degrade other modes. |
| 10 | After every multi-mode-related change, update the regression checklist or test samples. |

## 16.7 Recommended Architecture

Do not implement multi-mode features as:

```text
Component A handles source mode
Component B handles writing mode
Component C handles split mode
```

Recommended:

```txt
Unified feature entry
  ↓
EditorCapabilityService
  ↓
SourceEditorAdapter / WysiwygEditorAdapter / SplitEditorAdapter
  ↓
Concrete editor implementation
```

Examples:

```txt
saveCurrentDocument()
findInCurrentEditor()
replaceInCurrentEditor()
insertImageIntoCurrentEditor()
applyEditorSettings()
```

These functions should not care whether the underlying implementation is a textarea or ProseMirror. They should dispatch through adapters.

## 16.8 Regression Checklist

Any change involving editors, renderers, shortcuts, images, saving, exporting, or settings must regress the following:

| Category | Verification Items |
|---|---|
| File loop | New, open, save, save as, autosave, unsaved-close confirmation. |
| Editing modes | Source mode, writing mode, split mode; switching must not lose content. |
| Image chain | Drag, paste, button insert, relative path, reopen, export display. |
| Shortcuts | Ctrl+S, Ctrl+O, Ctrl+N, Ctrl+F, Ctrl+H, Ctrl+P, Ctrl+Shift+P. |
| Find/replace | All three modes can search; writing-mode highlight must not corrupt content. |
| Settings | Font, size, theme, autosave are effective in all modes. |
| Export | HTML, PDF, print images and styles are correct. |
| Error handling | Failures are visible; do not silently swallow errors; do not clear dirty state. |

---

# Part II. Workflow

# 1. Basic Process

## 1. Plan Stage: Optional When Needed

```text
Enter Plan mode. This stage is analysis only. Do not modify files.

Task: [write the task here]

Please read first:
- AGENTS.md
- docs/PRD.md
- docs/architecture.md
- docs/markdown_spec.md
- docs/progress.md, if it exists
- Cross-Project Development Principles v1.1.md, if it exists

Only output the following sections:

## Conclusion
One sentence explaining the recommended approach.

## Involved Files
| File | Purpose | Needs Modification |
|---|---|---|

## Recommended Plan
At most 5 items.

## Risks
At most 5 items.

## Acceptance Checklist
At most 8 items.

## Questions Needing Confirmation
If none, write “None.”

## Summary for ChatGPT
Within 20 lines. Keep only the key information.

Output limits:
1. Do not output full code.
2. Do not output full diffs.
3. Do not explain too much background.
4. Keep total output within 80 lines.
```

---

## 2. Build Stage

```text
Enter Build mode. Execute the confirmed plan.

Task: [write the task here]

Limits:
1. Only modify files confirmed in the Plan stage.
2. Do not perform unrelated refactoring.
3. Do not add unconfirmed dependencies.
4. Do not break the Markdown saving loop.
5. Do not break the image asset chain.
6. Do not break the writing-mode lifecycle.
7. Do not break the window close guard.
8. Run `pnpm build` after completion.

Output format:

## Conclusion
Completed / Not completed / Partially completed.

## Changed Files
| File | Change |
|---|---|

## Verification Commands
| Command | Result |
|---|---|

## Risks / Unfinished Items
At most 5 items.

## Summary for ChatGPT
Within 20 lines.

Output limits:
1. Do not output full code.
2. Do not output full diffs.
3. Do not output unrelated explanations.
4. If `pnpm build` fails, only paste the last 80 lines of the error.

Enter Build mode. Execute the confirmed plan.

Limits:
1. Only modify confirmed files.
2. Do not perform unrelated refactoring.
3. Do not add unconfirmed dependencies.
4. Do not break the image asset chain.
5. Do not break the Markdown saving loop.
6. Do not break the window close guard.
7. Run `pnpm build` after completion.

Output:
1. Changed files.
2. Core logic.
3. Commands run.
4. Manual verification points.
5. Risks / unfinished items.
```

---

## 3. Review Stage: Optional When Needed

```text
Enter Review mode. Do not modify code.

Review the latest change.

Only check:
1. git diff --stat
2. git diff --name-only
3. Whether unrelated files were modified
4. Whether Markdown content is affected
5. Whether image paths are affected
6. Whether writing mode is affected
7. Whether save/autosave is affected
8. Whether export is affected
9. Whether the window close guard is affected
10. Whether this should be committed

Output format:

## Should Commit?
Yes / No / Commit after fixing.

## Diff Overview
Paste the `git diff --stat` result.

## Risk Check
| Check Item | Result | Notes |
|---|---|---|

## Must Manually Verify
At most 8 items.

## Summary for ChatGPT
Within 20 lines.

Output limits:
1. Do not output full diffs.
2. Do not output full code.
3. Keep total output within 80 lines.
```

---

# 2. Commit Strategy Must Also Be Fixed

Every feature must have a checkpoint:

```powershell
pnpm build
git status
git diff --stat
git add .
git commit -m "type: message"
```

Recommended commit types:

| Type | Usage |
|---|---|
| `feat:` | New feature. |
| `fix:` | Bug fix. |
| `refactor:` | Refactoring. |
| `style:` | UI/CSS. |
| `chore:` | Configuration or checkpoint. |
| `test:` | Test samples. |

Stable points such as the image chain and close guard must be committed separately. Do not mix them with new features.

---

# 3. Work Combination

```text
You: product judgment + final acceptance
Me: architecture boundaries + risk control + instruction design
OpenCode Plan: read real code and design the plan
OpenCode Build: implement in small steps
OpenCode Review: review diffs and regression risks
Git: checkpoint each step
```

This uses OpenCode's code-context capability without letting it freely improvise in complex chains.

---

# Part III. LLM Coding Guidelines

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Part IV. Examples

# Examples

Real-world code examples demonstrating the four principles. Each example shows what LLMs commonly do wrong and how to fix it.

---

## 1. Think Before Coding

### Example 1: Hidden Assumptions

**User Request:** "Add a feature to export user data"

**❌ What LLMs Do (Wrong Assumptions)**

```python
def export_users(format='json'):
    """Export all users to a file."""
    users = User.query.all()
    
    if format == 'json':
        with open('users.json', 'w') as f:
            json.dump([u.to_dict() for u in users], f)
    elif format == 'csv':
        with open('users.csv', 'w') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'email', 'name'])
            writer.writeheader()
            writer.writerows([u.to_dict() for u in users])
    
    return f"Exported {len(users)} users"
```

**Problems:**
- Assumed it should export ALL users (what about pagination? privacy?)
- Assumed file location without asking
- Assumed which fields to include
- Assumed CSV fieldnames without checking actual data structure

**✅ What Should Happen (Surface Assumptions)**

```
Before implementing, I need to clarify:

1. **Scope**: Export all users or filtered subset? (privacy implications)
2. **Format**: You mentioned "export" - did you mean:
   - Download file in browser?
   - Background job with email notification?
   - API endpoint returning data?
3. **Fields**: Which user fields? (some might be sensitive)
4. **Volume**: How many users typically? (affects approach)

Simplest approach: Add an API endpoint that returns paginated JSON.
Would need more info for file-based exports.

What's your preference?
```

### Example 2: Multiple Interpretations

**User Request:** "Make the search faster"

**❌ What LLMs Do (Pick Silently)**

```python
# Adds caching, database indexes, and async processing
# without asking which "faster" matters
@lru_cache(maxsize=1000)
async def search(query: str) -> List[Result]:
    # ... 200 lines of optimization code
```

**✅ What Should Happen**

```
"Make the search faster" could mean:

1. **Faster response time** (< 100ms instead of 500ms)
   - Add database indexes
   - Cache frequent queries
   - Estimated effort: 2 hours

2. **Handle more concurrent searches** (throughput)
   - Add async/await
   - Connection pooling
   - Estimated effort: 4 hours

3. **Faster perceived speed** (UX)
   - Show partial results immediately
   - Progressive loading
   - Estimated effort: 3 hours

Current search takes ~500ms for typical queries. 
Which aspect matters most for your use case?
```

---

## 2. Simplicity First

### Example 1: Over-abstraction

**User Request:** "Add a function to calculate discount"

**❌ What LLMs Do (Overengineered)**

```python
from abc import ABC, abstractmethod
from enum import Enum
from typing import Protocol, Union
from dataclasses import dataclass

class DiscountStrategy(ABC):
    @abstractmethod
    def calculate(self, amount: float) -> float:
        pass

class PercentageDiscount(DiscountStrategy):
    def __init__(self, percentage: float):
        self.percentage = percentage
    
    def calculate(self, amount: float) -> float:
        return amount * (self.percentage / 100)

class FixedDiscount(DiscountStrategy):
    def __init__(self, fixed_amount: float):
        self.fixed_amount = fixed_amount
    
    def calculate(self, amount: float) -> float:
        return min(self.fixed_amount, amount)

@dataclass
class DiscountConfig:
    strategy: DiscountStrategy
    min_purchase: float = 0.0
    max_discount: float = float('inf')

class DiscountCalculator:
    def __init__(self, config: DiscountConfig):
        self.config = config
    
    def apply_discount(self, amount: float) -> float:
        if amount < self.config.min_purchase:
            return 0
        discount = self.config.strategy.calculate(amount)
        return min(discount, self.config.max_discount)

# Usage requires 30+ lines of setup for a simple calculation
```

**✅ What Should Happen (Simple)**

```python
def calculate_discount(amount: float, percent: float) -> float:
    """Calculate discount amount. percent should be 0-100."""
    return amount * (percent / 100)

# Usage
discount = calculate_discount(100.0, 10.0)  # $10 off
```

**When to add complexity:** Only when you actually need multiple discount types. If that requirement comes later, refactor then.

### Example 2: Speculative Features

**User Request:** "Save user preferences to database"

**❌ What LLMs Do (Unnecessary Features)**

```python
class PreferenceManager:
    def __init__(self, db, cache=None, validator=None):
        self.db = db
        self.cache = cache or InMemoryCache()
        self.validator = validator or DefaultValidator()
    
    def save(self, user_id: int, prefs: dict, 
             merge: bool = True, 
             validate: bool = True,
             notify: bool = False) -> bool:
        """Save preferences with optional merging, validation, and notifications."""
        
        if validate:
            errors = self.validator.validate(prefs)
            if errors:
                raise ValidationError(errors)
        
        existing = self.get(user_id) if merge else {}
        
        if merge:
            existing.update(prefs)
            prefs = existing
        
        self.db.execute(
            "UPDATE users SET preferences = ? WHERE id = ?",
            (json.dumps(prefs), user_id)
        )
        
        if self.cache:
            self.cache.set(f"prefs:{user_id}", prefs)
        
        if notify:
            self.notify_preference_change(user_id, prefs)
        
        return True
    
    def notify_preference_change(self, user_id: int, prefs: dict):
        # Another 30 lines for a feature nobody asked for
        pass
```

**✅ What Should Happen (Just What Was Asked)**

```python
def save_preferences(db, user_id: int, preferences: dict):
    """Save user preferences to database."""
    db.execute(
        "UPDATE users SET preferences = ? WHERE id = ?",
        (json.dumps(preferences), user_id)
    )
```

**Add later if needed:** Caching (when performance matters), validation (when bad data appears), merging (when requirement emerges).

---

## 3. Surgical Changes

### Example 1: Drive-by Refactoring

**User Request:** "Fix the bug where empty emails crash the validator"

**❌ What LLMs Do (Too Much)**

```diff
  def validate_user(user_data):
-     # Check email format
-     if not user_data.get('email'):
+     """Validate user data."""
+     email = user_data.get('email', '').strip()
+     
+     # Validate email
+     if not email:
          raise ValueError("Email required")
-     
-     # Basic email validation
-     if '@' not in user_data['email']:
+     if '@' not in email or '.' not in email.split('@')[1]:
          raise ValueError("Invalid email")
      
-     # Check username
-     if not user_data.get('username'):
+     # Validate username
+     username = user_data.get('username', '').strip()
+     if not username:
          raise ValueError("Username required")
+     if len(username) < 3:
+         raise ValueError("Username too short")
+     if not username.isalnum():
+         raise ValueError("Username must be alphanumeric")
      
      return True
```

**Problems:**
- "Improved" email validation beyond the bug fix
- Added username validation nobody asked for
- Changed comments
- Added docstring

**✅ What Should Happen (Surgical)**

```diff
  def validate_user(user_data):
      # Check email format
-     if not user_data.get('email'):
+     email = user_data.get('email', '')
+     if not email or not email.strip():
          raise ValueError("Email required")
      
      # Basic email validation
-     if '@' not in user_data['email']:
+     if '@' not in email:
          raise ValueError("Invalid email")
      
      # Check username
      if not user_data.get('username'):
          raise ValueError("Username required")
      
      return True
```

**Only changed:** The specific lines that fix empty email handling.

### Example 2: Style Drift

**User Request:** "Add logging to the upload function"

**❌ What LLMs Do (Reformat Everything)**

```diff
- def upload_file(file_path, destination):
+ def upload_file(file_path: str, destination: str) -> bool:
+     """Upload file to destination with logging."""
+     logger.info(f"Uploading {file_path} to {destination}")
+     
      try:
-         with open(file_path, 'rb') as f:
-             data = f.read()
-         
-         response = requests.post(destination, files={'file': data})
-         
-         if response.status_code == 200:
-             return True
-         else:
-             return False
+         with open(file_path, "rb") as f:
+             data = f.read()
+         response = requests.post(destination, files={"file": data})
+         success = response.status_code == 200
+         
+         if success:
+             logger.info(f"Upload successful: {file_path}")
+         else:
+             logger.error(f"Upload failed: {file_path}, status={response.status_code}")
+         
+         return success
      except Exception as e:
-         print(f"Error: {e}")
+         logger.exception(f"Upload error for {file_path}: {e}")
          return False
```

**Problems:**
- Changed quote style ('' to "")
- Added type hints nobody asked for
- Added docstring
- Reformatted whitespace
- Changed boolean return logic

**✅ What Should Happen (Match Existing Style)**

```diff
+ import logging
+ 
+ logger = logging.getLogger(__name__)
+ 
  def upload_file(file_path, destination):
+     logger.info(f'Starting upload: {file_path}')
      try:
          with open(file_path, 'rb') as f:
              data = f.read()
          
          response = requests.post(destination, files={'file': data})
          
          if response.status_code == 200:
+             logger.info(f'Upload successful: {file_path}')
              return True
          else:
+             logger.error(f'Upload failed: {file_path}, status={response.status_code}')
              return False
      except Exception as e:
-         print(f"Error: {e}")
+         logger.exception(f'Upload error: {file_path}')
          return False
```

**Matched:** Single quotes, no type hints, existing boolean pattern, spacing style.

---

## 4. Goal-Driven Execution

### Example 1: Vague vs. Verifiable

**User Request:** "Fix the authentication system"

**❌ What LLMs Do (Vague Approach)**

```
I'll fix the authentication system by:
1. Reviewing the code
2. Identifying issues
3. Making improvements
4. Testing the changes

[Proceeds to make changes without clear success criteria]
```

**✅ What Should Happen (Verifiable Goals)**

```
To "fix authentication," I need to define success criteria. 
What specific issue are we solving?

If the issue is "users stay logged in after password change":

Plan:
1. Write test: Change password → verify old session invalidated
   Verify: Test fails (reproduces bug)

2. Implement: Invalidate sessions on password change
   Verify: Test passes

3. Check edge cases: Multiple active sessions, concurrent changes
   Verify: Additional tests pass

4. Verify no regression: Existing auth tests still pass
   Verify: Full test suite green

Current test coverage for auth: [shows coverage]
What's the specific auth issue you're seeing?
```

### Example 2: Multi-Step with Verification

**User Request:** "Add rate limiting to the API"

**❌ What LLMs Do (All at Once)**

```python
# Implements full rate limiting with Redis, multiple strategies,
# configuration system, and monitoring in one 300-line commit
# No clear verification steps
```

**✅ What Should Happen (Incremental with Verification)**

```
Plan for rate limiting:

1. Add basic in-memory rate limiting (single endpoint)
   Verify: 
   - Test: 100 requests → first 10 succeed, rest get 429
   - Manual: curl endpoint 11 times, see rate limit error

2. Extract to middleware (apply to all endpoints)
   Verify:
   - Test: Rate limits apply to /users and /posts
   - Existing endpoint tests still pass

3. Add Redis backend (for multi-server)
   Verify:
   - Test: Rate limit persists across app restarts
   - Test: Two app instances share rate limit counter

4. Add configuration (rates per endpoint)
   Verify:
   - Test: /search allows 10/min, /users allows 100/min
   - Config file parsed correctly

Each step is independently verifiable and deployable.
Start with step 1?
```

### Example 3: Test-First Verification

**User Request:** "The sorting breaks when there are duplicate scores"

**❌ What LLMs Do (Fix Without Reproducing)**

```python
# Immediately changes sort logic without confirming the bug
def sort_scores(scores):
    return sorted(scores, key=lambda x: (-x['score'], x['name']))
```

**✅ What Should Happen (Reproduce First)**

```python
# 1. First, write a test that reproduces the issue
def test_sort_with_duplicate_scores():
    """Test sorting when multiple items have same score."""
    scores = [
        {'name': 'Alice', 'score': 100},
        {'name': 'Bob', 'score': 100},
        {'name': 'Charlie', 'score': 90},
    ]
    
    result = sort_scores(scores)
    
    # The bug: order is non-deterministic for duplicates
    # Run this test multiple times, it should be consistent
    assert result[0]['score'] == 100
    assert result[1]['score'] == 100
    assert result[2]['score'] == 90

# Verify: Run test 10 times → fails with inconsistent ordering

# 2. Now fix with stable sort
def sort_scores(scores):
    """Sort by score descending, then name ascending for ties."""
    return sorted(scores, key=lambda x: (-x['score'], x['name']))

# Verify: Test passes consistently
```

---

## Anti-Patterns Summary

| Principle | Anti-Pattern | Fix |
|-----------|-------------|-----|
| Think Before Coding | Silently assumes file format, fields, scope | List assumptions explicitly, ask for clarification |
| Simplicity First | Strategy pattern for single discount calculation | One function until complexity is actually needed |
| Surgical Changes | Reformats quotes, adds type hints while fixing bug | Only change lines that fix the reported issue |
| Goal-Driven | "I'll review and improve the code" | "Write test for bug X → make it pass → verify no regressions" |

## Key Insight

The "overcomplicated" examples aren't obviously wrong—they follow design patterns and best practices. The problem is **timing**: they add complexity before it's needed, which:

- Makes code harder to understand
- Introduces more bugs
- Takes longer to implement
- Harder to test

The "simple" versions are:
- Easier to understand
- Faster to implement
- Easier to test
- Can be refactored later when complexity is actually needed

**Good code is code that solves today's problem simply, not tomorrow's problem prematurely.**
