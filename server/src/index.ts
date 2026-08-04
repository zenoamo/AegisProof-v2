import Fastify from "fastify";

import { healthRoutes } from "./routes/health.js";
import { sessionRoutes } from "./routes/sessions.js";

const app = Fastify({
  logger: true,
});

const start = async () => {
  try {
    await app.register(healthRoutes);
    await app.register(sessionRoutes);

    await app.listen({
      host: "127.0.0.1",
      port: 3000,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
