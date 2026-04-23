import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Candidate,
  CandidateDocument,
} from '../candidates/schemas/candidate.schema';
import {
  JobApplication,
  JobApplicationDocument,
} from '../applications/schemas/job-application.schema';
import { Job, JobDocument } from '../jobs/schemas/job.schema';

@Injectable()
export class SeedService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectModel(Candidate.name)
    private readonly candidateModel: Model<CandidateDocument>,
    @InjectModel(JobApplication.name)
    private readonly jobApplicationModel: Model<JobApplicationDocument>,
  ) {}

  async seedDemoData() {
    await this.jobModel
      .deleteMany({ jobId: { $in: ['JOB-BE-001', 'JOB-AI-002'] } })
      .exec();
    await this.candidateModel
      .deleteMany({
        email: {
          $in: [
            'alice.backend@example.com',
            'jean.express@example.com',
            'maria.nest@example.com',
            'eric.fullstack@example.com',
          ],
        },
      })
      .exec();
    await this.jobApplicationModel.deleteMany({}).exec();

    const jobs = await this.jobModel.insertMany([
      {
        jobId: 'JOB-BE-001',
        title: 'Backend Engineer',
        department: 'Engineering',
        location: 'Kigali, Rwanda',
        description:
          'Build scalable backend APIs for HR intelligence products.',
        requiredSkills: ['Node.js', 'REST APIs', 'MongoDB'],
        preferredSkills: ['Express', 'NestJS', 'Docker'],
        minYearsExperience: 3,
      },
      {
        jobId: 'JOB-AI-002',
        title: 'AI Backend Engineer',
        department: 'Engineering',
        location: 'Kigali, Rwanda',
        description: 'Build AI service integrations and ranking pipelines.',
        requiredSkills: ['Node.js', 'Python', 'Prompt Engineering'],
        preferredSkills: ['Gemini API', 'MongoDB'],
        minYearsExperience: 2,
      },
    ]);

    const candidates = await this.candidateModel.insertMany([
      {
        firstName: 'Alice',
        lastName: 'Backend',
        email: 'alice.backend@example.com',
        headline: 'Backend Engineer - Node.js & Express',
        bio: 'Experienced in APIs and microservices',
        location: 'Kigali, Rwanda',
        skills: [
          { name: 'Node.js', level: 'Expert', yearsOfExperience: 5 },
          { name: 'Express', level: 'Advanced', yearsOfExperience: 4 },
          { name: 'MongoDB', level: 'Advanced', yearsOfExperience: 4 },
        ],
        languages: [{ name: 'English', proficiency: 'Fluent' }],
        experience: [
          {
            company: 'Tech Ltd',
            role: 'Backend Engineer',
            startDate: '2020-01',
            endDate: 'Present',
            description: 'Built core APIs',
            technologies: ['Node.js', 'Express', 'MongoDB'],
            isCurrent: true,
          },
        ],
        education: [
          {
            institution: 'UR',
            degree: "Bachelor's",
            fieldOfStudy: 'Computer Science',
            startYear: 2015,
            endYear: 2019,
          },
        ],
        projects: [
          {
            name: 'Hiring API',
            description: 'Applicant screening API',
            technologies: ['Express', 'MongoDB'],
            role: 'Backend Engineer',
            startDate: '2023-01',
            endDate: '2023-12',
          },
        ],
        availability: { status: 'Open to Opportunities', type: 'Full-time' },
        source: 'manual',
      },
      {
        firstName: 'Jean',
        lastName: 'Express',
        email: 'jean.express@example.com',
        headline: 'Node.js Engineer - Express Specialist',
        location: 'Kigali, Rwanda',
        skills: [
          { name: 'Node.js', level: 'Advanced', yearsOfExperience: 4 },
          { name: 'Express', level: 'Expert', yearsOfExperience: 5 },
          { name: 'NestJS', level: 'Beginner', yearsOfExperience: 1 },
        ],
        experience: [
          {
            company: 'Apps Co',
            role: 'Backend Engineer',
            startDate: '2019-06',
            endDate: 'Present',
            description: 'REST API development with Express',
            technologies: ['Node.js', 'Express'],
            isCurrent: true,
          },
        ],
        education: [
          {
            institution: 'AUCA',
            degree: "Bachelor's",
            fieldOfStudy: 'Software Engineering',
            startYear: 2014,
            endYear: 2018,
          },
        ],
        projects: [
          {
            name: 'Billing API',
            description: 'High throughput billing microservice',
            technologies: ['Express', 'Redis'],
            role: 'Backend Engineer',
            startDate: '2022-01',
            endDate: '2023-12',
          },
        ],
        availability: { status: 'Available', type: 'Contract' },
        source: 'manual',
      },
      {
        firstName: 'Maria',
        lastName: 'Nest',
        email: 'maria.nest@example.com',
        headline: 'NestJS Architect',
        location: 'Kampala, Uganda',
        skills: [
          { name: 'Node.js', level: 'Advanced', yearsOfExperience: 5 },
          { name: 'NestJS', level: 'Expert', yearsOfExperience: 5 },
          { name: 'MongoDB', level: 'Intermediate', yearsOfExperience: 3 },
        ],
        experience: [
          {
            company: 'Scale Inc',
            role: 'Senior Backend Engineer',
            startDate: '2018-01',
            endDate: 'Present',
            description: 'Built modular NestJS services',
            technologies: ['Node.js', 'NestJS', 'MongoDB'],
            isCurrent: true,
          },
        ],
        education: [
          {
            institution: 'Makerere',
            degree: "Bachelor's",
            fieldOfStudy: 'Computer Science',
            startYear: 2012,
            endYear: 2016,
          },
        ],
        projects: [
          {
            name: 'Platform Core API',
            description: 'Core services for product suite',
            technologies: ['NestJS', 'MongoDB'],
            role: 'Tech Lead',
            startDate: '2021-01',
            endDate: '2024-01',
          },
        ],
        availability: { status: 'Not Available', type: 'Full-time' },
        source: 'manual',
      },
      {
        firstName: 'Eric',
        lastName: 'Fullstack',
        email: 'eric.fullstack@example.com',
        headline: 'Fullstack Engineer (Node + React)',
        location: 'Kigali, Rwanda',
        skills: [
          { name: 'Node.js', level: 'Intermediate', yearsOfExperience: 3 },
          { name: 'Express', level: 'Intermediate', yearsOfExperience: 2 },
          { name: 'React', level: 'Advanced', yearsOfExperience: 4 },
        ],
        experience: [
          {
            company: 'Startup Hub',
            role: 'Fullstack Engineer',
            startDate: '2021-05',
            endDate: 'Present',
            description: 'Built B2B dashboard and backend APIs',
            technologies: ['React', 'Node.js', 'Express'],
            isCurrent: true,
          },
        ],
        education: [
          {
            institution: 'ULK',
            degree: "Bachelor's",
            fieldOfStudy: 'Information Systems',
            startYear: 2016,
            endYear: 2020,
          },
        ],
        projects: [
          {
            name: 'Recruitment Dashboard',
            description: 'Screening dashboard for HR teams',
            technologies: ['React', 'Express'],
            role: 'Fullstack Engineer',
            startDate: '2023-02',
            endDate: '2024-02',
          },
        ],
        availability: { status: 'Open to Opportunities', type: 'Part-time' },
        source: 'manual',
      },
    ]);

    const jobByExternalId = new Map(jobs.map((job) => [job.jobId, job]));
    const candidateByEmail = new Map(
      candidates.map((candidate) => [candidate.email, candidate]),
    );

    await this.jobApplicationModel.insertMany([
      {
        jobId: jobByExternalId.get('JOB-BE-001')?._id,
        candidateId: candidateByEmail.get('alice.backend@example.com')?._id,
        status: 'applied',
        source: 'dummy-seed',
      },
      {
        jobId: jobByExternalId.get('JOB-BE-001')?._id,
        candidateId: candidateByEmail.get('jean.express@example.com')?._id,
        status: 'applied',
        source: 'dummy-seed',
      },
      {
        jobId: jobByExternalId.get('JOB-AI-002')?._id,
        candidateId: candidateByEmail.get('maria.nest@example.com')?._id,
        status: 'applied',
        source: 'dummy-seed',
      },
      {
        jobId: jobByExternalId.get('JOB-AI-002')?._id,
        candidateId: candidateByEmail.get('eric.fullstack@example.com')?._id,
        status: 'applied',
        source: 'dummy-seed',
      },
    ]);

    return {
      insertedJobs: jobs.length,
      insertedCandidates: candidates.length,
      jobIds: jobs.map((job) => job.jobId),
      candidateEmails: candidates.map((candidate) => candidate.email),
    };
  }
}
