import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './context/LanguageContext'
import LanguageSwitcher from './components/LanguageSwitcher'
import CharactersPage from './pages/CharactersPage'
import CharacterDetailPage from './pages/CharacterDetailPage'
import ReactionsPage from './pages/ReactionsPage'
import TeamsPage from './pages/TeamsPage'
import TeamBuilderPage from './pages/TeamBuilderPage'
import './styles.css'

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <nav className="nav">
          <Link to="/" className="brand">Genshin Smart Team Builder</Link>
          <div className="nav-links">
            <Link to="/">Personagens</Link>
            <Link to="/teams">Times</Link>
            <Link to="/reactions">Reações</Link>
            <LanguageSwitcher />
          </div>
        </nav>
        <main className="container">
          <Routes>
            <Route path="/" element={<CharactersPage />} />
            <Route path="/characters/:slug" element={<CharacterDetailPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/new" element={<TeamBuilderPage />} />
            <Route path="/reactions" element={<ReactionsPage />} />
          </Routes>
        </main>
      </BrowserRouter>
    </LanguageProvider>
  )
}
