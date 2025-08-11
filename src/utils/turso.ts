import type { RequestEventBase } from "@builder.io/qwik-city";
import { createClient, type Client } from "@libsql/client";
import { hashPassword } from "~/utils/auth";

// Define a browser-safe QueryArgs type that doesn't use Buffer
type QueryArgs = (string | number | boolean | null | Uint8Array)[];

export type QueryResult = {
  rows: Array<Record<string, any>>;
  columns: string[];
  rowsAffected: number;
  lastInsertRowid: unknown;
};

// WARNING:
// This singleton client is ONLY for use in Node.js scripts, plugins, or server entrypoints outside of Qwik City routes/loaders/actions/server$.
// DO NOT use this in any Qwik City route, loader, action, or server$ function.
// For all Qwik City app code, always use tursoClient(requestEvent) to access environment variables securely.
export const client = createClient({
  url: process.env.PRIVATE_TURSO_DATABASE_URL || "file:./local.db",
  authToken: process.env.PRIVATE_TURSO_AUTH_TOKEN,
});

export function tursoClient(requestEvent: RequestEventBase): Client {
  const url = requestEvent.env.get("PRIVATE_TURSO_DATABASE_URL")?.trim();
  if (url === undefined) {
    throw new Error("PRIVATE_TURSO_DATABASE_URL is not defined");
  }

  const authToken = requestEvent.env.get("PRIVATE_TURSO_AUTH_TOKEN")?.trim();
  if (authToken === undefined) {
    if (!url.includes("file:")) {
      throw new Error("PRIVATE_TURSO_AUTH_TOKEN is not defined");
    }
  }

  return createClient({
    url,
    authToken,
  });
}

// Ejecuta migraciones en cada carga de página (idempotente)
export async function runMigrations(requestEvent: RequestEventBase): Promise<void> {
  const client = tursoClient(requestEvent);
  // --- Fix professionals.user_id and wallet NOT NULL constraint if present ---
  const pragma = await client.execute(`PRAGMA table_info(professionals);`);
  const walletCol = pragma.rows.find((col: any) => col.name === 'wallet');
  const userIdCol = pragma.rows.find((col: any) => col.name === 'user_id');
  if ((walletCol && walletCol.notnull === 1) || (userIdCol && userIdCol.notnull === 1)) {
    // Recreate table with user_id and wallet nullable
    await client.execute('BEGIN TRANSACTION;');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS professionals_tmp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        wallet TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    await client.execute(`
      INSERT INTO professionals_tmp (id, user_id, name, role, email, phone, wallet, created_at)
      SELECT id, user_id, name, role, email, phone, wallet, created_at FROM professionals;
    `);
    await client.execute('DROP TABLE professionals;');
    await client.execute('ALTER TABLE professionals_tmp RENAME TO professionals;');
    await client.execute('COMMIT;');
  }
  console.log("Running database migrations for users and trees tables...");

  // USERS TABLE
  await client.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    username TEXT NOT NULL DEFAULT '',
    type TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_expires DATETIME
  );`);
  // Asegura columna email (por si la tabla ya existía sin ella)
  try { await client.execute(`ALTER TABLE users ADD COLUMN email TEXT;`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }
  // Asegura columna type (por si la tabla ya existía sin ella)
  try { await client.execute(`ALTER TABLE users ADD COLUMN type TEXT DEFAULT 'normal';`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }
  // Asegura columna username (por si la tabla ya existía sin ella)
  try { await client.execute(`ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT '';`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }
  // Asegura columna session_expires (por si la tabla ya existía sin ella)
  try { await client.execute(`ALTER TABLE users ADD COLUMN session_expires DATETIME;`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }
  // Asegura índice único
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

  // PROFESSIONALS TABLE
  await client.execute(`CREATE TABLE IF NOT EXISTS professionals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );`);
  // Ensure columns exist (for old DBs)
  try { await client.execute(`ALTER TABLE professionals ADD COLUMN email TEXT;`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }
  try { await client.execute(`ALTER TABLE professionals ADD COLUMN phone TEXT;`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }
  try { await client.execute(`ALTER TABLE professionals ADD COLUMN wallet TEXT;`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }

  // CONTRACTS TABLE
  await client.execute(`CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    professional_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    contract_pdf_url TEXT,
    contract_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (professional_id) REFERENCES professionals(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );`);
  // Asegura columna contract_url (por si la tabla ya existía sin ella)
  try { await client.execute(`ALTER TABLE contracts ADD COLUMN contract_url TEXT;`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }

  // INVOICES TABLE
  await client.execute(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    professional_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    issue_date TEXT NOT NULL,
    paid_date TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'paid')),
    invoice_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (professional_id) REFERENCES professionals(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );`);

  // SETTLEMENTS TABLE
  await client.execute(`CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    professional_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    total_in_knrt REAL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'paid')),
    payment_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (professional_id) REFERENCES professionals(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );`);
  // Asegura columna total_in_knrt (por si la tabla ya existía sin ella)
  try { await client.execute(`ALTER TABLE settlements ADD COLUMN total_in_knrt REAL;`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }

  // PAYMENTS TABLE (for individual, non-settlement payments)
  await client.execute(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      professional_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      invoice_id INTEGER,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'paid')),
      due_date TEXT NOT NULL,
      payment_date TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (professional_id) REFERENCES professionals(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );`);

  // Asegura columna contract_id (por si la tabla ya existía sin ella)
  try { await client.execute(`ALTER TABLE payments ADD COLUMN contract_id INTEGER;`); } catch (e: any) { if (!String(e.message).toLowerCase().includes("duplicate column name")) throw e; }

  // TIMELOCKS TABLE (for blockchain timelock payments)
  await client.execute(`CREATE TABLE IF NOT EXISTS timelocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      release_timestamp INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed')),
      tx_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES payments(id)
  );`);
  
  // Crear índice en payment_id para mejorar el rendimiento de las consultas
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_timelocks_payment_id ON timelocks(payment_id);`);
  
  // Verificar que la tabla timelocks existe correctamente
  try {
    console.log("Verificando la tabla timelocks...");
    const timelocksCheck = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='timelocks';`);
    if (timelocksCheck.rows.length === 0) {
      console.error("⚠️ La tabla timelocks no se creó correctamente. Intentando crearla de nuevo con DROP TABLE...");
      await client.execute(`DROP TABLE IF EXISTS timelocks;`);
      await client.execute(`CREATE TABLE IF NOT EXISTS timelocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          payment_id INTEGER NOT NULL,
          release_timestamp INTEGER NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed')),
          tx_hash TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`);
      console.log("✅ Tabla timelocks creada correctamente.");
    } else {
      console.log("✅ Tabla timelocks verificada correctamente.");
    }
  } catch (e) {
    console.error("Error al verificar la tabla timelocks:", e);
  }

  // APP_SETTINGS TABLE
  await client.execute(`CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name TEXT NOT NULL DEFAULT 'Mi Empresa',
    company_email TEXT NOT NULL DEFAULT 'info@miempresa.com',
    company_logo_url TEXT,
    invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
    default_currency TEXT NOT NULL DEFAULT 'USD',
    payment_methods TEXT NOT NULL DEFAULT '["bank_transfer","paypal","wise","crypto"]',
    notifications_enabled BOOLEAN NOT NULL DEFAULT 1,
    theme TEXT NOT NULL DEFAULT 'system',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Ensure the default settings record exists
  const settingsCheck = await client.execute(`SELECT COUNT(*) as count FROM app_settings WHERE id = 1`);
  if ((settingsCheck.rows[0].count as number) === 0) {
    await client.execute(`INSERT INTO app_settings (id) VALUES (1)`);
  }
  // ...otros índices y migraciones si es necesario...
}

/**
 * Create admin user if it doesn't exist
 */
// export async function createAdminUser(requestEvent: RequestEventBase): Promise<void> {
//   try {
//     const adminEmail = "admin@gmail.com";
    
//     // Check if admin user already exists
//     const checkResult = await executeQuery(
//       requestEvent,
//       `SELECT id FROM users WHERE email = ?`,
//       [adminEmail]
//     );
    
//     if (checkResult.rows.length === 0) {
//       console.log("Creating admin user...");
      
//       // Hash the password
//       const passwordHash = await hashPassword("123456");
      
//       // Insert admin user
//       const userResult = await executeQuery(
//         requestEvent,
//         `INSERT INTO users (email, password_hash, type, username) VALUES (?, ?, ?, ?)`,
//         [adminEmail, passwordHash, "admin", "admin"]
//       );
      
//       // Get the user ID and ensure it's a string/number
//       const userId = String(userResult.lastInsertRowid);
      
//       // Create administrator record
//       await executeQuery(
//         requestEvent,
//         `INSERT INTO administrators (user_id, name, email) VALUES (?, ?, ?)`,
//         [userId, "Administrator", adminEmail]
//       );
      
//       console.log("Admin user created successfully with administrator record");
//     } else {
//       console.log("Admin user already exists, checking for administrator record");
      
//       // Get the user ID and ensure it's a string/number
//       const userId = String(checkResult.rows[0].id);
      
//       // Check if administrator record exists
//       const adminResult = await executeQuery(
//         requestEvent,
//         `SELECT id FROM administrators WHERE user_id = ?`,
//         [userId]