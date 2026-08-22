# Real Gateway Profile and System Test

## Connect a real profile

1. On the operator-controlled host, confirm the gateway is available only through its intended HTTPS edge or private mesh and that authenticated `GET /v1/health` returns a truthful module-status response.
2. Open **Gateway** in the installed BlackBox app and choose **Add profile**.
3. Enter the profile name, HTTPS endpoint, operator access token, and a 4–8 digit confirmation PIN directly on the device. Do not send any of these values in chat, include them in a finding, or paste them into workspace notes.
4. Tap **Test and save**. BlackBox saves the profile only after the gateway accepts the authenticated health request. If it fails, correct the endpoint, token, TLS edge, or gateway health response before continuing.
5. Select the profile as active, then use **Refresh health**. Treat every Awaiting, Manual, or Unavailable state as action needed rather than as a passed result.

## Run System Test

1. Open **Settings** and tap **System Test**, or open it from the **Stack** tab.
2. Run the read-only checks. Verify local storage, the installed PDF capability, and each available module status reported by the active authenticated gateway profile.
3. Record the result honestly. A module is ready only when the gateway reports the expected healthy state. Follow the linked module setup guide for Action needed results.
4. Before a real dispatch, prepare an authorized analysis record, select only needed modules, confirm authority, and enter the active profile PIN. The gateway must still independently enforce target scope, allowed modules, signatures, and idempotency.

System Test does not execute analysis tools, does not expose gateway credentials, and does not convert unavailable gateway data into a pass.
