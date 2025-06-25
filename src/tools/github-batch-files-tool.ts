import { z } from 'zod';
import { GitHubFileRequestSchema, fetchGitHubFiles } from '../core/github-utils.js';
import type { ToolContext } from '../core/types.js';

// Schema for batch file request
const BatchFileRequestSchema = z.object({
  files: z.array(GitHubFileRequestSchema)
});

type BatchFileRequest = z.infer<typeof BatchFileRequestSchema>;

export const githubBatchFilesTool = {
  name: 'github_batch_files',
  description: 'Fetch multiple file contents from GitHub repositories in parallel',
  version: '1.0.0',
  parameters: BatchFileRequestSchema,
  annotations: {
    title: 'GitHub Batch Files Fetcher',
    readOnlyHint: true,
    openWorldHint: true,
  },
  execute: async (args: BatchFileRequest, context: ToolContext) => {
    const params = BatchFileRequestSchema.parse(args);
    try {
      const results = await fetchGitHubFiles(params.files);
      return JSON.stringify(results, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }, null, 2);
    }
  }
};
