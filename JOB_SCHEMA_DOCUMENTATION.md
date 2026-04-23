# Job Schema Documentation

Complete guide for creating and uploading job records with structured data.

---

## Table of Contents
1. [Schema Overview](#schema-overview)
2. [Field Descriptions](#field-descriptions)
3. [Data Types & Validation](#data-types--validation)
4. [Complete JSON Schema](#complete-json-schema)
5. [Example Jobs](#example-jobs)
6. [Uploading Jobs](#uploading-jobs)
7. [Tips for Dummy Data](#tips-for-dummy-data)

---

## Schema Overview

The job schema consists of:
- **Basic Information**: jobId, title, department, location, description, isOpen
- **Structured Blocks**: role, requirements, experience, skills (recommended for clarity)
- **Legacy Flat Fields**: requiredSkills, preferredSkills, minYearsExperience (for AI compatibility)

### Structure Hierarchy

```
Job
├── Basic Info
│   ├── jobId (UUID, auto-generated)
│   ├── title (string, required)
│   ├── department (string)
│   ├── location (string)
│   ├── description (string)
│   └── isOpen (boolean)
│
├── Structured Blocks (Recommended)
│   ├── role
│   │   ├── title (string)
│   │   ├── responsibilities (string[])
│   │   └── education (string[])
│   │
│   ├── requirements
│   │   ├── requiredSkills (string[])
│   │   ├── preferredSkills (string[])
│   │   └── minYearsExperience (number)
│   │
│   ├── experience
│   │   ├── years (number[])
│   │   └── level (string[])
│   │
│   └── skills
│       ├── core (string[])
│       └── niceToHave (string[])
│
└── Legacy Flat Fields (optional, auto-populated from structured blocks)
    ├── requiredSkills (string[])
    ├── preferredSkills (string[])
    └── minYearsExperience (number)
```

---

## Field Descriptions

### Basic Information Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | UUID string | Auto-generated | Unique identifier for the job. Auto-generated if not provided. Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `title` | String | **REQUIRED** | Job title/position name. Examples: "Senior Software Engineer", "Product Manager", "UX Designer" |
| `department` | String | Optional | Department or team. Examples: "Engineering", "Product", "Design", "Sales", "HR" |
| `location` | String | Optional | Job location. Can be city, country, or "Remote". Examples: "New York, USA", "London, UK", "Remote" |
| `description` | String | Optional | Detailed job description or summary. Can be long (supports multi-line in JSON) |
| `isOpen` | Boolean | Optional | Whether the position is currently open (default: true) |

### Role Object

| Field | Type | Description |
|-------|------|-------------|
| `role.title` | String | Formal role title. Example: "Senior Backend Engineer" |
| `role.responsibilities` | String[] | Array of key responsibilities. Example: `["Design scalable APIs", "Lead team meetings", "Code review"]` |
| `role.education` | String[] | Array of preferred education/qualifications. Example: `["Bachelor's in Computer Science", "AWS Certification"]` |

**Note**: Responsibilities and education can be specified as:
- Array of strings: `["item1", "item2"]`
- Comma-separated string: `"item1, item2"`
- Semicolon-separated string: `"item1; item2"`
- Pipe-separated string: `"item1 | item2"`

### Requirements Object

| Field | Type | Description |
|-------|------|-------------|
| `requirements.requiredSkills` | String[] | Array of required technical/soft skills |
| `requirements.preferredSkills` | String[] | Array of nice-to-have skills |
| `requirements.minYearsExperience` | Number | Minimum years of experience required. Example: `5`, `10` |

### Experience Object

| Field | Type | Description |
|-------|------|-------------|
| `experience.years` | Number[] | Array of experience ranges in years. Example: `[3, 5]` means 3-5 years, `[5]` means 5+ years |
| `experience.level` | String[] | Array of experience levels. Example: `["Senior", "Lead"]` or `["Mid-level"]` |

### Skills Object

| Field | Type | Description |
|-------|------|-------------|
| `skills.core` | String[] | Array of core/required technical skills |
| `skills.niceToHave` | String[] | Array of nice-to-have additional skills |

---

## Data Types & Validation

### String Arrays
Can be provided as:
1. **JSON Array**: `["Python", "JavaScript", "TypeScript"]`
2. **Comma-separated**: `"Python, JavaScript, TypeScript"`
3. **Semicolon-separated**: `"Python; JavaScript; TypeScript"`
4. **Pipe-separated**: `"Python | JavaScript | TypeScript"`

All formats are automatically parsed and normalized.

### Numbers
- **minYearsExperience**: Integer (0-50)
- **experience.years**: Array of integers

### Booleans
- **isOpen**: `true` or `false` (default: `true`)

### Strings
- No length limits (but recommended under 5000 characters for descriptions)
- UTF-8 supported
- Case-insensitive for most fields

---

## Complete JSON Schema

### Minimal Job (Required Fields Only)
```json
{
  "title": "Software Engineer"
}
```

### Full Job (With All Fields)
```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Senior Software Engineer",
  "department": "Engineering",
  "location": "San Francisco, USA",
  "description": "We are looking for a talented Senior Software Engineer to join our platform team...",
  "isOpen": true,
  "role": {
    "title": "Senior Backend Engineer",
    "responsibilities": [
      "Design and implement scalable distributed systems",
      "Lead architectural decisions and code reviews",
      "Mentor junior engineers and conduct technical interviews",
      "Collaborate with product and infrastructure teams"
    ],
    "education": [
      "Bachelor's degree in Computer Science or related field",
      "AWS Solutions Architect certification (preferred)",
      "Kubernetes administration experience"
    ]
  },
  "requirements": {
    "requiredSkills": [
      "Node.js",
      "TypeScript",
      "PostgreSQL",
      "Docker",
      "Kubernetes",
      "System Design"
    ],
    "preferredSkills": [
      "GraphQL",
      "AWS",
      "MongoDB",
      "Redis",
      "Machine Learning basics"
    ],
    "minYearsExperience": 6
  },
  "experience": {
    "years": [6, 10],
    "level": ["Senior", "Lead"]
  },
  "skills": {
    "core": [
      "Backend Development",
      "Microservices Architecture",
      "Database Design",
      "Cloud Infrastructure"
    ],
    "niceToHave": [
      "DevOps",
      "API Design",
      "Technical Leadership"
    ]
  }
}
```

### Uploading Multiple Jobs (Batch Format)
```json
{
  "jobs": [
    { ... job 1 ... },
    { ... job 2 ... },
    { ... job 3 ... }
  ]
}
```

OR

```json
{
  "jobProfiles": [
    { ... job 1 ... },
    { ... job 2 ... },
    { ... job 3 ... }
  ]
}
```

---

## Example Jobs

### Example 1: Senior Backend Engineer
```json
{
  "title": "Senior Backend Engineer",
  "department": "Engineering",
  "location": "San Francisco, USA",
  "description": "Join our platform team to build scalable APIs serving millions of users. You'll design microservices, optimize databases, and lead technical initiatives.",
  "isOpen": true,
  "role": {
    "title": "Senior Backend Engineer - Platform",
    "responsibilities": [
      "Design and implement scalable REST APIs and microservices",
      "Optimize database queries and implement caching strategies",
      "Lead code review and mentor junior engineers",
      "Own end-to-end deployment and monitoring",
      "Collaborate with DevOps on infrastructure improvements"
    ],
    "education": [
      "Bachelor's in Computer Science or equivalent experience",
      "AWS Certified Solutions Architect (preferred)"
    ]
  },
  "requirements": {
    "requiredSkills": [
      "Node.js or Java",
      "TypeScript",
      "PostgreSQL or MySQL",
      "Docker",
      "Kubernetes",
      "System Design",
      "HTTP/REST APIs"
    ],
    "preferredSkills": [
      "GraphQL",
      "AWS EC2, RDS, Lambda",
      "Redis",
      "Event-driven architecture",
      "gRPC"
    ],
    "minYearsExperience": 6
  },
  "experience": {
    "years": [6, 12],
    "level": ["Senior", "Lead"]
  },
  "skills": {
    "core": [
      "Backend Development",
      "Microservices Architecture",
      "Database Design",
      "Cloud Infrastructure",
      "API Design"
    ],
    "niceToHave": [
      "DevOps",
      "Search Engine Optimization",
      "Performance Tuning"
    ]
  }
}
```

### Example 2: Full-Stack Developer (Mid-Level)
```json
{
  "title": "Full Stack Developer",
  "department": "Engineering",
  "location": "Berlin, Germany",
  "description": "Build modern web applications using React and Node.js. You'll work on features from database to UI, collaborating with designers and product managers.",
  "isOpen": true,
  "role": {
    "title": "Full Stack Developer",
    "responsibilities": [
      "Develop features across frontend and backend layers",
      "Build responsive UIs with React and modern CSS",
      "Implement API endpoints with Node.js and Express",
      "Write unit and integration tests",
      "Participate in design and architecture discussions"
    ],
    "education": [
      "Bachelor's in Computer Science or related field",
      "Bootcamp certification or equivalent professional experience"
    ]
  },
  "requirements": {
    "requiredSkills": [
      "React or Vue.js",
      "Node.js",
      "JavaScript/TypeScript",
      "MongoDB or PostgreSQL",
      "HTML/CSS",
      "Git",
      "REST APIs"
    ],
    "preferredSkills": [
      "Next.js",
      "GraphQL",
      "Docker",
      "AWS basics",
      "Stripe or payment integration"
    ],
    "minYearsExperience": 3
  },
  "experience": {
    "years": [3, 6],
    "level": ["Mid-level", "Developer"]
  },
  "skills": {
    "core": [
      "Frontend Development",
      "Backend Development",
      "Database Management",
      "Web Fundamentals"
    ],
    "niceToHave": [
      "Mobile Development",
      "DevOps",
      "UX/Design Thinking"
    ]
  }
}
```

### Example 3: Product Manager
```json
{
  "title": "Product Manager",
  "department": "Product",
  "location": "New York, USA",
  "description": "Lead product strategy for our B2B SaaS platform. Define roadmaps, work with engineering and design, and drive product growth metrics.",
  "isOpen": true,
  "role": {
    "title": "Senior Product Manager",
    "responsibilities": [
      "Define and communicate product vision and roadmap",
      "Conduct user research and analyze market trends",
      "Write detailed PRDs and user stories",
      "Collaborate with engineering, design, and sales teams",
      "Monitor KPIs and iterate based on usage data",
      "Present to stakeholders and executives"
    ],
    "education": [
      "MBA or equivalent experience",
      "Product Management certification (preferred)"
    ]
  },
  "requirements": {
    "requiredSkills": [
      "Product Strategy",
      "Data Analysis",
      "User Research",
      "Roadmap Planning",
      "Stakeholder Management",
      "SQL basics",
      "A/B Testing"
    ],
    "preferredSkills": [
      "SaaS experience",
      "B2B expertise",
      "Tableau or Looker",
      "Python or R",
      "Design thinking"
    ],
    "minYearsExperience": 5
  },
  "experience": {
    "years": [5, 15],
    "level": ["Senior", "Lead"]
  },
  "skills": {
    "core": [
      "Product Strategy",
      "Data-Driven Decision Making",
      "Cross-functional Leadership",
      "Market Analysis"
    ],
    "niceToHave": [
      "Growth Hacking",
      "Fundraising Knowledge",
      "Public Speaking"
    ]
  }
}
```

### Example 4: UX/UI Designer
```json
{
  "title": "UX/UI Designer",
  "department": "Design",
  "location": "Remote",
  "description": "Design beautiful, intuitive interfaces for our web and mobile products. You'll lead design thinking, conduct user testing, and work closely with product and engineering.",
  "isOpen": true,
  "role": {
    "title": "Senior UX/UI Designer",
    "responsibilities": [
      "Create wireframes, mockups, and high-fidelity prototypes",
      "Conduct user research and usability testing",
      "Establish and maintain design systems",
      "Collaborate with product and engineering on implementation",
      "Present design concepts to stakeholders",
      "Mentor junior designers"
    ],
    "education": [
      "Bachelor's in Design, HCI, or related field",
      "UX certification (preferred)"
    ]
  },
  "requirements": {
    "requiredSkills": [
      "Figma or Adobe XD",
      "User Research",
      "Wireframing",
      "Prototyping",
      "Design Systems",
      "HTML/CSS basics",
      "Interaction Design"
    ],
    "preferredSkills": [
      "After Effects",
      "Prototyping tools (Framer, Principle)",
      "User Testing platforms",
      "Analytics understanding",
      "Mobile design expertise"
    ],
    "minYearsExperience": 4
  },
  "experience": {
    "years": [4, 10],
    "level": ["Senior", "Lead Designer"]
  },
  "skills": {
    "core": [
      "Visual Design",
      "User Experience Design",
      "Prototyping",
      "Design Systems"
    ],
    "niceToHave": [
      "Animation Design",
      "Accessibility (a11y)",
      "Design Research"
    ]
  }
}
```

### Example 5: DevOps Engineer
```json
{
  "title": "DevOps Engineer",
  "department": "Infrastructure",
  "location": "Remote",
  "description": "Build and maintain our cloud infrastructure. Automate deployments, improve system reliability, and optimize costs on AWS and Kubernetes.",
  "isOpen": true,
  "role": {
    "title": "DevOps/SRE Engineer",
    "responsibilities": [
      "Design and maintain Kubernetes clusters",
      "Implement CI/CD pipelines using GitHub Actions or Jenkins",
      "Monitor system performance and uptime",
      "Implement security best practices and compliance",
      "Optimize cloud costs and resource utilization",
      "Respond to production incidents and implement fixes"
    ],
    "education": [
      "Bachelor's in Computer Science or related field",
      "AWS Certified DevOps Professional or CKA (preferred)"
    ]
  },
  "requirements": {
    "requiredSkills": [
      "Kubernetes",
      "Docker",
      "Terraform or CloudFormation",
      "AWS (EC2, RDS, S3, Lambda)",
      "Linux administration",
      "Bash/Shell scripting",
      "Monitoring (Prometheus, DataDog)"
    ],
    "preferredSkills": [
      "Helm",
      "GitOps (ArgoCD)",
      "Python or Go",
      "GCP or Azure",
      "Service mesh (Istio)"
    ],
    "minYearsExperience": 5
  },
  "experience": {
    "years": [5, 12],
    "level": ["Senior", "Lead SRE"]
  },
  "skills": {
    "core": [
      "Kubernetes Orchestration",
      "Cloud Infrastructure",
      "Infrastructure as Code",
      "CI/CD Automation",
      "System Monitoring"
    ],
    "niceToHave": [
      "Security Hardening",
      "Cost Optimization",
      "Disaster Recovery"
    ]
  }
}
```

---

## Uploading Jobs

### Option 1: Upload Single Job via POST (Manual Creation)

**Endpoint**: `POST /jobs`

**Request Body**:
```json
{
  "title": "Senior Software Engineer",
  "department": "Engineering",
  "location": "San Francisco, USA",
  "role": {
    "title": "Senior Backend Engineer",
    "responsibilities": ["Design APIs", "Lead reviews"]
  },
  "requirements": {
    "requiredSkills": ["Node.js", "TypeScript", "PostgreSQL"],
    "minYearsExperience": 6
  }
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Software Engineer",
    "department": "Engineering",
    "location": "San Francisco, USA",
    "role": {
      "title": "Senior Backend Engineer",
      "responsibilities": ["Design APIs", "Lead reviews"]
    },
    "requirements": {
      "requiredSkills": ["Node.js", "TypeScript", "PostgreSQL"],
      "minYearsExperience": 6
    }
  }'
```

### Option 2: Upload Multiple Jobs via JSON File

**Endpoint**: `POST /jobs/upload/json`

**Request Format**:
- **Header**: `Content-Type: multipart/form-data`
- **File field**: `file` (attach JSON file)
- **OR JSON body**: Send JSON with `jobs` or `jobProfiles` array

**JSON File Content** (`jobs.json`):
```json
{
  "jobs": [
    {
      "title": "Senior Backend Engineer",
      "department": "Engineering",
      "location": "San Francisco, USA",
      "role": {
        "title": "Senior Backend Engineer",
        "responsibilities": ["Design APIs", "Optimize databases"]
      },
      "requirements": {
        "requiredSkills": ["Node.js", "TypeScript", "PostgreSQL"],
        "minYearsExperience": 6
      }
    },
    {
      "title": "Full Stack Developer",
      "department": "Engineering",
      "location": "Berlin, Germany",
      "role": {
        "title": "Full Stack Developer",
        "responsibilities": ["Build features", "Write tests"]
      },
      "requirements": {
        "requiredSkills": ["React", "Node.js", "MongoDB"],
        "minYearsExperience": 3
      }
    }
  ]
}
```

**cURL Example - File Upload**:
```bash
curl -X POST http://localhost:3000/jobs/upload/json \
  -F 'file=@jobs.json;type=application/json'
```

**cURL Example - JSON Body**:
```bash
curl -X POST http://localhost:3000/jobs/upload/json \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      {
        "title": "Senior Backend Engineer",
        "department": "Engineering"
      },
      {
        "title": "Full Stack Developer",
        "department": "Engineering"
      }
    ]
  }'
```

### Option 3: Upload via CSV File

**Endpoint**: `POST /jobs/upload/spreadsheet`

**CSV Format**:
```csv
jobId,title,department,location,description,isOpen,role.title,role.responsibilities,requirements.requiredSkills,requirements.minYearsExperience
,Senior Backend Engineer,Engineering,"San Francisco, USA",Platform team role,true,Senior Backend Engineer,"Design APIs, Optimize databases","Node.js, TypeScript, PostgreSQL",6
,Full Stack Developer,Engineering,"Berlin, Germany",Web development,true,Full Stack Developer,"Build features, Write tests","React, Node.js, MongoDB",3
```

**cURL Example**:
```bash
curl -X POST http://localhost:3000/jobs/upload/spreadsheet \
  -F 'file=@jobs.csv'
```

### Option 4: Upload via Excel File

**Endpoint**: `POST /jobs/upload/spreadsheet`

Create an Excel file with columns similar to CSV format above.

**cURL Example**:
```bash
curl -X POST http://localhost:3000/jobs/upload/spreadsheet \
  -F 'file=@jobs.xlsx'
```

### Response Examples

**Success (HTTP 201)**:
```json
{
  "message": "3 jobs created successfully",
  "count": 3,
  "jobIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "c3d4e5f6-a7b8-9012-cdef-234567890123"
  ]
}
```

**Error (HTTP 400)**:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": {
    "field": "title",
    "issue": "title is required"
  }
}
```

---

## Tips for Dummy Data

### 1. **Quick Job Generation**
Use this template pattern for rapid creation:
```json
{
  "title": "[Role Title]",
  "department": "[Dept]",
  "location": "[City, Country]",
  "role": {
    "title": "[Formal Title]",
    "responsibilities": ["Responsibility 1", "Responsibility 2", "Responsibility 3"]
  },
  "requirements": {
    "requiredSkills": ["Skill1", "Skill2", "Skill3"],
    "minYearsExperience": [3-10]
  }
}
```

### 2. **Variety Tips**
Create jobs across different:
- **Departments**: Engineering, Product, Design, Sales, Marketing, HR
- **Locations**: San Francisco, New York, London, Berlin, Remote, Tokyo
- **Levels**: Entry-level (1-2 yrs), Mid-level (3-6 yrs), Senior (6+ yrs)
- **Roles**: Backend, Frontend, Full Stack, DevOps, PM, Designer, QA, Data Science

### 3. **Skill Pool for Variety**
```
Backend: Node.js, Java, Python, Go, Rust, Spring Boot, Django, FastAPI
Frontend: React, Vue.js, Angular, Next.js, TypeScript, HTML/CSS
Database: PostgreSQL, MySQL, MongoDB, Redis, DynamoDB, Elasticsearch
DevOps: Kubernetes, Docker, AWS, GCP, Terraform, Jenkins, GitHub Actions
Data: Python, SQL, Spark, TensorFlow, Tableau, Looker, Airflow
```

### 4. **Experience Ranges**
- Junior: 0-2 years
- Mid: 3-6 years
- Senior: 6-10 years
- Lead/Staff: 10+ years

### 5. **Batch Creation Script**
Save as `create_dummy_jobs.json` and upload via `/jobs/upload/json`:

```json
{
  "jobs": [
    {
      "title": "Senior Backend Engineer",
      "department": "Engineering",
      "location": "San Francisco, USA",
      "role": {
        "title": "Senior Backend Engineer",
        "responsibilities": ["Design scalable APIs", "Lead architecture", "Mentor team"]
      },
      "requirements": {
        "requiredSkills": ["Node.js", "TypeScript", "PostgreSQL", "Kubernetes"],
        "preferredSkills": ["GraphQL", "AWS", "Redis"],
        "minYearsExperience": 7
      }
    },
    {
      "title": "Frontend Engineer",
      "department": "Engineering",
      "location": "Berlin, Germany",
      "role": {
        "title": "Frontend Developer",
        "responsibilities": ["Build React components", "Optimize performance", "Implement accessibility"]
      },
      "requirements": {
        "requiredSkills": ["React", "TypeScript", "CSS", "Jest"],
        "preferredSkills": ["Next.js", "Tailwind", "Storybook"],
        "minYearsExperience": 4
      }
    },
    {
      "title": "Product Manager",
      "department": "Product",
      "location": "Remote",
      "role": {
        "title": "Senior PM",
        "responsibilities": ["Define roadmap", "Conduct user research", "Lead cross-team projects"]
      },
      "requirements": {
        "requiredSkills": ["Product Strategy", "Data Analysis", "SQL", "User Research"],
        "preferredSkills": ["Tableau", "A/B Testing", "SaaS experience"],
        "minYearsExperience": 6
      }
    },
    {
      "title": "DevOps Engineer",
      "department": "Infrastructure",
      "location": "London, UK",
      "role": {
        "title": "SRE Engineer",
        "responsibilities": ["Manage Kubernetes clusters", "Build CI/CD pipelines", "Monitor systems"]
      },
      "requirements": {
        "requiredSkills": ["Kubernetes", "Docker", "Terraform", "AWS", "Linux"],
        "preferredSkills": ["Helm", "Go", "GitOps"],
        "minYearsExperience": 6
      }
    },
    {
      "title": "UX Designer",
      "department": "Design",
      "location": "New York, USA",
      "role": {
        "title": "Senior UX Designer",
        "responsibilities": ["Create wireframes", "Conduct user research", "Build design systems"]
      },
      "requirements": {
        "requiredSkills": ["Figma", "User Research", "Prototyping", "Design Systems"],
        "preferredSkills": ["After Effects", "HTML/CSS basics", "Usability Testing"],
        "minYearsExperience": 5
      }
    }
  ]
}
```

### 6. **Common Mistakes to Avoid**
- ❌ Missing `title` (it's required)
- ❌ Empty arrays for skills (provide at least 2-3)
- ❌ Negative years of experience
- ❌ Unclear responsibility descriptions
- ✅ Always provide context-specific skills
- ✅ Include both required and preferred skills
- ✅ Make responsibilities action-oriented (use verbs)

### 7. **Naming Conventions**
- **Job titles**: Use industry-standard titles (Senior Engineer, not "High-Level Code Writer")
- **Departments**: Consistent across company (Engineering, not Dev/Backend)
- **Skills**: Exact version names when relevant (PostgreSQL 12+, React 18, Node.js 18)
- **Locations**: City, Country or "Remote"

---

## Working with the API

### Get All Jobs
```bash
curl http://localhost:3000/jobs
```

### Get Single Job by ID
```bash
curl http://localhost:3000/jobs/{jobId}
```

### Update a Job
```bash
curl -X PATCH http://localhost:3000/jobs/{jobId} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Principal Engineer",
    "requirements": {
      "minYearsExperience": 10
    }
  }'
```

### Delete a Job
```bash
curl -X DELETE http://localhost:3000/jobs/{jobId}
```

---

## Schema Summary Table

| Field | Type | Required | Allowed Values |
|-------|------|----------|-----------------|
| `jobId` | UUID | No (auto) | Valid UUID format |
| `title` | String | **Yes** | Any string |
| `department` | String | No | Any string |
| `location` | String | No | City, Country or "Remote" |
| `description` | String | No | Any string |
| `isOpen` | Boolean | No | true/false (default: true) |
| `role.title` | String | No | Any string |
| `role.responsibilities` | String[] | No | Array or delimited string |
| `role.education` | String[] | No | Array or delimited string |
| `requirements.requiredSkills` | String[] | No | Array or delimited string |
| `requirements.preferredSkills` | String[] | No | Array or delimited string |
| `requirements.minYearsExperience` | Number | No | 0-50 |
| `experience.years` | Number[] | No | Array of positive integers |
| `experience.level` | String[] | No | Array or delimited string |
| `skills.core` | String[] | No | Array or delimited string |
| `skills.niceToHave` | String[] | No | Array or delimited string |

---

## Next Steps

1. **Create your dummy jobs** using the examples above
2. **Save to JSON file** (e.g., `dummy_jobs.json`)
3. **Upload via API**: `POST /jobs/upload/json` with file attachment
4. **Verify creation**: `GET /jobs` to list all jobs
5. **Use for AI ranking**: The jobs will be available for candidate ranking

Enjoy creating your job database! 🚀
