/**
 * Depósitos manuales con comprobante — anti-fraude
 *
 *   getDepositMethods     — catálogo de métodos (Prex, bancos, próximamente Binance/PayPal)
 *   submitDepositRequest  — usuario sube comprobante + metadata de dispositivo
 *   adminListDeposits     — cola para operadores
 *   adminReviewDeposit    — aprobar / rechazar con un clic (acredita CN)
 */
/** Métodos de ingreso — solo el servidor define alias/cuentas */
export declare const DEPOSIT_METHODS: {
    readonly prex_ars: {
        readonly id: "prex_ars";
        readonly label: "Prex / Bancos y billeteras";
        readonly subtitle: "Transferencia en pesos argentinos";
        readonly currency: "ARS";
        readonly destination: "ceroclub.sk";
        readonly destinationType: "alias";
        readonly enabled: true;
        readonly manualReview: true;
    };
    readonly prex_usd: {
        readonly id: "prex_usd";
        readonly label: "Prex — Cuenta en dólares";
        readonly subtitle: "Transferencia USD";
        readonly currency: "USD";
        readonly destination: "PREXUSD";
        readonly destinationType: "alias";
        readonly enabled: true;
        readonly manualReview: true;
    };
    readonly prex_account: {
        readonly id: "prex_account";
        readonly label: "Otras cuentas Prex";
        readonly subtitle: "Por número de cuenta Prex";
        readonly currency: "ARS/USD";
        readonly destination: "25782517";
        readonly destinationType: "account";
        readonly enabled: true;
        readonly manualReview: true;
    };
    readonly mercadopago_auto: {
        readonly id: "mercadopago_auto";
        readonly label: "Mercado Pago";
        readonly subtitle: "Pago automático con tarjeta / MP";
        readonly currency: "ARS";
        readonly destination: null;
        readonly enabled: true;
        readonly manualReview: false;
    };
    readonly binance: {
        readonly id: "binance";
        readonly label: "Binance";
        readonly subtitle: "Próximamente";
        readonly currency: "USDT";
        readonly destination: null;
        readonly enabled: false;
        readonly manualReview: true;
        readonly comingSoon: true;
    };
    readonly paypal: {
        readonly id: "paypal";
        readonly label: "PayPal";
        readonly subtitle: "Próximamente";
        readonly currency: "USD";
        readonly destination: null;
        readonly enabled: false;
        readonly manualReview: true;
        readonly comingSoon: true;
    };
};
interface DeviceFingerprint {
    deviceId?: string;
    userAgent?: string;
    platform?: string;
    os?: string;
    deviceType?: string;
    screen?: string;
    language?: string;
    isMobile?: boolean;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    timezone?: string;
}
export declare const getDepositMethods: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    ok: boolean;
    methods: {
        id: "prex_ars" | "prex_usd" | "prex_account" | "mercadopago_auto" | "binance" | "paypal";
        label: "Prex / Bancos y billeteras" | "Prex — Cuenta en dólares" | "Otras cuentas Prex" | "Mercado Pago" | "Binance" | "PayPal";
        subtitle: "Transferencia en pesos argentinos" | "Transferencia USD" | "Por número de cuenta Prex" | "Pago automático con tarjeta / MP" | "Próximamente";
        currency: "ARS" | "USD" | "ARS/USD" | "USDT";
        destination: "ceroclub.sk" | "PREXUSD" | "25782517" | null;
        destinationType: string | null;
        enabled: boolean;
        manualReview: boolean;
        comingSoon: boolean;
    }[];
}>>;
interface SubmitDepositRequest {
    methodId: string;
    coinsRequested: number;
    amountPaid?: number;
    currency?: string;
    receiptBase64: string;
    receiptName?: string;
    payerReference?: string;
    device?: DeviceFingerprint;
}
export declare const submitDepositRequest: import("firebase-functions/v2/https").CallableFunction<SubmitDepositRequest, any>;
export declare const adminListDeposits: import("firebase-functions/v2/https").CallableFunction<{
    status?: string;
    limit?: number;
}, any>;
interface ReviewDepositRequest {
    depositId: string;
    action: 'approve' | 'reject';
    adminNote?: string;
    coinsToCredit?: number;
}
export declare const adminReviewDeposit: import("firebase-functions/v2/https").CallableFunction<ReviewDepositRequest, any>;
export {};
