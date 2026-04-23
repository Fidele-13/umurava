import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Error as MongooseError, Model } from 'mongoose';
import { ApplicationsService } from '../applications/applications.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import {
  TalentProfile,
  normalizeTalentProfile,
} from './dto/talent-profile.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import {
  CandidateParsedProfile,
  CandidateParsedProfileDocument,
} from './schemas/candidate-parsed-profile.schema';
import {
  CandidateSourceProfile,
  CandidateSourceProfileDocument,
} from './schemas/candidate-source-profile.schema';
import { Candidate, CandidateDocument } from './schemas/candidate.schema';

type UpsertSchemaOptions = {
  session?: ClientSession;
  skipTransaction?: boolean;
  sourceSnapshot?: Record<string, unknown>;
};

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    @InjectModel(Candidate.name)
    private readonly candidateModel: Model<CandidateDocument>,
    @InjectModel(CandidateParsedProfile.name)
    private readonly parsedProfileModel: Model<CandidateParsedProfileDocument>,
    @InjectModel(CandidateSourceProfile.name)
    private readonly sourceProfileModel: Model<CandidateSourceProfileDocument>,
    private readonly applicationsService: ApplicationsService,
  ) {}

  async create(
    payload: Partial<CreateCandidateDto>,
    source: Candidate['source'] = 'manual',
  ) {
    return this.createOrUpdateSchemaProfile(payload, source);
  }

  async createOrUpdateSchemaProfile(
    payload: Partial<CreateCandidateDto>,
    source: Candidate['source'] = 'manual',
    options: UpsertSchemaOptions = {},
  ) {
    if (!options.skipTransaction && !options.session) {
      return this.runInTransaction((session) =>
        this.createOrUpdateSchemaProfile(payload, source, {
          ...options,
          session,
          skipTransaction: true,
        }),
      );
    }

    const normalized = normalizeTalentProfile(
      payload as Partial<TalentProfile>,
    );
    const externalCandidateId =
      typeof payload.externalCandidateId === 'string' &&
      payload.externalCandidateId.trim()
        ? payload.externalCandidateId.trim()
        : undefined;

    if (
      (!normalized.email || normalized.email === 'unknown@example.com') &&
      !externalCandidateId
    ) {
      throw new BadRequestException(
        'Candidate email or externalCandidateId is required for source schema ingestion',
      );
    }

    const matchFilter = this.resolveIdentityFilter(normalized, externalCandidateId);

    try {
      const candidate = await this.candidateModel
        .findOneAndUpdate(
          matchFilter,
          {
            $set: {
              ...normalized,
              source,
              ...(externalCandidateId ? { externalCandidateId } : {}),
            },
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
            session: options.session,
          },
        )
        .exec();

      await this.sourceProfileModel
        .findOneAndUpdate(
          { candidateId: candidate._id },
          {
            $set: {
              candidateId: candidate._id,
              externalCandidateId,
              schemaData: options.sourceSnapshot ?? this.toPlainObject(payload),
              normalizedSchemaData: normalized,
              source:
                source === 'external-api'
                  ? 'external-api'
                  : source === 'csv' || source === 'xlsx'
                    ? 'spreadsheet-upload'
                    : 'manual-json',
              schemaVersion: 'v1',
              ingestedAt: new Date(),
            },
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
            session: options.session,
          },
        )
        .exec();

      return candidate;
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async createMany(
    payloads: Partial<CreateCandidateDto>[],
    source: Candidate['source'],
    jobExternalId?: string,
  ) {
    if (!payloads.length) {
      return [];
    }

    return this.runInTransaction(async (session) => {
      const candidates: CandidateDocument[] = [];

      for (const payload of payloads) {
        const candidate = await this.createOrUpdateSchemaProfile(payload, source, {
          session,
          skipTransaction: true,
          sourceSnapshot: this.toPlainObject(payload),
        });
        candidates.push(candidate);
      }

      if (jobExternalId) {
        await this.applicationsService.linkCandidatesToJobByExternalId(
          jobExternalId,
          candidates.map((candidate) => String(candidate._id)),
          source === 'csv' || source === 'xlsx' ? 'csv-upload' : 'manual',
          session,
        );
      }

      return candidates;
    });
  }

  async linkCandidateToJobs(
    candidateId: string,
    jobExternalIds: string[] | undefined,
    source: Candidate['source'] = 'manual',
    session?: ClientSession,
  ) {
    const normalizedJobIds = this.normalizeJobExternalIds(jobExternalIds);

    if (!normalizedJobIds.length) {
      return [];
    }

    const applicationSource = this.toApplicationSource(source);

    return Promise.all(
      normalizedJobIds.map((jobExternalId) =>
        this.applicationsService.linkCandidateToJobByExternalId(
          jobExternalId,
          candidateId,
          applicationSource,
          session,
        ),
      ),
    );
  }

  findAll() {
    return this.candidateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const candidate = await this.candidateModel.findById(id).exec();

    if (!candidate) {
      throw new NotFoundException(`Candidate ${id} not found`);
    }

    return candidate;
  }

  async findByIds(ids: string[]) {
    return this.candidateModel.find({ _id: { $in: ids } }).exec();
  }

  async findOneWithParsedProfile(id: string) {
    const candidate = await this.findOne(id);
    const parsedProfile = await this.parsedProfileModel
      .findOne({ candidateId: candidate._id })
      .exec();
    const sourceProfile = await this.sourceProfileModel
      .findOne({ candidateId: candidate._id })
      .exec();

    return {
      candidate,
      sourceProfile,
      parsedProfile,
    };
  }

  async update(id: string, payload: UpdateCandidateDto) {
    const existingCandidate = await this.findOne(id);

    const normalized = normalizeTalentProfile({
      ...(existingCandidate.toObject() as Partial<TalentProfile>),
      ...(payload as Partial<TalentProfile>),
    });

    try {
      const candidate = await this.candidateModel
        .findByIdAndUpdate(
          id,
          {
            ...normalized,
            source: existingCandidate.source,
            externalCandidateId:
              payload.externalCandidateId ?? existingCandidate.externalCandidateId,
          },
          { returnDocument: 'after', runValidators: true },
        )
        .exec();

      if (!candidate) {
        throw new NotFoundException(`Candidate ${id} not found`);
      }

      await this.sourceProfileModel
        .findOneAndUpdate(
          { candidateId: candidate._id },
          {
            $set: {
              candidateId: candidate._id,
              externalCandidateId: candidate.externalCandidateId,
              schemaData: candidate.toObject(),
              normalizedSchemaData: normalizeTalentProfile(
                candidate.toObject() as Partial<TalentProfile>,
              ),
              source: 'manual-json',
              schemaVersion: 'v1',
              ingestedAt: new Date(),
            },
          },
          { upsert: true, new: true },
        )
        .exec();

      return candidate;
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async reparse(
    id: string,
    payload: Partial<TalentProfile>,
    source: Candidate['source'],
  ) {
    const existingCandidate = await this.findOne(id);
    return this.saveParsedProfile(
      String(existingCandidate._id),
      payload,
      source,
    );
  }

  async createFromParsedResume(
    payload: Partial<TalentProfile>,
    source: Candidate['source'],
    options?: { jobExternalId?: string; sourceSnapshot?: Record<string, unknown> },
  ) {
    return this.runInTransaction(async (session) => {
      const normalizedParsed = normalizeTalentProfile(payload);

      if (
        !normalizedParsed.email ||
        normalizedParsed.email === 'unknown@example.com'
      ) {
        throw new BadRequestException(
          'Parsed resume does not contain a valid email. Upload to /candidates/:id/reparse for an existing candidate.',
        );
      }

      const candidate = await this.createOrUpdateSchemaProfile(normalizedParsed, source, {
        session,
        skipTransaction: true,
        sourceSnapshot: options?.sourceSnapshot,
      });

      const parsedProfile = await this.saveParsedProfile(
        String(candidate._id),
        normalizedParsed,
        source,
        session,
      );

      if (options?.jobExternalId) {
        await this.applicationsService.linkCandidateToJobByExternalId(
          options.jobExternalId,
          String(candidate._id),
          'resume-upload',
          session,
        );
      }

      return {
        candidate,
        parsedProfile,
      };
    });
  }

  async saveParsedProfile(
    candidateId: string,
    parsedPayload: Partial<TalentProfile>,
    source = 'resume-pdf',
    session?: ClientSession,
  ) {
    const candidateQuery = this.candidateModel.findById(candidateId);
    if (session) {
      candidateQuery.session(session);
    }
    const candidate = await candidateQuery.exec();

    if (!candidate) {
      throw new NotFoundException(`Candidate ${candidateId} not found`);
    }

    const schemaData = this.extractTalentProfileFromCandidate(candidate);
    const parsedData = normalizeTalentProfile(parsedPayload);
    const mergedProfile = this.buildMergedProfile(schemaData, parsedData);
    const confidenceScore = this.computeConfidenceScore(schemaData, parsedData);

    const parsedProfile = await this.parsedProfileModel
      .findOneAndUpdate(
        { candidateId: candidate._id },
        {
          $set: {
            candidateId: candidate._id,
            parsedData,
            mergedProfile,
            confidenceScore,
            source,
            parserVersion: 'v1',
            parsedAt: new Date(),
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          session,
        },
      )
      .exec();

    return parsedProfile;
  }

  async recomputeCandidateProfile(candidateId: string, session?: ClientSession) {
    const candidateQuery = this.candidateModel.findById(candidateId);
    if (session) {
      candidateQuery.session(session);
    }

    const candidate = await candidateQuery.exec();

    if (!candidate) {
      throw new NotFoundException(`Candidate ${candidateId} not found`);
    }

    const parsedProfileQuery = this.parsedProfileModel.findOne({
      candidateId: candidate._id,
    });
    if (session) {
      parsedProfileQuery.session(session);
    }

    const parsedProfile = await parsedProfileQuery.exec();
    if (!parsedProfile) {
      const normalized = normalizeTalentProfile(
        candidate.toObject() as Partial<TalentProfile>,
      );

      return this.saveParsedProfile(String(candidate._id), normalized, candidate.source, session);
    }

    const schemaData = this.extractTalentProfileFromCandidate(candidate);
    const parsedData = normalizeTalentProfile(
      parsedProfile.parsedData as Partial<TalentProfile>,
    );
    const mergedProfile = this.buildMergedProfile(schemaData, parsedData);
    const confidenceScore = this.computeConfidenceScore(schemaData, parsedData);

    parsedProfile.parsedData = parsedData;
    parsedProfile.mergedProfile = mergedProfile;
    parsedProfile.confidenceScore = confidenceScore;
    parsedProfile.source = parsedProfile.source ?? 'resume-pdf';
    parsedProfile.parserVersion = 'v1';
    parsedProfile.parsedAt = new Date();

    await parsedProfile.save({ session });

    return parsedProfile;
  }

  async remove(id: string) {
    return this.runInTransaction(async (session) => {
      const parsedDeleteQuery = this.parsedProfileModel.deleteOne({
        candidateId: id,
      });
      if (session) {
        parsedDeleteQuery.session(session);
      }
      await parsedDeleteQuery.exec();

      const sourceDeleteQuery = this.sourceProfileModel.deleteOne({
        candidateId: id,
      });
      if (session) {
        sourceDeleteQuery.session(session);
      }
      await sourceDeleteQuery.exec();

      const candidateDeleteQuery = this.candidateModel.findByIdAndDelete(id);
      if (session) {
        candidateDeleteQuery.session(session);
      }
      const candidate = await candidateDeleteQuery.exec();

      if (!candidate) {
        throw new NotFoundException(`Candidate ${id} not found`);
      }

      return {
        success: true,
        deletedId: id,
      };
    });
  }

  private handlePersistenceError(error: unknown): never {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException('A candidate with this email already exists');
    }

    if (error instanceof MongooseError.ValidationError) {
      throw new ConflictException(error.message);
    }

    throw error;
  }

  private extractTalentProfileFromCandidate(
    candidate: CandidateDocument,
  ): TalentProfile {
    return normalizeTalentProfile(candidate.toObject() as Partial<TalentProfile>);
  }

  private buildMergedProfile(
    schemaData: TalentProfile,
    parsedData: TalentProfile,
  ): TalentProfile {
    const pick = (primary: string, secondary: string, fallback = 'Unknown') => {
      if (primary && primary !== 'Unknown' && primary !== 'unknown@example.com') {
        return primary;
      }

      if (secondary && secondary !== 'Unknown' && secondary !== 'unknown@example.com') {
        return secondary;
      }

      return fallback;
    };

    return normalizeTalentProfile({
      firstName: pick(schemaData.firstName, parsedData.firstName),
      lastName: pick(schemaData.lastName, parsedData.lastName),
      email: pick(schemaData.email, parsedData.email, 'unknown@example.com'),
      headline: pick(schemaData.headline, parsedData.headline),
      bio: schemaData.bio ?? parsedData.bio,
      location: pick(schemaData.location, parsedData.location),
      skills: schemaData.skills.length ? schemaData.skills : parsedData.skills,
      languages: schemaData.languages.length
        ? schemaData.languages
        : parsedData.languages,
      experience: schemaData.experience.length
        ? schemaData.experience
        : parsedData.experience,
      education: schemaData.education.length
        ? schemaData.education
        : parsedData.education,
      certifications: schemaData.certifications.length
        ? schemaData.certifications
        : parsedData.certifications,
      projects: schemaData.projects.length ? schemaData.projects : parsedData.projects,
      availability:
        schemaData.availability?.status && schemaData.availability?.type
          ? schemaData.availability
          : parsedData.availability,
      socialLinks: {
        linkedin: schemaData.socialLinks.linkedin ?? parsedData.socialLinks.linkedin,
        github: schemaData.socialLinks.github ?? parsedData.socialLinks.github,
        portfolio: schemaData.socialLinks.portfolio ?? parsedData.socialLinks.portfolio,
      },
    });
  }

  private computeConfidenceScore(
    schemaData: TalentProfile,
    parsedData: TalentProfile,
  ): number {
    let checks = 0;
    let score = 0;

    checks += 1;
    if (
      schemaData.email.toLowerCase() === parsedData.email.toLowerCase() &&
      schemaData.email !== 'unknown@example.com'
    ) {
      score += 1;
    }

    checks += 1;
    const schemaSkills = new Set(schemaData.skills.map((skill) => skill.name.toLowerCase()));
    const parsedSkills = new Set(parsedData.skills.map((skill) => skill.name.toLowerCase()));
    const overlap = [...schemaSkills].filter((skill) => parsedSkills.has(skill)).length;
    const maxSize = Math.max(1, schemaSkills.size);
    score += overlap / maxSize;

    checks += 1;
    if (schemaData.experience.length && parsedData.experience.length) {
      const schemaCompanies = new Set(
        schemaData.experience.map((item) => item.company.toLowerCase()),
      );
      const parsedCompanies = new Set(
        parsedData.experience.map((item) => item.company.toLowerCase()),
      );
      const companyOverlap = [...schemaCompanies].filter((company) =>
        parsedCompanies.has(company),
      ).length;
      score += companyOverlap / Math.max(1, schemaCompanies.size);
    }

    const normalized = score / checks;
    return Math.max(0, Math.min(1, Number(normalized.toFixed(4))));
  }

  private resolveIdentityFilter(
    normalized: TalentProfile,
    externalCandidateId?: string,
  ): Record<string, unknown> {
    if (externalCandidateId && normalized.email !== 'unknown@example.com') {
      return {
        $or: [{ externalCandidateId }, { email: normalized.email }],
      };
    }

    if (externalCandidateId) {
      return { externalCandidateId };
    }

    return { email: normalized.email };
  }

  private toApplicationSource(
    source: Candidate['source'],
  ): 'manual' | 'dummy-seed' | 'external-api' | 'csv-upload' | 'resume-upload' {
    if (source === 'external-api') {
      return 'external-api';
    }

    if (source === 'csv' || source === 'xlsx') {
      return 'csv-upload';
    }

    if (source === 'resume-pdf') {
      return 'resume-upload';
    }

    return 'manual';
  }

  private normalizeJobExternalIds(jobExternalIds?: string[]) {
    if (!Array.isArray(jobExternalIds)) {
      return [];
    }

    return [
      ...new Set(
        jobExternalIds.map((jobId) => jobId?.trim()).filter(Boolean),
      ),
    ] as string[];
  }

  private async runInTransaction<T>(
    callback: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.candidateModel.db.startSession();

    try {
      let value: T | undefined;
      try {
        await session.withTransaction(async () => {
          value = await callback(session);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isStandaloneTransactionError =
          /Transaction numbers are only allowed on a replica set member or mongos/i.test(
            message,
          );

        if (!isStandaloneTransactionError) {
          throw error;
        }

        this.logger.warn(
          'MongoDB transactions are unavailable (standalone mode). Falling back to non-transactional execution.',
        );
        value = await callback(undefined);
      }

      if (value === undefined) {
        throw new BadRequestException('Transaction completed without result');
      }

      return value;
    } finally {
      await session.endSession();
    }
  }

  private toPlainObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {};
    }

    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

}
