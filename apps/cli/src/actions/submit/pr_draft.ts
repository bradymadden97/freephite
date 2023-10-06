import { TContext } from '../../lib/context';

export async function getPRDraftStatus(context: TContext): Promise<boolean> {
  if (!context.interactive) {
    return true;
  }
  const response = await context.prompts({
    type: 'select',
    name: 'draft',
    message: 'Submit',
    choices: [
      { title: 'Publish Pull Request', value: 'publish' },
      { title: 'Create Draft Pull Request', value: 'draft' },
    ],
  });
  return response.draft === 'draft';

  // Hi
}
