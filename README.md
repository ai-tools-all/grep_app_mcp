# Grep App MCP Server

## Tools

### batch_retrieve_files

This tool allows you to retrieve files from previously cached search results.

#### Usage

```json
{
  "query": "your_previous_search_query",
  "resultNumbers": [1, 2, 3] // Array of 1-based indices of results you want to retrieve
}
```

#### Parameters

- `query`: The exact search query string that was used in the previous search
- `resultNumbers`: An array of numbers representing which results you want to retrieve (1-based indexing)

#### Example

```json
{
  "query": "tower_governor",
  "resultNumbers": [1, 2]
}
```

#### Response

- Success: Returns an object with `success: true` and `files` array containing the requested files
- Failure: Returns an object with `success: false` and an `error` message if no cached results are found

#### Note

Make sure to:
1. Use the exact same query string that was used in the original search
2. Only request result numbers that exist in the original search results
3. Call this tool after performing a search that caches the results
