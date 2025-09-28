/**
 * Add content to GitHub Projects V2
 * Adds an issue or pull request to a specified project
 */

const core = require('@actions/core');
const { 
  validateEnvironmentVariables, 
  createOctokit, 
  withRetry,
  setOutputs,
  executeScript,
  GRAPHQL_QUERIES
} = require('./shared-utils');

/**
 * Main function to add content to project
 */
async function addToProject() {
  // Validate required environment variables
  validateEnvironmentVariables(['GITHUB_TOKEN', 'PROJECT_ID', 'CONTENT_ID']);

  const token = process.env.GITHUB_TOKEN;
  const projectId = process.env.PROJECT_ID;
  const contentId = process.env.CONTENT_ID;

  const octokit = createOctokit(token);

  // Add content to project with retry logic
  const result = await withRetry(
    () => octokit.graphql(GRAPHQL_QUERIES.ADD_TO_PROJECT, { projectId, contentId }),
    { operation: 'adding content to project' }
  );

  const itemId = result.addProjectV2ItemById.item.id;
  
  core.info(`✅ Added content ${contentId} to project ${projectId}`);
  
  // Set outputs for downstream steps
  setOutputs({ itemId });
}

// Execute script with error handling
executeScript(addToProject, 'Add to Project Script');