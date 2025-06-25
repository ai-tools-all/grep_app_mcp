# Search Parameters Schema Enhancement

## Key Decisions and Judgement Calls

1. **Schema Centralization**
   - Moved from duplicate schema definitions to a single source of truth in `types.ts`
   - Rationale: Reduces maintenance overhead and ensures consistency across codebase

2. **Validation Strategy**
   - Added two-tier validation approach:
     - Basic schema (`SearchParamsSchema`): For standard parameter validation
     - Advanced schema (`SearchParamsSchemaAdvanced`): For regex pattern validation
   - Rationale: Separates concerns and allows flexibility in validation level

3. **Default Values**
   - Added default values for boolean flags:
     ```typescript
     caseSensitive: z.boolean().optional().default(false)
     useRegex: z.boolean().optional().default(false)
     wholeWords: z.boolean().optional().default(false)
     ```
   - Rationale: Ensures consistent behavior when parameters are omitted

4. **Helper Functions**
   - Created `searchParamsHelpers` object with utility functions
   - Rationale: Provides a clean API for common operations and encapsulates validation logic

## Code Evolution

### Initial Implementation
Location: `/src/core/grep-app-client.ts`
```typescript
parameters: z.object({
  query: z.string().describe('The search query string'),
  // ... duplicate schema definition
})
```

### Enhanced Implementation
Location: `/src/core/types.ts`
```typescript
export const SearchParamsSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  // ... centralized schema with better validation
})
```

## Learnings

1. **Schema Organization**
   - Keep schema definitions centralized
   - Use TypeScript's type inference (`z.infer`) to maintain DRY principle
   - Document schema with examples in JSDoc comments

2. **Validation Best Practices**
   - Add meaningful error messages
   - Validate at the appropriate level (basic vs advanced)
   - Use refinements for complex validations (like regex pattern checking)

3. **Helper Functions**
   - Create utility functions for common operations
   - Use type guards for runtime type checking
   - Provide examples for common use cases

4. **FastMCP Integration**
   - FastMCP tools can directly use Zod schemas for parameter validation
   - Schema descriptions are used for tool documentation
   - Examples in schema help with tool usage

## False Paths and Corrections

1. **JSON Response Format**
   - Initially tried to format tool response as JSON string:
   ```typescript
   // Wrong approach
   return {
     content: [{ type: 'text', text: JSON.stringify(totalHits, null, 2) }]
   };
   ```
   - Corrected to return raw hits object:
   ```typescript
   // Correct approach
   return totalHits;
   ```

2. **Example Constants**
   - Initially tried to use type assertions:
   ```typescript
   // Wrong approach
   } as const satisfies SearchParams
   ```
   - Fixed to use helper function:
   ```typescript
   // Correct approach
   searchParamsHelpers.create({...})
   ```

## Future Improvements

1. Consider adding more refinements for:
   - Language filter validation
   - Path pattern validation
   - Repository name format validation

2. Add unit tests for:
   - Schema validation
   - Helper functions
   - Edge cases in regex patterns
