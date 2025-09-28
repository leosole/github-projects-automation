/**
 * Set date field value in GitHub Projects V2
 * Updates a date field for an issue in a project
 */

const core = require('@actions/core');
const { 
  validateEnvironmentVariables, 
  createOctokit, 
  findIssueProjectItem,
  withRetry,
  setOutputs,
  executeScript,
  GRAPHQL_QUERIES
} = require('./shared-utils');

/**
 * Find date field in project
 * @param {Object} octokit - Octokit instance
 * @param {string} projectId - Project ID
 * @param {string} fieldName - Field name to find
 * @returns {Promise<Object>} Date field object
 */
async function findDateField(octokit, projectId, fieldName) {
  const result = await withRetry(
    () => octokit.graphql(GRAPHQL_QUERIES.PROJECT_FIELDS, { projectId }),
    { operation: 'finding date field' }
  );

  const dateField = result.node.fields.nodes.find(
    field => field.name === fieldName && field.dataType === 'DATE'
  );
  
  if (!dateField) {
    throw new Error(`Date field "${fieldName}" not found in project`);
  }

  core.info(`✅ Found date field '${fieldName}' (ID: ${dateField.id})`);
  return dateField;
}

/**
 * Main function to set date field
 */
async function setDate() {
  // Validate required environment variables
  validateEnvironmentVariables(['GITHUB_TOKEN', 'PROJECT_ID', 'FIELD_NAME', 'ISSUE_NODE_ID']);

  const token = process.env.GITHUB_TOKEN;
  const projectId = process.env.PROJECT_ID;
  const fieldName = process.env.FIELD_NAME;
  const issueNodeId = process.env.ISSUE_NODE_ID;
  const dateValue = process.env.DATE_VALUE || new Date().toISOString().split('T')[0]; // Default to current date

  const octokit = createOctokit(token);

  // Find the date field
  const dateField = await findDateField(octokit, projectId, fieldName);

  // Find the project item for this issue
  const projectItem = await findIssueProjectItem(octokit, issueNodeId, projectId);
  
  if (!projectItem) {
    core.warning(`⚠️ Issue not found in project ${projectId}`);
    return;
  }

  // Update the date field with retry logic
  await withRetry(
    () => octokit.graphql(GRAPHQL_QUERIES.UPDATE_PROJECT_DATE_FIELD, {
      projectId,
      itemId: projectItem.id,
      fieldId: dateField.id,
      dateValue
    }),
    { operation: 'updating date field' }
  );

  core.info(`✅ Field "${fieldName}" updated with date: ${dateValue}`);
  
  setOutputs({
    fieldId: dateField.id,
    date: dateValue
  });
}

// Execute script with error handling
executeScript(setDate, 'Set Date Script');
