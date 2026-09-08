# T005-A1 static review

- Contract: Generation-7 T005, revision 1.
- Input: HEAD `8b5894bc85a7de3d608efa8db74357d942764519` plus the pre-existing generation-7 planning tree.
- Owned implementation path: `tests/e2e/production/station-resource-group.spec.ts`.
- Static expected derivation: Empire 1 saved stations produce resource groups `[hydrogen, methane, ore, silicon]`, `[helium, methane]`, and `[ice]`; Empire 2 produces one group `[helium, hydrogen, methane, ore, silicon]` because its first station's relevant wares are locked and its second station remains resource-bearing. Logic Flow 1 retains three groups and seven summary tags.
- Fixture negative controls: `M7 Empty Empire` has no stations; `M7 Empty Plan` has no groups. Neither is loadable.
- `git diff --check -- tests/e2e/production/station-resource-group.spec.ts`: exit 0.
- Browser/build/focused validation: unavailable; dispatcher confirmation for the exclusive `e2e-build-browser` resource was not present, so no browser or build command was run.
