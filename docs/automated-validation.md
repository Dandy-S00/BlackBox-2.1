# Automated Validation

BlackBox uses deterministic test fixtures only inside the automated test suite. The fixture does **not** create a gateway profile, store a credential, appear in the Gateway UI, or change the app’s live System Test results.

## Repeatable commands

```sh
pnpm test:system
pnpm test:release
```

`test:system` verifies the fixed gateway health-state contract, including the only condition in which all six modules become passed: an authenticated response that explicitly reports every configured module as healthy. `test:release` runs lint, TypeScript, all automated tests, and the production API bundle compilation.

## Recurring execution choices

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---|---|
| Run before every checkpoint or managed publish | Immediate local feedback; no background schedule | No added cost | Low |
| Daily scheduled validation with an in-app or project log | Regular independent check; requires choosing a time and retaining a result destination | Depends on the chosen hosting plan | Medium |
| CI validation on every source update | Fast feedback for every change; requires a connected source repository | Typically free within provider limits | Medium |

Choose the cadence and destination before enabling a recurring job. Production System Test continues to require a real active gateway profile and will never use the deterministic fixture.
