# BlackBox

## Project overview

BlackBox is a local-first mobile workspace for authorized security and engineering analysis. It organizes workspaces, analysis records, findings, approved dispatches, and reports on-device. Privileged analysis remains behind an operator-controlled gateway.

## Current capability set

| Area | Status |
|---|---|
| Workspace and reporting | Local workspaces, authorized analysis records, findings, insights, Dashboard feedback, and PDF exports are implemented. |
| Private gateway | Encrypted named profiles, authenticated health testing, active-profile switching, safe removal, and a confirmation PIN before dispatch are implemented. |
| Six modules | Ghidra, MobSF, Frida/Runtime, Filesystem, Git, and SQLite each have in-app setup, configuration, verification, and authorized-run guidance. |
| GitHub target loader | Public search, releases, branches, queue-as-target, local history, optional encrypted PAT, and diagnostics are implemented. |
| Optional AI assistance | OpenAI, Anthropic, and HTTPS-compatible provider settings use device-local encrypted keys and explicit draft requests. |
| Android delivery | Local Android JavaScript bundle and resource generation are validated. The installable signed APK is generated through the managed Publish flow. |

## Security boundary

BlackBox does not directly execute privileged tools. The app sends only an approved reference, selected modules, target type, and approval time to a real gateway after explicit authority acknowledgement and active-profile PIN confirmation. The gateway must independently enforce target scope, module allowlists, authorization, signatures, and idempotency.

API keys, gateway tokens, confirmation PINs, and GitHub PATs are encrypted on the device. They are not stored in workspace records, PDFs, gateway payloads, app logs, or navigation parameters.

## Effective workflow

1. Create a workspace and record an authorized target reference, scope, and intended module set.
2. Select the named gateway profile for the engagement.
3. Run System Test and treat Awaiting, Manual, Unavailable, and missing module results as action needed.
4. Dispatch only selected approved modules after authority acknowledgement and PIN confirmation.
5. Review evidence, record verified findings, and export reports when needed.

## Connect a real gateway and run System Test

1. Confirm the operator-controlled HTTPS or private-mesh gateway serves authenticated `/v1/health` and reports truthful module statuses.
2. In the installed app, open **Gateway**, select **Add profile**, and enter the profile name, endpoint, operator token, and a 4–8 digit PIN directly on the device. Do not place these values in records or chat.
3. Select **Test and save**. The profile is saved only after the authenticated health check succeeds.
4. Activate the profile, refresh health, then open **System Test** from Settings or Stack.
5. Mark a module ready only when the real gateway reports it healthy. Follow its setup guide for every Action needed result.

## Automated validation

The `pnpm test:system` command runs deterministic test-only gateway health fixtures. The fixture never creates a profile, saves a credential, appears in the app, or alters a live System Test. It verifies that all six modules become passed only when a health response explicitly reports every module healthy, and that manual, unavailable, and missing module results remain actionable.

The `pnpm test:release` command runs linting, TypeScript, the full automated suite, and production API bundle compilation.

## Validation record

| Check | Result |
|---|---|
| Deterministic gateway and System Test suite | 9 tests passed. |
| Full application suite | 24 tests passed; 1 intentional integration skip. |
| Lint and TypeScript | Passed. |
| Production API bundle | Passed. |
| API boundaries | Health, release manifest, and auth paths validated; unauthenticated gateway status is denied. |
| Android local bundle | JavaScript bundle and Android resources generated successfully. |

## Android release and bundle-size configuration

The Android release configuration enables R8 code shrinking, resource shrinking, PNG crunching, and embedded JavaScript bundle compression. Hermes remains enabled. GIF and WebP decoder support are disabled because the project contains no GIF or WebP assets, avoiding unnecessary decoder dependencies. The Android build continues to target `armeabi-v7a` and `arm64-v8a` for broad device compatibility.

## Deployment handoff

1. Run `pnpm test:release` before a managed build.
2. Confirm a real active gateway profile and run System Test if remote modules are part of the release acceptance criteria.
3. Save a checkpoint and select **Publish** in the project interface to create the signed Android APK.
4. After the managed build completes, record the actual public APK URL and SHA-256 in the release manifest.
5. Enable the in-app QR download panel only after both the HTTPS APK URL and matching SHA-256 are present.
6. Before installation, compare the downloaded APK SHA-256 with the published value.

## Current prerequisites

Remote module verification remains action needed until a real authorized gateway profile is connected. The app intentionally does not create mock profiles or fabricate passed runtime results.
