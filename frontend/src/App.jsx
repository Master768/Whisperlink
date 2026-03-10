import React, { useState, useEffect } from 'react';
import JoinRoom from './components/JoinRoom';
import ChatRoom from './components/ChatRoom';

function App() {
  const [roomData, setRoomData] = useState(() => {
    const saved = localStorage.getItem('whisperlink_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Bug fix: intercept browser back button so it leaves the room instead of
  // navigating away (then coming back with stale session on refresh)
  useEffect(() => {
    if (roomData) {
      // Push a new history entry so the back button has something to pop
      window.history.pushState({ inRoom: true }, '');

      const handlePopState = (e) => {
        // Back button was pressed while in a room → leave the room
        handleLeave();
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [roomData]);

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
