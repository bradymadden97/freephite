export async function getReviewers(
  reviewers: string | undefined
): Promise<string[]> {
  if (typeof reviewers === 'undefined') {
    return [];
  }

  return reviewers.split(',').map((reviewer) => reviewer.trim());
}
