import { appConfig } from "./index.js";

export const loggerConfig = {
  level: appConfig.logLevel,
  transport: appConfig.isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : undefined,
};

export default loggerConfig;
