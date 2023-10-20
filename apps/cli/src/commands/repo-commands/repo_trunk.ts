import yargs from 'yargs';
import { graphite } from '../../lib/runner';
import { checkoutBranch } from '../../actions/checkout_branch';

const args = {} as const;

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const command = 'trunk';
export const canonical = 'repo trunk';
export const description = 'Switch the to repo trunk branch.';
export const aliases = ['t'];
export const builder = args;
export const handler = async (argv: argsT): Promise<void> => {
  return graphite(argv, canonical, async (context) => {
    const trunk = context.repoConfig.getTrunk();

    if (!trunk) {
      context.splog.error('No trunk has been set yet, please set one first.');
      return;
    }

    return checkoutBranch(
      {
        branchName: trunk,
      },
      context
    );
  });
};
