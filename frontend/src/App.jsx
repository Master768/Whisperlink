import React, { useState, useEffect } from 'react';
import JoinRoom from './components/JoinRoom';
import ChatRoom from './components/ChatRoom';

function App() {
  const [roomData, setRoomData] = useState(() => {
    const saved = localStorage.getItem('whisperlink_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Controls whether we show the chat room or the join screen.
  // We keep roomData in localStorage so messages in sessionStorage can be
  // restored when the user rejoins. Only a true "leave" clears everything.
  const [viewChat, setViewChat] = useState(!!localStorage.getItem('whisperlink_session'));

  // Intercept browser back button: show join screen but keep session saved
  // so messages survive when the user goes back and then rejoins the same room.
  useEffect(() => {
    if (viewChat && roomData) {
      window.history.pushState({ inRoom: true }, '');

      const handlePopState = () => {
        // Just hide the chat view — don't clear localStorage or messages
        setViewChat(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [viewChat, roomData]);

  const handleJoin = (roomId, secretPhrase, username, createdAt) => {
    const session = { roomId, secretPhrase, username, createdAt };
    setRoomData(session);
    localStorage.setItem('whisperlink_session', JSON.stringify(session));
    setViewChat(true);
  };

  // Full leave: clears session AND stored messages
  const handleLeave = () => {
    if (roomData) {
      localStorage.removeItem(`wl_messages_${roomData.roomId}`);
      localStorage.removeItem(`wl_expiry_${roomData.roomId}`);
    }
    localStorage.removeItem('whisperlink_session');
    setRoomData(null);
    setViewChat(false);
  };

  return (
    <div className="App">
      {viewChat && roomData ? (
        <ChatRoom
          roomId={roomData.roomId}
          secretPhrase={roomData.secretPhrase}
          username={roomData.username}
          createdAt={roomData.createdAt}
          onLeave={handleLeave}
        />
      ) : (
        <JoinRoom onJoin={handleJoin} />
      )}
    </div>
  );
}

export default App;
