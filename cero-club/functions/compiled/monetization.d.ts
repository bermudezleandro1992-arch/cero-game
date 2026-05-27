/**
 * functions/src/monetization.ts
 *
 * Monetización de CERO:
 *   · purchaseCoins        — admin: acredita Coins manualmente (bonos, refunds)
 *   · createCoinPayment    — usuario: inicia pago de Coins via Mercado Pago
 *   · activateVIP          — usuario: inicia pago del Pase VIP via Mercado Pago
 *   · mercadoPagoWebhook   — HTTP: recibe notificaciones de MP, verifica y procesa
 *   · grantMonthlyVIPCoins — Scheduler: día 1 de cada mes, acredita 500 CC a VIPs
 *
 * Variables de entorno esperadas (firebase functions:secrets:set):
 *   MERCADOPAGO_ACCESS_TOKEN  — Token de acceso (TEST-... en sandbox, APP_USR-... en prod)
 *   MERCADOPAGO_WEBHOOK_SECRET — Secret para verificar firma de webhooks
 *   APP_BASE_URL               — URL base del frontend (ej: https://cero.club)
 */
export declare const COIN_PACKAGES: {
    readonly pack_100: {
        readonly coins: 100;
        readonly bonusCoins: 0;
        readonly priceARS: 1490;
        readonly label: "100 Cero Coins";
    };
    readonly pack_500: {
        readonly coins: 500;
        readonly bonusCoins: 50;
        readonly priceARS: 5990;
        readonly label: "500 + 50 bonus";
    };
    readonly pack_1500: {
        readonly coins: 1500;
        readonly bonusCoins: 200;
        readonly priceARS: 14990;
        readonly label: "1500 + 200 bonus";
    };
    readonly pack_4000: {
        readonly coins: 4000;
        readonly bonusCoins: 600;
        readonly priceARS: 34990;
        readonly label: "4000 + 600 bonus";
    };
};
type PackageId = keyof typeof COIN_PACKAGES;
/** Regiones de pago soportadas (Fase 4 — multi-moneda) */
export declare const PAYMENT_REGIONS: {
    readonly AR: {
        readonly currency: "ARS";
        readonly label: "Argentina";
        readonly symbol: "$";
    };
    readonly UY: {
        readonly currency: "UYU";
        readonly label: "Uruguay (Prex)";
        readonly symbol: "$U";
    };
    readonly US: {
        readonly currency: "USD";
        readonly label: "Internacional";
        readonly symbol: "US$";
    };
};
type PaymentRegion = keyof typeof PAYMENT_REGIONS;
/** Precios locales por región (1 CC ≈ 1 unidad de moneda local) */
export declare const COIN_PACKAGES_BY_REGION: Record<PaymentRegion, Record<PackageId, {
    price: number;
    currency: string;
}>>;
export declare const VIP_PLANS: {
    readonly vip_monthly: {
        readonly priceARS: 5990;
        readonly durationDays: 30;
        readonly label: "Pase VIP Mensual";
        readonly monthlyCoins: 500;
    };
    readonly vip_annual: {
        readonly priceARS: 49990;
        readonly durationDays: 365;
        readonly label: "Pase VIP Anual";
        readonly monthlyCoins: 500;
    };
};
interface PurchaseCoinsRequest {
    uid: string;
    amount: number;
    reason?: string;
}
/**
 * Acredita Coins a un usuario sin cobro (bonus, compensación, setup inicial).
 * Solo puede ser llamada por operadores registrados en /admins.
 */
export declare const purchaseCoins: import("firebase-functions/v2/https").CallableFunction<PurchaseCoinsRequest, any>;
interface CreatePaymentRequest {
    packageId: string;
    region?: string;
}
interface CreatePaymentResponse {
    intentId: string;
    checkoutUrl: string;
    coins: number;
    bonusCoins: number;
    price: number;
    currency: string;
    region: string;
}
export declare const getPaymentCatalog: import("firebase-functions/v2/https").CallableFunction<{
    region?: string;
}, any>;
export declare const createCoinPayment: import("firebase-functions/v2/https").CallableFunction<CreatePaymentRequest, Promise<CreatePaymentResponse>>;
interface ActivateVIPRequest {
    planId: string;
}
interface ActivateVIPResponse {
    intentId: string;
    checkoutUrl: string;
    plan: string;
}
export declare const activateVIP: import("firebase-functions/v2/https").CallableFunction<ActivateVIPRequest, Promise<ActivateVIPResponse>>;
export declare const mercadoPagoWebhook: import("firebase-functions/v2/https").HttpsFunction;
export declare const grantMonthlyVIPCoins: import("firebase-functions/v2/scheduler").ScheduleFunction;
export {};
