import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { logger } from './logger.js';

const octokit = new Octokit();

// Schema for GitHub file request
export const GitHubFileRequestSchema = z.object({
    owner: z.string(),
    repo: z.string(),
    path: z.string(),
    ref: z.string().optional()
});

export type GitHubFileRequest = z.infer<typeof GitHubFileRequestSchema>;

// Schema for GitHub file content response
export const GitHubFileContentSchema = z.object({
    content: z.string(),
    path: z.string(),
    sha: z.string(),
    owner: z.string(),
    repo: z.string(),
    error: z.string().optional()
});

export type GitHubFileContent = z.infer<typeof GitHubFileContentSchema>;

/**
 * Fetch multiple files from GitHub in parallel
 */
export async function fetchGitHubFiles(files: GitHubFileRequest[]): Promise<GitHubFileContent[]> {
    logger.info('Fetching files from GitHub', { fileCount: files.length });
    
    return await Promise.all(
        files.map(async (file) => {
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
                logger.error('Failed to fetch GitHub file', { error, file });
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
}
