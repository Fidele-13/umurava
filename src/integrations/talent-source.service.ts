import { Injectable } from '@nestjs/common';

@Injectable()
export class TalentSourceService {
  async fetchStructuredProfiles() {
    return {
      source: 'placeholder-external-api',
      profiles: [],
      note: 'Replace this service with the real upstream API integration when available.',
    };
  }
}
