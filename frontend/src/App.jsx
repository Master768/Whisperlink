import React, { useState, useEffect } from 'react';
import JoinRoom from './components/JoinRoom';
import ChatRoom from './components/ChatRoom';

function App() {
  const [roomData, setRoomData] = useState(() => {
    try {
      const saved = localStorage.getItem('whisperlink_session');
      if (!saved) return null;
      
      const session = JSON.parse(saved);
      const createdAt = session.createdAt;
      
      // If session is older than 2 hours (120 minutes), clear it
      if (createdAt && Date.now() > new Date(createdAt).getTime() + 120 * 60 * 1000) {
        localStorage.removeItem('whisperlink_session');
        localStorage.removeItem(`wl_messages_${session.roomId}`);
        localStorage.removeItem(`wl_expiry_${session.roomId}`);
        return null;
      }
      
      return session;
    } catch {
      return null;
    }
  });

  const [viewChat, setViewChat] = useState(() => {
    const saved = localStorage.getItem('whisperlink_session');
    if (!saved) return false;
    try {
      const session = JSON.parse(saved);
      return (Date.now() <= new Date(session.createdAt).getTime() + 120 * 60 * 1000);
    } catch {
      return false;
    }
  });

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
