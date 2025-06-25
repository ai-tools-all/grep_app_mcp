import { z } from 'zod';
import { batchRetrieveFiles } from '../core/batch-retrieval.js';
import { ToolContext } from '../core/types.js';

// Schema for batch retrieval request
const BatchRetrievalSchema = z.object({
    query: z.string().describe('The original search query used to find the files'),
    resultNumbers: z.array(z.number()).optional()
        .describe('List of result numbers to retrieve from the cached search results')
});

type BatchRetrievalRequest = z.infer<typeof BatchRetrievalSchema>;

export const batchRetrievalTool = {
    name: 'batchRetrievalTool',
    description: 'Retrieve file contents from GitHub for specified search results. Must be used after a search query has been cached.',
    version: '1.0.0',
    parameters: BatchRetrievalSchema,
    annotations: {
        title: 'Batch File Retriever',
        readOnlyHint: true,
        openWorldHint: true,
    },
    execute: async (args: any, context: ToolContext) => {
        try {
            const params = BatchRetrievalSchema.parse(args);
            const result = await batchRetrieveFiles(params, context);
            return JSON.stringify(result, null, 2);
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            }, null, 2);
        }
    }
};
