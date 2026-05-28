/**
 * Notificaciones push (FCM) — guardar tokens y enviar avisos.
 */
export declare const saveFcmToken: import("firebase-functions/v2/https").CallableFunction<{
    token: string;
    action?: "add" | "remove";
}, any>;
/** Envía push a un usuario (best-effort, no lanza). */
export declare function sendPushToUser(uid: string, title: string, body: string, data?: Record<string, string>): Promise<void>;
export declare const sendTestPush: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, any>;
/** Config pública para el cliente (VAPID key, lobby, flags). */
export declare const getPublicConfig: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, any>;
