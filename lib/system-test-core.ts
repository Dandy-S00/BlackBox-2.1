import type { ModuleId } from "@/lib/workspace-model";

export type GatewayModuleHealth = { id: ModuleId; status: "healthy" | "unavailable" | "manual" };
export type GatewaySystemCheck = { id: ModuleId; state: "passed" | "warning" | "failed"; detail: string };

/**
 * Convert an authenticated gateway health response into truthful System Test
 * states. This is deliberately pure so tests can use fixtures without
 * creating, storing, or rendering a mock gateway profile in the app.
 */
export function deriveGatewaySystemChecks(
  moduleIds: readonly ModuleId[],
  profileName: string,
  reportedModules: readonly GatewayModuleHealth[],
): GatewaySystemCheck[] {
  const remoteStatus = new Map(reportedModules.map((module) => [module.id, module.status]));
  return moduleIds.map((id) => {
    const status = remoteStatus.get(id);
    if (status === "healthy") return { id, state: "passed", detail: `Reported healthy by ${profileName}.` };
    if (status === "manual") return { id, state: "warning", detail: `${profileName} requires operator verification for this module.` };
    if (status === "unavailable") return { id, state: "failed", detail: `${profileName} reported this module as unavailable.` };
    return { id, state: "warning", detail: `${profileName} did not include this module in its health response.` };
  });
}
