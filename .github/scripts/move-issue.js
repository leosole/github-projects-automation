/**
 * Move issue to different status in project
 * Updates the field value for an issue in GitHub Projects V2
 */

const core = require('@actions/core');
const { 
  validateEnvironmentVariables, 
  createOctokit, 
  findIssueProjectItem,
  withRetry,
  executeScript,
  GRAPHQL_QUERIES
} = require('./shared-utils');

/**
 * Main function to move issue
 */
async function moveIssue() {
  // Validate required environment variables
  validateEnvironmentVariables([
    'GITHUB_TOKEN', 
    'PROJECT_ID', 
    'ISSUE_NODE_ID', 
    'FIELD_ID', 
    'OPTION_ID'
  ]);

  const token = process.env.GITHUB_TOKEN;
  const projectId = process.env.PROJECT_ID;
  const issueNodeId = process.env.ISSUE_NODE_ID;
  const fieldId = process.env.FIELD_ID;
  const optionId = process.env.OPTION_ID;
  const issueNumber = process.env.ISSUE_NUMBER; // Optional for logging

  const octokit = createOctokit(token);

  // Find the project item for this issue
  const item = await findIssueProjectItem(octokit, issueNodeId, projectId);
  
  if (!item) {
    core.warning(`⚠️ No project item found for issue${issueNumber ? ` #${issueNumber}` : ''} with node_id ${issueNodeId} in project ${projectId}`);
    core.warning(`This could mean: 1) Issue not in project, 2) Node ID mismatch`);
    return;
  }

  // Update the field value with retry logic
  await withRetry(
    () => octokit.graphql(GRAPHQL_QUERIES.UPDATE_PROJECT_FIELD, {
      projectId,
      itemId: item.id,
      fieldId,
      optionId
    }),
    { operation: 'updating issue status' }
  );

  core.info(`✅ Moved issue${issueNumber ? ` #${issueNumber}` : ''} to new status`);
}

// Execute script with error handling
executeScript(moveIssue, 'Move Issue Script');