import { useState } from 'react';
import TurkeyMap from './TurkeyMap';
import ActionPanel from './ActionPanel';
import DailyEvents from './DailyEvents';
import { PROVINCES } from '../data/provinces';
import './GameView.css';

export default function GameView({
  state,
  onRally,
  onTV,
  onSocialMedia,
  onAdvanceDay,
  onDismissEvents,
  onProvinceClick,
  onTravel,
  onBuild,
  onBuyAction,
  onToggleSettings,
}) {
  const [viewMode, setViewMode] = useState('votes'); // 'votes' | 'radar' | 'logistics'

  if (!state) return null;

  return (
    <div className="game-view">
      {/* Sol taraf - Harita */}
      <div className="game-map-area">
        <div className="map-top-bar">
          <div className="map-title">
            <span className="map-flag">🇹🇷</span>
            Türkiye Seçim Haritası
          </div>
          <div className="map-info">
            {state.playerLocation ? `📍 Şu anki konumunuz: ${PROVINCES.find(p => p.id === state.playerLocation)?.name.toUpperCase()}` : 'Konum belirleniyor...'}
          </div>
        </div>

        <TurkeyMap
          provinceVotes={state.provinceVotes}
          selectedProvince={state.selectedProvince}
          onProvinceClick={onProvinceClick}
          playerPartyId={state.playerPartyId}
          playerActions={state.playerActions}
          aiActions={state.aiActions}
          aiState={state.aiState}
          viewMode={viewMode}
          setViewMode={setViewMode}
          playerLocation={state.playerLocation}
          offices={state.offices}
          remotePlayers={state.remotePlayers}
        />

        {/* Bölge lejandı */}
        <div className="map-legend">
          <span className="legend-label">İllerin rengi önde olan partiyi gösterir. Altın ikon seçim aracınızın konumunu temsil eder.</span>
        </div>
      </div>

      {/* Sağ panel - Aksiyonlar */}
      <ActionPanel
        playerPartyId={state.playerPartyId}
        selectedProvince={state.selectedProvince}
        provinceVotes={state.provinceVotes}
        currentDay={state.currentDay}
        nationalVotes={state.nationalVotes}
        ralliesThisTurn={state.ralliesThisTurn}
        maxRallies={state.maxRallies}
        budget={state.budget}
        playerLocation={state.playerLocation}
        offices={state.offices}
        aiState={state.aiState}
        aiActions={state.aiActions}
        playerActions={state.playerActions}
        viewMode={viewMode}
        onRally={onRally}
        onTV={onTV}
        onSocialMedia={onSocialMedia}
        onAdvanceDay={onAdvanceDay}
        onTravel={onTravel}
        onBuild={onBuild}
        onBuyAction={onBuyAction}
        onToggleSettings={onToggleSettings}
      />

      {/* Günlük olaylar modal */}
      {state.showEvents && state.phase === 'events' && (
        <DailyEvents
          events={state.dailyEvents}
          aiActions={state.aiActions}
          currentDay={state.currentDay}
          onDismiss={onDismissEvents}
          dailyIncome={state.dailyIncome}
          dailyExpenses={state.dailyExpenses}
          dailyBulletin={state.dailyBulletin}
          isBulletinLoading={state.isBulletinLoading}
        />
      )}
    </div>
  );
}
