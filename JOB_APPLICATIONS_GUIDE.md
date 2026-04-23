# Job Applications Guide

Complete guide for linking candidates to jobs and tracking applications.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Model](#data-model)
3. [Relationship Explained](#relationship-explained)
4. [API Endpoints](#api-endpoints)
5. [Workflows](#workflows)
6. [Examples](#examples)
7. [Best Practices](#best-practices)

---

## Architecture Overview

The system uses a **many-to-many relationship** between Candidates and Jobs through the `JobApplication` collection:

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  Candidate (applicant)  ──→  JobApplication  ←──  Job        │
│  (one candidate)             (middleware)       (one job)     │
│                                                               │
│  ┌──────────────────┐    ┌──────────────────┐  ┌──────────┐ │
│  │ Candidate        │    │ JobApplication   │  │ Job      │ │
│  ├──────────────────┤    ├──────────────────┤  ├──────────┤ │
│  │ _id (ObjectId)   │←───│ candidateId      │  │ _id ←────┤ │
│  │ name             │    │ jobId ───────────→  │ title    │ │
│  │ email            │    │ status           │  │ dept     │ │
│  │ skills[]         │    │ source           │  │ location │ │
│  │                  │    │ createdAt        │  │ skills[] │ │
│  └──────────────────┘    │ updatedAt        │  └──────────┘ │
│                          └──────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘

KEY RELATIONSHIPS:
- One Candidate → Many JobApplications → Many Jobs
- One Job → Many JobApplications → Many Candidates
- Unique constraint: (jobId, candidateId) = only one application per candidate per job
```

---

## Data Model

### JobApplication Schema

```typescript
{
  _id: ObjectId,                    // MongoDB ID
  jobId: ObjectId,                  // Reference to Job._id
  candidateId: ObjectId,            // Reference to Candidate._id
  status: string,                   // 'applied' | 'screened' | 'shortlisted' | 'rejected'
  source: string,                   // How they applied ('manual' | 'csv-upload' | 'resume-upload' | etc)
  createdAt: Date,                  // When they applied
  updatedAt: Date                   // Last updated
}
```

### Status Lifecycle

```
applied
   ↓
screened (after initial review)
   ↓
┌─ shortlisted (strong candidate, move to interview)
│
└─ rejected (doesn't meet requirements)
```

---

## Relationship Explained

### Example Scenario

**Database State**:
```
Jobs:
├── Job_A: "Senior Backend Engineer" (jobId: JOB-12345)
└── Job_B: "Frontend Engineer" (jobId: JOB-67890)

Candidates:
├── Candidate_1: "Alice Johnson" (specializes in backend)
├── Candidate_2: "Bob Smith" (full-stack developer)
└── Candidate_3: "Charlie Brown" (frontend specialist)

JobApplications (Linking them):
├── Application_1: Candidate_1 → Job_A (status: applied)
├── Application_2: Candidate_1 → Job_B (status: rejected)
├── Application_3: Candidate_2 → Job_A (status: screened)
├── Application_4: Candidate_2 → Job_B (status: applied)
└── Application_5: Candidate_3 → Job_B (status: shortlisted)
```

**Queries**:
- "Which candidates applied to Job_A?" → Applications 1, 3
- "Which jobs did Alice apply to?" → Applications 1, 2
- "Who is shortlisted for Job_B?" → Application 5 (Charlie)
- "How many applications for Job_B?" → 3 candidates

---

## API Endpoints

### 1. Create Application (Candidate Applies)

**POST** `/applications`

Candidate applies for a specific job.

**Request Body**:
```json
{
  "jobId": "JOB-12345",           // Business job ID (from POST /jobs response)
  "candidateId": "507f1f77bcf86cd799439011",  // Candidate MongoDB ID
  "source": "manual"              // Optional: how they applied
}
```

**Source Values**:
- `manual` - Manually created in system
- `csv-upload` - Via CSV import
- `resume-upload` - Via resume upload
- `external-api` - Via external API
- `dummy-seed` - For testing/demo data

**Response (HTTP 201)**:
```json
{
  "_id": "69dd5c1f6fb11c3c9e740d01",
  "jobId": "507f191e810c19729de860ea",  // Job's MongoDB ObjectId
  "candidateId": "507f1f77bcf86cd799439011",
  "status": "applied",
  "source": "manual",
  "createdAt": "2026-04-13T21:15:00.000Z",
  "updatedAt": "2026-04-13T21:15:00.000Z"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3000/applications \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "JOB-12345",
    "candidateId": "507f1f77bcf86cd799439011",
    "source": "manual"
  }'
```

---

### 2. Get All Applications for a Job

**GET** `/applications/job/:jobId`

Retrieve all candidates who applied to a specific job (with candidate details).

**Parameters**:
- `:jobId` - Business job ID (string, e.g., "JOB-12345")

**Response (HTTP 200)**:
```json
[
  {
    "_id": "69dd5c1f6fb11c3c9e740d01",
    "jobId": {
      "_id": "507f191e810c19729de860ea",
      "jobId": "JOB-12345",
      "title": "Senior Backend Engineer",
      "department": "Engineering",
      "location": "San Francisco, USA"
    },
    "candidateId": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "skills": ["Node.js", "TypeScript", "PostgreSQL"]
    },
    "status": "applied",
    "source": "manual",
    "createdAt": "2026-04-13T21:15:00.000Z",
    "updatedAt": "2026-04-13T21:15:00.000Z"
  }
]
```

**cURL Example**:
```bash
curl http://localhost:3000/applications/job/JOB-12345
```

---

### 3. Get All Applications for a Candidate

**GET** `/applications/candidate/:candidateId`

Retrieve all jobs a specific candidate has applied to (with job details).

**Parameters**:
- `:candidateId` - Candidate MongoDB ID (ObjectId string)

**Response (HTTP 200)**:
```json
[
  {
    "_id": "69dd5c1f6fb11c3c9e740d01",
    "jobId": {
      "_id": "507f191e810c19729de860ea",
      "jobId": "JOB-12345",
      "title": "Senior Backend Engineer",
      "department": "Engineering",
      "location": "San Francisco, USA"
    },
    "candidateId": "507f1f77bcf86cd799439011",
    "status": "applied",
    "source": "manual",
    "createdAt": "2026-04-13T21:15:00.000Z",
    "updatedAt": "2026-04-13T21:15:00.000Z"
  },
  {
    "_id": "69dd5c1f6fb11c3c9e740d02",
    "jobId": {
      "_id": "507f191e810c19729de860eb",
      "jobId": "JOB-67890",
      "title": "Frontend Engineer",
      "department": "Engineering",
      "location": "Berlin, Germany"
    },
    "candidateId": "507f1f77bcf86cd799439011",
    "status": "shortlisted",
    "source": "csv-upload",
    "createdAt": "2026-04-13T20:00:00.000Z",
    "updatedAt": "2026-04-13T21:30:00.000Z"
  }
]
```

**cURL Example**:
```bash
curl http://localhost:3000/applications/candidate/507f1f77bcf86cd799439011
```

---

## Workflows

### Workflow 1: Single Candidate Applies to Job

```
USER ACTION: Candidate Alice applies to Job "Senior Backend Engineer"

STEPS:
1. GET /jobs or use jobId from email/frontend
2. POST /applications
   {
     "jobId": "JOB-12345",
     "candidateId": "<alice-id>",
     "source": "manual"
   }
3. Application created with status: "applied"
```

### Workflow 2: Bulk Import - Link CSV Candidates to Jobs

```
USER ACTION: Upload CSV with candidate-to-job mappings

STEPS:
1. Parse CSV with columns: [jobId, candidateId, status, source]
2. FOR EACH ROW:
   POST /applications
   {
     "jobId": "JOB-XXXXX",
     "candidateId": "<id>",
     "source": "csv-upload"
   }
3. All applications created with status: "applied"
```

### Workflow 3: View Job Applications (Recruiter)

```
RECRUITER ACTION: Review all applicants for a job

STEPS:
1. Find job jobId (e.g., from listing page)
2. GET /applications/job/JOB-12345
3. Response shows all applicants with:
   - Candidate details (name, email, skills)
   - Application status (applied/screened/shortlisted/rejected)
   - When they applied (createdAt)
   - Source (how they found the job)
4. Use status to filter: shortlisted candidates for interviews
```

### Workflow 4: View Candidate Applications (Candidate Portal)

```
CANDIDATE ACTION: Check which jobs I applied to and their status

STEPS:
1. Login as candidate, get candidateId from session
2. GET /applications/candidate/<candidateId>
3. Response shows all jobs with:
   - Job details (title, company, location)
   - Application status (applied/screened/shortlisted/rejected)
   - When applied and last update
4. Candidate can see: "My applications: 5 total, 2 shortlisted, 1 rejected"
```

---

## Examples

### Example 1: Complete Application Flow

**Step 1: Create a Job**
```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Backend Engineer",
    "department": "Engineering",
    "location": "San Francisco, USA",
    "requirements": {
      "requiredSkills": ["Node.js", "TypeScript", "PostgreSQL"],
      "minYearsExperience": 6
    }
  }'
# Response: { "jobId": "JOB-12345", ... }
```

**Step 2: Create/Get a Candidate**
(Assume we have candidate with _id: "507f1f77bcf86cd799439011")

**Step 3: Create Application**
```bash
curl -X POST http://localhost:3000/applications \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "JOB-12345",
    "candidateId": "507f1f77bcf86cd799439011",
    "source": "manual"
  }'
# Response: Application created with status "applied"
```

**Step 4: View All Applicants for Job**
```bash
curl http://localhost:3000/applications/job/JOB-12345
# Response: Array of all applications for JOB-12345 with candidate details
```

**Step 5: View All Jobs Candidate Applied To**
```bash
curl http://localhost:3000/applications/candidate/507f1f77bcf86cd799439011
# Response: Array of all applications by this candidate with job details
```

---

### Example 2: Bulk Link Candidates to Jobs

**CSV Format** (`applications.csv`):
```csv
jobId,candidateId,source
JOB-12345,507f1f77bcf86cd799439011,csv-upload
JOB-12345,507f1f77bcf86cd799439012,csv-upload
JOB-67890,507f1f77bcf86cd799439012,csv-upload
JOB-67890,507f1f77bcf86cd799439013,csv-upload
```

**Script to Process**:
```bash
# Parse CSV and create applications
while IFS=, read -r jobId candidateId source; do
  curl -X POST http://localhost:3000/applications \
    -H "Content-Type: application/json" \
    -d "{
      \"jobId\": \"$jobId\",
      \"candidateId\": \"$candidateId\",
      \"source\": \"$source\"
    }"
done < applications.csv
```

---

### Example 3: Dashboard Queries

**Query: Get all jobs a candidate applied to with rejection status**
```bash
curl http://localhost:3000/applications/candidate/507f1f77bcf86cd799439011 \
  | jq '.[] | select(.status == "rejected") | .jobId'
```

**Query: Get shortlisted candidates for a job**
```bash
curl http://localhost:3000/applications/job/JOB-12345 \
  | jq '.[] | select(.status == "shortlisted")'
```

**Query: Count applications per job**
```bash
curl http://localhost:3000/applications/job/JOB-12345 \
  | jq 'length'
```

---

## Best Practices

### 1. **Always Have Both Candidate and Job**
```
❌ DON'T: Create application without verifying job exists
✅ DO: First verify job exists, then create application
```

```bash
# Good Flow
JOB_ID=$(curl http://localhost:3000/jobs | jq '.[] | select(.title == "Backend Engineer") | .jobId')
curl -X POST http://localhost:3000/applications \
  -H "Content-Type: application/json" \
  -d "{\"jobId\": \"$JOB_ID\", \"candidateId\": \"...\"}"
```

### 2. **Use Proper Source Tracking**
```json
{
  "source": "csv-upload"      // ✅ Track where applications came from
}
```

Benefits:
- Know which applications came from which channel
- Identify high-quality sources (e.g., "resume-upload" vs "dummy-seed")
- Analytics: "60% from CSV, 40% from manual")

### 3. **Prevent Duplicate Applications**
The system prevents duplicates with unique index on `(jobId, candidateId)`.

```bash
# First application - SUCCESS
curl -X POST http://localhost:3000/applications \
  -d '{"jobId": "JOB-123", "candidateId": "CAND-456"}'
# Response: Created ✅

# Duplicate attempt - UPSERT (updates existing)
curl -X POST http://localhost:3000/applications \
  -d '{"jobId": "JOB-123", "candidateId": "CAND-456"}'
# Response: Updated existing application ✅ (no error)
```

### 4. **Organize Applications by Status**

```typescript
// In your frontend/dashboard
const applications = getApplicationsByJob(jobId);
const byStatus = {
  applied: applications.filter(a => a.status === 'applied'),
  screened: applications.filter(a => a.status === 'screened'),
  shortlisted: applications.filter(a => a.status === 'shortlisted'),
  rejected: applications.filter(a => a.status === 'rejected'),
};

// Display pipeline
console.log(`Funnel for Job: ${jobId}`);
console.log(`Applied: ${byStatus.applied.length}`);
console.log(`Screened: ${byStatus.screened.length}`);
console.log(`Shortlisted: ${byStatus.shortlisted.length}`);
console.log(`Rejected: ${byStatus.rejected.length}`);
```

### 5. **Avoid Status Regressions**

```typescript
// ❌ DON'T: Reject then shortlist
applied → rejected → shortlisted❌

// ✅ DO: Follow natural progression
applied → screened → shortlisted
or
applied → screened → rejected
```

### 6. **Batch Operations**

For bulk imports:
```bash
# Instead of 1000 individual requests
for candidateId in list; do
  curl POST http://localhost:3000/applications ...
done

# Better: Create endpoint for batch (future enhancement)
# POST /applications/batch
# [{"jobId": "...", "candidateId": "..."}, ...]
```

---

## Migration: Existing Candidates → Job Applications

If you already have candidates in the system but they're not linked to jobs:

```bash
#!/bin/bash
# Script to link all candidates to a job (for testing)

JOB_ID="JOB-12345"

# Get all candidate IDs
CANDIDATES=$(curl http://localhost:3000/candidates | jq -r '.[] | ._id')

# Link each to the job
for CAND_ID in $CANDIDATES; do
  curl -X POST http://localhost:3000/applications \
    -H "Content-Type: application/json" \
    -d "{
      \"jobId\": \"$JOB_ID\",
      \"candidateId\": \"$CAND_ID\",
      \"source\": \"csv-upload\"
    }"
done

echo "Added all candidates to job $JOB_ID"
```

---

## Architecture Summary

| Component | Purpose | Endpoint |
|---|---|---|
| **Job** | Job posting with requirements | `POST /jobs`, `GET /jobs/:jobId` |
| **Candidate** | Applicant profile with skills | `POST /candidates`, `GET /candidates/:id` |
| **JobApplication** | Link candidate to job + track status | `POST /applications`, `GET /applications/job/:jobId`, `GET /applications/candidate/:id` |

**Many-to-Many Logic**:
- One candidate applies to many jobs ← JobApplication
- One job has many applicants ← JobApplication
- Single connection per candidate-job pair (unique constraint)

**Status Tracking**:
- `applied` → Initial state when candidate applies
- `screened` → Recruiter reviewed and passed screening
- `shortlisted` → Strong candidate, move to interview stage
- `rejected` → Doesn't meet requirements

This architecture ensures:
✅ Candidates aren't "floating" without job context
✅ Easy filtering (all applicants for a job, all jobs for a candidate)
✅ Status tracking for recruitment pipeline
✅ Source tracking for analytics
✅ No duplicate applications (unique constraint)

---

## Next Steps

1. **Test the flow**: Create a job, create candidate, link them via `/applications`
2. **Check applications**: Use `/applications/job/:jobId` to see all applicants
3. **Track status**: Monitor how many are at each pipeline stage
4. **Scale up**: Use bulk import scripts for CSV/batch candidate linking

Now your candidates are properly connected to jobs! 🎯
