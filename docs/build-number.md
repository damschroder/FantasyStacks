# Build label

The footer build number and `fantasy_stacks_build` PostHog property come from `NEXT_PUBLIC_APP_BUILD`. Both the Sites/Vinext and GitHub Pages/Next builds set that value automatically from the full Git commit count. A new pushed commit therefore advances the label when it is built and published.

When a source archive or shallow checkout has no full Git history, set `FANTASY_STACKS_BUILD_NUMBER` to the pushed commit's count before building. Without that override, the build uses a numeric timestamp so it never silently reuses a stale hard-coded label. The label is embedded at build time; a browser refresh cannot change it until a new version is deployed.
