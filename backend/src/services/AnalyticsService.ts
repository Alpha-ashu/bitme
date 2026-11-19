import crypto from 'crypto';
import { db } from '../db/Database';
import { AnalyticsEventInput } from '../types';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface TimeSeriesBucket {
  bucket: string;
  dau: number;
  newUsers: number;
  gamesPlayed: number;
  completedGames: number;
  abandonedGames: number;
  avgScore: number;
  gameplayHours: number;
  adImpressions: number;
  adClicks: number;
}

export interface AnalyticsReport {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: {
    newUsers: number;
    activeUsers: number;
    gamesPlayed: number;
    completedGames: number;
    abandonedGames: number;
    completionRate: number;
    abandonmentRate: number;
    avgScore: number;
    highestScore: number;
    totalGameplayHours: number;
    adImpressions: number;
    adClicks: number;
  };
  series: TimeSeriesBucket[];
}

export class AnalyticsService {
  /** Record a real product, gameplay, auth, or story analytics event in SQLite. */
  public static track(input: AnalyticsEventInput & { createdAt?: string }): string {
    const id = `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const createdAt = input.createdAt || new Date().toISOString();
    const conn = db.getRawDb();
    conn.prepare(`
      INSERT INTO analytics_events (
        id, event_type, user_id, session_id, mode, room_id, duration_seconds, score, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.eventType,
      input.userId || null,
      input.sessionId || null,
      input.mode || null,
      input.roomId || null,
      input.durationSeconds ?? null,
      input.score ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt
    );
    if (input.userId) {
      db.touchUserActivity(input.userId);
    }
    return id;
  }

  private static startOfUtcDayIso(date: Date = new Date()): string {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)).toISOString();
  }

  private static daysAgoIso(days: number, now: Date = new Date()): string {
    return new Date(now.getTime() - days * 86_400_000).toISOString();
  }

  /** Build comprehensive User Analytics purely from recorded database state & events. */
  public static getUserAnalytics() {
    const conn = db.getRawDb();
    const now = new Date();
    const todayStart = this.startOfUtcDayIso(now);
    const weekAgo = this.daysAgoIso(7, now);
    const monthAgo = this.daysAgoIso(30, now);

    const counts = conn.prepare(`
      SELECT
        COUNT(CASE WHEN role = 'player' THEN 1 END) AS total_players,
        COUNT(CASE WHEN role = 'player' AND is_guest = 0 THEN 1 END) AS total_registered,
        COUNT(CASE WHEN role = 'player' AND is_guest = 1 THEN 1 END) AS total_guests,
        COUNT(CASE WHEN role = 'player' AND status = 'active' THEN 1 END) AS active_accounts,
        COUNT(CASE WHEN role IN ('admin', 'super_admin') THEN 1 END) AS total_admins,
        COUNT(CASE WHEN role = 'player' AND created_at >= ? THEN 1 END) AS new_today,
        COUNT(CASE WHEN role = 'player' AND created_at >= ? THEN 1 END) AS new_week,
        COUNT(CASE WHEN role = 'player' AND created_at >= ? THEN 1 END) AS new_month
      FROM users
    `).get(todayStart, weekAgo, monthAgo) as any;

    const activeDistinct = (sinceIso: string): number => {
      const r = conn.prepare(`
        SELECT COUNT(DISTINCT uid) AS cnt FROM (
          SELECT user_id AS uid FROM analytics_events WHERE user_id IS NOT NULL AND created_at >= ?
          UNION
          SELECT user_id AS uid FROM match_history WHERE created_at >= ?
          UNION
          SELECT id AS uid FROM users WHERE role = 'player' AND last_active_at >= ?
        )
      `).get(sinceIso, sinceIso, sinceIso) as { cnt: number };
      return r?.cnt || 0;
    };

    const dau = activeDistinct(todayStart);
    const wau = activeDistinct(weekAgo);
    const mau = activeDistinct(monthAgo);

    const returningRow = conn.prepare(`
      SELECT COUNT(*) AS cnt FROM (
        SELECT uid, MIN(act_day) AS first_day, COUNT(DISTINCT act_day) AS days_count
        FROM (
          SELECT user_id AS uid, substr(created_at, 1, 10) AS act_day FROM analytics_events WHERE user_id IS NOT NULL AND created_at >= ?
          UNION ALL
          SELECT user_id AS uid, substr(created_at, 1, 10) AS act_day FROM match_history WHERE created_at >= ?
        ) t
        JOIN users u ON u.id = t.uid AND u.role = 'player'
        GROUP BY uid
        HAVING days_count >= 2 OR substr(u.created_at, 1, 10) < MAX(act_day)
      )
    `).get(monthAgo, monthAgo) as { cnt: number };

    const returningUsers = returningRow?.cnt || 0;
    const totalPlayers = counts?.total_players || 0;
    const inactiveUsers = Math.max(0, totalPlayers - mau);

    return {
      totalUsers: totalPlayers,
      totalRegisteredUsers: counts?.total_registered || 0,
      totalGuests: counts?.total_guests || 0,
      totalAdmins: counts?.total_admins || 0,
      totalActiveUsers: mau,
      activeAccounts: counts?.active_accounts || 0,
      newUsersToday: counts?.new_today || 0,
      newUsersThisWeek: counts?.new_week || 0,
      newUsersThisMonth: counts?.new_month || 0,
      dau,
      wau,
      mau,
      returningUsers,
      inactiveUsers,
    };
  }

  /** Build Gameplay Analytics purely from match_history & analytics_events. */
  public static getGameplayAnalytics(startIso?: string, endIso?: string) {
    const conn = db.getRawDb();
    const whereParts: string[] = [];
    const params: any[] = [];
    if (startIso) { whereParts.push('created_at >= ?'); params.push(startIso); }
    if (endIso) { whereParts.push('created_at <= ?'); params.push(endIso); }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const matchAgg = conn.prepare(`
      SELECT
        COUNT(*) AS total_matches,
        COUNT(CASE WHEN abandoned = 0 THEN 1 END) AS completed_matches,
        COUNT(CASE WHEN abandoned = 1 THEN 1 END) AS abandoned_matches,
        COUNT(DISTINCT user_id) AS distinct_players,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds,
        COALESCE(AVG(duration_seconds), 0) AS avg_duration,
        COALESCE(AVG(score), 0) AS avg_score,
        COALESCE(MAX(score), 0) AS highest_score
      FROM match_history
      ${whereSql}
    `).get(...params) as any;

    const sessionRow = conn.prepare(`
      SELECT
        COUNT(CASE WHEN event_type = 'session_start' THEN 1 END) AS session_starts,
        COUNT(CASE WHEN event_type = 'match_abandon' THEN 1 END) AS extra_abandons,
        AVG(CASE WHEN event_type = 'session_end' AND duration_seconds IS NOT NULL THEN duration_seconds END) AS avg_session_sec
      FROM analytics_events
      ${whereSql}
    `).get(...params) as any;

    const modeRows = conn.prepare(`
      SELECT
        mode,
        COUNT(*) AS games,
        COUNT(CASE WHEN abandoned = 0 THEN 1 END) AS completed,
        COUNT(CASE WHEN abandoned = 1 THEN 1 END) AS abandoned,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds,
        COALESCE(AVG(score), 0) AS avg_score,
        COALESCE(MAX(score), 0) AS highest_score
      FROM match_history
      ${whereSql}
      GROUP BY mode
      ORDER BY games DESC
    `).all(...params) as any[];

    const totalMatches = matchAgg?.total_matches || 0;
    const completedGames = matchAgg?.completed_matches || 0;
    const abandonedGames = (matchAgg?.abandoned_matches || 0);
    const totalGameplaySessions = Math.max(sessionRow?.session_starts || 0, totalMatches);
    const avgSessionDurationSeconds = Math.round((sessionRow?.avg_session_sec ?? matchAgg?.avg_duration ?? 0) * 10) / 10;
    const totalGameplayHours = Math.round(((matchAgg?.total_seconds || 0) / 3600) * 100) / 100;
    const distinctPlayers = matchAgg?.distinct_players || 0;
    const avgGamesPerUser = distinctPlayers > 0 ? Math.round((totalMatches / distinctPlayers) * 100) / 100 : 0;

    const storyModes = new Set(['explorer', 'story', 'free_roam', 'boss']);
    const gameModes = new Set(['classic', 'nokia', 'endless', 'event']);
    const multiplayerModes = new Set(['battle_royale', 'team']);

    let storyModeUsage = 0;
    let gameModeUsage = 0;
    let multiplayerModeUsage = 0;

    const modeBreakdown = modeRows.map(r => {
      const m = String(r.mode || 'unknown');
      if (storyModes.has(m)) storyModeUsage += r.games;
      else if (multiplayerModes.has(m)) multiplayerModeUsage += r.games;
      else if (gameModes.has(m)) gameModeUsage += r.games;
      else gameModeUsage += r.games;

      return {
        mode: m,
        games: r.games,
        completed: r.completed,
        abandoned: r.abandoned,
        avgScore: Math.round(r.avg_score || 0),
        highestScore: r.highest_score || 0,
        hours: Math.round(((r.total_seconds || 0) / 3600) * 100) / 100,
      };
    });

    const denominator = totalMatches > 0 ? totalMatches : 0;
    const completionRate = denominator > 0 ? Math.round((completedGames / denominator) * 1000) / 10 : 0;
    const abandonmentRate = denominator > 0 ? Math.round((abandonedGames / denominator) * 1000) / 10 : 0;

    return {
      totalGamesPlayed: totalMatches,
      completedGames,
      abandonedGames,
      extraSocketAbandons: sessionRow?.extra_abandons || 0,
      totalGameplaySessions,
      avgSessionDurationSeconds,
      totalGameplayHours,
      avgGamesPerUser,
      distinctPlayers,
      mostPopularMode: modeBreakdown[0]?.mode || 'none',
      storyModeUsage,
      gameModeUsage,
      multiplayerModeUsage,
      completionRate,
      abandonmentRate,
      avgScore: Math.round(matchAgg?.avg_score || 0),
      highestScore: matchAgg?.highest_score || 0,
      modeBreakdown,
    };
  }

  /** Compute real cohort Day 1, Day 7, Day 30 retention & new vs returning split. */
  public static getRetentionAnalytics() {
    const conn = db.getRawDb();
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);

    // Collect distinct active dates per player from real activity tables
    const activityRows = conn.prepare(`
      SELECT user_id, substr(created_at, 1, 10) AS day FROM analytics_events WHERE user_id IS NOT NULL
      UNION
      SELECT user_id, substr(created_at, 1, 10) AS day FROM match_history
      UNION
      SELECT id AS user_id, substr(last_active_at, 1, 10) AS day FROM users WHERE last_active_at IS NOT NULL
    `).all() as Array<{ user_id: string; day: string }>;

    const daysByUser = new Map<string, Set<string>>();
    for (const r of activityRows) {
      if (!r.user_id || !r.day) continue;
      let set = daysByUser.get(r.user_id);
      if (!set) { set = new Set(); daysByUser.set(r.user_id, set); }
      set.add(r.day);
    }

    const users = conn.prepare(`SELECT id, created_at FROM users WHERE role = 'player'`).all() as Array<{ id: string; created_at: string }>;

    const addDays = (dateStr: string, offset: number): string => {
      const d = new Date(`${dateStr}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    };

    let d1Eligible = 0, d1Retained = 0;
    let d7Eligible = 0, d7Retained = 0;
    let d30Eligible = 0, d30Retained = 0;

    let recentActiveTotal = 0;
    let recentNewPlayers = 0;
    let recentReturningPlayers = 0;
    const sevenDaysAgo = this.daysAgoIso(7, now).slice(0, 10);

    for (const u of users) {
      const regDay = (u.created_at || todayDate).slice(0, 10);
      const actDays = daysByUser.get(u.id) || new Set<string>();

      const d1Target = addDays(regDay, 1);
      if (d1Target <= todayDate) {
        d1Eligible++;
        if (actDays.has(d1Target)) d1Retained++;
      }

      const d7Target = addDays(regDay, 7);
      if (d7Target <= todayDate) {
        d7Eligible++;
        if (actDays.has(d7Target)) d7Retained++;
      }

      const d30Target = addDays(regDay, 30);
      if (d30Target <= todayDate) {
        d30Eligible++;
        if (actDays.has(d30Target)) d30Retained++;
      }

      // Active in last 7 days split into New vs Returning
      const activeRecently = Array.from(actDays).some(d => d >= sevenDaysAgo);
      if (activeRecently) {
        recentActiveTotal++;
        if (regDay >= sevenDaysAgo && actDays.size <= 1) {
          recentNewPlayers++;
        } else {
          recentReturningPlayers++;
        }
      }
    }

    const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

    return {
      day1Retention: pct(d1Retained, d1Eligible),
      day7Retention: pct(d7Retained, d7Eligible),
      day30Retention: pct(d30Retained, d30Eligible),
      cohorts: {
        day1: { eligible: d1Eligible, retained: d1Retained, rate: pct(d1Retained, d1Eligible) },
        day7: { eligible: d7Eligible, retained: d7Retained, rate: pct(d7Retained, d7Eligible) },
        day30: { eligible: d30Eligible, retained: d30Retained, rate: pct(d30Retained, d30Eligible) },
      },
      returningPlayerPercentage: pct(recentReturningPlayers, recentActiveTotal),
      newPlayersCount: recentNewPlayers,
      returningPlayersCount: recentReturningPlayers,
      activeSampleSize: recentActiveTotal,
    };
  }

  /** Build complete admin overview bundle (Users + Gameplay + Retention). */
  public static getOverview() {
    return {
      users: this.getUserAnalytics(),
      gameplay: this.getGameplayAnalytics(),
      retention: this.getRetentionAnalytics(),
    };
  }

  /** Generate Daily, Weekly, Monthly, Yearly, or Custom date-range time-series reports. */
  public static getReport(period: ReportPeriod, startDate?: string, endDate?: string): AnalyticsReport {
    const now = new Date();
    const endDt = endDate ? new Date(`${endDate.slice(0, 10)}T23:59:59.999Z`) : now;
    let startDt: Date;

    if (startDate && period === 'custom') {
      startDt = new Date(`${startDate.slice(0, 10)}T00:00:00.000Z`);
    } else if (period === 'daily') {
      startDt = new Date(Date.UTC(endDt.getUTCFullYear(), endDt.getUTCMonth(), endDt.getUTCDate(), 0, 0, 0, 0));
    } else if (period === 'weekly') {
      startDt = new Date(endDt.getTime() - 6 * 86_400_000);
      startDt = new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth(), startDt.getUTCDate(), 0, 0, 0, 0));
    } else if (period === 'monthly') {
      startDt = new Date(endDt.getTime() - 29 * 86_400_000);
      startDt = new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth(), startDt.getUTCDate(), 0, 0, 0, 0));
    } else if (period === 'yearly') {
      startDt = new Date(Date.UTC(endDt.getUTCFullYear() - 1, endDt.getUTCMonth(), 1, 0, 0, 0, 0));
    } else {
      startDt = new Date(endDt.getTime() - 6 * 86_400_000);
    }

    if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime())) {
      startDt = new Date(now.getTime() - 6 * 86_400_000);
    }

    const startIso = startDt.toISOString();
    const endIso = endDt.toISOString();
    const groupFmt = period === 'yearly' ? 7 : 10; // 'YYYY-MM' vs 'YYYY-MM-DD'

    const conn = db.getRawDb();
    const newUserRows = conn.prepare(`
      SELECT substr(created_at, 1, ?) AS b, COUNT(*) AS cnt
      FROM users
      WHERE role = 'player' AND created_at >= ? AND created_at <= ?
      GROUP BY b
    `).all(groupFmt, startIso, endIso) as Array<{ b: string; cnt: number }>;

    const dauRows = conn.prepare(`
      SELECT b, COUNT(DISTINCT uid) AS cnt FROM (
        SELECT substr(created_at, 1, ?) AS b, user_id AS uid FROM analytics_events WHERE user_id IS NOT NULL AND created_at >= ? AND created_at <= ?
        UNION
        SELECT substr(created_at, 1, ?) AS b, user_id AS uid FROM match_history WHERE created_at >= ? AND created_at <= ?
      )
      GROUP BY b
    `).all(groupFmt, startIso, endIso, groupFmt, startIso, endIso) as Array<{ b: string; cnt: number }>;

    const matchRows = conn.prepare(`
      SELECT
        substr(created_at, 1, ?) AS b,
        COUNT(*) AS games,
        COUNT(CASE WHEN abandoned = 0 THEN 1 END) AS completed,
        COUNT(CASE WHEN abandoned = 1 THEN 1 END) AS abandoned,
        COALESCE(AVG(score), 0) AS avg_score,
        COALESCE(MAX(score), 0) AS max_score,
        COALESCE(SUM(duration_seconds), 0) AS total_sec
      FROM match_history
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY b
    `).all(groupFmt, startIso, endIso) as Array<{
      b: string; games: number; completed: number; abandoned: number; avg_score: number; max_score: number; total_sec: number;
    }>;

    const adRows = conn.prepare(`
      SELECT
        substr(created_at, 1, ?) AS b,
        COUNT(CASE WHEN event_type = 'impression' THEN 1 END) AS impressions,
        COUNT(CASE WHEN event_type = 'click' THEN 1 END) AS clicks
      FROM ad_events
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY b
    `).all(groupFmt, startIso, endIso) as Array<{ b: string; impressions: number; clicks: number }>;

    // Enumerate every bucket in the range so charts have zero gaps
    const buckets: string[] = [];
    if (period === 'yearly') {
      const cur = new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth(), 1));
      const endM = new Date(Date.UTC(endDt.getUTCFullYear(), endDt.getUTCMonth(), 1));
      while (cur <= endM && buckets.length < 36) {
        buckets.push(cur.toISOString().slice(0, 7));
        cur.setUTCMonth(cur.getUTCMonth() + 1);
      }
    } else {
      const cur = new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth(), startDt.getUTCDate()));
      const endD = new Date(Date.UTC(endDt.getUTCFullYear(), endDt.getUTCMonth(), endDt.getUTCDate()));
      while (cur <= endD && buckets.length < 400) {
        buckets.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    const newMap = new Map(newUserRows.map(r => [r.b, r.cnt]));
    const dauMap = new Map(dauRows.map(r => [r.b, r.cnt]));
    const matchMap = new Map(matchRows.map(r => [r.b, r]));
    const adMap = new Map(adRows.map(r => [r.b, r]));

    let sumNew = 0, sumGames = 0, sumComp = 0, sumAband = 0, sumSec = 0, sumImpr = 0, sumClicks = 0;
    let weightedScoreSum = 0, maxScore = 0;

    const series: TimeSeriesBucket[] = buckets.map(bucket => {
      const newUsers = newMap.get(bucket) || 0;
      const dau = dauMap.get(bucket) || 0;
      const m = matchMap.get(bucket);
      const ad = adMap.get(bucket);

      const gamesPlayed = m?.games || 0;
      const completedGames = m?.completed || 0;
      const abandonedGames = m?.abandoned || 0;
      const avgScore = Math.round(m?.avg_score || 0);
      const gameplayHours = Math.round(((m?.total_sec || 0) / 3600) * 100) / 100;
      const adImpressions = ad?.impressions || 0;
      const adClicks = ad?.clicks || 0;

      sumNew += newUsers;
      sumGames += gamesPlayed;
      sumComp += completedGames;
      sumAband += abandonedGames;
      sumSec += m?.total_sec || 0;
      weightedScoreSum += (m?.avg_score || 0) * gamesPlayed;
      if ((m?.max_score || 0) > maxScore) maxScore = m!.max_score;
      sumImpr += adImpressions;
      sumClicks += adClicks;

      return {
        bucket,
        dau,
        newUsers,
        gamesPlayed,
        completedGames,
        abandonedGames,
        avgScore,
        gameplayHours,
        adImpressions,
        adClicks,
      };
    });

    const activeRow = conn.prepare(`
      SELECT COUNT(DISTINCT uid) AS cnt FROM (
        SELECT user_id AS uid FROM analytics_events WHERE user_id IS NOT NULL AND created_at >= ? AND created_at <= ?
        UNION
        SELECT user_id AS uid FROM match_history WHERE created_at >= ? AND created_at <= ?
      )
    `).get(startIso, endIso, startIso, endIso) as { cnt: number };

    return {
      period,
      startDate: startIso.slice(0, 10),
      endDate: endIso.slice(0, 10),
      generatedAt: now.toISOString(),
      summary: {
        newUsers: sumNew,
        activeUsers: activeRow?.cnt || 0,
        gamesPlayed: sumGames,
        completedGames: sumComp,
        abandonedGames: sumAband,
        completionRate: sumGames > 0 ? Math.round((sumComp / sumGames) * 1000) / 10 : 0,
        abandonmentRate: sumGames > 0 ? Math.round((sumAband / sumGames) * 1000) / 10 : 0,
        avgScore: sumGames > 0 ? Math.round(weightedScoreSum / sumGames) : 0,
        highestScore: maxScore,
        totalGameplayHours: Math.round((sumSec / 3600) * 100) / 100,
        adImpressions: sumImpr,
        adClicks: sumClicks,
      },
      series,
    };
  }

  private static csvCell(v: string | number): string {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /** Export an analytics report as an RFC-4180 safe CSV document. */
  public static toCsv(report: AnalyticsReport): string {
    const lines: string[] = [];
    lines.push(['Period', report.period, 'Start', report.startDate, 'End', report.endDate, 'Generated At', report.generatedAt].map(c => this.csvCell(c)).join(','));
    lines.push('');
    lines.push(['Bucket', 'DAU', 'New Users', 'Games Played', 'Completed Games', 'Abandoned Games', 'Avg Score', 'Gameplay Hours', 'Ad Impressions', 'Ad Clicks'].join(','));
    for (const row of report.series) {
      lines.push([
        row.bucket,
        row.dau,
        row.newUsers,
        row.gamesPlayed,
        row.completedGames,
        row.abandonedGames,
        row.avgScore,
        row.gameplayHours,
        row.adImpressions,
        row.adClicks,
      ].map(c => this.csvCell(c)).join(','));
    }
    lines.push('');
    lines.push(['TOTAL/SUMMARY', report.summary.activeUsers, report.summary.newUsers, report.summary.gamesPlayed, report.summary.completedGames, report.summary.abandonedGames, report.summary.avgScore, report.summary.totalGameplayHours, report.summary.adImpressions, report.summary.adClicks].map(c => this.csvCell(c)).join(','));
    return lines.join('\r\n');
  }

  /** Real RPG, Quest, Educational Quiz, Boss, and Team Multiplayer analytics computed strictly from SQLite records. */
  public static getRpgAnalytics() {
    const conn = db.getRawDb();
    const countEvent = (type: string): number => {
      const r = conn.prepare('SELECT COUNT(*) AS cnt FROM analytics_events WHERE event_type = ?').get(type) as { cnt: number };
      return r?.cnt || 0;
    };

    const advStarted = countEvent('adventure_level_start');
    const advCompleted = countEvent('adventure_level_complete');
    const advFailed = countEvent('adventure_level_fail');
    const advAbandoned = countEvent('adventure_level_abandon');
    const campStats = conn.prepare(`
      SELECT COUNT(*) AS players, AVG(adventure_level) AS avg_level, MAX(adventure_level) AS max_level
      FROM player_campaign_progress
    `).get() as any;

    const npcEncounters = countEvent('npc_encounter');
    const questOffers = countEvent('quest_offer');
    const questAccepts = countEvent('quest_accept');
    const questLaters = countEvent('quest_later');
    const questSkips = countEvent('quest_skip');
    const questCompletes = countEvent('quest_complete');
    const questFails = countEvent('quest_fail');
    const questClaims = countEvent('quest_claim');
    const questAvg = conn.prepare(`
      SELECT AVG(attempts) AS avg_attempts FROM quest_sessions WHERE state IN ('CLAIMABLE', 'CLAIMED')
    `).get() as any;

    const quizStats = conn.prepare(`
      SELECT
        COUNT(*) AS total_attempts,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_attempts,
        AVG(response_ms) AS avg_response_ms,
        COUNT(DISTINCT question_id) AS unique_questions
      FROM question_attempts
    `).get() as any;

    const quizByCategory = conn.prepare(`
      SELECT qb.category, COUNT(*) AS attempts,
             SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
             AVG(qa.response_ms) AS avg_ms
      FROM question_attempts qa
      JOIN question_bank qb ON qb.question_id = qa.question_id
      GROUP BY qb.category
    `).all() as any[];

    const quizByDifficulty = conn.prepare(`
      SELECT difficulty, COUNT(*) AS attempts,
             SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct
      FROM question_attempts
      GROUP BY difficulty ORDER BY difficulty
    `).all() as any[];

    const bossAttempts = countEvent('boss_attempt');
    const bossVictories = countEvent('boss_victory');
    const bossFails = countEvent('boss_fail');
    const bossMilestoneAbandons = countEvent('boss_milestone_abandon');

    const teamCaptures = countEvent('team_zone_capture');
    const teamRelics = countEvent('team_relic_deliver');
    const privateCreated = countEvent('private_room_create');
    const privateInvites = countEvent('private_room_invite');
    const privateJoins = countEvent('private_room_join');

    const totalQuiz = quizStats?.total_attempts || 0;
    const correctQuiz = quizStats?.correct_attempts || 0;

    return {
      adventure: {
        levelsStarted: advStarted,
        levelsCompleted: advCompleted,
        levelsFailed: advFailed,
        levelsAbandoned: advAbandoned,
        completionRate: advStarted > 0 ? Math.round((advCompleted / advStarted) * 1000) / 10 : 0,
        trackedPlayers: campStats?.players || 0,
        avgAdventureLevel: Math.round((campStats?.avg_level || 1) * 10) / 10,
        highestAdventureLevel: campStats?.max_level || 1,
        campaignCompletionPct: Math.round(((campStats?.avg_level || 1) / 1000) * 10000) / 100,
      },
      quests: {
        npcEncounters,
        popupImpressions: questOffers,
        accepted: questAccepts,
        later: questLaters,
        skipped: questSkips,
        completed: questCompletes,
        failed: questFails,
        claimed: questClaims,
        acceptanceRate: questOffers > 0 ? Math.round((questAccepts / questOffers) * 1000) / 10 : 0,
        completionRate: questAccepts > 0 ? Math.round((questCompletes / questAccepts) * 1000) / 10 : 0,
        avgAttempts: Math.round((questAvg?.avg_attempts || 0) * 100) / 100,
      },
      educational: {
        totalAttempts: totalQuiz,
        correctAttempts: correctQuiz,
        incorrectAttempts: Math.max(0, totalQuiz - correctQuiz),
        accuracyPct: totalQuiz > 0 ? Math.round((correctQuiz / totalQuiz) * 1000) / 10 : 0,
        avgResponseMs: Math.round(quizStats?.avg_response_ms || 0),
        uniqueQuestionsServed: quizStats?.unique_questions || 0,
        byCategory: quizByCategory.map(r => ({
          category: r.category,
          attempts: r.attempts,
          accuracyPct: r.attempts > 0 ? Math.round((r.correct / r.attempts) * 1000) / 10 : 0,
          avgResponseMs: Math.round(r.avg_ms || 0),
        })),
        byDifficulty: quizByDifficulty.map(r => ({
          difficulty: r.difficulty,
          attempts: r.attempts,
          accuracyPct: r.attempts > 0 ? Math.round((r.correct / r.attempts) * 1000) / 10 : 0,
        })),
      },
      bosses: {
        attempts: bossAttempts,
        victories: bossVictories,
        failures: bossFails,
        milestoneAbandonments: bossMilestoneAbandons,
        avgAttemptsPerVictory: bossVictories > 0 ? Math.round((bossAttempts / bossVictories) * 100) / 100 : 0,
      },
      multiplayerObjectives: {
        teamZoneCaptures: teamCaptures,
        teamRelicsDelivered: teamRelics,
        privateRoomsCreated: privateCreated,
        privateInvitesSent: privateInvites,
        privateRoomJoins: privateJoins,
      },
    };
  }
}

