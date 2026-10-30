import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { LanguageProvider } from './context/LanguageContext'
import LanguageSwitcher from './components/LanguageSwitcher'
import ErrorBoundary from './components/ErrorBoundary'
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
import TemplateDetailPage from './pages/TemplateDetailPage'
import PlannerPage from './pages/PlannerPage'
import PlannerCharactersPage from './pages/PlannerCharactersPage'
import TierlistPage from './pages/TierlistPage'
import './styles.css'

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <nav className="nav">
          <Link to="/" className="brand">Genshin Smart Team Builder</Link>
          <div className="nav-links">
            <Link to="/">Personagens</Link>
            <Link to="/weapons">Armas</Link>
            <Link to="/artifacts">Artefatos</Link>
            <Link to="/teams">Times</Link>
            <Link to="/planner">Planejador</Link>
            <Link to="/tierlist">Tierlist</Link>
            <Link to="/reactions">Reações</Link>
            <LanguageSwitcher />
          </div>
        </nav>
        <MainContent />
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
        <Route path="/teams/templates/:id" element={<TemplateDetailPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/planner/characters" element={<PlannerCharactersPage />} />
        <Route path="/tierlist" element={<TierlistPage />} />
        <Route path="/reactions" element={<ReactionsPage />} />
      </Routes>
      </ErrorBoundary>
    </main>
  )
}
