import { Routes, Route, Link, NavLink } from 'react-router-dom'
import StudentDiagnosis from './pages/StudentDiagnosis'
import StudentBookList from './pages/StudentBookList'
import BookDetail from './pages/BookDetail'
import InstructorInput from './pages/InstructorInput'
import AdminPanel from './pages/AdminPanel'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-gray-900 text-lg">
            BG参考書DB
          </Link>
          <nav className="flex items-center gap-1">
            {[
              { to: '/', label: '診断' },
              { to: '/books', label: '一覧' },
              { to: '/instructor', label: 'レビュー投稿' },
              { to: '/admin', label: '管理者' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<StudentDiagnosis />} />
          <Route path="/books" element={<StudentBookList />} />
          <Route path="/books/:id" element={<BookDetail />} />
          <Route path="/instructor" element={<InstructorInput />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </main>
    </div>
  )
}
