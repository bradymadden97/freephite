import yargs from "yargs";
import { init } from "../../actions/init";
import { profiledHandler } from "../../lib/telemetry";

const args = {
  trunk: {
    describe: `The name of your trunk branch.`,
    demandOption: false,
    optional: true,
    type: "string",
  },
  "ignore-branches": {
    describe: `A list of branches that will never be merged into trunk and that Graphite should ignore when making stacks.`,
    demandOption: false,
    optional: true,
    type: "string",
    array: true,
  },
} as const;

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const command = "init";
export const description =
  "Create or regenerate a `.graphite_repo_config` file.";
export const builder = args;
export const handler = async (argv: argsT): Promise<void> => {
  return profiledHandler(command, async () => {
    await init(argv.trunk, argv["ignore-branches"]);
  });
};