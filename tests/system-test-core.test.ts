import { describe, expect, it } from "vitest";
import { deriveGatewaySystemChecks } from "../lib/system-test-core";
import { STACK_MODULES, type ModuleId } from "../lib/workspace-model";

const moduleIds = STACK_MODULES.map((module) => module.id) as ModuleId[];

describe("System Test gateway health mapping", () => {
  it("marks all six modules passed only when a deterministic health fixture reports each one healthy", () => {
    const fixture = moduleIds.map((id) => ({ id, status: "healthy" as const }));
    const results = deriveGatewaySystemChecks(moduleIds, "Fixture gateway", fixture);
    expect(results).toHaveLength(6);
    expect(results.every((result) => result.state === "passed")).toBe(true);
    expect(results.map((result) => result.id)).toEqual(moduleIds);
  });

  it("preserves manual, unavailable, and missing module states as action-required results", () => {
    const [first, second, third] = moduleIds;
    const results = deriveGatewaySystemChecks(moduleIds, "Fixture gateway", [
      { id: first, status: "manual" },
      { id: second, status: "unavailable" },
    ]);
    expect(results.find((result) => result.id === first)?.state).toBe("warning");
    expect(results.find((result) => result.id === second)?.state).toBe("failed");
    expect(results.find((result) => result.id === third)?.state).toBe("warning");
  });
});
