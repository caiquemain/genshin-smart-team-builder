import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { Cloud } from 'lucide-react'
import { LanguageProvider } from './context/LanguageContext'
import LanguageSwitcher from './components/LanguageSwitcher'
import BackupSyncModal from './components/BackupSyncModal'
import ErrorBoundary from './components/ErrorBoundary'
import SpaceBackground from './components/SpaceBackground'
import { attachDriveAutoSyncListener, isDriveConnected } from './utils/google-drive-sync'
import CharactersPage from './pages/CharactersPage'
import CharacterDetailPage from './pages/CharacterDetailPage'
import ReactionsPage from './pages/ReactionsPage'
import TeamsPage from './pages/TeamsPage'
import WeaponsPage from './pages/WeaponsPage'
import ArtifactsPage from './pages/ArtifactsPage'
import ArtifactDetailPage from './pages/ArtifactDetailPage'
import WeaponDetailPage from './pages/WeaponDetailPage'
import TeamBuilderPage from './pages/TeamBuilderPage'
import TeamDetailPage from './pages/TeamDetailPage'
import PlannerPage from './pages/PlannerPage'
import RosterPage from './pages/RosterPage'
import InventoryAuditPage from './pages/InventoryAuditPage'
import PlannerCharactersPage from './pages/PlannerCharactersPage'
import TierlistPage from './pages/TierlistPage'
import PullAdvisorPage from './pages/PullAdvisorPage'
import _DebugPage from './pages/_DebugPage' // <-- ADICIONADO
import BestiaryPage from './pages/BestiaryPage';
import CommunityStatsPage from './pages/CommunityStatsPage'
import './styles.css'

export default function App() {
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [driveOn, setDriveOn] = useState(() => isDriveConnected())

  useEffect(() => {
    return attachDriveAutoSyncListener()
  }, [])

  return (
    <LanguageProvider>
      <BrowserRouter>
        <SpaceBackground />
        <nav className="nav">
          <Link to="/" className="brand">Genshin Smart Team Builder</Link>
          <div className="nav-links">
            <Link to="/">Personagens</Link>
            <Link to="/roster">Meu Roster</Link>
            <Link to="/pull-advisor">Consultor</Link>
            <Link to="/weapons">Armas</Link>
            <Link to="/artifacts">Artefatos</Link>
            <Link to="/teams">Times</Link>
            <Link to="/planner">Planejador</Link>
            <Link to="/inventory">Inventário</Link>
            <Link to="/bestiary">Bestiário</Link>
            <Link to="/tierlist">Tierlist</Link>
            <Link to="/community-stats">Comunidade</Link>
            <Link to="/reactions">Reações</Link>
            <button
              type="button"
              className={`nav-backup-btn ${driveOn ? 'is-connected' : ''}`}
              onClick={() => setShowBackupModal(true)}
              title="Backup local (.json) & Sync Google Drive"
            >
              <Cloud size={15} />
              <span>Backup</span>
            </button>
            <LanguageSwitcher />
          </div>
        </nav>
        <MainContent />
        {showBackupModal && (
          <BackupSyncModal
            onClose={() => {
              setDriveOn(isDriveConnected())
              setShowBackupModal(false)
            }}
            onRestored={() => {
              setDriveOn(isDriveConnected())
            }}
          />
        )}
      </BrowserRouter>
    </LanguageProvider>
  )
}

function MainContent() {
  const location = useLocation()
  const isWidePage = (
    (location.pathname.startsWith('/teams/') && 
     location.pathname !== '/teams/new' && 
     !location.pathname.includes('/templates/'))
    || location.pathname === '/tierlist'
    || location.pathname === '/pull-advisor'
    || location.pathname === '/consultor'
    || location.pathname === '/community-stats'
  )

  return (
    <main className={`container ${isWidePage ? 'container-wide' : ''}`}>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={<CharactersPage />} />
        <Route path="/characters/:slug" element={<CharacterDetailPage />} />
        <Route path="/weapons" element={<WeaponsPage />} />
        <Route path="/weapons/:slug" element={<WeaponDetailPage />} />
        <Route path="/artifacts" element={<ArtifactsPage />} />
        <Route path="/artifacts/:slug" element={<ArtifactDetailPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/new" element={<TeamBuilderPage />} />
        <Route path="/teams/:id" element={<TeamDetailPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/roster" element={<RosterPage />} />
        <Route path="/pull-advisor" element={<PullAdvisorPage />} />
        <Route path="/consultor" element={<PullAdvisorPage />} />
        <Route path="/inventory" element={<InventoryAuditPage />} />
        <Route path="/bestiary" element={<BestiaryPage />} />
        <Route path="/planner/characters" element={<PlannerCharactersPage />} />
        <Route path="/tierlist" element={<TierlistPage />} />
        <Route path="/community-stats" element={<CommunityStatsPage />} />
        <Route path="/reactions" element={<ReactionsPage />} />
        <Route path="/_debug" element={<_DebugPage />} /> {/* <-- ADICIONADO */}
      </Routes>
      </ErrorBoundary>
    </main>
  )
}