# Manual Upload Page: Frontend/Backend Data Contract

This document explains what the manual upload frontend page is trying to fetch, which backend endpoints currently expose that data, and where the current gaps are.

It is based on the current backend code in:

- `src/jobs/jobs.controller.ts`
- `src/jobs/jobs.service.ts`
- `src/candidates/candidates.controller.ts`
- `src/candidates/candidates.service.ts`
- `src/applications/applications.controller.ts`
- `src/applications/applications.service.ts`

## 1. Main Finding

The manual upload page mixes two kinds of data:

1. Data that is already exposed by backend APIs
2. Data that is not exposed by backend APIs and is currently computed only in browser `localStorage`

Because of that:

- Job dropdowns can be populated from backend
- Candidate dropdowns can be populated from backend
- Upload history and upload statistics are **not** coming from backend
- "No Upload History" and all counters being `0` are caused by empty `localStorage`, not by missing records in MongoDB

## 2. What The Frontend Page Fetches

From the provided frontend page:

### Backend API calls

- `GET /jobs`
- `GET /candidates`
- upload actions via:
  - `POST /candidates/upload/json`
  - `POST /candidates/upload/spreadsheet`
  - `POST /candidates/upload/resume`
  - `POST /candidates/:id/reparse`
  - `POST /jobs/upload/json`
  - `POST /jobs/upload/spreadsheet`

### Browser-only local data

The page also reads:

- `localStorage.getItem('uploadHistory')`

It uses that local value to compute:

- total uploads
- successful uploads
- failed uploads
- total candidates added
- total jobs added
- success rate
- uploads over time
- uploads by type

There is no backend request for:

- upload history
- upload statistics
- audit trail of uploads

## 3. Endpoint Contract For This Page

## 3.1 `GET /jobs`

### Purpose

Populate the "Link to Job" dropdown on candidate upload cards.

### Backend status

Implemented.

### Controller

- `src/jobs/jobs.controller.ts`

### Service behavior

- Returns all jobs sorted by `createdAt` descending.

### Current response shape

Each item is a job document containing at least:

```json
{
  "_id": "mongodb-object-id",
  "jobId": "JOB-ABC12345",
  "title": "Software Engineer",
  "department": "Engineering",
  "location": "Remote",
  "description": "Job description",
  "requiredSkills": ["React", "Node.js"],
  "preferredSkills": [],
  "minYearsExperience": 3,
  "isOpen": true,
  "role": {
    "title": "Software Engineer",
    "responsibilities": [],
    "education": []
  },
  "requirements": {
    "requiredSkills": ["React", "Node.js"],
    "preferredSkills": [],
    "minYearsExperience": 3
  },
  "experience": {
    "years": [],
    "level": []
  },
  "skills": {
    "core": [],
    "niceToHave": []
  },
  "createdAt": "2026-04-22T10:00:00.000Z",
  "updatedAt": "2026-04-22T10:00:00.000Z"
}
```

### Frontend fields actually used

- `_id`
- `jobId`
- `title`
- `department`
- `location`

### Conclusion

This endpoint is sufficient for the current job dropdown.

## 3.2 `GET /candidates`

### Purpose

Populate the candidate dropdown for the "Reparse Candidate" card.

### Backend status

Implemented.

### Controller

- `src/candidates/candidates.controller.ts`

### Service behavior

- Returns all candidate documents sorted by `createdAt` descending.

### Current response shape

Each item is a candidate document containing at least:

```json
{
  "_id": "mongodb-object-id",
  "externalCandidateId": "EXT-001",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "headline": "Frontend Engineer",
  "bio": null,
  "location": "Kigali",
  "skills": [],
  "languages": [],
  "experience": [],
  "education": [],
  "certifications": [],
  "projects": [],
  "availability": {
    "status": "Open to Opportunities",
    "type": "Full-time",
    "startDate": null
  },
  "socialLinks": {
    "linkedin": null,
    "github": null,
    "portfolio": null
  },
  "source": "manual",
  "createdAt": "2026-04-22T10:00:00.000Z",
  "updatedAt": "2026-04-22T10:00:00.000Z"
}
```

### Frontend fields actually used

- `_id`
- `firstName`
- `lastName`
- `email`

### Conclusion

This endpoint is sufficient for the current reparse dropdown.

## 3.3 `POST /candidates/upload/json`

### Purpose

Upload candidate JSON and optionally link uploaded candidates to one or more jobs.

### Backend status

Implemented.

### Accepted input

Multipart form-data:

- `file`: JSON file
- `jobId`: optional external job ID

Also supported inside JSON payload/file:

- `candidates`
- `talentProfiles`
- per-candidate `jobId`
- per-candidate `appliedJobIds`

### Important backend behavior

Candidate-to-job links are not stored on the `candidate` document.

They are stored in the `job_applications` relationship collection via:

- `ApplicationsService.linkCandidateToJobByExternalId(...)`

### Response

Returns created/updated candidate documents.

### Conclusion

Upload logic exists. Job linkage also exists. But linked jobs will not appear on plain `GET /candidates`.

## 3.4 `POST /candidates/upload/spreadsheet`

### Purpose

Upload CSV/XLS/XLSX candidate files and optionally link created candidates to a job.

### Backend status

Implemented.

### Accepted input

Multipart form-data:

- `file`
- `jobId`: optional external job ID

### Response

Returns created/updated candidate documents.

### Conclusion

Implemented and working as an ingestion endpoint.

## 3.5 `POST /candidates/upload/resume`

### Purpose

Upload a resume, parse it, create/update the candidate, and optionally link the candidate to a job.

### Backend status

Implemented.

### Accepted input

Multipart form-data:

- `file`
- `jobId`: optional external job ID

### Response shape

```json
{
  "candidate": {
    "_id": "mongodb-object-id",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com"
  },
  "parsedProfile": {
    "_id": "mongodb-object-id",
    "candidateId": "mongodb-object-id"
  }
}
```

### Important note

The frontend currently advertises `.pdf`, `.doc`, `.docx`.

The backend route currently uses `parseResumePdf(...)`, which strongly suggests this route is PDF-focused. If DOC/DOCX support is expected, that expectation should be verified and probably tightened.

## 3.6 `POST /candidates/:id/reparse`

### Purpose

Upload a new file for an existing candidate and regenerate parsed profile data.

### Backend status

Implemented.

### Accepted input

Multipart form-data:

- `file`

### Response shape

```json
{
  "success": true,
  "parsedProfile": {
    "_id": "mongodb-object-id",
    "candidateId": "mongodb-object-id"
  }
}
```

### Conclusion

Implemented and matches the frontend usage.

## 3.7 `POST /jobs/upload/json`

### Purpose

Upload jobs from JSON.

### Backend status

Implemented.

### Accepted input

Multipart form-data:

- `file`

Supported JSON roots:

- `{ "jobs": [...] }`
- `{ "jobProfiles": [...] }`
- root array

### Response

Returns created job documents.

## 3.8 `POST /jobs/upload/spreadsheet`

### Purpose

Upload jobs from CSV/XLS/XLSX.

### Backend status

Implemented.

### Accepted input

Multipart form-data:

- `file`

### Response

Returns created job documents.

## 4. Data The Frontend Is Expecting But The Backend Does Not Expose

The current manual upload page visually expects:

- upload history list
- total upload count
- success/failure totals
- candidates added total
- jobs added total
- success rate
- uploads over time
- uploads by type

### Current reality

These values are **not** exposed by any backend endpoint.

They are currently generated only from browser `localStorage`.

### Evidence from frontend logic

The page:

- reads `localStorage.uploadHistory`
- calculates stats from that local array
- never calls a backend route for upload history or upload statistics

### Result

If a user opens the page on:

- a new browser
- a cleared browser storage
- another machine
- another user session

the page will show:

- `No Upload History`
- all counters as `0`

even if the database already contains many jobs and candidates.

## 5. Candidate/Job Relationship Data

This is the most important place where confusion can happen.

## 5.1 How relationships are stored

Candidate-job applications are stored in a separate collection:

- `JobApplication`

This contains:

```json
{
  "_id": "mongodb-object-id",
  "jobId": "Job Mongo ObjectId",
  "candidateId": "Candidate Mongo ObjectId",
  "status": "applied",
  "source": "manual",
  "createdAt": "2026-04-22T10:00:00.000Z",
  "updatedAt": "2026-04-22T10:00:00.000Z"
}
```

## 5.2 What plain `GET /candidates` does not include

Plain `GET /candidates` does not include:

- `jobId`
- `appliedJobIds`
- `applications`
- populated job records

This is by design in the current backend.

## 5.3 Endpoints that expose linked job data

Use these when the frontend needs candidate/job relationship data:

### `GET /candidates/with-jobs`

Returns:

```json
[
  {
    "candidate": {
      "_id": "candidate-id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "appliedJobIds": ["JOB-001", "JOB-002"],
    "applications": [
      {
        "applicationId": "application-id",
        "jobId": "JOB-001",
        "mongoJobId": "job-mongo-id",
        "title": "Backend Engineer",
        "status": "applied",
        "source": "csv-upload"
      }
    ]
  }
]
```

### `GET /candidates/:id/with-jobs`

Returns one candidate with:

- `candidate`
- `appliedJobIds`
- `applications`

### `GET /applications/job/:jobId`

Returns all applications for one business job ID, with populated candidate details.

### `GET /applications/candidate/:candidateId`

Returns all applications for one candidate, with populated job details.

## 6. What Exists vs What Is Missing

## 6.1 Already available in backend

- job list for dropdowns
- candidate list for dropdowns
- JSON candidate upload
- spreadsheet candidate upload
- resume upload
- candidate reparse
- JSON job upload
- spreadsheet job upload
- candidate/job relationship persistence
- candidate/job relationship read endpoints

## 6.2 Not available in backend

- persisted upload history API
- persisted upload statistics API
- audit log of file uploads
- server-side "uploads over time" aggregation
- server-side "uploads by type" aggregation

## 7. Clear Instructions For Frontend Team

## 7.1 If the UI needs job dropdown options

Call:

- `GET /jobs`

Use:

- `_id`
- `jobId`
- `title`
- `department`
- `location`

## 7.2 If the UI needs candidate dropdown options

Call:

- `GET /candidates`

Use:

- `_id`
- `firstName`
- `lastName`
- `email`

## 7.3 If the UI needs to show which jobs a candidate is linked to

Do not rely on:

- `GET /candidates`

Instead call one of:

- `GET /candidates/with-jobs`
- `GET /candidates/:id/with-jobs`
- `GET /applications/candidate/:candidateId`

## 7.4 If the UI needs to show which candidates applied to a job

Call:

- `GET /applications/job/:jobId`

## 7.5 If the UI needs upload history and system-wide stats

These do not currently exist in backend.

The frontend has two choices:

1. Keep using browser `localStorage`
2. Ask backend to add persistent APIs

## 8. Recommended Backend APIs To Add If You Want Real Upload History

If the manual upload page should show shared, persistent history, add a new upload log resource.

Recommended endpoints:

### `GET /upload-history`

Return:

```json
[
  {
    "id": "upload-log-id",
    "type": "candidates-json",
    "fileName": "candidates.json",
    "fileSize": 20480,
    "status": "success",
    "count": 24,
    "jobId": "JOB-001",
    "candidateId": null,
    "message": "Successfully uploaded 24 candidates",
    "createdAt": "2026-04-22T10:00:00.000Z"
  }
]
```

### `GET /upload-stats`

Return:

```json
{
  "totalUploads": 42,
  "successfulUploads": 36,
  "failedUploads": 6,
  "totalCandidatesAdded": 120,
  "totalJobsAdded": 18,
  "uploadsByType": {
    "candidates-json": 12,
    "candidates-spreadsheet": 7,
    "candidates-resume": 10,
    "jobs-json": 5,
    "jobs-spreadsheet": 6,
    "reparse": 2
  },
  "uploadsOverTime": [
    { "date": "2026-04-16", "count": 4 },
    { "date": "2026-04-17", "count": 8 }
  ]
}
```

## 9. Final Conclusion

For the manual upload page:

- `GET /jobs` and `GET /candidates` are already exposed correctly for dropdowns
- upload endpoints are already exposed correctly for ingestion
- candidate/job links are exposed, but through relationship endpoints, not plain `GET /candidates`
- upload history and dashboard stats are not exposed by backend at all

So the exact gap is:

- relationship data: backend exists, frontend must use the correct endpoints
- upload history/stats: backend does not exist yet, frontend currently uses local-only storage
