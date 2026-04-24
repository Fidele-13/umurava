# Umurava HR AI Backend

NestJS + MongoDB backend for job ingestion, candidate ingestion/parsing, application linking, AI ranking/chat, upload history analytics, and demo seeding.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Run Locally](#run-locally)
- [Environment Variables](#environment-variables)
- [Global API Behavior](#global-api-behavior)
- [Data Models (High Level)](#data-models-high-level)
- [API Endpoints](#api-endpoints)
  - [Health](#health)
  - [Jobs](#jobs)
  - [Candidates](#candidates)
  - [Resume/Document Parsing](#resumedocument-parsing)
  - [Applications](#applications)
  - [AI](#ai)
  - [Upload Logs](#upload-logs)
  - [Seed](#seed)
- [Multipart Upload Guide (Jobs + Applicants)](#multipart-upload-guide-jobs--applicants)
- [Common Error Responses](#common-error-responses)

## Tech Stack

- NestJS 11
- MongoDB + Mongoose
- Class Validator / Class Transformer
- Gemini integration (`@google/generative-ai`) with fallback logic when API key is missing

## Run Locally

```bash
npm install
npm run start:dev
```

Default URL: `http://localhost:3000`

## Environment Variables

| Variable          | Required | Default                                   | Notes                                                                             |
| ----------------- | -------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| `MONGO_URI`       | No       | `mongodb://127.0.0.1:27017/umurava-hr-ai` | MongoDB connection string                                                         |
| `PORT`            | No       | `3000`                                    | Server port                                                                       |
| `ALLOWED_ORIGINS` | No       | `[]`                                      | Comma-separated list for CORS, e.g. `http://localhost:5173,http://localhost:3001` |
| `GEMINI_API_KEY`  | No       | none                                      | Enables Gemini for parsing/ranking/chat; without it, fallback logic is used       |

## Global API Behavior

- Validation pipe is global with:
  - `whitelist: true`
  - `transform: true`
  - `forbidNonWhitelisted: true`
- This means DTO-based endpoints reject unknown fields and invalid types.
- Upload endpoints that accept `Record<string, unknown>` are more flexible and perform custom validation in controller/service logic.

## Data Models (High Level)

### Job

- `jobId` (unique external ID)
- `title`, `department`, `location`, `description`
- structured sections: `role`, `requirements`, `experience`, `skills`
- flattened matching fields: `requiredSkills`, `preferredSkills`, `minYearsExperience`, `isOpen`

### Candidate

- identity: `externalCandidateId?`, `firstName`, `lastName`, `email`
- profile: `headline`, `bio`, `location`, `skills`, `languages`, `experience`, `education`, `certifications`, `projects`, `availability`, `socialLinks`
- source tracking: `source` (`manual` | `resume-pdf` | `csv` | `xlsx` | `external-api`)

### JobApplication

- `jobId` (Mongo reference), `candidateId` (Mongo reference)
- `status`: `applied | screened | shortlisted | rejected`
- `source`: `manual | dummy-seed | external-api | csv-upload | resume-upload`
- unique index on `(jobId, candidateId)`

### Parsed/Source Candidate Profiles

- `CandidateSourceProfile`: stores original schema payload + normalized payload
- `CandidateParsedProfile`: stores parsed resume data + merged profile + `confidenceScore`

### AI Screening Result

- linked to job
- ranked candidates with score/explanation/strengths/concerns/decision/confidence

---

## API Endpoints

## Health

### `GET /`

Simple health text.

**Response**

```json
"Hello World!"
```

## Jobs

### `POST /jobs`

Create one job.

**Content-Type**: `application/json`

**Required fields**

- `title` (string)

**Optional fields**

- `jobId`, `department`, `location`, `description`, `role`, `requirements`, `experience`, `skills`, `requiredSkills`, `preferredSkills`, `minYearsExperience`, `isOpen`

**Response**

- Created job document (Mongo object with `_id`, timestamps, normalized defaults)

---

### `POST /jobs/upload/json`

Bulk create jobs from JSON body OR JSON file via multipart.

**Content-Types**

- `application/json`
- `multipart/form-data` (use file field `file` or `files`; controller accepts any file field)

**Accepted body/file structures**

- `{ "jobs": [...] }`
- `{ "jobProfiles": [...] }`
- `{ "items": [...] }`
- top-level JSON array (`[...]`) also supported
- NDJSON (one JSON object per line) is also supported
- JSON with BOM/comments/trailing commas is attempted with relaxed parsing

**Response**

- Array of created job documents

**Upload log side effect**

- Creates `jobs-json` upload log (`success` or `failed`)

---

### `POST /jobs/upload/spreadsheet`

Bulk create jobs from CSV/XLS/XLSX file.

**Content-Type**: `multipart/form-data`

**Required form-data**

- `file`: CSV or Excel file

**File detection rules**

- CSV if `mimetype === text/csv` OR filename ends with `.csv`
- Excel if OpenXML mimetype OR filename ends with `.xlsx` or `.xls`
- Otherwise returns `400` with `Only CSV/XLS/XLSX files are supported`

**Response**

- Array of created job documents

**Upload log side effect**

- Creates `jobs-spreadsheet` upload log

---

### `GET /jobs`

Returns all jobs sorted by newest first.

### `GET /jobs/:jobId`

Find by external `jobId` (not Mongo `_id`).

- `404` if not found

### `PATCH /jobs/:jobId`

Partial update by external `jobId`.

- Body uses `UpdateJobDto` (all fields optional)
- `404` if not found

### `DELETE /jobs/:jobId`

Delete by external `jobId`.

**Response**

```json
{
  "success": true,
  "deletedJobId": "JOB-..."
}
```

---

## Candidates

### `POST /candidates`

Create or upsert one candidate from JSON profile.

**Content-Type**: `application/json`

**Required fields (DTO)**

- `firstName`, `lastName`, `email`, `headline`, `location`
- `skills` (array), `experience` (array), `education` (array), `projects` (array)
- `availability` (object)

**Optional fields**

- `externalCandidateId`, `bio`, `languages`, `certifications`, `socialLinks`
- `jobId` and/or `appliedJobIds` to auto-link candidate to jobs by external job IDs

**Response**

- Candidate document (created or updated by identity rules)

---

### `POST /candidates/upload/json`

Bulk create/upsert candidates from JSON body or multipart JSON file.

**Content-Types**

- `application/json`
- `multipart/form-data`

**Form-data fields**

- `file`: JSON file (optional if sending JSON in body)
- `jobId`: optional default external job ID for all candidates in this upload

**Accepted payload keys**

- `candidates[]` or `talentProfiles[]`

**Parser tolerance for JSON file**

- UTF-8/UTF-16LE/latin1/ascii decoding attempts
- BOM stripping
- supports standard JSON object/array
- supports JSON with comments and trailing commas
- supports NDJSON

**Response**

- Array of candidate documents

**Upload log side effect**

- Creates `candidates-json` upload log

---

### `POST /candidates/upload/spreadsheet`

Bulk create/upsert candidates from CSV/XLS/XLSX.

**Content-Type**: `multipart/form-data`

**Required form-data**

- `file`: CSV/XLS/XLSX

**Optional form-data**

- `jobId`: external job ID; if present, uploaded candidates are linked to that job

**Response**

- Array of candidate documents

**Upload log side effect**

- Creates `candidates-spreadsheet` upload log

---

### `POST /candidates/upload/resume`

Parse one resume and create/upsert candidate + parsed profile.

**Content-Type**: `multipart/form-data`

**Required form-data**

- `file`: resume file (controller expects a single `file`)

**Optional form-data**

- `jobId`: external job ID to auto-link as application source `resume-upload`

**Important behavior**

- Internally this route uses PDF parsing path (`parseResumePdf`), so use PDF files for reliable results.
- Candidate must resolve to a valid email after parsing; otherwise `400`.

**Response**

```json
{
  "candidate": { "...": "candidate doc" },
  "parsedProfile": { "...": "parsed/merged profile doc" }
}
```

**Upload log side effect**

- Creates `candidates-resume` upload log

---

### `POST /candidates/:id/reparse`

Re-parse an uploaded document for an existing candidate.

**Content-Type**: `multipart/form-data`

**Required form-data**

- `file`

**Response**

```json
{
  "success": true,
  "parsedProfile": { "...": "parsed profile doc" }
}
```

**Upload log side effect**

- Creates `reparse` upload log

---

### `POST /candidates/:id/recompute`

Recomputes merged parsed profile/confidence from current candidate + parsed data.

**Response**

- Parsed profile document

---

### `GET /candidates`

All candidates (newest first).

### `GET /candidates/with-jobs`

All candidates with linked applications and flattened applied job IDs.

### `GET /candidates/:id`

Candidate with related source profile + parsed profile.

**Response shape**

```json
{
  "candidate": { "...": "candidate doc" },
  "sourceProfile": { "...": "source profile doc or null" },
  "parsedProfile": { "...": "parsed profile doc or null" }
}
```

### `GET /candidates/:id/with-jobs`

Single candidate + linked applications/jobs.

### `PATCH /candidates/:id`

Partial update candidate.

### `DELETE /candidates/:id`

Delete candidate + related parsed/source profile docs.

**Response**

```json
{
  "success": true,
  "deletedId": "<candidate-id>"
}
```

---

## Resume/Document Parsing

These routes parse files without directly creating application links.

### `POST /parse/resume`

Parse one file and return normalized talent profile.

**Content-Type**: `multipart/form-data`

**Required form-data**

- `file`

**Supported file types**

- PDF
- DOC/DOCX
- TXT
- CSV
- XLS/XLSX

**Response**

```json
{
  "success": true,
  "data": { "...": "TalentProfile" }
}
```

### `POST /parse/batch`

Parse multiple files.

**Content-Type**: `multipart/form-data`

**Required form-data**

- `files`: multiple file parts

**Response**

```json
{
  "success": true,
  "count": 2,
  "data": [{ "...": "TalentProfile" }]
}
```

---

## Applications

### `POST /applications`

Create/upsert link between candidate and job (external job ID).

**Content-Type**: `application/json`

**Required fields**

- `jobId`: external job ID (e.g. `JOB-BE-001`)
- `candidateId`: Mongo candidate `_id`

**Optional**

- `source`: one of `manual`, `dummy-seed`, `external-api`, `csv-upload`, `resume-upload`

**Response**

- JobApplication document (`status` defaults to `applied`)

### `GET /applications/job/:jobId`

Get all applications for external job ID.

- `404` if job not found
- populates `candidateId`

### `GET /applications/candidate/:candidateId`

Get all applications for candidate Mongo ID.

- populates `jobId`

---

## AI

### `POST /ai/rank`

Rank candidates for a job.

**Content-Type**: `application/json`

**Required fields**

- `jobId` (external job ID)

**Optional fields**

- `topN` (integer, min 1, default 5)
- `customPrompt` (string)
- `candidateIds` (array of candidate Mongo IDs) to limit ranking scope

**Behavior**

- if `candidateIds` not provided, uses candidates applied to job
- if no applications found, falls back to all candidates
- uses Gemini when `GEMINI_API_KEY` exists, otherwise fallback ranking

**Response**

- saved `ScreeningResult` document with populated `jobId` and `rankedCandidates.candidateId`

### `POST /ai/chat`

HR assistant chat with optional job-aware context.

**Content-Type**: `application/json`

**Required fields**

- `prompt`

**Optional fields**

- `sessionId` (continue an existing thread)
- `jobId` (external `jobId` or Mongo job `_id`)

**Response**

```json
{
  "sessionId": "...",
  "answer": "...",
  "messages": [{ "role": "hr|assistant", "content": "...", "createdAt": "..." }]
}
```

### `GET /ai/chat/:sessionId`

Get full chat session history.

- `404` if session not found

### `GET /ai/screenings`

List all saved screening results (newest first), populated.

---

## Upload Logs

### `GET /upload-history`

List upload events with normalized fields.

**Response item fields**

- `id`, `type`, `fileName`, `fileSize`, `status`, `count`, `jobId`, `candidateId`, `message`, `createdAt`, `updatedAt`

### `GET /upload-stats`

Aggregated upload metrics.

**Response**

```json
{
  "totalUploads": 0,
  "successfulUploads": 0,
  "failedUploads": 0,
  "totalCandidatesAdded": 0,
  "totalJobsAdded": 0,
  "uploadsByType": {},
  "uploadsOverTime": [{ "date": "YYYY-MM-DD", "count": 0 }]
}
```

---

## Seed

### `POST /seed/demo`

Clears/recreates demo jobs/candidates/applications.

**Response**

```json
{
  "insertedJobs": 2,
  "insertedCandidates": 4,
  "jobIds": ["JOB-BE-001", "JOB-AI-002"],
  "candidateEmails": ["..."]
}
```

---

## Multipart Upload Guide (Jobs + Applicants)

This section focuses on the upload workflows you requested (JSON, CSV, XLS/XLSX via multipart form-data), for **jobs** and **applicants/candidates**.

### 1) Jobs JSON upload (`POST /jobs/upload/json`)

```bash
curl -X POST http://localhost:3000/jobs/upload/json \
	-F "file=@./jobs.json;type=application/json"
```

Accepted JSON file examples:

```json
{ "jobs": [{ "title": "Backend Engineer", "department": "Engineering" }] }
```

or

```json
[{ "title": "Backend Engineer" }, { "title": "AI Engineer" }]
```

**Response**: array of created job documents.

---

### 2) Jobs spreadsheet upload (`POST /jobs/upload/spreadsheet`)

```bash
curl -X POST http://localhost:3000/jobs/upload/spreadsheet \
	-F "file=@./jobs.xlsx"
```

Also supports `.csv` and `.xls`.

**Response**: array of created job documents.

---

### 3) Applicants JSON upload (`POST /candidates/upload/json`)

```bash
curl -X POST http://localhost:3000/candidates/upload/json \
	-F "file=@./candidates.json;type=application/json" \
	-F "jobId=JOB-BE-001"
```

Accepted JSON keys:

- `candidates`
- `talentProfiles`

Supports arrays/NDJSON/relaxed JSON parsing.

**Response**: array of created/upserted candidate documents.

---

### 4) Applicants spreadsheet upload (`POST /candidates/upload/spreadsheet`)

```bash
curl -X POST http://localhost:3000/candidates/upload/spreadsheet \
	-F "file=@./candidates.csv" \
	-F "jobId=JOB-BE-001"
```

Also supports `.xls` and `.xlsx`.

**Response**: array of created/upserted candidate documents.

---

### 5) Applicant resume upload (`POST /candidates/upload/resume`)

```bash
curl -X POST http://localhost:3000/candidates/upload/resume \
	-F "file=@./resume.pdf" \
	-F "jobId=JOB-BE-001"
```

**Response**:

- `candidate`: created/upserted candidate document
- `parsedProfile`: parsed/merged profile document

---

## Common Error Responses

Typical status codes:

- `400 Bad Request`
  - missing required file (`File is required`)
  - invalid upload type (`Only CSV/XLS/XLSX files are supported`)
  - malformed JSON payload/file
  - parser cannot extract text
- `404 Not Found`
  - missing job/candidate/chat session by identifier
- `409 Conflict`
  - candidate uniqueness conflict (e.g. duplicate email in some flows)

Validation error example (DTO endpoints):

```json
{
  "statusCode": 400,
  "message": ["title must be a string"],
  "error": "Bad Request"
}
```

---

## Notes

- External job operations use `jobId` (e.g. `JOB-BE-001`) rather than Mongo `_id` unless explicitly stated.
- Candidate link endpoints use Mongo candidate `_id`.
- AI endpoints continue to function without Gemini key using fallback behavior.
- Upload endpoints create upload-log records even when upload processing fails (best-effort logging).

---

## Advanced AI System Reference

This section explains the AI endpoints in production detail: what they require, what they return, how fallback works, how chat is stored, and what can fail.

### AI Capability Snapshot (Current State)

The backend currently supports:

1. **AI candidate ranking** by job
2. **HR chat assistant** with optional job + applicants context
3. **Screening result persistence** in MongoDB
4. **Chat session persistence** in MongoDB
5. **Dynamic model failover attempts** (ranking/chat and parser each have model fallback lists)

The backend currently does **not** expose one single endpoint that automatically returns a full “job + applicants + AI prediction packet” in one call. That capability is feasible and documented below as a recommended integration extension.

---

### AI Endpoint Deep Dive

#### 1) `POST /ai/rank` — Candidate Ranking Pipeline

**Goal**

- Rank candidates for a target job and persist a screening result.

**Request**

```json
{
  "jobId": "JOB-BE-001",
  "topN": 5,
  "customPrompt": "Prioritize strong NestJS backend candidates with production API experience.",
  "candidateIds": ["680a...", "680b..."]
}
```

**Required**

- `jobId` (external job ID string)

**Optional**

- `topN` (integer >= 1; default = `5`)
- `customPrompt` (string)
- `candidateIds` (array of Mongo candidate IDs)

**Internal selection logic**

1. Find job by external `jobId`.
2. If `candidateIds` provided, use those candidates.
3. Else, use candidates linked through applications for that job.
4. If no linked candidates exist, fallback to all candidates.
5. Load parsed profile records for selected candidates.
6. Build candidate context (`schemaData`, `parsedData`, `mergedProfile`, `confidenceScore`).
7. Call AI ranking service (Gemini if available, local fallback otherwise).
8. Persist `ScreeningResult`.

**Output shape (stored + returned)**

- `jobId` (Mongo reference, populated on read)
- `jobExternalId`
- `topN`
- `customPrompt`
- `rankedCandidates[]` with:
  - `candidateId` (Mongo reference)
  - `rank`
  - `score` (`0..100`)
  - `explanation`
  - `strengths[]`
  - `concerns[]`
  - `scores` (skill/experience/education/project/overall)
  - `decision` (`Selected | Consider | Reject`)
  - `weaknesses[]`
  - `missingRequirements[]`
  - `confidence` (`0..1`)
- `usedGemini`
- `rawModelOutput`

**Possible errors**

- `404`: `Job <jobId> not found`
- `400`: invalid payload type/shape (validation)
- `500`: unexpected data/model failure

---

#### 2) `POST /ai/chat` — Job-Aware HR Assistant

**Goal**

- Answer HR prompts and persist conversation history.

**Request**

```json
{
  "prompt": "Who is the best applicant for this job and why?",
  "sessionId": "optional-existing-session",
  "jobId": "JOB-BE-001"
}
```

**Required**

- `prompt`

**Optional**

- `sessionId` (continue existing thread)
- `jobId` (external job ID or Mongo ObjectId)

**Context construction logic**

If `jobId` is provided:

1. Try to resolve as external job ID.
2. If not found and value looks like ObjectId, resolve as Mongo `_id`.
3. Load applications for that job.
4. Load candidates and parsed profiles for those applications.
5. Build `APPLICANTS_CONTEXT` with status/source + profile data.
6. Inject context into model prompt.

If `jobId` is not provided:

- Chat works as generic assistant conversation.

**Persistence behavior**

1. Save HR message first (`role: hr`).
2. Generate AI response.
3. Save assistant message (`role: assistant`).
4. Return session and full message list.

**Response**

```json
{
  "sessionId": "generated-or-existing",
  "answer": "AI response text",
  "messages": [
    { "role": "hr", "content": "...", "createdAt": "..." },
    { "role": "assistant", "content": "...", "createdAt": "..." }
  ]
}
```

**Possible errors**

- `400`: invalid request payload
- `500`: model/network/unexpected system error

---

#### 3) `GET /ai/chat/:sessionId` — Retrieve Chat History

**Goal**

- Fetch stored conversation thread.

**Response**

- Full `ChatSession` document with all messages and metadata.

**Possible errors**

- `404`: `Chat session not found`

---

#### 4) `GET /ai/screenings` — Retrieve Past Screening Runs

**Goal**

- List all screening results, newest first, with populated references.

**Response**

- Array of screening documents.

**Possible errors**

- Usually `200` with empty array when no screenings exist.

---

### Dynamic AI Model Failover Behavior

The project uses **model fallback chains** when calling Gemini.

#### A) Ranking/Chat Model Chain

Ranking/chat service attempts these models in sequence:

1. `gemini-2.5-flash`
2. `gemini-2.5-flash-lite`
3. `gemini-2.5-pro`
4. `gemini-flash-latest`
5. `gemini-pro-latest`

If a model fails due to unavailable model/network/transient reasons, the next model is tried.

If all fail:

- Ranking uses deterministic fallback scoring.
- Chat returns a fallback assistant response.

#### B) Resume Parser Model Chain

Document parser attempts:

1. `gemini-1.5-flash`
2. `gemini-1.5-flash-001`
3. `gemini-1.5-flash-lite`

If all fail or no key is configured, deterministic parsing is used and cached.

#### C) Why this matters for clients

- Higher reliability under vendor outages/model deprecation
- Graceful degradation instead of total feature outage
- Predictable response contract even when model quality varies

---

### AI Output Reliability Notes

When Gemini returns structured output:

- Service validates/parses JSON and normalizes fields.
- Candidate identity is enforced by `candidateId` in ranking output.
- Scores are clamped/normalized where needed.

When Gemini output is malformed:

- Ranking parser falls back to local scoring heuristics.
- Chat returns fallback textual output if model path fails.

This design prioritizes service availability and stable contracts over strict dependency on model behavior.

---

### Chat Storage and Retrieval Internals

Chat is persisted in `ChatSession` documents.

**Session fields**

- `sessionId` (unique external identifier)
- `jobId` (Mongo reference, optional)
- `jobExternalId` (optional)
- `title` (default: `HR AI Session`)
- `messages[]`

**Message fields**

- `role`: `hr | assistant`
- `content`: message text
- `createdAt`: timestamp

**Storage model behavior**

- New `sessionId` auto-generated if missing.
- Existing `sessionId` appends to current thread.
- Job context can be associated with the session for traceability.

**Why this is useful**

- Auditability of AI conversations
- Context continuity across HR sessions
- UI-friendly retrieval for historical conversation playback

---

## Endpoint-by-Endpoint Contract Appendix (Full API)

This appendix is intentionally verbose so teams can implement frontend, QA, and partner integrations without inspecting code.

### Health

#### `GET /`

- **Purpose**: Liveness check.
- **Auth**: none.
- **Request body**: none.
- **Returns**: plain string `Hello World!`.

### Jobs

#### `POST /jobs`

- **Purpose**: Create one job.
- **Required**: `title`.
- **Optional**: all structured/nested job fields.
- **Returns**: persisted job document with `_id`, timestamps.

#### `POST /jobs/upload/json`

- **Purpose**: Bulk create jobs from JSON body or uploaded JSON file.
- **Formats**:
  - JSON object containing `jobs[]` or `jobProfiles[]` or `items[]`
  - top-level JSON array
  - NDJSON (one object per line)
- **Returns**: created jobs array.
- **Side effect**: upload log (`jobs-json`).

#### `POST /jobs/upload/spreadsheet`

- **Purpose**: Bulk create jobs from CSV/XLS/XLSX.
- **Required form-data**: `file`.
- **Returns**: created jobs array.
- **Validation**: only CSV/XLS/XLSX accepted.
- **Side effect**: upload log (`jobs-spreadsheet`).

#### `GET /jobs`

- **Purpose**: list jobs.
- **Returns**: jobs sorted desc by `createdAt`.

#### `GET /jobs/:jobId`

- **Purpose**: get one job by external job ID.
- **Returns**: job document.
- **Errors**: `404` if missing.

#### `PATCH /jobs/:jobId`

- **Purpose**: update one job by external ID.
- **Returns**: updated job.
- **Errors**: `404` if missing.

#### `DELETE /jobs/:jobId`

- **Purpose**: delete one job by external ID.
- **Returns**: `{ success, deletedJobId }`.
- **Errors**: `404` if missing.

### Candidates

#### `POST /candidates`

- **Purpose**: create/upsert candidate from schema profile.
- **Identity logic**: email and/or `externalCandidateId` used for matching.
- **Job linking**: optional via `jobId` and `appliedJobIds`.
- **Returns**: created/updated candidate.

#### `POST /candidates/upload/json`

- **Purpose**: bulk create/upsert candidates via JSON.
- **Sources accepted**: body payload or form-data file.
- **Payload keys**: `candidates[]` or `talentProfiles[]`.
- **Encoding tolerance**: UTF-8/UTF-16/latin1/ascii + BOM stripping.
- **JSON tolerance**: comments, trailing commas, NDJSON.
- **Returns**: candidate array.
- **Side effect**: upload log (`candidates-json`).

#### `POST /candidates/upload/spreadsheet`

- **Purpose**: bulk create/upsert candidates via CSV/XLS/XLSX.
- **Optional link field**: `jobId` (external).
- **Returns**: candidate array.
- **Side effect**: upload log (`candidates-spreadsheet`).

#### `POST /candidates/upload/resume`

- **Purpose**: parse resume and create candidate + parsed profile.
- **Expected file**: PDF path is primary for this route.
- **Optional**: `jobId` to auto-create application with source `resume-upload`.
- **Returns**: `{ candidate, parsedProfile }`.
- **Side effect**: upload log (`candidates-resume`).

#### `POST /candidates/:id/reparse`

- **Purpose**: parse replacement document for an existing candidate.
- **Returns**: `{ success: true, parsedProfile }`.
- **Side effect**: upload log (`reparse`).

#### `POST /candidates/:id/recompute`

- **Purpose**: recompute merged profile/confidence from current records.
- **Returns**: parsed profile doc.

#### `GET /candidates`

- **Purpose**: list candidates.
- **Returns**: candidates sorted by latest.

#### `GET /candidates/with-jobs`

- **Purpose**: list candidates enriched with linked applications/jobs.
- **Returns**: array with `candidate`, `appliedJobIds`, `applications[]`.

#### `GET /candidates/:id`

- **Purpose**: get candidate with source + parsed profile.
- **Returns**: `{ candidate, sourceProfile, parsedProfile }`.
- **Errors**: `404` if candidate missing.

#### `GET /candidates/:id/with-jobs`

- **Purpose**: one candidate enriched with applications/jobs.
- **Returns**: `candidate` wrapper + applications metadata.

#### `PATCH /candidates/:id`

- **Purpose**: partial candidate update.
- **Returns**: updated candidate.
- **Errors**: `404` if missing.

#### `DELETE /candidates/:id`

- **Purpose**: delete candidate and profile companions.
- **Returns**: `{ success: true, deletedId }`.
- **Errors**: `404` if missing.

### Parse Module

#### `POST /parse/resume`

- **Purpose**: parse one uploaded document into `TalentProfile`.
- **Formats**: pdf/doc/docx/txt/csv/xls/xlsx.
- **Returns**: `{ success: true, data: TalentProfile }`.

#### `POST /parse/batch`

- **Purpose**: parse many files in one request.
- **Field**: `files` (multi-file form-data key).
- **Returns**: `{ success, count, data[] }` where `count === data.length` for successful parses.

### Applications

#### `POST /applications`

- **Purpose**: create/upsert candidate↔job application link.
- **Required**: external `jobId`, Mongo `candidateId`.
- **Source enum**: `manual | dummy-seed | external-api | csv-upload | resume-upload`.
- **Returns**: application doc.

#### `GET /applications/job/:jobId`

- **Purpose**: list applications by external job ID.
- **Returns**: applications populated with `candidateId` document.
- **Errors**: `404` if job not found.

#### `GET /applications/candidate/:candidateId`

- **Purpose**: list applications by candidate ID.
- **Returns**: applications populated with `jobId` document.

### AI

#### `POST /ai/rank`

- **Purpose**: rank and persist screening.
- **See deep dive section above** for full behavior.

#### `POST /ai/chat`

- **Purpose**: conversational HR assistant with optional job context.
- **See deep dive section above** for full behavior.

#### `GET /ai/chat/:sessionId`

- **Purpose**: session retrieval.

#### `GET /ai/screenings`

- **Purpose**: list historical screenings.

### Upload Logs

#### `GET /upload-history`

- **Purpose**: fetch upload event history.

#### `GET /upload-stats`

- **Purpose**: aggregate KPIs (volume, success/failure, added entities, 7-day trend).

### Seed

#### `POST /seed/demo`

- **Purpose**: create deterministic sample data set.

---

## Client Integration Positioning (Available Now vs Proposed)

This section is written for client conversations and solution architecture alignment.

### What is already true today

The API already supports end-to-end operational flows:

1. Ingest jobs (`/jobs/...`)
2. Ingest candidates (`/candidates/...` or `/parse/...` + candidate routes)
3. Link applications (`/applications`)
4. Run AI ranking (`/ai/rank`)
5. Run AI chat (`/ai/chat`)
6. Retrieve historical AI outcomes (`/ai/screenings`, `/ai/chat/:sessionId`)

This means a partner can integrate using multiple API calls and still build a complete “AI-powered hiring workflow” today.

### What is not yet exposed as a single endpoint

There is currently **no built-in endpoint** like `POST /integration/full-evaluation` that ingests all payloads and returns one final prediction packet in one call.

### Proposed “single-call orchestration API” (recommended)

For enterprise clients, a next step can be:

- `POST /integrations/evaluate`

Proposed request (example):

```json
{
  "job": { "title": "Backend Engineer", "requiredSkills": ["Node.js", "NestJS"] },
  "candidates": [{ "firstName": "A", "lastName": "B", "email": "a@b.com", "skills": [] }],
  "options": {
    "topN": 5,
    "persist": true,
    "returnChatStarter": true
  }
}
```

Proposed response (example):

```json
{
  "job": { "jobId": "JOB-123" },
  "candidates": { "ingested": 10, "linked": 10 },
  "ranking": { "screeningId": "...", "topCandidates": [] },
  "chat": { "sessionId": "...", "starterAnswer": "..." },
  "audit": { "usedGemini": true, "modelFallbackTriggered": false }
}
```

### Why this matters as a client-facing pro

- Reduces frontend orchestration complexity
- Standardizes AI decision packet contract
- Easier enterprise integration with third-party ATS/HRIS
- Centralized auditing and reliability flags (`usedGemini`, fallback indicators)

### Positioning statement for clients

Use this statement:

> “The platform already supports full hiring intelligence workflows through modular APIs today. We can also provide a consolidated orchestration endpoint for one-call evaluation in the next integration phase, while preserving the same persistence and AI traceability model.”

This keeps communications accurate, strong, and implementation-friendly.

---

## AI Error and Reliability Matrix

| Area | Failure Mode | Current Handling | Client Impact |
|---|---|---|---|
| `/ai/rank` | Job not found | `404` | Request must use valid external `jobId` |
| `/ai/rank` | Gemini unavailable | fallback ranker | Response still returned, `usedGemini = false` |
| `/ai/rank` | Invalid model JSON output | parser normalization + fallback | Stable output contract maintained |
| `/ai/chat` | Gemini unavailable | fallback text response | Session still persists |
| `/ai/chat/:sessionId` | Unknown session | `404` | Client should create/reuse valid `sessionId` |
| Parse services | Parser/model failures | deterministic parsing + caching | Lower extraction richness, but available flow |

---

## Suggested Postman / API Test Order

1. `POST /seed/demo`
2. `GET /jobs`
3. `GET /candidates`
4. `POST /applications` (optional additional linking)
5. `POST /ai/rank`
6. `POST /ai/chat`
7. `GET /ai/chat/:sessionId`
8. `GET /ai/screenings`
9. `GET /upload-history`
10. `GET /upload-stats`

This sequence demonstrates ingestion, linking, AI inference, persistence, and observability.

