import React, { useState, useEffect } from 'react';
import JoinRoom from './components/JoinRoom';
import ChatRoom from './components/ChatRoom';

function App() {
  const [roomData, setRoomData] = useState(() => {
    const saved = localStorage.getItem('whisperlink_session');
    return saved ? JSON.parse(saved) : null;
  });

  const handleJoin = (roomId, secretPhrase, username, createdAt) => {
    const session = { roomId, secretPhrase, username, createdAt };
    setRoomData(session);
    localStorage.setItem('whisperlink_session', JSON.stringify(session));
  };

  const handleLeave = () => {
    localStorage.removeItem('whisperlink_session');
    setRoomData(null);
  };

  return (
    <div className="App">
      {!roomData ? (
        <JoinRoom onJoin={handleJoin} />
      ) : (
        <ChatRoom
          roomId={roomData.roomId}
          secretPhrase={roomData.secretPhrase}
          username={roomData.username}
          createdAt={roomData.createdAt}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}

export default App;
