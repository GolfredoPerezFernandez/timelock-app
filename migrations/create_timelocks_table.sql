-- Crear tabla para almacenar información de timelocks
CREATE TABLE IF NOT EXISTS timelocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  release_timestamp INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);
