// Runs before every build, so a missing HeroUI Pro install is named for what
// it is rather than failing somewhere unrelated.
//
// On Workers Builds, HEROUI_AUTH_TOKEN must be a BUILD variable (Settings >
// Build > Variables and secrets), holding the CI/CD token from
// https://heroui.pro/dashboard: @heroui-pro/react fetches its real files with
// it while installing.
import { existsSync } from "node:fs";

if (process.env.CI && !process.env.HEROUI_AUTH_TOKEN) {
  console.error("\nHEROUI_AUTH_TOKEN is not set in this build. It is a build variable on Workers Builds, not a runtime one.\n");
  process.exit(1);
}
if (!existsSync("node_modules/@heroui-pro/react/dist/index.js")) {
  console.error("\nHeroUI Pro's files are missing: its install did not fetch them. Check HEROUI_AUTH_TOKEN.\n");
  process.exit(1);
}
