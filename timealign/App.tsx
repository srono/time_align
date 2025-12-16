import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import Hero from './components/Hero';
import CreatePoll from './components/CreatePoll';
import ViewPoll from './components/ViewPoll';

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col font-sans">
        {/* Navbar */}
        <nav className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="flex items-center gap-2">
                  <div className="bg-brand-600 text-white p-1.5 rounded-lg">
                    <i className="fas fa-calendar-alt text-lg"></i>
                  </div>
                  <span className="font-bold text-xl text-gray-900 tracking-tight">TimeAlign</span>
                </Link>
              </div>
              <div className="flex items-center gap-4">
                 <Link to="/create" className="text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors">
                    New Poll
                 </Link>
                 <a href="#" className="text-gray-400 hover:text-gray-600">
                    <i className="fab fa-github text-xl"></i>
                 </a>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-grow bg-slate-50">
          <Routes>
            <Route path="/" element={<Hero />} />
            <Route path="/create" element={<CreatePoll />} />
            <Route path="/edit/:id" element={<CreatePoll />} />
            <Route path="/poll/:id" element={<ViewPoll />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
            <p>&copy; {new Date().getFullYear()} TimeAlign. Powered by Google Gemini.</p>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;