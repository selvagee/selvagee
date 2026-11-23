CREATE TABLE IF NOT EXISTS telemetry (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_hash CHAR(64) NOT NULL UNIQUE,
  device_id VARCHAR(40) NOT NULL,
  event_id VARCHAR(64) NOT NULL,
  temperature DOUBLE NOT NULL,
  alarm BOOLEAN NOT NULL,
  received_at DATETIME(3) NOT NULL,
  INDEX idx_device_time (device_id, received_at)
);
