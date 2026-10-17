/**
 * GraphQL Review Mutations & Touch Gesture Dispatcher
 * Submits GitHub GraphQL addPullRequestReview mutations for APPROVE and REQUEST_CHANGES,
 * and delegates SWIPE_UP_SWARM_HEAL events back to the autonomous agent swarm.
 */

import type { MobileReviewEvent, MobileSwipeAction } from '@omnistack/types';
import type { Octokit } from '@octokit/rest';

export type PullRequestReviewEventGraphQL = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export interface AddPullRequestReviewInput {
  pullRequestId: string;
  commitOID?: string;
  body?: string;
  event: PullRequestReviewEventGraphQL;
}

export interface GraphQLReviewResponse {
  addPullRequestReview: {
    pullRequestReview: {
      id: string;
      state: string;
      url: string;
      submittedAt: string;
      author?: {
        login: string;
      };
    };
  };
}

export interface ReviewExecutionResult {
  success: boolean;
  action: MobileSwipeAction;
  verdict: 'APPROVED' | 'CHANGES_REQUESTED' | 'DELEGATED_TO_SWARM';
  reviewId?: string;
  reviewUrl?: string;
  commentId?: string;
  commentUrl?: string;
  delegationJobId?: string;
  summary: string;
  timestamp: string;
}

export interface SwarmDelegationPayload {
  jobId: string;
  projectId: string;
  prNumber: number;
  commitOid: string;
  requestedBy: string;
  feedbackMemo?: string;
  voiceMemoUrl?: string;
  timestamp: string;
}

export type SwarmDelegationHandler = (payload: SwarmDelegationPayload) => Promise<string | void>;

export interface ReviewMutationOptions {
  octokit?: Octokit;
  owner?: string;
  repo?: string;
  pullRequestId?: string;
  isDryRun?: boolean;
  onSwarmDelegation?: SwarmDelegationHandler;
}

const ADD_PULL_REQUEST_REVIEW_MUTATION = `
  mutation AddPullRequestReview($input: AddPullRequestReviewInput!) {
    addPullRequestReview(input: $input) {
      pullRequestReview {
        id
        state
        url
        submittedAt
        author {
          login
        }
      }
    }
  }
`;

const GET_PR_NODE_ID_QUERY = `
  query GetPullRequestNodeId($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        id
        headRefOid
        title
        state
      }
    }
  }
`;

/**
 * Resolves the GitHub GraphQL Node ID and Head Ref OID for a Pull Request.
 */
export async function fetchPullRequestNodeId(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ id: string; headRefOid: string }> {
  try {
    const response = (await octokit.graphql(GET_PR_NODE_ID_QUERY, {
      owner,
      repo,
      number: prNumber,
    })) as {
      repository?: {
        pullRequest?: {
          id: string;
          headRefOid: string;
        };
      };
    };

    const pr = response.repository?.pullRequest;
    if (!pr) {
      throw new Error(`Pull Request #${prNumber} not found in ${owner}/${repo}`);
    }

    return {
      id: pr.id,
      headRefOid: pr.headRefOid,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to query PR Node ID for ${owner}/${repo}#${prNumber}: ${message}`);
  }
}

/**
 * Dispatches the GitHub GraphQL addPullRequestReview mutation.
 */
export async function executeAddPullRequestReview(
  octokit: Octokit,
  input: AddPullRequestReviewInput
): Promise<GraphQLReviewResponse['addPullRequestReview']['pullRequestReview']> {
  const response = (await octokit.graphql(ADD_PULL_REQUEST_REVIEW_MUTATION, {
    input,
  })) as GraphQLReviewResponse;

  return response.addPullRequestReview.pullRequestReview;
}

/**
 * Formats Markdown review commentary based on mobile review action and metadata.
 */
export function formatMobileReviewBody(event: MobileReviewEvent): string {
  const parts: string[] = [];
  const meta = event.metadata;
  const shortSha = event.commitOid ? event.commitOid.slice(0, 7) : 'head';

  if (event.action === 'SWIPE_RIGHT_APPROVE') {
    parts.push('### ✅ PR Approved via OmniStack PR Tinder (Mobile)');
    parts.push(`**Reviewer:** @${event.reviewer}`);
    parts.push(`**Action:** Approved via Swipe Right`);
    parts.push(`**Commit:** \`${shortSha}\``);
    if (event.feedbackMemo) {
      parts.push(`\n**Memo:** ${event.feedbackMemo}`);
    }
  } else if (event.action === 'SWIPE_LEFT_REJECT') {
    parts.push('### ❌ Changes Requested via OmniStack PR Tinder (Mobile)');
    parts.push(`**Reviewer:** @${event.reviewer}`);
    parts.push(`**Action:** Changes Requested via Swipe Left`);
    parts.push(`**Commit:** \`${shortSha}\``);
    parts.push('\n#### 💬 Feedback Details:');
    parts.push(event.feedbackMemo || 'Reviewer requested changes to this pull request.');
    if (event.voiceMemoUrl) {
      parts.push(`\n🎙️ **Voice Memo:** [Listen to voice feedback recording](${event.voiceMemoUrl})`);
    }
  } else if (event.action === 'SWIPE_UP_SWARM_HEAL') {
    parts.push('### 🤖 Swarm Remediation Dispatched via PR Tinder (Mobile)');
    parts.push(`**Triggered by:** @${event.reviewer} via Swipe Up`);
    parts.push(`**Commit:** \`${shortSha}\``);
    parts.push('\nAutonomous healing swarm (`Agent-Scaffold` & `Agent-Vision`) dispatched for code remediation.');
    if (event.feedbackMemo) {
      parts.push(`\n**Instruction:** ${event.feedbackMemo}`);
    }
  }

  // Telemetry footer
  const telemetryDetails: string[] = [];
  if (meta?.deviceModel) {
    telemetryDetails.push(`Device: ${meta.deviceModel}`);
  }
  if (meta?.gestureVelocity !== undefined) {
    telemetryDetails.push(`Swipe Velocity: ${meta.gestureVelocity.toFixed(2)} px/ms`);
  }
  telemetryDetails.push(`Timestamp: ${event.timestamp}`);

  parts.push(`\n---\n*OmniStack Forge Mobile Reviewer Engine • ${telemetryDetails.join(' • ')}*`);

  return parts.join('\n');
}

/**
 * Ingests touch gesture physics events from the PR Tinder mobile app
 * and executes appropriate GitHub GraphQL mutations or swarm remediation delegations.
 */
export async function processMobileReviewEvent(
  event: MobileReviewEvent,
  options: ReviewMutationOptions = {}
): Promise<ReviewExecutionResult> {
  const timestamp = new Date().toISOString();
  const body = formatMobileReviewBody(event);

  // 1. SWIPE UP: Delegate PR code remediation back to the autonomous swarm
  if (event.action === 'SWIPE_UP_SWARM_HEAL') {
    const delegationJobId = `heal_${event.projectId}_pr${event.prNumber}_${Date.now()}`;
    const delegationPayload: SwarmDelegationPayload = {
      jobId: delegationJobId,
      projectId: event.projectId,
      prNumber: event.prNumber,
      commitOid: event.commitOid,
      requestedBy: event.reviewer,
      timestamp,
      ...(event.feedbackMemo ? { feedbackMemo: event.feedbackMemo } : {}),
      ...(event.voiceMemoUrl ? { voiceMemoUrl: event.voiceMemoUrl } : {}),
    };

    if (options.onSwarmDelegation) {
      await options.onSwarmDelegation(delegationPayload);
    }

    // If Octokit is available and repository is specified, post tracking comment to GitHub
    let commentUrl: string | undefined;
    if (options.octokit && options.owner && options.repo && !options.isDryRun) {
      try {
        const commentRes = await options.octokit.rest.issues.createComment({
          owner: options.owner,
          repo: options.repo,
          issue_number: event.prNumber,
          body,
        });
        commentUrl = commentRes.data.html_url;
      } catch {
        // Comment posting error logged but does not block swarm execution
      }
    }

    return {
      success: true,
      action: 'SWIPE_UP_SWARM_HEAL',
      verdict: 'DELEGATED_TO_SWARM',
      delegationJobId,
      ...(commentUrl ? { commentUrl } : {}),
      summary: `Swipe Up event received. Delegated PR #${event.prNumber} remediation to autonomous swarm (Job ${delegationJobId}).`,
      timestamp,
    };
  }

  // 2. SWIPE RIGHT or SWIPE LEFT: Execute GitHub GraphQL addPullRequestReview
  const isApprove = event.action === 'SWIPE_RIGHT_APPROVE';
  const graphQLEvent: PullRequestReviewEventGraphQL = isApprove ? 'APPROVE' : 'REQUEST_CHANGES';
  const verdict: 'APPROVED' | 'CHANGES_REQUESTED' = isApprove ? 'APPROVED' : 'CHANGES_REQUESTED';

  // Dry run or mock mode (sandboxed compilation / tests)
  if (options.isDryRun || !options.octokit) {
    const mockReviewId = `PRR_mock_${Date.now()}`;
    const mockUrl = `https://github.com/${options.owner ?? 'omnistack'}/${options.repo ?? 'project'}/pull/${event.prNumber}#pullrequestreview-${mockReviewId}`;
    return {
      success: true,
      action: event.action,
      verdict,
      reviewId: mockReviewId,
      reviewUrl: mockUrl,
      summary: `[Dry Run] Dispatched addPullRequestReview(${graphQLEvent}) for PR #${event.prNumber}`,
      timestamp,
    };
  }

  // Resolve Pull Request GraphQL Node ID
  let pullRequestId = options.pullRequestId;
  if (!pullRequestId && options.owner && options.repo) {
    const prDetails = await fetchPullRequestNodeId(
      options.octokit,
      options.owner,
      options.repo,
      event.prNumber
    );
    pullRequestId = prDetails.id;
  }

  if (!pullRequestId) {
    throw new Error(
      `Cannot execute addPullRequestReview: pullRequestId or (owner, repo, prNumber) must be provided.`
    );
  }

  const reviewInput: AddPullRequestReviewInput = {
    pullRequestId,
    event: graphQLEvent,
    body,
    ...(event.commitOid ? { commitOID: event.commitOid } : {}),
  };

  const reviewResult = await executeAddPullRequestReview(options.octokit, reviewInput);

  return {
    success: true,
    action: event.action,
    verdict,
    reviewId: reviewResult.id,
    reviewUrl: reviewResult.url,
    summary: `Executed addPullRequestReview(${graphQLEvent}) on PR #${event.prNumber} by @${event.reviewer}`,
    timestamp: reviewResult.submittedAt || timestamp,
  };
}
