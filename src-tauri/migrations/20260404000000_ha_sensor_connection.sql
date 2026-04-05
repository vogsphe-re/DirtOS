-- Phase: Home Assistant sensor connection type
--
-- SQLite does not support ALTER TABLE to modify CHECK constraints, so we
-- recreate the sensors table to include 'home_assistant' in the allowed
-- connection_type values.
--
-- This allows DirtOS sensors to poll state directly from a Home Assistant
-- entity REST API endpoint, appearing as virtual "HA mirror" sensors.

PRAGMA foreign_keys = OFF;

CREATE TABLE sensors_ha (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id         INTEGER REFERENCES environments(id) ON DELETE CASCADE,
    location_id            INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    plant_id               INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    name                   TEXT    NOT NULL,
    type                   TEXT    NOT NULL
                                   CHECK(type IN ('moisture','light','temperature','humidity','ph','ec','co2','air_quality','custom')),
    connection_type        TEXT    NOT NULL
                                   CHECK(connection_type IN ('serial','usb','mqtt','http','manual','home_assistant')),
    connection_config_json TEXT,
    poll_interval_seconds  INTEGER,
    is_active              INTEGER NOT NULL DEFAULT 1,
    created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO sensors_ha SELECT * FROM sensors;

DROP TABLE sensors;

ALTER TABLE sensors_ha RENAME TO sensors;

PRAGMA foreign_keys = ON;
