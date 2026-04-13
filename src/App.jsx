import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useGameEngine } from './hooks/useGameEngine';
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';
import ElectionResults from './components/ElectionResults';
import RallyModal from './components/RallyModal';
import SettingsModal from './components/SettingsModal';
import SocialMediaModal from './components/SocialMediaModal';
import { getPartyById } from './data/parties';
import './index.css';

function AppContent() {
  const navigate = useNavigate();
  const {
    state,
    startGame,
    organizeRally,
    tvAppearance,
    socialMedia,
    advanceDay,
    dismissEvents,
    selectProvince,
    travelTo,
    buildOffice,
    buyActionPoint,
    submitRallyTopic,
    submitRallyAnswer,
    finishRally,
    toggleSettings,
    saveGame,
    loadGame,
    resetGame,
    generatePlayerSocialAI,
    socialMediaOpen,
    toggleSocialMedia,
    createPost,
    likePost,
    shareStory,
    stories,
    followerCount
  } = useGameEngine();

  // Otomatik Yönlendirme: Hafızada oyun varsa doğrudan /game'e uçur
  useEffect(() => {
    const currentPath = window.location.hash; // HashRouter'da hash'e bakarız
    if (state && state.phase !== 'results' && (!currentPath || currentPath === '#/' || currentPath === '#/singleplayer')) {
      navigate('/game', { replace: true });
    }
  }, [state, navigate]);

  const playerParty = state ? getPartyById(state.playerPartyId) : null;

  return (
    <>
      <Routes>
        <Route path="/" element={<MainMenu onStartGame={startGame} />} />
        <Route path="/singleplayer" element={<MainMenu onStartGame={startGame} initialStep={1} initialMode="single" />} />
        <Route path="/multiplayer" element={<MainMenu onStartGame={startGame} initialStep={1} initialMode="multi" />} />
        
        <Route 
          path="/game" 
          element={
            state && state.phase !== 'results' ? (
              <GameView
                state={state}
                onRally={organizeRally}
                onTV={tvAppearance}
                onSocialMedia={toggleSocialMedia}
                onAdvanceDay={advanceDay}
                onDismissEvents={dismissEvents}
                onProvinceClick={selectProvince}
                onTravel={travelTo}
                onBuild={buildOffice}
                onBuyAction={buyActionPoint}
                onToggleSettings={toggleSettings}
              />
            ) : state?.phase === 'results' ? (
              <Navigate to="/results" replace />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        <Route 
          path="/results" 
          element={
            state?.phase === 'results' ? (
              <ElectionResults
                state={state}
                onRestart={resetGame}
              />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {state && (
        <>
          <SocialMediaModal
            isOpen={socialMediaOpen}
            onClose={toggleSocialMedia}
            posts={state.posts}
            stories={stories} 
            followerCount={followerCount} 
            createPost={createPost}
            likePost={likePost}
            shareStory={shareStory}
            generateAIContent={generatePlayerSocialAI}
            playerPartyId={state.playerPartyId}
            currentDay={state.currentDay}
            lastStoryDay={state.lastStoryDay}
          />

          {state.rallyInteraction.active && (
            <RallyModal 
              interaction={state.rallyInteraction}
              party={playerParty}
              onTopicSubmit={submitRallyTopic}
              onAnswer={submitRallyAnswer}
              onFinish={finishRally}
              onClose={finishRally}
            />
          )}

          {state.showSettings && (
            <SettingsModal
              onSave={saveGame}
              onLoad={loadGame}
              onRestart={resetGame}
              onClose={toggleSettings}
            />
          )}
        </>
      )}
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
