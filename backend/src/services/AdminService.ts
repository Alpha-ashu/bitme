import os from 'os';
import { db } from '../db/Database';
import { AdminTelemetry } from '../types';

export class AdminService {
  private static lastCpuUsage = process.cpuUsage();
  private static lastCpuAt = process.hrtime.bigint();
  private static cachedCpuPercent = 0;

  private static measureCpuPercent(): number {
    const now = process.hrtime.bigint();
    const elapsedNs = Number(now - this.lastCpuAt);
    if (elapsedNs >= 500_000_000) { // update at most every 500ms
      const delta = process.cpuUsage(this.lastCpuUsage);
      const totalCpuUs = delta.user + delta.system;
      const elapsedUs = elapsedNs / 1000;
      const cores = Math.max(1, os.cpus().length);
      const pct = (totalCpuUs / (elapsedUs * cores)) * 100;
      this.cachedCpuPercent = Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
      this.lastCpuUsage = process.cpuUsage();
      this.lastCpuAt = now;
    }
    return this.cachedCpuPercent;
  }

  public static getTelemetry(
    activeMatchesCount: number,
    connectedPlayersCount: number,
    onlinePresentCount?: number,
    avgTickMs?: number
  ): AdminTelemetry {
    const mem = process.memoryUsage();
    const totalOnline = onlinePresentCount ?? connectedPlayersCount;
    return {
      activeInstances: 1,
      activeMatches: activeMatchesCount,
      activeSockets: connectedPlayersCount,
      connectedPlayers: connectedPlayersCount,
      totalPlayersOnline: totalOnline,
      serverTickRateHz: 30,
      serverTickMs: avgTickMs !== undefined ? Math.round(avgTickMs * 100) / 100 : 0,
      cpuUsagePercent: this.measureCpuPercent(),
      memoryUsageMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      antiCheatFlagsCount: db.getAuditLogs().length,
      uptimeSeconds: Math.floor(process.uptime()),
    } as AdminTelemetry;
  }

  public static getAuditLogs() {
    return db.getAuditLogs();
  }

  public static getAdminAuditLogs(limit = 100) {
    return db.getAdminAuditLogs(limit);
  }
}
