-- Migration: Add contract_id to payments table
ALTER TABLE payments ADD COLUMN contract_id INTEGER;
-- Optionally, add a foreign key constraint if supported by your SQLite version:
-- ALTER TABLE payments ADD CONSTRAINT fk_contract FOREIGN KEY (contract_id) REFERENCES contracts(id);
