/**
 * Shared utilities for GitHub Actions scripts
 * Provides common functionality for project automation workflows
 */

const core = require('@actions/core');
const github = require('@actions/github');

/**
 * Validates required environment variables
 * @param {string[]} requiredVars - Array of required environment variable names
 * @throws {Error} If any required variable is missing
 */
function validateEnvironmentVariables(requiredVars) {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  core.info(`✅ All required environment variables validated: ${requiredVars.join(', ')}`);
}

/**
 * Creates an authenticated Octokit instance
 * @param {string} token - GitHub token
 * @returns {Object} Octokit instance
 */
function createOctokit(token) {
  if (!token) {
    throw new Error('GitHub token is required');
  }
  return github.getOctokit(token);
}

/**
 * Executes a function with retry logic
 * @param {Function} fn - Function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.delay - Delay between retries in ms (default: 1000)
 * @param {string} options.operation - Operation name for logging
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(fn, options = {}) {
  const { maxRetries = 3, delay = 1000, operation = 'operation' } = options;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        core.info(`✅ ${operation} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      core.warning(`⚠️ ${operation} failed on attempt ${attempt}/${maxRetries}: ${error.message}`);
      
      if (attempt < maxRetries) {
        core.info(`⏱️ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`${operation} failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

/**
 * Common GraphQL queries for project automation
 */
const GRAPHQL_QUERIES = {
  /**
   * Find project fields and options
   */
  PROJECT_FIELDS: `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
              ... on ProjectV2Field {
                id
                name
                dataType
              }
            }
          }
        }
      }
    }
  `,

  /**
   * Find project items for an issue
   */
  ISSUE_PROJECT_ITEMS: `
    query($issueNodeId: ID!) {
      issue: node(id: $issueNodeId) {
        ... on Issue {
          id
          number
          projectItems(first: 20) {
            nodes {
              id
              project {
                id
              }
            }
          }
        }
      }
    }
  `,

  /**
   * Find project items for a PR with pagination
   */
  PR_PROJECT_ITEMS_PAGINATED: `
    query($prNodeId: ID!, $cursor: String) {
      pullRequest: node(id: $prNodeId) {
        ... on PullRequest {
          id
          number
          title
          projectItems(first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              project {
                id
              }
            }
          }
        }
      }
    }
  `,

  /**
   * Add item to project
   */
  ADD_TO_PROJECT: `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item {
          id
        }
      }
    }
  `,

  /**
   * Update project item field value
   */
  UPDATE_PROJECT_FIELD: `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { singleSelectOptionId: $optionId }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
  `,

  /**
   * Update project item date field
   */
  UPDATE_PROJECT_DATE_FIELD: `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $dateValue: Date!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { date: $dateValue }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
  `,

  /**
   * Remove item from project
   */
  REMOVE_FROM_PROJECT: `
    mutation($projectId: ID!, $itemId: ID!) {
      deleteProjectV2Item(input: {projectId: $projectId, itemId: $itemId}) {
        deletedItemId
      }
    }
  `
};

/**
 * Finds project fields by name and option
 * @param {Object} octokit - Octokit instance
 * @param {string} projectId - Project ID
 * @param {string} fieldName - Field name to find
 * @param {string} optionName - Option name to find (optional)
 * @returns {Promise<Object>} Object with fieldId and optionId (if applicable)
 */
async function findProjectFields(octokit, projectId, fieldName, optionName = null) {
  const result = await withRetry(
    () => octokit.graphql(GRAPHQL_QUERIES.PROJECT_FIELDS, { projectId }),
    { operation: 'finding project fields' }
  );

  const fields = result.node.fields.nodes;
  const field = fields.find(f => f.name === fieldName);
  
  if (!field) {
    throw new Error(`Field '${fieldName}' not found in project ${projectId}`);
  }

  let optionId = null;
  if (optionName && field.options) {
    const option = field.options.find(opt => opt.name === optionName);
    if (!option) {
      throw new Error(`Option '${optionName}' not found in field '${fieldName}'`);
    }
    optionId = option.id;
  }

  core.info(`✅ Found field '${fieldName}' (ID: ${field.id})${optionId ? ` with option '${optionName}' (ID: ${optionId})` : ''}`);
  
  return {
    fieldId: field.id,
    optionId,
    field
  };
}

/**
 * Finds project item for an issue
 * @param {Object} octokit - Octokit instance
 * @param {string} issueNodeId - Issue node ID
 * @param {string} projectId - Project ID
 * @returns {Promise<Object|null>} Project item or null if not found
 */
async function findIssueProjectItem(octokit, issueNodeId, projectId) {
  const result = await withRetry(
    () => octokit.graphql(GRAPHQL_QUERIES.ISSUE_PROJECT_ITEMS, { issueNodeId }),
    { operation: 'finding issue project items' }
  );

  const item = result.issue?.projectItems?.nodes?.find(
    projectItem => projectItem.project.id === projectId
  );

  if (item) {
    core.info(`✅ Found project item ${item.id} for issue in project ${projectId}`);
  } else {
    core.warning(`⚠️ No project item found for issue ${issueNodeId} in project ${projectId}`);
  }

  return item;
}

/**
 * Finds project item for a PR with pagination support
 * @param {Object} octokit - Octokit instance
 * @param {string} prNodeId - PR node ID
 * @param {string} projectId - Project ID
 * @returns {Promise<Object|null>} Project item or null if not found
 */
async function findPRProjectItem(octokit, prNodeId, projectId) {
  let projectItem = null;
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage && !projectItem) {
    const result = await withRetry(
      () => octokit.graphql(GRAPHQL_QUERIES.PR_PROJECT_ITEMS_PAGINATED, { prNodeId, cursor }),
      { operation: 'finding PR project items' }
    );

    const pr = result.pullRequest;
    if (!pr) {
      core.warning(`⚠️ PR with node ID ${prNodeId} not found`);
      return null;
    }

    projectItem = pr.projectItems.nodes.find(item => item.project.id === projectId);
    hasNextPage = pr.projectItems.pageInfo.hasNextPage;
    cursor = pr.projectItems.pageInfo.endCursor;
  }

  if (projectItem) {
    core.info(`✅ Found project item ${projectItem.id} for PR in project ${projectId}`);
  } else {
    core.warning(`⚠️ No project item found for PR ${prNodeId} in project ${projectId}`);
  }

  return projectItem;
}

/**
 * Extracts issue number from branch name using regex
 * @param {string} branch - Branch name
 * @param {string} regex - Regex pattern
 * @returns {number|null} Issue number or null if not found
 */
function extractIssueFromBranch(branch, regex) {
  const cleanBranch = branch.replace('refs/heads/', '');
  const regexPattern = new RegExp(regex);
  const match = cleanBranch.match(regexPattern);
  
  if (match && match[1]) {
    const issueNumber = parseInt(match[1], 10);
    core.info(`✅ Extracted issue #${issueNumber} from branch '${cleanBranch}'`);
    return issueNumber;
  }
  
  core.info(`ℹ️ No issue number found in branch '${cleanBranch}' using regex '${regex}'`);
  return null;
}

/**
 * Sets GitHub Actions outputs safely
 * @param {Object} outputs - Object with key-value pairs to set as outputs
 */
function setOutputs(outputs) {
  Object.entries(outputs).forEach(([key, value]) => {
    core.setOutput(key, value);
    core.info(`📤 Set output: ${key} = ${value}`);
  });
}

/**
 * Handles script execution with comprehensive error handling
 * @param {Function} mainFunction - Main function to execute
 * @param {string} scriptName - Name of the script for logging
 */
async function executeScript(mainFunction, scriptName) {
  try {
    core.info(`🚀 Starting ${scriptName}`);
    await mainFunction();
    core.info(`✅ ${scriptName} completed successfully`);
  } catch (error) {
    core.error(`❌ ${scriptName} failed: ${error.message}`);
    core.setFailed(error.message);
    throw error;
  }
}

module.exports = {
  validateEnvironmentVariables,
  createOctokit,
  withRetry,
  GRAPHQL_QUERIES,
  findProjectFields,
  findIssueProjectItem,
  findPRProjectItem,
  extractIssueFromBranch,
  setOutputs,
  executeScript
};
