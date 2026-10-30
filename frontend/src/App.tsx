import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
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
            <Link to="/reactions">Reações</Link>
            <LanguageSwitcher />
          </div>
        </nav>
        <main className="container">
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
            <Route path="/reactions" element={<ReactionsPage />} />
          </Routes>
          </ErrorBoundary>
        </main>
      </BrowserRouter>
    </LanguageProvider>
  )
}
