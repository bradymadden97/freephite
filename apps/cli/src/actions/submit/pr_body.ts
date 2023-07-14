import fs from 'fs-extra';
import tmp from 'tmp';
import { TContext } from '../../lib/context';
import { getPRTemplate } from '../../lib/utils/pr_templates';

export async function getPRBody(
  args: {
    branchName: string;
    editPRFieldsInline: boolean | undefined;
  },
  context: TContext
): Promise<string> {
  const priorSubmitBody = context.engine.getPrInfo(args.branchName)?.body;
  const { inferredBody, skipDescription } = inferPRBody(
    { branchName: args.branchName, template: await getPRTemplate(context) },
    context
  );

  if (args.editPRFieldsInline === false) {
    return priorSubmitBody ?? inferredBody;
  }

  const usePriorSubmitBody =
    !!priorSubmitBody &&
    (
      await context.prompts({
        type: 'confirm',
        name: 'confirm',
        initial: true,
        message: 'Detected a PR body from an aborted submit, use it?',
      })
    ).confirm;

  const body = usePriorSubmitBody ? priorSubmitBody : inferredBody;

  if (args.editPRFieldsInline === undefined) {
    const response = await context.prompts({
      type: 'select',
      name: 'body',
      message: 'Body',
      choices: [
        {
          title: `Edit Body (using ${context.userConfig.getEditor()})`,
          value: 'edit',
        },
        {
          title: `Skip (${
            usePriorSubmitBody
              ? `use body from aborted submit`
              : skipDescription
          })`,
          value: 'skip',
        },
      ],
    });
    if (response.body === 'skip') {
      return body;
    }
  }

  return await editPRBody(body, context);
}

export async function editPRBody(
  initial: string,
  context: TContext
): Promise<string> {
  // We used to call this file `EDIT_DESCRIPTION` so editors would treat it like
  // a Git commit message.
  //
  // However, this caused editors like Vim to set the filetype to `gitcommit`,
  // which would create red/error highlights if the first line went over 50
  // characters. This was frustrating for users:
  //
  //   https://graphite-community.slack.com/archives/C02DRNRA9RA/p1683676287959569
  //   Also, see GT-8562 in Linear.
  //
  // Because we're _really_ editing a Markdown PR description, we should give it
  // a `.md` extension so every editor can do the smart thing and syntax
  // highlight it as Markdown.
  //
  // We're calling it `GRAPHITE_PR_DESCRIPTION.md` so that users can also
  // configure their `EDITOR` to do custom things.
  //
  // For example, if someone wanted the previous behavior of treating it as a
  // Git commit message, they could add the following snippet to their Vim
  // config:
  //
  //   autocmd BufNewFile,BufRead GRAPHITE_PR_DESCRIPTION.md set ft=gitcommit
  //
  const dir = tmp.dirSync();
  const file = tmp.fileSync({
    dir: dir.name,
    name: 'GRAPHITE_PR_DESCRIPTION.md',
  });
  fs.writeFileSync(file.name, initial);

  try {
    context.userConfig.execEditor(file.name);
    const contents = fs.readFileSync(file.name).toString();
    return contents;
  } finally {
    // Remove the file and directory even if the user kills the submit
    file.removeCallback();
    dir.removeCallback();
  }
}

export function inferPRBody(
  { branchName, template = '' }: { branchName: string; template?: string },
  context: TContext
): { inferredBody: string; skipDescription: string } {
  if (!context.userConfig.data.submitIncludeCommitMessages) {
    return {
      inferredBody: template,
      skipDescription: template ? 'paste template' : 'leave empty',
    };
  }

  const messages = context.engine
    .getAllCommits(branchName, 'MESSAGE')
    .reverse();
  const isSingleCommit = messages.length === 1;
  const commitMessages = isSingleCommit
    ? messages[0].split('\n').slice(1).join('\n').trim()
    : messages.join('\n\n');

  return {
    inferredBody: `${commitMessages}${
      commitMessages && template ? '\n\n' : ''
    }${template}`,

    skipDescription: `paste commit message${isSingleCommit ? '' : 's'}${
      template ? ' and template' : ''
    }`,
  };
}
