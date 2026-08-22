import { describe, expect, it } from "vitest";
import { MODULE_SETUP } from "../lib/module-setup";
import { STACK_MODULES } from "../lib/workspace-model";

describe("module setup guidance", () => {
  it("provides a complete setup, configuration, verification, and run guide for every selectable module", () => {
    expect(Object.keys(MODULE_SETUP).sort()).toEqual(STACK_MODULES.map((module) => module.id).sort());

    STACK_MODULES.forEach((module) => {
      const guide = MODULE_SETUP[module.id];
      expect(guide.title.trim().length).toBeGreaterThan(0);
      expect(guide.setup.trim().length).toBeGreaterThan(0);
      expect(guide.configure.trim().length).toBeGreaterThan(0);
      expect(guide.verify.trim().length).toBeGreaterThan(0);
      expect(guide.run.trim().length).toBeGreaterThan(0);
    });
  });
});
