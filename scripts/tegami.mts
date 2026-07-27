import { tegami } from "tegami"
import { runCli } from "tegami/cli"
import { github } from "tegami/plugins/github"

const paper = tegami({
  plugins: [
    github({
      repo: "noxify/vorsteh-queue",
      versionPr: {
        base: "main",
      },
    }),
  ],
  packages: {
    // optional: package options
    "your-package": {},
  },
})

await runCli(paper)
