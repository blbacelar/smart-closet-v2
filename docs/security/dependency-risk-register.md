# Dependency risk register

Last reviewed: 2026-10-15  
Owner: Fitly engineering  
Next review: 2026-11-15, or earlier when Expo publishes another SDK 57 patch set

This register covers the unresolved critical and high findings reported by:

```sh
npm audit --omit=dev --audit-level=critical
```

The lockfile currently has no critical finding. Compatible patch updates removed the
`shell-quote`, `brace-expansion`, and `js-yaml` high-severity root advisories. The
remaining high package entries collapse to the two transitive root advisories below; npm
counts every affected package in those dependency chains, not only the two root causes.

## Accepted high findings

| Root advisory | Reachability and exposure | Why it is not force-fixed | Mitigation and exit condition |
| --- | --- | --- | --- |
| `braces` stack exhaustion (`GHSA-vfj7-8cjw-p6xm`) through `micromatch`, Jest, Metro, React Native, and Expo tooling | Pattern parsing is used by local/CI build and test tools. Fitly does not pass member-controlled glob patterns to these tools, and the vulnerable parser is not exposed by the shipped app or an application server. | npm offers only a forced Jest/React Native dependency-tree change that is outside the Expo SDK 57 compatibility set. | Keep Node inputs repository-controlled, run CI with read-only permissions, retain the critical production gate, and accept the first Expo/Jest-compatible patched tree. |
| `node-forge` signature verification (`GHSA-86w9-cpqp-85rv`) through `@expo/code-signing-certificates` and `@expo/cli` | This path is used by Expo build/code-signing tooling, not by member-controlled application data at runtime. | npm's suggested forced resolution downgrades Expo to 44, which violates the SDK 57 requirement and would break the app. | Use the exact SDK 57 patch set and locked CLI tree, trust only configured Expo/EAS build endpoints, and upgrade as soon as Expo ships a compatible fix. |

## Review rule

Any new critical finding blocks merge. Any new high root advisory must be fixed with an
SDK-compatible patch or added here with its path, exposure analysis, owner, review date,
and exit condition. `npm audit fix --force`, Expo downgrades, and blanket audit ignores
are not approved mitigations.
