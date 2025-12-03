"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirestore = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
Object.defineProperty(exports, "getFirestore", { enumerable: true, get: function () { return firestore_1.getFirestore; } });
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
//# sourceMappingURL=firebaseAdmin.js.map