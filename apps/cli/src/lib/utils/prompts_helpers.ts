import prompts from 'prompts';
import { KilledError } from '../errors';

// need to explicitly copy this from prompts typedef because they have the namespace
// and the function aliased to the same name, so we can't use typeof
export type TPrompts = <T extends string = string>(
  questions: prompts.PromptObject<T> | Array<prompts.PromptObject<T>>,
  options?: prompts.Options
) => Promise<prompts.Answers<T>>;

export const suggest = (
  input: string,
  choices: prompts.Choice[]
): Promise<prompts.Choice[]> =>
  Promise.resolve(
    choices.filter((c: prompts.Choice) =>
      c.value.toLocaleLowerCase().includes(input.toLocaleLowerCase())
    )
  );

export const clearPromptResultLine = (): void => {
  process.stdout.moveCursor(0, -1);
  process.stdout.clearLine(1);
};

/**
 * Abstraction to hold onto any logic we want to enforce runs for all prompts
 */
export const gtPrompts = async (
  ...[questions, options]: Parameters<TPrompts>
): ReturnType<TPrompts> => {
  return prompts(questions, {
    onCancel: () => {
      throw new KilledError();
    },
    ...options,
  });
};
