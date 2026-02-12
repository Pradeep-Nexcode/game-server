import { useEffect, useRef } from "react";

const Game = ({ lobbyState, session, messages, onSendMessage, onLeave }) => {
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!lobbyState) return null;

  const players = Object.values(lobbyState.players || {});

  return (
    <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-4 lg:gap-6 animate-in fade-in duration-500 h-[90vh] lg:h-[700px]">
      {/* Game Visuals (Left) */}
      <div className="flex-[2] bg-black rounded-3xl shadow-2xl border-4 border-gray-800 flex flex-col items-center justify-center relative overflow-hidden min-h-[300px] lg:min-h-full">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-transparent"></div>
        <div className="z-10 text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-black italic tracking-tighter">GAME IN PROGRESS</h2>
          <div className="flex justify-center space-x-2">
            {players.map(p => (
              <span key={p.sessionId} className={`text-[10px] font-bold px-2 py-1 rounded uppercase bg-gray-900 ${p.userId === session.user_id ? "text-blue-400 border border-blue-500/30" : "text-gray-500"}`}>
                {p.username}
              </span>
            ))}
          </div>
        </div>
        <button onClick={onLeave} className="absolute bottom-4 px-6 py-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-xl font-bold transition-all text-xs">
          Quit Match
        </button>
      </div>

      {/* Chat (Right) */}
      <div className="flex-1 bg-gray-800 p-4 lg:p-6 rounded-3xl shadow-xl border border-gray-700/50 flex flex-col min-h-[400px] lg:min-h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Game Chat</h3>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        </div>
        
        <div className="flex-1 bg-gray-900/30 rounded-2xl p-4 overflow-y-auto space-y-3 mb-4 scrollbar-thin scroll-smooth">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-600 text-xs italic">No messages yet...</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={`${m.senderId}-${m.timestamp}-${i}`} className={`flex flex-col ${m.senderId === session.user_id ? "items-end" : "items-start"}`}>
              <span className="text-[10px] font-bold text-gray-500 uppercase mb-1 px-1">{m.senderName}</span>
              <div className={`px-4 py-2 rounded-2xl text-sm break-all max-w-[90%] ${
                m.senderId === session.user_id 
                ? "bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-900/20" 
                : "bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700/50"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          const content = e.target.msg.value;
          if (content.trim()) {
            onSendMessage(content);
            e.target.reset();
          }
        }} className="flex space-x-2">
          <input 
            name="msg" 
            type="text" 
            placeholder="Type a message..." 
            autoComplete="off" 
            className="flex-1 px-4 py-3 bg-gray-900 rounded-xl border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600" 
          />
          <button type="submit" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-900/20">
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default Game;
