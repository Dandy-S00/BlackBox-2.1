import type { ModuleId } from "@/lib/workspace-model";

export interface ModuleSetupGuide {
  title: string;
  setup: string;
  configure: string;
  verify: string;
  run: string;
}

export const MODULE_SETUP: Record<ModuleId, ModuleSetupGuide> = {
  ghidra: {
    title: "Native binary analysis",
    setup: "Install and license Ghidra on the private operator host. Create a restricted workspace for only approved native binaries.",
    configure: "Mount approved evidence read-only and configure the gateway policy to allow the Ghidra module for the selected target class.",
    verify: "The gateway health response must list Ghidra as healthy before it can be selected for a run.",
    run: "Prepare a Native binary analysis record, select Ghidra, then authorize and start the selected-module test through the active gateway profile.",
  },
  mobsf: {
    title: "Mobile package assessment",
    setup: "Run MobSF on the private operator host and configure an isolated upload workspace for approved mobile packages.",
    configure: "Set gateway policy and package-handling limits for the operator-owned assessment environment.",
    verify: "The gateway health response must list MobSF as healthy before package assessment can run.",
    run: "Prepare a Mobile package record, select MobSF, then authorize and dispatch only that selected module.",
  },
  frida: {
    title: "Runtime observation",
    setup: "Prepare a test device you own or are authorized to assess and install the operator-managed instrumentation service.",
    configure: "Pair only the authorized device and constrain runtime observation to the approved application and session.",
    verify: "The gateway may report Runtime as manual until the operator confirms device pairing and session readiness.",
    run: "Prepare an authorized record, select Runtime, confirm the target device, then start the approved observation through the active profile.",
  },
  filesystem: {
    title: "Controlled files",
    setup: "Create a scoped read-only evidence mount on the private host for approved materials.",
    configure: "Map the mount to the operator gateway and restrict access to the defined workspace path.",
    verify: "The Files module must be reported healthy after the scoped mount is available.",
    run: "Prepare an analysis record, select Files, and dispatch it only after confirming the evidence scope.",
  },
  git: {
    title: "Repository context",
    setup: "Provision a scoped repository service or read-only mirror for the approved source repository.",
    configure: "Use least-privilege repository credentials on the operator host; do not store repository secrets in this app.",
    verify: "The Git module must be reported healthy after the operator service can access the approved repository scope.",
    run: "Prepare a Repository record, select Git, then authorize a source-review job through the active gateway profile.",
  },
  sqlite: {
    title: "SQLite reference",
    setup: "Make an approved database copy available to the private host under the engagement’s data-handling policy.",
    configure: "Restrict the database service to the approved copy and ensure write operations are disabled unless specifically authorized.",
    verify: "The SQLite module must be reported healthy when its scoped database service is available.",
    run: "Prepare a Database record, select SQLite, and dispatch only after confirming the approved data source.",
  },
};
