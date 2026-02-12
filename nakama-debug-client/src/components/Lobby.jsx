const Lobby = ({ lobbyState, session, onReady, onStart, onLeave, matchId }) => {
  // If we don't have server state yet, show a loading view
  if (!lobbyState) {
    return (
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700/50 space-y-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium animate-pulse">Synchronizing Lobby...</p>
        <p className="text-[10px] text-gray-600 font-mono break-all bg-black/20 p-2 rounded w-full text-center">
          ID: {matchId}
        </p>
      </div>
    );
  }

  const players = Object.values(lobbyState.players || {});
  const self = players.find(p => p.userId === session.user_id);
  const isHost = session.user_id === lobbyState.hostId;
  const canStart = players.length >= 2 && players.every(p => p.ready);

  return (
    <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700/50 space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="flex flex-col space-y-1">
        <h2 className="text-xl font-bold flex justify-between items-center text-gray-300">
          Lobby Room
          <span className="text-xs bg-gray-900/50 text-blue-400 px-2 py-1 rounded-md">
            {players.length}/4 Players
          </span>
        </h2>
        <p className="text-[10px] text-gray-500 font-mono break-all bg-black/20 p-1 rounded">
          ID: {matchId}
        </p>
      </div>
      
      <div className="space-y-3">
        {players.map(p => (
          <div key={p.sessionId} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-xl border border-gray-700/30">
            <div className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${p.ready ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-600"}`}></div>
              <span className={`font-medium ${p.userId === session.user_id ? "text-blue-400" : "text-gray-300"}`}>
                {p.username}
              </span>
              {p.userId === lobbyState.hostId && (
                <span className="text-[10px] bg-amber-900/30 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">HOST</span>
              )}
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${p.ready ? "text-green-500" : "text-gray-500"}`}>
              {p.ready ? "Ready" : "Waiting"}
            </span>
          </div>
        ))}
        
        {/* Placeholder slots */}
        {Array.from({ length: 4 - players.length }).map((_, i) => (
          <div key={`empty-${i}`} className="flex items-center justify-between p-3 bg-gray-900/20 rounded-xl border border-gray-700/10 opacity-30">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-gray-800"></div>
              <span className="text-gray-600 text-sm italic">Empty Slot</span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 border-t border-gray-700/50 space-y-3">
        <button 
          onClick={onReady}
          className={`w-full py-3 rounded-xl font-bold transition-all transform active:scale-95 ${
            self?.ready
            ? "bg-gray-700 text-gray-300 hover:bg-gray-600" 
            : "bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-900/20"
          }`}
        >
          {self?.ready ? "Cancel Ready" : "I'm Ready!"}
        </button>
        
        {isHost && (
          <button 
            disabled={!canStart}
            onClick={onStart}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 ${
              canStart
              ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20"
              : "bg-gray-700 cursor-not-allowed opacity-50"
            }`}
          >
            Start Match
          </button>
        )}

        <button onClick={onLeave} className="w-full py-2 text-gray-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">
          Leave Lobby
        </button>
      </div>
    </div>
  );
};

export default Lobby;
