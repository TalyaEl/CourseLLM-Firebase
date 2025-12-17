"use strict";
/**
 * Helper to load IST context (ist_history, and eventually chat_history)
 * from the Firebase Data Connect IstEvent table.
 *
 * This mirrors the shape returned by loadIstContextFromJson so that
 * downstream DSPy calls can remain unchanged.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadIstContextFromDataConnect = void 0;
const app_1 = require("firebase/app");
const data_connect_1 = require("firebase/data-connect");
const functions_generated_1 = require("@dataconnect/functions-generated");
// Keep a singleton Data Connect instance for reads
let dataConnectInstance = null;
function getOrInitDataConnect() {
    if (dataConnectInstance) {
        return dataConnectInstance;
    }
    try {
        // Ensure a default Firebase App exists (same pattern as istEventsClient)
        if ((0, app_1.getApps)().length === 0) {
            const configEnv = process.env.FIREBASE_CONFIG;
            if (!configEnv) {
                console.warn('[DataConnect] Missing FIREBASE_CONFIG env var. Initializing with minimal config for emulator.');
                (0, app_1.initializeApp)({
                    projectId: process.env.GCLOUD_PROJECT || 'coursewise-f2421',
                });
            }
            else {
                const firebaseConfig = JSON.parse(configEnv);
                (0, app_1.initializeApp)(firebaseConfig);
            }
        }
        const dc = (0, data_connect_1.getDataConnect)(functions_generated_1.connectorConfig);
        if (process.env.FUNCTIONS_EMULATOR === 'true') {
            // Port 9400 is defined in firebase.json for the Data Connect emulator
            (0, data_connect_1.connectDataConnectEmulator)(dc, 'localhost', 9400);
        }
        dataConnectInstance = dc;
        console.log('[DataConnect] Initialized Data Connect client for IST context loading');
        return dataConnectInstance;
    }
    catch (err) {
        console.error('[DataConnect] Failed to initialize Data Connect client for IST context loading', err);
        return null;
    }
}
function normalizeStringArray(value) {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string');
    }
    return [];
}
/**
 * Load IST context from Firebase Data Connect IstEvent table.
 *
 * This returns the same IstContextResult shape as loadIstContextFromJson.
 */
async function loadIstContextFromDataConnect(options) {
    var _a, _b;
    const { userId, courseId, maxHistory = 5 } = options;
    // Without a userId (and courseId), we cannot query IstEvent
    if (!userId || !courseId) {
        console.warn('[IST][DataConnect] Missing userId or courseId in options, returning empty IST context');
        return { chatHistory: [], istHistory: [] };
    }
    const dc = getOrInitDataConnect();
    if (!dc) {
        console.warn('[IST][DataConnect] Data Connect client not initialized, returning empty IST context');
        return { chatHistory: [], istHistory: [] };
    }
    try {
        const ref = (0, functions_generated_1.istEventsByUserAndCourseRef)(dc, { userId, courseId });
        const result = await (0, data_connect_1.executeQuery)(ref);
        const events = (_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.istEvents) !== null && _b !== void 0 ? _b : [];
        if (!Array.isArray(events) || events.length === 0) {
            console.log(`[IST][DataConnect] No IST events found for userId=${userId}, courseId=${courseId}`);
            return { chatHistory: [], istHistory: [] };
        }
        // Take up to maxHistory items (query is already newest-first)
        const recentEvents = events.slice(0, maxHistory);
        const istHistory = recentEvents.map((event) => {
            const skills = normalizeStringArray(event.skills);
            const trajectory = normalizeStringArray(event.trajectory);
            let createdAt = null;
            if (event.createdAt) {
                const date = new Date(event.createdAt);
                createdAt = Number.isNaN(date.getTime())
                    ? null
                    : date.toISOString();
            }
            return {
                intent: event.intent,
                skills,
                trajectory,
                created_at: createdAt,
            };
        });
        const chatHistory = [];
        console.log(`[IST][DataConnect] Loaded ${istHistory.length} IST events from Data Connect (userId: ${userId}, courseId: ${courseId})`);
        return { chatHistory, istHistory };
    }
    catch (err) {
        console.error('[IST][DataConnect] Failed to load IST context from Data Connect', err);
        return { chatHistory: [], istHistory: [] };
    }
}
exports.loadIstContextFromDataConnect = loadIstContextFromDataConnect;
//# sourceMappingURL=istContextFromDataConnect.js.map