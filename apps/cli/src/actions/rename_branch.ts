import chalk from 'chalk';
import { TContext } from '../lib/context';
import { ExitFailedError } from '../lib/errors';
import { replaceUnsupportedCharacters } from '../lib/utils/branch_name';

async function getNewBranchName(
  context: TContext,
  oldBranchName: string
): Promise<string> {
  context.splog.info(`Enter new name for ${chalk.blueBright(oldBranchName)}:`);

  const response = await context.prompts({
    type: 'text',
    name: 'branchName',
    message: 'Branch Name',
    initial: oldBranchName,
    validate: (name) => {
      const calculatedName = replaceUnsupportedCharacters(name, context);
      return oldBranchName !== calculatedName &&
        context.engine.allBranchNames.includes(calculatedName)
        ? 'Branch name is unavailable.'
        : true;
    },
  });

  return response.branchName;
}

export async function renameCurrentBranch(
  args: { newBranchName?: string; force?: boolean },
  context: TContext
): Promise<void> {
  const oldBranchName = context.engine.currentBranchPrecondition;

  const branchName =
    context.interactive && args.newBranchName
      ? args.newBranchName
      : await getNewBranchName(context, oldBranchName);

  if (oldBranchName === branchName) {
    context.splog.info(
      `Current branch is already named ${chalk.cyan(oldBranchName)}`
    );
    return;
  }

  if (context.engine.getPrInfo(oldBranchName)?.number && !args.force) {
    context.splog.tip(
      `Renaming a branch that is already associated with a PR removes the association.`
    );

    throw new ExitFailedError(
      'Renaming a branch for a submitted PR requires the `--force` option'
    );
  }

  const newBranchName = replaceUnsupportedCharacters(branchName, context);

  context.engine.renameCurrentBranch(newBranchName);
  context.splog.info(
    `Successfully renamed ${chalk.blueBright(oldBranchName)} to ${chalk.green(
      newBranchName
    )}`
  );
}
