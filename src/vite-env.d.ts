/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MQTT_URL?: string;
  readonly VITE_MQTT_USERNAME?: string;
  readonly VITE_MQTT_PASSWORD?: string;
  readonly VITE_MQTT_CUSTOMER?: string;
  readonly VITE_MQTT_PROTOCOL_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
