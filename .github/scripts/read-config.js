const core = require('@actions/core');
const fs = require('fs');

/**
 * Reads configuration from inputs or config.json file
 * @param {Object} inputs - Input parameters object
 * @param {string} inputs.project_id - Project ID from workflow input
 * @param {string} inputs.domain - Domain from workflow input
 * @param {string} configPath - Path to config.json file (default: '.github/config.json')
 * @returns {Object} Configuration object with project_id and domain
 */
function readConfig(inputs = {}, configPath = '.github/config.json') {
  const config = {};

  // Read PROJECT_ID
  if (inputs.project_id) {
    config.project_id = inputs.project_id;
    core.info(`Using PROJECT_ID from input: ${config.project_id}`);
  } else {
    // Try to read from config.json
    if (fs.existsSync(configPath)) {
      try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.project_id = configData.PROJECT_ID;
        core.info(`Using PROJECT_ID from config.json: ${config.project_id}`);
      } catch (error) {
        core.setFailed(`Error reading config.json: ${error.message}`);
        return null;
      }
    } else {
      core.setFailed(`No PROJECT_ID provided as input and ${configPath} not found in the repository`);
      return null;
    }
  }

  // Read DOMAIN
  if (inputs.domain) {
    config.domain = inputs.domain;
    core.info(`Using DOMAIN from input: ${config.domain}`);
  } else {
    // Try to read from config.json
    if (fs.existsSync(configPath)) {
      try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.domain = configData.DOMAIN;
        if (config.domain) {
          core.info(`Using DOMAIN from config.json: ${config.domain}`);
        }
      } catch (error) {
        core.warning(`Error reading DOMAIN from config.json: ${error.message}`);
      }
    }
  }

  return config;
}

/**
 * Main function when script is run directly
 */
async function main() {
  try {
    const inputs = {
      project_id: process.env.PROJECT_ID,
      domain: process.env.DOMAIN
    };

    const config = readConfig(inputs);
    
    if (!config) {
      process.exit(1);
    }

    // Set outputs for GitHub Actions
    core.setOutput('project_id', config.project_id);
    if (config.domain) {
      core.setOutput('domain', config.domain);
    }

    core.info('Configuration successfully loaded');
  } catch (error) {
    core.setFailed(error.message);
  }
}

// Export for use in other scripts and run main if called directly
module.exports = { readConfig };

if (require.main === module) {
  main();
}
