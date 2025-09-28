/**
 * Find project fields and options
 * Locates field and option IDs for GitHub Projects V2
 */

const { 
  validateEnvironmentVariables, 
  createOctokit, 
  findProjectFields,
  setOutputs,
  executeScript
} = require('./shared-utils');

/**
 * Main function to find project fields
 */
async function findFields() {
  // Validate required environment variables
  validateEnvironmentVariables(['GITHUB_TOKEN', 'PROJECT_ID', 'FIELD_NAME', 'OPTION_NAME']);

  const token = process.env.GITHUB_TOKEN;
  const projectId = process.env.PROJECT_ID;
  const fieldName = process.env.FIELD_NAME;
  const optionName = process.env.OPTION_NAME;

  const octokit = createOctokit(token);

  // Find field and option using shared utility
  const { fieldId, optionId } = await findProjectFields(
    octokit, 
    projectId, 
    fieldName, 
    optionName
  );

  // Set outputs for downstream steps
  setOutputs({ fieldId, optionId });
}

// Execute script with error handling
executeScript(findFields, 'Find Fields Script');