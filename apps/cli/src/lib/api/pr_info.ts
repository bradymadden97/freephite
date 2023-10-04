import * as t from '@withgraphite/retype';
import { TUserConfig } from '../spiffy/user_config_spf';
import { TRepoParams } from './common_params';

const pullRequestInfoResponse = {
  prs: t.array(
    t.shape({
      prNumber: t.number,
      title: t.string,
      body: t.string,
      state: t.literals(['OPEN', 'CLOSED', 'MERGED'] as const),
      reviewDecision: t.literals([
        'CHANGES_REQUESTED',
        'APPROVED',
        'REVIEW_REQUIRED',
        null,
        undefined,
      ] as const),
      headRefName: t.string,
      baseRefName: t.string,
      url: t.string,
      isDraft: t.boolean,
    })
  ),
};

type TBranchNameWithPrNumber = {
  branchName: string;
  prNumber: number | undefined;
};

export type TPRInfoToUpsert = t.UnwrapSchemaMap<
  typeof pullRequestInfoResponse
>['prs'];

export async function getPrInfoForBranches(
  _branchNamesWithExistingPrInfo: TBranchNameWithPrNumber[],
  _params: TRepoParams,
  _userConfig: TUserConfig
): Promise<TPRInfoToUpsert> {
  // We unfortunately don't have a good way to get PR infos (not until we move it to GH)
  // This is just to keep things without break
  return Promise.resolve([]);
}
