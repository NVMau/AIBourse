"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toProvenance = void 0;
exports.validateProvenance = validateProvenance;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
function normalizeIso(input, fallback) {
    if (!input)
        return fallback;
    const d = new Date(input);
    if (Number.isNaN(d.getTime()))
        return fallback;
    return d.toISOString();
}
function normalizeSha(input) {
    const value = (input ?? "").trim().toLowerCase();
    return /^[a-f0-9]{64}$/.test(value) ? value : "";
}
const toProvenance = (input) => {
    const now = new Date(0).toISOString();
    const crawledAtIso = normalizeIso(input.crawl?.crawledAtIso, now);
    const fetchedAtIso = normalizeIso(input.crawl?.fetchedAtIso, crawledAtIso);
    return {
        recordId: input.recordId ?? "",
        modelId: input.modelId ?? "",
        metric: input.metric ?? "input_price",
        sourceUrl: input.sourceUrl ?? "",
        sourceTitle: input.sourceTitle,
        sourceCapturedAtIso: normalizeIso(input.sourceCapturedAtIso, fetchedAtIso),
        crawl: {
            crawledAtIso,
            fetchedAtIso,
            crawlerJobId: input.crawl?.crawlerJobId,
            userAgent: input.crawl?.userAgent,
        },
        parser: {
            name: input.parser?.name ?? "unknown",
            version: input.parser?.version ?? "unknown",
            configVersion: input.parser?.configVersion,
        },
        parseConfidence: clamp01(input.parseConfidence ?? 0),
        rawSnippet: input.rawSnippet ?? "",
        rawSnapshot: {
            objectUrl: input.rawSnapshot?.objectUrl ?? "",
            mimeType: input.rawSnapshot?.mimeType ?? "application/octet-stream",
            byteSize: Math.max(0, input.rawSnapshot?.byteSize ?? 0),
            sha256: normalizeSha(input.rawSnapshot?.sha256),
        },
        checksum: normalizeSha(input.checksum),
        notes: input.notes,
    };
};
exports.toProvenance = toProvenance;
function validateProvenance(p) {
    const errors = [];
    if (!p.recordId)
        errors.push("recordId is required");
    if (!p.modelId)
        errors.push("modelId is required");
    if (!p.sourceUrl)
        errors.push("sourceUrl is required");
    if (!p.rawSnapshot.objectUrl)
        errors.push("rawSnapshot.objectUrl is required");
    if (!p.rawSnapshot.sha256)
        errors.push("rawSnapshot.sha256 must be a valid sha256 hex");
    if (!p.checksum)
        errors.push("checksum must be a valid sha256 hex");
    const crawlTs = new Date(p.crawl.crawledAtIso).getTime();
    const fetchTs = new Date(p.crawl.fetchedAtIso).getTime();
    if (Number.isNaN(crawlTs))
        errors.push("crawl.crawledAtIso is invalid");
    if (Number.isNaN(fetchTs))
        errors.push("crawl.fetchedAtIso is invalid");
    if (!Number.isNaN(crawlTs) && !Number.isNaN(fetchTs) && fetchTs < crawlTs) {
        errors.push("crawl.fetchedAtIso cannot be older than crawl.crawledAtIso");
    }
    if (!p.parser.name || !p.parser.version) {
        errors.push("parser.name and parser.version are required");
    }
    if (errors.length > 0)
        return { ok: false, errors };
    return { ok: true };
}
