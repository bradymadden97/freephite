import { API_ROUTES } from '@withgraphite/graphite-cli-routes';
import * as t from '@withgraphite/retype';
import chalk from 'chalk';
import { TContext } from '../../lib/context';
import { ExitFailedError } from '../../lib/errors';
import { Unpacked } from '../../lib/utils/ts_helpers';

import { Octokit } from '@octokit/core';

export type TPRSubmissionInfo = t.UnwrapSchemaMap<
  typeof API_ROUTES.submitPullRequests.params
>['prs'];

type TSubmittedPRRequest = Unpacked<TPRSubmissionInfo>;

type TSubmittedPRResponse = Unpacked<
  t.UnwrapSchemaMap<typeof API_ROUTES.submitPullRequests.response>['prs']
>;

type TSubmittedPR = {
  request: TSubmittedPRRequest;
  response: TSubmittedPRResponse;
};

export async function submitPullRequest(
  args: {
    submissionInfo: TPRSubmissionInfo;
    mergeWhenReady: boolean;
    trunkBranchName: string;
    cliAuthToken: string;
  },
  context: TContext
): Promise<void> {
  const pr = (
    await requestServerToSubmitPRs({
      submissionInfo: args.submissionInfo,
      mergeWhenReady: args.mergeWhenReady,
      trunkBranchName: args.trunkBranchName,
      context,
    })
  )[0];

  if (pr.response.status === 'error') {
    throw new ExitFailedError(
      `Failed to submit PR for ${pr.response.head}: ${parseSubmitError(
        pr.response.error
      )}`
    );
  }

  context.engine.upsertPrInfo(pr.response.head, {
    number: pr.response.prNumber,
    url: pr.response.prURL,
    base: pr.request.base,
    state: 'OPEN', // We know this is not closed or merged because submit succeeded
    ...(pr.request.action === 'create'
      ? {
          title: pr.request.title,
          body: pr.request.body,
          reviewDecision: 'REVIEW_REQUIRED', // Because we just opened this PR
        }
      : {}),
    ...(pr.request.draft !== undefined ? { draft: pr.request.draft } : {}),
  });
  context.splog.info(
    `${chalk.green(pr.response.head)}: ${pr.response.prURL} (${{
      updated: chalk.yellow,
      created: chalk.green,
    }[pr.response.status](pr.response.status)})`
  );
}

function parseSubmitError(error: string): string {
  try {
    return JSON.parse(error)?.response?.data?.message ?? error;
  } catch {
    return error;
  }
}

// This endpoint is plural for legacy reasons.
// Leaving the function plural in case we want to revert.
async function requestServerToSubmitPRs({
  submissionInfo,
  mergeWhenReady: __mergeWhenReady,
  trunkBranchName: __trunkBranchName,
  context,
}: {
  submissionInfo: TPRSubmissionInfo;
  mergeWhenReady: boolean;
  trunkBranchName: string;
  context: TContext;
}): Promise<TSubmittedPR[]> {
  const octokit = new Octokit({
    auth: process.env.GH_AUTH_TOKEN,
  });

  const owner = context.repoConfig.getRepoOwner();
  const repo = context.repoConfig.getRepoName();

  const prs = [];
  for (const info of submissionInfo) {
    if (info.action === 'create') {
      prs.push(
        await octokit.request(`POST /repos/{owner}/{repo}/pulls`, {
          owner,
          repo,
          title: info.title,
          body: info.body,
          head: info.head,
          base: info.base,
          draft: info.draft,
          headers: { 'X-GitHub-Api-Version': '2022-11-28' },
        })
      );

      // TODO: Add a comment to PR with the tree
    }

    if (info.action === 'update') {
      prs.push(
        await octokit.request(
          `PATCH /repos/{owner}/{repo}/pulls/{pull_number}`,
          {
            owner,
            repo,
            pull_number: info.prNumber,
            title: info.title,
            body: info.body,
            base: info.base,
            headers: { 'X-GitHub-Api-Version': '2022-11-28' },
          }
        )
      );

      // TODO: Update comment in PR with the updated tree
    }
  }

  const requests: { [head: string]: TSubmittedPRRequest } = {};
  submissionInfo.forEach((prRequest) => {
    requests[prRequest.head] = prRequest;
  });

  return prs.map((prResponse) => {
    const request = requests[prResponse.data.head.ref];
    return {
      request,
      response: {
        head: prResponse.data.head.ref,
        status: request.action === 'create' ? 'created' : 'updated',
        prNumber: prResponse.data.number,
        prURL: prResponse.data.html_url,
      },
    };
  });
}
