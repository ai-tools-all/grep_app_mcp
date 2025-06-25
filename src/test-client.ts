import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const MCP_ENDPOINT = 'http://localhost:8603/mcp';

async function main() {
    // The SDK's Client handles session management automatically.
    const transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT));
    const client = new Client({
        name: 'test-client',
        version: '1.0.0',
    });

    try {
        console.log('Connecting to the FastMCP server...');
        await client.connect(transport);
        console.log('Connection successful.');

        // 1. Search for code
        console.log('\n--- Step 1: Searching for "import React" ---');
        const searchResult = (await client.callTool({
            name: 'searchCode',
            arguments: { query: 'import React', numberedOutput: true },
        })) as any; // Cast to any to resolve lint error
        console.log('Search Result:\n', searchResult.content[0].text);

        // 2. Batch retrieve some results
        console.log('\n--- Step 2: Batch retrieving results 1, 5, and 10 ---');
        const batchResult = (await client.callTool({
            name: 'batchRetrievalTool',
            arguments: { query: 'import React', resultNumbers: [1, 5, 10] },
        })) as any; // Cast to any to resolve lint error
        console.log('Batch Retrieval Result:\n', JSON.stringify(batchResult.content[0], null, 2));

        // The result from batchRetrieveFiles is a JSON string inside the content array
        const batchResultData = JSON.parse(batchResult.content[0].text);

        if (batchResultData.success) {
            console.log('\n--- Test PASSED ---');
        } else {
            console.log('\n--- Test FAILED ---');
            console.error('Failure reason:', batchResultData.error);
        }

    } catch (error) {
        console.error('\n--- Test FAILED with an unexpected error ---', error);
    } finally {
        // The client does not have a `disconnect` method. The connection will close when the process exits.
        console.log('\nTest finished.');
    }
}

main();
