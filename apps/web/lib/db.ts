import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type {
  CourseState,
  ExamAttemptRecord,
  GrammarErrorRecord,
  InteractionGrade,
  LearnerFact,
  TeacherNoteRecord,
  VocabProgressRecord,
} from "@/app/course/types";

export interface HistoryEvent {
  id: string;
  timestamp: string;
  userId?: string;
  game: "sejour" | "epicerie";
  event: string;
  details?: Record<string, unknown>;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  image?: string;
  role: "student" | "admin";
  timezone: string;
  inviteCodeUsed?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface SessionRecord {
  id: string; // sha256 hex of raw session token
  userId: string;
  expiresAt: string;
  createdAt: string;
  userAgent?: string;
}

export interface InviteRecord {
  code: string;
  createdBy: string;
  maxUses: number;
  uses: number;
  redeemedBy: { userId: string; email: string; at: string }[];
  expiresAt: string | null;
  note: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface UserLearningBundle {
  saves: {
    sejour?: { save: unknown; updatedAt: string };
    epicerie?: { save: unknown; updatedAt: string };
  };
  course: CourseState;
  vocab: Record<string, VocabProgressRecord>;
  errors: GrammarErrorRecord[];
  teacherNotes: TeacherNoteRecord[];
  learnerFacts: Record<string, LearnerFact>;
  exams: ExamAttemptRecord[];
  interactions: (InteractionGrade & { id: string; createdAt: string; transcript?: { role: string; text: string }[] })[];
  probeLog: { day: number; probeId: string; scene: string; at: string }[];
}

export interface LocalDatabaseSchema {
  version: 1;
  sejour?: {
    save: unknown;
    updatedAt: string;
  };
  epicerie?: {
    save: unknown;
    updatedAt: string;
  };
  history: HistoryEvent[];
  users?: Record<string, UserRecord>;
  sessions?: Record<string, SessionRecord>;
  invites?: Record<string, InviteRecord>;
  userBundles?: Record<string, UserLearningBundle>;
}

const DEFAULT_INVITES: Record<string, InviteRecord> = {
  SEJOUR2026: {
    code: "SEJOUR2026",
    createdBy: "system",
    maxUses: 100,
    uses: 0,
    redeemedBy: [],
    expiresAt: null,
    note: "Default beta invite code for Le Séjour 4-Week Course",
    revokedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  BONJOUR: {
    code: "BONJOUR",
    createdBy: "system",
    maxUses: 100,
    uses: 0,
    redeemedBy: [],
    expiresAt: null,
    note: "General student invite code",
    revokedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

function getDatabasePath(): string {
  if (process.env.DATA_DIR) {
    return path.join(process.env.DATA_DIR, "french_game.json");
  }
  const base = process.cwd().endsWith("apps/web")
    ? path.resolve(process.cwd(), "data")
    : path.resolve(process.cwd(), "apps/web/data");
  return path.join(base, "french_game.json");
}

let inMemoryCache: LocalDatabaseSchema | null = null;
let pgSql: any = null;
let pgChecked = false;
let pgAvailable = false;

async function getPostgresStore(): Promise<any | null> {
  if (process.env.DATA_DIR) return null; // Unit test override uses local temp file
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) return null;
  if (pgChecked) return pgAvailable ? pgSql : null;
  pgChecked = true;
  try {
    const postgresMod = await import("postgres");
    const postgres = postgresMod.default ?? postgresMod;
    const sql = postgres(dbUrl, {
      connect_timeout: 2,
      idle_timeout: 20,
      max: 5,
    });
    await sql`
      CREATE TABLE IF NOT EXISTS sejour_app_store (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    pgSql = sql;
    pgAvailable = true;
    return sql;
  } catch {
    pgAvailable = false;
    return null;
  }
}

function ensureCollections(db: LocalDatabaseSchema): LocalDatabaseSchema {
  if (!db.users) db.users = {};
  if (!db.sessions) db.sessions = {};
  if (!db.invites) db.invites = { ...DEFAULT_INVITES };
  for (const [code, inv] of Object.entries(DEFAULT_INVITES)) {
    if (!db.invites[code]) db.invites[code] = { ...inv, redeemedBy: [...inv.redeemedBy] };
  }
  if (!db.userBundles) db.userBundles = {};
  if (!db.history) db.history = [];
  return db;
}

export async function readDatabase(): Promise<LocalDatabaseSchema> {
  if (inMemoryCache) return ensureCollections(inMemoryCache);

  const sql = await getPostgresStore();
  if (sql) {
    try {
      const rows = await sql`SELECT payload FROM sejour_app_store WHERE id = 'main' LIMIT 1`;
      if (rows.length > 0 && rows[0].payload) {
        const parsed = (typeof rows[0].payload === "string"
          ? JSON.parse(rows[0].payload)
          : rows[0].payload) as LocalDatabaseSchema;
        if (parsed && parsed.version === 1) {
          inMemoryCache = ensureCollections(parsed);
          return inMemoryCache;
        }
      }
    } catch {
      // Fallback to local file
    }
  }

  const dbPath = getDatabasePath();
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw) as LocalDatabaseSchema;
    if (parsed && parsed.version === 1) {
      inMemoryCache = ensureCollections(parsed);
      return inMemoryCache;
    }
  } catch {
    // File not found or corrupt; fallback to empty default
  }

  const initial: LocalDatabaseSchema = ensureCollections({
    version: 1,
    history: [],
  });
  inMemoryCache = initial;
  return initial;
}

export async function writeDatabase(data: LocalDatabaseSchema): Promise<void> {
  const normalized = ensureCollections(data);
  inMemoryCache = normalized;

  const sql = await getPostgresStore();
  if (sql) {
    try {
      await sql`
        INSERT INTO sejour_app_store (id, payload, updated_at)
        VALUES ('main', ${sql.json(normalized)}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET payload = EXCLUDED.payload, updated_at = NOW()
      `;
    } catch {
      // Also write to disk below
    }
  }

  const dbPath = getDatabasePath();
  const dir = path.dirname(dbPath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = `${dbPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const content = JSON.stringify(normalized, null, 2);
  await fs.writeFile(tempPath, content, "utf8");
  try {
    await fs.rename(tempPath, dbPath);
  } catch {
    await fs.writeFile(dbPath, content, "utf8");
    await fs.unlink(tempPath).catch(() => {});
  }
}

export function todayIsoInTz(tz = "Europe/Paris", now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value ?? "2026";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function createInitialCourseState(userId: string, timezone = "Europe/Paris"): CourseState {
  return {
    userId,
    startDate: todayIsoInTz(timezone),
    timezone,
    placementScore: null,
    placementStatus: "pending",
    skippedWeeks: 0,
    currentDay: 1,
    supportBand: "high",
    streak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    unlockedPlaces: ["boulangerie"],
    unlockedEvents: [],
    lessonsCompleted: [],
    dayPlans: {},
    queuedDayVocabIds: [],
  };
}

export async function getUserBundle(userId: string, timezone = "Europe/Paris"): Promise<UserLearningBundle> {
  const db = await readDatabase();
  const existing = db.userBundles?.[userId];
  if (existing) {
    if (!existing.course) existing.course = createInitialCourseState(userId, timezone);
    if (!Array.isArray(existing.course.unlockedPlaces) || existing.course.unlockedPlaces.length === 0) {
      existing.course.unlockedPlaces = ["boulangerie"];
    }
    if (!Array.isArray(existing.course.unlockedEvents)) existing.course.unlockedEvents = [];
    if (!existing.vocab) existing.vocab = {};
    if (!existing.errors) existing.errors = [];
    if (!existing.teacherNotes) existing.teacherNotes = [];
    if (!existing.learnerFacts) existing.learnerFacts = {};
    if (!existing.exams) existing.exams = [];
    if (!existing.interactions) existing.interactions = [];
    if (!existing.probeLog) existing.probeLog = [];
    if (!existing.saves) existing.saves = {};
    return existing;
  }
  const fresh: UserLearningBundle = {
    saves: {},
    course: createInitialCourseState(userId, timezone),
    vocab: {},
    errors: [],
    teacherNotes: [],
    learnerFacts: {},
    exams: [],
    interactions: [],
    probeLog: [],
  };
  db.userBundles![userId] = fresh;
  await writeDatabase(db);
  return fresh;
}

export async function saveUserBundle(userId: string, bundle: UserLearningBundle): Promise<void> {
  const db = await readDatabase();
  db.userBundles![userId] = bundle;
  await writeDatabase(db);
}

export async function getGameSave(
  game: "sejour" | "epicerie",
  userId?: string,
): Promise<{ save: unknown | null; updatedAt: string | null }> {
  const db = await readDatabase();
  if (userId) {
    const bundle = await getUserBundle(userId);
    const rec = bundle.saves[game];
    if (!rec || !rec.save) return { save: null, updatedAt: null };
    return { save: rec.save, updatedAt: rec.updatedAt };
  }
  const record = db[game];
  if (!record || !record.save) return { save: null, updatedAt: null };
  return { save: record.save, updatedAt: record.updatedAt };
}

export async function saveGameState(
  game: "sejour" | "epicerie",
  save: unknown,
  eventDescription?: string,
  eventDetails?: Record<string, unknown>,
  userId?: string,
): Promise<{ updatedAt: string }> {
  const db = await readDatabase();
  const updatedAt = new Date().toISOString();

  if (userId) {
    const bundle = await getUserBundle(userId);
    bundle.saves[game] = { save, updatedAt };
    db.userBundles![userId] = bundle;
  } else {
    db[game] = { save, updatedAt };
  }

  if (eventDescription) {
    const event: HistoryEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: updatedAt,
      userId,
      game,
      event: eventDescription,
      details: eventDetails,
    };
    db.history = [...(db.history || []).slice(-200), event];
  }

  await writeDatabase(db);
  return { updatedAt };
}

export async function recordHistoryEvent(
  game: "sejour" | "epicerie",
  event: string,
  details?: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  const db = await readDatabase();
  const historyEvent: HistoryEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    userId,
    game,
    event,
    details,
  };
  db.history = [...(db.history || []).slice(-200), historyEvent];
  await writeDatabase(db);
}

export async function resetGameSave(game: "sejour" | "epicerie", userId?: string): Promise<void> {
  const db = await readDatabase();
  if (userId && db.userBundles?.[userId]) {
    delete db.userBundles[userId].saves[game];
  } else {
    delete db[game];
  }
  db.history = [
    ...(db.history || []).slice(-200),
    {
      id: `${Date.now()}-reset`,
      timestamp: new Date().toISOString(),
      userId,
      game,
      event: "reset_game",
    },
  ];
  await writeDatabase(db);
}

/** User & Invite management helpers */
export function isAdminEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  const rawList = process.env.ADMIN_EMAILS?.trim() || "";
  const admins = rawList
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (admins.includes(clean)) return true;
  if (clean.endsWith("@admin.local") || clean === "admin@sejour.local") return true;
  return false;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const db = await readDatabase();
  const target = email.trim().toLowerCase();
  for (const user of Object.values(db.users || {})) {
    if (user.email.toLowerCase() === target) return user;
  }
  return null;
}

export async function findUserById(userId: string): Promise<UserRecord | null> {
  const db = await readDatabase();
  return db.users?.[userId] ?? null;
}

export async function validateInviteCode(rawCode: string): Promise<{ ok: true; invite: InviteRecord } | { ok: false; error: string }> {
  const db = await readDatabase();
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Please enter an invite code." };
  const invite = db.invites?.[code];
  if (!invite) return { ok: false, error: "Invalid invite code." };
  if (invite.revokedAt) return { ok: false, error: "This invite code has been revoked." };
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "This invite code has expired." };
  }
  if (invite.uses >= invite.maxUses) {
    return { ok: false, error: "This invite code has reached its maximum number of uses." };
  }
  return { ok: true, invite };
}

export async function upsertUserWithInvite(params: {
  email: string;
  name: string;
  image?: string;
  inviteCode?: string;
  timezone?: string;
  forceAdmin?: boolean;
}): Promise<{ ok: true; user: UserRecord; isNew: boolean } | { ok: false; error: string }> {
  const db = await readDatabase();
  const email = params.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const tz = params.timezone?.trim() || "Europe/Paris";

  const existing = Object.values(db.users || {}).find((u) => u.email.toLowerCase() === email);
  if (existing) {
    existing.lastSeenAt = now;
    if (params.name?.trim()) existing.name = params.name.trim();
    if (params.image) existing.image = params.image;
    if (params.forceAdmin || isAdminEmail(email)) existing.role = "admin";
    db.users![existing.id] = existing;
    await writeDatabase(db);
    return { ok: true, user: existing, isNew: false };
  }

  // New user requires a valid invite code unless they are an admin email
  const admin = Boolean(params.forceAdmin || isAdminEmail(email));
  let codeToRedeem = params.inviteCode?.trim().toUpperCase() || "";
  if (!admin) {
    const check = await validateInviteCode(codeToRedeem);
    if (!check.ok) return check;
  } else if (codeToRedeem && db.invites?.[codeToRedeem]) {
    // Admin provided an optional code
  } else {
    codeToRedeem = "";
  }

  const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
  const user: UserRecord = {
    id: userId,
    email,
    name: params.name.trim() || email.split("@")[0] || "Student",
    image: params.image,
    role: admin ? "admin" : "student",
    timezone: tz,
    inviteCodeUsed: codeToRedeem || undefined,
    createdAt: now,
    lastSeenAt: now,
  };
  db.users![userId] = user;

  if (codeToRedeem && db.invites?.[codeToRedeem]) {
    const inv = db.invites[codeToRedeem];
    inv.uses += 1;
    inv.redeemedBy.push({ userId, email, at: now });
  }

  db.userBundles![userId] = {
    saves: {},
    course: createInitialCourseState(userId, tz),
    vocab: {},
    errors: [],
    teacherNotes: [],
    learnerFacts: {
      name: { key: "name", value: user.name, updatedAt: now },
    },
    exams: [],
    interactions: [],
    probeLog: [],
  };

  await writeDatabase(db);
  return { ok: true, user, isNew: true };
}

export async function createInviteCode(params: {
  code?: string;
  createdBy: string;
  maxUses?: number;
  expiresInDays?: number | null;
  note?: string;
}): Promise<InviteRecord> {
  const db = await readDatabase();
  const code = (
    params.code?.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") ||
    `FR-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
  ).slice(0, 24);
  const now = new Date();
  const expiresAt =
    typeof params.expiresInDays === "number" && params.expiresInDays > 0
      ? new Date(now.getTime() + params.expiresInDays * 86400_000).toISOString()
      : null;

  const record: InviteRecord = {
    code,
    createdBy: params.createdBy,
    maxUses: Math.max(1, Math.min(1000, params.maxUses ?? 10)),
    uses: 0,
    redeemedBy: [],
    expiresAt,
    note: (params.note ?? "").trim().slice(0, 160),
    revokedAt: null,
    createdAt: now.toISOString(),
  };
  db.invites![code] = record;
  await writeDatabase(db);
  return record;
}

export async function revokeInviteCode(code: string): Promise<boolean> {
  const db = await readDatabase();
  const clean = code.trim().toUpperCase();
  const inv = db.invites?.[clean];
  if (!inv) return false;
  inv.revokedAt = new Date().toISOString();
  await writeDatabase(db);
  return true;
}

export async function listInvites(): Promise<InviteRecord[]> {
  const db = await readDatabase();
  return Object.values(db.invites || {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listUsersWithSummaries(): Promise<
  {
    user: UserRecord;
    course: CourseState;
    vocabCoveredCount: number;
    errorCount: number;
    noteCount: number;
    interactionCount: number;
  }[]
> {
  const db = await readDatabase();
  const users = Object.values(db.users || {}).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  const out = [];
  for (const user of users) {
    const bundle = await getUserBundle(user.id, user.timezone);
    const vocabCoveredCount = Object.values(bundle.vocab).filter((v) => v.box >= 2 || v.usedInConvo).length;
    out.push({
      user,
      course: bundle.course,
      vocabCoveredCount,
      errorCount: bundle.errors.length,
      noteCount: bundle.teacherNotes.length,
      interactionCount: bundle.interactions.length,
    });
  }
  return out;
}

export async function resetUserProgress(userId: string): Promise<boolean> {
  const db = await readDatabase();
  const user = db.users?.[userId];
  if (!user) return false;
  db.userBundles![userId] = {
    saves: {},
    course: createInitialCourseState(userId, user.timezone),
    vocab: {},
    errors: [],
    teacherNotes: [],
    learnerFacts: {
      name: { key: "name", value: user.name, updatedAt: new Date().toISOString() },
    },
    exams: [],
    interactions: [],
    probeLog: [],
  };
  await writeDatabase(db);
  return true;
}

export function clearDbCacheForTesting(): void {
  inMemoryCache = null;
}
