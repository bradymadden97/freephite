import { TContext } from '../context';
import { TRepoParams } from './common_params';

export async function getDownstackDependencies(
  args: { branchName: string; trunkName: string },
  _params: TRepoParams,
  _context: TContext
): Promise<string[]> {
  // Until we have a real way to compute the downstack branches
  // We will be returning a single item (the branch name) to get updated
  return [args.branchName];
}
