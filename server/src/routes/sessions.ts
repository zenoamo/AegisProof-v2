import type { FastifyInstance } from "fastify";

import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from "viem";

import { localhost } from "viem/chains";

import { aegisShieldAbi } from "../AegisShield.js";
import { config } from "../config.js";

// ============================================================
// Client
// ============================================================

let publicClient: PublicClient | null = null;

function getClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: localhost,
      transport: http(config.rpcUrl),
    });
  }

  return publicClient;
}

// ============================================================
// Input Validation
// ============================================================

function parseUint256(value: string): bigint | null {
  try {
    const parsed = BigInt(value);

    if (parsed < 0n || parsed >= 2n ** 256n) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// ============================================================
// Routes
// ============================================================

export async function sessionRoutes(
  app: FastifyInstance
): Promise<void> {
  const shieldAddress = config.shieldAddress as Address;

  // ----------------------------------------------------------
  // GET /sessions/:sessionId
  // ----------------------------------------------------------

  app.get("/sessions/:sessionId", async (request, reply) => {
    const { sessionId: rawSessionId } = request.params as {
      sessionId: string;
    };

    const sessionId = parseUint256(rawSessionId);

    if (sessionId === null) {
      return reply
        .code(400)
        .send({ error: "Invalid sessionId" });
    }

    try {
      const client = getClient();

      const exists = await client.readContract({
        address: shieldAddress,
        abi: aegisShieldAbi,
        functionName: "sessionExists",
        args: [sessionId],
      });

      const [purposeId, active] = await client.readContract({
        address: shieldAddress,
        abi: aegisShieldAbi,
        functionName: "sessions",
        args: [sessionId],
      });

      return {
        sessionId: sessionId.toString(),
        exists,
        purposeId: purposeId.toString(),
        active,
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(502).send({
        error: "Failed to read session from chain",
      });
    }
  });

  // ----------------------------------------------------------
  // GET /nullifiers/:nullifier
  // ----------------------------------------------------------

  app.get("/nullifiers/:nullifier", async (request, reply) => {
    const { nullifier: rawNullifier } = request.params as {
      nullifier: string;
    };

    const nullifier = parseUint256(rawNullifier);

    if (nullifier === null) {
      return reply
        .code(400)
        .send({ error: "Invalid nullifier" });
    }

    try {
      const client = getClient();

      const used = await client.readContract({
        address: shieldAddress,
        abi: aegisShieldAbi,
        functionName: "usedNullifiers",
        args: [nullifier],
      });

      return {
        nullifier: nullifier.toString(),
        used,
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(502).send({
        error: "Failed to read nullifier from chain",
      });
    }
  });
}
