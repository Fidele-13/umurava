import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Job, JobDocument } from '../jobs/schemas/job.schema';
import {
  JobApplication,
  JobApplicationDocument,
} from './schemas/job-application.schema';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectModel(JobApplication.name)
    private readonly jobApplicationModel: Model<JobApplicationDocument>,
  ) {}

  async linkCandidateToJobByExternalId(
    jobExternalId: string,
    candidateId: string,
    source: JobApplication['source'] = 'manual',
    session?: ClientSession,
  ) {
    const jobQuery = this.jobModel.findOne({ jobId: jobExternalId });
    if (session) {
      jobQuery.session(session);
    }
    const job = await jobQuery.exec();

    if (!job) {
      throw new NotFoundException(`Job ${jobExternalId} not found`);
    }

    return this.jobApplicationModel
      .findOneAndUpdate(
        {
          jobId: job._id,
          candidateId: new Types.ObjectId(candidateId),
        },
        {
          $set: {
            status: 'applied',
            source,
          },
        },
        { upsert: true, new: true, session },
      )
      .exec();
  }

  async linkCandidatesToJobByExternalId(
    jobExternalId: string,
    candidateIds: string[],
    source: JobApplication['source'] = 'manual',
    session?: ClientSession,
  ) {
    if (!candidateIds.length) {
      return [];
    }

    const jobQuery = this.jobModel.findOne({ jobId: jobExternalId });
    if (session) {
      jobQuery.session(session);
    }
    const job = await jobQuery.exec();

    if (!job) {
      throw new NotFoundException(`Job ${jobExternalId} not found`);
    }

    await Promise.all(
      candidateIds.map((candidateId) =>
        this.jobApplicationModel
          .findOneAndUpdate(
            {
              jobId: job._id,
              candidateId: new Types.ObjectId(candidateId),
            },
            {
              $set: {
                status: 'applied',
                source,
              },
            },
            { upsert: true, new: true, session },
          )
          .exec(),
      ),
    );

    const query = this.jobApplicationModel.find({ jobId: job._id });
    if (session) {
      query.session(session);
    }

    return query.exec();
  }

  async findByJobExternalId(jobExternalId: string) {
    const job = await this.jobModel.findOne({ jobId: jobExternalId }).exec();

    if (!job) {
      throw new NotFoundException(`Job ${jobExternalId} not found`);
    }

    return this.jobApplicationModel
      .find({ jobId: job._id })
      .populate('candidateId')
      .sort({ createdAt: -1 })
      .exec();
  }

  findByCandidateId(candidateId: string) {
    return this.jobApplicationModel
      .find({ candidateId: new Types.ObjectId(candidateId) })
      .populate('jobId')
      .sort({ createdAt: -1 })
      .exec();
  }
}
