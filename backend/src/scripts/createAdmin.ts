import bcrypt from 'bcryptjs';
import readline from 'readline';
import { db } from '../db/Database';
import { UserRole } from '../types';

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  const eq = process.argv.find(a => a.startsWith(`${flag}=`));
  return eq ? eq.slice(flag.length + 1) : undefined;
}

function promptQuestion(rl: readline.Interface, q: string): Promise<string> {
  return new Promise(resolve => rl.question(q, ans => resolve(ans.trim())));
}

async function main() {
  let username = argValue('--username') || process.env.ADMIN_USERNAME || '';
  let email = argValue('--email') || process.env.ADMIN_EMAIL || '';
  let password = argValue('--password') || process.env.ADMIN_PASSWORD || '';
  const roleRaw = (argValue('--role') || process.env.ADMIN_ROLE || 'super_admin').trim();
  const role: UserRole = roleRaw === 'admin' ? 'admin' : 'super_admin';
  const resetPassword = process.argv.includes('--reset-password');

  if (!username || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!username) username = await promptQuestion(rl, 'Admin username: ');
      if (!email) email = await promptQuestion(rl, 'Admin email (optional): ');
      if (!password) password = await promptQuestion(rl, 'Admin password (min 8 chars): ');
    } finally {
      rl.close();
    }
  }

  username = username.trim();
  if (!username || username.length < 3 || !/^[A-Za-z0-9_]+$/.test(username)) {
    console.error('Error: Username must be at least 3 alphanumeric/underscore characters.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('Error: Admin password must be at least 8 characters.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const existing = db.getUserByUsername(username);
  if (existing) {
    if (!resetPassword) {
      console.error(`Error: Account "${username}" already exists (role=${existing.role}). Pass --reset-password to promote/update it.`);
      process.exit(1);
    }
    db.updateUserRoleStatus(existing.id, { role, status: 'active', passwordHash: hash });
    db.revokeAllUserSessions(existing.id);
    db.recordAdminAuditLog({
      adminId: 'cli',
      adminUsername: 'cli',
      action: 'admin_promoted_cli',
      targetType: 'user',
      targetId: existing.id,
      details: { username: existing.username, role },
    });
    console.log(`Updated "${existing.username}" (id=${existing.id}) -> role=${role}.`);
    db.close();
    process.exit(0);
  }

  const { user } = db.createUser(username, email.trim() || `${username.toLowerCase()}@admin.local`, hash, false, role);
  db.recordAdminAuditLog({
    adminId: 'cli',
    adminUsername: 'cli',
    action: 'admin_provisioned_cli',
    targetType: 'user',
    targetId: user.id,
    details: { username: user.username, role },
  });
  console.log(`Created ${role} account "${user.username}" (id=${user.id}).`);
  db.close();
}

main().catch((err) => {
  console.error('Failed to provision admin:', err);
  process.exit(1);
});

