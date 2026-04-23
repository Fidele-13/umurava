export const SKILL_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
] as const;

export const LANGUAGE_PROFICIENCIES = [
  'Basic',
  'Conversational',
  'Fluent',
  'Native',
] as const;

export const AVAILABILITY_STATUSES = [
  'Available',
  'Open to Opportunities',
  'Not Available',
] as const;

export const AVAILABILITY_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];
export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCIES)[number];
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];
export type AvailabilityType = (typeof AVAILABILITY_TYPES)[number];

export interface Skill {
  name: string;
  level: SkillLevel;
  yearsOfExperience: number;
}

export interface Language {
  name: string;
  proficiency: LanguageProficiency;
}

export interface Experience {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  technologies: string[];
  isCurrent: boolean;
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: number;
  endYear: number;
}

export interface Certification {
  name: string;
  issuer: string;
  issueDate: string;
}

export interface Project {
  name: string;
  description: string;
  technologies: string[];
  role: string;
  link: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface Availability {
  status: AvailabilityStatus;
  type: AvailabilityType;
  startDate: string | null;
}

export interface SocialLinks {
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
}

export interface TalentProfile {
  firstName: string;
  lastName: string;
  email: string;
  headline: string;
  bio: string | null;
  location: string;
  skills: Skill[];
  languages: Language[];
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
  availability: Availability;
  socialLinks: SocialLinks;
}

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function clampNonNegativeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return fallback;
}

function asEnumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === 'string' && allowed.includes(value)
    ? (value as T[number])
    : fallback;
}

function asYear(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d{4}$/.test(value.trim())) {
    return Number(value.trim());
  }

  return 0;
}

export function defaultTalentProfile(): TalentProfile {
  return {
    firstName: 'Unknown',
    lastName: 'Unknown',
    email: 'unknown@example.com',
    headline: 'Unknown',
    bio: null,
    location: 'Unknown',
    skills: [],
    languages: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    availability: {
      status: 'Open to Opportunities',
      type: 'Full-time',
      startDate: null,
    },
    socialLinks: {
      linkedin: null,
      github: null,
      portfolio: null,
    },
  };
}

export function normalizeTalentProfile(
  input: Partial<TalentProfile> | null | undefined,
): TalentProfile {
  const defaults = defaultTalentProfile();

  const skills = Array.isArray(input?.skills)
    ? input.skills
        .map((skill) => ({
          name: asNonEmptyString(skill?.name, ''),
          level: asEnumValue(skill?.level, SKILL_LEVELS, 'Intermediate'),
          yearsOfExperience: clampNonNegativeNumber(
            skill?.yearsOfExperience,
            0,
          ),
        }))
        .filter((skill) => Boolean(skill.name))
    : [];

  const languages = Array.isArray(input?.languages)
    ? input.languages
        .map((language) => ({
          name: asNonEmptyString(language?.name, ''),
          proficiency: asEnumValue(
            language?.proficiency,
            LANGUAGE_PROFICIENCIES,
            'Conversational',
          ),
        }))
        .filter((language) => Boolean(language.name))
    : [];

  const experience = Array.isArray(input?.experience)
    ? input.experience
        .map((item) => ({
          company: asNonEmptyString(item?.company, ''),
          role: asNonEmptyString(item?.role, ''),
          startDate: asNonEmptyString(item?.startDate, 'Unknown'),
          endDate:
            item?.endDate === 'Present'
              ? 'Present'
              : asNonEmptyString(item?.endDate, 'Unknown'),
          description: asNonEmptyString(item?.description, ''),
          technologies: asStringArray(item?.technologies),
          isCurrent:
            typeof item?.isCurrent === 'boolean'
              ? item.isCurrent
              : item?.endDate === 'Present',
        }))
        .filter((item) => Boolean(item.company && item.role))
    : [];

  const education = Array.isArray(input?.education)
    ? input.education
        .map((item) => ({
          institution: asNonEmptyString(item?.institution, ''),
          degree: asNonEmptyString(item?.degree, 'Unknown'),
          fieldOfStudy: asNonEmptyString(item?.fieldOfStudy, 'Unknown'),
          startYear: asYear(item?.startYear),
          endYear: asYear(item?.endYear),
        }))
        .filter((item) => Boolean(item.institution))
    : [];

  const certifications = Array.isArray(input?.certifications)
    ? input.certifications
        .map((item) => ({
          name: asNonEmptyString(item?.name, ''),
          issuer: asNonEmptyString(item?.issuer, 'Unknown'),
          issueDate: asNonEmptyString(item?.issueDate, 'Unknown'),
        }))
        .filter((item) => Boolean(item.name))
    : [];

  const projects = Array.isArray(input?.projects)
    ? input.projects
        .map((item) => ({
          name: asNonEmptyString(item?.name, ''),
          description: asNonEmptyString(item?.description, 'Unknown'),
          technologies: asStringArray(item?.technologies),
          role: asNonEmptyString(item?.role, 'Unknown'),
          link: asNullableString(item?.link),
          startDate: asNullableString(item?.startDate),
          endDate: asNullableString(item?.endDate),
        }))
        .filter((item) => Boolean(item.name))
    : [];

  return {
    firstName: asNonEmptyString(input?.firstName, defaults.firstName),
    lastName: asNonEmptyString(input?.lastName, defaults.lastName),
    email: asNonEmptyString(input?.email, defaults.email),
    headline: asNonEmptyString(input?.headline, defaults.headline),
    bio: asNullableString(input?.bio),
    location: asNonEmptyString(input?.location, defaults.location),
    skills,
    languages,
    experience,
    education,
    certifications,
    projects,
    availability: {
      status: asEnumValue(
        input?.availability?.status,
        AVAILABILITY_STATUSES,
        defaults.availability.status,
      ),
      type: asEnumValue(
        input?.availability?.type,
        AVAILABILITY_TYPES,
        defaults.availability.type,
      ),
      startDate: asNullableString(input?.availability?.startDate),
    },
    socialLinks: {
      linkedin: asNullableString(input?.socialLinks?.linkedin),
      github: asNullableString(input?.socialLinks?.github),
      portfolio: asNullableString(input?.socialLinks?.portfolio),
    },
  };
}
