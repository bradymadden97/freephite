import type { CommitTreeWithPreviews } from "./getCommitTree";

import { Commit } from "./Commit";
import { ErrorNotice } from "./ErrorNotice";
import { treeWithPreviews, useMarkOperationsCompleted } from "./previews";
import { commitFetchError } from "./serverAPIState";
import { Icon } from "@withgraphite/gti-shared/Icon";

import "./CommitTreeList.scss";
import { observer } from "mobx-react-lite";
import type { BranchName } from "@withgraphite/gti-cli-shared-types";

export const CommitTreeList = observer(() => {
  // TOMAS: I believe the below is unnecessary now with MobX, but leaving for a sec
  // Make sure we trigger subscription to changes to uncommitted changes *before* we have a tree to render,
  // so we don't miss the first returned uncommitted changes mesage.
  // TODO: This is a little ugly, is there a better way to tell recoil to start the subscription immediately?
  // Or should we queue/cache messages?
  // useRecoilState(latestUncommittedChanges);
  // useRecoilState(pageVisibility);

  useMarkOperationsCompleted();

  const { trees } = treeWithPreviews.get();
  const fetchError = commitFetchError.get();
  return fetchError == null && trees.length === 0 ? (
    <Center>
      <Spinner />
    </Center>
  ) : (
    <>
      {fetchError ? (
        <ErrorNotice title={"Failed to fetch commits"} error={fetchError} />
      ) : null}
      <div className="commit-tree-root commit-group">
        <MainLineEllipsis />
        {trees.map((tree) => createSubtree(tree))}
        <MainLineEllipsis />
      </div>
    </>
  );
});

function createSubtree(
  tree: CommitTreeWithPreviews
): Array<React.ReactElement> {
  const { info, children, previewType } = tree;
  const isPublic = info.partOfTrunk;

  const renderedChildren = (children ?? [])
    .map((tree) => createSubtree(tree))
    .map((components, i) => {
      if (!isPublic && i === 0) {
        // first child can be rendered without branching, so single-child lineages render in the same branch
        return components;
      }
      // any additional children render with branches
      return [
        <Branch key={`branch-${info.branch}-${i}`} descendsFrom={info.branch}>
          {components}
        </Branch>,
      ];
    })
    .flat();

  return [
    ...renderedChildren,
    <Commit
      commit={info}
      key={info.branch}
      previewType={previewType}
      hasChildren={renderedChildren.length > 0}
    />,
  ];
}

function Spinner() {
  return (
    <div data-testid="loading-spinner">
      <Icon icon="loading" size="L" />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="center-container">{children}</div>;
}

function Branch({
  children,
  descendsFrom,
}: {
  children: Array<React.ReactElement>;
  descendsFrom: BranchName;
}) {
  return (
    <div className="commit-group" data-testid={`branch-from-${descendsFrom}`}>
      {children}
      <BranchIndicator />
    </div>
  );
}

function MainLineEllipsis() {
  return <div className="commit-ellipsis" />;
}

const COMPONENT_PADDING = 10;
export const BranchIndicator = () => {
  const width = COMPONENT_PADDING * 2;
  const height = COMPONENT_PADDING * 3;
  // Compensate for line width
  const startX = width + 1;
  const startY = 0;
  const endX = 0;
  const endY = height;
  const verticalLead = height * 0.75;
  const path =
    // start point
    `M${startX} ${startY}` +
    // cubic bezier curve to end point
    `C ${startX} ${startY + verticalLead}, ${endX} ${
      endY - verticalLead
    }, ${endX} ${endY}`;
  return (
    <svg
      className="branch-indicator"
      width={width + 2 /* avoid border clipping */}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} strokeWidth="2px" fill="transparent" />
    </svg>
  );
};
