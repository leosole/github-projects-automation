# GitHub Projects Automation

A comprehensive collection of GitHub Actions workflows and scripts for automating task management in GitHub Projects. This repository provides reusable workflows that automatically update project statuses based on various GitHub events like issue creation, branch creation, pull request activities, and deployments.

## Features

- **Automatic Project Management**: Moves issues and pull requests through project columns based on their lifecycle
- **Multi-Domain Support**: Handle projects with domain-based organization
- **Configurable Status Mapping**: Customize status names to match your project workflow
- **Branch-Issue Integration**: Automatically links branches to issues using configurable regex patterns
- **Staging/Production Workflow**: Special handling for deployment-related status updates
- **Robust Error Handling**: Built-in retry logic and comprehensive logging

## Available Workflows

### Core Automation Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `project-automation-master.yml` | All | Main orchestrator for all project automation |
| `issue-opened.yml` | Issue created | Adds new issues to project with domain information |
| `branch-created.yml` | Branch created | Moves linked issue to "Doing" status |
| `pr-opened.yml` | PR opened | Moves linked issue to "Review" status |
| `pr-review.yml` | PR review requested | Updates issue status based on review state |
| `pr-add.yml` | PR created | Adds pull requests to projects |
| `pr-main-closed.yml` | PR merged to main | Moves issue to "Done" status and adds label |
| `pr-stg-closed.yml` | PR merged to staging | HMoves issue to "Done" status and adds label |
| `issue-closed.yml` | Issue closed | updates issue end date |
| `stg-to-prod.yml` | Manual/scheduled | Promotes items from staging to production |

## Setup

### Required Permissions

Your GitHub token needs the following permissions:
- `contents: read`
- `issues: write`
- `pull-requests: write`
- `projects: write`

### Installation

1. **Copy workflows**: Copy the `WORKFLOWS/workflows/project-automation.yml` to your repository's `.github/workflows/` directory

2. **Set up secrets**: Add the following secrets to your repository:
   ```
   GH_PROJECT_TOKEN - Your GitHub token with project permissions
   ```

## License

This project is open source and available under the [MIT License](LICENSE).


---

**Note**: This automation system is designed to work with GitHub Projects (Beta/V2). Make sure your project is using the new GitHub Projects interface.
