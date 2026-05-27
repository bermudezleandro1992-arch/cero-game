/**
 * functions/src/tournaments.ts
 *
 * Sistema de torneos para CERO.
 *
 * Esquema Firestore:
 *
 *   tournaments/{id}
 *     name:             string
 *     description:      string
 *     mode:             'classic' | 'cero'
 *     entryFee:         number          — CC para inscribirse (0 = gratis)
 *     prizePool:        number          — CC acumulados del pozo
 *     guaranteedPrize:  number          — CC garantizados por el organizador
 *     maxPlayers:       number
 *     minPlayers:       number          — mínimo para iniciar
 *     registrationDeadline: Timestamp
 *     startTime:        Timestamp       — hora programada de inicio
 *     status:           'upcoming' | 'open' | 'in_progress' | 'finished' | 'cancelled'
 *     participantIds:   string[]
 *     participantCount: number
 *     winnerId:         string | null
 *     runnerUpId:       string | null
 *     prizeDistribution: { first: number; second?: number; third?: number } (% del pozo)
 *     createdAt:        Timestamp
 *     createdBy:        string          — uid del admin
 *     finishedAt:       Timestamp | null
 *
 *   tournaments/{id}/registrations/{uid}
 *     uid:          string
 *     displayName:  string
 *     registeredAt: Timestamp
 *     seed:         number | null
 *     eliminated:   boolean
 *     position:     number | null       — posición final
 *
 * Cloud Functions exportadas:
 *   registerTournament          — jugador: inscribirse pagando entryFee
 *   cancelTournamentRegistration — jugador: cancelar (si status = 'open')
 *   awardTournamentPrizes        — admin: distribuir premios al terminar
 */
interface RegisterRequest {
    tournamentId: string;
}
interface RegisterResponse {
    ok: true;
    position: number;
    charged: boolean;
    coinsLeft: number;
}
/**
 * Inscribe al jugador en un torneo, descontando el entryFee de forma atómica.
 *
 * Condiciones para inscribirse:
 *   · status = 'open'
 *   · No inscripto previamente
 *   · registration deadline no superada
 *   · Sala no llena
 *   · Saldo >= entryFee (a menos que entryFee = 0 o sea VIP con fee <= 50)
 */
export declare const registerTournament: import("firebase-functions/v2/https").CallableFunction<RegisterRequest, Promise<RegisterResponse>>;
interface CancelRegResponse {
    ok: true;
    refunded: number;
}
/**
 * Cancela la inscripción de un jugador y devuelve el entryFee.
 * Solo disponible mientras status = 'open'.
 */
export declare const cancelTournamentRegistration: import("firebase-functions/v2/https").CallableFunction<RegisterRequest, Promise<CancelRegResponse>>;
interface AwardPrizesRequest {
    tournamentId: string;
    results: Array<{
        uid: string;
        position: number;
    }>;
}
interface AwardPrizesResponse {
    ok: true;
    awarded: Array<{
        uid: string;
        coins: number;
        position: number;
    }>;
}
/**
 * Cierra el torneo, registra los resultados y distribuye el premio.
 * Solo puede ser llamada por admins.
 *
 * `prizeDistribution` define los % para cada posición.
 * Si hay `guaranteedPrize`, se agrega al pozo antes de distribuir.
 */
export declare const awardTournamentPrizes: import("firebase-functions/v2/https").CallableFunction<AwardPrizesRequest, Promise<AwardPrizesResponse>>;
export {};
