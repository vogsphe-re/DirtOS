-- Phase 15: performance and query-path indexes

CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time
    ON sensor_readings(sensor_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_indoor_readings_env_time_phase15
    ON indoor_readings(indoor_environment_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_plant_created
    ON journal_entries(plant_id, created_at DESC);
