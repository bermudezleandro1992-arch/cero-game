import { countConnectedPlayers, getPlayerList, type RoomData } from "../types/room";

interface Props {
  room: RoomData;
}

export default function RoomStatusPanel({ room }: Props) {
  const players = getPlayerList(room.players);
  const connected = countConnectedPlayers(room.players);

  return (
    <div className="room-status">
      <div className="room-status-header">
        <span className="pill">Sala {room.code}</span>
        <span className="pill accent">{connected}/{room.maxPlayers} conectados</span>
      </div>
      <div className="players-list">
        {players.map((player) => (
          <div key={player.uid} className="player-row">
            <span className={`dot ${player.connected ? "online" : "offline"}`} />
            <span className="player-name">{player.displayName}</span>
            <span className="player-symbol">{player.symbol}</span>
            {!player.connected && <span className="player-tag">Desconectado</span>}
          </div>
        ))}
        {players.length < room.maxPlayers &&
          Array.from({ length: room.maxPlayers - players.length }).map((_, i) => (
            <div key={`empty-${i}`} className="player-row muted">
              <span className="dot offline" />
              <span className="player-name">Esperando jugador...</span>
            </div>
          ))}
      </div>
    </div>
  );
}
