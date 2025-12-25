"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveIstEventToDataConnect = void 0;
const app_1 = require("firebase/app");
const data_connect_1 = require("firebase/data-connect");
const functions_generated_1 = require("@dataconnect/functions-generated");
// Keep a singleton Data Connect instance
let dataConnectInstance = null;
function getOrInitDataConnect() {
    if (dataConnectInstance) {
        return dataConnectInstance;
    }
    try {
        // Ensure a default Firebase App exists
        if ((0, app_1.getApps)().length === 0) {
            const configEnv = process.env.FIREBASE_CONFIG;
            if (!configEnv) {
                // In some emulator environments, FIREBASE_CONFIG might be missing or minimal.
                // We can try a fallback or just log error.
                // For local emulator, sometimes just {} is enough if we trust the emulator config.
                console.warn('[DataConnect] Missing FIREBASE_CONFIG env var. Attempting to initialize with minimal config for emulator.');
                // Minimal config might work for emulator if it only needs project ID
                (0, app_1.initializeApp)({ projectId: process.env.GCLOUD_PROJECT || 'coursewise-f2421' });
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
        console.log('[DataConnect] Initialized Data Connect client');
        return dataConnectInstance;
    }
    catch (err) {
        console.error('[DataConnect] Failed to initialize Data Connect client', err);
        return null;
    }
}
async function saveIstEventToDataConnect(input) {
    const dc = getOrInitDataConnect();
    if (!dc) {
        console.warn('[DataConnect] Skipping saveIstEventToDataConnect because Data Connect client is not initialized');
        return;
    }
    try {
        const ref = (0, functions_generated_1.createIstEventRef)(dc, {
            userId: input.userId,
            courseId: input.courseId,
            threadId: input.threadId,
            messageId: input.messageId,
            utterance: input.utterance,
            intent: input.intent,
            skills: input.skills,
            trajectory: input.trajectory,
        });
        await (0, data_connect_1.executeMutation)(ref);
        console.log('[DataConnect] Successfully created IstEvent for messageId', input.messageId);
    }
    catch (err) {
        console.error('[DataConnect] Failed to create IstEvent for messageId', input.messageId, err);
    }
}
exports.saveIstEventToDataConnect = saveIstEventToDataConnect;
//# sourceMappingURL=istEventsClient.js.map