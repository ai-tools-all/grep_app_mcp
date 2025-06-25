import { Octokit } from '@octokit/rest';
import { z } from 'zod';

const octokit = new Octokit();

// Schema for batch file request
const BatchFileRequestSchema = z.object({
  files: z.array(z.object({
    owner: z.string(),
    repo: z.string(),
    path: z.string(),
    ref: z.string().optional()
  }))
});

type BatchFileRequest = z.infer<typeof BatchFileRequestSchema>;

// Schema for batch file content response
const BatchFileContentSchema = z.array(z.object({
  content: z.string(),
  path: z.string(),
  sha: z.string(),
  owner: z.string(),
  repo: z.string()
}));

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
  execute: async (args: any, { log, reportProgress }: any) => {
    const params = BatchFileRequestSchema.parse(args);
    try {
      const results = await Promise.all(
        params.files.map(async (file) => {
          try {
            const response = await octokit.rest.repos.getContent({
              owner: file.owner,
              repo: file.repo,
              path: file.path,
              ref: file.ref
            });

            if (Array.isArray(response.data)) {
              throw new Error(`Path ${file.path} points to a directory, not a file`);
            }

            if (!('content' in response.data)) {
              throw new Error(`No content found in response for ${file.path}`);
            }

            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

            return {
              content,
              path: response.data.path,
              sha: response.data.sha,
              owner: file.owner,
              repo: file.repo
            };
          } catch (error) {
            return {
              content: '',
              path: file.path,
              sha: '',
              owner: file.owner,
              repo: file.repo,
              error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
          }
        })
      );

      return JSON.stringify(results, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }, null, 2);
    }
  }
};
