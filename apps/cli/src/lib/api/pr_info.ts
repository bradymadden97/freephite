import * as t from '@withgraphite/retype';
import { TUserConfig } from '../spiffy/user_config_spf';
import { TRepoParams } from './common_params';
import { Octokit } from '@octokit/core';

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
  branchNamesWithExistingPrInfo: TBranchNameWithPrNumber[],
  params: TRepoParams,
  userConfig: TUserConfig
): Promise<TPRInfoToUpsert> {
  const branchesWithoutPrInfo = new Set<string>();
  const existingPrInfo = new Map<number, string>();

  branchNamesWithExistingPrInfo.forEach((branch) => {
    if (branch?.prNumber === undefined) {
      branchesWithoutPrInfo.add(branch.branchName);
    } else {
      existingPrInfo.set(branch.prNumber, branch.branchName);
    }
  });

  const auth = userConfig.getFPAuthToken();
  if (!auth) {
    throw new Error(
      'No freephite auth token found. Run `fp auth-fp -t <YOUR_GITHUB_TOKEN>` then try again.'
    );
  }

  const octokit = new Octokit({ auth });
  const requests = [];

  for (const pr of existingPrInfo.keys()) {
    requests.push({
      pr: octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: params.repoOwner,
        repo: params.repoName,
        pull_number: pr,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }),
      merge: octokit.request(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/merge',
        {
          owner: params.repoOwner,
          repo: params.repoName,
          pull_number: pr,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      ),
      reviews: octokit.request(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
        {
          owner: params.repoOwner,
          repo: params.repoName,
          pull_number: pr,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      ),
      review_requests: octokit.request(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers',
        {
          owner: params.repoOwner,
          repo: params.repoName,
          pull_number: pr,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      ),
    });
  }

  const responses = await Promise.all(
    requests.map(({ pr, merge, reviews, review_requests }) =>
      Promise.allSettled([pr, merge, reviews, review_requests]).then(
        ([pr, merge, reviews, review_requests]) => {
          if (
            pr.status !== 'fulfilled' ||
            reviews.status !== 'fulfilled' ||
            review_requests.status !== 'fulfilled'
          ) {
            return null;
          }

          const isOpen = pr.value.data.state === 'open';
          const isMerged = merge.status === 'fulfilled';
          const isApproved = reviews.value.data.some(
            (r) => r.state === 'APPROVED'
          );
          const isRequestedChanges = reviews.value.data.some(
            (r) => r.state === 'CHANGES_REQUESTED'
          );

          const isReviewRequired =
            review_requests.value.data.teams.length > 0 ||
            review_requests.value.data.users.length > 0;

          return {
            prNumber: pr.value.data.number,
            title: pr.value.data.title,
            body: pr.value.data.body ?? '',
            state: isOpen ? 'OPEN' : isMerged ? 'MERGED' : 'CLOSED',
            reviewDecision: isApproved
              ? 'APPROVED'
              : isRequestedChanges
              ? 'CHANGES_REQUESTED'
              : isReviewRequired
              ? 'REVIEW_REQUIRED'
              : null,
            headRefName: pr.value.data.head.ref,
            baseRefName: pr.value.data.base.ref,
            url: pr.value.data.html_url,
            isDraft: pr.value.data.draft ?? false,
          } as const;
        }
      )
    )
  );

  // TODO: Need to implement the same fetching for `branchesWithoutPrInfo`
  // for (const ref of branchesWithoutPrInfo.values()) {
  //   requests.push(...)
  // }

  /** Filter nulls, typescript */
  const prs: TPRInfoToUpsert = [];
  for (const pr of responses) {
    if (pr) {
      prs.push(pr);
    }
  }

  return prs.filter((pr) => {
    const branchNameIfAssociated = existingPrInfo.get(pr.prNumber);

    const shouldAssociatePrWithBranch =
      !branchNameIfAssociated &&
      pr.state === 'OPEN' &&
      branchesWithoutPrInfo.has(pr.headRefName);

    const shouldUpdateExistingBranch =
      branchNameIfAssociated === pr.headRefName;

    return shouldAssociatePrWithBranch || shouldUpdateExistingBranch;
  });
}
