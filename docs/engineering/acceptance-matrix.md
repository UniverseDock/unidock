# Automated Acceptance Matrix

## Principle

自动化验收是默认门槛，人工验收只用于浏览器兼容性、安装体验和难以稳定模拟的外部环境差异。任何新增功能都必须先补到对应的自动化层，再更新本矩阵。

## Current automated coverage

| Area | Node / contract | Real Chromium / Playwright | Status |
| --- | --- | --- | --- |
| Storage Adapter | IndexedDB unavailable、错误分类、adapter id、destroy | Query boundary、lifecycle、close/reopen、versionchange | Automated |
| Content | CRUD、过滤、标签、分页、坏数据 | Web App local content persistence | Automated |
| Reader | Document/Block、Repository、ReadingState | Open Reader、read/starred、refresh recovery | Automated |
| RSS | RSS/Atom parser、fetcher、importer、dedup、extractor | Local CORS fixture import、refresh、subscription removal、article retention | Automated |
| Backup | JSON format、schema、URL、reference validation | Download、delete、file import、state recovery | Automated |
| PWA | Static manifest、cache list、update message | SW activation、waiting、user-confirmed update、data retention、offline reload | Automated |
| Build quality | TypeScript and package builds | Playwright acceptance runner | Automated |

## Commands

Run the complete pipeline:

```bash
corepack pnpm acceptance
```

The pipeline runs:

1. All workspace builds.
2. All workspace Node tests serially.
3. Playwright Chromium acceptance.

Useful focused commands:

```bash
corepack pnpm --filter @unidock/web test:browser
corepack pnpm --filter @unidock/web verify
```

## Manual assistance only

The following remain manual or environment-assisted:

- Installed PWA experience on different operating systems and browsers.
- Browser restart and first cold start in a newly opened tab.
- Real public Feed CORS and site-specific response behavior.
- Storage quota and browser eviction policies.
- Accessibility and responsive visual review.

Manual checks are supplementary evidence; they must not replace the automated pipeline for existing functionality.
