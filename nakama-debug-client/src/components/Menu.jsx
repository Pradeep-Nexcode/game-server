const Menu = ({ onCreateMatch, onJoinMatch, inputMatchId, setInputMatchId }) => {
  return (
    <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700/50 space-y-6 animate-in fade-in zoom-in duration-300">
      <button 
        onClick={onCreateMatch}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-95"
      >
        Create Private Lobby
      </button>
      <div className="flex space-x-2">
        <input 
          type="text" 
          placeholder="Enter Match ID..." 
          value={inputMatchId}
          onChange={(e) => setInputMatchId(e.target.value)}
          className="flex-1 px-4 py-3 bg-gray-900 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition font-mono text-sm"
        />
        <button 
          onClick={() => onJoinMatch(inputMatchId)}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-95"
        >
          Join
        </button>
      </div>
    </div>
  );
};

export default Menu;
