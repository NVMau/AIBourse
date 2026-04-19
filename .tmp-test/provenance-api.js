"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryProvenanceStore = void 0;
const provenance_1 = require("./provenance");
class InMemoryProvenanceStore {
    constructor() {
        this.byRecordId = new Map();
    }
    upsert(input) {
        const p = (0, provenance_1.toProvenance)(input);
        const validation = (0, provenance_1.validateProvenance)(p);
        if (!validation.ok) {
            throw new Error(`Invalid provenance payload: ${validation.errors.join("; ")}`);
        }
        this.byRecordId.set(p.recordId, p);
        return p;
    }
    getByRecordId(recordId) {
        const data = this.byRecordId.get(recordId) ?? null;
        if (!data)
            return null;
        return { recordId, data };
    }
    listByModel(modelId) {
        return Array.from(this.byRecordId.values()).filter((p) => p.modelId === modelId);
    }
}
exports.InMemoryProvenanceStore = InMemoryProvenanceStore;
/**
 * REST contract (to implement in HTTP framework):
 *
 * GET /api/provenance/:recordId
 * 200 -> ProvenanceResponse
 * 404 -> { error: "not_found" }
 *
 * GET /api/models/:modelId/provenance
 * 200 -> PriceProvenance[]
 */
