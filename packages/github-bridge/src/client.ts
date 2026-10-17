/**
 * GitHub Bridge Client
 * Handles GitHub App private key JWT exchange for ephemeral installation tokens,
 * Octokit client instantiation, and HMAC SHA-256 webhook signature verification.
 */

import { createAppAuth, type InstallationAccessTokenAuthentication } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface GitHubAppConfig {
  appId: string | number;
  privateKey: string;
  installationId?: number;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  baseUrl?: string;
}

export interface EphemeralInstallationToken {
  token: string;
  expiresAt: string;
  installationId: number;
  permissions?: Record<string, string>;
  repositorySelection?: 'all' | 'selected';
}

export interface PullRequestUser {
  login: string;
  id: number;
  avatar_url?: string;
}

export interface PullRequestBranch {
  ref: string;
  sha: string;
}

export interface PullRequestPayload {
  id: number;
  node_id: string;
  number: number;
  state: string;
  title: string;
  body: string | null;
  head: PullRequestBranch;
  base: PullRequestBranch;
  diff_url: string;
  patch_url: string;
  user: PullRequestUser;
  html_url: string;
}

export interface PullRequestWebhookPayload {
  action: 'opened' | 'synchronize' | 'closed' | 'reopened' | 'edited' | string;
  number: number;
  pull_request: PullRequestPayload;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  installation?: {
    id: number;
  };
}

export interface PullRequestReviewCommentWebhookPayload {
  action: 'created' | 'edited' | 'deleted' | string;
  pull_request: {
    id: number;
    node_id: string;
    number: number;
    title?: string;
  };
  comment: {
    id: number;
    node_id: string;
    body: string;
    path: string;
    line: number | null;
    commit_id: string;
    user: PullRequestUser;
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  installation?: {
    id: number;
  };
}

export interface IssueCommentWebhookPayload {
  action: 'created' | 'edited' | 'deleted' | string;
  issue: {
    id: number;
    number: number;
    title: string;
    pull_request?: {
      url: string;
      html_url: string;
      diff_url: string;
    };
  };
  comment: {
    id: number;
    node_id: string;
    body: string;
    user: PullRequestUser;
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  installation?: {
    id: number;
  };
}

export interface WebhookHandlers {
  onPullRequestOpened(payload: PullRequestWebhookPayload): Promise<void>;
  onPullRequestSynchronize(payload: PullRequestWebhookPayload): Promise<void>;
  onReviewCommentCreated(payload: PullRequestReviewCommentWebhookPayload): Promise<void>;
  onIssueComment(payload: IssueCommentWebhookPayload): Promise<void>;
}

export interface PullRequestDetails {
  nodeId: string;
  number: number;
  title: string;
  state: string;
  body: string;
  headSha: string;
  baseSha: string;
  author: string;
  htmlUrl: string;
  rawDiff?: string;
}

/**
 * Verifies a GitHub webhook signature using HMAC SHA-256.
 * Timing-safe comparison prevents timing side-channel attacks.
 */
export function verifyWebhookSignature(
  rawPayload: string | Buffer,
  signatureHeader: string | undefined,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) {
    return false;
  }

  const prefix = 'sha256=';
  const incomingHex = signatureHeader.startsWith(prefix)
    ? signatureHeader.slice(prefix.length)
    : signatureHeader;

  const hmac = createHmac('sha256', webhookSecret);
  hmac.update(rawPayload);
  const expectedHex = hmac.digest('hex');

  const incomingBuffer = Buffer.from(incomingHex, 'utf8');
  const expectedBuffer = Buffer.from(expectedHex, 'utf8');

  if (incomingBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(incomingBuffer, expectedBuffer);
}

/**
 * Exchanges GitHub App private key JWT for an ephemeral installation access token.
 */
export async function getInstallationToken(
  config: GitHubAppConfig,
  installationId?: number
): Promise<EphemeralInstallationToken> {
  const targetInstallationId = installationId ?? config.installationId;
  if (!targetInstallationId) {
    throw new Error('installationId is required to generate an installation token');
  }

  const authOptions: Record<string, unknown> = {
    appId: config.appId,
    privateKey: config.privateKey,
    installationId: targetInstallationId,
  };

  if (config.clientId) authOptions['clientId'] = config.clientId;
  if (config.clientSecret) authOptions['clientSecret'] = config.clientSecret;

  const auth = createAppAuth(authOptions as Parameters<typeof createAppAuth>[0]);

  const authResult = (await auth({
    type: 'installation',
    installationId: targetInstallationId,
  })) as InstallationAccessTokenAuthentication;

  const permissionsRecord: Record<string, string> = {};
  if (authResult.permissions) {
    for (const [key, val] of Object.entries(authResult.permissions)) {
      if (typeof val === 'string') {
        permissionsRecord[key] = val;
      }
    }
  }

  return {
    token: authResult.token,
    expiresAt: authResult.expiresAt,
    installationId: targetInstallationId,
    permissions: permissionsRecord,
    repositorySelection: authResult.repositorySelection,
  };
}

/**
 * Creates an Octokit instance authenticated with an ephemeral installation token.
 */
export async function createInstallationClient(
  config: GitHubAppConfig,
  installationId?: number
): Promise<Octokit> {
  const tokenData = await getInstallationToken(config, installationId);
  const options: Record<string, unknown> = {
    auth: tokenData.token,
  };
  if (config.baseUrl) {
    options['baseUrl'] = config.baseUrl;
  }
  return new Octokit(options);
}

/**
 * Creates an App-level Octokit client with automatic token rotation via createAppAuth.
 */
export function createAppOctokitClient(config: GitHubAppConfig): Octokit {
  const authConfig: Record<string, unknown> = {
    appId: config.appId,
    privateKey: config.privateKey,
  };

  if (config.installationId) authConfig['installationId'] = config.installationId;
  if (config.clientId) authConfig['clientId'] = config.clientId;
  if (config.clientSecret) authConfig['clientSecret'] = config.clientSecret;

  const octokitOptions: Record<string, unknown> = {
    authStrategy: createAppAuth,
    auth: authConfig,
  };

  if (config.baseUrl) {
    octokitOptions['baseUrl'] = config.baseUrl;
  }

  return new Octokit(octokitOptions);
}

/**
 * Dispatches an ingested GitHub webhook payload to registered event handlers.
 */
export async function dispatchWebhookEvent(
  event: string,
  payload: unknown,
  handlers: Partial<WebhookHandlers>
): Promise<void> {
  switch (event) {
    case 'pull_request': {
      const prPayload = payload as PullRequestWebhookPayload;
      if (prPayload.action === 'opened' && handlers.onPullRequestOpened) {
        await handlers.onPullRequestOpened(prPayload);
      } else if (prPayload.action === 'synchronize' && handlers.onPullRequestSynchronize) {
        await handlers.onPullRequestSynchronize(prPayload);
      }
      break;
    }

    case 'pull_request_review_comment': {
      const commentPayload = payload as PullRequestReviewCommentWebhookPayload;
      if (commentPayload.action === 'created' && handlers.onReviewCommentCreated) {
        await handlers.onReviewCommentCreated(commentPayload);
      }
      break;
    }

    case 'issue_comment': {
      const issuePayload = payload as IssueCommentWebhookPayload;
      if (handlers.onIssueComment) {
        await handlers.onIssueComment(issuePayload);
      }
      break;
    }

    default:
      // Other unhandled webhooks safely ignored
      break;
  }
}

/**
 * GitHub Bridge Client orchestrator
 * Manages token lifecycle, caching, and repository queries.
 */
export class GitHubBridgeClient {
  private readonly config: GitHubAppConfig;
  private cachedToken: EphemeralInstallationToken | null = null;
  private cachedClient: Octokit | null = null;

  constructor(config: GitHubAppConfig) {
    this.config = config;
  }

  /**
   * Retrieves an installation token, utilizing memory cache until 60 seconds before expiry.
   */
  async getValidInstallationToken(installationId?: number): Promise<string> {
    const targetId = installationId ?? this.config.installationId;
    if (this.cachedToken && this.cachedToken.installationId === targetId) {
      const expiryMs = new Date(this.cachedToken.expiresAt).getTime();
      const marginMs = 60 * 1000; // 60 seconds buffer
      if (Date.now() < expiryMs - marginMs) {
        return this.cachedToken.token;
      }
    }

    const tokenData = await getInstallationToken(this.config, targetId);
    this.cachedToken = tokenData;
    this.cachedClient = new Octokit({
      auth: tokenData.token,
      ...(this.config.baseUrl ? { baseUrl: this.config.baseUrl } : {}),
    });
    return tokenData.token;
  }

  /**
   * Returns an authenticated Octokit instance for the target installation.
   */
  async getOctokit(installationId?: number): Promise<Octokit> {
    await this.getValidInstallationToken(installationId);
    if (!this.cachedClient) {
      throw new Error('Failed to initialize authenticated Octokit client');
    }
    return this.cachedClient;
  }

  /**
   * Fetches unified diff string for a Pull Request.
   */
  async fetchPullRequestDiff(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId?: number
  ): Promise<string> {
    const octokit = await this.getOctokit(installationId);
    const response = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
      headers: {
        accept: 'application/vnd.github.v3.diff',
      },
    });

    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  }

  /**
   * Fetches structured Pull Request details.
   */
  async fetchPullRequestDetails(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId?: number
  ): Promise<PullRequestDetails> {
    const octokit = await this.getOctokit(installationId);
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    return {
      nodeId: pr.node_id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      body: pr.body ?? '',
      headSha: pr.head.sha,
      baseSha: pr.base.sha,
      author: pr.user?.login ?? 'unknown',
      htmlUrl: pr.html_url,
    };
  }
}
