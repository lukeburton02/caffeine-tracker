# Caffeine Tracker — Open Tasks

## Mobile layout
- [x] Test on real device after 900px breakpoint change and 2×2 preset grid fix
- [x] Check analysis page panel stacking on phone
- [x] Verify Live page chart height fills screen correctly on mobile (uses `100dvh`)

## Recurring maintenance

### GitHub Actions version bumps
GitHub drops old Node.js versions from runners roughly every 1–2 years, and the official Pages actions cut a new major version to match. When deprecation warnings appear in Actions logs:
1. Check latest releases: `gh api repos/actions/checkout/releases/latest --jq '.tag_name'` (repeat for configure-pages, upload-pages-artifact, deploy-pages)
2. Review release notes for breaking changes (historically just Node.js version bumps — safe to update)
3. Bump all four in `.github/workflows/deploy.yml` together
