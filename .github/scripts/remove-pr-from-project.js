/**
 * Remove pull request from GitHub Projects V2
 * Finds and removes a PR from a specified project
 */

const core = require('@actions/core');
const { 
  validateEnvironmentVariables, 
  createOctokit, 
  findPRProjectItem,
  withRetry,
  setOutputs,
  executeScript,
  GRAPHQL_QUERIES
} = require('./shared-utils');

/**
 * Main function to remove PR from project
 */
async function removePRFromProject() {
  // Validate required environment variables
  validateEnvironmentVariables(['GITHUB_TOKEN', 'PROJECT_ID', 'PR_NODE_ID']);

  const token = process.env.GITHUB_TOKEN;
  const projectId = process.env.PROJECT_ID;
  const prNodeId = process.env.PR_NODE_ID;

  const octokit = createOctokit(token);

  core.info(`🔍 Looking for PR with node_id: ${prNodeId} in project ${projectId}`);

  // Find the project item for this PR
  const projectItem = await findPRProjectItem(octokit, prNodeId, projectId);

  if (!projectItem) {
    core.info(`ℹ️ PR is not in project ${projectId} - nothing to remove`);
    setOutputs({
      removed: 'false',
      'pr-number': '',
      'item-id': ''
    });
    return;
  }

  // Remove the PR from the project with retry logic
  const result = await withRetry(
    () => octokit.graphql(GRAPHQL_QUERIES.REMOVE_FROM_PROJECT, {
      projectId,
      itemId: projectItem.id
    }),
    { operation: 'removing PR from project' }
  );

  core.info(`✅ Successfully removed PR from project`);
  
  setOutputs({
    removed: 'true',
    'pr-number': '', // PR number would need to be extracted from projectItem if needed
    'item-id': projectItem.id
  });
}

// Execute script with error handling
executeScript(removePRFromProject, 'Remove PR from Project Script');
