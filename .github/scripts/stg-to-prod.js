/**
 * Move tasks from Staging to Production
 * Replaces 'staging' labels with 'production' labels on closed issues
 */

const core = require('@actions/core');
const github = require('@actions/github');
const { 
  validateEnvironmentVariables, 
  createOctokit, 
  withRetry,
  executeScript
} = require('./shared-utils');

/**
 * Remove label from an issue
 * @param {Object} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string} labelName - Label name to remove
 */
async function removeLabel(octokit, owner, repo, issueNumber, labelName) {
  try {
    await withRetry(
      () => octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: labelName
      }),
      { operation: `removing "${labelName}" label from issue #${issueNumber}` }
    );
    core.info(`✅ Removed "${labelName}" label from issue #${issueNumber}`);
  } catch (error) {
    core.warning(`⚠️ Could not remove "${labelName}" label from issue #${issueNumber}: ${error.message}`);
  }
}

/**
 * Add labels to an issue
 * @param {Object} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string[]} labels - Label names to add
 */
async function addLabels(octokit, owner, repo, issueNumber, labels) {
  await withRetry(
    () => octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels
    }),
    { operation: `adding labels to issue #${issueNumber}` }
  );
  core.info(`✅ Added "${labels.join(', ')}" label(s) to issue #${issueNumber}`);
}

/**
 * Main function to move staging issues to production
 */
async function stagingToProduction() {
  // Validate required environment variables
  validateEnvironmentVariables(['GITHUB_TOKEN']);

  const token = process.env.GITHUB_TOKEN;
  const stagingLabel = process.env.STAGING_LABEL || 'staging';
  const productionLabel = process.env.PRODUCTION_LABEL || 'production';
  
  const octokit = createOctokit(token);
  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;

  core.info(`🏷️ Using staging label: '${stagingLabel}', production label: '${productionLabel}'`);

  // Fetch all closed issues with staging label with pagination support
  const issues = await withRetry(
    () => octokit.paginate(octokit.rest.issues.listForRepo, {
      owner,
      repo,
      state: 'closed',
      labels: stagingLabel,
      per_page: 100
    }),
    { operation: `fetching closed issues with ${stagingLabel} label` }
  );

  core.info(`📋 Found ${issues.length} closed issues with '${stagingLabel}' label`);

  if (issues.length === 0) {
    core.info(`ℹ️ No issues to process`);
    return;
  }

  // Process each issue
  let processedCount = 0;
  for (const issue of issues) {
    try {
      // Remove staging label
      await removeLabel(octokit, owner, repo, issue.number, stagingLabel);
      
      // Add production label
      await addLabels(octokit, owner, repo, issue.number, [productionLabel]);
      
      processedCount++;
    } catch (error) {
      core.warning(`⚠️ Failed to process issue #${issue.number}: ${error.message}`);
      // Continue with other issues instead of failing completely
    }
  }

  core.info(`✅ Successfully processed ${processedCount}/${issues.length} issues`);
}

// Execute script with error handling
executeScript(stagingToProduction, 'Staging to Production Script');