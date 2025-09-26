# Cap Table Session API Performance Issues

## Identified Problems

### 1. **Multiple Sequential Database Queries (N+1 Problem)**
The GET endpoint makes 5 separate database queries in sequence:
- `supabase.auth.getUser()` - Auth check
- Query `companies` table for ownership verification
- Query `profiles` table for creator email
- Query `company_members` table for admin member
- Query `cap_table_sessions` table for active session

**Impact**: Each query adds ~1-2 seconds of latency, compounding to 4-8+ seconds total.

### 2. **Waterfall Query Pattern**
Queries are executed sequentially where each depends on the previous result, instead of using efficient JOINs or parallel execution.

### 3. **Repeated Logic Across Functions**
The same "find admin member" logic is duplicated in multiple functions, causing redundant database calls.

### 4. **No Query Optimization**
- No database indexes on frequently queried columns
- No query result caching
- No connection pooling optimization

## Recommended Solutions

### Immediate Fixes (High Impact)

#### 1. **Combine Queries with JOINs**
Replace multiple sequential queries with a single optimized query:

```sql
SELECT 
  c.id as company_id,
  c.name as company_name,
  cm.id as admin_member_id,
  cm.credit_balance,
  cm.name as admin_name,
  cts.id as session_id,
  cts.session_fee,
  cts.paid_at,
  cts.is_active
FROM companies c
LEFT JOIN profiles p ON c.created_by = p.id
LEFT JOIN company_members cm ON cm.company_id = c.id AND cm.email = p.email
LEFT JOIN cap_table_sessions cts ON cts.company_id = c.id AND cts.is_active = true
WHERE c.id = $1 AND c.created_by = $2
```

#### 2. **Add Database Indexes**
```sql
-- Add these indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_company_members_company_email ON company_members(company_id, email);
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_company_active ON cap_table_sessions(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON companies(created_by);
```

#### 3. **Implement Response Caching**
Cache frequently accessed company data for 30-60 seconds to reduce database load.

### Medium-term Improvements

#### 4. **Connection Pooling**
Ensure Supabase client is using connection pooling effectively.

#### 5. **Database Query Monitoring**
Add query performance monitoring to identify slow queries.

## Expected Performance Improvement
- **Current**: 4-19 seconds response time
- **After optimization**: 200-500ms response time
- **Improvement**: 90-95% reduction in response time

## Implementation Priority
1. **High**: Combine queries with JOINs (biggest impact)
2. **High**: Add database indexes
3. **Medium**: Implement caching
4. **Low**: Add monitoring and alerting
