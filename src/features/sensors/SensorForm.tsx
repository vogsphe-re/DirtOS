import {
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { commands } from "../../lib/bindings";
import type { NewSensor, Sensor, SensorConnectionType, SensorType } from "../../lib/bindings";

const SENSOR_TYPE_OPTIONS: { value: SensorType; label: string }[] = [
  { value: "moisture", label: "Moisture" },
  { value: "light", label: "Light" },
  { value: "temperature", label: "Temperature" },
  { value: "humidity", label: "Humidity" },
  { value: "ph", label: "pH" },
  { value: "ec", label: "EC (Electrical Conductivity)" },
  { value: "co2", label: "CO₂" },
  { value: "air_quality", label: "Air Quality" },
  { value: "custom", label: "Custom" },
];

const CONNECTION_TYPE_OPTIONS: { value: SensorConnectionType; label: string }[] = [
  { value: "manual", label: "Manual Entry" },
  { value: "http", label: "HTTP Endpoint" },
  { value: "mqtt", label: "MQTT Topic" },
  { value: "serial", label: "Serial Port" },
  { value: "usb", label: "USB / Serial" },
];

interface Props {
  opened: boolean;
  environmentId: number;
  sensor?: Sensor;
  onClose: () => void;
  onSaved: () => void;
}

export function SensorForm({ opened, environmentId, sensor, onClose, onSaved }: Props) {
  const isEdit = !!sensor;

  const [name, setName] = useState(sensor?.name ?? "");
  const [sensorType, setSensorType] = useState<SensorType>(
    sensor?.sensor_type ?? "moisture"
  );
  const [connectionType, setConnectionType] = useState<SensorConnectionType>(
    sensor?.connection_type ?? "manual"
  );
  const [pollInterval, setPollInterval] = useState<number | string>(
    sensor?.poll_interval_seconds ?? 60
  );
  const [isActive, setIsActive] = useState(sensor?.is_active ?? true);

  // Connection-specific config (stored as JSON)
  const [serialPort, setSerialPort] = useState("");
  const [baudRate, setBaudRate] = useState<number | string>(9600);
  const [httpUrl, setHttpUrl] = useState("");
  const [httpJsonPointer, setHttpJsonPointer] = useState("");
  const [mqttBroker, setMqttBroker] = useState("");
  const [mqttTopic, setMqttTopic] = useState("");

  // Limits
  const [minValue, setMinValue] = useState<number | string>("");
  const [maxValue, setMaxValue] = useState<number | string>("");
  const [limitUnit, setLimitUnit] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildConnectionConfig = (): string => {
    if (connectionType === "serial" || connectionType === "usb") {
      return JSON.stringify({ port: serialPort, baud_rate: Number(baudRate) });
    }
    if (connectionType === "http") {
      return JSON.stringify({
        url: httpUrl,
        json_pointer: httpJsonPointer || null,
      });
    }
    if (connectionType === "mqtt") {
      return JSON.stringify({ broker_url: mqttBroker, topic: mqttTopic });
    }
    return "{}";
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      let savedSensorId: number;

      if (isEdit && sensor) {
        const res = await commands.updateSensor(sensor.id, {
          name: name.trim(),
          sensor_type: sensorType,
          connection_type: connectionType,
          connection_config_json: buildConnectionConfig(),
          poll_interval_seconds: Number(pollInterval),
          location_id: null,
          plant_id: null,
          is_active: isActive,
        });
        if (res.status === "error") throw new Error(res.error);
        savedSensorId = sensor.id;
      } else {
        const input: NewSensor = {
          environment_id: environmentId,
          location_id: null,
          plant_id: null,
          name: name.trim(),
          sensor_type: sensorType,
          connection_type: connectionType,
          connection_config_json: buildConnectionConfig(),
          poll_interval_seconds: Number(pollInterval),
          is_active: isActive,
        };
        const res = await commands.createSensor(input);
        if (res.status === "error") throw new Error(res.error);
        savedSensorId = res.data.id;
      }

      // Save limits if any set
      if (minValue !== "" || maxValue !== "" || alertEnabled) {
        await commands.setSensorLimits(
          savedSensorId,
          minValue !== "" ? Number(minValue) : null,
          maxValue !== "" ? Number(maxValue) : null,
          limitUnit || null,
          alertEnabled
        );
      }

      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Sensor" : "Add Sensor"}
      size="lg"
    >
      <Stack>
        <Grid>
          <Grid.Col span={8}>
            <TextInput
              label="Sensor Name"
              placeholder="e.g. Soil Moisture Bed 1"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <NumberInput
              label="Poll Interval (s)"
              value={pollInterval}
              onChange={setPollInterval}
              min={5}
            />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={6}>
            <Select
              label="Sensor Type"
              data={SENSOR_TYPE_OPTIONS}
              value={sensorType}
              onChange={(v) => setSensorType((v as SensorType) ?? "moisture")}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Connection Type"
              data={CONNECTION_TYPE_OPTIONS}
              value={connectionType}
              onChange={(v) =>
                setConnectionType((v as SensorConnectionType) ?? "manual")
              }
            />
          </Grid.Col>
        </Grid>

        {/* Dynamic connection fields */}
        {(connectionType === "serial" || connectionType === "usb") && (
          <Grid>
            <Grid.Col span={8}>
              <TextInput
                label="Serial Port"
                placeholder="/dev/ttyUSB0"
                value={serialPort}
                onChange={(e) => setSerialPort(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Baud Rate"
                value={baudRate}
                onChange={setBaudRate}
                min={300}
              />
            </Grid.Col>
          </Grid>
        )}

        {connectionType === "http" && (
          <Stack gap="xs">
            <TextInput
              label="Endpoint URL"
              placeholder="http://192.168.1.100/sensor"
              value={httpUrl}
              onChange={(e) => setHttpUrl(e.currentTarget.value)}
            />
            <TextInput
              label="JSON Pointer (optional)"
              description="RFC 6901 pointer to the numeric value, e.g. /data/temperature"
              placeholder="/value"
              value={httpJsonPointer}
              onChange={(e) => setHttpJsonPointer(e.currentTarget.value)}
            />
          </Stack>
        )}

        {connectionType === "mqtt" && (
          <Grid>
            <Grid.Col span={7}>
              <TextInput
                label="Broker URL"
                placeholder="mqtt://localhost:1883"
                value={mqttBroker}
                onChange={(e) => setMqttBroker(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={5}>
              <TextInput
                label="Topic"
                placeholder="sensors/moisture/1"
                value={mqttTopic}
                onChange={(e) => setMqttTopic(e.currentTarget.value)}
              />
            </Grid.Col>
          </Grid>
        )}

        <Divider label="Alert Limits (optional)" labelPosition="left" />

        <Grid>
          <Grid.Col span={4}>
            <NumberInput
              label="Minimum Value"
              placeholder="—"
              value={minValue}
              onChange={setMinValue}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <NumberInput
              label="Maximum Value"
              placeholder="—"
              value={maxValue}
              onChange={setMaxValue}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              label="Unit"
              placeholder="%, °C, ppm…"
              value={limitUnit}
              onChange={(e) => setLimitUnit(e.currentTarget.value)}
            />
          </Grid.Col>
        </Grid>

        <Switch
          label="Enable breach alerts (creates an issue when limit is exceeded)"
          checked={alertEnabled}
          onChange={(e) => setAlertEnabled(e.currentTarget.checked)}
        />

        <Switch
          label="Sensor active (start polling immediately)"
          checked={isActive}
          onChange={(e) => setIsActive(e.currentTarget.checked)}
        />

        {error && <Text c="red" size="sm">{error}</Text>}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? "Save Changes" : "Add Sensor"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
