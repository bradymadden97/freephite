import yargs from 'yargs';
import { getPrInfoToUpsert } from '../../background_tasks/fetch_pr_info';
import { graphite } from '../../lib/runner';
import { cuteString } from '../../lib/utils/cute_string';

const args = {} as const;

export const command = 'sync';
export const canonical = 'dev sync';
export const description = false;
export const builder = args;

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;
export const handler = async (argv: argsT): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log("IT'S ENTERING HERE! fp dev sync");
  return graphite(argv, canonical, async (context) => {
    context.splog.info(cuteString(getPrInfoToUpsert(context)));
  });
};
