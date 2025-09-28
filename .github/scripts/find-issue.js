/**
 * Find issue from branch name
 * Extracts issue number from branch name and fetches issue details
 */

const core = require('@actions/core');
const github = require('@actions/github');
const { 
  validateEnvironmentVariables, 
  createOctokit, 
  extractIssueFromBranch,
  withRetry,
  setOutputs,
  executeScript
} = require('./shared-utils');

/**
 * Main function to find issue from branch
 */
async function findIssue() {
  // Support both TOKEN and GITHUB_TOKEN for backward compatibility
  const tokenVar = process.env.GITHUB_TOKEN ? 'GITHUB_TOKEN' : 'TOKEN';
  
  // Validate required environment variables
  validateEnvironmentVariables([tokenVar, 'BRANCH', 'REGEX']);

  const token = process.env.GITHUB_TOKEN || process.env.TOKEN;
  const branch = process.env.BRANCH;
  const regex = process.env.REGEX;

  const octokit = createOctokit(token);

  // Extract issue number from branch name
  const issueNumber = extractIssueFromBranch(branch, regex);
  
  if (!issueNumber) {
    core.info(`ℹ️ No issue number found in branch '${branch}' using regex '${regex}'`);
    setOutputs({
      issue: "",
      issue_number: "",
      issue_node_id: ""
    });
    return;
  }

  // Fetch issue details
  try {
    const issue = await withRetry(
      () => octokit.rest.issues.get({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issueNumber
      }),
      { operation: `fetching issue #${issueNumber}` }
    );

    core.info(`✅ Found issue #${issueNumber}`);
    
    setOutputs({
      issue: JSON.stringify(issue.data),
      issue_number: issueNumber.toString(),
      issue_node_id: issue.data.node_id
    });

  } catch (error) {
    // If issue doesn't exist, return empty values instead of failing
    if (error.status === 404) {
      core.info(`ℹ️ No issue found for #${issueNumber}`);
      setOutputs({
        issue: "",
        issue_number: "",
        issue_node_id: ""
      });
    } else {
      throw error; // Re-throw other errors
    }
  }
}

// Execute script with error handling
executeScript(findIssue, 'Find Issue Script');