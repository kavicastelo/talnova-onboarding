# Comparison with Audit V0

V0 was read only after this reconstruction.

| Area | Audit V0 | Ground truth | Difference / confidence |
|---|---|---|---|
| Missing USER_CREATED producer | P0 fact | confirmed by code search | agreement / high. |
| Manual assignment core | described as reliable | implemented, but not runtime-verified here because DB tests skipped | V0 overstated verification / high. |
| Task dependency gating | V0 called unenforced | TaskService blocks completing a task with uncompleted prerequisites | disagreement: completion gating is implemented; no broader onboarding gate / high. |
| Advanced journey branches | V0 said stored/unenforced | service/controller implement branch and prerequisites, but branching not called by quiz flow | partial disagreement / high. |
| No onboarding model | V0 fact | committed architecture lacks one; uncommitted worktree now has one | V0 correct for committed baseline; current worktree distinction required / high. |
| Test evidence | V0 said no test execution | this audit executed test command and found DB suites skipped | V1 has stronger executable evidence / high. |

No finding was accepted merely because V0 or documentation claimed it.
