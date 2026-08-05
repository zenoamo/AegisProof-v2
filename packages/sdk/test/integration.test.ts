// ============================================================================
// Phase 6 Milestone 2 — SDK Integration Tests
// ============================================================================
import { describe, it, expect } from "vitest";
import * as sdk from "../src/core";
import fs from "fs";
import path from "path";

describe("AegisProof SDK Integration", () => {
  
  // Load production proof artifact for testing
  const getTestProof = () => {
    const proofPath = path.join(__dirname, "../../../../../artifacts/phase4/reports/production_proof_baseline.json");
    if (!fs.existsSync(proofPath)) {
      throw new Error("Missing test artifact: run scripts/phase4_verify_production.mjs first");
    }
    const data = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    return {
      proof: typeof data.proof !== "undefined" ? data.proof : data,
      signals: Array.isArray(data.publicSignals) 
        ? data.publicSignals.map((s) => s.toString()) 
        : [],
    };
  };
  
  describe("signal validation", () => {
    
    it("validates correct signal count", () => {
      const validSignals = Array.from({ length: 30 }, (_, i) => (i + 1).toString());
      expect(() => sdk.validateSignalCount(validSignals)).not.toThrow();
    });
    
    it("rejects insufficient signal count", () => {
      const shortSignals = Array.from({ length: 29 }, (_, i) => (i + 1).toString());
      expect(() => sdk.validateSignalCount(shortSignals)).toThrow(sdk.InvalidSignalCountError);
    });
    
    it("rejects excessive signal count", () => {
      const longSignals = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
      expect(() => sdk.validateSignalCount(longSignals)).toThrow(sdk.InvalidSignalCountError);
    });
    
  });
  
  describe("signal mapping", () => {
    
    it("builds public signals from named inputs", () => {
      const inputs = {
        timestamp: "1234567890",
        chainId: "31337",
        protocolVersion: "2",
        deviceId: "device-001",
        commitment: "0xabc",
        nullifier: "0xdef",
        sessionId: "777",
        purposeId: "42",
      };
      
      // Add remaining signals with default values
      for (let i = 8; i < 30; i++) {
        inputs[sdk.SIGNAL_NAMES[i]] = "0";
      }
      
      const signals = sdk.buildPublicSignals(inputs);
      expect(signals).toHaveLength(30);
      expect(signals[0]).toBe("1234567890");
      expect(signals[1]).toBe("31337");
    });
    
    it("throws on missing required signals", () => {
      const incompleteInputs = { timestamp: "123" };
      expect(() => sdk.buildPublicSignals(incompleteInputs)).toThrow(sdk.SignalMappingError);
    });
    
    it("preserves SSoT signal order", () => {
      const inputs: Record<string, string> = {};
      for (const name of sdk.SIGNAL_NAMES) {
        inputs[name] = "test";
      }
      const signals = sdk.buildPublicSignals(inputs);
      
      // Verify all indices map correctly back to names
      const parsed = sdk.parsePublicSignals(signals);
      expect(parsed.timestamp).toBe("test");
      expect(parsed.chainId).toBe("test");
    });
    
  });
  
  describe("calldata conversion", () => {
    
    it("pads signals to 64 characters", () => {
      const shortSignal = "1";
      const padded = sdk.toCalldataSignals([shortSignal]);
      expect(padded[0]).toBe("0".repeat(63) + "1");
    });
    
    it("converts groth proof coordinates correctly", () => {
      const snarkjsProof = {
        pi_a: ["1", "2"],
        pi_b: [
          ["y1_lo", "y1_hi"],
          ["x1_lo", "x1_hi"],
        ],
        pi_c: ["3", "4"],
      };
      
      const calldata = sdk.grothProofToCalldata(snarkjsProof);
      
      // Verify G1 points parsed correctly
      expect(calldata.pA[0]).toBe(BigInt("1"));
      expect(calldata.pA[1]).toBe(BigInt("2"));
      
      // Verify G2 coordinate swap (snarkjs y,x -> Solidity x,y)
      expect(calldata.pB[0][0]).toBe(BigInt("x1_lo")); // Should be x component
      expect(calldata.pB[0][1]).toBe(BigInt("x1_hi"));
      expect(calldata.pB[1][0]).toBe(BigInt("y1_lo")); // Should be y component
      expect(calldata.pB[1][1]).toBe(BigInt("y1_hi"));
    });
    
    it("validates proof structure lengths", () => {
      const invalidProof = {
        pi_a: ["1"], // Wrong length
        pi_b: [
          ["1", "2"],
          ["3", "4"],
        ],
        pi_c: ["5", "6"],
      };
      
      expect(() => sdk.grothProofToCalldata(invalidProof)).toThrow(sdk.InvalidProofStructureError);
    });
    
  });
  
  describe("error handling", () => {
    
    it("creates typed errors with context", () => {
      const error = new sdk.AegisSDKError("test error", "TEST_CODE", { field: "signal_count" });
      expect(error.name).toBe("AegisSDKError");
      expect(error.code).toBe("TEST_CODE");
      expect(error.context?.field).toBe("signal_count");
    });
    
    it("generates appropriate errors for validation failures", () => {
      try {
        sdk.validateSignalCount(["1"]);
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(sdk.InvalidSignalCountError);
        const typedErr = err as sdk.InvalidSignalCountError;
        expect(typedErr.code).toBe("INVALID_SIGNAL_COUNT");
        expect(typedErr.context?.expected).toBe(30);
      }
    });
    
  });
  
  describe("utility functions", () => {
    
    it("decodes revert reason format", () => {
      const revertData = "0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000065265766572740000000000000000000000000000000000000000000000000000";
      const decoded = sdk.decodeRevertReason(revertData);
      
      expect(decoded?.selector).toBe("0x08c379a0");
      expect(decoded?.message).toContain("Revert");
    });
    
    it("handles non-hex revert reasons gracefully", () => {
      expect(sdk.decodeRevertReason("plain text")).toBeNull();
      expect(sdk.decodeRevertReason("")).toBeNull();
    });
    
  });
  
  describe("SSoT consistency", () => {
    
    it("matches expected signal count constant", () => {
      expect(sdk.EXPECTED_SIGNAL_COUNT).toBe(30);
      expect(sdk.SIGNAL_NAMES.length).toBe(30);
    });
    
    it("defines all required signal names", () => {
      const requiredNames = ["timestamp", "chainId", "protocolVersion", "deviceId", "commitment", "nullifier", "sessionId", "purposeId"];
      for (const name of requiredNames) {
        expect(sdk.SIGNAL_NAMES.includes(name as sdk.SignalName)).toBe(true);
      }
    });
    
  });
  
});
