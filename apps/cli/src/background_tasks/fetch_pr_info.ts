import { getPrInfoForBranches, TPRInfoToUpsert } from '../lib/api/pr_info';
import { TContext } from '../lib/context';
import {
  getMetadataRefList,
  readMetadataRef,
} from '../lib/engine/metadata_ref';
import { prInfoConfigFactory } from '../lib/spiffy/pr_info_spf';
import { repoConfigFactory, TRepoConfig } from '../lib/spiffy/repo_config_spf';
import { TUserConfig, userConfigFactory } from '../lib/spiffy/user_config_spf';
import { spawnDetached } from '../lib/utils/spawn';

export function refreshPRInfoInBackground(context: TContext): void {
  if (!context.repoConfig.graphiteInitialized()) {
    return;
  }

  const now = Date.now();
  const lastFetchedMs = context.repoConfig.data.lastFetchedPRInfoMs;
  const msInSecond = 1000;

  // rate limit refreshing PR info to once per minute
  if (lastFetchedMs === undefined || now - lastFetchedMs > 60 * msInSecond) {
    // do our potential write before we kick off the child process so that we
    // don't incur a possible race condition with the write
    context.repoConfig.update((data) => (data.lastFetchedPRInfoMs = now));

    spawnDetached(__filename);
  }
}

export async function getPrInfoToUpsert({
  userConfig,
  repoConfig,
}: {
  userConfig: TUserConfig;
  repoConfig: TRepoConfig;
}): Promise<TPRInfoToUpsert> {
  const { authToken, repoName, repoOwner } = {
    authToken: userConfig.getAuthToken(),
    repoName: repoConfig.getRepoName(),
    repoOwner: repoConfig.getRepoOwner(),
  };
  if (!authToken || !repoName || !repoOwner) {
    return [];
  }
  const branchNamesWithExistingPrNumbers = Object.keys(
    getMetadataRefList()
  ).map((branchName) => ({
    branchName,
    prNumber: readMetadataRef(branchName)?.prInfo?.number,
  }));
  return await getPrInfoForBranches(
    branchNamesWithExistingPrNumbers,
    {
      authToken,
      repoName,
      repoOwner,
    },
    userConfig
  );
}

async function refreshPRInfo(): Promise<void> {
  const loaded = prInfoConfigFactory.load();
  // eslint-disable-next-line no-console
  console.log('refreshPRInfo:', loaded);
  try {
    const prInfoToUpsert = await getPrInfoToUpsert({
      userConfig: userConfigFactory.load(),
      repoConfig: repoConfigFactory.load(),
    });
    loaded.update((data) => (data.prInfoToUpsert = prInfoToUpsert));
  } catch (err) {
    loaded.delete();
  }
}

if (process.argv[1] === __filename) {
  void refreshPRInfo();
}
