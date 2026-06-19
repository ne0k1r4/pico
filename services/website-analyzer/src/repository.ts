import pg from "pg";
import type { WebsiteProfile } from "./types";

export interface AnalysisRepository {
  save(profile: WebsiteProfile): Promise<void>;
}

export class PostgresAnalysisRepository implements AnalysisRepository {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });
  }

  async save(profile: WebsiteProfile): Promise<void> {
    await this.pool.query(
      `
      insert into website_analyses (
        url,
        final_url,
        origin,
        title,
        name,
        description,
        theme_color,
        favicon_url,
        profile,
        analyzed_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      on conflict (url)
      do update set
        final_url = excluded.final_url,
        origin = excluded.origin,
        title = excluded.title,
        name = excluded.name,
        description = excluded.description,
        theme_color = excluded.theme_color,
        favicon_url = excluded.favicon_url,
        profile = excluded.profile,
        analyzed_at = excluded.analyzed_at,
        updated_at = now()
      `,
      [
        profile.url,
        profile.finalUrl,
        profile.origin,
        profile.title,
        profile.name,
        profile.description,
        profile.themeColor,
        profile.favicon,
        profile,
        profile.analyzedAt
      ]
    );
  }
}

export class NoopAnalysisRepository implements AnalysisRepository {
  async save(_profile: WebsiteProfile): Promise<void> {
    return;
  }
}
