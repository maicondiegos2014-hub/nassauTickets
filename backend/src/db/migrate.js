import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { config } from '../config.js';
import { now } from '../domain/clock.js';
import { logger } from '../logger.js';
import { validatePasswordStrength } from '../services/authService.js';
import { query } from './pool.js';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

/** Cria o banco (se preciso), aplica o esquema e cadastra o gestor e os guichês iniciais. */
export async function migrate({ createDatabase = true } = {}) {
  const { host, port, user, password, database } = config.db;
  if (!user) throw new Error('Defina DB_USER e DB_PASSWORD no arquivo .env do backend.');
  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  try {
    if (createDatabase) {
      await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
      );
    }
    await conn.query(`USE \`${database}\``);
    await conn.query(await readFile(schemaPath, 'utf8'));
  } finally {
    await conn.end();
  }
  await seed();
}

async function seed() {
  const [{ total }] = await query("SELECT COUNT(*) AS total FROM users WHERE role = 'GESTOR'");
  const at = now();
  if (total === 0) {
    const { gestorUsername, gestorPassword } = config.seed;
    const problem = gestorUsername ? validatePasswordStrength(gestorPassword) : 'GESTOR_USERNAME não definido.';
    if (problem) {
      throw new Error(`Gestor inicial não criado: defina GESTOR_USERNAME e GESTOR_PASSWORD no .env. ${problem}`);
    }
    const hash = await bcrypt.hash(config.seed.gestorPassword, config.auth.bcryptCost);
    await query(
      `INSERT INTO users (username, full_name, password_hash, role, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, 'GESTOR', 'ATIVO', 1, ?, ?)`,
      [config.seed.gestorUsername.toLowerCase(), config.seed.gestorName, hash, at, at],
    );
    logger.warn({ username: config.seed.gestorUsername }, 'Gestor inicial criado — troque a senha no primeiro acesso');
  }
  const [{ counters }] = await query('SELECT COUNT(*) AS counters FROM counters');
  if (counters === 0) {
    for (let n = 1; n <= config.seed.counters; n += 1) {
      await query('INSERT INTO counters (number, name, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)', [
        n,
        `Guichê ${n}`,
        at,
        at,
      ]);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { closePool } = await import('./pool.js');
  try {
    await migrate();
    logger.info('Banco de dados pronto');
  } finally {
    await closePool();
  }
}
