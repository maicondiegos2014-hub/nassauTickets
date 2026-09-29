import mysql from 'mysql2/promise';
import { config } from '../config.js';

let pool = null;

export function createPool(overrides = {}) {
  return mysql.createPool({
    ...config.db,
    ...overrides,
    waitForConnections: true,
    // Horários trafegam sempre em UTC; a conversão para o fuso do laboratório é feita na aplicação.
    timezone: 'Z',
    dateStrings: ['DATE'],
    supportBigNumbers: true,
    bigNumberStrings: false,
    enableKeepAlive: true,
  });
}

export function getPool() {
  if (!pool) pool = createPool();
  return pool;
}

export function setPool(newPool) {
  pool = newPool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function query(sql, params) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** Executa `work` numa transação; faz rollback em qualquer erro. */
export async function withTransaction(work) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}

export function isDuplicateKey(error) {
  return error?.code === 'ER_DUP_ENTRY';
}
