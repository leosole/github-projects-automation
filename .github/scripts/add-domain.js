/**
 * Add domain value to project item
 * Sets the Domain field for an issue or project item in GitHub Projects V2
 */

const core = require('@actions/core');
const github = require('@actions/github');
const { 
  validateEnvironmentVariables, 
  createOctokit, 
  findProjectFields,
  findIssueProjectItem,
  withRetry,
  executeScript,
  GRAPHQL_QUERIES
} = require('./shared-utils');

/**
 * Main function to add domain to project item
 */
async function addDomain() {
  // Validate required environment variables
  validateEnvironmentVariables(['GITHUB_TOKEN', 'PROJECT_ID', 'DOMAIN']);

  const token = process.env.GITHUB_TOKEN;
  const projectId = process.env.PROJECT_ID;
  const domainValue = process.env.DOMAIN;
  const providedItemId = process.env.ITEM_ID;

  const octokit = createOctokit(token);

  // Get content ID and issue number if not using provided item ID
  let contentId, issueNumber;
  if (!providedItemId) {
    issueNumber = github.context.payload.issue?.number;
    if (!issueNumber) {
      throw new Error('No issue number found in context and no ITEM_ID provided');
    }

    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;
    
    const { data: issue } = await withRetry(
      () => octokit.rest.issues.get({ owner, repo, issue_number: issueNumber }),
      { operation: 'fetching issue data' }
    );
    contentId = issue.node_id;
  }

  // Find Domain field and option
  const { fieldId, optionId } = await findProjectFields(
    octokit, 
    projectId, 
    'Domain', 
    domainValue
  );

  // Find or use project item
  let item;
  if (providedItemId) {
    item = { id: providedItemId };
    core.info(`📌 Using provided item ID: ${providedItemId}`);
  } else {
    item = await findIssueProjectItem(octokit, contentId, projectId);
    if (!item) {
      throw new Error(`Project item for issue #${issueNumber} not found in project ${projectId}`);
    }
  }

  // Update the Domain field value
  await withRetry(
    () => octokit.graphql(GRAPHQL_QUERIES.UPDATE_PROJECT_FIELD, {
      projectId,
      itemId: item.id,
      fieldId,
      optionId
    }),
    { operation: 'updating domain field' }
  );

  core.info(`✅ Set Domain field to "${domainValue}"${issueNumber ? ` for issue #${issueNumber}` : ' for project item'}`);
}

// Execute script with error handling
executeScript(addDomain, 'Add Domain Script');